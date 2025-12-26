/**
 * Ëtrid Bridge Monitor Service Entry Point
 * Main orchestrator for multi-chain bridge monitoring across all supported chains
 */

import dotenv from 'dotenv';
import express from 'express';
import { logger } from './utils/logger';
import { getMetrics, serviceUp, recordError } from './metrics';
import { ChainConfigurations } from './config/chains';
import { TransferStore } from './utils/TransferStore';

// Load environment variables
dotenv.config();

/**
 * Main Bridge Monitor Service
 * Orchestrates monitoring across all supported blockchains
 */
class BridgeMonitorService {
  private app: express.Application;
  private metricsApp: express.Application;
  private startTime: number;
  private transferStore: TransferStore;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  // Monitor instances (to be implemented)
  private ethereumMonitor: any = null;
  private solanaMonitor: any = null;
  private bitcoinMonitor: any = null;
  private tronMonitor: any = null;
  private xrpMonitor: any = null;
  private bscMonitor: any = null;
  private polygonMonitor: any = null;
  private substrateMonitor: any = null;

  constructor() {
    this.app = express();
    this.metricsApp = express();
    this.startTime = Date.now();

    // Load service configuration
    const config = ChainConfigurations.loadServiceConfig();

    // Initialize transfer store
    this.transferStore = new TransferStore(config.eventRetentionHours);

    this.setupMiddleware();
    this.setupRoutes();
    this.setupMetricsRoutes();

    logger.info('Bridge Monitor Service initialized', {
      config: {
        port: config.port,
        metricsPort: config.metricsPort,
        enabledChains: {
          ethereum: config.monitorEthereum,
          solana: config.monitorSolana,
          bitcoin: config.monitorBitcoin,
          tron: config.monitorTron,
          xrp: config.monitorXrp,
          bsc: config.monitorBsc,
          polygon: config.monitorPolygon,
          substrate: config.monitorSubstrate,
        },
      },
    });
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.debug('HTTP request', {
        method: req.method,
        path: req.path,
        ip: req.ip,
      });
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    const config = ChainConfigurations.loadServiceConfig();

    // Health check
    this.app.get('/health', (req, res) => {
      const stats = this.transferStore.getStats();
      const health = {
        status: 'healthy',
        uptime: Date.now() - this.startTime,
        timestamp: new Date().toISOString(),
        transfers: stats,
        monitors: this.getMonitorStatuses(),
      };

      res.json(health);
    });

    // Get all transfers
    this.app.get('/transfers', (req, res) => {
      const transfers = this.transferStore.getAllTransfers();
      res.json({
        transfers,
        total: transfers.length,
      });
    });

    // Get transfer by ID
    this.app.get('/transfers/:id', (req, res) => {
      const transfer = this.transferStore.getTransfer(req.params.id);
      if (!transfer) {
        return res.status(404).json({ error: 'Transfer not found' });
      }
      res.json(transfer);
    });

    // Get stuck transfers
    this.app.get('/transfers/stuck', (req, res) => {
      const stuckTransfers = this.transferStore.getStuckTransfers(config.alertStuckTransferHours);
      res.json({
        stuckTransfers,
        total: stuckTransfers.length,
      });
    });

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'Ëtrid Bridge Monitor Service',
        version: '1.0.0',
        uptime: Date.now() - this.startTime,
        supportedChains: [
          'ethereum',
          'solana',
          'bitcoin',
          'tron',
          'xrp',
          'bsc',
          'polygon',
          'substrate',
        ],
        endpoints: {
          health: '/health',
          transfers: '/transfers',
          transferById: '/transfers/:id',
          stuckTransfers: '/transfers/stuck',
          metrics: `http://localhost:${config.metricsPort}/metrics`,
        },
      });
    });
  }

  /**
   * Get status of all monitors
   */
  private getMonitorStatuses(): any {
    const statuses: any = {};

    if (this.ethereumMonitor) {
      statuses.ethereum = this.ethereumMonitor.getStatus();
    }
    if (this.solanaMonitor) {
      statuses.solana = this.solanaMonitor.getStatus();
    }
    if (this.bitcoinMonitor) {
      statuses.bitcoin = this.bitcoinMonitor.getStatus();
    }
    if (this.tronMonitor) {
      statuses.tron = this.tronMonitor.getStatus();
    }
    if (this.xrpMonitor) {
      statuses.xrp = this.xrpMonitor.getStatus();
    }
    if (this.bscMonitor) {
      statuses.bsc = this.bscMonitor.getStatus();
    }
    if (this.polygonMonitor) {
      statuses.polygon = this.polygonMonitor.getStatus();
    }
    if (this.substrateMonitor) {
      statuses.substrate = this.substrateMonitor.getStatus();
    }

    return statuses;
  }

  /**
   * Setup metrics routes
   */
  private setupMetricsRoutes(): void {
    this.metricsApp.get('/metrics', async (req, res) => {
      try {
        res.set('Content-Type', 'text/plain');
        const metrics = await getMetrics();
        res.send(metrics);
      } catch (error) {
        logger.error('Error generating metrics', error);
        res.status(500).send('Error generating metrics');
      }
    });

    this.metricsApp.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });
  }

  /**
   * Initialize chain monitors
   */
  private async initializeMonitors(): Promise<void> {
    const config = ChainConfigurations.loadServiceConfig();

    if (config.monitorEthereum) {
      await this.startEthereumMonitor();
    }

    if (config.monitorSolana) {
      await this.startSolanaMonitor();
    }

    if (config.monitorBitcoin) {
      await this.startBitcoinMonitor();
    }

    if (config.monitorTron) {
      await this.startTronMonitor();
    }

    if (config.monitorXrp) {
      await this.startXrpMonitor();
    }

    if (config.monitorBsc) {
      await this.startBscMonitor();
    }

    if (config.monitorPolygon) {
      await this.startPolygonMonitor();
    }

    if (config.monitorSubstrate) {
      await this.startSubstrateMonitor();
    }
  }

  private async startEthereumMonitor(): Promise<void> {
    logger.info('Starting Ethereum monitor...');
    // TODO: Implement EthereumMonitor
    // const config = ChainConfigurations.loadEthereumConfig();
    // this.ethereumMonitor = new EthereumMonitor(config, this.transferStore);
    // await this.ethereumMonitor.start();
    logger.info('Ethereum monitor ready');
  }

  private async startSolanaMonitor(): Promise<void> {
    logger.info('Starting Solana monitor...');
    // TODO: Implement SolanaMonitor
    logger.info('Solana monitor ready');
  }

  private async startBitcoinMonitor(): Promise<void> {
    logger.info('Starting Bitcoin monitor...');
    // TODO: Implement BitcoinMonitor
    logger.info('Bitcoin monitor ready');
  }

  private async startTronMonitor(): Promise<void> {
    logger.info('Starting Tron monitor...');
    // TODO: Implement TronMonitor
    logger.info('Tron monitor ready');
  }

  private async startXrpMonitor(): Promise<void> {
    logger.info('Starting XRP monitor...');
    // TODO: Implement XrpMonitor
    logger.info('XRP monitor ready');
  }

  private async startBscMonitor(): Promise<void> {
    logger.info('Starting BSC monitor...');
    // TODO: Implement BscMonitor
    logger.info('BSC monitor ready');
  }

  private async startPolygonMonitor(): Promise<void> {
    logger.info('Starting Polygon monitor...');
    // TODO: Implement PolygonMonitor
    logger.info('Polygon monitor ready');
  }

  private async startSubstrateMonitor(): Promise<void> {
    logger.info('Starting Substrate monitor...');
    // TODO: Implement SubstrateMonitor
    logger.info('Substrate monitor ready');
  }

  /**
   * Start the service
   */
  async start(): Promise<void> {
    try {
      const config = ChainConfigurations.loadServiceConfig();

      logger.info('═══════════════════════════════════════════════════════');
      logger.info('   Starting Ëtrid Bridge Monitor Service');
      logger.info('═══════════════════════════════════════════════════════');
      logger.info('Configuration:', {
        port: config.port,
        metricsPort: config.metricsPort,
        enabledChains: this.getEnabledChains(),
      });

      // Initialize all monitors
      await this.initializeMonitors();

      // Start periodic cleanup
      this.cleanupInterval = setInterval(() => {
        const cleaned = this.transferStore.cleanup();
        if (cleaned > 0) {
          logger.info(`Cleaned up ${cleaned} old transfers/events`);
        }
      }, 60 * 60 * 1000); // Every hour

      // Start health checks
      this.healthCheckInterval = setInterval(() => {
        this.performHealthCheck();
      }, config.healthCheckInterval * 1000);

      // Start API server
      await new Promise<void>((resolve) => {
        this.app.listen(config.port, () => {
          logger.info(`API server listening on port ${config.port}`);
          resolve();
        });
      });

      // Start metrics server
      await new Promise<void>((resolve) => {
        this.metricsApp.listen(config.metricsPort, () => {
          logger.info(`Metrics server listening on port ${config.metricsPort}`);
          resolve();
        });
      });

      serviceUp.set(1);
      logger.info('═══════════════════════════════════════════════════════');
      logger.info('   Bridge Monitor Service started successfully');
      logger.info('═══════════════════════════════════════════════════════');
    } catch (error) {
      logger.error('Failed to start Bridge Monitor Service', error);
      serviceUp.set(0);
      throw error;
    }
  }

  /**
   * Perform health check
   */
  private performHealthCheck(): void {
    const stats = this.transferStore.getStats();
    logger.debug('Health check completed', {
      uptime: this.getUptime(),
      totalTransfers: stats.total,
      byStatus: stats.byStatus,
    });
  }

  /**
   * Get uptime in seconds
   */
  private getUptime(): number {
    return Math.floor((Date.now() - this.startTime) / 1000);
  }

  /**
   * Get list of enabled chains
   */
  private getEnabledChains(): string[] {
    const config = ChainConfigurations.loadServiceConfig();
    const enabled: string[] = [];

    if (config.monitorEthereum) enabled.push('ethereum');
    if (config.monitorSolana) enabled.push('solana');
    if (config.monitorBitcoin) enabled.push('bitcoin');
    if (config.monitorTron) enabled.push('tron');
    if (config.monitorXrp) enabled.push('xrp');
    if (config.monitorBsc) enabled.push('bsc');
    if (config.monitorPolygon) enabled.push('polygon');
    if (config.monitorSubstrate) enabled.push('substrate');

    return enabled;
  }

  /**
   * Stop the service
   */
  async stop(): Promise<void> {
    logger.info('Stopping Bridge Monitor Service...');

    try {
      // Stop cleanup interval
      if (this.cleanupInterval) {
        clearInterval(this.cleanupInterval);
        this.cleanupInterval = null;
      }

      // Stop health check interval
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }

      // Stop all monitors
      if (this.ethereumMonitor) {
        await this.ethereumMonitor.stop();
      }
      if (this.solanaMonitor) {
        await this.solanaMonitor.stop();
      }
      if (this.bitcoinMonitor) {
        await this.bitcoinMonitor.stop();
      }
      if (this.tronMonitor) {
        await this.tronMonitor.stop();
      }
      if (this.xrpMonitor) {
        await this.xrpMonitor.stop();
      }
      if (this.bscMonitor) {
        await this.bscMonitor.stop();
      }
      if (this.polygonMonitor) {
        await this.polygonMonitor.stop();
      }
      if (this.substrateMonitor) {
        await this.substrateMonitor.stop();
      }

      serviceUp.set(0);
      logger.info('Bridge Monitor Service stopped successfully');
    } catch (error) {
      logger.error('Error stopping Bridge Monitor Service', error);
      throw error;
    }
  }
}

/**
 * Main entry point
 */
async function main() {
  logger.info('═══════════════════════════════════════════════════════');
  logger.info('   Ëtrid Bridge Monitor Service');
  logger.info('   Multi-chain Bridge Monitoring & Analytics');
  logger.info('═══════════════════════════════════════════════════════');

  const service = new BridgeMonitorService();

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
    recordError('uncaught_exception', 'main');
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { reason, promise });
    recordError('unhandled_rejection', 'main');
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

export default BridgeMonitorService;
