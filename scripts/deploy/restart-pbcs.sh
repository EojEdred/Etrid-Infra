#!/bin/bash
# Restart PBC services on ALL VMs
# Each VM runs primearc + all PBC collators
# Usage: ./restart-pbcs.sh [--vm=ts-val-XX] [--service=name]

set -e

SSH_KEY_ORACLE="~/.ssh/gizzi-validator"
SSH_KEY_CONTABO="~/.ssh/contabo-validators"

# All validator VMs
VALIDATORS=(
    "ts-val-01" "ts-val-02" "ts-val-03" "ts-val-04" "ts-val-05"
    "ts-val-06" "ts-val-07" "ts-val-08" "ts-val-09" "ts-val-10"
    "ts-val-11" "ts-val-12" "ts-val-13" "ts-val-14" "ts-val-15"
    "ts-val-16" "ts-val-17" "ts-val-18" "ts-val-19" "ts-val-20"
    "ts-val-21" "ts-val-22"
)

# All services that might be running
SERVICES=(
    "primearc-core-node"
    "etrid-validator"
    "pbc-collator"
    "eth-pbc-collator"
    "doge-pbc-collator"
    "ai-compute-pbc-collator"
)

get_ssh_key() {
    case "$1" in
        ts-val-01|ts-val-02) echo "$SSH_KEY_ORACLE" ;;
        *) echo "$SSH_KEY_CONTABO" ;;
    esac
}

# Parse arguments
TARGET_VM=""
TARGET_SERVICE=""
for arg in "$@"; do
    case $arg in
        --vm=*) TARGET_VM="${arg#*=}" ;;
        --service=*) TARGET_SERVICE="${arg#*=}" ;;
    esac
done

echo "=========================================="
echo "  Restarting ËTRID Services"
echo "=========================================="
echo ""

restart_vm_services() {
    local vm=$1
    local ssh_key=$(get_ssh_key "$vm")

    echo "Restarting services on $vm..."

    # Check connectivity
    if ! ssh -i $ssh_key -o ConnectTimeout=5 $vm "echo ok" &>/dev/null; then
        echo "  ⚠ Cannot connect to $vm, skipping..."
        return
    fi

    if [ -n "$TARGET_SERVICE" ]; then
        # Restart specific service
        ssh -i $ssh_key $vm "systemctl restart $TARGET_SERVICE 2>/dev/null || echo 'Service $TARGET_SERVICE not found'"
        echo "  ✓ Restarted $TARGET_SERVICE"
    else
        # Restart all known services
        for service in "${SERVICES[@]}"; do
            result=$(ssh -i $ssh_key $vm "systemctl restart $service 2>/dev/null && echo 'restarted' || echo 'not found'" 2>/dev/null)
            if [ "$result" = "restarted" ]; then
                echo "  ✓ Restarted $service"
            fi
        done
    fi
}

if [ -n "$TARGET_VM" ]; then
    # Restart specific VM
    restart_vm_services "$TARGET_VM"
else
    # Restart all VMs
    for vm in "${VALIDATORS[@]}"; do
        restart_vm_services "$vm"
    done
fi

echo ""
echo "Done! Check status with: ./check-pbc-status.sh"
