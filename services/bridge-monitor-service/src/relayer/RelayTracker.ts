import { RelayStatus, RelayResult, RelayStats } from './types';

/**
 * Tracks relay status to avoid duplicate relays and provide statistics
 * Implements exponential backoff for retries
 */
export class RelayTracker {
  private relays: Map<string, RelayStatus> = new Map();
  private maxRetries: number;
  private retryDelayMs: number;
  private exponentialBackoff: boolean;

  constructor(
    maxRetries: number = 3,
    retryDelayMs: number = 60000,
    exponentialBackoff: boolean = true
  ) {
    this.maxRetries = maxRetries;
    this.retryDelayMs = retryDelayMs;
    this.exponentialBackoff = exponentialBackoff;
  }

  /**
   * Check if a message has already been relayed successfully
   */
  isRelayed(messageHash: string): boolean {
    const relay = this.relays.get(messageHash);
    return relay?.status === 'success';
  }

  /**
   * Check if a message is currently being relayed
   */
  isRelaying(messageHash: string): boolean {
    const relay = this.relays.get(messageHash);
    return relay?.status === 'relaying';
  }

  /**
   * Check if a message can be retried
   */
  canRetry(messageHash: string): boolean {
    const relay = this.relays.get(messageHash);

    if (!relay) {
      return true; // Not tracked yet, can try
    }

    if (relay.status === 'success') {
      return false; // Already successful
    }

    if (relay.status === 'relaying') {
      return false; // Currently in progress
    }

    if (relay.attempts >= this.maxRetries) {
      return false; // Max retries exceeded
    }

    // Check if enough time has passed since last attempt
    if (relay.lastAttemptTime && relay.nextRetryTime) {
      const now = Date.now();
      if (now < relay.nextRetryTime) {
        return false; // Too soon to retry
      }
    }

    return true;
  }

  /**
   * Create or update relay status
   */
  createRelay(
    messageHash: string,
    sourceDomain: number,
    destinationDomain: number,
    nonce: bigint
  ): RelayStatus {
    const now = Date.now();
    const existing = this.relays.get(messageHash);

    if (existing) {
      // Update existing
      existing.status = 'relaying';
      existing.attempts++;
      existing.lastAttemptTime = now;

      // Calculate next retry time with exponential backoff
      existing.nextRetryTime = this.calculateNextRetryTime(existing.attempts);

      existing.updatedAt = now;
      this.relays.set(messageHash, existing);

      console.log('[RelayTracker] Updated relay status', {
        messageHash,
        attempts: existing.attempts,
        status: 'relaying',
        nextRetryTime: new Date(existing.nextRetryTime).toISOString(),
      });

      return existing;
    } else {
      // Create new
      const relay: RelayStatus = {
        messageHash,
        sourceDomain,
        destinationDomain,
        nonce,
        status: 'relaying',
        attempts: 1,
        lastAttemptTime: now,
        nextRetryTime: this.calculateNextRetryTime(1),
        createdAt: now,
        updatedAt: now,
        relayResults: [],
      };

      this.relays.set(messageHash, relay);

      console.log('[RelayTracker] Created relay status', {
        messageHash,
        sourceDomain,
        destinationDomain,
        nonce: nonce.toString(),
      });

      return relay;
    }
  }

  /**
   * Mark relay as successful
   */
  markSuccess(messageHash: string, result: RelayResult): void {
    const relay = this.relays.get(messageHash);

    if (!relay) {
      console.warn('[RelayTracker] Relay not found for success marking', { messageHash });
      return;
    }

    relay.status = 'success';
    relay.txHash = result.txHash;
    relay.updatedAt = Date.now();
    relay.error = undefined;

    // Add result to history
    if (!relay.relayResults) {
      relay.relayResults = [];
    }
    relay.relayResults.push(result);

    this.relays.set(messageHash, relay);

    console.log('[RelayTracker] Marked relay as successful', {
      messageHash,
      txHash: result.txHash,
      chain: result.chain,
      attempts: relay.attempts,
    });
  }

  /**
   * Mark relay as failed
   */
  markFailed(messageHash: string, result: RelayResult): void {
    const relay = this.relays.get(messageHash);

    if (!relay) {
      console.warn('[RelayTracker] Relay not found for failure marking', { messageHash });
      return;
    }

    relay.status = 'failed';
    relay.error = result.error;
    relay.updatedAt = Date.now();

    // Add result to history
    if (!relay.relayResults) {
      relay.relayResults = [];
    }
    relay.relayResults.push(result);

    // Calculate next retry time if retries remaining
    if (relay.attempts < this.maxRetries) {
      relay.nextRetryTime = this.calculateNextRetryTime(relay.attempts);
      relay.status = 'pending'; // Set to pending for retry
    }

    this.relays.set(messageHash, relay);

    console.warn('[RelayTracker] Marked relay as failed', {
      messageHash,
      error: result.error,
      attempts: relay.attempts,
      canRetry: relay.attempts < this.maxRetries,
      nextRetryTime: relay.nextRetryTime
        ? new Date(relay.nextRetryTime).toISOString()
        : 'N/A',
    });
  }

  /**
   * Get relay status
   */
  getRelay(messageHash: string): RelayStatus | undefined {
    return this.relays.get(messageHash);
  }

  /**
   * Get relay by nonce
   */
  getRelayByNonce(sourceDomain: number, nonce: bigint): RelayStatus | undefined {
    for (const relay of this.relays.values()) {
      if (relay.sourceDomain === sourceDomain && relay.nonce === nonce) {
        return relay;
      }
    }
    return undefined;
  }

  /**
   * Get all relays
   */
  getAllRelays(): RelayStatus[] {
    return Array.from(this.relays.values());
  }

  /**
   * Get pending relays (can be retried)
   */
  getPendingRelays(): RelayStatus[] {
    const now = Date.now();
    return Array.from(this.relays.values()).filter(
      (relay) =>
        (relay.status === 'pending' || relay.status === 'failed') &&
        relay.attempts < this.maxRetries &&
        (!relay.nextRetryTime || now >= relay.nextRetryTime)
    );
  }

  /**
   * Get relays ready for retry
   */
  getRetryableRelays(): RelayStatus[] {
    return this.getPendingRelays();
  }

  /**
   * Get statistics
   */
  getStats(): RelayStats {
    const stats: RelayStats = {
      total: this.relays.size,
      pending: 0,
      relaying: 0,
      success: 0,
      failed: 0,
      byDestination: {},
    };

    for (const relay of this.relays.values()) {
      // Count by status
      switch (relay.status) {
        case 'pending':
          stats.pending++;
          break;
        case 'relaying':
          stats.relaying++;
          break;
        case 'success':
          stats.success++;
          break;
        case 'failed':
          stats.failed++;
          break;
      }

      // Count by destination
      const destDomain = relay.destinationDomain;
      if (!stats.byDestination[destDomain]) {
        stats.byDestination[destDomain] = {
          total: 0,
          success: 0,
          failed: 0,
          chainName: this.getChainName(destDomain),
        };
      }

      stats.byDestination[destDomain].total++;

      if (relay.status === 'success') {
        stats.byDestination[destDomain].success++;
      } else if (relay.status === 'failed' && relay.attempts >= this.maxRetries) {
        stats.byDestination[destDomain].failed++;
      }
    }

    return stats;
  }

  /**
   * Clean up old successful relays
   */
  cleanup(maxAgeMs: number = 86400000): number {
    // Default: 24 hours
    const now = Date.now();
    let cleaned = 0;

    for (const [messageHash, relay] of this.relays.entries()) {
      // Only clean up successful relays that are old
      if (relay.status === 'success' && now - relay.updatedAt > maxAgeMs) {
        this.relays.delete(messageHash);
        cleaned++;
      }

      // Also clean up permanently failed relays that are old
      if (
        relay.status === 'failed' &&
        relay.attempts >= this.maxRetries &&
        now - relay.updatedAt > maxAgeMs
      ) {
        this.relays.delete(messageHash);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log('[RelayTracker] Cleaned up old relay records', { count: cleaned });
    }

    return cleaned;
  }

  /**
   * Calculate next retry time with exponential backoff
   */
  private calculateNextRetryTime(attempts: number): number {
    const now = Date.now();

    if (!this.exponentialBackoff) {
      return now + this.retryDelayMs;
    }

    // Exponential backoff: delay * 2^(attempts-1)
    // attempts=1: delay * 1
    // attempts=2: delay * 2
    // attempts=3: delay * 4
    const backoffMultiplier = Math.pow(2, attempts - 1);
    const delay = this.retryDelayMs * backoffMultiplier;

    // Cap at 1 hour
    const maxDelay = 3600000;
    const cappedDelay = Math.min(delay, maxDelay);

    return now + cappedDelay;
  }

  /**
   * Get chain name by domain ID
   */
  private getChainName(domain: number): string {
    const chainNames: { [key: number]: string } = {
      0: 'Ethereum',
      1: 'Solana',
      2: 'Substrate',
      3: 'Polygon',
      4: 'BNB',
      5: 'Avalanche',
      6: 'Arbitrum',
      7: 'Optimism',
      8: 'Tron',
    };

    return chainNames[domain] || `Unknown (${domain})`;
  }

  /**
   * Get retry statistics
   */
  getRetryStats(): {
    totalRetries: number;
    retryingNow: number;
    pendingRetry: number;
    maxedOut: number;
  } {
    let totalRetries = 0;
    let retryingNow = 0;
    let pendingRetry = 0;
    let maxedOut = 0;

    const now = Date.now();

    for (const relay of this.relays.values()) {
      if (relay.attempts > 1) {
        totalRetries += relay.attempts - 1;
      }

      if (relay.status === 'relaying' && relay.attempts > 1) {
        retryingNow++;
      }

      if (
        (relay.status === 'pending' || relay.status === 'failed') &&
        relay.attempts < this.maxRetries &&
        relay.nextRetryTime &&
        now < relay.nextRetryTime
      ) {
        pendingRetry++;
      }

      if (relay.status === 'failed' && relay.attempts >= this.maxRetries) {
        maxedOut++;
      }
    }

    return {
      totalRetries,
      retryingNow,
      pendingRetry,
      maxedOut,
    };
  }
}
