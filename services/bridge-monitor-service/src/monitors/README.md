# Bridge Monitors

Production-ready blockchain monitors for Ëtrid bridge service.

## Monitors

### XRP Monitor (`XrpMonitor.ts`)
- Supports XRPL Classic and EVM Sidechain
- Uses WebSocket streams for real-time updates
- Destination tag and memo support
- Instant finality (1 confirmation)

### Cardano Monitor (`CardanoMonitor.ts`)
- UTXO-based deposit detection
- Blockfrost API integration
- Transaction metadata parsing (CIP-20)
- Native token support

### Stellar Monitor (`StellarMonitor.ts`)
- Real-time payment streaming via Horizon
- XLM and Stellar asset support
- Memo parsing (text, hash, ID)
- Fast 5-second ledger times

See individual monitor files for detailed documentation.
