# PBC Bridge Configuration Toolkit - Index

**Location:** `/Users/macbook/Desktop/etrid/scripts/pbc-config/`
**Created:** 2025-12-01
**Author:** Eoj

## Quick Navigation

### Getting Started
1. [QUICKSTART.md](QUICKSTART.md) - Get up and running in 5 minutes
2. [README.md](README.md) - Comprehensive documentation
3. [SUMMARY.md](SUMMARY.md) - Project overview and summary

### Core Scripts

#### Configuration Scripts
- **[configure-pbc.sh](configure-pbc.sh)** - Configure single PBC bridge
  - Usage: `./configure-pbc.sh <chain> <endpoint> [config]`
  - Supports: solana, bnb, ethereum, polygon, tron, xrp, bitcoin

- **[batch-configure.sh](batch-configure.sh)** - Configure all PBC bridges
  - Usage: `./batch-configure.sh [--sequential] [--chains chain1,chain2]`
  - Parallel or sequential execution

#### Validation & Testing
- **[validate-config.sh](validate-config.sh)** - Validate configuration file
  - Usage: `./validate-config.sh [config-file]`
  - Checks syntax, fields, addresses, logic

- **[test-connection.sh](test-connection.sh)** - Test PBC node connectivity
  - Usage: `./test-connection.sh [config-file]`
  - Reports status, sync, peers

- **[test-all.sh](test-all.sh)** - Comprehensive test suite
  - Usage: `./test-all.sh [config-file]`
  - Runs all validation and integrity tests

#### Build Scripts
- **[build.sh](build.sh)** - Build Rust CLI tool
  - Usage: `./build.sh [--release]`
  - Compiles etrid-bridge-config binary

### Configuration Files

- **[config.json](config.json)** - Main configuration (active)
  - Contains all PBC endpoints and settings
  - Should be customized for your deployment

- **[config.example.json](config.example.json)** - Example configuration
  - Template with example values
  - Copy to config.json and customize

### Rust CLI Tool

- **[Cargo.toml](Cargo.toml)** - Rust project manifest
  - Dependencies: subxt, tokio, clap, serde

- **[src/main.rs](src/main.rs)** - Rust CLI implementation
  - Subxt-based bridge configuration
  - Commands: configure, configure-all, verify, query, update

### Supporting Files

- **[.gitignore](.gitignore)** - Git ignore rules
  - Excludes logs, keys, build artifacts

## File Purposes at a Glance

| File | Type | Purpose | Executable |
|------|------|---------|------------|
| configure-pbc.sh | Shell | Configure single PBC | Yes |
| batch-configure.sh | Shell | Configure all PBCs | Yes |
| validate-config.sh | Shell | Validate config | Yes |
| test-connection.sh | Shell | Test connectivity | Yes |
| test-all.sh | Shell | Run all tests | Yes |
| build.sh | Shell | Build Rust CLI | Yes |
| config.json | JSON | Main configuration | No |
| config.example.json | JSON | Example config | No |
| Cargo.toml | TOML | Rust manifest | No |
| src/main.rs | Rust | CLI implementation | No |
| README.md | Markdown | Full documentation | No |
| QUICKSTART.md | Markdown | Quick guide | No |
| SUMMARY.md | Markdown | Project summary | No |
| INDEX.md | Markdown | This file | No |
| .gitignore | Text | Git ignore | No |

## Workflow Guides

### First Time Setup
```bash
# 1. Copy example config
cp config.example.json config.json

# 2. Edit configuration
nano config.json

# 3. Validate
./validate-config.sh

# 4. Test connectivity
./test-connection.sh

# 5. Run tests
./test-all.sh
```

### Configure All Bridges
```bash
# Parallel mode (fastest)
./batch-configure.sh

# Sequential mode (safer)
./batch-configure.sh --sequential

# Specific chains only
./batch-configure.sh --chains solana,ethereum
```

### Configure Single Bridge
```bash
./configure-pbc.sh solana ws://10.0.0.101:9944
```

### Build and Use Rust CLI
```bash
# Build
./build.sh --release

# Configure
./etrid-bridge-config configure solana

# Verify
./etrid-bridge-config verify solana
```

## Supported Chains

| Chain | Decimals | Default Port | Confirmations |
|-------|----------|--------------|---------------|
| Solana | 9 | 9944 | 32 |
| BNB | 18 | 9944 | 15 |
| Ethereum | 18 | 9944 | 12 |
| Polygon | 18 | 9944 | 128 |
| Tron | 6 | 9944 | 19 |
| XRP | 6 | 9944 | 1 |
| Bitcoin | 8 | 9944 | 6 |

## Directory Structure

```
pbc-config/
├── configure-pbc.sh          # Single chain config
├── batch-configure.sh        # Batch config
├── validate-config.sh        # Validation
├── test-connection.sh        # Connectivity test
├── test-all.sh              # Test suite
├── build.sh                 # Rust build
├── config.json              # Main config
├── config.example.json      # Example config
├── Cargo.toml               # Rust manifest
├── src/
│   └── main.rs             # Rust implementation
├── logs/                    # Generated logs (not in git)
│   ├── batch-config-*.log
│   ├── <chain>-config-*.log
│   └── config-summary-*.json
├── README.md                # Full docs
├── QUICKSTART.md            # Quick guide
├── SUMMARY.md              # Summary
├── INDEX.md                # This file
└── .gitignore              # Git ignore

Optional:
├── solana/                  # Solana-specific tools
│   ├── configure-sol-pbc.sh
│   ├── verify-bridge.sh
│   └── ...
└── etrid-bridge-config     # Built Rust binary (generated)
```

## Common Commands

### Validation
```bash
./validate-config.sh                    # Validate config.json
./validate-config.sh custom-config.json # Validate custom config
```

### Connectivity
```bash
./test-connection.sh                    # Test all nodes
./test-connection.sh custom-config.json # Test with custom config
```

### Configuration
```bash
# All chains
./batch-configure.sh

# Sequential mode
./batch-configure.sh --sequential

# Specific chains
./batch-configure.sh --chains solana,ethereum,bnb

# Single chain
./configure-pbc.sh solana ws://10.0.0.101:9944
```

### Testing
```bash
./test-all.sh              # Run comprehensive tests
```

### Building
```bash
./build.sh                # Debug build
./build.sh --release      # Release build
```

### Logs
```bash
# View latest batch log
tail -f logs/batch-config-*.log

# View specific chain
tail -f logs/solana-config-*.log

# View summary
cat logs/config-summary-*.json | jq '.'
```

## Configuration Reference

### Required Fields
- `operator` - Operator SS58 address
- `relayers` - Array of relayer addresses
- `chains` - Chain configurations
- `flarechain` - FlareChain endpoint
- `configuration` - Bridge parameters

### Chain Configuration
Each chain requires:
- `pbc_endpoint` - WebSocket endpoint
- `http_endpoint` - HTTP endpoint
- `token_address` - Token address on that chain
- `exchange_rate` - Conversion rate
- `bridge_address` - Bridge contract/account
- `decimals` - Token decimals

### Bridge Parameters
- `max_transfer_amount` - Maximum transfer amount
- `min_transfer_amount` - Minimum transfer amount
- `bridge_fee_percent` - Bridge fee percentage
- `confirmation_blocks` - Required confirmations per chain

## Troubleshooting

### Issue: Endpoint Not Reachable
**Solution:**
1. Check VM is running
2. Verify firewall allows ports 9933, 9944
3. Test: `curl http://10.0.0.101:9933`

### Issue: Configuration Failed
**Solution:**
1. Check logs: `cat logs/<chain>-config-*.log`
2. Verify node synced: `./test-connection.sh`
3. Check operator permissions

### Issue: Permission Denied
**Solution:**
```bash
chmod +x *.sh
```

### Issue: Missing Dependencies
**Solution:**
```bash
# macOS
brew install jq curl

# Ubuntu/Debian
sudo apt-get install jq curl
```

## Production Checklist

Before deploying to production:

- [ ] Run `./test-all.sh` - all tests pass
- [ ] Run `./validate-config.sh` - config valid
- [ ] Run `./test-connection.sh` - all nodes reachable
- [ ] Verify operator account funded
- [ ] Verify relayer accounts created
- [ ] Verify token addresses on each chain
- [ ] Review exchange rates
- [ ] Review bridge parameters (fees, limits)
- [ ] Backup config.json
- [ ] Secure private keys
- [ ] Configure monitoring
- [ ] Test on testnet first

## Dependencies

### Required
- bash (>=4.0)
- jq
- curl

### Optional
- Rust toolchain (for Rust CLI)
- wscat (for WebSocket testing)

## Support

- **Full Documentation**: [README.md](README.md)
- **Quick Start**: [QUICKSTART.md](QUICKSTART.md)
- **Summary**: [SUMMARY.md](SUMMARY.md)
- **GitHub**: https://github.com/etrid/etrid
- **Discord**: https://discord.gg/etrid

## Version

**v1.0.0** - Initial release (2025-12-01)

## License

MIT License - Copyright (c) 2025 Etrid Network

---

**Note:** This toolkit provides automation templates. Actual blockchain interactions require runtime metadata and proper key management. Always test on testnet before production deployment.
