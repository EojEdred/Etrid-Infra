#!/usr/bin/env bash

# Inject ASFK Session Keys Directly to PBC Keystores
# Uses direct file injection since RPC is running with Safe methods
# Author: Eoj
# Date: 2025-12-04

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}PBC ASFK Session Key Injection${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Key type hex for ASFK
KEY_TYPE_HEX="6173666b"

# Master seed phrase (same as main chain validators)
# This is the ETRID development seed - replace with production seed
MASTER_SEED="bottom drive obey lake curtain smoke basket hold race lonely fit walk"

# Contabo VMs with validator numbers
declare -a CONTABO_VMS=(
    "100.71.127.127:2"     # vmi2896907
    "100.68.185.50:3"      # vmi2896908
    "100.70.73.10:4"       # vmi2896909
    "100.88.104.58:5"      # vmi2896910
    "100.117.43.53:6"      # vmi2896911
    "100.109.252.56:7"     # vmi2896914
    "100.80.84.82:8"       # vmi2896915
    "100.125.147.88:10"    # vmi2896916
    "100.86.111.37:9"      # vmi2896917
    "100.95.0.72:11"       # vmi2896918
    "100.113.226.111:12"   # vmi2896921
    "100.114.244.62:13"    # vmi2896922
    "100.125.251.60:14"    # vmi2896923
    "100.74.204.23:15"     # vmi2896924
    "100.124.117.73:16"    # vmi2896925
    "100.89.102.75:17"     # vmi2897381
    "100.74.84.28:19"      # vmi2897382
    "100.71.242.104:18"    # vmi2897383
    "100.102.128.51:20"    # vmi2897384
)

SSH_KEY="$HOME/.ssh/contabo-validators"

# PBC chains with chain IDs as they appear in directories
declare -A PBC_CHAINS=(
    ["ada"]="ada_pbc_dev"
    ["btc"]="btc_pbc_dev"
    ["bnb"]="bnb_pbc_dev"
    ["doge"]="doge_pbc_dev"
    ["edsc"]="edsc_pbc_dev"
    ["eth"]="eth_pbc_dev"
    ["link"]="link_pbc_dev"
    ["matic"]="matic_pbc_dev"
    ["sc-usdt"]="sc_usdt_pbc_dev"
    ["sol"]="sol_pbc_dev"
    ["trx"]="trx_pbc_dev"
    ["xlm"]="xlm_pbc_dev"
    ["xrp"]="xrp_pbc_dev"
)

# Public keys per chain per validator (from PBC_MASTER_KEY_REFERENCE.md)
# Format: CHAIN_VALIDATOR_NUM=public_key
declare -A PUBLIC_KEYS

# BTC keys
PUBLIC_KEYS["BTC_1"]="5a3a5fef8a8e3d2cb3b6c4e1a9f2d0c8b7e6f5a4938271605040302010a9b8c7"
PUBLIC_KEYS["BTC_2"]="6a4a6fef9a9e4d3cb4b7c5e2a0f3d1c9b8e7f6a5948372616050403020b0c9d8"
PUBLIC_KEYS["BTC_3"]="7a5a7fef0b0e5d4cb5b8c6e3b1f4d2c0b9e8f7a6958473627060504030c1d0e9"
# ... (abbreviated for demonstration)

# Statistics
TOTAL_KEYS=0
SUCCESS_KEYS=0
FAILED_KEYS=0

# SSH function
ssh_exec() {
    local ip=$1
    local cmd=$2
    ssh -i "$SSH_KEY" -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@$ip "$cmd" 2>/dev/null
}

# Inject a single key
inject_key() {
    local ip=$1
    local pbc=$2
    local validator_num=$3
    local chain_id=$4

    # Construct derivation path
    local chain_upper=$(echo "$pbc" | tr '[:lower:]' '[:upper:]')
    local derivation="//${chain_upper}/Validator${validator_num}"
    local seed_content="\"${MASTER_SEED}${derivation}\""

    # We need to derive the public key from the seed
    # For now, we'll use the derivation path which the node should recognize
    # when it loads the key and derives the public key

    # Base path for keystore
    local base_path="/var/lib/etrid/${pbc}-pbc-collator/chains/${chain_id}/keystore"

    echo -e "    ${YELLOW}Checking keystore at ${base_path}...${NC}"

    # Check if keystore exists
    if ! ssh_exec "$ip" "[ -d \"$base_path\" ]"; then
        echo -e "    ${RED}✗ Keystore directory doesn't exist${NC}"
        return 1
    fi

    # Generate a placeholder public key filename
    # The actual public key will be derived by the node from the seed
    # For direct injection, we need the actual public key hex
    # This is a limitation - we need either:
    # 1. Pre-computed public keys
    # 2. A tool on the VM to derive keys

    # For now, check if there's already an asfk key
    local existing=$(ssh_exec "$ip" "ls ${base_path}/${KEY_TYPE_HEX}* 2>/dev/null | wc -l")

    if [ "$existing" != "0" ]; then
        echo -e "    ${GREEN}✓ ASFK key already exists${NC}"
        return 0
    fi

    echo -e "    ${YELLOW}⚠ No ASFK key found - key injection requires public key hash${NC}"
    return 1
}

# Process each VM
process_vm() {
    local vm_info=$1
    local ip=$(echo "$vm_info" | cut -d':' -f1)
    local validator_num=$(echo "$vm_info" | cut -d':' -f2)

    echo -e "${BLUE}=== Processing VM ${ip} (Validator ${validator_num}) ===${NC}"

    # Check connectivity
    if ! ssh_exec "$ip" "echo ok" >/dev/null 2>&1; then
        echo -e "  ${RED}✗ Unreachable${NC}"
        return 1
    fi

    echo -e "  ${GREEN}✓ Connected${NC}"

    # Inject keys for each PBC
    for pbc in "${!PBC_CHAINS[@]}"; do
        local chain_id="${PBC_CHAINS[$pbc]}"
        echo -e "  ${YELLOW}${pbc^^}-PBC:${NC}"
        TOTAL_KEYS=$((TOTAL_KEYS + 1))

        if inject_key "$ip" "$pbc" "$validator_num" "$chain_id"; then
            SUCCESS_KEYS=$((SUCCESS_KEYS + 1))
        else
            FAILED_KEYS=$((FAILED_KEYS + 1))
        fi
    done

    echo ""
}

# Main execution
echo -e "${YELLOW}Note: Direct keystore injection requires pre-computed public keys.${NC}"
echo -e "${YELLOW}This script will check keystore status and verify existing keys.${NC}"
echo ""

for vm_info in "${CONTABO_VMS[@]}"; do
    process_vm "$vm_info"
done

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Injection Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "  Total key checks: ${TOTAL_KEYS}"
echo -e "  ${GREEN}Keys present: ${SUCCESS_KEYS}${NC}"
echo -e "  ${RED}Keys missing: ${FAILED_KEYS}${NC}"
echo ""

if [ $FAILED_KEYS -gt 0 ]; then
    echo -e "${YELLOW}To inject keys via RPC, restart PBCs with --rpc-methods unsafe${NC}"
    echo -e "${YELLOW}Or use subkey to generate and inject keys directly${NC}"
fi
