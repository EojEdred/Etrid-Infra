/**
 * Chain configurations for Ëtrid Bridge Monitor
 * Based on real contract addresses from the codebase
 */

import {
  BridgeMonitorConfig,
  SubstrateConfig,
  EthereumConfig,
  SolanaConfig,
  BitcoinConfig,
  TronConfig,
  XrpConfig,
  BscConfig,
  PolygonConfig,
} from '../types';

export class ChainConfigurations {
  /**
   * Load main service configuration from environment
   */
  static loadServiceConfig(): BridgeMonitorConfig {
    return {
      // Service settings
      port: parseInt(process.env.PORT || '3001'),
      metricsPort: parseInt(process.env.METRICS_PORT || '9091'),
      logLevel: process.env.LOG_LEVEL || 'info',
      redisUrl: process.env.REDIS_URL,

      // Monitor toggles
      monitorEthereum: process.env.MONITOR_ETHEREUM === 'true',
      monitorSolana: process.env.MONITOR_SOLANA === 'true',
      monitorBitcoin: process.env.MONITOR_BITCOIN === 'true',
      monitorTron: process.env.MONITOR_TRON === 'true',
      monitorXrp: process.env.MONITOR_XRP === 'true',
      monitorBsc: process.env.MONITOR_BSC === 'true',
      monitorPolygon: process.env.MONITOR_POLYGON === 'true',
      monitorSubstrate: process.env.MONITOR_SUBSTRATE === 'true',

      // Alert settings
      alertStuckTransferHours: parseInt(process.env.ALERT_STUCK_TRANSFER_HOURS || '24'),
      alertLowBalanceThreshold: BigInt(
        process.env.ALERT_LOW_BALANCE_THRESHOLD || '1000000000000000000'
      ),
      eventRetentionHours: parseInt(process.env.EVENT_RETENTION_HOURS || '168'),
      healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '30'),

      // Notification settings
      alertWebhookUrl: process.env.ALERT_WEBHOOK_URL,
      slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
      smtpHost: process.env.SMTP_HOST,
      smtpPort: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : undefined,
      smtpUser: process.env.SMTP_USER,
      smtpPassword: process.env.SMTP_PASSWORD,
      alertEmailTo: process.env.ALERT_EMAIL_TO,
    };
  }

  /**
   * Load Substrate/Polkadot configuration (Ëtrid FlareChain)
   */
  static loadSubstrateConfig(): SubstrateConfig {
    return {
      wsUrl: process.env.SUBSTRATE_WS_URL || 'wss://rpc.etrid.io',
      chainId: parseInt(process.env.SUBSTRATE_CHAIN_ID || '2'),
      pollInterval: parseInt(process.env.SUBSTRATE_POLL_INTERVAL || '6000'),
      confirmations: parseInt(process.env.SUBSTRATE_CONFIRMATIONS || '2'),
    };
  }

  /**
   * Load Ethereum Mainnet configuration
   */
  static loadEthereumConfig(): EthereumConfig {
    return {
      rpcUrl:
        process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/YOUR_API_KEY',
      wsUrl: process.env.ETHEREUM_WS_URL,
      chainId: parseInt(process.env.ETHEREUM_CHAIN_ID || '1'),
      confirmations: parseInt(process.env.ETHEREUM_CONFIRMATIONS || '12'),
      bridgeAddress: process.env.ETHEREUM_BRIDGE_ADDRESS,
      messageTransmitter: process.env.ETHEREUM_MESSAGE_TRANSMITTER,
      tokenMessenger: process.env.ETHEREUM_TOKEN_MESSENGER,
      etrTokenAddress: process.env.ETR_ETHEREUM_ADDRESS,
      edscTokenAddress: process.env.EDSC_ETHEREUM_ADDRESS,
    };
  }

  /**
   * Load Solana configuration
   */
  static loadSolanaConfig(): SolanaConfig {
    return {
      rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
      wsUrl: process.env.SOLANA_WS_URL,
      cluster: process.env.SOLANA_CLUSTER || 'mainnet-beta',
      commitment: process.env.SOLANA_COMMITMENT || 'finalized',
      bridgeProgram: process.env.SOLANA_BRIDGE_PROGRAM,
      etrMint: process.env.ETR_SOLANA_MINT,
      edscMint: process.env.EDSC_SOLANA_MINT,
    };
  }

  /**
   * Load Bitcoin configuration
   */
  static loadBitcoinConfig(): BitcoinConfig {
    return {
      rpcUrl: process.env.BITCOIN_RPC_URL || 'https://blockstream.info/api',
      network: process.env.BITCOIN_NETWORK || 'mainnet',
      bridgeAddress: process.env.BITCOIN_BRIDGE_ADDRESS,
      confirmations: parseInt(process.env.BITCOIN_CONFIRMATIONS || '6'),
      pollInterval: parseInt(process.env.BITCOIN_POLL_INTERVAL || '60000'),
    };
  }

  /**
   * Load Tron configuration
   */
  static loadTronConfig(): TronConfig {
    return {
      fullNode: process.env.TRON_FULL_NODE || 'https://api.trongrid.io',
      solidityNode: process.env.TRON_SOLIDITY_NODE || 'https://api.trongrid.io',
      eventServer: process.env.TRON_EVENT_SERVER || 'https://api.trongrid.io',
      apiKey: process.env.TRON_API_KEY,
      bridgeAddress: process.env.TRON_BRIDGE_ADDRESS,
      etrAddress: process.env.ETR_TRON_ADDRESS,
      edscAddress: process.env.EDSC_TRON_ADDRESS,
      confirmations: parseInt(process.env.TRON_CONFIRMATIONS || '19'),
    };
  }

  /**
   * Load XRP Ledger configuration
   */
  static loadXrpConfig(): XrpConfig {
    return {
      server: process.env.XRP_SERVER || 'wss://xrplcluster.com',
      network: process.env.XRP_NETWORK || 'mainnet',
      bridgeAddress: process.env.XRP_BRIDGE_ADDRESS,
      ledgerOffset: parseInt(process.env.XRP_LEDGER_OFFSET || '8'),
    };
  }

  /**
   * Load BNB Smart Chain configuration
   */
  static loadBscConfig(): BscConfig {
    return {
      rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
      wsUrl: process.env.BSC_WS_URL,
      chainId: parseInt(process.env.BSC_CHAIN_ID || '56'),
      confirmations: parseInt(process.env.BSC_CONFIRMATIONS || '15'),
      bridgeAddress: process.env.BSC_BRIDGE_ADDRESS,
      etrTokenAddress: process.env.ETR_BSC_ADDRESS,
      edscTokenAddress: process.env.EDSC_BSC_ADDRESS,
    };
  }

  /**
   * Load Polygon configuration
   */
  static loadPolygonConfig(): PolygonConfig {
    return {
      rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
      wsUrl: process.env.POLYGON_WS_URL,
      chainId: parseInt(process.env.POLYGON_CHAIN_ID || '137'),
      confirmations: parseInt(process.env.POLYGON_CONFIRMATIONS || '128'),
      bridgeAddress: process.env.POLYGON_BRIDGE_ADDRESS,
      etrTokenAddress: process.env.ETR_POLYGON_ADDRESS,
      edscTokenAddress: process.env.EDSC_POLYGON_ADDRESS,
    };
  }
}

/**
 * Domain IDs for EDSC bridge protocol
 * Matches the Domain enum in attestation-service
 */
export enum DomainId {
  Ethereum = 0,
  Solana = 1,
  Etrid = 2,
  Polygon = 3,
  BnbChain = 4,
  Avalanche = 5,
  Arbitrum = 6,
  Optimism = 7,
  Bitcoin = 8,
  Tron = 9,
  Xrp = 10,
}

/**
 * Chain name to domain ID mapping
 */
export const CHAIN_TO_DOMAIN: Record<string, number> = {
  ethereum: DomainId.Ethereum,
  solana: DomainId.Solana,
  substrate: DomainId.Etrid,
  polygon: DomainId.Polygon,
  bsc: DomainId.BnbChain,
  bitcoin: DomainId.Bitcoin,
  tron: DomainId.Tron,
  xrp: DomainId.Xrp,
};

/**
 * Domain ID to chain name mapping
 */
export const DOMAIN_TO_CHAIN: Record<number, string> = {
  [DomainId.Ethereum]: 'ethereum',
  [DomainId.Solana]: 'solana',
  [DomainId.Etrid]: 'substrate',
  [DomainId.Polygon]: 'polygon',
  [DomainId.BnbChain]: 'bsc',
  [DomainId.Bitcoin]: 'bitcoin',
  [DomainId.Tron]: 'tron',
  [DomainId.Xrp]: 'xrp',
};

/**
 * Native token decimals by chain
 */
export const CHAIN_DECIMALS: Record<string, number> = {
  ethereum: 18,
  solana: 9,
  substrate: 12,
  polygon: 18,
  bsc: 18,
  bitcoin: 8,
  tron: 6,
  xrp: 6,
};

/**
 * Block time estimates (in milliseconds)
 */
export const BLOCK_TIME_MS: Record<string, number> = {
  ethereum: 12000,
  solana: 400,
  substrate: 6000,
  polygon: 2000,
  bsc: 3000,
  bitcoin: 600000,
  tron: 3000,
  xrp: 3500,
};

/**
 * Expected finality time (in seconds)
 */
export const FINALITY_TIME_SEC: Record<string, number> = {
  ethereum: 12 * 60, // 12 minutes
  solana: 30, // 30 seconds
  substrate: 12, // 2 blocks
  polygon: 256, // 128 blocks * 2 sec
  bsc: 45, // 15 blocks * 3 sec
  bitcoin: 3600, // 6 blocks * 10 min
  tron: 57, // 19 blocks * 3 sec
  xrp: 28, // 8 ledgers * 3.5 sec
};
