/**
 * ËTRID Bridge Monitor Service - RPC Endpoints Configuration
 *
 * Production RPC URLs with fallback support and rate limiting
 */

// ============================================================================
// ETHEREUM MAINNET RPC ENDPOINTS
// ============================================================================
export const ETHEREUM_RPC_ENDPOINTS = {
  primary: [
    process.env.ETHEREUM_RPC_PRIMARY || 'https://eth.llamarpc.com',
    process.env.ALCHEMY_ETHEREUM_URL || '',
    process.env.INFURA_ETHEREUM_URL || ''
  ].filter(Boolean),

  fallback: [
    'https://rpc.ankr.com/eth',
    'https://eth-mainnet.public.blastapi.io',
    'https://ethereum.publicnode.com',
    'https://cloudflare-eth.com',
    'https://eth.drpc.org'
  ],

  websocket: [
    process.env.ETHEREUM_WS_PRIMARY || '',
    process.env.ALCHEMY_ETHEREUM_WS || '',
    process.env.INFURA_ETHEREUM_WS || ''
  ].filter(Boolean),

  rateLimit: {
    requestsPerSecond: 10,
    maxConcurrent: 5,
    timeout: 30000 // 30 seconds
  }
} as const;

// ============================================================================
// BSC MAINNET RPC ENDPOINTS
// ============================================================================
export const BSC_RPC_ENDPOINTS = {
  primary: [
    process.env.BSC_RPC_PRIMARY || 'https://bsc-dataseed.binance.org',
    process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org',
    'https://bsc-dataseed2.binance.org',
    'https://bsc-dataseed3.binance.org'
  ],

  fallback: [
    'https://bsc-dataseed4.binance.org',
    'https://rpc.ankr.com/bsc',
    'https://bsc-mainnet.public.blastapi.io',
    'https://bsc.publicnode.com',
    'https://bsc.drpc.org',
    'https://bsc-pokt.nodies.app'
  ],

  websocket: [
    'wss://bsc-ws-node.nariox.org:443',
    'wss://bsc.publicnode.com'
  ],

  rateLimit: {
    requestsPerSecond: 15,
    maxConcurrent: 10,
    timeout: 20000
  }
} as const;

// ============================================================================
// POLYGON MAINNET RPC ENDPOINTS
// ============================================================================
export const POLYGON_RPC_ENDPOINTS = {
  primary: [
    process.env.POLYGON_RPC_PRIMARY || 'https://polygon-rpc.com',
    process.env.ALCHEMY_POLYGON_URL || '',
    process.env.INFURA_POLYGON_URL || ''
  ].filter(Boolean),

  fallback: [
    'https://rpc-mainnet.matic.network',
    'https://rpc-mainnet.maticvigil.com',
    'https://rpc.ankr.com/polygon',
    'https://polygon-mainnet.public.blastapi.io',
    'https://polygon.publicnode.com',
    'https://polygon.drpc.org'
  ],

  websocket: [
    process.env.POLYGON_WS_PRIMARY || '',
    'wss://polygon-mainnet.public.blastapi.io',
    'wss://polygon.publicnode.com'
  ].filter(Boolean),

  rateLimit: {
    requestsPerSecond: 12,
    maxConcurrent: 8,
    timeout: 25000
  }
} as const;

// ============================================================================
// ARBITRUM MAINNET RPC ENDPOINTS
// ============================================================================
export const ARBITRUM_RPC_ENDPOINTS = {
  primary: [
    process.env.ARBITRUM_RPC_PRIMARY || 'https://arb1.arbitrum.io/rpc',
    process.env.ALCHEMY_ARBITRUM_URL || '',
    process.env.INFURA_ARBITRUM_URL || ''
  ].filter(Boolean),

  fallback: [
    'https://arbitrum-one.public.blastapi.io',
    'https://rpc.ankr.com/arbitrum',
    'https://arbitrum.publicnode.com',
    'https://arbitrum.drpc.org'
  ],

  websocket: [
    process.env.ARBITRUM_WS_PRIMARY || '',
    'wss://arbitrum-one.publicnode.com'
  ].filter(Boolean),

  rateLimit: {
    requestsPerSecond: 10,
    maxConcurrent: 5,
    timeout: 30000
  }
} as const;

// ============================================================================
// BASE MAINNET RPC ENDPOINTS
// ============================================================================
export const BASE_RPC_ENDPOINTS = {
  primary: [
    process.env.BASE_RPC_PRIMARY || 'https://mainnet.base.org',
    process.env.ALCHEMY_BASE_URL || '',
    'https://base.llamarpc.com'
  ].filter(Boolean),

  fallback: [
    'https://base.publicnode.com',
    'https://base.drpc.org',
    'https://base-mainnet.public.blastapi.io',
    'https://rpc.ankr.com/base'
  ],

  websocket: [
    process.env.BASE_WS_PRIMARY || '',
    'wss://base.publicnode.com'
  ].filter(Boolean),

  rateLimit: {
    requestsPerSecond: 10,
    maxConcurrent: 5,
    timeout: 30000
  }
} as const;

// ============================================================================
// SOLANA MAINNET RPC ENDPOINTS
// ============================================================================
export const SOLANA_RPC_ENDPOINTS = {
  primary: [
    process.env.SOLANA_RPC_PRIMARY || 'https://api.mainnet-beta.solana.com',
    process.env.HELIUS_SOLANA_URL || '',
    process.env.QUICKNODE_SOLANA_URL || ''
  ].filter(Boolean),

  fallback: [
    'https://solana-api.projectserum.com',
    'https://rpc.ankr.com/solana',
    'https://solana.publicnode.com',
    'https://solana-mainnet.rpc.extrnode.com'
  ],

  websocket: [
    process.env.SOLANA_WS_PRIMARY || 'wss://api.mainnet-beta.solana.com',
    'wss://solana.publicnode.com'
  ],

  rateLimit: {
    requestsPerSecond: 5, // Solana has stricter limits
    maxConcurrent: 3,
    timeout: 60000 // Solana can be slower
  }
} as const;

// ============================================================================
// TRON MAINNET RPC ENDPOINTS
// ============================================================================
export const TRON_RPC_ENDPOINTS = {
  primary: [
    process.env.TRON_RPC_PRIMARY || 'https://api.trongrid.io',
    process.env.TRONSTACK_API_URL || ''
  ].filter(Boolean),

  fallback: [
    'https://api.tronstack.io',
    'https://tron.public.blastapi.io'
  ],

  websocket: [],

  rateLimit: {
    requestsPerSecond: 5,
    maxConcurrent: 3,
    timeout: 30000
  }
} as const;

// ============================================================================
// XRP LEDGER RPC ENDPOINTS
// ============================================================================
export const XRP_RPC_ENDPOINTS = {
  primary: [
    process.env.XRP_RPC_PRIMARY || 'https://s1.ripple.com:51234',
    'https://s2.ripple.com:51234'
  ],

  fallback: [
    'https://xrplcluster.com',
    'https://xrpl.ws'
  ],

  websocket: [
    'wss://s1.ripple.com',
    'wss://s2.ripple.com',
    'wss://xrplcluster.com',
    'wss://xrpl.ws'
  ],

  rateLimit: {
    requestsPerSecond: 10,
    maxConcurrent: 5,
    timeout: 20000
  }
} as const;

// ============================================================================
// BITCOIN RPC ENDPOINTS (via API services)
// ============================================================================
export const BITCOIN_RPC_ENDPOINTS = {
  primary: [
    process.env.BITCOIN_RPC_PRIMARY || 'https://blockstream.info/api',
    process.env.BLOCKCHAIN_INFO_API || ''
  ].filter(Boolean),

  fallback: [
    'https://mempool.space/api',
    'https://api.blockcypher.com/v1/btc/main'
  ],

  websocket: [],

  rateLimit: {
    requestsPerSecond: 2, // Very conservative for public APIs
    maxConcurrent: 2,
    timeout: 60000
  }
} as const;

// ============================================================================
// FLARECHAIN (PRIMEARC CORE) ENDPOINTS
// ============================================================================
export const FLARECHAIN_RPC_ENDPOINTS = {
  primary: [
    'ws://10.0.0.100:9944'
  ],

  http: [
    'http://10.0.0.100:9933'
  ],

  fallback: [
    process.env.FLARECHAIN_BACKUP_WS || '',
    process.env.FLARECHAIN_BACKUP_HTTP || ''
  ].filter(Boolean),

  rateLimit: {
    requestsPerSecond: 20, // Internal network, higher limit
    maxConcurrent: 15,
    timeout: 10000
  }
} as const;

// ============================================================================
// PBC NODE ENDPOINTS
// ============================================================================
export const PBC_RPC_ENDPOINTS = {
  solana: {
    ws: 'ws://10.0.0.101:9944',
    http: 'http://10.0.0.101:9933'
  },
  bnb: {
    ws: 'ws://10.0.0.102:9944',
    http: 'http://10.0.0.102:9933'
  },
  ethereum: {
    ws: 'ws://10.0.0.103:9944',
    http: 'http://10.0.0.103:9933'
  },
  polygon: {
    ws: 'ws://10.0.0.104:9944',
    http: 'http://10.0.0.104:9933'
  },
  tron: {
    ws: 'ws://10.0.0.105:9944',
    http: 'http://10.0.0.105:9933'
  },
  xrp: {
    ws: 'ws://10.0.0.106:9944',
    http: 'http://10.0.0.106:9933'
  },
  bitcoin: {
    ws: 'ws://10.0.0.107:9944',
    http: 'http://10.0.0.107:9933'
  }
} as const;

// ============================================================================
// TESTNET RPC ENDPOINTS
// ============================================================================
export const TESTNET_RPC_ENDPOINTS = {
  sepolia: {
    primary: [
      process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
      'https://ethereum-sepolia.publicnode.com'
    ],
    fallback: [
      'https://rpc2.sepolia.org',
      'https://sepolia.drpc.org'
    ]
  },

  bscTestnet: {
    primary: [
      'https://data-seed-prebsc-1-s1.binance.org:8545',
      'https://data-seed-prebsc-2-s1.binance.org:8545'
    ],
    fallback: [
      'https://bsc-testnet.public.blastapi.io',
      'https://bsc-testnet.publicnode.com'
    ]
  },

  mumbai: {
    primary: [
      'https://rpc-mumbai.maticvigil.com',
      'https://polygon-mumbai.g.alchemy.com/v2/' + (process.env.ALCHEMY_API_KEY || '')
    ].filter(url => !url.endsWith('/')),
    fallback: [
      'https://polygon-mumbai.publicnode.com',
      'https://rpc.ankr.com/polygon_mumbai'
    ]
  },

  solanaDevnet: {
    primary: [
      'https://api.devnet.solana.com'
    ],
    fallback: [
      'https://devnet.solana.com'
    ]
  }
} as const;

// ============================================================================
// RPC ENDPOINT SELECTOR
// ============================================================================

export interface RpcEndpointConfig {
  primary: string[];
  fallback: string[];
  websocket?: string[];
  rateLimit: {
    requestsPerSecond: number;
    maxConcurrent: number;
    timeout: number;
  };
}

/**
 * Get RPC endpoints for a specific chain
 */
export function getRpcEndpoints(
  chain: 'ethereum' | 'bsc' | 'polygon' | 'arbitrum' | 'base' | 'solana' | 'tron' | 'xrp' | 'bitcoin',
  network: 'mainnet' | 'testnet' = 'mainnet'
): RpcEndpointConfig {
  if (network === 'testnet') {
    const testnetMap = {
      ethereum: TESTNET_RPC_ENDPOINTS.sepolia,
      bsc: TESTNET_RPC_ENDPOINTS.bscTestnet,
      polygon: TESTNET_RPC_ENDPOINTS.mumbai,
      solana: TESTNET_RPC_ENDPOINTS.solanaDevnet
    };

    const endpoints = testnetMap[chain as keyof typeof testnetMap];
    if (endpoints) {
      return {
        ...endpoints,
        websocket: [],
        rateLimit: {
          requestsPerSecond: 5,
          maxConcurrent: 3,
          timeout: 30000
        }
      };
    }
  }

  const endpointMap = {
    ethereum: ETHEREUM_RPC_ENDPOINTS,
    bsc: BSC_RPC_ENDPOINTS,
    polygon: POLYGON_RPC_ENDPOINTS,
    arbitrum: ARBITRUM_RPC_ENDPOINTS,
    base: BASE_RPC_ENDPOINTS,
    solana: SOLANA_RPC_ENDPOINTS,
    tron: TRON_RPC_ENDPOINTS,
    xrp: XRP_RPC_ENDPOINTS,
    bitcoin: BITCOIN_RPC_ENDPOINTS
  };

  return endpointMap[chain];
}

/**
 * Get all primary RPC URLs for a chain
 */
export function getPrimaryRpcUrls(chain: string): string[] {
  const endpoints = getRpcEndpoints(chain as any);
  return endpoints.primary;
}

/**
 * Get all fallback RPC URLs for a chain
 */
export function getFallbackRpcUrls(chain: string): string[] {
  const endpoints = getRpcEndpoints(chain as any);
  return endpoints.fallback;
}

/**
 * Get websocket URLs for a chain
 */
export function getWebsocketUrls(chain: string): string[] {
  const endpoints = getRpcEndpoints(chain as any);
  return endpoints.websocket || [];
}
