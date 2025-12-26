#!/bin/bash
# ETRID SPL Token Deployment Script
# Deploy ÉTR token on Solana for Raydium listing

set -e

echo "=== ËTRID SPL Token Deployment ==="
echo ""

# Configuration
TOKEN_NAME="Ëtrid"
TOKEN_SYMBOL="ÉTR"
TOKEN_DECIMALS=9
TOTAL_SUPPLY=2521014000  # 2.521 Billion tokens (matches PrimeArc mainnet)

# Check if spl-token CLI is installed
if ! command -v spl-token &> /dev/null; then
    echo "❌ spl-token CLI not found. Installing..."
    cargo install spl-token-cli
fi

# Check Solana CLI
if ! command -v solana &> /dev/null; then
    echo "❌ Solana CLI not found. Please install from https://docs.solana.com/cli/install-solana-cli-tools"
    exit 1
fi

echo "✅ Solana CLI installed"
echo ""

# Check wallet
KEYPAIR="${HOME}/.config/solana/id.json"
if [ ! -f "$KEYPAIR" ]; then
    echo "❌ No Solana wallet found at $KEYPAIR"
    echo "Creating new wallet..."
    solana-keygen new --outfile "$KEYPAIR"
fi

echo "📍 Using wallet: $KEYPAIR"
WALLET_ADDRESS=$(solana address)
echo "   Address: $WALLET_ADDRESS"
echo ""

# Check network
NETWORK=$(solana config get | grep "RPC URL" | awk '{print $3}')
echo "🌐 Network: $NETWORK"
echo ""

# Check SOL balance
SOL_BALANCE=$(solana balance | awk '{print $1}')
echo "💰 SOL Balance: $SOL_BALANCE SOL"

if (( $(echo "$SOL_BALANCE < 0.5" | bc -l) )); then
    echo "⚠️  WARNING: Low SOL balance. You need ~0.5 SOL for token deployment."
    echo "   Please fund your wallet: $WALLET_ADDRESS"
    read -p "   Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi
echo ""

# Create token
echo "🚀 Creating ÉTR token..."
echo "   Name: $TOKEN_NAME"
echo "   Symbol: $TOKEN_SYMBOL"
echo "   Decimals: $TOKEN_DECIMALS"
echo ""

TOKEN_ADDRESS=$(spl-token create-token --decimals $TOKEN_DECIMALS | grep "Creating token" | awk '{print $3}')

if [ -z "$TOKEN_ADDRESS" ]; then
    echo "❌ Failed to create token"
    exit 1
fi

echo "✅ Token created!"
echo "   Token Address: $TOKEN_ADDRESS"
echo ""

# Create token account for yourself
echo "📦 Creating token account..."
TOKEN_ACCOUNT=$(spl-token create-account $TOKEN_ADDRESS | grep "Creating account" | awk '{print $3}')
echo "✅ Token account created: $TOKEN_ACCOUNT"
echo ""

# Mint initial supply
echo "💎 Minting initial supply: $TOTAL_SUPPLY ÉTR"
spl-token mint $TOKEN_ADDRESS $TOTAL_SUPPLY
echo "✅ Tokens minted!"
echo ""

# Get token info
echo "📊 Token Information:"
spl-token display $TOKEN_ADDRESS
echo ""

# Disable further minting (optional - makes supply fixed)
read -p "🔒 Disable minting authority to make supply fixed? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    spl-token authorize $TOKEN_ADDRESS mint --disable
    echo "✅ Minting disabled - supply is now fixed at $TOTAL_SUPPLY ÉTR"
else
    echo "⚠️  Minting authority retained"
fi
echo ""

# Save deployment info
DEPLOYMENT_FILE="Desktop/etrid/scripts/launch/deployment-info.json"
cat > "$DEPLOYMENT_FILE" <<EOF
{
  "token_name": "$TOKEN_NAME",
  "token_symbol": "$TOKEN_SYMBOL",
  "token_address": "$TOKEN_ADDRESS",
  "token_account": "$TOKEN_ACCOUNT",
  "decimals": $TOKEN_DECIMALS,
  "total_supply": $TOTAL_SUPPLY,
  "deployer_address": "$WALLET_ADDRESS",
  "network": "$NETWORK",
  "deployed_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "📝 Deployment info saved to: $DEPLOYMENT_FILE"
echo ""

# Create metadata (Metaplex)
echo "🎨 Next Steps:"
echo "   1. Upload logo to Arweave/IPFS"
echo "   2. Create token metadata using Metaplex"
echo "   3. Submit to Solana Token List"
echo "   4. Create Raydium liquidity pools"
echo ""

echo "=== DEPLOYMENT COMPLETE ==="
echo ""
echo "📋 SAVE THESE ADDRESSES:"
echo "   Token Address:   $TOKEN_ADDRESS"
echo "   Token Account:   $TOKEN_ACCOUNT"
echo "   Wallet Address:  $WALLET_ADDRESS"
echo ""
echo "⚠️  IMPORTANT: Back up your wallet keypair at:"
echo "   $KEYPAIR"
echo ""
