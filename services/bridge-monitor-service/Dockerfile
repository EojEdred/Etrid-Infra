# ═══════════════════════════════════════════════════════════════════════
# Dockerfile for Bridge Monitor Service
# Multi-stage build for optimized production deployment
# ═══════════════════════════════════════════════════════════════════════

# Stage 1: Builder
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install ALL dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Remove dev dependencies
RUN npm prune --production

# ═══════════════════════════════════════════════════════════════════════
# Stage 2: Production Runtime
FROM node:18-alpine

# Install runtime dependencies only
RUN apk add --no-cache \
    curl \
    wget \
    tini

# Create non-root user for security
RUN addgroup -g 1001 -S etrid && \
    adduser -u 1001 -S etrid -G etrid

# Set working directory
WORKDIR /app

# Copy built application from builder
COPY --from=builder --chown=etrid:etrid /app/dist ./dist
COPY --from=builder --chown=etrid:etrid /app/node_modules ./node_modules
COPY --from=builder --chown=etrid:etrid /app/package*.json ./

# Create data directory for logs and state
RUN mkdir -p /app/data /app/logs && \
    chown -R etrid:etrid /app

# Switch to non-root user
USER etrid

# Expose ports
# 3002 - API
# 9092 - Metrics (Prometheus)
EXPOSE 3002 9092

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3002/health || exit 1

# Use tini as init to handle signals properly
ENTRYPOINT ["/sbin/tini", "--"]

# Run the service
CMD ["node", "dist/index.js"]
