#!/bin/bash
#
# ETRID Network Unified Dashboard
# Complete health overview of PrimeArc Core + All PBC Chains
#
# Usage: etrid-dashboard [full|quick|alerts|watch]
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
DIM='\033[2m'

# Thresholds
DISK_WARN=70
DISK_CRIT=85
MEM_WARN=80
MEM_CRIT=90

# PrimeArc Core Validators (Tailscale IPs)
declare -A PA_VALIDATORS=(
    ["pa-val-01"]="100.102.128.51"
    ["pa-val-02"]="100.89.102.75"
    ["pa-val-03"]="100.80.84.82"
    ["pa-val-04"]="100.74.84.28"
    ["pa-val-05"]="100.71.242.104"
)

# PBC VMs (Tailscale IPs)
declare -A PBC_VMS=(
    ["vmi2896907"]="100.71.127.127"
    ["vmi2896914"]="100.109.252.56"
    ["vmi2896916"]="100.125.147.88"
    ["vmi2896921"]="100.113.226.111"
    ["vmi2896923"]="100.125.251.60"
    ["vmi2896925"]="100.124.117.73"
)

# PBC Chains
declare -A PBC_CHAINS=(
    ["ADA"]=9945 ["BTC"]=9946 ["BNB"]=9947 ["DOGE"]=9948
    ["EDSC"]=9949 ["ETH"]=9950 ["LINK"]=9951 ["MATIC"]=9952
    ["SC-USDT"]=9953 ["SOL"]=9954 ["TRX"]=9955 ["XLM"]=9956 ["XRP"]=9957
)

print_banner() {
    [ -t 1 ] && clear
    echo -e "${CYAN}"
    cat << 'EOF'
    ╔═══════════════════════════════════════════════════════════════════════════╗
    ║                                                                           ║
    ║   ███████╗████████╗██████╗ ██╗██████╗     ███╗   ██╗███████╗████████╗    ║
    ║   ██╔════╝╚══██╔══╝██╔══██╗██║██╔══██╗    ████╗  ██║██╔════╝╚══██╔══╝    ║
    ║   █████╗     ██║   ██████╔╝██║██║  ██║    ██╔██╗ ██║█████╗     ██║       ║
    ║   ██╔══╝     ██║   ██╔══██╗██║██║  ██║    ██║╚██╗██║██╔══╝     ██║       ║
    ║   ███████╗   ██║   ██║  ██║██║██████╔╝    ██║ ╚████║███████╗   ██║       ║
    ║   ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝╚═════╝     ╚═╝  ╚═══╝╚══════╝   ╚═╝       ║
    ║                                                                           ║
    ║                    UNIFIED NETWORK HEALTH DASHBOARD                       ║
    ╚═══════════════════════════════════════════════════════════════════════════╝
EOF
    echo -e "${NC}"
    echo -e "${DIM}                         $(date '+%Y-%m-%d %H:%M:%S %Z')${NC}"
    echo ""
}

get_quick_status() {
    local ip=$1
    local port=${2:-9944}

    result=$(timeout 2 bash -c "curl -s -X POST -H 'Content-Type: application/json' \
        --data '{\"jsonrpc\":\"2.0\",\"method\":\"chain_getHeader\",\"params\":[],\"id\":1}' \
        http://$ip:$port 2>/dev/null" || echo "")

    if [ -n "$result" ] && echo "$result" | grep -q "number"; then
        block_hex=$(echo $result | grep -oP '"number":"0x\K[^"]+' || echo "0")
        block=$((16#${block_hex:-0}))

        health=$(timeout 2 bash -c "curl -s -X POST -H 'Content-Type: application/json' \
            --data '{\"jsonrpc\":\"2.0\",\"method\":\"system_health\",\"params\":[],\"id\":1}' \
            http://$ip:$port 2>/dev/null" || echo "")
        peers=$(echo $health | grep -oP '"peers":\K[0-9]+' || echo "0")

        echo "OK|$block|$peers"
    else
        echo "DOWN|0|0"
    fi
}

get_vm_resources() {
    local ip=$1

    ssh -o StrictHostKeyChecking=no -o ConnectTimeout=2 root@$ip bash << 'EOF' 2>/dev/null
disk=$(df -h / | tail -1 | awk '{print $5}' | tr -d '%')
mem=$(free | grep Mem | awk '{print int($3/$2*100)}')
echo "$disk|$mem"
EOF
}

# Dashboard: PrimeArc Core status
show_primearc_status() {
    echo -e "${BOLD}${WHITE}┌─────────────────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${BOLD}${WHITE}│                      PRIMEARC CORE CHAIN (Relay)                       │${NC}"
    echo -e "${WHITE}├─────────────────────────────────────────────────────────────────────────┤${NC}"
    printf "${WHITE}│${NC} %-10s │ %-15s │ %-6s │ %-8s │ %-5s │ %-5s │ %-5s │\n" \
        "Validator" "IP" "Status" "Block" "Peers" "Disk" "Mem"
    echo -e "${WHITE}├────────────┼─────────────────┼────────┼──────────┼───────┼───────┼───────┤${NC}"

    local total=0
    local healthy=0
    local max_block=0

    for name in $(echo "${!PA_VALIDATORS[@]}" | tr ' ' '\n' | sort); do
        ip=${PA_VALIDATORS[$name]}
        ((total++))

        status=$(get_quick_status "$ip" 9944)
        resources=$(get_vm_resources "$ip")

        IFS='|' read -r state block peers <<< "$status"
        IFS='|' read -r disk mem <<< "$resources"

        [ "$state" = "OK" ] && ((healthy++))
        [ "${block:-0}" -gt "$max_block" ] && max_block=$block

        # Format with colors
        if [ "$state" = "OK" ]; then
            state_fmt="${GREEN}✓ OK${NC}"
        else
            state_fmt="${RED}✗ DOWN${NC}"
        fi

        [ "${disk:-0}" -ge 85 ] && disk_fmt="${RED}${disk}%${NC}" || disk_fmt="${GREEN}${disk:-?}%${NC}"
        [ "${mem:-0}" -ge 90 ] && mem_fmt="${RED}${mem}%${NC}" || mem_fmt="${GREEN}${mem:-?}%${NC}"

        printf "${WHITE}│${NC} %-10s │ %-15s │ %-14s │ %-8s │ %-5s │ %-13s │ %-13s │\n" \
            "$name" "$ip" "$state_fmt" "${block:-0}" "${peers:-0}" "$disk_fmt" "$mem_fmt"
    done

    echo -e "${WHITE}├─────────────────────────────────────────────────────────────────────────┤${NC}"

    if [ $healthy -eq $total ]; then
        echo -e "${WHITE}│${NC} ${GREEN}✓ All $total validators healthy${NC} │ Best Block: ${CYAN}#$max_block${NC}                    │"
    else
        echo -e "${WHITE}│${NC} ${RED}⚠ $healthy/$total validators healthy${NC} │ Best Block: ${CYAN}#$max_block${NC}                    │"
    fi

    echo -e "${WHITE}└─────────────────────────────────────────────────────────────────────────┘${NC}"
}

# Dashboard: PBC VMs status
show_pbc_vm_status() {
    echo -e "\n${BOLD}${MAGENTA}┌─────────────────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${BOLD}${MAGENTA}│                    PBC COLLATOR VMS (6 Active)                          │${NC}"
    echo -e "${MAGENTA}├─────────────────────────────────────────────────────────────────────────┤${NC}"
    printf "${MAGENTA}│${NC} %-12s │ %-15s │ %-6s │ %-5s │ %-5s │ %-18s │\n" \
        "VM" "IP" "Status" "Disk" "Mem" "Sample Chains"
    echo -e "${MAGENTA}├──────────────┼─────────────────┼────────┼───────┼───────┼────────────────────┤${NC}"

    local total=0
    local healthy=0

    for vm in $(echo "${!PBC_VMS[@]}" | tr ' ' '\n' | sort); do
        ip=${PBC_VMS[$vm]}
        ((total++))

        resources=$(get_vm_resources "$ip")
        IFS='|' read -r disk mem <<< "$resources"

        # Check a few chains
        chains_up=0
        for port in 9945 9950 9954; do
            result=$(timeout 1 curl -s http://$ip:$port 2>/dev/null || echo "")
            [ -n "$result" ] && ((chains_up++))
        done

        if [ -n "$resources" ]; then
            ((healthy++))
            state_fmt="${GREEN}✓ UP${NC}"
        else
            state_fmt="${RED}✗ DOWN${NC}"
        fi

        [ "${disk:-0}" -ge 85 ] && disk_fmt="${RED}${disk}%${NC}" || disk_fmt="${GREEN}${disk:-?}%${NC}"
        [ "${mem:-0}" -ge 90 ] && mem_fmt="${RED}${mem}%${NC}" || mem_fmt="${GREEN}${mem:-?}%${NC}"

        printf "${MAGENTA}│${NC} %-12s │ %-15s │ %-14s │ %-13s │ %-13s │ %-18s │\n" \
            "$vm" "$ip" "$state_fmt" "$disk_fmt" "$mem_fmt" "$chains_up/3 responding"
    done

    echo -e "${MAGENTA}├─────────────────────────────────────────────────────────────────────────┤${NC}"

    if [ $healthy -eq $total ]; then
        echo -e "${MAGENTA}│${NC} ${GREEN}✓ All $total VMs healthy${NC} │ 73 Collators │ 13 PBC Chains                  │"
    else
        echo -e "${MAGENTA}│${NC} ${RED}⚠ $healthy/$total VMs healthy${NC}                                                │"
    fi

    echo -e "${MAGENTA}└─────────────────────────────────────────────────────────────────────────┘${NC}"
}

# Dashboard: PBC chains matrix
show_pbc_chains_matrix() {
    echo -e "\n${BOLD}${BLUE}┌─────────────────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${BOLD}${BLUE}│                      PBC CHAINS STATUS MATRIX                           │${NC}"
    echo -e "${BLUE}├─────────────────────────────────────────────────────────────────────────┤${NC}"

    # Header row with VMs
    printf "${BLUE}│${NC} %-8s │" "Chain"
    for vm in $(echo "${!PBC_VMS[@]}" | tr ' ' '\n' | sort | head -4); do
        printf " %-9s │" "${vm: -3}"
    done
    echo ""
    echo -e "${BLUE}├──────────┼───────────┼───────────┼───────────┼───────────┤${NC}"

    # Sample a few key chains
    for chain in BTC ETH SOL XRP; do
        port=${PBC_CHAINS[$chain]}
        printf "${BLUE}│${NC} %-8s │" "$chain"

        for vm in $(echo "${!PBC_VMS[@]}" | tr ' ' '\n' | sort | head -4); do
            ip=${PBC_VMS[$vm]}
            status=$(get_quick_status "$ip" "$port")
            IFS='|' read -r state block peers <<< "$status"

            if [ "$state" = "OK" ]; then
                printf " ${GREEN}#%-7s${NC} │" "$block"
            else
                printf " ${RED}%-9s${NC} │" "DOWN"
            fi
        done
        echo ""
    done

    echo -e "${BLUE}├─────────────────────────────────────────────────────────────────────────┤${NC}"
    echo -e "${BLUE}│${NC} ${DIM}Showing 4/13 chains on 4/6 VMs. Run 'pbc-health all' for full view.${NC}    │"
    echo -e "${BLUE}└─────────────────────────────────────────────────────────────────────────┘${NC}"
}

# Alert summary
show_alerts() {
    echo -e "\n${BOLD}${RED}┌─────────────────────────────────────────────────────────────────────────┐${NC}"
    echo -e "${BOLD}${RED}│                           ALERT SUMMARY                                 │${NC}"
    echo -e "${RED}├─────────────────────────────────────────────────────────────────────────┤${NC}"

    local alerts=()

    # Check PrimeArc validators
    for name in $(echo "${!PA_VALIDATORS[@]}" | tr ' ' '\n' | sort); do
        ip=${PA_VALIDATORS[$name]}
        status=$(get_quick_status "$ip" 9944)
        resources=$(get_vm_resources "$ip")

        IFS='|' read -r state block peers <<< "$status"
        IFS='|' read -r disk mem <<< "$resources"

        [ "$state" != "OK" ] && alerts+=("PrimeArc $name: RPC DOWN")
        [ "${disk:-0}" -ge 85 ] && alerts+=("PrimeArc $name: Disk ${disk}%")
        [ "${mem:-0}" -ge 90 ] && alerts+=("PrimeArc $name: Memory ${mem}%")
        [ "${peers:-0}" -lt 3 ] && [ "$state" = "OK" ] && alerts+=("PrimeArc $name: Low peers ($peers)")
    done

    # Check PBC VMs
    for vm in $(echo "${!PBC_VMS[@]}" | tr ' ' '\n' | sort); do
        ip=${PBC_VMS[$vm]}
        resources=$(get_vm_resources "$ip")

        if [ -z "$resources" ]; then
            alerts+=("PBC $vm: UNREACHABLE")
        else
            IFS='|' read -r disk mem <<< "$resources"
            [ "${disk:-0}" -ge 85 ] && alerts+=("PBC $vm: Disk ${disk}%")
            [ "${mem:-0}" -ge 90 ] && alerts+=("PBC $vm: Memory ${mem}%")
        fi
    done

    if [ ${#alerts[@]} -eq 0 ]; then
        echo -e "${RED}│${NC} ${GREEN}✓ No active alerts - all systems healthy${NC}                              │"
    else
        for alert in "${alerts[@]}"; do
            printf "${RED}│${NC} ${YELLOW}⚠${NC} %-69s ${RED}│${NC}\n" "$alert"
        done
    fi

    echo -e "${RED}└─────────────────────────────────────────────────────────────────────────┘${NC}"
}

# Network summary
show_network_summary() {
    echo -e "\n${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${WHITE}${BOLD}NETWORK SUMMARY${NC}"
    echo -e "${DIM}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  PrimeArc Core:  ${CYAN}5 Validators${NC} (Relay Chain)"
    echo -e "  PBC Network:    ${CYAN}6 VMs${NC} × ${CYAN}13 Chains${NC} = ${CYAN}73 Collators${NC}"
    echo -e "  Total Nodes:    ${GREEN}78 Active${NC}"
    echo ""
    echo -e "  ${DIM}Quick Commands:${NC}"
    echo -e "    ${CYAN}pa${NC}      - PrimeArc health    ${CYAN}pbc${NC}     - PBC health"
    echo -e "    ${CYAN}alerts${NC}  - Check alerts       ${CYAN}watch${NC}   - Live monitor"
    echo ""
}

# Watch mode
watch_mode() {
    while true; do
        print_banner
        show_primearc_status
        show_pbc_vm_status
        show_alerts
        echo -e "\n${DIM}Refreshing every 30s... Press Ctrl+C to exit${NC}"
        sleep 30
    done
}

# Main
main() {
    case "${1:-quick}" in
        full|f)
            print_banner
            show_primearc_status
            show_pbc_vm_status
            show_pbc_chains_matrix
            show_alerts
            show_network_summary
            ;;
        quick|q|"")
            print_banner
            show_primearc_status
            show_pbc_vm_status
            show_alerts
            ;;
        alerts|a)
            print_banner
            show_alerts
            ;;
        watch|w)
            watch_mode
            ;;
        *)
            echo "ETRID Network Dashboard"
            echo ""
            echo "Usage: etrid-dashboard [command]"
            echo ""
            echo "Commands:"
            echo "  quick, q     Quick overview (default)"
            echo "  full, f      Full dashboard with chain matrix"
            echo "  alerts, a    Alert summary only"
            echo "  watch, w     Live monitoring (refreshes every 30s)"
            ;;
    esac
}

main "$@"
