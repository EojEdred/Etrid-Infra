import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { AttestationConfig, EthereumBurnEvent, MonitorStatus } from '../types';
import { EventEmitter } from 'events';
import {
  ethereumConnected,
  ethereumBlockHeight,
  lastBlockTimestamp,
  messagesSeen,
  recordError,
} from '../metrics';

/**
 * Monitors Ethereum for MessageSent events from EDSCTokenMessenger contract
 */
export class EthereumMonitor extends EventEmitter {
  private provider: ethers.JsonRpcProvider | null = null;
  private tokenMessenger: ethers.Contract | null = null;
  private isRunning = false;
  private lastProcessedBlock = 0;
  private eventsProcessed = 0;
  private errors = 0;
  private lastError?: string;
  private lastErrorTime?: number;

  // EDSCTokenMessenger ABI (only events we need)
  private readonly TOKEN_MESSENGER_ABI = [
    'event MessageSent(uint32 indexed destinationDomain, uint64 indexed nonce, address indexed sender, bytes recipient, uint256 amount)',
  ];

  constructor(private config: AttestationConfig) {
    super();
  }

  /**
   * Start monitoring Ethereum chain
   */
  async start(): Promise<void> {
    logger.info('Starting Ethereum monitor...', {
      rpcUrl: this.config.ethereumRpcUrl,
    });

    try {
      // Connect to Ethereum node
      this.provider = new ethers.JsonRpcProvider(this.config.ethereumRpcUrl);

      // Get network info
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();

      logger.info('Connected to Ethereum network', {
        chainId: network.chainId.toString(),
        blockNumber,
      });

      // Initialize contract
      if (this.config.tokenMessengerAddress) {
        this.tokenMessenger = new ethers.Contract(
          this.config.tokenMessengerAddress,
          this.TOKEN_MESSENGER_ABI,
          this.provider
        );

        // Subscribe to events
        await this.subscribeToEvents();
      } else {
        logger.warn('TokenMessenger address not configured, skipping event subscription');
      }

      this.isRunning = true;
      ethereumConnected.set(1);
      this.emit('started');

      logger.info('Ethereum monitor started');
    } catch (error) {
      logger.error('Failed to start Ethereum monitor', error);
      ethereumConnected.set(0);
      recordError('ethereum_connection', 'EthereumMonitor');
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Subscribe to MessageSent events
   */
  private async subscribeToEvents(): Promise<void> {
    if (!this.tokenMessenger || !this.provider) {
      throw new Error('Contract or provider not initialized');
    }

    // Get current block number
    const currentBlock = await this.provider.getBlockNumber();
    this.lastProcessedBlock = currentBlock;

    // Subscribe to new blocks
    this.provider.on('block', async (blockNumber: number) => {
      try {
        // Wait for required confirmations
        const latestBlock = await this.provider!.getBlockNumber();
        if (latestBlock - blockNumber >= this.config.confirmationsRequired) {
          await this.processBlock(blockNumber);
          this.lastProcessedBlock = blockNumber;

          // Update metrics
          ethereumBlockHeight.set(blockNumber);
          lastBlockTimestamp.set({ chain: 'ethereum' }, Date.now() / 1000);
        }
      } catch (error) {
        logger.error('Error processing Ethereum block', { blockNumber, error });
        this.handleError(error);
      }
    });

    logger.info('Subscribed to Ethereum MessageSent events', {
      contractAddress: this.config.tokenMessengerAddress,
    });
  }

  /**
   * Process a single block for MessageSent events
   */
  private async processBlock(blockNumber: number): Promise<void> {
    if (!this.tokenMessenger) return;

    try {
      // Query events for this block
      const filter = this.tokenMessenger.filters.MessageSent();
      const events = await this.tokenMessenger.queryFilter(
        filter,
        blockNumber,
        blockNumber
      );

      if (events.length > 0) {
        logger.info(`Found ${events.length} burn events in Ethereum block ${blockNumber}`);
      }

      // Process each event
      for (const event of events) {
        await this.processMessageSentEvent(event, blockNumber);
      }
    } catch (error) {
      logger.error('Error querying Ethereum events', { blockNumber, error });
      this.handleError(error);
    }
  }

  /**
   * Process a MessageSent event
   */
  private async processMessageSentEvent(
    event: ethers.Log | ethers.EventLog,
    blockNumber: number
  ): Promise<void> {
    try {
      // Type guard: only process EventLog (not plain Log)
      if (!('args' in event) || !event.args) return;

      // Extract event args: MessageSent(destinationDomain, nonce, sender, recipient, amount)
      const destinationDomain = Number(event.args.destinationDomain);
      const nonce = BigInt(event.args.nonce);
      const sender = event.args.sender as string;
      const recipient = ethers.getBytes(event.args.recipient);
      const amount = BigInt(event.args.amount);

      const burnEvent: EthereumBurnEvent = {
        nonce,
        destinationDomain,
        amount,
        sender,
        recipient: new Uint8Array(recipient),
        blockNumber,
        transactionHash: event.transactionHash,
        timestamp: Date.now(),
      };

      logger.info('Processed Ethereum burn event', {
        nonce: burnEvent.nonce.toString(),
        destinationDomain: burnEvent.destinationDomain,
        amount: burnEvent.amount.toString(),
        sender: burnEvent.sender,
        blockNumber: burnEvent.blockNumber,
        txHash: burnEvent.transactionHash,
      });

      this.eventsProcessed++;

      // Update metrics
      messagesSeen.inc({
        source_domain: '0', // Ethereum domain is 0
        chain: 'ethereum',
      });

      this.emit('burnEvent', burnEvent);
    } catch (error) {
      logger.error('Error processing MessageSent event', error);
      this.handleError(error);
    }
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    logger.info('Stopping Ethereum monitor...');

    if (this.provider) {
      this.provider.removeAllListeners();
      this.provider = null;
    }

    this.tokenMessenger = null;
    this.isRunning = false;
    this.emit('stopped');

    logger.info('Ethereum monitor stopped');
  }

  /**
   * Get monitor status
   */
  getStatus(): MonitorStatus {
    return {
      isRunning: this.isRunning,
      lastBlock: this.lastProcessedBlock,
      eventsProcessed: this.eventsProcessed,
      errors: this.errors,
      lastError: this.lastError,
      lastErrorTime: this.lastErrorTime,
    };
  }

  /**
   * Handle errors
   */
  private handleError(error: any): void {
    this.errors++;
    this.lastError = error?.message || String(error);
    this.lastErrorTime = Date.now();
    this.emit('error', error);
  }

  /**
   * Get current block number
   */
  async getCurrentBlock(): Promise<number> {
    if (!this.provider) throw new Error('Provider not initialized');

    return await this.provider.getBlockNumber();
  }
}
