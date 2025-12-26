# ËTR Multi-Chain Deployment Guide

## Contract: EtridToken.sol
- Name: "Etrid" (no special chars for compatibility)
- Symbol: "ETR"
- Decimals: 18
- Initial Supply: 10,000,000 (for LP)
- Bridge-enabled: Yes

## Deployment Order

### 1. BSC (BNB Smart Chain) - $100 budget

**Network Settings (MetaMask):**
- RPC: https://bsc-dataseed.binance.org/
- Chain ID: 56
- Symbol: BNB
- Explorer: https://bscscan.com

**Deploy:**
1. Go to https://remix.ethereum.org
2. Create new file: EtridToken.sol
3. Paste contract code
4. Compile (Solidity 0.8.20)
5. Deploy tab → Injected Provider (MetaMask on BSC)
6. Deploy → Confirm in MetaMask (~$2-5)

**Create PancakeSwap Pool:**
1. Go to https://pancakeswap.finance/add
2. Select ETR token (paste contract address)
3. Pair with BNB
4. Add ~$100 liquidity (50/50 split)

**Verify Contract:**
1. Go to https://bscscan.com/address/YOUR_CONTRACT
2. Click "Contract" → "Verify"
3. Compiler: 0.8.20, Optimization: Yes
4. Paste source code

---

### 2. Polygon - $100 budget

**Network Settings:**
- RPC: https://polygon-rpc.com
- Chain ID: 137
- Symbol: MATIC
- Explorer: https://polygonscan.com

**Deploy:** Same as BSC but on Polygon network

**Create QuickSwap Pool:**
1. Go to https://quickswap.exchange/#/pools
2. Add liquidity: ETR/MATIC
3. Add ~$100 liquidity

---

### 3. Arbitrum - $100 budget

**Network Settings:**
- RPC: https://arb1.arbitrum.io/rpc
- Chain ID: 42161
- Symbol: ETH
- Explorer: https://arbiscan.io

**Deploy:** Same process

**Create Camelot Pool:**
1. Go to https://app.camelot.exchange/liquidity
2. Add liquidity: ETR/ETH
3. Add ~$100 liquidity

---

### 4. Ethereum Mainnet - $150 budget

**Network Settings:**
- RPC: https://mainnet.infura.io/v3/YOUR_KEY (or use MetaMask default)
- Chain ID: 1
- Symbol: ETH
- Explorer: https://etherscan.io

**Deploy:** Same process (~$50-100 gas)

**Create Uniswap V3 Pool:**
1. Go to https://app.uniswap.org/add
2. Select ETR token
3. Pair with ETH
4. Add ~$50-100 liquidity

---

## After All Deployments

### Record All Addresses:
```
BSC:      0x...
Polygon:  0x...
Arbitrum: 0x...
Ethereum: 0x...
Solana:   CA4ALvCam7N3ya8d2axp3AakwNdCdQchQNNwYSYiMRR4
```

### Configure PBC Bridges:
Update each PBC runtime config with the deployed contract addresses.

### Submit to CoinGecko:
One submission with ALL chain addresses for unified listing.

---

## Quick Checklist

- [ ] Fund MetaMask with: BNB, MATIC, ETH (Arbitrum), ETH (Mainnet)
- [ ] Deploy on BSC → Record address
- [ ] Create PancakeSwap pool → Verify on DexScreener
- [ ] Deploy on Polygon → Record address
- [ ] Create QuickSwap pool → Verify
- [ ] Deploy on Arbitrum → Record address
- [ ] Create Camelot pool → Verify
- [ ] Deploy on Ethereum → Record address
- [ ] Create Uniswap pool → Verify
- [ ] Verify all contracts on explorers
- [ ] Submit all to CoinGecko

## Estimated Costs

| Chain | Deploy Gas | LP | Total |
|-------|------------|-----|-------|
| BSC | ~$3 | $97 | $100 |
| Polygon | ~$1 | $99 | $100 |
| Arbitrum | ~$5 | $95 | $100 |
| Ethereum | ~$75 | $75 | $150 |
| **Total** | ~$84 | $366 | **$450** |

Plus Solana: ~$360 more to hit $500 = **$810 total**
