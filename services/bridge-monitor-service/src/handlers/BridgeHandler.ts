import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { KeyringPair } from '@polkadot/keyring/types';
import { SubmittableExtrinsic } from '@polkadot/api/types';
import { ISubmittableResult, AnyTuple } from '@polkadot/types/types';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { logger } from '../utils/logger';
import { hexToU8a, u8aToHex, stringToU8a } from '@polkadot/util';

/**
 * Supported chains for bridge operations
 */
export enum SupportedChain {
  Bitcoin = 'bitcoin',
  Ethereum = 'ethereum',
  Solana = 'solana',
  BnbChain = 'bnb',
  Polygon = 'polygon',
  Tron = 'tron',
  Ripple = 'xrp',
}

/**
 * Bridge deposit event from external chain
 */
export interface BridgeDeposit {
  chain: SupportedChain;
  depositor: string; // Etrid account
  sourceAddress: string; // External chain address
  txHash: string;
  amount: string | bigint;
  blockHeight?: number;
  slot?: number;
  ledgerIndex?: number;
  confirmations: number;
  tokenAddress?: string; // For ERC-20, BEP-20, TRC-20, SPL tokens
  destinationTag?: number; // For XRP
}

/**
 * Bridge burn event from external chain (for unlocking ETR)
 */
export interface BridgeBurn {
  chain: SupportedChain;
  recipient: string; // Etrid account
  amount: string | bigint;
  burnTxHash: string;
}

/**
 * Transaction submission result
 */
export interface TxResult {
  success: boolean;
  txHash?: string;
  blockHash?: string;
  error?: string;
  extrinsicIndex?: number;
}

/**
 * Retry configuration
 */
interface RetryConfig {
  maxRetries: number;
  retryDelay: number; // milliseconds
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 2000,
  backoffMultiplier: 2,
};

/**
 * Nonce manager for transaction ordering
 */
class NonceManager {
  private currentNonce: number = -1;
  private pendingTxs: Set<number> = new Set();

  async initialize(api: ApiPromise, address: string): Promise<void> {
    const nonce = await api.rpc.system.accountNextIndex(address);
    this.currentNonce = nonce.toNumber();
    logger.info('Nonce manager initialized', { address, nonce: this.currentNonce });
  }

  getNextNonce(): number {
    const nonce = this.currentNonce++;
    this.pendingTxs.add(nonce);
    return nonce;
  }

  releaseNonce(nonce: number): void {
    this.pendingTxs.delete(nonce);
  }

  reset(newNonce: number): void {
    this.currentNonce = newNonce;
    this.pendingTxs.clear();
  }
}

/**
 * Metrics tracking
 */
class BridgeMetrics {
  totalSubmitted = 0;
  totalSucceeded = 0;
  totalFailed = 0;
  totalRetried = 0;
  chainMetrics: Map<SupportedChain, { submitted: number; succeeded: number; failed: number }> = new Map();

  recordSubmission(chain: SupportedChain): void {
    this.totalSubmitted++;
    const chainStats = this.chainMetrics.get(chain) || { submitted: 0, succeeded: 0, failed: 0 };
    chainStats.submitted++;
    this.chainMetrics.set(chain, chainStats);
  }

  recordSuccess(chain: SupportedChain): void {
    this.totalSucceeded++;
    const chainStats = this.chainMetrics.get(chain) || { submitted: 0, succeeded: 0, failed: 0 };
    chainStats.succeeded++;
    this.chainMetrics.set(chain, chainStats);
  }

  recordFailure(chain: SupportedChain): void {
    this.totalFailed++;
    const chainStats = this.chainMetrics.get(chain) || { submitted: 0, succeeded: 0, failed: 0 };
    chainStats.failed++;
    this.chainMetrics.set(chain, chainStats);
  }

  recordRetry(): void {
    this.totalRetried++;
  }

  getStats() {
    return {
      total: {
        submitted: this.totalSubmitted,
        succeeded: this.totalSucceeded,
        failed: this.totalFailed,
        retried: this.totalRetried,
        successRate: this.totalSubmitted > 0 ? (this.totalSucceeded / this.totalSubmitted) * 100 : 0,
      },
      byChain: Object.fromEntries(this.chainMetrics),
    };
  }
}

/**
 * BridgeHandler wires monitor events to bridge pallet extrinsics
 * Handles deposits from ALL supported chains with proper type conversion
 */
export class BridgeHandler {
  private api: ApiPromise | null = null;
  private keyring: Keyring | null = null;
  private relayerAccount: KeyringPair | null = null;
  private nonceManager: NonceManager = new NonceManager();
  private metrics: BridgeMetrics = new BridgeMetrics();
  private isConnected = false;
  private retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG;

  constructor(
    private wsUrl: string,
    private relayerPrivateKey: string,
    retryConfig?: Partial<RetryConfig>
  ) {
    if (retryConfig) {
      this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    }
  }

  /**
   * Connect to Substrate node and initialize relayer account
   */
  async connect(): Promise<void> {
    logger.info('BridgeHandler connecting to Substrate...', { wsUrl: this.wsUrl });

    try {
      // Connect to node
      const provider = new WsProvider(this.wsUrl);
      this.api = await ApiPromise.create({ provider });

      // Get chain info
      const chain = await this.api.rpc.system.chain();
      const lastHeader = await this.api.rpc.chain.getHeader();

      logger.info('Connected to Substrate network', {
        chain: chain.toString(),
        blockNumber: lastHeader.number.toNumber(),
      });

      // Initialize keyring
      await cryptoWaitReady();
      this.keyring = new Keyring({ type: 'sr25519' });
      this.relayerAccount = this.keyring.addFromUri(this.relayerPrivateKey);

      logger.info('Relayer account initialized', {
        address: this.relayerAccount.address,
      });

      // Initialize nonce manager
      await this.nonceManager.initialize(this.api, this.relayerAccount.address);

      this.isConnected = true;
    } catch (error) {
      logger.error('Failed to connect to Substrate', error);
      throw error;
    }
  }

  /**
   * Disconnect from Substrate
   */
  async disconnect(): Promise<void> {
    logger.info('BridgeHandler disconnecting...');

    if (this.api) {
      await this.api.disconnect();
      this.api = null;
    }

    this.keyring = null;
    this.relayerAccount = null;
    this.isConnected = false;

    logger.info('BridgeHandler disconnected');
  }

  /**
   * Handle deposit from external chain
   */
  async handleDeposit(deposit: BridgeDeposit): Promise<TxResult> {
    if (!this.isConnected || !this.api || !this.relayerAccount) {
      throw new Error('BridgeHandler not connected');
    }

    logger.info('Handling bridge deposit', {
      chain: deposit.chain,
      depositor: deposit.depositor,
      amount: deposit.amount.toString(),
      txHash: deposit.txHash,
      confirmations: deposit.confirmations,
    });

    this.metrics.recordSubmission(deposit.chain);

    try {
      let extrinsic: SubmittableExtrinsic<'promise', ISubmittableResult> | null = null;

      // Route to chain-specific handler
      switch (deposit.chain) {
        case SupportedChain.Bitcoin:
          extrinsic = await this.handleBitcoinDeposit(deposit);
          break;
        case SupportedChain.Ethereum:
          extrinsic = await this.handleEthereumDeposit(deposit);
          break;
        case SupportedChain.Solana:
          extrinsic = await this.handleSolanaDeposit(deposit);
          break;
        case SupportedChain.BnbChain:
          extrinsic = await this.handleBnbDeposit(deposit);
          break;
        case SupportedChain.Polygon:
          extrinsic = await this.handlePolygonDeposit(deposit);
          break;
        case SupportedChain.Tron:
          extrinsic = await this.handleTronDeposit(deposit);
          break;
        case SupportedChain.Ripple:
          extrinsic = await this.handleRippleDeposit(deposit);
          break;
        default:
          throw new Error(`Unsupported chain: ${deposit.chain}`);
      }

      if (!extrinsic) {
        throw new Error('Failed to create extrinsic');
      }

      // Submit transaction with retry
      const result = await this.submitWithRetry(extrinsic, deposit.chain);

      if (result.success) {
        this.metrics.recordSuccess(deposit.chain);
      } else {
        this.metrics.recordFailure(deposit.chain);
      }

      return result;
    } catch (error: any) {
      this.metrics.recordFailure(deposit.chain);
      logger.error('Failed to handle deposit', {
        chain: deposit.chain,
        error: error?.message || String(error),
      });

      return {
        success: false,
        error: error?.message || String(error),
      };
    }
  }

  /**
   * Handle ETR burn from external chain (unlock ETR on Primearc)
   */
  async handleBurn(burn: BridgeBurn): Promise<TxResult> {
    if (!this.isConnected || !this.api || !this.relayerAccount) {
      throw new Error('BridgeHandler not connected');
    }

    logger.info('Handling bridge burn (ETR unlock)', {
      chain: burn.chain,
      recipient: burn.recipient,
      amount: burn.amount.toString(),
      burnTxHash: burn.burnTxHash,
    });

    this.metrics.recordSubmission(burn.chain);

    try {
      let extrinsic: SubmittableExtrinsic<'promise', ISubmittableResult> | null = null;

      // Route to chain-specific burn handler
      switch (burn.chain) {
        case SupportedChain.Bitcoin:
          extrinsic = await this.handleBitcoinBurn(burn);
          break;
        case SupportedChain.Ethereum:
          // Ethereum bridge doesn't have burn/unlock pattern in the pallet
          throw new Error('Ethereum bridge does not support ETR burn/unlock pattern');
        case SupportedChain.Solana:
          extrinsic = await this.handleSolanaBurn(burn);
          break;
        case SupportedChain.BnbChain:
          extrinsic = await this.handleBnbBurn(burn);
          break;
        case SupportedChain.Polygon:
          extrinsic = await this.handlePolygonBurn(burn);
          break;
        case SupportedChain.Tron:
          // Tron bridge doesn't have burn/unlock pattern in the pallet
          throw new Error('Tron bridge does not support ETR burn/unlock pattern');
        case SupportedChain.Ripple:
          extrinsic = await this.handleRippleBurn(burn);
          break;
        default:
          throw new Error(`Unsupported chain: ${burn.chain}`);
      }

      if (!extrinsic) {
        throw new Error('Failed to create burn extrinsic');
      }

      // Submit transaction with retry
      const result = await this.submitWithRetry(extrinsic, burn.chain);

      if (result.success) {
        this.metrics.recordSuccess(burn.chain);
      } else {
        this.metrics.recordFailure(burn.chain);
      }

      return result;
    } catch (error: any) {
      this.metrics.recordFailure(burn.chain);
      logger.error('Failed to handle burn', {
        chain: burn.chain,
        error: error?.message || String(error),
      });

      return {
        success: false,
        error: error?.message || String(error),
      };
    }
  }

  // ==================== BITCOIN HANDLERS ====================

  private async handleBitcoinDeposit(deposit: BridgeDeposit): Promise<SubmittableExtrinsic<'promise', ISubmittableResult>> {
    if (!this.api) throw new Error('API not initialized');

    // bitcoinBridge.depositBtc(depositor, btc_address, btc_txid, amount_satoshi, block_height)
    const extrinsic = this.api.tx.bitcoinBridge.depositBtc(
      deposit.depositor,
      Array.from(hexToU8a(deposit.sourceAddress.padEnd(128, '0').slice(0, 128))), // BoundedVec<u8, 64>
      Array.from(hexToU8a(deposit.txHash.padEnd(128, '0').slice(0, 128))), // BoundedVec<u8, 64>
      BigInt(deposit.amount),
      deposit.blockHeight || 0
    );

    logger.debug('Created Bitcoin deposit extrinsic', {
      depositor: deposit.depositor,
      txHash: deposit.txHash,
    });

    return extrinsic;
  }

  private async handleBitcoinBurn(burn: BridgeBurn): Promise<SubmittableExtrinsic<'promise', ISubmittableResult>> {
    if (!this.api) throw new Error('API not initialized');

    // bitcoinBridge.processEtrBurnFromBitcoin(etrid_recipient, amount, bitcoin_burn_tx)
    const extrinsic = this.api.tx.bitcoinBridge.processEtrBurnFromBitcoin(
      burn.recipient,
      BigInt(burn.amount),
      Array.from(hexToU8a(burn.burnTxHash.padEnd(128, '0').slice(0, 128))) // BoundedVec<u8, 64>
    );

    logger.debug('Created Bitcoin burn extrinsic', {
      recipient: burn.recipient,
      burnTxHash: burn.burnTxHash,
    });

    return extrinsic;
  }

  // ==================== ETHEREUM HANDLERS ====================

  private async handleEthereumDeposit(deposit: BridgeDeposit): Promise<SubmittableExtrinsic<'promise', ISubmittableResult>> {
    if (!this.api) throw new Error('API not initialized');

    if (deposit.tokenAddress) {
      // ERC-20 token deposit
      // ethereumBridge.initiateTokenDeposit(etrid_account, eth_address, token_address, amount, tx_hash, confirmations)
      return this.api.tx.ethereumBridge.initiateTokenDeposit(
        deposit.depositor,
        deposit.sourceAddress, // H160
        deposit.tokenAddress, // H160
        BigInt(deposit.amount),
        deposit.txHash, // H256
        deposit.confirmations
      );
    } else {
      // ETH deposit
      // ethereumBridge.initiateEthDeposit(etrid_account, eth_address, amount, tx_hash, confirmations)
      return this.api.tx.ethereumBridge.initiateEthDeposit(
        deposit.depositor,
        deposit.sourceAddress, // H160
        BigInt(deposit.amount),
        deposit.txHash, // H256
        deposit.confirmations
      );
    }
  }

  // ==================== SOLANA HANDLERS ====================

  private async handleSolanaDeposit(deposit: BridgeDeposit): Promise<SubmittableExtrinsic<'promise', ISubmittableResult>> {
    if (!this.api) throw new Error('API not initialized');

    // Convert Solana signature (64 bytes) to tuple of two H256
    const signature = this.parseSolanaSignature(deposit.txHash);

    if (deposit.tokenAddress) {
      // SPL token deposit
      // solanaBridge.initiateTokenDeposit(etrid_account, sol_pubkey, token_mint, amount, signature, slot, confirmations)
      return this.api.tx.solanaBridge.initiateTokenDeposit(
        deposit.depositor,
        deposit.sourceAddress, // H256 (SolanaPublicKey)
        deposit.tokenAddress, // H256 (SplTokenMint)
        BigInt(deposit.amount),
        signature, // (H256, H256)
        deposit.slot || 0,
        deposit.confirmations
      );
    } else {
      // SOL deposit
      // solanaBridge.initiateSolDeposit(etrid_account, sol_pubkey, amount, signature, slot, confirmations)
      return this.api.tx.solanaBridge.initiateSolDeposit(
        deposit.depositor,
        deposit.sourceAddress, // H256
        BigInt(deposit.amount),
        signature, // (H256, H256)
        deposit.slot || 0,
        deposit.confirmations
      );
    }
  }

  private async handleSolanaBurn(burn: BridgeBurn): Promise<SubmittableExtrinsic<'promise', ISubmittableResult>> {
    if (!this.api) throw new Error('API not initialized');

    const signature = this.parseSolanaSignature(burn.burnTxHash);

    // solanaBridge.processEtrBurnFromSolana(etrid_recipient, amount, sol_burn_tx)
    return this.api.tx.solanaBridge.processEtrBurnFromSolana(
      burn.recipient,
      BigInt(burn.amount),
      signature // (H256, H256)
    );
  }

  // ==================== BNB CHAIN HANDLERS ====================

  private async handleBnbDeposit(deposit: BridgeDeposit): Promise<SubmittableExtrinsic<'promise', ISubmittableResult>> {
    if (!this.api) throw new Error('API not initialized');

    if (deposit.tokenAddress) {
      // BEP-20 token deposit
      // bnbBridge.initiateTokenDeposit(etrid_account, bnb_address, token_contract, amount, tx_hash, block_number, confirmations)
      return this.api.tx.bnbBridge.initiateTokenDeposit(
        deposit.depositor,
        deposit.sourceAddress, // H160
        deposit.tokenAddress, // H160
        BigInt(deposit.amount),
        deposit.txHash, // H256
        deposit.blockHeight || 0,
        deposit.confirmations
      );
    } else {
      // BNB deposit
      // bnbBridge.initiateBnbDeposit(etrid_account, bnb_address, amount, tx_hash, block_number, confirmations)
      return this.api.tx.bnbBridge.initiateBnbDeposit(
        deposit.depositor,
        deposit.sourceAddress, // H160
        BigInt(deposit.amount),
        deposit.txHash, // H256
        deposit.blockHeight || 0,
        deposit.confirmations
      );
    }
  }

  private async handleBnbBurn(burn: BridgeBurn): Promise<SubmittableExtrinsic<'promise', ISubmittableResult>> {
    if (!this.api) throw new Error('API not initialized');

    // bnbBridge.processEtrBurnFromBnb(etrid_recipient, amount, bnb_burn_tx)
    return this.api.tx.bnbBridge.processEtrBurnFromBnb(
      burn.recipient,
      BigInt(burn.amount),
      burn.burnTxHash // H256
    );
  }

  // ==================== POLYGON HANDLERS ====================

  private async handlePolygonDeposit(deposit: BridgeDeposit): Promise<SubmittableExtrinsic<'promise', ISubmittableResult>> {
    if (!this.api) throw new Error('API not initialized');

    // polygonBridge.initiateDeposit(account, polygon_address, amount, tx_hash, block_number, bridge_type_raw)
    // bridge_type_raw: 0 = Plasma, 1 = PoS
    const bridgeType = 1; // Default to PoS Bridge for security

    return this.api.tx.polygonBridge.initiateDeposit(
      deposit.depositor,
      deposit.sourceAddress, // H160
      BigInt(deposit.amount),
      deposit.txHash, // H256
      deposit.blockHeight || 0,
      bridgeType
    );
  }

  private async handlePolygonBurn(burn: BridgeBurn): Promise<SubmittableExtrinsic<'promise', ISubmittableResult>> {
    if (!this.api) throw new Error('API not initialized');

    // polygonBridge.processEtrBurnFromPolygon(etrid_recipient, amount, polygon_burn_tx)
    return this.api.tx.polygonBridge.processEtrBurnFromPolygon(
      burn.recipient,
      BigInt(burn.amount),
      burn.burnTxHash // H256
    );
  }

  // ==================== TRON HANDLERS ====================

  private async handleTronDeposit(deposit: BridgeDeposit): Promise<SubmittableExtrinsic<'promise', ISubmittableResult>> {
    if (!this.api) throw new Error('API not initialized');

    // Convert Tron address to [u8; 21]
    const tronAddress = this.parseTronAddress(deposit.sourceAddress);

    if (deposit.tokenAddress) {
      // TRC-20 token deposit
      const tokenContract = this.parseTronAddress(deposit.tokenAddress);
      // tronBridge.initiateTokenDeposit(etrid_account, tron_address, token_contract, amount, tx_id, block_height, confirmations)
      return this.api.tx.tronBridge.initiateTokenDeposit(
        deposit.depositor,
        tronAddress,
        tokenContract,
        BigInt(deposit.amount),
        deposit.txHash, // H256
        deposit.blockHeight || 0,
        deposit.confirmations
      );
    } else {
      // TRX deposit
      // tronBridge.initiateTrxDeposit(etrid_account, tron_address, amount, tx_id, block_height, confirmations)
      return this.api.tx.tronBridge.initiateTrxDeposit(
        deposit.depositor,
        tronAddress,
        BigInt(deposit.amount),
        deposit.txHash, // H256
        deposit.blockHeight || 0,
        deposit.confirmations
      );
    }
  }

  // ==================== RIPPLE (XRP) HANDLERS ====================

  private async handleRippleDeposit(deposit: BridgeDeposit): Promise<SubmittableExtrinsic<'promise', ISubmittableResult>> {
    if (!this.api) throw new Error('API not initialized');

    // xrpBridge.initiateXrpDeposit(etrid_account, xrpl_address, amount, tx_hash, ledger_index, confirmations, destination_tag)
    return this.api.tx.xrpBridge.initiateXrpDeposit(
      deposit.depositor,
      deposit.sourceAddress, // H160
      BigInt(deposit.amount),
      deposit.txHash, // H256
      deposit.ledgerIndex || 0,
      deposit.confirmations,
      deposit.destinationTag || null
    );
  }

  private async handleRippleBurn(burn: BridgeBurn): Promise<SubmittableExtrinsic<'promise', ISubmittableResult>> {
    if (!this.api) throw new Error('API not initialized');

    // xrpBridge.processEtrBurnFromXrp(etrid_recipient, amount, xrp_burn_tx)
    return this.api.tx.xrpBridge.processEtrBurnFromXrp(
      burn.recipient,
      BigInt(burn.amount),
      burn.burnTxHash // H256
    );
  }

  // ==================== HELPER METHODS ====================

  /**
   * Parse Solana signature (64 bytes) into tuple of two H256
   */
  private parseSolanaSignature(signature: string): [string, string] {
    // Remove 0x prefix if present
    const sig = signature.startsWith('0x') ? signature.slice(2) : signature;

    // Ensure it's 128 hex chars (64 bytes)
    const paddedSig = sig.padEnd(128, '0').slice(0, 128);

    // Split into two 32-byte chunks
    const first32 = '0x' + paddedSig.slice(0, 64);
    const second32 = '0x' + paddedSig.slice(64, 128);

    return [first32, second32];
  }

  /**
   * Parse Tron address (21 bytes) from base58 or hex
   */
  private parseTronAddress(address: string): Uint8Array {
    // If already hex, convert directly
    if (address.startsWith('0x')) {
      const bytes = hexToU8a(address);
      // Ensure 21 bytes
      const result = new Uint8Array(21);
      result.set(bytes.slice(0, 21));
      return result;
    }

    // For base58 addresses, convert to hex first (simplified - in production use proper base58 decoder)
    const hex = address; // Placeholder - implement proper base58 decoding
    const bytes = hexToU8a(hex);
    const result = new Uint8Array(21);
    result.set(bytes.slice(0, 21));
    return result;
  }

  /**
   * Submit transaction with retry logic and proper error handling
   */
  private async submitWithRetry(
    extrinsic: SubmittableExtrinsic<'promise', ISubmittableResult>,
    chain: SupportedChain,
    retryCount = 0
  ): Promise<TxResult> {
    if (!this.api || !this.relayerAccount) {
      throw new Error('API or account not initialized');
    }

    const nonce = this.nonceManager.getNextNonce();

    try {
      logger.debug('Submitting extrinsic', {
        chain,
        nonce,
        retryCount,
        method: extrinsic.method.toHuman(),
      });

      const result = await new Promise<TxResult>((resolve, reject) => {
        extrinsic
          .signAndSend(
            this.relayerAccount!,
            { nonce },
            ({ status, dispatchError, events, txHash }): void => {
              // Track transaction status
              if (status.isInBlock) {
                logger.debug('Transaction in block', {
                  chain,
                  blockHash: status.asInBlock.toString(),
                  txHash: txHash.toString(),
                });
              }

              if (status.isFinalized) {
                logger.info('Transaction finalized', {
                  chain,
                  blockHash: status.asFinalized.toString(),
                  txHash: txHash.toString(),
                });

                // Check for dispatch errors
                if (dispatchError) {
                  let errorInfo = '';

                  if (dispatchError.isModule) {
                    // Decode module error
                    const decoded = this.api!.registry.findMetaError(dispatchError.asModule);
                    errorInfo = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
                  } else {
                    // Other error types
                    errorInfo = dispatchError.toString();
                  }

                  logger.error('Transaction failed with dispatch error', {
                    chain,
                    error: errorInfo,
                    txHash: txHash.toString(),
                  });

                  this.nonceManager.releaseNonce(nonce);
                  reject(new Error(errorInfo));
                } else {
                  // Success
                  const extrinsicIndex = events
                    .filter(({ event }) => this.api!.events.system.ExtrinsicSuccess.is(event))
                    .map(({ phase }) => {
                      if (phase.isApplyExtrinsic) {
                        return phase.asApplyExtrinsic.toNumber();
                      }
                      return undefined;
                    })
                    .find((index) => index !== undefined);

                  this.nonceManager.releaseNonce(nonce);
                  resolve({
                    success: true,
                    txHash: txHash.toString(),
                    blockHash: status.asFinalized.toString(),
                    extrinsicIndex,
                  });
                }
              }
            }
          )
          .catch((error) => {
            logger.error('Failed to submit transaction', {
              chain,
              error: error?.message,
              nonce,
            });
            this.nonceManager.releaseNonce(nonce);
            reject(error);
          });
      });

      return result;
    } catch (error: any) {
      this.nonceManager.releaseNonce(nonce);

      // Retry logic
      if (retryCount < this.retryConfig.maxRetries) {
        const delay = this.retryConfig.retryDelay * Math.pow(this.retryConfig.backoffMultiplier, retryCount);

        logger.warn('Retrying transaction', {
          chain,
          retryCount: retryCount + 1,
          maxRetries: this.retryConfig.maxRetries,
          delayMs: delay,
          error: error?.message,
        });

        this.metrics.recordRetry();

        // Wait before retry
        await new Promise((resolve) => setTimeout(resolve, delay));

        // Reset nonce if needed
        if (error?.message?.includes('nonce') || error?.message?.includes('stale')) {
          const newNonce = await this.api.rpc.system.accountNextIndex(this.relayerAccount.address);
          this.nonceManager.reset(newNonce.toNumber());
        }

        // Retry
        return this.submitWithRetry(extrinsic, chain, retryCount + 1);
      }

      // Max retries exceeded
      logger.error('Max retries exceeded', {
        chain,
        retryCount,
        error: error?.message,
      });

      return {
        success: false,
        error: error?.message || String(error),
      };
    }
  }

  /**
   * Get bridge handler statistics
   */
  getStats() {
    return {
      isConnected: this.isConnected,
      relayerAddress: this.relayerAccount?.address,
      metrics: this.metrics.getStats(),
    };
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<bigint> {
    if (!this.api || !this.relayerAccount) {
      throw new Error('API or account not initialized');
    }

    const accountInfo: any = await this.api.query.system.account(this.relayerAccount.address);
    return BigInt(accountInfo.data.free.toString());
  }

  /**
   * Get current block number
   */
  async getCurrentBlock(): Promise<number> {
    if (!this.api) {
      throw new Error('API not initialized');
    }

    const header = await this.api.rpc.chain.getHeader();
    return header.number.toNumber();
  }
}
