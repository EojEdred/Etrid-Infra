# EDSC Attestation Service

Off-chain attestation service for the Ëtrid Dollar Stablecoin (EDSC) cross-chain bridge. This service monitors both Ëtrid (Substrate) and Ethereum chains for burn events, signs cross-chain messages, and provides a REST API for relayers to fetch attestations.

## Architecture

The attestation service implements a CCTP-style (Cross-Chain Transfer Protocol) architecture:

1. **Chain Monitors**: Watch both Ëtrid and Ethereum for burn events
2. **Message Signer**: Signs messages with ECDSA (Ethereum) or SR25519 (Substrate)
3. **Attestation Store**: Aggregates signatures from multiple attesters (M-of-N threshold)
4. **REST API**: Provides endpoints for relayers to fetch signed attestations

## Features

- **Dual-chain monitoring**: Substrate (WebSocket) and Ethereum (JSON-RPC)
- **Dual signature support**: ECDSA for Ethereum, SR25519 for Substrate
- **M-of-N threshold signatures**: Configurable signature requirements (default 3-of-5)
- **Automatic signature aggregation**: Combines signatures from multiple attesters
- **REST API**: Easy integration for relayers
- **Health monitoring**: Service and chain status endpoints
- **Graceful shutdown**: Proper cleanup of connections
- **Configurable confirmations**: Wait for block finality before processing

## Prerequisites

- Node.js 18+ and npm/yarn
- Access to Ëtrid node (WebSocket)
- Access to Ethereum node (HTTP or WebSocket)
- Attester private key (must be registered in AttesterRegistry contract)

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

Edit the `.env` file with your attester credentials:

```bash
# Chain connections
SUBSTRATE_WS_URL=ws://localhost:9944
ETHEREUM_RPC_URL=http://localhost:8545

# Attester identity
ATTESTER_ID=0
ATTESTER_ADDRESS=0x1234567890123456789012345678901234567890
ATTESTER_PRIVATE_KEY=0x0123456789abcdef...

# Signature thresholds
MIN_SIGNATURES=3
TOTAL_ATTESTERS=5

# Security
CONFIRMATIONS_REQUIRED=2

# Ethereum contract
TOKEN_MESSENGER_ADDRESS=0x0000000000000000000000000000000000000000

# API
PORT=3000
LOG_LEVEL=info
```

### Configuration Fields

| Field | Description | Default |
|-------|-------------|---------|
| `SUBSTRATE_WS_URL` | Ëtrid WebSocket endpoint | `ws://localhost:9944` |
| `ETHEREUM_RPC_URL` | Ethereum JSON-RPC endpoint | `http://localhost:8545` |
| `ATTESTER_ID` | Your attester ID (0-based index) | Required |
| `ATTESTER_ADDRESS` | Your Ethereum address | Required |
| `ATTESTER_PRIVATE_KEY` | Your private key (secp256k1) | Required |
| `MIN_SIGNATURES` | M in M-of-N threshold | `3` |
| `TOTAL_ATTESTERS` | N in M-of-N threshold | `5` |
| `CONFIRMATIONS_REQUIRED` | Block confirmations to wait | `2` |
| `TOKEN_MESSENGER_ADDRESS` | Ethereum TokenMessenger contract | Optional |
| `PORT` | API server port | `3000` |
| `LOG_LEVEL` | Logging level (error, warn, info, debug) | `info` |

## Usage

### Development Mode

```bash
# Run with ts-node (hot reload)
npm run dev

# Or with nodemon (auto-restart on changes)
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
pm2 start dist/index.js --name edsc-attester

# View logs
pm2 logs edsc-attester

# Restart service
pm2 restart edsc-attester

# Stop service
pm2 stop edsc-attester
```

## REST API

The service exposes a REST API on `http://localhost:3000` (or configured PORT).

### Health Check

```bash
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "uptime": 123456,
  "substrate": {
    "isRunning": true,
    "lastBlock": 1234567,
    "eventsProcessed": 42,
    "errors": 0
  },
  "ethereum": {
    "isRunning": true,
    "lastBlock": 8901234,
    "eventsProcessed": 38,
    "errors": 0
  },
  "pendingAttestations": 5,
  "readyAttestations": 12
}
```

### Get Attestation by Message Hash

```bash
GET /attestation/:messageHash
```

**Example:**
```bash
curl http://localhost:3000/attestation/0x1234...
```

**Response:**
```json
{
  "messageHash": "0x1234...",
  "message": "0xabcd...",
  "signatures": [
    "0x5678...",
    "0x9abc...",
    "0xdef0..."
  ],
  "signatureCount": 3,
  "thresholdMet": true,
  "status": "ready"
}
```

### Get Attestation by Domain and Nonce

```bash
GET /attestation/:sourceDomain/:nonce
```

**Example:**
```bash
# Get attestation from Ethereum (domain 0) with nonce 42
curl http://localhost:3000/attestation/0/42
```

### Get All Ready Attestations

```bash
GET /attestations/ready
```

**Response:**
```json
{
  "count": 2,
  "attestations": [
    {
      "messageHash": "0x1234...",
      "message": "0xabcd...",
      "signatures": ["0x5678...", "0x9abc...", "0xdef0..."],
      "signatureCount": 3,
      "thresholdMet": true,
      "status": "ready"
    }
  ]
}
```

### Get Service Statistics

```bash
GET /stats
```

**Response:**
```json
{
  "attestations": {
    "total": 20,
    "pending": 5,
    "ready": 12,
    "relayed": 2,
    "expired": 1
  },
  "substrate": {
    "lastBlock": 1234567,
    "eventsProcessed": 42,
    "errors": 0
  },
  "ethereum": {
    "lastBlock": 8901234,
    "eventsProcessed": 38,
    "errors": 0
  }
}
```

### Get Monitor Status

```bash
GET /status
```

**Response:**
```json
{
  "substrate": {
    "isRunning": true,
    "lastBlock": 1234567,
    "eventsProcessed": 42,
    "errors": 0,
    "lastError": null,
    "lastErrorTime": null
  },
  "ethereum": {
    "isRunning": true,
    "lastBlock": 8901234,
    "eventsProcessed": 38,
    "errors": 0,
    "lastError": null,
    "lastErrorTime": null
  }
}
```

## How It Works

### 1. Monitoring Chains

The service monitors both chains for burn events:

- **Ëtrid → Ethereum**: Monitors `tokenMessenger.BurnMessageSent` events on Ëtrid
- **Ethereum → Ëtrid**: Monitors `MessageSent` events on Ethereum TokenMessenger contract

### 2. Signing Messages

When a burn event is detected:

1. Construct cross-chain message from event data
2. Compute message hash
3. Sign hash with appropriate key (ECDSA for Ethereum, SR25519 for Substrate)
4. Store signature in attestation store

### 3. Signature Aggregation

The attestation store:

1. Collects signatures from multiple attesters
2. Tracks threshold (e.g., 3-of-5 signatures)
3. Marks attestation as "ready" when threshold is met
4. Expires attestations after 1 hour

### 4. Relaying

Relayers (separate service) fetch ready attestations via REST API and submit to destination chain.

## Security Considerations

### Private Key Management

⚠️ **IMPORTANT**: Never commit your `.env` file or expose your private key!

For production:
- Use Hardware Security Modules (HSM)
- Use cloud key management services (AWS KMS, Google Cloud KMS, Azure Key Vault)
- Use environment variables set by your deployment platform
- Rotate keys regularly

### Network Security

- Use firewalls to restrict API access
- Use HTTPS/WSS in production
- Implement rate limiting
- Monitor for suspicious activity

### Confirmation Requirements

Set `CONFIRMATIONS_REQUIRED` based on your security needs:
- **Low security (testing)**: 1-2 confirmations
- **Medium security**: 5-10 confirmations
- **High security**: 20+ confirmations

More confirmations = slower but more secure against chain reorganizations.

## Troubleshooting

### Service won't start

1. Check your `.env` configuration
2. Verify chain connections: `telnet localhost 9944`, `curl http://localhost:8545`
3. Check logs in `logs/combined.log` and `logs/error.log`

### No events being processed

1. Check monitor status via `/status` endpoint
2. Verify contract address is correct
3. Check if blocks are being processed: look for `lastBlock` changes
4. Increase `LOG_LEVEL=debug` for more details

### Signatures not aggregating

1. Verify `ATTESTER_ID` is unique across attesters
2. Check that M-of-N thresholds are configured correctly
3. Ensure all attesters are monitoring the same chains
4. Check that message hashes match across attesters

### API returning 404

1. Verify attestation exists: check `/attestations/ready`
2. Wait for threshold: attestation might still be "pending"
3. Check if attestation expired (1 hour TTL)

## Development

### Project Structure

```
services/attestation-service/
├── src/
│   ├── api/
│   │   └── server.ts          # REST API server
│   ├── monitors/
│   │   ├── SubstrateMonitor.ts # Ëtrid event monitor
│   │   └── EthereumMonitor.ts  # Ethereum event monitor
│   ├── signers/
│   │   └── MessageSigner.ts    # ECDSA + SR25519 signing
│   ├── utils/
│   │   ├── AttestationStore.ts # In-memory attestation store
│   │   └── logger.ts           # Winston logger
│   ├── types/
│   │   └── index.ts            # TypeScript type definitions
│   └── index.ts                # Main orchestrator
├── logs/                       # Log files
├── .env                        # Configuration (gitignored)
├── .env.example                # Configuration template
├── package.json
├── tsconfig.json
└── README.md
```

### Building

```bash
npm run build
```

Compiled output will be in `dist/` directory.

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
```

### Testing

```bash
npm test
```

## Deployment

### Docker

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY dist/ dist/
CMD ["node", "dist/index.js"]
```

Build and run:

```bash
docker build -t edsc-attester .
docker run -d --env-file .env -p 3000:3000 --name edsc-attester edsc-attester
```

### Kubernetes

Create deployment with secrets for sensitive configuration.

### Systemd

Create service file `/etc/systemd/system/edsc-attester.service`:

```ini
[Unit]
Description=EDSC Attestation Service
After=network.target

[Service]
Type=simple
User=edsc
WorkingDirectory=/opt/edsc/attestation-service
ExecStart=/usr/bin/node dist/index.js
Restart=always
EnvironmentFile=/opt/edsc/attestation-service/.env

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable edsc-attester
sudo systemctl start edsc-attester
sudo systemctl status edsc-attester
```

## Production Recommendations

1. **High Availability**: Run multiple attester instances with different IDs
2. **Monitoring**: Use Prometheus/Grafana to monitor service health
3. **Alerting**: Set up alerts for errors, downtime, and signature failures
4. **Logging**: Use centralized logging (ELK stack, Splunk, CloudWatch)
5. **Redis**: Replace in-memory AttestationStore with Redis for persistence
6. **Load Balancer**: Use nginx/HAProxy for API if needed
7. **Backup**: Regular backups of attestation data
8. **Key Rotation**: Rotate attester keys periodically

## License

Apache-2.0

## Support

For issues and questions:
- GitHub Issues: [etrid/etrid](https://github.com/etrid/etrid/issues)
- Documentation: [docs.etrid.org](https://docs.etrid.org)
- Discord: [discord.gg/etrid](https://discord.gg/etrid)
