#!/bin/bash

# Primearc Core Mainnet - Tailscale Multi-VM Deployment Script
# Deploys Primearc Core validator nodes to all VMs in the Tailscale network

set -e

# Configuration
BINARY_PATH="/Users/macbook/Desktop/etrid/binaries/x86_64/primearc-core-node"
CHAINSPEC_PATH="/Users/macbook/Desktop/etrid/primearc_core_mainnet.json"
ETRID_BASE_PATH="/var/lib/etrid"
LOG_DIR="/Users/macbook/Desktop/etrid/deployment-logs"
SSH_KEY="$HOME/.ssh/contabo-validators"

# Parse arguments
AUTO_CONFIRM=false
if [[ "$1" == "--yes" ]] || [[ "$1" == "-y" ]]; then
    AUTO_CONFIRM=true
fi

# Bootnode addresses (from existing network)
BOOTNODE_GIZZI="/ip4/64.181.215.19/tcp/30333/p2p/12D3KooWPyfp2DECPKTmJ1AhxB6midHnp7wYTP15vBAxbTewxaq1"

# Get all VMs from Tailscale (exclude local machine and gizzi-io-validator)
echo "═══════════════════════════════════════════════════════════════════════"
echo "Primearc Core Mainnet - Tailscale Multi-VM Deployment"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""

# Create log directory
mkdir -p "$LOG_DIR"

# Get VM list from Tailscale
VMS=$(tailscale status | grep "linux" | grep "vmi" | awk '{print $2}')
VM_COUNT=$(echo "$VMS" | wc -l | tr -d ' ')

echo "Found $VM_COUNT VMs in Tailscale network:"
echo "$VMS"
echo ""

# Validate prerequisites
echo "Validating prerequisites..."
if [ ! -f "$BINARY_PATH" ]; then
    echo "❌ Binary not found: $BINARY_PATH"
    exit 1
fi

if [ ! -f "$CHAINSPEC_PATH" ]; then
    echo "❌ Chain spec not found: $CHAINSPEC_PATH"
    exit 1
fi

echo "✅ Binary: $(ls -lh $BINARY_PATH | awk '{print $5}')"
echo "✅ Chain spec: $(ls -lh $CHAINSPEC_PATH | awk '{print $5}')"
echo ""

if [ "$AUTO_CONFIRM" = false ]; then
    read -p "Deploy to $VM_COUNT VMs? (y/n): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
else
    echo "Auto-confirm enabled, proceeding with deployment..."
    echo ""
fi

# Function to deploy to a single VM
deploy_to_vm() {
    local VM_NAME=$1
    local VALIDATOR_NUM=$2
    local LOG_FILE="$LOG_DIR/${VM_NAME}.log"

    echo "[$VM_NAME] Starting deployment (Validator-$VALIDATOR_NUM)..." | tee "$LOG_FILE"

    {
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "[$VM_NAME] Step 1: Opening Firewall (Port 30333)"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=10 "root@$VM_NAME" bash << 'ENDFIREWALL'
            # Check if rule already exists
            if sudo iptables -L INPUT -n 2>/dev/null | grep -q "tcp dpt:30333"; then
                echo "✅ Port 30333 already open"
            else
                echo "Opening port 30333..."
                sudo iptables -I INPUT 1 -p tcp --dport 30333 -m comment --comment "Primearc Core P2P" -j ACCEPT
                echo "✅ Port 30333 opened"
            fi

            # Install and save
            if ! command -v netfilter-persistent &> /dev/null; then
                echo "Installing iptables-persistent..."
                DEBIAN_FRONTEND=noninteractive apt-get update -qq > /dev/null 2>&1
                DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent > /dev/null 2>&1
            fi
            netfilter-persistent save > /dev/null 2>&1
            echo "✅ Firewall configured"
ENDFIREWALL

        echo ""
        echo "[$VM_NAME] Step 2: Creating Directory Structure"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "root@$VM_NAME" bash << 'ENDDIRS'
            mkdir -p /var/lib/etrid/chains/primearc_core_mainnet_v1/network
            mkdir -p /var/lib/etrid/chains/primearc_core_mainnet_v1/keystore
            mkdir -p /usr/local/bin
            echo "✅ Directories created"
ENDDIRS

        echo ""
        echo "[$VM_NAME] Step 3: Deploying Binary (75MB)"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        # Transfer binary
        cat "$BINARY_PATH" | ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "root@$VM_NAME" \
            'cat > /usr/local/bin/primearc-core-node && chmod +x /usr/local/bin/primearc-core-node'
        echo "✅ Binary deployed"

        echo ""
        echo "[$VM_NAME] Step 4: Deploying Chain Spec (2MB)"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        # Transfer chainspec
        cat "$CHAINSPEC_PATH" | ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "root@$VM_NAME" \
            'cat > /var/lib/etrid/chainspec-mainnet.json'
        echo "✅ Chain spec deployed"

        echo ""
        echo "[$VM_NAME] Step 5: Generating Session Keys"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        KEYS_OUTPUT=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "root@$VM_NAME" bash << 'ENDKEYS'
            # Network key
            NETWORK_KEY=$(openssl rand -hex 32)
            echo -n "$NETWORK_KEY" > /var/lib/etrid/chains/primearc_core_mainnet_v1/network/secret_ed25519
            chmod 600 /var/lib/etrid/chains/primearc_core_mainnet_v1/network/secret_ed25519
            echo "✅ Network key generated"

            # AURA key
            /usr/local/bin/primearc-core-node key generate --scheme sr25519 --output-type json 2>/dev/null > /tmp/aura_key.json
            AURA_SECRET=$(cat /tmp/aura_key.json | grep -o '"secretPhrase":"[^"]*"' | cut -d'"' -f4)

            /usr/local/bin/primearc-core-node key insert \
                --base-path /var/lib/etrid \
                --chain /var/lib/etrid/chainspec-mainnet.json \
                --key-type aura \
                --scheme sr25519 \
                --suri "$AURA_SECRET" 2>/dev/null

            # GRANDPA key
            /usr/local/bin/primearc-core-node key generate --scheme ed25519 --output-type json 2>/dev/null > /tmp/gran_key.json
            GRAN_SECRET=$(cat /tmp/gran_key.json | grep -o '"secretPhrase":"[^"]*"' | cut -d'"' -f4)

            /usr/local/bin/primearc-core-node key insert \
                --base-path /var/lib/etrid \
                --chain /var/lib/etrid/chainspec-mainnet.json \
                --key-type gran \
                --scheme ed25519 \
                --suri "$GRAN_SECRET" 2>/dev/null

            # ASF key (same as AURA)
            /usr/local/bin/primearc-core-node key insert \
                --base-path /var/lib/etrid \
                --chain /var/lib/etrid/chainspec-mainnet.json \
                --key-type asfk \
                --scheme sr25519 \
                --suri "$AURA_SECRET" 2>/dev/null

            echo "✅ Session keys generated"
            echo "AURA/ASF: $AURA_SECRET"
            echo "GRANDPA: $GRAN_SECRET"
ENDKEYS
)

        echo "$KEYS_OUTPUT"
        echo "$KEYS_OUTPUT" > "$LOG_DIR/${VM_NAME}_keys.txt"

        echo ""
        echo "[$VM_NAME] Step 6: Creating Systemd Service"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "root@$VM_NAME" bash << ENDSERVICE
cat > /etc/systemd/system/flarechain-validator.service << 'EOFSERVICE'
[Unit]
Description=Primearc Core Validator Node (Validator-${VALIDATOR_NUM})
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/lib/etrid
ExecStart=/usr/local/bin/primearc-core-node \\
    --base-path /var/lib/etrid \\
    --chain /var/lib/etrid/chainspec-mainnet.json \\
    --validator \\
    --name "Validator-${VALIDATOR_NUM}" \\
    --bootnodes ${BOOTNODE_GIZZI} \\
    --port 30333 \\
    --prometheus-port 9615 \\
    --prometheus-external \\
    --rpc-port 9944 \\
    --rpc-cors all \\
    --unsafe-rpc-external

Restart=always
RestartSec=10
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOFSERVICE

systemctl daemon-reload
systemctl enable flarechain-validator > /dev/null 2>&1
echo "✅ Service created and enabled"
ENDSERVICE

        echo ""
        echo "[$VM_NAME] Step 7: Starting Validator"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "root@$VM_NAME" bash << 'ENDSTART'
            systemctl start flarechain-validator
            sleep 5
            if systemctl is-active --quiet flarechain-validator; then
                echo "✅ Validator is running"
                systemctl status flarechain-validator --no-pager | head -10
            else
                echo "❌ Validator failed to start"
                journalctl -u flarechain-validator -n 20 --no-pager
                exit 1
            fi
ENDSTART

        echo ""
        echo "╔══════════════════════════════════════════════════════════════════════╗"
        echo "║  ✅ [$VM_NAME] DEPLOYMENT COMPLETE (Validator-$VALIDATOR_NUM)        ║"
        echo "╚══════════════════════════════════════════════════════════════════════╝"

    } >> "$LOG_FILE" 2>&1

    if [ $? -eq 0 ]; then
        echo "✅ [$VM_NAME] Deployment successful" | tee -a "$LOG_FILE"
    else
        echo "❌ [$VM_NAME] Deployment failed - check $LOG_FILE" | tee -a "$LOG_FILE"
    fi
}

# Deploy to all VMs in parallel
echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "Starting parallel deployment to $VM_COUNT VMs..."
echo "═══════════════════════════════════════════════════════════════════════"
echo ""

VALIDATOR_NUM=1
for VM in $VMS; do
    deploy_to_vm "$VM" "$VALIDATOR_NUM" &
    VALIDATOR_NUM=$((VALIDATOR_NUM + 1))
    # Stagger deployments by 5 seconds to avoid overwhelming the network
    sleep 5
done

# Wait for all deployments to complete
echo ""
echo "Waiting for all deployments to complete..."
wait

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "Deployment Summary"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""

SUCCESS_COUNT=0
FAIL_COUNT=0

for VM in $VMS; do
    LOG_FILE="$LOG_DIR/${VM}.log"
    if grep -q "✅.*DEPLOYMENT COMPLETE" "$LOG_FILE" 2>/dev/null; then
        echo "✅ $VM - Deployed successfully"
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
    else
        echo "❌ $VM - Deployment failed"
        FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
done

echo ""
echo "Results: $SUCCESS_COUNT successful, $FAIL_COUNT failed"
echo ""
echo "Logs saved to: $LOG_DIR"
echo "Session keys saved to: $LOG_DIR/*_keys.txt"
echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "Next Steps"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""
echo "1. Check node status on any VM:"
echo "   ssh root@<vm-name> 'systemctl status flarechain-validator'"
echo ""
echo "2. View logs:"
echo "   ssh root@<vm-name> 'journalctl -u flarechain-validator -f'"
echo ""
echo "3. Check peers (after 60 seconds):"
echo "   ssh root@<vm-name> 'journalctl -u flarechain-validator | grep peers'"
echo ""
echo "4. Check all validators:"
echo "   for vm in $VMS; do echo \"=== \$vm ===\";"
echo "   ssh root@\$vm 'journalctl -u flarechain-validator -n 5 | grep -E \"(Syncing|peers)\"'; done"
echo ""
