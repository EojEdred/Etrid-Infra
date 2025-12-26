# Bridge Monitor Service - Configuration Guide

## Overview

The Bridge Monitor Service configuration is organized into modular, production-ready files that manage all aspects of cross-chain bridge monitoring for the ËTRID network.

## Configuration Files

### 1. `src/config/production.ts`
**Production configuration for mainnet deployment**

Contains:
- FlareChain (Primearc Core) mainnet endpoints
- All 7 PBC (Partition Burst Chain) configurations:
  - Solana-PBC
  - BNB-PBC
  - Ethereum-PBC
  - Polygon-PBC
  - Tron-PBC
  - XRP-PBC
  - Bitcoin-PBC
- Production contract addresses from actual deployments
- Bridge operator and relayer accounts from `.env.mainnet`
- Real validator accounts (Gizzi, Eojedred)
- EDSC infrastructure accounts (Reserve Vault, Oracle, Custodians)
- Bridge parameters (0.1% fee, confirmation blocks, limits)
- Monitoring configuration (Prometheus, alerting, logging)
- Emergency controls and circuit breakers
- Governance multisig configuration (2-of-2)

**Key Production Values:**
```typescript
// Real deployed contracts
edsc: {
  token: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  messageTransmitter: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  tokenMessenger: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'
}

// Real BSC ETR token
bsc.token.address: '0xcc9b37fed77a01329502f8844620577742eb0dc6'

// Real Solana ETR SPL token
solana.token.address: 'CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp'
```

### 2. `src/config/testnet.ts`
**Testnet configuration for development and testing**

Contains:
- Localhost/testnet endpoints for all chains
- Relaxed limits for testing (lower minimums, faster confirmations)
- Test account addresses (Alice, Bob, Charlie)
- Hardhat localhost deployment addresses
- More verbose logging for debugging
- Lenient circuit breaker settings

**Use Cases:**
- Local development with `hardhat node`
- BSC Testnet, Sepolia, Mumbai testing
- Solana Devnet integration testing

### 3. `src/config/contracts.ts`
**Contract ABIs and addresses for all deployed contracts**

Contains:
- **EDSC Token ABI**: Full ERC20 + cross-chain mint/burn interface
- **MessageTransmitter ABI**: Receives and verifies messages from ËTRID
- **TokenMessenger ABI**: Burns EDSC to send to ËTRID
- **AttesterRegistry ABI**: Manages attesters and signature verification
- **ERC20 ABI**: Standard token interface for ETR tokens
- **DEX ABIs**: PancakeSwap/Uniswap for price feeds
- **Domain identifiers**: Ethereum (0), ËTRID (2), BSC (3), etc.
- **Helper functions**: `getContractAddress()`, `getTokenAddress()`, `getDexFactory()`

**Contract Addresses:**
```typescript
// Ethereum EDSC Infrastructure
ETHEREUM_MAINNET_CONTRACTS = {
  edsc: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  attesterRegistry: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  messageTransmitter: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  tokenMessenger: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9'
}

// BSC Production Tokens
BSC_MAINNET_TOKENS = {
  etr: '0xcc9b37fed77a01329502f8844620577742eb0dc6',
  usdt: '0x55d398326f99059fF775485246999027B3197955',
  busd: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56'
}

// Solana Production Token
SOLANA_MAINNET_TOKENS = {
  etr: 'CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp'
}
```

### 4. `src/config/rpc-endpoints.ts`
**RPC URLs with fallbacks and rate limiting**

Contains:
- **Primary endpoints**: Fast, reliable RPC providers (Alchemy, Infura, QuickNode)
- **Fallback endpoints**: Public RPCs for redundancy (Ankr, BlastAPI, PublicNode)
- **WebSocket endpoints**: For real-time event monitoring
- **Rate limits**: Requests/second, concurrent connections, timeouts per chain
- **Testnet endpoints**: Sepolia, BSC Testnet, Mumbai, Solana Devnet

**RPC Configuration Example:**
```typescript
BSC_RPC_ENDPOINTS = {
  primary: [
    'https://bsc-dataseed.binance.org',
    'https://bsc-dataseed1.binance.org'
  ],
  fallback: [
    'https://rpc.ankr.com/bsc',
    'https://bsc.publicnode.com',
    'https://bsc.drpc.org'
  ],
  rateLimit: {
    requestsPerSecond: 15,
    maxConcurrent: 10,
    timeout: 20000
  }
}
```

### 5. `secrets/.env.bridge-monitors`
**Production secrets template (DO NOT COMMIT TO GIT)**

Contains environment variable templates for:
- **RPC API Keys**: Alchemy, Infura, Helius, QuickNode
- **Private Keys**: Relayer, operator, attester keys (NEVER commit!)
- **Contract Addresses**: All deployed contract addresses
- **Alert Configuration**: Telegram, Slack, Email settings
- **Database URLs**: PostgreSQL, Redis for metrics storage
- **Security Keys**: JWT, encryption, API keys
- **Feature Flags**: Enable/disable specific bridges
- **AWS Credentials**: For backups (if using S3)

**Critical Security Notes:**
- Copy to `.env` and fill in real values
- Never commit `.env` files to git
- Use `.gitignore` to exclude all `.env*` files
- Store production secrets in secure vault (AWS Secrets Manager, HashiCorp Vault)
- Rotate keys regularly

### 6. `src/config/index.ts`
**Central configuration export and selector**

Provides:
- `getConfig()`: Auto-selects production/testnet based on `NODE_ENV`
- `isProduction()`: Check if running in production
- `isTestnet()`: Check if running in testnet
- Centralized exports for all configuration modules

**Usage:**
```typescript
import { getConfig, isProduction, EDSC_ABI, getRpcEndpoints } from './config';

const config = getConfig();
console.log(config.flarechain.wsEndpoint); // ws://10.0.0.100:9944

const rpc = getRpcEndpoints('bsc', 'mainnet');
console.log(rpc.primary); // BSC RPC URLs
```

## Configuration Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Bridge Monitor Service                │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐        │
│  │ Production │  │  Testnet   │  │ Localhost  │        │
│  │   Config   │  │   Config   │  │   Config   │        │
│  └─────┬──────┘  └─────┬──────┘  └─────┬──────┘        │
│        │               │               │                │
│        └───────────────┴───────────────┘                │
│                        │                                │
│                        ▼                                │
│              ┌──────────────────┐                       │
│              │  Config Selector │                       │
│              │   (index.ts)     │                       │
│              └────────┬─────────┘                       │
│                       │                                 │
│         ┌─────────────┼─────────────┐                   │
│         ▼             ▼             ▼                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │Contracts │  │   RPC    │  │  Secrets │              │
│  │   ABIs   │  │Endpoints │  │  (.env)  │              │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Real Production Data Sources

All configuration values are derived from:

1. **`secrets/.env.mainnet`**:
   - Validator accounts (Gizzi, Eojedred)
   - EDSC infrastructure accounts
   - Custodian accounts
   - Bridge operator: `5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY`
   - Relayers: `5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty`, `5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy`

2. **`scripts/pbc-config/config.json`**:
   - PBC endpoints (10.0.0.100-107)
   - Bridge parameters (0.1% fee, confirmation blocks)
   - Transfer limits

3. **`scripts/pbc-config/solana/sol-pbc-config.json`**:
   - Solana token: `CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp`
   - Exchange rates and decimals

4. **`contracts/ethereum/deployment-localhost-1761000235862.json`**:
   - EDSC: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
   - MessageTransmitter: `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0`
   - TokenMessenger: `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9`
   - AttesterRegistry: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`

5. **`05-multichain/partition-burst-chains/pbc-chains/bnb-pbc/runtime/presets/production.json`**:
   - BSC ETR: `0xcc9b37fed77a01329502f8844620577742eb0dc6`

## Usage Examples

### Basic Configuration Loading

```typescript
import { getConfig, isProduction } from './config';

const config = getConfig();

if (isProduction()) {
  console.log('Running in PRODUCTION mode');
  console.log('FlareChain:', config.flarechain.wsEndpoint);
} else {
  console.log('Running in TESTNET mode');
}
```

### Connect to Ethereum with Fallback

```typescript
import { ethers } from 'ethers';
import { getRpcEndpoints } from './config';

const endpoints = getRpcEndpoints('ethereum', 'mainnet');

async function connectWithFallback() {
  for (const url of [...endpoints.primary, ...endpoints.fallback]) {
    try {
      const provider = new ethers.JsonRpcProvider(url);
      await provider.getBlockNumber(); // Test connection
      console.log('Connected to:', url);
      return provider;
    } catch (error) {
      console.warn('Failed to connect to:', url);
      continue;
    }
  }
  throw new Error('All RPC endpoints failed');
}
```

### Monitor EDSC Contract

```typescript
import { ethers } from 'ethers';
import {
  getConfig,
  EDSC_ABI,
  ETHEREUM_MAINNET_CONTRACTS,
  getRpcEndpoints
} from './config';

const config = getConfig();
const rpc = getRpcEndpoints('ethereum', 'mainnet');
const provider = new ethers.JsonRpcProvider(rpc.primary[0]);

const edscContract = new ethers.Contract(
  ETHEREUM_MAINNET_CONTRACTS.edsc,
  EDSC_ABI,
  provider
);

// Listen for cross-chain mints
edscContract.on('CrossChainMint', (recipient, amount, nonce) => {
  console.log('EDSC minted:', {
    recipient,
    amount: ethers.formatEther(amount),
    nonce: nonce.toString()
  });
});
```

### Check Bridge Parameters

```typescript
import { getConfig } from './config';

const config = getConfig();
const params = config.bridgeParameters;

console.log('Bridge Fee:', params.feePercent, '%');
console.log('Min Transfer:', params.minTransferAmount);
console.log('Max Transfer:', params.maxTransferAmount);
console.log('Daily Limit:', params.dailyLimitUSD, 'USD');

// EDSC specific limits
console.log('Max EDSC burn/tx:', params.edsc.maxBurnPerTx);
console.log('Min signatures:', params.edsc.minSignatures);
```

## Environment Variables

Set these in your deployment environment or `.env` file:

```bash
# Select configuration
NODE_ENV=production          # or testnet, development
NETWORK_ENV=mainnet         # or testnet

# Override RPC endpoints
ETHEREUM_RPC_PRIMARY=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
BSC_RPC_PRIMARY=https://bsc-dataseed.binance.org
SOLANA_RPC_PRIMARY=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY

# API Keys
ALCHEMY_API_KEY=your_alchemy_key
INFURA_PROJECT_ID=your_infura_id
HELIUS_API_KEY=your_helius_key

# Monitoring
PROMETHEUS_PORT=9615
LOG_LEVEL=info

# Alerts
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

## Security Best Practices

1. **Never commit secrets**: Use `.gitignore` to exclude `.env*` files
2. **Use environment-specific configs**: Separate production and testnet
3. **Rotate keys regularly**: Update relayer and attester keys periodically
4. **Monitor API key usage**: Set up alerts for rate limit violations
5. **Use secure vaults**: Store production secrets in AWS Secrets Manager or HashiCorp Vault
6. **Audit access logs**: Track who accesses configuration files
7. **Encrypt backups**: If backing up config, encrypt with strong keys

## Testing Configuration

```bash
# Test with testnet config
NODE_ENV=testnet npm run start

# Test with production config (read-only)
NODE_ENV=production npm run validate-config

# Test RPC connectivity
npm run test:rpc-health
```

## Production Deployment Checklist

- [ ] Copy `.env.bridge-monitors` to `.env`
- [ ] Fill in all RPC API keys (Alchemy, Infura, etc.)
- [ ] Set relayer private keys (NEVER commit!)
- [ ] Configure alert channels (Telegram, Slack, Email)
- [ ] Verify all contract addresses match deployments
- [ ] Set `NODE_ENV=production`
- [ ] Enable Prometheus monitoring
- [ ] Set up log aggregation (ELK, DataDog, etc.)
- [ ] Configure database URLs (PostgreSQL, Redis)
- [ ] Test circuit breaker functionality
- [ ] Verify emergency pause authorities
- [ ] Set up backup and recovery procedures
- [ ] Document runbook for incidents

## Configuration Updates

When updating configuration:

1. **Production changes**: Require governance approval (sudo multisig)
2. **Contract address changes**: Coordinate with deployment team
3. **RPC endpoint changes**: Test connectivity before deploying
4. **Fee changes**: Notify users in advance
5. **Limit changes**: Ensure compliance with regulations

## Support

For configuration questions:
- **Documentation**: See `/docs/DEPLOYMENT_GUIDE.md`
- **Issues**: File GitHub issue with `config` label
- **Security**: Email `security@etrid.network` for sensitive config issues

---

**Last Updated**: 2025-12-03
**Configuration Version**: 1.0.0
**Maintainer**: ËTRID Core Team
