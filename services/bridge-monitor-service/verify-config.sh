#!/bin/bash

# ËTRID Bridge Monitor Service - Configuration Verification Script
# This script validates that all configuration files are present and properly formatted

echo "============================================================"
echo "ËTRID Bridge Monitor - Configuration Verification"
echo "============================================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0

# Function to check file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "${GREEN}✓${NC} Found: $1"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗${NC} Missing: $1"
        ((FAILED++))
        return 1
    fi
}

# Function to check TypeScript syntax
check_ts_syntax() {
    if command -v node >/dev/null 2>&1; then
        if node -c "$1" 2>/dev/null; then
            echo -e "${GREEN}✓${NC} Valid TypeScript: $1"
            ((PASSED++))
        else
            echo -e "${YELLOW}⚠${NC} Cannot verify TypeScript syntax (requires ts-node): $1"
        fi
    fi
}

echo "Checking Configuration Files..."
echo "----------------------------"

# Check main config files
check_file "src/config/production.ts"
check_file "src/config/testnet.ts"
check_file "src/config/contracts.ts"
check_file "src/config/rpc-endpoints.ts"
check_file "src/config/index.ts"

echo ""
echo "Checking Documentation..."
echo "----------------------------"
check_file "CONFIG_README.md"
check_file "CONFIGURATION_SUMMARY.md"

echo ""
echo "Checking Secrets Template..."
echo "----------------------------"
check_file "../../secrets/.env.bridge-monitors"

echo ""
echo "Checking Key Addresses in Configuration..."
echo "----------------------------"

# Check for real production addresses
if grep -q "0xcc9b37fed77a01329502f8844620577742eb0dc6" src/config/production.ts; then
    echo -e "${GREEN}✓${NC} BSC ETR address found in production config"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} BSC ETR address missing from production config"
    ((FAILED++))
fi

if grep -q "CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp" src/config/production.ts; then
    echo -e "${GREEN}✓${NC} Solana ETR SPL address found in production config"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Solana ETR SPL address missing from production config"
    ((FAILED++))
fi

if grep -q "0x5FbDB2315678afecb367f032d93F642f64180aa3" src/config/contracts.ts; then
    echo -e "${GREEN}✓${NC} EDSC contract address found in contracts config"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} EDSC contract address missing from contracts config"
    ((FAILED++))
fi

if grep -q "5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY" src/config/production.ts; then
    echo -e "${GREEN}✓${NC} Operator account found in production config"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Operator account missing from production config"
    ((FAILED++))
fi

echo ""
echo "Checking RPC Endpoints..."
echo "----------------------------"

if grep -q "bsc-dataseed.binance.org" src/config/rpc-endpoints.ts; then
    echo -e "${GREEN}✓${NC} BSC RPC endpoints configured"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} BSC RPC endpoints missing"
    ((FAILED++))
fi

if grep -q "api.mainnet-beta.solana.com" src/config/rpc-endpoints.ts; then
    echo -e "${GREEN}✓${NC} Solana RPC endpoints configured"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Solana RPC endpoints missing"
    ((FAILED++))
fi

if grep -q "eth.llamarpc.com" src/config/rpc-endpoints.ts; then
    echo -e "${GREEN}✓${NC} Ethereum RPC endpoints configured"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Ethereum RPC endpoints missing"
    ((FAILED++))
fi

echo ""
echo "Checking PBC Configurations..."
echo "----------------------------"

# Check all 7 PBCs
for pbc in "solana" "bnb" "ethereum" "polygon" "tron" "xrp" "bitcoin"; do
    if grep -q "${pbc}:" src/config/production.ts; then
        echo -e "${GREEN}✓${NC} ${pbc} PBC configured"
        ((PASSED++))
    else
        echo -e "${RED}✗${NC} ${pbc} PBC missing"
        ((FAILED++))
    fi
done

echo ""
echo "Checking Contract ABIs..."
echo "----------------------------"

if grep -q "EDSC_ABI" src/config/contracts.ts; then
    echo -e "${GREEN}✓${NC} EDSC ABI defined"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} EDSC ABI missing"
    ((FAILED++))
fi

if grep -q "MESSAGE_TRANSMITTER_ABI" src/config/contracts.ts; then
    echo -e "${GREEN}✓${NC} MessageTransmitter ABI defined"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} MessageTransmitter ABI missing"
    ((FAILED++))
fi

if grep -q "TOKEN_MESSENGER_ABI" src/config/contracts.ts; then
    echo -e "${GREEN}✓${NC} TokenMessenger ABI defined"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} TokenMessenger ABI missing"
    ((FAILED++))
fi

echo ""
echo "Checking Environment Template..."
echo "----------------------------"

if grep -q "ETHEREUM_RPC_PRIMARY" ../../secrets/.env.bridge-monitors; then
    echo -e "${GREEN}✓${NC} RPC endpoint variables defined"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} RPC endpoint variables missing"
    ((FAILED++))
fi

if grep -q "RELAYER_PRIVATE_KEY" ../../secrets/.env.bridge-monitors; then
    echo -e "${GREEN}✓${NC} Relayer key variables defined"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Relayer key variables missing"
    ((FAILED++))
fi

if grep -q "TELEGRAM_BOT_TOKEN" ../../secrets/.env.bridge-monitors; then
    echo -e "${GREEN}✓${NC} Alert configuration variables defined"
    ((PASSED++))
else
    echo -e "${RED}✗${NC} Alert configuration variables missing"
    ((FAILED++))
fi

echo ""
echo "============================================================"
echo "Verification Summary"
echo "============================================================"
echo -e "Passed: ${GREEN}${PASSED}${NC}"
echo -e "Failed: ${RED}${FAILED}${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All configuration checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Copy secrets/.env.bridge-monitors to .env"
    echo "2. Fill in API keys and private keys"
    echo "3. Run: npm run start"
    exit 0
else
    echo -e "${RED}✗ Some configuration checks failed.${NC}"
    echo "Please review the errors above and fix missing configuration."
    exit 1
fi
