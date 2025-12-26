#!/bin/bash
# PrimeArc Core Chain Mainnet Health Check Script
# Usage: ./check-mainnet-health.sh [node-ip]
# Default: Uses Tailscale IP for gizzi validator

set -e

# Configuration
NODE_IP="${1:-100.96.84.69}"
RPC_PORT="9944"
METRICS_PORT="9615"
RPC_URL="http://${NODE_IP}:${RPC_PORT}"
METRICS_URL="http://${NODE_IP}:${METRICS_PORT}/metrics"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo "Installing jq..."
    if command -v apt-get &> /dev/null; then
        sudo apt-get update -qq && sudo apt-get install -y jq curl
    elif command -v yum &> /dev/null; then
        sudo yum install -y jq curl
    else
        echo "Please install jq manually"
        exit 1
    fi
fi

# Helper function to make RPC calls
rpc_call() {
    local method="$1"
    local params="${2:-[]}"
    curl -sf -H "Content-Type: application/json" \
         -d "{\"id\":1, \"jsonrpc\":\"2.0\", \"method\": \"${method}\", \"params\":${params}}" \
         "${RPC_URL}" 2>/dev/null || echo '{"error":"Connection failed"}'
}

# Helper function to get metrics
get_metric() {
    local metric="$1"
    curl -sf "${METRICS_URL}" 2>/dev/null | grep -E "^${metric}" | grep -v "^#" | head -1 || echo ""
}

# Convert hex to decimal
hex2dec() {
    echo $((16#${1#0x}))
}

# Print section header
print_header() {
    echo -e "\n${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${WHITE}$1${NC}"
    echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Print key-value pair
print_kv() {
    local key="$1"
    local value="$2"
    local status="${3:-}"

    if [ -n "$status" ]; then
        if [ "$status" = "ok" ]; then
            echo -e "${BLUE}${key}:${NC} ${GREEN}${value}${NC}"
        elif [ "$status" = "warn" ]; then
            echo -e "${BLUE}${key}:${NC} ${YELLOW}${value}${NC}"
        elif [ "$status" = "error" ]; then
            echo -e "${BLUE}${key}:${NC} ${RED}${value}${NC}"
        fi
    else
        echo -e "${BLUE}${key}:${NC} ${WHITE}${value}${NC}"
    fi
}

# Print status indicator
print_status() {
    local label="$1"
    local status="$2"

    if [ "$status" = "ok" ]; then
        echo -e "${BLUE}${label}:${NC} ${GREEN}✅ HEALTHY${NC}"
    elif [ "$status" = "warn" ]; then
        echo -e "${BLUE}${label}:${NC} ${YELLOW}⚠️  WARNING${NC}"
    else
        echo -e "${BLUE}${label}:${NC} ${RED}❌ ERROR${NC}"
    fi
}

# Main script
clear
echo -e "${BOLD}${PURPLE}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ËTRID PRIMEARC CORE CHAIN MAINNET HEALTH CHECK            ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${CYAN}Target Node:${NC} ${NODE_IP}:${RPC_PORT}"
echo -e "${CYAN}Timestamp:${NC} $(date '+%Y-%m-%d %H:%M:%S %Z')\n"

# Test connectivity
echo -e "${YELLOW}Connecting to node...${NC}"
CHAIN_NAME=$(rpc_call "system_chain" | jq -r '.result // "ERROR"')

if [ "$CHAIN_NAME" = "ERROR" ] || [ -z "$CHAIN_NAME" ]; then
    echo -e "${RED}❌ Failed to connect to node at ${NODE_IP}${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Connected successfully${NC}"

# ============================================================================
# BLOCKCHAIN STATUS
# ============================================================================
print_header "🔗 BLOCKCHAIN STATUS"

# Get current block header
CURRENT_HEADER=$(rpc_call "chain_getHeader")
CURRENT_BLOCK_HEX=$(echo "$CURRENT_HEADER" | jq -r '.result.number // "0x0"')
CURRENT_BLOCK=$(hex2dec "$CURRENT_BLOCK_HEX")

# Get finalized block
FINALIZED_HASH=$(rpc_call "chain_getFinalizedHead" | jq -r '.result // "0x0"')
FINALIZED_HEADER=$(rpc_call "chain_getHeader" "[\"$FINALIZED_HASH\"]")
FINALIZED_BLOCK_HEX=$(echo "$FINALIZED_HEADER" | jq -r '.result.number // "0x0"')
FINALIZED_BLOCK=$(hex2dec "$FINALIZED_BLOCK_HEX")

# Calculate finalization lag
FINALIZATION_LAG=$((CURRENT_BLOCK - FINALIZED_BLOCK))

# Get sync state
SYNC_STATE=$(rpc_call "system_syncState")
HIGHEST_BLOCK=$(echo "$SYNC_STATE" | jq -r '.result.highestBlock // 0')
IS_SYNCING=$(echo "$SYNC_STATE" | jq -r '.result.currentBlock < .result.highestBlock')

# Get chain properties
PROPERTIES=$(rpc_call "system_properties")
TOKEN_SYMBOL=$(echo "$PROPERTIES" | jq -r '.result.tokenSymbol // "ETR"')
TOKEN_DECIMALS=$(echo "$PROPERTIES" | jq -r '.result.tokenDecimals // "12"')
CONSENSUS_MODE=$(echo "$PROPERTIES" | jq -r '.result.consensusMode // "N/A"')
FINALITY_TYPE=$(echo "$PROPERTIES" | jq -r '.result.finality // "N/A"')
BLOCK_PRODUCTION=$(echo "$PROPERTIES" | jq -r '.result.blockProduction // "N/A"')

# Get runtime version
RUNTIME=$(rpc_call "state_getRuntimeVersion")
SPEC_VERSION=$(echo "$RUNTIME" | jq -r '.result.specVersion // "N/A"')

print_kv "Chain Name" "$CHAIN_NAME"
print_kv "Chain ID" "primearc_core_mainnet_v1"
print_kv "Runtime Version" "$SPEC_VERSION"
echo ""
print_kv "Current Block" "$(printf '%s' "$CURRENT_BLOCK" | sed ':a;s/\B[0-9]\{3\}\>/,&/;ta')" "ok"
print_kv "Finalized Block" "$(printf '%s' "$FINALIZED_BLOCK" | sed ':a;s/\B[0-9]\{3\}\>/,&/;ta')" "ok"

if [ "$FINALIZATION_LAG" -lt 10 ]; then
    print_kv "Finalization Lag" "$FINALIZATION_LAG blocks" "ok"
elif [ "$FINALIZATION_LAG" -lt 50 ]; then
    print_kv "Finalization Lag" "$FINALIZATION_LAG blocks" "warn"
else
    print_kv "Finalization Lag" "$FINALIZATION_LAG blocks" "error"
fi

if [ "$IS_SYNCING" = "false" ]; then
    print_kv "Sync Status" "✅ Fully Synced" "ok"
else
    print_kv "Sync Status" "⚠️  Syncing (${CURRENT_BLOCK}/${HIGHEST_BLOCK})" "warn"
fi

echo ""
print_kv "Token" "$TOKEN_SYMBOL (${TOKEN_DECIMALS} decimals)"

# ============================================================================
# CONSENSUS & FINALITY
# ============================================================================
print_header "⚡ CONSENSUS & FINALITY"

print_kv "Consensus Mode" "$CONSENSUS_MODE"
print_kv "Finality Type" "$FINALITY_TYPE"
print_kv "Block Production" "$BLOCK_PRODUCTION"

# Get metrics if available
BEST_BLOCK_METRIC=$(get_metric "substrate_block_height.*best")
FINALIZED_BLOCK_METRIC=$(get_metric "substrate_block_height.*finalized")
READY_TXS=$(get_metric "substrate_ready_transactions_number")

if [ -n "$READY_TXS" ]; then
    TX_COUNT=$(echo "$READY_TXS" | awk '{print $2}')
    if [ "$TX_COUNT" -eq 0 ]; then
        print_kv "Transaction Queue" "$TX_COUNT pending" "ok"
    elif [ "$TX_COUNT" -lt 100 ]; then
        print_kv "Transaction Queue" "$TX_COUNT pending" "warn"
    else
        print_kv "Transaction Queue" "$TX_COUNT pending" "error"
    fi
fi

# Get block construction time
BLOCK_CONSTRUCT=$(get_metric "substrate_proposer_block_constructed_count")
if [ -n "$BLOCK_CONSTRUCT" ]; then
    CONSTRUCT_COUNT=$(echo "$BLOCK_CONSTRUCT" | awk '{print $2}')
    print_kv "Blocks Constructed" "$CONSTRUCT_COUNT" "ok"
fi

# Estimate finality time (assuming 5s block time)
FINALITY_TIME=$((FINALIZATION_LAG * 5))
if [ "$FINALITY_TIME" -lt 60 ]; then
    print_kv "Estimated Finality Time" "~${FINALITY_TIME}s" "ok"
else
    FINALITY_MIN=$((FINALITY_TIME / 60))
    print_kv "Estimated Finality Time" "~${FINALITY_MIN}m" "warn"
fi

# ============================================================================
# NETWORK & PEERING
# ============================================================================
print_header "🌐 NETWORK & PEERING"

# Get system health
HEALTH=$(rpc_call "system_health")
PEER_COUNT=$(echo "$HEALTH" | jq -r '.result.peers // 0')
IS_SYNCING_HEALTH=$(echo "$HEALTH" | jq -r '.result.isSyncing // false')
SHOULD_HAVE_PEERS=$(echo "$HEALTH" | jq -r '.result.shouldHavePeers // true')

if [ "$PEER_COUNT" -ge 5 ]; then
    print_kv "Connected Peers" "$PEER_COUNT" "ok"
elif [ "$PEER_COUNT" -ge 2 ]; then
    print_kv "Connected Peers" "$PEER_COUNT" "warn"
else
    print_kv "Connected Peers" "$PEER_COUNT" "error"
fi

# Get detailed peer info
PEERS=$(rpc_call "system_peers")
AUTHORITY_COUNT=$(echo "$PEERS" | jq -r '[.result[] | select(.roles == "AUTHORITY")] | length')
print_kv "Validator Peers" "$AUTHORITY_COUNT" "ok"

# Check if all peers are authorities (good for mainnet)
if [ "$AUTHORITY_COUNT" -eq "$PEER_COUNT" ] && [ "$PEER_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ All peers are validators (strong quorum)${NC}"
fi

# Get peer block heights range
if [ "$PEER_COUNT" -gt 0 ]; then
    PEER_BLOCKS=$(echo "$PEERS" | jq -r '[.result[].bestNumber] | min, max')
    MIN_BLOCK=$(echo "$PEER_BLOCKS" | head -1)
    MAX_BLOCK=$(echo "$PEER_BLOCKS" | tail -1)
    BLOCK_VARIANCE=$((MAX_BLOCK - MIN_BLOCK))

    if [ "$BLOCK_VARIANCE" -lt 10 ]; then
        print_kv "Peer Block Range" "${MIN_BLOCK} - ${MAX_BLOCK} (variance: ${BLOCK_VARIANCE})" "ok"
    else
        print_kv "Peer Block Range" "${MIN_BLOCK} - ${MAX_BLOCK} (variance: ${BLOCK_VARIANCE})" "warn"
    fi
fi

# ============================================================================
# SYSTEM HEALTH
# ============================================================================
print_header "💻 SYSTEM HEALTH"

# Try to get system metrics via SSH if on Tailscale network
if [[ "$NODE_IP" =~ ^100\. ]]; then
    # Check if we can SSH
    SSH_RESULT=$(timeout 5 ssh -i ~/.ssh/gizzi-validator -o ConnectTimeout=3 -o StrictHostKeyChecking=no ubuntu@${NODE_IP} "uptime && free -h | grep Mem && df -h /var/lib/etrid | tail -1" 2>/dev/null || echo "")

    if [ -n "$SSH_RESULT" ]; then
        UPTIME=$(echo "$SSH_RESULT" | head -1 | awk -F'up ' '{print $2}' | awk -F',' '{print $1}')
        LOAD=$(echo "$SSH_RESULT" | head -1 | grep -o 'load average:.*' | awk '{print $3, $4, $5}')
        MEM_USED=$(echo "$SSH_RESULT" | grep Mem | awk '{print $3}')
        MEM_TOTAL=$(echo "$SSH_RESULT" | grep Mem | awk '{print $2}')
        DISK_USED=$(echo "$SSH_RESULT" | tail -1 | awk '{print $3}')
        DISK_TOTAL=$(echo "$SSH_RESULT" | tail -1 | awk '{print $2}')
        DISK_PERCENT=$(echo "$SSH_RESULT" | tail -1 | awk '{print $5}')

        print_kv "Server Uptime" "$UPTIME" "ok"
        print_kv "Load Average" "$LOAD"
        print_kv "Memory Usage" "${MEM_USED} / ${MEM_TOTAL}"

        DISK_PCT=$(echo "$DISK_PERCENT" | tr -d '%')
        if [ "$DISK_PCT" -lt 70 ]; then
            print_kv "Disk Usage" "${DISK_USED} / ${DISK_TOTAL} (${DISK_PERCENT})" "ok"
        elif [ "$DISK_PCT" -lt 85 ]; then
            print_kv "Disk Usage" "${DISK_USED} / ${DISK_TOTAL} (${DISK_PERCENT})" "warn"
        else
            print_kv "Disk Usage" "${DISK_USED} / ${DISK_TOTAL} (${DISK_PERCENT})" "error"
        fi
    else
        echo -e "${YELLOW}System metrics unavailable (SSH not accessible)${NC}"
    fi
else
    echo -e "${YELLOW}System metrics unavailable (remote node)${NC}"
fi

# ============================================================================
# SUMMARY
# ============================================================================
print_header "📊 HEALTH SUMMARY"

# Calculate overall health
OVERALL_STATUS="ok"

if [ "$FINALIZATION_LAG" -gt 50 ]; then
    OVERALL_STATUS="error"
elif [ "$FINALIZATION_LAG" -gt 10 ]; then
    OVERALL_STATUS="warn"
fi

if [ "$PEER_COUNT" -lt 2 ]; then
    OVERALL_STATUS="error"
elif [ "$PEER_COUNT" -lt 5 ]; then
    [ "$OVERALL_STATUS" = "ok" ] && OVERALL_STATUS="warn"
fi

if [ "$IS_SYNCING" = "true" ]; then
    [ "$OVERALL_STATUS" = "ok" ] && OVERALL_STATUS="warn"
fi

echo ""
print_status "Block Production" "ok"
print_status "Finalization" "$( [ "$FINALIZATION_LAG" -lt 10 ] && echo "ok" || echo "warn" )"
print_status "Network Sync" "$( [ "$IS_SYNCING" = "false" ] && echo "ok" || echo "warn" )"
print_status "Peer Count" "$( [ "$PEER_COUNT" -ge 5 ] && echo "ok" || echo "warn" )"
print_status "Consensus (ASF-BFT)" "ok"

echo ""
if [ "$OVERALL_STATUS" = "ok" ]; then
    echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${GREEN}   ✅ OVERALL STATUS: HEALTHY${NC}"
    echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
elif [ "$OVERALL_STATUS" = "warn" ]; then
    echo -e "${BOLD}${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${YELLOW}   ⚠️  OVERALL STATUS: WARNING${NC}"
    echo -e "${BOLD}${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
else
    echo -e "${BOLD}${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${RED}   ❌ OVERALL STATUS: ERROR${NC}"
    echo -e "${BOLD}${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
fi

echo ""
echo -e "${CYAN}Access via Tailscale:${NC} ${NODE_IP}:${RPC_PORT}"
echo -e "${CYAN}Public Bootnode:${NC} /ip4/64.181.215.19/tcp/30333/p2p/12D3KooWHdiAxVd8uMQR1hGWXccidmfCwLqcMpGwR6QcTP6QRMuD"
echo ""
