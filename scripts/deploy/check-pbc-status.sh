#!/bin/bash
# Check status of all validators and PBC collators
# Each VM runs primearc + all PBCs
# Usage: ./check-pbc-status.sh [--vm=ts-val-XX]

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

get_ssh_key() {
    case "$1" in
        ts-val-01|ts-val-02) echo "$SSH_KEY_ORACLE" ;;
        *) echo "$SSH_KEY_CONTABO" ;;
    esac
}

# Parse arguments
TARGET_VM=""
for arg in "$@"; do
    case $arg in
        --vm=*) TARGET_VM="${arg#*=}" ;;
    esac
done

echo "=========================================="
echo "  ËTRID Validator Status"
echo "=========================================="
echo ""
printf "%-12s %-10s %-12s %-8s %-10s\n" "VM" "STATUS" "BLOCK" "PEERS" "BINARY"
echo "----------------------------------------------------------------"

check_vm() {
    local vm=$1
    local ssh_key=$(get_ssh_key "$vm")

    # Check connectivity
    if ! ssh -i $ssh_key -o ConnectTimeout=5 $vm "echo ok" &>/dev/null 2>&1; then
        printf "%-12s %-10s %-12s %-8s %-10s\n" "$vm" "OFFLINE" "-" "-" "-"
        return
    fi

    # Check for running service
    status=$(ssh -i $ssh_key $vm "systemctl is-active primearc-core-node 2>/dev/null || systemctl is-active etrid-validator 2>/dev/null || echo 'stopped'" 2>/dev/null)

    # Get block height
    block="N/A"
    peers="N/A"
    if [ "$status" = "active" ]; then
        block=$(ssh -i $ssh_key $vm 'curl -s localhost:9944 -H "Content-Type: application/json" -d "{\"jsonrpc\":\"2.0\",\"method\":\"chain_getHeader\",\"params\":[],\"id\":1}" 2>/dev/null | jq -r ".result.number // \"N/A\""' 2>/dev/null || echo "N/A")
        peers=$(ssh -i $ssh_key $vm 'curl -s localhost:9944 -H "Content-Type: application/json" -d "{\"jsonrpc\":\"2.0\",\"method\":\"system_health\",\"params\":[],\"id\":1}" 2>/dev/null | jq -r ".result.peers // \"N/A\""' 2>/dev/null || echo "N/A")
    fi

    # Check which binary exists
    binary=$(ssh -i $ssh_key $vm "ls /opt/etrid/bin/ 2>/dev/null | head -1" 2>/dev/null || echo "none")

    # Color status
    case "$status" in
        active) status_display="✓ RUNNING" ;;
        stopped|inactive) status_display="✗ STOPPED" ;;
        *) status_display="? $status" ;;
    esac

    printf "%-12s %-10s %-12s %-8s %-10s\n" "$vm" "$status_display" "$block" "$peers" "$binary"
}

if [ -n "$TARGET_VM" ]; then
    check_vm "$TARGET_VM"
else
    for vm in "${VALIDATORS[@]}"; do
        check_vm "$vm"
    done
fi

echo ""
echo "=========================================="

# Summary
echo ""
echo "Binary locations: /opt/etrid/bin/"
echo "Service names: primearc-core-node, etrid-validator"
echo ""
echo "Quick commands:"
echo "  Restart all: ./restart-pbcs.sh"
echo "  Restart one: ./restart-pbcs.sh --vm=ts-val-01"
echo "  View logs:   ssh ts-val-XX 'journalctl -u primearc-core-node -f'"
