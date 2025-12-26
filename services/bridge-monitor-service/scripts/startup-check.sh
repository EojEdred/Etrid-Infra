#!/bin/bash
# ============================================================================
# ËTRID BRIDGE MONITOR SERVICE - STARTUP VALIDATION SCRIPT
# ============================================================================
# This script validates the configuration before starting the service
# Run: ./scripts/startup-check.sh
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}       ËTRID BRIDGE MONITOR SERVICE - STARTUP VALIDATION${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# Track errors
ERRORS=0
WARNINGS=0

# Load .env file
if [ -f .env ]; then
    source .env
    echo -e "${GREEN}✓${NC} Loaded .env configuration"
else
    echo -e "${RED}✗${NC} .env file not found!"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo -e "${BLUE}--- Checking Required Environment Variables ---${NC}"

# Check required variables
check_required() {
    local var_name=$1
    local var_value="${!var_name}"
    if [ -z "$var_value" ]; then
        echo -e "${RED}✗${NC} $var_name is not set"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✓${NC} $var_name is set"
    fi
}

check_optional() {
    local var_name=$1
    local var_value="${!var_name}"
    if [ -z "$var_value" ]; then
        echo -e "${YELLOW}!${NC} $var_name is not set (optional)"
        WARNINGS=$((WARNINGS + 1))
    else
        echo -e "${GREEN}✓${NC} $var_name is set"
    fi
}

# Core settings
check_required "NODE_ENV"
check_required "PORT"
check_required "PRIMEARC_WS_URL"

# Bridge operator
check_required "BRIDGE_OPERATOR_ACCOUNT"

# PBC endpoints
echo ""
echo -e "${BLUE}--- Checking PBC Endpoints ---${NC}"
check_required "BTC_PBC_WS"
check_required "ETH_PBC_WS"
check_required "SOL_PBC_WS"
check_required "BNB_PBC_WS"
check_required "XRP_PBC_WS"
check_required "TRX_PBC_WS"
check_required "ADA_PBC_WS"
check_required "MATIC_PBC_WS"
check_required "XLM_PBC_WS"
check_required "EDSC_PBC_WS"

# External chain RPCs
echo ""
echo -e "${BLUE}--- Checking External Chain RPCs ---${NC}"
check_required "ETHEREUM_RPC_URL"
check_required "SOLANA_RPC_URL"
check_required "BNB_RPC_URL"
check_required "POLYGON_RPC_URL"
check_optional "TRON_API_KEY"
check_optional "CARDANO_BLOCKFROST_API_KEY"

# Bridge addresses
echo ""
echo -e "${BLUE}--- Checking Bridge Addresses ---${NC}"
check_required "BITCOIN_BRIDGE_ADDRESS"
check_required "ETHEREUM_BRIDGE_ADDRESS"
check_required "SOLANA_BRIDGE_PROGRAM"
check_required "BNB_BRIDGE_ADDRESS"
check_required "TRON_BRIDGE_ADDRESS"
check_required "XRP_BRIDGE_ADDRESS"
check_required "STELLAR_BRIDGE_ACCOUNT"
check_required "CARDANO_BRIDGE_ADDRESS"

# Check for placeholder addresses
echo ""
echo -e "${BLUE}--- Checking for Placeholder Addresses ---${NC}"
if [ "$POLYGON_BRIDGE_ADDRESS" = "0x0000000000000000000000000000000000000000" ]; then
    echo -e "${YELLOW}!${NC} POLYGON_BRIDGE_ADDRESS is placeholder (not deployed yet)"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✓${NC} POLYGON_BRIDGE_ADDRESS is configured"
fi

# Test PrimeArc connectivity
echo ""
echo -e "${BLUE}--- Testing PrimeArc Connectivity ---${NC}"
if command -v curl &> /dev/null; then
    PRIMEARC_HTTP=${PRIMEARC_WS_URL/ws:/http:}
    PRIMEARC_HTTP=${PRIMEARC_HTTP/:9944/:9933}

    if curl -s --max-time 5 "$PRIMEARC_HTTP/health" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} PrimeArc RPC is reachable at $PRIMEARC_HTTP"
    else
        echo -e "${YELLOW}!${NC} Cannot reach PrimeArc at $PRIMEARC_HTTP (may be normal if using WebSocket)"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${YELLOW}!${NC} curl not installed, skipping connectivity test"
fi

# Check Node.js
echo ""
echo -e "${BLUE}--- Checking Dependencies ---${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Node.js installed: $NODE_VERSION"

    # Check if >= 18.0.0
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d. -f1 | tr -d 'v')
    if [ "$NODE_MAJOR" -lt 18 ]; then
        echo -e "${RED}✗${NC} Node.js 18+ required, found $NODE_VERSION"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${RED}✗${NC} Node.js not found"
    ERRORS=$((ERRORS + 1))
fi

# Check if node_modules exists
if [ -d "node_modules" ]; then
    echo -e "${GREEN}✓${NC} node_modules directory exists"
else
    echo -e "${RED}✗${NC} node_modules not found - run 'npm install'"
    ERRORS=$((ERRORS + 1))
fi

# Check if dist exists (compiled)
if [ -d "dist" ]; then
    echo -e "${GREEN}✓${NC} dist directory exists (compiled)"
else
    echo -e "${YELLOW}!${NC} dist not found - run 'npm run build'"
    WARNINGS=$((WARNINGS + 1))
fi

# Check Redis (if required)
echo ""
echo -e "${BLUE}--- Checking Redis ---${NC}"
if command -v redis-cli &> /dev/null; then
    if redis-cli -h ${REDIS_HOST:-localhost} -p ${REDIS_PORT:-6379} ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Redis is running at ${REDIS_HOST:-localhost}:${REDIS_PORT:-6379}"
    else
        echo -e "${YELLOW}!${NC} Redis not responding (may be normal for Docker deployment)"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${YELLOW}!${NC} redis-cli not installed, skipping Redis check"
fi

# Check attester keys
echo ""
echo -e "${BLUE}--- Checking Attester Keys ---${NC}"
# Check multiple possible locations for attester keys
if [ -f "/opt/etrid/secrets/attester-keys.json" ]; then
    ATTESTER_KEYS_FILE="/opt/etrid/secrets/attester-keys.json"
elif [ -f "/Users/macbook/Desktop/etrid/secrets/attester-keys.json" ]; then
    ATTESTER_KEYS_FILE="/Users/macbook/Desktop/etrid/secrets/attester-keys.json"
elif [ -f "./secrets/attester-keys.json" ]; then
    ATTESTER_KEYS_FILE="./secrets/attester-keys.json"
else
    ATTESTER_KEYS_FILE=""
fi

if [ -n "$ATTESTER_KEYS_FILE" ] && [ -f "$ATTESTER_KEYS_FILE" ]; then
    ATTESTER_COUNT=$(grep -c '"accountId"' "$ATTESTER_KEYS_FILE" 2>/dev/null || echo "0")
    if [ "$ATTESTER_COUNT" -ge 5 ]; then
        echo -e "${GREEN}✓${NC} Attester keys file found at $ATTESTER_KEYS_FILE ($ATTESTER_COUNT attesters)"
    else
        echo -e "${YELLOW}!${NC} Attester keys file has only $ATTESTER_COUNT attesters (need 5)"
        WARNINGS=$((WARNINGS + 1))
    fi
else
    echo -e "${RED}✗${NC} Attester keys file not found in any expected location:"
    echo "    - /opt/etrid/secrets/attester-keys.json (production)"
    echo "    - /Users/macbook/Desktop/etrid/secrets/attester-keys.json (development)"
    echo "    - ./secrets/attester-keys.json (relative)"
    ERRORS=$((ERRORS + 1))
fi

# Summary
echo ""
echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}                           VALIDATION SUMMARY${NC}"
echo -e "${BLUE}============================================================================${NC}"

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed! Ready to start.${NC}"
    echo ""
    echo "To start the service:"
    echo "  npm run dev     # Development mode"
    echo "  npm start       # Production mode"
    echo "  docker-compose up -d  # Docker deployment"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}! Passed with $WARNINGS warning(s)${NC}"
    echo ""
    echo "The service can start, but check the warnings above."
    exit 0
else
    echo -e "${RED}✗ Failed with $ERRORS error(s) and $WARNINGS warning(s)${NC}"
    echo ""
    echo "Please fix the errors above before starting the service."
    exit 1
fi
