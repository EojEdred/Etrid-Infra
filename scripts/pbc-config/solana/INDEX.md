# Sol-PBC Configuration - File Index

Complete configuration package for Solana PBC bridge with ËTR SPL token support.

## Quick Navigation

| File | Purpose | Start Here |
|------|---------|------------|
| **QUICK_START.md** | Fast setup guide | ⭐ Start here for quick setup |
| **README.md** | Complete documentation | 📖 Full reference guide |
| **CONVERSION_DETAILS.md** | Address conversion technical details | 🔍 Deep dive into conversion |

## Configuration Files

### 1. sol-pbc-config.json
**Purpose:** Main configuration file
**Size:** 1.6 KB
**Edit Required:** Yes - Replace placeholder accounts

**Contains:**
- ËTR token addresses (SPL and H256)
- Exchange rate (1:1)
- Operator account placeholder
- Relayer accounts placeholders
- Bridge parameters

**Action Required:**
```bash
nano sol-pbc-config.json
# Replace all PLACEHOLDER values with actual accounts
```

## Executable Scripts

### 2. convert-address.py
**Purpose:** Convert between Solana Base58 and H256 formats
**Size:** 3.0 KB
**Executable:** Yes

**Usage:**
```bash
# Convert SPL to H256
./convert-address.py CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp

# Convert H256 to SPL
./convert-address.py --reverse 0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f
```

**Dependencies:** `pip install base58`

### 3. configure-sol-pbc.sh
**Purpose:** Configure Sol-PBC bridge with ëTR support
**Size:** 5.2 KB
**Executable:** Yes

**Usage:**
```bash
./configure-sol-pbc.sh
```

**Requirements:**
- Configuration file edited (placeholders replaced)
- jq installed (`brew install jq`)
- polkadot-js-api CLI (optional, for direct execution)

**Output:**
- Validation of configuration
- Command templates for extrinsics
- Step-by-step instructions

### 4. verify-bridge.sh
**Purpose:** Verify configuration and dependencies
**Size:** 6.7 KB
**Executable:** Yes

**Usage:**
```bash
./verify-bridge.sh
```

**Checks:**
- ✓ Dependencies installed
- ✓ Configuration file valid
- ✓ Address conversion working
- ✓ Node connectivity (if running)
- ✓ On-chain configuration (if deployed)

## Documentation Files

### 5. README.md
**Purpose:** Complete setup and reference guide
**Size:** 6.4 KB

**Sections:**
- Overview of Sol-PBC bridge
- File descriptions
- Complete setup process (5 steps)
- Token address conversion details
- Bridge parameters
- Security considerations
- Troubleshooting
- Next steps

### 6. QUICK_START.md
**Purpose:** Condensed setup guide
**Size:** 3.3 KB

**Sections:**
- Token addresses (quick reference)
- 3-step setup process
- Verification commands
- Test transfer examples
- Quick troubleshooting

### 7. CONVERSION_DETAILS.md
**Purpose:** Technical deep dive into address conversion
**Size:** 8.6 KB

**Sections:**
- Step-by-step conversion process
- Mathematical verification
- Byte structure breakdown
- Why conversion is needed
- Security considerations
- Code examples (Python, JavaScript)

## Token Information

### ËTR SPL Token (Solana)
```
Address:  CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp
Format:   Base58
Chain:    Solana Mainnet
Decimals: 9
```

### ËTR H256 (Sol-PBC)
```
Address:  0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f
Format:   H256 (32-byte hex)
Chain:    Sol-PBC (Substrate)
Decimals: 9
```

### Exchange Rate
```
Rate: 1:1 (represented as 10^9 = 1,000,000,000)
```

## Setup Workflow

```
1. Install Dependencies
   ├─ Python: pip install base58
   ├─ Node.js: npm install -g @polkadot/api-cli
   └─ macOS: brew install jq

2. Verify Setup
   └─ Run: ./verify-bridge.sh

3. Configure Accounts
   └─ Edit: sol-pbc-config.json

4. Run Configuration
   └─ Execute: ./configure-sol-pbc.sh

5. Execute Commands
   ├─ setOperator
   ├─ addSupportedToken
   └─ registerRelayer (x3)

6. Verify On-Chain
   └─ Check: query.bridgeConfig.supportedTokens

7. Deploy Relayers
   └─ Start relayer services

8. Test Bridge
   ├─ Solana → Sol-PBC
   └─ Sol-PBC → Solana
```

## Common Commands

### Verify Everything
```bash
./verify-bridge.sh
```

### Convert Address
```bash
./convert-address.py CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp
```

### Configure Bridge
```bash
./configure-sol-pbc.sh
```

### Check Token On-Chain
```bash
polkadot-js-api --ws wss://sol-pbc-rpc.etrid.network \
  query.bridgeConfig.supportedTokens \
  '0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f'
```

## File Dependencies

```
sol-pbc-config.json
    ↓ (read by)
configure-sol-pbc.sh ──→ Generates command templates
    ↓ (uses)
convert-address.py ──→ Address conversion
    ↓ (validates with)
verify-bridge.sh ──→ Pre-flight checks
```

## Directory Structure

```
/Users/macbook/Desktop/etrid/scripts/pbc-config/solana/
├── INDEX.md                  ← You are here
├── QUICK_START.md            ← Start here (3-step guide)
├── README.md                 ← Full documentation
├── CONVERSION_DETAILS.md     ← Technical deep dive
├── sol-pbc-config.json       ← Configuration (edit this!)
├── convert-address.py        ← Address converter
├── configure-sol-pbc.sh      ← Main setup script
└── verify-bridge.sh          ← Verification script
```

## What to Read When

### Just Getting Started
1. **QUICK_START.md** - Get up and running fast
2. **verify-bridge.sh** - Check your setup

### Setting Up Production
1. **README.md** - Complete setup guide
2. **sol-pbc-config.json** - Edit configuration
3. **configure-sol-pbc.sh** - Run configuration

### Understanding the Details
1. **CONVERSION_DETAILS.md** - How conversion works
2. **README.md** - Security considerations

### Troubleshooting
1. **verify-bridge.sh** - Run diagnostics
2. **README.md** - Troubleshooting section
3. **QUICK_START.md** - Quick fixes

## Key Concepts

### H256 Conversion
The SPL address `CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp` is converted to H256 format `0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f` through standard Base58 decoding. This is:
- Deterministic (same input = same output)
- Reversible (can convert back)
- Standard (industry-standard encoding)

### Exchange Rate
The 1:1 exchange rate is represented as `1000000000` (10^9) because both chains use 9 decimal places. This means:
- 1.0 ËTR on Solana = 1.0 ËTR on Sol-PBC
- Transfers maintain exact value
- No loss of precision

### Bridge Security
The bridge maintains total supply invariant:
```
Total_Supply_Solana + Total_Supply_Sol-PBC = Constant
```

Every lock/mint and burn/unlock operation maintains this balance.

## Next Steps After Configuration

1. **Deploy Relayers**: Start relayer services on configured servers
2. **Test Transfers**: Perform small test transfers both directions
3. **Monitor Health**: Set up monitoring and alerting
4. **Production Rollout**: Gradually increase transfer limits
5. **Documentation**: Update runbooks with actual accounts used

## Support

For issues or questions:
- Run diagnostics: `./verify-bridge.sh`
- Check logs: Sol-PBC node logs
- Review documentation: Start with README.md
- Contact: Etrid Core Team

## Version

```
Created: 2025-12-01
Version: 1.0.0
Author: Etrid Core Team
```

---

**TL;DR:**
1. Read **QUICK_START.md**
2. Run `./verify-bridge.sh`
3. Edit **sol-pbc-config.json**
4. Run `./configure-sol-pbc.sh`
5. Execute the commands it provides
