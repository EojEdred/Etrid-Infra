# Solana Token List Submission

## Overview
This will make your logo and metadata show on:
- Jupiter Aggregator
- Phantom Wallet
- Solscan
- All major Solana platforms

## Submission Steps

### 1. Fork the Repository
Go to: https://github.com/solana-labs/token-list
Click "Fork" in the top right

### 2. Clone Your Fork
```bash
cd ~/Desktop
git clone https://github.com/YOUR_GITHUB_USERNAME/token-list.git
cd token-list
```

### 3. Add Your Token
Create file: `src/tokens/etrid.tokenlist.json`

```json
{
  "chainId": 101,
  "address": "CA4ALvCam7N3ya8d2axp3AakwNdCdQchQNNwYSYiMRR4",
  "symbol": "ÉTR",
  "name": "Ëtrid",
  "decimals": 9,
  "logoURI": "https://arweave.net/ga6lvo-_6QoGFrLhO8T6_2FtHHMkCsas0LIEFZT3voI",
  "tags": [
    "multichain",
    "defi",
    "substrate"
  ],
  "extensions": {
    "website": "https://etrid.org",
    "twitter": "https://x.com/gizzi_io",
    "telegram": "https://t.me/etridnetwork",
    "discord": "https://discord.gg/etrid",
    "description": "Native token of the ËTRID multichain network - PrimeArc Core Chain and Partition Burst Chains.",
    "serumV3Usdc": "",
    "serumV3Usdt": "",
    "coingeckoId": "",
    "coinmarketcapId": ""
  }
}
```

### 4. Download Logo (Square Format)
Download your logo from Arweave and save as:
`assets/mainnet/CA4ALvCam7N3ya8d2axp3AakwNdCdQchQNNwYSYiMRR4/logo.png`

Requirements:
- Square (200x200 recommended)
- PNG format
- Max 100kb
- Clean, professional

### 5. Commit and Push
```bash
git checkout -b add-etrid-token
git add .
git commit -m "Add Ëtrid (ÉTR) token"
git push origin add-etrid-token
```

### 6. Create Pull Request
1. Go to your fork on GitHub
2. Click "Pull Request"
3. Title: "Add Ëtrid (ÉTR) token"
4. Description:
```
## Token Information
- **Name**: Ëtrid
- **Symbol**: ÉTR
- **Contract**: CA4ALvCam7N3ya8d2axp3AakwNdCdQchQNNwYSYiMRR4
- **Decimals**: 9
- **Total Supply**: 2,521,014,000

## Project Information
- **Website**: https://etrid.org
- **Twitter**: https://x.com/gizzi_io
- **Telegram**: https://t.me/etridnetwork
- **Type**: Multichain infrastructure token

## Verification
- [x] Token deployed on Solana mainnet
- [x] Metadata uploaded to Arweave
- [x] Trading live on Raydium
- [x] Logo hosted on Arweave (permanent)

## Liquidity
- Pool: 7MqieHiFzohJ9D5ENZnuo24S3XmLz4Xy9k3v4R46TFWr
- Pair: ETR/SOL
- DEX: Raydium

Ëtrid is the native token of the ËTRID multichain network built with Substrate/Polkadot SDK, featuring PrimeArc Core Chain and 11 Partition Burst Chains.
```

### 7. Wait for Review
- Usually takes 1-7 days
- Maintainers may request changes
- Once merged, logo shows everywhere within 24 hours

## Verification Links
After submission, check these to track progress:
- Your PR: https://github.com/solana-labs/token-list/pulls
- Token on Solscan: https://solscan.io/token/CA4ALvCam7N3ya8d2axp3AakwNdCdQchQNNwYSYiMRR4

## Common Issues

**PR Rejected:**
- Logo too large (>100kb)
- Logo not square
- Missing required fields
- Token not verified on-chain

**Fix:**
- Optimize logo with TinyPNG
- Ensure square aspect ratio
- Add all required metadata
- Verify token exists on mainnet

## Alternative: Jupiter Strict List
If you want faster approval, you can also submit to Jupiter's strict list:
https://station.jup.ag/guides/general/get-your-token-on-jupiter
