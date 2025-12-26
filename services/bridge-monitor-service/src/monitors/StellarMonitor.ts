import { EventEmitter } from 'events';
import * as StellarSdk from 'stellar-sdk';
import { Counter, Gauge } from 'prom-client';

// Extract types from stellar-sdk
const { Server, Horizon, Networks, Asset } = StellarSdk as any;
const BASE_FEE = '100'; // 100 stroops
import { logger } from '../utils/logger';

/**
 * Stellar Bridge Monitor
 *
 * Monitors Stellar blockchain for bridge deposits.
 * Supports XLM and Stellar assets.
 * Uses sequence numbers for transaction ordering.
 * Parses memo fields for recipient identification.
 * Fast 5-second ledger close times.
 */

export interface StellarMonitorConfig {
  // Connection
  horizonUrl: string; // https://horizon.stellar.org or https://horizon-testnet.stellar.org
  network: 'mainnet' | 'testnet';

  // Bridge configuration
  bridgeAccountId: string; // Stellar public key (G...)
  minConfirmations: number; // Default: 3 ledgers = 15 seconds (SCP finality)

  // Streaming configuration
  cursor?: string; // Optional: start from specific cursor
  reconnectTimeout: number; // milliseconds

  // Optional filters
  minAmount?: string; // Minimum amount in stroops (1 XLM = 10,000,000 stroops)
  assetCode?: string; // Monitor specific asset (e.g., 'USDC')
  assetIssuer?: string; // Asset issuer public key
}

export interface StellarDepositEvent {
  id: string; // Transaction ID
  pagingToken: string; // Cursor for pagination
  ledger: number;
  sequence: string;
  timestamp: number;

  // Transaction details
  from: string; // Source account
  to: string; // Destination account (bridge)
  amount: string; // In stroops for XLM, or asset amount
  asset: {
    code: string; // 'XLM' or asset code
    issuer?: string; // Issuer for non-native assets
    type: 'native' | 'credit_alphanum4' | 'credit_alphanum12';
  };

  // Memo
  memo?: {
    type: string; // 'text' | 'id' | 'hash' | 'return'
    value: string;
  };
  etridRecipient?: string; // Parsed from memo

  // Confirmations
  confirmations: number;
  isConfirmed: boolean;

  // Operation details
  operationType: string;
  sourceAccount?: string;
}

export interface MonitorStatus {
  isRunning: boolean;
  lastLedger: number;
  lastSequence: string;
  eventsProcessed: number;
  errors: number;
  lastError?: string;
  lastErrorTime?: number;
}

/**
 * Prometheus Metrics
 */
const stellarConnected = new Gauge({
  name: 'bridge_stellar_connected',
  help: 'Connected to Stellar Horizon (1 = connected, 0 = disconnected)',
  labelNames: ['network'],
});

const stellarLedger = new Gauge({
  name: 'bridge_stellar_ledger',
  help: 'Latest Stellar ledger processed',
  labelNames: ['network'],
});

const stellarDepositsDetected = new Counter({
  name: 'bridge_stellar_deposits_detected_total',
  help: 'Total Stellar deposits detected',
  labelNames: ['network', 'asset_code'],
});

const stellarLastLedgerTimestamp = new Gauge({
  name: 'bridge_stellar_last_ledger_timestamp',
  help: 'Timestamp of last Stellar ledger processed',
  labelNames: ['network'],
});

const stellarErrors = new Counter({
  name: 'bridge_stellar_errors_total',
  help: 'Total Stellar monitor errors',
  labelNames: ['network', 'error_type'],
});

export class StellarMonitor extends EventEmitter {
  private config: StellarMonitorConfig;
  private server: Server;
  private isRunning = false;
  private lastLedger = 0;
  private lastSequence = '0';
  private eventsProcessed = 0;
  private errors = 0;
  private lastError?: string;
  private lastErrorTime?: number;
  private paymentStream?: () => void; // Stream close function
  private reconnectTimer?: NodeJS.Timeout;

  constructor(config: StellarMonitorConfig) {
    super();
    this.config = config;

    // Initialize Stellar server
    this.server = new Server(config.horizonUrl);
  }

  /**
   * Start monitoring Stellar chain
   */
  async start(): Promise<void> {
    logger.info('Starting Stellar monitor...', {
      horizonUrl: this.config.horizonUrl,
      network: this.config.network,
      bridgeAccountId: this.config.bridgeAccountId,
    });

    try {
      // Test connection by loading account
      await this.server.loadAccount(this.config.bridgeAccountId);

      // Get current ledger
      const ledger = await this.server.ledgers().order('desc').limit(1).call();
      if (ledger.records && ledger.records.length > 0) {
        this.lastLedger = ledger.records[0].sequence;
      }

      logger.info('Connected to Stellar network', {
        network: this.config.network,
        currentLedger: this.lastLedger,
      });

      // Start streaming payments
      await this.startPaymentStream();

      this.isRunning = true;

      stellarConnected.set({ network: this.config.network }, 1);
      this.emit('started');

      logger.info('Stellar monitor started');
    } catch (error) {
      logger.error('Failed to start Stellar monitor', error);
      stellarConnected.set({ network: this.config.network }, 0);
      this.handleError(error, 'connection');
      throw error;
    }
  }

  /**
   * Start streaming payment operations to bridge account
   */
  private async startPaymentStream(): Promise<void> {
    try {
      // Create payment stream for bridge account
      const paymentCallBuilder = this.server
        .payments()
        .forAccount(this.config.bridgeAccountId)
        .order('asc');

      // Set cursor if provided
      if (this.config.cursor) {
        paymentCallBuilder.cursor(this.config.cursor);
      }

      // Start streaming
      const streamCloseFunc = paymentCallBuilder.stream({
        onmessage: async (payment: any) => {
          try {
            await this.processPayment(payment);
          } catch (error) {
            logger.error('Error processing payment', { payment, error });
            this.handleError(error, 'payment_processing');
          }
        },
        onerror: async (error: any) => {
          logger.error('Payment stream error', error);
          this.handleError(error, 'stream_error');

          stellarConnected.set({ network: this.config.network }, 0);

          // Attempt to reconnect
          await this.handleReconnection();
        },
      });

      this.paymentStream = streamCloseFunc;

      logger.info('Started Stellar payment stream', {
        bridgeAccount: this.config.bridgeAccountId,
      });
    } catch (error) {
      logger.error('Failed to start payment stream', error);
      throw error;
    }
  }

  /**
   * Process a payment operation
   */
  private async processPayment(
    payment: any
  ): Promise<void> {
    try {
      // Only process payments TO the bridge account
      if (payment.to !== this.config.bridgeAccountId) {
        return;
      }

      // Skip if this is a create_account operation instead of payment
      if (payment.type === 'create_account') {
        logger.debug('Skipping create_account operation', { id: payment.id });
        return;
      }

      // Get payment details
      const from = payment.from || payment.source_account;
      const to = payment.to;
      const amount = payment.amount;

      // Get asset details
      let asset: StellarDepositEvent['asset'];
      if (payment.asset_type === 'native') {
        asset = {
          code: 'XLM',
          type: 'native',
        };
      } else {
        asset = {
          code: payment.asset_code || 'unknown',
          issuer: payment.asset_issuer,
          type: payment.asset_type as any,
        };

        // Check if we're filtering for specific asset
        if (this.config.assetCode && asset.code !== this.config.assetCode) {
          return;
        }
        if (this.config.assetIssuer && asset.issuer !== this.config.assetIssuer) {
          return;
        }
      }

      // Check minimum amount if configured
      if (this.config.minAmount) {
        const amountFloat = parseFloat(amount);
        const minAmountFloat = parseFloat(this.config.minAmount);
        if (amountFloat < minAmountFloat) {
          logger.debug('Payment below minimum amount', {
            amount,
            minimum: this.config.minAmount,
          });
          return;
        }
      }

      // Get transaction to access memo
      const txRecord = await this.getTransaction(payment.transaction_hash);

      // Parse memo for Etrid recipient
      const memo = this.parseMemo(txRecord);
      const etridRecipient = this.parseEtridRecipient(memo);

      if (!etridRecipient) {
        logger.warn('No Etrid recipient found in payment memo', {
          txHash: payment.transaction_hash,
          from,
        });
        // We still emit the event but without recipient
        // The handler can decide what to do
      }

      // Get current ledger for confirmations
      const currentLedgerResp = await this.server.ledgers().order('desc').limit(1).call();
      const currentLedger = currentLedgerResp.records[0].sequence;

      const ledgerNumber = parseInt(payment.ledger_attr || '0');
      const confirmations = currentLedger - ledgerNumber;
      const isConfirmed = confirmations >= this.config.minConfirmations;

      // Create deposit event
      const depositEvent: StellarDepositEvent = {
        id: payment.id,
        pagingToken: payment.paging_token,
        ledger: ledgerNumber,
        sequence: payment.transaction_attr || '0',
        timestamp: new Date(payment.created_at).getTime(),
        from,
        to,
        amount,
        asset,
        memo,
        etridRecipient,
        confirmations,
        isConfirmed,
        operationType: payment.type,
        sourceAccount: payment.source_account,
      };

      logger.info('Stellar deposit detected', {
        id: depositEvent.id,
        from: depositEvent.from,
        amount: depositEvent.amount,
        asset: depositEvent.asset.code,
        etridRecipient: depositEvent.etridRecipient,
        confirmations: depositEvent.confirmations,
        isConfirmed: depositEvent.isConfirmed,
      });

      this.eventsProcessed++;
      this.lastLedger = ledgerNumber;
      this.lastSequence = depositEvent.sequence;

      stellarLedger.set({ network: this.config.network }, this.lastLedger);
      stellarLastLedgerTimestamp.set({ network: this.config.network }, Date.now() / 1000);
      stellarDepositsDetected.inc({
        network: this.config.network,
        asset_code: asset.code,
      });

      // Emit event
      this.emit('deposit', depositEvent);

      // If confirmed, emit confirmed event
      if (isConfirmed) {
        this.emit('depositConfirmed', depositEvent);
      }
    } catch (error) {
      logger.error('Error processing payment', { payment, error });
      this.handleError(error, 'payment_processing');
    }
  }

  /**
   * Get transaction details
   */
  private async getTransaction(txHash: string): Promise<any> {
    try {
      return await this.server.transactions().transaction(txHash).call();
    } catch (error) {
      logger.error('Failed to get transaction', { txHash, error });
      throw error;
    }
  }

  /**
   * Parse memo from transaction
   */
  private parseMemo(
    tx: any
  ): StellarDepositEvent['memo'] | undefined {
    if (!tx.memo_type || tx.memo_type === 'none') {
      return undefined;
    }

    let value: string;
    if (tx.memo_type === 'text') {
      value = tx.memo || '';
    } else if (tx.memo_type === 'id') {
      value = tx.memo || '';
    } else if (tx.memo_type === 'hash') {
      value = tx.memo || '';
    } else if (tx.memo_type === 'return') {
      value = tx.memo || '';
    } else {
      value = tx.memo || '';
    }

    return {
      type: tx.memo_type,
      value,
    };
  }

  /**
   * Parse Etrid recipient from memo
   */
  private parseEtridRecipient(
    memo: StellarDepositEvent['memo']
  ): string | undefined {
    if (!memo || !memo.value) {
      return undefined;
    }

    // For text memos, the value should be the Etrid account
    if (memo.type === 'text') {
      // Stellar text memos can be up to 28 bytes
      // Etrid SS58 addresses are typically 47-48 characters
      // We may need to use memo hash for longer addresses
      return memo.value;
    }

    // For hash memos, decode base64 to get the recipient
    if (memo.type === 'hash') {
      try {
        // Memo hash is 32 bytes, base64 encoded
        const decoded = Buffer.from(memo.value, 'base64').toString('utf-8');
        return decoded;
      } catch (error) {
        logger.debug('Failed to decode hash memo', { memo, error });
      }
    }

    // For ID memos, could be used as a lookup key
    if (memo.type === 'id') {
      // TODO: Implement memo ID -> Etrid account lookup
      logger.debug('Memo ID found but no mapping implemented', {
        memoId: memo.value,
      });
    }

    return undefined;
  }

  /**
   * Handle reconnection logic
   */
  private async handleReconnection(): Promise<void> {
    if (this.reconnectTimer) {
      return; // Reconnection already in progress
    }

    logger.info('Attempting to reconnect to Stellar Horizon', {
      timeout: this.config.reconnectTimeout,
    });

    this.reconnectTimer = setTimeout(async () => {
      try {
        // Test connection
        await this.server.loadAccount(this.config.bridgeAccountId);

        // Restart payment stream
        if (this.paymentStream) {
          this.paymentStream(); // Close old stream
        }
        await this.startPaymentStream();

        stellarConnected.set({ network: this.config.network }, 1);

        this.reconnectTimer = undefined;
        logger.info('Reconnected to Stellar Horizon');
      } catch (error) {
        logger.error('Reconnection failed', error);
        this.reconnectTimer = undefined;
        await this.handleReconnection(); // Try again
      }
    }, this.config.reconnectTimeout);
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    logger.info('Stopping Stellar monitor...');

    if (this.paymentStream) {
      this.paymentStream();
      this.paymentStream = undefined;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }

    this.isRunning = false;

    stellarConnected.set({ network: this.config.network }, 0);

    this.emit('stopped');
    logger.info('Stellar monitor stopped');
  }

  /**
   * Get monitor status
   */
  getStatus(): MonitorStatus {
    return {
      isRunning: this.isRunning,
      lastLedger: this.lastLedger,
      lastSequence: this.lastSequence,
      eventsProcessed: this.eventsProcessed,
      errors: this.errors,
      lastError: this.lastError,
      lastErrorTime: this.lastErrorTime,
    };
  }

  /**
   * Get current ledger
   */
  async getCurrentLedger(): Promise<number> {
    const ledger = await this.server.ledgers().order('desc').limit(1).call();
    if (ledger.records && ledger.records.length > 0) {
      return ledger.records[0].sequence;
    }
    return 0;
  }

  /**
   * Get account details
   */
  async getAccountDetails(accountId: string): Promise<any> {
    return await this.server.loadAccount(accountId);
  }

  /**
   * Get account balances
   */
  async getAccountBalances(accountId: string): Promise<any[]> {
    const account = await this.server.loadAccount(accountId);
    return account.balances;
  }

  /**
   * Handle errors
   */
  private handleError(error: any, errorType: string): void {
    this.errors++;
    this.lastError = error?.message || String(error);
    this.lastErrorTime = Date.now();

    stellarErrors.inc({
      network: this.config.network,
      error_type: errorType,
    });

    this.emit('error', error);
  }

  /**
   * Get bridge account sequence number
   */
  async getBridgeSequence(): Promise<string> {
    const account = await this.server.loadAccount(this.config.bridgeAccountId);
    return account.sequence;
  }

  /**
   * Check if account exists
   */
  async accountExists(accountId: string): Promise<boolean> {
    try {
      await this.server.loadAccount(accountId);
      return true;
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /**
   * Get transaction by hash
   */
  async getTransactionByHash(
    txHash: string
  ): Promise<any> {
    return await this.server.transactions().transaction(txHash).call();
  }

  /**
   * Get operations for transaction
   */
  async getTransactionOperations(
    txHash: string
  ): Promise<any[]> {
    const operations = await this.server
      .operations()
      .forTransaction(txHash)
      .call();
    return operations.records;
  }

  /**
   * Get payment history for account (useful for syncing)
   */
  async getPaymentHistory(
    accountId: string,
    limit: number = 200,
    cursor?: string
  ): Promise<any[]> {
    const callBuilder = this.server
      .payments()
      .forAccount(accountId)
      .order('desc')
      .limit(limit);

    if (cursor) {
      callBuilder.cursor(cursor);
    }

    const payments = await callBuilder.call();
    return payments.records as any[];
  }
}
