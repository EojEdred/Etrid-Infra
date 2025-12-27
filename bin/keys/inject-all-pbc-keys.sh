#!/bin/bash
# Inject ASF session keys for all PBC validators
# Uses CLI key insertion method
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
echo -e "${BLUE}PBC Session Key Injection (CLI Method)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# PBC to VM mapping with validator numbers
declare -A PBC_CONFIG=(
    # Format: "pbc_name|tailscale_ip|validator_num|binary_name"
    ["btc"]="btc|100.124.117.73|16|btc-pbc-collator"
    ["xrp"]="xrp|100.71.127.127|2|xrp-pbc-collator"
    ["bnb"]="bnb|100.68.185.50|3|bnb-pbc-collator"
    ["sol"]="sol|100.70.73.10|4|sol-pbc-collator"
    ["ada"]="ada|100.88.104.58|5|ada-pbc-collator"
    ["doge"]="doge|100.117.43.53|6|doge-pbc-collator"
    ["trx"]="trx|100.109.252.56|7|trx-pbc-collator"
    ["matic"]="matic|100.80.84.82|8|matic-pbc-collator"
    ["link"]="link|100.86.111.37|9|link-pbc-collator"
    ["xlm"]="xlm|100.125.147.88|10|xlm-pbc-collator"
    ["usdt"]="usdt|100.95.0.72|11|sc-usdt-pbc-collator"
    ["edsc"]="edsc|100.113.226.111|12|edsc-pbc-collator"
)

# SSH key
SSH_KEY="~/.ssh/contabo-validators"

# Counter
total_success=0
total_failed=0
total_skipped=0

# Function to inject key for a PBC
inject_pbc_key() {
    local pbc_name=$1
    local vm_ip=$2
    local validator_num=$3
    local binary_name=$4

    echo -e "\n${BLUE}=== Processing ${pbc_name^^}-PBC ===${NC}"
    echo -e "  VM: ${vm_ip}"
    echo -e "  Validator: ${validator_num}"
    echo -e "  Binary: ${binary_name}"

    # Determine derivation path
    local derivation="//${pbc_name^^}/Validator${validator_num}"
    echo -e "  Derivation: ${derivation}"

    # Find the base path and chainspec path
    local base_path="/var/lib/etrid/${pbc_name}-pbc-collator"
    local chainspec_path="/var/lib/etrid/chainspecs/${pbc_name}-pbc-spec.json"

    # For USDT, the paths are different
    if [[ "$pbc_name" == "usdt" ]]; then
        base_path="/var/lib/etrid/sc-usdt-pbc-collator"
        chainspec_path="/var/lib/etrid/chainspecs/sc-usdt-pbc-spec.json"
    fi

    # Check if chainspec exists
    if ! ssh -i $SSH_KEY root@${vm_ip} "test -f ${chainspec_path}" 2>/dev/null; then
        echo -e "${RED}  [SKIP] Chainspec not found: ${chainspec_path}${NC}"
        ((total_skipped++))
        return 1
    fi

    # Insert the key
    echo -e "${YELLOW}  [INSERTING] Injecting key via CLI...${NC}"

    if ssh -i $SSH_KEY root@${vm_ip} "${binary_name} key insert \
        --base-path ${base_path} \
        --chain ${chainspec_path} \
        --scheme Sr25519 \
        --suri '${derivation}' \
        --key-type asfk" 2>&1; then

        echo -e "${GREEN}  [SUCCESS] Key injected successfully${NC}"

        # Restart the service to apply the key
        echo -e "${YELLOW}  [RESTARTING] Restarting ${pbc_name}-pbc-collator service...${NC}"
        if ssh -i $SSH_KEY root@${vm_ip} "systemctl restart ${pbc_name}-pbc-collator" 2>&1; then
            echo -e "${GREEN}  [SUCCESS] Service restarted${NC}"
            ((total_success++))
            return 0
        else
            echo -e "${RED}  [ERROR] Failed to restart service${NC}"
            ((total_failed++))
            return 1
        fi
    else
        echo -e "${RED}  [ERROR] Failed to inject key${NC}"
        ((total_failed++))
        return 1
    fi
}

# Main execution
echo -e "${YELLOW}Starting key injection for all PBC collators...${NC}"
echo ""

# Process each PBC
for pbc in btc xrp bnb sol ada doge trx matic link xlm usdt edsc; do
    config="${PBC_CONFIG[$pbc]}"
    IFS='|' read -r pbc_name vm_ip validator_num binary_name <<< "$config"

    inject_pbc_key "$pbc_name" "$vm_ip" "$validator_num" "$binary_name"

    # Brief delay between operations
    sleep 2
done

# Summary
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}Injection Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Successfully Configured: ${total_success}${NC}"
echo -e "${RED}Failed: ${total_failed}${NC}"
echo -e "${YELLOW}Skipped: ${total_skipped}${NC}"
echo ""

# Show status of all PBC services
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}PBC Service Status Check${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

for pbc in btc xrp bnb sol ada doge trx matic link xlm usdt edsc; do
    config="${PBC_CONFIG[$pbc]}"
    IFS='|' read -r pbc_name vm_ip validator_num binary_name <<< "$config"

    echo -e "${YELLOW}${pbc_name^^}-PBC on ${vm_ip}:${NC}"
    ssh -i $SSH_KEY root@${vm_ip} "systemctl status ${pbc_name}-pbc-collator --no-pager | head -3" 2>&1 || echo "  [ERROR] Could not check status"
    echo ""
done

echo -e "${GREEN}Key injection process complete!${NC}"
