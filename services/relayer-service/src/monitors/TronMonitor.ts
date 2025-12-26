/**
 * TRON BRIDGE MONITOR
 *
 * Production-ready monitor for TRON blockchain deposits (TRX and TRC-20 tokens)
 * Optimized for USDT (63% of global USDT supply on TRON)
 *
 * Key Features:
 * - Monitors TRX and TRC-20 token deposits to bridge contract
 * - Tracks energy and bandwidth usage for TRON-specific resource model
 * - Supports both mainnet and shasta testnet
 * - Handles base58/hex address conversion
 * - Prometheus metrics integration
 * - Comprehensive error handling and recovery
 * - 19 block confirmations (super representative finality)
 */

import TronWeb from 'tronweb';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import {
  tronConnected,
  tronBlockHeight,
  lastBlockTimestamp,
  depositsSeen,
  recordError,
} from '../metrics';

// TRON address is 21 bytes (base58 encoded to 34 chars starting with 'T')
export type TronAddress = string; // Base58 encoded (e.g., "TYmS7...")
export type TronTxId = string; // 64 hex chars

/**
 * TRX deposit event from bridge contract
 */
export interface TrxDepositEvent {
  etridAccount: Uint8Array; // 32 bytes SS58 account
  tronAddress: TronAddress;
  amount: bigint; // in SUN (1 TRX = 1,000,000 SUN)
  txId: TronTxId;
  blockNumber: number;
  blockTimestamp: number;
  confirmations: number;
  energyUsage: number;
  bandwidthUsage: number;
  timestamp: number;
}

/**
 * TRC-20 token deposit event
 */
export interface Trc20DepositEvent {
  etridAccount: Uint8Array;
  tronAddress: TronAddress;
  tokenContract: TronAddress; // TRC-20 contract address
  tokenSymbol: string; // USDT, USDC, etc.
  amount: bigint; // in token's smallest unit
  txId: TronTxId;
  blockNumber: number;
  blockTimestamp: number;
  confirmations: number;
  energyUsage: number;
  bandwidthUsage: number;
  timestamp: number;
}

/**
 * TRON Monitor configuration
 */
export interface TronMonitorConfig {
  // RPC endpoints
  fullNodeUrl: string; // e.g., https://api.trongrid.io
  solidityNodeUrl: string; // e.g., https://api.trongrid.io
  eventServerUrl: string; // e.g., https://api.trongrid.io

  // Network
  network: 'mainnet' | 'shasta' | 'nile';

  // Bridge contract
  bridgeContractAddress: TronAddress;

  // Supported TRC-20 tokens
  supportedTokens: {
    address: TronAddress;
    symbol: string;
    decimals: number;
  }[];

  // USDT contract (most important - 63% of global USDT)
  usdtContractAddress?: TronAddress;

  // Polling configuration
  pollIntervalMs: number; // Default: 3000 (3 seconds = TRON block time)
  startBlock?: number; // Block to start monitoring from

  // Confirmations
  minConfirmations: number; // Default: 19 (super representative finality)

  // Resource limits
  maxEnergyLimit: number; // Default: 150,000,000
  maxBandwidthLimit: number; // Default: 5,000

  // API key for TronGrid (optional but recommended for rate limits)
  tronGridApiKey?: string;
}

/**
 * Monitor status
 */
export interface TronMonitorStatus {
  isRunning: boolean;
  lastBlock: number;
  depositsProcessed: number;
  errors: number;
  lastError?: string;
  lastErrorTime?: number;
  networkInfo?: {
    chainId: string;
    solidityBlock: number;
    energyPrice: number;
    bandwidthPrice: number;
  };
}

/**
 * TRON Bridge Monitor
 *
 * Monitors TRON blockchain for bridge deposits and emits events
 * for the relayer to submit to ËTRID runtime
 */
export class TronMonitor extends EventEmitter {
  private tronWeb: TronWeb | null = null;
  private bridgeContract: any = null;

  private isRunning = false;
  private lastProcessedBlock = 0;
  private depositsProcessed = 0;
  private errors = 0;
  private lastError?: string;
  private lastErrorTime?: number;
  private pollTimer?: NodeJS.Timeout;

  // Bridge contract ABI for deposits
  private readonly BRIDGE_CONTRACT_ABI = [
    {
      "anonymous": false,
      "inputs": [
        { "indexed": true, "name": "depositor", "type": "address" },
        { "indexed": false, "name": "etridAccount", "type": "bytes32" },
        { "indexed": false, "name": "amount", "type": "uint256" }
      ],
      "name": "TrxDeposit",
      "type": "event"
    },
    {
      "anonymous": false,
      "inputs": [
        { "indexed": true, "name": "depositor", "type": "address" },
        { "indexed": true, "name": "tokenContract", "type": "address" },
        { "indexed": false, "name": "etridAccount", "type": "bytes32" },
        { "indexed": false, "name": "amount", "type": "uint256" }
      ],
      "name": "Trc20Deposit",
      "type": "event"
    }
  ];

  // TRC-20 ABI for token info
  private readonly TRC20_ABI = [
    {
      "constant": true,
      "inputs": [],
      "name": "name",
      "outputs": [{ "name": "", "type": "string" }],
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "symbol",
      "outputs": [{ "name": "", "type": "string" }],
      "type": "function"
    },
    {
      "constant": true,
      "inputs": [],
      "name": "decimals",
      "outputs": [{ "name": "", "type": "uint8" }],
      "type": "function"
    }
  ];

  constructor(private config: TronMonitorConfig) {
    super();
  }

  /**
   * Start monitoring TRON chain
   */
  async start(): Promise<void> {
    logger.info('Starting TRON monitor...', {
      network: this.config.network,
      fullNode: this.config.fullNodeUrl,
      bridgeContract: this.config.bridgeContractAddress,
    });

    try {
      // Initialize TronWeb
      const headers: Record<string, string> = {};
      if (this.config.tronGridApiKey) {
        headers['TRON-PRO-API-KEY'] = this.config.tronGridApiKey;
      }

      this.tronWeb = new TronWeb({
        fullHost: this.config.fullNodeUrl,
        headers,
        solidityNode: this.config.solidityNodeUrl,
        eventServer: this.config.eventServerUrl,
      });

      // Validate connection
      const isConnected = await this.tronWeb.isConnected();
      if (!isConnected.fullNode) {
        throw new Error('Failed to connect to TRON full node');
      }

      // Get network info
      const nodeInfo = await this.tronWeb.trx.getNodeInfo();
      const chainId = await this.tronWeb.trx.getChainParameters();
      const currentBlock = await this.tronWeb.trx.getCurrentBlock();

      logger.info('Connected to TRON network', {
        network: this.config.network,
        blockNumber: currentBlock.block_header.raw_data.number,
        nodeInfo: nodeInfo.configNodeInfo,
      });

      // Initialize bridge contract
      this.bridgeContract = await this.tronWeb.contract(
        this.BRIDGE_CONTRACT_ABI,
        this.config.bridgeContractAddress
      );

      // Set starting block
      if (this.config.startBlock) {
        this.lastProcessedBlock = this.config.startBlock;
      } else {
        this.lastProcessedBlock = currentBlock.block_header.raw_data.number;
      }

      logger.info('TRON bridge contract initialized', {
        contractAddress: this.config.bridgeContractAddress,
        startBlock: this.lastProcessedBlock,
      });

      // Start polling for events
      this.isRunning = true;
      tronConnected.set(1);
      this.emit('started');

      this.startPolling();

      logger.info('TRON monitor started successfully');
    } catch (error) {
      logger.error('Failed to start TRON monitor', error);
      tronConnected.set(0);
      recordError('tron_connection', 'TronMonitor');
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Start polling for new blocks and events
   */
  private startPolling(): void {
    if (!this.isRunning) return;

    this.pollTimer = setInterval(async () => {
      try {
        await this.pollForEvents();
      } catch (error) {
        logger.error('Error during TRON polling', error);
        this.handleError(error);
      }
    }, this.config.pollIntervalMs);

    // Initial poll
    this.pollForEvents().catch((error) => {
      logger.error('Error during initial TRON poll', error);
      this.handleError(error);
    });
  }

  /**
   * Poll for new events from TRON blockchain
   */
  private async pollForEvents(): Promise<void> {
    if (!this.tronWeb) {
      throw new Error('TronWeb not initialized');
    }

    try {
      // Get current block (use solidity node for confirmed blocks)
      const solidityBlock = await this.tronWeb.trx.getCurrentBlock();
      const currentBlockNum = solidityBlock.block_header.raw_data.number;

      // Calculate confirmed block (subtract minimum confirmations)
      const confirmedBlock = currentBlockNum - this.config.minConfirmations;

      // Only process if we have new confirmed blocks
      if (confirmedBlock <= this.lastProcessedBlock) {
        return;
      }

      logger.debug('Polling TRON events', {
        currentBlock: currentBlockNum,
        confirmedBlock,
        lastProcessed: this.lastProcessedBlock,
      });

      // Query events from bridge contract
      // Note: TronWeb uses getEventResult() with pagination
      const events = await this.tronWeb.event.getEventResult(
        this.config.bridgeContractAddress,
        {
          eventName: null, // Get all events
          blockNumber: null, // We'll filter by block range
          onlyConfirmed: true,
          minBlockTimestamp: this.lastProcessedBlock * 1000, // TRON uses ms
          maxBlockTimestamp: confirmedBlock * 1000,
          orderBy: 'block_timestamp,asc',
        }
      );

      if (events && events.length > 0) {
        logger.info(`Found ${events.length} TRON events in blocks ${this.lastProcessedBlock}-${confirmedBlock}`);

        // Process each event
        for (const event of events) {
          await this.processEvent(event, confirmedBlock);
        }
      }

      // Update last processed block
      this.lastProcessedBlock = confirmedBlock;

      // Update metrics
      tronBlockHeight.set(confirmedBlock);
      lastBlockTimestamp.set({ chain: 'tron' }, Date.now() / 1000);

    } catch (error: any) {
      // Handle rate limiting gracefully
      if (error.message?.includes('rate limit') || error.message?.includes('429')) {
        logger.warn('TRON API rate limit hit, backing off...');
        // Temporarily increase poll interval
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        throw error;
      }
    }
  }

  /**
   * Process a single event from TRON
   */
  private async processEvent(event: any, currentBlock: number): Promise<void> {
    try {
      const eventName = event.event_name || event.event;
      const blockNumber = event.block_number;
      const txId = event.transaction_id;

      logger.debug('Processing TRON event', {
        eventName,
        blockNumber,
        txId,
      });

      // Get transaction receipt for energy and bandwidth info
      const txInfo = await this.getTxInfo(txId);
      const confirmations = currentBlock - blockNumber;

      if (eventName === 'TrxDeposit') {
        await this.processTrxDeposit(event, txInfo, confirmations);
      } else if (eventName === 'Trc20Deposit') {
        await this.processTrc20Deposit(event, txInfo, confirmations);
      } else {
        logger.debug('Unknown TRON event type', { eventName });
      }

    } catch (error) {
      logger.error('Error processing TRON event', { event, error });
      this.handleError(error);
    }
  }

  /**
   * Process TRX deposit event
   */
  private async processTrxDeposit(
    event: any,
    txInfo: any,
    confirmations: number
  ): Promise<void> {
    try {
      const result = event.result;

      // Extract event data
      const depositor = this.tronWeb!.address.fromHex(result.depositor);
      const etridAccount = this.hexToBytes(result.etridAccount);
      const amount = BigInt(result.amount);

      // Create deposit event
      const depositEvent: TrxDepositEvent = {
        etridAccount,
        tronAddress: depositor,
        amount,
        txId: event.transaction_id,
        blockNumber: event.block_number,
        blockTimestamp: event.block_timestamp,
        confirmations,
        energyUsage: txInfo.energyUsage || 0,
        bandwidthUsage: txInfo.bandwidthUsage || 0,
        timestamp: Date.now(),
      };

      logger.info('Processed TRON TRX deposit', {
        depositor,
        etridAccount: this.bytesToHex(etridAccount),
        amount: amount.toString(),
        amountTRX: (Number(amount) / 1_000_000).toFixed(6),
        blockNumber: event.block_number,
        txId: event.transaction_id,
        confirmations,
        energyUsage: depositEvent.energyUsage,
        bandwidthUsage: depositEvent.bandwidthUsage,
      });

      this.depositsProcessed++;

      // Update metrics
      depositsSeen.inc({
        chain: 'tron',
        token: 'TRX',
      });

      // Emit event for relayer
      this.emit('trxDeposit', depositEvent);

    } catch (error) {
      logger.error('Error processing TRX deposit event', { event, error });
      this.handleError(error);
    }
  }

  /**
   * Process TRC-20 token deposit event
   */
  private async processTrc20Deposit(
    event: any,
    txInfo: any,
    confirmations: number
  ): Promise<void> {
    try {
      const result = event.result;

      // Extract event data
      const depositor = this.tronWeb!.address.fromHex(result.depositor);
      const tokenContract = this.tronWeb!.address.fromHex(result.tokenContract);
      const etridAccount = this.hexToBytes(result.etridAccount);
      const amount = BigInt(result.amount);

      // Get token info
      const tokenInfo = await this.getTokenInfo(tokenContract);

      // Check if token is supported
      const isSupported = this.config.supportedTokens.some(
        t => t.address === tokenContract
      );

      if (!isSupported) {
        logger.warn('Unsupported TRC-20 token deposit detected', {
          tokenContract,
          depositor,
        });
        return;
      }

      // Special handling for USDT (63% of global supply)
      const isUsdt = this.config.usdtContractAddress === tokenContract;

      // Create deposit event
      const depositEvent: Trc20DepositEvent = {
        etridAccount,
        tronAddress: depositor,
        tokenContract,
        tokenSymbol: tokenInfo.symbol,
        amount,
        txId: event.transaction_id,
        blockNumber: event.block_number,
        blockTimestamp: event.block_timestamp,
        confirmations,
        energyUsage: txInfo.energyUsage || 0,
        bandwidthUsage: txInfo.bandwidthUsage || 0,
        timestamp: Date.now(),
      };

      logger.info('Processed TRON TRC-20 deposit', {
        depositor,
        etridAccount: this.bytesToHex(etridAccount),
        tokenContract,
        tokenSymbol: tokenInfo.symbol,
        amount: amount.toString(),
        humanAmount: (Number(amount) / Math.pow(10, tokenInfo.decimals)).toFixed(tokenInfo.decimals),
        blockNumber: event.block_number,
        txId: event.transaction_id,
        confirmations,
        energyUsage: depositEvent.energyUsage,
        bandwidthUsage: depositEvent.bandwidthUsage,
        isUsdt,
      });

      this.depositsProcessed++;

      // Update metrics
      depositsSeen.inc({
        chain: 'tron',
        token: tokenInfo.symbol,
      });

      // Emit appropriate event
      if (isUsdt) {
        this.emit('usdtDeposit', depositEvent);
      } else {
        this.emit('trc20Deposit', depositEvent);
      }

    } catch (error) {
      logger.error('Error processing TRC-20 deposit event', { event, error });
      this.handleError(error);
    }
  }

  /**
   * Get transaction info including energy and bandwidth usage
   */
  private async getTxInfo(txId: string): Promise<any> {
    if (!this.tronWeb) {
      throw new Error('TronWeb not initialized');
    }

    try {
      const txInfo = await this.tronWeb.trx.getTransactionInfo(txId);

      return {
        energyUsage: txInfo.receipt?.energy_usage_total || 0,
        bandwidthUsage: txInfo.receipt?.net_usage || 0,
        energyFee: txInfo.receipt?.energy_fee || 0,
        netFee: txInfo.receipt?.net_fee || 0,
        result: txInfo.receipt?.result,
      };
    } catch (error) {
      logger.warn('Failed to get TRON transaction info', { txId, error });
      return {
        energyUsage: 0,
        bandwidthUsage: 0,
        energyFee: 0,
        netFee: 0,
        result: 'UNKNOWN',
      };
    }
  }

  /**
   * Get TRC-20 token information
   */
  private async getTokenInfo(contractAddress: string): Promise<{
    symbol: string;
    name: string;
    decimals: number;
  }> {
    if (!this.tronWeb) {
      throw new Error('TronWeb not initialized');
    }

    try {
      const contract = await this.tronWeb.contract(this.TRC20_ABI, contractAddress);

      const [symbol, name, decimals] = await Promise.all([
        contract.symbol().call(),
        contract.name().call(),
        contract.decimals().call(),
      ]);

      return {
        symbol: symbol.toString(),
        name: name.toString(),
        decimals: Number(decimals),
      };
    } catch (error) {
      logger.warn('Failed to get TRC-20 token info', { contractAddress, error });

      // Check if it's known USDT contract
      if (contractAddress === this.config.usdtContractAddress) {
        return { symbol: 'USDT', name: 'Tether USD', decimals: 6 };
      }

      // Return defaults
      return {
        symbol: 'UNKNOWN',
        name: 'Unknown Token',
        decimals: 6, // TRON default
      };
    }
  }

  /**
   * Convert TRON address from base58 to hex
   */
  public addressToHex(address: TronAddress): string {
    if (!this.tronWeb) {
      throw new Error('TronWeb not initialized');
    }
    return this.tronWeb.address.toHex(address);
  }

  /**
   * Convert TRON address from hex to base58
   */
  public addressFromHex(hex: string): TronAddress {
    if (!this.tronWeb) {
      throw new Error('TronWeb not initialized');
    }
    return this.tronWeb.address.fromHex(hex);
  }

  /**
   * Validate TRON address
   */
  public isValidAddress(address: string): boolean {
    if (!this.tronWeb) {
      throw new Error('TronWeb not initialized');
    }
    return this.tronWeb.isAddress(address);
  }

  /**
   * Get 21-byte address from base58 address
   */
  public getAddressBytes(address: TronAddress): Uint8Array {
    const hexAddr = this.addressToHex(address);
    return this.hexToBytes(hexAddr);
  }

  /**
   * Convert hex string to bytes
   */
  private hexToBytes(hex: string): Uint8Array {
    // Remove 0x prefix if present
    hex = hex.replace(/^0x/i, '');

    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  }

  /**
   * Convert bytes to hex string
   */
  private bytesToHex(bytes: Uint8Array): string {
    return '0x' + Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    logger.info('Stopping TRON monitor...');

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }

    this.isRunning = false;
    this.tronWeb = null;
    this.bridgeContract = null;

    tronConnected.set(0);
    this.emit('stopped');

    logger.info('TRON monitor stopped');
  }

  /**
   * Get monitor status
   */
  getStatus(): TronMonitorStatus {
    const status: TronMonitorStatus = {
      isRunning: this.isRunning,
      lastBlock: this.lastProcessedBlock,
      depositsProcessed: this.depositsProcessed,
      errors: this.errors,
      lastError: this.lastError,
      lastErrorTime: this.lastErrorTime,
    };

    return status;
  }

  /**
   * Get current TRON block number
   */
  async getCurrentBlock(): Promise<number> {
    if (!this.tronWeb) {
      throw new Error('TronWeb not initialized');
    }

    const block = await this.tronWeb.trx.getCurrentBlock();
    return block.block_header.raw_data.number;
  }

  /**
   * Get confirmed block number (current - min confirmations)
   */
  async getConfirmedBlock(): Promise<number> {
    const currentBlock = await this.getCurrentBlock();
    return currentBlock - this.config.minConfirmations;
  }

  /**
   * Query deposit by transaction ID
   */
  async getDepositByTxId(txId: string): Promise<any> {
    if (!this.tronWeb) {
      throw new Error('TronWeb not initialized');
    }

    try {
      const events = await this.tronWeb.event.getEventResult(
        this.config.bridgeContractAddress,
        {
          eventName: null,
          transactionID: txId,
        }
      );

      return events && events.length > 0 ? events[0] : null;
    } catch (error) {
      logger.error('Error querying TRON deposit', { txId, error });
      return null;
    }
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
}

/**
 * Create TRON monitor with default configuration
 */
export function createTronMonitor(
  bridgeContractAddress: TronAddress,
  network: 'mainnet' | 'shasta' | 'nile' = 'mainnet',
  options?: Partial<TronMonitorConfig>
): TronMonitor {
  // Network-specific endpoints
  const networkEndpoints = {
    mainnet: {
      fullNodeUrl: 'https://api.trongrid.io',
      solidityNodeUrl: 'https://api.trongrid.io',
      eventServerUrl: 'https://api.trongrid.io',
    },
    shasta: {
      fullNodeUrl: 'https://api.shasta.trongrid.io',
      solidityNodeUrl: 'https://api.shasta.trongrid.io',
      eventServerUrl: 'https://api.shasta.trongrid.io',
    },
    nile: {
      fullNodeUrl: 'https://nile.trongrid.io',
      solidityNodeUrl: 'https://nile.trongrid.io',
      eventServerUrl: 'https://nile.trongrid.io',
    },
  };

  const endpoints = networkEndpoints[network];

  // USDT contracts by network
  const usdtContracts = {
    mainnet: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', // Official USDT on TRON mainnet
    shasta: 'TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs', // Test USDT on shasta
    nile: 'TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj', // Test USDT on nile
  };

  const config: TronMonitorConfig = {
    ...endpoints,
    network,
    bridgeContractAddress,
    supportedTokens: [
      {
        address: usdtContracts[network],
        symbol: 'USDT',
        decimals: 6,
      },
    ],
    usdtContractAddress: usdtContracts[network],
    pollIntervalMs: 3000, // 3 seconds (TRON block time)
    minConfirmations: 19, // Super representative finality
    maxEnergyLimit: 150_000_000,
    maxBandwidthLimit: 5_000,
    ...options,
  };

  return new TronMonitor(config);
}

export default TronMonitor;
