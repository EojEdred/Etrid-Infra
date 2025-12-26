# ËTRID Token Launch Package

Complete toolkit for launching ÉTR token on Solana Raydium and listing on CoinMarketCap/CoinGecko.

## 📦 Package Contents

### Deployment Scripts
- `01-deploy-spl-token.sh` - Deploy ÉTR SPL token on Solana
- `02-create-token-metadata.js` - Create Metaplex metadata

### Guides & Templates
- `03-raydium-lp-guide.md` - Step-by-step Raydium pool creation
- `04-cmc-submission-template.md` - CoinMarketCap listing template
- `05-coingecko-submission-template.md` - CoinGecko listing template
- `06-launch-assets-checklist.md` - Complete pre-launch checklist
- `07-launch-narrative-strategy.md` - 7-day launch marketing plan

### Configuration
- `package.json` - Node.js dependencies
- `deployment-info.json` - Generated after deployment

---

## 🚀 Quick Start

### Prerequisites

**Required Tools:**
```bash
# 1. Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# 2. SPL Token CLI
cargo install spl-token-cli

# 3. Node.js (v16+)
# Download from: https://nodejs.org/
```

**Required Assets:**
- [ ] Solana wallet with ~1 SOL for fees
- [ ] Logo files (200x200 PNG, transparent)
- [ ] Website live with token info
- [ ] Documentation published
- [ ] Social media accounts active

### Step 1: Install Dependencies

```bash
cd Desktop/etrid/scripts/launch
npm install
```

### Step 2: Configure Wallet

```bash
# Check if wallet exists
solana address

# If not, create new wallet
solana-keygen new --outfile ~/.config/solana/id.json

# Set network (mainnet-beta for production)
solana config set --url https://api.mainnet-beta.solana.com

# Check SOL balance
solana balance

# If balance is low, fund your wallet
# Address: $(solana address)
```

### Step 3: Deploy SPL Token

```bash
# Make script executable
chmod +x 01-deploy-spl-token.sh

# Run deployment
./01-deploy-spl-token.sh
```

**This will:**
- ✅ Create ÉTR SPL token (1B supply, 9 decimals)
- ✅ Create token account
- ✅ Mint initial supply
- ✅ Optionally disable minting (fixed supply)
- ✅ Save deployment info to `deployment-info.json`

**Output:**
```json
{
  "token_address": "YOUR_TOKEN_ADDRESS",
  "token_account": "YOUR_TOKEN_ACCOUNT",
  "decimals": 9,
  "total_supply": 1000000000,
  ...
}
```

### Step 4: Create Token Metadata

**Before running, update `02-create-token-metadata.js`:**

```javascript
// Line 9-30: Update these fields
const CONFIG = {
  tokenName: 'Ëtrid',
  tokenSymbol: 'ÉTR',
  description: '...',
  image: 'https://etrid.io/assets/etr-logo.png', // ← YOUR LOGO URL
  externalUrl: 'https://etrid.io',
  twitter: 'https://x.com/EtridNetwork',  // ← YOUR SOCIALS
  // ...
};
```

**Upload logo first:**
```bash
# Option 1: Upload to your website
# https://etrid.io/assets/etr-logo-200x200.png

# Option 2: Use Arweave/IPFS
# Recommended: arweave.net, nft.storage, pinata.cloud
```

**Run metadata creation:**
```bash
npm run create-metadata
```

**This will:**
- ✅ Upload metadata to Arweave via Bundlr
- ✅ Create on-chain metadata account via Metaplex
- ✅ Update `deployment-info.json` with metadata URI

### Step 5: Verify Token

```bash
# Check token on SolScan
open "https://solscan.io/token/$(cat deployment-info.json | grep token_address | cut -d'"' -f4)"

# Check metadata
spl-token display $(cat deployment-info.json | grep token_address | cut -d'"' -f4)
```

**Verify:**
- [ ] Token shows correct name/symbol
- [ ] Logo appears
- [ ] Supply is 1,000,000,000
- [ ] Decimals = 9
- [ ] (Optional) Minting disabled

### Step 6: Create Raydium Pools

**Follow:** `03-raydium-lp-guide.md`

**Summary:**
1. Go to https://raydium.io/liquidity/add/
2. Connect wallet (Phantom/Solflare)
3. Select ÉTR (paste your token address) + USDC
4. Add liquidity (recommended: $100K+ for CMC/CG)
5. Repeat for ETR/SOL pool
6. Save pool addresses

**Record pool info:**
```json
{
  "etr_usdc_pool": {
    "pool_address": "...",
    "amm_id": "...",
    "initial_liquidity_usd": 100000,
    "initial_price": 0.01
  },
  "etr_sol_pool": {
    "pool_address": "...",
    "amm_id": "...",
    "initial_liquidity_usd": 50000,
    "initial_price": 0.01
  }
}
```

### Step 7: Submit to CMC & CoinGecko

**CoinMarketCap:**
- Template: `04-cmc-submission-template.md`
- URL: https://coinmarketcap.com/request/
- Fill all fields from template
- Submit

**CoinGecko:**
- Template: `05-coingecko-submission-template.md`
- URL: https://www.coingecko.com/en/coins/new
- Fill all fields from template
- Submit

**Timeline:**
- CMC: 3-15 days
- CoinGecko: 7-14 days

### Step 8: Execute Launch Narrative

**Follow:** `07-launch-narrative-strategy.md`

**7-Day Plan:**
- Day -3: Pre-announcement teaser
- Day -2: Technical deep dive thread
- Day -1: Tokenomics transparency
- Day 0: LAUNCH (coordinated announcements)
- Day +1: 24h stats, momentum
- Day +2: Technical showcase
- Day +3: Ecosystem expansion
- Day +4: Governance activation
- Day +5: Validator spotlight
- Day +6: Roadmap preview
- Day +7: Week one wrap-up

---

## 📋 Launch Day Checklist

Use: `06-launch-assets-checklist.md`

**Critical Items:**

### Before Launch
- [ ] SPL token deployed ✅
- [ ] Metadata created ✅
- [ ] Logo uploaded (200x200 PNG)
- [ ] Website live with token page
- [ ] Documentation published
- [ ] Social media accounts active
- [ ] Wallet funded with USDC/SOL for LP
- [ ] Team briefed on launch procedure

### Launch Day
- [ ] Create Raydium ETR/USDC pool
- [ ] Create Raydium ETR/SOL pool
- [ ] Verify pools live
- [ ] Test swap transactions
- [ ] Submit to CoinMarketCap
- [ ] Submit to CoinGecko
- [ ] Post launch announcement (Twitter, Telegram, Discord)
- [ ] Monitor trading activity
- [ ] Engage with community

### Post-Launch (Week 1)
- [ ] Track CMC/CG submission status
- [ ] Update circulating supply if needed
- [ ] Monitor holder distribution
- [ ] Daily community engagement
- [ ] Address issues immediately
- [ ] Publish weekly update

---

## 🛠️ Troubleshooting

### "spl-token command not found"
```bash
cargo install spl-token-cli
export PATH="$HOME/.cargo/bin:$PATH"
```

### "Insufficient SOL for transaction"
```bash
# Check balance
solana balance

# You need ~1 SOL for:
# - Token deployment: 0.01 SOL
# - Metadata creation: 0.1-0.5 SOL (Bundlr upload)
# - Raydium pool: 0.5 SOL (fees + rent)

# Fund your wallet
# Send SOL to: $(solana address)
```

### "Cannot find module @solana/web3.js"
```bash
# Install dependencies
npm install
```

### "Token not showing on SolScan"
```bash
# Wait 30-60 seconds after deployment
# Then refresh: https://solscan.io/token/[YOUR_TOKEN_ADDRESS]

# If still not showing:
spl-token display [YOUR_TOKEN_ADDRESS]
# Should show token details
```

### "Raydium pool creation failed"
- Ensure you have enough ÉTR + USDC/SOL in wallet
- Increase slippage to 1%
- Try with smaller amounts first
- Check Solana network status: status.solana.com

---

## 📚 Additional Resources

### Solana Documentation
- CLI: https://docs.solana.com/cli
- SPL Token: https://spl.solana.com/token

### Raydium
- Docs: https://docs.raydium.io/
- Discord: https://discord.gg/raydium

### Metaplex
- Docs: https://docs.metaplex.com/
- Token Metadata: https://docs.metaplex.com/programs/token-metadata/

### Listing Guides
- CMC: https://support.coinmarketcap.com/hc/en-us/articles/360043659351
- CoinGecko: https://support.coingecko.com/hc/en-us/articles/7291312302617

---

## 🔒 Security Best Practices

### Wallet Security
- ✅ **Backup keypair:** `~/.config/solana/id.json` to offline storage
- ✅ **Never share:** Private keys, seed phrases
- ✅ **Use hardware wallet:** For large amounts (Ledger)
- ✅ **Test transactions:** Always test with small amounts first

### Token Security
- ✅ **Disable minting:** After initial supply (makes supply fixed)
- ✅ **Lock liquidity:** Via Streamflow or burn LP tokens
- ✅ **Multi-sig treasury:** For team funds (3-of-5 recommended)
- ✅ **Audit code:** Before mainnet deployment

### Operational Security
- ✅ **2FA enabled:** On all accounts (GitHub, Twitter, Discord)
- ✅ **Secure domains:** HTTPS, DNSSEC
- ✅ **API keys:** Never commit to Git
- ✅ **Team access:** Role-based permissions

---

## 📊 Success Metrics

### Week 1 Targets
- Trading Volume: $1M+
- Unique Holders: 1,000+
- Liquidity (TVL): $150K+
- Social Growth: Twitter +5K, Telegram +2K
- CMC/CG: Submitted within 24h

### Month 1 Targets
- CMC/CG: Listed
- Holders: 5,000+
- Daily Volume: $100K+
- Community: Active (500+ daily Telegram messages)
- Development: Roadmap items completed on schedule

---

## 🆘 Support

### Ëtrid Channels
- Telegram: https://t.me/etridnetwork
- Discord: https://discord.gg/etrid
- Twitter: https://x.com/EtridNetwork
- Email: support@etrid.io

### Community Resources
- Docs: https://docs.etrid.io
- GitHub: https://github.com/etrid-network/etrid
- Blog: https://etrid.io/blog

---

## 📝 Notes

### Deployment Info Location
All deployment addresses saved to: `deployment-info.json`

**Example:**
```json
{
  "token_name": "Ëtrid",
  "token_symbol": "ÉTR",
  "token_address": "ABC123...",
  "token_account": "DEF456...",
  "decimals": 9,
  "total_supply": 1000000000,
  "deployer_address": "GHI789...",
  "network": "mainnet-beta",
  "deployed_at": "2025-12-01T12:00:00Z",
  "metadata_uri": "https://arweave.net/...",
  "metadata_account": "JKL012..."
}
```

**⚠️ CRITICAL:** Back up this file securely!

### Network Selection

**For Testing (Devnet):**
```bash
solana config set --url https://api.devnet.solana.com
# Get free devnet SOL: solana airdrop 2
```

**For Production (Mainnet):**
```bash
solana config set --url https://api.mainnet-beta.solana.com
# Fund with real SOL
```

---

## ✅ Final Pre-Launch Checklist

**48 Hours Before:**
- [ ] All scripts tested on devnet
- [ ] Logo uploaded and URL verified
- [ ] Website fully functional
- [ ] Social media posts drafted
- [ ] Team roles assigned
- [ ] Support channels staffed
- [ ] Wallet funded with SOL

**24 Hours Before:**
- [ ] Final script review
- [ ] Dry run on devnet
- [ ] Launch timeline confirmed
- [ ] Social posts scheduled
- [ ] Community notified

**Launch Day:**
- [ ] Deploy SPL token ✅
- [ ] Create metadata ✅
- [ ] Create Raydium pools ✅
- [ ] Submit CMC/CG ✅
- [ ] Announce launch ✅
- [ ] Monitor 24/7 ✅

---

**Good luck with your launch! 🚀**

For questions, reach out in Discord or Telegram.

Let's build the future of multichain infrastructure together.

— Ëtrid Network Team
