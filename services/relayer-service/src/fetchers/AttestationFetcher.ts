import axios, { AxiosInstance } from 'axios';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { Attestation, ReadyAttestationsResponse, RelayerConfig } from '../types';

/**
 * Fetches ready attestations from attestation service(s)
 * Polls multiple attestation service endpoints and emits new attestations
 */
export class AttestationFetcher extends EventEmitter {
  private isRunning = false;
  private pollInterval: NodeJS.Timeout | null = null;
  private httpClients: Map<string, AxiosInstance> = new Map();
  private seenAttestations: Set<string> = new Set();
  private totalFetched = 0;
  private errors = 0;
  private lastFetchTime?: number;
  private lastError?: string;

  constructor(private config: RelayerConfig) {
    super();

    // Create HTTP clients for each attestation service
    for (const url of config.attestationServiceUrls) {
      const client = axios.create({
        baseURL: url,
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      this.httpClients.set(url, client);
      logger.info('Created HTTP client for attestation service', { url });
    }
  }

  /**
   * Start polling attestation services
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('AttestationFetcher already running');
      return;
    }

    logger.info('Starting attestation fetcher...', {
      services: this.config.attestationServiceUrls,
      pollInterval: this.config.pollIntervalMs,
    });

    this.isRunning = true;

    // Do initial fetch
    await this.fetchAttestations();

    // Start polling
    this.pollInterval = setInterval(async () => {
      try {
        await this.fetchAttestations();
      } catch (error) {
        logger.error('Error in poll interval', error);
        this.handleError(error);
      }
    }, this.config.pollIntervalMs);

    this.emit('started');
    logger.info('Attestation fetcher started');
  }

  /**
   * Stop polling
   */
  async stop(): Promise<void> {
    logger.info('Stopping attestation fetcher...');

    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }

    this.isRunning = false;
    this.emit('stopped');

    logger.info('Attestation fetcher stopped');
  }

  /**
   * Fetch attestations from all services
   */
  private async fetchAttestations(): Promise<void> {
    const fetchPromises: Promise<void>[] = [];

    // Fetch from each service in parallel
    for (const [url, client] of this.httpClients.entries()) {
      fetchPromises.push(this.fetchFromService(url, client));
    }

    await Promise.allSettled(fetchPromises);

    this.lastFetchTime = Date.now();
  }

  /**
   * Fetch attestations from a single service
   */
  private async fetchFromService(
    serviceUrl: string,
    client: AxiosInstance
  ): Promise<void> {
    try {
      logger.debug('Fetching attestations from service', { serviceUrl });

      const response = await client.get<ReadyAttestationsResponse>(
        '/attestations/ready'
      );

      const { count, attestations } = response.data;

      logger.debug('Fetched attestations', {
        serviceUrl,
        count,
      });

      // Process each attestation
      for (const attestation of attestations) {
        await this.processAttestation(attestation, serviceUrl);
      }
    } catch (error: any) {
      logger.error('Failed to fetch from attestation service', {
        serviceUrl,
        error: error?.message,
      });
      this.handleError(error);
    }
  }

  /**
   * Process a single attestation
   */
  private async processAttestation(
    attestation: Attestation,
    serviceUrl: string
  ): Promise<void> {
    const { messageHash, thresholdMet, status } = attestation;

    // Skip if not ready
    if (status !== 'ready' && status !== 'relayed') {
      logger.debug('Skipping non-ready attestation', {
        messageHash,
        status,
      });
      return;
    }

    // Skip if threshold not met
    if (!thresholdMet) {
      logger.debug('Skipping attestation without threshold', {
        messageHash,
        signatureCount: attestation.signatureCount,
      });
      return;
    }

    // Skip if already seen
    if (this.seenAttestations.has(messageHash)) {
      logger.debug('Skipping already seen attestation', {
        messageHash,
      });
      return;
    }

    // Mark as seen
    this.seenAttestations.add(messageHash);
    this.totalFetched++;

    logger.info('New attestation ready for relay', {
      messageHash,
      signatureCount: attestation.signatureCount,
      serviceUrl,
    });

    // Emit event for relayer
    this.emit('newAttestation', attestation);
  }

  /**
   * Fetch a specific attestation by message hash
   */
  async fetchAttestationByHash(messageHash: string): Promise<Attestation | null> {
    // Try each service until we find it
    for (const [url, client] of this.httpClients.entries()) {
      try {
        logger.debug('Fetching attestation by hash', { messageHash, serviceUrl: url });

        const response = await client.get<Attestation>(
          `/attestation/${messageHash}`
        );

        logger.info('Found attestation by hash', {
          messageHash,
          serviceUrl: url,
          signatureCount: response.data.signatureCount,
        });

        return response.data;
      } catch (error: any) {
        // If 404, try next service
        if (error?.response?.status === 404) {
          continue;
        }

        logger.error('Error fetching attestation by hash', {
          messageHash,
          serviceUrl: url,
          error: error?.message,
        });
      }
    }

    logger.warn('Attestation not found in any service', { messageHash });
    return null;
  }

  /**
   * Fetch attestation by source domain and nonce
   */
  async fetchAttestationByNonce(
    sourceDomain: number,
    nonce: bigint
  ): Promise<Attestation | null> {
    // Try each service until we find it
    for (const [url, client] of this.httpClients.entries()) {
      try {
        logger.debug('Fetching attestation by nonce', {
          sourceDomain,
          nonce: nonce.toString(),
          serviceUrl: url,
        });

        const response = await client.get<Attestation>(
          `/attestation/${sourceDomain}/${nonce.toString()}`
        );

        logger.info('Found attestation by nonce', {
          sourceDomain,
          nonce: nonce.toString(),
          messageHash: response.data.messageHash,
          serviceUrl: url,
        });

        return response.data;
      } catch (error: any) {
        // If 404, try next service
        if (error?.response?.status === 404) {
          continue;
        }

        logger.error('Error fetching attestation by nonce', {
          sourceDomain,
          nonce: nonce.toString(),
          serviceUrl: url,
          error: error?.message,
        });
      }
    }

    logger.warn('Attestation not found in any service', {
      sourceDomain,
      nonce: nonce.toString(),
    });
    return null;
  }

  /**
   * Check health of attestation services
   */
  async checkHealth(): Promise<{ [url: string]: boolean }> {
    const health: { [url: string]: boolean } = {};

    for (const [url, client] of this.httpClients.entries()) {
      try {
        await client.get('/health', { timeout: 5000 });
        health[url] = true;
      } catch (error) {
        health[url] = false;
        logger.warn('Attestation service unhealthy', { url });
      }
    }

    return health;
  }

  /**
   * Handle errors
   */
  private handleError(error: any): void {
    this.errors++;
    this.lastError = error?.message || String(error);
    this.emit('error', error);
  }

  /**
   * Get status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      totalFetched: this.totalFetched,
      seenCount: this.seenAttestations.size,
      errors: this.errors,
      lastFetchTime: this.lastFetchTime,
      lastError: this.lastError,
      services: this.config.attestationServiceUrls,
    };
  }

  /**
   * Clear seen attestations (for cleanup)
   */
  clearSeen(maxAge: number = 86400000): number {
    // Default: 24 hours
    // Since we don't track timestamps for seen attestations,
    // we'll just clear all if too many accumulated
    const MAX_SEEN = 10000;

    if (this.seenAttestations.size > MAX_SEEN) {
      const cleared = this.seenAttestations.size;
      this.seenAttestations.clear();
      logger.info('Cleared seen attestations cache', { count: cleared });
      return cleared;
    }

    return 0;
  }
}
