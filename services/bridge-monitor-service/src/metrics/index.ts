/**
 * Prometheus Metrics for Bridge Monitor Service
 *
 * Exposes metrics for monitoring Bitcoin/Ethereum bridge operations
 */

import { Registry, Counter, Gauge, Histogram, collectDefaultMetrics } from 'prom-client';

// Create a Registry which registers the metrics
export const register = new Registry();

// Add default metrics (CPU, memory, etc.)
collectDefaultMetrics({
  register,
  prefix: 'bridge_monitor_',
});

// Service health
export const serviceUp = new Gauge({
  name: 'bridge_monitor_service_up',
  help: 'Service is running (1 = up, 0 = down)',
  registers: [register],
});

// Initialize as up
serviceUp.set(1);

// Deposits detected
export const depositsSeen = new Counter({
  name: 'bridge_monitor_deposits_seen_total',
  help: 'Total deposits detected from chains',
  labelNames: ['chain'],
  registers: [register],
});

// Deposits confirmed (threshold met)
export const depositsConfirmed = new Counter({
  name: 'bridge_monitor_deposits_confirmed_total',
  help: 'Total deposits confirmed (confirmations threshold met)',
  labelNames: ['chain'],
  registers: [register],
});

// Chain connectivity
export const bitcoinConnected = new Gauge({
  name: 'bridge_monitor_bitcoin_connected',
  help: 'Connected to Bitcoin API (1 = connected, 0 = disconnected)',
  registers: [register],
});

export const ethereumConnected = new Gauge({
  name: 'bridge_monitor_ethereum_connected',
  help: 'Connected to Ethereum RPC (1 = connected, 0 = disconnected)',
  registers: [register],
});

export const substrateConnected = new Gauge({
  name: 'bridge_monitor_substrate_connected',
  help: 'Connected to Substrate RPC (1 = connected, 0 = disconnected)',
  registers: [register],
});

export const solanaConnected = new Gauge({
  name: 'bridge_monitor_solana_connected',
  help: 'Connected to Solana RPC (1 = connected, 0 = disconnected)',
  registers: [register],
});

export const tronConnected = new Gauge({
  name: 'bridge_monitor_tron_connected',
  help: 'Connected to TRON RPC (1 = connected, 0 = disconnected)',
  registers: [register],
});

export const xrpConnected = new Gauge({
  name: 'bridge_monitor_xrp_connected',
  help: 'Connected to XRP Ledger (1 = connected, 0 = disconnected)',
  registers: [register],
});

export const cardanoConnected = new Gauge({
  name: 'bridge_monitor_cardano_connected',
  help: 'Connected to Cardano (1 = connected, 0 = disconnected)',
  registers: [register],
});

export const stellarConnected = new Gauge({
  name: 'bridge_monitor_stellar_connected',
  help: 'Connected to Stellar Horizon (1 = connected, 0 = disconnected)',
  registers: [register],
});

// Generic EVM chain metrics
export const evmConnected = new Gauge({
  name: 'bridge_monitor_evm_connected',
  help: 'Connected to EVM RPC (1 = connected, 0 = disconnected)',
  labelNames: ['chain'],
  registers: [register],
});

export const evmBlockHeight = new Gauge({
  name: 'bridge_monitor_evm_block_height',
  help: 'Latest EVM block height processed',
  labelNames: ['chain'],
  registers: [register],
});

export const evmLastBlockTimestamp = new Gauge({
  name: 'bridge_monitor_evm_last_block_timestamp',
  help: 'Timestamp of last EVM block processed',
  labelNames: ['chain'],
  registers: [register],
});

export const evmMessagesSeen = new Counter({
  name: 'bridge_monitor_evm_messages_seen_total',
  help: 'Total messages/events detected from EVM chains',
  labelNames: ['chain', 'source_domain', 'token_type'],
  registers: [register],
});

export const evmErrors = new Counter({
  name: 'bridge_monitor_evm_errors_total',
  help: 'Total errors from EVM monitors',
  labelNames: ['chain', 'error_type'],
  registers: [register],
});

// Chain block heights
export const bitcoinBlockHeight = new Gauge({
  name: 'bridge_monitor_bitcoin_block_height',
  help: 'Latest Bitcoin block height processed',
  registers: [register],
});

export const ethereumBlockHeight = new Gauge({
  name: 'bridge_monitor_ethereum_block_height',
  help: 'Latest Ethereum block height processed',
  registers: [register],
});

export const solanaSlotHeight = new Gauge({
  name: 'bridge_monitor_solana_slot_height',
  help: 'Latest Solana slot height processed',
  registers: [register],
});

export const tronBlockHeight = new Gauge({
  name: 'bridge_monitor_tron_block_height',
  help: 'Latest TRON block height processed',
  registers: [register],
});

export const xrpLedgerIndex = new Gauge({
  name: 'bridge_monitor_xrp_ledger_index',
  help: 'Latest XRP ledger index processed',
  registers: [register],
});

export const cardanoBlockHeight = new Gauge({
  name: 'bridge_monitor_cardano_block_height',
  help: 'Latest Cardano block height processed',
  registers: [register],
});

export const stellarLedgerSequence = new Gauge({
  name: 'bridge_monitor_stellar_ledger_sequence',
  help: 'Latest Stellar ledger sequence processed',
  registers: [register],
});

// Last block timestamp
export const lastBlockTimestamp = new Gauge({
  name: 'bridge_monitor_last_block_timestamp',
  help: 'Timestamp of last block processed',
  labelNames: ['chain'],
  registers: [register],
});

// Pending deposits (waiting for confirmations)
export const pendingDeposits = new Gauge({
  name: 'bridge_monitor_pending_deposits',
  help: 'Number of deposits waiting for confirmations',
  labelNames: ['chain'],
  registers: [register],
});

// Extrinsic submissions
export const extrinsicsSubmitted = new Counter({
  name: 'bridge_monitor_extrinsics_submitted_total',
  help: 'Total extrinsics submitted to ETRID',
  labelNames: ['type'],
  registers: [register],
});

export const extrinsicsFinalized = new Counter({
  name: 'bridge_monitor_extrinsics_finalized_total',
  help: 'Total extrinsics finalized on ETRID',
  labelNames: ['type'],
  registers: [register],
});

export const extrinsicsFailed = new Counter({
  name: 'bridge_monitor_extrinsics_failed_total',
  help: 'Total extrinsics that failed',
  labelNames: ['type', 'reason'],
  registers: [register],
});

// API request metrics
export const apiRequests = new Counter({
  name: 'bridge_monitor_api_requests_total',
  help: 'Total API requests received',
  labelNames: ['endpoint', 'method', 'status'],
  registers: [register],
});

export const apiRequestDuration = new Histogram({
  name: 'bridge_monitor_api_request_duration_seconds',
  help: 'API request duration in seconds',
  labelNames: ['endpoint', 'method'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// Deposit processing duration
export const depositProcessingDuration = new Histogram({
  name: 'bridge_monitor_deposit_processing_duration_seconds',
  help: 'Time to process a deposit from detection to submission',
  labelNames: ['chain'],
  buckets: [1, 5, 10, 30, 60, 120, 300],
  registers: [register],
});

// Errors
export const errors = new Counter({
  name: 'bridge_monitor_errors_total',
  help: 'Total errors encountered',
  labelNames: ['type', 'source'],
  registers: [register],
});

// Confirmation tracking
export const depositConfirmations = new Histogram({
  name: 'bridge_monitor_deposit_confirmations',
  help: 'Distribution of deposit confirmations when processed',
  labelNames: ['chain'],
  buckets: [1, 3, 6, 12, 24, 50, 100],
  registers: [register],
});

// Deposit amounts (in satoshis for BTC, wei for ETH)
export const depositAmounts = new Histogram({
  name: 'bridge_monitor_deposit_amounts',
  help: 'Distribution of deposit amounts',
  labelNames: ['chain'],
  buckets: [
    100000, // 0.001 BTC
    1000000, // 0.01 BTC
    10000000, // 0.1 BTC
    50000000, // 0.5 BTC
    100000000, // 1 BTC
    500000000, // 5 BTC
    1000000000, // 10 BTC
  ],
  registers: [register],
});

/**
 * Record an API request
 */
export function recordApiRequest(
  endpoint: string,
  method: string,
  status: number,
  duration: number
): void {
  apiRequests.inc({ endpoint, method, status: status.toString() });
  apiRequestDuration.observe({ endpoint, method }, duration);
}

/**
 * Record an error
 */
export function recordError(type: string, source: string): void {
  errors.inc({ type, source });
}

/**
 * Record deposit detected
 */
export function recordDepositDetected(chain: string, amountSatoshi: number): void {
  depositsSeen.inc({ chain });
  depositAmounts.observe({ chain }, amountSatoshi);
}

/**
 * Record message seen (for non-deposit events like burns)
 */
export const messagesSeen = new Counter({
  name: 'bridge_monitor_messages_seen_total',
  help: 'Total messages/events detected from chains',
  labelNames: ['source_domain', 'chain'],
  registers: [register],
});

/**
 * Record deposit confirmed
 */
export function recordDepositConfirmed(chain: string, confirmations: number): void {
  depositsConfirmed.inc({ chain });
  depositConfirmations.observe({ chain }, confirmations);
}

/**
 * Record extrinsic submission
 */
export function recordExtrinsicSubmitted(type: string): void {
  extrinsicsSubmitted.inc({ type });
}

/**
 * Record extrinsic finalized
 */
export function recordExtrinsicFinalized(type: string): void {
  extrinsicsFinalized.inc({ type });
}

/**
 * Record extrinsic failed
 */
export function recordExtrinsicFailed(type: string, reason: string): void {
  extrinsicsFailed.inc({ type, reason });
}

/**
 * Update pending deposits count
 */
export function updatePendingDeposits(chain: string, count: number): void {
  pendingDeposits.set({ chain }, count);
}

/**
 * Get metrics as string (for /metrics endpoint)
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Reset all metrics (useful for testing)
 */
export function resetMetrics(): void {
  register.resetMetrics();
}
