#!/bin/bash

# Validate config.json for correctness and completeness
# Usage: ./validate-config.sh [config-file]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${1:-$SCRIPT_DIR/config.json}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   Configuration Validation${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Check dependencies
if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is not installed${NC}"
    exit 1
fi

# Validate config file exists
if [[ ! -f "$CONFIG_FILE" ]]; then
    echo -e "${RED}Error: Config file not found: $CONFIG_FILE${NC}"
    exit 1
fi

echo -e "${BLUE}Validating: $CONFIG_FILE${NC}"
echo ""

errors=0
warnings=0

# Test 1: Valid JSON
echo -n "JSON syntax: "
if jq empty "$CONFIG_FILE" 2>/dev/null; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL - Invalid JSON syntax${NC}"
    exit 1
fi

# Test 2: Required top-level fields
echo -n "Required fields: "
required_fields=("operator" "relayers" "chains" "flarechain" "configuration")
missing_fields=()

for field in "${required_fields[@]}"; do
    if ! jq -e ".$field" "$CONFIG_FILE" >/dev/null 2>&1; then
        missing_fields+=("$field")
    fi
done

if [[ ${#missing_fields[@]} -eq 0 ]]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL - Missing fields: ${missing_fields[*]}${NC}"
    errors=$((errors + 1))
fi

# Test 3: Operator address format
echo -n "Operator address: "
operator=$(jq -r '.operator' "$CONFIG_FILE")
if [[ "$operator" =~ ^5[A-Za-z0-9]{47}$ ]]; then
    echo -e "${GREEN}PASS${NC} ($operator)"
else
    echo -e "${YELLOW}WARN - Invalid format (expected SS58 address)${NC}"
    warnings=$((warnings + 1))
fi

# Test 4: Relayers array
echo -n "Relayers: "
relayers=$(jq -r '.relayers | length' "$CONFIG_FILE")
if [[ $relayers -gt 0 ]]; then
    echo -e "${GREEN}PASS${NC} ($relayers relayers configured)"
else
    echo -e "${RED}FAIL - No relayers configured${NC}"
    errors=$((errors + 1))
fi

# Test 5: Supported chains
echo -n "Chains configuration: "
supported_chains=("solana" "bnb" "ethereum" "polygon" "tron" "xrp" "bitcoin")
configured_chains=$(jq -r '.chains | keys[]' "$CONFIG_FILE")
chain_count=0

for chain in $configured_chains; do
    chain_count=$((chain_count + 1))
    if [[ ! " ${supported_chains[@]} " =~ " ${chain} " ]]; then
        echo -e "${YELLOW}WARN - Unknown chain: $chain${NC}"
        warnings=$((warnings + 1))
    fi
done

if [[ $chain_count -gt 0 ]]; then
    echo -e "${GREEN}PASS${NC} ($chain_count chains configured)"
else
    echo -e "${RED}FAIL - No chains configured${NC}"
    errors=$((errors + 1))
fi

# Test 6: Chain-specific configuration
echo ""
echo -e "${BLUE}Chain-specific validation:${NC}"

for chain in $configured_chains; do
    echo -n "  $chain: "

    # Check required fields
    required_chain_fields=("pbc_endpoint" "token_address" "exchange_rate" "decimals")
    chain_errors=0

    for field in "${required_chain_fields[@]}"; do
        if ! jq -e ".chains.$chain.$field" "$CONFIG_FILE" >/dev/null 2>&1; then
            echo -e "${RED}Missing $field${NC}"
            chain_errors=$((chain_errors + 1))
        fi
    done

    if [[ $chain_errors -eq 0 ]]; then
        # Validate endpoint format
        endpoint=$(jq -r ".chains.$chain.pbc_endpoint" "$CONFIG_FILE")
        if [[ "$endpoint" =~ ^wss?:// ]]; then
            echo -e "${GREEN}PASS${NC}"
        else
            echo -e "${YELLOW}WARN - Invalid endpoint format${NC}"
            warnings=$((warnings + 1))
        fi
    else
        errors=$((errors + $chain_errors))
    fi
done

# Test 7: FlareChain configuration
echo -n "FlareChain endpoint: "
flare_endpoint=$(jq -r '.flarechain.endpoint' "$CONFIG_FILE")
if [[ "$flare_endpoint" =~ ^wss?:// ]]; then
    echo -e "${GREEN}PASS${NC} ($flare_endpoint)"
else
    echo -e "${RED}FAIL - Invalid endpoint format${NC}"
    errors=$((errors + 1))
fi

# Test 8: Bridge configuration parameters
echo -n "Bridge parameters: "
required_params=("max_transfer_amount" "min_transfer_amount" "bridge_fee_percent" "confirmation_blocks")
param_errors=0

for param in "${required_params[@]}"; do
    if ! jq -e ".configuration.$param" "$CONFIG_FILE" >/dev/null 2>&1; then
        param_errors=$((param_errors + 1))
    fi
done

if [[ $param_errors -eq 0 ]]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL - Missing parameters${NC}"
    errors=$((errors + param_errors))
fi

# Test 9: Confirmation blocks for each chain
echo -n "Confirmation blocks: "
confirmation_errors=0

for chain in $configured_chains; do
    if ! jq -e ".configuration.confirmation_blocks.$chain" "$CONFIG_FILE" >/dev/null 2>&1; then
        confirmation_errors=$((confirmation_errors + 1))
    fi
done

if [[ $confirmation_errors -eq 0 ]]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${YELLOW}WARN - Missing confirmation blocks for some chains${NC}"
    warnings=$((warnings + 1))
fi

# Test 10: Numeric values validation
echo -n "Numeric values: "
numeric_errors=0

max_amount=$(jq -r '.configuration.max_transfer_amount' "$CONFIG_FILE")
min_amount=$(jq -r '.configuration.min_transfer_amount' "$CONFIG_FILE")

if ! [[ "$max_amount" =~ ^[0-9]+$ ]]; then
    numeric_errors=$((numeric_errors + 1))
fi

if ! [[ "$min_amount" =~ ^[0-9]+$ ]]; then
    numeric_errors=$((numeric_errors + 1))
fi

if [[ $numeric_errors -eq 0 ]]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL - Invalid numeric values${NC}"
    errors=$((errors + numeric_errors))
fi

# Test 11: Logical validation
echo -n "Logical checks: "
if [[ "$max_amount" =~ ^[0-9]+$ ]] && [[ "$min_amount" =~ ^[0-9]+$ ]]; then
    if [[ $max_amount -gt $min_amount ]]; then
        echo -e "${GREEN}PASS${NC}"
    else
        echo -e "${RED}FAIL - max_transfer_amount must be greater than min_transfer_amount${NC}"
        errors=$((errors + 1))
    fi
else
    echo -e "${YELLOW}SKIP - Cannot validate due to invalid numeric values${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   Validation Summary${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

if [[ $errors -eq 0 ]] && [[ $warnings -eq 0 ]]; then
    echo -e "${GREEN}Configuration is valid!${NC}"
    echo ""
    echo "Chains configured: $chain_count"
    echo "Relayers configured: $relayers"
    exit 0
elif [[ $errors -eq 0 ]]; then
    echo -e "${YELLOW}Configuration is valid with warnings${NC}"
    echo ""
    echo -e "${YELLOW}Warnings: $warnings${NC}"
    echo "Chains configured: $chain_count"
    echo "Relayers configured: $relayers"
    echo ""
    echo -e "${YELLOW}Please review warnings before deploying to production${NC}"
    exit 0
else
    echo -e "${RED}Configuration validation failed${NC}"
    echo ""
    echo -e "${RED}Errors: $errors${NC}"
    echo -e "${YELLOW}Warnings: $warnings${NC}"
    echo ""
    echo -e "${RED}Please fix errors before using this configuration${NC}"
    exit 1
fi
