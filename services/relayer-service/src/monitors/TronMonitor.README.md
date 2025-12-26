# TRON Bridge Monitor

Production-ready monitor for TRON blockchain bridge deposits to ËTRID multichain network.

## Overview

The TronMonitor monitors TRON blockchain for bridge contract events (TRX and TRC-20 deposits) and emits events for the ËTRID relayer to submit on-chain. Optimized for high-value stablecoin transfers, particularly USDT (63% of global USDT supply on TRON).

**Priority**: #2 Bridge ($21.5B daily volume, $76B+ stablecoin infrastructure)

## Features

- ✅ **TRX Deposits**: Native TRON token bridging
- ✅ **TRC-20 Tokens**: Support for USDT, USDC, and custom tokens
- ✅ **USDT Fast-Track**: Special handling for USDT (highest volume stablecoin)
- ✅ **Energy & Bandwidth Tracking**: TRON-specific resource monitoring
- ✅ **19 Block Confirmations**: Super representative finality
- ✅ **Base58/Hex Conversion**: Proper TRON address handling (21 bytes)
- ✅ **Prometheus Metrics**: Full observability integration
- ✅ **Error Recovery**: Automatic retry and reconnection logic
- ✅ **Mainnet & Testnet**: Support for mainnet, shasta, and nile networks

## Architecture

```
┌─────────────────┐
│  TRON Network   │
│   (Mainnet)     │
└────────┬────────┘
         │ Events
         ↓
┌─────────────────┐      Events      ┌──────────────────┐
│  TronMonitor    │ ──────────────→  │  ËTRID Relayer   │
│  (EventEmitter) │                   │   (Substrate)    │
└─────────────────┘                   └──────────────────┘
         │
         ↓ Metrics
┌─────────────────┐
│   Prometheus    │
│    /metrics     │
└─────────────────┘
```

## Installation

```bash
npm install tronweb --save
npm install @polkadot/api @polkadot/keyring --save
```

## Quick Start

```typescript
import { createTronMonitor } from './monitors/TronMonitor';

// Create monitor
const monitor = createTronMonitor(
  'TYourBridgeContractAddress',
  'mainnet',
  {
    tronGridApiKey: process.env.TRONGRID_API_KEY,
    pollIntervalMs: 3000,
    minConfirmations: 19,
  }
);

// Listen for TRX deposits
monitor.on('trxDeposit', async (event) => {
  console.log('TRX Deposit:', {
    depositor: event.tronAddress,
    amount: event.amount.toString(),
    txId: event.txId,
  });

  // Submit to ËTRID runtime
  await submitToEtrid(event);
});

// Listen for USDT deposits
monitor.on('usdtDeposit', async (event) => {
  console.log('USDT Deposit (High Priority):', {
    depositor: event.tronAddress,
    amount: event.amount.toString(),
  });

  // Fast-track to ËTRID
  await submitUsdtToEtrid(event);
});

// Start monitoring
await monitor.start();
```

## Configuration

### TronMonitorConfig

```typescript
interface TronMonitorConfig {
  // RPC endpoints
  fullNodeUrl: string;
  solidityNodeUrl: string;
  eventServerUrl: string;

  // Network (mainnet, shasta, nile)
  network: 'mainnet' | 'shasta' | 'nile';

  // Bridge contract address (base58)
  bridgeContractAddress: string;

  // Supported TRC-20 tokens
  supportedTokens: {
    address: string;
    symbol: string;
    decimals: number;
  }[];

  // USDT contract (auto-configured per network)
  usdtContractAddress?: string;

  // Polling
  pollIntervalMs: number; // Default: 3000 (TRON block time)
  startBlock?: number;

  // Confirmations (super representative finality)
  minConfirmations: number; // Default: 19

  // Resource limits
  maxEnergyLimit: number; // Default: 150,000,000
  maxBandwidthLimit: number; // Default: 5,000

  // TronGrid API key (recommended)
  tronGridApiKey?: string;
}
```

### Network Endpoints

**Mainnet**:
```typescript
{
  fullNodeUrl: 'https://api.trongrid.io',
  solidityNodeUrl: 'https://api.trongrid.io',
  eventServerUrl: 'https://api.trongrid.io',
  usdtContract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
}
```

**Shasta (Testnet)**:
```typescript
{
  fullNodeUrl: 'https://api.shasta.trongrid.io',
  solidityNodeUrl: 'https://api.shasta.trongrid.io',
  eventServerUrl: 'https://api.shasta.trongrid.io',
  usdtContract: 'TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs',
}
```

## Events

### `trxDeposit`

Emitted when a TRX deposit is detected.

```typescript
interface TrxDepositEvent {
  etridAccount: Uint8Array; // 32-byte SS58 account
  tronAddress: string; // Base58 address
  amount: bigint; // in SUN (1 TRX = 1,000,000 SUN)
  txId: string; // Transaction ID (64 hex chars)
  blockNumber: number;
  blockTimestamp: number;
  confirmations: number;
  energyUsage: number; // TRON energy consumed
  bandwidthUsage: number; // TRON bandwidth consumed
  timestamp: number;
}
```

### `trc20Deposit`

Emitted for TRC-20 token deposits (excluding USDT).

```typescript
interface Trc20DepositEvent {
  etridAccount: Uint8Array;
  tronAddress: string;
  tokenContract: string; // TRC-20 contract address
  tokenSymbol: string; // e.g., "USDC"
  amount: bigint;
  txId: string;
  blockNumber: number;
  blockTimestamp: number;
  confirmations: number;
  energyUsage: number;
  bandwidthUsage: number;
  timestamp: number;
}
```

### `usdtDeposit`

Emitted specifically for USDT deposits (high priority).

```typescript
// Same as Trc20DepositEvent but for USDT
```

### `error`

Emitted on errors.

```typescript
monitor.on('error', (error: Error) => {
  console.error('Monitor error:', error);
});
```

### `started` / `stopped`

Lifecycle events.

```typescript
monitor.on('started', () => console.log('Monitor started'));
monitor.on('stopped', () => console.log('Monitor stopped'));
```

## ËTRID Runtime Integration

### Extrinsic Calls

**TRX Deposit** → `tronBridge.initiateTrxDeposit()`:

```typescript
const tx = api.tx.tronBridge.initiateTrxDeposit(
  event.etridAccount, // AccountId (32 bytes)
  Array.from(tronAddressBytes), // TronAddress (21 bytes)
  event.amount.toString(), // Balance (in SUN)
  event.txId, // H256 (32 bytes)
  event.blockNumber, // u64
  event.confirmations // u32
);

await tx.signAndSend(relayerAccount);
```

**Confirm TRX Deposit** → `tronBridge.confirmTrxDeposit()`:

```typescript
const tx = api.tx.tronBridge.confirmTrxDeposit(
  event.txId // H256
);

await tx.signAndSend(relayerAccount);
```

**USDT Deposit (Fast-Track)** → `tronBridge.initiateUsdtDeposit()`:

```typescript
const tx = api.tx.tronBridge.initiateUsdtDeposit(
  event.etridAccount,
  Array.from(tronAddressBytes),
  event.amount.toString(),
  event.txId,
  event.blockNumber,
  event.confirmations
);

await tx.signAndSend(relayerAccount);
```

**TRC-20 Token Deposit** → `tronBridge.initiateTokenDeposit()`:

```typescript
const tx = api.tx.tronBridge.initiateTokenDeposit(
  event.etridAccount,
  Array.from(tronAddressBytes),
  Array.from(tokenContractBytes), // TokenContract (21 bytes)
  event.amount.toString(),
  event.txId,
  event.blockNumber,
  event.confirmations
);

await tx.signAndSend(relayerAccount);
```

## Address Conversion

TRON addresses are 21 bytes (base58 encoded to 34 chars starting with 'T').

```typescript
// Base58 to Hex
const hex = monitor.addressToHex('TYmS7nCVWy7XYqTTRMr1LXqNAP6aQSEuW3');
// → "41f34ab2fc67caa3c9c9d1e63f6e50a8b88f8e01c3"

// Hex to Base58
const base58 = monitor.addressFromHex('41f34ab2fc67caa3c9c9d1e63f6e50a8b88f8e01c3');
// → "TYmS7nCVWy7XYqTTRMr1LXqNAP6aQSEuW3"

// Get 21-byte address
const bytes = monitor.getAddressBytes('TYmS7nCVWy7XYqTTRMr1LXqNAP6aQSEuW3');
// → Uint8Array(21) [0x41, 0xf3, 0x4a, ...]

// Validate address
const isValid = monitor.isValidAddress('TYmS7nCVWy7XYqTTRMr1LXqNAP6aQSEuW3');
// → true
```

## Prometheus Metrics

The monitor exports these metrics to `/metrics`:

### Connection Metrics
- `relayer_tron_connected` - Connected to TRON node (1/0)
- `relayer_tron_block_height` - Latest block height processed

### Deposit Metrics
- `relayer_tron_deposits_seen_total{chain,token}` - Total deposits detected
- `relayer_tron_trx_deposits_total` - TRX deposits
- `relayer_tron_trc20_deposits_total{token_symbol}` - TRC-20 deposits
- `relayer_tron_usdt_deposits_total` - USDT deposits (high priority)
- `relayer_tron_deposit_amount_sun{token}` - Total amount deposited

### Resource Metrics
- `relayer_tron_energy_used_total` - Total energy consumed
- `relayer_tron_bandwidth_used_total` - Total bandwidth consumed

### Timing Metrics
- `relayer_last_block_timestamp{chain="tron"}` - Last block processed timestamp

### Error Metrics
- `relayer_errors_total{type,source}` - Total errors

## TRON-Specific Details

### Block Confirmations

TRON uses 19 block confirmations for super representative finality (~57 seconds at 3s/block).

```typescript
minConfirmations: 19 // Super representative finality
```

### Energy & Bandwidth

TRON uses energy and bandwidth instead of gas:

- **Energy**: Computational resources (max ~150M)
- **Bandwidth**: Network resources (max ~5,000)

Both are tracked per transaction:

```typescript
event.energyUsage // e.g., 65000
event.bandwidthUsage // e.g., 345
```

### Amount Units

**TRX**: 1 TRX = 1,000,000 SUN
```typescript
const trxAmount = Number(event.amount) / 1_000_000;
```

**USDT**: 1 USDT = 1,000,000 units (6 decimals)
```typescript
const usdtAmount = Number(event.amount) / 1_000_000;
```

### Rate Limits

TronGrid API has rate limits:
- **Free**: 100 requests/second
- **Pro**: 1,000+ requests/second

Use `tronGridApiKey` for production:

```typescript
{
  tronGridApiKey: process.env.TRONGRID_API_KEY
}
```

## Error Handling

### Automatic Recovery

```typescript
let consecutiveErrors = 0;

monitor.on('error', async (error) => {
  consecutiveErrors++;

  if (consecutiveErrors >= 5) {
    await monitor.stop();
    await new Promise(r => setTimeout(r, 10000)); // Wait 10s
    await monitor.start();
    consecutiveErrors = 0;
  }
});

monitor.on('trxDeposit', () => {
  consecutiveErrors = 0; // Reset on success
});
```

### Rate Limit Handling

The monitor automatically backs off on rate limit errors (HTTP 429).

### Connection Issues

```typescript
monitor.on('error', (error) => {
  if (error.message.includes('ECONNREFUSED')) {
    // Handle connection error
  }
});
```

## Health Checks

```typescript
// Get monitor status
const status = monitor.getStatus();

console.log({
  isRunning: status.isRunning,
  lastBlock: status.lastBlock,
  depositsProcessed: status.depositsProcessed,
  errors: status.errors,
  lastError: status.lastError,
  lastErrorTime: status.lastErrorTime,
});

// Get current block
const currentBlock = await monitor.getCurrentBlock();

// Get confirmed block (current - 19)
const confirmedBlock = await monitor.getConfirmedBlock();
```

## Testing

### Shasta Testnet

```typescript
const monitor = createTronMonitor(
  'TYourTestnetContract',
  'shasta',
  {
    pollIntervalMs: 3000,
    minConfirmations: 19,
  }
);

await monitor.start();
```

### Query Deposit

```typescript
const deposit = await monitor.getDepositByTxId(
  '0x1234567890abcdef...'
);

if (deposit) {
  console.log('Deposit found:', deposit);
}
```

## Performance

- **Poll Interval**: 3 seconds (TRON block time)
- **Event Processing**: < 100ms per event
- **Memory Usage**: ~50-100 MB
- **CPU Usage**: < 5% (idle), 10-20% (active)

## Production Checklist

- [ ] Set `TRONGRID_API_KEY` for rate limit increases
- [ ] Configure proper `bridgeContractAddress`
- [ ] Set up Prometheus metrics scraping
- [ ] Implement error alerting (Grafana, PagerDuty)
- [ ] Test address conversion thoroughly
- [ ] Verify USDT contract address per network
- [ ] Set up log aggregation (ELK, Loki)
- [ ] Configure health check endpoint
- [ ] Test graceful shutdown (SIGINT/SIGTERM)
- [ ] Monitor energy and bandwidth usage

## Environment Variables

```bash
# TRON Configuration
TRON_BRIDGE_CONTRACT=TYourBridgeContract...
TRONGRID_API_KEY=your-api-key-here

# ËTRID Configuration
ETRID_WS_URL=ws://localhost:9944
RELAYER_SEED=//Alice

# Monitoring
METRICS_PORT=9090
LOG_LEVEL=info
```

## Troubleshooting

### Issue: Events not detected

**Solution**: Check block height and confirmations:
```typescript
const currentBlock = await monitor.getCurrentBlock();
const confirmedBlock = await monitor.getConfirmedBlock();
console.log({ currentBlock, confirmedBlock, lastProcessed: monitor.getStatus().lastBlock });
```

### Issue: Rate limit errors

**Solution**: Add TronGrid API key:
```typescript
{ tronGridApiKey: process.env.TRONGRID_API_KEY }
```

### Issue: Invalid address format

**Solution**: Validate addresses:
```typescript
const isValid = monitor.isValidAddress(address);
if (!isValid) {
  console.error('Invalid TRON address:', address);
}
```

### Issue: Energy/bandwidth errors

**Solution**: Check resource limits:
```typescript
{
  maxEnergyLimit: 150_000_000,
  maxBandwidthLimit: 5_000,
}
```

## References

- [TRON Documentation](https://developers.tron.network/)
- [TronWeb Library](https://github.com/tronprotocol/tronweb)
- [TronGrid API](https://www.trongrid.io/)
- [ËTRID Bridge Pallet](../../05-multichain/bridges/protocols/tron-bridge/)
- [USDT on TRON](https://tron.network/usdt)

## License

MIT License - ËTRID Foundation

## Support

For issues or questions:
- GitHub: https://github.com/etrid/etrid
- Discord: https://discord.gg/etrid
- Email: dev@etrid.io
