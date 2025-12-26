import { logger } from './logger';
import { Attestation, AttestationSignature, AttestationConfig } from '../types';
import { ethers } from 'ethers';

/**
 * In-memory attestation store
 * In production, use Redis or a database
 */
export class AttestationStore {
  private attestations: Map<string, Attestation> = new Map();
  private readonly EXPIRY_TIME = 3600000; // 1 hour in milliseconds

  constructor(private config: AttestationConfig) {}

  /**
   * Create a new attestation
   */
  createAttestation(
    messageHash: string,
    message: Uint8Array,
    sourceDomain: number,
    destinationDomain: number,
    nonce: bigint
  ): Attestation {
    const now = Date.now();

    const attestation: Attestation = {
      messageHash,
      message,
      sourceDomain,
      destinationDomain,
      nonce,
      signatures: [],
      createdAt: now,
      expiresAt: now + this.EXPIRY_TIME,
      status: 'pending',
    };

    this.attestations.set(messageHash, attestation);

    logger.info('Created new attestation', {
      messageHash,
      sourceDomain,
      destinationDomain,
      nonce: nonce.toString(),
    });

    return attestation;
  }

  /**
   * Add a signature to an attestation
   */
  addSignature(messageHash: string, signature: AttestationSignature): boolean {
    const attestation = this.attestations.get(messageHash);

    if (!attestation) {
      logger.warn('Attestation not found for signature', { messageHash });
      return false;
    }

    // Check if this attester already signed
    const existingIndex = attestation.signatures.findIndex(
      (s) => s.attesterId === signature.attesterId
    );

    if (existingIndex >= 0) {
      logger.warn('Attester already signed this message', {
        messageHash,
        attesterId: signature.attesterId,
      });
      return false;
    }

    // Add signature
    attestation.signatures.push(signature);

    // Check if threshold met
    if (attestation.signatures.length >= this.config.minSignatures) {
      attestation.status = 'ready';

      logger.info('Attestation threshold met', {
        messageHash,
        signatureCount: attestation.signatures.length,
        threshold: this.config.minSignatures,
      });
    }

    this.attestations.set(messageHash, attestation);

    logger.info('Added signature to attestation', {
      messageHash,
      attesterId: signature.attesterId,
      totalSignatures: attestation.signatures.length,
      status: attestation.status,
    });

    return true;
  }

  /**
   * Get an attestation by message hash
   */
  getAttestation(messageHash: string): Attestation | undefined {
    const attestation = this.attestations.get(messageHash);

    if (!attestation) {
      return undefined;
    }

    // Check if expired
    if (Date.now() > attestation.expiresAt) {
      attestation.status = 'expired';
      this.attestations.set(messageHash, attestation);
    }

    return attestation;
  }

  /**
   * Get attestation by source domain and nonce
   */
  getAttestationByNonce(
    sourceDomain: number,
    nonce: bigint
  ): Attestation | undefined {
    for (const attestation of this.attestations.values()) {
      if (
        attestation.sourceDomain === sourceDomain &&
        attestation.nonce === nonce
      ) {
        return attestation;
      }
    }

    return undefined;
  }

  /**
   * Get all ready attestations
   */
  getReadyAttestations(): Attestation[] {
    const ready: Attestation[] = [];

    for (const attestation of this.attestations.values()) {
      if (attestation.status === 'ready') {
        ready.push(attestation);
      }
    }

    return ready;
  }

  /**
   * Mark attestation as relayed
   */
  markAsRelayed(messageHash: string): boolean {
    const attestation = this.attestations.get(messageHash);

    if (!attestation) {
      return false;
    }

    attestation.status = 'relayed';
    this.attestations.set(messageHash, attestation);

    logger.info('Marked attestation as relayed', { messageHash });

    return true;
  }

  /**
   * Clean up expired attestations
   */
  cleanup(): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [messageHash, attestation] of this.attestations.entries()) {
      if (now > attestation.expiresAt) {
        this.attestations.delete(messageHash);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cleaned up expired attestations', { count: cleaned });
    }

    return cleaned;
  }

  /**
   * Get statistics
   */
  getStats() {
    let pending = 0;
    let ready = 0;
    let relayed = 0;
    let expired = 0;

    for (const attestation of this.attestations.values()) {
      switch (attestation.status) {
        case 'pending':
          pending++;
          break;
        case 'ready':
          ready++;
          break;
        case 'relayed':
          relayed++;
          break;
        case 'expired':
          expired++;
          break;
      }
    }

    return {
      total: this.attestations.size,
      pending,
      ready,
      relayed,
      expired,
    };
  }

  /**
   * Compute message hash (Blake2 for Substrate, Keccak256 for Ethereum)
   */
  static computeMessageHash(message: Uint8Array, destinationDomain: number): string {
    // For Ethereum (domain 0), use keccak256
    if (destinationDomain === 0) {
      return ethers.keccak256(message);
    }

    // For Substrate (domain 2), use blake2-256
    // Note: ethers doesn't have blake2, so we use keccak256 for now
    // In production, use @polkadot/util-crypto blake2AsHex
    return ethers.keccak256(message);
  }
}
