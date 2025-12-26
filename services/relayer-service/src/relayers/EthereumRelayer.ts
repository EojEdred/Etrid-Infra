import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { Attestation, RelayerConfig, RelayResult } from '../types';

/**
 * Relays messages to Ethereum (EDSCMessageTransmitter contract)
 */
export class EthereumRelayer {
  private provider: ethers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;
  private messageTransmitter: ethers.Contract | null = null;
  private isConnected = false;
  private lastRelayTime?: number;
  private totalRelays = 0;
  private successfulRelays = 0;
  private failedRelays = 0;

  // EDSCMessageTransmitter ABI
  private readonly MESSAGE_TRANSMITTER_ABI = [
    'function receiveMessage(bytes calldata message, bytes[] calldata signatures) external returns (bool)',
    'function isMessageReceived(bytes32 messageHash) external view returns (bool)',
    'function usedNonces(uint32 sourceDomain, uint64 nonce) external view returns (bool)',
    'event MessageReceived(bytes32 indexed messageHash, uint32 indexed sourceDomain, uint64 indexed nonce, address recipient, uint256 amount)',
  ];

  constructor(private config: RelayerConfig) {}

  /**
   * Connect to Ethereum
   */
  async connect(): Promise<void> {
    logger.info('Connecting to Ethereum...', {
      rpcUrl: this.config.ethereumRpcUrl,
    });

    try {
      // Connect to Ethereum node
      this.provider = new ethers.JsonRpcProvider(this.config.ethereumRpcUrl);

      // Get network info
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();

      logger.info('Connected to Ethereum network', {
        chainId: network.chainId.toString(),
        blockNumber,
      });

      // Initialize wallet
      this.wallet = new ethers.Wallet(
        this.config.relayerPrivateKey,
        this.provider
      );

      logger.info('Relayer wallet initialized', {
        address: this.wallet.address,
      });

      // Initialize contract if address provided
      if (this.config.messageTransmitterAddress) {
        this.messageTransmitter = new ethers.Contract(
          this.config.messageTransmitterAddress,
          this.MESSAGE_TRANSMITTER_ABI,
          this.wallet
        );

        logger.info('MessageTransmitter contract initialized', {
          address: this.config.messageTransmitterAddress,
        });
      } else {
        logger.warn('MessageTransmitter address not configured');
      }

      this.isConnected = true;
    } catch (error) {
      logger.error('Failed to connect to Ethereum', error);
      throw error;
    }
  }

  /**
   * Disconnect from Ethereum
   */
  async disconnect(): Promise<void> {
    logger.info('Disconnecting from Ethereum...');

    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
    }

    this.wallet = null;
    this.messageTransmitter = null;
    this.isConnected = false;

    logger.info('Disconnected from Ethereum');
  }

  /**
   * Relay a message to Ethereum
   */
  async relayMessage(attestation: Attestation): Promise<RelayResult> {
    if (!this.isConnected || !this.messageTransmitter || !this.wallet) {
      throw new Error('Not connected to Ethereum');
    }

    const { messageHash, message, signatures } = attestation;

    logger.info('Relaying message to Ethereum', {
      messageHash,
      signatureCount: signatures.length,
    });

    this.totalRelays++;

    try {
      // Check if already received
      const isReceived = await this.messageTransmitter.isMessageReceived(
        messageHash
      );

      if (isReceived) {
        logger.info('Message already received on Ethereum', { messageHash });
        this.successfulRelays++;
        return {
          success: true,
          messageHash,
          error: 'Already received',
        };
      }

      // Decode message bytes
      const messageBytes = ethers.getBytes(message);

      // Build transaction
      const tx = await this.messageTransmitter.receiveMessage(
        messageBytes,
        signatures,
        {
          gasLimit: this.config.gasLimit || 500000,
          maxFeePerGas: this.config.maxFeePerGas
            ? ethers.parseUnits(this.config.maxFeePerGas, 'gwei')
            : undefined,
          maxPriorityFeePerGas: this.config.maxPriorityFeePerGas
            ? ethers.parseUnits(this.config.maxPriorityFeePerGas, 'gwei')
            : undefined,
        }
      );

      logger.info('Submitted relay transaction to Ethereum', {
        messageHash,
        txHash: tx.hash,
      });

      // Wait for confirmation
      const receipt = await tx.wait();

      if (receipt?.status === 1) {
        this.successfulRelays++;
        this.lastRelayTime = Date.now();

        logger.info('Successfully relayed message to Ethereum', {
          messageHash,
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
        });

        return {
          success: true,
          messageHash,
          txHash: receipt.hash,
          gasUsed: receipt.gasUsed,
        };
      } else {
        this.failedRelays++;

        logger.error('Transaction failed on Ethereum', {
          messageHash,
          txHash: receipt?.hash,
        });

        return {
          success: false,
          messageHash,
          txHash: receipt?.hash,
          error: 'Transaction failed',
        };
      }
    } catch (error: any) {
      this.failedRelays++;

      logger.error('Failed to relay message to Ethereum', {
        messageHash,
        error: error?.message,
        code: error?.code,
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
    if (!this.messageTransmitter) {
      throw new Error('MessageTransmitter not initialized');
    }

    try {
      return await this.messageTransmitter.isMessageReceived(messageHash);
    } catch (error) {
      logger.error('Error checking if message received', { messageHash, error });
      return false;
    }
  }

  /**
   * Check if a nonce has been used
   */
  async isNonceUsed(sourceDomain: number, nonce: bigint): Promise<boolean> {
    if (!this.messageTransmitter) {
      throw new Error('MessageTransmitter not initialized');
    }

    try {
      return await this.messageTransmitter.usedNonces(sourceDomain, nonce);
    } catch (error) {
      logger.error('Error checking nonce', { sourceDomain, nonce, error });
      return false;
    }
  }

  /**
   * Get relayer balance
   */
  async getBalance(): Promise<bigint> {
    if (!this.wallet || !this.provider) {
      throw new Error('Wallet not initialized');
    }

    try {
      return await this.provider.getBalance(this.wallet.address);
    } catch (error) {
      logger.error('Error getting balance', error);
      return 0n;
    }
  }

  /**
   * Get current gas price
   */
  async getGasPrice(): Promise<bigint> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      const feeData = await this.provider.getFeeData();
      return feeData.gasPrice || 0n;
    } catch (error) {
      logger.error('Error getting gas price', error);
      return 0n;
    }
  }

  /**
   * Get current block number
   */
  async getCurrentBlock(): Promise<number> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      return await this.provider.getBlockNumber();
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
      relayerAddress: this.wallet?.address,
      messageTransmitterAddress: this.config.messageTransmitterAddress,
      totalRelays: this.totalRelays,
      successfulRelays: this.successfulRelays,
      failedRelays: this.failedRelays,
      lastRelayTime: this.lastRelayTime,
    };
  }
}
