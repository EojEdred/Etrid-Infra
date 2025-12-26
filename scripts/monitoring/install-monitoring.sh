#!/bin/bash
#
# Install ETRID Monitoring Suite
# Run this from your Mac to deploy to auditdev
#
# Usage: ./install-monitoring.sh [auditdev-ip]
#

set -e

# Default auditdev (you can change this or pass as argument)
AUDITDEV_IP="${1:-100.102.128.51}"  # Using pa-val-01 as auditdev by default
AUDITDEV_USER="root"
INSTALL_DIR="/root/etrid-monitor"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║           ETRID MONITORING SUITE - INSTALLER                      ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""
echo "Installing to: $AUDITDEV_USER@$AUDITDEV_IP:$INSTALL_DIR"
echo ""

# Check if we can connect
echo "Testing connection..."
if ! ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 $AUDITDEV_USER@$AUDITDEV_IP "echo 'Connection OK'" 2>/dev/null; then
    echo "ERROR: Cannot connect to $AUDITDEV_IP"
    echo "Make sure Tailscale is connected and the IP is correct."
    exit 1
fi

# Create install directory
echo "Creating install directory..."
ssh $AUDITDEV_USER@$AUDITDEV_IP "mkdir -p $INSTALL_DIR"

# Copy monitoring scripts
echo "Copying monitoring scripts..."
scp "$SCRIPT_DIR/primearc-health.sh" $AUDITDEV_USER@$AUDITDEV_IP:$INSTALL_DIR/
scp "$SCRIPT_DIR/pbc-health.sh" $AUDITDEV_USER@$AUDITDEV_IP:$INSTALL_DIR/
scp "$SCRIPT_DIR/etrid-dashboard.sh" $AUDITDEV_USER@$AUDITDEV_IP:$INSTALL_DIR/
scp "$SCRIPT_DIR/mobile-commands.sh" $AUDITDEV_USER@$AUDITDEV_IP:$INSTALL_DIR/

# Make executable
echo "Setting permissions..."
ssh $AUDITDEV_USER@$AUDITDEV_IP "chmod +x $INSTALL_DIR/*.sh"

# Add to bashrc if not already there
echo "Configuring shell..."
ssh $AUDITDEV_USER@$AUDITDEV_IP bash << EOF
if ! grep -q "etrid-monitor" ~/.bashrc 2>/dev/null; then
    echo "" >> ~/.bashrc
    echo "# ETRID Monitoring Suite" >> ~/.bashrc
    echo "export ETRID_MONITOR_DIR=$INSTALL_DIR" >> ~/.bashrc
    echo "source $INSTALL_DIR/mobile-commands.sh" >> ~/.bashrc
    echo "Added monitoring commands to ~/.bashrc"
else
    echo "Monitoring commands already in ~/.bashrc"
fi
EOF

# Create global symlinks for easy access
echo "Creating global command symlinks..."
ssh $AUDITDEV_USER@$AUDITDEV_IP bash << EOF
ln -sf $INSTALL_DIR/etrid-dashboard.sh /usr/local/bin/etrid-dashboard
ln -sf $INSTALL_DIR/primearc-health.sh /usr/local/bin/primearc-health
ln -sf $INSTALL_DIR/pbc-health.sh /usr/local/bin/pbc-health

# Short aliases
ln -sf $INSTALL_DIR/etrid-dashboard.sh /usr/local/bin/ed
ln -sf $INSTALL_DIR/primearc-health.sh /usr/local/bin/pa-health
ln -sf $INSTALL_DIR/pbc-health.sh /usr/local/bin/pbc
EOF

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                    INSTALLATION COMPLETE!                         ║"
echo "╠═══════════════════════════════════════════════════════════════════╣"
echo "║ SSH to auditdev and use these commands:                           ║"
echo "║                                                                   ║"
echo "║   d       - Quick dashboard                                       ║"
echo "║   a       - Check alerts                                          ║"
echo "║   pa      - PrimeArc status                                       ║"
echo "║   pbc     - PBC status                                            ║"
echo "║   h       - Show all commands                                     ║"
echo "║                                                                   ║"
echo "║ Or use full commands:                                             ║"
echo "║   etrid-dashboard                                                 ║"
echo "║   primearc-health                                                 ║"
echo "║   pbc-health                                                      ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""
echo "Connect via Termius: ssh root@$AUDITDEV_IP"
