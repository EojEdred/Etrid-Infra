#!/bin/bash
# ËTRID VM Build Environment Setup Script
# Run this on each Contabo VM to prepare for building

set -e

echo "=== ËTRID Build Environment Setup ==="
echo "Hostname: $(hostname)"
echo "CPUs: $(nproc)"
echo "Memory: $(free -h | grep Mem | awk '{print $2}')"
echo ""

# Update system
echo "[1/6] Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

# Install build dependencies
echo "[2/6] Installing build dependencies..."
apt-get install -y -qq \
    build-essential \
    git \
    curl \
    wget \
    clang \
    llvm \
    libclang-dev \
    pkg-config \
    libssl-dev \
    protobuf-compiler \
    cmake \
    jq

# Install Rust
echo "[3/6] Installing Rust toolchain..."
if ! command -v rustc &> /dev/null; then
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source "$HOME/.cargo/env"
else
    echo "Rust already installed: $(rustc --version)"
fi

# Add to path
source "$HOME/.cargo/env"

# Install Rust targets
echo "[4/6] Adding WASM target..."
rustup target add wasm32-unknown-unknown
rustup component add rust-src

# Clone ËTRID repo
echo "[5/6] Cloning ËTRID repository..."
cd /root
if [ -d "etrid" ]; then
    cd etrid && git pull origin main
else
    git clone https://github.com/EojEdred/Etrid.git etrid
    cd etrid
fi

# Verify setup
echo "[6/6] Verifying setup..."
echo "Rust: $(rustc --version)"
echo "Cargo: $(cargo --version)"
echo "WASM target: $(rustup target list | grep wasm32-unknown-unknown)"
echo "Repo: $(pwd)"
echo ""
echo "=== Setup Complete ==="
echo "Ready to build ËTRID!"
