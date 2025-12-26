# Quick Start Guide - PBC Bridge Configuration

Get up and running with PBC bridge configuration in 5 minutes.

## Step 1: Prerequisites

Install required tools:

```bash
# macOS
brew install jq curl

# Ubuntu/Debian
sudo apt-get install jq curl

# Install Rust (optional, for Rust CLI)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

## Step 2: Setup Configuration

1. Navigate to the directory:
```bash
cd /Users/macbook/Desktop/etrid/scripts/pbc-config
```

2. Copy example config:
```bash
cp config.example.json config.json
```

3. Edit config.json with your values:
```bash
nano config.json
```

Update these fields:
- `operator`: Your operator SS58 address
- `relayers`: Array of relayer SS58 addresses
- `chains.*.pbc_endpoint`: Actual VM endpoints
- `chains.*.token_address`: Real token addresses for each chain
- `chains.*.bridge_address`: Bridge contract addresses

## Step 3: Validate Configuration

Test your configuration file:

```bash
./validate-config.sh
```

This checks:
- JSON syntax
- Required fields
- Address formats
- Numeric values
- Logical consistency

## Step 4: Test Connectivity

Verify all PBC nodes are reachable:

```bash
./test-connection.sh
```

This will show:
- Node status (online/offline)
- Sync status (synced/syncing)
- Peer count
- Chain name

## Step 5: Configure Bridges

### Option A: Configure All Chains (Recommended)

```bash
# Parallel mode (fastest)
./batch-configure.sh

# Sequential mode (safer for production)
./batch-configure.sh --sequential
```

### Option B: Configure Specific Chains

```bash
# Configure only EVM chains
./batch-configure.sh --chains ethereum,polygon,bnb

# Configure one chain at a time
./configure-pbc.sh solana ws://10.0.0.101:9944
./configure-pbc.sh ethereum ws://10.0.0.103:9944
```

## Step 6: Verify Configuration

Check the logs:

```bash
# View summary
cat logs/batch-config-*.log

# View specific chain log
cat logs/solana-config-*.log

# View configuration summary
cat logs/config-summary-*.json | jq '.'
```

## Common Commands

### Quick Health Check
```bash
./test-connection.sh
```

### Validate Configuration
```bash
./validate-config.sh config.json
```

### Configure All Chains
```bash
./batch-configure.sh
```

### Configure Single Chain
```bash
./configure-pbc.sh <chain> <endpoint>
```

### View Logs
```bash
# Latest batch log
tail -f logs/batch-config-*.log

# Specific chain
tail -f logs/solana-config-*.log
```

## Using the Rust CLI (Advanced)

### Build the CLI
```bash
./build.sh --release
```

### Run Commands
```bash
# Configure single chain
./etrid-bridge-config configure solana

# Configure all chains
./etrid-bridge-config configure-all

# Verify configuration
./etrid-bridge-config verify solana

# Query state
./etrid-bridge-config query ethereum --query-type token-mapping
```

## Troubleshooting

### Endpoint Not Reachable
```bash
# Check node status
ssh user@10.0.0.101 'systemctl status pbc-solana'

# Test connectivity
ping 10.0.0.101
curl http://10.0.0.101:9933
```

### Configuration Failed
```bash
# Check logs
cat logs/solana-config-*.log

# Verify node is synced
./test-connection.sh
```

### Permission Denied
```bash
# Make scripts executable
chmod +x *.sh
```

## Production Deployment Checklist

- [ ] All PBC nodes running and synced
- [ ] Configuration validated (`./validate-config.sh`)
- [ ] Connectivity tested (`./test-connection.sh`)
- [ ] Operator account funded
- [ ] Relayer accounts created and funded
- [ ] Token addresses verified
- [ ] Exchange rates calculated
- [ ] Backup of configuration created
- [ ] Private keys secured
- [ ] Monitoring configured

## Next Steps

After successful configuration:

1. Monitor bridge operations
2. Set up automated health checks
3. Configure alerting for failures
4. Test cross-chain transfers
5. Document any chain-specific quirks

## Support

- Full documentation: `README.md`
- GitHub: https://github.com/etrid/etrid
- Discord: https://discord.gg/etrid

## Tips

1. **Always validate before deploying**: Run `./validate-config.sh` first
2. **Test connectivity**: Use `./test-connection.sh` to verify all nodes
3. **Use sequential mode for production**: Safer than parallel
4. **Check logs regularly**: Monitor `logs/` directory
5. **Backup your config**: Keep versioned backups of `config.json`
6. **Use example config as template**: Copy `config.example.json`
7. **Secure your keys**: Never commit private keys to git
