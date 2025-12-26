# Raydium Liquidity Pool Creation Guide

## Prerequisites

Before creating Raydium LPs, ensure you have:

- [ ] ÉTR SPL token deployed on Solana
- [ ] Token metadata created via Metaplex
- [ ] Sufficient ÉTR tokens in your wallet
- [ ] USDC for ETR/USDC pool
- [ ] SOL for ETR/SOL pool
- [ ] Extra SOL for transaction fees (~0.5 SOL)

## Recommended Initial Liquidity

Based on target price of $0.01-$0.05 per ÉTR:

### Pool 1: ETR/USDC (Recommended for stable price discovery)

**Option A: Conservative Launch**
- 10,000,000 ÉTR
- $100,000 USDC
- **Initial Price:** $0.01 per ÉTR
- **Market Cap:** $10M FDV

**Option B: Mid-Range Launch**
- 5,000,000 ÉTR
- $150,000 USDC
- **Initial Price:** $0.03 per ÉTR
- **Market Cap:** $30M FDV

**Option C: Premium Launch**
- 2,000,000 ÉTR
- $100,000 USDC
- **Initial Price:** $0.05 per ÉTR
- **Market Cap:** $50M FDV

### Pool 2: ETR/SOL (For additional liquidity & visibility)

Assuming SOL = $100:

**Option A: Conservative**
- 5,000,000 ÉTR
- 500 SOL ($50,000)
- **Initial Price:** $0.01 per ÉTR

**Option B: Mid-Range**
- 3,000,000 ÉTR
- 900 SOL ($90,000)
- **Initial Price:** $0.03 per ÉTR

**Option C: Premium**
- 1,000,000 ÉTR
- 500 SOL ($50,000)
- **Initial Price:** $0.05 per ÉTR

## Step-by-Step: Creating ETR/USDC Pool

### 1. Navigate to Raydium

https://raydium.io/liquidity/add/

### 2. Connect Wallet

- Click "Connect Wallet"
- Select Phantom/Solflare/other wallet
- Approve connection

### 3. Select Tokens

**Base Token:** ÉTR
- Click token selector
- Paste your ÉTR token address
- If not auto-populated, manually enter

**Quote Token:** USDC
- Select USDC from list
- Address: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`

### 4. Enter Amounts

Based on your chosen option (A/B/C above):

**Example for Option A:**
- ÉTR Amount: `10000000`
- USDC Amount: `100000`

The interface will show:
- Initial price: $0.01 per ÉTR
- Pool share: 100% (new pool)
- LP tokens received: ~1,000,000

### 5. Review Pool Settings

**Check:**
- Starting price is correct
- Token amounts match your calculation
- Fee tier (default 0.25% is fine)

### 6. Create Pool

- Click "Create Pool"
- Approve transactions:
  1. Approve ÉTR spend
  2. Approve USDC spend
  3. Create pool
  4. Add liquidity

**Total TX Count:** 2-4 signatures

### 7. Save Pool Information

After creation, record:
- **Pool Address:** `[Pool ID from Raydium]`
- **AMM ID:** `[AMM ID from Raydium]`
- **Pool URL:** `https://raydium.io/swap/?inputCurrency=sol&outputCurrency=[YOUR_ETR_ADDRESS]`
- **Analytics URL:** `https://raydium.io/liquidity/info/?ammId=[AMM_ID]`

## Step-by-Step: Creating ETR/SOL Pool

Repeat the same process, but:

**Quote Token:** SOL (Native Solana)
- Symbol: SOL
- Auto-selected

**Amounts** (Option A example):
- ÉTR: `5000000`
- SOL: `500`

## Post-Creation Verification

### 1. Check Pool on Raydium

Visit: `https://raydium.io/liquidity/info/?ammId=[YOUR_AMM_ID]`

**Verify:**
- [ ] Total liquidity shown correctly
- [ ] Price matches expected initial price
- [ ] Both tokens appear with correct symbols
- [ ] Volume starts at $0

### 2. Check on Solana Explorer

Visit: `https://solscan.io/account/[POOL_ADDRESS]`

**Verify:**
- [ ] Pool account exists
- [ ] Token balances correct
- [ ] Creation transaction succeeded

### 3. Test Swap

**Small Test Swap:**
- Go to Raydium Swap
- Swap 1 USDC → ÉTR
- Verify you receive ~100 ÉTR (if price is $0.01)
- Check transaction succeeded

### 4. Record Pool Data for CMC/CG

For CoinMarketCap & CoinGecko submissions:

```json
{
  "dex": "Raydium",
  "network": "Solana",
  "pools": [
    {
      "pair": "ETR/USDC",
      "pool_address": "[POOL_ADDRESS]",
      "amm_id": "[AMM_ID]",
      "pool_url": "https://raydium.io/liquidity/info/?ammId=[AMM_ID]",
      "initial_liquidity_usd": 100000,
      "initial_price": 0.01
    },
    {
      "pair": "ETR/SOL",
      "pool_address": "[POOL_ADDRESS]",
      "amm_id": "[AMM_ID]",
      "pool_url": "https://raydium.io/liquidity/info/?ammId=[AMM_ID]",
      "initial_liquidity_usd": 50000,
      "initial_price": 0.01
    }
  ]
}
```

## Important Considerations

### Liquidity Lock (Optional but Recommended)

To prevent rug-pull concerns:

**Option 1: Burn LP Tokens**
- Send LP tokens to null address
- Liquidity becomes permanently locked
- **IRREVERSIBLE**

**Option 2: Time-Lock via Streamflow**
- Use https://streamflow.finance/
- Lock LP tokens for 6-12 months
- Shows commitment to project

**Option 3: Multi-Sig Lock**
- Create multi-sig wallet
- Require 3/5 signatures to remove liquidity
- More flexible than burn

### Slippage Protection

When creating pools:
- Set slippage to 0.5% for pool creation
- After creation, users can trade with 0.1-1% slippage

### Price Impact Monitoring

After launch:
- Monitor first 100 trades
- Watch for large buys/sells
- Be ready to add liquidity if needed

## Troubleshooting

### "Insufficient SOL for transaction"
- Add more SOL to wallet (need ~0.5 SOL)

### "Token not found"
- Verify token address is correct
- Ensure metadata is created
- Wait 5-10 minutes after metadata creation

### "Pool already exists"
- Someone already created pool for this pair
- Check existing pools first
- Consider adding to existing pool instead

### "Transaction failed"
- Check wallet has enough tokens + fees
- Increase slippage to 1%
- Try again with lower amounts first

## Next Steps

After successful pool creation:

1. [ ] Submit to CoinMarketCap (use pool URLs)
2. [ ] Submit to CoinGecko (use pool URLs)
3. [ ] Announce on social media
4. [ ] Add pool links to website
5. [ ] Monitor liquidity and volume
6. [ ] Consider adding to Jupiter aggregator
7. [ ] Consider listing on additional DEXes (Orca, Meteora)

## Pool Analytics

Track these metrics post-launch:

- **24h Volume**
- **Total Liquidity (TVL)**
- **Price (current vs. initial)**
- **Unique wallets trading**
- **Largest trades**
- **Price impact of $1K/$10K/$100K trades**

Use:
- Raydium Analytics
- Birdeye.so
- Dexscreener.com
- SolScan

## Support

If you encounter issues:
- Raydium Discord: https://discord.gg/raydium
- Raydium Docs: https://docs.raydium.io/
