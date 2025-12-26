#!/bin/bash
# Deploy built binary and chain spec from build VM to all VMs

BUILD_VM="vmi2896906"
VMS="vmi2896906 vmi2896907 vmi2896908 vmi2896909 vmi2896910 vmi2896911 vmi2896914 vmi2896915 vmi2896916 vmi2896917 vmi2896918 vmi2896921 vmi2896922 vmi2896923 vmi2896924 vmi2896925 vmi2897381 vmi2897382 vmi2897383 vmi2897384"
SSH_KEY="$HOME/.ssh/contabo-validators"

echo "═══════════════════════════════════════════════════════════════════════"
echo "Deploying Primearc Core to all VMs"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""

# First, copy files from build VM to local machine
echo "Copying files from build VM..."
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no "root@$BUILD_VM:/opt/etrid-build/target/release/etrid" /tmp/etrid-binary
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no "root@$BUILD_VM:/tmp/flarechain-mainnet-v108-raw.json" /tmp/chainspec.json
echo "✅ Files copied to local machine"
echo ""

# Deploy to all VMs
for VM in $VMS; do
    echo "Deploying to $VM..."

    # Stop service
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "root@$VM" 'systemctl stop flarechain-validator' 2>/dev/null

    # Deploy binary
    cat /tmp/etrid-binary | ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "root@$VM" \
        'cat > /usr/local/bin/primearc-core-node && chmod +x /usr/local/bin/primearc-core-node'

    # Deploy chain spec
    cat /tmp/chainspec.json | ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "root@$VM" \
        'cat > /var/lib/etrid/chainspec-mainnet.json'

    # Start service
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "root@$VM" 'systemctl start flarechain-validator' 2>/dev/null

    echo "✅ $VM deployed"
done

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "Deployment Complete! Waiting for services to start..."
echo "═══════════════════════════════════════════════════════════════════════"
sleep 15

echo ""
echo "Checking status..."
ACTIVE=0
ACTIVATING=0
FAILED=0

for VM in $VMS; do
    STATUS=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=5 "root@$VM" 'systemctl is-active flarechain-validator 2>/dev/null' 2>/dev/null)
    if [ "$STATUS" = "active" ]; then
        echo "✅ $VM: ACTIVE"
        ACTIVE=$((ACTIVE + 1))
    elif [ "$STATUS" = "activating" ]; then
        echo "🔄 $VM: ACTIVATING"
        ACTIVATING=$((ACTIVATING + 1))
    else
        echo "❌ $VM: $STATUS"
        FAILED=$((FAILED + 1))
    fi
done

echo ""
echo "Summary: $ACTIVE active, $ACTIVATING activating, $FAILED failed"
echo ""

# Clean up temp files
rm -f /tmp/etrid-binary /tmp/chainspec.json
