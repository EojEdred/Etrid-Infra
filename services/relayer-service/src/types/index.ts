/**
 * Type definitions for EDSC relayer service
 */

/**
 * Relayer configuration
 */
export interface RelayerConfig {
  // Attestation service endpoints (can poll multiple services)
  attestationServiceUrls: string[];

  // Chain connections
  substrateWsUrl: string;
  ethereumRpcUrl: string;

  // Relayer identity
  relayerPrivateKey: string;
  relayerAddress: string;

  // Contract addresses
  messageTransmitterAddress?: string; // Ethereum contract
  tokenMessengerAddress?: string; // Ethereum contract

  // Polling settings
  pollIntervalMs: number;
  maxRetries: number;
  retryDelayMs: number;

  // Gas settings for Ethereum
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;

  // API server (optional status endpoint)
  enableApi: boolean;
  apiPort: number;
  metricsPort?: number; // Port for metrics server (defaults to apiPort)
}

/**
 * Attestation from attestation service
 */
export interface Attestation {
  messageHash: string;
  message: string; // Hex-encoded
  signatures: string[];
  signatureCount: number;
  thresholdMet: boolean;
  status: 'pending' | 'ready' | 'relayed' | 'expired';
}

/**
 * Response from attestation service /attestations/ready endpoint
 */
export interface ReadyAttestationsResponse {
  count: number;
  attestations: Attestation[];
}

/**
 * Relay status for tracking
 */
export interface RelayStatus {
  messageHash: string;
  sourceDomain: number;
  destinationDomain: number;
  nonce: bigint;
  status: 'pending' | 'relaying' | 'success' | 'failed';
  attempts: number;
  lastAttemptTime?: number;
  txHash?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * Relay result
 */
export interface RelayResult {
  success: boolean;
  messageHash: string;
  txHash?: string;
  error?: string;
  gasUsed?: bigint;
}

/**
 * Service health
 */
export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  totalRelays: number;
  successfulRelays: number;
  failedRelays: number;
  pendingRelays: number;
  lastRelayTime?: number;
  ethereumConnected: boolean;
  substrateConnected: boolean;
}

/**
 * Relay statistics
 */
export interface RelayStats {
  total: number;
  pending: number;
  relaying: number;
  success: number;
  failed: number;
  byDestination: {
    [domain: number]: {
      total: number;
      success: number;
      failed: number;
    };
  };
}
