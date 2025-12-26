/**
 * Solana Bridge Monitor for ËTRID Bridge System
 *
 * Monitors Solana blockchain for bridge deposit events and token burns
 * - Subscribes to program logs via onLogs()
 * - Tracks slot-based confirmations (31 slots for finalized state)
 * - Supports both SOL and SPL token deposits
 * - Extracts ËTRID recipient from memo program instructions
 * - Handles signature as 64-byte array split into two H256 (32 bytes each)
 */

import {
  Connection,
  PublicKey,
  Commitment,
  Context,
  ParsedTransactionWithMeta,
  ConfirmedSignatureInfo,
  TransactionSignature,
  LogsCallback,
  Logs,
  ParsedInstruction,
  PartiallyDecodedInstruction,
} from '@solana/web3.js';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { BridgeConfig, SolanaDepositEvent, SolanaTokenBurnEvent, MonitorStatus } from '../types';
import {
  solanaConnected,
  solanaSlotHeight,
  lastBlockTimestamp,
  messagesSeen,
  recordError,
  depositProcessingDuration,
} from '../metrics';

/**
 * Solana Bridge Program ID (to be configured)
 * This is the on-chain program that handles bridge deposits
 */
const SOLANA_BRIDGE_PROGRAM_ID = process.env.SOLANA_BRIDGE_PROGRAM_ID ||
  'BRGPidxhcsLVFBQ5zZqRHZ8bKRAHhAhiEDCfqELV8M7u';

/**
 * SPL Token Program ID
 */
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

/**
 * Memo Program ID (for extracting ËTRID recipient)
 */
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

/**
 * Minimum confirmations for finalized state on Solana
 */
const MIN_CONFIRMATIONS = 31;

/**
 * Slot polling interval (ms)
 */
const SLOT_POLL_INTERVAL = 400; // Solana's ~400ms block time

/**
 * Maximum retries for RPC connection
 */
const MAX_RETRIES = 5;

/**
 * Retry delay (ms)
 */
const RETRY_DELAY = 5000;

/**
 * Monitors Solana blockchain for bridge deposits and token burns
 */
export class SolanaMonitor extends EventEmitter {
  private connection: Connection | null = null;
  private bridgeProgramId: PublicKey;
  private isRunning = false;
  private lastProcessedSlot = 0;
  private eventsProcessed = 0;
  private errors = 0;
  private lastError?: string;
  private lastErrorTime?: number;

  // Subscription IDs
  private logSubscriptionId: number | null = null;
  private slotPollingInterval: NodeJS.Timeout | null = null;

  // Pending deposits waiting for confirmations
  private pendingDeposits: Map<string, PendingDeposit> = new Map();

  // Reconnection state
  private reconnectAttempts = 0;
  private isReconnecting = false;

  constructor(private config: BridgeConfig) {
    super();
    this.bridgeProgramId = new PublicKey(SOLANA_BRIDGE_PROGRAM_ID);
  }

  /**
   * Start monitoring Solana chain
   */
  async start(): Promise<void> {
    logger.info('Starting Solana monitor...', {
      rpcUrl: this.config.solanaRpcUrl,
      commitment: 'confirmed',
      minConfirmations: MIN_CONFIRMATIONS,
    });

    try {
      await this.connect();
      await this.subscribeToLogs();
      this.startSlotPolling();

      this.isRunning = true;
      this.reconnectAttempts = 0;
      solanaConnected.set(1);
      this.emit('started');

      logger.info('Solana monitor started successfully', {
        currentSlot: this.lastProcessedSlot,
        bridgeProgram: this.bridgeProgramId.toBase58(),
      });
    } catch (error) {
      logger.error('Failed to start Solana monitor', error);
      solanaConnected.set(0);
      recordError('solana_connection', 'SolanaMonitor');
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Connect to Solana RPC
   */
  private async connect(): Promise<void> {
    const commitment: Commitment = 'confirmed';

    this.connection = new Connection(
      this.config.solanaRpcUrl,
      {
        commitment,
        wsEndpoint: this.config.solanaWsUrl,
        confirmTransactionInitialTimeout: 60000,
      }
    );

    // Test connection and get current slot
    const currentSlot = await this.connection.getSlot(commitment);
    this.lastProcessedSlot = currentSlot;

    // Get cluster nodes to verify connection
    const clusterNodes = await this.connection.getClusterNodes();

    logger.info('Connected to Solana cluster', {
      slot: currentSlot,
      commitment,
      nodes: clusterNodes.length,
    });
  }

  /**
   * Subscribe to bridge program logs
   */
  private async subscribeToLogs(): Promise<void> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    const logsCallback: LogsCallback = (logs: Logs, ctx: Context) => {
      this.handleLogs(logs, ctx).catch((error) => {
        logger.error('Error handling Solana logs', { error, signature: logs.signature });
        this.handleError(error);
      });
    };

    // Subscribe to all transactions mentioning the bridge program
    this.logSubscriptionId = this.connection.onLogs(
      this.bridgeProgramId,
      logsCallback,
      'confirmed'
    );

    logger.info('Subscribed to Solana bridge program logs', {
      programId: this.bridgeProgramId.toBase58(),
      subscriptionId: this.logSubscriptionId,
    });
  }

  /**
   * Handle incoming log events
   */
  private async handleLogs(logs: Logs, ctx: Context): Promise<void> {
    const { signature, err } = logs;

    // Skip failed transactions
    if (err) {
      logger.debug('Skipping failed transaction', { signature, error: err });
      return;
    }

    const startTime = Date.now();

    try {
      // Parse transaction to extract deposit/burn events
      const transaction = await this.fetchTransaction(signature);

      if (!transaction) {
        logger.warn('Could not fetch transaction', { signature });
        return;
      }

      // Check for BridgeDeposit or TokenBurn events
      const events = this.parseTransactionEvents(transaction, logs, ctx.slot);

      for (const event of events) {
        if (event.type === 'deposit') {
          await this.handleDepositEvent(event as SolanaDepositEvent, signature, ctx.slot);
        } else if (event.type === 'burn') {
          await this.handleBurnEvent(event as SolanaTokenBurnEvent, signature, ctx.slot);
        }
      }

      // Record processing duration
      const duration = (Date.now() - startTime) / 1000;
      depositProcessingDuration.observe({ chain: 'solana' }, duration);

    } catch (error) {
      logger.error('Error processing Solana transaction', { signature, error });
      this.handleError(error);
    }
  }

  /**
   * Fetch and parse transaction details
   */
  private async fetchTransaction(signature: TransactionSignature): Promise<ParsedTransactionWithMeta | null> {
    if (!this.connection) return null;

    try {
      const tx = await this.connection.getParsedTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });

      return tx;
    } catch (error) {
      logger.error('Error fetching Solana transaction', { signature, error });
      return null;
    }
  }

  /**
   * Parse transaction for bridge events
   */
  private parseTransactionEvents(
    transaction: ParsedTransactionWithMeta,
    logs: Logs,
    slot: number
  ): Array<SolanaDepositEvent | SolanaTokenBurnEvent> {
    const events: Array<SolanaDepositEvent | SolanaTokenBurnEvent> = [];

    if (!transaction.meta || !transaction.transaction) {
      return events;
    }

    const { message } = transaction.transaction;
    const instructions = message.instructions;

    // Look for bridge deposit/burn instructions
    for (let i = 0; i < instructions.length; i++) {
      const instruction = instructions[i];

      // Check if this is a bridge program instruction
      if (this.isBridgeInstruction(instruction)) {
        const event = this.parseBridgeInstruction(
          instruction,
          transaction,
          logs,
          slot,
          i
        );

        if (event) {
          events.push(event);
        }
      }
    }

    return events;
  }

  /**
   * Check if instruction is from bridge program
   */
  private isBridgeInstruction(instruction: ParsedInstruction | PartiallyDecodedInstruction): boolean {
    if ('programId' in instruction) {
      return instruction.programId.equals(this.bridgeProgramId);
    }
    return false;
  }

  /**
   * Parse bridge instruction to extract deposit/burn event
   */
  private parseBridgeInstruction(
    instruction: ParsedInstruction | PartiallyDecodedInstruction,
    transaction: ParsedTransactionWithMeta,
    logs: Logs,
    slot: number,
    instructionIndex: number
  ): SolanaDepositEvent | SolanaTokenBurnEvent | null {
    try {
      // Extract ËTRID recipient from memo instruction
      const etridRecipient = this.extractEtridRecipient(transaction);

      if (!etridRecipient) {
        logger.warn('No ËTRID recipient found in transaction', {
          signature: logs.signature
        });
        return null;
      }

      // Parse instruction data
      const instructionData = this.parseInstructionData(instruction);

      if (!instructionData) {
        return null;
      }

      const { eventType, amount, tokenMint, solPubkey } = instructionData;

      if (eventType === 'BridgeDeposit') {
        return {
          type: 'deposit',
          etridRecipient,
          solPubkey,
          amount,
          tokenMint, // undefined for SOL, PublicKey for SPL tokens
          slot,
          confirmations: 0,
          timestamp: Date.now(),
        };
      } else if (eventType === 'TokenBurn') {
        return {
          type: 'burn',
          etridRecipient,
          amount,
          tokenMint: tokenMint!, // Token burns always have a mint
          slot,
          confirmations: 0,
          timestamp: Date.now(),
        };
      }

      return null;
    } catch (error) {
      logger.error('Error parsing bridge instruction', { error, signature: logs.signature });
      return null;
    }
  }

  /**
   * Extract ËTRID recipient from memo program instruction
   */
  private extractEtridRecipient(transaction: ParsedTransactionWithMeta): string | null {
    if (!transaction.transaction) return null;

    const { message } = transaction.transaction;
    const instructions = message.instructions;

    // Look for memo instruction
    for (const instruction of instructions) {
      if ('program' in instruction && instruction.program === 'spl-memo') {
        // Memo format: "ETRID:<hex_account_id>"
        const parsed = instruction.parsed as any;
        const memo = parsed?.memo || parsed;

        if (typeof memo === 'string' && memo.startsWith('ETRID:')) {
          const etridAccount = memo.substring(6); // Remove "ETRID:" prefix

          // Validate hex format (should be 64 hex chars for 32-byte AccountId)
          if (/^[0-9a-fA-F]{64}$/.test(etridAccount)) {
            return etridAccount;
          }
        }
      }
    }

    return null;
  }

  /**
   * Parse instruction data (simplified - would use Borsh deserialization in production)
   */
  private parseInstructionData(
    instruction: ParsedInstruction | PartiallyDecodedInstruction
  ): {
    eventType: 'BridgeDeposit' | 'TokenBurn';
    amount: bigint;
    tokenMint?: PublicKey;
    solPubkey: PublicKey;
  } | null {
    // In production, this would use Borsh deserialization based on your Solana program's IDL
    // For now, we'll parse from the instruction accounts and data

    if (!('accounts' in instruction)) {
      return null;
    }

    const accounts = (instruction as PartiallyDecodedInstruction).accounts;
    const data = (instruction as PartiallyDecodedInstruction).data;

    if (!accounts || accounts.length === 0) {
      return null;
    }

    // Example structure (adjust based on your actual program):
    // Account 0: User's SOL/token account
    // Account 1: Bridge vault
    // Account 2: Token mint (if SPL token)

    const solPubkey = accounts[0];
    const tokenMint = accounts.length > 2 ? accounts[2] : undefined;

    // Parse instruction discriminator and data
    // First byte is instruction discriminator:
    // 0 = BridgeDeposit
    // 1 = TokenBurn
    const buffer = Buffer.from(data, 'base64');
    const discriminator = buffer.readUInt8(0);

    // Amount is next 8 bytes (u64)
    const amount = buffer.readBigUInt64LE(1);

    const eventType = discriminator === 0 ? 'BridgeDeposit' : 'TokenBurn';

    return {
      eventType,
      amount,
      tokenMint,
      solPubkey,
    };
  }

  /**
   * Handle deposit event
   */
  private async handleDepositEvent(
    event: SolanaDepositEvent,
    signature: TransactionSignature,
    slot: number
  ): Promise<void> {
    logger.info('Detected Solana deposit', {
      signature,
      etridRecipient: event.etridRecipient,
      amount: event.amount.toString(),
      tokenMint: event.tokenMint?.toBase58() || 'SOL',
      slot,
    });

    // Convert signature to (H256, H256) tuple
    const signatureTuple = this.signatureToH256Tuple(signature);

    // Store pending deposit
    this.pendingDeposits.set(signature, {
      event,
      signature,
      signatureTuple,
      slot,
      confirmations: 0,
    });

    // Check confirmations
    await this.checkConfirmations(signature);

    this.eventsProcessed++;
    messagesSeen.inc({ source_domain: '1', chain: 'solana' });
  }

  /**
   * Handle token burn event
   */
  private async handleBurnEvent(
    event: SolanaTokenBurnEvent,
    signature: TransactionSignature,
    slot: number
  ): Promise<void> {
    logger.info('Detected Solana token burn', {
      signature,
      etridRecipient: event.etridRecipient,
      amount: event.amount.toString(),
      tokenMint: event.tokenMint.toBase58(),
      slot,
    });

    // Convert signature to (H256, H256) tuple
    const signatureTuple = this.signatureToH256Tuple(signature);

    // For burns, we still need confirmations
    this.pendingDeposits.set(signature, {
      event,
      signature,
      signatureTuple,
      slot,
      confirmations: 0,
    });

    await this.checkConfirmations(signature);

    this.eventsProcessed++;
    messagesSeen.inc({ source_domain: '1', chain: 'solana' });
  }

  /**
   * Convert Solana signature (64 bytes) to (H256, H256) tuple
   * Solana signatures are 64 bytes, split into two 32-byte H256 values
   */
  private signatureToH256Tuple(signature: TransactionSignature): [string, string] {
    // Signature is base58 encoded, decode to bytes
    const bs58 = require('bs58');
    const sigBytes = bs58.decode(signature);

    if (sigBytes.length !== 64) {
      throw new Error(`Invalid signature length: ${sigBytes.length}, expected 64`);
    }

    // Split into two 32-byte arrays
    const first32 = sigBytes.slice(0, 32);
    const second32 = sigBytes.slice(32, 64);

    // Convert to hex strings with 0x prefix (H256 format)
    const h256_1 = '0x' + Buffer.from(first32).toString('hex');
    const h256_2 = '0x' + Buffer.from(second32).toString('hex');

    return [h256_1, h256_2];
  }

  /**
   * Check confirmations for pending deposits
   */
  private async checkConfirmations(signature: TransactionSignature): Promise<void> {
    if (!this.connection) return;

    const pending = this.pendingDeposits.get(signature);
    if (!pending) return;

    try {
      // Get current slot
      const currentSlot = await this.connection.getSlot('finalized');
      const confirmations = currentSlot - pending.slot;

      // Update confirmations
      pending.confirmations = confirmations;

      // If finalized (31+ confirmations), emit event
      if (confirmations >= MIN_CONFIRMATIONS) {
        logger.info('Deposit confirmed (finalized)', {
          signature,
          confirmations,
          etridRecipient: pending.event.etridRecipient,
        });

        // Emit confirmed event based on type
        if (pending.event.type === 'deposit') {
          this.emit('depositConfirmed', {
            etridRecipient: pending.event.etridRecipient,
            solPubkey: (pending.event as SolanaDepositEvent).solPubkey.toBase58(),
            amount: pending.event.amount.toString(),
            signature: pending.signatureTuple,
            slot: pending.slot,
            confirmations,
            tokenMint: (pending.event as SolanaDepositEvent).tokenMint?.toBase58(),
          });
        } else if (pending.event.type === 'burn') {
          this.emit('burnConfirmed', {
            etridRecipient: pending.event.etridRecipient,
            amount: pending.event.amount.toString(),
            signature: pending.signatureTuple,
            slot: pending.slot,
            confirmations,
            tokenMint: (pending.event as SolanaTokenBurnEvent).tokenMint.toBase58(),
          });
        }

        // Remove from pending
        this.pendingDeposits.delete(signature);
      }
    } catch (error) {
      logger.error('Error checking confirmations', { signature, error });
      this.handleError(error);
    }
  }

  /**
   * Start polling for slot updates and checking confirmations
   */
  private startSlotPolling(): void {
    this.slotPollingInterval = setInterval(async () => {
      if (!this.connection || !this.isRunning) return;

      try {
        const currentSlot = await this.connection.getSlot('confirmed');

        if (currentSlot > this.lastProcessedSlot) {
          this.lastProcessedSlot = currentSlot;
          solanaSlotHeight.set(currentSlot);
          lastBlockTimestamp.set({ chain: 'solana' }, Date.now() / 1000);
        }

        // Check confirmations for pending deposits
        for (const signature of this.pendingDeposits.keys()) {
          await this.checkConfirmations(signature);
        }
      } catch (error) {
        logger.error('Error polling Solana slot', error);
        this.handleError(error);
      }
    }, SLOT_POLL_INTERVAL);

    logger.info('Started Solana slot polling', { interval: SLOT_POLL_INTERVAL });
  }

  /**
   * Stop monitoring
   */
  async stop(): Promise<void> {
    logger.info('Stopping Solana monitor...');

    this.isRunning = false;

    // Unsubscribe from logs
    if (this.connection && this.logSubscriptionId !== null) {
      try {
        await this.connection.removeOnLogsListener(this.logSubscriptionId);
        this.logSubscriptionId = null;
      } catch (error) {
        logger.error('Error removing logs listener', error);
      }
    }

    // Stop slot polling
    if (this.slotPollingInterval) {
      clearInterval(this.slotPollingInterval);
      this.slotPollingInterval = null;
    }

    this.connection = null;
    solanaConnected.set(0);
    this.emit('stopped');

    logger.info('Solana monitor stopped', {
      eventsProcessed: this.eventsProcessed,
      pendingDeposits: this.pendingDeposits.size,
    });
  }

  /**
   * Get monitor status
   */
  getStatus(): MonitorStatus {
    return {
      isRunning: this.isRunning,
      lastBlock: this.lastProcessedSlot,
      eventsProcessed: this.eventsProcessed,
      errors: this.errors,
      lastError: this.lastError,
      lastErrorTime: this.lastErrorTime,
      pendingCount: this.pendingDeposits.size,
    };
  }

  /**
   * Handle errors and trigger reconnection if needed
   */
  private handleError(error: any): void {
    this.errors++;
    this.lastError = error?.message || String(error);
    this.lastErrorTime = Date.now();
    this.emit('error', error);

    // Check if we need to reconnect
    const isConnectionError =
      error?.message?.includes('socket') ||
      error?.message?.includes('connect') ||
      error?.message?.includes('timeout') ||
      error?.code === 'ECONNREFUSED' ||
      error?.code === 'ETIMEDOUT';

    if (isConnectionError && !this.isReconnecting) {
      this.reconnect();
    }
  }

  /**
   * Reconnect to Solana RPC
   */
  private async reconnect(): Promise<void> {
    if (this.isReconnecting || !this.isRunning) return;

    this.isReconnecting = true;
    this.reconnectAttempts++;

    logger.warn('Attempting to reconnect to Solana RPC', {
      attempt: this.reconnectAttempts,
      maxRetries: MAX_RETRIES,
    });

    if (this.reconnectAttempts > MAX_RETRIES) {
      logger.error('Max reconnection attempts reached, stopping monitor');
      solanaConnected.set(0);
      this.isRunning = false;
      this.emit('failed');
      return;
    }

    // Wait before reconnecting
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));

    try {
      // Stop current connections
      await this.stop();

      // Restart
      await this.start();

      logger.info('Successfully reconnected to Solana RPC');
      this.reconnectAttempts = 0;
    } catch (error) {
      logger.error('Reconnection failed', error);
      this.isReconnecting = false;

      // Try again
      setTimeout(() => this.reconnect(), RETRY_DELAY);
    } finally {
      this.isReconnecting = false;
    }
  }

  /**
   * Get current slot number
   */
  async getCurrentSlot(): Promise<number> {
    if (!this.connection) throw new Error('Connection not initialized');
    return await this.connection.getSlot('confirmed');
  }

  /**
   * Get pending deposits count
   */
  getPendingDepositsCount(): number {
    return this.pendingDeposits.size;
  }

  /**
   * Manually check a specific transaction
   */
  async checkTransaction(signature: TransactionSignature): Promise<void> {
    const transaction = await this.fetchTransaction(signature);

    if (!transaction) {
      throw new Error(`Transaction not found: ${signature}`);
    }

    const events = this.parseTransactionEvents(
      transaction,
      { signature, err: null, logs: transaction.meta?.logMessages || [] },
      transaction.slot
    );

    for (const event of events) {
      if (event.type === 'deposit') {
        await this.handleDepositEvent(event as SolanaDepositEvent, signature, transaction.slot);
      } else if (event.type === 'burn') {
        await this.handleBurnEvent(event as SolanaTokenBurnEvent, signature, transaction.slot);
      }
    }
  }
}

/**
 * Pending deposit record
 */
interface PendingDeposit {
  event: SolanaDepositEvent | SolanaTokenBurnEvent;
  signature: TransactionSignature;
  signatureTuple: [string, string]; // (H256, H256)
  slot: number;
  confirmations: number;
}
