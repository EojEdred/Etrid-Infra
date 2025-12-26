#!/bin/bash
#
# Mobile-Friendly Commands for ETRID Network Monitoring
# Short, easy-to-type commands for Termius on phone
#
# Install: source /path/to/mobile-commands.sh
# Or add to ~/.bashrc on auditdev
#

# Script directory (where monitoring scripts live)
ETRID_MONITOR_DIR="${ETRID_MONITOR_DIR:-/root/etrid-monitor}"

# ============================================================================
# QUICK STATUS COMMANDS
# ============================================================================

# 'dash' - Dashboard quick view
dash() {
    $ETRID_MONITOR_DIR/etrid-dashboard.sh quick
}

# 'dashf' - Dashboard full view
dashf() {
    $ETRID_MONITOR_DIR/etrid-dashboard.sh full
}

# 'dashw' - Dashboard watch mode
dashw() {
    $ETRID_MONITOR_DIR/etrid-dashboard.sh watch
}

# 'pa' - PrimeArc Core quick status
pa() {
    $ETRID_MONITOR_DIR/primearc-health.sh quick
}

# 'paf' - PrimeArc Core full status
paf() {
    $ETRID_MONITOR_DIR/primearc-health.sh all
}

# 'pbc' - PBC chains quick status
pbc() {
    $ETRID_MONITOR_DIR/pbc-health.sh quick
}

# 'pbcf' - PBC chains full status
pbcf() {
    $ETRID_MONITOR_DIR/pbc-health.sh all
}

# 'all' - Check all alerts
all() {
    echo "=== PRIMEARC CORE ALERTS ==="
    $ETRID_MONITOR_DIR/primearc-health.sh alerts
    echo ""
    echo "=== PBC CHAIN ALERTS ==="
    $ETRID_MONITOR_DIR/pbc-health.sh alerts
}
alias alerts='all'

# ============================================================================
# CHAIN METRICS - SPECIFIC HEALTH CHECKS
# ============================================================================

# 'asf' - ASF quorum status
asf() {
    $ETRID_MONITOR_DIR/chain-metrics.sh asf
}

# 'fin' - Finality status
fin() {
    $ETRID_MONITOR_DIR/chain-metrics.sh finality
}

# 'blk' - Block production
blk() {
    $ETRID_MONITOR_DIR/chain-metrics.sh blocks
}

# 'peers' - Peer connections
peers() {
    $ETRID_MONITOR_DIR/chain-metrics.sh peers
}

# 'sync' - Sync status
sync() {
    $ETRID_MONITOR_DIR/chain-metrics.sh sync
}

# 'txpool' - Transaction pool
txpool() {
    $ETRID_MONITOR_DIR/chain-metrics.sh txpool
}

# 'wasf' - Watch ASF logs live
wasf() {
    $ETRID_MONITOR_DIR/chain-metrics.sh watchasf
}

# 'metrics' - Show all chain metrics
metrics() {
    $ETRID_MONITOR_DIR/chain-metrics.sh all
}

# ============================================================================
# CHAIN-SPECIFIC COMMANDS
# ============================================================================

# Check specific PBC chain: btc, eth, sol, etc.
btc() { $ETRID_MONITOR_DIR/pbc-health.sh chain BTC; }
eth() { $ETRID_MONITOR_DIR/pbc-health.sh chain ETH; }
sol() { $ETRID_MONITOR_DIR/pbc-health.sh chain SOL; }
xrp() { $ETRID_MONITOR_DIR/pbc-health.sh chain XRP; }
ada() { $ETRID_MONITOR_DIR/pbc-health.sh chain ADA; }
bnb() { $ETRID_MONITOR_DIR/pbc-health.sh chain BNB; }
doge() { $ETRID_MONITOR_DIR/pbc-health.sh chain DOGE; }
link() { $ETRID_MONITOR_DIR/pbc-health.sh chain LINK; }
matic() { $ETRID_MONITOR_DIR/pbc-health.sh chain MATIC; }
trx() { $ETRID_MONITOR_DIR/pbc-health.sh chain TRX; }
xlm() { $ETRID_MONITOR_DIR/pbc-health.sh chain XLM; }
usdt() { $ETRID_MONITOR_DIR/pbc-health.sh chain SC-USDT; }
edsc() { $ETRID_MONITOR_DIR/pbc-health.sh chain EDSC; }

# ============================================================================
# VM-SPECIFIC COMMANDS
# ============================================================================

# PrimeArc validators
v1() { $ETRID_MONITOR_DIR/primearc-health.sh pa-val-01; }
v2() { $ETRID_MONITOR_DIR/primearc-health.sh pa-val-02; }
v3() { $ETRID_MONITOR_DIR/primearc-health.sh pa-val-03; }
v4() { $ETRID_MONITOR_DIR/primearc-health.sh pa-val-04; }
v5() { $ETRID_MONITOR_DIR/primearc-health.sh pa-val-05; }

# PBC VMs (by last 2 digits)
vm07() { $ETRID_MONITOR_DIR/pbc-health.sh vmi2896907; }
vm14() { $ETRID_MONITOR_DIR/pbc-health.sh vmi2896914; }
vm16() { $ETRID_MONITOR_DIR/pbc-health.sh vmi2896916; }
vm21() { $ETRID_MONITOR_DIR/pbc-health.sh vmi2896921; }
vm23() { $ETRID_MONITOR_DIR/pbc-health.sh vmi2896923; }
vm25() { $ETRID_MONITOR_DIR/pbc-health.sh vmi2896925; }

# ============================================================================
# DISK SPACE COMMANDS
# ============================================================================

# 'disk' - Quick disk check on all VMs
disk() {
    echo "=== DISK USAGE - ALL VMS ==="
    echo ""
    echo "PRIMEARC CORE:"
    for ip in 100.102.128.51 100.89.102.75 100.80.84.82 100.74.84.28 100.71.242.104; do
        result=$(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=2 root@$ip 'df -h / | tail -1' 2>/dev/null || echo "UNREACHABLE")
        echo "  $ip: $result"
    done

    echo ""
    echo "PBC VMS:"
    for ip in 100.71.127.127 100.109.252.56 100.125.147.88 100.113.226.111 100.125.251.60 100.124.117.73; do
        result=$(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=2 root@$ip 'df -h / | tail -1' 2>/dev/null || echo "UNREACHABLE")
        echo "  $ip: $result"
    done
}

# 'mem' - Quick memory check on all VMs
mem() {
    echo "=== MEMORY USAGE - ALL VMS ==="
    echo ""
    echo "PRIMEARC CORE:"
    for ip in 100.102.128.51 100.89.102.75 100.80.84.82 100.74.84.28 100.71.242.104; do
        result=$(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=2 root@$ip 'free -h | grep Mem' 2>/dev/null || echo "UNREACHABLE")
        echo "  $ip: $result"
    done

    echo ""
    echo "PBC VMS:"
    for ip in 100.71.127.127 100.109.252.56 100.125.147.88 100.113.226.111 100.125.251.60 100.124.117.73; do
        result=$(ssh -o StrictHostKeyChecking=no -o ConnectTimeout=2 root@$ip 'free -h | grep Mem' 2>/dev/null || echo "UNREACHABLE")
        echo "  $ip: $result"
    done
}

# ============================================================================
# BLOCK HEIGHT COMMANDS
# ============================================================================

# 'blocks' - Quick block height check
blocks() {
    echo "=== BLOCK HEIGHTS ==="
    echo ""
    echo "PRIMEARC CORE (port 9944):"
    for ip in 100.102.128.51 100.89.102.75 100.80.84.82 100.74.84.28 100.71.242.104; do
        block=$(curl -s -m 2 -X POST -H "Content-Type: application/json" \
            --data '{"jsonrpc":"2.0","method":"chain_getHeader","params":[],"id":1}' \
            http://$ip:9944 2>/dev/null | grep -oP '"number":"0x\K[^"]+' || echo "N/A")
        [ "$block" != "N/A" ] && block=$((16#$block))
        echo "  $ip: #$block"
    done

    echo ""
    echo "PBC SAMPLE (ETH chain, port 9950):"
    for ip in 100.71.127.127 100.109.252.56 100.125.147.88; do
        block=$(curl -s -m 2 -X POST -H "Content-Type: application/json" \
            --data '{"jsonrpc":"2.0","method":"chain_getHeader","params":[],"id":1}' \
            http://$ip:9950 2>/dev/null | grep -oP '"number":"0x\K[^"]+' || echo "N/A")
        [ "$block" != "N/A" ] && block=$((16#$block))
        echo "  $ip (ETH-PBC): #$block"
    done
}

# ============================================================================
# HELP COMMAND
# ============================================================================

acmds() {
    cat << 'EOF'
╔═══════════════════════════════════════════════════════════════════╗
║                 ETRID MOBILE MONITORING COMMANDS                  ║
╠═══════════════════════════════════════════════════════════════════╣
║ DASHBOARD                                                         ║
║   dash    - Quick dashboard                                       ║
║   dashf   - Full dashboard with chain matrix                      ║
║   dashw   - Watch mode (auto-refresh)                             ║
║   all     - Check all alerts                                      ║
╠═══════════════════════════════════════════════════════════════════╣
║ CHAIN METRICS (specific health checks)                            ║
║   asf     - ASF quorum status & voting                            ║
║   fin     - Finality status                                       ║
║   blk     - Block production                                      ║
║   peers   - Peer connections                                      ║
║   sync    - Sync status                                           ║
║   txpool  - Transaction pool                                      ║
║   wasf    - Watch ASF logs LIVE                                   ║
║   metrics - All chain metrics                                     ║
╠═══════════════════════════════════════════════════════════════════╣
║ PRIMEARC CORE                                                     ║
║   pa      - Quick status                                          ║
║   paf     - Full details                                          ║
║   v1-v5   - Check specific validator                              ║
╠═══════════════════════════════════════════════════════════════════╣
║ PBC CHAINS                                                        ║
║   pbc     - Quick status                                          ║
║   pbcf    - Full details                                          ║
║   btc/eth/sol/xrp/ada/bnb/doge/link/matic/trx/xlm/usdt/edsc      ║
╠═══════════════════════════════════════════════════════════════════╣
║ PBC VMS                                                           ║
║   vm07/vm14/vm16/vm21/vm23/vm25                                   ║
╠═══════════════════════════════════════════════════════════════════╣
║ RESOURCES                                                         ║
║   disk    - Disk usage all VMs                                    ║
║   mem     - Memory usage all VMs                                  ║
║   blocks  - Block heights                                         ║
╠═══════════════════════════════════════════════════════════════════╣
║   acmds   - Show this help                                        ║
╚═══════════════════════════════════════════════════════════════════╝
EOF
}

# Show help on source
echo "ETRID monitoring commands loaded. Type 'acmds' for help."
