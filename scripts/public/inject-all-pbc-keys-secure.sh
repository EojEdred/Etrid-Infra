#!/bin/bash
# Inject ASF session keys for all PBC validators
# Uses CLI key insertion method
# Uses external configuration file for sensitive data
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

# Load configuration from environment or config file
CONFIG_FILE="${CONFIG_FILE:-./config/secure/.env.secure}"

if [ -f "$CONFIG_FILE" ]; then
    echo -e "${YELLOW}Loading configuration from: $CONFIG_FILE${NC}"
    source "$CONFIG_FILE"
else
    echo -e "${RED}ERROR: Configuration file not found: $CONFIG_FILE${NC}"
    echo -e "${YELLOW}Please create the config file based on config/templates/.env.example${NC}"
    exit 1
fi

# Load validator configuration from JSON
VALIDATOR_CONFIG_FILE="${VALIDATOR_CONFIG_FILE:-./config/templates/validator-config.json}"

if [ -f "$VALIDATOR_CONFIG_FILE" ]; then
    echo -e "${YELLOW}Loading validator configuration from: $VALIDATOR_CONFIG_FILE${NC}"
else
    echo -e "${RED}ERROR: Validator configuration file not found: $VALIDATOR_CONFIG_FILE${NC}"
    exit 1
fi

# SSH key from environment variable
SSH_KEY="${SSH_KEY_PATH:-~/.ssh/id_rsa}"

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

# Process each PBC using jq to parse the JSON config
for pbc in btc xrp bnb sol ada doge trx matic link xlm usdt edsc; do
    vm_ip=$(jq -r ".pbcValidators[\"$pbc\"].ip" "$VALIDATOR_CONFIG_FILE")
    validator_num=$(jq -r ".pbcValidators[\"$pbc\"].validatorNum" "$VALIDATOR_CONFIG_FILE")
    binary_name=$(jq -r ".pbcValidators[\"$pbc\"].binaryName" "$VALIDATOR_CONFIG_FILE")

    inject_pbc_key "$pbc" "$vm_ip" "$validator_num" "$binary_name"

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
    vm_ip=$(jq -r ".pbcValidators[\"$pbc\"].ip" "$VALIDATOR_CONFIG_FILE")
    binary_name=$(jq -r ".pbcValidators[\"$pbc\"].binaryName" "$VALIDATOR_CONFIG_FILE")

    echo -e "${YELLOW}${pbc_name^^}-PBC on ${vm_ip}:${NC}"
    ssh -i $SSH_KEY root@${vm_ip} "systemctl status ${pbc_name}-pbc-collator --no-pager | head -3" 2>&1 || echo "  [ERROR] Could not check status"
    echo ""
done

echo -e "${GREEN}Key injection process complete!${NC}"