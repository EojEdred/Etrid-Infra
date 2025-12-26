import { EventEmitter } from 'events';
import { Counter, Gauge } from 'prom-client';
import { logger } from '../utils/logger';

/**
 * Cardano Bridge Monitor
 *
 * Monitors Cardano blockchain for bridge deposits using UTXO model.
 * Supports both Blockfrost API and Cardano Serialization Library.
 * Parses transaction metadata for recipient identification.
 */

export interface CardanoMonitorConfig {
  // Connection
  blockfrostApiKey: string;
  blockfrostUrl: string; // https://cardano-mainnet.blockfrost.io/api/v0 or testnet
  network: 'mainnet' | 'testnet' | 'preprod' | 'preview';

  // Bridge configuration
  bridgeAddress: string; // Cardano address (addr1... for mainnet, addr_test1... for testnet)
  minConfirmations: number; // Cardano finality: ~15 epochs or 2k blocks recommended

  // Polling configuration
  pollInterval: number; // milliseconds (default: 20000 for Cardano's ~20s block time)
  startFromSlot?: number; // Optional: start monitoring from specific slot

  // Reconnection
  maxRetries: number;
  retryDelay: number; // milliseconds

  // Optional filters
  minAmount?: number; // Minimum amount in lovelaces (1 ADA = 1,000,000 lovelaces)
  policyId?: string; // Native token policy ID (for non-ADA tokens)
}

export interface CardanoUtxo {
  txHash: string;
  outputIndex: number;
  address: string;
  amount: CardanoValue[];
  dataHash?: string; // Datum hash
  inlineDatum?: string; // Inline datum (Babbage+)
  scriptRef?: string; // Reference script (Babbage+)
  slot: number;
  blockHeight: number;
  blockHash: string;
}

export interface CardanoValue {
  unit: string; // 'lovelace' for ADA, or policyId+assetName for native tokens
  quantity: string;
}

export interface CardanoDepositEvent {
  txHash: string;
  outputIndex: number;
  slot: number;
  epoch: number;
  blockHeight: number;
  blockHash: string;
  timestamp: number;

  // UTXO details
  from: string; // Input address (first input)
  to: string; // Bridge address
  amount: string; // In lovelaces
  asset?: {
    policyId: string;
    assetName: string;
    quantity: string;
  };

  // Metadata
  metadata?: any; // Transaction metadata (label 674 for message)
  etridRecipient?: string; // Parsed from metadata

  // Plutus script data
  plutusDatum?: string; // Datum data (hex)
  plutusRedeemer?: string; // Redeemer data (hex)

  // Confirmations
  confirmations: number;
  isConfirmed: boolean;
}

export interface MonitorStatus {
  isRunning: boolean;
  lastSlot: number;
  lastEpoch: number;
  eventsProcessed: number;
  errors: number;
  lastError?: string;
  lastErrorTime?: number;
}

/**
 * Prometheus Metrics
 */
const cardanoConnected = new Gauge({
  name: 'bridge_cardano_connected',
  help: 'Connected to Cardano node (1 = connected, 0 = disconnected)',
  labelNames: ['network'],
});

const cardanoSlot = new Gauge({
  name: 'bridge_cardano_slot',
  help: 'Latest Cardano slot processed',
  labelNames: ['network'],
});

const cardanoEpoch = new Gauge({
  name: 'bridge_cardano_epoch',
  help: 'Current Cardano epoch',
  labelNames: ['network'],
});

const cardanoDepositsDetected = new Counter({
  name: 'bridge_cardano_deposits_detected_total',
  help: 'Total Cardano deposits detected',
  labelNames: ['network', 'asset_type'],
});

const cardanoLastBlockTimestamp = new Gauge({
  name: 'bridge_cardano_last_block_timestamp',
  help: 'Timestamp of last Cardano block processed',
  labelNames: ['network'],
});

const cardanoErrors = new Counter({
  name: 'bridge_cardano_errors_total',
  help: 'Total Cardano monitor errors',
  labelNames: ['network', 'error_type'],
});

export class CardanoMonitor extends EventEmitter {
  private config: CardanoMonitorConfig;
  private isRunning = false;
  private lastSlot = 0;
  private lastEpoch = 0;
  private lastBlockHeight = 0;
  private eventsProcessed = 0;
  private errors = 0;
  private lastError?: string;
  private lastErrorTime?: number;
  private pollTimer?: NodeJS.Timeout;
  private retryCount = 0;

  // Track processed UTXOs to avoid duplicates
  private processedUtxos = new Set<string>();

  constructor(config: CardanoMonitorConfig) {
    super();
    this.config = config;

    if (config.startFromSlot) {
      this.lastSlot = config.startFromSlot;
    }
  }

  /**
   * Start monitoring Cardano chain
   */
  async start(): Promise<void> {
    logger.info('Starting Cardano monitor...', {
      blockfrostUrl: this.config.blockfrostUrl,
      network: this.config.network,
      bridgeAddress: this.config.bridgeAddress,
    });

    try {
      // Test Blockfrost connection
      await this.testConnection();

      // Get current chain tip
      const tipInfo = await this.getChainTip();
      if (!this.lastSlot) {
        this.lastSlot = tipInfo.slot;
      }
      this.lastEpoch = tipInfo.epoch;
      this.lastBlockHeight = tipInfo.height;

      logger.info('Connected to Cardano network', {
        slot: this.lastSlot,
        epoch: this.lastEpoch,
        height: this.lastBlockHeight,
      });

      this.isRunning = true;
      this.retryCount = 0;

      cardanoConnected.set({ network: this.config.network }, 1);
      this.emit('started');

      // Start polling
      this.startPolling();

      logger.info('Cardano monitor started');
    } catch (error) {
      logger.error('Failed to start Cardano monitor', error);
      cardanoConnected.set({ network: this.config.network }, 0);
      this.handleError(error, 'connection');
      throw error;
    }
  }

  /**
   * Test Blockfrost connection
   */
  private async testConnection(): Promise<void> {
    const response = await fetch(`${this.config.blockfrostUrl}/health`, {
      headers: {
        'project_id': this.config.blockfrostApiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Blockfrost API error: ${response.status} ${response.statusText}`);
    }

    const health = await response.json();
    if (!health.is_healthy) {
      throw new Error('Blockfrost API is not healthy');
    }
  }

  /**
   * Get current chain tip
   */
  private async getChainTip(): Promise<{ slot: number; epoch: number; height: number }> {
    const response = await fetch(`${this.config.blockfrostUrl}/blocks/latest`, {
      headers: {
        'project_id': this.config.blockfrostApiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get chain tip: ${response.status}`);
    }

    const block = await response.json();
    return {
      slot: parseInt(block.slot),
      epoch: parseInt(block.epoch),
      height: parseInt(block.height),
    };
  }

  /**
   * Start polling for new blocks
   */
  private startPolling(): void {
    this.pollTimer = setInterval(async () => {
      try {
        await this.pollNewBlocks();
      } catch (error) {
        logger.error('Error polling for new blocks', error);
        this.handleError(error, 'polling');
      }
    }, this.config.pollInterval);
  }

  /**
   * Poll for new blocks and process UTXOs
   */
  private async pollNewBlocks(): Promise<void> {
    try {
      // Get current chain tip
      const tipInfo = await this.getChainTip();

      if (tipInfo.slot <= this.lastSlot) {
        // No new blocks
        return;
      }

      logger.debug('New Cardano blocks detected', {
        fromSlot: this.lastSlot,
        toSlot: tipInfo.slot,
      });

      // Get address UTXOs since last check
      const utxos = await this.getAddressUtxos(this.config.bridgeAddress);

      // Process new UTXOs
      for (const utxo of utxos) {
        if (utxo.slot > this.lastSlot) {
          await this.processUtxo(utxo, tipInfo.slot);
        }
      }

      // Update last processed slot
      this.lastSlot = tipInfo.slot;
      this.lastEpoch = tipInfo.epoch;
      this.lastBlockHeight = tipInfo.height;

      cardanoSlot.set({ network: this.config.network }, this.lastSlot);
      cardanoEpoch.set({ network: this.config.network }, this.lastEpoch);
      cardanoLastBlockTimestamp.set({ network: this.config.network }, Date.now() / 1000);

      this.retryCount = 0; // Reset retry count on success
    } catch (error) {
      logger.error('Error in pollNewBlocks', error);
      this.handleError(error, 'polling');

      // Implement exponential backoff
      if (this.retryCount < this.config.maxRetries) {
        this.retryCount++;
        const delay = this.config.retryDelay * Math.pow(2, this.retryCount - 1);
        logger.info('Retrying after delay', { delay, attempt: this.retryCount });
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        logger.error('Max retries reached, stopping monitor');
        await this.stop();
      }
    }
  }

  /**
   * Get UTXOs for an address
   */
  private async getAddressUtxos(address: string): Promise<CardanoUtxo[]> {
    const response = await fetch(
      `${this.config.blockfrostUrl}/addresses/${address}/utxos`,
      {
        headers: {
          'project_id': this.config.blockfrostApiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get UTXOs: ${response.status}`);
    }

    const utxos = await response.json();
    return utxos.map((utxo: any) => this.parseUtxo(utxo));
  }

  /**
   * Parse UTXO from Blockfrost response
   */
  private parseUtxo(utxo: any): CardanoUtxo {
    return {
      txHash: utxo.tx_hash,
      outputIndex: utxo.output_index,
      address: utxo.address,
      amount: utxo.amount,
      dataHash: utxo.data_hash,
      inlineDatum: utxo.inline_datum,
      scriptRef: utxo.reference_script_hash,
      slot: 0, // Will be filled from tx info
      blockHeight: 0, // Will be filled from tx info
      blockHash: '', // Will be filled from tx info
    };
  }

  /**
   * Process a UTXO
   */
  private async processUtxo(utxo: CardanoUtxo, currentSlot: number): Promise<void> {
    try {
      // Create unique UTXO identifier
      const utxoId = `${utxo.txHash}#${utxo.outputIndex}`;

      // Skip if already processed
      if (this.processedUtxos.has(utxoId)) {
        return;
      }

      // Get transaction details
      const txInfo = await this.getTransaction(utxo.txHash);

      // Update UTXO with transaction info
      utxo.slot = txInfo.slot;
      utxo.blockHeight = txInfo.blockHeight;
      utxo.blockHash = txInfo.blockHash;

      // Extract ADA amount
      const adaAmount = utxo.amount.find(a => a.unit === 'lovelace');
      if (!adaAmount) {
        logger.debug('UTXO has no ADA', { utxoId });
        return;
      }

      const amountLovelace = parseInt(adaAmount.quantity);

      // Check minimum amount
      if (this.config.minAmount && amountLovelace < this.config.minAmount) {
        logger.debug('UTXO below minimum amount', {
          utxoId,
          amount: amountLovelace,
          minimum: this.config.minAmount,
        });
        return;
      }

      // Get transaction metadata
      const metadata = await this.getTransactionMetadata(utxo.txHash);

      // Parse Etrid recipient from metadata (label 674 is common for messages)
      const etridRecipient = this.parseEtridRecipient(metadata);

      if (!etridRecipient) {
        logger.warn('No Etrid recipient in metadata', { utxoId });
        return;
      }

      // Get sender address (first input)
      const fromAddress = await this.getTransactionSender(utxo.txHash);

      // Calculate confirmations
      const confirmations = currentSlot - utxo.slot;
      const isConfirmed = confirmations >= this.config.minConfirmations;

      // Check for native tokens
      let asset: CardanoDepositEvent['asset'] = undefined;
      if (this.config.policyId) {
        const nativeToken = utxo.amount.find(a =>
          a.unit.startsWith(this.config.policyId!)
        );
        if (nativeToken) {
          asset = {
            policyId: this.config.policyId,
            assetName: nativeToken.unit.slice(this.config.policyId.length),
            quantity: nativeToken.quantity,
          };
        }
      }

      // Create deposit event
      const depositEvent: CardanoDepositEvent = {
        txHash: utxo.txHash,
        outputIndex: utxo.outputIndex,
        slot: utxo.slot,
        epoch: this.calculateEpoch(utxo.slot),
        blockHeight: utxo.blockHeight,
        blockHash: utxo.blockHash,
        timestamp: this.slotToTimestamp(utxo.slot),
        from: fromAddress,
        to: utxo.address,
        amount: adaAmount.quantity,
        asset,
        metadata,
        etridRecipient,
        plutusDatum: utxo.inlineDatum || undefined,
        confirmations,
        isConfirmed,
      };

      logger.info('Cardano deposit detected', {
        txHash: depositEvent.txHash,
        from: depositEvent.from,
        amount: depositEvent.amount,
        etridRecipient: depositEvent.etridRecipient,
        confirmations: depositEvent.confirmations,
        isConfirmed: depositEvent.isConfirmed,
      });

      this.eventsProcessed++;
      this.processedUtxos.add(utxoId);

      const assetType = asset ? 'native_token' : 'ada';
      cardanoDepositsDetected.inc({ network: this.config.network, asset_type: assetType });

      // Emit event
      this.emit('deposit', depositEvent);

      // If confirmed, emit confirmed event
      if (isConfirmed) {
        this.emit('depositConfirmed', depositEvent);
      }
    } catch (error) {
      logger.error('Error processing UTXO', { utxo, error });
      this.handleError(error, 'utxo_processing');
    }
  }

  /**
   * Get transaction details
   */
  private async getTransaction(txHash: string): Promise<{
    slot: number;
    blockHeight: number;
    blockHash: string;
  }> {
    const response = await fetch(
      `${this.config.blockfrostUrl}/txs/${txHash}`,
      {
        headers: {
          'project_id': this.config.blockfrostApiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get transaction: ${response.status}`);
    }

    const tx = await response.json();
    return {
      slot: parseInt(tx.slot),
      blockHeight: parseInt(tx.block_height),
      blockHash: tx.block,
    };
  }

  /**
   * Get transaction metadata
   */
  private async getTransactionMetadata(txHash: string): Promise<any> {
    const response = await fetch(
      `${this.config.blockfrostUrl}/txs/${txHash}/metadata`,
      {
        headers: {
          'project_id': this.config.blockfrostApiKey,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        // No metadata
        return null;
      }
      throw new Error(`Failed to get metadata: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Get transaction sender (first input address)
   */
  private async getTransactionSender(txHash: string): Promise<string> {
    const response = await fetch(
      `${this.config.blockfrostUrl}/txs/${txHash}/utxos`,
      {
        headers: {
          'project_id': this.config.blockfrostApiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to get transaction UTXOs: ${response.status}`);
    }

    const utxos = await response.json();
    if (utxos.inputs && utxos.inputs.length > 0) {
      return utxos.inputs[0].address;
    }

    return 'unknown';
  }

  /**
   * Parse Etrid recipient from transaction metadata
   */
  private parseEtridRecipient(metadata: any): string | undefined {
    if (!metadata || !Array.isArray(metadata)) {
      return undefined;
    }

    // Look for label 674 (CIP-20 message standard)
    const messageMetadata = metadata.find((m: any) => m.label === '674');
    if (messageMetadata && messageMetadata.json_metadata) {
      const msg = messageMetadata.json_metadata;

      // Check for 'msg' or 'recipient' field
      if (typeof msg === 'string') {
        return msg;
      } else if (msg.msg) {
        return msg.msg;
      } else if (msg.recipient) {
        return msg.recipient;
      } else if (msg.etrid_account) {
        return msg.etrid_account;
      }
    }

    // Fallback: check other common labels
    for (const meta of metadata) {
      if (meta.json_metadata && meta.json_metadata.recipient) {
        return meta.json_metadata.recipient;
      }
      if (meta.json_metadata && meta.json_metadata.etrid_account) {
        return meta.json_metadata.etrid_account;
      }
    }

    return undefined;
  }

  /**
   * Calculate epoch from slot
   */
  private calculateEpoch(slot: number): number {
    // Cardano epoch length: 432,000 slots (5 days)
    // Shelley start slot: 4,492,800
    const shelleyStartSlot = 4492800;
    const epochLength = 432000;

    if (slot < shelleyStartSlot) {
      // Byron era
      return Math.floor(slot / 21600); // Byron epoch length
    }

    const shelleySlot = slot - shelleyStartSlot;
    return 208 + Math.floor(shelleySlot / epochLength); // 208 is Shelley start epoch
  }

  /**
   * Convert slot to Unix timestamp
   */
  private slotToTimestamp(slot: number): number {
    // Shelley mainnet start: 1596491091 (July 29, 2020)
    const shelleyStart = 1596491091;
    const shelleyStartSlot = 4492800;

    if (slot < shelleyStartSlot) {
      // Byron era (not commonly used)
      return shelleyStart * 1000;
    }

    const secondsSinceShelley = slot - shelleyStartSlot;
    return (shelleyStart + secondsSinceShelley) * 1000;
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    logger.info('Stopping Cardano monitor...');

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = undefined;
    }

    this.isRunning = false;
    cardanoConnected.set({ network: this.config.network }, 0);

    this.emit('stopped');
    logger.info('Cardano monitor stopped');
  }

  /**
   * Get monitor status
   */
  getStatus(): MonitorStatus {
    return {
      isRunning: this.isRunning,
      lastSlot: this.lastSlot,
      lastEpoch: this.lastEpoch,
      eventsProcessed: this.eventsProcessed,
      errors: this.errors,
      lastError: this.lastError,
      lastErrorTime: this.lastErrorTime,
    };
  }

  /**
   * Get current slot
   */
  async getCurrentSlot(): Promise<number> {
    const tipInfo = await this.getChainTip();
    return tipInfo.slot;
  }

  /**
   * Handle errors
   */
  private handleError(error: any, errorType: string): void {
    this.errors++;
    this.lastError = error?.message || String(error);
    this.lastErrorTime = Date.now();

    cardanoErrors.inc({
      network: this.config.network,
      error_type: errorType,
    });

    this.emit('error', error);
  }
}
