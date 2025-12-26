# Multi-stage build for Etrid node
FROM rust:1.75 as builder

WORKDIR /etrid

# Install dependencies
RUN apt-get update && apt-get install -y \
    cmake \
    pkg-config \
    libssl-dev \
    git \
    clang \
    libclang-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy source code
COPY . .

# Build the node
RUN cargo build --release

# Final stage
FROM ubuntu:22.04

RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy binary from builder
COPY --from=builder /etrid/target/release/etrid /usr/local/bin/

# Create data directory
RUN mkdir -p /data

EXPOSE 9944 9933 30333 9615

ENTRYPOINT ["/usr/local/bin/etrid"]
