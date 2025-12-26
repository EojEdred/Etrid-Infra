#!/bin/bash
# Distribute built binaries from build VM to ALL validator VMs
# Each VM gets ALL binaries (primearc + all PBC collators)
# Usage: ./distribute-binaries.sh [build-vm-alias] [--dry-run]

set -e

# Configuration
BUILD_VM="${1:-ts-val-01}"
REMOTE_BUILD_DIR="/home/ubuntu/etrid-build"
BINARY_DIR="/opt/etrid/bin"
SSH_KEY_ORACLE="~/.ssh/gizzi-validator"
SSH_KEY_CONTABO="~/.ssh/contabo-validators"

# All validator VMs - each gets ALL binaries
VALIDATORS=(
    "ts-val-01" "ts-val-02" "ts-val-03" "ts-val-04" "ts-val-05"
    "ts-val-06" "ts-val-07" "ts-val-08" "ts-val-09" "ts-val-10"
    "ts-val-11" "ts-val-12" "ts-val-13" "ts-val-14" "ts-val-15"
    "ts-val-16" "ts-val-17" "ts-val-18" "ts-val-19" "ts-val-20"
    "ts-val-21" "ts-val-22"
)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }

# Parse arguments
DRY_RUN=false
for arg in "$@"; do
    case $arg in
        --dry-run) DRY_RUN=true ;;
        ts-val-*) BUILD_VM="$arg" ;;
    esac
done

# Determine SSH key based on VM
get_ssh_key() {
    case "$1" in
        ts-val-01|ts-val-02) echo "$SSH_KEY_ORACLE" ;;
        *) echo "$SSH_KEY_CONTABO" ;;
    esac
}

get_user() {
    case "$1" in
        ts-val-01|ts-val-02) echo "ubuntu" ;;
        *) echo "root" ;;
    esac
}

log "=========================================="
log "  ËTRID Binary Distribution"
log "  ALL binaries → ALL VMs"
log "=========================================="
log "Build VM: $BUILD_VM"
log "Target VMs: ${#VALIDATORS[@]} validators"
log "Dry Run: $DRY_RUN"
echo ""

# Step 1: Get list of built binaries from build VM
log "Step 1: Checking built binaries on $BUILD_VM..."
BUILD_SSH_KEY=$(get_ssh_key "$BUILD_VM")

BINARIES=$(ssh -i $BUILD_SSH_KEY $BUILD_VM "ls $REMOTE_BUILD_DIR/target/release/ 2>/dev/null | grep -E 'collator$|primearc-core-node$'" || true)

if [ -z "$BINARIES" ]; then
    error "No binaries found on $BUILD_VM. Run build-on-vm.sh first."
    exit 1
fi

echo "Found binaries:"
echo "$BINARIES" | while read bin; do
    size=$(ssh -i $BUILD_SSH_KEY $BUILD_VM "ls -lh $REMOTE_BUILD_DIR/target/release/$bin 2>/dev/null | awk '{print \$5}'" || echo "?")
    echo "  - $bin ($size)"
done
echo ""

# Step 2: Create local temp directory for binaries
TEMP_DIR=$(mktemp -d)
log "Step 2: Downloading binaries to local temp: $TEMP_DIR"

for binary in $BINARIES; do
    log "  Downloading $binary..."
    if [ "$DRY_RUN" = false ]; then
        scp -i $BUILD_SSH_KEY "$BUILD_VM:$REMOTE_BUILD_DIR/target/release/$binary" "$TEMP_DIR/"
        chmod +x "$TEMP_DIR/$binary"
    fi
done
success "Binaries downloaded"

# Step 3: Distribute ALL binaries to ALL VMs
log "Step 3: Distributing ALL binaries to ALL ${#VALIDATORS[@]} VMs..."
echo ""

FAILED_VMS=()
SUCCESS_COUNT=0

for vm in "${VALIDATORS[@]}"; do
    # Skip build VM (already has binaries)
    if [ "$vm" = "$BUILD_VM" ]; then
        log "  Skipping $vm (build VM)"
        continue
    fi

    ssh_key=$(get_ssh_key "$vm")
    user=$(get_user "$vm")

    log "  Deploying to $vm..."

    if [ "$DRY_RUN" = true ]; then
        echo "    [DRY-RUN] Would copy all binaries to $vm:$BINARY_DIR/"
        continue
    fi

    # Check connectivity
    if ! ssh -i $ssh_key -o ConnectTimeout=10 $vm "echo ok" &>/dev/null; then
        warn "    Cannot connect to $vm, skipping..."
        FAILED_VMS+=("$vm")
        continue
    fi

    # Create directory if needed
    ssh -i $ssh_key $vm "mkdir -p $BINARY_DIR" 2>/dev/null || true

    # Copy all binaries
    for binary in $BINARIES; do
        scp -i $ssh_key "$TEMP_DIR/$binary" "$vm:$BINARY_DIR/" 2>/dev/null
        ssh -i $ssh_key $vm "chmod +x $BINARY_DIR/$binary" 2>/dev/null
    done

    success "    All binaries deployed to $vm"
    ((SUCCESS_COUNT++))
done

# Cleanup
rm -rf "$TEMP_DIR"

echo ""
log "=========================================="
success "  Distribution Complete!"
log "=========================================="
echo ""
log "Successfully deployed to: $SUCCESS_COUNT VMs"

if [ ${#FAILED_VMS[@]} -gt 0 ]; then
    warn "Failed VMs: ${FAILED_VMS[*]}"
fi

echo ""
log "Next steps:"
log "  1. Restart services: ./restart-pbcs.sh"
log "  2. Check status: ./check-pbc-status.sh"
