/**
 * Bitcoin Bridge Monitor for ETRID
 * Location: services/bridge-monitor-service/src/monitors/BitcoinMonitor.ts
 *
 * Monitors Bitcoin blockchain for deposits to bridge addresses and emits events
 * when confirmations threshold is met. Supports both mainnet and testnet.
 *
 * Features:
 * - UTXO monitoring via Electrum/Blockstream API
 * - OP_RETURN memo parsing for ETRID recipient extraction
 * - Confirmation tracking (minimum 6 confirmations)
 * - Transaction replay prevention
 * - Comprehensive error handling
 * - Prometheus metrics integration
 * - EventEmitter pattern for loose coupling
 */

import { EventEmitter } from 'events';
import axios, { AxiosInstance } from 'axios';
import * as bitcoin from 'bitcoinjs-lib';
import { logger } from '../utils/logger';
import { BitcoinMonitorConfig, BitcoinDepositEvent, MonitorStatus } from '../types';
import {
  bitcoinConnected,
  bitcoinBlockHeight,
  lastBlockTimestamp,
  depositsSeen,
  depositsConfirmed,
  recordError,
} from '../metrics';

/**
 * Bitcoin Network Types
 */
export enum BitcoinNetwork {
  MAINNET = 'mainnet',
  TESTNET = 'testnet',
}

/**
 * Bitcoin transaction with confirmation details
 */
interface BitcoinTransaction {
  txid: string;
  confirmations: number;
  blockHeight: number;
  blockTime: number;
  vout: Array<{
    value: number;
    scriptPubKey: {
      hex: string;
      type: string;
      addresses?: string[];
    };
  }>;
  vin: Array<{
    txid: string;
    vout: number;
  }>;
}

/**
 * UTXO information
 */
interface UTXO {
  txid: string;
  vout: number;
  value: number;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_time?: number;
  };
}

/**
 * Processed deposit tracking
 */
interface ProcessedDeposit {
  txid: string;
  vout: number;
  amountSatoshi: number;
  etridRecipient: string;
  confirmations: number;
  blockHeight: number;
  processedAt: number;
  status: 'pending' | 'confirmed' | 'emitted';
}

/**
 * Bitcoin Monitor
 * Monitors Bitcoin blockchain for bridge deposits
 */
export class BitcoinMonitor extends EventEmitter {
  private apiClient: AxiosInstance;
  private network: bitcoin.Network;
  private networkType: BitcoinNetwork;
  private isRunning = false;
  private lastProcessedBlock = 0;
  private depositsProcessed = 0;
  private errors = 0;
  private lastError?: string;
  private lastErrorTime?: number;

  // Polling interval in milliseconds
  private pollingInterval = 60000; // 1 minute
  private pollingTimer?: NodeJS.Timeout;

  // Track processed deposits to prevent replay
  private processedDeposits = new Map<string, ProcessedDeposit>();

  // Minimum confirmations required (default: 6 for Bitcoin)
  private minConfirmations: number;

  // Bridge address to monitor
  private bridgeAddress: string;

  constructor(private config: BitcoinMonitorConfig) {
    super();

    this.bridgeAddress = config.bridgeAddress;
    this.minConfirmations = config.minConfirmations || 6;
    this.networkType = config.network || BitcoinNetwork.MAINNET;
    this.pollingInterval = config.pollingInterval || 60000;

    // Set Bitcoin network
    this.network = this.networkType === BitcoinNetwork.MAINNET
      ? bitcoin.networks.bitcoin
      : bitcoin.networks.testnet;

    // Initialize API client
    const baseURL = this.networkType === BitcoinNetwork.MAINNET
      ? config.apiUrl || 'https://blockstream.info/api'
      : config.apiUrl || 'https://blockstream.info/testnet/api';

    this.apiClient = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for logging
    this.apiClient.interceptors.request.use(
      (config) => {
        logger.debug('Bitcoin API request', {
          method: config.method,
          url: config.url,
        });
        return config;
      },
      (error) => {
        logger.error('Bitcoin API request error', error);
        return Promise.reject(error);
      }
    );

    // Add response interceptor for error handling
    this.apiClient.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('Bitcoin API response error', {
          message: error.message,
          status: error.response?.status,
          data: error.response?.data,
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Start monitoring Bitcoin blockchain
   */
  async start(): Promise<void> {
    logger.info('Starting Bitcoin monitor...', {
      network: this.networkType,
      bridgeAddress: this.bridgeAddress,
      minConfirmations: this.minConfirmations,
      pollingInterval: this.pollingInterval,
    });

    try {
      // Test connection
      const blockHeight = await this.getCurrentBlockHeight();
      this.lastProcessedBlock = blockHeight;

      logger.info('Connected to Bitcoin network', {
        network: this.networkType,
        blockHeight,
      });

      this.isRunning = true;
      bitcoinConnected.set(1);

      // Start polling
      await this.poll();
      this.schedulePoll();

      this.emit('started');
      logger.info('Bitcoin monitor started');
    } catch (error) {
      logger.error('Failed to start Bitcoin monitor', error);
      bitcoinConnected.set(0);
      recordError('bitcoin_connection', 'BitcoinMonitor');
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    logger.info('Stopping Bitcoin monitor...');

    this.isRunning = false;

    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = undefined;
    }

    this.emit('stopped');
    logger.info('Bitcoin monitor stopped');
  }

  /**
   * Schedule next poll
   */
  private schedulePoll(): void {
    if (!this.isRunning) return;

    this.pollingTimer = setTimeout(async () => {
      try {
        await this.poll();
      } catch (error) {
        logger.error('Error during Bitcoin poll', error);
        this.handleError(error);
      }

      this.schedulePoll();
    }, this.pollingInterval);
  }

  /**
   * Poll for new deposits
   */
  private async poll(): Promise<void> {
    if (!this.isRunning) return;

    try {
      const startTime = Date.now();

      // Get current block height
      const currentBlock = await this.getCurrentBlockHeight();

      if (currentBlock > this.lastProcessedBlock) {
        logger.debug('New Bitcoin blocks detected', {
          lastBlock: this.lastProcessedBlock,
          currentBlock,
          newBlocks: currentBlock - this.lastProcessedBlock,
        });

        this.lastProcessedBlock = currentBlock;
        bitcoinBlockHeight.set(currentBlock);
        lastBlockTimestamp.set({ chain: 'bitcoin' }, Date.now() / 1000);
      }

      // Fetch UTXOs for bridge address
      const utxos = await this.fetchAddressUTXOs(this.bridgeAddress);

      logger.debug('Fetched UTXOs for bridge address', {
        address: this.bridgeAddress,
        utxoCount: utxos.length,
      });

      // Process each UTXO
      for (const utxo of utxos) {
        await this.processUTXO(utxo);
      }

      // Update confirmations for pending deposits
      await this.updatePendingDeposits();

      const duration = Date.now() - startTime;
      logger.debug('Bitcoin poll completed', {
        duration: `${duration}ms`,
        utxosProcessed: utxos.length,
      });

    } catch (error) {
      logger.error('Error during Bitcoin poll', error);
      this.handleError(error);
      recordError('bitcoin_poll', 'BitcoinMonitor');
    }
  }

  /**
   * Get current Bitcoin block height
   */
  private async getCurrentBlockHeight(): Promise<number> {
    try {
      const response = await this.apiClient.get<string>('/blocks/tip/height');
      return parseInt(response.data, 10);
    } catch (error) {
      logger.error('Failed to fetch Bitcoin block height', error);
      throw error;
    }
  }

  /**
   * Fetch UTXOs for an address
   */
  private async fetchAddressUTXOs(address: string): Promise<UTXO[]> {
    try {
      const response = await this.apiClient.get<UTXO[]>(`/address/${address}/utxo`);
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch UTXOs', { address, error });
      throw error;
    }
  }

  /**
   * Fetch full transaction details
   */
  private async fetchTransaction(txid: string): Promise<BitcoinTransaction> {
    try {
      const response = await this.apiClient.get<any>(`/tx/${txid}`);

      const tx = response.data;
      const confirmations = tx.status.confirmed
        ? (this.lastProcessedBlock - tx.status.block_height) + 1
        : 0;

      return {
        txid: tx.txid,
        confirmations,
        blockHeight: tx.status.block_height || 0,
        blockTime: tx.status.block_time || 0,
        vout: tx.vout.map((output: any) => ({
          value: output.value,
          scriptPubKey: {
            hex: output.scriptpubkey,
            type: output.scriptpubkey_type,
            addresses: output.scriptpubkey_address ? [output.scriptpubkey_address] : undefined,
          },
        })),
        vin: tx.vin.map((input: any) => ({
          txid: input.txid,
          vout: input.vout,
        })),
      };
    } catch (error) {
      logger.error('Failed to fetch transaction', { txid, error });
      throw error;
    }
  }

  /**
   * Process a UTXO
   */
  private async processUTXO(utxo: UTXO): Promise<void> {
    const depositKey = `${utxo.txid}:${utxo.vout}`;

    // Skip if already processed
    const existing = this.processedDeposits.get(depositKey);
    if (existing && existing.status === 'emitted') {
      return;
    }

    // Skip unconfirmed transactions
    if (!utxo.status.confirmed) {
      return;
    }

    const confirmations = utxo.status.block_height
      ? (this.lastProcessedBlock - utxo.status.block_height) + 1
      : 0;

    // Fetch full transaction to extract OP_RETURN data
    const tx = await this.fetchTransaction(utxo.txid);

    // Extract ETRID recipient from OP_RETURN
    const etridRecipient = this.extractEtridRecipient(tx);

    if (!etridRecipient) {
      logger.warn('No valid ETRID recipient found in transaction', {
        txid: utxo.txid,
        vout: utxo.vout,
      });
      return;
    }

    // Create or update deposit record
    const deposit: ProcessedDeposit = {
      txid: utxo.txid,
      vout: utxo.vout,
      amountSatoshi: utxo.value,
      etridRecipient,
      confirmations,
      blockHeight: utxo.status.block_height || 0,
      processedAt: Date.now(),
      status: confirmations >= this.minConfirmations ? 'confirmed' : 'pending',
    };

    this.processedDeposits.set(depositKey, deposit);

    // Emit deposit detected event (first time only)
    if (!existing) {
      logger.info('Bitcoin deposit detected', {
        txid: deposit.txid,
        vout: deposit.vout,
        amount: deposit.amountSatoshi,
        recipient: deposit.etridRecipient,
        confirmations: deposit.confirmations,
      });

      depositsSeen.inc({ chain: 'bitcoin' });
    }

    // Emit deposit event if confirmations threshold met
    if (deposit.status === 'confirmed' && (!existing || existing.status === 'pending')) {
      await this.emitDepositEvent(deposit);
    }
  }

  /**
   * Update confirmations for pending deposits
   */
  private async updatePendingDeposits(): Promise<void> {
    const pending = Array.from(this.processedDeposits.values()).filter(
      (d) => d.status === 'pending'
    );

    for (const deposit of pending) {
      const confirmations = deposit.blockHeight
        ? (this.lastProcessedBlock - deposit.blockHeight) + 1
        : 0;

      deposit.confirmations = confirmations;

      if (confirmations >= this.minConfirmations) {
        deposit.status = 'confirmed';
        await this.emitDepositEvent(deposit);
      }
    }
  }

  /**
   * Emit deposit event
   */
  private async emitDepositEvent(deposit: ProcessedDeposit): Promise<void> {
    const depositEvent: BitcoinDepositEvent = {
      txid: deposit.txid,
      vout: deposit.vout,
      amountSatoshi: deposit.amountSatoshi,
      etridRecipient: deposit.etridRecipient,
      confirmations: deposit.confirmations,
      blockHeight: deposit.blockHeight,
      timestamp: Date.now(),
    };

    logger.info('Bitcoin deposit confirmed', {
      txid: depositEvent.txid,
      vout: depositEvent.vout,
      amount: depositEvent.amountSatoshi,
      recipient: depositEvent.etridRecipient,
      confirmations: depositEvent.confirmations,
      blockHeight: depositEvent.blockHeight,
    });

    this.depositsProcessed++;
    deposit.status = 'emitted';

    // Update metrics
    depositsConfirmed.inc({ chain: 'bitcoin' });

    this.emit('deposit', depositEvent);
  }

  /**
   * Extract ETRID recipient from OP_RETURN in transaction
   *
   * Expected format: OP_RETURN <ETRID_ADDRESS_HEX>
   * ETRID addresses are 32-byte SS58 encoded, represented as 64 hex characters
   */
  private extractEtridRecipient(tx: BitcoinTransaction): string | null {
    try {
      // Look for OP_RETURN outputs
      for (const output of tx.vout) {
        if (output.scriptPubKey.type === 'nulldata' || output.scriptPubKey.type === 'op_return') {
          const script = Buffer.from(output.scriptPubKey.hex, 'hex');

          // OP_RETURN is 0x6a
          if (script[0] !== 0x6a) continue;

          // Parse the data after OP_RETURN
          const dataLength = script[1];
          const data = script.slice(2, 2 + dataLength);

          // Check if data looks like an ETRID address (hex string)
          if (data.length >= 32 && data.length <= 64) {
            const address = data.toString('hex');

            // Basic validation: check if it's a valid hex string
            if (/^[0-9a-fA-F]+$/.test(address)) {
              logger.debug('Extracted ETRID recipient from OP_RETURN', {
                txid: tx.txid,
                recipient: address,
              });
              return address;
            }
          }

          // Try to parse as UTF-8 string (alternative format)
          const addressStr = data.toString('utf8').trim();
          if (addressStr.length > 0 && /^[0-9a-zA-Z]+$/.test(addressStr)) {
            logger.debug('Extracted ETRID recipient from OP_RETURN (UTF-8)', {
              txid: tx.txid,
              recipient: addressStr,
            });
            return addressStr;
          }
        }
      }

      logger.warn('No OP_RETURN data found in transaction', { txid: tx.txid });
      return null;
    } catch (error) {
      logger.error('Error extracting ETRID recipient', { txid: tx.txid, error });
      return null;
    }
  }

  /**
   * Get monitor status
   */
  getStatus(): MonitorStatus {
    return {
      isRunning: this.isRunning,
      lastBlock: this.lastProcessedBlock,
      eventsProcessed: this.depositsProcessed,
      errors: this.errors,
      lastError: this.lastError,
      lastErrorTime: this.lastErrorTime,
    };
  }

  /**
   * Get pending deposits count
   */
  getPendingDepositsCount(): number {
    return Array.from(this.processedDeposits.values()).filter(
      (d) => d.status === 'pending'
    ).length;
  }

  /**
   * Get confirmed deposits count
   */
  getConfirmedDepositsCount(): number {
    return Array.from(this.processedDeposits.values()).filter(
      (d) => d.status === 'confirmed' || d.status === 'emitted'
    ).length;
  }

  /**
   * Get processed deposits
   */
  getProcessedDeposits(): ProcessedDeposit[] {
    return Array.from(this.processedDeposits.values());
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
   * Get current block number (alias for compatibility)
   */
  async getCurrentBlock(): Promise<number> {
    return await this.getCurrentBlockHeight();
  }

  /**
   * Validate Bitcoin address
   */
  static validateAddress(address: string, network: BitcoinNetwork): boolean {
    try {
      const net = network === BitcoinNetwork.MAINNET
        ? bitcoin.networks.bitcoin
        : bitcoin.networks.testnet;

      bitcoin.address.toOutputScript(address, net);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Parse Bitcoin transaction
   */
  static parseTransaction(txHex: string, network: BitcoinNetwork): bitcoin.Transaction {
    const net = network === BitcoinNetwork.MAINNET
      ? bitcoin.networks.bitcoin
      : bitcoin.networks.testnet;

    return bitcoin.Transaction.fromHex(txHex);
  }
}
