# Quick Start Guide - Bitcoin Bridge Monitor

Get the Bitcoin bridge monitor up and running in 5 minutes.

## Prerequisites

- Node.js 18+
- Bitcoin bridge address (testnet or mainnet)
- ETRID node connection (optional for initial testing)

## 1. Install Dependencies

```bash
cd services/bridge-monitor-service
npm install
```

## 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set required values:

```env
# Required: Your Bitcoin bridge address
BITCOIN_BRIDGE_ADDRESS=tb1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh

# Network (testnet recommended for testing)
BITCOIN_NETWORK=testnet

# Optional: Faster polling for testing
BITCOIN_POLLING_INTERVAL=30000  # 30 seconds
```

## 3. Start the Service

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm run build
npm start
```

## 4. Test the Monitor

### Check Service Health

```bash
curl http://localhost:3002/health
```

Expected response:
```json
{
  "status": "healthy",
  "uptime": 12345,
  "timestamp": "2024-12-03T10:00:00.000Z",
  "monitors": {
    "bitcoin": {
      "isRunning": true,
      "lastBlock": 2563421,
      "eventsProcessed": 0,
      "errors": 0
    }
  }
}
```

### Check Bitcoin Monitor Status

```bash
curl http://localhost:3002/bitcoin/status
```

Expected response:
```json
{
  "isRunning": true,
  "lastBlock": 2563421,
  "eventsProcessed": 5,
  "errors": 0,
  "pendingDeposits": 2,
  "confirmedDeposits": 3
}
```

### View Processed Deposits

```bash
curl http://localhost:3002/bitcoin/deposits
```

### View Metrics

```bash
curl http://localhost:9092/metrics
```

## 5. Send a Test Deposit

### Create Bitcoin Transaction with OP_RETURN

Use a Bitcoin wallet or script to send a transaction to your bridge address with an OP_RETURN output containing your ETRID address:

```
Output 0: tb1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh (0.001 BTC)
Output 1: OP_RETURN 5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
Output 2: <your change address>
```

### Using Bitcoin CLI

```bash
# Create OP_RETURN data (hex-encoded ETRID address)
DATA="5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"

# Create raw transaction
bitcoin-cli createrawtransaction \
  '[{"txid":"<input_txid>","vout":0}]' \
  '{
    "tb1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh": 0.001,
    "data": "'$(echo -n $DATA | xxd -p)'"
  }'

# Sign and broadcast...
```

### Watch Logs

The monitor will detect the deposit after 1-2 polling cycles:

```
2024-12-03 10:15:23 [info]: Bitcoin deposit detected {
  txid: "abc123...",
  vout: 0,
  amount: 100000,
  recipient: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  confirmations: 1
}
```

After 6 confirmations:

```
2024-12-03 10:45:23 [info]: Bitcoin deposit confirmed {
  txid: "abc123...",
  vout: 0,
  amount: 100000,
  recipient: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  confirmations: 6,
  blockHeight: 2563427
}
```

## 6. Monitor Events

### Listen to Events Programmatically

```typescript
import { BitcoinMonitor, BitcoinNetwork } from './src/monitors/BitcoinMonitor';

const monitor = new BitcoinMonitor({
  network: BitcoinNetwork.TESTNET,
  bridgeAddress: 'tb1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
  minConfirmations: 6,
});

monitor.on('deposit', (depositEvent) => {
  console.log('Deposit confirmed!', depositEvent);

  // Submit to ETRID
  // await api.tx.bitcoinBridge.depositBtc(...).signAndSend();
});

monitor.on('error', (error) => {
  console.error('Monitor error:', error);
});

await monitor.start();
```

## 7. Docker Deployment

### Build and Run

```bash
docker-compose up -d
```

### Check Status

```bash
docker-compose ps
docker-compose logs -f bridge-monitor
```

### Stop

```bash
docker-compose down
```

## Troubleshooting

### Monitor Not Starting

**Check bridge address is configured:**
```bash
grep BITCOIN_BRIDGE_ADDRESS .env
```

**Check logs:**
```bash
tail -f logs/combined.log
```

### No Deposits Detected

**Verify transaction format:**
- Transaction sent to correct bridge address?
- OP_RETURN output included?
- ETRID address in OP_RETURN is valid?

**Check block explorer:**
```
https://blockstream.info/testnet/address/<your_bridge_address>
```

**Check monitor status:**
```bash
curl http://localhost:3002/bitcoin/status
```

### High Error Rate

**Check API connectivity:**
```bash
curl https://blockstream.info/testnet/api/blocks/tip/height
```

**Switch API endpoint:**
```env
BITCOIN_API_URL=https://mempool.space/testnet/api
```

## Next Steps

1. **Configure ETRID Connection**: Add ETRID substrate connection for automatic extrinsic submission
2. **Enable Metrics**: Set up Prometheus and Grafana for monitoring
3. **Add Alerting**: Configure webhooks or email notifications
4. **Production Setup**: Use mainnet configuration with proper security
5. **Scale**: Deploy multiple instances behind a load balancer

## Useful Commands

```bash
# Build TypeScript
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run typecheck

# Clean build
npm run clean && npm run build

# Watch mode (auto-restart on changes)
npm run watch
```

## Example Output

```
2024-12-03 10:00:00 [info]: Logger initialized
2024-12-03 10:00:00 [info]: Starting Bridge Monitor Service...
2024-12-03 10:00:00 [info]: Starting Bitcoin monitor...
2024-12-03 10:00:01 [info]: Connected to Bitcoin network { network: 'testnet', blockHeight: 2563421 }
2024-12-03 10:00:01 [info]: Bitcoin monitor started
2024-12-03 10:00:01 [info]: API server listening on port 3002
2024-12-03 10:00:01 [info]: Metrics server listening on port 9092
2024-12-03 10:00:01 [info]: Bridge Monitor Service started successfully
```

## Support

- **Documentation**: See [README.md](./README.md) for complete documentation
- **Issues**: https://github.com/etrid/etrid/issues
- **Discord**: https://discord.gg/etrid
