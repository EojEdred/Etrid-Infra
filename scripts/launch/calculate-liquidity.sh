#!/bin/bash

# Liquidity Calculator for ËTR Token
# Helps calculate how much SOL and ËTR needed for adding liquidity

echo "🧮 ËTR Liquidity Calculator"
echo "================================"
echo ""

# Current pool state
CURRENT_SOL=0.55
CURRENT_ETR=10000000
POOL_ADDRESS="7MqieHiFzohJ9D5ENZnuo24S3XmLz4Xy9k3v4R46TFWr"

# SOL price (update this manually or fetch from API)
SOL_PRICE=154  # USD per SOL (update as needed)

echo "📊 Current Raydium Pool State:"
echo "Pool Address: $POOL_ADDRESS"
echo "SOL in pool: $CURRENT_SOL SOL"
echo "ËTR in pool: $CURRENT_ETR ËTR"
echo "Ratio: 1 SOL = $(python3 -c "print(f'{$CURRENT_ETR/$CURRENT_SOL:,.2f}')") ËTR"
echo ""

# Calculate current price
PRICE_PER_ETR=$(python3 -c "print($CURRENT_SOL / $CURRENT_ETR * $SOL_PRICE)")
echo "Current ËTR Price: \$$PRICE_PER_ETR USD"
echo ""

echo "================================"
echo ""

# Ask user how much USD they want to add
echo "💰 How much liquidity do you want to add?"
echo ""
echo "Enter amount in USD (e.g., 100, 200, 406):"
read -p "> $" USD_AMOUNT

if [ -z "$USD_AMOUNT" ]; then
    echo "No amount entered. Using $406 (remaining budget)"
    USD_AMOUNT=406
fi

echo ""
echo "================================"
echo ""

# Calculate amounts needed
echo "📈 Liquidity Calculation for \$$USD_AMOUNT USD:"
echo ""

# SOL amount needed (half of USD value)
SOL_NEEDED=$(python3 -c "print($USD_AMOUNT / 2 / $SOL_PRICE)")
echo "SOL needed: $SOL_NEEDED SOL (\$$(python3 -c "print($USD_AMOUNT/2)"))"

# ËTR amount needed (based on current ratio)
RATIO=$(python3 -c "print($CURRENT_ETR / $CURRENT_SOL)")
ETR_NEEDED=$(python3 -c "print(int($SOL_NEEDED * $RATIO))")
echo "ËTR needed: $ETR_NEEDED ËTR (\$$(python3 -c "print($USD_AMOUNT/2)"))"

echo ""
echo "================================"
echo ""

# Check current balances
echo "🔍 Checking your current balances..."
echo ""

PHANTOM_WALLET="9e94HFkAYT7PueBQtX3qUL5WeaDaSJ6JAjo6tyVo9s85"
TOKEN_ADDRESS="CA4ALvCam7N3ya8d2axp3AakwNdCdQchQNNwYSYiMRR4"

# Check SOL balance
SOL_BALANCE=$(solana balance $PHANTOM_WALLET 2>/dev/null | awk '{print $1}')
echo "Your SOL balance: $SOL_BALANCE SOL"

# Check ËTR balance
ETR_BALANCE=$(spl-token balance $TOKEN_ADDRESS --owner $PHANTOM_WALLET 2>/dev/null)
echo "Your ËTR balance: $(python3 -c "print(f'{$ETR_BALANCE:,.0f}')") ËTR"

echo ""

# Check if sufficient
ENOUGH_SOL=$(python3 -c "print('Yes ✅' if float('$SOL_BALANCE') >= float('$SOL_NEEDED') else 'No ❌')")
ENOUGH_ETR=$(python3 -c "print('Yes ✅' if float('$ETR_BALANCE') >= float('$ETR_NEEDED') else 'No ❌')")

echo "Sufficient SOL: $ENOUGH_SOL"
echo "Sufficient ËTR: $ENOUGH_ETR"

echo ""
echo "================================"
echo ""

# Show after state
NEW_SOL=$(python3 -c "print($CURRENT_SOL + $SOL_NEEDED)")
NEW_ETR=$(python3 -c "print(int($CURRENT_ETR + $ETR_NEEDED))")
NEW_TOTAL_VALUE=$(python3 -c "print(int(($CURRENT_SOL + $SOL_NEEDED) * $SOL_PRICE * 2))")

echo "📊 Pool After Adding Liquidity:"
echo ""
echo "SOL in pool: $NEW_SOL SOL"
echo "ËTR in pool: $(python3 -c "print(f'{$NEW_ETR:,.0f}')") ËTR"
echo "Total pool value: ~\$$NEW_TOTAL_VALUE USD"
echo ""

echo "================================"
echo ""

echo "🎯 Next Steps:"
echo ""
echo "1. Go to Raydium:"
echo "   https://raydium.io/liquidity/increase/?pool_id=$POOL_ADDRESS"
echo ""
echo "2. Enter these amounts:"
echo "   SOL: $SOL_NEEDED"
echo "   ËTR: $ETR_NEEDED"
echo ""
echo "3. Confirm transaction in Phantom"
echo ""
echo "4. You'll receive more LP tokens!"
echo ""

# Option to create new pool
echo "================================"
echo ""
echo "💡 Want to create a pool on another DEX instead?"
echo ""
echo "Recommended DEXs:"
echo "1. Orca: https://www.orca.so/pools"
echo "2. Meteora: https://app.meteora.ag/pools"
echo ""
echo "Use the SAME amounts calculated above for a new pool!"
echo ""
