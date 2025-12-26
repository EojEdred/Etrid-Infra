# PBC Bridge Configuration - Complete Implementation Guide

## Deployed Contract Addresses

```
SOLANA:    CA4ALvCam7N3ya8d2axp3AakwNdCdQchQNNwYSYiMRR4  (SPL Token)
BSC:       0xcc9b37fed77a01329502f8844620577742eb0dc6  (BEP-20)
POLYGON:   0x5566f6fb5cdb3aadf8662f9d1218ce2fc4bc72fb  (ERC-20)
ETHEREUM:  0x5566f6fb5cdb3aadf8662f9d1218ce2fc4bc72fb  (ERC-20)
ARBITRUM:  0x1A065196152C2A70e54AC06D3a3433e3D8606eF3  (ERC-20)
```

---

## Bridge Architecture Overview

The PBC (Partition Burst Chain) bridge system uses a **lock-and-mint / burn-and-unlock** mechanism:

### Inbound (External Chain -> Primearc Core)
1. User deposits/locks wrapped ETR on external chain
2. Relayer monitors external chain for deposit events
3. Relayer submits deposit proof to PBC bridge pallet
4. After confirmation threshold, ETR is minted to user on Primearc

### Outbound (Primearc Core -> External Chain)
1. User initiates bridge_etr_to_* extrinsic on Primearc
2. ETR is locked in the bridge lock account
3. Event emitted for relayer
4. Relayer mints/unlocks wrapped ETR on external chain
5. When user burns wrapped ETR, relayer submits burn proof
6. ETR unlocked on Primearc to user

---

## Chain-Specific Configuration

### 1. Solana Bridge (solana-bridge pallet)

**Confirmation Requirements:**
- MinConfirmations: 31 (Solana finalized state)
- Uses slots instead of blocks (400ms per slot)

**Configuration Constants:**
```rust
type MinConfirmations: Get<u32> = 31;
type BridgeFeeRate: Get<u32> = 10;  // 0.1% = 10/1000
type MaxPriorityFee: Get<u64> = 1_000_000;  // lamports
type MaxComputeUnits: Get<u32> = 200_000;
type MaxDepositsPerAccount: Get<u32> = 100;
type MaxWithdrawalsPerAccount: Get<u32> = 50;
```

**SPL Token Configuration:**
```rust
// Add ETR SPL token as supported
SupportedTokens::insert(
    H256::from_slice(&bs58::decode("CA4ALvCam7N3ya8d2axp3AakwNdCdQchQNNwYSYiMRR4").into_vec().unwrap()),
    true
);

// Exchange rate (1:1 with 9 decimal adjustment)
TokenRates::insert(etr_mint, 1_000_000_000);  // 1e9
```

**Key Extrinsics:**
- `bridge_etr_to_solana(amount, sol_destination)` - Lock ETR, emit event for relayer
- `process_etr_burn_from_solana(etrid_recipient, amount, sol_burn_tx)` - Unlock ETR from Solana burn
- `register_relayer(relayer)` - Authorize relayer (sudo only)

---

### 2. BNB Chain Bridge (bnb-bridge pallet)

**Confirmation Requirements:**
- MinConfirmations: 15 (3-second blocks, ~45 seconds)

**Configuration Constants:**
```rust
type MinConfirmations: Get<u32> = 15;
type BridgeFeeRate: Get<u32> = 10;  // 0.1%
type MaxGasLimit: Get<u64> = 500_000;
type MaxGasPrice: Get<u128> = 50_000_000_000;  // 50 gwei
type MaxDepositsPerAccount: Get<u32> = 100;
type MaxWithdrawalsPerAccount: Get<u32> = 50;
```

**BEP-20 Token Configuration:**
```rust
// Add ETR BEP-20 as supported token
let etr_bsc = H160::from_slice(&hex::decode("cc9b37fed77a01329502f8844620577742eb0dc6").unwrap());
SupportedTokens::insert(etr_bsc, true);
TokenRates::insert(etr_bsc, 1_000_000_000_000_000_000);  // 1e18
```

**Key Extrinsics:**
- `bridge_etr_to_bnb(amount, bnb_destination)` - Lock ETR for BNB Chain
- `process_etr_burn_from_bnb(etrid_recipient, amount, bnb_burn_tx)` - Unlock from burn
- `register_relayer(relayer)` - Authorize relayer

---

### 3. Ethereum Bridge (ethereum-bridge pallet)

**Confirmation Requirements:**
- MinConfirmations: 12 (~2.4 minutes with 12s blocks)

**Configuration Constants:**
```rust
type MinConfirmations: Get<u32> = 12;
type BridgeFeeRate: Get<u32> = 10;  // 0.1%
type MaxGasLimit: Get<u64> = 500_000;
type MaxDepositsPerAccount: Get<u32> = 100;
type MaxWithdrawalsPerAccount: Get<u32> = 50;
```

**ERC-20 Token Configuration:**
```rust
// Ethereum ETR contract
let etr_eth = H160::from_slice(&hex::decode("5566f6fb5cdb3aadf8662f9d1218ce2fc4bc72fb").unwrap());
SupportedTokens::insert(etr_eth, true);
TokenRates::insert(etr_eth, 1_000_000_000_000_000_000);  // 1e18
```

---

### 4. Polygon Bridge

Uses same structure as Ethereum bridge with adjusted confirmations:
- MinConfirmations: 256 (for Polygon PoS finality)
- Contract: 0x5566f6fb5cdb3aadf8662f9d1218ce2fc4bc72fb

---

### 5. Arbitrum Bridge

Uses same structure as Ethereum bridge:
- MinConfirmations: 12 (L2 with L1 finality)
- Contract: 0x1A065196152C2A70e54AC06D3a3433e3D8606eF3

---

## Relayer Implementation

### Event Listening Architecture

Each PBC needs a relayer service that:

1. **Monitors External Chain Events:**
```javascript
// Example for EVM chains
const contract = new ethers.Contract(ETR_ADDRESS, ERC20_ABI, provider);

// Listen for Transfer events TO the burn address
contract.on("Transfer", (from, to, amount, event) => {
    if (to === BURN_ADDRESS || to === ethers.ZeroAddress) {
        // User burned tokens - submit proof to PBC
        submitBurnProof(from, amount, event.transactionHash);
    }
});

// Listen for lockForBridge events (if using bridge contract)
contract.on("BridgeLock", (user, amount, etridAddress, event) => {
    submitLockProof(user, amount, etridAddress, event.transactionHash);
});
```

2. **Submits Proofs to PBC:**
```rust
// Relayer calls this extrinsic
pallet_bnb_bridge::Pallet::process_etr_burn_from_bnb(
    origin,           // Authorized relayer
    etrid_recipient,  // Primearc account to receive ETR
    amount,           // Amount burned on external chain
    bnb_burn_tx,      // Transaction hash as proof
)?;
```

3. **Listens for PBC Events:**
```rust
// Monitor Primearc for outbound bridge requests
Event::EtrBridgedToBnb { from, amount, bnb_address } => {
    // Mint/unlock wrapped ETR on BNB Chain
    mint_on_external_chain(bnb_address, amount);
}
```

---

## Token Locking Mechanism (pallet-etr-lock)

The ETR locking pallet provides unified token locking across all bridges:

### Lock Account
```rust
// Single lock account holds all bridged-out ETR
#[pallet::storage]
pub type LockAccount<T: Config> = StorageValue<_, T::AccountId>;

// Locked balances per chain
#[pallet::storage]
pub type LockedBalance<T: Config> = StorageMap<_, Blake2_128Concat, ChainId, Balance, ValueQuery>;
```

### Chain IDs
```rust
pub enum ChainId {
    Solana,
    Ethereum,
    BnbChain,
    Polygon,
    Arbitrum,
    Tron,
    // ... others
}
```

### Lock for Bridge
```rust
pub fn lock_for_bridge(
    origin: OriginFor<T>,
    chain_id: ChainId,
    amount: BalanceOf<T>,
    destination: Vec<u8>,  // External chain address bytes
) -> DispatchResult {
    let who = ensure_signed(origin)?;

    // Transfer ETR to lock account
    T::Currency::transfer(&who, &lock_account, amount, KeepAlive)?;

    // Update locked balance for chain
    LockedBalance::<T>::mutate(chain_id, |bal| *bal = bal.saturating_add(amount));

    // Emit event for relayer
    Self::deposit_event(Event::TokensLocked { who, chain_id, amount, destination });

    Ok(())
}
```

### Unlock from Bridge
```rust
pub fn unlock_from_bridge(
    origin: OriginFor<T>,  // Root or authorized relayer
    chain_id: ChainId,
    amount: BalanceOf<T>,
) -> DispatchResult {
    ensure_root(origin)?;  // Only root can unlock

    // Update locked balance
    LockedBalance::<T>::mutate(chain_id, |bal| *bal = bal.saturating_sub(amount));

    Ok(())
}
```

---

## Genesis Configuration

### For Each PBC Runtime

```rust
// In chain_spec.rs
fn genesis_config() -> RuntimeGenesisConfig {
    RuntimeGenesisConfig {
        // ... other pallets

        // Solana bridge
        solana_bridge: SolanaBridgeConfig {
            sol_to_etr_rate: 1_000_000_000,  // 1:1
            wormhole_enabled: false,
        },

        // BNB bridge
        bnb_bridge: BnbBridgeConfig {
            bnb_to_etr_rate: 1_000_000_000_000_000_000,
            maxwell_upgrade_enabled: true,
            portal_bridge_enabled: false,
        },

        // Ethereum bridge
        ethereum_bridge: EthereumBridgeConfig {
            eth_to_etr_rate: 1_000_000_000_000_000_000,
        },

        // ETR lock pallet
        etr_lock: EtrLockConfig {
            lock_account: Some(BRIDGE_LOCK_ACCOUNT),
        },
    }
}
```

---

## Wrapped Token Contract (EVM Chains)

The deployed EtridToken.sol contract includes bridge functions:

```solidity
address public bridge;  // PBC bridge relayer address

// User locks tokens to bridge to native ETR on Primearc
function lockForBridge(uint256 amount, bytes32 etridAddress) external {
    require(balanceOf[msg.sender] >= amount, "Insufficient balance");
    balanceOf[msg.sender] -= amount;
    totalSupply -= amount;  // Burn on this chain
    emit BridgeLock(msg.sender, amount, etridAddress);
}

// Bridge mints tokens when user bridges from Primearc
function bridgeMint(address to, uint256 amount) external onlyBridge {
    totalSupply += amount;
    balanceOf[to] += amount;
    emit BridgeMint(to, amount);
    emit Transfer(address(0), to, amount);
}
```

**After deployment, set bridge address:**
```solidity
// Call from owner wallet
etridToken.setBridge(RELAYER_ADDRESS);
```

---

## Future: Native PBC Migration

To migrate from wrapped tokens to fully native PBC tokens:

### Phase 1: Parallel Operation
- Keep wrapped tokens on external chains
- PBCs mint native chain tokens (e.g., wBTC on BTC-PBC)
- Bridge wrapped ETR <-> native PBC tokens

### Phase 2: Token Swap
- Deploy upgraded PBC runtime with native token
- Allow 1:1 swap: wrapped ETR -> native PBC token
- Gradually phase out wrapped tokens

### Phase 3: Direct Bridge
- PBC directly monitors native chain (BTC, ETH, etc.)
- Mints native representation on Primearc
- No more wrapped tokens on external chains

---

## Security Considerations

### Multi-Signature Requirements
- Use multisig for bridge operator role
- Require 3-of-5 signatures for parameter changes
- Time-lock for exchange rate updates

### Circuit Breaker
```rust
// In pallet-circuit-breaker
pub fn pause_bridge(origin: OriginFor<T>, chain_id: ChainId) -> DispatchResult;
pub fn resume_bridge(origin: OriginFor<T>, chain_id: ChainId) -> DispatchResult;
```

### Rate Limiting
- Max withdrawal per block
- Daily volume caps
- Cooldown between large transactions

---

## Quick Start Commands

### Register Relayer on PBC
```bash
# Using polkadot-js
polkadot-js-api --ws ws://localhost:9944 \
  tx.sudo.sudo \
  'solanaBridge.registerRelayer' \
  '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
```

### Set Bridge Operator
```bash
polkadot-js-api --ws ws://localhost:9944 \
  tx.sudo.sudo \
  'bnbBridge.setOperator' \
  '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
```

### Add Supported Token
```bash
polkadot-js-api --ws ws://localhost:9944 \
  tx.bnbBridge.addSupportedToken \
  '0xcc9b37fed77a01329502f8844620577742eb0dc6' \
  '1000000000000000000'
```

---

## Monitoring & Alerts

### Key Metrics to Track
1. `total_bridged_volume` - Per chain volume
2. `locked_balance` - ETR locked in bridge
3. `pending_deposits` - Queue depth
4. `pending_withdrawals` - Queue depth

### Alert Thresholds
- Volume spike: >200% of 24h average
- Queue depth: >100 pending transactions
- Balance mismatch: locked != sum(minted)

---

## Summary

| Chain | Contract | Confirmations | Rate Scale |
|-------|----------|---------------|------------|
| Solana | CA4ALvCam7N3ya8d2axp3AakwNdCdQchQNNwYSYiMRR4 | 31 slots | 1e9 |
| BSC | 0xcc9b37fed77a01329502f8844620577742eb0dc6 | 15 blocks | 1e18 |
| Polygon | 0x5566f6fb5cdb3aadf8662f9d1218ce2fc4bc72fb | 256 blocks | 1e18 |
| Ethereum | 0x5566f6fb5cdb3aadf8662f9d1218ce2fc4bc72fb | 12 blocks | 1e18 |
| Arbitrum | 0x1A065196152C2A70e54AC06D3a3433e3D8606eF3 | 12 blocks | 1e18 |
