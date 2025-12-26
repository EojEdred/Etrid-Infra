#!/bin/bash

# Comprehensive test suite for PBC configuration scripts
# Usage: ./test-all.sh [config-file]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${1:-$SCRIPT_DIR/config.json}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   PBC Configuration Test Suite${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Track results
total_tests=0
passed_tests=0
failed_tests=0

# Test function
run_test() {
    local test_name=$1
    local test_command=$2

    total_tests=$((total_tests + 1))

    echo -e "${CYAN}[$total_tests] Testing: $test_name${NC}"

    if eval "$test_command" >/dev/null 2>&1; then
        echo -e "    ${GREEN}PASS${NC}"
        passed_tests=$((passed_tests + 1))
        return 0
    else
        echo -e "    ${RED}FAIL${NC}"
        failed_tests=$((failed_tests + 1))
        return 1
    fi
}

# Test 1: Check dependencies
echo -e "${BLUE}Phase 1: Dependency Checks${NC}"
echo ""

run_test "jq installed" "command -v jq"
run_test "curl installed" "command -v curl"
run_test "bash version >= 4" "[[ ${BASH_VERSION%%.*} -ge 4 ]]"

echo ""

# Test 2: Check scripts exist and are executable
echo -e "${BLUE}Phase 2: Script Integrity${NC}"
echo ""

run_test "configure-pbc.sh exists" "[[ -f $SCRIPT_DIR/configure-pbc.sh ]]"
run_test "configure-pbc.sh executable" "[[ -x $SCRIPT_DIR/configure-pbc.sh ]]"
run_test "batch-configure.sh exists" "[[ -f $SCRIPT_DIR/batch-configure.sh ]]"
run_test "batch-configure.sh executable" "[[ -x $SCRIPT_DIR/batch-configure.sh ]]"
run_test "validate-config.sh exists" "[[ -f $SCRIPT_DIR/validate-config.sh ]]"
run_test "validate-config.sh executable" "[[ -x $SCRIPT_DIR/validate-config.sh ]]"
run_test "test-connection.sh exists" "[[ -f $SCRIPT_DIR/test-connection.sh ]]"
run_test "test-connection.sh executable" "[[ -x $SCRIPT_DIR/test-connection.sh ]]"

echo ""

# Test 3: Configuration validation
echo -e "${BLUE}Phase 3: Configuration Validation${NC}"
echo ""

run_test "config.json exists" "[[ -f $CONFIG_FILE ]]"
run_test "config.json valid JSON" "jq empty $CONFIG_FILE"
run_test "operator field exists" "jq -e '.operator' $CONFIG_FILE"
run_test "relayers field exists" "jq -e '.relayers' $CONFIG_FILE"
run_test "chains field exists" "jq -e '.chains' $CONFIG_FILE"
run_test "flarechain field exists" "jq -e '.flarechain' $CONFIG_FILE"
run_test "configuration field exists" "jq -e '.configuration' $CONFIG_FILE"

echo ""

# Test 4: Chain configuration
echo -e "${BLUE}Phase 4: Chain Configuration${NC}"
echo ""

chains=$(jq -r '.chains | keys[]' "$CONFIG_FILE" 2>/dev/null || echo "")

if [[ -n "$chains" ]]; then
    for chain in $chains; do
        run_test "$chain has pbc_endpoint" "jq -e '.chains.$chain.pbc_endpoint' $CONFIG_FILE"
        run_test "$chain has token_address" "jq -e '.chains.$chain.token_address' $CONFIG_FILE"
        run_test "$chain has exchange_rate" "jq -e '.chains.$chain.exchange_rate' $CONFIG_FILE"
        run_test "$chain has decimals" "jq -e '.chains.$chain.decimals' $CONFIG_FILE"
    done
else
    echo -e "${YELLOW}No chains configured - skipping chain tests${NC}"
fi

echo ""

# Test 5: Run actual validation script
echo -e "${BLUE}Phase 5: Comprehensive Validation${NC}"
echo ""

if [[ -x "$SCRIPT_DIR/validate-config.sh" ]]; then
    echo "Running validate-config.sh..."
    if "$SCRIPT_DIR/validate-config.sh" "$CONFIG_FILE"; then
        echo -e "${GREEN}Configuration validation passed${NC}"
        passed_tests=$((passed_tests + 1))
    else
        echo -e "${RED}Configuration validation failed${NC}"
        failed_tests=$((failed_tests + 1))
    fi
    total_tests=$((total_tests + 1))
else
    echo -e "${YELLOW}validate-config.sh not executable - skipping${NC}"
fi

echo ""

# Test 6: Connectivity tests (optional, may fail if nodes are offline)
echo -e "${BLUE}Phase 6: Connectivity Tests (Optional)${NC}"
echo ""

echo "Testing connectivity to configured nodes..."
if [[ -x "$SCRIPT_DIR/test-connection.sh" ]]; then
    if "$SCRIPT_DIR/test-connection.sh" "$CONFIG_FILE"; then
        echo -e "${GREEN}All nodes are reachable${NC}"
    else
        echo -e "${YELLOW}Some nodes are not reachable (this is OK for testing)${NC}"
    fi
else
    echo -e "${YELLOW}test-connection.sh not executable - skipping${NC}"
fi

echo ""

# Test 7: Rust CLI (if available)
echo -e "${BLUE}Phase 7: Rust CLI Tests${NC}"
echo ""

if [[ -f "$SCRIPT_DIR/Cargo.toml" ]]; then
    run_test "Cargo.toml exists" "[[ -f $SCRIPT_DIR/Cargo.toml ]]"
    run_test "src/main.rs exists" "[[ -f $SCRIPT_DIR/src/main.rs ]]"

    if command -v cargo >/dev/null 2>&1; then
        echo "  Rust is installed - you can build the CLI with: ./build.sh"
    else
        echo -e "  ${YELLOW}Rust not installed - Rust CLI not available${NC}"
    fi
else
    echo -e "${YELLOW}Rust CLI not configured${NC}"
fi

echo ""

# Summary
echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}   Test Summary${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

echo "Total tests: $total_tests"
echo -e "${GREEN}Passed: $passed_tests${NC}"
echo -e "${RED}Failed: $failed_tests${NC}"

if [[ $failed_tests -eq 0 ]]; then
    echo ""
    echo -e "${GREEN}All tests passed!${NC}"
    echo ""
    echo "You can now:"
    echo "  1. Review your config: cat config.json"
    echo "  2. Validate config: ./validate-config.sh"
    echo "  3. Test connectivity: ./test-connection.sh"
    echo "  4. Configure bridges: ./batch-configure.sh"
    echo ""
    exit 0
else
    echo ""
    echo -e "${YELLOW}Some tests failed. Please review the errors above.${NC}"
    echo ""
    exit 1
fi
