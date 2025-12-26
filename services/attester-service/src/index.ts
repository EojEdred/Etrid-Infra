/**
 * ËTRID Bridge Attester Service
 *
 * Runs on each Director VM to sign bridge attestations.
 * Part of the 5-of-9 threshold signature system.
 */

import dotenv from 'dotenv';
import express from 'express';
import { ethers } from 'ethers';
import { createLogger, format, transports } from 'winston';
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

dotenv.config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const config = {
  port: parseInt(process.env.ATTESTER_PORT || '3003'),
  metricsPort: parseInt(process.env.METRICS_PORT || '3004'),
  attesterId: parseInt(process.env.ATTESTER_ID || '0'),
  attesterName: process.env.ATTESTER_NAME || 'Unknown',
  privateKey: process.env.ATTESTER_PRIVATE_KEY || '',

  // Substrate/Primearc connection
  primearWsUrl: process.env.PRIMERC_WS_URL || 'ws://100.71.127.127:9944',

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
};

// ============================================================================
// LOGGER
// ============================================================================

const logger = createLogger({
  level: config.logLevel,
  format: format.combine(
    format.timestamp(),
    format.errors({ stack: true }),
    format.json()
  ),
  defaultMeta: {
    service: 'attester-service',
    attesterId: config.attesterId,
    attesterName: config.attesterName
  },
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    }),
    new transports.File({ filename: 'attester.log' })
  ],
});

// ============================================================================
// METRICS
// ============================================================================

const register = new Registry();
collectDefaultMetrics({ register });

const attestationsSignedCounter = new Counter({
  name: 'attester_attestations_signed_total',
  help: 'Total number of attestations signed',
  labelNames: ['chain', 'status'],
  registers: [register]
});

const signatureLatencyHistogram = new Histogram({
  name: 'attester_signature_latency_seconds',
  help: 'Latency of signature operations',
  labelNames: ['chain'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
  registers: [register]
});

const attesterStatusGauge = new Gauge({
  name: 'attester_status',
  help: 'Attester service status (1 = up, 0 = down)',
  registers: [register]
});

// ============================================================================
// ATTESTER SERVICE
// ============================================================================

class AttesterService {
  private app: express.Application;
  private metricsApp: express.Application;
  private wallet: ethers.Wallet | null = null;
  private startTime: number;
  private attestationsCount: number = 0;

  constructor() {
    this.app = express();
    this.metricsApp = express();
    this.startTime = Date.now();

    this.setupMiddleware();
    this.setupRoutes();
    this.setupMetrics();
  }

  private setupMiddleware(): void {
    this.app.use(express.json());

    // Request logging
    this.app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.path}`, { ip: req.ip });
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        attesterId: config.attesterId,
        attesterName: config.attesterName,
        address: this.wallet?.address || 'not initialized',
        uptime: Date.now() - this.startTime,
        attestationsCount: this.attestationsCount,
        timestamp: new Date().toISOString()
      });
    });

    // Get attester info
    this.app.get('/info', (req, res) => {
      if (!this.wallet) {
        return res.status(500).json({ error: 'Wallet not initialized' });
      }

      res.json({
        attesterId: config.attesterId,
        attesterName: config.attesterName,
        publicKey: ethers.SigningKey.computePublicKey(this.wallet.privateKey, true),
        address: this.wallet.address,
        uptime: Date.now() - this.startTime,
        attestationsCount: this.attestationsCount
      });
    });

    // Sign attestation
    this.app.post('/sign', async (req, res) => {
      const startTime = Date.now();

      try {
        const { messageHash, sourceDomain, destDomain, nonce, amount, sender, recipient } = req.body;

        if (!messageHash) {
          attestationsSignedCounter.inc({ chain: 'unknown', status: 'error' });
          return res.status(400).json({ error: 'messageHash is required' });
        }

        if (!this.wallet) {
          attestationsSignedCounter.inc({ chain: sourceDomain || 'unknown', status: 'error' });
          return res.status(500).json({ error: 'Wallet not initialized' });
        }

        // Validate message hash format
        if (!ethers.isHexString(messageHash, 32)) {
          attestationsSignedCounter.inc({ chain: sourceDomain || 'unknown', status: 'error' });
          return res.status(400).json({ error: 'Invalid messageHash format - must be 32 bytes hex' });
        }

        // Sign the message hash
        const signature = await this.wallet.signMessage(ethers.getBytes(messageHash));

        // Track metrics
        const duration = (Date.now() - startTime) / 1000;
        signatureLatencyHistogram.observe({ chain: sourceDomain || 'unknown' }, duration);
        attestationsSignedCounter.inc({ chain: sourceDomain || 'unknown', status: 'success' });
        this.attestationsCount++;

        logger.info('Attestation signed', {
          messageHash,
          sourceDomain,
          destDomain,
          nonce,
          amount,
          duration
        });

        res.json({
          attesterId: config.attesterId,
          attesterName: config.attesterName,
          publicKey: ethers.SigningKey.computePublicKey(this.wallet.privateKey, true),
          address: this.wallet.address,
          messageHash,
          signature,
          signedAt: new Date().toISOString()
        });
      } catch (error: any) {
        logger.error('Error signing attestation', { error: error.message });
        attestationsSignedCounter.inc({ chain: req.body?.sourceDomain || 'unknown', status: 'error' });
        res.status(500).json({ error: error.message });
      }
    });

    // Batch sign multiple attestations
    this.app.post('/sign-batch', async (req, res) => {
      try {
        const { messages } = req.body;

        if (!Array.isArray(messages) || messages.length === 0) {
          return res.status(400).json({ error: 'messages array is required' });
        }

        if (!this.wallet) {
          return res.status(500).json({ error: 'Wallet not initialized' });
        }

        const signatures = [];
        for (const msg of messages) {
          if (!ethers.isHexString(msg.messageHash, 32)) {
            signatures.push({ messageHash: msg.messageHash, error: 'Invalid format' });
            continue;
          }

          const signature = await this.wallet.signMessage(ethers.getBytes(msg.messageHash));
          signatures.push({
            messageHash: msg.messageHash,
            signature,
            attesterId: config.attesterId
          });
          this.attestationsCount++;
        }

        res.json({
          attesterId: config.attesterId,
          attesterName: config.attesterName,
          publicKey: ethers.SigningKey.computePublicKey(this.wallet.privateKey, true),
          signatures,
          signedAt: new Date().toISOString()
        });
      } catch (error: any) {
        logger.error('Error in batch signing', { error: error.message });
        res.status(500).json({ error: error.message });
      }
    });

    // Verify a signature (for testing)
    this.app.post('/verify', async (req, res) => {
      try {
        const { messageHash, signature } = req.body;

        if (!messageHash || !signature) {
          return res.status(400).json({ error: 'messageHash and signature are required' });
        }

        const recoveredAddress = ethers.verifyMessage(ethers.getBytes(messageHash), signature);
        const isValid = recoveredAddress.toLowerCase() === this.wallet?.address.toLowerCase();

        res.json({
          isValid,
          recoveredAddress,
          expectedAddress: this.wallet?.address
        });
      } catch (error: any) {
        res.status(500).json({ error: error.message });
      }
    });

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        service: 'ËTRID Bridge Attester Service',
        version: '1.0.0',
        attesterId: config.attesterId,
        attesterName: config.attesterName,
        endpoints: {
          health: '/health',
          info: '/info',
          sign: 'POST /sign',
          signBatch: 'POST /sign-batch',
          verify: 'POST /verify',
          metrics: `http://localhost:${config.metricsPort}/metrics`
        }
      });
    });
  }

  private setupMetrics(): void {
    this.metricsApp.get('/metrics', async (req, res) => {
      try {
        res.set('Content-Type', register.contentType);
        res.send(await register.metrics());
      } catch (error) {
        res.status(500).send('Error collecting metrics');
      }
    });

    this.metricsApp.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });
  }

  async start(): Promise<void> {
    try {
      // Validate configuration
      if (!config.privateKey) {
        throw new Error('ATTESTER_PRIVATE_KEY environment variable is required');
      }

      if (config.attesterId === 0) {
        logger.warn('ATTESTER_ID not set, using default 0');
      }

      // Initialize wallet
      this.wallet = new ethers.Wallet(config.privateKey);
      const publicKey = ethers.SigningKey.computePublicKey(this.wallet.privateKey, true);

      logger.info('═══════════════════════════════════════════════════════════');
      logger.info('   ËTRID Bridge Attester Service');
      logger.info('═══════════════════════════════════════════════════════════');
      logger.info(`Attester ID: ${config.attesterId}`);
      logger.info(`Attester Name: ${config.attesterName}`);
      logger.info(`EVM Address: ${this.wallet.address}`);
      logger.info(`Public Key: ${publicKey}`);
      logger.info('═══════════════════════════════════════════════════════════');

      // Start API server
      await new Promise<void>((resolve) => {
        this.app.listen(config.port, '0.0.0.0', () => {
          logger.info(`API server listening on port ${config.port}`);
          resolve();
        });
      });

      // Start metrics server
      await new Promise<void>((resolve) => {
        this.metricsApp.listen(config.metricsPort, '0.0.0.0', () => {
          logger.info(`Metrics server listening on port ${config.metricsPort}`);
          resolve();
        });
      });

      attesterStatusGauge.set(1);
      logger.info('Attester Service started successfully');
    } catch (error) {
      logger.error('Failed to start Attester Service', error);
      attesterStatusGauge.set(0);
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.info('Stopping Attester Service...');
    attesterStatusGauge.set(0);
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  const service = new AttesterService();

  // Handle graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}, shutting down...`);
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

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', error);
    shutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { reason });
    shutdown('unhandledRejection');
  });

  try {
    await service.start();
  } catch (error) {
    logger.error('Failed to start service', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export default AttesterService;
