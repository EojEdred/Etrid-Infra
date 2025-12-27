#!/bin/bash
# Configure ASF session keys for all PBC validators
# Author: Eoj Edred
# Date: 2025-12-03

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}PBC Session Key Configuration${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Key mapping directory
KEY_DIR="/Users/macbook/Desktop/etrid/secrets/validator-keys"

# PBC infrastructure mapping
# IMPORTANT: Main chain uses 9944, PBCs start at 9945
# Updated to match start-pbc-network-production.sh
declare -A PBC_RPC_PORTS=(
    ["ada"]="9945"
    ["btc"]="9947"
    ["bnb"]="9960"
    ["doge"]="9948"
    ["edsc"]="9949"
    ["eth"]="9950"
    ["link"]="9951"
    ["matic"]="9952"
    ["usdt"]="9953"
    ["sol"]="9954"
    ["trx"]="9955"
    ["xlm"]="9956"
    ["xrp"]="9957"
)

declare -A PBC_VM_IPS=(
    ["btc"]="100.124.117.73"
    ["xrp"]="100.71.127.127"
    ["bnb"]="100.68.185.50"
    ["sol"]="100.70.73.10"
    ["ada"]="100.88.104.58"
    ["doge"]="100.117.43.53"
    ["trx"]="100.109.252.56"
    ["matic"]="100.80.84.82"
    ["xlm"]="100.125.147.88"
    ["link"]="100.86.111.37"
    ["usdt"]="100.95.0.72"
    ["edsc"]="100.113.226.111"
)

# VM to Validator number mapping (based on VMI IDs)
declare -A VM_TO_VALIDATOR=(
    ["100.93.43.18"]="1"   # vmi2896906 (BROKEN - reassigned)
    ["100.71.127.127"]="2"  # vmi2896907
    ["100.68.185.50"]="3"   # vmi2896908
    ["100.70.73.10"]="4"    # vmi2896909
    ["100.88.104.58"]="5"   # vmi2896910
    ["100.117.43.53"]="6"   # vmi2896911
    ["100.109.252.56"]="7"  # vmi2896914
    ["100.80.84.82"]="8"    # vmi2896915
    ["100.86.111.37"]="9"   # vmi2896917
    ["100.125.147.88"]="10" # vmi2896916
    ["100.95.0.72"]="11"    # vmi2896918
    ["100.113.226.111"]="12" # vmi2896921
    ["100.114.244.62"]="13" # vmi2896922
    ["100.125.251.60"]="14" # vmi2896923
    ["100.74.204.23"]="15"  # vmi2896924
    ["100.124.117.73"]="16" # vmi2896925
    ["100.89.102.75"]="17"  # vmi2897381
    ["100.71.242.104"]="18" # vmi2897383
    ["100.74.84.28"]="19"   # vmi2897382
    ["100.102.128.51"]="20" # vmi2897384
    ["100.96.84.69"]="21"   # Oracle Cloud - Gizzi
    ["100.70.242.106"]="22" # Oracle Cloud - Auditdev
)

# Function to extract key info from mapping file
extract_key_info() {
    local pbc=$1
    local validator_num=$2
    local mapping_file="$KEY_DIR/${pbc^^}_PBC_VALIDATOR_KEYS_MAPPING.md"

    if [[ ! -f "$mapping_file" ]]; then
        echo -e "${RED}Error: Mapping file not found: $mapping_file${NC}"
        return 1
    fi

    # Extract derivation path (e.g., //BTC/Validator1)
    local derivation="//${pbc^^}/Validator${validator_num}"

    # Extract public key hex from the mapping file
    local pubkey=$(grep -A 3 "### Validator $validator_num" "$mapping_file" | grep "Public Key (Hex):" | awk '{print $4}')

    if [[ -z "$pubkey" ]]; then
        echo -e "${RED}Error: Could not extract public key for ${pbc^^} Validator ${validator_num}${NC}"
        return 1
    fi

    echo "$derivation|$pubkey"
}

# Function to inject key via RPC
inject_key_via_rpc() {
    local pbc=$1
    local validator_num=$2
    local vm_ip=$3
    local rpc_port=$4

    echo -e "${YELLOW}[${pbc^^}-PBC] Configuring Validator ${validator_num} on ${vm_ip}:${rpc_port}${NC}"

    # Get key info
    local key_info=$(extract_key_info "$pbc" "$validator_num")
    if [[ $? -ne 0 ]]; then
        return 1
    fi

    local derivation=$(echo "$key_info" | cut -d'|' -f1)
    local pubkey=$(echo "$key_info" | cut -d'|' -f2)

    echo -e "  Derivation: ${derivation}"
    echo -e "  Public Key: ${pubkey}"

    # Check if RPC is accessible
    if ! ssh -i ~/.ssh/contabo-validators root@${vm_ip} "curl -s http://localhost:${rpc_port} > /dev/null 2>&1"; then
        echo -e "${RED}  [SKIP] RPC not accessible at ${vm_ip}:${rpc_port}${NC}"
        return 1
    fi

    # Inject key via RPC
    # Note: We use the derivation path as the seed, the key type is 'asfk'
    local result=$(ssh -i ~/.ssh/contabo-validators root@${vm_ip} "curl -s -H 'Content-Type: application/json' -d '{
        \"id\":1,
        \"jsonrpc\":\"2.0\",
        \"method\":\"author_insertKey\",
        \"params\":[\"asfk\", \"${derivation}\", \"${pubkey}\"]
    }' http://localhost:${rpc_port}")

    # Check result
    if echo "$result" | grep -q '"result":null'; then
        echo -e "${GREEN}  [SUCCESS] Key injected successfully${NC}"
        return 0
    elif echo "$result" | grep -q '"error"'; then
        local error_msg=$(echo "$result" | grep -o '"message":"[^"]*"' | cut -d'"' -f4)
        echo -e "${RED}  [ERROR] $error_msg${NC}"
        return 1
    else
        echo -e "${YELLOW}  [UNKNOWN] Response: $result${NC}"
        return 1
    fi
}

# Main execution
main() {
    local total_configured=0
    local total_failed=0
    local total_skipped=0

    # Process each PBC
    for pbc in btc xrp bnb sol ada doge trx matic xlm link usdt edsc; do
        echo -e "\n${BLUE}=== Processing ${pbc^^}-PBC ===${NC}"

        local vm_ip="${PBC_VM_IPS[$pbc]}"
        local rpc_port="${PBC_RPC_PORTS[$pbc]}"
        local validator_num="${VM_TO_VALIDATOR[$vm_ip]}"

        if [[ -z "$validator_num" ]]; then
            echo -e "${RED}[ERROR] Could not determine validator number for VM ${vm_ip}${NC}"
            ((total_failed++))
            continue
        fi

        if inject_key_via_rpc "$pbc" "$validator_num" "$vm_ip" "$rpc_port"; then
            ((total_configured++))
        else
            ((total_failed++))
        fi

        sleep 1  # Brief delay between operations
    done

    # Summary
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}Configuration Summary${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo -e "${GREEN}Successfully Configured: ${total_configured}${NC}"
    echo -e "${RED}Failed: ${total_failed}${NC}"
    echo -e "${YELLOW}Skipped: ${total_skipped}${NC}"
    echo ""
}

# Run main function
main
