# TRON Monitor - Quick Reference Card

## 🚀 Quick Start (30 seconds)

```typescript
import { createTronMonitor } from './monitors/TronMonitor';

const monitor = createTronMonitor('TYourBridgeContract', 'mainnet', {
  tronGridApiKey: process.env.TRONGRID_API_KEY,
});

monitor.on('trxDeposit', (e) => console.log('TRX:', e.amount));
monitor.on('usdtDeposit', (e) => console.log('USDT:', e.amount));

await monitor.start();
```

## 📦 Essential Files

| File | Purpose | Size |
|------|---------|------|
| `TronMonitor.ts` | Core implementation | 23 KB |
| `TronMonitor.README.md` | API docs | 13 KB |
| `TronMonitor.example.ts` | 6 examples | 15 KB |
| `TronMonitor.DEPLOYMENT.md` | Deploy guide | 16 KB |
| `TronMonitor.test.ts` | Unit tests | 18 KB |
| `TRON_MONITOR_SUMMARY.md` | Overview | 16 KB |

## 🔧 Configuration (.env)

```bash
# Required
TRON_NETWORK=mainnet
TRON_BRIDGE_CONTRACT=TYourContractAddress
TRONGRID_API_KEY=your-api-key
ETRID_WS_URL=wss://rpc.etrid.io
RELAYER_SEED=//YourSecureSeed

# Optional
TRON_POLL_INTERVAL_MS=3000
TRON_MIN_CONFIRMATIONS=19
METRICS_PORT=9090
LOG_LEVEL=info
```

## 📊 Key Metrics (Prometheus)

```promql
# Connection
relayer_tron_connected

# Deposits
rate(relayer_tron_deposits_seen_total[5m])
rate(relayer_tron_usdt_deposits_total[5m])

# Resources
rate(relayer_tron_energy_used_total[5m])
rate(relayer_tron_bandwidth_used_total[5m])
```

## 🎯 Events

```typescript
// TRX deposits
monitor.on('trxDeposit', (event: TrxDepositEvent) => {
  // event.amount in SUN (1 TRX = 1,000,000 SUN)
  // event.tronAddress is base58
  // event.confirmations >= 19
});

// USDT deposits (high-priority)
monitor.on('usdtDeposit', (event: Trc20DepositEvent) => {
  // Fast-track USDT (63% global supply)
  // event.amount in 6 decimals
});

// Other TRC-20 tokens
monitor.on('trc20Deposit', (event: Trc20DepositEvent) => {
  // event.tokenSymbol = 'USDC', etc.
  // event.tokenContract is base58
});
```

## 🔗 ËTRID Integration

```typescript
import { ApiPromise } from '@polkadot/api';

// TRX deposit
const tx = api.tx.tronBridge.initiateTrxDeposit(
  event.etridAccount,        // AccountId (32 bytes)
  tronAddressBytes,          // TronAddress (21 bytes)
  event.amount.toString(),   // Balance (in SUN)
  event.txId,                // H256 (32 bytes)
  event.blockNumber,         // u64
  event.confirmations        // u32
);

await tx.signAndSend(relayerAccount);

// USDT deposit (fast-track)
const tx = api.tx.tronBridge.initiateUsdtDeposit(
  event.etridAccount,
  tronAddressBytes,
  event.amount.toString(),
  event.txId,
  event.blockNumber,
  event.confirmations
);
```

## 🏗️ Address Conversion

```typescript
// Base58 to Hex (21 bytes)
const hex = monitor.addressToHex('TYmS7nCVWy7X...');
// → "41f34ab2fc67caa3c9c9d1e63f6e50a8b88f8e01c3"

// Hex to Base58
const base58 = monitor.addressFromHex('41f34ab2...');
// → "TYmS7nCVWy7X..."

// Get 21-byte array
const bytes = monitor.getAddressBytes('TYmS7nCVWy7X...');
// → Uint8Array(21)

// Validate
const valid = monitor.isValidAddress('TYmS7nCVWy7X...');
// → true/false
```

## 🔢 Amount Conversion

```typescript
// TRX: 1 TRX = 1,000,000 SUN
const trx = Number(event.amount) / 1_000_000;

// USDT: 6 decimals
const usdt = Number(event.amount) / 1_000_000;

// Generic TRC-20
const amount = Number(event.amount) / Math.pow(10, decimals);
```

## 🚨 Error Handling

```typescript
let errors = 0;

monitor.on('error', async (error) => {
  errors++;

  // Rate limit
  if (error.message.includes('429')) {
    console.warn('Rate limited, backing off...');
    return;
  }

  // Restart after 5 consecutive errors
  if (errors >= 5) {
    await monitor.stop();
    await sleep(10000);
    await monitor.start();
    errors = 0;
  }
});

monitor.on('trxDeposit', () => errors = 0);
```

## 📈 Status & Health

```typescript
// Get status
const status = monitor.getStatus();
console.log({
  isRunning: status.isRunning,
  lastBlock: status.lastBlock,
  depositsProcessed: status.depositsProcessed,
  errors: status.errors,
});

// Current block
const current = await monitor.getCurrentBlock();

// Confirmed block (current - 19)
const confirmed = await monitor.getConfirmedBlock();
```

## 🐳 Docker Deploy

```bash
# Build
docker build -t tron-monitor .

# Run
docker run -d \
  --name tron-monitor \
  -p 9090:9090 \
  --env-file .env \
  tron-monitor
```

## 🔄 PM2 Deploy

```bash
# Start
pm2 start ecosystem.config.js

# Status
pm2 status

# Logs
pm2 logs tron-bridge-monitor

# Restart
pm2 restart tron-bridge-monitor
```

## ☸️ Kubernetes Deploy

```bash
kubectl apply -f k8s-deployment.yaml
kubectl get pods -n etrid
kubectl logs -f deployment/tron-bridge-monitor -n etrid
```

## 🧪 Testing

```bash
# Unit tests
npm test -- TronMonitor.test.ts

# Integration (testnet)
TRON_NETWORK=shasta npm run test:integration

# Load test
npm run test:load
```

## 🔍 Troubleshooting

### Events not detected
```typescript
const status = monitor.getStatus();
const current = await monitor.getCurrentBlock();
console.log({ lastBlock: status.lastBlock, current });
// Ensure lastBlock is incrementing
```

### Rate limit (429)
```bash
# Add API key
TRONGRID_API_KEY=your-key-here
# Upgrade to Pro tier: https://www.trongrid.io/
```

### Invalid address
```typescript
const valid = monitor.isValidAddress(address);
if (!valid) console.error('Invalid TRON address');
// Must start with 'T' and be 34 chars (base58)
```

### High memory
```bash
# PM2: Restart on memory limit
pm2 start app.js --max-memory-restart 2G

# Node: Increase heap size
NODE_OPTIONS="--max-old-space-size=2048"
```

## 📚 Resources

- **API Docs**: `TronMonitor.README.md`
- **Examples**: `TronMonitor.example.ts` (6 examples)
- **Deployment**: `TronMonitor.DEPLOYMENT.md`
- **Tests**: `TronMonitor.test.ts` (650+ lines)
- **Overview**: `TRON_MONITOR_SUMMARY.md`

## 🌐 Networks

| Network | RPC Endpoint | USDT Contract |
|---------|--------------|---------------|
| Mainnet | `https://api.trongrid.io` | `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t` |
| Shasta | `https://api.shasta.trongrid.io` | `TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs` |
| Nile | `https://nile.trongrid.io` | `TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj` |

## 🎯 TRON Specifics

- **Block Time**: 3 seconds
- **Confirmations**: 19 blocks (super representative finality)
- **Confirmation Time**: ~57 seconds
- **Energy Limit**: 150,000,000
- **Bandwidth Limit**: 5,000
- **Address Format**: 21 bytes (base58, starts with 'T')
- **TRX Decimals**: 6 (SUN)
- **USDT Decimals**: 6

## 📞 Support

- **GitHub**: https://github.com/etrid/etrid/issues
- **Discord**: https://discord.gg/etrid
- **Email**: dev@etrid.io
- **Docs**: See `TronMonitor.README.md`

## ✅ Production Checklist

- [ ] TronGrid Pro API key configured
- [ ] Bridge contract deployed & verified
- [ ] Relayer account funded (TRX)
- [ ] Prometheus metrics enabled
- [ ] Grafana dashboard imported
- [ ] Alerts configured (PagerDuty/Slack)
- [ ] Health checks enabled
- [ ] Log rotation configured
- [ ] Security audit completed
- [ ] Load testing passed

---

**Version**: 1.0.0 | **Status**: Production-Ready ✅ | **Updated**: 2025-12-03
