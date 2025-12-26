# Multi-Chain Relayer - Quick Start Guide

## Installation

```bash
cd /Users/macbook/Desktop/etrid/services/bridge-monitor-service
npm install
```

## Environment Setup

Create a `.env` file:

```bash
# Relayer Identity
RELAYER_PRIVATE_KEY=0x1234567890abcdef...
RELAYER_ADDRESS=0xYourRelayerAddress

# Attestation Services
ATTESTATION_SERVICE_URL_1=http://attestation-1.etrid.network
ATTESTATION_SERVICE_URL_2=http://attestation-2.etrid.network

# Chain RPC URLs (use your own or public endpoints)
ETHEREUM_RPC_URL=https://eth.llamarpc.com
POLYGON_RPC_URL=https://polygon-rpc.com
BNB_RPC_URL=https://bsc-dataseed1.binance.org
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
OPTIMISM_RPC_URL=https://mainnet.optimism.io
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SUBSTRATE_WS_URL=wss://rpc.etrid.network
TRON_RPC_URL=https://api.trongrid.io

# Contract Addresses
ETH_MESSAGE_TRANSMITTER=0x...
POLYGON_MESSAGE_TRANSMITTER=0x...
BNB_MESSAGE_TRANSMITTER=0x...
AVAX_MESSAGE_TRANSMITTER=0x...
ARB_MESSAGE_TRANSMITTER=0x...
OP_MESSAGE_TRANSMITTER=0x...
SOLANA_MESSAGE_TRANSMITTER_PROGRAM=...
TRON_MESSAGE_TRANSMITTER=T...

# Configuration
SIGNATURE_THRESHOLD=2
TOTAL_ATTESTORS=3
MAX_RETRIES=5
RETRY_DELAY_MS=60000
EXPONENTIAL_BACKOFF=true
POLL_INTERVAL_MS=30000

# API & Metrics
ENABLE_API=true
API_PORT=3001
METRICS_ENABLED=true
METRICS_PORT=9090
```

## Run the Example

```bash
npm run dev
```

This will:
1. Connect to all configured chains
2. Start the relay service
3. Start the API server on port 3001
4. Start metrics endpoint on port 9090

## Test the API

### Health Check
```bash
curl http://localhost:3001/health
```

### Get Statistics
```bash
curl http://localhost:3001/stats
```

### Get Connected Chains
```bash
curl http://localhost:3001/chains
```

### Query Relay Status
```bash
curl http://localhost:3001/relay/0x1234...
```

### Get Prometheus Metrics
```bash
curl http://localhost:3001/metrics
```

## Basic Integration

```typescript
import { MultiChainRelayer, MultiChainRelayerConfig, ChainConfig, ChainDomain, ChainType } from './src/relayer';

// 1. Configure chains
const chains = new Map<number, ChainConfig>();

chains.set(ChainDomain.Ethereum, {
  domain: ChainDomain.Ethereum,
  name: 'Ethereum',
  type: ChainType.EVM,
  rpcUrl: process.env.ETHEREUM_RPC_URL!,
  chainId: 1,
  messageTransmitterAddress: process.env.ETH_MESSAGE_TRANSMITTER,
  confirmations: 2,
  gasConfig: {
    maxFeePerGas: '50',
    maxPriorityFeePerGas: '2',
  },
  enabled: true,
});

// Add more chains...

// 2. Create config
const config: MultiChainRelayerConfig = {
  attestationServiceUrls: [process.env.ATTESTATION_SERVICE_URL_1!],
  relayerPrivateKey: process.env.RELAYER_PRIVATE_KEY!,
  relayerAddress: process.env.RELAYER_ADDRESS!,
  chains,
  signatureThreshold: 2,
  totalAttestors: 3,
  pollIntervalMs: 30000,
  maxRetries: 5,
  retryDelayMs: 60000,
  exponentialBackoff: true,
  metricsEnabled: true,
  metricsPort: 9090,
  enableApi: true,
  apiPort: 3001,
};

// 3. Create and initialize
const relayer = new MultiChainRelayer(config);
await relayer.initialize();
await relayer.start();

// 4. Process attestation
await relayer.processAttestation(attestation);
```

## Event Handling

```typescript
// Success
relayer.on('relaySuccess', (result, duration) => {
  console.log(`✓ Relayed to ${result.chain}`, {
    txHash: result.txHash,
    gasUsed: result.gasUsed?.toString(),
    duration: `${duration}s`,
  });
});

// Failure
relayer.on('relayFailed', (result) => {
  console.error(`✗ Relay failed: ${result.chain}`, {
    error: result.error,
  });
});

// Retry needed
relayer.on('retryNeeded', (relay) => {
  console.log('⟳ Retry needed', {
    messageHash: relay.messageHash,
    attempts: relay.attempts,
  });
});
```

## Monitoring

### Grafana Dashboard

Create a dashboard with panels for:

1. **Relay Success Rate**
   ```promql
   rate(relayer_relays_success_total[5m]) / rate(relayer_relays_attempted_total[5m]) * 100
   ```

2. **Relay Duration**
   ```promql
   histogram_quantile(0.95, rate(relayer_relay_duration_seconds_bucket[5m]))
   ```

3. **Chains Connected**
   ```promql
   relayer_chains_connected
   ```

4. **Pending Relays**
   ```promql
   sum(relayer_relays_pending)
   ```

5. **Relayer Balances**
   ```promql
   relayer_balance
   ```

### Alerts

Set up alerts for:

```yaml
- alert: LowRelayerBalance
  expr: relayer_balance < 0.1
  labels:
    severity: warning
  annotations:
    summary: "Low relayer balance on {{ $labels.chain }}"

- alert: HighRelayFailureRate
  expr: rate(relayer_relays_failed_total[5m]) > 0.1
  labels:
    severity: critical
  annotations:
    summary: "High relay failure rate"

- alert: ChainDisconnected
  expr: relayer_chains_connected < 5
  labels:
    severity: critical
  annotations:
    summary: "One or more chains disconnected"
```

## Production Deployment

### Docker

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3001 9090

CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t multi-chain-relayer .
docker run -d \
  --name relayer \
  -p 3001:3001 \
  -p 9090:9090 \
  --env-file .env \
  multi-chain-relayer
```

### Kubernetes

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: relayer-secrets
type: Opaque
stringData:
  privateKey: "0x..."

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: relayer-config
data:
  ETHEREUM_RPC_URL: "https://eth.llamarpc.com"
  POLYGON_RPC_URL: "https://polygon-rpc.com"
  # ... other config

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: multi-chain-relayer
spec:
  replicas: 1
  selector:
    matchLabels:
      app: relayer
  template:
    metadata:
      labels:
        app: relayer
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      containers:
      - name: relayer
        image: multi-chain-relayer:latest
        ports:
        - containerPort: 3001
          name: api
        - containerPort: 9090
          name: metrics
        env:
        - name: RELAYER_PRIVATE_KEY
          valueFrom:
            secretKeyRef:
              name: relayer-secrets
              key: privateKey
        envFrom:
        - configMapRef:
            name: relayer-config
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3001
          initialDelaySeconds: 10
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: relayer-service
spec:
  selector:
    app: relayer
  ports:
  - name: api
    port: 3001
    targetPort: 3001
  - name: metrics
    port: 9090
    targetPort: 9090
```

Apply:
```bash
kubectl apply -f relayer-deployment.yaml
```

## Troubleshooting

### Issue: Relayer not connecting to chain

**Solution:**
1. Check RPC URL is accessible
2. Verify chain ID matches configuration
3. Check contract address is correct
4. Ensure relayer has sufficient balance

```bash
# Test RPC connection
curl -X POST $ETHEREUM_RPC_URL \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

### Issue: Relays failing consistently

**Solution:**
1. Check contract logs for revert reasons
2. Verify signature format
3. Increase gas limits
4. Check message format

```bash
# Query relay status
curl http://localhost:3001/relay/0x1234...

# Check metrics for error patterns
curl http://localhost:3001/metrics | grep failed
```

### Issue: High retry rate

**Solution:**
1. Increase gas limits in config
2. Check RPC endpoint stability
3. Verify signature threshold is correct
4. Review chain-specific requirements

```bash
# Get retry statistics
curl http://localhost:3001/stats/retry
```

## Support

For issues and questions:
- GitHub: https://github.com/etrid/etrid
- Docs: https://docs.etrid.network
- Email: support@etrid.network

## Next Steps

1. ✅ Configure your chains in `.env`
2. ✅ Run the example with `npm run dev`
3. ✅ Test with sample attestations
4. ✅ Set up monitoring (Grafana + Prometheus)
5. ✅ Deploy to production (Docker/Kubernetes)
6. ✅ Set up alerts for critical metrics
7. ✅ Monitor relayer balances regularly

## Documentation

Full documentation available at:
- `/Users/macbook/Desktop/etrid/services/bridge-monitor-service/src/relayer/README.md`
- `/Users/macbook/Desktop/etrid/services/bridge-monitor-service/MULTICHAIN_RELAYER_SUMMARY.md`
