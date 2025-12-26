#!/bin/bash
# ============================================================================
# Generate Attester Environment Files (Secure Version)
# Creates .env files for each of the 9 Director attesters
# Uses external configuration instead of hardcoded secrets
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ETRID_ROOT="$(dirname "$SCRIPT_DIR")"
SECRETS_DIR="$ETRID_ROOT/secrets"
KEYS_FILE="${KEYS_FILE:-$ETRID_ROOT/config/secure/attester-keys.json}"  # Secure location
OUTPUT_DIR="$SECRETS_DIR/attester-env"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Generate Attester Environment Files (Secure Version)${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"

# Check if keys file exists
if [ ! -f "$KEYS_FILE" ]; then
  echo -e "${RED}ERROR: Keys file not found: $KEYS_FILE${NC}"
  echo -e "${YELLOW}Please ensure your attester keys are in the secure location${NC}"
  exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"
chmod 700 "$OUTPUT_DIR"

echo -e "\n${YELLOW}Reading keys from: $KEYS_FILE${NC}"

# Generate env files using node.js to parse JSON
node -e "
const fs = require('fs');
const path = require('path');

// Use environment variable or default path
const keysFile = process.env.KEYS_FILE || '$KEYS_FILE';
const outputDir = '$OUTPUT_DIR';

// Load validator configuration to get the Primearc connection URL
const validatorConfigFile = process.env.VALIDATOR_CONFIG_FILE || '$ETRID_ROOT/config/templates/validator-config.json';
const validatorConfig = JSON.parse(fs.readFileSync(validatorConfigFile, 'utf8'));

// Get the first primearc node as the default connection
const primearcNode = validatorConfig.primearcNodes[0] || { ip: '127.0.0.1' };
const primearcWsUrl = process.env.PRIMEARC_RPC_URL || 'ws://' + primearcNode.ip + ':9944';

const data = JSON.parse(fs.readFileSync(keysFile, 'utf8'));

for (const attester of data.attesters) {
  const envContent = \`# ËTRID Attester Service Configuration
# Attester-\${attester.id} (\${attester.name})
# Generated: \${new Date().toISOString()}
# WARNING: Keep this file secure - contains private key

# Attester Identity
ATTESTER_ID=\${attester.id}
ATTESTER_NAME=\${attester.name}

# ECDSA Private Key (secp256k1)
# Address: \${attester.address}
ATTESTER_PRIVATE_KEY=\${attester.privateKey}

# Service Ports
ATTESTER_PORT=3003
METRICS_PORT=3004

# Primearc Connection
PRIMEARC_WS_URL=\${primearcWsUrl}

# Logging
LOG_LEVEL=\${process.env.LOG_LEVEL || 'info'}
NODE_ENV=\${process.env.NODE_ENV || 'production'}
\`;

  const envPath = path.join(outputDir, \`attester-\${attester.id}.env\`);
  fs.writeFileSync(envPath, envContent);
  fs.chmodSync(envPath, 0o600);
  console.log(\`Created: attester-\${attester.id}.env (Address: \${attester.address})\`);
}

console.log(\`\\nGenerated \${data.attesters.length} env files in \${outputDir}\`);
"

echo -e "\n${GREEN}✓ All env files generated successfully${NC}"
echo -e "${YELLOW}Files are in: $OUTPUT_DIR${NC}"
echo -e "${RED}WARNING: These files contain private keys - keep secure!${NC}"

# List generated files
echo -e "\n${BLUE}Generated files:${NC}"
ls -la "$OUTPUT_DIR"/*.env 2>/dev/null || echo "No files found"