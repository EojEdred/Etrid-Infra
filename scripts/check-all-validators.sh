#!/bin/bash
# Check status of all validators

VMS="vmi2896906 vmi2896907 vmi2896908 vmi2896909 vmi2896910 vmi2896911 vmi2896914 vmi2896915 vmi2896916 vmi2896917 vmi2896918 vmi2896921 vmi2896922 vmi2896923 vmi2896924 vmi2896925 vmi2897381 vmi2897382 vmi2897383 vmi2897384"
SSH_KEY="$HOME/.ssh/contabo-validators"

echo "═══════════════════════════════════════════════════════════════════════"
echo "Primearc Core Validator Status Check"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""

ACTIVE=0
INACTIVE=0

for VM in $VMS; do
    STATUS=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=5 "root@$VM" 'systemctl is-active flarechain-validator 2>/dev/null' 2>/dev/null)
    if [ "$STATUS" = "active" ]; then
        echo "✅ $VM: ACTIVE"
        ACTIVE=$((ACTIVE + 1))
    else
        echo "❌ $VM: $STATUS"
        INACTIVE=$((INACTIVE + 1))
    fi
done

echo ""
echo "═══════════════════════════════════════════════════════════════════════"
echo "Summary: $ACTIVE active, $INACTIVE inactive"
echo "═══════════════════════════════════════════════════════════════════════"
echo ""

if [ $ACTIVE -gt 0 ]; then
    echo "Checking sample logs from first active node..."
    for VM in $VMS; do
        STATUS=$(ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=5 "root@$VM" 'systemctl is-active flarechain-validator 2>/dev/null' 2>/dev/null)
        if [ "$STATUS" = "active" ]; then
            echo "=== $VM Logs ==="
            ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "root@$VM" 'journalctl -u flarechain-validator -n 10 --no-pager | grep -E "(Syncing|peers|Imported|best)"' 2>/dev/null
            break
        fi
    done
fi
