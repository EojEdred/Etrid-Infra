/**
 * ËTRID Bridge Monitor Service - Testnet Configuration
 *
 * Configuration for testing bridge monitors on testnets
 */

export const testnetConfig = {
  // ============================================================================
  // NETWORK CONFIGURATION
  // ============================================================================
  environment: 'testnet' as const,

  // FlareChain Testnet
  flarechain: {
    name: 'Ëtrid Primearc Testnet',
    chainId: 'primearc_testnet',
    wsEndpoint: 'ws://localhost:9944',
    httpEndpoint: 'http://localhost:9933',
    telemetryUrl: 'wss://telemetry.polkadot.io/submit/',
    telemetryEnabled: false,

    nativeToken: {
      symbol: 'tETR',
      decimals: 18,
      name: 'Testnet Ëtrid Token'
    }
  },

  // ============================================================================
  // PARTITION BURST CHAINS (Testnets)
  // ============================================================================
  pbcs: {
    solana: {
      name: 'Sol-PBC-Testnet',
      chainName: 'Solana',
      network: 'devnet',
      pbcEndpoint: 'ws://localhost:9945',
      pbcHttpEndpoint: 'http://localhost:9934',
      publicEndpoint: 'https://api.devnet.solana.com',
      explorerUrl: 'https://explorer.solana.com/?cluster=devnet',

      token: {
        name: 'Testnet Ëtrid Token',
        symbol: 'tETR',
        address: process.env.SOLANA_TESTNET_ETR || '',
        h256Address: '',
        decimals: 9,
        exchangeRate: '1000000000'
      },

      confirmationBlocks: 32,
      blockTime: 400
    },

    bnb: {
      name: 'BNB-PBC-Testnet',
      chainName: 'BNB Smart Chain Testnet',
      network: 'testnet',
      chainId: 97,
      pbcEndpoint: 'ws://localhost:9946',
      pbcHttpEndpoint: 'http://localhost:9935',
      publicEndpoint: 'https://data-seed-prebsc-1-s1.binance.org:8545',
      explorerUrl: 'https://testnet.bscscan.com',

      token: {
        name: 'Testnet Ëtrid Token',
        symbol: 'tETR',
        address: process.env.BSC_TESTNET_ETR || '',
        decimals: 18,
        exchangeRate: '1000000000000000000'
      },

      stablecoins: {
        usdt: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
        busd: '0xeD24FC36d5Ee211Ea25A80239Fb8C4Cfd80f12Ee',
        usdc: '0x64544969ed7EBf5f083679233325356EbE738930'
      },

      confirmationBlocks: 3, // Faster for testing
      blockTime: 3000
    },

    ethereum: {
      name: 'Ethereum-PBC-Testnet',
      chainName: 'Sepolia',
      network: 'sepolia',
      chainId: 11155111,
      pbcEndpoint: 'ws://localhost:9947',
      pbcHttpEndpoint: 'http://localhost:9936',
      publicEndpoint: process.env.SEPOLIA_RPC_URL || 'https://rpc.sepolia.org',
      explorerUrl: 'https://sepolia.etherscan.io',

      token: {
        name: 'Testnet Ëtrid Token',
        symbol: 'tETR',
        address: process.env.SEPOLIA_ETR || '',
        decimals: 18,
        exchangeRate: '1000000000000000000'
      },

      // EDSC Test Contracts (localhost deployment)
      edsc: {
        token: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        attesterRegistry: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        messageTransmitter: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
        tokenMessenger: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'
      },

      confirmationBlocks: 2, // Faster for testing
      blockTime: 12000
    },

    polygon: {
      name: 'Polygon-PBC-Testnet',
      chainName: 'Mumbai',
      network: 'mumbai',
      chainId: 80001,
      pbcEndpoint: 'ws://localhost:9948',
      pbcHttpEndpoint: 'http://localhost:9937',
      publicEndpoint: 'https://rpc-mumbai.maticvigil.com',
      explorerUrl: 'https://mumbai.polygonscan.com',

      token: {
        name: 'Testnet Ëtrid Token',
        symbol: 'tETR',
        address: process.env.MUMBAI_ETR || '',
        decimals: 18,
        exchangeRate: '1000000000000000000'
      },

      confirmationBlocks: 10, // Faster for testing
      blockTime: 2000
    }
  },

  // ============================================================================
  // BRIDGE OPERATORS & RELAYERS (Test Accounts)
  // ============================================================================
  operators: {
    primary: 'Alice', // Well-known test account
    relayers: ['Bob', 'Charlie'],

    validators: {
      alice: {
        accountId: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
        role: 'Test Validator 1'
      },
      bob: {
        accountId: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
        role: 'Test Validator 2'
      }
    }
  },

  // ============================================================================
  // BRIDGE PARAMETERS (More Relaxed for Testing)
  // ============================================================================
  bridgeParameters: {
    minTransferAmount: '1000', // Lower minimum for testing
    maxTransferAmount: '100000000000000000', // 0.1 ETR max for testing

    transferFeeBps: 10,
    feePercent: 0.1,

    dailyLimitUSD: 100000, // $100k for testing

    messageTimeout: 600, // 10 minutes
    attestationTimeout: 120, // 2 minutes
    relayTimeout: 60, // 1 minute

    maxRetries: 3,
    retryDelayMs: 10000, // 10 seconds

    edsc: {
      maxBurnPerTx: '100000000000000000000', // 100 EDSC for testing
      dailyBurnLimit: '1000000000000000000000', // 1000 EDSC
      minSignatures: 2, // Lower threshold for testing
      totalAttesters: 3
    }
  },

  // ============================================================================
  // MONITORING CONFIGURATION (More Verbose for Testing)
  // ============================================================================
  monitoring: {
    healthCheckInterval: 30000, // 30 seconds
    metricsCollectionInterval: 15000, // 15 seconds
    eventScanInterval: 5000, // 5 seconds

    alerts: {
      highTransferVolumeUSD: 1000,
      pendingTransferThreshold: 5,
      failedAttestationThreshold: 2,
      relayerBalanceLowETR: '100000000000000000', // 0.1 ETR
      dailyLimitUtilization: 0.5
    },

    prometheus: {
      enabled: true,
      port: 9615,
      path: '/metrics'
    },

    logging: {
      level: 'debug', // More verbose for testing
      format: 'pretty',
      outputs: ['console'],
      fileRotation: false,
      maxFileSize: '10mb',
      maxFiles: 5
    }
  },

  // ============================================================================
  // EMERGENCY CONTROLS (More Lenient for Testing)
  // ============================================================================
  emergency: {
    circuitBreaker: {
      enabled: true,
      failureThreshold: 3,
      resetTimeout: 60000, // 1 minute
      halfOpenRequests: 2
    },

    pauseAuthorities: ['Alice', 'Bob'],

    notifications: {
      email: 'test@localhost',
      telegram: {
        enabled: false,
        botToken: '',
        chatId: ''
      },
      slack: {
        enabled: false,
        webhookUrl: ''
      }
    }
  },

  // ============================================================================
  // GOVERNANCE (Simplified for Testing)
  // ============================================================================
  governance: {
    sudoMultisig: {
      threshold: 1,
      members: ['Alice']
    },

    proposalThresholds: {
      updateBridgeFee: 'sudo',
      updateTransferLimits: 'sudo',
      addRelayer: 'sudo',
      removeRelayer: 'sudo',
      pauseBridge: 'sudo',
      upgradeBridge: 'sudo'
    }
  },

  // ============================================================================
  // LOCALHOST HARDHAT CONFIGURATION
  // ============================================================================
  localhost: {
    enabled: true,
    chainId: 31337,
    rpcUrl: 'http://localhost:8545',

    // Hardhat test accounts
    accounts: {
      deployer: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      relayer1: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      relayer2: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      user1: '0x90F79bf6EB2c4f870365E785982E1f101E93b906'
    },

    // Local deployment addresses
    contracts: {
      edsc: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      attesterRegistry: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
      messageTransmitter: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
      tokenMessenger: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'
    }
  }
} as const;

export type TestnetConfig = typeof testnetConfig;
