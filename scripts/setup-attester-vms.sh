#!/bin/bash
# ============================================================================
# Setup Director VMs for Attester Service
# Installs Node.js and prepares VMs for attester deployment
# ============================================================================

set -e

# Director VMs
DIRECTORS=(
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

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Setup Director VMs for Attester Service${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"

setup_vm() {
  local ip=$1
  local idx=$2

  echo -e "\n${YELLOW}[Director-${idx}] Setting up ${ip}...${NC}"

  # Check SSH connectivity
  if ! ssh -o ConnectTimeout=10 -o BatchMode=yes root@$ip "echo 'Connected'" &>/dev/null; then
    echo -e "${RED}  ✗ Cannot connect to ${ip}${NC}"
    return 1
  fi

  # Check if Node.js is already installed
  if ssh root@$ip "node --version" &>/dev/null; then
    local version=$(ssh root@$ip "node --version")
    echo -e "${GREEN}  ✓ Node.js already installed: ${version}${NC}"
    return 0
  fi

  echo -e "${YELLOW}  Installing Node.js 20.x...${NC}"

  # Install Node.js using NodeSource
  ssh root@$ip "bash -c '
    # Detect package manager
    if command -v apt-get &>/dev/null; then
      # Debian/Ubuntu
      curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
      apt-get install -y nodejs
    elif command -v dnf &>/dev/null; then
      # Fedora/RHEL
      curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
      dnf install -y nodejs
    elif command -v yum &>/dev/null; then
      # CentOS/RHEL older
      curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
      yum install -y nodejs
    else
      echo \"Unknown package manager\"
      exit 1
    fi
  '" 2>&1 | tail -5

  # Verify installation
  if ssh root@$ip "node --version" &>/dev/null; then
    local version=$(ssh root@$ip "node --version")
    echo -e "${GREEN}  ✓ Node.js installed: ${version}${NC}"

    # Also verify npm
    local npm_version=$(ssh root@$ip "npm --version")
    echo -e "${GREEN}  ✓ npm: ${npm_version}${NC}"
    return 0
  else
    echo -e "${RED}  ✗ Node.js installation failed${NC}"
    return 1
  fi
}

# Process based on arguments
if [ "$1" = "single" ] && [ -n "$2" ]; then
  idx=$2
  if [ "$idx" -lt 1 ] || [ "$idx" -gt 9 ]; then
    echo -e "${RED}Invalid index. Use 1-9.${NC}"
    exit 1
  fi
  setup_vm "${DIRECTORS[$((idx-1))]}" "$idx"
else
  # Setup all VMs
  success=0
  failed=0

  for i in "${!DIRECTORS[@]}"; do
    if setup_vm "${DIRECTORS[$i]}" "$((i+1))"; then
      ((success++))
    else
      ((failed++))
    fi
  done

  echo -e "\n${BLUE}════════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}Successful: ${success}${NC}"
  echo -e "${RED}Failed: ${failed}${NC}"
  echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"

  if [ $failed -eq 0 ]; then
    echo -e "\n${GREEN}All VMs ready! Run:${NC}"
    echo -e "${YELLOW}  ./scripts/deploy-attesters.sh all${NC}"
  fi
fi
