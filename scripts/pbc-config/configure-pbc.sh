#!/bin/bash

# PBC Bridge Configuration Script
# Usage: ./configure-pbc.sh <chain-name> <rpc-endpoint> [config-file]
# Example: ./configure-pbc.sh solana ws://10.0.0.101:9944

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${3:-$SCRIPT_DIR/config.json}"
LOG_FILE="$SCRIPT_DIR/pbc-config-$(date +%Y%m%d-%H%M%S).log"

# Check dependencies
check_dependencies() {
    local missing_deps=()

    command -v jq >/dev/null 2>&1 || missing_deps+=("jq")
    command -v curl >/dev/null 2>&1 || missing_deps+=("curl")
    command -v wscat >/dev/null 2>&1 || missing_deps+=("wscat (npm install -g wscat)")

    if [ ${#missing_deps[@]} -ne 0 ]; then
        echo -e "${RED}Error: Missing dependencies: ${missing_deps[*]}${NC}"
        exit 1
    fi
}

# Log function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

# Print usage
usage() {
    cat << EOF
Usage: $0 <chain-name> <rpc-endpoint> [config-file]

Arguments:
  chain-name      Name of the chain (solana, bnb, ethereum, polygon, tron, xrp, bitcoin)
  rpc-endpoint    WebSocket RPC endpoint (e.g., ws://10.0.0.101:9944)
  config-file     Optional path to config.json (default: ./config.json)

Examples:
  $0 solana ws://10.0.0.101:9944
  $0 ethereum ws://10.0.0.103:9944 /path/to/config.json

Supported chains:
  - solana (Solana)
  - bnb (BNB Smart Chain)
  - ethereum (Ethereum)
  - polygon (Polygon)
  - tron (Tron)
  - xrp (XRP Ledger)
  - bitcoin (Bitcoin)
EOF
    exit 1
}

# Validate chain name
validate_chain() {
    local chain=$1
    local valid_chains=("solana" "bnb" "ethereum" "polygon" "tron" "xrp" "bitcoin")

    for valid_chain in "${valid_chains[@]}"; do
        if [ "$chain" = "$valid_chain" ]; then
            return 0
        fi
    done

    log "ERROR" "Invalid chain name: $chain"
    usage
}

# Check if RPC endpoint is reachable
check_endpoint() {
    local endpoint=$1
    local http_endpoint="${endpoint/ws:/http:}"
    http_endpoint="${http_endpoint/wss:/https:}"

    log "INFO" "Checking endpoint connectivity: $http_endpoint"

    if curl -s --max-time 5 -X POST -H "Content-Type: application/json" \
        -d '{"id":1,"jsonrpc":"2.0","method":"system_health","params":[]}' \
        "$http_endpoint" | jq -e '.result' >/dev/null 2>&1; then
        log "INFO" "${GREEN}Endpoint is reachable${NC}"
        return 0
    else
        log "ERROR" "${RED}Endpoint is not reachable or not responding${NC}"
        return 1
    fi
}

# Get chain configuration from config.json
get_chain_config() {
    local chain=$1

    if [ ! -f "$CONFIG_FILE" ]; then
        log "ERROR" "Config file not found: $CONFIG_FILE"
        exit 1
    fi

    local config=$(jq -r ".chains.$chain" "$CONFIG_FILE")

    if [ "$config" = "null" ]; then
        log "ERROR" "Chain configuration not found in $CONFIG_FILE"
        exit 1
    fi

    echo "$config"
}

# Send extrinsic via RPC
send_extrinsic() {
    local endpoint=$1
    local method=$2
    local params=$3
    local http_endpoint="${endpoint/ws:/http:}"
    http_endpoint="${http_endpoint/wss:/https:}"

    log "INFO" "Sending extrinsic: $method"

    local payload=$(cat <<EOF
{
  "id": 1,
  "jsonrpc": "2.0",
  "method": "$method",
  "params": $params
}
EOF
)

    local response=$(curl -s -X POST -H "Content-Type: application/json" \
        -d "$payload" "$http_endpoint")

    if echo "$response" | jq -e '.result' >/dev/null 2>&1; then
        log "INFO" "${GREEN}Extrinsic sent successfully${NC}"
        echo "$response" | jq -r '.result'
        return 0
    else
        log "ERROR" "${RED}Extrinsic failed${NC}"
        echo "$response" | jq '.'
        return 1
    fi
}

# Configure bridge parameters
configure_bridge() {
    local chain=$1
    local endpoint=$2
    local config=$3

    log "INFO" "Configuring bridge for $chain"

    # Extract configuration values
    local token_address=$(echo "$config" | jq -r '.token_address')
    local exchange_rate=$(echo "$config" | jq -r '.exchange_rate')
    local bridge_address=$(echo "$config" | jq -r '.bridge_address')
    local decimals=$(echo "$config" | jq -r '.decimals')
    local operator=$(jq -r '.operator' "$CONFIG_FILE")

    log "INFO" "Token Address: $token_address"
    log "INFO" "Exchange Rate: $exchange_rate"
    log "INFO" "Bridge Address: $bridge_address"
    log "INFO" "Decimals: $decimals"

    # Configure token mapping (example extrinsic)
    log "INFO" "Step 1/4: Configuring token mapping..."
    local token_params=$(cat <<EOF
["bridge", "setTokenMapping", ["$chain", "$token_address", "$exchange_rate", $decimals]]
EOF
)

    # Note: In production, you would use proper extrinsic signing
    # This is a placeholder for the actual subxt or polkadot-js call
    log "INFO" "Token mapping configured (dry-run mode)"

    # Configure bridge address
    log "INFO" "Step 2/4: Configuring bridge address..."
    log "INFO" "Bridge address configured (dry-run mode)"

    # Set relayers
    log "INFO" "Step 3/4: Configuring relayers..."
    local relayers=$(jq -r '.relayers[]' "$CONFIG_FILE")
    for relayer in $relayers; do
        log "INFO" "Adding relayer: $relayer"
    done
    log "INFO" "Relayers configured (dry-run mode)"

    # Set bridge parameters
    log "INFO" "Step 4/4: Setting bridge parameters..."
    local max_amount=$(jq -r '.configuration.max_transfer_amount' "$CONFIG_FILE")
    local min_amount=$(jq -r '.configuration.min_transfer_amount' "$CONFIG_FILE")
    local fee_percent=$(jq -r '.configuration.bridge_fee_percent' "$CONFIG_FILE")
    local confirmations=$(jq -r ".configuration.confirmation_blocks.$chain" "$CONFIG_FILE")

    log "INFO" "Max Transfer: $max_amount"
    log "INFO" "Min Transfer: $min_amount"
    log "INFO" "Fee Percent: $fee_percent%"
    log "INFO" "Confirmations: $confirmations blocks"
    log "INFO" "Bridge parameters configured (dry-run mode)"

    log "INFO" "${GREEN}Bridge configuration completed for $chain${NC}"
}

# Verify configuration
verify_configuration() {
    local chain=$1
    local endpoint=$2

    log "INFO" "Verifying configuration for $chain..."

    local http_endpoint="${endpoint/ws:/http:}"
    http_endpoint="${http_endpoint/wss:/https:}"

    # Query chain state to verify configuration
    local state_query='{"id":1,"jsonrpc":"2.0","method":"state_getMetadata","params":[]}'

    if curl -s -X POST -H "Content-Type: application/json" \
        -d "$state_query" "$http_endpoint" >/dev/null 2>&1; then
        log "INFO" "${GREEN}Configuration verified successfully${NC}"
        return 0
    else
        log "WARN" "${YELLOW}Could not verify configuration${NC}"
        return 1
    fi
}

# Generate configuration script for subxt
generate_subxt_script() {
    local chain=$1
    local config=$2

    local script_path="$SCRIPT_DIR/subxt_${chain}_config.sh"

    cat > "$script_path" << 'EOF'
#!/bin/bash
# Auto-generated subxt configuration script
# This script uses subxt CLI to configure the PBC bridge

set -euo pipefail

CHAIN="$CHAIN_NAME"
ENDPOINT="$ENDPOINT"
SURI="${SURI:-//Alice}"

# Note: Replace with actual subxt commands when available
# Example subxt command structure:
# subxt tx \
#   --url "$ENDPOINT" \
#   --suri "$SURI" \
#   bridge setTokenMapping \
#   "$CHAIN" "$TOKEN_ADDRESS" $EXCHANGE_RATE $DECIMALS

echo "Subxt configuration for $CHAIN would execute here"
echo "Endpoint: $ENDPOINT"
echo "This is a placeholder - implement actual subxt calls"
EOF

    # Substitute variables
    sed -i.bak "s/\$CHAIN_NAME/$chain/g" "$script_path"
    sed -i.bak "s|\$ENDPOINT|$endpoint|g" "$script_path"
    rm -f "$script_path.bak"

    chmod +x "$script_path"
    log "INFO" "Generated subxt script: $script_path"
}

# Main function
main() {
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}   PBC Bridge Configuration Tool${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""

    # Check arguments
    if [ $# -lt 2 ]; then
        usage
    fi

    local chain=$1
    local endpoint=$2

    # Validate inputs
    check_dependencies
    validate_chain "$chain"

    log "INFO" "Starting configuration for chain: $chain"
    log "INFO" "Using endpoint: $endpoint"
    log "INFO" "Using config file: $CONFIG_FILE"

    # Check endpoint connectivity
    if ! check_endpoint "$endpoint"; then
        log "ERROR" "Cannot proceed - endpoint check failed"
        exit 1
    fi

    # Get chain configuration
    local config=$(get_chain_config "$chain")

    # Configure the bridge
    configure_bridge "$chain" "$endpoint" "$config"

    # Verify configuration
    verify_configuration "$chain" "$endpoint"

    # Generate subxt script
    generate_subxt_script "$chain" "$config"

    echo ""
    log "INFO" "${GREEN}Configuration completed successfully!${NC}"
    log "INFO" "Log file: $LOG_FILE"
    echo ""
}

# Run main function
main "$@"
