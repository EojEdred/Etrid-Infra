#!/bin/bash
# ============================================================================
# ETRID Bridge Attestation Service Deployment
# Deploys 5 attesters across geographically distributed VMs
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
ATTESTATION_SERVICE_DIR="/Users/macbook/Desktop/etrid/services/attestation-service"
DEPLOY_DIR="/opt/etrid/attestation-service"

# 9 Attesters - Decentralized Directors (from VALIDATOR_INFRASTRUCTURE_MAPPING.md)
# These are Genesis 0-8 validators with Director (Type 4) role
# Threshold: 5-of-9 (simple majority)
declare -A ATTESTERS=(
    ["attester-1"]="vmi2896906:root:100.93.43.18:UK Portsmouth"    # Director-1 (Genesis 0)
    ["attester-2"]="vmi2896907:root:100.71.127.127:UK Portsmouth"  # Director-2 (Genesis 1) - EojEdred
    ["attester-3"]="vmi2896908:root:100.68.185.50:UK Portsmouth"   # Director-3 (Genesis 2)
    ["attester-4"]="vmi2896909:root:100.70.73.10:UK Portsmouth"    # Director-4 (Genesis 3)
    ["attester-5"]="vmi2896910:root:100.88.104.58:UK Portsmouth"   # Director-5 (Genesis 4)
    ["attester-6"]="vmi2896911:root:100.117.43.53:UK Portsmouth"   # Director-6 (Genesis 5)
    ["attester-7"]="vmi2896914:root:100.109.252.56:Seattle"        # Director-7 (Genesis 6)
    ["attester-8"]="vmi2896915:root:100.80.84.82:Seattle"          # Director-8 (Genesis 7)
    ["attester-9"]="vmi2896917:root:100.86.111.37:New York"        # Director-9 (Genesis 8)
)

# Attester private keys (to be set before deployment)
# These should be generated securely and stored in a vault
ATTESTER_KEYS_FILE="/Users/macbook/.etrid/attester-keys.env"

echo -e "${BLUE}============================================${NC}"
echo -e "${BLUE}  ETRID Attestation Service Deployment${NC}"
echo -e "${BLUE}============================================${NC}"

# Check prerequisites
check_prerequisites() {
    echo -e "\n${YELLOW}Checking prerequisites...${NC}"

    if [ ! -d "$ATTESTATION_SERVICE_DIR" ]; then
        echo -e "${RED}Error: Attestation service directory not found${NC}"
        exit 1
    fi

    if [ ! -f "$ATTESTER_KEYS_FILE" ]; then
        echo -e "${RED}Error: Attester keys file not found at $ATTESTER_KEYS_FILE${NC}"
        echo -e "${YELLOW}Please create the file with the following format:${NC}"
        echo "ATTESTER_1_PRIVATE_KEY=0x..."
        echo "ATTESTER_1_ADDRESS=0x..."
        echo "ATTESTER_2_PRIVATE_KEY=0x..."
        echo "..."
        exit 1
    fi

    # Source the keys
    source "$ATTESTER_KEYS_FILE"

    echo -e "${GREEN}Prerequisites checked${NC}"
}

# Build the attestation service
build_service() {
    echo -e "\n${YELLOW}Building attestation service...${NC}"

    cd "$ATTESTATION_SERVICE_DIR"
    npm ci
    npm run build

    echo -e "${GREEN}Service built successfully${NC}"
}

# Create deployment package
create_package() {
    echo -e "\n${YELLOW}Creating deployment package...${NC}"

    PACKAGE_DIR="/tmp/attestation-service-deploy"
    rm -rf "$PACKAGE_DIR"
    mkdir -p "$PACKAGE_DIR"

    # Copy built files
    cp -r "$ATTESTATION_SERVICE_DIR/dist" "$PACKAGE_DIR/"
    cp "$ATTESTATION_SERVICE_DIR/package.json" "$PACKAGE_DIR/"
    cp "$ATTESTATION_SERVICE_DIR/package-lock.json" "$PACKAGE_DIR/"

    # Create tarball
    tar -czf /tmp/attestation-service.tar.gz -C "$PACKAGE_DIR" .

    echo -e "${GREEN}Package created at /tmp/attestation-service.tar.gz${NC}"
}

# Deploy to a single attester VM
deploy_to_vm() {
    local attester_id=$1
    local vm_info="${ATTESTERS[$attester_id]}"

    IFS=':' read -r vm_alias user tailscale_ip location <<< "$vm_info"

    echo -e "\n${BLUE}Deploying $attester_id to $vm_alias ($location)...${NC}"

    local ssh_key
    if [[ "$vm_alias" == "ts-val-01" || "$vm_alias" == "ts-val-02" ]]; then
        ssh_key="~/.ssh/gizzi-validator"
    else
        ssh_key="~/.ssh/contabo-validators"
    fi

    # Get attester index (1-5)
    local idx="${attester_id##*-}"
    local priv_key_var="ATTESTER_${idx}_PRIVATE_KEY"
    local addr_var="ATTESTER_${idx}_ADDRESS"

    # Create environment file for this attester
    cat > /tmp/attester-${idx}.env << EOF
# Attestation Service Configuration - Attester ${idx}
# Location: ${location}

# Chain connections
SUBSTRATE_WS_URL=ws://100.96.84.69:9944
SUBSTRATE_CHAIN_ID=2
ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
ETHEREUM_CHAIN_ID=1

# Attester identity
ATTESTER_PRIVATE_KEY=${!priv_key_var}
ATTESTER_ADDRESS=${!addr_var}
ATTESTER_ID=${idx}

# Signature thresholds (5-of-9 majority)
MIN_SIGNATURES=5
TOTAL_ATTESTERS=9

# Security settings
CONFIRMATIONS_REQUIRED=2

# API settings
PORT=3000
LOG_LEVEL=info
EOF

    # SSH commands
    ssh -i "$ssh_key" ${user}@${tailscale_ip} << REMOTE_COMMANDS
set -e

# Create directories
mkdir -p $DEPLOY_DIR
mkdir -p /var/log/etrid

# Stop existing service if running
systemctl stop attestation-service 2>/dev/null || true
REMOTE_COMMANDS

    # Copy files
    scp -i "$ssh_key" /tmp/attestation-service.tar.gz ${user}@${tailscale_ip}:$DEPLOY_DIR/
    scp -i "$ssh_key" /tmp/attester-${idx}.env ${user}@${tailscale_ip}:$DEPLOY_DIR/.env

    # Continue setup on remote
    ssh -i "$ssh_key" ${user}@${tailscale_ip} << REMOTE_SETUP
set -e

cd $DEPLOY_DIR

# Extract package
tar -xzf attestation-service.tar.gz
rm attestation-service.tar.gz

# Install production dependencies
npm ci --omit=dev

# Create systemd service
cat > /etc/systemd/system/attestation-service.service << 'SYSTEMD'
[Unit]
Description=ETRID Attestation Service
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

# Logging
StandardOutput=append:/var/log/etrid/attestation-service.log
StandardError=append:/var/log/etrid/attestation-service.error.log

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/etrid $DEPLOY_DIR

[Install]
WantedBy=multi-user.target
SYSTEMD

# Reload systemd and start service
systemctl daemon-reload
systemctl enable attestation-service
systemctl start attestation-service

# Wait and check status
sleep 3
systemctl status attestation-service --no-pager
REMOTE_SETUP

    echo -e "${GREEN}$attester_id deployed successfully to $vm_alias${NC}"
}

# Deploy all attesters
deploy_all() {
    echo -e "\n${YELLOW}Deploying to all 5 attester VMs...${NC}"

    for attester_id in "${!ATTESTERS[@]}"; do
        deploy_to_vm "$attester_id"
    done

    echo -e "\n${GREEN}All attesters deployed!${NC}"
}

# Verify deployment
verify_deployment() {
    echo -e "\n${YELLOW}Verifying deployments...${NC}"

    local all_healthy=true

    for attester_id in "${!ATTESTERS[@]}"; do
        local vm_info="${ATTESTERS[$attester_id]}"
        IFS=':' read -r vm_alias user tailscale_ip location <<< "$vm_info"

        echo -n "Checking $attester_id ($location)... "

        local health=$(curl -s --connect-timeout 5 http://${tailscale_ip}:3000/health 2>/dev/null || echo "failed")

        if [[ "$health" == *"healthy"* ]]; then
            echo -e "${GREEN}HEALTHY${NC}"
        else
            echo -e "${RED}UNHEALTHY${NC}"
            all_healthy=false
        fi
    done

    if [ "$all_healthy" = true ]; then
        echo -e "\n${GREEN}All attesters are healthy!${NC}"
    else
        echo -e "\n${RED}Some attesters are unhealthy. Check logs for details.${NC}"
    fi
}

# Show help
show_help() {
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  deploy    - Deploy attestation service to all VMs"
    echo "  verify    - Verify all attesters are healthy"
    echo "  status    - Show status of all attesters"
    echo "  help      - Show this help"
}

# Main
case "${1:-deploy}" in
    deploy)
        check_prerequisites
        build_service
        create_package
        deploy_all
        verify_deployment
        ;;
    verify)
        verify_deployment
        ;;
    status)
        verify_deployment
        ;;
    help)
        show_help
        ;;
    *)
        echo "Unknown command: $1"
        show_help
        exit 1
        ;;
esac

echo -e "\n${BLUE}============================================${NC}"
echo -e "${BLUE}  Deployment Complete${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""
echo "Attester API endpoints:"
for attester_id in "${!ATTESTERS[@]}"; do
    local vm_info="${ATTESTERS[$attester_id]}"
    IFS=':' read -r vm_alias user tailscale_ip location <<< "$vm_info"
    echo "  $attester_id: http://${tailscale_ip}:3000"
done
