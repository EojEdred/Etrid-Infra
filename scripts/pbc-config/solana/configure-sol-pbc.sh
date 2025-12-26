#!/bin/bash
set -e

# Sol-PBC Configuration Script
# Configures the Solana PBC with ËTR SPL token support

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/sol-pbc-config.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if config file exists
if [ ! -f "$CONFIG_FILE" ]; then
    print_error "Configuration file not found: $CONFIG_FILE"
    exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    print_error "jq is required but not installed. Install with: brew install jq"
    exit 1
fi

# Check if polkadot-js CLI is available
if ! command -v polkadot-js-api &> /dev/null; then
    print_warn "polkadot-js-api CLI not found. Installing..."
    npm install -g @polkadot/api-cli
fi

print_header "Sol-PBC Configuration"

# Read configuration
SOL_PBC_NODE=$(jq -r '.sol_pbc_node' "$CONFIG_FILE")
ETR_H256=$(jq -r '.tokens.ETR.h256_address' "$CONFIG_FILE")
ETR_SPL=$(jq -r '.tokens.ETR.spl_address' "$CONFIG_FILE")
EXCHANGE_RATE=$(jq -r '.tokens.ETR.exchange_rate' "$CONFIG_FILE")
DECIMALS=$(jq -r '.tokens.ETR.decimals' "$CONFIG_FILE")
OPERATOR=$(jq -r '.operator.account' "$CONFIG_FILE")

print_info "Sol-PBC Node: $SOL_PBC_NODE"
print_info "ËTR SPL Address: $ETR_SPL"
print_info "ËTR H256 Address: $ETR_H256"
print_info "Exchange Rate: $EXCHANGE_RATE (1:1 for $DECIMALS decimals)"

# Check if operator account is set
if [ "$OPERATOR" == "OPERATOR_ACCOUNT_PLACEHOLDER" ]; then
    print_error "Operator account not configured!"
    print_error "Please edit $CONFIG_FILE and set the operator account"
    exit 1
fi

# Confirm before proceeding
echo
read -p "$(echo -e ${YELLOW}Do you want to proceed with configuration? [y/N]:${NC} )" -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_info "Configuration cancelled"
    exit 0
fi

print_header "Step 1: Set Operator Account"

print_info "Setting operator: $OPERATOR"

# Example extrinsic call (adjust based on actual pallet methods)
# polkadot-js-api --ws "$SOL_PBC_NODE" tx.bridgeConfig.setOperator "$OPERATOR" --seed "$SEED"

print_warn "Manual action required: Call bridgeConfig.setOperator($OPERATOR)"
echo "Command template:"
echo "  polkadot-js-api --ws $SOL_PBC_NODE tx.bridgeConfig.setOperator $OPERATOR --seed \$OPERATOR_SEED"
echo

print_header "Step 2: Add Supported Token"

print_info "Adding ËTR token support"
print_info "  H256 Address: $ETR_H256"
print_info "  Exchange Rate: $EXCHANGE_RATE"
print_info "  Decimals: $DECIMALS"

print_warn "Manual action required: Call bridgeConfig.addSupportedToken(...)"
echo "Command template:"
echo "  polkadot-js-api --ws $SOL_PBC_NODE tx.bridgeConfig.addSupportedToken \\"
echo "    '$ETR_H256' \\"
echo "    '$EXCHANGE_RATE' \\"
echo "    $DECIMALS \\"
echo "    --seed \$OPERATOR_SEED"
echo

print_header "Step 3: Register Relayers"

# Read relayers from config
RELAYER_COUNT=$(jq '.relayers | length' "$CONFIG_FILE")

for ((i=0; i<$RELAYER_COUNT; i++)); do
    RELAYER=$(jq -r ".relayers[$i].account" "$CONFIG_FILE")
    SOLANA_WALLET=$(jq -r ".relayers[$i].solana_wallet" "$CONFIG_FILE")

    if [[ "$RELAYER" != *"PLACEHOLDER"* ]]; then
        print_info "Registering relayer $((i+1)): $RELAYER"
        print_info "  Solana wallet: $SOLANA_WALLET"

        print_warn "Manual action required: Call bridgeConfig.registerRelayer(...)"
        echo "Command template:"
        echo "  polkadot-js-api --ws $SOL_PBC_NODE tx.bridgeConfig.registerRelayer \\"
        echo "    '$RELAYER' \\"
        echo "    '$SOLANA_WALLET' \\"
        echo "    --seed \$OPERATOR_SEED"
        echo
    else
        print_warn "Skipping relayer $((i+1)): account not configured"
    fi
done

print_header "Configuration Summary"

print_info "Configuration file: $CONFIG_FILE"
print_info "Sol-PBC node: $SOL_PBC_NODE"
print_info "ËTR token configured with H256: $ETR_H256"
print_info ""
print_warn "IMPORTANT: The commands above are templates."
print_warn "You need to execute them with the appropriate operator seed/key."
print_warn ""
print_info "Next steps:"
print_info "1. Execute the setOperator extrinsic with sudo privileges"
print_info "2. Execute the addSupportedToken extrinsic to add ËTR"
print_info "3. Execute registerRelayer for each relayer account"
print_info "4. Verify configuration with query.bridgeConfig.supportedTokens()"
print_info "5. Start relayer services"

print_header "Verification Commands"

echo "Check operator:"
echo "  polkadot-js-api --ws $SOL_PBC_NODE query.bridgeConfig.operator"
echo
echo "Check supported tokens:"
echo "  polkadot-js-api --ws $SOL_PBC_NODE query.bridgeConfig.supportedTokens '$ETR_H256'"
echo
echo "Check relayers:"
echo "  polkadot-js-api --ws $SOL_PBC_NODE query.bridgeConfig.relayers"
echo

print_info "Configuration script completed!"
