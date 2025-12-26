# Bridge Monitor Service

Production-ready blockchain monitoring service for Ëtrid bridge deposits across XRP, Cardano, and Stellar networks.

## Features

- **Multi-Chain Support**: Monitors XRP (Classic & EVM Sidechain), Cardano, and Stellar
- **Real-Time Streaming**: WebSocket and HTTP streaming for instant deposit detection
- **Production Ready**: Comprehensive error handling, reconnection logic, and monitoring
- **Prometheus Metrics**: Built-in metrics for observability
- **Type Safe**: Full TypeScript implementation with comprehensive type definitions
- **Event-Driven**: EventEmitter pattern for easy integration

## Monitors

### XRP Monitor
- XRPL Classic and EVM Sidechain support
- Destination tag and memo parsing
- Instant finality (1 confirmation)
- Handles ledger_index for confirmations

### Cardano Monitor
- UTXO-based deposit detection via Blockfrost API
- Transaction metadata parsing (CIP-20)
- Native token support
- Plutus datum/redeemer support

### Stellar Monitor
- Real-time payment streaming via Horizon API
- XLM and Stellar asset support
- Multiple memo types (text, hash, ID, return)
- Fast 5-second ledger times

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:
- Bridge addresses for each chain
- API keys (Blockfrost for Cardano)
- RPC/Horizon endpoints
- Confirmation requirements

## Usage

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t etrid-bridge-monitor .
docker run -p 3000:3000 --env-file .env etrid-bridge-monitor
```

## API Endpoints

- `GET /health` - Health check with monitor status
- `GET /metrics` - Prometheus metrics
- `GET /status` - Detailed service status

## Metrics

All monitors expose Prometheus metrics:

- Connection status
- Block/ledger height
- Deposits detected
- Error counts
- Processing timestamps

Access metrics at: http://localhost:3000/metrics

## Event Handling

Each monitor emits events:

```typescript
monitor.on('deposit', (deposit) => {
  // New deposit detected (not yet confirmed)
});

monitor.on('depositConfirmed', (deposit) => {
  // Deposit confirmed with required confirmations
  // Process and mint wrapped tokens here
});

monitor.on('error', (error) => {
  // Handle errors
});
```

## Architecture

```
bridge-monitor-service/
├── src/
│   ├── monitors/
│   │   ├── XrpMonitor.ts         # XRP/XRPL monitor
│   │   ├── CardanoMonitor.ts     # Cardano monitor
│   │   ├── StellarMonitor.ts     # Stellar monitor
│   │   ├── index.ts              # Monitor exports
│   │   └── README.md             # Monitor documentation
│   ├── utils/
│   │   └── logger.ts             # Winston logger
│   └── index.ts                  # Service entry point
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Development

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
npm run lint:fix
```

### Type Checking

```bash
npx tsc --noEmit
```

## Production Deployment

### Requirements
- Node.js >= 18.0.0
- API keys for Cardano (Blockfrost)
- Access to RPC endpoints

### Environment Variables

See `.env.example` for all configuration options.

### Monitoring

- Health checks: `GET /health`
- Prometheus metrics: `GET /metrics`
- Structured JSON logging via Winston

### High Availability

- Automatic reconnection with exponential backoff
- Event replay from cursors/checkpoints
- Graceful shutdown handling

## Troubleshooting

### XRP Monitor
- Verify WebSocket URL is accessible
- Check destination tag mapping
- Ensure bridge address is correct

### Cardano Monitor
- Verify Blockfrost API key
- Check rate limits (poll interval)
- Ensure UTXO tracking is working

### Stellar Monitor
- Check Horizon server status
- Verify memo parsing logic
- Monitor stream disconnections

See `src/monitors/README.md` for detailed troubleshooting.

## License

Apache-2.0
