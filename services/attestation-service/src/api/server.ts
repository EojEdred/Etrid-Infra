import express, { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { AttestationStore } from '../utils/AttestationStore';
import { SubstrateMonitor } from '../monitors/SubstrateMonitor';
import { EthereumMonitor } from '../monitors/EthereumMonitor';
import { AttestationConfig, AttestationResponse, ServiceHealth } from '../types';
import { ethers } from 'ethers';
import { getMetrics, recordApiRequest } from '../metrics';

/**
 * REST API server for attestation service
 * Provides endpoints for relayers to fetch signed attestations
 */
export class ApiServer {
  private app: express.Application;
  private server: any;
  private startTime: number;

  constructor(
    private config: AttestationConfig,
    private attestationStore: AttestationStore,
    private substrateMonitor: SubstrateMonitor,
    private ethereumMonitor: EthereumMonitor
  ) {
    this.app = express();
    this.startTime = Date.now();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(express.json());

    // Request logging and metrics
    this.app.use((req, res, next) => {
      const startTime = Date.now();

      logger.debug('API request', {
        method: req.method,
        path: req.path,
        query: req.query,
        body: req.body,
      });

      // Record metrics when response finishes
      res.on('finish', () => {
        const duration = (Date.now() - startTime) / 1000; // Convert to seconds
        recordApiRequest(req.path, req.method, res.statusCode, duration);
      });

      next();
    });

    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', this.handleHealth.bind(this));

    // Prometheus metrics
    this.app.get('/metrics', this.handleMetrics.bind(this));

    // Get attestation by message hash
    this.app.get('/attestation/:messageHash', this.handleGetAttestation.bind(this));

    // Get attestation by source domain and nonce
    this.app.get(
      '/attestation/:sourceDomain/:nonce',
      this.handleGetAttestationByNonce.bind(this)
    );

    // List all ready attestations
    this.app.get('/attestations/ready', this.handleGetReadyAttestations.bind(this));

    // Get service statistics
    this.app.get('/stats', this.handleGetStats.bind(this));

    // Get monitor status
    this.app.get('/status', this.handleGetStatus.bind(this));

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not found' });
    });

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: any) => {
      logger.error('API error', err);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  /**
   * Health check endpoint
   */
  private handleHealth(req: Request, res: Response): void {
    const substrateStatus = this.substrateMonitor.getStatus();
    const ethereumStatus = this.ethereumMonitor.getStatus();
    const stats = this.attestationStore.getStats();

    const health: ServiceHealth = {
      status:
        substrateStatus.isRunning && ethereumStatus.isRunning
          ? 'healthy'
          : substrateStatus.isRunning || ethereumStatus.isRunning
          ? 'degraded'
          : 'unhealthy',
      uptime: Date.now() - this.startTime,
      substrate: substrateStatus,
      ethereum: ethereumStatus,
      pendingAttestations: stats.pending,
      readyAttestations: stats.ready,
    };

    res.json(health);
  }

  /**
   * Prometheus metrics endpoint
   */
  private async handleMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await getMetrics();
      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.send(metrics);
    } catch (error) {
      logger.error('Error generating metrics', error);
      res.status(500).send('Error generating metrics');
    }
  }

  /**
   * Get attestation by message hash
   */
  private handleGetAttestation(req: Request, res: Response): void {
    const { messageHash } = req.params;

    if (!messageHash || !messageHash.startsWith('0x')) {
      res.status(400).json({ error: 'Invalid message hash' });
      return;
    }

    const attestation = this.attestationStore.getAttestation(messageHash);

    if (!attestation) {
      res.status(404).json({ error: 'Attestation not found' });
      return;
    }

    const response: AttestationResponse = {
      messageHash: attestation.messageHash,
      message: ethers.hexlify(attestation.message),
      signatures: attestation.signatures.map((s) => s.signature),
      signatureCount: attestation.signatures.length,
      thresholdMet: attestation.status === 'ready' || attestation.status === 'relayed',
      status: attestation.status,
    };

    res.json(response);
  }

  /**
   * Get attestation by source domain and nonce
   */
  private handleGetAttestationByNonce(req: Request, res: Response): void {
    const sourceDomain = parseInt(req.params.sourceDomain);
    const nonce = BigInt(req.params.nonce);

    if (isNaN(sourceDomain) || nonce < 0n) {
      res.status(400).json({ error: 'Invalid source domain or nonce' });
      return;
    }

    const attestation = this.attestationStore.getAttestationByNonce(
      sourceDomain,
      nonce
    );

    if (!attestation) {
      res.status(404).json({ error: 'Attestation not found' });
      return;
    }

    const response: AttestationResponse = {
      messageHash: attestation.messageHash,
      message: ethers.hexlify(attestation.message),
      signatures: attestation.signatures.map((s) => s.signature),
      signatureCount: attestation.signatures.length,
      thresholdMet: attestation.status === 'ready' || attestation.status === 'relayed',
      status: attestation.status,
    };

    res.json(response);
  }

  /**
   * Get all ready attestations
   */
  private handleGetReadyAttestations(req: Request, res: Response): void {
    const ready = this.attestationStore.getReadyAttestations();

    const responses: AttestationResponse[] = ready.map((attestation) => ({
      messageHash: attestation.messageHash,
      message: ethers.hexlify(attestation.message),
      signatures: attestation.signatures.map((s) => s.signature),
      signatureCount: attestation.signatures.length,
      thresholdMet: true,
      status: attestation.status,
    }));

    res.json({ count: responses.length, attestations: responses });
  }

  /**
   * Get service statistics
   */
  private handleGetStats(req: Request, res: Response): void {
    const stats = this.attestationStore.getStats();

    res.json({
      attestations: stats,
      substrate: {
        lastBlock: this.substrateMonitor.getStatus().lastBlock,
        eventsProcessed: this.substrateMonitor.getStatus().eventsProcessed,
        errors: this.substrateMonitor.getStatus().errors,
      },
      ethereum: {
        lastBlock: this.ethereumMonitor.getStatus().lastBlock,
        eventsProcessed: this.ethereumMonitor.getStatus().eventsProcessed,
        errors: this.ethereumMonitor.getStatus().errors,
      },
    });
  }

  /**
   * Get monitor status
   */
  private handleGetStatus(req: Request, res: Response): void {
    res.json({
      substrate: this.substrateMonitor.getStatus(),
      ethereum: this.ethereumMonitor.getStatus(),
    });
  }

  /**
   * Start the API server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.config.port, () => {
        logger.info(`API server started on port ${this.config.port}`);
        resolve();
      });
    });
  }

  /**
   * Stop the API server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('API server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}
