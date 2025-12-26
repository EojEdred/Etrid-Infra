import { EventEmitter } from 'events';
import {
  IChainRelayer,
  MultiChainRelayerConfig,
  ChainDomain,
  ChainType,
  ChainConfig,
  Attestation,
  DecodedMessage,
  RelayResult,
  ServiceHealth,
  RelayStats,
  ChainRelayerStats,
} from './types';
import { EVMRelayer } from './EVMRelayer';
import { SolanaRelayer } from './SolanaRelayer';
import { SubstrateRelayer } from './SubstrateRelayer';
import { TronRelayer } from './TronRelayer';
import { RelayTracker } from './RelayTracker';

/**
 * Multi-chain relayer orchestrator
 * Routes attestations to appropriate destination chains
 * Supports: Ethereum, Solana, Substrate, Polygon, BNB, Avalanche, Arbitrum, Optimism, Tron
 */
export class MultiChainRelayer extends EventEmitter {
  private relayers: Map<number, IChainRelayer> = new Map();
  private relayTracker: RelayTracker;
  private isRunning = false;
  private startTime: number = 0;
  private retryInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  // Statistics
  private totalAttestationsProcessed = 0;
  private totalRelaysAttempted = 0;
  private totalRelaysSucceeded = 0;
  private totalRelaysFailed = 0;

  constructor(private config: MultiChainRelayerConfig) {
    super();

    // Initialize relay tracker
    this.relayTracker = new RelayTracker(
      config.maxRetries,
      config.retryDelayMs,
      config.exponentialBackoff
    );

    console.log('[MultiChainRelayer] Initialized', {
      chains: Array.from(config.chains.keys()),
      signatureThreshold: config.signatureThreshold,
      maxRetries: config.maxRetries,
    });
  }

  /**
   * Initialize and connect all chain relayers
   */
  async initialize(): Promise<void> {
    console.log('[MultiChainRelayer] Initializing chain relayers...');

    const initPromises: Promise<void>[] = [];

    for (const [domain, chainConfig] of this.config.chains.entries()) {
      if (!chainConfig.enabled) {
        console.log(`[MultiChainRelayer] Skipping disabled chain: ${chainConfig.name}`);
        continue;
      }

      initPromises.push(this.initializeChainRelayer(domain, chainConfig));
    }

    await Promise.allSettled(initPromises);

    console.log('[MultiChainRelayer] Chain relayers initialized', {
      connected: this.relayers.size,
      total: this.config.chains.size,
    });
  }

  /**
   * Initialize a specific chain relayer
   */
  private async initializeChainRelayer(
    domain: number,
    chainConfig: ChainConfig
  ): Promise<void> {
    try {
      let relayer: IChainRelayer;

      // Create appropriate relayer based on chain type
      switch (chainConfig.type) {
        case ChainType.EVM:
          relayer = new EVMRelayer(chainConfig, this.config.relayerPrivateKey);
          break;

        case ChainType.Solana:
          relayer = new SolanaRelayer(chainConfig, this.config.relayerPrivateKey);
          break;

        case ChainType.Substrate:
          relayer = new SubstrateRelayer(chainConfig, this.config.relayerPrivateKey);
          break;

        case ChainType.Tron:
          relayer = new TronRelayer(chainConfig, this.config.relayerPrivateKey);
          break;

        default:
          throw new Error(`Unsupported chain type: ${chainConfig.type}`);
      }

      // Connect to chain
      await relayer.connect();

      // Store relayer
      this.relayers.set(domain, relayer);

      console.log(`[MultiChainRelayer] Initialized ${chainConfig.name} relayer`, {
        domain,
        type: chainConfig.type,
      });
    } catch (error: any) {
      console.error(`[MultiChainRelayer] Failed to initialize ${chainConfig.name}`, {
        domain,
        error: error?.message,
      });
      // Don't throw - allow other chains to initialize
    }
  }

  /**
   * Start the multi-chain relayer
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      console.warn('[MultiChainRelayer] Already running');
      return;
    }

    console.log('[MultiChainRelayer] Starting...');

    this.isRunning = true;
    this.startTime = Date.now();

    // Start retry interval for failed/pending relays
    this.retryInterval = setInterval(async () => {
      await this.processRetries();
    }, this.config.retryDelayMs);

    // Start cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 3600000); // Every hour

    console.log('[MultiChainRelayer] Started successfully');
  }

  /**
   * Stop the multi-chain relayer
   */
  async stop(): Promise<void> {
    console.log('[MultiChainRelayer] Stopping...');

    this.isRunning = false;

    // Stop intervals
    if (this.retryInterval) {
      clearInterval(this.retryInterval);
      this.retryInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Disconnect all relayers
    const disconnectPromises: Promise<void>[] = [];

    for (const [domain, relayer] of this.relayers.entries()) {
      disconnectPromises.push(
        relayer.disconnect().catch((error) => {
          console.error(`[MultiChainRelayer] Error disconnecting from domain ${domain}`, error);
        })
      );
    }

    await Promise.allSettled(disconnectPromises);

    this.relayers.clear();

    console.log('[MultiChainRelayer] Stopped successfully');
  }

  /**
   * Process a new attestation
   */
  async processAttestation(attestation: Attestation): Promise<void> {
    const { messageHash, message, signatures, signatureCount, thresholdMet } = attestation;

    console.log('[MultiChainRelayer] Processing attestation', {
      messageHash,
      signatureCount,
      thresholdMet,
    });

    this.totalAttestationsProcessed++;

    // Validate signature threshold
    if (!thresholdMet || signatureCount < this.config.signatureThreshold) {
      console.warn('[MultiChainRelayer] Signature threshold not met', {
        messageHash,
        signatureCount,
        threshold: this.config.signatureThreshold,
      });
      return;
    }

    // Check if already relayed
    if (this.relayTracker.isRelayed(messageHash)) {
      console.log('[MultiChainRelayer] Message already relayed', { messageHash });
      return;
    }

    // Check if currently relaying
    if (this.relayTracker.isRelaying(messageHash)) {
      console.log('[MultiChainRelayer] Message currently being relayed', { messageHash });
      return;
    }

    // Check if can retry
    if (!this.relayTracker.canRetry(messageHash)) {
      console.log('[MultiChainRelayer] Message cannot be retried yet', { messageHash });
      return;
    }

    // Decode message to determine destination
    const decoded = this.decodeMessage(message);

    if (!decoded) {
      console.error('[MultiChainRelayer] Failed to decode message', { messageHash });
      return;
    }

    console.log('[MultiChainRelayer] Decoded message', {
      messageHash,
      sourceDomain: decoded.sourceDomain,
      destinationDomain: decoded.destinationDomain,
      nonce: decoded.nonce.toString(),
    });

    // Create relay tracking
    this.relayTracker.createRelay(
      messageHash,
      decoded.sourceDomain,
      decoded.destinationDomain,
      decoded.nonce
    );

    // Relay to destination chain
    await this.relayToChain(decoded.destinationDomain, attestation);
  }

  /**
   * Relay message to a specific chain
   */
  private async relayToChain(domain: number, attestation: Attestation): Promise<void> {
    const { messageHash } = attestation;

    // Get relayer for destination chain
    const relayer = this.relayers.get(domain);

    if (!relayer) {
      const error = `No relayer configured for domain ${domain}`;
      console.error(`[MultiChainRelayer] ${error}`, { messageHash });

      const result: RelayResult = {
        success: false,
        messageHash,
        chain: `Unknown (${domain})`,
        chainDomain: domain,
        error,
        timestamp: Date.now(),
      };

      this.relayTracker.markFailed(messageHash, result);
      this.totalRelaysFailed++;
      this.emit('relayFailed', result);
      return;
    }

    this.totalRelaysAttempted++;

    const startTime = Date.now();

    try {
      console.log(`[MultiChainRelayer] Relaying to ${relayer.chainName}`, {
        messageHash,
        domain,
      });

      // Relay message
      const result = await relayer.relayMessage(attestation);

      const duration = (Date.now() - startTime) / 1000;

      if (result.success) {
        this.totalRelaysSucceeded++;
        this.relayTracker.markSuccess(messageHash, result);
        this.emit('relaySuccess', result, duration);

        console.log(`[MultiChainRelayer] Successfully relayed to ${relayer.chainName}`, {
          messageHash,
          txHash: result.txHash,
          duration: `${duration}s`,
        });
      } else {
        this.totalRelaysFailed++;
        this.relayTracker.markFailed(messageHash, result);
        this.emit('relayFailed', result);

        console.error(`[MultiChainRelayer] Failed to relay to ${relayer.chainName}`, {
          messageHash,
          error: result.error,
          duration: `${duration}s`,
        });
      }
    } catch (error: any) {
      this.totalRelaysFailed++;

      const result: RelayResult = {
        success: false,
        messageHash,
        chain: relayer.chainName,
        chainDomain: domain,
        error: error?.message || String(error),
        timestamp: Date.now(),
      };

      this.relayTracker.markFailed(messageHash, result);
      this.emit('relayFailed', result);

      console.error(`[MultiChainRelayer] Exception relaying to ${relayer.chainName}`, {
        messageHash,
        error: error?.message,
      });
    }
  }

  /**
   * Process pending retries
   */
  private async processRetries(): Promise<void> {
    const pendingRelays = this.relayTracker.getPendingRelays();

    if (pendingRelays.length === 0) {
      return;
    }

    console.log('[MultiChainRelayer] Processing retries', {
      count: pendingRelays.length,
    });

    for (const relay of pendingRelays) {
      // Reconstruct attestation from relay data
      // Note: In production, you'd want to refetch from attestation service
      // For now, we'll skip retries that don't have full data
      console.log('[MultiChainRelayer] Retry needed for relay', {
        messageHash: relay.messageHash,
        attempts: relay.attempts,
      });

      // Emit event to fetch attestation and retry
      this.emit('retryNeeded', relay);
    }
  }

  /**
   * Cleanup old relay records
   */
  private cleanup(): void {
    const cleaned = this.relayTracker.cleanup();

    if (cleaned > 0) {
      console.log('[MultiChainRelayer] Cleanup completed', { relaysCleaned: cleaned });
    }
  }

  /**
   * Decode message to extract routing information
   */
  private decodeMessage(messageHex: string): DecodedMessage | null {
    try {
      const message = messageHex.startsWith('0x') ? messageHex.slice(2) : messageHex;

      // Message format: [sourceDomain(4), destDomain(4), nonce(8), sender(32), recipient(32), amount(16), payload(...)]
      // All values are hex-encoded

      if (message.length < 96) {
        // Minimum: 4+4+8+32+32 = 80 bytes = 160 hex chars
        console.error('[MultiChainRelayer] Message too short', {
          length: message.length,
          expected: 96,
        });
        return null;
      }

      // Source domain (bytes 0-4, 8 hex chars)
      const sourceDomainHex = message.slice(0, 8);
      const sourceDomain = parseInt(sourceDomainHex, 16);

      // Destination domain (bytes 4-8, 8 hex chars)
      const destDomainHex = message.slice(8, 16);
      const destinationDomain = parseInt(destDomainHex, 16);

      // Nonce (bytes 8-16, 16 hex chars)
      const nonceHex = message.slice(16, 32);
      const nonce = BigInt('0x' + nonceHex);

      // Sender (bytes 16-48, 64 hex chars)
      const sender = '0x' + message.slice(32, 96);

      // Recipient (bytes 48-80, 64 hex chars)
      const recipient = '0x' + message.slice(96, 160);

      // Amount (bytes 80-96, 32 hex chars) - optional
      let amount: bigint | undefined;
      if (message.length >= 192) {
        const amountHex = message.slice(160, 192);
        amount = BigInt('0x' + amountHex);
      }

      // Payload (remaining bytes) - optional
      let payload: string | undefined;
      if (message.length > 192) {
        payload = '0x' + message.slice(192);
      }

      return {
        sourceDomain,
        destinationDomain,
        nonce,
        sender,
        recipient,
        amount,
        payload,
      };
    } catch (error: any) {
      console.error('[MultiChainRelayer] Failed to decode message', {
        messageHex,
        error: error?.message,
      });
      return null;
    }
  }

  /**
   * Get service health
   */
  getHealth(): ServiceHealth {
    const stats = this.relayTracker.getStats();

    const chains: ServiceHealth['chains'] = {};

    for (const [domain, relayer] of this.relayers.entries()) {
      const relayerStats = relayer.getStats();
      chains[domain] = {
        name: relayerStats.chainName,
        connected: relayerStats.isConnected,
        currentBlock: relayerStats.currentBlock,
        balance: relayerStats.balance,
      };
    }

    const status =
      this.relayers.size === 0
        ? 'unhealthy'
        : this.relayers.size < this.config.chains.size / 2
        ? 'degraded'
        : 'healthy';

    return {
      status,
      uptime: Date.now() - this.startTime,
      totalRelays: this.totalRelaysAttempted,
      successfulRelays: this.totalRelaysSucceeded,
      failedRelays: this.totalRelaysFailed,
      pendingRelays: stats.pending,
      chains,
      attestationServices: {},
    };
  }

  /**
   * Get relay statistics
   */
  getStats(): RelayStats {
    return this.relayTracker.getStats();
  }

  /**
   * Get chain relayer statistics
   */
  getChainStats(): ChainRelayerStats[] {
    const stats: ChainRelayerStats[] = [];

    for (const relayer of this.relayers.values()) {
      stats.push(relayer.getStats());
    }

    return stats;
  }

  /**
   * Get relay by message hash
   */
  getRelay(messageHash: string) {
    return this.relayTracker.getRelay(messageHash);
  }

  /**
   * Get relay by nonce
   */
  getRelayByNonce(sourceDomain: number, nonce: bigint) {
    return this.relayTracker.getRelayByNonce(sourceDomain, nonce);
  }

  /**
   * Check if a specific chain is connected
   */
  isChainConnected(domain: number): boolean {
    const relayer = this.relayers.get(domain);
    return relayer ? relayer.isConnected() : false;
  }

  /**
   * Get relayer for a specific chain
   */
  getRelayer(domain: number): IChainRelayer | undefined {
    return this.relayers.get(domain);
  }

  /**
   * Get all connected chains
   */
  getConnectedChains(): number[] {
    return Array.from(this.relayers.keys());
  }

  /**
   * Estimate gas for relaying to a specific chain
   */
  async estimateGas(domain: number, attestation: Attestation): Promise<bigint> {
    const relayer = this.relayers.get(domain);

    if (!relayer) {
      throw new Error(`No relayer for domain ${domain}`);
    }

    return await relayer.estimateGas(attestation);
  }

  /**
   * Get total statistics
   */
  getTotalStats() {
    const relayStats = this.getStats();
    const chainStats = this.getChainStats();
    const retryStats = this.relayTracker.getRetryStats();

    return {
      attestations: {
        processed: this.totalAttestationsProcessed,
      },
      relays: {
        attempted: this.totalRelaysAttempted,
        succeeded: this.totalRelaysSucceeded,
        failed: this.totalRelaysFailed,
      },
      tracking: relayStats,
      retries: retryStats,
      chains: chainStats,
    };
  }
}
