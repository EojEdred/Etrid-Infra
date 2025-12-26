#!/bin/bash
#
# PBC (Partition Burst Chain) - Comprehensive Health Monitor
# Full metrics for all 13 PBC chains across 6 VMs
#
# Usage: pbc-health [chain|vm|all|quick|alerts]
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
PEER_MIN=2
BLOCK_STALE_MINS=5

# PBC VMs (Tailscale IPs for access from anywhere)
declare -A PBC_VMS=(
    ["vmi2896907"]="100.71.127.127"
    ["vmi2896914"]="100.109.252.56"
    ["vmi2896916"]="100.125.147.88"
    ["vmi2896921"]="100.113.226.111"
    ["vmi2896923"]="100.125.251.60"
    ["vmi2896925"]="100.124.117.73"
)

# PBC Chains with their RPC ports
declare -A PBC_CHAINS=(
    ["ADA"]=9945
    ["BTC"]=9946
    ["BNB"]=9947
    ["DOGE"]=9948
    ["EDSC"]=9949
    ["ETH"]=9950
    ["LINK"]=9951
    ["MATIC"]=9952
    ["SC-USDT"]=9953
    ["SOL"]=9954
    ["TRX"]=9955
    ["XLM"]=9956
    ["XRP"]=9957
)

print_header() {
    echo -e "${MAGENTA}"
    echo "╔══════════════════════════════════════════════════════════════════════════╗"
    echo "║              PBC PARTITION BURST CHAINS - HEALTH MONITOR                 ║"
    echo "║                         $(date '+%Y-%m-%d %H:%M:%S %Z')                          ║"
    echo "║                  13 Chains × 6 VMs = 73 Collators                        ║"
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

# Get VM system metrics
get_vm_metrics() {
    local vm_name=$1
    local ip=$2

    ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 root@$ip bash << 'EOF' 2>/dev/null
# System metrics
cpu_usage=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 2>/dev/null || echo "0")
load_avg=$(cat /proc/loadavg | awk '{print $1}')
cpu_cores=$(nproc)

mem_info=$(free -m | grep Mem)
mem_total=$(echo $mem_info | awk '{print $2}')
mem_used=$(echo $mem_info | awk '{print $3}')
mem_pct=$((mem_used * 100 / mem_total))

disk_info=$(df -h / | tail -1)
disk_total=$(echo $disk_info | awk '{print $2}')
disk_used=$(echo $disk_info | awk '{print $3}')
disk_avail=$(echo $disk_info | awk '{print $4}')
disk_pct=$(echo $disk_info | awk '{print $5}' | tr -d '%')

# Count running collators
collator_count=$(pgrep -f "pbc-collator\|pbc_collator" | wc -l)

# Total chain data size
chain_data=""
for dir in /var/lib/pbc /root/.local/share; do
    if [ -d "$dir" ]; then
        chain_data=$(du -sh "$dir" 2>/dev/null | awk '{print $1}')
        break
    fi
done

uptime_info=$(uptime -p 2>/dev/null | sed 's/up //')

echo "CPU=$cpu_usage|LOAD=$load_avg|CORES=$cpu_cores|MEM_USED=$mem_used|MEM_TOTAL=$mem_total|MEM_PCT=$mem_pct|DISK_USED=$disk_used|DISK_TOTAL=$disk_total|DISK_AVAIL=$disk_avail|DISK_PCT=$disk_pct|COLLATORS=$collator_count|CHAIN_DATA=$chain_data|UPTIME=$uptime_info"
EOF
}

# Get chain status from RPC
get_chain_status() {
    local ip=$1
    local port=$2
    local chain=$3

    result=$(curl -s -m 3 -X POST -H "Content-Type: application/json" \
        --data '{"jsonrpc":"2.0","method":"chain_getHeader","params":[],"id":1}' \
        http://$ip:$port 2>/dev/null || echo "")

    if [ -n "$result" ] && echo "$result" | grep -q "result"; then
        block_hex=$(echo $result | grep -oP '"number":"0x\K[^"]+' || echo "0")
        block_num=$((16#${block_hex:-0}))

        # Get peer count
        health=$(curl -s -m 2 -X POST -H "Content-Type: application/json" \
            --data '{"jsonrpc":"2.0","method":"system_health","params":[],"id":1}' \
            http://$ip:$port 2>/dev/null || echo "")
        peers=$(echo $health | grep -oP '"peers":\K[0-9]+' || echo "0")
        syncing=$(echo $health | grep -oP '"isSyncing":\K[a-z]+' || echo "false")

        echo "OK|$block_num|$peers|$syncing"
    else
        echo "DOWN|0|0|false"
    fi
}

# Display VM detailed metrics
display_vm_details() {
    local vm_name=$1
    local ip=$2

    echo -e "\n${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BOLD}${WHITE}  VM: $vm_name ($ip)${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

    # Get system metrics
    metrics=$(get_vm_metrics "$vm_name" "$ip")

    if [ -z "$metrics" ]; then
        echo -e "  $(status_icon crit) ${RED}UNREACHABLE${NC}"
        return 1
    fi

    # Parse metrics
    IFS='|' read -ra PARTS <<< "$metrics"
    for part in "${PARTS[@]}"; do
        eval "$part"
    done

    local alerts=()

    echo ""
    echo -e "${WHITE}  ┌─ SYSTEM RESOURCES ─────────────────────────────────────────────┐${NC}"

    # CPU
    cpu_int=${CPU%.*}
    if [ "${cpu_int:-0}" -ge "$CPU_CRIT" ]; then
        echo -e "  │ $(status_icon crit) CPU: ${RED}${CPU}%${NC} (Load: $LOAD / $CORES cores)"
        alerts+=("CPU Critical")
    elif [ "${cpu_int:-0}" -ge "$CPU_WARN" ]; then
        echo -e "  │ $(status_icon warn) CPU: ${YELLOW}${CPU}%${NC} (Load: $LOAD / $CORES cores)"
        alerts+=("CPU Warning")
    else
        echo -e "  │ $(status_icon ok) CPU: ${GREEN}${CPU}%${NC} (Load: $LOAD / $CORES cores)"
    fi

    # Memory
    if [ "${MEM_PCT:-0}" -ge "$MEM_CRIT" ]; then
        echo -e "  │ $(status_icon crit) Memory: ${RED}${MEM_USED}MB / ${MEM_TOTAL}MB (${MEM_PCT}%)${NC}"
        alerts+=("Memory Critical")
    elif [ "${MEM_PCT:-0}" -ge "$MEM_WARN" ]; then
        echo -e "  │ $(status_icon warn) Memory: ${YELLOW}${MEM_USED}MB / ${MEM_TOTAL}MB (${MEM_PCT}%)${NC}"
        alerts+=("Memory Warning")
    else
        echo -e "  │ $(status_icon ok) Memory: ${GREEN}${MEM_USED}MB / ${MEM_TOTAL}MB (${MEM_PCT}%)${NC}"
    fi

    # Disk
    if [ "${DISK_PCT:-0}" -ge "$DISK_CRIT" ]; then
        echo -e "  │ $(status_icon crit) Disk: ${RED}${DISK_USED} / ${DISK_TOTAL} (${DISK_PCT}%)${NC} - ${DISK_AVAIL} free"
        alerts+=("Disk Critical")
    elif [ "${DISK_PCT:-0}" -ge "$DISK_WARN" ]; then
        echo -e "  │ $(status_icon warn) Disk: ${YELLOW}${DISK_USED} / ${DISK_TOTAL} (${DISK_PCT}%)${NC} - ${DISK_AVAIL} free"
        alerts+=("Disk Warning")
    else
        echo -e "  │ $(status_icon ok) Disk: ${GREEN}${DISK_USED} / ${DISK_TOTAL} (${DISK_PCT}%)${NC} - ${DISK_AVAIL} free"
    fi

    echo -e "  │   Chain Data: ${CHAIN_DATA:-N/A}"
    echo -e "  │   Uptime: ${UPTIME:-N/A}"
    echo -e "  │   Running Collators: ${COLLATORS:-0}"
    echo -e "  └──────────────────────────────────────────────────────────────────┘"

    # Chain status table
    echo -e "  ┌─ PBC CHAIN STATUS ──────────────────────────────────────────────┐"
    printf "  │ %-10s │ %-8s │ %-10s │ %-6s │ %-8s │\n" "Chain" "Status" "Block" "Peers" "Syncing"
    echo -e "  ├────────────┼──────────┼────────────┼────────┼──────────┤"

    for chain in $(echo "${!PBC_CHAINS[@]}" | tr ' ' '\n' | sort); do
        port=${PBC_CHAINS[$chain]}
        status=$(get_chain_status "$ip" "$port" "$chain")

        IFS='|' read -r state block peers syncing <<< "$status"

        if [ "$state" = "OK" ]; then
            state_col="${GREEN}OK${NC}"
            [ "${peers:-0}" -lt "$PEER_MIN" ] && state_col="${YELLOW}LOW${NC}" && alerts+=("$chain: Low peers")
        else
            state_col="${RED}DOWN${NC}"
            alerts+=("$chain: DOWN")
        fi

        sync_col="$syncing"
        [ "$syncing" = "true" ] && sync_col="${YELLOW}yes${NC}"

        printf "  │ %-10s │ %-16s │ %-10s │ %-6s │ %-16s │\n" \
            "$chain" "$state_col" "$block" "$peers" "$sync_col"
    done

    echo -e "  └────────────┴──────────┴────────────┴────────┴──────────┘"

    # Alerts
    if [ ${#alerts[@]} -gt 0 ]; then
        echo -e "  ┌─ ${RED}ALERTS${NC} ───────────────────────────────────────────────────────┐"
        for alert in "${alerts[@]}"; do
            echo -e "  │ ${RED}⚠ $alert${NC}"
        done
        echo -e "  └──────────────────────────────────────────────────────────────────┘"
    fi
}

# Quick summary of all VMs
quick_vm_summary() {
    echo -e "\n${WHITE}${BOLD}PBC VM SUMMARY${NC}"
    echo "┌────────────┬─────────────────┬────────┬────────┬─────────┬───────┬──────────┐"
    echo "│ VM         │ IP              │ Status │ Collat │ Disk    │ Mem   │ Chains   │"
    echo "├────────────┼─────────────────┼────────┼────────┼─────────┼───────┼──────────┤"

    for vm in $(echo "${!PBC_VMS[@]}" | tr ' ' '\n' | sort); do
        ip=${PBC_VMS[$vm]}

        metrics=$(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=3 root@$ip bash << 'EOF' 2>/dev/null
disk_pct=$(df -h / | tail -1 | awk '{print $5}' | tr -d '%')
mem_pct=$(free | grep Mem | awk '{print int($3/$2*100)}')
collators=$(pgrep -f "pbc-collator\|pbc_collator" | wc -l)

# Count responding chains (quick check on a few ports)
chains_up=0
for port in 9945 9946 9950 9954 9957; do
    curl -s -m 1 http://127.0.0.1:$port >/dev/null 2>&1 && ((chains_up++)) || true
done

echo "OK|$collators|$disk_pct|$mem_pct|$chains_up"
EOF
)

        if [ -n "$metrics" ]; then
            IFS='|' read -r status collators disk mem chains <<< "$metrics"

            [ "${disk:-0}" -ge 85 ] && disk_col="${RED}${disk}%${NC}" || disk_col="${GREEN}${disk}%${NC}"
            [ "${mem:-0}" -ge 90 ] && mem_col="${RED}${mem}%${NC}" || mem_col="${GREEN}${mem}%${NC}"

            printf "│ %-10s │ %-15s │ ${GREEN}%-6s${NC} │ %-6s │ %-15s │ %-13s │ %-8s │\n" \
                "$vm" "$ip" "UP" "$collators" "$disk_col" "$mem_col" "${chains:-0}/5"
        else
            printf "│ %-10s │ %-15s │ ${RED}%-6s${NC} │ %-6s │ %-7s │ %-5s │ %-8s │\n" \
                "$vm" "$ip" "DOWN" "-" "-" "-" "-"
        fi
    done

    echo "└────────────┴─────────────────┴────────┴────────┴─────────┴───────┴──────────┘"
}

# Quick summary per chain across all VMs
quick_chain_summary() {
    echo -e "\n${WHITE}${BOLD}PBC CHAIN OVERVIEW (All VMs)${NC}"
    echo "┌───────────┬────────────────────────────────────────────────────────────────┐"
    echo "│ Chain     │ VM Status (Block Height / Peers)                               │"
    echo "├───────────┼────────────────────────────────────────────────────────────────┤"

    for chain in $(echo "${!PBC_CHAINS[@]}" | tr ' ' '\n' | sort); do
        port=${PBC_CHAINS[$chain]}
        vm_status=""

        for vm in $(echo "${!PBC_VMS[@]}" | tr ' ' '\n' | sort | head -3); do
            ip=${PBC_VMS[$vm]}
            status=$(get_chain_status "$ip" "$port" "$chain")
            IFS='|' read -r state block peers syncing <<< "$status"

            if [ "$state" = "OK" ]; then
                vm_status="${vm_status}${GREEN}${block}/${peers}${NC} "
            else
                vm_status="${vm_status}${RED}DOWN${NC} "
            fi
        done

        printf "│ %-9s │ %-68s │\n" "$chain-PBC" "$vm_status..."
    done

    echo "└───────────┴────────────────────────────────────────────────────────────────┘"
}

# Alert check across all VMs and chains
alerts_only() {
    echo -e "\n${WHITE}${BOLD}PBC NETWORK - ALERT CHECK${NC}\n"

    local has_alerts=false

    for vm in $(echo "${!PBC_VMS[@]}" | tr ' ' '\n' | sort); do
        ip=${PBC_VMS[$vm]}
        vm_alerts=""

        # System alerts
        sys_alerts=$(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=3 root@$ip bash << 'EOF' 2>/dev/null
alerts=""
disk_pct=$(df -h / | tail -1 | awk '{print $5}' | tr -d '%')
[ "$disk_pct" -ge 85 ] && alerts="${alerts}DISK:$disk_pct% "

mem_pct=$(free | grep Mem | awk '{print int($3/$2*100)}')
[ "$mem_pct" -ge 90 ] && alerts="${alerts}MEM:$mem_pct% "

collators=$(pgrep -f "pbc-collator\|pbc_collator" | wc -l)
[ "$collators" -lt 10 ] && alerts="${alerts}LOW_COLLATORS:$collators "

echo "$alerts"
EOF
)

        # Chain alerts (check a sample)
        chain_alerts=""
        for port in 9945 9950 9954 9957; do
            result=$(curl -s -m 1 -X POST -H "Content-Type: application/json" \
                --data '{"jsonrpc":"2.0","method":"system_health","params":[],"id":1}' \
                http://$ip:$port 2>/dev/null || echo "")
            if [ -z "$result" ] || ! echo "$result" | grep -q "result"; then
                chain_alerts="${chain_alerts}PORT_${port}_DOWN "
            fi
        done

        if [ -n "$sys_alerts" ] || [ -n "$chain_alerts" ]; then
            has_alerts=true
            echo -e "${RED}⚠ $vm ($ip):${NC}"
            [ -n "$sys_alerts" ] && echo -e "  System: $sys_alerts"
            [ -n "$chain_alerts" ] && echo -e "  Chains: $chain_alerts"
            echo ""
        fi
    done

    if [ "$has_alerts" = false ]; then
        echo -e "${GREEN}✓ All PBC VMs and chains healthy - no alerts${NC}"
    fi
}

# Check specific chain across all VMs
check_chain() {
    local chain_name=$1

    if [ -z "${PBC_CHAINS[$chain_name]}" ]; then
        echo -e "${RED}Unknown chain: $chain_name${NC}"
        echo "Available chains: ${!PBC_CHAINS[@]}"
        return 1
    fi

    local port=${PBC_CHAINS[$chain_name]}

    echo -e "\n${WHITE}${BOLD}$chain_name-PBC STATUS (Port: $port)${NC}"
    echo "┌────────────┬─────────────────┬────────┬────────────┬────────┬──────────┐"
    echo "│ VM         │ IP              │ Status │ Block      │ Peers  │ Syncing  │"
    echo "├────────────┼─────────────────┼────────┼────────────┼────────┼──────────┤"

    for vm in $(echo "${!PBC_VMS[@]}" | tr ' ' '\n' | sort); do
        ip=${PBC_VMS[$vm]}
        status=$(get_chain_status "$ip" "$port" "$chain_name")
        IFS='|' read -r state block peers syncing <<< "$status"

        if [ "$state" = "OK" ]; then
            state_col="${GREEN}OK${NC}"
        else
            state_col="${RED}DOWN${NC}"
        fi

        printf "│ %-10s │ %-15s │ %-14s │ %-10s │ %-6s │ %-8s │\n" \
            "$vm" "$ip" "$state_col" "$block" "$peers" "$syncing"
    done

    echo "└────────────┴─────────────────┴────────┴────────────┴────────┴──────────┘"
}

# Main
main() {
    print_header

    case "${1:-quick}" in
        quick|q)
            quick_vm_summary
            quick_chain_summary
            ;;
        alerts|a)
            alerts_only
            ;;
        all)
            for vm in $(echo "${!PBC_VMS[@]}" | tr ' ' '\n' | sort); do
                ip=${PBC_VMS[$vm]}
                display_vm_details "$vm" "$ip"
            done
            ;;
        vm)
            if [ -n "$2" ] && [ -n "${PBC_VMS[$2]}" ]; then
                display_vm_details "$2" "${PBC_VMS[$2]}"
            else
                echo "Usage: pbc-health vm <vm-name>"
                echo "Available VMs: ${!PBC_VMS[@]}"
            fi
            ;;
        chain)
            if [ -n "$2" ]; then
                check_chain "${2^^}"
            else
                echo "Usage: pbc-health chain <chain-name>"
                echo "Available chains: ${!PBC_CHAINS[@]}"
            fi
            ;;
        vmi*)
            if [ -n "${PBC_VMS[$1]}" ]; then
                display_vm_details "$1" "${PBC_VMS[$1]}"
            else
                echo -e "${RED}Unknown VM: $1${NC}"
                echo "Available: ${!PBC_VMS[@]}"
            fi
            ;;
        ADA|BTC|BNB|DOGE|EDSC|ETH|LINK|MATIC|SC-USDT|SOL|TRX|XLM|XRP)
            check_chain "$1"
            ;;
        *)
            echo "Usage: pbc-health [command]"
            echo ""
            echo "Commands:"
            echo "  quick, q        Quick summary of all VMs and chains"
            echo "  alerts, a       Check for alerts only"
            echo "  all             Detailed metrics for all VMs"
            echo "  vm <name>       Detailed metrics for specific VM"
            echo "  chain <name>    Status of specific chain across all VMs"
            echo "  <chain>         Direct chain name (ETH, BTC, SOL, etc.)"
            echo "  <vm>            Direct VM name (vmi2896907, etc.)"
            echo ""
            echo "VMs: ${!PBC_VMS[@]}"
            echo "Chains: ${!PBC_CHAINS[@]}"
            ;;
    esac
}

main "$@"
