/**
 * Prometheus Metrics for Attestation Service
 *
 * Exposes metrics for monitoring service health, performance, and operations.
 */

import { Registry, Counter, Gauge, Histogram, collectDefaultMetrics } from 'prom-client';

// Create a Registry which registers the metrics
export const register = new Registry();

// Add default metrics (CPU, memory, etc.)
collectDefaultMetrics({
  register,
  prefix: 'attestation_',
});

// Service health
export const serviceUp = new Gauge({
  name: 'attestation_service_up',
  help: 'Service is running (1 = up, 0 = down)',
  registers: [register],
});

// Initialize as up
serviceUp.set(1);

// Messages detected
export const messagesSeen = new Counter({
  name: 'attestation_messages_seen_total',
  help: 'Total messages detected from chains',
  labelNames: ['source_domain', 'chain'],
  registers: [register],
});

// Signatures created
export const signaturesCreated = new Counter({
  name: 'attestation_signatures_created_total',
  help: 'Total signatures created by this attester',
  registers: [register],
});

// Threshold reached (attestations ready to relay)
export const thresholdReached = new Counter({
  name: 'attestation_threshold_reached_total',
  help: 'Total attestations that reached threshold',
  registers: [register],
});

// Chain connectivity
export const ethereumConnected = new Gauge({
  name: 'attestation_ethereum_connected',
  help: 'Connected to Ethereum RPC (1 = connected, 0 = disconnected)',
  registers: [register],
});

export const substrateConnected = new Gauge({
  name: 'attestation_substrate_connected',
  help: 'Connected to Substrate RPC (1 = connected, 0 = disconnected)',
  registers: [register],
});

// Chain block heights
export const ethereumBlockHeight = new Gauge({
  name: 'attestation_ethereum_block_height',
  help: 'Latest Ethereum block height processed',
  registers: [register],
});

export const substrateBlockHeight = new Gauge({
  name: 'attestation_substrate_block_height',
  help: 'Latest Substrate block height processed',
  registers: [register],
});

// Last block timestamp
export const lastBlockTimestamp = new Gauge({
  name: 'attestation_last_block_timestamp',
  help: 'Timestamp of last block processed',
  labelNames: ['chain'],
  registers: [register],
});

// Last signature timestamp
export const lastSignatureTimestamp = new Gauge({
  name: 'attestation_last_signature_timestamp',
  help: 'Timestamp of last signature created',
  registers: [register],
});

// Ready messages (waiting to be relayed)
export const readyMessages = new Gauge({
  name: 'attestation_ready_messages',
  help: 'Number of messages ready to relay (threshold met)',
  registers: [register],
});

// API request metrics
export const apiRequests = new Counter({
  name: 'attestation_api_requests_total',
  help: 'Total API requests received',
  labelNames: ['endpoint', 'method', 'status'],
  registers: [register],
});

export const apiRequestDuration = new Histogram({
  name: 'attestation_api_request_duration_seconds',
  help: 'API request duration in seconds',
  labelNames: ['endpoint', 'method'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});

// Signature verification
export const signatureVerificationFailures = new Counter({
  name: 'attestation_signature_verification_failures_total',
  help: 'Total signature verification failures',
  labelNames: ['reason'],
  registers: [register],
});

// Attestation store metrics
export const attestationsInStore = new Gauge({
  name: 'attestation_store_size',
  help: 'Number of attestations currently in store',
  registers: [register],
});

export const attestationsByStatus = new Gauge({
  name: 'attestation_store_by_status',
  help: 'Number of attestations by status',
  labelNames: ['status'],
  registers: [register],
});

// Message processing duration
export const messageProcessingDuration = new Histogram({
  name: 'attestation_message_processing_duration_seconds',
  help: 'Time to process and sign a message',
  labelNames: ['chain'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

// Errors
export const errors = new Counter({
  name: 'attestation_errors_total',
  help: 'Total errors encountered',
  labelNames: ['type', 'source'],
  registers: [register],
});

/**
 * Update store metrics from AttestationStore
 */
export function updateStoreMetrics(
  totalCount: number,
  statusCounts: { pending: number; ready: number; relayed: number; expired: number }
): void {
  attestationsInStore.set(totalCount);
  attestationsByStatus.set({ status: 'pending' }, statusCounts.pending);
  attestationsByStatus.set({ status: 'ready' }, statusCounts.ready);
  attestationsByStatus.set({ status: 'relayed' }, statusCounts.relayed);
  attestationsByStatus.set({ status: 'expired' }, statusCounts.expired);
  readyMessages.set(statusCounts.ready);
}

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
