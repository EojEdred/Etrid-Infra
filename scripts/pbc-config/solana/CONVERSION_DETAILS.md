# Solana Address Conversion Details

## ËTR Token Address Conversion

This document explains the conversion of the Solana SPL token address to H256 format for use in Sol-PBC.

## Addresses

### Original (Solana SPL Token)
```
Format:   Base58 (Solana standard)
Address:  CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp
Chain:    Solana Mainnet
Type:     SPL Token Mint Address
Decimals: 9
```

### Converted (Sol-PBC)
```
Format:   H256 (32-byte hex with 0x prefix)
Address:  0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f
Chain:    Sol-PBC (Substrate-based)
Type:     Token Identifier
Decimals: 9 (preserved)
```

## Conversion Process

### Step-by-Step Breakdown

1. **Input**: Base58 string
   ```
   CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp
   ```

2. **Base58 Decode**: Convert to raw bytes (32 bytes)
   ```python
   import base58
   decoded = base58.b58decode("CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp")
   # Result: 32-byte array
   ```

3. **Byte Array** (in hex):
   ```
   a5 c2 5b 94 41 17 c1 7f c1 cd 26 55 57 61 e1 a2
   74 c6 57 6d f5 a4 8a 7e 51 18 3b a2 11 ab a6 5f
   ```

4. **H256 Format**: Add 0x prefix
   ```
   0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f
   ```

### Mathematical Verification

The conversion is deterministic and reversible:

**Forward:**
```
Base58 → Bytes → Hex → H256
CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp
  ↓
[165, 194, 91, 148, 65, 23, 193, 127, 193, 205, 38, 85, 87, 97, 225, 162, 116, 198, 87, 109, 245, 164, 138, 126, 81, 24, 59, 162, 17, 171, 166, 95]
  ↓
a5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f
  ↓
0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f
```

**Reverse:**
```
H256 → Hex → Bytes → Base58
0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f
  ↓
a5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f
  ↓
[165, 194, 91, 148, 65, 23, 193, 127, 193, 205, 38, 85, 87, 97, 225, 162, 116, 198, 87, 109, 245, 164, 138, 126, 81, 24, 59, 162, 17, 171, 166, 95]
  ↓
CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp
```

## Why This Conversion?

### Different Address Formats

- **Solana**: Uses Base58 encoding (like Bitcoin) for human-readable addresses
- **Substrate**: Uses various formats including H256 (hex) for on-chain storage

### Same Token, Different Representation

The conversion does NOT create a new token. It's the same token represented in two different formats:

```
Solana Chain:          Sol-PBC Chain:
━━━━━━━━━━━━━          ━━━━━━━━━━━━━━
┌─────────────┐        ┌──────────────┐
│  ËTR Token  │ ←────→ │  ËTR Token   │
│             │ Bridge │              │
│ CA4A...qhp  │        │ 0xa5c2...a65f │
│ (Base58)    │        │ (H256)       │
└─────────────┘        └──────────────┘
```

### Benefits

1. **Deterministic**: Same input always produces same output
2. **Reversible**: Can convert back and forth without data loss
3. **Efficient**: Direct byte-level conversion, no computation
4. **Standard**: Both formats are industry standards

## Technical Details

### Byte Structure

```
Position  | Bytes (Hex)                      | Decimal Values
----------|----------------------------------|---------------------------
0-15      | a5 c2 5b 94 41 17 c1 7f          | 165 194 91 148 65 23 193 127
          | c1 cd 26 55 57 61 e1 a2          | 193 205 38 85 87 97 225 162
16-31     | 74 c6 57 6d f5 a4 8a 7e          | 116 198 87 109 245 164 138 126
          | 51 18 3b a2 11 ab a6 5f          | 81 24 59 162 17 171 166 95
```

### Validation

Both addresses can be validated independently:

**Solana (Base58):**
```bash
# Check length after decode
python3 -c "import base58; print(len(base58.b58decode('CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp')))"
# Output: 32
```

**H256 (Hex):**
```bash
# Check length (0x + 64 hex chars = 32 bytes)
echo "0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f" | sed 's/0x//' | wc -c
# Output: 64 (characters) = 32 bytes
```

## Usage in Bridge Configuration

### Solana Side (SPL Program)

When locking ËTR tokens on Solana for bridge transfer:

```rust
// Solana program
pub fn lock_tokens(
    ctx: Context<LockTokens>,
    amount: u64,
    dest_chain: String,
) -> Result<()> {
    let token_mint = "CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp"; // Base58
    // ... lock logic
}
```

### Sol-PBC Side (Substrate Pallet)

When registering the token in Sol-PBC:

```rust
// Substrate pallet
#[pallet::call]
impl<T: Config> Pallet<T> {
    pub fn add_supported_token(
        origin: OriginFor<T>,
        token_address: H256,
        exchange_rate: u128,
        decimals: u8,
    ) -> DispatchResult {
        let token_address = H256::from_slice(
            &hex::decode("a5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f")
                .unwrap()
        );
        // ... registration logic
    }
}
```

### Bridge Relayer

The relayer maps between both formats:

```typescript
// Relayer service
const TOKEN_MAPPING = {
  solana: "CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp",
  solPbc: "0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f",
  decimals: 9,
  exchangeRate: "1000000000"
};
```

## Exchange Rate Calculation

The exchange rate is set to maintain 1:1 parity:

```
Exchange Rate = 10^decimals
              = 10^9
              = 1,000,000,000

This means:
1.0 ËTR on Solana   = 1,000,000,000 base units
1.0 ËTR on Sol-PBC  = 1,000,000,000 base units

Transfer of 5.5 ËTR:
Solana → Sol-PBC:  5,500,000,000 → 5,500,000,000
Sol-PBC → Solana:  5,500,000,000 → 5,500,000,000
```

## Security Considerations

### Address Validation

Always validate addresses before conversion:

```python
def validate_solana_address(address: str) -> bool:
    try:
        decoded = base58.b58decode(address)
        return len(decoded) == 32
    except:
        return False

def validate_h256(hex_string: str) -> bool:
    try:
        hex_clean = hex_string.replace("0x", "")
        return len(hex_clean) == 64 and all(c in "0123456789abcdefABCDEF" for c in hex_clean)
    except:
        return False
```

### Bridge Integrity

The bridge ensures:
1. Total supply on Solana + Total supply on Sol-PBC = Constant
2. Each lock on one chain creates equal mint on other chain
3. Each burn on one chain creates equal unlock on other chain
4. Address mapping is immutable once set

## Tools

### Conversion Script

Use the provided script:

```bash
# Forward conversion
python3 convert-address.py CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp

# Reverse conversion
python3 convert-address.py --reverse 0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f
```

### Manual Verification (Python)

```python
import base58

# Forward
spl = "CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp"
h256 = "0x" + base58.b58decode(spl).hex()
print(f"H256: {h256}")

# Reverse
h256_input = "0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f"
spl_recovered = base58.b58encode(bytes.fromhex(h256_input[2:])).decode()
print(f"SPL: {spl_recovered}")
```

### Manual Verification (JavaScript)

```javascript
const bs58 = require('bs58');

// Forward
const spl = "CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp";
const bytes = bs58.decode(spl);
const h256 = "0x" + Buffer.from(bytes).toString('hex');
console.log("H256:", h256);

// Reverse
const h256Input = "0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f";
const bytesReverse = Buffer.from(h256Input.slice(2), 'hex');
const splRecovered = bs58.encode(bytesReverse);
console.log("SPL:", splRecovered);
```

## References

- [Solana Address Format](https://docs.solana.com/terminology#account)
- [Base58 Encoding](https://en.bitcoin.it/wiki/Base58Check_encoding)
- [Substrate H256 Type](https://docs.rs/sp-core/latest/sp_core/struct.H256.html)
- [SPL Token Program](https://spl.solana.com/token)

## Summary

The conversion from `CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp` to `0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f` is:

- **Deterministic**: Always produces the same result
- **Reversible**: Can convert back to original
- **Standard**: Uses industry-standard encoding methods
- **Verifiable**: Can be independently verified by anyone

This ensures the Sol-PBC bridge can correctly identify and handle ËTR tokens transferred from Solana while maintaining full compatibility with both ecosystems.
