#!/usr/bin/env bash
# Multi-Node Mainnet Health Check with Quorum & Voting Info
# Scans all VMs on Tailscale network

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'
BOLD='\033[1m'

# All Tailscale VMs
ALL_VMS=(
    "100.96.84.69:gizzi-validator"
    "100.70.242.106:auditdev"
    "100.93.43.18:vmi2896906"
    "100.71.127.127:vmi2896907"
    "100.68.185.50:vmi2896908"
    "100.70.73.10:vmi2896909"
    "100.88.104.58:vmi2896910"
    "100.117.43.53:vmi2896911"
    "100.109.252.56:vmi2896914"
    "100.80.84.82:vmi2896915"
    "100.125.147.88:vmi2896916"
    "100.86.111.37:vmi2896917"
    "100.95.0.72:vmi2896918"
    "100.113.226.111:vmi2896921"
    "100.114.244.62:vmi2896922"
    "100.125.251.60:vmi2896923"
    "100.74.204.23:vmi2896924"
    "100.124.117.73:vmi2896925"
    "100.89.102.75:vmi2897381"
    "100.74.84.28:vmi2897382"
    "100.71.242.104:vmi2897383"
    "100.102.128.51:vmi2897384"
)

RPC_PORT="9944"
BOOTNODE_IP="100.80.84.82"  # ts-val-10 has best connectivity (21 peers)

# Helper functions
rpc_call() {
    local ip="$1"
    local method="$2"
    local params="${3:-[]}"
    curl -sf -m 3 -H "Content-Type: application/json" \
         -d "{\"id\":1, \"jsonrpc\":\"2.0\", \"method\": \"${method}\", \"params\":${params}}" \
         "http://${ip}:${RPC_PORT}" 2>/dev/null || echo '{"error":"timeout"}'
}

hex2dec() {
    echo $((16#${1#0x}))
}

print_header() {
    echo -e "\n${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${WHITE}$1${NC}"
    echo -e "${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# Main script
clear
echo -e "${BOLD}${PURPLE}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ËTRID MULTI-NODE MAINNET HEALTH CHECK                     ║
║   Quorum, Voting & Network Analysis                          ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

echo -e "${CYAN}Scanning ${#ALL_VMS[@]} VMs on Tailscale network...${NC}"
echo -e "${CYAN}Timestamp:${NC} $(date '+%Y-%m-%d %H:%M:%S %Z')\n"

# Scan all VMs for running nodes
declare -a ACTIVE_NODES
declare -A NODE_BLOCKS
declare -A NODE_FINALIZED
declare -A NODE_PEERS
declare -A NODE_SYNCING
declare -A NODE_ROLE

echo -e "${YELLOW}Probing all VMs for active nodes...${NC}"

for vm in "${ALL_VMS[@]}"; do
    ip="${vm%%:*}"
    name="${vm##*:}"

    # Quick check if node is running
    result=$(rpc_call "$ip" "system_chain")

    if echo "$result" | grep -q "\"result\""; then
        ACTIVE_NODES+=("$ip:$name")

        # Get block height
        header=$(rpc_call "$ip" "chain_getHeader")
        block_hex=$(echo "$header" | jq -r '.result.number // "0x0"')
        NODE_BLOCKS[$ip]=$(hex2dec "$block_hex")

        # Get finalized block
        fin_hash=$(rpc_call "$ip" "chain_getFinalizedHead" | jq -r '.result // "0x0"')
        fin_header=$(rpc_call "$ip" "chain_getHeader" "[\"$fin_hash\"]")
        fin_hex=$(echo "$fin_header" | jq -r '.result.number // "0x0"')
        NODE_FINALIZED[$ip]=$(hex2dec "$fin_hex")

        # Get peer count and sync status
        health=$(rpc_call "$ip" "system_health")
        NODE_PEERS[$ip]=$(echo "$health" | jq -r '.result.peers // 0')
        NODE_SYNCING[$ip]=$(echo "$health" | jq -r '.result.isSyncing // "unknown"')

        # Check if validator (try to detect from process or peers)
        peers=$(rpc_call "$ip" "system_peers")
        if echo "$peers" | jq -e '.result[] | select(.roles == "AUTHORITY")' > /dev/null 2>&1; then
            NODE_ROLE[$ip]="VALIDATOR"
        else
            NODE_ROLE[$ip]="FULL_NODE"
        fi

        echo -e "  ${GREEN}✓${NC} $name ($ip) - Block: ${NODE_BLOCKS[$ip]}"
    fi
done

echo ""

# ============================================================================
# NODE SUMMARY TABLE
# ============================================================================
print_header "📡 ACTIVE NODES (${#ACTIVE_NODES[@]}/${#ALL_VMS[@]} VMs)"

if [ ${#ACTIVE_NODES[@]} -eq 0 ]; then
    echo -e "${RED}No active nodes found!${NC}"
    exit 1
fi

echo ""
printf "${BOLD}%-20s %-18s %-12s %-12s %-8s %-10s %-8s${NC}\n" \
    "NAME" "IP" "BLOCK" "FINALIZED" "LAG" "PEERS" "STATUS"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

for node in "${ACTIVE_NODES[@]}"; do
    ip="${node%%:*}"
    name="${node##*:}"

    block=${NODE_BLOCKS[$ip]}
    finalized=${NODE_FINALIZED[$ip]}
    lag=$((block - finalized))
    peers=${NODE_PEERS[$ip]}
    is_syncing=${NODE_SYNCING[$ip]}

    # Color code by lag
    if [ "$lag" -lt 10 ]; then
        lag_color="${GREEN}"
    elif [ "$lag" -lt 50 ]; then
        lag_color="${YELLOW}"
    else
        lag_color="${RED}"
    fi

    # Status
    if [ "$is_syncing" = "false" ]; then
        status="${GREEN}SYNCED${NC}"
    else
        status="${YELLOW}SYNCING${NC}"
    fi

    printf "%-20s %-18s ${GREEN}%-12s${NC} ${GREEN}%-12s${NC} ${lag_color}%-8s${NC} %-10s %s\n" \
        "$name" "$ip" \
        "$(printf '%s' "$block" | sed ':a;s/\B[0-9]\{3\}\>/,&/;ta')" \
        "$(printf '%s' "$finalized" | sed ':a;s/\B[0-9]\{3\}\>/,&/;ta')" \
        "$lag" "$peers" "$status"
done

# ============================================================================
# NETWORK QUORUM & PEERING
# ============================================================================
print_header "🌐 NETWORK QUORUM & PEERING"

# Get detailed peer info from bootnode
echo -e "\n${BOLD}Detailed Peer Analysis (from bootnode):${NC}\n"

PEERS_DATA=$(rpc_call "$BOOTNODE_IP" "system_peers")
TOTAL_PEERS=$(echo "$PEERS_DATA" | jq -r '.result | length')

echo -e "${BLUE}Total Connected Peers:${NC} ${GREEN}$TOTAL_PEERS${NC}"

# Count by role
AUTHORITY_COUNT=$(echo "$PEERS_DATA" | jq -r '[.result[] | select(.roles == "AUTHORITY")] | length')
FULL_NODE_COUNT=$(echo "$PEERS_DATA" | jq -r '[.result[] | select(.roles == "FULL")] | length')
LIGHT_COUNT=$(echo "$PEERS_DATA" | jq -r '[.result[] | select(.roles == "LIGHT")] | length')

echo -e "${BLUE}Authority/Validator Peers:${NC} ${GREEN}$AUTHORITY_COUNT${NC}"
echo -e "${BLUE}Full Node Peers:${NC} $FULL_NODE_COUNT"
echo -e "${BLUE}Light Client Peers:${NC} $LIGHT_COUNT"

# Peer block heights
echo -e "\n${BOLD}Peer Block Heights:${NC}"
echo "$PEERS_DATA" | jq -r '.result[] | "\(.roles): Block \(.bestNumber)"' | sort -t: -k2 -n | while read line; do
    echo -e "  ${CYAN}•${NC} $line"
done

# Calculate peer consensus
MIN_PEER_BLOCK=$(echo "$PEERS_DATA" | jq -r '[.result[].bestNumber] | min')
MAX_PEER_BLOCK=$(echo "$PEERS_DATA" | jq -r '[.result[].bestNumber] | max')
BLOCK_VARIANCE=$((MAX_PEER_BLOCK - MIN_PEER_BLOCK))

echo ""
if [ "$BLOCK_VARIANCE" -lt 10 ]; then
    echo -e "${GREEN}✅ Peer consensus: STRONG${NC} (variance: $BLOCK_VARIANCE blocks)"
elif [ "$BLOCK_VARIANCE" -lt 50 ]; then
    echo -e "${YELLOW}⚠️  Peer consensus: MODERATE${NC} (variance: $BLOCK_VARIANCE blocks)"
else
    echo -e "${RED}❌ Peer consensus: WEAK${NC} (variance: $BLOCK_VARIANCE blocks)"
fi

# ============================================================================
# VALIDATOR SET & SESSION INFO
# ============================================================================
print_header "👥 VALIDATOR SET & SESSION INFO"

# Try to get validator set
echo -e "\n${YELLOW}Querying validator set...${NC}\n"

# Try different APIs for validator info
VALIDATOR_INFO=$(rpc_call "$BOOTNODE_IP" "state_call" '["SessionApi_session_keys", "0x"]' 2>/dev/null)

# Get session info via storage
SESSION_VALIDATORS=$(rpc_call "$BOOTNODE_IP" "state_getStorage" '["0x26aa394eea5630e07c48ae0c9558cef7b99d880ec681799c0cf30e8886371da9"]' 2>/dev/null)

if echo "$SESSION_VALIDATORS" | grep -q "\"result\""; then
    echo -e "${BLUE}Session Validators:${NC} ${GREEN}Retrieved${NC}"
    # Decode if possible
    VAL_HEX=$(echo "$SESSION_VALIDATORS" | jq -r '.result // "0x"')
    echo -e "${BLUE}Validator Data (hex):${NC} ${VAL_HEX:0:66}..."
else
    echo -e "${YELLOW}Validator set: Using peer count as estimate${NC}"
    echo -e "${BLUE}Estimated Validators:${NC} $AUTHORITY_COUNT (from authority peers)"
fi

# Get current session/era if available
BLOCK_NUMBER=$(rpc_call "$BOOTNODE_IP" "chain_getHeader" | jq -r '.result.number')
echo -e "${BLUE}Current Block:${NC} $((16#${BLOCK_NUMBER#0x}))"

# ============================================================================
# ASF-BFT CONSENSUS & FINALITY
# ============================================================================
print_header "⚡ ASF-BFT CONSENSUS & FINALITY"

echo ""
echo -e "${BOLD}Consensus Mechanism: ${PURPLE}ASF-BFT${NC} (Asynchronous Stochastic Finality)"
echo -e "${BOLD}Block Production: ${PURPLE}PPFA${NC} (Pragmatic Probabilistic Finality Algorithm)"
echo ""

# Calculate network-wide finalization
HIGHEST_BLOCK=$(printf '%s\n' "${NODE_BLOCKS[@]}" | sort -n | tail -1)
HIGHEST_FINALIZED=$(printf '%s\n' "${NODE_FINALIZED[@]}" | sort -n | tail -1)
NETWORK_LAG=$((HIGHEST_BLOCK - HIGHEST_FINALIZED))

echo -e "${BLUE}Network Best Block:${NC} ${GREEN}$(printf '%s' "$HIGHEST_BLOCK" | sed ':a;s/\B[0-9]\{3\}\>/,&/;ta')${NC}"
echo -e "${BLUE}Network Finalized Block:${NC} ${GREEN}$(printf '%s' "$HIGHEST_FINALIZED" | sed ':a;s/\B[0-9]\{3\}\>/,&/;ta')${NC}"

if [ "$NETWORK_LAG" -lt 10 ]; then
    echo -e "${BLUE}Finalization Lag:${NC} ${GREEN}$NETWORK_LAG blocks ✅ HEALTHY${NC}"
elif [ "$NETWORK_LAG" -lt 50 ]; then
    echo -e "${BLUE}Finalization Lag:${NC} ${YELLOW}$NETWORK_LAG blocks ⚠️  MODERATE${NC}"
else
    echo -e "${BLUE}Finalization Lag:${NC} ${RED}$NETWORK_LAG blocks ❌ CRITICAL${NC}"
fi

# Estimate finality time (assuming 5s block time)
FINALITY_TIME=$((NETWORK_LAG * 5))
echo -e "${BLUE}Estimated Finality Time:${NC} ~${FINALITY_TIME}s"

# Calculate quorum (15/21 for mainnet - from genesis)
TOTAL_VALIDATORS=21
REQUIRED_QUORUM=15
ACTIVE_VALIDATORS=$AUTHORITY_COUNT
echo ""
echo -e "${BOLD}Quorum Analysis:${NC}"
echo -e "${BLUE}Total Validators (Genesis):${NC} $TOTAL_VALIDATORS"
echo -e "${BLUE}Active Validators (Connected):${NC} $ACTIVE_VALIDATORS"
echo -e "${BLUE}Required for Quorum (15/21):${NC} $REQUIRED_QUORUM"

if [ "$ACTIVE_VALIDATORS" -ge "$REQUIRED_QUORUM" ]; then
    echo -e "${GREEN}✅ Quorum: ACTIVE${NC} ($ACTIVE_VALIDATORS ≥ $REQUIRED_QUORUM)"
elif [ "$ACTIVE_VALIDATORS" -ge 8 ]; then
    echo -e "${YELLOW}⚠️  Quorum: PARTIAL${NC} ($ACTIVE_VALIDATORS/$TOTAL_VALIDATORS active, need $REQUIRED_QUORUM)"
else
    echo -e "${RED}❌ Quorum: FAILED${NC} ($ACTIVE_VALIDATORS < $REQUIRED_QUORUM)"
fi

# ============================================================================
# HEALTH SUMMARY
# ============================================================================
print_header "📊 OVERALL HEALTH SUMMARY"

echo ""
total_vms=${#ALL_VMS[@]}
active_nodes=${#ACTIVE_NODES[@]}
synced_nodes=0

for node in "${ACTIVE_NODES[@]}"; do
    ip="${node%%:*}"
    if [ "${NODE_SYNCING[$ip]}" = "false" ]; then
        ((synced_nodes++))
    fi
done

echo -e "${BLUE}Total VMs Monitored:${NC} $total_vms"
echo -e "${BLUE}Active Nodes:${NC} ${GREEN}$active_nodes${NC} ($(( active_nodes * 100 / total_vms ))%)"
echo -e "${BLUE}Fully Synced Nodes:${NC} ${GREEN}$synced_nodes${NC}"
echo -e "${BLUE}Total Network Peers:${NC} ${GREEN}$TOTAL_PEERS${NC}"
echo -e "${BLUE}Validator Peers:${NC} ${GREEN}$AUTHORITY_COUNT${NC}"

echo ""

# Overall status
if [ "$synced_nodes" -ge 1 ] && [ "$AUTHORITY_COUNT" -ge "$REQUIRED_QUORUM" ] && [ "$NETWORK_LAG" -lt 10 ]; then
    echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${GREEN}   ✅ MAINNET STATUS: HEALTHY${NC}"
    echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
elif [ "$synced_nodes" -ge 1 ] && [ "$AUTHORITY_COUNT" -ge "$REQUIRED_QUORUM" ]; then
    echo -e "${BOLD}${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${YELLOW}   ⚠️  MAINNET STATUS: WARNING${NC}"
    echo -e "${BOLD}${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
else
    echo -e "${BOLD}${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${RED}   ❌ MAINNET STATUS: CRITICAL${NC}"
    echo -e "${BOLD}${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
fi

echo ""
