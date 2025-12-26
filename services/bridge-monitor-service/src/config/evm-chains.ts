/**
 * EVM Chain Configurations for Bridge Monitoring
 *
 * Supports: Ethereum, BNB Chain, Polygon, Arbitrum, Base
 *
 * Each chain has specific requirements for:
 * - Block confirmations (security vs speed)
 * - Block times (affects polling intervals)
 * - Gas settings (L1 vs L2 differences)
 * - RPC endpoints (fallback support)
 */

export interface EvmChainConfig {
  // Chain identity
  chainId: number;
  name: string;
  shortName: string;
  domain: number; // CCTP domain ID

  // Network settings
  rpcUrls: string[]; // Primary + fallback RPCs
  wsUrls?: string[]; // WebSocket endpoints (optional)

  // Block confirmation requirements
  confirmations: number; // Required confirmations for finality
  blockTime: number; // Average block time in seconds

  // Contract addresses
  tokenMessengerAddress: string;
  messageTransmitterAddress: string;
  usdcAddress?: string; // Circle USDC address

  // Gas settings
  maxGasPrice: bigint; // Maximum gas price in wei
  gasLimit: number; // Standard gas limit for transactions

  // Monitoring settings
  batchSize: number; // Events to query per batch
  pollingInterval: number; // Milliseconds between polls
  maxRetries: number; // Max retries on RPC failure
  retryDelay: number; // Milliseconds between retries

  // Network characteristics
  isL2: boolean; // Layer 2 chain (faster, cheaper)
  nativeToken: string; // Native token symbol
  explorerUrl: string; // Block explorer base URL

  // Feature flags
  supportsEIP1559: boolean; // EIP-1559 transaction support
  supportsWebSocket: boolean; // WebSocket subscription support
}

/**
 * Ethereum Mainnet Configuration
 * Priority #1 - $38B bridge volume, 70% stablecoin supply
 */
export const ETHEREUM_CONFIG: EvmChainConfig = {
  // Chain identity
  chainId: 1,
  name: 'Ethereum Mainnet',
  shortName: 'ETH',
  domain: 0,

  // Network settings
  rpcUrls: [
    process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY',
    'https://rpc.ankr.com/eth',
    'https://eth.llamarpc.com',
    'https://ethereum.publicnode.com',
  ],
  wsUrls: [
    process.env.ETHEREUM_WS_URL || 'wss://eth-mainnet.g.alchemy.com/v2/YOUR_KEY',
  ],

  // Block confirmation requirements (12 confirmations = ~2.5 minutes)
  confirmations: 12,
  blockTime: 12, // ~12 seconds post-merge

  // Contract addresses (Circle CCTP)
  tokenMessengerAddress: process.env.ETH_TOKEN_MESSENGER || '0xbd3fa81b58ba92a82136038b25adec7066af3155',
  messageTransmitterAddress: process.env.ETH_MESSAGE_TRANSMITTER || '0x0a992d191deec32afe36203ad87d7d289a738f81',
  usdcAddress: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // Circle USDC

  // Gas settings (typical mainnet gas)
  maxGasPrice: 100n * 1_000_000_000n, // 100 gwei
  gasLimit: 200_000,

  // Monitoring settings
  batchSize: 1000, // Query 1000 blocks at a time
  pollingInterval: 12_000, // Poll every 12 seconds (1 block)
  maxRetries: 5,
  retryDelay: 2_000,

  // Network characteristics
  isL2: false,
  nativeToken: 'ETH',
  explorerUrl: 'https://etherscan.io',

  // Feature flags
  supportsEIP1559: true,
  supportsWebSocket: true,
};

/**
 * BNB Chain (BSC) Configuration
 * Priority #5 - $81.9B market cap, $15B+ stablecoin supply
 */
export const BNB_CHAIN_CONFIG: EvmChainConfig = {
  // Chain identity
  chainId: 56,
  name: 'BNB Smart Chain',
  shortName: 'BNB',
  domain: 4,

  // Network settings
  rpcUrls: [
    process.env.BNB_RPC_URL || 'https://bsc-dataseed1.binance.org',
    'https://bsc-dataseed2.binance.org',
    'https://bsc-dataseed3.binance.org',
    'https://bsc-dataseed4.binance.org',
    'https://rpc.ankr.com/bsc',
    'https://bsc.publicnode.com',
  ],
  wsUrls: [
    'wss://bsc-ws-node.nariox.org:443',
  ],

  // Block confirmation requirements (15 confirmations = ~45 seconds)
  confirmations: 15,
  blockTime: 3, // ~3 seconds (post-Maxwell upgrade)

  // Contract addresses
  tokenMessengerAddress: process.env.BNB_TOKEN_MESSENGER || '0x0000000000000000000000000000000000000000', // Update when available
  messageTransmitterAddress: process.env.BNB_MESSAGE_TRANSMITTER || '0x0000000000000000000000000000000000000000',
  usdcAddress: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d', // Binance-Peg USDC

  // Gas settings (very cheap on BSC)
  maxGasPrice: 10n * 1_000_000_000n, // 10 gwei (BSC is cheap)
  gasLimit: 200_000,

  // Monitoring settings (faster blocks = more frequent polling)
  batchSize: 2000, // Query more blocks due to faster block time
  pollingInterval: 3_000, // Poll every 3 seconds (1 block)
  maxRetries: 5,
  retryDelay: 1_000,

  // Network characteristics
  isL2: false, // L1 but with faster blocks
  nativeToken: 'BNB',
  explorerUrl: 'https://bscscan.com',

  // Feature flags
  supportsEIP1559: false, // BSC doesn't support EIP-1559
  supportsWebSocket: true,
};

/**
 * Polygon (Matic) Configuration
 * High-volume chain with 2-second blocks
 */
export const POLYGON_CONFIG: EvmChainConfig = {
  // Chain identity
  chainId: 137,
  name: 'Polygon Mainnet',
  shortName: 'MATIC',
  domain: 3,

  // Network settings
  rpcUrls: [
    process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
    'https://rpc.ankr.com/polygon',
    'https://polygon-bor.publicnode.com',
    'https://polygon.llamarpc.com',
  ],
  wsUrls: [
    process.env.POLYGON_WS_URL || 'wss://polygon-bor.publicnode.com',
  ],

  // Block confirmation requirements (128 confirmations = ~4 minutes)
  confirmations: 128, // Higher due to reorg risk
  blockTime: 2, // ~2 seconds

  // Contract addresses (Circle CCTP)
  tokenMessengerAddress: process.env.POLYGON_TOKEN_MESSENGER || '0x9daF8c91AEFAE50b9c0E69629D3F6Ca40cA3B3FE',
  messageTransmitterAddress: process.env.POLYGON_MESSAGE_TRANSMITTER || '0xF3be9355363857F3e001be68856A2f96b4C39Ba9',
  usdcAddress: '0x2791bca1f2de4661ed88a30c99a7a9449aa84174', // Circle USDC (native)

  // Gas settings (very cheap)
  maxGasPrice: 500n * 1_000_000_000n, // 500 gwei (Polygon uses higher numbers but cheaper in USD)
  gasLimit: 200_000,

  // Monitoring settings (very fast blocks)
  batchSize: 5000, // Large batches due to fast blocks
  pollingInterval: 2_000, // Poll every 2 seconds (1 block)
  maxRetries: 5,
  retryDelay: 1_000,

  // Network characteristics
  isL2: false, // Technically a sidechain, not L2
  nativeToken: 'MATIC',
  explorerUrl: 'https://polygonscan.com',

  // Feature flags
  supportsEIP1559: true,
  supportsWebSocket: true,
};

/**
 * Arbitrum One Configuration
 * Layer 2 rollup with fast finality
 */
export const ARBITRUM_CONFIG: EvmChainConfig = {
  // Chain identity
  chainId: 42161,
  name: 'Arbitrum One',
  shortName: 'ARB',
  domain: 6,

  // Network settings
  rpcUrls: [
    process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
    'https://rpc.ankr.com/arbitrum',
    'https://arbitrum-one.publicnode.com',
    'https://arbitrum.llamarpc.com',
  ],
  wsUrls: [
    process.env.ARBITRUM_WS_URL || 'wss://arbitrum-one.publicnode.com',
  ],

  // Block confirmation requirements (L2 is fast and secure)
  confirmations: 1, // L2 has instant finality
  blockTime: 0.25, // ~250ms (very fast L2 blocks)

  // Contract addresses (Circle CCTP)
  tokenMessengerAddress: process.env.ARBITRUM_TOKEN_MESSENGER || '0x19330d10D9Cc8751218eaf51E8885D058642E08A',
  messageTransmitterAddress: process.env.ARBITRUM_MESSAGE_TRANSMITTER || '0xC30362313FBBA5cf9163F0bb16a0e01f01A896ca',
  usdcAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831', // Circle USDC (native)

  // Gas settings (L2 is very cheap)
  maxGasPrice: 2n * 1_000_000_000n, // 2 gwei (L2 is cheap)
  gasLimit: 200_000,

  // Monitoring settings (very fast L2)
  batchSize: 10000, // Large batches for fast L2
  pollingInterval: 1_000, // Poll every second
  maxRetries: 5,
  retryDelay: 500,

  // Network characteristics
  isL2: true,
  nativeToken: 'ETH',
  explorerUrl: 'https://arbiscan.io',

  // Feature flags
  supportsEIP1559: true,
  supportsWebSocket: true,
};

/**
 * Base Configuration
 * Coinbase's Layer 2 (Optimism fork)
 */
export const BASE_CONFIG: EvmChainConfig = {
  // Chain identity
  chainId: 8453,
  name: 'Base',
  shortName: 'BASE',
  domain: 7,

  // Network settings
  rpcUrls: [
    process.env.BASE_RPC_URL || 'https://mainnet.base.org',
    'https://base.llamarpc.com',
    'https://base.publicnode.com',
    'https://rpc.ankr.com/base',
  ],
  wsUrls: [
    process.env.BASE_WS_URL || 'wss://base.publicnode.com',
  ],

  // Block confirmation requirements (L2 fast finality)
  confirmations: 1, // L2 instant finality
  blockTime: 2, // ~2 seconds (Optimism-based)

  // Contract addresses (Circle CCTP)
  tokenMessengerAddress: process.env.BASE_TOKEN_MESSENGER || '0x1682Ae6375C4E4A97e4B583BC394c861A46D8962',
  messageTransmitterAddress: process.env.BASE_MESSAGE_TRANSMITTER || '0xAD09780d193884d503182aD4588450C416D6F9D4',
  usdcAddress: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', // Circle USDC (native)

  // Gas settings (L2 cheap)
  maxGasPrice: 2n * 1_000_000_000n, // 2 gwei
  gasLimit: 200_000,

  // Monitoring settings
  batchSize: 5000,
  pollingInterval: 2_000, // Poll every 2 seconds
  maxRetries: 5,
  retryDelay: 500,

  // Network characteristics
  isL2: true,
  nativeToken: 'ETH',
  explorerUrl: 'https://basescan.org',

  // Feature flags
  supportsEIP1559: true,
  supportsWebSocket: true,
};

/**
 * Chain registry - map chain ID to configuration
 */
export const CHAIN_CONFIGS: Map<number, EvmChainConfig> = new Map([
  [1, ETHEREUM_CONFIG],
  [56, BNB_CHAIN_CONFIG],
  [137, POLYGON_CONFIG],
  [42161, ARBITRUM_CONFIG],
  [8453, BASE_CONFIG],
]);

/**
 * Get chain configuration by chain ID
 */
export function getChainConfig(chainId: number): EvmChainConfig | undefined {
  return CHAIN_CONFIGS.get(chainId);
}

/**
 * Get chain configuration by domain ID
 */
export function getChainConfigByDomain(domain: number): EvmChainConfig | undefined {
  for (const config of CHAIN_CONFIGS.values()) {
    if (config.domain === domain) {
      return config;
    }
  }
  return undefined;
}

/**
 * Get all configured chains
 */
export function getAllChainConfigs(): EvmChainConfig[] {
  return Array.from(CHAIN_CONFIGS.values());
}

/**
 * Validate chain configuration
 */
export function validateChainConfig(config: EvmChainConfig): string[] {
  const errors: string[] = [];

  if (!config.chainId || config.chainId <= 0) {
    errors.push('Invalid chain ID');
  }

  if (!config.rpcUrls || config.rpcUrls.length === 0) {
    errors.push('No RPC URLs configured');
  }

  if (config.confirmations < 0) {
    errors.push('Invalid confirmations count');
  }

  if (config.blockTime <= 0) {
    errors.push('Invalid block time');
  }

  if (!config.tokenMessengerAddress || config.tokenMessengerAddress === '0x0000000000000000000000000000000000000000') {
    errors.push('TokenMessenger address not configured');
  }

  if (!config.messageTransmitterAddress || config.messageTransmitterAddress === '0x0000000000000000000000000000000000000000') {
    errors.push('MessageTransmitter address not configured');
  }

  return errors;
}

/**
 * Get recommended polling interval based on block time and confirmations
 */
export function getRecommendedPollingInterval(config: EvmChainConfig): number {
  // Poll at block time frequency, but not faster than 500ms
  const baseInterval = config.blockTime * 1000;
  return Math.max(baseInterval, 500);
}

/**
 * Calculate finality time in seconds
 */
export function calculateFinalityTime(config: EvmChainConfig): number {
  return config.confirmations * config.blockTime;
}

/**
 * Environment variable helpers
 */
export function loadChainConfigFromEnv(chainId: number): Partial<EvmChainConfig> {
  const prefix = getEnvPrefix(chainId);

  return {
    rpcUrls: process.env[`${prefix}_RPC_URL`] ? [process.env[`${prefix}_RPC_URL`]!] : undefined,
    wsUrls: process.env[`${prefix}_WS_URL`] ? [process.env[`${prefix}_WS_URL`]!] : undefined,
    tokenMessengerAddress: process.env[`${prefix}_TOKEN_MESSENGER`],
    messageTransmitterAddress: process.env[`${prefix}_MESSAGE_TRANSMITTER`],
    usdcAddress: process.env[`${prefix}_USDC_ADDRESS`],
  };
}

function getEnvPrefix(chainId: number): string {
  switch (chainId) {
    case 1: return 'ETHEREUM';
    case 56: return 'BNB';
    case 137: return 'POLYGON';
    case 42161: return 'ARBITRUM';
    case 8453: return 'BASE';
    default: return `CHAIN_${chainId}`;
  }
}
