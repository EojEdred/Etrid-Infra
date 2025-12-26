import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { AttestationConfig, SubstrateBurnEvent, EthereumBurnEvent } from './types';
import { SubstrateMonitor } from './monitors/SubstrateMonitor';
import { EthereumMonitor } from './monitors/EthereumMonitor';
import { MessageSigner } from './signers/MessageSigner';
import { AttestationStore } from './utils/AttestationStore';
import { ApiServer } from './api/server';
import {
  signaturesCreated,
  thresholdReached,
  lastSignatureTimestamp,
  messageProcessingDuration,
  updateStoreMetrics,
} from './metrics';

// Load environment variables
dotenv.config();

/**
 * Main attestation service orchestrator
 * Monitors both chains, signs messages, and provides REST API
 */
class AttestationService {
  private config: AttestationConfig;
  private substrateMonitor: SubstrateMonitor;
  private ethereumMonitor: EthereumMonitor;
  private messageSigner: MessageSigner;
  private attestationStore: AttestationStore;
  private apiServer: ApiServer;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Load configuration from environment
    this.config = this.loadConfig();

    // Initialize components
    this.attestationStore = new AttestationStore(this.config);
    this.messageSigner = new MessageSigner(this.config);
    this.substrateMonitor = new SubstrateMonitor(this.config);
    this.ethereumMonitor = new EthereumMonitor(this.config);
    this.apiServer = new ApiServer(
      this.config,
      this.attestationStore,
      this.substrateMonitor,
      this.ethereumMonitor
    );

    // Wire up event handlers
    this.setupEventHandlers();
  }

  /**
   * Load configuration from environment variables
   */
  private loadConfig(): AttestationConfig {
    const config: AttestationConfig = {
      // Chain connections
      substrateWsUrl: process.env.SUBSTRATE_WS_URL || 'ws://localhost:9944',
      substrateChainId: parseInt(process.env.SUBSTRATE_CHAIN_ID || '2'),
      ethereumRpcUrl: process.env.ETHEREUM_RPC_URL || 'http://localhost:8545',
      ethereumChainId: parseInt(process.env.ETHEREUM_CHAIN_ID || '1337'),

      // Attester identity
      attesterPrivateKey: process.env.ATTESTER_PRIVATE_KEY || '',
      attesterId: parseInt(process.env.ATTESTER_ID || '0'),
      attesterAddress: process.env.ATTESTER_ADDRESS || '',

      // Signature thresholds
      minSignatures: parseInt(process.env.MIN_SIGNATURES || '3'),
      totalAttesters: parseInt(process.env.TOTAL_ATTESTERS || '5'),

      // Security settings
      confirmationsRequired: parseInt(process.env.CONFIRMATIONS_REQUIRED || '2'),

      // Contract addresses
      tokenMessengerAddress: process.env.TOKEN_MESSENGER_ADDRESS,

      // API settings
      port: parseInt(process.env.PORT || '3000'),
      logLevel: process.env.LOG_LEVEL || 'info',
    };

    // Validate required fields
    if (!config.attesterPrivateKey) {
      throw new Error('ATTESTER_PRIVATE_KEY is required');
    }

    if (!config.attesterAddress) {
      throw new Error('ATTESTER_ADDRESS is required');
    }

    logger.info('Configuration loaded', {
      substrateWsUrl: config.substrateWsUrl,
      ethereumRpcUrl: config.ethereumRpcUrl,
      attesterId: config.attesterId,
      attesterAddress: config.attesterAddress,
      minSignatures: config.minSignatures,
      totalAttesters: config.totalAttesters,
      confirmationsRequired: config.confirmationsRequired,
      port: config.port,
    });

    return config;
  }

  /**
   * Setup event handlers to connect monitors with signing logic
   */
  private setupEventHandlers(): void {
    // Handle Substrate burn events (Ëtrid → Ethereum)
    this.substrateMonitor.on('burnEvent', async (event: SubstrateBurnEvent) => {
      try {
        await this.handleSubstrateBurnEvent(event);
      } catch (error) {
        logger.error('Error handling Substrate burn event', error);
      }
    });

    // Handle Ethereum burn events (Ethereum → Ëtrid)
    this.ethereumMonitor.on('burnEvent', async (event: EthereumBurnEvent) => {
      try {
        await this.handleEthereumBurnEvent(event);
      } catch (error) {
        logger.error('Error handling Ethereum burn event', error);
      }
    });

    // Handle monitor errors
    this.substrateMonitor.on('error', (error: Error) => {
      logger.error('Substrate monitor error', error);
    });

    this.ethereumMonitor.on('error', (error: Error) => {
      logger.error('Ethereum monitor error', error);
    });

    logger.info('Event handlers configured');
  }

  /**
   * Handle a burn event from Substrate (Ëtrid → Ethereum)
   */
  private async handleSubstrateBurnEvent(event: SubstrateBurnEvent): Promise<void> {
    const startTime = Date.now();

    logger.info('Processing Substrate burn event', {
      nonce: event.nonce.toString(),
      destinationDomain: event.destinationDomain,
      amount: event.amount.toString(),
    });

    // Source domain is 2 (Ëtrid), destination is from event
    const sourceDomain = 2;
    const destinationDomain = event.destinationDomain;

    // Construct cross-chain message
    const message = this.constructCrossChainMessage(
      sourceDomain,
      destinationDomain,
      event.nonce,
      event.sender,
      event.recipient,
      event.amount
    );

    // Compute message hash
    const messageHash = AttestationStore.computeMessageHash(message, destinationDomain);

    // Create or get attestation
    let attestation = this.attestationStore.getAttestation(messageHash);
    if (!attestation) {
      attestation = this.attestationStore.createAttestation(
        messageHash,
        message,
        sourceDomain,
        destinationDomain,
        event.nonce
      );
    }

    // Sign the message
    const signature = await this.messageSigner.signCrossChainMessage(
      messageHash,
      destinationDomain
    );

    // Add signature to attestation
    const thresholdMet = this.attestationStore.addSignature(messageHash, signature);

    // Update metrics
    signaturesCreated.inc();
    lastSignatureTimestamp.set(Date.now() / 1000);
    if (thresholdMet) {
      thresholdReached.inc();
    }

    // Record processing duration
    const duration = (Date.now() - startTime) / 1000;
    messageProcessingDuration.observe({ chain: 'substrate' }, duration);

    logger.info('Signed Substrate burn event', {
      messageHash,
      attesterId: signature.attesterId,
      status: attestation.status,
    });
  }

  /**
   * Handle a burn event from Ethereum (Ethereum → Ëtrid)
   */
  private async handleEthereumBurnEvent(event: EthereumBurnEvent): Promise<void> {
    const startTime = Date.now();

    logger.info('Processing Ethereum burn event', {
      nonce: event.nonce.toString(),
      destinationDomain: event.destinationDomain,
      amount: event.amount.toString(),
    });

    // Source domain is 0 (Ethereum), destination is from event
    const sourceDomain = 0;
    const destinationDomain = event.destinationDomain;

    // Construct cross-chain message
    const message = this.constructCrossChainMessage(
      sourceDomain,
      destinationDomain,
      event.nonce,
      event.sender,
      event.recipient,
      event.amount
    );

    // Compute message hash
    const messageHash = AttestationStore.computeMessageHash(message, destinationDomain);

    // Create or get attestation
    let attestation = this.attestationStore.getAttestation(messageHash);
    if (!attestation) {
      attestation = this.attestationStore.createAttestation(
        messageHash,
        message,
        sourceDomain,
        destinationDomain,
        event.nonce
      );
    }

    // Sign the message
    const signature = await this.messageSigner.signCrossChainMessage(
      messageHash,
      destinationDomain
    );

    // Add signature to attestation
    const thresholdMet = this.attestationStore.addSignature(messageHash, signature);

    // Update metrics
    signaturesCreated.inc();
    lastSignatureTimestamp.set(Date.now() / 1000);
    if (thresholdMet) {
      thresholdReached.inc();
    }

    // Record processing duration
    const duration = (Date.now() - startTime) / 1000;
    messageProcessingDuration.observe({ chain: 'ethereum' }, duration);

    logger.info('Signed Ethereum burn event', {
      messageHash,
      attesterId: signature.attesterId,
      status: attestation.status,
    });
  }

  /**
   * Construct a cross-chain message in SCALE encoding
   * This should match the format expected by MessageTransmitter contracts
   */
  private constructCrossChainMessage(
    sourceDomain: number,
    destinationDomain: number,
    nonce: bigint,
    sender: string | Uint8Array,
    recipient: Uint8Array,
    amount: bigint
  ): Uint8Array {
    // In production, use proper SCALE encoding via @polkadot/api
    // For now, create a simple concatenation (this is a placeholder)
    const encoder = new TextEncoder();

    // Convert all fields to bytes
    const sourceDomainBytes = new Uint8Array([sourceDomain & 0xff, (sourceDomain >> 8) & 0xff, (sourceDomain >> 16) & 0xff, (sourceDomain >> 24) & 0xff]);
    const destDomainBytes = new Uint8Array([destinationDomain & 0xff, (destinationDomain >> 8) & 0xff, (destinationDomain >> 16) & 0xff, (destinationDomain >> 24) & 0xff]);

    // Nonce as 8 bytes (u64)
    const nonceBytes = new Uint8Array(8);
    const view = new DataView(nonceBytes.buffer);
    view.setBigUint64(0, nonce, true); // little-endian

    // Sender bytes
    const senderBytes = typeof sender === 'string'
      ? encoder.encode(sender.slice(0, 32).padEnd(32, '\0'))
      : sender;

    // Amount as 16 bytes (u128)
    const amountBytes = new Uint8Array(16);
    const amountView = new DataView(amountBytes.buffer);
    amountView.setBigUint64(0, amount & 0xFFFFFFFFFFFFFFFFn, true);
    amountView.setBigUint64(8, amount >> 64n, true);

    // Concatenate all parts
    const totalLength =
      sourceDomainBytes.length +
      destDomainBytes.length +
      nonceBytes.length +
      senderBytes.length +
      recipient.length +
      amountBytes.length;

    const message = new Uint8Array(totalLength);
    let offset = 0;

    message.set(sourceDomainBytes, offset);
    offset += sourceDomainBytes.length;

    message.set(destDomainBytes, offset);
    offset += destDomainBytes.length;

    message.set(nonceBytes, offset);
    offset += nonceBytes.length;

    message.set(senderBytes, offset);
    offset += senderBytes.length;

    message.set(recipient, offset);
    offset += recipient.length;

    message.set(amountBytes, offset);

    return message;
  }

  /**
   * Start the attestation service
   */
  async start(): Promise<void> {
    logger.info('Starting attestation service...');

    try {
      // Initialize message signer
      await this.messageSigner.initialize();
      logger.info('Message signer initialized');

      // Start chain monitors
      await this.substrateMonitor.start();
      logger.info('Substrate monitor started');

      await this.ethereumMonitor.start();
      logger.info('Ethereum monitor started');

      // Start API server
      await this.apiServer.start();
      logger.info('API server started');

      // Start periodic cleanup of expired attestations
      this.cleanupInterval = setInterval(() => {
        const cleaned = this.attestationStore.cleanup();
        if (cleaned > 0) {
          logger.info(`Cleaned up ${cleaned} expired attestations`);
        }

        // Update store metrics
        const stats = this.attestationStore.getStats();
        updateStoreMetrics(stats.total, {
          pending: stats.pending,
          ready: stats.ready,
          relayed: stats.relayed,
          expired: stats.expired,
        });
      }, 60000); // Every minute

      logger.info('Attestation service started successfully', {
        attesterId: this.config.attesterId,
        attesterAddress: this.config.attesterAddress,
        apiPort: this.config.port,
      });
    } catch (error) {
      logger.error('Failed to start attestation service', error);
      throw error;
    }
  }

  /**
   * Stop the attestation service
   */
  async stop(): Promise<void> {
    logger.info('Stopping attestation service...');

    try {
      // Stop cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }

      // Stop API server
      await this.apiServer.stop();
      logger.info('API server stopped');

      // Stop monitors
      await this.ethereumMonitor.stop();
      logger.info('Ethereum monitor stopped');

      await this.substrateMonitor.stop();
      logger.info('Substrate monitor stopped');

      logger.info('Attestation service stopped successfully');
    } catch (error) {
      logger.error('Error stopping attestation service', error);
      throw error;
    }
  }
}

/**
 * Main entry point
 */
async function main() {
  logger.info('Starting EDSC Attestation Service');

  const service = new AttestationService();

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down gracefully...`);
    try {
      await service.stop();
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { reason, promise });
    shutdown('unhandledRejection');
  });

  try {
    await service.start();
  } catch (error) {
    logger.error('Failed to start service', error);
    process.exit(1);
  }
}

// Start the service
main().catch((error) => {
  logger.error('Fatal error', error);
  process.exit(1);
});
