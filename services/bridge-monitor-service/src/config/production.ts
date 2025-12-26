/**
 * ËTRID Bridge Monitor Service - Production Configuration
 *
 * SECURITY: This file contains production addresses and endpoints
 * Do NOT commit production RPC API keys to git
 */

export const productionConfig = {
  // ============================================================================
  // NETWORK CONFIGURATION
  // ============================================================================
  environment: 'production' as const,

  // FlareChain (Primearc Core Mainnet)
  flarechain: {
    name: 'Ëtrid Primearc Core Mainnet',
    chainId: 'primearc_core_mainnet',
    wsEndpoint: 'ws://10.0.0.100:9944',
    httpEndpoint: 'http://10.0.0.100:9933',

    // Telemetry
    telemetryUrl: 'wss://telemetry.polkadot.io/submit/',
    telemetryEnabled: true,

    // Native token
    nativeToken: {
      symbol: 'ETR',
      decimals: 18,
      name: 'Ëtrid Token'
    }
  },

  // ============================================================================
  // PARTITION BURST CHAINS (PBCs)
  // ============================================================================
  pbcs: {
    solana: {
      name: 'Sol-PBC',
      chainName: 'Solana',
      network: 'mainnet-beta',
      pbcEndpoint: 'ws://10.0.0.101:9944',
      pbcHttpEndpoint: 'http://10.0.0.101:9933',
      publicEndpoint: 'https://api.mainnet-beta.solana.com',
      explorerUrl: 'https://explorer.solana.com',

      token: {
        name: 'Ëtrid Token',
        symbol: 'ETR',
        address: 'CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp',
        h256Address: '0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f',
        decimals: 9,
        exchangeRate: '1000000000' // 10^9 for 9 decimals
      },

      confirmationBlocks: 32,
      blockTime: 400 // milliseconds
    },

    bnb: {
      name: 'BNB-PBC',
      chainName: 'BNB Smart Chain',
      network: 'mainnet',
      chainId: 56,
      pbcEndpoint: 'ws://10.0.0.102:9944',
      pbcHttpEndpoint: 'http://10.0.0.102:9933',
      publicEndpoint: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
      explorerUrl: 'https://bscscan.com',

      token: {
        name: 'Ëtrid Token',
        symbol: 'ETR',
        address: '0xcc9b37fed77a01329502f8844620577742eb0dc6', // Production BSC ETR address
        decimals: 18,
        exchangeRate: '1000000000000000000' // 10^18 for 18 decimals
      },

      stablecoins: {
        usdt: '0x55d398326f99059fF775485246999027B3197955',
        busd: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
        usdc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'
      },

      confirmationBlocks: 15,
      blockTime: 3000 // milliseconds
    },

    ethereum: {
      name: 'Ethereum-PBC',
      chainName: 'Ethereum',
      network: 'mainnet',
      chainId: 1,
      pbcEndpoint: 'ws://10.0.0.103:9944',
      pbcHttpEndpoint: 'http://10.0.0.103:9933',
      publicEndpoint: process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com',
      explorerUrl: 'https://etherscan.io',

      token: {
        name: 'Ëtrid Token',
        symbol: 'ETR',
        address: process.env.ETR_ETHEREUM_ADDRESS || '', // To be deployed
        decimals: 18,
        exchangeRate: '1000000000000000000'
      },

      // EDSC Cross-Chain Messaging Contracts
      edsc: {
        token: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        attesterRegistry: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        messageTransmitter: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
        tokenMessenger: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'
      },

      confirmationBlocks: 12,
      blockTime: 12000 // milliseconds
    },

    polygon: {
      name: 'Polygon-PBC',
      chainName: 'Polygon',
      network: 'mainnet',
      chainId: 137,
      pbcEndpoint: 'ws://10.0.0.104:9944',
      pbcHttpEndpoint: 'http://10.0.0.104:9933',
      publicEndpoint: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
      explorerUrl: 'https://polygonscan.com',

      token: {
        name: 'Ëtrid Token',
        symbol: 'ETR',
        address: process.env.ETR_POLYGON_ADDRESS || '',
        decimals: 18,
        exchangeRate: '1000000000000000000'
      },

      stablecoins: {
        usdt: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
        usdc: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
      },

      confirmationBlocks: 128,
      blockTime: 2000 // milliseconds
    },

    tron: {
      name: 'Tron-PBC',
      chainName: 'Tron',
      network: 'mainnet',
      pbcEndpoint: 'ws://10.0.0.105:9944',
      pbcHttpEndpoint: 'http://10.0.0.105:9933',
      publicEndpoint: process.env.TRON_RPC_URL || 'https://api.trongrid.io',
      explorerUrl: 'https://tronscan.org',

      token: {
        name: 'Ëtrid Token',
        symbol: 'ETR',
        address: process.env.ETR_TRON_ADDRESS || '',
        decimals: 6,
        exchangeRate: '1000000'
      },

      stablecoins: {
        usdt: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
      },

      confirmationBlocks: 19,
      blockTime: 3000 // milliseconds
    },

    xrp: {
      name: 'XRP-PBC',
      chainName: 'XRP Ledger',
      network: 'mainnet',
      pbcEndpoint: 'ws://10.0.0.106:9944',
      pbcHttpEndpoint: 'http://10.0.0.106:9933',
      publicEndpoint: process.env.XRP_RPC_URL || 'https://s1.ripple.com:51234',
      explorerUrl: 'https://livenet.xrpl.org',

      token: {
        name: 'Ëtrid Token',
        symbol: 'ETR',
        address: process.env.ETR_XRP_ADDRESS || '',
        decimals: 6,
        exchangeRate: '1000000'
      },

      confirmationBlocks: 1,
      blockTime: 4000 // milliseconds
    },

    bitcoin: {
      name: 'Bitcoin-PBC',
      chainName: 'Bitcoin',
      network: 'mainnet',
      pbcEndpoint: 'ws://10.0.0.107:9944',
      pbcHttpEndpoint: 'http://10.0.0.107:9933',
      publicEndpoint: process.env.BITCOIN_RPC_URL || 'https://blockstream.info/api',
      explorerUrl: 'https://blockstream.info',

      token: {
        name: 'Wrapped BTC',
        symbol: 'WBTC',
        address: process.env.WBTC_ADDRESS || '',
        decimals: 8,
        exchangeRate: '100000000'
      },

      confirmationBlocks: 6,
      blockTime: 600000 // 10 minutes in milliseconds
    }
  },

  // ============================================================================
  // BRIDGE OPERATORS & RELAYERS
  // ============================================================================
  operators: {
    // Main operator account (from mainnet config)
    primary: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',

    // Relayer accounts
    relayers: [
      '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
      '5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy'
    ],

    // Validator accounts
    validators: {
      gizzi: {
        accountId: '5Dd8AjjuwKDP8P8sDguiiNKfADAXrACramNbWvLcdLEpGaPJ',
        role: 'AI Overseer'
      },
      eojedred: {
        accountId: '5HYpUK51E1BzhEfiRikhjkNivJiw2WAEG5Uxsrbj5ZE669EM',
        role: 'Founder'
      }
    },

    // EDSC Infrastructure
    edscAccounts: {
      reserveVault: '5Eq5h1KQkzyDStVVaCnizXPHjL6c8HoetjKvzgdPF6i3w7md',
      oracleAuthority: '5GWDz1a6inaKC2vxKgjiY4Miyzv1JUzpHWGRR43LiA5ufZs2',
      custodianManager: '5DhrrecXHiyPaNactHLBgN5bzP1tv7nbNGYjkmJq6UxX2XFk',
      minterAuthority: '5DvgxdPMHmkR6oYsWVkKPUvcFJo6CtSdtKKsHQg8rc9F8s1p',
      emergencyPause: '5EHaSsLMDQhqFdex2DxBx4f6uukfAapkwNQngzkajrhN9xHN'
    },

    // Asset custodians
    custodians: {
      btc: '5EkSL1meXtvAvGgmvXHDtiu6cz7Qn2kkdmJ5N8w44KQ2VMcw',
      eth: '5Ge9ReoKXd4KcdUjh1Swu2a3bnX2e5zUQnqSHhkzvmA8ErKR',
      gold: '5DEvKLfWAcRpTtvkpb3BTpTHkokFV3Xrnth1rZCrA3b2Ekrq',
      usdc: '5CAkWrcGVSF46R6U7JkMCz4Z2GKRs3vmaWRHgphkbv3QXcAn',
      usdt: '5EFVubPpceWrYq2LcQGvD9ogyqd53Ntn4SHjtRUkKzciTx8R'
    }
  },

  // ============================================================================
  // BRIDGE PARAMETERS
  // ============================================================================
  bridgeParameters: {
    // Transfer limits (in native token units with decimals)
    minTransferAmount: '1000000', // 0.000001 ETR minimum
    maxTransferAmount: '1000000000000000', // 1M ETR maximum

    // Fee configuration
    transferFeeBps: 10, // 0.1% = 10 basis points
    feePercent: 0.1,

    // Daily limits per chain (in USD equivalent)
    dailyLimitUSD: 10000000, // $10M daily limit per chain

    // Timeout configurations (in seconds)
    messageTimeout: 3600, // 1 hour
    attestationTimeout: 600, // 10 minutes
    relayTimeout: 300, // 5 minutes

    // Retry configuration
    maxRetries: 5,
    retryDelayMs: 30000, // 30 seconds

    // EDSC-specific limits
    edsc: {
      maxBurnPerTx: '1000000000000000000000000', // 1M EDSC
      dailyBurnLimit: '10000000000000000000000000', // 10M EDSC
      minSignatures: 5, // 5-of-9 threshold
      totalAttesters: 9
    }
  },

  // ============================================================================
  // ATTESTERS (9 Directors)
  // ============================================================================
  attesters: {
    // Threshold configuration
    threshold: {
      minSignatures: 5,
      totalAttesters: 9,
      activeAttesters: 8,
      emergencyBackup: 1,
      description: '5-of-9 threshold with Director-9 as emergency backup'
    },

    // Attester endpoints (Director VMs)
    endpoints: [
      { id: 1, name: 'Director-1', endpoint: 'http://100.93.43.18:3003', publicKey: '0x03974b3a6408b7cec959215fbbbbf19af7c34eaa506b1420d89850662ef9af7d1f', address: '0xA12d48dB2589cfe7ff11a595b80013CffFf5eE3d', active: true },
      { id: 2, name: 'Director-2', endpoint: 'http://100.71.127.127:3003', publicKey: '0x02bb133f8096effc1a2d6671f3797986fba0be082a978c5d15eafe2742f369644f', address: '0x18a6034995CC0c6Db7fC9Ee53E535f5b1984f83e', active: true },
      { id: 3, name: 'Director-3', endpoint: 'http://100.68.185.50:3003', publicKey: '0x024e73743d02d4aedc8d08d444af3e608ba7168836a17b3126d1909432f757b41b', address: '0x574B03172d7e637e2aA645eA9789Fe1E36DdBE33', active: true },
      { id: 4, name: 'Director-4', endpoint: 'http://100.70.73.10:3003', publicKey: '0x03e5b448f4d78125a005b5cbdee8cf5acfcc99905f9e352f27cdf36b20a275b3b4', address: '0x698AEdAd3550e716eDA5C923950caC3aA163883F', active: true },
      { id: 5, name: 'Director-5', endpoint: 'http://100.88.104.58:3003', publicKey: '0x02c8c32311ae5480b65e9db6dd1059d53747117380b63aba243c4d6b8521795171', address: '0xa27f49Bf5a5daa961fECF86526bDa0FD315bE988', active: true },
      { id: 6, name: 'Director-6', endpoint: 'http://100.117.43.53:3003', publicKey: '0x022d2477d1388e282fa0c2987d7f16e68cf57ba15156f321533fb4b31eb79f6a9b', address: '0x6250F01Ca6fcCeB81a1c7E5c2f8A114511188934', active: true },
      { id: 7, name: 'Director-7', endpoint: 'http://100.109.252.56:3003', publicKey: '0x02886bbf04d83c7efcba263123da9c4e502b205f0ccf348dde95e6f81e80a80c72', address: '0x56824F247Bbb54c353025306E860E8edA8877c7b', active: true },
      { id: 8, name: 'Director-8', endpoint: 'http://100.80.84.82:3003', publicKey: '0x0295ff6d4a61254daa701439609e8dbfe99fd541f6e7d609a1229fc449d42209c6', address: '0x64810209643c663D0505806e66Fe5dc0C5cEdB37', active: true },
      { id: 9, name: 'Director-9', endpoint: 'http://100.86.111.37:3003', publicKey: '0x0280cf1c15ea6b78f6a57b449016a0bd0c24bee322afbc5dcba44ea21e9c66abce', address: '0x3D9f108A558f9DDDc3c0881d6eafF7292d64dF92', active: false }, // Emergency backup
    ],

    // Signature collection settings
    collection: {
      timeout: 30000, // 30 seconds per attester
      parallelRequests: true,
      retryAttempts: 3,
      retryDelay: 5000, // 5 seconds between retries
    },

    // Health check settings
    healthCheck: {
      interval: 60000, // 1 minute
      timeout: 10000, // 10 seconds
      unhealthyThreshold: 3, // 3 consecutive failures = unhealthy
    }
  },

  // ============================================================================
  // MONITORING CONFIGURATION
  // ============================================================================
  monitoring: {
    // Health check intervals (in milliseconds)
    healthCheckInterval: 60000, // 1 minute
    metricsCollectionInterval: 30000, // 30 seconds
    eventScanInterval: 10000, // 10 seconds

    // Alert thresholds
    alerts: {
      highTransferVolumeUSD: 100000, // Alert if single transfer > $100k
      pendingTransferThreshold: 10, // Alert if > 10 pending transfers
      failedAttestationThreshold: 3, // Alert if > 3 failed attestations
      relayerBalanceLowETR: '1000000000000000000', // Alert if relayer balance < 1 ETR
      dailyLimitUtilization: 0.8 // Alert if 80% of daily limit used
    },

    // Prometheus metrics
    prometheus: {
      enabled: true,
      port: 9615,
      path: '/metrics'
    },

    // Logging
    logging: {
      level: 'info',
      format: 'json',
      outputs: ['console', 'file'],
      fileRotation: true,
      maxFileSize: '100mb',
      maxFiles: 30
    }
  },

  // ============================================================================
  // EMERGENCY CONTROLS
  // ============================================================================
  emergency: {
    // Circuit breaker thresholds
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5, // Consecutive failures before circuit opens
      resetTimeout: 300000, // 5 minutes before attempting reset
      halfOpenRequests: 3 // Test requests before fully closing circuit
    },

    // Emergency pause contacts
    pauseAuthorities: [
      '5EHaSsLMDQhqFdex2DxBx4f6uukfAapkwNQngzkajrhN9xHN', // Emergency pause account
      '5HQTgrkRhd5h5VE2SsL76S9jAf2xZRCaEoVcFiyGxSPAFciq', // Eoj controller
      '5CAyFg27EJwoTJcj1KHravoqjidEn4XqciKM5q9ukbVSzSbW'  // Gizzi controller
    ],

    // Notification channels
    notifications: {
      email: process.env.EMERGENCY_EMAIL || 'alerts@etrid.network',
      telegram: {
        enabled: true,
        botToken: process.env.TELEGRAM_BOT_TOKEN || '',
        chatId: process.env.TELEGRAM_CHAT_ID || ''
      },
      slack: {
        enabled: false,
        webhookUrl: process.env.SLACK_WEBHOOK_URL || ''
      }
    }
  },

  // ============================================================================
  // GOVERNANCE
  // ============================================================================
  governance: {
    // Sudo multisig (2-of-2)
    sudoMultisig: {
      threshold: 2,
      members: [
        '5HQTgrkRhd5h5VE2SsL76S9jAf2xZRCaEoVcFiyGxSPAFciq', // Eoj controller
        '5CAyFg27EJwoTJcj1KHravoqjidEn4XqciKM5q9ukbVSzSbW'  // Gizzi controller
      ]
    },

    // Proposal thresholds
    proposalThresholds: {
      updateBridgeFee: 'sudo', // Requires sudo multisig
      updateTransferLimits: 'sudo',
      addRelayer: 'sudo',
      removeRelayer: 'sudo',
      pauseBridge: 'emergency', // Can be triggered by emergency authorities
      upgradeBridge: 'sudo'
    }
  }
} as const;

export type ProductionConfig = typeof productionConfig;
