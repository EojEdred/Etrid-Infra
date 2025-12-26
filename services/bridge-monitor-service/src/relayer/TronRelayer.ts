import TronWeb from 'tronweb';
import {
  IChainRelayer,
  ChainType,
  ChainConfig,
  Attestation,
  RelayResult,
  ChainRelayerStats,
} from './types';

/**
 * Tron relayer for TRC20-based message transmission
 */
export class TronRelayer implements IChainRelayer {
  public readonly chainDomain = 8; // Tron domain
  public readonly chainName = 'Tron';
  public readonly chainType = ChainType.Tron;

  private tronWeb: TronWeb | null = null;
  private messageTransmitterContract: any = null;
  private connected = false;

  // Statistics
  private totalRelays = 0;
  private successfulRelays = 0;
  private failedRelays = 0;
  private lastRelayTime?: number;

  // MessageTransmitter ABI (same as EVM)
  private readonly MESSAGE_TRANSMITTER_ABI = [
    {
      inputs: [
        { name: 'message', type: 'bytes' },
        { name: 'signatures', type: 'bytes[]' },
      ],
      name: 'receiveMessage',
      outputs: [{ type: 'bool' }],
      stateMutability: 'nonpayable',
      type: 'function',
    },
    {
      inputs: [{ name: 'messageHash', type: 'bytes32' }],
      name: 'isMessageReceived',
      outputs: [{ type: 'bool' }],
      stateMutability: 'view',
      type: 'function',
    },
    {
      inputs: [
        { name: 'sourceDomain', type: 'uint32' },
        { name: 'nonce', type: 'uint64' },
      ],
      name: 'usedNonces',
      outputs: [{ type: 'bool' }],
      stateMutability: 'view',
      type: 'function',
    },
  ];

  constructor(
    private config: ChainConfig,
    private relayerPrivateKey: string
  ) {}

  /**
   * Connect to Tron
   */
  async connect(): Promise<void> {
    console.log(`[${this.chainName}] Connecting...`, {
      rpcUrl: this.config.rpcUrl,
    });

    try {
      // Initialize TronWeb
      this.tronWeb = new TronWeb({
        fullHost: this.config.rpcUrl,
        privateKey: this.relayerPrivateKey,
      });

      // Verify connection
      const nodeInfo = await this.tronWeb.trx.getCurrentBlock();

      console.log(`[${this.chainName}] Connected to Tron`, {
        blockNumber: nodeInfo.block_header?.raw_data?.number || 0,
      });

      // Get relayer address
      const address = this.tronWeb.address.fromPrivateKey(this.relayerPrivateKey);

      console.log(`[${this.chainName}] Relayer address initialized`, {
        address,
      });

      // Initialize MessageTransmitter contract if configured
      if (this.config.messageTransmitterAddress) {
        try {
          // Convert base58 address to hex if needed
          const contractAddress = this.tronWeb.address.toHex(
            this.config.messageTransmitterAddress
          );

          this.messageTransmitterContract = await this.tronWeb.contract(
            this.MESSAGE_TRANSMITTER_ABI,
            contractAddress
          );

          console.log(`[${this.chainName}] MessageTransmitter contract initialized`, {
            address: this.config.messageTransmitterAddress,
          });
        } catch (error: any) {
          throw new Error(`Failed to initialize contract: ${error.message}`);
        }
      } else {
        console.warn(`[${this.chainName}] MessageTransmitter address not configured`);
      }

      this.connected = true;
    } catch (error: any) {
      console.error(`[${this.chainName}] Failed to connect`, {
        error: error?.message,
      });
      throw error;
    }
  }

  /**
   * Disconnect from Tron
   */
  async disconnect(): Promise<void> {
    console.log(`[${this.chainName}] Disconnecting...`);

    this.tronWeb = null;
    this.messageTransmitterContract = null;
    this.connected = false;

    console.log(`[${this.chainName}] Disconnected`);
  }

  /**
   * Relay a message to Tron
   */
  async relayMessage(attestation: Attestation): Promise<RelayResult> {
    if (!this.connected || !this.messageTransmitterContract || !this.tronWeb) {
      throw new Error(`[${this.chainName}] Not connected`);
    }

    const { messageHash, message, signatures } = attestation;

    console.log(`[${this.chainName}] Relaying message`, {
      messageHash,
      signatureCount: signatures.length,
    });

    this.totalRelays++;

    try {
      // Check if already received
      const isReceived = await this.messageTransmitterContract.isMessageReceived(
        messageHash
      ).call();

      if (isReceived) {
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

      // Prepare transaction parameters
      const messageBytes = message.startsWith('0x') ? message : '0x' + message;

      // Estimate energy
      let feeLimit = 1000000000; // 1000 TRX default
      try {
        const estimate = await this.tronWeb.transactionBuilder.triggerConstantContract(
          this.tronWeb.address.toHex(this.config.messageTransmitterAddress!),
          'receiveMessage(bytes,bytes[])',
          {},
          [
            { type: 'bytes', value: messageBytes },
            { type: 'bytes[]', value: signatures },
          ]
        );

        if (estimate.energy_used) {
          // Convert energy to TRX (roughly)
          feeLimit = Math.ceil(estimate.energy_used * 420); // 420 sun per energy unit
          feeLimit = Math.min(feeLimit * 2, 1000000000); // Cap at 1000 TRX
        }
      } catch (error: any) {
        console.warn(`[${this.chainName}] Energy estimation failed, using default`, {
          messageHash,
          error: error?.message,
        });
      }

      console.log(`[${this.chainName}] Submitting transaction`, {
        messageHash,
        feeLimit,
      });

      // Send transaction
      const tx = await this.messageTransmitterContract
        .receiveMessage(messageBytes, signatures)
        .send({
          feeLimit,
          shouldPollResponse: true,
        });

      console.log(`[${this.chainName}] Transaction submitted`, {
        messageHash,
        txHash: tx,
      });

      // Wait for confirmation
      let confirmed = false;
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds

      while (!confirmed && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1000));

        try {
          const txInfo = await this.tronWeb.trx.getTransactionInfo(tx);

          if (txInfo && txInfo.id) {
            if (txInfo.receipt?.result === 'SUCCESS') {
              confirmed = true;

              this.successfulRelays++;
              this.lastRelayTime = Date.now();

              console.log(`[${this.chainName}] Message relayed successfully`, {
                messageHash,
                txHash: tx,
                blockNumber: txInfo.blockNumber,
                energyUsed: txInfo.receipt.energy_usage_total,
              });

              return {
                success: true,
                messageHash,
                chain: this.chainName,
                chainDomain: this.chainDomain,
                txHash: tx,
                gasUsed: BigInt(txInfo.receipt.energy_usage_total || 0),
                blockNumber: txInfo.blockNumber,
                timestamp: Date.now(),
              };
            } else if (txInfo.receipt?.result === 'REVERT') {
              throw new Error(`Transaction reverted: ${txInfo.resMessage || 'Unknown error'}`);
            }
          }
        } catch (error: any) {
          if (error.message.includes('reverted')) {
            throw error;
          }
          // Continue waiting
        }

        attempts++;
      }

      if (!confirmed) {
        throw new Error('Transaction confirmation timeout');
      }
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

    // Should never reach here
    return {
      success: false,
      messageHash,
      chain: this.chainName,
      chainDomain: this.chainDomain,
      error: 'Unknown error',
      timestamp: Date.now(),
    };
  }

  /**
   * Check if a message has been received
   */
  async isMessageReceived(messageHash: string): Promise<boolean> {
    if (!this.messageTransmitterContract) {
      throw new Error(`[${this.chainName}] MessageTransmitter not initialized`);
    }

    try {
      return await this.messageTransmitterContract.isMessageReceived(messageHash).call();
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
    if (!this.messageTransmitterContract) {
      throw new Error(`[${this.chainName}] MessageTransmitter not initialized`);
    }

    try {
      return await this.messageTransmitterContract.usedNonces(
        sourceDomain,
        nonce.toString()
      ).call();
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
   * Get relayer balance (TRX)
   */
  async getBalance(): Promise<bigint> {
    if (!this.tronWeb) {
      throw new Error(`[${this.chainName}] TronWeb not initialized`);
    }

    try {
      const address = this.tronWeb.address.fromPrivateKey(this.relayerPrivateKey);
      const balance = await this.tronWeb.trx.getBalance(address);
      return BigInt(balance);
    } catch (error) {
      console.error(`[${this.chainName}] Error getting balance`, error);
      return 0n;
    }
  }

  /**
   * Get current block number
   */
  async getCurrentBlock(): Promise<number> {
    if (!this.tronWeb) {
      throw new Error(`[${this.chainName}] TronWeb not initialized`);
    }

    try {
      const block = await this.tronWeb.trx.getCurrentBlock();
      return block.block_header?.raw_data?.number || 0;
    } catch (error) {
      console.error(`[${this.chainName}] Error getting block number`, error);
      return 0;
    }
  }

  /**
   * Estimate gas (energy) for a relay transaction
   */
  async estimateGas(attestation: Attestation): Promise<bigint> {
    if (!this.tronWeb || !this.config.messageTransmitterAddress) {
      throw new Error(`[${this.chainName}] Not initialized`);
    }

    try {
      const messageBytes = attestation.message.startsWith('0x')
        ? attestation.message
        : '0x' + attestation.message;

      const estimate = await this.tronWeb.transactionBuilder.triggerConstantContract(
        this.tronWeb.address.toHex(this.config.messageTransmitterAddress),
        'receiveMessage(bytes,bytes[])',
        {},
        [
          { type: 'bytes', value: messageBytes },
          { type: 'bytes[]', value: attestation.signatures },
        ]
      );

      return BigInt(estimate.energy_used || 0);
    } catch (error) {
      console.error(`[${this.chainName}] Error estimating gas`, error);
      return 0n;
    }
  }

  /**
   * Get relayer statistics
   */
  getStats(): ChainRelayerStats {
    const relayerAddress = this.tronWeb
      ? this.tronWeb.address.fromPrivateKey(this.relayerPrivateKey)
      : undefined;

    return {
      chainDomain: this.chainDomain,
      chainName: this.chainName,
      isConnected: this.connected,
      relayerAddress,
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
