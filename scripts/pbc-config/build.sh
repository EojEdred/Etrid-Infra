#!/bin/bash

# Build script for etrid-bridge-config Rust CLI
# Usage: ./build.sh [--release]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}Building Etrid Bridge Config CLI...${NC}"

# Check if Rust is installed
if ! command -v cargo &> /dev/null; then
    echo -e "${YELLOW}Rust is not installed. Installing via rustup...${NC}"
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
fi

# Parse arguments
BUILD_MODE="debug"
if [[ "${1:-}" == "--release" ]]; then
    BUILD_MODE="release"
    CARGO_FLAGS="--release"
else
    CARGO_FLAGS=""
fi

echo -e "${BLUE}Build mode: $BUILD_MODE${NC}"

# Build the project
echo -e "${BLUE}Running cargo build...${NC}"
cargo build $CARGO_FLAGS

# Copy binary to convenient location
if [[ "$BUILD_MODE" == "release" ]]; then
    BINARY_PATH="target/release/etrid-bridge-config"
else
    BINARY_PATH="target/debug/etrid-bridge-config"
fi

if [[ -f "$BINARY_PATH" ]]; then
    echo -e "${GREEN}Build successful!${NC}"
    echo -e "Binary location: ${BINARY_PATH}"

    # Optionally create symlink
    ln -sf "$BINARY_PATH" "$SCRIPT_DIR/etrid-bridge-config"
    echo -e "Symlink created: $SCRIPT_DIR/etrid-bridge-config"

    # Show usage
    echo ""
    echo -e "${BLUE}Usage examples:${NC}"
    echo "  ./etrid-bridge-config configure solana"
    echo "  ./etrid-bridge-config configure-all --chains solana,ethereum"
    echo "  ./etrid-bridge-config verify ethereum"
    echo "  ./etrid-bridge-config query solana --query-type token-mapping"
else
    echo -e "${YELLOW}Build completed but binary not found${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}Build complete!${NC}"
