import { ApiPromise, WsProvider } from '@polkadot/api';
import { EventRecord } from '@polkadot/types/interfaces';
import { logger } from '../utils/logger';
import { AttestationConfig, SubstrateBurnEvent, MonitorStatus } from '../types';
import { EventEmitter } from 'events';
import {
  substrateConnected,
  substrateBlockHeight,
  lastBlockTimestamp,
  messagesSeen,
  recordError,
} from '../metrics';

/**
 * Monitors Substrate chain for BurnMessageSent events from TokenMessenger pallet
 */
export class SubstrateMonitor extends EventEmitter {
  private api: ApiPromise | null = null;
  private isRunning = false;
  private lastProcessedBlock = 0;
  private eventsProcessed = 0;
  private errors = 0;
  private lastError?: string;
  private lastErrorTime?: number;

  constructor(private config: AttestationConfig) {
    super();
  }

  /**
   * Start monitoring Substrate chain
   */
  async start(): Promise<void> {
    logger.info('Starting Substrate monitor...', {
      wsUrl: this.config.substrateWsUrl,
    });

    try {
      // Connect to Substrate node
      const provider = new WsProvider(this.config.substrateWsUrl);
      this.api = await ApiPromise.create({ provider });

      // Get chain info
      const [chain, nodeName, nodeVersion] = await Promise.all([
        this.api.rpc.system.chain(),
        this.api.rpc.system.name(),
        this.api.rpc.system.version(),
      ]);

      logger.info('Connected to Substrate chain', {
        chain: chain.toString(),
        nodeName: nodeName.toString(),
        nodeVersion: nodeVersion.toString(),
      });

      // Subscribe to new blocks
      await this.subscribeToBlocks();

      this.isRunning = true;
      substrateConnected.set(1);
      this.emit('started');

      logger.info('Substrate monitor started');
    } catch (error) {
      logger.error('Failed to start Substrate monitor', error);
      substrateConnected.set(0);
      recordError('substrate_connection', 'SubstrateMonitor');
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Subscribe to new blocks and process events
   */
  private async subscribeToBlocks(): Promise<void> {
    if (!this.api) throw new Error('API not initialized');

    // Subscribe to new block headers
    await this.api.rpc.chain.subscribeNewHeads(async (header) => {
      const blockNumber = header.number.toNumber();

      try {
        // Get block hash
        const blockHash = await this.api!.rpc.chain.getBlockHash(blockNumber);

        // Check if block is finalized (wait for required confirmations)
        const finalizedHash = await this.api!.rpc.chain.getFinalizedHead();
        const finalizedHeader = await this.api!.rpc.chain.getHeader(finalizedHash);
        const finalizedNumber = finalizedHeader.number.toNumber();

        // Only process if block is finalized
        if (blockNumber <= finalizedNumber - this.config.confirmationsRequired) {
          await this.processBlock(blockNumber, blockHash.toString());
          this.lastProcessedBlock = blockNumber;

          // Update metrics
          substrateBlockHeight.set(blockNumber);
          lastBlockTimestamp.set({ chain: 'substrate' }, Date.now() / 1000);
        }
      } catch (error) {
        logger.error('Error processing block', { blockNumber, error });
        this.handleError(error);
      }
    });
  }

  /**
   * Process a single block for BurnMessageSent events
   */
  private async processBlock(blockNumber: number, blockHash: string): Promise<void> {
    if (!this.api) return;

    try {
      // Get events for this block
      const apiAt = await this.api.at(blockHash);
      const events = await apiAt.query.system.events();

      // Filter for TokenMessenger.BurnMessageSent events
      // Cast events to Vec<EventRecord> to access filter method
      const eventsArray = events as unknown as EventRecord[];
      const burnEvents = eventsArray.filter((record: EventRecord) => {
        const { event } = record;
        return (
          event.section === 'tokenMessenger' &&
          event.method === 'BurnMessageSent'
        );
      });

      if (burnEvents.length > 0) {
        logger.info(`Found ${burnEvents.length} burn events in block ${blockNumber}`);
      }

      // Process each burn event
      for (const record of burnEvents) {
        await this.processBurnEvent(record, blockNumber, blockHash);
      }
    } catch (error) {
      logger.error('Error processing block events', { blockNumber, error });
      this.handleError(error);
    }
  }

  /**
   * Process a BurnMessageSent event
   */
  private async processBurnEvent(
    record: EventRecord,
    blockNumber: number,
    blockHash: string
  ): Promise<void> {
    try {
      const { event } = record;

      // Extract event data: BurnMessageSent { nonce, destination_domain, sender, amount, recipient }
      const [nonce, destinationDomain, sender, amount, recipient] = event.data;

      const burnEvent: SubstrateBurnEvent = {
        nonce: BigInt(nonce.toString()),
        destinationDomain: Number(destinationDomain.toString()),
        sender: new Uint8Array(sender.toU8a()),
        amount: BigInt(amount.toString()),
        recipient: new Uint8Array(recipient.toU8a()),
        blockNumber,
        blockHash,
        extrinsicHash: record.phase.isApplyExtrinsic
          ? record.phase.asApplyExtrinsic.toString()
          : 'unknown',
        timestamp: Date.now(),
      };

      logger.info('Processed Substrate burn event', {
        nonce: burnEvent.nonce.toString(),
        destinationDomain: burnEvent.destinationDomain,
        amount: burnEvent.amount.toString(),
        blockNumber: burnEvent.blockNumber,
      });

      this.eventsProcessed++;

      // Update metrics
      messagesSeen.inc({
        source_domain: '2', // Substrate domain is 2
        chain: 'substrate',
      });

      this.emit('burnEvent', burnEvent);
    } catch (error) {
      logger.error('Error processing burn event', error);
      this.handleError(error);
    }
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    logger.info('Stopping Substrate monitor...');

    if (this.api) {
      await this.api.disconnect();
      this.api = null;
    }

    this.isRunning = false;
    this.emit('stopped');

    logger.info('Substrate monitor stopped');
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
    if (!this.api) throw new Error('API not initialized');

    const header = await this.api.rpc.chain.getHeader();
    return header.number.toNumber();
  }
}
