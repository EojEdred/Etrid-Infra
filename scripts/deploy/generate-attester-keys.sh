#!/bin/bash
# ============================================================================
# Generate ECDSA Keys for 9 Decentralized Directors (Attesters)
# These keys are used for signing cross-chain bridge messages
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

OUTPUT_DIR="$HOME/.etrid"
KEYS_FILE="$OUTPUT_DIR/attester-keys.env"
ADDRESSES_FILE="$OUTPUT_DIR/attester-addresses.json"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║    ETRID Director Attester Key Generation                  ║${NC}"
echo -e "${BLUE}║    Generating 9 ECDSA keypairs for bridge attestation      ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is required but not installed${NC}"
    exit 1
fi

# Check for ethers
if ! node -e "require('ethers')" 2>/dev/null; then
    echo -e "${YELLOW}Installing ethers.js...${NC}"
    npm install -g ethers 2>/dev/null || npm install ethers
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Backup existing keys if present
if [ -f "$KEYS_FILE" ]; then
    BACKUP_FILE="$OUTPUT_DIR/attester-keys.env.backup.$(date +%Y%m%d_%H%M%S)"
    echo -e "${YELLOW}Backing up existing keys to $BACKUP_FILE${NC}"
    cp "$KEYS_FILE" "$BACKUP_FILE"
fi

echo -e "\n${YELLOW}Generating 9 ECDSA keypairs...${NC}\n"

# Generate keys using Node.js
node << 'NODEJS'
const { ethers } = require('ethers');

const directors = [
    { id: 1, vm: 'ts-val-01', location: 'Oracle Cloud' },
    { id: 2, vm: 'ts-val-02', location: 'Oracle Cloud' },
    { id: 3, vm: 'ts-val-03', location: 'St. Louis' },
    { id: 4, vm: 'ts-val-04', location: 'St. Louis' },
    { id: 5, vm: 'ts-val-05', location: 'New York' },
    { id: 6, vm: 'ts-val-06', location: 'New York' },
    { id: 7, vm: 'ts-val-10', location: 'Seattle' },
    { id: 8, vm: 'ts-val-15', location: 'UK Portsmouth' },
    { id: 9, vm: 'ts-val-19', location: 'UK Portsmouth' },
];

let envContent = `# ═══════════════════════════════════════════════════════════════
# ETRID Bridge Attestation Keys - 9 Decentralized Directors
# Generated: ${new Date().toISOString()}
# Threshold: 5-of-9 (simple majority)
#
# SECURITY WARNING:
# - Keep this file secure and never commit to git
# - Each director should only have access to their own key
# - Consider using HSM/vault for production
# ═══════════════════════════════════════════════════════════════

`;

const addresses = [];

for (const dir of directors) {
    const wallet = ethers.Wallet.createRandom();

    envContent += `# Director ${dir.id} - ${dir.vm} (${dir.location})\n`;
    envContent += `ATTESTER_${dir.id}_PRIVATE_KEY=${wallet.privateKey}\n`;
    envContent += `ATTESTER_${dir.id}_ADDRESS=${wallet.address}\n\n`;

    addresses.push({
        director: dir.id,
        vm: dir.vm,
        location: dir.location,
        address: wallet.address
    });

    console.log(`Director ${dir.id} (${dir.vm}): ${wallet.address}`);
}

// Write env file
const fs = require('fs');
const path = require('path');
const outputDir = process.env.HOME + '/.etrid';

fs.writeFileSync(path.join(outputDir, 'attester-keys.env'), envContent);
fs.writeFileSync(path.join(outputDir, 'attester-addresses.json'), JSON.stringify(addresses, null, 2));

console.log('\n✅ Keys generated successfully!');
NODEJS

# Set secure permissions
chmod 600 "$KEYS_FILE"
chmod 644 "$ADDRESSES_FILE"

echo -e "\n${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Keys generated successfully!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Files created:"
echo -e "  ${BLUE}Private keys:${NC} $KEYS_FILE (chmod 600)"
echo -e "  ${BLUE}Addresses:${NC}    $ADDRESSES_FILE"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Securely distribute each director's private key to them"
echo -e "  2. Register all 9 addresses on-chain:"
echo ""
echo -e "     ${CYAN}# On Primearc (Substrate):${NC}"
echo -e "     polkadot-js-api --ws ws://localhost:9944 \\"
echo -e "       tx.sudo.sudo 'edscBridgeAttestation.registerAttester' '<address>'"
echo ""
echo -e "     ${CYAN}# On Ethereum:${NC}"
echo -e "     attesterRegistry.registerAttester(<address>)"
echo ""
echo -e "  3. Deploy attestation services:"
echo -e "     ./scripts/deploy/deploy-attesters.sh deploy"
echo ""

# Show addresses for easy copying
echo -e "${BLUE}Attester Addresses (for on-chain registration):${NC}"
cat "$ADDRESSES_FILE" | grep address | sed 's/.*: "\(.*\)".*/\1/'
