#!/bin/bash
#
# FlareChain Validator Monitor
# Usage: monitor-validator [validator-number|all|quick]
# Examples:
#   monitor-validator 1          # Check ts-val-01
#   monitor-validator quick      # Check all validators (summary)
#   monitor-validator all        # Check all validators (detailed)
#   monitor-validator            # Interactive mode

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Thresholds
CRITICAL_LAG=1000
WARNING_LAG=100
MIN_PEERS=3

# Validator configurations
declare -A VALIDATOR_IPS
declare -A VALIDATOR_USERS
declare -A VALIDATOR_KEYS
declare -A VALIDATOR_NAMES

# Oracle Cloud validators (gizzi-validator key)
VALIDATOR_IPS[1]="100.96.84.69"
VALIDATOR_USERS[1]="ubuntu"
VALIDATOR_KEYS[1]="$HOME/.ssh/gizzi-validator"
VALIDATOR_NAMES[1]="gizzi-io-validator"

VALIDATOR_IPS[2]="100.70.242.106"
VALIDATOR_USERS[2]="ubuntu"
VALIDATOR_KEYS[2]="$HOME/.ssh/gizzi-validator"
VALIDATOR_NAMES[2]="auditdev"

# Contabo validators (contabo-validators key)
for i in {3..22}; do
    VALIDATOR_USERS[$i]="root"
    VALIDATOR_KEYS[$i]="$HOME/.ssh/contabo-validators"
done

# Contabo IPs
VALIDATOR_IPS[3]="100.102.128.51"
VALIDATOR_NAMES[3]="vmi2897384"

VALIDATOR_IPS[4]="100.71.242.104"
VALIDATOR_NAMES[4]="vmi2897383"

VALIDATOR_IPS[5]="100.74.84.28"
VALIDATOR_NAMES[5]="vmi2897382"

VALIDATOR_IPS[6]="100.89.102.75"
VALIDATOR_NAMES[6]="vmi2897381"

VALIDATOR_IPS[7]="100.95.0.72"
VALIDATOR_NAMES[7]="vmi2896918"

VALIDATOR_IPS[8]="100.86.111.37"
VALIDATOR_NAMES[8]="vmi2896917"

VALIDATOR_IPS[9]="100.125.147.88"
VALIDATOR_NAMES[9]="vmi2896916"

VALIDATOR_IPS[10]="100.80.84.82"
VALIDATOR_NAMES[10]="vmi2896915"

VALIDATOR_IPS[11]="100.109.252.56"
VALIDATOR_NAMES[11]="vmi2896914"

VALIDATOR_IPS[12]="100.117.43.53"
VALIDATOR_NAMES[12]="vmi2896911"

VALIDATOR_IPS[13]="100.88.104.58"
VALIDATOR_NAMES[13]="vmi2896910"

VALIDATOR_IPS[14]="100.70.73.10"
VALIDATOR_NAMES[14]="vmi2896909"

VALIDATOR_IPS[15]="100.68.185.50"
VALIDATOR_NAMES[15]="vmi2896908"

VALIDATOR_IPS[16]="100.71.127.127"
VALIDATOR_NAMES[16]="vmi2896907"

VALIDATOR_IPS[17]="100.93.43.18"
VALIDATOR_NAMES[17]="vmi2896906"

VALIDATOR_IPS[18]="100.124.117.73"
VALIDATOR_NAMES[18]="vmi2896925"

VALIDATOR_IPS[19]="100.74.204.23"
VALIDATOR_NAMES[19]="vmi2896924"

VALIDATOR_IPS[20]="100.125.251.60"
VALIDATOR_NAMES[20]="vmi2896923"

VALIDATOR_IPS[21]="100.114.244.62"
VALIDATOR_NAMES[21]="vmi2896922"

VALIDATOR_IPS[22]="100.113.226.111"
VALIDATOR_NAMES[22]="vmi2896921"

# Function to check single validator
check_validator() {
    local num=$1
    local ip=${VALIDATOR_IPS[$num]}
    local user=${VALIDATOR_USERS[$num]}
    local key=${VALIDATOR_KEYS[$num]}
    local name=${VALIDATOR_NAMES[$num]}

    # Get stats from validator
    local result=$(ssh -o "StrictHostKeyChecking=no" -o "ConnectTimeout=5" -i "$key" "$user@$ip" 'bash -s' 2>/dev/null <<'REMOTE'
latest_response=$(curl -s -m 5 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"chain_getHeader","params":[],"id":1}' http://localhost:9944 2>/dev/null)
latest_hex=$(echo "$latest_response" | jq -r '.result.number' 2>/dev/null)

finalized_hash_response=$(curl -s -m 5 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"chain_getFinalizedHead","params":[],"id":1}' http://localhost:9944 2>/dev/null)
finalized_hash=$(echo "$finalized_hash_response" | jq -r '.result' 2>/dev/null)
finalized_response=$(curl -s -m 5 -H "Content-Type: application/json" -d "{\"jsonrpc\":\"2.0\",\"method\":\"chain_getHeader\",\"params\":[\"$finalized_hash\"],\"id\":1}" http://localhost:9944 2>/dev/null)
finalized_hex=$(echo "$finalized_response" | jq -r '.result.number' 2>/dev/null)

health_response=$(curl -s -m 5 -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"system_health","params":[],"id":1}' http://localhost:9944 2>/dev/null)
peers=$(echo "$health_response" | jq -r '.result.peers' 2>/dev/null)
is_syncing=$(echo "$health_response" | jq -r '.result.isSyncing' 2>/dev/null)

if [ -n "$latest_hex" ] && [ -n "$finalized_hex" ] && [ "$latest_hex" != "null" ] && [ "$finalized_hex" != "null" ]; then
    lag=$((latest_hex - finalized_hex))
    echo "$latest_hex|$finalized_hex|$lag|$peers|$is_syncing"
else
    echo "ERROR|ERROR|ERROR|ERROR|ERROR"
fi
REMOTE
)

    if [ $? -ne 0 ] || [ -z "$result" ]; then
        echo "ERROR||||"
        return 1
    fi

    echo "$result"
}

# Function to display validator status (detailed)
display_validator_detailed() {
    local num=$1
    local result=$2
    local name=${VALIDATOR_NAMES[$num]}
    local ip=${VALIDATOR_IPS[$num]}

    IFS='|' read -r latest finalized lag peers is_syncing <<< "$result"

    printf "${BOLD}ts-val-%02d${NC} (%s - %s)\n" "$num" "$name" "$ip"

    if [ "$latest" = "ERROR" ]; then
        printf "  ${RED}✗ OFFLINE or UNREACHABLE${NC}\n"
        return
    fi

    printf "  Latest Block:    ${BLUE}%s${NC}\n" "$latest"
    printf "  Finalized Block: ${BLUE}%s${NC}\n" "$finalized"

    # Lag status
    if [ "$lag" -lt "$WARNING_LAG" ]; then
        printf "  Finalization Lag: ${GREEN}%s blocks ✓${NC}\n" "$lag"
    elif [ "$lag" -lt "$CRITICAL_LAG" ]; then
        printf "  Finalization Lag: ${YELLOW}%s blocks ⚠${NC}\n" "$lag"
    else
        printf "  Finalization Lag: ${RED}%s blocks ✗${NC}\n" "$lag"
    fi

    # Peers status
    if [ "$peers" -ge "$MIN_PEERS" ]; then
        printf "  Peers:           ${GREEN}%s ✓${NC}\n" "$peers"
    else
        printf "  Peers:           ${RED}%s ✗${NC}\n" "$peers"
    fi

    # Sync status
    if [ "$is_syncing" = "false" ]; then
        printf "  Syncing:         ${GREEN}No (synced) ✓${NC}\n"
    else
        printf "  Syncing:         ${YELLOW}Yes ⚠${NC}\n"
    fi

    # Overall status
    if [ "$lag" -lt "$WARNING_LAG" ] && [ "$peers" -ge "$MIN_PEERS" ] && [ "$is_syncing" = "false" ]; then
        printf "  Status:          ${GREEN}✓ HEALTHY${NC}\n"
    elif [ "$lag" -ge "$CRITICAL_LAG" ]; then
        printf "  Status:          ${RED}✗ CRITICAL${NC}\n"
    else
        printf "  Status:          ${YELLOW}⚠ WARNING${NC}\n"
    fi

    echo ""
}

# Function to display validator status (quick summary)
display_validator_quick() {
    local num=$1
    local result=$2
    local name=${VALIDATOR_NAMES[$num]}

    IFS='|' read -r latest finalized lag peers is_syncing <<< "$result"

    if [ "$latest" = "ERROR" ]; then
        printf "${RED}ts-val-%02d %-16s OFFLINE${NC}\n" "$num" "$name"
        return
    fi

    # Determine status
    local status_icon=""
    local status_color=""

    if [ "$lag" -lt "$WARNING_LAG" ] && [ "$peers" -ge "$MIN_PEERS" ] && [ "$is_syncing" = "false" ]; then
        status_icon="✓"
        status_color="$GREEN"
    elif [ "$lag" -ge "$CRITICAL_LAG" ]; then
        status_icon="✗"
        status_color="$RED"
    else
        status_icon="⚠"
        status_color="$YELLOW"
    fi

    printf "${status_color}ts-val-%02d${NC} %-16s Block: %-8s Finalized: %-8s Lag: %-6s Peers: %-3s %s\n" \
        "$num" "$name" "$latest" "$finalized" "$lag" "$peers" "$status_icon"
}

# Main execution
MODE="${1:-interactive}"

case "$MODE" in
    all)
        echo -e "${BOLD}${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${BOLD}${BLUE}║        FlareChain Validator Monitor - All Nodes           ║${NC}"
        echo -e "${BOLD}${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
        echo ""

        for i in {1..22}; do
            result=$(check_validator $i)
            display_validator_detailed $i "$result"
        done
        ;;

    quick)
        echo -e "${BOLD}${BLUE}FlareChain Validators - Quick Status${NC}"
        echo -e "${BOLD}════════════════════════════════════════════════════════════${NC}"

        for i in {1..22}; do
            result=$(check_validator $i)
            display_validator_quick $i "$result"
        done

        echo ""
        echo -e "${GREEN}✓${NC} = Healthy  ${YELLOW}⚠${NC} = Warning  ${RED}✗${NC} = Critical"
        ;;

    [0-9]|[0-9][0-9])
        num=$1
        if [ "$num" -lt 1 ] || [ "$num" -gt 22 ]; then
            echo -e "${RED}Error: Validator number must be between 1 and 22${NC}"
            exit 1
        fi

        echo -e "${BOLD}${BLUE}Checking ts-val-$(printf "%02d" $num)...${NC}"
        echo ""

        result=$(check_validator $num)
        display_validator_detailed $num "$result"
        ;;

    interactive|*)
        echo -e "${BOLD}${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
        echo -e "${BOLD}${BLUE}║          FlareChain Validator Monitor (v1.0)              ║${NC}"
        echo -e "${BOLD}${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
        echo ""
        echo "Usage: monitor-validator [option]"
        echo ""
        echo "Options:"
        echo "  quick           - Quick summary of all 22 validators"
        echo "  all             - Detailed status of all 22 validators"
        echo "  1-22            - Check specific validator (e.g., '1' for ts-val-01)"
        echo "  interactive     - This menu"
        echo ""
        echo "Examples:"
        echo "  monitor-validator quick       # Quick check all"
        echo "  monitor-validator 1           # Check gizzi-validator"
        echo "  monitor-validator 6           # Check vmi2897381"
        echo ""

        read -p "Enter validator number (1-22) or 'quick': " choice

        if [ "$choice" = "quick" ]; then
            exec $0 quick
        elif [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le 22 ]; then
            exec $0 $choice
        else
            echo -e "${RED}Invalid choice${NC}"
            exit 1
        fi
        ;;
esac
