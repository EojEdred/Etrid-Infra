#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════
# Ëtrid Bridge Monitoring Stack - Deployment Script
# Starts all bridge monitors, attestation aggregators, and relayer service
# ═══════════════════════════════════════════════════════════════════════

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DOCKER_DIR="$PROJECT_ROOT/docker"
COMPOSE_FILE="$DOCKER_DIR/docker-compose.bridge-monitors.yml"
ENV_FILE="$DOCKER_DIR/.env.bridge-monitors"
ENV_EXAMPLE="$DOCKER_DIR/.env.bridge-monitors.example"

# ═══════════════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════════════

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════════════${NC}"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════
# Pre-flight Checks
# ═══════════════════════════════════════════════════════════════════════

preflight_checks() {
    print_header "Running Pre-flight Checks"

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    log_success "Docker is installed: $(docker --version)"

    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    log_success "Docker Compose is installed"

    # Check if Docker daemon is running
    if ! docker info &> /dev/null; then
        log_error "Docker daemon is not running. Please start Docker."
        exit 1
    fi
    log_success "Docker daemon is running"

    # Check if compose file exists
    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "Docker Compose file not found: $COMPOSE_FILE"
        exit 1
    fi
    log_success "Docker Compose file found"

    # Check if .env file exists
    if [ ! -f "$ENV_FILE" ]; then
        log_warning ".env file not found. Creating from example..."
        if [ -f "$ENV_EXAMPLE" ]; then
            cp "$ENV_EXAMPLE" "$ENV_FILE"
            log_warning "Please edit $ENV_FILE with your configuration before running this script again."
            exit 1
        else
            log_error "Example .env file not found: $ENV_EXAMPLE"
            exit 1
        fi
    fi
    log_success "Environment file found"

    # Validate critical environment variables
    source "$ENV_FILE"
    local missing_vars=()

    if [ -z "$FLARECHAIN_WS_URL" ]; then missing_vars+=("FLARECHAIN_WS_URL"); fi
    if [ -z "$RELAYER_PRIVATE_KEY" ]; then missing_vars+=("RELAYER_PRIVATE_KEY"); fi
    if [ -z "$AGGREGATOR_1_PRIVATE_KEY" ]; then missing_vars+=("AGGREGATOR_1_PRIVATE_KEY"); fi
    if [ -z "$BITCOIN_RPC_URL" ]; then missing_vars+=("BITCOIN_RPC_URL"); fi
    if [ -z "$ETHEREUM_RPC_URL" ]; then missing_vars+=("ETHEREUM_RPC_URL"); fi

    if [ ${#missing_vars[@]} -gt 0 ]; then
        log_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        exit 1
    fi
    log_success "All critical environment variables are set"
}

# ═══════════════════════════════════════════════════════════════════════
# Network Connectivity Tests
# ═══════════════════════════════════════════════════════════════════════

test_connectivity() {
    print_header "Testing Network Connectivity"

    source "$ENV_FILE"

    # Test FlareChain connectivity
    log_info "Testing FlareChain connectivity..."
    if timeout 5 bash -c "</dev/tcp/10.0.0.100/9944" 2>/dev/null; then
        log_success "FlareChain is reachable"
    else
        log_error "Cannot reach FlareChain at 10.0.0.100:9944"
        exit 1
    fi

    # Test PBC endpoints
    local pbc_endpoints=(
        "10.0.0.101:9944:Solana-PBC"
        "10.0.0.102:9944:BNB-PBC"
        "10.0.0.103:9944:Ethereum-PBC"
        "10.0.0.104:9944:Polygon-PBC"
        "10.0.0.105:9944:Tron-PBC"
        "10.0.0.106:9944:XRP-PBC"
        "10.0.0.107:9944:Bitcoin-PBC"
    )

    for endpoint in "${pbc_endpoints[@]}"; do
        IFS=':' read -r host port name <<< "$endpoint"
        log_info "Testing $name connectivity..."
        if timeout 5 bash -c "</dev/tcp/$host/$port" 2>/dev/null; then
            log_success "$name is reachable"
        else
            log_warning "Cannot reach $name at $host:$port"
        fi
    done
}

# ═══════════════════════════════════════════════════════════════════════
# Build Docker Images
# ═══════════════════════════════════════════════════════════════════════

build_images() {
    print_header "Building Docker Images"

    cd "$DOCKER_DIR"

    log_info "Building bridge monitor service image..."
    docker-compose -f "$COMPOSE_FILE" build bridge-monitor-btc

    log_info "Building attestation aggregator service image..."
    docker-compose -f "$COMPOSE_FILE" build attestation-aggregator-1

    log_info "Building relayer service image..."
    docker-compose -f "$COMPOSE_FILE" build relayer-service

    log_success "All images built successfully"
}

# ═══════════════════════════════════════════════════════════════════════
# Start Services
# ═══════════════════════════════════════════════════════════════════════

start_services() {
    print_header "Starting Bridge Monitoring Stack"

    cd "$DOCKER_DIR"

    log_info "Starting monitoring infrastructure (Prometheus, Grafana)..."
    docker-compose -f "$COMPOSE_FILE" up -d prometheus grafana alertmanager

    sleep 5

    log_info "Starting bridge monitors..."
    docker-compose -f "$COMPOSE_FILE" up -d \
        bridge-monitor-btc \
        bridge-monitor-sol \
        bridge-monitor-eth \
        bridge-monitor-bnb \
        bridge-monitor-polygon \
        bridge-monitor-trx \
        bridge-monitor-xrp

    sleep 10

    log_info "Starting attestation aggregators..."
    docker-compose -f "$COMPOSE_FILE" up -d \
        attestation-aggregator-1 \
        attestation-aggregator-2 \
        attestation-aggregator-3 \
        attestation-aggregator-4 \
        attestation-aggregator-5

    sleep 5

    log_info "Starting relayer service..."
    docker-compose -f "$COMPOSE_FILE" up -d relayer-service

    log_success "All services started"
}

# ═══════════════════════════════════════════════════════════════════════
# Health Checks
# ═══════════════════════════════════════════════════════════════════════

check_health() {
    print_header "Performing Health Checks"

    cd "$DOCKER_DIR"

    log_info "Waiting for services to become healthy (60s timeout)..."
    sleep 30

    local services=(
        "bridge-monitor-btc:3010"
        "bridge-monitor-sol:3011"
        "bridge-monitor-eth:3012"
        "bridge-monitor-bnb:3013"
        "bridge-monitor-polygon:3014"
        "bridge-monitor-trx:3015"
        "bridge-monitor-xrp:3016"
        "attestation-aggregator-1:3020"
        "attestation-aggregator-2:3021"
        "attestation-aggregator-3:3022"
        "attestation-aggregator-4:3023"
        "attestation-aggregator-5:3024"
        "relayer-service:3030"
    )

    local unhealthy_services=()

    for service in "${services[@]}"; do
        IFS=':' read -r name port <<< "$service"
        log_info "Checking health of $name..."

        if docker exec "etrid-$name" wget --quiet --tries=1 --spider http://localhost:$port/health 2>/dev/null; then
            log_success "$name is healthy"
        else
            log_warning "$name is not healthy yet"
            unhealthy_services+=("$name")
        fi
    done

    if [ ${#unhealthy_services[@]} -gt 0 ]; then
        log_warning "Some services are not healthy yet. They may still be starting up."
        log_info "Unhealthy services: ${unhealthy_services[*]}"
    else
        log_success "All services are healthy"
    fi
}

# ═══════════════════════════════════════════════════════════════════════
# Display Status
# ═══════════════════════════════════════════════════════════════════════

display_status() {
    print_header "Deployment Status"

    cd "$DOCKER_DIR"

    echo ""
    log_info "Running containers:"
    docker-compose -f "$COMPOSE_FILE" ps

    echo ""
    log_info "Service URLs:"
    echo "  Prometheus:   http://localhost:9090"
    echo "  Grafana:      http://localhost:3000 (admin/etrid2025)"
    echo "  Alertmanager: http://localhost:9093"
    echo ""
    echo "  Bridge Monitor (BTC):     http://localhost:3010"
    echo "  Bridge Monitor (SOL):     http://localhost:3011"
    echo "  Bridge Monitor (ETH):     http://localhost:3012"
    echo "  Bridge Monitor (BNB):     http://localhost:3013"
    echo "  Bridge Monitor (Polygon): http://localhost:3014"
    echo "  Bridge Monitor (TRX):     http://localhost:3015"
    echo "  Bridge Monitor (XRP):     http://localhost:3016"
    echo ""
    echo "  Attestation Aggregator 1: http://localhost:3020"
    echo "  Attestation Aggregator 2: http://localhost:3021"
    echo "  Attestation Aggregator 3: http://localhost:3022"
    echo "  Attestation Aggregator 4: http://localhost:3023"
    echo "  Attestation Aggregator 5: http://localhost:3024"
    echo ""
    echo "  Relayer Service:          http://localhost:3030"
    echo ""
}

# ═══════════════════════════════════════════════════════════════════════
# Monitoring Commands
# ═══════════════════════════════════════════════════════════════════════

show_monitoring_commands() {
    print_header "Monitoring Commands"

    cat << 'EOF'
View logs:
  All services:         docker-compose -f docker/docker-compose.bridge-monitors.yml logs -f
  Bridge monitors only: docker-compose -f docker/docker-compose.bridge-monitors.yml logs -f bridge-monitor-btc bridge-monitor-eth
  Aggregators only:     docker-compose -f docker/docker-compose.bridge-monitors.yml logs -f attestation-aggregator-1 attestation-aggregator-2
  Relayer only:         docker-compose -f docker/docker-compose.bridge-monitors.yml logs -f relayer-service

Service management:
  Stop all:             docker-compose -f docker/docker-compose.bridge-monitors.yml down
  Restart service:      docker-compose -f docker/docker-compose.bridge-monitors.yml restart <service-name>
  View status:          docker-compose -f docker/docker-compose.bridge-monitors.yml ps

Health checks:
  curl http://localhost:3010/health  # BTC monitor
  curl http://localhost:3020/health  # Aggregator 1
  curl http://localhost:3030/health  # Relayer

Metrics:
  curl http://localhost:9100/metrics # BTC monitor metrics
  curl http://localhost:9110/metrics # Aggregator 1 metrics
  curl http://localhost:9120/metrics # Relayer metrics

EOF
}

# ═══════════════════════════════════════════════════════════════════════
# Main Execution
# ═══════════════════════════════════════════════════════════════════════

main() {
    print_header "Ëtrid Bridge Monitoring Stack Deployment"

    preflight_checks
    test_connectivity
    build_images
    start_services
    check_health
    display_status
    show_monitoring_commands

    echo ""
    log_success "Bridge monitoring stack deployed successfully!"
    echo ""
    log_info "Next steps:"
    echo "  1. Access Grafana at http://localhost:3000 (admin/etrid2025)"
    echo "  2. Import bridge monitoring dashboards"
    echo "  3. Configure alerting rules in Prometheus"
    echo "  4. Set up external notifications in Alertmanager"
    echo "  5. Monitor logs: docker-compose -f $COMPOSE_FILE logs -f"
    echo ""
}

# Run main function
main "$@"
