import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import {
  IChainRelayer,
  ChainType,
  ChainConfig,
  Attestation,
  RelayResult,
  ChainRelayerStats,
} from './types';

/**
 * Substrate relayer for Ëtrid and other Substrate-based chains
 */
export class SubstrateRelayer implements IChainRelayer {
  public readonly chainDomain: number;
  public readonly chainName: string;
  public readonly chainType = ChainType.Substrate;

  private api: ApiPromise | null = null;
  private keyring: Keyring | null = null;
  private relayerAccount: any = null;
  private connected = false;

  // Statistics
  private totalRelays = 0;
  private successfulRelays = 0;
  private failedRelays = 0;
  private lastRelayTime?: number;

  constructor(
    private config: ChainConfig,
    private relayerPrivateKey: string
  ) {
    this.chainDomain = config.domain;
    this.chainName = config.name;
  }

  /**
   * Connect to Substrate chain
   */
  async connect(): Promise<void> {
    console.log(`[${this.chainName}] Connecting...`, {
      wsUrl: this.config.wsUrl || this.config.rpcUrl,
    });

    try {
      // Connect to Substrate node
      const wsUrl = this.config.wsUrl || this.config.rpcUrl;
      const provider = new WsProvider(wsUrl);
      this.api = await ApiPromise.create({ provider });

      // Get chain info
      const chain = await this.api.rpc.system.chain();
      const lastHeader = await this.api.rpc.chain.getHeader();

      console.log(`[${this.chainName}] Connected to Substrate network`, {
        chain: chain.toString(),
        blockNumber: lastHeader.number.toNumber(),
      });

      // Initialize keyring and relayer account
      await cryptoWaitReady();
      this.keyring = new Keyring({ type: 'sr25519' });
      this.relayerAccount = this.keyring.addFromUri(this.relayerPrivateKey);

      console.log(`[${this.chainName}] Relayer account initialized`, {
        address: this.relayerAccount.address,
      });

      this.connected = true;
    } catch (error: any) {
      console.error(`[${this.chainName}] Failed to connect`, {
        error: error?.message,
      });
      throw error;
    }
  }

  /**
   * Disconnect from Substrate chain
   */
  async disconnect(): Promise<void> {
    console.log(`[${this.chainName}] Disconnecting...`);

    if (this.api) {
      await this.api.disconnect();
      this.api = null;
    }

    this.keyring = null;
    this.relayerAccount = null;
    this.connected = false;

    console.log(`[${this.chainName}] Disconnected`);
  }

  /**
   * Relay a message to Substrate chain
   */
  async relayMessage(attestation: Attestation): Promise<RelayResult> {
    if (!this.connected || !this.api || !this.relayerAccount) {
      throw new Error(`[${this.chainName}] Not connected`);
    }

    const { messageHash, message, signatures } = attestation;

    console.log(`[${this.chainName}] Relaying message`, {
      messageHash,
      signatureCount: signatures.length,
    });

    this.totalRelays++;

    try {
      // Check if message already received
      const isReceived = await this.api.query.attestation?.receivedMessages(
        messageHash
      );

      if (isReceived && isReceived.toJSON()) {
        console.log(`[${this.chainName}] Message already received`, { messageHash });
        this.successfulRelays++;
        return {
          success: true,
          messageHash,
          chain: this.chainName,
          chainDomain: this.chainDomain,
          error: 'Already received',
          timestamp: Date.now(),
        };
      }

      // Prepare extrinsic: attestation.receiveMessage(message, signatures)
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

      // Create extrinsic
      const extrinsic = this.api.tx.attestation?.receiveMessage(
        Array.from(messageBytes),
        signatureVecs
      );

      if (!extrinsic) {
        throw new Error('attestation.receiveMessage extrinsic not available');
      }

      console.log(`[${this.chainName}] Submitting extrinsic`, {
        messageHash,
        method: extrinsic.method.toHuman(),
      });

      // Sign and send transaction
      const txHash = await new Promise<string>((resolve, reject) => {
        let txBlockHash: string | undefined;
        let txBlockNumber: number | undefined;

        extrinsic
          .signAndSend(
            this.relayerAccount,
            { nonce: -1 }, // Auto-increment nonce
            ({ status, dispatchError, events }) => {
              if (status.isInBlock) {
                txBlockHash = status.asInBlock.toString();
                console.log(`[${this.chainName}] Transaction in block`, {
                  messageHash,
                  blockHash: txBlockHash,
                });
              } else if (status.isFinalized) {
                console.log(`[${this.chainName}] Transaction finalized`, {
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

                  console.error(`[${this.chainName}] Transaction failed with dispatch error`, {
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
            console.error(`[${this.chainName}] Failed to submit transaction`, {
              messageHash,
              error: error?.message,
            });
            reject(error);
          });
      });

      this.successfulRelays++;
      this.lastRelayTime = Date.now();

      console.log(`[${this.chainName}] Message relayed successfully`, {
        messageHash,
        blockHash: txHash,
      });

      return {
        success: true,
        messageHash,
        chain: this.chainName,
        chainDomain: this.chainDomain,
        txHash,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      this.failedRelays++;

      console.error(`[${this.chainName}] Failed to relay message`, {
        messageHash,
        error: error?.message,
      });

      return {
        success: false,
        messageHash,
        chain: this.chainName,
        chainDomain: this.chainDomain,
        error: error?.message || String(error),
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Check if a message has been received
   */
  async isMessageReceived(messageHash: string): Promise<boolean> {
    if (!this.api) {
      throw new Error(`[${this.chainName}] API not initialized`);
    }

    try {
      const isReceived = await this.api.query.attestation?.receivedMessages(
        messageHash
      );

      return isReceived ? isReceived.toJSON() === true : false;
    } catch (error) {
      console.error(`[${this.chainName}] Error checking if message received`, {
        messageHash,
        error,
      });
      return false;
    }
  }

  /**
   * Check if a nonce has been used
   */
  async isNonceUsed(sourceDomain: number, nonce: bigint): Promise<boolean> {
    if (!this.api) {
      throw new Error(`[${this.chainName}] API not initialized`);
    }

    try {
      const isUsed = await this.api.query.attestation?.usedNonces([
        sourceDomain,
        nonce.toString(),
      ]);

      return isUsed ? isUsed.toJSON() === true : false;
    } catch (error) {
      console.error(`[${this.chainName}] Error checking nonce`, {
        sourceDomain,
        nonce: nonce.toString(),
        error,
      });
      return false;
    }
  }

  /**
   * Get relayer balance
   */
  async getBalance(): Promise<bigint> {
    if (!this.api || !this.relayerAccount) {
      throw new Error(`[${this.chainName}] API or account not initialized`);
    }

    try {
      const accountInfo: any = await this.api.query.system.account(
        this.relayerAccount.address
      );

      return BigInt(accountInfo.data.free.toString());
    } catch (error) {
      console.error(`[${this.chainName}] Error getting balance`, error);
      return 0n;
    }
  }

  /**
   * Get current block number
   */
  async getCurrentBlock(): Promise<number> {
    if (!this.api) {
      throw new Error(`[${this.chainName}] API not initialized`);
    }

    try {
      const header = await this.api.rpc.chain.getHeader();
      return header.number.toNumber();
    } catch (error) {
      console.error(`[${this.chainName}] Error getting block number`, error);
      return 0;
    }
  }

  /**
   * Estimate gas for a relay transaction
   * Substrate uses weight, not gas
   */
  async estimateGas(attestation: Attestation): Promise<bigint> {
    if (!this.api || !this.relayerAccount) {
      throw new Error(`[${this.chainName}] Not initialized`);
    }

    try {
      const messageBytes = attestation.message.startsWith('0x')
        ? Buffer.from(attestation.message.slice(2), 'hex')
        : Buffer.from(attestation.message, 'hex');

      const signatureVecs = attestation.signatures.map((sig) => {
        const sigBytes = sig.startsWith('0x')
          ? Buffer.from(sig.slice(2), 'hex')
          : Buffer.from(sig, 'hex');
        return Array.from(sigBytes);
      });

      const extrinsic = this.api.tx.attestation?.receiveMessage(
        Array.from(messageBytes),
        signatureVecs
      );

      if (!extrinsic) {
        return 0n;
      }

      const paymentInfo = await extrinsic.paymentInfo(this.relayerAccount);
      return BigInt(paymentInfo.weight.toString());
    } catch (error) {
      console.error(`[${this.chainName}] Error estimating gas`, error);
      return 0n;
    }
  }

  /**
   * Get relayer statistics
   */
  getStats(): ChainRelayerStats {
    return {
      chainDomain: this.chainDomain,
      chainName: this.chainName,
      isConnected: this.connected,
      relayerAddress: this.relayerAccount?.address,
      totalRelays: this.totalRelays,
      successfulRelays: this.successfulRelays,
      failedRelays: this.failedRelays,
      lastRelayTime: this.lastRelayTime,
    };
  }

  /**
   * Check if relayer is connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}
