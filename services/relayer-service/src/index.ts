import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { RelayerConfig, Attestation } from './types';
import { AttestationFetcher } from './fetchers/AttestationFetcher';
import { EthereumRelayer } from './relayers/EthereumRelayer';
import { SubstrateRelayer } from './relayers/SubstrateRelayer';
import { RelayTracker } from './utils/RelayTracker';
import { ApiServer } from './api/server';
import {
  updateBalances,
  attestationsReady,
  recordSuccessfulRelay,
  recordFailedRelay,
} from './metrics';

// Load environment variables
dotenv.config();

/**
 * Main relayer service orchestrator
 * Fetches attestations and relays messages to destination chains
 */
class RelayerService {
  private config: RelayerConfig;
  private attestationFetcher: AttestationFetcher;
  private ethereumRelayer: EthereumRelayer;
  private substrateRelayer: SubstrateRelayer;
  private relayTracker: RelayTracker;
  private apiServer: ApiServer;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private balanceCheckInterval: NodeJS.Timeout | null = null;
  private startTime: number;

  constructor() {
    // Load configuration from environment
    this.config = this.loadConfig();
    this.startTime = Date.now();

    // Initialize components
    this.attestationFetcher = new AttestationFetcher(this.config);
    this.ethereumRelayer = new EthereumRelayer(this.config);
    this.substrateRelayer = new SubstrateRelayer(this.config);
    this.relayTracker = new RelayTracker(
      this.config.maxRetries,
      this.config.retryDelayMs
    );
    this.apiServer = new ApiServer(this.config);

    // Wire up event handlers
    this.setupEventHandlers();
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfig(): RelayerConfig {
    const config: RelayerConfig = {
      // Attestation services (comma-separated list)
      attestationServiceUrls: (
        process.env.ATTESTATION_SERVICE_URLS || 'http://localhost:3000'
      ).split(','),

      // Chain connections
      substrateWsUrl: process.env.SUBSTRATE_WS_URL || 'ws://localhost:9944',
      ethereumRpcUrl: process.env.ETHEREUM_RPC_URL || 'http://localhost:8545',

      // Relayer identity
      relayerPrivateKey: process.env.RELAYER_PRIVATE_KEY || '',
      relayerAddress: process.env.RELAYER_ADDRESS || '',

      // Contract addresses
      messageTransmitterAddress: process.env.MESSAGE_TRANSMITTER_ADDRESS,
      tokenMessengerAddress: process.env.TOKEN_MESSENGER_ADDRESS,

      // Polling settings
      pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '30000'), // 30 seconds
      maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
      retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '60000'), // 1 minute

      // Gas settings (Ethereum)
      gasLimit: process.env.GAS_LIMIT,
      maxFeePerGas: process.env.MAX_FEE_PER_GAS,
      maxPriorityFeePerGas: process.env.MAX_PRIORITY_FEE_PER_GAS,

      // API settings
      enableApi: process.env.ENABLE_API === 'true',
      apiPort: parseInt(process.env.API_PORT || '3001'),
    };

    // Validate required fields
    if (!config.relayerPrivateKey) {
      throw new Error('RELAYER_PRIVATE_KEY is required');
    }

    logger.info('Configuration loaded', {
      attestationServices: config.attestationServiceUrls,
      substrateWsUrl: config.substrateWsUrl,
      ethereumRpcUrl: config.ethereumRpcUrl,
      relayerAddress: config.relayerAddress,
      pollIntervalMs: config.pollIntervalMs,
      maxRetries: config.maxRetries,
    });

    return config;
  }

  /**
   * Setup event handlers to connect fetcher with relayers
   */
  private setupEventHandlers(): void {
    // Handle new attestations
    this.attestationFetcher.on('newAttestation', async (attestation: Attestation) => {
      try {
        await this.handleNewAttestation(attestation);
      } catch (error) {
        logger.error('Error handling new attestation', error);
      }
    });

    // Handle fetcher errors
    this.attestationFetcher.on('error', (error: Error) => {
      logger.error('Attestation fetcher error', error);
    });

    logger.info('Event handlers configured');
  }

  /**
   * Handle a new attestation
   */
  private async handleNewAttestation(attestation: Attestation): Promise<void> {
    const { messageHash, message, signatures } = attestation;

    logger.info('Processing new attestation', {
      messageHash,
      signatureCount: signatures.length,
    });

    // Check if already relayed
    if (this.relayTracker.isRelayed(messageHash)) {
      logger.info('Message already relayed', { messageHash });
      return;
    }

    // Check if currently relaying
    if (this.relayTracker.isRelaying(messageHash)) {
      logger.info('Message currently being relayed', { messageHash });
      return;
    }

    // Check if can retry
    if (!this.relayTracker.canRetry(messageHash)) {
      logger.info('Message cannot be retried yet', { messageHash });
      return;
    }

    // Decode message to determine destination domain
    // For now, we'll attempt to relay to both chains and let them determine validity
    const destinationDomain = this.extractDestinationDomain(message);

    if (destinationDomain === null) {
      logger.error('Could not determine destination domain', { messageHash });
      return;
    }

    // Extract source domain and nonce for tracking
    const sourceDomain = this.extractSourceDomain(message);
    const nonce = this.extractNonce(message);

    // Create relay status
    this.relayTracker.createRelay(
      messageHash,
      sourceDomain || 0,
      destinationDomain,
      nonce || 0n
    );

    // Relay to appropriate chain
    if (destinationDomain === 0) {
      // Destination is Ethereum
      await this.relayToEthereum(attestation);
    } else if (destinationDomain === 2) {
      // Destination is Ëtrid
      await this.relayToSubstrate(attestation);
    } else {
      logger.error('Unsupported destination domain', {
        messageHash,
        destinationDomain,
      });
      this.relayTracker.markFailed(
        messageHash,
        `Unsupported destination domain: ${destinationDomain}`
      );
    }
  }

  /**
   * Relay message to Ethereum
   */
  private async relayToEthereum(attestation: Attestation): Promise<void> {
    const { messageHash } = attestation;
    const startTime = Date.now();

    try {
      logger.info('Relaying to Ethereum', { messageHash });

      const result = await this.ethereumRelayer.relayMessage(attestation);

      if (result.success) {
        const duration = (Date.now() - startTime) / 1000;
        this.relayTracker.markSuccess(messageHash, result.txHash || '');
        recordSuccessfulRelay('ethereum', duration);
        logger.info('Successfully relayed to Ethereum', {
          messageHash,
          txHash: result.txHash,
        });
      } else {
        this.relayTracker.markFailed(messageHash, result.error || 'Unknown error');
        recordFailedRelay('ethereum', result.error || 'unknown');
        logger.error('Failed to relay to Ethereum', {
          messageHash,
          error: result.error,
        });
      }
    } catch (error: any) {
      this.relayTracker.markFailed(messageHash, error?.message || String(error));
      recordFailedRelay('ethereum', error?.message || 'exception');
      logger.error('Exception relaying to Ethereum', {
        messageHash,
        error: error?.message,
      });
    }
  }

  /**
   * Relay message to Substrate
   */
  private async relayToSubstrate(attestation: Attestation): Promise<void> {
    const { messageHash } = attestation;
    const startTime = Date.now();

    try {
      logger.info('Relaying to Substrate', { messageHash });

      const result = await this.substrateRelayer.relayMessage(attestation);

      if (result.success) {
        const duration = (Date.now() - startTime) / 1000;
        this.relayTracker.markSuccess(messageHash, result.txHash || '');
        recordSuccessfulRelay('substrate', duration);
        logger.info('Successfully relayed to Substrate', {
          messageHash,
          txHash: result.txHash,
        });
      } else {
        this.relayTracker.markFailed(messageHash, result.error || 'Unknown error');
        recordFailedRelay('substrate', result.error || 'unknown');
        logger.error('Failed to relay to Substrate', {
          messageHash,
          error: result.error,
        });
      }
    } catch (error: any) {
      this.relayTracker.markFailed(messageHash, error?.message || String(error));
      recordFailedRelay('substrate', error?.message || 'exception');
      logger.error('Exception relaying to Substrate', {
        messageHash,
        error: error?.message,
      });
    }
  }

  /**
   * Extract destination domain from message
   * Message format: [sourceDomain(4), destDomain(4), nonce(8), sender(32), recipient(32), amount(16)]
   */
  private extractDestinationDomain(messageHex: string): number | null {
    try {
      const message = messageHex.startsWith('0x')
        ? messageHex.slice(2)
        : messageHex;

      // Destination domain is bytes 4-8 (little-endian u32)
      const destDomainHex = message.slice(8, 16);
      const destDomain = parseInt(destDomainHex, 16);

      return destDomain;
    } catch (error) {
      logger.error('Failed to extract destination domain', { messageHex, error });
      return null;
    }
  }

  /**
   * Extract source domain from message
   */
  private extractSourceDomain(messageHex: string): number | null {
    try {
      const message = messageHex.startsWith('0x')
        ? messageHex.slice(2)
        : messageHex;

      // Source domain is bytes 0-4 (little-endian u32)
      const sourceDomainHex = message.slice(0, 8);
      const sourceDomain = parseInt(sourceDomainHex, 16);

      return sourceDomain;
    } catch (error) {
      logger.error('Failed to extract source domain', { messageHex, error });
      return null;
    }
  }

  /**
   * Extract nonce from message
   */
  private extractNonce(messageHex: string): bigint | null {
    try {
      const message = messageHex.startsWith('0x')
        ? messageHex.slice(2)
        : messageHex;

      // Nonce is bytes 8-16 (little-endian u64)
      const nonceHex = message.slice(16, 32);
      const nonce = BigInt('0x' + nonceHex);

      return nonce;
    } catch (error) {
      logger.error('Failed to extract nonce', { messageHex, error });
      return null;
    }
  }

  /**
   * Start the relayer service
   */
  async start(): Promise<void> {
    logger.info('Starting relayer service...');

    try {
      // Connect to chains
      await this.ethereumRelayer.connect();
      logger.info('Connected to Ethereum');

      await this.substrateRelayer.connect();
      logger.info('Connected to Substrate');

      // Start attestation fetcher
      await this.attestationFetcher.start();
      logger.info('Attestation fetcher started');

      // Start API server (if enabled)
      if (this.config.enableApi) {
        await this.apiServer.start();
        logger.info('API server started');
      }

      // Start periodic cleanup
      this.cleanupInterval = setInterval(() => {
        const relaysCleaned = this.relayTracker.cleanup();
        const seenCleaned = this.attestationFetcher.clearSeen();

        if (relaysCleaned > 0 || seenCleaned > 0) {
          logger.info('Cleanup completed', { relaysCleaned, seenCleaned });
        }
      }, 3600000); // Every hour

      // Start periodic balance checking for metrics
      this.balanceCheckInterval = setInterval(async () => {
        await this.updateBalanceMetrics();
      }, 60000); // Every minute

      // Initial balance update
      await this.updateBalanceMetrics();

      logger.info('Relayer service started successfully', {
        relayerAddress: this.config.relayerAddress,
      });

      // Log balances
      await this.logBalances();
    } catch (error) {
      logger.error('Failed to start relayer service', error);
      throw error;
    }
  }

  /**
   * Stop the relayer service
   */
  async stop(): Promise<void> {
    logger.info('Stopping relayer service...');

    try {
      // Stop cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }

      // Stop balance check interval
      if (this.balanceCheckInterval) {
        clearInterval(this.balanceCheckInterval);
        this.balanceCheckInterval = null;
      }

      // Stop API server
      if (this.config.enableApi) {
        await this.apiServer.stop();
        logger.info('API server stopped');
      }

      // Stop attestation fetcher
      await this.attestationFetcher.stop();
      logger.info('Attestation fetcher stopped');

      // Disconnect from chains
      await this.substrateRelayer.disconnect();
      logger.info('Disconnected from Substrate');

      await this.ethereumRelayer.disconnect();
      logger.info('Disconnected from Ethereum');

      logger.info('Relayer service stopped successfully');
    } catch (error) {
      logger.error('Error stopping relayer service', error);
      throw error;
    }
  }

  /**
   * Update balance metrics
   */
  private async updateBalanceMetrics(): Promise<void> {
    try {
      const ethBalance = await this.ethereumRelayer.getBalance();
      const substrateBalance = await this.substrateRelayer.getBalance();

      // Convert to human-readable numbers
      const ethFormatted = parseFloat(ethBalance.toString()) / 1e18;
      const edscFormatted = parseFloat(substrateBalance.toString()) / 1e12;

      updateBalances(ethFormatted, edscFormatted);
    } catch (error) {
      logger.error('Error updating balance metrics', error);
    }
  }

  /**
   * Log current balances
   */
  private async logBalances(): Promise<void> {
    try {
      const ethBalance = await this.ethereumRelayer.getBalance();
      const substrateBalance = await this.substrateRelayer.getBalance();

      logger.info('Relayer balances', {
        ethereum: ethBalance.toString(),
        substrate: substrateBalance.toString(),
      });
    } catch (error) {
      logger.error('Error getting balances', error);
    }
  }

  /**
   * Get service statistics
   */
  getStats() {
    return {
      uptime: Date.now() - this.startTime,
      relays: this.relayTracker.getStats(),
      ethereum: this.ethereumRelayer.getStats(),
      substrate: this.substrateRelayer.getStats(),
      fetcher: this.attestationFetcher.getStatus(),
    };
  }
}

/**
 * Main entry point
 */
async function main() {
  logger.info('Starting EDSC Relayer Service');

  const service = new RelayerService();

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    try {
      await service.stop();
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { reason, promise });
    shutdown('unhandledRejection');
  });

  try {
    await service.start();

    // Log statistics periodically
    setInterval(() => {
      const stats = service.getStats();
      logger.info('Service statistics', stats);
    }, 300000); // Every 5 minutes
  } catch (error) {
    logger.error('Failed to start service', error);
    process.exit(1);
  }
}

// Start the service
main().catch((error) => {
  logger.error('Fatal error', error);
  process.exit(1);
});
