# EDSC Relayer Service

Permissionless relayer service for the Ëtrid Dollar Stablecoin (EDSC) cross-chain bridge. This service fetches signed attestations from attestation services and submits them to destination chains (Ethereum or Ëtrid).

## Overview

The relayer service is responsible for:

1. **Polling attestation services** for ready attestations with M-of-N threshold signatures
2. **Submitting messages** to destination chains (Ethereum `MessageTransmitter` or Ëtrid `attestation` pallet)
3. **Tracking relay status** to avoid duplicate submissions and handle retries
4. **Managing gas** and transaction fees efficiently

**Anyone can run a relayer** - it's a permissionless role that earns transaction fees for completing cross-chain transfers.

## Architecture

```
┌─────────────────────────────────────────────┐
│         Relayer Service                     │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────────┐                          │
│  │ Attestation  │                          │
│  │ Fetcher      │                          │
│  │ (Poll APIs)  │                          │
│  └──────┬───────┘                          │
│         │                                   │
│         ▼                                   │
│  ┌──────────────┐                          │
│  │ Relay        │                          │
│  │ Tracker      │                          │
│  │ (Dedup)      │                          │
│  └──────┬───────┘                          │
│         │                                   │
│    ┌────┴────┐                             │
│    ▼         ▼                             │
│  ┌────┐   ┌────────┐                      │
│  │Eth │   │Substrate│                      │
│  │Relay│   │Relay   │                      │
│  └────┘   └────────┘                      │
│                                             │
└─────────────────────────────────────────────┘
```

## Features

- **Multi-service polling**: Fetch from multiple attestation services for redundancy
- **Automatic routing**: Routes messages to correct destination chain (Ethereum or Ëtrid)
- **Duplicate prevention**: Tracks relayed messages to avoid wasting gas
- **Smart retry logic**: Configurable retry attempts with exponential backoff
- **Gas optimization**: Configurable gas settings for Ethereum transactions
- **Balance monitoring**: Logs relayer balances on both chains
- **Health checking**: Monitors attestation service availability
- **Statistics tracking**: Records success/failure rates and relay counts

## Prerequisites

- Node.js 18+ and npm/yarn
- Access to Ëtrid node (WebSocket)
- Access to Ethereum node (HTTP or WebSocket)
- Relayer private key and funded accounts on both chains
- Access to at least one attestation service

## Installation

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

## Configuration

Edit the `.env` file with your relayer credentials:

```bash
# Attestation services (comma-separated)
ATTESTATION_SERVICE_URLS=http://localhost:3000,http://localhost:3001

# Chain connections
SUBSTRATE_WS_URL=ws://localhost:9944
ETHEREUM_RPC_URL=http://localhost:8545

# Relayer identity
RELAYER_ADDRESS=0x1234567890123456789012345678901234567890
RELAYER_PRIVATE_KEY=0x0123456789abcdef...

# Contract addresses
MESSAGE_TRANSMITTER_ADDRESS=0x0000000000000000000000000000000000000000
TOKEN_MESSENGER_ADDRESS=0x0000000000000000000000000000000000000000

# Polling settings
POLL_INTERVAL_MS=30000
MAX_RETRIES=3
RETRY_DELAY_MS=60000

# Gas settings
GAS_LIMIT=500000
MAX_FEE_PER_GAS=50
MAX_PRIORITY_FEE_PER_GAS=2

# Logging
LOG_LEVEL=info
```

### Configuration Fields

| Field | Description | Default |
|-------|-------------|---------|
| `ATTESTATION_SERVICE_URLS` | Comma-separated attestation service URLs | `http://localhost:3000` |
| `SUBSTRATE_WS_URL` | Ëtrid WebSocket endpoint | `ws://localhost:9944` |
| `ETHEREUM_RPC_URL` | Ethereum JSON-RPC endpoint | `http://localhost:8545` |
| `RELAYER_ADDRESS` | Your relayer's address | Required |
| `RELAYER_PRIVATE_KEY` | Your private key | Required |
| `MESSAGE_TRANSMITTER_ADDRESS` | Ethereum MessageTransmitter contract | Required for Eth relaying |
| `TOKEN_MESSENGER_ADDRESS` | Ethereum TokenMessenger contract | Optional |
| `POLL_INTERVAL_MS` | Poll frequency (milliseconds) | `30000` (30s) |
| `MAX_RETRIES` | Maximum retry attempts | `3` |
| `RETRY_DELAY_MS` | Retry delay (milliseconds) | `60000` (1min) |
| `GAS_LIMIT` | Ethereum gas limit | `500000` |
| `MAX_FEE_PER_GAS` | Max gas fee (gwei) | Network default |
| `MAX_PRIORITY_FEE_PER_GAS` | Priority fee (gwei) | Network default |
| `LOG_LEVEL` | Logging level | `info` |

## Usage

### Development Mode

```bash
# Run with ts-node
npm run dev

# Or with nodemon (auto-restart)
npm run watch
```

### Production Mode

```bash
# Build TypeScript
npm run build

# Start service
npm start
```

### Running with PM2

```bash
# Install PM2
npm install -g pm2

# Start service
pm2 start dist/index.js --name edsc-relayer

# View logs
pm2 logs edsc-relayer

# Monitor
pm2 monit

# Restart
pm2 restart edsc-relayer

# Stop
pm2 stop edsc-relayer
```

## How It Works

### 1. Polling for Attestations

The service polls configured attestation services every `POLL_INTERVAL_MS`:

```
GET http://attestation-service/attestations/ready
```

Returns attestations with threshold signatures (e.g., 3-of-5 attesters signed).

### 2. Relay Tracking

Before relaying, the service checks:

1. **Already relayed?** Skip to avoid wasting gas
2. **Currently relaying?** Skip to avoid race conditions
3. **Can retry?** Check retry count and delay

### 3. Message Routing

The service decodes the cross-chain message to determine:

- **Source domain**: Where the message originated (0=Ethereum, 2=Ëtrid)
- **Destination domain**: Where to relay (0=Ethereum, 2=Ëtrid)
- **Nonce**: Unique message identifier

### 4. Submission

**To Ethereum:**
```solidity
messageTransmitter.receiveMessage(messageBytes, signatures)
```

**To Ëtrid:**
```rust
attestation.receiveMessage(message, signatures)
```

### 5. Confirmation

- **Ethereum**: Waits for transaction receipt
- **Ëtrid**: Waits for finalization
- Records success/failure in relay tracker

## Economics

### Relayer Incentives

Relayers earn fees for completing cross-chain transfers:

- **Ethereum → Ëtrid**: Gas fees paid by user on Ethereum, relayer subsidizes Substrate tx
- **Ëtrid → Ethereum**: User pays Substrate tx, relayer earns gas refund on Ethereum

### Cost Considerations

**Ethereum Costs:**
- Gas: ~200,000-500,000 gas per relay
- At 50 gwei and $2000 ETH: $20-50 per relay

**Ëtrid Costs:**
- Minimal: ~0.001 EDSC per transaction

**Recommendation**: Focus on Ethereum → Ëtrid relays (cheaper) and batch when possible.

## Monitoring

### Logs

Logs are written to:
- `logs/combined.log` - All logs
- `logs/error.log` - Errors only
- Console - Colored output

### Statistics

Every 5 minutes, the service logs:

```json
{
  "uptime": 300000,
  "relays": {
    "total": 42,
    "pending": 0,
    "success": 40,
    "failed": 2,
    "byDestination": {
      "0": { "total": 20, "success": 19, "failed": 1 },
      "2": { "total": 22, "success": 21, "failed": 1 }
    }
  },
  "ethereum": {
    "isConnected": true,
    "totalRelays": 22,
    "successfulRelays": 21,
    "failedRelays": 1
  },
  "substrate": {
    "isConnected": true,
    "totalRelays": 20,
    "successfulRelays": 19,
    "failedRelays": 1
  }
}
```

### Balance Monitoring

At startup and periodically, the service logs balances:

```
Relayer balances: ethereum=5000000000000000000, substrate=1000000000000000000
```

Ensure sufficient balance on both chains to cover transaction fees.

## Troubleshooting

### Service won't start

1. Check `.env` configuration
2. Verify chain connections
3. Check attestation service URLs
4. Review logs in `logs/error.log`

### No attestations found

1. Check attestation services are running: `GET /health`
2. Verify services have ready attestations: `GET /attestations/ready`
3. Increase `LOG_LEVEL=debug` for more details
4. Check poll interval isn't too long

### Relays failing

**Ethereum:**
- Check `MESSAGE_TRANSMITTER_ADDRESS` is correct
- Verify relayer has sufficient ETH balance
- Check gas settings aren't too low
- Review contract events for errors

**Ëtrid:**
- Check attestation pallet is deployed
- Verify relayer has sufficient EDSC balance
- Check extrinsic format matches pallet expectations

### Already relayed messages

This is normal! The service automatically detects and skips already-relayed messages to save gas.

### High gas costs

1. Reduce `MAX_FEE_PER_GAS` (but risk slower confirmation)
2. Increase `POLL_INTERVAL_MS` to batch relays
3. Use Flashbots or MEV protection
4. Monitor gas prices and relay during low-fee periods

## Security Considerations

### Private Key Management

⚠️ **IMPORTANT**: Protect your private key!

For production:
- Use Hardware Security Modules (HSM)
- Use cloud key management (AWS KMS, Azure Key Vault)
- Use MPC (Multi-Party Computation) wallets
- Never commit `.env` to git

### Transaction Security

- The service only submits already-signed attestations
- All signature verification happens on-chain
- Relayers cannot forge or modify messages
- Failed relays don't compromise security

### Economic Security

- Monitor balances to avoid running out of funds
- Set gas limits to prevent excessive spending
- Track relay profitability
- Consider gas price thresholds

## Advanced Configuration

### Multiple Attestation Services

For redundancy, configure multiple services:

```bash
ATTESTATION_SERVICE_URLS=http://attestation1.example.com,http://attestation2.example.com,http://attestation3.example.com
```

The relayer will:
- Poll all services in parallel
- Deduplicate attestations by message hash
- Use first available service for manual queries

### Gas Optimization

**Dynamic gas pricing:**
```bash
# Don't set MAX_FEE_PER_GAS to use network default
# This automatically adjusts to current gas prices
```

**Fixed gas pricing:**
```bash
MAX_FEE_PER_GAS=30  # Set your max (gwei)
MAX_PRIORITY_FEE_PER_GAS=1
```

### Retry Strategy

Adjust retry behavior:

```bash
MAX_RETRIES=5          # Try up to 5 times
RETRY_DELAY_MS=300000  # Wait 5 minutes between retries
```

## Development

### Project Structure

```
services/relayer-service/
├── src/
│   ├── fetchers/
│   │   └── AttestationFetcher.ts  # Poll attestation services
│   ├── relayers/
│   │   ├── EthereumRelayer.ts     # Submit to Ethereum
│   │   └── SubstrateRelayer.ts    # Submit to Ëtrid
│   ├── utils/
│   │   ├── RelayTracker.ts        # Track relay status
│   │   └── logger.ts              # Winston logger
│   ├── types/
│   │   └── index.ts               # TypeScript types
│   └── index.ts                   # Main orchestrator
├── logs/
├── .env
├── .env.example
├── package.json
└── README.md
```

### Testing

```bash
npm test
```

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
```

## Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ dist/
CMD ["node", "dist/index.js"]
```

### Kubernetes

Deploy with proper resource limits and liveness probes.

### Systemd

```ini
[Unit]
Description=EDSC Relayer Service
After=network.target

[Service]
Type=simple
User=edsc
WorkingDirectory=/opt/edsc/relayer-service
ExecStart=/usr/bin/node dist/index.js
Restart=always
EnvironmentFile=/opt/edsc/relayer-service/.env

[Install]
WantedBy=multi-user.target
```

## Production Recommendations

1. **Monitoring**: Use Prometheus/Grafana for metrics
2. **Alerting**: Alert on balance drops, failed relays, connection issues
3. **Logging**: Centralized logging (ELK, Splunk, CloudWatch)
4. **High Availability**: Run multiple relayer instances (they'll deduplicate)
5. **Load Balancing**: Use multiple RPC endpoints with failover
6. **Backup Keys**: Keep encrypted backup of relayer key
7. **Auto-funding**: Implement automatic balance top-ups
8. **Profitability Tracking**: Track costs vs. fees earned

## License

Apache-2.0

## Support

For issues and questions:
- GitHub Issues: [etrid/etrid](https://github.com/etrid/etrid/issues)
- Documentation: [docs.etrid.org](https://docs.etrid.org)
- Discord: [discord.gg/etrid](https://discord.gg/etrid)
