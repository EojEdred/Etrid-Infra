# Sol-PBC Quick Start

## ËTR Token Addresses

**Solana SPL Token:**
- Address: `CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp`
- Format: Base58
- Chain: Solana Mainnet

**Sol-PBC Token:**
- Address: `0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f`
- Format: H256 (32-byte hex)
- Chain: Sol-PBC (Substrate)

## Quick Setup (3 Steps)

### 1. Edit Configuration
```bash
nano sol-pbc-config.json
```

Replace these placeholders:
- `OPERATOR_ACCOUNT_PLACEHOLDER` → Your Substrate sudo account
- `RELAYER_X_ACCOUNT_PLACEHOLDER` → Your relayer Substrate accounts
- `SOLANA_WALLET_X_PLACEHOLDER` → Your relayer Solana wallets

### 2. Run Configuration Script
```bash
./configure-sol-pbc.sh
```

This will validate your config and show you the commands to run.

### 3. Execute Commands
Copy the commands from the script output and execute them with your operator seed.

Example:
```bash
# Set operator
polkadot-js-api --ws wss://sol-pbc-rpc.etrid.network \
  tx.bridgeConfig.setOperator \
  '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY' \
  --seed "$OPERATOR_SEED"

# Add ËTR token
polkadot-js-api --ws wss://sol-pbc-rpc.etrid.network \
  tx.bridgeConfig.addSupportedToken \
  '0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f' \
  '1000000000' \
  9 \
  --seed "$OPERATOR_SEED"
```

## Verify Setup

```bash
# Check supported tokens
polkadot-js-api --ws wss://sol-pbc-rpc.etrid.network \
  query.bridgeConfig.supportedTokens \
  '0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f'
```

Should return:
```json
{
  "tokenAddress": "0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f",
  "exchangeRate": "1000000000",
  "decimals": 9,
  "enabled": true
}
```

## Test Transfer

### Solana → Sol-PBC
```bash
# Lock ËTR on Solana (will be released on Sol-PBC)
spl-token transfer \
  CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp \
  1000000000 \
  <BRIDGE_WALLET> \
  --fund-recipient
```

### Sol-PBC → Solana
```bash
# Burn ËTR on Sol-PBC (will be released on Solana)
polkadot-js-api --ws wss://sol-pbc-rpc.etrid.network \
  tx.bridgeTransfer.burnAndUnlock \
  '0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f' \
  1000000000 \
  '<SOLANA_RECIPIENT>' \
  --seed "$USER_SEED"
```

## Troubleshooting

**Script won't run:**
```bash
chmod +x configure-sol-pbc.sh convert-address.py
```

**Missing dependencies:**
```bash
pip install base58
npm install -g @polkadot/api-cli
brew install jq
```

**Can't connect to Sol-PBC:**
```bash
# Check node is running
curl https://sol-pbc-rpc.etrid.network/health
```

## Files Created

1. `/Users/macbook/Desktop/etrid/scripts/pbc-config/solana/convert-address.py` - Address converter
2. `/Users/macbook/Desktop/etrid/scripts/pbc-config/solana/sol-pbc-config.json` - Configuration file
3. `/Users/macbook/Desktop/etrid/scripts/pbc-config/solana/configure-sol-pbc.sh` - Setup script
4. `/Users/macbook/Desktop/etrid/scripts/pbc-config/solana/README.md` - Full documentation

## Next Steps

1. Configure accounts in `sol-pbc-config.json`
2. Run `./configure-sol-pbc.sh`
3. Execute the generated commands
4. Deploy relayer services
5. Test bridge transfers
6. Monitor bridge health

See `README.md` for full documentation.
