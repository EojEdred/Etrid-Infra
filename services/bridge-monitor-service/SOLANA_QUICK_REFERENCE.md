# Solana Bridge Monitor - Quick Reference Card

## File Locations

```
/Users/macbook/Desktop/etrid/services/bridge-monitor-service/
├── src/monitors/
│   ├── SolanaMonitor.ts           # Main implementation (22KB, 930 lines)
│   ├── SolanaMonitor.example.ts   # Integration examples
│   ├── SolanaMonitor.test.ts      # Unit tests
│   └── README.md                  # Detailed documentation
├── src/types/index.ts             # Type definitions (updated)
├── src/metrics/index.ts           # Prometheus metrics (updated)
├── src/utils/logger.ts            # Winston logger
├── .env.solana.example            # Configuration template
├── docker-compose.solana.yml      # Docker deployment
├── SOLANA_DEPLOYMENT.md           # Production deployment guide
├── SOLANA_MONITOR_SUMMARY.md      # Implementation summary
└── SOLANA_ARCHITECTURE.txt        # ASCII architecture diagram
```

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure
cp .env.solana.example .env
# Edit .env with your settings

# 3. Start development
npm run dev

# 4. Production
npm run build && npm start
```

## Environment Variables (Minimal)

```env
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_WS_URL=wss://api.mainnet-beta.solana.com
SOLANA_BRIDGE_PROGRAM_ID=BRGPidxhcsLVFBQ5zZqRHZ8bKRAHhAhiEDCfqELV8M7u
SUBSTRATE_WS_URL=ws://127.0.0.1:9944
RELAYER_SEED=//Alice
MIN_CONFIRMATIONS=31
```

## Usage Example

```typescript
import { SolanaMonitor } from './monitors/SolanaMonitor';

const monitor = new SolanaMonitor(config);

// Listen for deposits
monitor.on('depositConfirmed', async (deposit) => {
  console.log('Deposit:', deposit);
  // Submit to ËTRID via extrinsic
});

// Listen for burns
monitor.on('burnConfirmed', async (burn) => {
  console.log('Burn:', burn);
  // Process burn on ËTRID
});

await monitor.start();
```

## Event Formats

### depositConfirmed
```typescript
{
  etridRecipient: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  solPubkey: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  amount: "1000000000",
  signature: ["0x1234...", "0x5678..."],  // (H256, H256)
  slot: 123456,
  confirmations: 31,
  tokenMint: "EPjFWdd5..." // undefined for SOL
}
```

### burnConfirmed
```typescript
{
  etridRecipient: "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  amount: "5000000000",
  signature: ["0x1234...", "0x5678..."],
  slot: 123457,
  confirmations: 31,
  tokenMint: "CA4ALvCam7N3ya8d2axp3AakwNdCdQchQNNwYSYiMRR4"
}
```

## Extrinsic Calls

### SOL Deposit
```typescript
api.tx.solanaBridge.initiateSolDeposit(
  etridRecipient,    // AccountId32
  solPubkey,         // H256
  amount,            // u128
  [sig1, sig2],      // (H256, H256)
  slot,              // u64
  confirmations      // u32
)
```

### Token Deposit
```typescript
api.tx.solanaBridge.initiateTokenDeposit(
  etridRecipient,
  solPubkey,
  tokenMint,         // H256
  amount,
  [sig1, sig2],
  slot,
  confirmations
)
```

### Burn Processing
```typescript
api.tx.solanaBridge.processEtrBurnFromSolana(
  etridRecipient,
  amount,
  [sig1, sig2]       // (H256, H256)
)
```

## Metrics Endpoints

```bash
# Prometheus metrics
curl http://localhost:9090/metrics

# Health check
curl http://localhost:3000/health

# Monitor status
curl http://localhost:3000/api/status
```

## Key Metrics

| Metric | Description |
|--------|-------------|
| `bridge_monitor_solana_connected` | 0/1 connection status |
| `bridge_monitor_solana_slot_height` | Current slot processed |
| `bridge_monitor_messages_seen_total{chain="solana"}` | Events detected |
| `bridge_monitor_deposits_confirmed_total{chain="solana"}` | Confirmed deposits |
| `bridge_monitor_pending_deposits{chain="solana"}` | Awaiting confirmations |

## Common Commands

```bash
# Development
npm run dev                     # Start with hot reload
npm test                        # Run tests
npm run build                   # Build TypeScript

# Production
npm start                       # Start service
docker-compose up -d            # Docker deployment
kubectl apply -f k8s/           # Kubernetes deployment

# Monitoring
docker-compose logs -f solana-bridge-monitor
journalctl -u etrid-solana-bridge -f
kubectl logs -f deployment/solana-bridge-monitor

# Troubleshooting
curl http://localhost:3000/health
npm run test:transaction -- <signature>
LOG_LEVEL=debug npm start
```

## Architecture Flow

```
User → Solana (deposit with memo)
  ↓
Solana Program (BridgeDeposit instruction)
  ↓
SolanaMonitor (WebSocket onLogs)
  ↓ Parse TX
  ↓ Extract memo
  ↓ Wait 31 confirmations
  ↓ Convert signature
  ↓ Emit event
  ↓
Bridge Relayer (event listener)
  ↓ Build extrinsic
  ↓ Sign with relayer
  ↓
ËTRID Substrate (pallet-solana-bridge)
  ↓ Validate
  ↓ Calculate fee
  ↓ Mint ËTR
  ↓
User receives ËTR ✓
```

## Memo Format

```
ETRID:<64_hex_characters>

Example:
ETRID:5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY
```

## Signature Conversion

```
Solana (base58): 5j7s7Qy... (64 bytes)
  ↓ bs58.decode()
Bytes: [0x12, 0x34, ..., 0xab] (64 bytes)
  ↓ Split
H256 tuple: [
  "0x1234...5678",  // First 32 bytes
  "0x9abc...def0"   // Second 32 bytes
]
```

## Confirmations

| Level | Slots | Time | Safety |
|-------|-------|------|--------|
| Processed | 0 | ~400ms | Low (not safe) |
| Confirmed | 12-20 | ~5-8s | Medium (2/3 stake) |
| Finalized | 31+ | ~13-15s | High (recommended) |

## Performance

| Metric | Value |
|--------|-------|
| Latency | ~13-15s (31 confirmations) |
| Throughput | Up to 65,000 TPS (Solana limit) |
| Memory | ~50MB idle, ~200MB active |
| CPU | <1% idle, ~5% active |

## Error Codes

| Error | Cause | Solution |
|-------|-------|----------|
| `bridge_monitor_solana_connected = 0` | RPC disconnected | Check RPC URL, switch provider |
| `Invalid signature length` | Signature not 64 bytes | Use bs58 decoder, verify format |
| `DepositAlreadyExists` | Duplicate signature | Already processed, ignore |
| `InsufficientConfirmations` | < 31 confirmations | Wait for more slots |

## Troubleshooting

### No deposits detected
1. Check bridge program ID matches
2. Verify memo format: `ETRID:<64_hex>`
3. Enable debug logging: `LOG_LEVEL=debug`
4. Test transaction: `npm run test:transaction -- <sig>`

### RPC connection errors
1. Verify RPC endpoint is accessible
2. Check WebSocket URL
3. Use dedicated RPC provider
4. Check firewall rules

### High latency
1. Reduce confirmations (less safe): `MIN_CONFIRMATIONS=20`
2. Use faster RPC (QuickNode/Triton)
3. Check network connectivity

## Dependencies

```json
{
  "@solana/web3.js": "^1.87.0",
  "bs58": "^5.0.0",
  "@polkadot/api": "^10.11.1",
  "winston": "^3.11.0",
  "prom-client": "^15.1.0"
}
```

## Related Pallets

- **Solana Bridge**: `/Users/macbook/Desktop/etrid/05-multichain/bridges/protocols/solana-bridge/src/lib.rs`
- **ETR Lock**: Shared locking mechanism for cross-chain transfers
- **Treasury**: Fee distribution

## Support

- **Docs**: `src/monitors/README.md`
- **Deployment**: `SOLANA_DEPLOYMENT.md`
- **Summary**: `SOLANA_MONITOR_SUMMARY.md`
- **Architecture**: `SOLANA_ARCHITECTURE.txt`

## Production Checklist

- [ ] Use dedicated RPC provider
- [ ] Configure Redis
- [ ] Set up monitoring (Prometheus + Grafana)
- [ ] Enable alerting
- [ ] Configure HTTPS
- [ ] Set up log rotation
- [ ] Test failover
- [ ] Document procedures
- [ ] Secure relayer keys
- [ ] Configure firewall

## License

Apache 2.0
