#!/bin/bash
# Quick build and deploy - all in one
# Usage: ./quick-build-deploy.sh [build-vm]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_VM="${1:-ts-val-01}"

echo "=========================================="
echo "  ËTRID Quick Build & Deploy"
echo "=========================================="
echo ""
echo "Build VM: $BUILD_VM"
echo ""
echo "This will:"
echo "  1. Sync code to $BUILD_VM"
echo "  2. Build all binaries (primearc + PBC collators) (15-30 min)"
echo "  3. Distribute ALL binaries to ALL 22 VMs"
echo "  4. Restart services on all VMs"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Step 1: Build
echo ""
echo "=== Step 1: Building on $BUILD_VM ==="
"$SCRIPT_DIR/build-on-vm.sh" "$BUILD_VM"

# Step 2: Distribute
echo ""
echo "=== Step 2: Distributing binaries ==="
"$SCRIPT_DIR/distribute-binaries.sh" "$BUILD_VM" --pbc=all

# Step 3: Restart (optional)
echo ""
read -p "Restart PBC services now? (y/n) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    "$SCRIPT_DIR/restart-pbcs.sh"
fi

echo ""
echo "=========================================="
echo "  Complete!"
echo "=========================================="
