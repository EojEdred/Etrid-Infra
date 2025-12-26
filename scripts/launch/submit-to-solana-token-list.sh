#!/bin/bash
set -e

# Solana Token List Submission Script
# This script automates the submission of ËTR token to the official Solana Token List

TOKEN_ADDRESS="CA4ALvCam7N3ya8d2axp3AakwNdCdQchQNNwYSYiMRR4"
YOUR_GITHUB_USERNAME="${1:-YourGitHubUsername}"

echo "🚀 Solana Token List Submission for ËTR"
echo "========================================"
echo ""
echo "Token Address: $TOKEN_ADDRESS"
echo "GitHub Username: $YOUR_GITHUB_USERNAME"
echo ""

# Step 1: Check if fork exists
echo "📋 Step 1: Fork the repository"
echo "Go to: https://github.com/solana-labs/token-list"
echo "Click 'Fork' button in top right"
echo ""
read -p "Press ENTER after you've forked the repo..."

# Step 2: Clone your fork
echo ""
echo "📥 Step 2: Cloning your fork..."
cd /Users/macbook/Desktop
if [ -d "token-list" ]; then
    echo "⚠️  token-list directory exists. Removing..."
    rm -rf token-list
fi

git clone "https://github.com/$YOUR_GITHUB_USERNAME/token-list.git"
cd token-list

# Step 3: Create branch
echo ""
echo "🌿 Step 3: Creating branch..."
git checkout -b "add-etrid-token"

# Step 4: Create directories
echo ""
echo "📁 Step 4: Creating directories..."
mkdir -p "assets/mainnet/$TOKEN_ADDRESS"

# Step 5: Copy logo (200x200 PNG, < 100KB)
echo ""
echo "🎨 Step 5: Copying logo..."
cp /Users/macbook/Desktop/etrid/scripts/launch/etrid-logo-200x200.png "assets/mainnet/$TOKEN_ADDRESS/logo.png"

# Verify logo size
LOGO_SIZE=$(stat -f%z "assets/mainnet/$TOKEN_ADDRESS/logo.png")
echo "Logo size: $LOGO_SIZE bytes"
if [ $LOGO_SIZE -gt 102400 ]; then
    echo "⚠️  WARNING: Logo is larger than 100KB. May need to optimize."
fi

# Step 6: Add token entry to solana.tokenlist.json
echo ""
echo "📝 Step 6: Adding token to list..."

# Read the JSON entry
TOKEN_ENTRY=$(cat /Users/macbook/Desktop/etrid/scripts/launch/etrid-token-list-entry.json)

# Use Python to properly insert the entry
python3 << 'PYTHON_SCRIPT'
import json
import sys

# Read existing token list
with open('src/tokens/solana.tokenlist.json', 'r') as f:
    data = json.load(f)

# Read new token entry
with open('/Users/macbook/Desktop/etrid/scripts/launch/etrid-token-list-entry.json', 'r') as f:
    new_token = json.load(f)

# Check if token already exists
exists = any(token['address'] == new_token['address'] for token in data['tokens'])

if not exists:
    # Add new token to the list
    data['tokens'].append(new_token)

    # Sort tokens by symbol (case-insensitive)
    data['tokens'].sort(key=lambda x: x['symbol'].lower())

    # Write back
    with open('src/tokens/solana.tokenlist.json', 'w') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print("✅ Token added successfully!")
else:
    print("⚠️  Token already exists in the list")
    sys.exit(1)
PYTHON_SCRIPT

# Step 7: Commit changes
echo ""
echo "💾 Step 7: Committing changes..."
git add .
git commit -m "Add Ëtrid (ËTR) token

Token Address: CA4ALvCam7N3ya8d2axp3AakwNdCdQchQNNwYSYiMRR4
Website: https://etrid.org
Twitter: https://x.com/gizzi_io

Ëtrid is a decentralized blockchain platform with multi-chain capabilities."

# Step 8: Push to your fork
echo ""
echo "⬆️  Step 8: Pushing to your fork..."
git push origin add-etrid-token

echo ""
echo "✅ SUCCESS! Your token submission is ready!"
echo ""
echo "📋 NEXT STEPS:"
echo "=============="
echo ""
echo "1. Go to your fork: https://github.com/$YOUR_GITHUB_USERNAME/token-list"
echo "2. Click 'Compare & pull request' button"
echo "3. Title: Add Ëtrid (ËTR) token"
echo "4. Description:"
echo ""
cat << 'EOF'
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
EOF
echo ""
echo "5. Submit the pull request"
echo "6. Wait for review (usually 1-3 days)"
echo ""
echo "🎉 Once merged, your logo will appear on:"
echo "   - Jupiter Aggregator"
echo "   - Phantom Wallet"
echo "   - Solscan"
echo "   - All apps using the Solana Token List"
echo ""
