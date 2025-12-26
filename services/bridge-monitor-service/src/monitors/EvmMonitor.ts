/**
 * Generic EVM Chain Monitor for Bridge Operations
 *
 * Supports: Ethereum, BNB Chain, Polygon, Arbitrum, Base
 *
 * Features:
 * - Ethers.js v6 with JsonRpcProvider
 * - TokenMessenger MessageSent event subscription
 * - Configurable confirmation requirements per chain
 * - Native token and ERC-20 deposit handling
 * - Chain-specific gas and block time handling
 * - Auto-reconnect on provider disconnect
 * - Batch event queries for efficiency
 * - Prometheus metrics per chain
 * - Multiple RPC fallback support
 */

import { ethers } from 'ethers';
import { EventEmitter } from 'events';
import { EvmChainConfig } from '../config/evm-chains';
import { logger } from '../utils/logger';
import {
  evmConnected,
  evmBlockHeight,
  evmLastBlockTimestamp,
  evmMessagesSeen,
  evmErrors,
  recordError,
} from '../metrics';

/**
 * EVM deposit event (native token or ERC-20)
 */
export interface EvmDepositEvent {
  // Event data
  nonce: bigint;
  destinationDomain: number;
  amount: bigint;
  sender: string;
  recipient: Uint8Array;

  // Transaction metadata
  blockNumber: number;
  transactionHash: string;
  timestamp: number;

  // Chain context
  chainId: number;
  chainName: string;

  // Token information
  isNativeToken: boolean;
  tokenAddress?: string; // ERC-20 contract address
  tokenSymbol?: string;
}

/**
 * Monitor status interface
 */
export interface MonitorStatus {
  isRunning: boolean;
  chainId: number;
  chainName: string;
  currentBlock: number;
  lastProcessedBlock: number;
  eventsProcessed: number;
  errors: number;
  lastError?: string;
  lastErrorTime?: number;
  rpcIndex: number; // Current RPC endpoint index
  reconnectCount: number;
}

/**
 * TokenMessenger ABI - MessageSent event
 */
const TOKEN_MESSENGER_ABI = [
  'event MessageSent(bytes message)',
  'function depositForBurn(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken) external returns (uint64 nonce)',
  'function depositForBurnWithCaller(uint256 amount, uint32 destinationDomain, bytes32 mintRecipient, address burnToken, bytes32 destinationCaller) external returns (uint64 nonce)',
];

/**
 * MessageTransmitter ABI - for decoding message details
 */
const MESSAGE_TRANSMITTER_ABI = [
  'event MessageSent(bytes message)',
  'function sendMessage(uint32 destinationDomain, bytes32 recipient, bytes calldata messageBody) external returns (uint64)',
  'function receiveMessage(bytes calldata message, bytes calldata attestation) external returns (bool success)',
];

/**
 * ERC-20 Token ABI (minimal)
 */
const ERC20_ABI = [
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
];

/**
 * Generic EVM Monitor for all supported chains
 */
export class EvmMonitor extends EventEmitter {
  private config: EvmChainConfig;
  private provider: ethers.JsonRpcProvider | null = null;
  private tokenMessenger: ethers.Contract | null = null;
  private isRunning = false;
  private lastProcessedBlock = 0;
  private currentBlock = 0;
  private eventsProcessed = 0;
  private errors = 0;
  private lastError?: string;
  private lastErrorTime?: number;
  private currentRpcIndex = 0;
  private reconnectCount = 0;
  private pollingInterval?: NodeJS.Timeout;
  private blockSubscription?: any;

  // Token cache for ERC-20 metadata
  private tokenCache: Map<string, { symbol: string; decimals: number }> = new Map();

  constructor(config: EvmChainConfig) {
    super();
    this.config = config;
  }

  /**
   * Start monitoring the EVM chain
   */
  async start(): Promise<void> {
    logger.info(`Starting ${this.config.name} monitor...`, {
      chainId: this.config.chainId,
      domain: this.config.domain,
      confirmations: this.config.confirmations,
    });

    try {
      // Connect to RPC provider
      await this.connectProvider();

      // Get network info
      const network = await this.provider!.getNetwork();
      const blockNumber = await this.provider!.getBlockNumber();

      logger.info(`Connected to ${this.config.name}`, {
        chainId: network.chainId.toString(),
        blockNumber,
        rpcUrl: this.config.rpcUrls[this.currentRpcIndex],
      });

      // Verify chain ID matches
      if (Number(network.chainId) !== this.config.chainId) {
        throw new Error(
          `Chain ID mismatch: expected ${this.config.chainId}, got ${network.chainId}`
        );
      }

      // Initialize TokenMessenger contract
      this.tokenMessenger = new ethers.Contract(
        this.config.tokenMessengerAddress,
        TOKEN_MESSENGER_ABI,
        this.provider!
      );

      // Get starting block (current - 100 for safety)
      this.lastProcessedBlock = Math.max(0, blockNumber - 100);
      this.currentBlock = blockNumber;

      // Start monitoring strategy based on WebSocket support
      if (this.config.supportsWebSocket && this.config.wsUrls && this.config.wsUrls.length > 0) {
        await this.startWebSocketMonitoring();
      } else {
        await this.startPollingMonitoring();
      }

      this.isRunning = true;
      evmConnected.set({ chain: this.config.shortName }, 1);
      this.emit('started');

      logger.info(`${this.config.name} monitor started`, {
        startBlock: this.lastProcessedBlock,
        pollingInterval: this.config.pollingInterval,
      });
    } catch (error) {
      logger.error(`Failed to start ${this.config.name} monitor`, error);
      evmConnected.set({ chain: this.config.shortName }, 0);
      recordError('evm_connection', this.config.shortName);
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Connect to RPC provider with fallback support
   */
  private async connectProvider(): Promise<void> {
    let lastError: Error | null = null;

    for (let i = 0; i < this.config.rpcUrls.length; i++) {
      const rpcUrl = this.config.rpcUrls[i];
      this.currentRpcIndex = i;

      try {
        logger.info(`Attempting connection to ${this.config.name} RPC ${i + 1}/${this.config.rpcUrls.length}`, {
          rpcUrl,
        });

        this.provider = new ethers.JsonRpcProvider(rpcUrl, this.config.chainId, {
          staticNetwork: true, // Performance optimization
        });

        // Test connection
        await this.provider.getBlockNumber();

        logger.info(`Successfully connected to ${this.config.name} RPC`, {
          rpcUrl,
          rpcIndex: i,
        });

        return;
      } catch (error) {
        lastError = error as Error;
        logger.warn(`Failed to connect to ${this.config.name} RPC ${i + 1}`, {
          rpcUrl,
          error: (error as Error).message,
        });

        this.provider = null;
        continue;
      }
    }

    throw new Error(
      `Failed to connect to any ${this.config.name} RPC: ${lastError?.message || 'Unknown error'}`
    );
  }

  /**
   * Start WebSocket-based monitoring (real-time)
   */
  private async startWebSocketMonitoring(): Promise<void> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    logger.info(`Starting WebSocket monitoring for ${this.config.name}`);

    // Subscribe to new blocks
    this.blockSubscription = this.provider.on('block', async (blockNumber: number) => {
      try {
        this.currentBlock = blockNumber;

        // Wait for required confirmations
        const confirmedBlock = blockNumber - this.config.confirmations;

        if (confirmedBlock > this.lastProcessedBlock) {
          await this.processBlockRange(this.lastProcessedBlock + 1, confirmedBlock);
          this.lastProcessedBlock = confirmedBlock;

          // Update metrics
          evmBlockHeight.set({ chain: this.config.shortName }, confirmedBlock);
          evmLastBlockTimestamp.set({ chain: this.config.shortName }, Date.now() / 1000);
        }
      } catch (error) {
        logger.error(`Error processing ${this.config.name} block`, {
          blockNumber,
          error,
        });
        this.handleError(error);

        // Attempt reconnection on persistent errors
        if (this.errors > 5) {
          await this.reconnect();
        }
      }
    });

    // Handle provider errors
    this.provider.on('error', async (error) => {
      logger.error(`${this.config.name} provider error`, { error });
      this.handleError(error);
      await this.reconnect();
    });
  }

  /**
   * Start polling-based monitoring (fallback)
   */
  private async startPollingMonitoring(): Promise<void> {
    logger.info(`Starting polling monitoring for ${this.config.name}`, {
      interval: this.config.pollingInterval,
    });

    this.pollingInterval = setInterval(async () => {
      try {
        if (!this.provider) {
          logger.warn(`${this.config.name} provider not initialized, skipping poll`);
          return;
        }

        // Get current block
        const currentBlock = await this.provider.getBlockNumber();
        this.currentBlock = currentBlock;

        // Calculate confirmed block
        const confirmedBlock = currentBlock - this.config.confirmations;

        if (confirmedBlock > this.lastProcessedBlock) {
          // Process blocks in batches
          await this.processBlockRange(this.lastProcessedBlock + 1, confirmedBlock);
          this.lastProcessedBlock = confirmedBlock;

          // Update metrics
          evmBlockHeight.set({ chain: this.config.shortName }, confirmedBlock);
          evmLastBlockTimestamp.set({ chain: this.config.shortName }, Date.now() / 1000);
        }
      } catch (error) {
        logger.error(`Error polling ${this.config.name} blocks`, { error });
        this.handleError(error);

        // Attempt reconnection on persistent errors
        if (this.errors > 5) {
          await this.reconnect();
        }
      }
    }, this.config.pollingInterval);
  }

  /**
   * Process a range of blocks for events
   */
  private async processBlockRange(fromBlock: number, toBlock: number): Promise<void> {
    if (!this.tokenMessenger) {
      return;
    }

    // Process in batches to avoid RPC limits
    const batchSize = this.config.batchSize;

    for (let start = fromBlock; start <= toBlock; start += batchSize) {
      const end = Math.min(start + batchSize - 1, toBlock);

      try {
        await this.processBlockBatch(start, end);
      } catch (error) {
        logger.error(`Error processing ${this.config.name} block batch`, {
          start,
          end,
          error,
        });
        this.handleError(error);

        // Retry with smaller batch on failure
        if (batchSize > 100) {
          await this.processBlockBatch(start, end, Math.floor(batchSize / 2));
        }
      }
    }
  }

  /**
   * Process a batch of blocks
   */
  private async processBlockBatch(
    fromBlock: number,
    toBlock: number,
    customBatchSize?: number
  ): Promise<void> {
    if (!this.tokenMessenger) {
      return;
    }

    const batchSize = customBatchSize || this.config.batchSize;

    for (let start = fromBlock; start <= toBlock; start += batchSize) {
      const end = Math.min(start + batchSize - 1, toBlock);

      try {
        // Query MessageSent events
        const filter = this.tokenMessenger.filters.MessageSent();
        const events = await this.tokenMessenger.queryFilter(filter, start, end);

        if (events.length > 0) {
          logger.info(
            `Found ${events.length} deposit events in ${this.config.name} blocks ${start}-${end}`
          );

          // Process each event
          for (const event of events) {
            await this.processMessageSentEvent(event);
          }
        }
      } catch (error) {
        logger.error(`Error querying ${this.config.name} events`, {
          fromBlock: start,
          toBlock: end,
          error,
        });
        throw error;
      }
    }
  }

  /**
   * Process a MessageSent event
   */
  private async processMessageSentEvent(event: ethers.Log | ethers.EventLog): Promise<void> {
    try {
      // Type guard: only process EventLog
      if (!('args' in event) || !event.args) {
        return;
      }

      // Extract message bytes
      const messageBytes = ethers.getBytes(event.args.message);

      // Decode CCTP message format
      const message = this.decodeCctpMessage(messageBytes);

      if (!message) {
        logger.warn(`Failed to decode CCTP message from ${this.config.name}`, {
          txHash: event.transactionHash,
        });
        return;
      }

      // Get transaction receipt for timestamp
      const receipt = await this.provider!.getTransactionReceipt(event.transactionHash);
      if (!receipt) {
        logger.warn(`No receipt found for transaction`, {
          txHash: event.transactionHash,
        });
        return;
      }

      const block = await this.provider!.getBlock(receipt.blockNumber);
      if (!block) {
        logger.warn(`No block found`, {
          blockNumber: receipt.blockNumber,
        });
        return;
      }

      // Check if this is an ERC-20 deposit
      const tokenAddress = message.burnToken;
      const isNativeDeposit = tokenAddress === ethers.ZeroAddress;

      let tokenSymbol: string | undefined;
      if (!isNativeDeposit) {
        tokenSymbol = await this.getTokenSymbol(tokenAddress);
      }

      // Create deposit event
      const depositEvent: EvmDepositEvent = {
        nonce: message.nonce,
        destinationDomain: message.destinationDomain,
        amount: message.amount,
        sender: message.sender,
        recipient: message.recipient,
        blockNumber: receipt.blockNumber,
        transactionHash: event.transactionHash,
        timestamp: block.timestamp * 1000,
        chainId: this.config.chainId,
        chainName: this.config.name,
        isNativeToken: isNativeDeposit,
        tokenAddress: !isNativeDeposit ? tokenAddress : undefined,
        tokenSymbol,
      };

      logger.info(`Processed ${this.config.name} deposit event`, {
        nonce: depositEvent.nonce.toString(),
        destinationDomain: depositEvent.destinationDomain,
        amount: ethers.formatUnits(depositEvent.amount, 6), // USDC is 6 decimals
        sender: depositEvent.sender,
        blockNumber: depositEvent.blockNumber,
        txHash: depositEvent.transactionHash,
        tokenSymbol: depositEvent.tokenSymbol || 'NATIVE',
      });

      this.eventsProcessed++;

      // Update metrics
      evmMessagesSeen.inc({
        source_domain: this.config.domain.toString(),
        chain: this.config.shortName,
        token_type: isNativeDeposit ? 'native' : 'erc20',
      });

      // Emit event for consumption
      this.emit('deposit', depositEvent);
    } catch (error) {
      logger.error(`Error processing ${this.config.name} MessageSent event`, {
        error,
        txHash: event.transactionHash,
      });
      this.handleError(error);
    }
  }

  /**
   * Decode CCTP message format
   * Format: version (4) | sourceDomain (4) | destinationDomain (4) | nonce (8) | sender (32) | recipient (32) | destinationCaller (32) | messageBody
   * MessageBody: version (4) | burnToken (32) | mintRecipient (32) | amount (32) | messageSender (32)
   */
  private decodeCctpMessage(messageBytes: Uint8Array): {
    version: number;
    sourceDomain: number;
    destinationDomain: number;
    nonce: bigint;
    sender: string;
    recipient: Uint8Array;
    burnToken: string;
    amount: bigint;
  } | null {
    try {
      const dataView = new DataView(messageBytes.buffer);
      let offset = 0;

      // Message header
      const version = dataView.getUint32(offset);
      offset += 4;
      const sourceDomain = dataView.getUint32(offset);
      offset += 4;
      const destinationDomain = dataView.getUint32(offset);
      offset += 4;
      const nonce = dataView.getBigUint64(offset);
      offset += 8;

      // Sender (32 bytes)
      const sender = ethers.hexlify(messageBytes.slice(offset, offset + 32));
      offset += 32;

      // Recipient (32 bytes)
      const recipient = messageBytes.slice(offset, offset + 32);
      offset += 32;

      // Destination caller (32 bytes, skip)
      offset += 32;

      // Message body
      // const bodyVersion = dataView.getUint32(offset);
      offset += 4;

      // Burn token (32 bytes) - extract address from last 20 bytes
      const burnTokenBytes = messageBytes.slice(offset + 12, offset + 32);
      const burnToken = ethers.hexlify(burnTokenBytes);
      offset += 32;

      // Mint recipient (32 bytes, skip)
      offset += 32;

      // Amount (32 bytes)
      const amountBytes = messageBytes.slice(offset, offset + 32);
      const amount = BigInt(ethers.hexlify(amountBytes));
      offset += 32;

      return {
        version,
        sourceDomain,
        destinationDomain,
        nonce,
        sender,
        recipient,
        burnToken,
        amount,
      };
    } catch (error) {
      logger.error('Error decoding CCTP message', { error });
      return null;
    }
  }

  /**
   * Get ERC-20 token symbol (with caching)
   */
  private async getTokenSymbol(tokenAddress: string): Promise<string> {
    // Check cache
    const cached = this.tokenCache.get(tokenAddress);
    if (cached) {
      return cached.symbol;
    }

    try {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider!);
      const symbol = await tokenContract.symbol();
      const decimals = await tokenContract.decimals();

      // Cache result
      this.tokenCache.set(tokenAddress, { symbol, decimals });

      return symbol;
    } catch (error) {
      logger.warn(`Failed to get token symbol for ${tokenAddress}`, { error });
      return 'UNKNOWN';
    }
  }

  /**
   * Reconnect to provider
   */
  private async reconnect(): Promise<void> {
    logger.info(`Reconnecting ${this.config.name} monitor...`);

    this.reconnectCount++;

    try {
      // Stop current monitoring
      await this.stopMonitoring();

      // Attempt to connect to next RPC endpoint
      this.currentRpcIndex = (this.currentRpcIndex + 1) % this.config.rpcUrls.length;
      await this.connectProvider();

      // Restart monitoring
      if (this.config.supportsWebSocket && this.config.wsUrls && this.config.wsUrls.length > 0) {
        await this.startWebSocketMonitoring();
      } else {
        await this.startPollingMonitoring();
      }

      // Reset error counter on successful reconnection
      this.errors = 0;

      logger.info(`${this.config.name} monitor reconnected successfully`, {
        reconnectCount: this.reconnectCount,
        rpcIndex: this.currentRpcIndex,
      });

      evmConnected.set({ chain: this.config.shortName }, 1);
    } catch (error) {
      logger.error(`Failed to reconnect ${this.config.name} monitor`, { error });
      evmConnected.set({ chain: this.config.shortName }, 0);

      // Retry after delay
      setTimeout(() => this.reconnect(), this.config.retryDelay);
    }
  }

  /**
   * Stop monitoring (internal)
   */
  private async stopMonitoring(): Promise<void> {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }

    if (this.blockSubscription && this.provider) {
      this.provider.removeAllListeners('block');
      this.provider.removeAllListeners('error');
      this.blockSubscription = undefined;
    }
  }

  /**
   * Stop monitoring (public)
   */
  async stop(): Promise<void> {
    logger.info(`Stopping ${this.config.name} monitor...`);

    await this.stopMonitoring();

    if (this.provider) {
      this.provider.removeAllListeners();
      this.provider = null;
    }

    this.tokenMessenger = null;
    this.isRunning = false;
    evmConnected.set({ chain: this.config.shortName }, 0);
    this.emit('stopped');

    logger.info(`${this.config.name} monitor stopped`);
  }

  /**
   * Get monitor status
   */
  getStatus(): MonitorStatus {
    return {
      isRunning: this.isRunning,
      chainId: this.config.chainId,
      chainName: this.config.name,
      currentBlock: this.currentBlock,
      lastProcessedBlock: this.lastProcessedBlock,
      eventsProcessed: this.eventsProcessed,
      errors: this.errors,
      lastError: this.lastError,
      lastErrorTime: this.lastErrorTime,
      rpcIndex: this.currentRpcIndex,
      reconnectCount: this.reconnectCount,
    };
  }

  /**
   * Handle errors
   */
  private handleError(error: any): void {
    this.errors++;
    this.lastError = error?.message || String(error);
    this.lastErrorTime = Date.now();

    evmErrors.inc({
      chain: this.config.shortName,
      error_type: this.classifyError(error),
    });

    this.emit('error', error);
  }

  /**
   * Classify error type for metrics
   */
  private classifyError(error: any): string {
    const message = error?.message || String(error);

    if (message.includes('network')) return 'network';
    if (message.includes('timeout')) return 'timeout';
    if (message.includes('rate limit')) return 'rate_limit';
    if (message.includes('nonce')) return 'nonce';
    if (message.includes('gas')) return 'gas';
    if (message.includes('revert')) return 'revert';

    return 'unknown';
  }

  /**
   * Get current block number
   */
  async getCurrentBlock(): Promise<number> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    return await this.provider.getBlockNumber();
  }

  /**
   * Get chain configuration
   */
  getChainConfig(): EvmChainConfig {
    return this.config;
  }

  /**
   * Manual event query for specific block range
   */
  async queryEvents(fromBlock: number, toBlock: number): Promise<EvmDepositEvent[]> {
    if (!this.tokenMessenger) {
      throw new Error('TokenMessenger contract not initialized');
    }

    const filter = this.tokenMessenger.filters.MessageSent();
    const events = await this.tokenMessenger.queryFilter(filter, fromBlock, toBlock);

    const depositEvents: EvmDepositEvent[] = [];

    for (const event of events) {
      if ('args' in event && event.args) {
        const messageBytes = ethers.getBytes(event.args.message);
        const message = this.decodeCctpMessage(messageBytes);

        if (message) {
          const receipt = await this.provider!.getTransactionReceipt(event.transactionHash);
          const block = await this.provider!.getBlock(receipt!.blockNumber);

          const tokenAddress = message.burnToken;
          const isNativeDeposit = tokenAddress === ethers.ZeroAddress;

          depositEvents.push({
            nonce: message.nonce,
            destinationDomain: message.destinationDomain,
            amount: message.amount,
            sender: message.sender,
            recipient: message.recipient,
            blockNumber: receipt!.blockNumber,
            transactionHash: event.transactionHash,
            timestamp: block!.timestamp * 1000,
            chainId: this.config.chainId,
            chainName: this.config.name,
            isNativeToken: isNativeDeposit,
            tokenAddress: !isNativeDeposit ? tokenAddress : undefined,
          });
        }
      }
    }

    return depositEvents;
  }
}
