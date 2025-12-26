/**
 * Example usage of MultiChainRelayer
 * This demonstrates how to configure and use the multi-chain relayer service
 */

import {
  MultiChainRelayer,
  RelayerAPI,
  MultiChainRelayerConfig,
  ChainConfig,
  ChainDomain,
  ChainType,
  Attestation,
  relayerMetrics,
} from './index';

/**
 * Example: Setup and run multi-chain relayer
 */
async function main() {
  console.log('=== Multi-Chain Relayer Example ===\n');

  // 1. Configure chains
  const chains = new Map<number, ChainConfig>();

  // Ethereum mainnet
  chains.set(ChainDomain.Ethereum, {
    domain: ChainDomain.Ethereum,
    name: 'Ethereum',
    type: ChainType.EVM,
    rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
    chainId: 1,
    messageTransmitterAddress: process.env.ETH_MESSAGE_TRANSMITTER,
    confirmations: 2,
    gasConfig: {
      maxFeePerGas: '50', // 50 gwei
      maxPriorityFeePerGas: '2', // 2 gwei
    },
    enabled: true,
  });

  // Polygon
  chains.set(ChainDomain.Polygon, {
    domain: ChainDomain.Polygon,
    name: 'Polygon',
    type: ChainType.EVM,
    rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    chainId: 137,
    messageTransmitterAddress: process.env.POLYGON_MESSAGE_TRANSMITTER,
    confirmations: 128, // ~5 minutes on Polygon
    gasConfig: {
      maxFeePerGas: '200', // 200 gwei
      maxPriorityFeePerGas: '30', // 30 gwei
    },
    enabled: true,
  });

  // BNB Chain
  chains.set(ChainDomain.BNB, {
    domain: ChainDomain.BNB,
    name: 'BNB Chain',
    type: ChainType.EVM,
    rpcUrl: process.env.BNB_RPC_URL || 'https://bsc-dataseed1.binance.org',
    chainId: 56,
    messageTransmitterAddress: process.env.BNB_MESSAGE_TRANSMITTER,
    confirmations: 15,
    gasConfig: {
      gasPrice: '5', // 5 gwei
    },
    enabled: true,
  });

  // Avalanche
  chains.set(ChainDomain.Avalanche, {
    domain: ChainDomain.Avalanche,
    name: 'Avalanche',
    type: ChainType.EVM,
    rpcUrl: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
    chainId: 43114,
    messageTransmitterAddress: process.env.AVAX_MESSAGE_TRANSMITTER,
    confirmations: 1,
    gasConfig: {
      maxFeePerGas: '30',
      maxPriorityFeePerGas: '2',
    },
    enabled: true,
  });

  // Arbitrum
  chains.set(ChainDomain.Arbitrum, {
    domain: ChainDomain.Arbitrum,
    name: 'Arbitrum',
    type: ChainType.EVM,
    rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    chainId: 42161,
    messageTransmitterAddress: process.env.ARB_MESSAGE_TRANSMITTER,
    confirmations: 1,
    gasConfig: {
      maxFeePerGas: '0.5',
      maxPriorityFeePerGas: '0.01',
    },
    enabled: true,
  });

  // Optimism
  chains.set(ChainDomain.Optimism, {
    domain: ChainDomain.Optimism,
    name: 'Optimism',
    type: ChainType.EVM,
    rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
    chainId: 10,
    messageTransmitterAddress: process.env.OP_MESSAGE_TRANSMITTER,
    confirmations: 1,
    gasConfig: {
      maxFeePerGas: '0.5',
      maxPriorityFeePerGas: '0.01',
    },
    enabled: true,
  });

  // Solana
  chains.set(ChainDomain.Solana, {
    domain: ChainDomain.Solana,
    name: 'Solana',
    type: ChainType.Solana,
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    messageTransmitterAddress: process.env.SOLANA_MESSAGE_TRANSMITTER_PROGRAM,
    confirmations: 1,
    enabled: true,
  });

  // Substrate (Ëtrid)
  chains.set(ChainDomain.Substrate, {
    domain: ChainDomain.Substrate,
    name: 'Ëtrid',
    type: ChainType.Substrate,
    rpcUrl: 'wss://rpc.etrid.network', // Use wsUrl for Substrate
    wsUrl: process.env.SUBSTRATE_WS_URL || 'wss://rpc.etrid.network',
    confirmations: 1,
    enabled: true,
  });

  // Tron
  chains.set(ChainDomain.Tron, {
    domain: ChainDomain.Tron,
    name: 'Tron',
    type: ChainType.Tron,
    rpcUrl: process.env.TRON_RPC_URL || 'https://api.trongrid.io',
    messageTransmitterAddress: process.env.TRON_MESSAGE_TRANSMITTER,
    confirmations: 19, // ~1 minute on Tron
    enabled: false, // Disabled by default
  });

  // 2. Create relayer configuration
  const config: MultiChainRelayerConfig = {
    // Attestation services (multiple for redundancy)
    attestationServiceUrls: [
      process.env.ATTESTATION_SERVICE_URL_1 || 'http://attestation-1.etrid.network',
      process.env.ATTESTATION_SERVICE_URL_2 || 'http://attestation-2.etrid.network',
    ],

    // Relayer identity
    relayerPrivateKey: process.env.RELAYER_PRIVATE_KEY!,
    relayerAddress: process.env.RELAYER_ADDRESS!,

    // Chain configurations
    chains,

    // Signature threshold (M-of-N)
    signatureThreshold: parseInt(process.env.SIGNATURE_THRESHOLD || '2'),
    totalAttestors: parseInt(process.env.TOTAL_ATTESTORS || '3'),

    // Polling & retry settings
    pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS || '30000'), // 30 seconds
    maxRetries: parseInt(process.env.MAX_RETRIES || '5'),
    retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '60000'), // 1 minute
    exponentialBackoff: process.env.EXPONENTIAL_BACKOFF !== 'false',

    // Monitoring
    metricsEnabled: process.env.METRICS_ENABLED !== 'false',
    metricsPort: parseInt(process.env.METRICS_PORT || '9090'),

    // API
    enableApi: process.env.ENABLE_API !== 'false',
    apiPort: parseInt(process.env.API_PORT || '3001'),
  };

  // 3. Create and initialize relayer
  console.log('Creating multi-chain relayer...');
  const relayer = new MultiChainRelayer(config);

  // 4. Setup event handlers
  relayer.on('relaySuccess', (result, duration) => {
    console.log(`✓ Relay succeeded: ${result.chain}`, {
      messageHash: result.messageHash,
      txHash: result.txHash,
      duration: `${duration}s`,
    });

    // Update metrics
    relayerMetrics.recordRelaySuccess(
      result.chain,
      result.chainDomain,
      duration,
      result.gasUsed
    );
  });

  relayer.on('relayFailed', (result) => {
    console.error(`✗ Relay failed: ${result.chain}`, {
      messageHash: result.messageHash,
      error: result.error,
    });

    // Update metrics
    relayerMetrics.recordRelayFailed(
      result.chain,
      result.chainDomain,
      result.error || 'unknown',
      0
    );
  });

  relayer.on('retryNeeded', (relay) => {
    console.log('⟳ Retry needed', {
      messageHash: relay.messageHash,
      attempts: relay.attempts,
      nextRetry: relay.nextRetryTime ? new Date(relay.nextRetryTime).toISOString() : 'N/A',
    });
  });

  // 5. Initialize chains
  console.log('Initializing chain connections...');
  await relayer.initialize();

  // Update connected chains metric
  const connectedChains = relayer.getConnectedChains();
  relayerMetrics.updateChainsConnected(connectedChains.length);

  console.log(`Connected to ${connectedChains.length} chains:`, connectedChains);

  // 6. Start relayer
  console.log('Starting relayer...');
  await relayer.start();

  // 7. Start API server
  let api: RelayerAPI | null = null;
  if (config.enableApi) {
    console.log('Starting API server...');
    api = new RelayerAPI(relayer, config.apiPort);
    await api.start();
    console.log(`API available at http://localhost:${config.apiPort}`);
    console.log(`Metrics available at http://localhost:${config.apiPort}/metrics`);
  }

  // 8. Example: Process attestation
  console.log('\n=== Example: Processing Attestation ===\n');

  const exampleAttestation: Attestation = {
    messageHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    message: '0x000000000000000100000002000000000000000500000000000000000000000000000000000000001234567890000000000000000000000000000000000000000000abcdef1234567890000000000000000000000000000000000000000000000000000000000000',
    signatures: [
      '0xsignature1...',
      '0xsignature2...',
      '0xsignature3...',
    ],
    signatureCount: 3,
    thresholdMet: true,
    status: 'ready',
  };

  // Process attestation
  await relayer.processAttestation(exampleAttestation);

  // 9. Query relay status
  console.log('\n=== Example: Query Relay Status ===\n');

  const relay = relayer.getRelay(exampleAttestation.messageHash);
  console.log('Relay status:', relay);

  // 10. Get statistics
  console.log('\n=== Statistics ===\n');

  const stats = relayer.getStats();
  console.log('Relay stats:', stats);

  const chainStats = relayer.getChainStats();
  console.log('Chain stats:', chainStats);

  const health = relayer.getHealth();
  console.log('Health:', health);

  const totalStats = relayer.getTotalStats();
  console.log('Total stats:', totalStats);

  // 11. Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);

    try {
      // Stop API
      if (api) {
        await api.stop();
        console.log('API stopped');
      }

      // Stop relayer
      await relayer.stop();
      console.log('Relayer stopped');

      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  console.log('\n=== Relayer running ===');
  console.log('Press Ctrl+C to stop\n');
}

// Run example
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };
