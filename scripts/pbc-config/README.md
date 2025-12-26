# PBC Bridge Configuration Scripts

Automation tools for configuring Partition Burst Chain (PBC) bridges across multiple VMs in the Etrid network.

## Overview

This toolkit provides shell scripts to automate the configuration of PBC bridges for cross-chain interoperability. It supports all 7 major PBC chains:

- Solana
- BNB Smart Chain
- Ethereum
- Polygon
- Tron
- XRP Ledger
- Bitcoin

## Files

### 1. `configure-pbc.sh`
Single chain configuration script that connects to a PBC node and runs configuration extrinsics.

**Usage:**
```bash
./configure-pbc.sh <chain-name> <rpc-endpoint> [config-file]
```

**Examples:**
```bash
# Configure Solana PBC
./configure-pbc.sh solana ws://10.0.0.101:9944

# Configure Ethereum PBC with custom config
./configure-pbc.sh ethereum ws://10.0.0.103:9944 /path/to/custom-config.json

# Configure all supported chains
./configure-pbc.sh solana ws://10.0.0.101:9944
./configure-pbc.sh bnb ws://10.0.0.102:9944
./configure-pbc.sh ethereum ws://10.0.0.103:9944
./configure-pbc.sh polygon ws://10.0.0.104:9944
./configure-pbc.sh tron ws://10.0.0.105:9944
./configure-pbc.sh xrp ws://10.0.0.106:9944
./configure-pbc.sh bitcoin ws://10.0.0.107:9944
```

**Features:**
- Validates chain name and endpoint connectivity
- Configures token mappings with exchange rates
- Sets up bridge addresses and relayers
- Configures transfer limits and fees
- Generates verification reports
- Creates subxt scripts for manual execution

### 2. `batch-configure.sh`
Batch configuration script that configures ALL PBC bridges in parallel or sequential mode.

**Usage:**
```bash
./batch-configure.sh [config-file] [options]
```

**Options:**
- `--sequential` - Run configurations sequentially instead of parallel
- `--chains chain1,chain2,...` - Configure only specific chains
- `--help` - Show help message

**Examples:**
```bash
# Configure all chains in parallel (default)
./batch-configure.sh

# Configure all chains sequentially
./batch-configure.sh --sequential

# Configure only Solana and Ethereum
./batch-configure.sh --chains solana,ethereum

# Use custom config file
./batch-configure.sh custom-config.json

# Combine options
./batch-configure.sh --chains solana,bnb,ethereum --sequential
```

**Features:**
- Parallel or sequential execution
- Health checks for all configured chains
- Comprehensive logging per chain
- Configuration summary report
- Status tracking for each chain
- Export configuration summaries

### 3. `config.json`
Central configuration file containing all PBC endpoints, token addresses, relayer accounts, and bridge parameters.

**Structure:**
```json
{
  "operator": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY",
  "relayers": ["5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty"],
  "chains": {
    "solana": {
      "pbc_endpoint": "ws://10.0.0.101:9944",
      "http_endpoint": "http://10.0.0.101:9933",
      "token_address": "CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp",
      "exchange_rate": "1000000000",
      "bridge_address": "BridgeGov1111111111111111111111111111111",
      "decimals": 9
    }
  },
  "configuration": {
    "max_transfer_amount": "1000000000000",
    "min_transfer_amount": "1000000",
    "bridge_fee_percent": "0.1",
    "confirmation_blocks": {
      "solana": 32,
      "ethereum": 12
    }
  }
}
```

## Installation

### Prerequisites

Install required dependencies:

```bash
# macOS
brew install jq curl

# Install wscat globally (optional)
npm install -g wscat

# Ubuntu/Debian
sudo apt-get install jq curl
```

### Setup

1. Clone or navigate to the etrid repository:
```bash
cd /Users/macbook/Desktop/etrid/scripts/pbc-config
```

2. Make scripts executable:
```bash
chmod +x configure-pbc.sh batch-configure.sh
```

3. Edit `config.json` with your actual values:
```bash
nano config.json
```

Update:
- Operator and relayer addresses
- PBC endpoints (IP addresses and ports)
- Token addresses for each chain
- Exchange rates and decimals
- Bridge parameters (fees, limits, confirmations)

## Quick Start

### Configure All Chains (Recommended)

```bash
# Run batch configuration in parallel
./batch-configure.sh

# This will:
# 1. Validate all endpoints
# 2. Configure all 7 PBC bridges in parallel
# 3. Perform health checks
# 4. Generate summary reports
```

### Configure Single Chain

```bash
# Configure just one chain
./configure-pbc.sh solana ws://10.0.0.101:9944
```

### Configure Specific Chains

```bash
# Configure only EVM-compatible chains
./batch-configure.sh --chains ethereum,polygon,bnb
```

## Configuration Parameters

### Exchange Rates
Exchange rates represent the conversion factor between native chain tokens and Etrid's native currency.

- **Solana**: 1,000,000,000 (9 decimals)
- **BNB/Ethereum/Polygon**: 1,000,000,000,000,000,000 (18 decimals)
- **Tron/XRP**: 1,000,000 (6 decimals)
- **Bitcoin**: 100,000,000 (8 decimals)

### Bridge Parameters

- **Max Transfer Amount**: Maximum amount per single transfer
- **Min Transfer Amount**: Minimum amount per single transfer
- **Bridge Fee**: Percentage fee charged on transfers (default: 0.1%)
- **Confirmation Blocks**: Number of blocks to wait for finality per chain

### Confirmation Blocks (Recommended Values)

| Chain    | Confirmations | Finality Time |
|----------|---------------|---------------|
| Solana   | 32            | ~12 seconds   |
| BNB      | 15            | ~45 seconds   |
| Ethereum | 12            | ~2.5 minutes  |
| Polygon  | 128           | ~4 minutes    |
| Tron     | 19            | ~57 seconds   |
| XRP      | 1             | ~4 seconds    |
| Bitcoin  | 6             | ~60 minutes   |

## Logs and Monitoring

### Log Locations

All logs are stored in `./logs/` directory:

- **Main batch log**: `logs/batch-config-YYYYMMDD-HHMMSS.log`
- **Individual chain logs**: `logs/<chain>-config-YYYYMMDD-HHMMSS.log`
- **Configuration summaries**: `logs/config-summary-YYYYMMDD-HHMMSS.json`

### View Logs

```bash
# View main batch log
tail -f logs/batch-config-*.log

# View specific chain log
tail -f logs/solana-config-*.log

# View configuration summary
cat logs/config-summary-*.json | jq '.'
```

### Health Check

After configuration, verify all chains are synced:

```bash
# Manual health check
for chain in solana bnb ethereum polygon tron xrp bitcoin; do
  endpoint=$(jq -r ".chains.$chain.http_endpoint" config.json)
  curl -s -X POST -H "Content-Type: application/json" \
    -d '{"id":1,"jsonrpc":"2.0","method":"system_health","params":[]}' \
    "$endpoint" | jq ".result"
done
```

## Troubleshooting

### Common Issues

#### 1. Endpoint Not Reachable
```
ERROR: Endpoint is not reachable or not responding
```

**Solutions:**
- Verify the VM is running: `ssh user@10.0.0.101 'systemctl status pbc-solana'`
- Check firewall rules allow ports 9933 and 9944
- Verify endpoint in config.json matches actual VM IP
- Check network connectivity: `ping 10.0.0.101`

#### 2. Missing Dependencies
```
Error: Missing dependencies: jq
```

**Solution:**
```bash
# macOS
brew install jq curl

# Ubuntu/Debian
sudo apt-get install jq curl
```

#### 3. Configuration Failed
```
ERROR: Failed to configure solana
```

**Solutions:**
- Check individual chain log in `logs/solana-config-*.log`
- Verify operator account has sufficient privileges
- Ensure PBC node is fully synced
- Check token addresses are valid for the chain

#### 4. Permission Denied
```
bash: ./configure-pbc.sh: Permission denied
```

**Solution:**
```bash
chmod +x configure-pbc.sh batch-configure.sh
```

### Debugging Mode

Enable verbose logging:

```bash
# Add set -x to scripts for debug output
bash -x ./configure-pbc.sh solana ws://10.0.0.101:9944
```

## Production Deployment

### Pre-Production Checklist

- [ ] All PBC nodes are running and synced
- [ ] Operator account is funded with sufficient balance
- [ ] Relayer accounts are created and funded
- [ ] Token addresses verified on each chain
- [ ] Exchange rates calculated and verified
- [ ] Bridge parameters reviewed (fees, limits)
- [ ] Firewall rules configured (ports 9933, 9944)
- [ ] SSL/TLS certificates configured for wss:// endpoints
- [ ] Backup of all private keys and mnemonics
- [ ] Monitoring and alerting configured

### Deployment Steps

1. **Test Configuration (Testnet)**
   ```bash
   # Use testnet config first
   ./batch-configure.sh testnet-config.json --sequential
   ```

2. **Verify Testnet**
   ```bash
   # Run test transfers on testnet
   # Verify all bridges work correctly
   ```

3. **Deploy to Production**
   ```bash
   # Use production config
   ./batch-configure.sh config.json
   ```

4. **Verify Production**
   ```bash
   # Health check all chains
   ./batch-configure.sh config.json
   # Check logs for any errors
   ```

5. **Monitor**
   ```bash
   # Set up continuous monitoring
   # Configure alerting for failures
   ```

## Integration with Subxt

The scripts generate `subxt_<chain>_config.sh` files for manual execution with subxt CLI.

### Using Subxt (Future Integration)

```bash
# Example subxt command (when available)
subxt tx \
  --url ws://10.0.0.101:9944 \
  --suri //Alice \
  bridge setTokenMapping \
  solana CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp 1000000000 9
```

### Rust CLI Tool (Planned)

A Rust-based subxt CLI tool is planned for production use:

```rust
// Future implementation
etrid-bridge-config \
  --chain solana \
  --endpoint ws://10.0.0.101:9944 \
  --suri //Operator \
  --config config.json
```

## Security Considerations

### Private Keys

- Never commit private keys or mnemonics to version control
- Use hardware wallets for operator and relayer accounts in production
- Store keys in secure key management systems (HashiCorp Vault, AWS KMS)

### Access Control

- Limit SSH access to PBC VMs
- Use VPN or bastion hosts for management access
- Implement role-based access control (RBAC)
- Audit all configuration changes

### Monitoring

- Monitor all bridge transactions
- Set up alerts for unusual activity
- Log all configuration changes
- Regular security audits

## Advanced Usage

### Custom Configuration Profiles

Create environment-specific configs:

```bash
# Testnet
./batch-configure.sh testnet-config.json

# Staging
./batch-configure.sh staging-config.json

# Production
./batch-configure.sh production-config.json
```

### Partial Updates

Update specific parameters without full reconfiguration:

```bash
# Update only token mappings
./configure-pbc.sh solana ws://10.0.0.101:9944

# Update only relayers
# (Modify script to skip token configuration steps)
```

### Automated Monitoring

```bash
#!/bin/bash
# monitor-bridges.sh - Continuous monitoring script

while true; do
  ./batch-configure.sh --health-check-only
  sleep 300  # Check every 5 minutes
done
```

## Support

For issues and questions:

- GitHub Issues: https://github.com/etrid/etrid/issues
- Documentation: https://docs.etrid.network
- Discord: https://discord.gg/etrid

## License

Copyright (c) 2025 Etrid Network
Licensed under MIT License

## Version History

- **v1.0.0** (2025-12-01): Initial release
  - Support for 7 PBC chains
  - Parallel and sequential configuration
  - Comprehensive logging and reporting
  - Health check integration
