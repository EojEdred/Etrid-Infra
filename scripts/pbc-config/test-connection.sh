#!/bin/bash

# Test connectivity to all PBC nodes
# Usage: ./test-connection.sh [config-file]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${1:-$SCRIPT_DIR/config.json}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   PBC Nodes Connectivity Test${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check dependencies
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is not installed${NC}"
    exit 1
fi

if ! command -v curl &> /dev/null; then
    echo -e "${RED}Error: curl is not installed${NC}"
    exit 1
fi

# Validate config file
if [[ ! -f "$CONFIG_FILE" ]]; then
    echo -e "${RED}Error: Config file not found: $CONFIG_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}Using config file: $CONFIG_FILE${NC}"
echo ""

# Test function
test_endpoint() {
    local chain=$1
    local endpoint=$2

    # Convert ws:// to http:// for testing
    local http_endpoint="${endpoint/ws:/http:}"
    http_endpoint="${http_endpoint/wss:/https:}"

    # Test 1: Basic connectivity
    if curl -s --max-time 5 "$http_endpoint" >/dev/null 2>&1; then
        echo -ne "${GREEN}[REACHABLE]${NC} "
    else
        echo -ne "${RED}[OFFLINE]  ${NC} "
        return 1
    fi

    # Test 2: RPC health check
    local health_response=$(curl -s --max-time 5 -X POST \
        -H "Content-Type: application/json" \
        -d '{"id":1,"jsonrpc":"2.0","method":"system_health","params":[]}' \
        "$http_endpoint" 2>/dev/null)

    if echo "$health_response" | jq -e '.result' >/dev/null 2>&1; then
        local is_syncing=$(echo "$health_response" | jq -r '.result.isSyncing // "unknown"')
        local peers=$(echo "$health_response" | jq -r '.result.peers // 0')

        if [[ "$is_syncing" == "false" ]]; then
            echo -ne "${GREEN}[SYNCED]${NC} "
        elif [[ "$is_syncing" == "true" ]]; then
            echo -ne "${YELLOW}[SYNCING]${NC} "
        else
            echo -ne "${YELLOW}[UNKNOWN]${NC} "
        fi

        echo -ne "Peers: $peers "
    else
        echo -ne "${YELLOW}[NO RPC] ${NC} "
    fi

    # Test 3: Get chain name
    local chain_response=$(curl -s --max-time 5 -X POST \
        -H "Content-Type: application/json" \
        -d '{"id":1,"jsonrpc":"2.0","method":"system_chain","params":[]}' \
        "$http_endpoint" 2>/dev/null)

    if echo "$chain_response" | jq -e '.result' >/dev/null 2>&1; then
        local chain_name=$(echo "$chain_response" | jq -r '.result')
        echo "Chain: $chain_name"
    else
        echo ""
    fi
}

# Test FlareChain
echo -e "${BLUE}FlareChain:${NC}"
flare_endpoint=$(jq -r '.flarechain.endpoint' "$CONFIG_FILE")
test_endpoint "flarechain" "$flare_endpoint"
echo ""

# Test all PBC chains
echo -e "${BLUE}PBC Chains:${NC}"

chains=$(jq -r '.chains | keys[]' "$CONFIG_FILE")

total=0
reachable=0

for chain in $chains; do
    total=$((total + 1))
    endpoint=$(jq -r ".chains.$chain.pbc_endpoint" "$CONFIG_FILE")

    echo -n "$(printf '%-10s' "$chain"): "

    if test_endpoint "$chain" "$endpoint"; then
        reachable=$((reachable + 1))
    fi
done

# Summary
echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   Summary${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo "Total chains: $total"
echo -e "${GREEN}Reachable: $reachable${NC}"
echo -e "${RED}Offline: $((total - reachable))${NC}"
echo ""

if [[ $reachable -eq $total ]]; then
    echo -e "${GREEN}All chains are reachable!${NC}"
    exit 0
else
    echo -e "${YELLOW}Some chains are not reachable. Check configuration and network.${NC}"
    exit 1
fi
