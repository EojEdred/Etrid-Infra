#!/bin/bash
# Build PBC collators on a Linux VM
# Usage: ./build-on-vm.sh [build-vm-alias]

set -e

# Configuration
BUILD_VM="${1:-ts-val-01}"  # Default to Oracle Cloud VM (more resources)
SOURCE_DIR="/Users/macbook/Desktop/etrid"
REMOTE_BUILD_DIR="/home/ubuntu/etrid-build"
SSH_KEY_ORACLE="~/.ssh/gizzi-validator"
SSH_KEY_CONTABO="~/.ssh/contabo-validators"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# Determine SSH key based on VM
get_ssh_key() {
    case "$1" in
        ts-val-01|ts-val-02) echo "$SSH_KEY_ORACLE" ;;
        *) echo "$SSH_KEY_CONTABO" ;;
    esac
}

# Determine user based on VM
get_user() {
    case "$1" in
        ts-val-01|ts-val-02) echo "ubuntu" ;;
        *) echo "root" ;;
    esac
}

SSH_KEY=$(get_ssh_key "$BUILD_VM")
REMOTE_USER=$(get_user "$BUILD_VM")

log "=========================================="
log "  ËTRID PBC Build on Linux VM"
log "=========================================="
log "Build VM: $BUILD_VM"
log "User: $REMOTE_USER"
log "SSH Key: $SSH_KEY"
echo ""

# Step 1: Check VM connectivity
log "Step 1: Checking VM connectivity..."
if ! ssh -i $SSH_KEY -o ConnectTimeout=10 $BUILD_VM "echo 'Connected'" 2>/dev/null; then
    error "Cannot connect to $BUILD_VM"
fi
success "Connected to $BUILD_VM"

# Step 2: Check/Install Rust on VM
log "Step 2: Checking Rust installation on VM..."
ssh -i $SSH_KEY $BUILD_VM "bash -s" << 'REMOTE_RUST'
if ! command -v rustc &> /dev/null; then
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source ~/.cargo/env
fi
rustc --version
cargo --version

# Add wasm target if not present
if ! rustup target list --installed | grep -q wasm32-unknown-unknown; then
    echo "Adding wasm32-unknown-unknown target..."
    rustup target add wasm32-unknown-unknown
fi
REMOTE_RUST
success "Rust is ready on VM"

# Step 3: Sync source code to VM
log "Step 3: Syncing source code to VM..."
log "This may take a few minutes for first sync..."

# Create exclude file for rsync
EXCLUDE_FILE=$(mktemp)
cat > "$EXCLUDE_FILE" << 'EOF'
target/
.git/
*.log
node_modules/
.DS_Store
Cargo.lock
EOF

rsync -avz --progress \
    --exclude-from="$EXCLUDE_FILE" \
    -e "ssh -i $SSH_KEY" \
    "$SOURCE_DIR/" \
    "$BUILD_VM:$REMOTE_BUILD_DIR/"

rm "$EXCLUDE_FILE"
success "Source code synced"

# Step 4: Build on VM
log "Step 4: Building PBC collators on VM..."
log "This will take 15-30 minutes for release build..."

ssh -i $SSH_KEY $BUILD_VM "bash -s" << REMOTE_BUILD
set -e
cd $REMOTE_BUILD_DIR
source ~/.cargo/env

# Check available memory
echo "Available memory:"
free -h

# Build all PBC collators in release mode
echo ""
echo "Building all PBC collators..."
echo "=============================="

# Build Primearc Core Node (main relay chain)
echo ""
echo "Building primearc-core-node (main validator)..."
cargo build --release -p primearc-core-node 2>&1 || echo "⚠ primearc-core-node build failed"

# List of PBC collator packages to build (those with dedicated collators)
DEDICATED_COLLATORS=(
    "eth-pbc-collator"
    "doge-pbc-collator"
    "ai-compute-pbc-collator"
)

# Build dedicated collators
for collator in "\${DEDICATED_COLLATORS[@]}"; do
    echo ""
    echo "Building \$collator..."
    if cargo build --release -p "\$collator" 2>&1; then
        echo "✓ \$collator built successfully"
    else
        echo "⚠ \$collator build failed or package not found, skipping..."
    fi
done

# Build generic PBC collator (used by other PBCs)
echo ""
echo "Building generic pbc-collator..."
cargo build --release -p pbc-collator 2>&1 || echo "⚠ pbc-collator build failed"

# Build PBC runtimes (needed for generic collator)
PBC_RUNTIMES=(
    "btc-pbc-runtime"
    "eth-pbc-runtime"
    "sol-pbc-runtime"
    "bnb-pbc-runtime"
    "xrp-pbc-runtime"
    "trx-pbc-runtime"
    "matic-pbc-runtime"
    "doge-pbc-runtime"
    "xlm-pbc-runtime"
    "ada-pbc-runtime"
    "link-pbc-runtime"
    "sc-usdt-pbc-runtime"
    "edsc-pbc-runtime"
)

echo ""
echo "Building PBC runtimes..."
for runtime in "\${PBC_RUNTIMES[@]}"; do
    echo "  Building \$runtime..."
    cargo build --release -p "\$runtime" 2>&1 || echo "  ⚠ \$runtime skipped"
done

echo ""
echo "=============================="
echo "Build complete!"
echo ""
echo "Built binaries:"
ls -lh target/release/*-collator 2>/dev/null || echo "No collator binaries found"
ls -lh target/release/flarechain-node 2>/dev/null || echo "No flarechain-node found"
REMOTE_BUILD

success "Build complete on VM"

# Step 5: List built binaries
log "Step 5: Checking built binaries..."
ssh -i $SSH_KEY $BUILD_VM "ls -lh $REMOTE_BUILD_DIR/target/release/ | grep -E 'collator|flarechain' | grep -v '\.d$'"

echo ""
success "=========================================="
success "  Build Complete!"
success "=========================================="
echo ""
log "Built binaries are at: $BUILD_VM:$REMOTE_BUILD_DIR/target/release/"
log ""
log "Next step: Run ./distribute-binaries.sh to copy to all VMs"
