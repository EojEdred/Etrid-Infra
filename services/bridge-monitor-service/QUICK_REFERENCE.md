# Bridge Monitor Configuration - Quick Reference Card

## Production Deployment Addresses

### Ethereum EDSC Infrastructure
```
EDSC Token:           0x5FbDB2315678afecb367f032d93F642f64180aa3
MessageTransmitter:   0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0
TokenMessenger:       0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
AttesterRegistry:     0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
```

### Token Addresses
```
BSC ETR:              0xcc9b37fed77a01329502f8844620577742eb0dc6
Solana ETR:           CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp
```

### Bridge Operators
```
Operator:             5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
Relayer 1:            5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty
Relayer 2:            5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy
```

### FlareChain & PBC Endpoints
```
FlareChain:           ws://10.0.0.100:9944
Solana-PBC:           ws://10.0.0.101:9944
BNB-PBC:              ws://10.0.0.102:9944
Ethereum-PBC:         ws://10.0.0.103:9944
Polygon-PBC:          ws://10.0.0.104:9944
Tron-PBC:             ws://10.0.0.105:9944
XRP-PBC:              ws://10.0.0.106:9944
Bitcoin-PBC:          ws://10.0.0.107:9944
```

## Bridge Parameters

```
Fee:                  0.1% (10 basis points)
Min Transfer:         0.000001 ETR
Max Transfer:         1,000,000 ETR
Daily Limit:          $10,000,000 USD

EDSC Max Burn/TX:     1,000,000 EDSC
EDSC Daily Limit:     10,000,000 EDSC
Min Signatures:       3 of 5 attesters
```

## Confirmation Blocks

```
Solana:               32 blocks (~13 seconds)
BNB:                  15 blocks (~45 seconds)
Ethereum:             12 blocks (~2.4 minutes)
Polygon:              128 blocks (~4.3 minutes)
Tron:                 19 blocks (~57 seconds)
XRP:                  1 ledger (~4 seconds)
Bitcoin:              6 blocks (~60 minutes)
```

## RPC Endpoints (Primary)

```typescript
Ethereum:  'https://eth.llamarpc.com'
BSC:       'https://bsc-dataseed.binance.org'
Polygon:   'https://polygon-rpc.com'
Arbitrum:  'https://arb1.arbitrum.io/rpc'
Base:      'https://mainnet.base.org'
Solana:    'https://api.mainnet-beta.solana.com'
Tron:      'https://api.trongrid.io'
XRP:       'https://s1.ripple.com:51234'
Bitcoin:   'https://blockstream.info/api'
```

## Configuration Files

```
Production:     /services/bridge-monitor-service/src/config/production.ts
Testnet:        /services/bridge-monitor-service/src/config/testnet.ts
Contracts:      /services/bridge-monitor-service/src/config/contracts.ts
RPC Endpoints:  /services/bridge-monitor-service/src/config/rpc-endpoints.ts
Secrets:        /secrets/.env.bridge-monitors
```

## Quick Start Commands

```bash
# 1. Copy secrets template
cp /Users/macbook/Desktop/etrid/secrets/.env.bridge-monitors .env

# 2. Fill in API keys (required)
nano .env  # Add Alchemy, Infura, Helius keys

# 3. Verify configuration
./verify-config.sh

# 4. Start in production mode
NODE_ENV=production npm run start

# 5. Start in testnet mode
NODE_ENV=testnet npm run start

# 6. Run tests
npm run test:config

# 7. Check RPC health
npm run test:rpc-health

# 8. View Prometheus metrics
curl http://localhost:9615/metrics
```

## Environment Variables (Critical)

```bash
# Network
NODE_ENV=production
NETWORK_ENV=mainnet

# Ethereum
ETHEREUM_RPC_PRIMARY=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY
ALCHEMY_ETHEREUM_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY

# BSC
BSC_RPC_PRIMARY=https://bsc-dataseed.binance.org

# Solana
SOLANA_RPC_PRIMARY=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
HELIUS_API_KEY=YOUR_HELIUS_KEY

# Relayer (NEVER COMMIT!)
RELAYER_PRIVATE_KEY=0x...
OPERATOR_SEED=...

# Monitoring
PROMETHEUS_PORT=9615
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
```

## Import Examples

```typescript
// Load configuration
import { getConfig, isProduction } from './config';
const config = getConfig();

// Get contract ABI
import { EDSC_ABI, ETHEREUM_MAINNET_CONTRACTS } from './config';

// Get RPC endpoints
import { getRpcEndpoints } from './config';
const rpc = getRpcEndpoints('ethereum', 'mainnet');

// Connect to contract
import { ethers } from 'ethers';
const provider = new ethers.JsonRpcProvider(rpc.primary[0]);
const edsc = new ethers.Contract(
  ETHEREUM_MAINNET_CONTRACTS.edsc,
  EDSC_ABI,
  provider
);
```

## Monitoring Endpoints

```
Prometheus:           http://localhost:9615/metrics
Health Check:         http://localhost:9615/health
FlareChain RPC:       http://10.0.0.100:9933
Solana-PBC RPC:       http://10.0.0.101:9933
```

## Alert Thresholds

```
High Transfer:        > $100,000 USD
Pending Transfers:    > 10 pending
Failed Attestations:  > 3 failures
Low Relayer Balance:  < 1 ETR
Daily Limit Usage:    > 80%
Circuit Breaker:      5 consecutive failures
```

## Emergency Contacts

```
Emergency Pause:      5EHaSsLMDQhqFdex2DxBx4f6uukfAapkwNQngzkajrhN9xHN
Eoj Controller:       5HQTgrkRhd5h5VE2SsL76S9jAf2xZRCaEoVcFiyGxSPAFciq
Gizzi Controller:     5CAyFg27EJwoTJcj1KHravoqjidEn4XqciKM5q9ukbVSzSbW
```

## Security Reminders

- ❌ NEVER commit private keys
- ❌ NEVER commit API keys
- ❌ NEVER commit `.env` files
- ✅ Use `.gitignore` for secrets
- ✅ Store keys in AWS Secrets Manager / Vault
- ✅ Rotate keys every 90 days
- ✅ Use separate keys for testnet/mainnet

## Troubleshooting

```bash
# Check RPC connectivity
curl https://eth.llamarpc.com -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Check PBC node
curl http://10.0.0.101:9933 -H "Content-Type: application/json" \
  -d '{"id":1,"jsonrpc":"2.0","method":"system_health","params":[]}'

# Test Solana connection
curl https://api.mainnet-beta.solana.com -X POST -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'

# Verify configuration
./verify-config.sh

# Check logs
tail -f /var/log/etrid/bridge-monitor.log
```

## File Locations

```
Configuration:     /Users/macbook/Desktop/etrid/services/bridge-monitor-service/src/config/
Secrets:           /Users/macbook/Desktop/etrid/secrets/.env.bridge-monitors
Documentation:     /Users/macbook/Desktop/etrid/services/bridge-monitor-service/CONFIG_README.md
Summary:           /Users/macbook/Desktop/etrid/services/bridge-monitor-service/CONFIGURATION_SUMMARY.md
Verification:      /Users/macbook/Desktop/etrid/services/bridge-monitor-service/verify-config.sh
```

## Support

- **Docs**: `CONFIG_README.md` (full guide)
- **Summary**: `CONFIGURATION_SUMMARY.md` (overview)
- **Issues**: GitHub issue with `configuration` label
- **Security**: `security@etrid.network`
- **Urgent**: ËTRID Core Team

---

**Last Updated**: 2025-12-03
**Version**: 1.0.0
**Status**: ✅ PRODUCTION READY
