#!/bin/bash
set -e

# PBC Release Creation Script
# Usage: ./scripts/create-pbc-release.sh <pbc-name> <version> [binary-path]
# Example: ./scripts/create-pbc-release.sh eth 1.0.0
# Example: ./scripts/create-pbc-release.sh btc 1.2.0 /path/to/btc-pbc-collator

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ ${NC}$1"
}

print_success() {
    echo -e "${GREEN}✓ ${NC}$1"
}

print_warning() {
    echo -e "${YELLOW}⚠ ${NC}$1"
}

print_error() {
    echo -e "${RED}✗ ${NC}$1"
}

# Check arguments
if [ $# -lt 2 ]; then
    print_error "Usage: $0 <pbc-name> <version> [binary-path]"
    echo ""
    echo "Examples:"
    echo "  $0 eth 1.0.0"
    echo "  $0 btc 1.2.0 /path/to/btc-pbc-collator"
    echo ""
    echo "Available PBCs:"
    echo "  eth, btc, sol, trx, bnb, xrp, ada, xlm, doge, link, matic, sc-usdt, edsc, ai-compute"
    exit 1
fi

PBC_NAME=$1
VERSION=$2
BINARY_PATH=$3

# Validate version format (semantic versioning)
if ! [[ $VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    print_error "Invalid version format: $VERSION"
    print_info "Version must be in format X.Y.Z (e.g., 1.0.0)"
    exit 1
fi

# PBC configurations
declare -A PBC_NAMES=(
    ["eth"]="Ethereum"
    ["btc"]="Bitcoin"
    ["sol"]="Solana"
    ["trx"]="Tron"
    ["bnb"]="BNB Chain"
    ["xrp"]="XRP Ledger"
    ["ada"]="Cardano"
    ["xlm"]="Stellar"
    ["doge"]="Dogecoin"
    ["link"]="Chainlink"
    ["matic"]="Polygon"
    ["sc-usdt"]="USDT"
    ["edsc"]="EDSC"
    ["ai-compute"]="AI Compute"
)

# Validate PBC name
if [ -z "${PBC_NAMES[$PBC_NAME]}" ]; then
    print_error "Unknown PBC: $PBC_NAME"
    print_info "Available PBCs: ${!PBC_NAMES[@]}"
    exit 1
fi

FULL_NAME="${PBC_NAMES[$PBC_NAME]}"
TAG_NAME="${PBC_NAME}-pbc-v${VERSION}"
RELEASE_TITLE="${PBC_NAME^^} PBC Collator v${VERSION}"
BINARY_NAME="${PBC_NAME}-pbc-collator"

# Determine workspace directory (check both possible locations)
WORKSPACE_DIR="05-multichain/partition-burst-chains/${PBC_NAME}-pbc-workspace"
if [ ! -d "$WORKSPACE_DIR" ]; then
    # Try pbc-chains directory
    WORKSPACE_DIR="05-multichain/partition-burst-chains/pbc-chains/${PBC_NAME}-pbc"
fi

print_info "Creating release for ${FULL_NAME} PBC v${VERSION}"
echo ""

# Check if workspace exists
if [ ! -d "$WORKSPACE_DIR" ]; then
    print_error "Workspace not found at:"
    echo "  - 05-multichain/partition-burst-chains/${PBC_NAME}-pbc-workspace"
    echo "  - 05-multichain/partition-burst-chains/pbc-chains/${PBC_NAME}-pbc"
    exit 1
fi

print_info "Using workspace: $WORKSPACE_DIR"

# Determine binary path
if [ -z "$BINARY_PATH" ]; then
    # Try to find binary in workspace target directory
    DEFAULT_BINARY_PATH="${WORKSPACE_DIR}/target/release/${BINARY_NAME}"
    if [ -f "$DEFAULT_BINARY_PATH" ]; then
        BINARY_PATH="$DEFAULT_BINARY_PATH"
        print_info "Using binary from: $BINARY_PATH"
    else
        print_warning "Binary not found at: $DEFAULT_BINARY_PATH"
        print_info "Please build the binary first or provide path as third argument"
        print_info "Build command:"
        echo "  cd $WORKSPACE_DIR"
        echo "  cargo build --release -p ${BINARY_NAME}"
        exit 1
    fi
else
    if [ ! -f "$BINARY_PATH" ]; then
        print_error "Binary not found at: $BINARY_PATH"
        exit 1
    fi
    print_info "Using binary from: $BINARY_PATH"
fi

# Verify binary is executable
if [ ! -x "$BINARY_PATH" ]; then
    print_info "Making binary executable..."
    chmod +x "$BINARY_PATH"
fi

# Test binary
print_info "Testing binary..."
if ! "$BINARY_PATH" --version > /dev/null 2>&1; then
    print_error "Binary test failed: $BINARY_PATH --version"
    exit 1
fi
print_success "Binary test passed"

# Check if tag already exists
if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
    print_warning "Tag $TAG_NAME already exists"
    read -p "Do you want to delete and recreate it? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_info "Deleting existing tag..."
        git tag -d "$TAG_NAME"
        git push origin ":refs/tags/$TAG_NAME" 2>/dev/null || true
        print_success "Deleted existing tag"
    else
        print_error "Aborted"
        exit 1
    fi
fi

# Create git tag
print_info "Creating git tag: $TAG_NAME"
git tag -a "$TAG_NAME" -m "${RELEASE_TITLE}

${FULL_NAME} bridge collator for Ëtrid multichain network.

Version: ${VERSION}
Compatible with: FlareChain v1.0.0+
Build date: $(date +'%Y-%m-%d')

Built by Gizzi / Eoj Edred"

print_success "Created tag: $TAG_NAME"

# Push tag to GitHub
print_info "Pushing tag to GitHub..."
if git push origin "$TAG_NAME"; then
    print_success "Tag pushed to GitHub"
else
    print_error "Failed to push tag to GitHub"
    print_info "You can manually push with: git push origin $TAG_NAME"
    exit 1
fi

# Prepare binary for upload
UPLOAD_DIR="/tmp/pbc-release-${PBC_NAME}-${VERSION}"
mkdir -p "$UPLOAD_DIR"

COMPRESSED_BINARY="${UPLOAD_DIR}/${BINARY_NAME}-v${VERSION}-linux-x86_64.gz"

print_info "Compressing binary..."
gzip -c "$BINARY_PATH" > "$COMPRESSED_BINARY"
print_success "Binary compressed: $(du -h "$COMPRESSED_BINARY" | cut -f1)"

# Generate release notes
RELEASE_NOTES="${UPLOAD_DIR}/release-notes.md"
cat > "$RELEASE_NOTES" <<EOF
# ${RELEASE_TITLE}

## Overview
${FULL_NAME} bridge collator for Ëtrid multichain network.

## Features
- Full ${FULL_NAME} integration
- Cross-chain bridge support
- GRANDPA finality integration
- Optimized for production use

## Installation

### Download Binary
\`\`\`bash
wget https://github.com/EojEdred/Etrid/releases/download/${TAG_NAME}/${BINARY_NAME}-v${VERSION}-linux-x86_64.gz
gunzip ${BINARY_NAME}-v${VERSION}-linux-x86_64.gz
chmod +x ${BINARY_NAME}-v${VERSION}-linux-x86_64
\`\`\`

### Run Collator
\`\`\`bash
./${BINARY_NAME}-v${VERSION}-linux-x86_64 \\
  --collator \\
  --base-path /var/lib/${PBC_NAME}-pbc \\
  --port 30333 \\
  --rpc-port 9944
\`\`\`

## Requirements
- FlareChain v1.0.0 or higher
- 4GB RAM minimum
- 100GB disk space

## Documentation
- [PBC Architecture](https://github.com/EojEdred/Etrid/blob/main/docs/architecture.md)
- [PBC Release Guide](https://github.com/EojEdred/Etrid/blob/main/docs/PBC_RELEASE_GUIDE.md)
- [Operator Guide](https://github.com/EojEdred/Etrid/blob/main/docs/OPERATOR_GUIDE.md)

## Changelog
- Version ${VERSION}
- ${FULL_NAME} bridge integration
- Production-ready release

Built by Gizzi / Eoj Edred
EOF

print_success "Release notes generated"

# Create GitHub release
print_info "Creating GitHub release..."

if gh release create "$TAG_NAME" \
    "$COMPRESSED_BINARY" \
    --repo EojEdred/Etrid \
    --title "$RELEASE_TITLE" \
    --notes-file "$RELEASE_NOTES"; then
    print_success "GitHub release created!"
else
    print_error "Failed to create GitHub release"
    print_info "Binary available at: $COMPRESSED_BINARY"
    print_info "Release notes at: $RELEASE_NOTES"
    print_info "You can manually create the release with:"
    echo "  gh release create $TAG_NAME $COMPRESSED_BINARY --title \"$RELEASE_TITLE\" --notes-file $RELEASE_NOTES"
    exit 1
fi

# Cleanup
print_info "Cleaning up temporary files..."
rm -rf "$UPLOAD_DIR"
print_success "Cleanup complete"

echo ""
print_success "═══════════════════════════════════════════════════"
print_success "  ${FULL_NAME} PBC v${VERSION} Released Successfully!"
print_success "═══════════════════════════════════════════════════"
echo ""
print_info "Release URL: https://github.com/EojEdred/Etrid/releases/tag/${TAG_NAME}"
echo ""
print_info "Next steps:"
echo "  1. Update docs/PBC_RELEASE_GUIDE.md release matrix"
echo "  2. Announce release to community"
echo "  3. Update validators if needed"
echo ""
