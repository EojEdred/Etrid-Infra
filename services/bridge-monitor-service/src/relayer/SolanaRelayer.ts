import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  SystemProgram,
} from '@solana/web3.js';
import * as borsh from 'borsh';
import {
  IChainRelayer,
  ChainType,
  ChainConfig,
  Attestation,
  RelayResult,
  ChainRelayerStats,
} from './types';

/**
 * Solana-specific message transmitter instruction data
 */
class ReceiveMessageInstruction {
  instruction: number = 0; // 0 = ReceiveMessage
  message: Uint8Array;
  signatures: Uint8Array[];

  constructor(fields: { message: Uint8Array; signatures: Uint8Array[] }) {
    this.message = fields.message;
    this.signatures = fields.signatures;
  }

  static schema = new Map([
    [
      ReceiveMessageInstruction,
      {
        kind: 'struct',
        fields: [
          ['instruction', 'u8'],
          ['message', ['u8']],
          ['signatures', [['u8']]],
        ],
      },
    ],
  ]);
}

/**
 * Solana relayer for SPL-based message transmission
 */
export class SolanaRelayer implements IChainRelayer {
  public readonly chainDomain = 1; // Solana domain
  public readonly chainName = 'Solana';
  public readonly chainType = ChainType.Solana;

  private connection: Connection | null = null;
  private relayerKeypair: Keypair | null = null;
  private messageTransmitterProgramId: PublicKey | null = null;
  private connected = false;

  // Statistics
  private totalRelays = 0;
  private successfulRelays = 0;
  private failedRelays = 0;
  private lastRelayTime?: number;

  constructor(
    private config: ChainConfig,
    private relayerPrivateKey: string
  ) {}

  /**
   * Connect to Solana
   */
  async connect(): Promise<void> {
    console.log(`[${this.chainName}] Connecting...`, {
      rpcUrl: this.config.rpcUrl,
    });

    try {
      // Connect to Solana cluster
      this.connection = new Connection(this.config.rpcUrl, {
        commitment: 'confirmed',
        confirmTransactionInitialTimeout: 60000,
      });

      // Get version to verify connection
      const version = await this.connection.getVersion();
      const slot = await this.connection.getSlot();

      console.log(`[${this.chainName}] Connected to Solana`, {
        version: version['solana-core'],
        slot,
      });

      // Initialize relayer keypair from private key
      // Expect base58-encoded private key or array of bytes
      try {
        const secretKey = this.parsePrivateKey(this.relayerPrivateKey);
        this.relayerKeypair = Keypair.fromSecretKey(secretKey);

        console.log(`[${this.chainName}] Relayer keypair initialized`, {
          address: this.relayerKeypair.publicKey.toBase58(),
        });
      } catch (error: any) {
        throw new Error(`Failed to parse Solana private key: ${error.message}`);
      }

      // Initialize message transmitter program ID
      if (this.config.messageTransmitterAddress) {
        try {
          this.messageTransmitterProgramId = new PublicKey(
            this.config.messageTransmitterAddress
          );

          console.log(`[${this.chainName}] MessageTransmitter program initialized`, {
            programId: this.messageTransmitterProgramId.toBase58(),
          });
        } catch (error: any) {
          throw new Error(`Invalid program ID: ${error.message}`);
        }
      } else {
        console.warn(`[${this.chainName}] MessageTransmitter program ID not configured`);
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
   * Disconnect from Solana
   */
  async disconnect(): Promise<void> {
    console.log(`[${this.chainName}] Disconnecting...`);

    this.connection = null;
    this.relayerKeypair = null;
    this.messageTransmitterProgramId = null;
    this.connected = false;

    console.log(`[${this.chainName}] Disconnected`);
  }

  /**
   * Relay a message to Solana
   */
  async relayMessage(attestation: Attestation): Promise<RelayResult> {
    if (!this.connected || !this.connection || !this.relayerKeypair || !this.messageTransmitterProgramId) {
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
      const isReceived = await this.isMessageReceived(messageHash);
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

      // Convert message and signatures to Uint8Array
      const messageBytes = this.hexToUint8Array(message);
      const signatureVecs = signatures.map((sig) => this.hexToUint8Array(sig));

      // Create instruction data
      const instructionData = new ReceiveMessageInstruction({
        message: messageBytes,
        signatures: signatureVecs,
      });

      // Serialize instruction
      const serialized = borsh.serialize(
        ReceiveMessageInstruction.schema,
        instructionData
      );

      // Derive PDA for message account
      const messageAccountPDA = await this.deriveMessageAccount(messageHash);

      // Create instruction
      const instruction = new TransactionInstruction({
        programId: this.messageTransmitterProgramId,
        keys: [
          { pubkey: this.relayerKeypair.publicKey, isSigner: true, isWritable: true },
          { pubkey: messageAccountPDA, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: Buffer.from(serialized),
      });

      // Create transaction
      const transaction = new Transaction().add(instruction);

      // Get recent blockhash
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = this.relayerKeypair.publicKey;

      console.log(`[${this.chainName}] Submitting transaction`, {
        messageHash,
        blockhash,
      });

      // Sign and send transaction
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [this.relayerKeypair],
        {
          commitment: 'confirmed',
          maxRetries: 3,
        }
      );

      // Get transaction details
      const txDetails = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
      });

      this.successfulRelays++;
      this.lastRelayTime = Date.now();

      console.log(`[${this.chainName}] Message relayed successfully`, {
        messageHash,
        signature,
        slot: txDetails?.slot,
      });

      return {
        success: true,
        messageHash,
        chain: this.chainName,
        chainDomain: this.chainDomain,
        txHash: signature,
        blockNumber: txDetails?.slot,
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
    if (!this.connection || !this.messageTransmitterProgramId) {
      throw new Error(`[${this.chainName}] Not initialized`);
    }

    try {
      const messageAccountPDA = await this.deriveMessageAccount(messageHash);
      const accountInfo = await this.connection.getAccountInfo(messageAccountPDA);
      return accountInfo !== null;
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
    if (!this.connection || !this.messageTransmitterProgramId) {
      throw new Error(`[${this.chainName}] Not initialized`);
    }

    try {
      // Derive nonce PDA
      const [noncePDA] = await PublicKey.findProgramAddress(
        [
          Buffer.from('nonce'),
          Buffer.from([sourceDomain]),
          Buffer.from(nonce.toString()),
        ],
        this.messageTransmitterProgramId
      );

      const accountInfo = await this.connection.getAccountInfo(noncePDA);
      return accountInfo !== null;
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
   * Get relayer balance (SOL)
   */
  async getBalance(): Promise<bigint> {
    if (!this.connection || !this.relayerKeypair) {
      throw new Error(`[${this.chainName}] Not initialized`);
    }

    try {
      const balance = await this.connection.getBalance(
        this.relayerKeypair.publicKey
      );
      return BigInt(balance);
    } catch (error) {
      console.error(`[${this.chainName}] Error getting balance`, error);
      return 0n;
    }
  }

  /**
   * Get current slot number
   */
  async getCurrentBlock(): Promise<number> {
    if (!this.connection) {
      throw new Error(`[${this.chainName}] Not initialized`);
    }

    try {
      return await this.connection.getSlot();
    } catch (error) {
      console.error(`[${this.chainName}] Error getting slot`, error);
      return 0;
    }
  }

  /**
   * Estimate gas (compute units) for a relay transaction
   */
  async estimateGas(attestation: Attestation): Promise<bigint> {
    // Solana uses compute units, not gas
    // Typical transaction uses ~200,000 compute units
    return BigInt(200000);
  }

  /**
   * Get relayer statistics
   */
  getStats(): ChainRelayerStats {
    return {
      chainDomain: this.chainDomain,
      chainName: this.chainName,
      isConnected: this.connected,
      relayerAddress: this.relayerKeypair?.publicKey.toBase58(),
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
   * Helper: Derive message account PDA
   */
  private async deriveMessageAccount(messageHash: string): Promise<PublicKey> {
    if (!this.messageTransmitterProgramId) {
      throw new Error('Program ID not initialized');
    }

    const [pda] = await PublicKey.findProgramAddress(
      [Buffer.from('message'), Buffer.from(messageHash.slice(2), 'hex')],
      this.messageTransmitterProgramId
    );

    return pda;
  }

  /**
   * Helper: Convert hex string to Uint8Array
   */
  private hexToUint8Array(hex: string): Uint8Array {
    const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
    return new Uint8Array(Buffer.from(clean, 'hex'));
  }

  /**
   * Helper: Parse private key
   */
  private parsePrivateKey(key: string): Uint8Array {
    // Try JSON array format first
    if (key.startsWith('[') && key.endsWith(']')) {
      const arr = JSON.parse(key);
      return new Uint8Array(arr);
    }

    // Try base58 format
    try {
      const bs58 = require('bs58');
      return bs58.decode(key);
    } catch {
      // Try hex format
      return this.hexToUint8Array(key);
    }
  }
}
