import { ethers } from 'ethers';
import { Keyring } from '@polkadot/keyring';
import { u8aToHex } from '@polkadot/util';
import { cryptoWaitReady } from '@polkadot/util-crypto';
import { logger } from '../utils/logger';
import { AttestationConfig, CrossChainMessage, AttestationSignature } from '../types';

/**
 * Signs cross-chain messages with attester's private key
 * Supports both ECDSA (Ethereum) and SR25519 (Substrate) signatures
 */
export class MessageSigner {
  private ethersSigner: ethers.Wallet | null = null;
  private substrateSigner: any = null; // Polkadot Keyring pair
  private attesterId: number;
  private attesterAddress: string;

  constructor(private config: AttestationConfig) {
    this.attesterId = config.attesterId;
    this.attesterAddress = config.attesterAddress;
  }

  /**
   * Initialize signers
   */
  async initialize(): Promise<void> {
    logger.info('Initializing message signer...', {
      attesterId: this.attesterId,
      attesterAddress: this.attesterAddress,
    });

    try {
      // Initialize Ethereum signer (ECDSA)
      this.ethersSigner = new ethers.Wallet(this.config.attesterPrivateKey);

      logger.info('Ethereum signer initialized', {
        address: this.ethersSigner.address,
      });

      // Initialize Substrate signer (SR25519)
      await cryptoWaitReady();
      const keyring = new Keyring({ type: 'sr25519' });

      // For development, you can use a seed phrase or private key
      // In production, use HSM or secure key management
      this.substrateSigner = keyring.addFromUri(this.config.attesterPrivateKey);

      logger.info('Substrate signer initialized', {
        address: this.substrateSigner.address,
      });

      logger.info('Message signer initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize message signer', error);
      throw error;
    }
  }

  /**
   * Sign a message hash (for Ethereum verification)
   * Uses ECDSA signature compatible with Ethereum's ecrecover
   */
  async signMessageHashEthereum(messageHash: string): Promise<AttestationSignature> {
    if (!this.ethersSigner) {
      throw new Error('Ethereum signer not initialized');
    }

    try {
      // Sign the message hash
      // ethers.js automatically prefixes with "\x19Ethereum Signed Message:\n32"
      const signature = await this.ethersSigner.signMessage(
        ethers.getBytes(messageHash)
      );

      logger.debug('Signed message with Ethereum signer', {
        messageHash,
        signature,
        attesterId: this.attesterId,
      });

      return {
        attesterId: this.attesterId,
        attesterAddress: this.attesterAddress,
        signature,
        signedAt: Date.now(),
      };
    } catch (error) {
      logger.error('Failed to sign message with Ethereum signer', error);
      throw error;
    }
  }

  /**
   * Sign a message hash (for Substrate verification)
   * Uses SR25519 signature
   */
  signMessageHashSubstrate(messageHash: string): AttestationSignature {
    if (!this.substrateSigner) {
      throw new Error('Substrate signer not initialized');
    }

    try {
      // Convert message hash to Uint8Array
      const messageBytes = ethers.getBytes(messageHash);

      // Sign with SR25519
      const signature = this.substrateSigner.sign(messageBytes);

      // Convert to hex
      const signatureHex = u8aToHex(signature);

      logger.debug('Signed message with Substrate signer', {
        messageHash,
        signature: signatureHex,
        attesterId: this.attesterId,
      });

      return {
        attesterId: this.attesterId,
        attesterAddress: this.attesterAddress,
        signature: signatureHex,
        signedAt: Date.now(),
      };
    } catch (error) {
      logger.error('Failed to sign message with Substrate signer', error);
      throw error;
    }
  }

  /**
   * Sign a cross-chain message based on destination domain
   * Automatically selects the appropriate signature type
   */
  async signCrossChainMessage(
    messageHash: string,
    destinationDomain: number
  ): Promise<AttestationSignature> {
    // Domain 0 = Ethereum (use ECDSA)
    // Domain 2 = Ëtrid (use SR25519)
    if (destinationDomain === 0) {
      return await this.signMessageHashEthereum(messageHash);
    } else if (destinationDomain === 2) {
      return this.signMessageHashSubstrate(messageHash);
    } else {
      throw new Error(`Unsupported destination domain: ${destinationDomain}`);
    }
  }

  /**
   * Verify an ECDSA signature (for testing)
   */
  verifyEthereumSignature(
    messageHash: string,
    signature: string
  ): { valid: boolean; recoveredAddress: string } {
    try {
      const messageBytes = ethers.getBytes(messageHash);
      const recoveredAddress = ethers.verifyMessage(messageBytes, signature);

      const valid = recoveredAddress.toLowerCase() === this.attesterAddress.toLowerCase();

      return { valid, recoveredAddress };
    } catch (error) {
      logger.error('Failed to verify Ethereum signature', error);
      return { valid: false, recoveredAddress: '' };
    }
  }

  /**
   * Verify an SR25519 signature (for testing)
   */
  verifySubstrateSignature(messageHash: string, signature: string): boolean {
    if (!this.substrateSigner) {
      throw new Error('Substrate signer not initialized');
    }

    try {
      const messageBytes = ethers.getBytes(messageHash);
      const signatureBytes = ethers.getBytes(signature);

      const valid = this.substrateSigner.verify(messageBytes, signatureBytes);

      return valid;
    } catch (error) {
      logger.error('Failed to verify Substrate signature', error);
      return false;
    }
  }

  /**
   * Get signer info
   */
  getInfo() {
    return {
      attesterId: this.attesterId,
      attesterAddress: this.attesterAddress,
      ethereumAddress: this.ethersSigner?.address,
      substrateAddress: this.substrateSigner?.address,
    };
  }
}
