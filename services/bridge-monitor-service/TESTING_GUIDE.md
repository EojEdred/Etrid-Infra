# Testing Guide - Bridge Monitor Service

## Unit Testing

### XRP Monitor Tests

```typescript
import { XrpMonitor } from './monitors/XrpMonitor';

describe('XrpMonitor', () => {
  it('should connect to XRPL testnet', async () => {
    const monitor = new XrpMonitor({
      rpcUrl: 'wss://s.altnet.rippletest.net:51233',
      network: 'testnet',
      bridgeType: 'classic',
      bridgeAddress: 'rTestBridgeAddress',
      minConfirmations: 1,
      reconnectAttempts: 3,
      reconnectDelay: 1000,
    });
    
    await monitor.start();
    const status = monitor.getStatus();
    expect(status.isRunning).toBe(true);
    await monitor.stop();
  });
  
  it('should parse destination tags', () => {
    // Test destination tag parsing logic
  });
  
  it('should parse Etrid recipient from memo', () => {
    // Test memo parsing
  });
});
```

### Cardano Monitor Tests

```typescript
import { CardanoMonitor } from './monitors/CardanoMonitor';

describe('CardanoMonitor', () => {
  it('should connect to Blockfrost preprod', async () => {
    const monitor = new CardanoMonitor({
      blockfrostApiKey: process.env.CARDANO_PREPROD_API_KEY!,
      blockfrostUrl: 'https://cardano-preprod.blockfrost.io/api/v0',
      network: 'preprod',
      bridgeAddress: 'addr_test1...',
      minConfirmations: 3,
      pollInterval: 10000,
      maxRetries: 3,
      retryDelay: 5000,
    });
    
    await monitor.start();
    expect(monitor.getStatus().isRunning).toBe(true);
    await monitor.stop();
  });
  
  it('should parse metadata label 674', () => {
    // Test metadata parsing
  });
});
```

### Stellar Monitor Tests

```typescript
import { StellarMonitor } from './monitors/StellarMonitor';

describe('StellarMonitor', () => {
  it('should connect to Stellar testnet', async () => {
    const monitor = new StellarMonitor({
      horizonUrl: 'https://horizon-testnet.stellar.org',
      network: 'testnet',
      bridgeAccountId: 'GTEST...',
      minConfirmations: 1,
      reconnectTimeout: 3000,
    });
    
    await monitor.start();
    expect(monitor.getStatus().isRunning).toBe(true);
    await monitor.stop();
  });
  
  it('should parse text memo', () => {
    // Test memo parsing
  });
});
```

## Integration Testing

### Test XRP Deposit Flow

```bash
# 1. Start monitor in testnet mode
XRP_ENABLED=true \
XRP_RPC_URL=wss://s.altnet.rippletest.net:51233 \
XRP_NETWORK=testnet \
XRP_BRIDGE_ADDRESS=rYourTestAddress \
npm run dev

# 2. Send test transaction on XRPL testnet
# Use https://xrpl.org/xrp-testnet-faucet.html

# 3. Verify deposit detected in logs
```

### Test Cardano Deposit Flow

```bash
# 1. Get preprod API key from https://blockfrost.io

# 2. Start monitor
CARDANO_ENABLED=true \
CARDANO_BLOCKFROST_API_KEY=preprodXXX \
CARDANO_NETWORK=preprod \
CARDANO_BRIDGE_ADDRESS=addr_test1... \
npm run dev

# 3. Send test transaction on Cardano preprod
# Use https://docs.cardano.org/cardano-testnet/overview/

# 4. Add metadata with label 674:
# { "674": { "recipient": "5GrwvaEF5..." } }

# 5. Verify deposit detected
```

### Test Stellar Deposit Flow

```bash
# 1. Create testnet account at https://laboratory.stellar.org

# 2. Start monitor
STELLAR_ENABLED=true \
STELLAR_HORIZON_URL=https://horizon-testnet.stellar.org \
STELLAR_NETWORK=testnet \
STELLAR_BRIDGE_ACCOUNT=GTEST... \
npm run dev

# 3. Send payment with text memo containing Etrid address

# 4. Verify deposit detected
```

## Load Testing

### Simulate High Volume

```typescript
// Create test harness
const depositRate = 100; // deposits per second

for (let i = 0; i < 1000; i++) {
  // Simulate deposit events
  await new Promise(resolve => setTimeout(resolve, 1000 / depositRate));
}
```

### Monitor Performance

```bash
# Check metrics
curl http://localhost:3000/metrics | grep deposits_detected

# Check error rate
curl http://localhost:3000/metrics | grep errors_total

# Check connection status
curl http://localhost:3000/health
```

## Error Injection Testing

### Test Reconnection Logic

```typescript
// 1. Start monitor
// 2. Kill network connection
// 3. Verify automatic reconnection
// 4. Check error metrics
```

### Test Rate Limiting

```typescript
// For Cardano (Blockfrost rate limits)
// 1. Set very low poll interval
// 2. Trigger rate limit
// 3. Verify exponential backoff
// 4. Verify recovery
```

### Test Invalid Data

```typescript
// Send transaction with:
// - Invalid memo format
// - Missing recipient
// - Invalid amount
// - Corrupted metadata

// Verify:
// - No crash
// - Proper error logging
// - Metrics updated
// - Monitor continues running
```

## Production Validation

### Pre-Deployment Checklist

- [ ] All tests pass
- [ ] Monitors connect successfully
- [ ] Deposits detected correctly
- [ ] Confirmations counted properly
- [ ] Recipient parsing works
- [ ] Metrics exposed correctly
- [ ] Health checks respond
- [ ] Errors logged properly
- [ ] Reconnection works
- [ ] Graceful shutdown works

### Smoke Tests in Production

```bash
# 1. Deploy to staging
# 2. Send small test deposits on mainnet
# 3. Verify detection and confirmation
# 4. Check logs and metrics
# 5. Verify no errors
# 6. Deploy to production
```

## Continuous Monitoring

### Alerts to Configure

```yaml
# Prometheus alerts
groups:
  - name: bridge_monitors
    rules:
      - alert: MonitorDisconnected
        expr: bridge_*_connected == 0
        for: 5m
        
      - alert: HighErrorRate
        expr: rate(bridge_*_errors_total[5m]) > 0.1
        for: 10m
        
      - alert: NoDepositsDetected
        expr: increase(bridge_*_deposits_detected_total[1h]) == 0
        for: 6h
        
      - alert: LagBehindChain
        expr: time() - bridge_*_last_ledger_timestamp > 300
        for: 5m
```

### Grafana Dashboards

- Connection status panel
- Deposit rate graph
- Error rate graph  
- Confirmation time histogram
- Block/ledger lag

## Test Coverage Goals

- Unit tests: > 80%
- Integration tests: > 70%
- End-to-end tests: All critical paths

## Running Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# Integration only
npm run test:integration

# Specific monitor
npm test -- XrpMonitor.test.ts
```

## Test Data

### XRP Test Addresses
- Testnet Faucet: https://xrpl.org/xrp-testnet-faucet.html
- Bridge Address: Generate via xrpl library

### Cardano Test Addresses  
- Preprod Faucet: https://docs.cardano.org/cardano-testnet/tools/faucet
- Use Eternl or Daedalus wallet for preprod

### Stellar Test Addresses
- Testnet: https://laboratory.stellar.org/#account-creator
- Fund via Friendbot

## Mock Responses

For unit tests, mock API responses:

```typescript
// Mock Blockfrost response
jest.mock('node-fetch', () => ({
  default: jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      tx_hash: '0x123...',
      slot: 12345678,
      // ...
    }),
  }),
}));
```

All monitors include comprehensive error handling and are ready for production testing!
