#!/bin/bash
set -e

# Sol-PBC Bridge Verification Script
# Checks that the bridge is properly configured and operational

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/sol-pbc-config.json"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_fail() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Check dependencies
check_dependencies() {
    local missing=0

    if ! command -v jq &> /dev/null; then
        print_fail "jq not installed"
        missing=1
    else
        print_success "jq installed"
    fi

    if ! command -v python3 &> /dev/null; then
        print_fail "python3 not installed"
        missing=1
    else
        print_success "python3 installed"
    fi

    if ! python3 -c "import base58" 2>/dev/null; then
        print_fail "Python base58 module not installed"
        missing=1
    else
        print_success "Python base58 module installed"
    fi

    if ! command -v polkadot-js-api &> /dev/null; then
        print_warn "polkadot-js-api CLI not installed (optional)"
    else
        print_success "polkadot-js-api CLI installed"
    fi

    return $missing
}

# Verify configuration file
check_config() {
    if [ ! -f "$CONFIG_FILE" ]; then
        print_fail "Configuration file not found: $CONFIG_FILE"
        return 1
    fi

    print_success "Configuration file exists"

    # Check if critical fields are set
    local operator=$(jq -r '.operator.account' "$CONFIG_FILE")
    if [[ "$operator" == *"PLACEHOLDER"* ]]; then
        print_warn "Operator account not configured"
        return 1
    else
        print_success "Operator account configured"
    fi

    # Check H256 address
    local h256=$(jq -r '.tokens.ETR.h256_address' "$CONFIG_FILE")
    if [ "$h256" != "0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f" ]; then
        print_fail "Incorrect H256 address in config"
        return 1
    else
        print_success "H256 address correct"
    fi

    # Check SPL address
    local spl=$(jq -r '.tokens.ETR.spl_address' "$CONFIG_FILE")
    if [ "$spl" != "CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp" ]; then
        print_fail "Incorrect SPL address in config"
        return 1
    else
        print_success "SPL address correct"
    fi

    return 0
}

# Test address conversion
test_conversion() {
    print_info "Testing address conversion..."

    local result=$(python3 "$SCRIPT_DIR/convert-address.py" "CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp" 2>&1 | grep "H256:" | awk '{print $2}')

    if [ "$result" == "0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f" ]; then
        print_success "Address conversion working correctly"
        return 0
    else
        print_fail "Address conversion failed"
        print_info "Expected: 0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f"
        print_info "Got: $result"
        return 1
    fi
}

# Test reverse conversion
test_reverse_conversion() {
    print_info "Testing reverse conversion..."

    local result=$(python3 "$SCRIPT_DIR/convert-address.py" --reverse "0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f" 2>&1 | grep "Base58:" | awk '{print $2}')

    if [ "$result" == "CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp" ]; then
        print_success "Reverse conversion working correctly"
        return 0
    else
        print_fail "Reverse conversion failed"
        print_info "Expected: CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp"
        print_info "Got: $result"
        return 1
    fi
}

# Check Sol-PBC node connectivity
check_node_connectivity() {
    local node=$(jq -r '.sol_pbc_node' "$CONFIG_FILE")

    print_info "Checking connectivity to $node..."

    if command -v polkadot-js-api &> /dev/null; then
        if timeout 10 polkadot-js-api --ws "$node" query.system.chain &>/dev/null; then
            print_success "Sol-PBC node is reachable"
            return 0
        else
            print_warn "Sol-PBC node not reachable (may not be running yet)"
            return 1
        fi
    else
        print_warn "Cannot check node connectivity (polkadot-js-api not installed)"
        return 1
    fi
}

# Check if token is configured on-chain
check_token_onchain() {
    local node=$(jq -r '.sol_pbc_node' "$CONFIG_FILE")
    local h256=$(jq -r '.tokens.ETR.h256_address' "$CONFIG_FILE")

    print_info "Checking if token is configured on-chain..."

    if ! command -v polkadot-js-api &> /dev/null; then
        print_warn "Cannot check on-chain state (polkadot-js-api not installed)"
        return 1
    fi

    if timeout 10 polkadot-js-api --ws "$node" query.bridgeConfig.supportedTokens "$h256" &>/dev/null; then
        print_success "Token is configured on-chain"
        return 0
    else
        print_warn "Token not yet configured on-chain (run configure-sol-pbc.sh)"
        return 1
    fi
}

# Main verification
main() {
    print_header "Sol-PBC Bridge Verification"

    local exit_code=0

    echo
    print_header "1. Checking Dependencies"
    if ! check_dependencies; then
        exit_code=1
    fi

    echo
    print_header "2. Verifying Configuration"
    if ! check_config; then
        exit_code=1
    fi

    echo
    print_header "3. Testing Address Conversion"
    if ! test_conversion; then
        exit_code=1
    fi

    if ! test_reverse_conversion; then
        exit_code=1
    fi

    echo
    print_header "4. Checking Node Connectivity"
    check_node_connectivity || true

    echo
    print_header "5. Checking On-Chain Configuration"
    check_token_onchain || true

    echo
    print_header "Verification Summary"

    if [ $exit_code -eq 0 ]; then
        print_success "All critical checks passed!"
        echo
        print_info "Configuration is ready. Run ./configure-sol-pbc.sh to set up the bridge."
    else
        print_fail "Some checks failed. Please review the errors above."
        echo
        print_info "Install missing dependencies and fix configuration issues."
    fi

    echo
    print_header "Token Information"
    echo "Solana SPL:  CA4ALvCam45ecioBfZ7BzPsXMf3r6BRXZ8iKdGpPmqhp"
    echo "Sol-PBC H256: 0xa5c25b944117c17fc1cd26555761e1a274c6576df5a48a7e51183ba211aba65f"
    echo "Decimals:     9"
    echo "Exchange Rate: 1:1 (1000000000)"

    exit $exit_code
}

main "$@"
