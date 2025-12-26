/**
 * Example: Multi-Chain EVM Monitor
 *
 * Demonstrates how to monitor multiple EVM chains simultaneously
 * for bridge deposits and route them to Etrid pallets.
 */

import { EvmMonitor, EvmDepositEvent } from '../monitors/EvmMonitor';
import {
  ETHEREUM_CONFIG,
  BNB_CHAIN_CONFIG,
  POLYGON_CONFIG,
  ARBITRUM_CONFIG,
  BASE_CONFIG,
  EvmChainConfig,
} from '../config/evm-chains';
import { logger } from '../utils/logger';

/**
 * Multi-chain monitor coordinator
 */
class MultiChainMonitor {
  private monitors: Map<number, EvmMonitor> = new Map();
  private isRunning = false;

  /**
   * Start monitoring all configured chains
   */
  async start(chainConfigs: EvmChainConfig[]): Promise<void> {
    logger.info('Starting multi-chain monitor...', {
      chains: chainConfigs.map((c) => c.name),
    });

    for (const config of chainConfigs) {
      try {
        const monitor = new EvmMonitor(config);

        // Listen for deposit events
        monitor.on('deposit', (event: EvmDepositEvent) => {
          this.handleDeposit(event);
        });

        // Listen for errors
        monitor.on('error', (error: Error) => {
          logger.error(`Error in ${config.name} monitor`, { error });
        });

        // Start monitoring
        await monitor.start();

        // Store monitor
        this.monitors.set(config.chainId, monitor);

        logger.info(`${config.name} monitor started successfully`);
      } catch (error) {
        logger.error(`Failed to start ${config.name} monitor`, { error });
      }
    }

    this.isRunning = true;
    logger.info('Multi-chain monitor started', {
      activeChains: this.monitors.size,
    });
  }

  /**
   * Handle deposit event from any chain
   */
  private async handleDeposit(event: EvmDepositEvent): Promise<void> {
    logger.info('Deposit detected', {
      chain: event.chainName,
      chainId: event.chainId,
      txHash: event.transactionHash,
      amount: event.amount.toString(),
      sender: event.sender,
      nonce: event.nonce.toString(),
      destinationDomain: event.destinationDomain,
      tokenSymbol: event.tokenSymbol || 'NATIVE',
    });

    // Route to appropriate Etrid pallet based on chain
    switch (event.chainId) {
      case 1: // Ethereum
        await this.submitEthereumDeposit(event);
        break;
      case 56: // BNB Chain
        await this.submitBnbDeposit(event);
        break;
      case 137: // Polygon
        await this.submitPolygonDeposit(event);
        break;
      case 42161: // Arbitrum
        await this.submitArbitrumDeposit(event);
        break;
      case 8453: // Base
        await this.submitBaseDeposit(event);
        break;
      default:
        logger.warn('Unknown chain ID', { chainId: event.chainId });
    }
  }

  /**
   * Submit Ethereum deposit to Etrid
   */
  private async submitEthereumDeposit(event: EvmDepositEvent): Promise<void> {
    logger.info('Submitting Ethereum deposit to Etrid', {
      txHash: event.transactionHash,
      amount: event.amount.toString(),
    });

    // Example: Call initiate_eth_deposit extrinsic
    // const extrinsic = api.tx.ethereumBridge.initiateEthDeposit(
    //   etridAccount,
    //   event.sender,
    //   event.amount,
    //   event.transactionHash,
    //   12 // confirmations
    // );
    // await extrinsic.signAndSend(relayer);
  }

  /**
   * Submit BNB Chain deposit to Etrid
   */
  private async submitBnbDeposit(event: EvmDepositEvent): Promise<void> {
    logger.info('Submitting BNB deposit to Etrid', {
      txHash: event.transactionHash,
      amount: event.amount.toString(),
    });

    // Example: Call initiate_bnb_deposit extrinsic
    // const extrinsic = api.tx.bnbBridge.initiateBnbDeposit(
    //   etridAccount,
    //   event.sender,
    //   event.amount,
    //   event.transactionHash,
    //   event.blockNumber,
    //   15 // confirmations
    // );
    // await extrinsic.signAndSend(relayer);
  }

  /**
   * Submit Polygon deposit to Etrid
   */
  private async submitPolygonDeposit(event: EvmDepositEvent): Promise<void> {
    logger.info('Submitting Polygon deposit to Etrid', {
      txHash: event.transactionHash,
      amount: event.amount.toString(),
    });

    // Example: Call initiate_polygon_deposit extrinsic
  }

  /**
   * Submit Arbitrum deposit to Etrid
   */
  private async submitArbitrumDeposit(event: EvmDepositEvent): Promise<void> {
    logger.info('Submitting Arbitrum deposit to Etrid', {
      txHash: event.transactionHash,
      amount: event.amount.toString(),
    });

    // Example: Call initiate_arbitrum_deposit extrinsic
  }

  /**
   * Submit Base deposit to Etrid
   */
  private async submitBaseDeposit(event: EvmDepositEvent): Promise<void> {
    logger.info('Submitting Base deposit to Etrid', {
      txHash: event.transactionHash,
      amount: event.amount.toString(),
    });

    // Example: Call initiate_base_deposit extrinsic
  }

  /**
   * Stop all monitors
   */
  async stop(): Promise<void> {
    logger.info('Stopping multi-chain monitor...');

    for (const [chainId, monitor] of this.monitors) {
      try {
        await monitor.stop();
        logger.info('Monitor stopped', { chainId });
      } catch (error) {
        logger.error('Error stopping monitor', { chainId, error });
      }
    }

    this.monitors.clear();
    this.isRunning = false;
    logger.info('Multi-chain monitor stopped');
  }

  /**
   * Get status of all monitors
   */
  getStatus(): any {
    const statuses: any = {};

    for (const [chainId, monitor] of this.monitors) {
      statuses[chainId] = monitor.getStatus();
    }

    return {
      isRunning: this.isRunning,
      activeChains: this.monitors.size,
      monitors: statuses,
    };
  }

  /**
   * Get specific monitor
   */
  getMonitor(chainId: number): EvmMonitor | undefined {
    return this.monitors.get(chainId);
  }
}

/**
 * Example usage
 */
async function main() {
  const coordinator = new MultiChainMonitor();

  // Configure chains to monitor
  const chains = [
    ETHEREUM_CONFIG,
    BNB_CHAIN_CONFIG,
    POLYGON_CONFIG,
    ARBITRUM_CONFIG,
    BASE_CONFIG,
  ];

  // Start monitoring
  await coordinator.start(chains);

  // Handle shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT, shutting down...');
    await coordinator.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down...');
    await coordinator.stop();
    process.exit(0);
  });

  // Log status every 60 seconds
  setInterval(() => {
    const status = coordinator.getStatus();
    logger.info('Multi-chain monitor status', { status });
  }, 60_000);
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    logger.error('Fatal error', { error });
    process.exit(1);
  });
}

export { MultiChainMonitor };
