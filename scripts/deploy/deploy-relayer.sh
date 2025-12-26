#!/bin/bash
# ============================================================================
# ETRID Bridge Relayer Service Deployment
# Deploys the relayer service to a dedicated VM
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
RELAYER_SERVICE_DIR="/Users/macbook/Desktop/etrid/services/relayer-service"
DEPLOY_DIR="/opt/etrid/relayer-service"

# Relayer VM - using ts-val-22 which already has bridge-monitor
RELAYER_VM="ts-val-22"
RELAYER_USER="root"
RELAYER_IP="100.113.226.111"
SSH_KEY="~/.ssh/contabo-validators"

# Relayer keys (to be set before deployment)
RELAYER_KEYS_FILE="/Users/macbook/.etrid/relayer-keys.env"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  ETRID Relayer Service Deployment${NC}"
echo -e "${BLUE}============================================${NC}"

# Check prerequisites
check_prerequisites() {
    echo -e "\n${YELLOW}Checking prerequisites...${NC}"

    if [ ! -d "$RELAYER_SERVICE_DIR" ]; then
        echo -e "${RED}Error: Relayer service directory not found${NC}"
        exit 1
    fi

    if [ ! -f "$RELAYER_KEYS_FILE" ]; then
        echo -e "${RED}Error: Relayer keys file not found at $RELAYER_KEYS_FILE${NC}"
        echo -e "${YELLOW}Please create the file with the following format:${NC}"
        echo "RELAYER_PRIVATE_KEY=0x..."
        echo "RELAYER_ADDRESS=0x..."
        echo "ALCHEMY_API_KEY=..."
        exit 1
    fi

    source "$RELAYER_KEYS_FILE"

    echo -e "${GREEN}Prerequisites checked${NC}"
}

# Build the relayer service
build_service() {
    echo -e "\n${YELLOW}Building relayer service...${NC}"

    cd "$RELAYER_SERVICE_DIR"
    npm ci
    npm run build

    echo -e "${GREEN}Service built successfully${NC}"
}

# Create deployment package
create_package() {
    echo -e "\n${YELLOW}Creating deployment package...${NC}"

    PACKAGE_DIR="/tmp/relayer-service-deploy"
    rm -rf "$PACKAGE_DIR"
    mkdir -p "$PACKAGE_DIR"

    cp -r "$RELAYER_SERVICE_DIR/dist" "$PACKAGE_DIR/"
    cp "$RELAYER_SERVICE_DIR/package.json" "$PACKAGE_DIR/"
    cp "$RELAYER_SERVICE_DIR/package-lock.json" "$PACKAGE_DIR/"

    tar -czf /tmp/relayer-service.tar.gz -C "$PACKAGE_DIR" .

    echo -e "${GREEN}Package created at /tmp/relayer-service.tar.gz${NC}"
}

# Deploy to VM
deploy() {
    echo -e "\n${BLUE}Deploying to $RELAYER_VM ($RELAYER_IP)...${NC}"

    # Create environment file
    cat > /tmp/relayer.env << EOF
# Relayer Service Configuration

# Attestation services (all 9 directors)
ATTESTATION_SERVICE_URLS=http://100.96.84.69:3000,http://100.70.242.106:3000,http://100.102.128.51:3000,http://100.71.242.104:3000,http://100.74.84.28:3000,http://100.89.102.75:3000,http://100.80.84.82:3000,http://100.68.185.50:3000,http://100.74.204.23:3000

# Chain connections
SUBSTRATE_WS_URL=ws://100.96.84.69:9944
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}

# Relayer identity
RELAYER_PRIVATE_KEY=${RELAYER_PRIVATE_KEY}
RELAYER_ADDRESS=${RELAYER_ADDRESS}

# Contract addresses (Ethereum mainnet)
MESSAGE_TRANSMITTER_ADDRESS=0x0000000000000000000000000000000000000000
TOKEN_MESSENGER_ADDRESS=0x0000000000000000000000000000000000000000

# Polling settings
POLL_INTERVAL_MS=30000
MAX_RETRIES=3
RETRY_DELAY_MS=60000

# Gas settings
GAS_LIMIT=500000
MAX_FEE_PER_GAS=50000000000
MAX_PRIORITY_FEE_PER_GAS=2000000000

# API settings
ENABLE_API=true
API_PORT=3001
EOF

    # SSH commands
    ssh -i "$SSH_KEY" ${RELAYER_USER}@${RELAYER_IP} << REMOTE_COMMANDS
set -e

mkdir -p $DEPLOY_DIR
mkdir -p /var/log/etrid

systemctl stop relayer-service 2>/dev/null || true
REMOTE_COMMANDS

    # Copy files
    scp -i "$SSH_KEY" /tmp/relayer-service.tar.gz ${RELAYER_USER}@${RELAYER_IP}:$DEPLOY_DIR/
    scp -i "$SSH_KEY" /tmp/relayer.env ${RELAYER_USER}@${RELAYER_IP}:$DEPLOY_DIR/.env

    # Continue setup on remote
    ssh -i "$SSH_KEY" ${RELAYER_USER}@${RELAYER_IP} << REMOTE_SETUP
set -e

cd $DEPLOY_DIR

tar -xzf relayer-service.tar.gz
rm relayer-service.tar.gz

npm ci --omit=dev

cat > /etc/systemd/system/relayer-service.service << 'SYSTEMD'
[Unit]
Description=ETRID Relayer Service
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=$DEPLOY_DIR
ExecStart=/usr/bin/node $DEPLOY_DIR/dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

StandardOutput=append:/var/log/etrid/relayer-service.log
StandardError=append:/var/log/etrid/relayer-service.error.log

NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/etrid $DEPLOY_DIR

[Install]
WantedBy=multi-user.target
SYSTEMD

systemctl daemon-reload
systemctl enable relayer-service
systemctl start relayer-service

sleep 3
systemctl status relayer-service --no-pager
REMOTE_SETUP

    echo -e "${GREEN}Relayer deployed successfully${NC}"
}

# Verify deployment
verify() {
    echo -e "\n${YELLOW}Verifying deployment...${NC}"

    echo -n "Checking relayer health... "
    local health=$(curl -s --connect-timeout 5 http://${RELAYER_IP}:3001/health 2>/dev/null || echo "failed")

    if [[ "$health" == *"healthy"* ]]; then
        echo -e "${GREEN}HEALTHY${NC}"
    else
        echo -e "${RED}UNHEALTHY${NC}"
        echo "Response: $health"
    fi
}

# Main
case "${1:-deploy}" in
    deploy)
        check_prerequisites
        build_service
        create_package
        deploy
        verify
        ;;
    verify)
        verify
        ;;
    *)
        echo "Usage: $0 [deploy|verify]"
        exit 1
        ;;
esac

echo -e "\n${BLUE}============================================${NC}"
echo -e "${BLUE}  Relayer Deployment Complete${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo "Relayer API: http://${RELAYER_IP}:3001"
echo "Health endpoint: http://${RELAYER_IP}:3001/health"
echo "Stats endpoint: http://${RELAYER_IP}:3001/stats"
