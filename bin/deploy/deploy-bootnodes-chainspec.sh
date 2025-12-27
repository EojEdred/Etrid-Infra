#!/bin/bash
# Deploy chain spec with bootnodes to all VMs

SSH_KEY="$HOME/.ssh/contabo-validators"

VMS=(
  vmi2896906
  vmi2896907
  vmi2896908
  vmi2896909
  vmi2896910
  vmi2896911
  vmi2896914
  vmi2896915
  vmi2896916
  vmi2896917
  vmi2896918
  vmi2896921
  vmi2896922
  vmi2896923
  vmi2896924
  vmi2896925
  vmi2897381
  vmi2897382
  vmi2897383
  vmi2897384
)

echo "Deploying chain spec with 19 bootnodes to all VMs..."
echo ""

for VM in "${VMS[@]}"; do
    echo "Updating $VM..."

    # Stop service
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "root@$VM" 'systemctl stop flarechain-validator' 2>/dev/null

    # Deploy chain spec
    cat /tmp/chainspec-with-bootnodes.json | ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "root@$VM" \
        'cat > /var/lib/etrid/chainspec-mainnet.json'

    # Start service
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "root@$VM" 'systemctl start flarechain-validator' 2>/dev/null

    echo "✅ $VM updated"
done

echo ""
echo "All VMs updated! Waiting 30 seconds for services to start and peer..."
sleep 30

echo ""
echo "Checking status and peer connections..."
ACTIVE=0
ACTIVATING=0
FAILED=0

for VM in "${VMS[@]}"; do
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
