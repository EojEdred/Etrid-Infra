# Solana PBC Configuration Guide

This directory contains scripts and configuration for setting up the Solana Partition Burst Chain (Sol-PBC) bridge with the ËTR SPL token.

## Overview

The Sol-PBC bridge enables bidirectional transfers of ËTR tokens between:
- **Solana Mainnet**: SPL token `CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp`
- **Sol-PBC**: Substrate-based PBC using H256 address format

## Files

### 1. `convert-address.py`
Python script to convert between Solana Base58 addresses and H256 hex format.

**Usage:**
```bash
# Convert Base58 to H256
python3 convert-address.py CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp

# Convert H256 back to Base58
python3 convert-address.py --reverse 0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f
```

**Dependencies:**
```bash
pip install base58
```

### 2. `sol-pbc-config.json`
Configuration file containing:
- ËTR token addresses (SPL and H256)
- Exchange rate (1:1 mapping)
- Operator account
- Relayer accounts
- Bridge parameters

### 3. `configure-sol-pbc.sh`
Shell script that reads the configuration and provides command templates for:
- Setting the operator account
- Adding ËTR as a supported token
- Registering relayer accounts

## Setup Process

### Step 1: Install Dependencies

```bash
# Python dependencies
pip install base58

# Node.js dependencies
npm install -g @polkadot/api-cli

# System dependencies (macOS)
brew install jq
```

### Step 2: Configure Accounts

Edit `sol-pbc-config.json` and replace placeholders:

1. **Operator Account**: The Substrate account with sudo privileges
   ```json
   "operator": {
     "account": "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
   }
   ```

2. **Relayer Accounts**: Substrate accounts that will run relayer services
   ```json
   "relayers": [
     {
       "account": "5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty",
       "solana_wallet": "7XaGjQvB5pYPwnz...",
       "comment": "Primary relayer"
     }
   ]
   ```

### Step 3: Run Configuration Script

```bash
cd /Users/macbook/Desktop/etrid/scripts/pbc-config/solana
chmod +x configure-sol-pbc.sh
./configure-sol-pbc.sh
```

The script will:
1. Validate your configuration
2. Display the settings
3. Provide command templates for manual execution

### Step 4: Execute Configuration Extrinsics

The script provides templates - you need to execute them with proper authorization:

#### 4.1 Set Operator
```bash
polkadot-js-api --ws wss://sol-pbc-rpc.etrid.network \
  tx.bridgeConfig.setOperator \
  '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' \
  --seed "$OPERATOR_SEED"
```

#### 4.2 Add ËTR Token Support
```bash
polkadot-js-api --ws wss://sol-pbc-rpc.etrid.network \
  tx.bridgeConfig.addSupportedToken \
  '0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f' \
  '1000000000' \
  9 \
  --seed "$OPERATOR_SEED"
```

Parameters:
- `0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f`: ËTR H256 address
- `1000000000`: Exchange rate (1:1 for 9 decimals)
- `9`: Decimal places

#### 4.3 Register Relayers
```bash
# For each relayer
polkadot-js-api --ws wss://sol-pbc-rpc.etrid.network \
  tx.bridgeConfig.registerRelayer \
  '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty' \
  '7XaGjQvB5pYPwnz...' \
  --seed "$OPERATOR_SEED"
```

### Step 5: Verify Configuration

```bash
# Check operator
polkadot-js-api --ws wss://sol-pbc-rpc.etrid.network \
  query.bridgeConfig.operator

# Check ËTR token support
polkadot-js-api --ws wss://sol-pbc-rpc.etrid.network \
  query.bridgeConfig.supportedTokens \
  '0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f'

# Check relayers
polkadot-js-api --ws wss://sol-pbc-rpc.etrid.network \
  query.bridgeConfig.relayers
```

## Token Address Conversion

### ËTR SPL Token
- **Base58 (Solana)**: `CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp`
- **H256 (Sol-PBC)**: `0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f`
- **Decimals**: 9
- **Exchange Rate**: 1:1 (represented as 10^9 = 1000000000)

### Conversion Method

The conversion uses standard Base58 decoding:
1. Decode Base58 string to 32-byte array
2. Convert bytes to hexadecimal
3. Prefix with `0x` for H256 format

This is a deterministic, reversible conversion that preserves the token identity across chains.

## Bridge Parameters

From `sol-pbc-config.json`:

| Parameter | Value | Description |
|-----------|-------|-------------|
| `min_transfer_amount` | 1,000,000 | 0.001 ËTR minimum |
| `max_transfer_amount` | 1,000,000,000,000,000 | 1M ËTR maximum |
| `transfer_fee_bps` | 10 | 0.1% (10 basis points) |
| `confirmation_threshold` | 32 | Solana blocks required |

## Security Considerations

1. **Operator Key**: Store operator seed securely, never commit to git
2. **Relayer Keys**: Each relayer needs both Substrate and Solana keys
3. **Multi-Sig**: Consider using multi-sig for operator role in production
4. **Rate Limiting**: Monitor bridge for unusual transfer patterns
5. **Auditing**: Log all bridge operations for compliance

## Troubleshooting

### Error: "jq not found"
```bash
brew install jq
```

### Error: "base58 module not found"
```bash
pip install base58
# or
pip3 install base58
```

### Error: "polkadot-js-api not found"
```bash
npm install -g @polkadot/api-cli
```

### Error: "Invalid address length"
Ensure you're using the correct SPL mint address (32 bytes when decoded).

### Connection Issues
Check that Sol-PBC node is running and accessible:
```bash
curl -H "Content-Type: application/json" \
  -d '{"id":1, "jsonrpc":"2.0", "method":"system_health"}' \
  https://sol-pbc-rpc.etrid.network
```

## Next Steps

After configuring Sol-PBC:

1. **Deploy Relayer Services**: Start relayer processes on configured servers
2. **Test Transfers**: Perform test transfers in both directions
3. **Monitor**: Set up monitoring for bridge health and performance
4. **Documentation**: Update operational runbooks with actual accounts used

## Support

For issues or questions:
- Check logs: `journalctl -u sol-pbc-relayer -f`
- Review bridge state on Sol-PBC explorer
- Contact Etrid Core Team

## References

- [Etrid PBC Architecture](../../docs/architecture.md)
- [Solana SPL Token Program](https://spl.solana.com/token)
- [Substrate Runtime Development](https://docs.substrate.io/)
- [Polkadot.js API Documentation](https://polkadot.js.org/docs/)
