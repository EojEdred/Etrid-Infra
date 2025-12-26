import { EventEmitter } from 'events';
import { Client, Payment, Transaction, TransactionStream, LedgerStream, Wallet } from 'xrpl';
import { Counter, Gauge } from 'prom-client';
import { logger } from '../utils/logger';

/**
 * XRP Bridge Monitor
 *
 * Monitors both XRPL Classic and EVM Sidechain for bridge deposits and withdrawals.
 * Supports destination tags for recipient identification.
 * Uses ledger_index for confirmations (instant finality on XRPL).
 */

export interface XrpMonitorConfig {
  // Connection
  rpcUrl: string; // wss://xrplcluster.com or wss://rpc-evm-sidechain.xrpl.org
  network: 'mainnet' | 'testnet' | 'devnet';
  bridgeType: 'classic' | 'evm-sidechain';

  // Bridge configuration
  bridgeAddress: string; // XRPL address to monitor (rXXX... for classic, 0x... for EVM)
  minConfirmations: number; // Default: 1 (XRPL has instant finality)

  // Reconnection
  reconnectAttempts: number;
  reconnectDelay: number; // milliseconds

  // Optional filters
  destinationTagFilter?: number; // Only process specific destination tag
  minAmount?: number; // Minimum amount in drops (1 XRP = 1,000,000 drops)
}

export interface XrpDepositEvent {
  txHash: string;
  ledgerIndex: number;
  timestamp: number;

  // Transaction details
  from: string; // XRPL address (rXXX... or 0x...)
  to: string; // Bridge address
  amount: string; // In drops for classic, wei for EVM sidechain
  destinationTag?: number;

  // Bridge recipient (parsed from memo or destination tag)
  etridRecipient?: string;

  // Confirmations
  confirmations: number;
  isConfirmed: boolean;

  // Chain info
  bridgeType: 'classic' | 'evm-sidechain';
}

export interface MonitorStatus {
  isRunning: boolean;
  lastLedger: number;
  eventsProcessed: number;
  errors: number;
  lastError?: string;
  lastErrorTime?: number;
  bridgeType: 'classic' | 'evm-sidechain';
}

/**
 * Prometheus Metrics
 */
const xrpConnected = new Gauge({
  name: 'bridge_xrp_connected',
  help: 'Connected to XRP node (1 = connected, 0 = disconnected)',
  labelNames: ['network', 'bridge_type'],
});

const xrpLedgerHeight = new Gauge({
  name: 'bridge_xrp_ledger_height',
  help: 'Latest XRP ledger index processed',
  labelNames: ['network', 'bridge_type'],
});

const xrpDepositsDetected = new Counter({
  name: 'bridge_xrp_deposits_detected_total',
  help: 'Total XRP deposits detected',
  labelNames: ['network', 'bridge_type'],
});

const xrpLastLedgerTimestamp = new Gauge({
  name: 'bridge_xrp_last_ledger_timestamp',
  help: 'Timestamp of last XRP ledger processed',
  labelNames: ['network', 'bridge_type'],
});

const xrpErrors = new Counter({
  name: 'bridge_xrp_errors_total',
  help: 'Total XRP monitor errors',
  labelNames: ['network', 'bridge_type', 'error_type'],
});

export class XrpMonitor extends EventEmitter {
  private client: Client | null = null;
  private config: XrpMonitorConfig;
  private isRunning = false;
  private lastLedgerIndex = 0;
  private eventsProcessed = 0;
  private errors = 0;
  private lastError?: string;
  private lastErrorTime?: number;
  private reconnectAttempt = 0;

  constructor(config: XrpMonitorConfig) {
    super();
    this.config = config;
  }

  /**
   * Start monitoring XRP chain
   */
  async start(): Promise<void> {
    logger.info('Starting XRP monitor...', {
      rpcUrl: this.config.rpcUrl,
      network: this.config.network,
      bridgeType: this.config.bridgeType,
      bridgeAddress: this.config.bridgeAddress,
    });

    try {
      // Create XRPL client
      this.client = new Client(this.config.rpcUrl, {
        connectionTimeout: 10000,
      });

      // Connect to XRPL
      await this.client.connect();

      logger.info('Connected to XRP node', {
        network: this.config.network,
        bridgeType: this.config.bridgeType,
      });

      // Get current ledger info
      const ledgerInfo = await this.client.getLedgerIndex();
      this.lastLedgerIndex = ledgerInfo;

      logger.info('XRP ledger info retrieved', {
        ledgerIndex: ledgerInfo,
      });

      // Subscribe to ledger and transaction streams
      await this.subscribeToStreams();

      this.isRunning = true;
      this.reconnectAttempt = 0;

      xrpConnected.set({
        network: this.config.network,
        bridge_type: this.config.bridgeType
      }, 1);

      this.emit('started');
      logger.info('XRP monitor started');
    } catch (error) {
      logger.error('Failed to start XRP monitor', error);
      xrpConnected.set({
        network: this.config.network,
        bridge_type: this.config.bridgeType
      }, 0);
      this.handleError(error, 'connection');
      throw error;
    }
  }

  /**
   * Subscribe to XRPL ledger and transaction streams
   */
  private async subscribeToStreams(): Promise<void> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    // Subscribe to ledger stream for new ledgers
    await this.client.request({
      command: 'subscribe',
      streams: ['ledger'],
    });

    // Subscribe to transactions for our bridge address
    await this.client.request({
      command: 'subscribe',
      accounts: [this.config.bridgeAddress],
    });

    // Handle ledger events
    this.client.on('ledgerClosed', async (ledger: any) => {
      try {
        const ledgerIndex = ledger.ledger_index;
        this.lastLedgerIndex = ledgerIndex;

        xrpLedgerHeight.set({
          network: this.config.network,
          bridge_type: this.config.bridgeType
        }, ledgerIndex);

        xrpLastLedgerTimestamp.set({
          network: this.config.network,
          bridge_type: this.config.bridgeType
        }, Date.now() / 1000);

        logger.debug('New XRP ledger closed', { ledgerIndex });
      } catch (error) {
        logger.error('Error processing ledger event', error);
        this.handleError(error, 'ledger_processing');
      }
    });

    // Handle transaction events
    this.client.on('transaction', async (tx: any) => {
      try {
        await this.processTransaction(tx);
      } catch (error) {
        logger.error('Error processing transaction', error);
        this.handleError(error, 'transaction_processing');
      }
    });

    // Handle connection errors
    this.client.on('error', (errorCode: string, errorMessage: string) => {
      logger.error('XRP client error', { errorCode, errorMessage });
      this.handleError(new Error(`${errorCode}: ${errorMessage}`), 'client_error');
    });

    // Handle disconnections
    this.client.on('disconnected', async (code: number) => {
      logger.warn('Disconnected from XRP node', { code });
      xrpConnected.set({
        network: this.config.network,
        bridge_type: this.config.bridgeType
      }, 0);

      await this.handleReconnection();
    });

    logger.info('Subscribed to XRP streams', {
      bridgeAddress: this.config.bridgeAddress,
    });
  }

  /**
   * Process a transaction
   */
  private async processTransaction(tx: any): Promise<void> {
    try {
      // Only process validated transactions
      if (!tx.validated) {
        return;
      }

      const transaction = tx.transaction;
      const meta = tx.meta;

      // Only process Payment transactions
      if (transaction.TransactionType !== 'Payment') {
        return;
      }

      // Check if payment is to our bridge address
      if (transaction.Destination !== this.config.bridgeAddress) {
        return;
      }

      // For EVM sidechain, handle differently
      if (this.config.bridgeType === 'evm-sidechain') {
        await this.processEvmSidechainTransaction(tx);
        return;
      }

      // Parse XRPL Classic payment
      const payment = transaction as Payment;

      // Extract amount (can be XRP drops or IOU)
      let amountDrops: string;
      if (typeof payment.Amount === 'string') {
        // XRP in drops
        amountDrops = payment.Amount;
      } else {
        // IOU - we'll skip for now (can be extended to support issued currencies)
        logger.debug('Skipping IOU payment', { txHash: tx.transaction.hash });
        return;
      }

      // Check minimum amount if configured
      if (this.config.minAmount && parseInt(amountDrops) < this.config.minAmount) {
        logger.debug('Payment below minimum amount', {
          amount: amountDrops,
          minimum: this.config.minAmount
        });
        return;
      }

      // Extract destination tag
      const destinationTag = payment.DestinationTag;

      // Check destination tag filter if configured
      if (this.config.destinationTagFilter !== undefined &&
          destinationTag !== this.config.destinationTagFilter) {
        return;
      }

      // Parse Etrid recipient from memo or destination tag
      const etridRecipient = this.parseEtridRecipient(payment);

      if (!etridRecipient) {
        logger.warn('No Etrid recipient found in transaction', {
          txHash: tx.transaction.hash,
          destinationTag,
        });
        return;
      }

      // Get ledger index for confirmations
      const ledgerIndex = tx.ledger_index || this.lastLedgerIndex;
      const confirmations = this.lastLedgerIndex - ledgerIndex + 1;
      const isConfirmed = confirmations >= this.config.minConfirmations;

      // Create deposit event
      const depositEvent: XrpDepositEvent = {
        txHash: tx.transaction.hash,
        ledgerIndex,
        timestamp: this.rippleTimeToUnix(tx.transaction.date || 0),
        from: payment.Account,
        to: payment.Destination,
        amount: amountDrops,
        destinationTag,
        etridRecipient,
        confirmations,
        isConfirmed,
        bridgeType: 'classic',
      };

      logger.info('XRP deposit detected', {
        txHash: depositEvent.txHash,
        from: depositEvent.from,
        amount: depositEvent.amount,
        etridRecipient: depositEvent.etridRecipient,
        confirmations: depositEvent.confirmations,
        isConfirmed: depositEvent.isConfirmed,
      });

      this.eventsProcessed++;

      xrpDepositsDetected.inc({
        network: this.config.network,
        bridge_type: this.config.bridgeType
      });

      // Emit event
      this.emit('deposit', depositEvent);

      // If confirmed, emit confirmed event
      if (isConfirmed) {
        this.emit('depositConfirmed', depositEvent);
      }
    } catch (error) {
      logger.error('Error processing XRP transaction', error);
      this.handleError(error, 'transaction_processing');
    }
  }

  /**
   * Process EVM Sidechain transaction
   */
  private async processEvmSidechainTransaction(tx: any): Promise<void> {
    // EVM sidechain uses Ethereum-compatible format
    // We'll parse it similar to Ethereum transactions
    const transaction = tx.transaction;

    // For EVM sidechain, Amount is in wei-like format
    const amount = typeof transaction.Amount === 'string'
      ? transaction.Amount
      : transaction.Amount.value;

    // Parse recipient from transaction data or memo
    const etridRecipient = this.parseEtridRecipient(transaction);

    if (!etridRecipient) {
      logger.warn('No Etrid recipient in EVM sidechain tx', {
        txHash: tx.transaction.hash
      });
      return;
    }

    const ledgerIndex = tx.ledger_index || this.lastLedgerIndex;
    const confirmations = this.lastLedgerIndex - ledgerIndex + 1;
    const isConfirmed = confirmations >= this.config.minConfirmations;

    const depositEvent: XrpDepositEvent = {
      txHash: tx.transaction.hash,
      ledgerIndex,
      timestamp: this.rippleTimeToUnix(tx.transaction.date || 0),
      from: transaction.Account,
      to: transaction.Destination,
      amount,
      etridRecipient,
      confirmations,
      isConfirmed,
      bridgeType: 'evm-sidechain',
    };

    logger.info('XRP EVM Sidechain deposit detected', {
      txHash: depositEvent.txHash,
      from: depositEvent.from,
      amount: depositEvent.amount,
      etridRecipient: depositEvent.etridRecipient,
    });

    this.eventsProcessed++;

    xrpDepositsDetected.inc({
      network: this.config.network,
      bridge_type: this.config.bridgeType
    });

    this.emit('deposit', depositEvent);

    if (isConfirmed) {
      this.emit('depositConfirmed', depositEvent);
    }
  }

  /**
   * Parse Etrid recipient from transaction memo or destination tag mapping
   */
  private parseEtridRecipient(payment: any): string | undefined {
    // Check Memos field for Etrid account
    if (payment.Memos && payment.Memos.length > 0) {
      for (const memoWrapper of payment.Memos) {
        const memo = memoWrapper.Memo;
        if (memo && memo.MemoData) {
          try {
            // MemoData is hex-encoded
            const memoData = Buffer.from(memo.MemoData, 'hex').toString('utf-8');

            // Check if it's an Etrid address (could be SS58 format)
            if (memoData.length > 0) {
              return memoData;
            }
          } catch (error) {
            logger.debug('Failed to parse memo', { error });
          }
        }
      }
    }

    // Fallback: Use destination tag for lookup
    // In production, you'd query a mapping service or database
    // For now, we'll return undefined if no memo is found
    if (payment.DestinationTag !== undefined) {
      // TODO: Implement destination tag -> Etrid account lookup
      logger.debug('Destination tag found but no mapping implemented', {
        destinationTag: payment.DestinationTag,
      });
    }

    return undefined;
  }

  /**
   * Convert Ripple epoch time to Unix timestamp
   */
  private rippleTimeToUnix(rippleTime: number): number {
    // Ripple epoch is January 1, 2000 00:00 UTC
    // Unix epoch is January 1, 1970 00:00 UTC
    // Difference: 946684800 seconds
    return (rippleTime + 946684800) * 1000;
  }

  /**
   * Handle reconnection logic
   */
  private async handleReconnection(): Promise<void> {
    if (this.reconnectAttempt >= this.config.reconnectAttempts) {
      logger.error('Max reconnection attempts reached', {
        attempts: this.reconnectAttempt,
      });
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    this.reconnectAttempt++;
    const delay = this.config.reconnectDelay * this.reconnectAttempt;

    logger.info('Attempting to reconnect to XRP node', {
      attempt: this.reconnectAttempt,
      delay,
    });

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      if (this.client) {
        await this.client.connect();
        await this.subscribeToStreams();

        xrpConnected.set({
          network: this.config.network,
          bridge_type: this.config.bridgeType
        }, 1);

        this.reconnectAttempt = 0;
        logger.info('Reconnected to XRP node');
      }
    } catch (error) {
      logger.error('Reconnection failed', error);
      await this.handleReconnection();
    }
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    logger.info('Stopping XRP monitor...');

    if (this.client && this.client.isConnected()) {
      await this.client.disconnect();
    }

    this.client = null;
    this.isRunning = false;

    xrpConnected.set({
      network: this.config.network,
      bridge_type: this.config.bridgeType
    }, 0);

    this.emit('stopped');
    logger.info('XRP monitor stopped');
  }

  /**
   * Get monitor status
   */
  getStatus(): MonitorStatus {
    return {
      isRunning: this.isRunning,
      lastLedger: this.lastLedgerIndex,
      eventsProcessed: this.eventsProcessed,
      errors: this.errors,
      lastError: this.lastError,
      lastErrorTime: this.lastErrorTime,
      bridgeType: this.config.bridgeType,
    };
  }

  /**
   * Get current ledger index
   */
  async getCurrentLedger(): Promise<number> {
    if (!this.client || !this.client.isConnected()) {
      throw new Error('Client not connected');
    }

    return await this.client.getLedgerIndex();
  }

  /**
   * Handle errors
   */
  private handleError(error: any, errorType: string): void {
    this.errors++;
    this.lastError = error?.message || String(error);
    this.lastErrorTime = Date.now();

    xrpErrors.inc({
      network: this.config.network,
      bridge_type: this.config.bridgeType,
      error_type: errorType,
    });

    this.emit('error', error);
  }
}
