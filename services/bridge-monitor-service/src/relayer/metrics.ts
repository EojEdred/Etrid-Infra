import { Counter, Gauge, Histogram, Registry } from 'prom-client';

/**
 * Prometheus metrics for multi-chain relayer
 */
export class RelayerMetrics {
  private registry: Registry;

  // Counters
  private attestationsProcessedTotal: Counter;
  private relaysAttemptedTotal: Counter;
  private relaysSuccessTotal: Counter;
  private relaysFailedTotal: Counter;

  // Gauges
  private chainsConnected: Gauge;
  private relaysPending: Gauge;
  private relaysRelaying: Gauge;
  private relayerBalances: Gauge;

  // Histograms
  private relayDuration: Histogram;
  private relayGasUsed: Histogram;

  constructor() {
    this.registry = new Registry();

    // Initialize counters
    this.attestationsProcessedTotal = new Counter({
      name: 'relayer_attestations_processed_total',
      help: 'Total number of attestations processed',
      registers: [this.registry],
    });

    this.relaysAttemptedTotal = new Counter({
      name: 'relayer_relays_attempted_total',
      help: 'Total number of relay attempts',
      labelNames: ['chain', 'domain'],
      registers: [this.registry],
    });

    this.relaysSuccessTotal = new Counter({
      name: 'relayer_relays_success_total',
      help: 'Total number of successful relays',
      labelNames: ['chain', 'domain'],
      registers: [this.registry],
    });

    this.relaysFailedTotal = new Counter({
      name: 'relayer_relays_failed_total',
      help: 'Total number of failed relays',
      labelNames: ['chain', 'domain', 'error'],
      registers: [this.registry],
    });

    // Initialize gauges
    this.chainsConnected = new Gauge({
      name: 'relayer_chains_connected',
      help: 'Number of chains currently connected',
      registers: [this.registry],
    });

    this.relaysPending = new Gauge({
      name: 'relayer_relays_pending',
      help: 'Number of pending relays',
      labelNames: ['chain', 'domain'],
      registers: [this.registry],
    });

    this.relaysRelaying = new Gauge({
      name: 'relayer_relays_relaying',
      help: 'Number of relays currently in progress',
      labelNames: ['chain', 'domain'],
      registers: [this.registry],
    });

    this.relayerBalances = new Gauge({
      name: 'relayer_balance',
      help: 'Relayer balance on each chain',
      labelNames: ['chain', 'domain', 'unit'],
      registers: [this.registry],
    });

    // Initialize histograms
    this.relayDuration = new Histogram({
      name: 'relayer_relay_duration_seconds',
      help: 'Duration of relay operations in seconds',
      labelNames: ['chain', 'domain', 'success'],
      buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
      registers: [this.registry],
    });

    this.relayGasUsed = new Histogram({
      name: 'relayer_relay_gas_used',
      help: 'Gas used for relay transactions',
      labelNames: ['chain', 'domain'],
      buckets: [50000, 100000, 200000, 500000, 1000000, 2000000, 5000000],
      registers: [this.registry],
    });

    // Set default metric values
    this.chainsConnected.set(0);
  }

  /**
   * Record attestation processed
   */
  recordAttestationProcessed(): void {
    this.attestationsProcessedTotal.inc();
  }

  /**
   * Record relay attempted
   */
  recordRelayAttempted(chain: string, domain: number): void {
    this.relaysAttemptedTotal.labels(chain, domain.toString()).inc();
  }

  /**
   * Record successful relay
   */
  recordRelaySuccess(
    chain: string,
    domain: number,
    durationSeconds: number,
    gasUsed?: bigint
  ): void {
    this.relaysSuccessTotal.labels(chain, domain.toString()).inc();
    this.relayDuration.labels(chain, domain.toString(), 'true').observe(durationSeconds);

    if (gasUsed !== undefined) {
      this.relayGasUsed.labels(chain, domain.toString()).observe(Number(gasUsed));
    }
  }

  /**
   * Record failed relay
   */
  recordRelayFailed(
    chain: string,
    domain: number,
    error: string,
    durationSeconds: number
  ): void {
    // Sanitize error message for label
    const sanitizedError = error.substring(0, 50).replace(/[^a-zA-Z0-9_]/g, '_');

    this.relaysFailedTotal.labels(chain, domain.toString(), sanitizedError).inc();
    this.relayDuration.labels(chain, domain.toString(), 'false').observe(durationSeconds);
  }

  /**
   * Update chains connected
   */
  updateChainsConnected(count: number): void {
    this.chainsConnected.set(count);
  }

  /**
   * Update pending relays
   */
  updatePendingRelays(chain: string, domain: number, count: number): void {
    this.relaysPending.labels(chain, domain.toString()).set(count);
  }

  /**
   * Update relaying count
   */
  updateRelayingCount(chain: string, domain: number, count: number): void {
    this.relaysRelaying.labels(chain, domain.toString()).set(count);
  }

  /**
   * Update relayer balance
   */
  updateRelayerBalance(chain: string, domain: number, balance: number, unit: string): void {
    this.relayerBalances.labels(chain, domain.toString(), unit).set(balance);
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Get registry
   */
  getRegistry(): Registry {
    return this.registry;
  }

  /**
   * Reset all metrics (for testing)
   */
  reset(): void {
    this.registry.resetMetrics();
  }
}

// Export singleton instance
export const relayerMetrics = new RelayerMetrics();
