/**
 * Type definitions for EDSC Attestation Service
 */

export interface AttestationConfig {
  // Substrate configuration
  substrateWsUrl: string;
  substrateChainId: number;

  // Ethereum configuration
  ethereumRpcUrl: string;
  ethereumChainId: number;

  // Attester configuration
  attesterPrivateKey: string;
  attesterAddress: string;
  attesterId: number;

  // Service configuration
  port: number;
  redisUrl?: string;
  logLevel: string;

  // Contract addresses (Ethereum)
  edscTokenAddress?: string;
  attesterRegistryAddress?: string;
  messageTransmitterAddress?: string;
  tokenMessengerAddress?: string;

  // Thresholds
  minSignatures: number;
  totalAttesters: number;
  confirmationsRequired: number; // Finality requirement
}

export interface CrossChainMessage {
  version: number;
  sourceDomain: number;
  destinationDomain: number;
  nonce: bigint;
  sender: Uint8Array;
  recipient: Uint8Array;
  messageBody: Uint8Array;
}

export interface BurnMessage {
  version: number;
  burnToken: Uint8Array;
  mintRecipient: Uint8Array;
  amount: bigint;
}

export interface SubstrateBurnEvent {
  nonce: bigint;
  destinationDomain: number;
  amount: bigint;
  sender: Uint8Array;
  recipient: Uint8Array;
  blockNumber: number;
  blockHash: string;
  extrinsicHash: string;
  timestamp: number;
}

export interface EthereumBurnEvent {
  nonce: bigint;
  destinationDomain: number;
  amount: bigint;
  sender: string;
  recipient: Uint8Array;
  blockNumber: number;
  transactionHash: string;
  timestamp: number;
}

export interface Attestation {
  messageHash: string;
  message: Uint8Array;
  sourceDomain: number;
  destinationDomain: number;
  nonce: bigint;
  signatures: AttestationSignature[];
  createdAt: number;
  expiresAt: number;
  status: 'pending' | 'ready' | 'relayed' | 'expired';
}

export interface AttestationSignature {
  attesterId: number;
  attesterAddress: string;
  signature: string; // hex string
  signedAt: number;
}

export interface AttestationRequest {
  messageHash: string;
  sourceDomain: number;
  nonce: bigint;
}

export interface AttestationResponse {
  messageHash: string;
  message: string; // hex string
  signatures: string[]; // hex strings
  signatureCount: number;
  thresholdMet: boolean;
  status: string;
}

export enum Domain {
  Ethereum = 0,
  Solana = 1,
  Etrid = 2,
  Polygon = 3,
  BnbChain = 4,
  Avalanche = 5,
  Arbitrum = 6,
  Optimism = 7,
}

export interface MonitorStatus {
  isRunning: boolean;
  lastBlock: number;
  eventsProcessed: number;
  errors: number;
  lastError?: string;
  lastErrorTime?: number;
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  substrate: MonitorStatus;
  ethereum: MonitorStatus;
  pendingAttestations: number;
  readyAttestations: number;
}
