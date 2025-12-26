/**
 * Tron Bridge Monitor for ETRID
 * Location: services/bridge-monitor-service/src/monitors/TronMonitor.ts
 *
 * Monitors TRON blockchain for TRC20/TRX deposits to bridge addresses and emits events
 * when confirmations threshold is met.
 *
 * Features:
 * - TronWeb integration for blockchain access
 * - TRC20 transfer monitoring (USDT, ETR)
 * - Native TRX transfer detection
 * - 19 block confirmations (Super Representative blocks)
 * - Energy and bandwidth tracking
 * - Memo parsing for ETRID recipient extraction
 * - Transaction replay prevention
 * - Prometheus metrics integration
 * - EventEmitter pattern for loose coupling
 */

import { EventEmitter } from 'events';
import TronWeb from 'tronweb';
import { logger } from '../utils/logger';
import {
  tronConnected,
  tronBlockHeight,
  lastBlockTimestamp,
  depositsSeen,
  depositsConfirmed,
  errors as recordErrorCounter,
} from '../metrics';

/**
 * TRON Network Types
 */
export enum TronNetwork {
  MAINNET = 'mainnet',
  SHASTA = 'shasta',
  NILE = 'nile',
}

/**
 * TronMonitor configuration
 */
export interface TronMonitorConfig {
  /** TronWeb full node URL */
  fullNode: string;
  /** TronWeb solidity node URL */
  solidityNode: string;
  /** TronWeb event server URL */
  eventServer: string;
  /** Bridge contract address (base58 format) */
  bridgeAddress: string;
  /** TRC20 token contracts to monitor */
  tokenContracts: TRC20TokenConfig[];
  /** Minimum confirmations required (default: 19) */
  minConfirmations?: number;
  /** Polling interval in ms (default: 3000) */
  pollingInterval?: number;
  /** Network type */
  network?: TronNetwork;
  /** API key for rate limiting */
  apiKey?: string;
}

/**
 * TRC20 token configuration
 */
export interface TRC20TokenConfig {
  /** Token symbol (e.g., 'USDT', 'ETR') */
  symbol: string;
  /** Contract address (base58 format) */
  address: string;
  /** Token decimals (default: 6 for USDT, 18 for others) */
  decimals: number;
}

/**
 * TRON deposit event
 */
export interface TronDepositEvent {
  /** Unique event identifier */
  id: string;
  /** Transaction hash */
  txHash: string;
  /** Sender address (base58) */
  from: string;
  /** Recipient on ETRID (SS58 format) */
  etridRecipient: string;
  /** Amount in token's smallest unit (sun for TRX) */
  amount: bigint;
  /** Token symbol ('TRX' for native) */
  token: string;
  /** Token contract address (null for TRX) */
  tokenContract: string | null;
  /** Block number */
  blockNumber: number;
  /** Block timestamp */
  blockTimestamp: number;
  /** Number of confirmations */
  confirmations: number;
  /** Energy consumed */
  energyUsed: number;
  /** Bandwidth consumed */
  bandwidthUsed: number;
  /** Transaction memo */
  memo?: string;
}

/**
 * Monitor status
 */
export interface MonitorStatus {
  isRunning: boolean;
  lastProcessedBlock: number;
  depositsProcessed: number;
  errors: number;
  lastError?: string;
  lastErrorTime?: number;
}

/**
 * Internal transaction tracking
 */
interface TrackedTransaction {
  txHash: string;
  from: string;
  etridRecipient: string;
  amount: bigint;
  token: string;
  tokenContract: string | null;
  blockNumber: number;
  blockTimestamp: number;
  confirmations: number;
  energyUsed: number;
  bandwidthUsed: number;
  memo?: string;
  status: 'pending' | 'confirmed' | 'emitted';
  firstSeen: number;
}

/**
 * TRC20 Transfer event log
 */
interface TRC20TransferLog {
  transaction_id: string;
  block_number: number;
  block_timestamp: number;
  caller_contract_address: string;
  contract_address: string;
  event_name: string;
  result: {
    from: string;
    to: string;
    value: string;
  };
}

/**
 * TRON transaction info
 */
interface TronTransactionInfo {
  id: string;
  blockNumber: number;
  blockTimeStamp: number;
  contractResult?: string[];
  receipt?: {
    energy_usage?: number;
    energy_usage_total?: number;
    net_usage?: number;
    result?: string;
  };
  log?: Array<{
    address: string;
    topics: string[];
    data: string;
  }>;
}

/**
 * TRON Monitor
 * Monitors TRON blockchain for bridge deposits
 */
export class TronMonitor extends EventEmitter {
  private tronWeb: TronWeb;
  private networkType: TronNetwork;
  private isRunning = false;
  private lastProcessedBlock = 0;
  private depositsProcessed = 0;
  private errors = 0;
  private lastError?: string;
  private lastErrorTime?: number;

  // Polling interval in milliseconds
  private pollingInterval = 3000; // 3 seconds (TRON block time)
  private pollingTimer?: NodeJS.Timeout;

  // Track pending deposits
  private trackedTransactions = new Map<string, TrackedTransaction>();

  // Processed transaction hashes to prevent replay
  private processedTxHashes = new Set<string>();

  // Minimum confirmations required (default: 19 for TRON - SR blocks)
  private minConfirmations: number;

  // Bridge address to monitor (base58)
  private bridgeAddress: string;

  // Token contracts to monitor
  private tokenContracts: Map<string, TRC20TokenConfig>;

  // TRC20 Transfer event topic
  private readonly TRANSFER_EVENT_TOPIC =
    'ddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

  constructor(private config: TronMonitorConfig) {
    super();

    this.bridgeAddress = config.bridgeAddress;
    this.minConfirmations = config.minConfirmations || 19;
    this.networkType = config.network || TronNetwork.MAINNET;
    this.pollingInterval = config.pollingInterval || 3000;

    // Initialize token contracts map
    this.tokenContracts = new Map();
    for (const token of config.tokenContracts || []) {
      this.tokenContracts.set(token.address.toLowerCase(), token);
    }

    // Initialize TronWeb
    const headers: Record<string, string> = {};
    if (config.apiKey) {
      headers['TRON-PRO-API-KEY'] = config.apiKey;
    }

    this.tronWeb = new TronWeb({
      fullHost: config.fullNode,
      solidityNode: config.solidityNode,
      eventServer: config.eventServer,
      headers,
    });

    logger.info('TronMonitor initialized', {
      network: this.networkType,
      bridgeAddress: this.bridgeAddress,
      minConfirmations: this.minConfirmations,
      tokenCount: this.tokenContracts.size,
    });
  }

  /**
   * Start monitoring TRON blockchain
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('TronMonitor already running');
      return;
    }

    logger.info('Starting TronMonitor...');

    try {
      // Test connection
      const currentBlock = await this.getCurrentBlockNumber();
      this.lastProcessedBlock = currentBlock - 1;

      logger.info('TronMonitor connected', {
        currentBlock,
        bridgeAddress: this.bridgeAddress,
      });

      // Update metrics
      tronConnected?.set(1);
      tronBlockHeight?.set(currentBlock);

      this.isRunning = true;

      // Start polling
      this.startPolling();

      this.emit('started');
    } catch (error) {
      this.handleError('Failed to start TronMonitor', error);
      throw error;
    }
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping TronMonitor...');

    this.isRunning = false;

    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = undefined;
    }

    tronConnected?.set(0);

    this.emit('stopped');
    logger.info('TronMonitor stopped');
  }

  /**
   * Get monitor status
   */
  getStatus(): MonitorStatus {
    return {
      isRunning: this.isRunning,
      lastProcessedBlock: this.lastProcessedBlock,
      depositsProcessed: this.depositsProcessed,
      errors: this.errors,
      lastError: this.lastError,
      lastErrorTime: this.lastErrorTime,
    };
  }

  /**
   * Start polling for new blocks
   */
  private startPolling(): void {
    const poll = async () => {
      if (!this.isRunning) {
        return;
      }

      try {
        await this.pollBlocks();
      } catch (error) {
        this.handleError('Polling error', error);
      }

      // Schedule next poll
      this.pollingTimer = setTimeout(poll, this.pollingInterval);
    };

    // Start first poll
    poll();
  }

  /**
   * Poll for new blocks and transactions
   */
  private async pollBlocks(): Promise<void> {
    const currentBlock = await this.getCurrentBlockNumber();

    if (currentBlock <= this.lastProcessedBlock) {
      return;
    }

    // Process new blocks
    const startBlock = this.lastProcessedBlock + 1;
    const endBlock = Math.min(currentBlock, startBlock + 10); // Process max 10 blocks at a time

    logger.debug('Processing blocks', { startBlock, endBlock });

    for (let blockNum = startBlock; blockNum <= endBlock; blockNum++) {
      await this.processBlock(blockNum, currentBlock);
    }

    this.lastProcessedBlock = endBlock;
    tronBlockHeight?.set(endBlock);

    // Check confirmations on pending transactions
    await this.updatePendingConfirmations(currentBlock);
  }

  /**
   * Process a single block
   */
  private async processBlock(blockNumber: number, currentBlock: number): Promise<void> {
    try {
      // Get block with transactions
      const block = await this.tronWeb.trx.getBlock(blockNumber);

      if (!block || !block.transactions) {
        return;
      }

      lastBlockTimestamp?.set(Date.now());

      // Process each transaction
      for (const tx of block.transactions) {
        await this.processTransaction(tx, blockNumber, currentBlock);
      }

      // Also query TRC20 transfer events for this block
      await this.queryTRC20Transfers(blockNumber, currentBlock);
    } catch (error) {
      this.handleError(`Failed to process block ${blockNumber}`, error);
    }
  }

  /**
   * Process a single transaction
   */
  private async processTransaction(
    tx: any,
    blockNumber: number,
    currentBlock: number
  ): Promise<void> {
    const txHash = tx.txID;

    // Skip if already processed
    if (this.processedTxHashes.has(txHash)) {
      return;
    }

    try {
      const contract = tx.raw_data?.contract?.[0];
      if (!contract) {
        return;
      }

      // Check for TRX transfers
      if (contract.type === 'TransferContract') {
        await this.handleTrxTransfer(tx, blockNumber, currentBlock);
      }

      // Check for TRC20 transfers (TriggerSmartContract)
      if (contract.type === 'TriggerSmartContract') {
        await this.handleSmartContractCall(tx, blockNumber, currentBlock);
      }
    } catch (error) {
      this.handleError(`Failed to process tx ${txHash}`, error);
    }
  }

  /**
   * Handle native TRX transfer
   */
  private async handleTrxTransfer(
    tx: any,
    blockNumber: number,
    currentBlock: number
  ): Promise<void> {
    const contract = tx.raw_data?.contract?.[0]?.parameter?.value;
    if (!contract) {
      return;
    }

    const toAddress = this.tronWeb.address.fromHex(contract.to_address);
    const fromAddress = this.tronWeb.address.fromHex(contract.owner_address);
    const amount = BigInt(contract.amount || 0);

    // Check if sent to bridge address
    if (toAddress !== this.bridgeAddress) {
      return;
    }

    // Get transaction info for memo and receipt
    const txInfo = await this.getTransactionInfo(tx.txID);

    // Extract ETRID recipient from memo
    const memo = this.extractMemo(tx.raw_data?.data);
    const etridRecipient = this.parseEtridRecipient(memo);

    if (!etridRecipient) {
      logger.warn('TRX deposit without valid ETRID recipient', {
        txHash: tx.txID,
        from: fromAddress,
      });
      return;
    }

    const confirmations = currentBlock - blockNumber;

    logger.info('TRX deposit detected', {
      txHash: tx.txID,
      from: fromAddress,
      amount: amount.toString(),
      etridRecipient,
      confirmations,
    });

    depositsSeen?.inc();

    // Track the transaction
    this.trackTransaction({
      txHash: tx.txID,
      from: fromAddress,
      etridRecipient,
      amount,
      token: 'TRX',
      tokenContract: null,
      blockNumber,
      blockTimestamp: tx.raw_data?.timestamp || Date.now(),
      confirmations,
      energyUsed: txInfo?.receipt?.energy_usage_total || 0,
      bandwidthUsed: txInfo?.receipt?.net_usage || 0,
      memo,
    });
  }

  /**
   * Handle smart contract calls (TRC20 transfers)
   */
  private async handleSmartContractCall(
    tx: any,
    blockNumber: number,
    currentBlock: number
  ): Promise<void> {
    const contract = tx.raw_data?.contract?.[0]?.parameter?.value;
    if (!contract) {
      return;
    }

    const contractAddress = this.tronWeb.address.fromHex(contract.contract_address);
    const tokenConfig = this.tokenContracts.get(contractAddress.toLowerCase());

    if (!tokenConfig) {
      return; // Not a monitored token
    }

    // Parse TRC20 transfer data
    const data = contract.data;
    if (!data || !data.startsWith('a9059cbb')) {
      return; // Not a transfer
    }

    // Decode transfer(address to, uint256 value)
    const toHex = '41' + data.substring(32, 72);
    const valueHex = data.substring(72, 136);

    const toAddress = this.tronWeb.address.fromHex(toHex);
    const amount = BigInt('0x' + valueHex);
    const fromAddress = this.tronWeb.address.fromHex(contract.owner_address);

    // Check if sent to bridge address
    if (toAddress !== this.bridgeAddress) {
      return;
    }

    // Get transaction info
    const txInfo = await this.getTransactionInfo(tx.txID);

    // Extract ETRID recipient from memo
    const memo = this.extractMemo(tx.raw_data?.data);
    const etridRecipient = this.parseEtridRecipient(memo);

    if (!etridRecipient) {
      logger.warn('TRC20 deposit without valid ETRID recipient', {
        txHash: tx.txID,
        token: tokenConfig.symbol,
        from: fromAddress,
      });
      return;
    }

    const confirmations = currentBlock - blockNumber;

    logger.info('TRC20 deposit detected', {
      txHash: tx.txID,
      token: tokenConfig.symbol,
      from: fromAddress,
      amount: amount.toString(),
      etridRecipient,
      confirmations,
    });

    depositsSeen?.inc();

    // Track the transaction
    this.trackTransaction({
      txHash: tx.txID,
      from: fromAddress,
      etridRecipient,
      amount,
      token: tokenConfig.symbol,
      tokenContract: contractAddress,
      blockNumber,
      blockTimestamp: tx.raw_data?.timestamp || Date.now(),
      confirmations,
      energyUsed: txInfo?.receipt?.energy_usage_total || 0,
      bandwidthUsed: txInfo?.receipt?.net_usage || 0,
      memo,
    });
  }

  /**
   * Query TRC20 transfer events from event server
   */
  private async queryTRC20Transfers(
    blockNumber: number,
    currentBlock: number
  ): Promise<void> {
    try {
      // Query events for bridge address
      const events = await this.tronWeb.event.getEventsByContractAddress(
        this.bridgeAddress,
        {
          eventName: 'Transfer',
          blockNumber,
          onlyConfirmed: false,
        }
      );

      if (!events || !Array.isArray(events)) {
        return;
      }

      for (const event of events as TRC20TransferLog[]) {
        if (event.event_name !== 'Transfer') {
          continue;
        }

        const tokenConfig = this.tokenContracts.get(
          event.contract_address.toLowerCase()
        );
        if (!tokenConfig) {
          continue;
        }

        // Check if transfer is to bridge
        const toAddress = this.tronWeb.address.fromHex(event.result.to);
        if (toAddress !== this.bridgeAddress) {
          continue;
        }

        const txHash = event.transaction_id;
        if (this.processedTxHashes.has(txHash)) {
          continue;
        }

        // Get full transaction info
        const txInfo = await this.getTransactionInfo(txHash);
        const tx = await this.tronWeb.trx.getTransaction(txHash);

        const fromAddress = this.tronWeb.address.fromHex(event.result.from);
        const amount = BigInt(event.result.value);

        // Extract memo
        const memo = this.extractMemo(tx?.raw_data?.data);
        const etridRecipient = this.parseEtridRecipient(memo);

        if (!etridRecipient) {
          continue;
        }

        const confirmations = currentBlock - event.block_number;

        logger.info('TRC20 transfer event detected', {
          txHash,
          token: tokenConfig.symbol,
          from: fromAddress,
          amount: amount.toString(),
          etridRecipient,
          confirmations,
        });

        depositsSeen?.inc();

        this.trackTransaction({
          txHash,
          from: fromAddress,
          etridRecipient,
          amount,
          token: tokenConfig.symbol,
          tokenContract: event.contract_address,
          blockNumber: event.block_number,
          blockTimestamp: event.block_timestamp,
          confirmations,
          energyUsed: txInfo?.receipt?.energy_usage_total || 0,
          bandwidthUsed: txInfo?.receipt?.net_usage || 0,
          memo,
        });
      }
    } catch (error) {
      // Event server might not be available
      logger.debug('Failed to query TRC20 events', { error });
    }
  }

  /**
   * Track a transaction for confirmation
   */
  private trackTransaction(tx: Omit<TrackedTransaction, 'status' | 'firstSeen'>): void {
    const key = `${tx.txHash}:${tx.token}`;

    if (this.trackedTransactions.has(key)) {
      // Update confirmations
      const tracked = this.trackedTransactions.get(key)!;
      tracked.confirmations = tx.confirmations;
      return;
    }

    this.trackedTransactions.set(key, {
      ...tx,
      status: 'pending',
      firstSeen: Date.now(),
    });

    // Check if already confirmed
    if (tx.confirmations >= this.minConfirmations) {
      this.emitDepositEvent(key);
    }
  }

  /**
   * Update confirmations for pending transactions
   */
  private async updatePendingConfirmations(currentBlock: number): Promise<void> {
    for (const [key, tx] of this.trackedTransactions) {
      if (tx.status !== 'pending') {
        continue;
      }

      tx.confirmations = currentBlock - tx.blockNumber;

      if (tx.confirmations >= this.minConfirmations) {
        this.emitDepositEvent(key);
      }
    }
  }

  /**
   * Emit deposit event when confirmed
   */
  private emitDepositEvent(key: string): void {
    const tx = this.trackedTransactions.get(key);
    if (!tx || tx.status === 'emitted') {
      return;
    }

    tx.status = 'confirmed';

    const event: TronDepositEvent = {
      id: key,
      txHash: tx.txHash,
      from: tx.from,
      etridRecipient: tx.etridRecipient,
      amount: tx.amount,
      token: tx.token,
      tokenContract: tx.tokenContract,
      blockNumber: tx.blockNumber,
      blockTimestamp: tx.blockTimestamp,
      confirmations: tx.confirmations,
      energyUsed: tx.energyUsed,
      bandwidthUsed: tx.bandwidthUsed,
      memo: tx.memo,
    };

    logger.info('TRON deposit confirmed', {
      txHash: tx.txHash,
      token: tx.token,
      amount: tx.amount.toString(),
      etridRecipient: tx.etridRecipient,
      confirmations: tx.confirmations,
    });

    this.emit('deposit', event);

    tx.status = 'emitted';
    this.processedTxHashes.add(tx.txHash);
    this.depositsProcessed++;
    depositsConfirmed?.inc();

    // Clean up after 1 hour
    setTimeout(() => {
      this.trackedTransactions.delete(key);
    }, 3600000);
  }

  /**
   * Get current block number
   */
  private async getCurrentBlockNumber(): Promise<number> {
    const block = await this.tronWeb.trx.getCurrentBlock();
    return block?.block_header?.raw_data?.number || 0;
  }

  /**
   * Get transaction info
   */
  private async getTransactionInfo(txHash: string): Promise<TronTransactionInfo | null> {
    try {
      return await this.tronWeb.trx.getTransactionInfo(txHash);
    } catch {
      return null;
    }
  }

  /**
   * Extract memo from transaction data
   */
  private extractMemo(data?: string): string | undefined {
    if (!data) {
      return undefined;
    }

    try {
      // TRON memos are hex-encoded
      return Buffer.from(data, 'hex').toString('utf8');
    } catch {
      return undefined;
    }
  }

  /**
   * Parse ETRID recipient from memo
   * Expected format: "ETRID:<ss58_address>"
   */
  private parseEtridRecipient(memo?: string): string | null {
    if (!memo) {
      return null;
    }

    // Check for ETRID: prefix
    const prefixMatch = memo.match(/^ETRID:([a-zA-Z0-9]+)$/);
    if (prefixMatch) {
      return prefixMatch[1];
    }

    // Check if entire memo is a valid SS58 address (starts with 5)
    if (/^5[a-zA-Z0-9]{47}$/.test(memo.trim())) {
      return memo.trim();
    }

    return null;
  }

  /**
   * Handle errors
   */
  private handleError(message: string, error: unknown): void {
    this.errors++;
    this.lastError = message;
    this.lastErrorTime = Date.now();

    const errorMsg = error instanceof Error ? error.message : String(error);

    logger.error(message, { error: errorMsg });
    recordErrorCounter.inc({ type: 'monitor', source: 'tron' });

    this.emit('error', new Error(`${message}: ${errorMsg}`));
  }
}

// MonitorStatus type is exported from BitcoinMonitor
