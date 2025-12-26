#!/bin/bash

# Primearc Core Mainnet - New Contabo Validator Deployment Script
# This script sets up a new Contabo VM as a Primearc Core validator

set -e

VALIDATOR_NUM=$1
VM_IP=$2
VALIDATOR_NAME=$3

if [ -z "$VALIDATOR_NUM" ] || [ -z "$VM_IP" ]; then
    echo "Usage: $0 <validator_number> <vm_ip> [validator_name]"
    echo ""
    echo "Example: $0 26 157.173.200.100 \"stlouis-vn05\""
    exit 1
fi

if [ -z "$VALIDATOR_NAME" ]; then
    VALIDATOR_NAME="Validator-$VALIDATOR_NUM"
fi

SSH_KEY="$HOME/.ssh/contabo-validators"
BOOTNODE_GIZZI="/ip4/64.181.215.19/tcp/30333/p2p/12D3KooWPyfp2DECPKTmJ1AhxB6midHnp7wYTP15vBAxbTewxaq1"
BOOTNODE_VAL6="/ip4/85.239.239.194/tcp/30333/p2p/12D3KooWSrYpSQ6SiDR3uduqbiepyfVp8xmaC8mzY6RmU29MEHGv"

echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║    Primearc Core Mainnet - New Validator Deployment                    ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Validator Number: $VALIDATOR_NUM"
echo "VM IP:           $VM_IP"
echo "Name:            $VALIDATOR_NAME"
echo ""
read -p "Continue? (y/n): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "Step 1: Opening Firewall (Port 30333)"
echo "═══════════════════════════════════════════════════════════════════════"

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "root@$VM_IP" bash << 'ENDFIREWALL'
    # Check if rule already exists
    if sudo iptables -L INPUT -n | grep -q "tcp dpt:30333"; then
        echo "✅ Port 30333 already open"
    else
        echo "Opening port 30333..."
        sudo iptables -I INPUT 1 -p tcp --dport 30333 -m comment --comment "Primearc Core P2P" -j ACCEPT
        echo "✅ Port 30333 opened"
    fi
    
    # Install and save
    if ! command -v netfilter-persistent &> /dev/null; then
        echo "Installing iptables-persistent..."
        DEBIAN_FRONTEND=noninteractive apt-get install -y iptables-persistent > /dev/null 2>&1
    fi
    netfilter-persistent save > /dev/null 2>&1
    echo "✅ Firewall rules saved"
ENDFIREWALL

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "Step 2: Creating Directory Structure"
echo "═══════════════════════════════════════════════════════════════════════"

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "root@$VM_IP" bash << 'ENDDIRS'
    mkdir -p /var/lib/etrid/chains/primearc_core_mainnet/network
    mkdir -p /var/lib/etrid/chains/primearc_core_mainnet/keystore
    mkdir -p /usr/local/bin
    echo "✅ Directories created"
ENDDIRS

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "Step 3: Deploying Binary and Chainspec"
echo "═══════════════════════════════════════════════════════════════════════"

# Copy binary from existing validator
echo "Copying primearc-core-node binary..."
ssh -i "$SSH_KEY" root@85.239.239.194 'cat /usr/local/bin/primearc-core-node' | \
    ssh -i "$SSH_KEY" "root@$VM_IP" 'cat > /usr/local/bin/primearc-core-node && chmod +x /usr/local/bin/primearc-core-node'

# Copy chainspec
echo "Copying chainspec..."
ssh -i "$SSH_KEY" root@85.239.239.194 'cat /var/lib/etrid/chainspec-mainnet-raw-FIXED.json' | \
    ssh -i "$SSH_KEY" "root@$VM_IP" 'cat > /var/lib/etrid/chainspec-mainnet-raw-FIXED.json'

echo "✅ Binary and chainspec deployed"

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "Step 4: Generating Keys"
echo "═══════════════════════════════════════════════════════════════════════"

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "root@$VM_IP" bash << 'ENDKEYS'
    # Network key
    NETWORK_KEY=$(openssl rand -hex 32)
    echo -n "$NETWORK_KEY" > /var/lib/etrid/chains/primearc_core_mainnet/network/secret_ed25519
    chmod 600 /var/lib/etrid/chains/primearc_core_mainnet/network/secret_ed25519
    echo "✅ Network key generated"
    
    # AURA key
    /usr/local/bin/primearc-core-node key generate --scheme sr25519 --output-type json > /tmp/aura_key.json
    AURA_SECRET=$(cat /tmp/aura_key.json | grep -o '"secretPhrase":"[^"]*"' | cut -d'"' -f4)
    
    /usr/local/bin/primearc-core-node key insert \
        --base-path /var/lib/etrid \
        --chain /var/lib/etrid/chainspec-mainnet-raw-FIXED.json \
        --key-type aura \
        --scheme sr25519 \
        --suri "$AURA_SECRET"
    
    # GRANDPA key
    /usr/local/bin/primearc-core-node key generate --scheme ed25519 --output-type json > /tmp/gran_key.json
    GRAN_SECRET=$(cat /tmp/gran_key.json | grep -o '"secretPhrase":"[^"]*"' | cut -d'"' -f4)
    
    /usr/local/bin/primearc-core-node key insert \
        --base-path /var/lib/etrid \
        --chain /var/lib/etrid/chainspec-mainnet-raw-FIXED.json \
        --key-type gran \
        --scheme ed25519 \
        --suri "$GRAN_SECRET"
    
    # ASF key (same as AURA)
    /usr/local/bin/primearc-core-node key insert \
        --base-path /var/lib/etrid \
        --chain /var/lib/etrid/chainspec-mainnet-raw-FIXED.json \
        --key-type asfk \
        --scheme sr25519 \
        --suri "$AURA_SECRET"
    
    # Save for documentation
    echo "VALIDATOR-$VALIDATOR_NUM" > /tmp/validator_keys.txt
    echo "AURA/ASF: $AURA_SECRET" >> /tmp/validator_keys.txt
    echo "GRANDPA: $GRAN_SECRET" >> /tmp/validator_keys.txt
    
    echo "✅ Session keys generated"
    echo ""
    echo "Keys:"
    cat /tmp/validator_keys.txt
ENDKEYS

echo ""
echo "⚠️  IMPORTANT: Save the keys shown above to the master secrets file!"
echo ""

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "Step 5: Creating Systemd Service"
echo "═══════════════════════════════════════════════════════════════════════"

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "root@$VM_IP" bash << ENDSERVICE
cat > /etc/systemd/system/flarechain-validator.service << 'EOFSERVICE'
[Unit]
Description=Primearc Core Validator Node ($VALIDATOR_NAME)
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=/var/lib/etrid
ExecStart=/usr/local/bin/primearc-core-node \\
    --base-path /var/lib/etrid \\
    --chain /var/lib/etrid/chainspec-mainnet-raw-FIXED.json \\
    --validator \\
    --name "$VALIDATOR_NAME" \\
    --bootnodes $BOOTNODE_GIZZI \\
    --bootnodes $BOOTNODE_VAL6 \\
    --public-addr "/ip4/$VM_IP/tcp/30333" \\
    --port 30333 \\
    --prometheus-port 9615 \\
    --prometheus-external

Restart=always
RestartSec=10
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOFSERVICE

systemctl daemon-reload
systemctl enable flarechain-validator
echo "✅ Service created and enabled"
ENDSERVICE

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "Step 6: Starting Validator"
echo "═══════════════════════════════════════════════════════════════════════"

ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "root@$VM_IP" bash << 'ENDSTART'
    systemctl start flarechain-validator
    sleep 3
    systemctl status flarechain-validator --no-pager | head -10
ENDSTART

echo ""
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                    ✅ DEPLOYMENT COMPLETE                            ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Next Steps:"
echo "  1. Save session keys to master secrets file"
echo "  2. Monitor logs: ssh -i $SSH_KEY root@$VM_IP 'journalctl -u flarechain-validator -f'"
echo "  3. Wait 30 seconds and check peers: ssh -i $SSH_KEY root@$VM_IP 'journalctl -u flarechain-validator -n 5 | grep peers'"
echo ""
echo "Expected peer count after 30 seconds: 8-15 peers"
echo ""

