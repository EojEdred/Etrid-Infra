# Multi-Chain Relayer

Production-ready multi-chain relayer service for routing attestations to destination chains.

## Features

- **Multi-Chain Support**: Ethereum, Solana, Substrate, Polygon, BNB Chain, Avalanche, Arbitrum, Optimism, Tron
- **Signature Aggregation**: M-of-N threshold validation
- **Relay Tracking**: Deduplication and status tracking
- **Retry Logic**: Exponential backoff for failed relays
- **Gas Estimation**: Per-chain gas optimization
- **Chain-Specific Handling**: EVM, Solana, Substrate, and Tron support
- **Prometheus Metrics**: Comprehensive monitoring
- **REST API**: Status queries and statistics
- **Production-Ready**: Error handling, logging, graceful shutdown

## Architecture

```
MultiChainRelayer (Orchestrator)
├── EVMRelayer (Ethereum, Polygon, BNB, Avalanche, Arbitrum, Optimism)
├── SolanaRelayer (Solana)
├── SubstrateRelayer (Ëtrid/Substrate)
├── TronRelayer (Tron)
├── RelayTracker (Status tracking with exponential backoff)
├── RelayerAPI (REST API for queries)
└── RelayerMetrics (Prometheus metrics)
```

## Domain IDs

| Chain       | Domain | Type      |
|-------------|--------|-----------|
| Ethereum    | 0      | EVM       |
| Solana      | 1      | Solana    |
| Substrate   | 2      | Substrate |
| Polygon     | 3      | EVM       |
| BNB Chain   | 4      | EVM       |
| Avalanche   | 5      | EVM       |
| Arbitrum    | 6      | EVM       |
| Optimism    | 7      | EVM       |
| Tron        | 8      | Tron      |

## Installation

```bash
npm install
```

## Configuration

### Environment Variables

```bash
# Relayer Identity
RELAYER_PRIVATE_KEY=0x...
RELAYER_ADDRESS=0x...

# Attestation Services (comma-separated)
ATTESTATION_SERVICE_URL_1=http://attestation-1.etrid.network
ATTESTATION_SERVICE_URL_2=http://attestation-2.etrid.network

# Chain RPC URLs
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

# Signature Threshold
SIGNATURE_THRESHOLD=2
TOTAL_ATTESTORS=3

# Retry Configuration
MAX_RETRIES=5
RETRY_DELAY_MS=60000  # 1 minute
EXPONENTIAL_BACKOFF=true

# Polling
POLL_INTERVAL_MS=30000  # 30 seconds

# API
ENABLE_API=true
API_PORT=3001

# Metrics
METRICS_ENABLED=true
METRICS_PORT=9090
```

## Usage

### Basic Usage

```typescript
import { MultiChainRelayer, MultiChainRelayerConfig } from './relayer';

// Create configuration
const config: MultiChainRelayerConfig = {
  attestationServiceUrls: ['http://attestation.etrid.network'],
  relayerPrivateKey: process.env.RELAYER_PRIVATE_KEY!,
  relayerAddress: process.env.RELAYER_ADDRESS!,
  chains: chainsMap,
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

// Create relayer
const relayer = new MultiChainRelayer(config);

// Initialize chains
await relayer.initialize();

// Start relayer
await relayer.start();

// Process attestation
await relayer.processAttestation(attestation);
```

### Event Handling

```typescript
// Successful relay
relayer.on('relaySuccess', (result, duration) => {
  console.log(`Relayed to ${result.chain}: ${result.txHash}`);
});

// Failed relay
relayer.on('relayFailed', (result) => {
  console.error(`Relay failed: ${result.error}`);
});

// Retry needed
relayer.on('retryNeeded', (relay) => {
  console.log(`Retry needed for ${relay.messageHash}`);
});
```

### Query Status

```typescript
// Get relay by message hash
const relay = relayer.getRelay(messageHash);

// Get relay by nonce
const relay = relayer.getRelayByNonce(sourceDomain, nonce);

// Get statistics
const stats = relayer.getStats();
const chainStats = relayer.getChainStats();
const health = relayer.getHealth();
```

## REST API

### Endpoints

#### `GET /health`
Get service health status.

**Response:**
```json
{
  "status": "healthy",
  "uptime": 123456,
  "totalRelays": 100,
  "successfulRelays": 95,
  "failedRelays": 5,
  "pendingRelays": 0,
  "chains": {
    "0": {
      "name": "Ethereum",
      "connected": true,
      "currentBlock": 12345678,
      "balance": "1000000000000000000"
    }
  }
}
```

#### `GET /relay/:messageHash`
Get relay status by message hash.

**Response:**
```json
{
  "found": true,
  "relay": {
    "messageHash": "0x...",
    "sourceDomain": 0,
    "destinationDomain": 2,
    "nonce": "1",
    "status": "success",
    "attempts": 1,
    "txHash": "0x...",
    "createdAt": 1234567890,
    "updatedAt": 1234567890
  }
}
```

#### `GET /relay/:sourceDomain/:nonce`
Get relay status by source domain and nonce.

#### `GET /stats`
Get relay statistics.

**Response:**
```json
{
  "stats": {
    "total": 100,
    "pending": 0,
    "relaying": 0,
    "success": 95,
    "failed": 5,
    "byDestination": {
      "0": {
        "total": 50,
        "success": 48,
        "failed": 2,
        "chainName": "Ethereum"
      }
    }
  },
  "chainStats": [...]
}
```

#### `GET /chains`
Get all connected chains.

#### `GET /chain/:domain`
Get specific chain status.

#### `GET /metrics`
Get Prometheus metrics (text format).

#### `GET /stats/total`
Get comprehensive statistics including retry stats.

## Metrics

### Prometheus Metrics

- `relayer_attestations_processed_total` - Total attestations processed
- `relayer_relays_attempted_total{chain, domain}` - Total relay attempts
- `relayer_relays_success_total{chain, domain}` - Successful relays
- `relayer_relays_failed_total{chain, domain, error}` - Failed relays
- `relayer_chains_connected` - Number of connected chains
- `relayer_relays_pending{chain, domain}` - Pending relays
- `relayer_relays_relaying{chain, domain}` - Relays in progress
- `relayer_balance{chain, domain, unit}` - Relayer balance per chain
- `relayer_relay_duration_seconds{chain, domain, success}` - Relay duration histogram
- `relayer_relay_gas_used{chain, domain}` - Gas used histogram

## Retry Logic

The relayer implements exponential backoff for failed relays:

- **Attempt 1**: Immediate
- **Attempt 2**: +1 minute (delay × 2^0)
- **Attempt 3**: +2 minutes (delay × 2^1)
- **Attempt 4**: +4 minutes (delay × 2^2)
- **Attempt 5**: +8 minutes (delay × 2^3)

Maximum delay is capped at 1 hour.

## Gas Estimation

Each chain relayer estimates gas before submitting transactions:

### EVM Chains
- Calls `estimateGas()` on contract
- Adds 20% buffer
- Supports EIP-1559 (maxFeePerGas, maxPriorityFeePerGas)
- Supports legacy (gasPrice)

### Solana
- Uses compute units (~200,000 typical)

### Substrate
- Uses weight system
- Calls `paymentInfo()` for estimation

### Tron
- Estimates energy usage
- Converts to TRX (420 sun per energy unit)

## Error Handling

All errors are caught and logged. Failed relays are tracked and retried with exponential backoff.

### Common Errors

- **"Not connected"** - Chain relayer not initialized
- **"Already received"** - Message already processed on chain
- **"Signature threshold not met"** - Insufficient signatures
- **"No relayer configured"** - Chain not enabled
- **"Transaction failed"** - On-chain execution failed

## Production Deployment

### Docker

```bash
docker build -t multi-chain-relayer .
docker run -d \
  --name relayer \
  -p 3001:3001 \
  -p 9090:9090 \
  -e RELAYER_PRIVATE_KEY=$RELAYER_PRIVATE_KEY \
  multi-chain-relayer
```

### Kubernetes

```yaml
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
    spec:
      containers:
      - name: relayer
        image: multi-chain-relayer:latest
        ports:
        - containerPort: 3001
        - containerPort: 9090
        env:
        - name: RELAYER_PRIVATE_KEY
          valueFrom:
            secretKeyRef:
              name: relayer-secrets
              key: privateKey
```

### Monitoring

Set up Prometheus to scrape metrics:

```yaml
scrape_configs:
  - job_name: 'multi-chain-relayer'
    static_configs:
      - targets: ['relayer:9090']
```

Create Grafana dashboards for:
- Relay success/failure rates
- Relay duration
- Gas usage
- Chain connection status
- Relayer balances
- Retry statistics

## Testing

```bash
# Run tests
npm test

# Run example
npm run example

# Check types
npm run typecheck
```

## Security

- **Private Key Management**: Use environment variables or secrets management
- **RPC Endpoints**: Use authenticated/private RPC endpoints in production
- **Rate Limiting**: Consider rate limits on API endpoints
- **Monitoring**: Set up alerts for failed relays and low balances

## Troubleshooting

### Relayer not connecting to chain

1. Check RPC URL is correct and accessible
2. Verify chain ID matches configuration
3. Check contract address is valid
4. Ensure relayer has sufficient balance

### Relays failing consistently

1. Check contract is deployed at configured address
2. Verify signature format matches chain expectations
3. Check gas configuration is sufficient
4. Review contract logs for revert reasons

### High retry rate

1. Increase gas limits
2. Check RPC endpoint stability
3. Verify signature threshold configuration
4. Review chain-specific transaction requirements

## License

MIT

## Support

For issues and questions, please open an issue on GitHub or contact support@etrid.network.
