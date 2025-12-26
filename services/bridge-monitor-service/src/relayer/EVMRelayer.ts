import { ethers } from 'ethers';
import {
  IChainRelayer,
  ChainType,
  ChainConfig,
  Attestation,
  RelayResult,
  ChainRelayerStats,
} from './types';

/**
 * Generic EVM relayer for all Ethereum-compatible chains
 * Supports: Ethereum, Polygon, BNB, Avalanche, Arbitrum, Optimism, etc.
 */
export class EVMRelayer implements IChainRelayer {
  public readonly chainDomain: number;
  public readonly chainName: string;
  public readonly chainType = ChainType.EVM;

  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;
  private messageTransmitter: ethers.Contract | null = null;
  private connected = false;

  // Statistics
  private totalRelays = 0;
  private successfulRelays = 0;
  private failedRelays = 0;
  private lastRelayTime?: number;

  // EDSCMessageTransmitter ABI
  private readonly MESSAGE_TRANSMITTER_ABI = [
    'function receiveMessage(bytes calldata message, bytes[] calldata signatures) external returns (bool)',
    'function isMessageReceived(bytes32 messageHash) external view returns (bool)',
    'function usedNonces(uint32 sourceDomain, uint64 nonce) external view returns (bool)',
    'event MessageReceived(bytes32 indexed messageHash, uint32 indexed sourceDomain, uint64 indexed nonce, address recipient, uint256 amount)',
  ];

  constructor(
    private config: ChainConfig,
    private relayerPrivateKey: string
  ) {
    this.chainDomain = config.domain;
    this.chainName = config.name;
  }

  /**
   * Connect to the EVM chain
   */
  async connect(): Promise<void> {
    console.log(`[${this.chainName}] Connecting...`, {
      rpcUrl: this.config.rpcUrl,
      chainId: this.config.chainId,
    });

    try {
      // Connect to chain
      this.provider = new ethers.JsonRpcProvider(this.config.rpcUrl);

      // Verify network
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();

      console.log(`[${this.chainName}] Connected to network`, {
        chainId: network.chainId.toString(),
        blockNumber,
      });

      // Verify chainId if configured
      if (this.config.chainId && Number(network.chainId) !== this.config.chainId) {
        throw new Error(
          `Chain ID mismatch: expected ${this.config.chainId}, got ${network.chainId}`
        );
      }

      // Initialize wallet
      this.wallet = new ethers.Wallet(this.relayerPrivateKey, this.provider);

      console.log(`[${this.chainName}] Relayer wallet initialized`, {
        address: this.wallet.address,
      });

      // Initialize MessageTransmitter contract if configured
      if (this.config.messageTransmitterAddress) {
        this.messageTransmitter = new ethers.Contract(
          this.config.messageTransmitterAddress,
          this.MESSAGE_TRANSMITTER_ABI,
          this.wallet
        );

        console.log(`[${this.chainName}] MessageTransmitter contract initialized`, {
          address: this.config.messageTransmitterAddress,
        });
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
   * Disconnect from the EVM chain
   */
  async disconnect(): Promise<void> {
    console.log(`[${this.chainName}] Disconnecting...`);

    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
    }

    this.wallet = null;
    this.messageTransmitter = null;
    this.connected = false;

    console.log(`[${this.chainName}] Disconnected`);
  }

  /**
   * Relay a message to the EVM chain
   */
  async relayMessage(attestation: Attestation): Promise<RelayResult> {
    if (!this.connected || !this.messageTransmitter || !this.wallet) {
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
      const isReceived = await this.messageTransmitter.isMessageReceived(messageHash);

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

      // Decode message bytes
      const messageBytes = ethers.getBytes(message);

      // Estimate gas first
      let gasEstimate: bigint;
      try {
        gasEstimate = await this.messageTransmitter.receiveMessage.estimateGas(
          messageBytes,
          signatures
        );
        console.log(`[${this.chainName}] Gas estimate`, {
          messageHash,
          gasEstimate: gasEstimate.toString(),
        });
      } catch (error: any) {
        console.warn(`[${this.chainName}] Gas estimation failed, using default`, {
          messageHash,
          error: error?.message,
        });
        gasEstimate = BigInt(this.config.gasConfig?.gasLimit || '500000');
      }

      // Build transaction with gas config
      const txOptions: any = {
        gasLimit: (gasEstimate * 120n) / 100n, // Add 20% buffer
      };

      // Add gas price config (EIP-1559 or legacy)
      if (this.config.gasConfig?.maxFeePerGas) {
        txOptions.maxFeePerGas = ethers.parseUnits(
          this.config.gasConfig.maxFeePerGas,
          'gwei'
        );
      }
      if (this.config.gasConfig?.maxPriorityFeePerGas) {
        txOptions.maxPriorityFeePerGas = ethers.parseUnits(
          this.config.gasConfig.maxPriorityFeePerGas,
          'gwei'
        );
      }
      if (this.config.gasConfig?.gasPrice) {
        txOptions.gasPrice = ethers.parseUnits(
          this.config.gasConfig.gasPrice,
          'gwei'
        );
      }

      // Submit transaction
      const tx = await this.messageTransmitter.receiveMessage(
        messageBytes,
        signatures,
        txOptions
      );

      console.log(`[${this.chainName}] Transaction submitted`, {
        messageHash,
        txHash: tx.hash,
      });

      // Wait for confirmation
      const confirmations = this.config.confirmations || 1;
      const receipt = await tx.wait(confirmations);

      if (receipt?.status === 1) {
        this.successfulRelays++;
        this.lastRelayTime = Date.now();

        console.log(`[${this.chainName}] Message relayed successfully`, {
          messageHash,
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
        });

        return {
          success: true,
          messageHash,
          chain: this.chainName,
          chainDomain: this.chainDomain,
          txHash: receipt.hash,
          gasUsed: receipt.gasUsed,
          blockNumber: receipt.blockNumber,
          timestamp: Date.now(),
        };
      } else {
        this.failedRelays++;

        console.error(`[${this.chainName}] Transaction failed`, {
          messageHash,
          txHash: receipt?.hash,
        });

        return {
          success: false,
          messageHash,
          chain: this.chainName,
          chainDomain: this.chainDomain,
          txHash: receipt?.hash,
          error: 'Transaction failed',
          timestamp: Date.now(),
        };
      }
    } catch (error: any) {
      this.failedRelays++;

      console.error(`[${this.chainName}] Failed to relay message`, {
        messageHash,
        error: error?.message,
        code: error?.code,
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
    if (!this.messageTransmitter) {
      throw new Error(`[${this.chainName}] MessageTransmitter not initialized`);
    }

    try {
      return await this.messageTransmitter.isMessageReceived(messageHash);
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
    if (!this.messageTransmitter) {
      throw new Error(`[${this.chainName}] MessageTransmitter not initialized`);
    }

    try {
      return await this.messageTransmitter.usedNonces(sourceDomain, nonce);
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
    if (!this.wallet || !this.provider) {
      throw new Error(`[${this.chainName}] Wallet not initialized`);
    }

    try {
      return await this.provider.getBalance(this.wallet.address);
    } catch (error) {
      console.error(`[${this.chainName}] Error getting balance`, error);
      return 0n;
    }
  }

  /**
   * Get current block number
   */
  async getCurrentBlock(): Promise<number> {
    if (!this.provider) {
      throw new Error(`[${this.chainName}] Provider not initialized`);
    }

    try {
      return await this.provider.getBlockNumber();
    } catch (error) {
      console.error(`[${this.chainName}] Error getting block number`, error);
      return 0;
    }
  }

  /**
   * Estimate gas for a relay transaction
   */
  async estimateGas(attestation: Attestation): Promise<bigint> {
    if (!this.messageTransmitter) {
      throw new Error(`[${this.chainName}] MessageTransmitter not initialized`);
    }

    try {
      const messageBytes = ethers.getBytes(attestation.message);
      return await this.messageTransmitter.receiveMessage.estimateGas(
        messageBytes,
        attestation.signatures
      );
    } catch (error) {
      console.error(`[${this.chainName}] Error estimating gas`, error);
      return BigInt(this.config.gasConfig?.gasLimit || '500000');
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
      relayerAddress: this.wallet?.address,
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

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<bigint> {
    if (!this.provider) {
      throw new Error(`[${this.chainName}] Provider not initialized`);
    }

    try {
      const feeData = await this.provider.getFeeData();
      return feeData.gasPrice || 0n;
    } catch (error) {
      console.error(`[${this.chainName}] Error getting gas price`, error);
      return 0n;
    }
  }

  /**
   * Get fee data (EIP-1559)
   */
  async getFeeData(): Promise<ethers.FeeData> {
    if (!this.provider) {
      throw new Error(`[${this.chainName}] Provider not initialized`);
    }

    try {
      return await this.provider.getFeeData();
    } catch (error: any) {
      console.error(`[${this.chainName}] Error getting fee data`, error);
      throw error;
    }
  }
}
