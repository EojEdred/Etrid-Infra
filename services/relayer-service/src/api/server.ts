import express, { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { RelayerConfig } from '../types';
import { getMetrics, recordApiRequest } from '../metrics';

/**
 * Simple API server for relayer service
 * Exposes health check and Prometheus metrics
 */
export class ApiServer {
  private app: express.Application;
  private server: any;
  private startTime: number;

  constructor(private config: RelayerConfig) {
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
      logger.debug('API request', {
        method: req.method,
        path: req.path,
      });

      // Record metrics when response finishes
      res.on('finish', () => {
        recordApiRequest(req.path, req.method, res.statusCode);
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
    const health = {
      status: 'healthy',
      uptime: Date.now() - this.startTime,
      relayerAddress: this.config.relayerAddress,
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
   * Start the API server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const port = this.config.metricsPort || 3001;
        this.server = this.app.listen(port, () => {
          logger.info(`Relayer API server listening on port ${port}`);
          resolve();
        });
      } catch (error) {
        reject(error);
      }
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
