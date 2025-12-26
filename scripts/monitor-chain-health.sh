#!/bin/bash

# Ëtrid Primearc Core - Chain Health Monitor
# Monitors validator status, block production, and network health

set -e

CHAIN_RPC="http://100.96.84.69:9944"  # Gizzi's validator via Tailscale

echo "═══════════════════════════════════════════════════════════"
echo "Ëtrid Primearc Core - Chain Health Report"
echo "═══════════════════════════════════════════════════════════"
echo "Time: $(date)"
echo ""

# 1. System Health
echo "📊 System Health:"
HEALTH=$(curl -s $CHAIN_RPC -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"system_health","params":[],"id":1}')

PEERS=$(echo $HEALTH | jq -r '.result.peers')
IS_SYNCING=$(echo $HEALTH | jq -r '.result.isSyncing')

echo "   Peers: $PEERS"
echo "   Syncing: $IS_SYNCING"

if [ "$IS_SYNCING" == "false" ]; then
  echo "   ✅ Node is fully synced"
else
  echo "   ⚠️  Node is syncing..."
fi
echo ""

# 2. Block Production
echo "📦 Block Production:"
BLOCK=$(curl -s $CHAIN_RPC -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"chain_getHeader","params":[],"id":1}')

BLOCK_NUM_HEX=$(echo $BLOCK | jq -r '.result.number')
BLOCK_NUM=$((16#${BLOCK_NUM_HEX:2}))

echo "   Current Block: #$BLOCK_NUM"

# Wait and check next block
sleep 7
BLOCK2=$(curl -s $CHAIN_RPC -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"chain_getHeader","params":[],"id":1}')
BLOCK_NUM2_HEX=$(echo $BLOCK2 | jq -r '.result.number')
BLOCK_NUM2=$((16#${BLOCK_NUM2_HEX:2}))

BLOCKS_PRODUCED=$((BLOCK_NUM2 - BLOCK_NUM))
echo "   Blocks in 7s: $BLOCKS_PRODUCED"

if [ $BLOCKS_PRODUCED -gt 0 ]; then
  echo "   ✅ Chain is producing blocks"
else
  echo "   ❌ Chain stalled - no new blocks!"
fi
echo ""

# 3. Sync Status
echo "🔄 Sync Status:"
SYNC=$(curl -s $CHAIN_RPC -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"system_syncState","params":[],"id":1}')

CURRENT=$(echo $SYNC | jq -r '.result.currentBlock')
HIGHEST=$(echo $SYNC | jq -r '.result.highestBlock')

echo "   Current: #$CURRENT"
echo "   Highest: #$HIGHEST"

if [ "$CURRENT" == "$HIGHEST" ]; then
  echo "   ✅ Fully synced"
else
  BEHIND=$((HIGHEST - CURRENT))
  echo "   ⚠️  Behind by $BEHIND blocks"
fi
echo ""

# 4. Network Info
echo "🌐 Network Info:"
CHAIN=$(curl -s $CHAIN_RPC -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"system_chain","params":[],"id":1}' | jq -r '.result')

VERSION=$(curl -s $CHAIN_RPC -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"system_version","params":[],"id":1}' | jq -r '.result')

NAME=$(curl -s $CHAIN_RPC -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"system_name","params":[],"id":1}' | jq -r '.result')

echo "   Chain: $CHAIN"
echo "   Version: $VERSION"
echo "   Node: $NAME"
echo ""

# 5. Validator Status (if available)
echo "👥 Validator Committee:"
# Try to query validator count
VALIDATORS=$(curl -s $CHAIN_RPC -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"state_call","params":["ValidatorCommitteeApi_validators",[]],"id":1}' 2>/dev/null)

if echo "$VALIDATORS" | grep -q "result"; then
  echo "   ✅ ValidatorCommittee responding"
else
  echo "   ⚠️  Unable to query validator committee"
fi
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "✅ Health Check Complete"
echo "═══════════════════════════════════════════════════════════"
