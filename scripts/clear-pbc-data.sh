#!/usr/bin/env bash

# Clear PBC Data Directories
# Stops all PBC processes and clears data directories to fix genesis mismatch
# Author: Eoj
# Date: 2025-12-03

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}PBC Data Directory Cleanup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# All validator VMs (Tailscale IPs)
declare -a VMS=(
    "100.71.127.127"   # vmi2896907
    "100.68.185.50"    # vmi2896908
    "100.70.73.10"     # vmi2896909
    "100.88.104.58"    # vmi2896910
    "100.117.43.53"    # vmi2896911
    "100.109.252.56"   # vmi2896914
    "100.80.84.82"     # vmi2896915
    "100.125.147.88"   # vmi2896916
    "100.86.111.37"    # vmi2896917
    "100.95.0.72"      # vmi2896918
    "100.113.226.111"  # vmi2896921
    "100.114.244.62"   # vmi2896922
    "100.125.251.60"   # vmi2896923
    "100.74.204.23"    # vmi2896924
    "100.124.117.73"   # vmi2896925
    "100.89.102.75"    # vmi2897381
    "100.74.84.28"     # vmi2897382
    "100.71.242.104"   # vmi2897383
    "100.102.128.51"   # vmi2897384
)

# Oracle Cloud VMs
declare -a ORACLE_VMS=(
    "100.96.84.69"     # gizzi
    "100.70.242.106"   # auditdev
)

SSH_KEY="$HOME/.ssh/contabo-validators"
SSH_KEY_ORACLE="$HOME/.ssh/gizzi-validator"

# SSH function
ssh_exec() {
    local ip=$1
    local cmd=$2
    local key=${3:-$SSH_KEY}
    ssh -i "$key" -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@$ip "$cmd" 2>/dev/null
}

# Clear PBC data on a single VM
clear_pbc_data() {
    local ip=$1
    local key=${2:-$SSH_KEY}

    echo -e "${YELLOW}Processing VM: ${ip}${NC}"

    # Check connectivity
    if ! ssh_exec "$ip" "echo 'ok'" "$key" >/dev/null 2>&1; then
        echo -e "  ${RED}✗ Unreachable${NC}"
        return 1
    fi

    echo -e "  ${GREEN}✓ Connected${NC}"

    # Stop all PBC processes
    echo -e "  ${YELLOW}Stopping PBC processes...${NC}"
    ssh_exec "$ip" "pkill -f 'pbc-collator' || true; pkill -f 'pbc' || true" "$key"
    sleep 2

    # Check if processes stopped
    local procs=$(ssh_exec "$ip" "pgrep -f 'pbc' | wc -l" "$key" | tr -d ' ')
    if [ "$procs" -gt 0 ]; then
        echo -e "  ${YELLOW}Force killing remaining processes...${NC}"
        ssh_exec "$ip" "pkill -9 -f 'pbc-collator' || true; pkill -9 -f 'pbc' || true" "$key"
        sleep 1
    fi

    # Clear /var/lib/*-pbc directories
    echo -e "  ${YELLOW}Clearing /var/lib PBC directories...${NC}"
    ssh_exec "$ip" "
        for dir in /var/lib/*-pbc /var/lib/*-pbc-collator; do
            if [ -d \"\$dir\" ]; then
                echo \"    Removing \$dir\"
                rm -rf \"\$dir\"
            fi
        done
    " "$key"

    # Clear /root/pbc-data
    echo -e "  ${YELLOW}Clearing /root/pbc-data...${NC}"
    ssh_exec "$ip" "
        if [ -d /root/pbc-data ]; then
            rm -rf /root/pbc-data/*
            echo '    Cleared /root/pbc-data'
        fi
    " "$key"

    # Clear /root/pbc-logs
    echo -e "  ${YELLOW}Clearing /root/pbc-logs...${NC}"
    ssh_exec "$ip" "
        if [ -d /root/pbc-logs ]; then
            rm -rf /root/pbc-logs/*
            echo '    Cleared /root/pbc-logs'
        fi
    " "$key"

    # Report space freed
    echo -e "  ${GREEN}✓ Cleanup complete${NC}"
    return 0
}

# Track statistics
SUCCESS=0
FAILED=0

# Process Contabo VMs
echo -e "\n${BLUE}=== Contabo VMs ===${NC}\n"
for ip in "${VMS[@]}"; do
    if clear_pbc_data "$ip" "$SSH_KEY"; then
        SUCCESS=$((SUCCESS + 1))
    else
        FAILED=$((FAILED + 1))
    fi
    echo ""
done

# Process Oracle Cloud VMs
echo -e "\n${BLUE}=== Oracle Cloud VMs ===${NC}\n"
for ip in "${ORACLE_VMS[@]}"; do
    if clear_pbc_data "$ip" "$SSH_KEY_ORACLE"; then
        SUCCESS=$((SUCCESS + 1))
    else
        FAILED=$((FAILED + 1))
    fi
    echo ""
done

# Summary
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Cleanup Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "  ${GREEN}Successful: ${SUCCESS}${NC}"
echo -e "  ${RED}Failed: ${FAILED}${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "  1. Deploy authoritative chainspecs to all VMs"
echo "  2. Inject ASFK session keys"
echo "  3. Restart PBC collators with production script"
echo ""
