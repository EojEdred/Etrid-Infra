import express, { Express, Request, Response } from 'express';
import { MultiChainRelayer } from './MultiChainRelayer';
import { relayerMetrics } from './metrics';
import {
  RelayStatusRequest,
  RelayStatusResponse,
  RelayStatsResponse,
  HealthResponse,
  MetricsResponse,
} from './types';

/**
 * REST API for multi-chain relayer
 * Provides endpoints for querying relay status, statistics, and health
 */
export class RelayerAPI {
  private app: Express;
  private server: any;
  private port: number;

  constructor(
    private relayer: MultiChainRelayer,
    port: number = 3001
  ) {
    this.port = port;
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup middleware
   */
  private setupMiddleware(): void {
    this.app.use(express.json());

    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type');
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`[API] ${req.method} ${req.path}`, {
        query: req.query,
        body: req.body,
      });
      next();
    });
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // Health check
    this.app.get('/health', this.handleHealth.bind(this));

    // Relay status by message hash
    this.app.get('/relay/:messageHash', this.handleGetRelayByHash.bind(this));

    // Relay status by source domain and nonce
    this.app.get('/relay/:sourceDomain/:nonce', this.handleGetRelayByNonce.bind(this));

    // All relays
    this.app.get('/relays', this.handleGetAllRelays.bind(this));

    // Relay statistics
    this.app.get('/stats', this.handleGetStats.bind(this));

    // Chain statistics
    this.app.get('/chains', this.handleGetChains.bind(this));

    // Chain status
    this.app.get('/chain/:domain', this.handleGetChain.bind(this));

    // Prometheus metrics
    this.app.get('/metrics', this.handleGetMetrics.bind(this));

    // Total statistics
    this.app.get('/stats/total', this.handleGetTotalStats.bind(this));

    // Retry statistics
    this.app.get('/stats/retry', this.handleGetRetryStats.bind(this));

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not found',
        path: req.path,
      });
    });

    // Error handler
    this.app.use((err: any, req: Request, res: Response, next: any) => {
      console.error('[API] Error handling request', {
        error: err.message,
        path: req.path,
      });

      res.status(500).json({
        error: 'Internal server error',
        message: err.message,
      });
    });
  }

  /**
   * Handle health check
   */
  private async handleHealth(req: Request, res: Response): Promise<void> {
    try {
      const health = this.relayer.getHealth();
      const response: HealthResponse = health;

      const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json(response);
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to get health',
        message: error.message,
      });
    }
  }

  /**
   * Handle get relay by message hash
   */
  private async handleGetRelayByHash(req: Request, res: Response): Promise<void> {
    try {
      const { messageHash } = req.params;

      const relay = this.relayer.getRelay(messageHash);

      const response: RelayStatusResponse = {
        found: relay !== undefined,
        relay,
      };

      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to get relay',
        message: error.message,
      });
    }
  }

  /**
   * Handle get relay by source domain and nonce
   */
  private async handleGetRelayByNonce(req: Request, res: Response): Promise<void> {
    try {
      const sourceDomain = parseInt(req.params.sourceDomain);
      const nonce = BigInt(req.params.nonce);

      if (isNaN(sourceDomain)) {
        res.status(400).json({
          error: 'Invalid sourceDomain',
        });
        return;
      }

      const relay = this.relayer.getRelayByNonce(sourceDomain, nonce);

      const response: RelayStatusResponse = {
        found: relay !== undefined,
        relay,
      };

      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to get relay',
        message: error.message,
      });
    }
  }

  /**
   * Handle get all relays
   */
  private async handleGetAllRelays(req: Request, res: Response): Promise<void> {
    try {
      const stats = this.relayer.getStats();

      // Get all relays from tracker (we'd need to expose this method)
      // For now, return stats
      res.json({
        stats,
        // In production, you'd implement pagination
        // relays: this.relayer.getAllRelays()
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to get relays',
        message: error.message,
      });
    }
  }

  /**
   * Handle get statistics
   */
  private async handleGetStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = this.relayer.getStats();
      const chainStats = this.relayer.getChainStats();

      const response: RelayStatsResponse = {
        stats,
        chainStats,
      };

      res.json(response);
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to get stats',
        message: error.message,
      });
    }
  }

  /**
   * Handle get chains
   */
  private async handleGetChains(req: Request, res: Response): Promise<void> {
    try {
      const chainStats = this.relayer.getChainStats();

      res.json({
        chains: chainStats,
        connected: this.relayer.getConnectedChains(),
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to get chains',
        message: error.message,
      });
    }
  }

  /**
   * Handle get chain
   */
  private async handleGetChain(req: Request, res: Response): Promise<void> {
    try {
      const domain = parseInt(req.params.domain);

      if (isNaN(domain)) {
        res.status(400).json({
          error: 'Invalid domain',
        });
        return;
      }

      const relayer = this.relayer.getRelayer(domain);

      if (!relayer) {
        res.status(404).json({
          error: 'Chain not found',
          domain,
        });
        return;
      }

      const stats = relayer.getStats();
      const connected = relayer.isConnected();

      // Get balance
      let balance: string | undefined;
      try {
        const balanceBigInt = await relayer.getBalance();
        balance = balanceBigInt.toString();
      } catch (error) {
        // Ignore
      }

      // Get current block
      let currentBlock: number | undefined;
      try {
        currentBlock = await relayer.getCurrentBlock();
      } catch (error) {
        // Ignore
      }

      res.json({
        domain,
        name: stats.chainName,
        connected,
        stats,
        balance,
        currentBlock,
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to get chain',
        message: error.message,
      });
    }
  }

  /**
   * Handle get Prometheus metrics
   */
  private async handleGetMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await relayerMetrics.getMetrics();

      res.set('Content-Type', 'text/plain; version=0.0.4');
      res.send(metrics);
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to get metrics',
        message: error.message,
      });
    }
  }

  /**
   * Handle get total statistics
   */
  private async handleGetTotalStats(req: Request, res: Response): Promise<void> {
    try {
      const totalStats = this.relayer.getTotalStats();

      res.json(totalStats);
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to get total stats',
        message: error.message,
      });
    }
  }

  /**
   * Handle get retry statistics
   */
  private async handleGetRetryStats(req: Request, res: Response): Promise<void> {
    try {
      const totalStats = this.relayer.getTotalStats();

      res.json({
        retries: totalStats.retries,
      });
    } catch (error: any) {
      res.status(500).json({
        error: 'Failed to get retry stats',
        message: error.message,
      });
    }
  }

  /**
   * Start API server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          console.log(`[RelayerAPI] Server started on port ${this.port}`);
          resolve();
        });

        this.server.on('error', (error: any) => {
          console.error('[RelayerAPI] Server error', error);
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop API server
   */
  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((error: any) => {
        if (error) {
          console.error('[RelayerAPI] Error stopping server', error);
          reject(error);
        } else {
          console.log('[RelayerAPI] Server stopped');
          resolve();
        }
      });
    });
  }

  /**
   * Get Express app (for testing)
   */
  getApp(): Express {
    return this.app;
  }
}
