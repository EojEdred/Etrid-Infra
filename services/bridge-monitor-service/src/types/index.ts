/**
 * Type definitions for Bridge Monitor Service
 */

export interface BridgeMonitorConfig {
  // Service configuration
  port: number;
  metricsPort: number;
  logLevel: string;
  redisUrl?: string;

  // Monitoring settings
  monitorEthereum: boolean;
  monitorSolana: boolean;
  monitorBitcoin: boolean;
  monitorTron: boolean;
  monitorXrp: boolean;
  monitorBsc: boolean;
  monitorPolygon: boolean;
  monitorSubstrate: boolean;

  // Alert settings
  alertStuckTransferHours: number;
  alertLowBalanceThreshold: bigint;
  eventRetentionHours: number;
  healthCheckInterval: number;

  // Notification settings
  alertWebhookUrl?: string;
  slackWebhookUrl?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  alertEmailTo?: string;
}

// Chain-specific configurations
export interface SubstrateConfig {
  wsUrl: string;
  chainId: number;
  pollInterval: number;
  confirmations: number;
}

export interface EthereumConfig {
  rpcUrl: string;
  wsUrl?: string;
  chainId: number;
  confirmations: number;
  bridgeAddress?: string;
  messageTransmitter?: string;
  tokenMessenger?: string;
  etrTokenAddress?: string;
  edscTokenAddress?: string;
}

export interface SolanaConfig {
  rpcUrl: string;
  wsUrl?: string;
  cluster: string;
  commitment: string;
  bridgeProgram?: string;
  etrMint?: string;
  edscMint?: string;
}

/**
 * Bridge configuration for multi-chain monitoring
 */
export interface BridgeConfig {
  // Solana configuration
  solanaRpcUrl: string;
  solanaWsUrl?: string;
  solanaBridgeProgramId: string;

  // Ethereum configuration
  ethereumRpcUrl: string;
  ethereumChainId: number;

  // Substrate/ËTRID configuration
  substrateWsUrl: string;
  substrateChainId: number;

  // Service configuration
  port: number;
  redisUrl?: string;
  logLevel: string;

  // Relayer configuration
  relayerPrivateKey: string;
  relayerAddress: string;

  // Thresholds
  confirmationsRequired: number;
  minConfirmations: number;
}

/**
 * Solana deposit event from bridge program
 */
export interface SolanaDepositEvent {
  type: 'deposit';
  etridRecipient: string; // Hex-encoded AccountId32 (64 hex chars)
  solPubkey: { toBase58(): string }; // PublicKey
  amount: bigint;
  tokenMint?: { toBase58(): string }; // undefined for SOL, PublicKey for SPL tokens
  slot: number;
  confirmations: number;
  timestamp: number;
}

/**
 * Solana token burn event (for wrapped ETR on Solana)
 */
export interface SolanaTokenBurnEvent {
  type: 'burn';
  etridRecipient: string; // Hex-encoded AccountId32
  amount: bigint;
  tokenMint: { toBase58(): string }; // Wrapped ETR token mint
  slot: number;
  confirmations: number;
  timestamp: number;
}

export interface BitcoinConfig {
  rpcUrl: string;
  network: string;
  bridgeAddress?: string;
  confirmations: number;
  pollInterval: number;
}

export interface BitcoinMonitorConfig {
  // Bitcoin network (mainnet or testnet)
  network: 'mainnet' | 'testnet';

  // API URL for blockchain data (Blockstream, Electrum, etc.)
  apiUrl?: string;

  // Bridge address to monitor
  bridgeAddress: string;

  // Minimum confirmations required (default: 6)
  minConfirmations?: number;

  // Polling interval in milliseconds (default: 60000)
  pollingInterval?: number;
}

/**
 * Bitcoin deposit event
 */
export interface BitcoinDepositEvent {
  // Bitcoin transaction ID
  txid: string;

  // Output index
  vout: number;

  // Amount in satoshis
  amountSatoshi: number;

  // ETRID recipient address (extracted from OP_RETURN)
  etridRecipient: string;

  // Number of confirmations
  confirmations: number;

  // Bitcoin block height
  blockHeight: number;

  // Timestamp when event was detected
  timestamp: number;
}

export interface TronConfig {
  fullNode: string;
  solidityNode: string;
  eventServer: string;
  apiKey?: string;
  bridgeAddress?: string;
  etrAddress?: string;
  edscAddress?: string;
  confirmations: number;
}

export interface XrpConfig {
  server: string;
  network: string;
  bridgeAddress?: string;
  ledgerOffset: number;
}

export interface BscConfig {
  rpcUrl: string;
  wsUrl?: string;
  chainId: number;
  confirmations: number;
  bridgeAddress?: string;
  etrTokenAddress?: string;
  edscTokenAddress?: string;
}

export interface PolygonConfig {
  rpcUrl: string;
  wsUrl?: string;
  chainId: number;
  confirmations: number;
  bridgeAddress?: string;
  etrTokenAddress?: string;
  edscTokenAddress?: string;
}

// Event types
export enum BridgeEventType {
  Deposit = 'deposit',
  Withdrawal = 'withdrawal',
  Lock = 'lock',
  Unlock = 'unlock',
  Burn = 'burn',
  Mint = 'mint',
  MessageSent = 'message_sent',
  MessageReceived = 'message_received',
}

export enum ChainType {
  Ethereum = 'ethereum',
  Solana = 'solana',
  Bitcoin = 'bitcoin',
  Tron = 'tron',
  Xrp = 'xrp',
  Bsc = 'bsc',
  Polygon = 'polygon',
  Substrate = 'substrate',
}

export enum TokenType {
  ETR = 'ETR',
  EDSC = 'EDSC',
  Native = 'NATIVE',
  Other = 'OTHER',
}

export interface BaseBridgeEvent {
  eventType: BridgeEventType;
  chain: ChainType;
  token: TokenType;
  amount: bigint;
  sender: string;
  recipient: string;
  blockNumber: number;
  blockHash?: string;
  transactionHash: string;
  timestamp: number;
  confirmed: boolean;
}

export interface EthereumBridgeEvent extends BaseBridgeEvent {
  chain: ChainType.Ethereum | ChainType.Bsc | ChainType.Polygon;
  destinationDomain?: number;
  nonce?: bigint;
  logIndex: number;
  contractAddress: string;
}

export interface SolanaBridgeEvent extends BaseBridgeEvent {
  chain: ChainType.Solana;
  slot: number;
  signature: string;
  programId: string;
}

export interface BitcoinBridgeEvent extends BaseBridgeEvent {
  chain: ChainType.Bitcoin;
  txid: string;
  vout: number;
  scriptPubKey: string;
}

export interface TronBridgeEvent extends BaseBridgeEvent {
  chain: ChainType.Tron;
  contractAddress: string;
  eventName: string;
  resourceConsumed: {
    energy: number;
    bandwidth: number;
  };
}

export interface XrpBridgeEvent extends BaseBridgeEvent {
  chain: ChainType.Xrp;
  ledgerIndex: number;
  destinationTag?: number;
  memos?: Array<{ data: string }>;
}

export interface SubstrateBridgeEvent extends BaseBridgeEvent {
  chain: ChainType.Substrate;
  extrinsicHash: string;
  palletName: string;
  eventName: string;
  eventIndex: number;
}

export type BridgeEvent =
  | EthereumBridgeEvent
  | SolanaBridgeEvent
  | BitcoinBridgeEvent
  | TronBridgeEvent
  | XrpBridgeEvent
  | SubstrateBridgeEvent;

// Transfer tracking
export interface BridgeTransfer {
  id: string;
  sourceChain: ChainType;
  destinationChain: ChainType;
  token: TokenType;
  amount: bigint;
  sender: string;
  recipient: string;
  sourceEvent: BridgeEvent;
  destinationEvent?: BridgeEvent;
  status: TransferStatus;
  createdAt: number;
  updatedAt: number;
  confirmations: number;
  estimatedCompletionTime?: number;
}

export enum TransferStatus {
  Initiated = 'initiated',
  SourceConfirmed = 'source_confirmed',
  Attested = 'attested',
  DestinationPending = 'destination_pending',
  Completed = 'completed',
  Failed = 'failed',
  Stuck = 'stuck',
}

// Monitor status
export interface MonitorStatus {
  isRunning: boolean;
  chain: ChainType;
  lastBlock: number;
  lastBlockTime: number;
  eventsProcessed: number;
  transfersDetected: number;
  errors: number;
  lastError?: string;
  lastErrorTime?: number;
  syncStatus: SyncStatus;
}

export enum SyncStatus {
  Syncing = 'syncing',
  Synced = 'synced',
  Lagging = 'lagging',
  Error = 'error',
}

// Service health
export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  monitors: Record<ChainType, MonitorStatus>;
  totalTransfers: number;
  activeTransfers: number;
  completedTransfers: number;
  stuckTransfers: number;
  failedTransfers: number;
}

// Alerts
export interface Alert {
  id: string;
  severity: AlertSeverity;
  type: AlertType;
  chain?: ChainType;
  message: string;
  details: any;
  timestamp: number;
  acknowledged: boolean;
}

export enum AlertSeverity {
  Info = 'info',
  Warning = 'warning',
  Error = 'error',
  Critical = 'critical',
}

export enum AlertType {
  StuckTransfer = 'stuck_transfer',
  FailedTransfer = 'failed_transfer',
  LowBalance = 'low_balance',
  MonitorError = 'monitor_error',
  ChainDisconnected = 'chain_disconnected',
  HighLatency = 'high_latency',
  UnexpectedEvent = 'unexpected_event',
}

// Statistics
export interface BridgeStatistics {
  totalVolume: Record<TokenType, bigint>;
  dailyVolume: Record<TokenType, bigint>;
  weeklyVolume: Record<TokenType, bigint>;
  monthlyVolume: Record<TokenType, bigint>;
  transfersByChain: Record<ChainType, number>;
  averageTransferTime: Record<string, number>; // chain pair -> seconds
  successRate: number;
}

// API responses
export interface TransfersResponse {
  transfers: BridgeTransfer[];
  total: number;
  page: number;
  pageSize: number;
}

export interface EventsResponse {
  events: BridgeEvent[];
  total: number;
  page: number;
  pageSize: number;
}
