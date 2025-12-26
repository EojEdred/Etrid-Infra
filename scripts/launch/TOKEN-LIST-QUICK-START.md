# 🎯 Solana Token List Submission - Quick Start

This will make your ËTR logo show on Jupiter, Phantom, Solscan, and ALL Solana platforms.

## 📋 What You Need

✅ Token deployed: `CA4ALvCam7N3ya8d2axp3AakwNdCdQchQNNwYSYiMRR4`
✅ Logo ready: `etrid-logo-200x200.png` (12KB, perfect size!)
✅ JSON entry: `etrid-token-list-entry.json`
✅ Submission script: `submit-to-solana-token-list.sh`

## 🚀 Submission Steps

### Step 1: Fork the Repository

Go to: https://github.com/solana-labs/token-list

Click the **Fork** button (top right corner)

### Step 2: Run the Submission Script

```bash
cd /Users/macbook/Desktop/etrid/scripts/launch

# Replace YOUR_GITHUB_USERNAME with your actual GitHub username
./submit-to-solana-token-list.sh YOUR_GITHUB_USERNAME
```

Example:
```bash
./submit-to-solana-token-list.sh eojacodes
```

The script will:
- Clone your forked repo
- Create a new branch `add-etrid-token`
- Copy your logo to the correct location
- Add ËTR to the token list
- Commit and push everything

### Step 3: Create Pull Request

After the script completes, it will give you a link to create the PR.

**PR Title:**
```
Add Ëtrid (ËTR) token
```

**PR Description:** (the script prints this for you to copy)
```markdown
## Token Information
- **Name:** Ëtrid
- **Symbol:** ËTR
- **Address:** CA4ALvCam7N3ya8d2axp3AakwNdCdQchQNNwYSYiMRR4
- **Decimals:** 9
- **Network:** Solana Mainnet

## Links
- Website: https://etrid.org
- Twitter: https://x.com/gizzi_io
- Telegram: https://t.me/etridnetwork
- Token on Solscan: https://solscan.io/token/CA4ALvCam7N3ya8d2axp3AakwNdCdQchQNNwYSYiMRR4

## Trading
- Raydium: https://raydium.io/swap/?outputCurrency=CA4ALvCam7N3ya8d2axp3AakwNdCdQchQNNwYSYiMRR4
- Jupiter: https://jup.ag/swap/SOL-CA4ALvCam7N3ya8d2axp3AakwNdCdQchQNNwYSYiMRR4

## Checklist
- [x] Logo is 200x200 PNG
- [x] Logo is under 100KB
- [x] Token is verified on Solscan
- [x] Token has active liquidity on Raydium
- [x] All social links are valid
```

### Step 4: Wait for Review

- Maintainers usually review within 1-3 days
- They may request changes
- Once approved and merged, your logo appears EVERYWHERE!

## ✨ After Approval

Your logo will automatically show on:
- ✅ Jupiter Aggregator
- ✅ Phantom Wallet
- ✅ Solflare Wallet
- ✅ Solscan
- ✅ Raydium
- ✅ Every app using Solana Token List

## 🔍 Manual Method (if script doesn't work)

If you prefer to do it manually:

1. **Fork & Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/token-list.git
   cd token-list
   git checkout -b add-etrid-token
   ```

2. **Add Logo**
   ```bash
   mkdir -p assets/mainnet/CA4ALvCam7N3ya8d2axp3AakwNdCdQchQNNwYSYiMRR4
   cp /Users/macbook/Desktop/etrid/scripts/launch/etrid-logo-200x200.png \
      assets/mainnet/CA4ALvCam7N3ya8d2axp3AakwNdCdQchQNNwYSYiMRR4/logo.png
   ```

3. **Edit Token List**

   Open `src/tokens/solana.tokenlist.json`

   Add this entry (in alphabetical order by symbol):
   ```json
   {
     "chainId": 101,
     "address": "CA4ALvCam7N3ya8d2axp3AakwNdCdQchQNNwYSYiMRR4",
     "symbol": "ËTR",
     "name": "Ëtrid",
     "decimals": 9,
     "logoURI": "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/CA4ALvCam7N3ya8d2axp3AakwNdCdQchQNNwYSYiMRR4/logo.png",
     "tags": [
       "social-token",
       "community"
     ],
     "extensions": {
       "website": "https://etrid.org",
       "twitter": "https://x.com/gizzi_io",
       "telegram": "https://t.me/etridnetwork",
       "discord": "https://discord.gg/etrid"
     }
   }
   ```

4. **Commit & Push**
   ```bash
   git add .
   git commit -m "Add Ëtrid (ËTR) token"
   git push origin add-etrid-token
   ```

5. **Create PR** on GitHub

## 📝 Requirements Checklist

Before submitting, verify:

- [x] Token address is correct
- [x] Logo is exactly 200x200 pixels
- [x] Logo is PNG format
- [x] Logo is under 100KB (yours is 12KB ✅)
- [x] Token has active trading on Raydium
- [x] All URLs are valid and working
- [x] Symbol is unique (ËTR)

## ❓ Common Issues

**Q: PR gets rejected?**
A: Common reasons:
- Logo too large (yours is fine at 12KB)
- Token not verified/no liquidity
- Duplicate symbol (yours is unique)
- Broken links

**Q: How long for approval?**
A: Usually 1-3 business days. Check your PR for comments.

**Q: Logo not showing after merge?**
A: Can take 1-24 hours to propagate to all platforms. Jupiter/Phantom update fastest.

## 🎉 Success!

Once your PR is merged, search for ËTR on Jupiter and you'll see your beautiful logo!

---

**Need Help?**
- GitHub: Open an issue on solana-labs/token-list
- Telegram: https://t.me/etridnetwork
- Discord: https://discord.gg/etrid
