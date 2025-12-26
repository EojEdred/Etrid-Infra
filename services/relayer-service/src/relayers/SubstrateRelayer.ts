import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { logger } from '../utils/logger';
import { Attestation, RelayerConfig, RelayResult } from '../types';

/**
 * Relays messages to Ëtrid Substrate chain (attestation pallet)
 */
export class SubstrateRelayer {
  private api: ApiPromise | null = null;
  private keyring: Keyring | null = null;
  private relayerAccount: any = null;
  private isConnected = false;
  private lastRelayTime?: number;
  private totalRelays = 0;
  private successfulRelays = 0;
  private failedRelays = 0;

  constructor(private config: RelayerConfig) {}

  /**
   * Connect to Substrate
   */
  async connect(): Promise<void> {
    logger.info('Connecting to Substrate...', {
      wsUrl: this.config.substrateWsUrl,
    });

    try {
      // Connect to Substrate node
      const provider = new WsProvider(this.config.substrateWsUrl);
      this.api = await ApiPromise.create({ provider });

      // Get chain info
      const chain = await this.api.rpc.system.chain();
      const lastHeader = await this.api.rpc.chain.getHeader();

      logger.info('Connected to Substrate network', {
        chain: chain.toString(),
        blockNumber: lastHeader.number.toNumber(),
      });

      // Initialize keyring and relayer account
      await cryptoWaitReady();
      this.keyring = new Keyring({ type: 'sr25519' });
      this.relayerAccount = this.keyring.addFromUri(this.config.relayerPrivateKey);

      logger.info('Relayer account initialized', {
        address: this.relayerAccount.address,
      });

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
    logger.info('Disconnecting from Substrate...');

    if (this.api) {
      await this.api.disconnect();
      this.api = null;
    }

    this.keyring = null;
    this.relayerAccount = null;
    this.isConnected = false;

    logger.info('Disconnected from Substrate');
  }

  /**
   * Relay a message to Substrate
   */
  async relayMessage(attestation: Attestation): Promise<RelayResult> {
    if (!this.isConnected || !this.api || !this.relayerAccount) {
      throw new Error('Not connected to Substrate');
    }

    const { messageHash, message, signatures } = attestation;

    logger.info('Relaying message to Substrate', {
      messageHash,
      signatureCount: signatures.length,
    });

    this.totalRelays++;

    try {
      // Check if message already received
      // Query: attestation.receivedMessages(messageHash) -> bool
      const isReceived = await this.api.query.attestation?.receivedMessages(
        messageHash
      );

      if (isReceived && isReceived.toJSON()) {
        logger.info('Message already received on Substrate', { messageHash });
        this.successfulRelays++;
        return {
          success: true,
          messageHash,
          error: 'Already received',
        };
      }

      // Prepare extrinsic: attestation.receiveMessage(message, signatures)
      // Convert hex message to Uint8Array
      const messageBytes = message.startsWith('0x')
        ? Buffer.from(message.slice(2), 'hex')
        : Buffer.from(message, 'hex');

      // Convert signature hex strings to Vec<u8>
      const signatureVecs = signatures.map((sig) => {
        const sigBytes = sig.startsWith('0x')
          ? Buffer.from(sig.slice(2), 'hex')
          : Buffer.from(sig, 'hex');
        return Array.from(sigBytes);
      });

      // Create and submit extrinsic
      const extrinsic = this.api.tx.attestation?.receiveMessage(
        Array.from(messageBytes),
        signatureVecs
      );

      if (!extrinsic) {
        throw new Error('attestation.receiveMessage extrinsic not available');
      }

      logger.debug('Submitting extrinsic to Substrate', {
        messageHash,
        method: extrinsic.method.toHuman(),
      });

      // Sign and send transaction
      const txHash = await new Promise<string>((resolve, reject) => {
        extrinsic
          .signAndSend(
            this.relayerAccount,
            { nonce: -1 }, // Auto-increment nonce
            ({ status, dispatchError, events }) => {
              if (status.isInBlock) {
                logger.debug('Transaction in block', {
                  messageHash,
                  blockHash: status.asInBlock.toString(),
                });
              } else if (status.isFinalized) {
                logger.info('Transaction finalized', {
                  messageHash,
                  blockHash: status.asFinalized.toString(),
                });

                // Check for errors
                if (dispatchError) {
                  let errorInfo = '';

                  if (dispatchError.isModule) {
                    const decoded = this.api!.registry.findMetaError(
                      dispatchError.asModule
                    );
                    errorInfo = `${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`;
                  } else {
                    errorInfo = dispatchError.toString();
                  }

                  logger.error('Transaction failed with dispatch error', {
                    messageHash,
                    error: errorInfo,
                  });

                  reject(new Error(errorInfo));
                } else {
                  resolve(status.asFinalized.toString());
                }
              }
            }
          )
          .catch((error) => {
            logger.error('Failed to submit transaction', {
              messageHash,
              error: error?.message,
            });
            reject(error);
          });
      });

      this.successfulRelays++;
      this.lastRelayTime = Date.now();

      logger.info('Successfully relayed message to Substrate', {
        messageHash,
        blockHash: txHash,
      });

      return {
        success: true,
        messageHash,
        txHash,
      };
    } catch (error: any) {
      this.failedRelays++;

      logger.error('Failed to relay message to Substrate', {
        messageHash,
        error: error?.message,
      });

      return {
        success: false,
        messageHash,
        error: error?.message || String(error),
      };
    }
  }

  /**
   * Check if a message has been received
   */
  async isMessageReceived(messageHash: string): Promise<boolean> {
    if (!this.api) {
      throw new Error('API not initialized');
    }

    try {
      const isReceived = await this.api.query.attestation?.receivedMessages(
        messageHash
      );

      return isReceived ? isReceived.toJSON() === true : false;
    } catch (error) {
      logger.error('Error checking if message received', { messageHash, error });
      return false;
    }
  }

  /**
   * Check if a nonce has been used
   */
  async isNonceUsed(sourceDomain: number, nonce: bigint): Promise<boolean> {
    if (!this.api) {
      throw new Error('API not initialized');
    }

    try {
      // Query: attestation.usedNonces(sourceDomain, nonce) -> bool
      const isUsed = await this.api.query.attestation?.usedNonces([
        sourceDomain,
        nonce.toString(),
      ]);

      return isUsed ? isUsed.toJSON() === true : false;
    } catch (error) {
      logger.error('Error checking nonce', { sourceDomain, nonce, error });
      return false;
    }
  }

  /**
   * Get relayer balance
   */
  async getBalance(): Promise<bigint> {
    if (!this.api || !this.relayerAccount) {
      throw new Error('API or account not initialized');
    }

    try {
      const accountInfo: any = await this.api.query.system.account(
        this.relayerAccount.address
      );

      return BigInt(accountInfo.data.free.toString());
    } catch (error) {
      logger.error('Error getting balance', error);
      return 0n;
    }
  }

  /**
   * Get current block number
   */
  async getCurrentBlock(): Promise<number> {
    if (!this.api) {
      throw new Error('API not initialized');
    }

    try {
      const header = await this.api.rpc.chain.getHeader();
      return header.number.toNumber();
    } catch (error) {
      logger.error('Error getting block number', error);
      return 0;
    }
  }

  /**
   * Get relayer statistics
   */
  getStats() {
    return {
      isConnected: this.isConnected,
      relayerAddress: this.relayerAccount?.address,
      totalRelays: this.totalRelays,
      successfulRelays: this.successfulRelays,
      failedRelays: this.failedRelays,
      lastRelayTime: this.lastRelayTime,
    };
  }
}
