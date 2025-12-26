import { logger } from './logger';
import { RelayStatus, RelayStats } from '../types';

/**
 * Tracks relay status to avoid duplicate relays and provide statistics
 * In production, use Redis or a database for persistence
 */
export class RelayTracker {
  private relays: Map<string, RelayStatus> = new Map();
  private MAX_RETRIES: number = 3;
  private RETRY_DELAY_MS: number = 60000; // 1 minute

  constructor(
    maxRetries: number = 3,
    retryDelayMs: number = 60000
  ) {
    this.MAX_RETRIES = maxRetries;
    this.RETRY_DELAY_MS = retryDelayMs;
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

    if (relay.attempts >= this.MAX_RETRIES) {
      return false; // Max retries exceeded
    }

    // Check if enough time has passed since last attempt
    if (relay.lastAttemptTime) {
      const timeSinceLastAttempt = Date.now() - relay.lastAttemptTime;
      if (timeSinceLastAttempt < this.RETRY_DELAY_MS) {
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
      existing.updatedAt = now;
      this.relays.set(messageHash, existing);

      logger.info('Updated relay status', {
        messageHash,
        attempts: existing.attempts,
        status: 'relaying',
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
        createdAt: now,
        updatedAt: now,
      };

      this.relays.set(messageHash, relay);

      logger.info('Created relay status', {
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
  markSuccess(messageHash: string, txHash: string): void {
    const relay = this.relays.get(messageHash);

    if (!relay) {
      logger.warn('Relay not found for success marking', { messageHash });
      return;
    }

    relay.status = 'success';
    relay.txHash = txHash;
    relay.updatedAt = Date.now();
    relay.error = undefined;

    this.relays.set(messageHash, relay);

    logger.info('Marked relay as successful', {
      messageHash,
      txHash,
      attempts: relay.attempts,
    });
  }

  /**
   * Mark relay as failed
   */
  markFailed(messageHash: string, error: string): void {
    const relay = this.relays.get(messageHash);

    if (!relay) {
      logger.warn('Relay not found for failure marking', { messageHash });
      return;
    }

    relay.status = 'failed';
    relay.error = error;
    relay.updatedAt = Date.now();

    this.relays.set(messageHash, relay);

    logger.warn('Marked relay as failed', {
      messageHash,
      error,
      attempts: relay.attempts,
    });
  }

  /**
   * Get relay status
   */
  getRelay(messageHash: string): RelayStatus | undefined {
    return this.relays.get(messageHash);
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
    return Array.from(this.relays.values()).filter(
      (relay) =>
        relay.status === 'pending' ||
        (relay.status === 'failed' && relay.attempts < this.MAX_RETRIES)
    );
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
      if (!stats.byDestination[relay.destinationDomain]) {
        stats.byDestination[relay.destinationDomain] = {
          total: 0,
          success: 0,
          failed: 0,
        };
      }

      stats.byDestination[relay.destinationDomain].total++;

      if (relay.status === 'success') {
        stats.byDestination[relay.destinationDomain].success++;
      } else if (relay.status === 'failed') {
        stats.byDestination[relay.destinationDomain].failed++;
      }
    }

    return stats;
  }

  /**
   * Clean up old successful relays (keep only recent ones)
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
    }

    if (cleaned > 0) {
      logger.info('Cleaned up old relay records', { count: cleaned });
    }

    return cleaned;
  }
}
