#!/bin/bash
#
# Install ETRID Monitoring Suite on ALL VMs
# Run from Mac to deploy everywhere
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/root/etrid-monitor"

# All 22 VMs (name:ip pairs) - Using Tailscale IPs
ALL_VMS=(
    # PrimeArc Validators
    "vmi2897384:100.102.128.51"
    "vmi2897381:100.89.102.75"
    "vmi2896915:100.80.84.82"
    "vmi2897382:100.74.84.28"
    "vmi2897383:100.71.242.104"
    # Other nodes
    "auditdev:100.70.242.106"
    "gizzi_validator:100.96.84.69"
    # PBC VMs
    "vmi2896906:100.93.43.18"
    "vmi2896907:100.71.127.127"
    "vmi2896908:100.68.185.50"
    "vmi2896909:100.70.73.10"
    "vmi2896910:100.88.104.58"
    "vmi2896911:100.117.43.53"
    "vmi2896914:100.109.252.56"
    "vmi2896916:100.125.147.88"
    "vmi2896917:100.86.111.37"
    "vmi2896918:100.95.0.72"
    "vmi2896921:100.113.226.111"
    "vmi2896922:100.114.244.62"
    "vmi2896923:100.125.251.60"
    "vmi2896924:100.74.204.23"
    "vmi2896925:100.124.117.73"
)

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║        ETRID MONITORING - INSTALL ON ALL VMS                      ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""

success=0
failed=0

for entry in "${ALL_VMS[@]}"; do
    name="${entry%%:*}"
    ip="${entry##*:}"
    echo -n "[$name] $ip ... "

    # Test connection
    if ! ssh -o StrictHostKeyChecking=no -o ConnectTimeout=3 root@$ip "echo ok" >/dev/null 2>&1; then
        echo "SKIP (unreachable)"
        ((failed++))
        continue
    fi

    # Create dir and copy files
    ssh -o StrictHostKeyChecking=no root@$ip "mkdir -p $INSTALL_DIR" 2>/dev/null

    scp -o StrictHostKeyChecking=no -q \
        "$SCRIPT_DIR/primearc-health.sh" \
        "$SCRIPT_DIR/pbc-health.sh" \
        "$SCRIPT_DIR/etrid-dashboard.sh" \
        "$SCRIPT_DIR/chain-metrics.sh" \
        "$SCRIPT_DIR/mobile-commands.sh" \
        root@$ip:$INSTALL_DIR/ 2>/dev/null

    # Setup on remote
    ssh -o StrictHostKeyChecking=no root@$ip bash << EOF 2>/dev/null
chmod +x $INSTALL_DIR/*.sh

# Add to bashrc if not there
if ! grep -q "etrid-monitor" ~/.bashrc 2>/dev/null; then
    echo "" >> ~/.bashrc
    echo "# ETRID Monitoring Suite" >> ~/.bashrc
    echo "export ETRID_MONITOR_DIR=$INSTALL_DIR" >> ~/.bashrc
    echo "source $INSTALL_DIR/mobile-commands.sh" >> ~/.bashrc
fi

# Global symlinks
ln -sf $INSTALL_DIR/etrid-dashboard.sh /usr/local/bin/etrid-dashboard 2>/dev/null
ln -sf $INSTALL_DIR/primearc-health.sh /usr/local/bin/primearc-health 2>/dev/null
ln -sf $INSTALL_DIR/pbc-health.sh /usr/local/bin/pbc-health 2>/dev/null
EOF

    echo "OK"
    ((success++))
done

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║  COMPLETE: $success installed, $failed skipped                            ║"
echo "╠═══════════════════════════════════════════════════════════════════╣"
echo "║  SSH to ANY VM and use: dash, pa, pbc, all, acmds                 ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
