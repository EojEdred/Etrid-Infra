import { BridgeTransfer, BridgeEvent, TransferStatus, ChainType, TokenType } from '../types';
import { logger } from './logger';

/**
 * In-memory store for tracking bridge transfers
 * In production, this should use Redis or a database
 */
export class TransferStore {
  private transfers: Map<string, BridgeTransfer> = new Map();
  private eventsByTxHash: Map<string, BridgeEvent[]> = new Map();
  private retentionMs: number;

  constructor(retentionHours: number = 168) {
    this.retentionMs = retentionHours * 60 * 60 * 1000;
  }

  /**
   * Create a new transfer from a source event
   */
  createTransfer(event: BridgeEvent, destinationChain: ChainType): BridgeTransfer {
    const transferId = this.generateTransferId(event);

    const transfer: BridgeTransfer = {
      id: transferId,
      sourceChain: event.chain,
      destinationChain,
      token: event.token,
      amount: event.amount,
      sender: event.sender,
      recipient: event.recipient,
      sourceEvent: event,
      status: TransferStatus.Initiated,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      confirmations: 0,
    };

    this.transfers.set(transferId, transfer);

    logger.info('Created new bridge transfer', {
      transferId,
      sourceChain: event.chain,
      destinationChain,
      amount: event.amount.toString(),
      token: event.token,
    });

    return transfer;
  }

  /**
   * Update transfer status
   */
  updateTransferStatus(transferId: string, status: TransferStatus): void {
    const transfer = this.transfers.get(transferId);
    if (!transfer) {
      logger.warn('Transfer not found for status update', { transferId, status });
      return;
    }

    transfer.status = status;
    transfer.updatedAt = Date.now();

    logger.info('Updated transfer status', { transferId, status });
  }

  /**
   * Add destination event to transfer
   */
  addDestinationEvent(transferId: string, event: BridgeEvent): void {
    const transfer = this.transfers.get(transferId);
    if (!transfer) {
      logger.warn('Transfer not found for destination event', { transferId });
      return;
    }

    transfer.destinationEvent = event;
    transfer.status = TransferStatus.Completed;
    transfer.updatedAt = Date.now();

    logger.info('Added destination event to transfer', {
      transferId,
      destinationChain: event.chain,
      txHash: event.transactionHash,
    });
  }

  /**
   * Update transfer confirmations
   */
  updateConfirmations(transferId: string, confirmations: number): void {
    const transfer = this.transfers.get(transferId);
    if (!transfer) return;

    transfer.confirmations = confirmations;
    transfer.updatedAt = Date.now();
  }

  /**
   * Get transfer by ID
   */
  getTransfer(transferId: string): BridgeTransfer | undefined {
    return this.transfers.get(transferId);
  }

  /**
   * Get all transfers
   */
  getAllTransfers(): BridgeTransfer[] {
    return Array.from(this.transfers.values());
  }

  /**
   * Get transfers by status
   */
  getTransfersByStatus(status: TransferStatus): BridgeTransfer[] {
    return Array.from(this.transfers.values()).filter((t) => t.status === status);
  }

  /**
   * Get transfers by chain
   */
  getTransfersByChain(chain: ChainType, isSource: boolean = true): BridgeTransfer[] {
    return Array.from(this.transfers.values()).filter((t) =>
      isSource ? t.sourceChain === chain : t.destinationChain === chain
    );
  }

  /**
   * Get stuck transfers (older than threshold)
   */
  getStuckTransfers(hoursThreshold: number): BridgeTransfer[] {
    const thresholdMs = hoursThreshold * 60 * 60 * 1000;
    const cutoff = Date.now() - thresholdMs;

    return Array.from(this.transfers.values()).filter(
      (t) =>
        t.status !== TransferStatus.Completed &&
        t.status !== TransferStatus.Failed &&
        t.createdAt < cutoff
    );
  }

  /**
   * Store event
   */
  storeEvent(event: BridgeEvent): void {
    const events = this.eventsByTxHash.get(event.transactionHash) || [];
    events.push(event);
    this.eventsByTxHash.set(event.transactionHash, events);
  }

  /**
   * Get events by transaction hash
   */
  getEventsByTxHash(txHash: string): BridgeEvent[] {
    return this.eventsByTxHash.get(txHash) || [];
  }

  /**
   * Clean up old transfers
   */
  cleanup(): number {
    const cutoff = Date.now() - this.retentionMs;
    let cleaned = 0;

    for (const [id, transfer] of this.transfers.entries()) {
      if (
        (transfer.status === TransferStatus.Completed ||
          transfer.status === TransferStatus.Failed) &&
        transfer.updatedAt < cutoff
      ) {
        this.transfers.delete(id);
        cleaned++;
      }
    }

    // Clean up old events
    for (const [txHash, events] of this.eventsByTxHash.entries()) {
      const oldestEvent = events[0];
      if (oldestEvent && oldestEvent.timestamp < cutoff) {
        this.eventsByTxHash.delete(txHash);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info(`Cleaned up ${cleaned} old transfers/events`);
    }

    return cleaned;
  }

  /**
   * Get statistics
   */
  getStats(): {
    total: number;
    byStatus: Record<TransferStatus, number>;
    byChain: Record<ChainType, number>;
    byToken: Record<TokenType, number>;
  } {
    const stats = {
      total: this.transfers.size,
      byStatus: {} as Record<TransferStatus, number>,
      byChain: {} as Record<ChainType, number>,
      byToken: {} as Record<TokenType, number>,
    };

    for (const transfer of this.transfers.values()) {
      stats.byStatus[transfer.status] = (stats.byStatus[transfer.status] || 0) + 1;
      stats.byChain[transfer.sourceChain] = (stats.byChain[transfer.sourceChain] || 0) + 1;
      stats.byToken[transfer.token] = (stats.byToken[transfer.token] || 0) + 1;
    }

    return stats;
  }

  /**
   * Generate unique transfer ID from event
   */
  private generateTransferId(event: BridgeEvent): string {
    return `${event.chain}-${event.transactionHash}-${event.blockNumber}`;
  }
}
