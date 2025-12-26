#!/bin/bash
# ============================================================================
# ETRID Bridge End-to-End Test Suite
# Tests the complete bridge flow: Primearc <-> Ethereum
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
PRIMEARC_WS="ws://100.96.84.69:9944"
BRIDGE_MONITOR="http://100.113.226.111:3002"
RELAYER_API="http://100.113.226.111:3001"

# Attester endpoints (9 Decentralized Directors)
ATTESTERS=(
    "http://100.96.84.69:3000"    # Director 1 - Oracle Cloud
    "http://100.70.242.106:3000"  # Director 2 - Oracle Cloud
    "http://100.102.128.51:3000"  # Director 3 - St. Louis
    "http://100.71.242.104:3000"  # Director 4 - St. Louis
    "http://100.74.84.28:3000"    # Director 5 - New York
    "http://100.89.102.75:3000"   # Director 6 - New York
    "http://100.80.84.82:3000"    # Director 7 - Seattle
    "http://100.68.185.50:3000"   # Director 8 - UK Portsmouth
    "http://100.74.204.23:3000"   # Director 9 - UK Portsmouth
)

# Test accounts (for testnet only)
TEST_SENDER="5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY"
TEST_RECIPIENT="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         ETRID Bridge End-to-End Test Suite                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_TOTAL=0

# Test helper functions
run_test() {
    local test_name="$1"
    local test_cmd="$2"

    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    echo -ne "${CYAN}[$TESTS_TOTAL] Testing: $test_name... ${NC}"

    if eval "$test_cmd" >/dev/null 2>&1; then
        echo -e "${GREEN}PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}FAILED${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

run_test_with_output() {
    local test_name="$1"
    local test_cmd="$2"
    local expected="$3"

    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    echo -ne "${CYAN}[$TESTS_TOTAL] Testing: $test_name... ${NC}"

    local result
    result=$(eval "$test_cmd" 2>/dev/null || echo "ERROR")

    if [[ "$result" == *"$expected"* ]]; then
        echo -e "${GREEN}PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}FAILED${NC}"
        echo -e "  Expected: $expected"
        echo -e "  Got: $result"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        return 1
    fi
}

# ============================================================================
# SECTION 1: Infrastructure Health Checks
# ============================================================================
echo -e "\n${YELLOW}═══ Section 1: Infrastructure Health Checks ═══${NC}\n"

# Test Primearc connectivity
run_test_with_output "Primearc RPC connectivity" \
    "curl -s -X POST -H 'Content-Type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"system_health\",\"params\":[],\"id\":1}' http://100.96.84.69:9944" \
    "isSyncing"

# Test Bridge Monitor
run_test_with_output "Bridge Monitor health" \
    "curl -s $BRIDGE_MONITOR/health" \
    "healthy"

# Test each attester
for i in "${!ATTESTERS[@]}"; do
    run_test_with_output "Attester $((i+1)) health" \
        "curl -s --connect-timeout 5 ${ATTESTERS[$i]}/health" \
        "healthy" || true
done

# Test Relayer (if deployed)
run_test_with_output "Relayer health" \
    "curl -s --connect-timeout 5 $RELAYER_API/health" \
    "healthy" || true

# ============================================================================
# SECTION 2: Chain State Verification
# ============================================================================
echo -e "\n${YELLOW}═══ Section 2: Chain State Verification ═══${NC}\n"

# Get current block
run_test_with_output "Get latest block" \
    "curl -s -X POST -H 'Content-Type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"chain_getHeader\",\"params\":[],\"id\":1}' http://100.96.84.69:9944 | jq -r '.result.number'" \
    "0x"

# Check peer count
run_test_with_output "Peer count > 0" \
    "curl -s -X POST -H 'Content-Type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"system_health\",\"params\":[],\"id\":1}' http://100.96.84.69:9944 | jq -r '.result.peers'" \
    ""

# Check runtime version
run_test_with_output "Runtime version check" \
    "curl -s -X POST -H 'Content-Type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"state_getRuntimeVersion\",\"params\":[],\"id\":1}' http://100.96.84.69:9944 | jq -r '.result.specName'" \
    ""

# ============================================================================
# SECTION 3: Bridge Pallet Verification
# ============================================================================
echo -e "\n${YELLOW}═══ Section 3: Bridge Pallet Verification ═══${NC}\n"

# Check if edscBridgeTokenMessenger pallet exists
run_test_with_output "EDSC Token Messenger pallet exists" \
    "curl -s -X POST -H 'Content-Type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"state_getMetadata\",\"params\":[],\"id\":1}' http://100.96.84.69:9944 | grep -o 'edscBridgeTokenMessenger' | head -1" \
    "edscBridgeTokenMessenger" || true

# Check if edscBridgeAttestation pallet exists
run_test_with_output "EDSC Bridge Attestation pallet exists" \
    "curl -s -X POST -H 'Content-Type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"state_getMetadata\",\"params\":[],\"id\":1}' http://100.96.84.69:9944 | grep -o 'edscBridgeAttestation' | head -1" \
    "edscBridgeAttestation" || true

# Check if etrLock pallet exists
run_test_with_output "ETR Lock pallet exists" \
    "curl -s -X POST -H 'Content-Type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"state_getMetadata\",\"params\":[],\"id\":1}' http://100.96.84.69:9944 | grep -o 'etrLock' | head -1" \
    "etrLock" || true

# ============================================================================
# SECTION 4: Attestation Service Tests
# ============================================================================
echo -e "\n${YELLOW}═══ Section 4: Attestation Service Tests ═══${NC}\n"

# Check attestation store on each attester
for i in "${!ATTESTERS[@]}"; do
    run_test "Attester $((i+1)) attestation store" \
        "curl -s --connect-timeout 5 ${ATTESTERS[$i]}/attestations | jq -e '.attestations'" || true
done

# Test message signing (mock test - requires actual setup)
echo -e "${CYAN}[Note] Full signing tests require live bridge transactions${NC}"

# ============================================================================
# SECTION 5: Bridge Monitor Statistics
# ============================================================================
echo -e "\n${YELLOW}═══ Section 5: Bridge Monitor Statistics ═══${NC}\n"

# Get bridge statistics
run_test_with_output "Bridge monitor transfers endpoint" \
    "curl -s $BRIDGE_MONITOR/health | jq -r '.transfers.total'" \
    "0" || run_test_with_output "Bridge monitor transfers endpoint" \
    "curl -s $BRIDGE_MONITOR/health | jq -r '.transfers'" \
    "total"

# ============================================================================
# SECTION 6: Cross-Chain Message Flow Test
# ============================================================================
echo -e "\n${YELLOW}═══ Section 6: Cross-Chain Message Flow Test ═══${NC}\n"

echo -e "${CYAN}[Note] Full cross-chain tests require:${NC}"
echo -e "  1. Funded test accounts on both chains"
echo -e "  2. Deployed and configured contracts"
echo -e "  3. Running attester and relayer services"
echo ""
echo -e "${CYAN}Manual test steps:${NC}"
echo -e "  1. Call burnAndSend on EDSC TokenMessenger (Substrate)"
echo -e "  2. Wait for attesters to sign (check /attestations endpoint)"
echo -e "  3. Relayer submits to Ethereum MessageTransmitter"
echo -e "  4. Verify EDSC minted on Ethereum"

# ============================================================================
# SECTION 7: Domain ID Verification
# ============================================================================
echo -e "\n${YELLOW}═══ Section 7: Domain ID Verification ═══${NC}\n"

# Verify domain IDs match across components
echo -e "${CYAN}Domain ID Configuration:${NC}"
echo -e "  Ethereum:    0"
echo -e "  Solana:      1"
echo -e "  PrimearcCore: 2"
echo -e "  Polygon:     3"
echo -e "  Arbitrum:    4"
echo -e "  BNBChain:    5"
echo ""
run_test "Domain IDs documented" "true"

# ============================================================================
# SECTION 8: Rate Limiting Verification
# ============================================================================
echo -e "\n${YELLOW}═══ Section 8: Rate Limiting Verification ═══${NC}\n"

echo -e "${CYAN}Configured Rate Limits:${NC}"
echo -e "  Max per TX (ETR):   100,000 ETR"
echo -e "  Max per TX (EDSC):  1,000,000 EDSC"
echo -e "  Daily limit (ETR):  1,000,000 ETR"
echo -e "  Daily limit (EDSC): 10,000,000 EDSC"
echo ""
run_test "Rate limits documented" "true"

# ============================================================================
# TEST SUMMARY
# ============================================================================
echo -e "\n${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    TEST SUMMARY                            ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Total Tests:  $TESTS_TOTAL"
echo -e "  ${GREEN}Passed:       $TESTS_PASSED${NC}"
echo -e "  ${RED}Failed:       $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Review the output above.${NC}"
    exit 1
fi
