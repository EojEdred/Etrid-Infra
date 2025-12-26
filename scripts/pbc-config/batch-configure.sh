#!/bin/bash

# Batch PBC Bridge Configuration Script
# Configures ALL PBC bridges in parallel from config.json
# Usage: ./batch-configure.sh [config-file] [--sequential] [--chains chain1,chain2,...]

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="${1:-$SCRIPT_DIR/config.json}"
LOG_DIR="$SCRIPT_DIR/logs"
MAIN_LOG="$LOG_DIR/batch-config-$(date +%Y%m%d-%H%M%S).log"
PARALLEL_MODE=true
SELECTED_CHAINS=""

# Parse arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --sequential)
                PARALLEL_MODE=false
                shift
                ;;
            --chains)
                SELECTED_CHAINS="$2"
                shift 2
                ;;
            --help)
                usage
                ;;
            *)
                if [ -f "$1" ]; then
                    CONFIG_FILE="$1"
                fi
                shift
                ;;
        esac
    done
}

# Create log directory
mkdir -p "$LOG_DIR"

# Print usage
usage() {
    cat << EOF
Usage: $0 [config-file] [options]

Options:
  --sequential          Run configurations sequentially instead of parallel
  --chains chain1,...   Configure only specific chains (comma-separated)
  --help               Show this help message

Examples:
  $0                                    # Configure all chains in parallel
  $0 --sequential                       # Configure all chains sequentially
  $0 --chains solana,ethereum           # Configure only Solana and Ethereum
  $0 custom-config.json --sequential    # Use custom config, sequential mode

Supported chains: solana, bnb, ethereum, polygon, tron, xrp, bitcoin
EOF
    exit 1
}

# Log function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$MAIN_LOG"
}

# Check dependencies
check_dependencies() {
    local missing_deps=()

    command -v jq >/dev/null 2>&1 || missing_deps+=("jq")
    command -v curl >/dev/null 2>&1 || missing_deps+=("curl")

    if [ ${#missing_deps[@]} -ne 0 ]; then
        echo -e "${RED}Error: Missing dependencies: ${missing_deps[*]}${NC}"
        exit 1
    fi

    if [ ! -f "$SCRIPT_DIR/configure-pbc.sh" ]; then
        echo -e "${RED}Error: configure-pbc.sh not found in $SCRIPT_DIR${NC}"
        exit 1
    fi
}

# Get list of chains to configure
get_chains() {
    if [ -n "$SELECTED_CHAINS" ]; then
        echo "$SELECTED_CHAINS" | tr ',' '\n'
    else
        jq -r '.chains | keys[]' "$CONFIG_FILE"
    fi
}

# Configure single chain
configure_chain() {
    local chain=$1
    local chain_log="$LOG_DIR/${chain}-config-$(date +%Y%m%d-%H%M%S).log"

    log "INFO" "${CYAN}Starting configuration for $chain${NC}"

    # Get endpoint from config
    local endpoint=$(jq -r ".chains.$chain.pbc_endpoint" "$CONFIG_FILE")

    if [ "$endpoint" = "null" ]; then
        log "ERROR" "${RED}No endpoint found for $chain${NC}"
        echo "FAILED" > "$LOG_DIR/${chain}.status"
        return 1
    fi

    # Run configuration script
    if bash "$SCRIPT_DIR/configure-pbc.sh" "$chain" "$endpoint" "$CONFIG_FILE" > "$chain_log" 2>&1; then
        log "INFO" "${GREEN}Successfully configured $chain${NC}"
        echo "SUCCESS" > "$LOG_DIR/${chain}.status"
        return 0
    else
        log "ERROR" "${RED}Failed to configure $chain${NC}"
        echo "FAILED" > "$LOG_DIR/${chain}.status"
        return 1
    fi
}

# Configure chains in parallel
configure_parallel() {
    local chains=("$@")
    local pids=()

    log "INFO" "${BLUE}Running parallel configuration for ${#chains[@]} chains${NC}"

    # Start all configurations in background
    for chain in "${chains[@]}"; do
        configure_chain "$chain" &
        pids+=($!)
    done

    # Wait for all to complete
    local failed=0
    for i in "${!pids[@]}"; do
        if ! wait "${pids[$i]}"; then
            failed=$((failed + 1))
        fi
    done

    return $failed
}

# Configure chains sequentially
configure_sequential() {
    local chains=("$@")
    local failed=0

    log "INFO" "${BLUE}Running sequential configuration for ${#chains[@]} chains${NC}"

    for chain in "${chains[@]}"; do
        if ! configure_chain "$chain"; then
            failed=$((failed + 1))
        fi
        sleep 2  # Brief pause between configurations
    done

    return $failed
}

# Print configuration summary
print_summary() {
    echo ""
    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}   Configuration Summary${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""

    local total=0
    local success=0
    local failed=0

    for status_file in "$LOG_DIR"/*.status; do
        if [ -f "$status_file" ]; then
            total=$((total + 1))
            local chain=$(basename "$status_file" .status)
            local status=$(cat "$status_file")

            if [ "$status" = "SUCCESS" ]; then
                success=$((success + 1))
                echo -e "${GREEN}[SUCCESS]${NC} $chain"
            else
                failed=$((failed + 1))
                echo -e "${RED}[FAILED]${NC}  $chain"
            fi
        fi
    done

    echo ""
    echo -e "Total chains: $total"
    echo -e "${GREEN}Successful: $success${NC}"
    echo -e "${RED}Failed: $failed${NC}"
    echo ""

    if [ $failed -eq 0 ]; then
        echo -e "${GREEN}All configurations completed successfully!${NC}"
    else
        echo -e "${YELLOW}Some configurations failed. Check logs in $LOG_DIR${NC}"
    fi

    echo ""
    log "INFO" "Summary: $success/$total configurations successful"
}

# Health check for all configured chains
health_check() {
    log "INFO" "Performing health check on configured chains..."

    local chains=("$@")

    for chain in "${chains[@]}"; do
        local endpoint=$(jq -r ".chains.$chain.http_endpoint" "$CONFIG_FILE")

        if [ "$endpoint" = "null" ]; then
            endpoint=$(jq -r ".chains.$chain.pbc_endpoint" "$CONFIG_FILE")
            endpoint="${endpoint/ws:/http:}"
        fi

        local health=$(curl -s --max-time 5 -X POST \
            -H "Content-Type: application/json" \
            -d '{"id":1,"jsonrpc":"2.0","method":"system_health","params":[]}' \
            "$endpoint" 2>/dev/null | jq -r '.result.isSyncing // "unknown"')

        if [ "$health" = "false" ]; then
            echo -e "${GREEN}[SYNCED]${NC} $chain"
        elif [ "$health" = "true" ]; then
            echo -e "${YELLOW}[SYNCING]${NC} $chain"
        else
            echo -e "${RED}[OFFLINE]${NC} $chain"
        fi
    done
}

# Export configuration for verification
export_config_summary() {
    local output_file="$LOG_DIR/config-summary-$(date +%Y%m%d-%H%M%S).json"

    log "INFO" "Exporting configuration summary to $output_file"

    jq '{
        operator: .operator,
        relayers: .relayers,
        chains: (.chains | to_entries | map({
            name: .key,
            endpoint: .value.pbc_endpoint,
            token: .value.token_address,
            decimals: .value.decimals
        })),
        configuration: .configuration
    }' "$CONFIG_FILE" > "$output_file"

    log "INFO" "Configuration summary exported"
}

# Main function
main() {
    # Parse command line arguments
    if [ $# -gt 0 ]; then
        parse_args "$@"
    fi

    echo -e "${BLUE}============================================${NC}"
    echo -e "${BLUE}   Batch PBC Bridge Configuration${NC}"
    echo -e "${BLUE}============================================${NC}"
    echo ""

    # Check dependencies
    check_dependencies

    # Validate config file
    if [ ! -f "$CONFIG_FILE" ]; then
        log "ERROR" "Config file not found: $CONFIG_FILE"
        exit 1
    fi

    log "INFO" "Using config file: $CONFIG_FILE"
    log "INFO" "Mode: $([ "$PARALLEL_MODE" = true ] && echo "Parallel" || echo "Sequential")"

    # Get chains to configure
    local chains=()
    while IFS= read -r chain; do
        chains+=("$chain")
    done < <(get_chains)

    if [ ${#chains[@]} -eq 0 ]; then
        log "ERROR" "No chains found to configure"
        exit 1
    fi

    log "INFO" "Chains to configure: ${chains[*]}"

    # Clean up old status files
    rm -f "$LOG_DIR"/*.status

    # Start configuration
    local start_time=$(date +%s)

    if [ "$PARALLEL_MODE" = true ]; then
        configure_parallel "${chains[@]}"
    else
        configure_sequential "${chains[@]}"
    fi

    local end_time=$(date +%s)
    local duration=$((end_time - start_time))

    log "INFO" "Configuration completed in ${duration}s"

    # Print summary
    print_summary

    # Health check
    echo -e "${BLUE}Performing health check...${NC}"
    health_check "${chains[@]}"

    # Export summary
    export_config_summary

    echo ""
    log "INFO" "Main log file: $MAIN_LOG"
    log "INFO" "Individual logs: $LOG_DIR/<chain>-config-*.log"
    echo ""
}

# Run main function
main "$@"
