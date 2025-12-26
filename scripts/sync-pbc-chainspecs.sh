#!/usr/bin/env bash

# Sync Authoritative PBC Chainspecs to All Validators
# Ensures all VMs have identical genesis configuration
# Author: Eoj
# Date: 2025-12-03

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}PBC Chainspec Synchronization${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Source VM with authoritative chainspecs
SOURCE_VM="100.71.127.127"
CHAINSPEC_DIR="/var/lib/etrid/chainspecs"

# All target VMs (Tailscale IPs) - excluding source
declare -a TARGET_VMS=(
    "100.68.185.50"    # vmi2896908
    "100.70.73.10"     # vmi2896909
    "100.88.104.58"    # vmi2896910
    "100.117.43.53"    # vmi2896911
    "100.109.252.56"   # vmi2896914
    "100.80.84.82"     # vmi2896915
    "100.125.147.88"   # vmi2896916
    "100.86.111.37"    # vmi2896917
    "100.95.0.72"      # vmi2896918
    "100.113.226.111"  # vmi2896921
    "100.114.244.62"   # vmi2896922
    "100.125.251.60"   # vmi2896923
    "100.74.204.23"    # vmi2896924
    "100.124.117.73"   # vmi2896925
    "100.89.102.75"    # vmi2897381
    "100.74.84.28"     # vmi2897382
    "100.71.242.104"   # vmi2897383
    "100.102.128.51"   # vmi2897384
)

# Oracle Cloud VMs
declare -a ORACLE_VMS=(
    "100.96.84.69"     # gizzi
    "100.70.242.106"   # auditdev
)

SSH_KEY="$HOME/.ssh/contabo-validators"
SSH_KEY_ORACLE="$HOME/.ssh/gizzi-validator"

# PBC chainspec files
declare -a PBC_SPECS=(
    "ada-pbc-spec.json"
    "bnb-pbc-spec.json"
    "btc-pbc-spec.json"
    "doge-pbc-spec.json"
    "edsc-pbc-spec.json"
    "eth-pbc-spec.json"
    "link-pbc-spec.json"
    "matic-pbc-spec.json"
    "sc-usdt-pbc-spec.json"
    "sol-pbc-spec.json"
    "trx-pbc-spec.json"
    "xlm-pbc-spec.json"
    "xrp-pbc-spec.json"
)

# Statistics
SUCCESS=0
FAILED=0

# SSH function
ssh_exec() {
    local ip=$1
    local cmd=$2
    local key=${3:-$SSH_KEY}
    ssh -i "$key" -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@$ip "$cmd" 2>/dev/null
}

# SCP function
scp_file() {
    local src_ip=$1
    local src_path=$2
    local dst_ip=$3
    local dst_path=$4
    local key=${5:-$SSH_KEY}

    # Use ssh to pipe file from source to destination
    ssh -i "$key" -o StrictHostKeyChecking=no root@$src_ip "cat $src_path" 2>/dev/null | \
        ssh -i "$key" -o StrictHostKeyChecking=no root@$dst_ip "cat > $dst_path" 2>/dev/null
}

# Sync chainspecs to a single VM
sync_chainspecs() {
    local target_ip=$1
    local key=${2:-$SSH_KEY}

    echo -e "${YELLOW}Syncing chainspecs to: ${target_ip}${NC}"

    # Check connectivity
    if ! ssh_exec "$target_ip" "echo 'ok'" "$key" >/dev/null 2>&1; then
        echo -e "  ${RED}✗ Unreachable${NC}"
        return 1
    fi

    echo -e "  ${GREEN}✓ Connected${NC}"

    # Ensure directory exists
    ssh_exec "$target_ip" "mkdir -p $CHAINSPEC_DIR" "$key"

    # Get MD5 of source chainspecs for verification
    local sync_count=0
    local fail_count=0

    for spec in "${PBC_SPECS[@]}"; do
        # Get source MD5
        local src_md5=$(ssh_exec "$SOURCE_VM" "md5sum $CHAINSPEC_DIR/$spec | cut -d' ' -f1" "$SSH_KEY")

        # Get target MD5 (if exists)
        local dst_md5=$(ssh_exec "$target_ip" "md5sum $CHAINSPEC_DIR/$spec 2>/dev/null | cut -d' ' -f1" "$key" || echo "none")

        if [ "$src_md5" = "$dst_md5" ]; then
            echo -e "    ${GREEN}✓ $spec (already synced)${NC}"
            ((sync_count++))
        else
            # Copy file
            echo -e "    ${YELLOW}Copying $spec...${NC}"
            if scp_file "$SOURCE_VM" "$CHAINSPEC_DIR/$spec" "$target_ip" "$CHAINSPEC_DIR/$spec" "$key"; then
                # Verify
                local new_md5=$(ssh_exec "$target_ip" "md5sum $CHAINSPEC_DIR/$spec | cut -d' ' -f1" "$key")
                if [ "$src_md5" = "$new_md5" ]; then
                    echo -e "    ${GREEN}✓ $spec (synced)${NC}"
                    ((sync_count++))
                else
                    echo -e "    ${RED}✗ $spec (MD5 mismatch)${NC}"
                    ((fail_count++))
                fi
            else
                echo -e "    ${RED}✗ $spec (copy failed)${NC}"
                ((fail_count++))
            fi
        fi
    done

    if [ $fail_count -eq 0 ]; then
        echo -e "  ${GREEN}✓ All chainspecs synced ($sync_count specs)${NC}"
        return 0
    else
        echo -e "  ${YELLOW}⚠ Partial sync: $sync_count synced, $fail_count failed${NC}"
        return 1
    fi
}

# First, verify source chainspecs exist
echo -e "${BLUE}Step 1: Verifying source chainspecs on ${SOURCE_VM}${NC}"
echo ""

src_count=$(ssh_exec "$SOURCE_VM" "ls -1 $CHAINSPEC_DIR/*.json 2>/dev/null | wc -l" "$SSH_KEY")
echo -e "Found ${GREEN}${src_count}${NC} chainspec files on source VM"

if [ "$src_count" -lt 13 ]; then
    echo -e "${RED}ERROR: Expected 13 chainspecs, found $src_count${NC}"
    exit 1
fi

# Sync to Contabo VMs
echo ""
echo -e "${BLUE}Step 2: Syncing to Contabo VMs${NC}"
echo ""

for ip in "${TARGET_VMS[@]}"; do
    if sync_chainspecs "$ip" "$SSH_KEY"; then
        SUCCESS=$((SUCCESS + 1))
    else
        FAILED=$((FAILED + 1))
    fi
    echo ""
done

# Sync to Oracle Cloud VMs
echo ""
echo -e "${BLUE}Step 3: Syncing to Oracle Cloud VMs${NC}"
echo ""

for ip in "${ORACLE_VMS[@]}"; do
    if sync_chainspecs "$ip" "$SSH_KEY_ORACLE"; then
        SUCCESS=$((SUCCESS + 1))
    else
        FAILED=$((FAILED + 1))
    fi
    echo ""
done

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Sync Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "  ${GREEN}Successfully synced: ${SUCCESS} VMs${NC}"
echo -e "  ${RED}Failed: ${FAILED} VMs${NC}"
echo ""
echo -e "${GREEN}Chainspecs are now synchronized across all VMs${NC}"
echo ""
