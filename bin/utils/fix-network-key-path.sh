#!/bin/bash
# Quick fix to move network keys to correct path

VMS="vmi2896906 vmi2896907 vmi2896908 vmi2896909 vmi2896910 vmi2896911 vmi2896914 vmi2896915 vmi2896916 vmi2896917 vmi2896918 vmi2896921 vmi2896922 vmi2896923 vmi2896924 vmi2896925 vmi2897381 vmi2897382 vmi2897383 vmi2897384"
SSH_KEY="$HOME/.ssh/contabo-validators"

for VM in $VMS; do
    echo "Fixing $VM..."
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "root@$VM" bash << 'EOF'
        # Stop the service first
        systemctl stop primearc-core-validator 2>/dev/null

        # Create correct directory
        mkdir -p /var/lib/etrid/chains/primearc_core_mainnet_v1/network
        mkdir -p /var/lib/etrid/chains/primearc_core_mainnet_v1/keystore

        # Generate network key if not exists
        if [ ! -f /var/lib/etrid/chains/primearc_core_mainnet_v1/network/secret_ed25519 ]; then
            NETWORK_KEY=$(openssl rand -hex 32)
            echo -n "$NETWORK_KEY" > /var/lib/etrid/chains/primearc_core_mainnet_v1/network/secret_ed25519
            chmod 600 /var/lib/etrid/chains/primearc_core_mainnet_v1/network/secret_ed25519
        fi

        # Start the service
        systemctl restart primearc-core-validator

        echo "✅ Fixed"
EOF
    echo "Done with $VM"
done

echo ""
echo "All VMs fixed! Checking status..."
sleep 5

for VM in $VMS; do
    echo "=== $VM ==="
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no "root@$VM" 'systemctl is-active primearc-core-validator'
done
