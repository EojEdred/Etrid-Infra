#!/bin/bash

# Fix Gizzi's Forked Chain
# Purge and resync to correct network

set -e

GIZZI_IP="64.181.215.19"

echo "═══════════════════════════════════════════════════════════"
echo "Fixing Gizzi's Forked Chain"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "Current status:"
BLOCK=$(curl -s http://$GIZZI_IP:9944 -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"chain_getHeader","params":[],"id":1}' | jq -r '.result.number')
BLOCK_DEC=$((16#${BLOCK:2}))
echo "  Gizzi block: #$BLOCK_DEC"
echo "  Main network: ~#17,303"
echo "  Difference: Gizzi is on a different fork!"
echo ""

echo "Steps to fix:"
echo "  1. SSH to Gizzi's validator"
echo "  2. Stop the node"
echo "  3. Purge forked database"
echo "  4. Restart and resync"
echo ""

echo "Run these commands on Gizzi's server:"
echo ""
echo "─────────────────────────────────────────────────────────"
cat << 'COMMANDS'
# SSH to Gizzi
ssh root@64.181.215.19

# Check if node is running
systemctl status primearc-core-validator || systemctl status primearc-core-node

# Stop the node
sudo systemctl stop primearc-core-validator 2>/dev/null || sudo systemctl stop primearc-core-node

# Find chain data directory
CHAIN_DATA=$(find / -name "primearc_core_mainnet" -type d 2>/dev/null | grep chains | head -1)
echo "Chain data: $CHAIN_DATA"

# Backup current database (optional)
sudo mv $CHAIN_DATA/db $CHAIN_DATA/db.forked.backup.$(date +%Y%m%d)

# Or just delete it
sudo rm -rf $CHAIN_DATA/db
sudo rm -rf $CHAIN_DATA/network

# Restart node (will resync from correct network)
sudo systemctl restart primearc-core-validator 2>/dev/null || sudo systemctl restart primearc-core-node

# Monitor sync progress
journalctl -u primearc-core-validator -f --since "1 min ago"
# OR
journalctl -u primearc-core-node -f --since "1 min ago"

# Check sync status (after a few minutes)
curl -s http://localhost:9944 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"system_health","params":[],"id":1}' | jq '.'
COMMANDS
echo "─────────────────────────────────────────────────────────"
echo ""

read -p "Do you want me to SSH and fix this automatically? (y/n): " ANSWER

if [ "$ANSWER" == "y" ]; then
  echo ""
  echo "Connecting to Gizzi's validator..."

  ssh root@$GIZZI_IP << 'ENDSSH'
    echo "Stopping node..."
    systemctl stop primearc-core-validator 2>/dev/null || systemctl stop primearc-core-node

    echo "Finding chain data..."
    CHAIN_DATA=$(find /root /home -name "primearc_core_mainnet" -type d 2>/dev/null | grep chains | head -1)

    if [ -z "$CHAIN_DATA" ]; then
      echo "❌ Could not find chain data directory"
      exit 1
    fi

    echo "Found: $CHAIN_DATA"
    echo "Purging forked database..."
    rm -rf $CHAIN_DATA/db
    rm -rf $CHAIN_DATA/network

    echo "Restarting node..."
    systemctl restart primearc-core-validator 2>/dev/null || systemctl restart primearc-core-node

    echo "✅ Node restarted - will resync from correct network"
    sleep 5

    echo "Current status:"
    journalctl -u primearc-core-validator -n 20 --no-pager 2>/dev/null || journalctl -u primearc-core-node -n 20 --no-pager
ENDSSH

  echo ""
  echo "✅ Gizzi's node has been reset and is resyncing"
  echo ""
  echo "Monitor progress with:"
  echo "  ssh root@$GIZZI_IP 'journalctl -u primearc-core-validator -f'"
fi

echo "═══════════════════════════════════════════════════════════"
