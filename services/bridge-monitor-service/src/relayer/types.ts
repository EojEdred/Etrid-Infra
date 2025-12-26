/**
 * Multi-chain relayer type definitions
 * Supports routing attestations to all supported chains
 */

/**
 * Domain IDs for all supported chains
 */
export enum ChainDomain {
  Ethereum = 0,
  Solana = 1,
  Substrate = 2,  // Ëtrid
  Polygon = 3,
  BNB = 4,
  Avalanche = 5,
  Arbitrum = 6,
  Optimism = 7,
  Tron = 8,
}

/**
 * Chain type categories
 */
export enum ChainType {
  EVM = 'evm',           // Ethereum-compatible chains
  Solana = 'solana',     // Solana
  Substrate = 'substrate', // Substrate/Polkadot
  Tron = 'tron',         // Tron
}

/**
 * Chain configuration
 */
export interface ChainConfig {
  domain: number;
  name: string;
  type: ChainType;
  rpcUrl: string;
  wsUrl?: string;
  chainId?: number;
  messageTransmitterAddress?: string;
  tokenMessengerAddress?: string;
  confirmations?: number;
  gasConfig?: GasConfig;
  enabled: boolean;
}

/**
 * Gas configuration per chain
 */
export interface GasConfig {
  gasLimit?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  gasPrice?: string;
}

/**
 * Multi-chain relayer configuration
 */
export interface MultiChainRelayerConfig {
  // Attestation services
  attestationServiceUrls: string[];

  // Relayer identity
  relayerPrivateKey: string;
  relayerAddress: string;

  // Chain configurations
  chains: Map<number, ChainConfig>;

  // Signature threshold (M-of-N)
  signatureThreshold: number;
  totalAttestors: number;

  // Polling & retry settings
  pollIntervalMs: number;
  maxRetries: number;
  retryDelayMs: number;
  exponentialBackoff: boolean;

  // Monitoring
  metricsEnabled: boolean;
  metricsPort: number;

  // API
  enableApi: boolean;
  apiPort: number;
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
  sourceDomain?: number;
  destinationDomain?: number;
  nonce?: string;
}

/**
 * Decoded message structure
 */
export interface DecodedMessage {
  sourceDomain: number;
  destinationDomain: number;
  nonce: bigint;
  sender: string;
  recipient: string;
  amount?: bigint;
  payload?: string;
}

/**
 * Relay result
 */
export interface RelayResult {
  success: boolean;
  messageHash: string;
  chain: string;
  chainDomain: number;
  txHash?: string;
  error?: string;
  gasUsed?: bigint;
  blockNumber?: number;
  timestamp: number;
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
  nextRetryTime?: number;
  txHash?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
  relayResults?: RelayResult[];
}

/**
 * Chain relayer interface - all chain-specific relayers must implement this
 */
export interface IChainRelayer {
  readonly chainDomain: number;
  readonly chainName: string;
  readonly chainType: ChainType;

  /**
   * Connect to the chain
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the chain
   */
  disconnect(): Promise<void>;

  /**
   * Relay a message to the chain
   */
  relayMessage(attestation: Attestation): Promise<RelayResult>;

  /**
   * Check if a message has been received on the chain
   */
  isMessageReceived(messageHash: string): Promise<boolean>;

  /**
   * Check if a nonce has been used on the chain
   */
  isNonceUsed(sourceDomain: number, nonce: bigint): Promise<boolean>;

  /**
   * Get relayer balance on the chain
   */
  getBalance(): Promise<bigint>;

  /**
   * Get current block number
   */
  getCurrentBlock(): Promise<number>;

  /**
   * Estimate gas for a relay transaction
   */
  estimateGas(attestation: Attestation): Promise<bigint>;

  /**
   * Get relayer statistics
   */
  getStats(): ChainRelayerStats;

  /**
   * Check if relayer is connected
   */
  isConnected(): boolean;
}

/**
 * Chain relayer statistics
 */
export interface ChainRelayerStats {
  chainDomain: number;
  chainName: string;
  isConnected: boolean;
  relayerAddress?: string;
  currentBlock?: number;
  balance?: string;
  totalRelays: number;
  successfulRelays: number;
  failedRelays: number;
  lastRelayTime?: number;
}

/**
 * Overall relay statistics
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
      chainName: string;
    };
  };
}

/**
 * Metrics for Prometheus
 */
export interface RelayMetrics {
  relaysTotal: number;
  relaysSuccessTotal: number;
  relaysFailedTotal: number;
  relayDurationSeconds: number[];
  relayGasUsed: number[];
  relayerBalances: { [chain: string]: number };
  attestationsReady: number;
  chainsConnected: number;
}

/**
 * Service health status
 */
export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  totalRelays: number;
  successfulRelays: number;
  failedRelays: number;
  pendingRelays: number;
  lastRelayTime?: number;
  chains: {
    [domain: number]: {
      name: string;
      connected: boolean;
      currentBlock?: number;
      balance?: string;
    };
  };
  attestationServices: {
    [url: string]: boolean;
  };
}

/**
 * API request/response types
 */
export interface RelayStatusRequest {
  messageHash?: string;
  sourceDomain?: number;
  nonce?: string;
}

export interface RelayStatusResponse {
  found: boolean;
  relay?: RelayStatus;
}

export interface RelayStatsResponse {
  stats: RelayStats;
  chainStats: ChainRelayerStats[];
}

export interface HealthResponse extends ServiceHealth {}

export interface MetricsResponse {
  metrics: RelayMetrics;
}
