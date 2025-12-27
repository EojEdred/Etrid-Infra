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

    local pbc_upper=$(echo "$pbc_name" | tr '[:lower:]' '[:upper:]')
    echo -e "\n${BLUE}=== Processing ${pbc_upper}-PBC ===${NC}"
    echo -e "  VM: ${vm_ip}"
    echo -e "  Validator: ${validator_num}"
    echo -e "  Binary: ${binary_name}"

    # Determine derivation path
    local derivation="//${pbc_upper}/Validator${validator_num}"
    echo -e "  Derivation: ${derivation}"

    # Find the base path and chainspec path
    local base_path="/var/lib/etrid/${pbc_name}-pbc-collator"
    local chainspec_path="/var/lib/etrid/chainspecs/${pbc_name}-pbc-spec.json"

    # For USDT, the paths are different
    if [[ "$pbc_name" == "usdt" ]]; then
        base_path="/var/lib/etrid/sc-usdt-pbc-collator"
        chainspec_path="/var/lib/etrid/chainspecs/sc-usdt-pbc-spec.json"
        binary_name="sc-usdt-pbc-collator"
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

        # Check keystore
        local keystore_count=$(ssh -i $SSH_KEY root@${vm_ip} "ls ${base_path}/chains/*/keystore/ 2>/dev/null | wc -l" 2>&1 || echo "0")
        echo -e "  Keystore files: ${keystore_count}"

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

# Process each PBC with explicit configuration
# Format: pbc_name vm_ip validator_num binary_name

inject_pbc_key "btc" "100.124.117.73" "16" "btc-pbc-collator"
sleep 2

inject_pbc_key "xrp" "100.71.127.127" "2" "xrp-pbc-collator"
sleep 2

inject_pbc_key "bnb" "100.68.185.50" "3" "bnb-pbc-collator"
sleep 2

inject_pbc_key "sol" "100.70.73.10" "4" "sol-pbc-collator"
sleep 2

inject_pbc_key "ada" "100.88.104.58" "5" "ada-pbc-collator"
sleep 2

inject_pbc_key "doge" "100.117.43.53" "6" "doge-pbc-collator"
sleep 2

inject_pbc_key "trx" "100.109.252.56" "7" "trx-pbc-collator"
sleep 2

inject_pbc_key "matic" "100.80.84.82" "8" "matic-pbc-collator"
sleep 2

inject_pbc_key "link" "100.86.111.37" "9" "link-pbc-collator"
sleep 2

inject_pbc_key "xlm" "100.125.147.88" "10" "xlm-pbc-collator"
sleep 2

inject_pbc_key "usdt" "100.95.0.72" "11" "sc-usdt-pbc-collator"
sleep 2

inject_pbc_key "edsc" "100.113.226.111" "12" "edsc-pbc-collator"
sleep 2

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

for pbc_info in "btc|100.124.117.73|btc-pbc-collator" "xrp|100.71.127.127|xrp-pbc-collator" "bnb|100.68.185.50|bnb-pbc-collator" "sol|100.70.73.10|sol-pbc-collator" "ada|100.88.104.58|ada-pbc-collator" "doge|100.117.43.53|doge-pbc-collator" "trx|100.109.252.56|trx-pbc-collator" "matic|100.80.84.82|matic-pbc-collator" "link|100.86.111.37|link-pbc-collator" "xlm|100.125.147.88|xlm-pbc-collator" "usdt|100.95.0.72|sc-usdt-pbc-collator" "edsc|100.113.226.111|edsc-pbc-collator"; do
    IFS='|' read -r pbc_name vm_ip service_name <<< "$pbc_info"

    pbc_upper=$(echo "$pbc_name" | tr '[:lower:]' '[:upper:]')
    echo -e "${YELLOW}${pbc_upper}-PBC on ${vm_ip}:${NC}"
    ssh -i $SSH_KEY root@${vm_ip} "systemctl status ${pbc_name}-pbc-collator --no-pager | head -3" 2>&1 || echo "  [ERROR] Could not check status"
    echo ""
done

echo -e "${GREEN}Key injection process complete!${NC}"
