/**
 * Attestation submission types for PBC integration
 */

import { KeyringPair } from '@polkadot/keyring/types';

/**
 * Attester signature format
 */
export interface AttesterSignature {
  attester: string; // Attester address
  signature: string; // Hex-encoded signature (0x...)
}

/**
 * Parameters for submitting attestation to PBC
 */
export interface SubmitAttestationParams {
  pbcEndpoint: string; // WebSocket endpoint for the PBC
  messageHash: string; // Hash of the message being attested
  signatures: AttesterSignature[]; // Array of attester signatures
  signerKeypair: KeyringPair; // Keyring pair for signing the extrinsic
  message?: string; // Optional: full message bytes (hex-encoded)
}

/**
 * Result from attestation submission
 */
export interface AttestationSubmissionResult {
  success: boolean;
  txHash?: string; // Transaction hash if successful
  blockHash?: string; // Block hash where tx was included
  blockNumber?: number; // Block number where tx was included
  error?: string; // Error message if failed
  chainName: string; // Name of the PBC chain
  timestamp: number; // Timestamp of submission
}

/**
 * PBC chain configuration
 */
export interface PbcChainConfig {
  name: string;
  wsEndpoint: string;
  httpEndpoint: string;
  chainId: number;
  enabled: boolean;
}

/**
 * Attestation submitter configuration
 */
export interface AttestationSubmitterConfig {
  chains: Record<string, PbcChainConfig>;
  defaultRetries?: number;
  retryDelayMs?: number;
  timeout?: number;
}

/**
 * Attestation status on PBC
 */
export interface AttestationStatus {
  messageHash: string;
  isVerified: boolean;
  attestations: number; // Number of attestations received
  requiredAttestations: number; // Minimum required
  attesters: string[]; // List of attester addresses
  submittedAt?: number; // Block number when first submitted
}

/**
 * Bridge attestation pallet call parameters
 */
export interface BridgeAttestationCall {
  messageHash: string; // H256
  signatures: string[]; // Vec<Vec<u8>> - raw signature bytes
  attesters: string[]; // Vec<AccountId> - attester accounts
}

/**
 * Submission options
 */
export interface SubmissionOptions {
  nonce?: number; // Optional nonce for transaction ordering
  tip?: bigint; // Optional tip for priority
  waitForFinalization?: boolean; // Wait for finalization (default: true)
  maxRetries?: number; // Max retry attempts (default: 3)
  retryDelay?: number; // Delay between retries in ms (default: 2000)
}

/**
 * Transaction status during submission
 */
export enum TxStatus {
  Pending = 'pending',
  InBlock = 'in_block',
  Finalized = 'finalized',
  Failed = 'failed',
  Dropped = 'dropped',
}

/**
 * Extended submission result with detailed status
 */
export interface ExtendedSubmissionResult extends AttestationSubmissionResult {
  status: TxStatus;
  events?: any[]; // Emitted events
  extrinsicIndex?: number; // Index in block
  gasUsed?: bigint; // Weight/gas consumed
  fee?: bigint; // Transaction fee paid
}
