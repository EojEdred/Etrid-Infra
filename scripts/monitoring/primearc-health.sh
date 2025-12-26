#!/bin/bash
#
# PrimeArc Core Chain - Comprehensive Health Monitor
# Full metrics, disk space, alerts for all validators
#
# Usage: primearc-health [validator|all|quick|alerts]
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
WHITE='\033[1;37m'
NC='\033[0m'
BOLD='\033[1m'

# Alert Thresholds
DISK_WARN=70
DISK_CRIT=85
MEM_WARN=80
MEM_CRIT=90
CPU_WARN=80
CPU_CRIT=95
BLOCK_LAG_WARN=10
BLOCK_LAG_CRIT=100
PEER_MIN=3
FINALITY_LAG_WARN=50

# PrimeArc Core Validators (Tailscale IPs)
declare -A VALIDATORS=(
    ["pa-val-01"]="100.102.128.51"
    ["pa-val-02"]="100.89.102.75"
    ["pa-val-03"]="100.80.84.82"
    ["pa-val-04"]="100.74.84.28"
    ["pa-val-05"]="100.71.242.104"
)

# RPC Ports
RPC_PORT=9944
WS_PORT=9944
P2P_PORT=30333

print_header() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════════════════╗"
    echo "║                   PRIMEARC CORE CHAIN - HEALTH MONITOR                   ║"
    echo "║                         $(date '+%Y-%m-%d %H:%M:%S %Z')                          ║"
    echo "╚══════════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

status_icon() {
    case $1 in
        ok)     echo -e "${GREEN}✓${NC}" ;;
        warn)   echo -e "${YELLOW}⚠${NC}" ;;
        crit)   echo -e "${RED}✗${NC}" ;;
        info)   echo -e "${BLUE}ℹ${NC}" ;;
    esac
}

# Get comprehensive metrics from a validator
get_validator_metrics() {
    local name=$1
    local ip=$2

    echo -e "\n${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${WHITE}  VALIDATOR: $name ($ip)${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Check if reachable
    if ! timeout 2 bash -c "echo >/dev/tcp/$ip/22" 2>/dev/null; then
        echo -e "  $(status_icon crit) ${RED}UNREACHABLE${NC}"
        return 1
    fi

    # Get all metrics via SSH
    ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 root@$ip bash << 'REMOTE_SCRIPT' 2>/dev/null
    # System Metrics
    echo "=== SYSTEM METRICS ==="

    # CPU
    cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 2>/dev/null || echo "N/A")
    load_avg=$(cat /proc/loadavg | awk '{print $1, $2, $3}')
    cpu_cores=$(nproc)
    echo "CPU_USAGE=$cpu_usage"
    echo "LOAD_AVG=$load_avg"
    echo "CPU_CORES=$cpu_cores"

    # Memory
    mem_info=$(free -m | grep Mem)
    mem_total=$(echo $mem_info | awk '{print $2}')
    mem_used=$(echo $mem_info | awk '{print $3}')
    mem_free=$(echo $mem_info | awk '{print $4}')
    mem_pct=$((mem_used * 100 / mem_total))
    swap_info=$(free -m | grep Swap)
    swap_total=$(echo $swap_info | awk '{print $2}')
    swap_used=$(echo $swap_info | awk '{print $3}')
    echo "MEM_TOTAL=$mem_total"
    echo "MEM_USED=$mem_used"
    echo "MEM_FREE=$mem_free"
    echo "MEM_PCT=$mem_pct"
    echo "SWAP_TOTAL=$swap_total"
    echo "SWAP_USED=$swap_used"

    # Disk - Root
    disk_info=$(df -h / | tail -1)
    disk_total=$(echo $disk_info | awk '{print $2}')
    disk_used=$(echo $disk_info | awk '{print $3}')
    disk_avail=$(echo $disk_info | awk '{print $4}')
    disk_pct=$(echo $disk_info | awk '{print $5}' | tr -d '%')
    echo "DISK_TOTAL=$disk_total"
    echo "DISK_USED=$disk_used"
    echo "DISK_AVAIL=$disk_avail"
    echo "DISK_PCT=$disk_pct"

    # Disk - Chain Data (check multiple locations)
    chain_size="N/A"
    for dir in /var/lib/primearc /var/lib/flarechain /root/.local/share/primearc /root/.local/share/flarechain; do
        if [ -d "$dir" ]; then
            chain_size=$(du -sh "$dir" 2>/dev/null | awk '{print $1}')
            break
        fi
    done
    echo "CHAIN_DATA_SIZE=$chain_size"

    # Network I/O
    if [ -f /proc/net/dev ]; then
        net_stats=$(cat /proc/net/dev | grep -E "eth0|ens" | head -1)
        rx_bytes=$(echo $net_stats | awk '{print $2}')
        tx_bytes=$(echo $net_stats | awk '{print $10}')
        rx_mb=$((rx_bytes / 1024 / 1024))
        tx_mb=$((tx_bytes / 1024 / 1024))
        echo "NET_RX_MB=$rx_mb"
        echo "NET_TX_MB=$tx_mb"
    fi

    # Uptime
    uptime_info=$(uptime -p 2>/dev/null || uptime | awk -F'up' '{print $2}' | awk -F',' '{print $1}')
    echo "UPTIME=$uptime_info"

    # Open file descriptors
    open_fds=$(ls /proc/self/fd 2>/dev/null | wc -l)
    max_fds=$(ulimit -n)
    echo "OPEN_FDS=$open_fds"
    echo "MAX_FDS=$max_fds"

    echo "=== PRIMEARC PROCESS ==="

    # PrimeArc process (check multiple names)
    primearc_pid=""
    for proc_name in "primearc" "flarechain" "polkadot" "substrate"; do
        primearc_pid=$(pgrep -f "$proc_name" | head -1 2>/dev/null || echo "")
        [ -n "$primearc_pid" ] && break
    done

    if [ -n "$primearc_pid" ]; then
        echo "PRIMEARC_RUNNING=true"
        echo "PRIMEARC_PID=$primearc_pid"

        # Process memory
        proc_mem=$(ps -o rss= -p $primearc_pid 2>/dev/null | awk '{print int($1/1024)}')
        echo "PRIMEARC_MEM_MB=$proc_mem"

        # Process CPU
        proc_cpu=$(ps -o %cpu= -p $primearc_pid 2>/dev/null)
        echo "PRIMEARC_CPU=$proc_cpu"

        # Process uptime
        proc_start=$(ps -o lstart= -p $primearc_pid 2>/dev/null)
        echo "PRIMEARC_START=$proc_start"

        # Open connections
        primearc_conns=$(ss -tnp | grep -c "$primearc_pid" 2>/dev/null || echo "0")
        echo "PRIMEARC_CONNECTIONS=$primearc_conns"
    else
        echo "PRIMEARC_RUNNING=false"
    fi

    echo "=== RPC METRICS ==="

    # Block height
    block_result=$(curl -s -X POST -H "Content-Type: application/json" \
        --data '{"jsonrpc":"2.0","method":"chain_getHeader","params":[],"id":1}' \
        http://127.0.0.1:9944 2>/dev/null || echo "")

    if [ -n "$block_result" ]; then
        block_hex=$(echo $block_result | grep -oP '"number":"0x\K[^"]+' || echo "0")
        block_num=$((16#$block_hex))
        echo "BLOCK_HEIGHT=$block_num"

        # Finalized block
        final_result=$(curl -s -X POST -H "Content-Type: application/json" \
            --data '{"jsonrpc":"2.0","method":"chain_getFinalizedHead","params":[],"id":1}' \
            http://127.0.0.1:9944 2>/dev/null || echo "")
        final_hash=$(echo $final_result | grep -oP '"result":"\K[^"]+' || echo "")

        if [ -n "$final_hash" ]; then
            final_header=$(curl -s -X POST -H "Content-Type: application/json" \
                --data "{\"jsonrpc\":\"2.0\",\"method\":\"chain_getHeader\",\"params\":[\"$final_hash\"],\"id\":1}" \
                http://127.0.0.1:9944 2>/dev/null || echo "")
            final_hex=$(echo $final_header | grep -oP '"number":"0x\K[^"]+' || echo "0")
            final_num=$((16#$final_hex))
            echo "FINALIZED_BLOCK=$final_num"
            echo "FINALITY_LAG=$((block_num - final_num))"
        fi

        # Peer count
        peers_result=$(curl -s -X POST -H "Content-Type: application/json" \
            --data '{"jsonrpc":"2.0","method":"system_health","params":[],"id":1}' \
            http://127.0.0.1:9944 2>/dev/null || echo "")
        peers=$(echo $peers_result | grep -oP '"peers":\K[0-9]+' || echo "0")
        syncing=$(echo $peers_result | grep -oP '"isSyncing":\K[a-z]+' || echo "unknown")
        echo "PEER_COUNT=$peers"
        echo "IS_SYNCING=$syncing"

        # Chain info
        chain_result=$(curl -s -X POST -H "Content-Type: application/json" \
            --data '{"jsonrpc":"2.0","method":"system_chain","params":[],"id":1}' \
            http://127.0.0.1:9944 2>/dev/null || echo "")
        chain_name=$(echo $chain_result | grep -oP '"result":"\K[^"]+' || echo "PrimeArc Core")
        echo "CHAIN_NAME=$chain_name"

        # Node name
        node_result=$(curl -s -X POST -H "Content-Type: application/json" \
            --data '{"jsonrpc":"2.0","method":"system_name","params":[],"id":1}' \
            http://127.0.0.1:9944 2>/dev/null || echo "")
        node_name=$(echo $node_result | grep -oP '"result":"\K[^"]+' || echo "unknown")
        echo "NODE_NAME=$node_name"

        # Version
        version_result=$(curl -s -X POST -H "Content-Type: application/json" \
            --data '{"jsonrpc":"2.0","method":"system_version","params":[],"id":1}' \
            http://127.0.0.1:9944 2>/dev/null || echo "")
        version=$(echo $version_result | grep -oP '"result":"\K[^"]+' || echo "unknown")
        echo "NODE_VERSION=$version"

        # Pending extrinsics
        pending_result=$(curl -s -X POST -H "Content-Type: application/json" \
            --data '{"jsonrpc":"2.0","method":"author_pendingExtrinsics","params":[],"id":1}' \
            http://127.0.0.1:9944 2>/dev/null || echo "")
        pending=$(echo $pending_result | grep -oP '\[.*\]' | tr -cd ',' | wc -c)
        pending=$((pending + 1))
        if echo "$pending_result" | grep -q '\[\]'; then pending=0; fi
        echo "PENDING_EXTRINSICS=$pending"

    else
        echo "RPC_AVAILABLE=false"
    fi

    echo "=== VALIDATOR STATUS ==="

    # Session keys
    session_result=$(curl -s -X POST -H "Content-Type: application/json" \
        --data '{"jsonrpc":"2.0","method":"author_hasSessionKeys","params":[""],"id":1}' \
        http://127.0.0.1:9944 2>/dev/null || echo "")
    if echo "$session_result" | grep -q '"result":true'; then
        echo "SESSION_KEYS=configured"
    else
        echo "SESSION_KEYS=not_configured"
    fi

    echo "=== END METRICS ==="

REMOTE_SCRIPT
}

# Parse and display metrics with alerts
display_metrics() {
    local name=$1
    local metrics=$2

    local alerts=()

    # Parse metrics
    eval $(echo "$metrics" | grep "=" | sed 's/^/local /')

    echo ""
    echo -e "${WHITE}  ┌─ SYSTEM RESOURCES ─────────────────────────────────────────────┐${NC}"

    # CPU
    if [ -n "$CPU_USAGE" ] && [ "$CPU_USAGE" != "N/A" ]; then
        cpu_int=${CPU_USAGE%.*}
        if [ "$cpu_int" -ge "$CPU_CRIT" ]; then
            echo -e "  │ $(status_icon crit) CPU: ${RED}${CPU_USAGE}%${NC} (CRITICAL > $CPU_CRIT%)"
            alerts+=("CPU Critical: ${CPU_USAGE}%")
        elif [ "$cpu_int" -ge "$CPU_WARN" ]; then
            echo -e "  │ $(status_icon warn) CPU: ${YELLOW}${CPU_USAGE}%${NC} (Warning > $CPU_WARN%)"
            alerts+=("CPU Warning: ${CPU_USAGE}%")
        else
            echo -e "  │ $(status_icon ok) CPU: ${GREEN}${CPU_USAGE}%${NC}"
        fi
    fi

    echo -e "  │   Load Avg: $LOAD_AVG (${CPU_CORES} cores)"

    # Memory
    if [ -n "$MEM_PCT" ]; then
        if [ "$MEM_PCT" -ge "$MEM_CRIT" ]; then
            echo -e "  │ $(status_icon crit) Memory: ${RED}${MEM_USED}MB / ${MEM_TOTAL}MB (${MEM_PCT}%)${NC} CRITICAL"
            alerts+=("Memory Critical: ${MEM_PCT}%")
        elif [ "$MEM_PCT" -ge "$MEM_WARN" ]; then
            echo -e "  │ $(status_icon warn) Memory: ${YELLOW}${MEM_USED}MB / ${MEM_TOTAL}MB (${MEM_PCT}%)${NC}"
            alerts+=("Memory Warning: ${MEM_PCT}%")
        else
            echo -e "  │ $(status_icon ok) Memory: ${GREEN}${MEM_USED}MB / ${MEM_TOTAL}MB (${MEM_PCT}%)${NC}"
        fi
    fi

    if [ -n "$SWAP_USED" ] && [ "$SWAP_USED" -gt 0 ]; then
        echo -e "  │   Swap: ${SWAP_USED}MB / ${SWAP_TOTAL}MB"
    fi

    # Disk
    if [ -n "$DISK_PCT" ]; then
        if [ "$DISK_PCT" -ge "$DISK_CRIT" ]; then
            echo -e "  │ $(status_icon crit) Disk: ${RED}${DISK_USED} / ${DISK_TOTAL} (${DISK_PCT}%)${NC} CRITICAL"
            alerts+=("Disk Critical: ${DISK_PCT}%")
        elif [ "$DISK_PCT" -ge "$DISK_WARN" ]; then
            echo -e "  │ $(status_icon warn) Disk: ${YELLOW}${DISK_USED} / ${DISK_TOTAL} (${DISK_PCT}%)${NC}"
            alerts+=("Disk Warning: ${DISK_PCT}%")
        else
            echo -e "  │ $(status_icon ok) Disk: ${GREEN}${DISK_USED} / ${DISK_TOTAL} (${DISK_PCT}%)${NC}"
        fi
    fi

    echo -e "  │   Chain Data: ${CHAIN_DATA_SIZE:-N/A}"
    echo -e "  │   Uptime: ${UPTIME:-N/A}"
    echo -e "  └──────────────────────────────────────────────────────────────────┘"

    echo -e "  ┌─ PRIMEARC PROCESS ──────────────────────────────────────────────┐"

    if [ "$PRIMEARC_RUNNING" = "true" ]; then
        echo -e "  │ $(status_icon ok) Process: ${GREEN}RUNNING${NC} (PID: $PRIMEARC_PID)"
        echo -e "  │   Memory: ${PRIMEARC_MEM_MB:-0}MB | CPU: ${PRIMEARC_CPU:-0}%"
        echo -e "  │   Started: ${PRIMEARC_START:-N/A}"
        echo -e "  │   Connections: ${PRIMEARC_CONNECTIONS:-0}"
    else
        echo -e "  │ $(status_icon crit) Process: ${RED}NOT RUNNING${NC}"
        alerts+=("PrimeArc process not running!")
    fi

    echo -e "  └──────────────────────────────────────────────────────────────────┘"

    echo -e "  ┌─ CHAIN STATUS ───────────────────────────────────────────────────┐"

    if [ -n "$BLOCK_HEIGHT" ]; then
        echo -e "  │ $(status_icon ok) Chain: ${CHAIN_NAME:-PrimeArc Core} v${NODE_VERSION:-unknown}"
        echo -e "  │   Best Block: ${GREEN}#${BLOCK_HEIGHT}${NC}"

        if [ -n "$FINALIZED_BLOCK" ]; then
            echo -e "  │   Finalized:  #${FINALIZED_BLOCK}"
            if [ -n "$FINALITY_LAG" ] && [ "$FINALITY_LAG" -ge "$FINALITY_LAG_WARN" ]; then
                echo -e "  │ $(status_icon warn) Finality Lag: ${YELLOW}${FINALITY_LAG} blocks${NC}"
                alerts+=("Finality lag: $FINALITY_LAG blocks")
            else
                echo -e "  │   Finality Lag: ${FINALITY_LAG:-0} blocks"
            fi
        fi

        # Peer count
        if [ -n "$PEER_COUNT" ]; then
            if [ "$PEER_COUNT" -lt "$PEER_MIN" ]; then
                echo -e "  │ $(status_icon crit) Peers: ${RED}${PEER_COUNT}${NC} (min: $PEER_MIN)"
                alerts+=("Low peers: $PEER_COUNT")
            else
                echo -e "  │ $(status_icon ok) Peers: ${GREEN}${PEER_COUNT}${NC}"
            fi
        fi

        # Syncing status
        if [ "$IS_SYNCING" = "true" ]; then
            echo -e "  │ $(status_icon warn) Status: ${YELLOW}SYNCING${NC}"
        else
            echo -e "  │ $(status_icon ok) Status: ${GREEN}SYNCED${NC}"
        fi

        echo -e "  │   Pending Txs: ${PENDING_EXTRINSICS:-0}"
    else
        echo -e "  │ $(status_icon crit) RPC: ${RED}NOT RESPONDING${NC}"
        alerts+=("RPC not responding")
    fi

    echo -e "  └──────────────────────────────────────────────────────────────────┘"

    # Display alerts
    if [ ${#alerts[@]} -gt 0 ]; then
        echo -e "  ┌─ ${RED}ALERTS${NC} ───────────────────────────────────────────────────────┐"
        for alert in "${alerts[@]}"; do
            echo -e "  │ ${RED}⚠ $alert${NC}"
        done
        echo -e "  └──────────────────────────────────────────────────────────────────┘"
    fi
}

# Quick summary of all validators
quick_summary() {
    echo -e "\n${WHITE}${BOLD}PRIMEARC CORE - VALIDATOR STATUS${NC}"
    echo "┌────────────┬─────────────────┬────────┬────────┬────────┬─────────┬───────┐"
    echo "│ Validator  │ IP              │ Status │ Block  │ Peers  │ Disk    │ Mem   │"
    echo "├────────────┼─────────────────┼────────┼────────┼────────┼─────────┼───────┤"

    for name in $(echo "${!VALIDATORS[@]}" | tr ' ' '\n' | sort); do
        ip=${VALIDATORS[$name]}

        # Quick check
        metrics=$(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=3 root@$ip bash << 'EOF' 2>/dev/null
disk_pct=$(df -h / | tail -1 | awk '{print $5}' | tr -d '%')
mem_pct=$(free | grep Mem | awk '{print int($3/$2*100)}')
block=$(curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"chain_getHeader","params":[],"id":1}' http://127.0.0.1:9944 2>/dev/null | grep -oP '"number":"0x\K[^"]+' || echo "0")
peers=$(curl -s -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"system_health","params":[],"id":1}' http://127.0.0.1:9944 2>/dev/null | grep -oP '"peers":\K[0-9]+' || echo "0")
running=$(pgrep -f "primearc\|flarechain\|polkadot" >/dev/null && echo "OK" || echo "DOWN")
echo "$running|$block|$peers|$disk_pct|$mem_pct"
EOF
)

        if [ -n "$metrics" ]; then
            IFS='|' read -r status block peers disk mem <<< "$metrics"
            block_dec=$((16#${block:-0}))

            # Color coding
            [ "$status" = "OK" ] && status_col="${GREEN}OK${NC}" || status_col="${RED}DOWN${NC}"
            [ "${disk:-0}" -ge 85 ] && disk_col="${RED}${disk}%${NC}" || disk_col="${GREEN}${disk}%${NC}"
            [ "${mem:-0}" -ge 90 ] && mem_col="${RED}${mem}%${NC}" || mem_col="${GREEN}${mem}%${NC}"

            printf "│ %-10s │ %-15s │ %-14s │ %-6s │ %-6s │ %-15s │ %-13s │\n" \
                "$name" "$ip" "$status_col" "$block_dec" "$peers" "$disk_col" "$mem_col"
        else
            printf "│ %-10s │ %-15s │ ${RED}%-6s${NC} │ %-6s │ %-6s │ %-7s │ %-5s │\n" \
                "$name" "$ip" "UNREACH" "-" "-" "-" "-"
        fi
    done

    echo "└────────────┴─────────────────┴────────┴────────┴────────┴─────────┴───────┘"
}

# Alert check only
alerts_only() {
    echo -e "\n${WHITE}${BOLD}PRIMEARC CORE - CHECKING FOR ALERTS...${NC}\n"

    local has_alerts=false

    for name in $(echo "${!VALIDATORS[@]}" | tr ' ' '\n' | sort); do
        ip=${VALIDATORS[$name]}

        alerts=$(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=3 root@$ip bash << 'EOF' 2>/dev/null
alerts=""
# Disk check
disk_pct=$(df -h / | tail -1 | awk '{print $5}' | tr -d '%')
[ "$disk_pct" -ge 85 ] && alerts="${alerts}DISK_CRITICAL:$disk_pct% "
[ "$disk_pct" -ge 70 ] && [ "$disk_pct" -lt 85 ] && alerts="${alerts}DISK_WARN:$disk_pct% "

# Memory check
mem_pct=$(free | grep Mem | awk '{print int($3/$2*100)}')
[ "$mem_pct" -ge 90 ] && alerts="${alerts}MEM_CRITICAL:$mem_pct% "
[ "$mem_pct" -ge 80 ] && [ "$mem_pct" -lt 90 ] && alerts="${alerts}MEM_WARN:$mem_pct% "

# Process check
pgrep -f "primearc\|flarechain\|polkadot" >/dev/null || alerts="${alerts}PROCESS_DOWN "

# RPC check
peers=$(curl -s -m 2 -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"system_health","params":[],"id":1}' http://127.0.0.1:9944 2>/dev/null | grep -oP '"peers":\K[0-9]+' || echo "0")
[ "$peers" -lt 3 ] && alerts="${alerts}LOW_PEERS:$peers "

echo "$alerts"
EOF
)

        if [ -n "$alerts" ] && [ "$alerts" != " " ]; then
            has_alerts=true
            echo -e "${RED}⚠ $name ($ip):${NC}"
            for alert in $alerts; do
                echo -e "  • $alert"
            done
            echo ""
        fi
    done

    if [ "$has_alerts" = false ]; then
        echo -e "${GREEN}✓ All PrimeArc validators healthy - no alerts${NC}"
    fi
}

# Main
main() {
    print_header

    case "${1:-all}" in
        quick|q)
            quick_summary
            ;;
        alerts|a)
            alerts_only
            ;;
        all)
            for name in $(echo "${!VALIDATORS[@]}" | tr ' ' '\n' | sort); do
                ip=${VALIDATORS[$name]}
                metrics=$(get_validator_metrics "$name" "$ip" 2>/dev/null)
                display_metrics "$name" "$metrics"
            done
            echo -e "\n${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
            quick_summary
            ;;
        pa-val-*)
            if [ -n "${VALIDATORS[$1]}" ]; then
                ip=${VALIDATORS[$1]}
                metrics=$(get_validator_metrics "$1" "$ip" 2>/dev/null)
                display_metrics "$1" "$metrics"
            else
                echo -e "${RED}Unknown validator: $1${NC}"
                echo "Available: ${!VALIDATORS[@]}"
            fi
            ;;
        *)
            echo "Usage: primearc-health [validator|all|quick|alerts]"
            echo ""
            echo "Commands:"
            echo "  all         Full metrics for all validators"
            echo "  quick, q    Quick summary table"
            echo "  alerts, a   Check for alerts only"
            echo "  pa-val-XX   Detailed metrics for specific validator"
            echo ""
            echo "Available validators: ${!VALIDATORS[@]}"
            ;;
    esac
}

main "$@"
