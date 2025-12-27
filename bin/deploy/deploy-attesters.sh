#!/bin/bash
# ============================================================================
# ËTRID Attester Service Deployment Script
# Deploys attester service to all 9 Director VMs
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ETRID_ROOT="$(dirname "$SCRIPT_DIR")"
ATTESTER_SERVICE="$ETRID_ROOT/services/attester-service"
SECRETS_DIR="$ETRID_ROOT/secrets"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   ËTRID Attester Service Deployment${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"

# Director VM configuration (IP:VM_ID)
DIRECTOR_IPS=(
  "100.93.43.18"
  "100.71.127.127"
  "100.68.185.50"
  "100.70.73.10"
  "100.88.104.58"
  "100.117.43.53"
  "100.109.252.56"
  "100.80.84.82"
  "100.86.111.37"
)

DIRECTOR_VMS=(
  "vmi2896906"
  "vmi2896907"
  "vmi2896908"
  "vmi2896909"
  "vmi2896910"
  "vmi2896911"
  "vmi2896914"
  "vmi2896915"
  "vmi2896917"
)

# Function to deploy to a single VM
deploy_to_vm() {
  local idx=$1
  local id=$((idx + 1))
  local ip="${DIRECTOR_IPS[$idx]}"
  local vm="${DIRECTOR_VMS[$idx]}"
  local env_file="$SECRETS_DIR/attester-env/attester-${id}.env"

  echo -e "\n${YELLOW}Deploying Attester-${id} to ${vm} (${ip})...${NC}"

  # Check if env file exists
  if [ ! -f "$env_file" ]; then
    echo -e "${RED}ERROR: Env file not found: $env_file${NC}"
    echo -e "${YELLOW}Run: ./scripts/generate-attester-envs.sh first${NC}"
    return 1
  fi

  # Create remote directory
  ssh -o ConnectTimeout=10 root@$ip "mkdir -p /opt/etrid/attester-service" 2>/dev/null || {
    echo -e "${RED}ERROR: Cannot connect to ${ip}${NC}"
    return 1
  }

  # Copy attester service files
  echo "  Copying service files..."
  rsync -avz --exclude 'node_modules' --exclude 'dist' \
    "$ATTESTER_SERVICE/" root@$ip:/opt/etrid/attester-service/ 2>&1 | grep -E "sent|total" || true

  # Copy env file
  echo "  Copying environment file..."
  scp "$env_file" root@$ip:/opt/etrid/attester-service/.env

  # Install dependencies (need devDependencies for TypeScript)
  echo "  Installing dependencies..."
  ssh root@$ip "cd /opt/etrid/attester-service && npm install 2>&1 | tail -3"

  # Build TypeScript
  echo "  Building TypeScript..."
  ssh root@$ip "cd /opt/etrid/attester-service && npx tsc 2>&1 | tail -5"

  # Clean up devDependencies after build
  echo "  Cleaning devDependencies..."
  ssh root@$ip "cd /opt/etrid/attester-service && npm prune --production 2>&1 | tail -2"

  # Create systemd service
  echo "  Creating systemd service..."
  ssh root@$ip "cat > /etc/systemd/system/etrid-attester.service << 'EOF'
[Unit]
Description=ËTRID Bridge Attester Service (Director-${id})
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/etrid/attester-service
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF"

  # Reload and start service
  echo "  Starting service..."
  ssh root@$ip "systemctl daemon-reload && systemctl enable etrid-attester && systemctl restart etrid-attester"

  # Check status
  sleep 2
  local status=$(ssh root@$ip "systemctl is-active etrid-attester" 2>/dev/null)
  if [ "$status" = "active" ]; then
    echo -e "${GREEN}  ✓ Attester-${id} deployed and running on ${ip}:3003${NC}"
    return 0
  else
    echo -e "${RED}  ✗ Attester-${id} failed to start${NC}"
    ssh root@$ip "journalctl -u etrid-attester -n 10 --no-pager" 2>/dev/null
    return 1
  fi
}

# Function to check attester status
check_attester_status() {
  local idx=$1
  local id=$((idx + 1))
  local ip="${DIRECTOR_IPS[$idx]}"

  echo -n "  Attester-${id} (${ip}): "
  local health=$(curl -s --connect-timeout 5 "http://${ip}:3003/health" 2>/dev/null)
  if [ -n "$health" ]; then
    echo -e "${GREEN}ONLINE${NC}"
    echo "$health" | grep -o '"address":"[^"]*"' | cut -d'"' -f4 | head -1 | xargs -I{} echo "    Address: {}"
  else
    echo -e "${RED}OFFLINE${NC}"
  fi
}

# Main deployment function
deploy_all() {
  echo -e "\n${BLUE}Deploying to all 9 Director VMs...${NC}"

  local success=0
  local failed=0

  for idx in 0 1 2 3 4 5 6 7 8; do
    if deploy_to_vm $idx; then
      ((success++))
    else
      ((failed++))
    fi
  done

  echo -e "\n${BLUE}════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}Successful: ${success}${NC}"
  echo -e "${RED}Failed: ${failed}${NC}"
  echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
}

# Check status of all attesters
check_all_status() {
  echo -e "\n${BLUE}Checking attester status...${NC}\n"
  for idx in 0 1 2 3 4 5 6 7 8; do
    check_attester_status $idx
  done
}

# Deploy to specific VM
deploy_single() {
  local id=$1
  if [ -z "$id" ] || [ "$id" -lt 1 ] || [ "$id" -gt 9 ]; then
    echo -e "${RED}Invalid Director ID. Use 1-9.${NC}"
    exit 1
  fi
  deploy_to_vm $((id - 1))
}

# Parse command line arguments
case "${1:-all}" in
  "all")
    deploy_all
    ;;
  "status")
    check_all_status
    ;;
  "single")
    deploy_single $2
    ;;
  *)
    echo "Usage: $0 [all|status|single <id>]"
    echo "  all     - Deploy to all 9 Directors"
    echo "  status  - Check status of all attesters"
    echo "  single  - Deploy to specific Director (1-9)"
    exit 1
    ;;
esac
