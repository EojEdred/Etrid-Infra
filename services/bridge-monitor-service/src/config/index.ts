/**
 * ËTRID Bridge Monitor Service - Configuration Index
 *
 * Central export for all configuration modules
 */

import { productionConfig, type ProductionConfig } from './production';
import { testnetConfig, type TestnetConfig } from './testnet';
import {
  EDSC_ABI,
  MESSAGE_TRANSMITTER_ABI,
  TOKEN_MESSENGER_ABI,
  ATTESTER_REGISTRY_ABI,
  ERC20_ABI,
  PAIR_ABI,
  FACTORY_ABI,
  ETHEREUM_MAINNET_CONTRACTS,
  BSC_MAINNET_DEX,
  BSC_MAINNET_TOKENS,
  SOLANA_MAINNET_TOKENS,
  DOMAINS,
  getContractAddress,
  getTokenAddress,
  getDexFactory,
  type CrossChainMessage,
  type BurnMessage,
  type OutboundMessage,
  type DomainId
} from './contracts';
import {
  ETHEREUM_RPC_ENDPOINTS,
  BSC_RPC_ENDPOINTS,
  POLYGON_RPC_ENDPOINTS,
  ARBITRUM_RPC_ENDPOINTS,
  BASE_RPC_ENDPOINTS,
  SOLANA_RPC_ENDPOINTS,
  TRON_RPC_ENDPOINTS,
  XRP_RPC_ENDPOINTS,
  BITCOIN_RPC_ENDPOINTS,
  FLARECHAIN_RPC_ENDPOINTS,
  PBC_RPC_ENDPOINTS,
  TESTNET_RPC_ENDPOINTS,
  getRpcEndpoints,
  getPrimaryRpcUrls,
  getFallbackRpcUrls,
  getWebsocketUrls,
  type RpcEndpointConfig
} from './rpc-endpoints';

// ============================================================================
// CONFIGURATION SELECTOR
// ============================================================================

/**
 * Get configuration based on environment
 */
export function getConfig(): ProductionConfig | TestnetConfig {
  const env = process.env.NETWORK_ENV || process.env.NODE_ENV || 'production';

  if (env === 'testnet' || env === 'development' || env === 'test') {
    return testnetConfig;
  }

  return productionConfig;
}

/**
 * Check if running in production
 */
export function isProduction(): boolean {
  const env = process.env.NETWORK_ENV || process.env.NODE_ENV || 'production';
  return env === 'production' || env === 'mainnet';
}

/**
 * Check if running in testnet
 */
export function isTestnet(): boolean {
  return !isProduction();
}

// ============================================================================
// EXPORTS
// ============================================================================

// Configuration objects
export {
  productionConfig,
  testnetConfig,
  type ProductionConfig,
  type TestnetConfig
};

// Contract ABIs and addresses
export {
  EDSC_ABI,
  MESSAGE_TRANSMITTER_ABI,
  TOKEN_MESSENGER_ABI,
  ATTESTER_REGISTRY_ABI,
  ERC20_ABI,
  PAIR_ABI,
  FACTORY_ABI,
  ETHEREUM_MAINNET_CONTRACTS,
  BSC_MAINNET_DEX,
  BSC_MAINNET_TOKENS,
  SOLANA_MAINNET_TOKENS,
  DOMAINS,
  getContractAddress,
  getTokenAddress,
  getDexFactory,
  type CrossChainMessage,
  type BurnMessage,
  type OutboundMessage,
  type DomainId
};

// RPC Endpoints
export {
  ETHEREUM_RPC_ENDPOINTS,
  BSC_RPC_ENDPOINTS,
  POLYGON_RPC_ENDPOINTS,
  ARBITRUM_RPC_ENDPOINTS,
  BASE_RPC_ENDPOINTS,
  SOLANA_RPC_ENDPOINTS,
  TRON_RPC_ENDPOINTS,
  XRP_RPC_ENDPOINTS,
  BITCOIN_RPC_ENDPOINTS,
  FLARECHAIN_RPC_ENDPOINTS,
  PBC_RPC_ENDPOINTS,
  TESTNET_RPC_ENDPOINTS,
  getRpcEndpoints,
  getPrimaryRpcUrls,
  getFallbackRpcUrls,
  getWebsocketUrls,
  type RpcEndpointConfig
};

// Default export
export default {
  getConfig,
  isProduction,
  isTestnet,
  productionConfig,
  testnetConfig,
  contracts: {
    EDSC_ABI,
    MESSAGE_TRANSMITTER_ABI,
    TOKEN_MESSENGER_ABI,
    ATTESTER_REGISTRY_ABI,
    ERC20_ABI,
    PAIR_ABI,
    FACTORY_ABI,
    ETHEREUM_MAINNET_CONTRACTS,
    BSC_MAINNET_DEX,
    BSC_MAINNET_TOKENS,
    SOLANA_MAINNET_TOKENS,
    DOMAINS,
    getContractAddress,
    getTokenAddress,
    getDexFactory
  },
  rpc: {
    ETHEREUM_RPC_ENDPOINTS,
    BSC_RPC_ENDPOINTS,
    POLYGON_RPC_ENDPOINTS,
    ARBITRUM_RPC_ENDPOINTS,
    BASE_RPC_ENDPOINTS,
    SOLANA_RPC_ENDPOINTS,
    TRON_RPC_ENDPOINTS,
    XRP_RPC_ENDPOINTS,
    BITCOIN_RPC_ENDPOINTS,
    FLARECHAIN_RPC_ENDPOINTS,
    PBC_RPC_ENDPOINTS,
    TESTNET_RPC_ENDPOINTS,
    getRpcEndpoints,
    getPrimaryRpcUrls,
    getFallbackRpcUrls,
    getWebsocketUrls
  }
};
