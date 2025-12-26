#!/bin/bash
#
# ETRID Chain Metrics - Specific Health Checks
# Tailored commands for ASF, finality, blocks, peers, etc.
#
# Usage: chain-metrics [asf|finality|blocks|peers|sync|txpool|all]
#

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

# PrimeArc Validators (Tailscale IPs)
PA_IPS=("100.102.128.51" "100.89.102.75" "100.80.84.82" "100.74.84.28" "100.71.242.104")
PA_NAMES=("pa-val-01" "pa-val-02" "pa-val-03" "pa-val-04" "pa-val-05")

# PBC VMs (Tailscale IPs)
PBC_IPS=("100.71.127.127" "100.109.252.56" "100.125.147.88" "100.113.226.111" "100.125.251.60" "100.124.117.73")

# ============================================================================
# ASF QUORUM STATUS
# ============================================================================
check_asf() {
    echo -e "${CYAN}╔══════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║                      ASF QUORUM STATUS                                   ║${NC}"
    echo -e "${CYAN}║                    $(date '+%Y-%m-%d %H:%M:%S')                               ║${NC}"
    echo -e "${CYAN}╚══════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    for i in "${!PA_IPS[@]}"; do
        ip=${PA_IPS[$i]}
        name=${PA_NAMES[$i]}

        echo -e "${WHITE}━━━ $name ($ip) ━━━${NC}"

        # Get latest logs with ASF info
        asf_logs=$(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=3 root@$ip \
            "journalctl -u primearc -u flarechain --no-pager -n 50 2>/dev/null | grep -i 'asf\|quorum\|vote\|finali' | tail -10" 2>/dev/null)

        if [ -n "$asf_logs" ]; then
            echo "$asf_logs" | while read line; do
                if echo "$line" | grep -qi "quorum reached\|quorum.*✅"; then
                    echo -e "  ${GREEN}✓${NC} $line"
                elif echo "$line" | grep -qi "vote added\|votes"; then
                    echo -e "  ${BLUE}→${NC} $line"
                elif echo "$line" | grep -qi "finali"; then
                    echo -e "  ${CYAN}◆${NC} $line"
                else
                    echo "  $line"
                fi
            done
        else
            # Fallback: check RPC for finality info
            result=$(curl -s -m 3 -X POST -H "Content-Type: application/json" \
                --data '{"jsonrpc":"2.0","method":"chain_getHeader","params":[],"id":1}' \
                http://$ip:9944 2>/dev/null)

            if [ -n "$result" ]; then
                best=$(echo $result | grep -oP '"number":"0x\K[^"]+' || echo "0")
                best_dec=$((16#${best:-0}))

                final_hash=$(curl -s -m 3 -X POST -H "Content-Type: application/json" \
                    --data '{"jsonrpc":"2.0","method":"chain_getFinalizedHead","params":[],"id":1}' \
                    http://$ip:9944 2>/dev/null | grep -oP '"result":"\K[^"]+')

                if [ -n "$final_hash" ]; then
                    final_header=$(curl -s -m 3 -X POST -H "Content-Type: application/json" \
                        --data "{\"jsonrpc\":\"2.0\",\"method\":\"chain_getHeader\",\"params\":[\"$final_hash\"],\"id\":1}" \
                        http://$ip:9944 2>/dev/null)
                    final=$(echo $final_header | grep -oP '"number":"0x\K[^"]+' || echo "0")
                    final_dec=$((16#${final:-0}))
                    lag=$((best_dec - final_dec))

                    echo -e "  Best Block:  ${GREEN}#$best_dec${NC}"
                    echo -e "  Finalized:   ${CYAN}#$final_dec${NC}"
                    if [ $lag -lt 10 ]; then
                        echo -e "  Finality Lag: ${GREEN}$lag blocks${NC} ✓"
                    elif [ $lag -lt 50 ]; then
                        echo -e "  Finality Lag: ${YELLOW}$lag blocks${NC}"
                    else
                        echo -e "  Finality Lag: ${RED}$lag blocks${NC} ⚠"
                    fi
                fi
            else
                echo -e "  ${RED}RPC not responding${NC}"
            fi
        fi
        echo ""
    done
}

# ============================================================================
# FINALITY STATUS
# ============================================================================
check_finality() {
    echo -e "${MAGENTA}╔══════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${MAGENTA}║                      FINALITY STATUS                                     ║${NC}"
    echo -e "${MAGENTA}╚══════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    echo "┌────────────┬─────────────────┬────────────┬────────────┬──────────┬─────────┐"
    echo "│ Validator  │ IP              │ Best Block │ Finalized  │ Lag      │ Status  │"
    echo "├────────────┼─────────────────┼────────────┼────────────┼──────────┼─────────┤"

    max_best=0
    max_final=0

    for i in "${!PA_IPS[@]}"; do
        ip=${PA_IPS[$i]}
        name=${PA_NAMES[$i]}

        result=$(curl -s -m 3 -X POST -H "Content-Type: application/json" \
            --data '{"jsonrpc":"2.0","method":"chain_getHeader","params":[],"id":1}' \
            http://$ip:9944 2>/dev/null)

        if [ -n "$result" ] && echo "$result" | grep -q "number"; then
            best=$(echo $result | grep -oP '"number":"0x\K[^"]+' || echo "0")
            best_dec=$((16#${best:-0}))
            [ $best_dec -gt $max_best ] && max_best=$best_dec

            final_hash=$(curl -s -m 3 -X POST -H "Content-Type: application/json" \
                --data '{"jsonrpc":"2.0","method":"chain_getFinalizedHead","params":[],"id":1}' \
                http://$ip:9944 2>/dev/null | grep -oP '"result":"\K[^"]+')

            final_dec=0
            if [ -n "$final_hash" ]; then
                final_header=$(curl -s -m 3 -X POST -H "Content-Type: application/json" \
                    --data "{\"jsonrpc\":\"2.0\",\"method\":\"chain_getHeader\",\"params\":[\"$final_hash\"],\"id\":1}" \
                    http://$ip:9944 2>/dev/null)
                final=$(echo $final_header | grep -oP '"number":"0x\K[^"]+' || echo "0")
                final_dec=$((16#${final:-0}))
                [ $final_dec -gt $max_final ] && max_final=$final_dec
            fi

            lag=$((best_dec - final_dec))

            if [ $lag -lt 10 ]; then
                status="${GREEN}OK${NC}"
            elif [ $lag -lt 50 ]; then
                status="${YELLOW}WARN${NC}"
            else
                status="${RED}BEHIND${NC}"
            fi

            printf "│ %-10s │ %-15s │ %-10s │ %-10s │ %-8s │ %-15s │\n" \
                "$name" "$ip" "$best_dec" "$final_dec" "$lag" "$status"
        else
            printf "│ %-10s │ %-15s │ %-10s │ %-10s │ %-8s │ ${RED}%-7s${NC} │\n" \
                "$name" "$ip" "-" "-" "-" "DOWN"
        fi
    done

    echo "└────────────┴─────────────────┴────────────┴────────────┴──────────┴─────────┘"
    echo ""
    echo -e "Network Best: ${GREEN}#$max_best${NC}  |  Network Finalized: ${CYAN}#$max_final${NC}  |  Gap: $((max_best - max_final))"
}

# ============================================================================
# BLOCK PRODUCTION
# ============================================================================
check_blocks() {
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                      BLOCK PRODUCTION                                    ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    echo -e "${WHITE}PRIMEARC CORE:${NC}"
    echo "┌────────────┬────────────┬────────────┬──────────┐"
    echo "│ Validator  │ Block      │ Block Hash │ Time     │"
    echo "├────────────┼────────────┼────────────┼──────────┤"

    for i in "${!PA_IPS[@]}"; do
        ip=${PA_IPS[$i]}
        name=${PA_NAMES[$i]}

        result=$(curl -s -m 3 -X POST -H "Content-Type: application/json" \
            --data '{"jsonrpc":"2.0","method":"chain_getHeader","params":[],"id":1}' \
            http://$ip:9944 2>/dev/null)

        if [ -n "$result" ] && echo "$result" | grep -q "number"; then
            block=$(echo $result | grep -oP '"number":"0x\K[^"]+' || echo "0")
            block_dec=$((16#${block:-0}))
            hash=$(echo $result | grep -oP '"parentHash":"0x\K[^"]{8}' || echo "????")

            printf "│ %-10s │ #%-9s │ %s...  │ now      │\n" "$name" "$block_dec" "$hash"
        else
            printf "│ %-10s │ %-10s │ %-10s │ %-8s │\n" "$name" "DOWN" "-" "-"
        fi
    done
    echo "└────────────┴────────────┴────────────┴──────────┘"

    echo ""
    echo -e "${WHITE}PBC CHAINS (sample - ETH, BTC, SOL):${NC}"
    echo "┌──────────┬─────────────────┬────────────┐"
    echo "│ Chain    │ VM              │ Block      │"
    echo "├──────────┼─────────────────┼────────────┤"

    for chain_port in "ETH:9950" "BTC:9946" "SOL:9954"; do
        chain=${chain_port%%:*}
        port=${chain_port##*:}

        for ip in "${PBC_IPS[@]:0:2}"; do
            result=$(curl -s -m 2 -X POST -H "Content-Type: application/json" \
                --data '{"jsonrpc":"2.0","method":"chain_getHeader","params":[],"id":1}' \
                http://$ip:$port 2>/dev/null)

            if [ -n "$result" ] && echo "$result" | grep -q "number"; then
                block=$(echo $result | grep -oP '"number":"0x\K[^"]+' || echo "0")
                block_dec=$((16#${block:-0}))
                printf "│ %-8s │ %-15s │ #%-9s │\n" "$chain" "$ip" "$block_dec"
            fi
        done
    done
    echo "└──────────┴─────────────────┴────────────┘"
}

# ============================================================================
# PEER CONNECTIONS
# ============================================================================
check_peers() {
    echo -e "${BLUE}╔══════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                      PEER CONNECTIONS                                    ║${NC}"
    echo -e "${BLUE}╚══════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    echo -e "${WHITE}PRIMEARC CORE VALIDATORS:${NC}"
    echo "┌────────────┬─────────────────┬───────┬──────────┬───────────┐"
    echo "│ Validator  │ IP              │ Peers │ Syncing  │ Status    │"
    echo "├────────────┼─────────────────┼───────┼──────────┼───────────┤"

    for i in "${!PA_IPS[@]}"; do
        ip=${PA_IPS[$i]}
        name=${PA_NAMES[$i]}

        health=$(curl -s -m 3 -X POST -H "Content-Type: application/json" \
            --data '{"jsonrpc":"2.0","method":"system_health","params":[],"id":1}' \
            http://$ip:9944 2>/dev/null)

        if [ -n "$health" ] && echo "$health" | grep -q "peers"; then
            peers=$(echo $health | grep -oP '"peers":\K[0-9]+' || echo "0")
            syncing=$(echo $health | grep -oP '"isSyncing":\K[a-z]+' || echo "unknown")

            if [ "$peers" -ge 4 ]; then
                status="${GREEN}HEALTHY${NC}"
            elif [ "$peers" -ge 2 ]; then
                status="${YELLOW}LOW${NC}"
            else
                status="${RED}CRITICAL${NC}"
            fi

            [ "$syncing" = "true" ] && sync_fmt="${YELLOW}yes${NC}" || sync_fmt="${GREEN}no${NC}"

            printf "│ %-10s │ %-15s │ %-5s │ %-16s │ %-17s │\n" \
                "$name" "$ip" "$peers" "$sync_fmt" "$status"
        else
            printf "│ %-10s │ %-15s │ %-5s │ %-8s │ ${RED}%-9s${NC} │\n" \
                "$name" "$ip" "-" "-" "DOWN"
        fi
    done
    echo "└────────────┴─────────────────┴───────┴──────────┴───────────┘"

    # Total peers
    echo ""
    total_peers=0
    for ip in "${PA_IPS[@]}"; do
        peers=$(curl -s -m 2 -X POST -H "Content-Type: application/json" \
            --data '{"jsonrpc":"2.0","method":"system_health","params":[],"id":1}' \
            http://$ip:9944 2>/dev/null | grep -oP '"peers":\K[0-9]+' || echo "0")
        total_peers=$((total_peers + peers))
    done
    echo -e "Total peer connections across network: ${GREEN}$total_peers${NC}"
}

# ============================================================================
# SYNC STATUS
# ============================================================================
check_sync() {
    echo -e "${YELLOW}╔══════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║                      SYNC STATUS                                         ║${NC}"
    echo -e "${YELLOW}╚══════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    # Get highest block first
    max_block=0
    for ip in "${PA_IPS[@]}"; do
        block=$(curl -s -m 2 -X POST -H "Content-Type: application/json" \
            --data '{"jsonrpc":"2.0","method":"chain_getHeader","params":[],"id":1}' \
            http://$ip:9944 2>/dev/null | grep -oP '"number":"0x\K[^"]+' || echo "0")
        block_dec=$((16#${block:-0}))
        [ $block_dec -gt $max_block ] && max_block=$block_dec
    done

    echo -e "Network highest block: ${GREEN}#$max_block${NC}"
    echo ""

    echo "┌────────────┬─────────────────┬────────────┬──────────┬──────────┬───────────┐"
    echo "│ Node       │ IP              │ Block      │ Behind   │ Syncing  │ Status    │"
    echo "├────────────┼─────────────────┼────────────┼──────────┼──────────┼───────────┤"

    for i in "${!PA_IPS[@]}"; do
        ip=${PA_IPS[$i]}
        name=${PA_NAMES[$i]}

        result=$(curl -s -m 3 -X POST -H "Content-Type: application/json" \
            --data '{"jsonrpc":"2.0","method":"chain_getHeader","params":[],"id":1}' \
            http://$ip:9944 2>/dev/null)

        health=$(curl -s -m 3 -X POST -H "Content-Type: application/json" \
            --data '{"jsonrpc":"2.0","method":"system_health","params":[],"id":1}' \
            http://$ip:9944 2>/dev/null)

        if [ -n "$result" ] && echo "$result" | grep -q "number"; then
            block=$(echo $result | grep -oP '"number":"0x\K[^"]+' || echo "0")
            block_dec=$((16#${block:-0}))
            behind=$((max_block - block_dec))
            syncing=$(echo $health | grep -oP '"isSyncing":\K[a-z]+' || echo "unknown")

            if [ $behind -eq 0 ]; then
                status="${GREEN}SYNCED${NC}"
            elif [ $behind -lt 10 ]; then
                status="${GREEN}OK${NC}"
            elif [ $behind -lt 100 ]; then
                status="${YELLOW}CATCHING${NC}"
            else
                status="${RED}BEHIND${NC}"
            fi

            [ "$syncing" = "true" ] && sync_fmt="${YELLOW}yes${NC}" || sync_fmt="${GREEN}no${NC}"

            printf "│ %-10s │ %-15s │ #%-9s │ %-8s │ %-16s │ %-17s │\n" \
                "$name" "$ip" "$block_dec" "$behind" "$sync_fmt" "$status"
        else
            printf "│ %-10s │ %-15s │ %-10s │ %-8s │ %-8s │ ${RED}%-9s${NC} │\n" \
                "$name" "$ip" "-" "-" "-" "DOWN"
        fi
    done
    echo "└────────────┴─────────────────┴────────────┴──────────┴──────────┴───────────┘"
}

# ============================================================================
# TX POOL
# ============================================================================
check_txpool() {
    echo -e "${WHITE}╔══════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${WHITE}║                      TRANSACTION POOL                                    ║${NC}"
    echo -e "${WHITE}╚══════════════════════════════════════════════════════════════════════════╝${NC}"
    echo ""

    echo "┌────────────┬─────────────────┬──────────────┬───────────┐"
    echo "│ Validator  │ IP              │ Pending TXs  │ Status    │"
    echo "├────────────┼─────────────────┼──────────────┼───────────┤"

    for i in "${!PA_IPS[@]}"; do
        ip=${PA_IPS[$i]}
        name=${PA_NAMES[$i]}

        pending=$(curl -s -m 3 -X POST -H "Content-Type: application/json" \
            --data '{"jsonrpc":"2.0","method":"author_pendingExtrinsics","params":[],"id":1}' \
            http://$ip:9944 2>/dev/null)

        if [ -n "$pending" ]; then
            # Count items in the array
            count=$(echo "$pending" | grep -oP '\["0x[^"]+' | wc -l)
            if echo "$pending" | grep -q '\[\]'; then count=0; fi

            if [ $count -eq 0 ]; then
                status="${GREEN}CLEAR${NC}"
            elif [ $count -lt 10 ]; then
                status="${GREEN}OK${NC}"
            elif [ $count -lt 100 ]; then
                status="${YELLOW}BUSY${NC}"
            else
                status="${RED}BACKLOG${NC}"
            fi

            printf "│ %-10s │ %-15s │ %-12s │ %-17s │\n" \
                "$name" "$ip" "$count" "$status"
        else
            printf "│ %-10s │ %-15s │ %-12s │ ${RED}%-9s${NC} │\n" \
                "$name" "$ip" "-" "DOWN"
        fi
    done
    echo "└────────────┴─────────────────┴──────────────┴───────────┘"
}

# ============================================================================
# LIVE ASF LOGS
# ============================================================================
watch_asf() {
    echo -e "${CYAN}Watching ASF quorum logs (Ctrl+C to stop)...${NC}"
    echo ""

    # Pick first available validator
    for ip in "${PA_IPS[@]}"; do
        if curl -s -m 2 http://$ip:9944 >/dev/null 2>&1; then
            ssh -o StrictHostKeyChecking=no root@$ip \
                "journalctl -u primearc -u flarechain -f --no-pager 2>/dev/null | grep --line-buffered -iE 'asf|quorum|vote|finali'"
            break
        fi
    done
}

# ============================================================================
# HELP
# ============================================================================
show_help() {
    cat << 'EOF'
╔═══════════════════════════════════════════════════════════════════╗
║                 CHAIN METRICS - SPECIFIC HEALTH CHECKS            ║
╠═══════════════════════════════════════════════════════════════════╣
║   asf        - ASF quorum status & voting                         ║
║   finality   - Block finalization status                          ║
║   blocks     - Block production across chains                     ║
║   peers      - Peer connections                                   ║
║   sync       - Sync status comparison                             ║
║   txpool     - Transaction pool status                            ║
║   watchasf   - Live ASF log stream                                ║
║   all        - Run all checks                                     ║
╚═══════════════════════════════════════════════════════════════════╝
EOF
}

# Main
case "${1:-help}" in
    asf)        check_asf ;;
    finality|fin)   check_finality ;;
    blocks|blk)     check_blocks ;;
    peers)      check_peers ;;
    sync)       check_sync ;;
    txpool|tx)  check_txpool ;;
    watchasf|wasf)  watch_asf ;;
    all)
        check_asf
        echo ""
        check_finality
        echo ""
        check_blocks
        echo ""
        check_peers
        echo ""
        check_sync
        echo ""
        check_txpool
        ;;
    *)          show_help ;;
esac
