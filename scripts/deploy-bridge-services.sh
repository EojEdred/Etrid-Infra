#!/bin/bash
#
# Deploy ETRID Bridge Services
# - Director Signer: All 9 Directors
# - Bridge Relayer: 3 nodes for redundancy
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 9 Director VMs (using PrimeArc validators + select PBC nodes)
DIRECTOR_VMS=(
    "0:vmi2897384:100.102.128.51"    # Director 1 (Gizzi - AI Overseer)
    "1:vmi2897381:100.89.102.75"     # Director 2 (EojEdred - Founder)
    "2:vmi2896915:100.80.84.82"      # Director 3
    "3:vmi2897382:100.74.84.28"      # Director 4
    "4:vmi2897383:100.71.242.104"    # Director 5
    "5:vmi2896906:100.93.43.18"      # Director 6
    "6:vmi2896907:100.71.127.127"    # Director 7
    "7:vmi2896908:100.68.185.50"     # Director 8
    "8:vmi2896909:100.70.73.10"      # Director 9
)

# Relayer VMs (3 for redundancy)
RELAYER_VMS=(
    "vmi2897384:100.102.128.51"
    "vmi2897381:100.89.102.75"
    "vmi2896915:100.80.84.82"
)

# Shared API key for Director communication
API_KEY="etrid-bridge-$(openssl rand -hex 16)"

# Service directories
DIRECTOR_SERVICE_DIR="/root/etrid-director-signer"
RELAYER_SERVICE_DIR="/root/etrid-bridge-relayer"

# Local source directories
LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIRECTOR_SRC="$LOCAL_DIR/services/director-signer"
RELAYER_SRC="$LOCAL_DIR/services/bridge-relayer"

echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║           ETRID BRIDGE SERVICES DEPLOYMENT                        ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${BLUE}API Key: ${API_KEY}${NC}"
echo ""
echo "Save this key - it's used for Director-Relayer communication!"
echo ""

# Generate Director private keys (for demo - in production use existing keys)
echo -e "${YELLOW}Step 1: Deploying Director Signers to 9 VMs${NC}"
echo ""

# Build Director URLs for relayer config
DIRECTOR_URLS=""

for entry in "${DIRECTOR_VMS[@]}"; do
    index="${entry%%:*}"
    rest="${entry#*:}"
    name="${rest%%:*}"
    ip="${rest#*:}"

    echo -e "${BLUE}[$((index+1))/9] Deploying Director $index to $name ($ip)${NC}"

    # Build URL list for relayer
    DIRECTOR_URLS="${DIRECTOR_URLS}DIRECTOR_$((index+1))_URL=http://${ip}:3100\n"

    ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@${ip} bash << EOFDIR || echo -e "${RED}Failed: $name${NC}"
        set -e

        # Install Node.js if not present
        if ! command -v node &> /dev/null; then
            echo "Installing Node.js..."
            curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
            apt-get install -y nodejs
        fi

        # Create service directory
        mkdir -p ${DIRECTOR_SERVICE_DIR}
        cd ${DIRECTOR_SERVICE_DIR}

        # Create package.json
        cat > package.json << 'EOFPKG'
{
  "name": "etrid-director-signer",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": { "start": "node index.js" },
  "dependencies": {
    "express": "^4.18.2",
    "ethers": "^6.9.0",
    "helmet": "^7.1.0",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  }
}
EOFPKG

        # Install dependencies
        npm install --production 2>/dev/null

        # Generate ECDSA key for this Director
        PRIVATE_KEY=\$(node -e "const {Wallet}=require('ethers');console.log(Wallet.createRandom().privateKey)")

        # Create .env
        cat > .env << EOFENV
PORT=3100
DIRECTOR_INDEX=${index}
DIRECTOR_PRIVATE_KEY=\${PRIVATE_KEY}
API_KEY=${API_KEY}
RPC_ETHEREUM=https://eth.llamarpc.com
RPC_ARBITRUM=https://arb1.arbitrum.io/rpc
RPC_POLYGON=https://polygon-rpc.com
RPC_BASE=https://mainnet.base.org
RPC_BSC=https://bsc-dataseed.binance.org
EOFENV

        # Create simplified index.js
        cat > index.js << 'EOFJS'
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { ethers } = require('ethers');
require('dotenv').config();

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());

const config = {
  port: parseInt(process.env.PORT || '3100'),
  directorIndex: parseInt(process.env.DIRECTOR_INDEX || '0'),
  privateKey: process.env.DIRECTOR_PRIVATE_KEY,
  apiKey: process.env.API_KEY,
};

const wallet = new ethers.Wallet(config.privateKey);
console.log(\`Director \${config.directorIndex} initialized: \${wallet.address}\`);

// Auth middleware
const auth = (req, res, next) => {
  if (req.headers['x-api-key'] !== config.apiKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', directorIndex: config.directorIndex, address: wallet.address });
});

// Info
app.get('/info', (req, res) => {
  res.json({
    directorIndex: config.directorIndex,
    signerAddress: wallet.address,
    publicKey: wallet.signingKey.compressedPublicKey,
  });
});

// Sign attestation
app.post('/sign', auth, async (req, res) => {
  try {
    const { requestId, sourceDomain, destDomain, recipient, token, amount, messageType } = req.body;

    const messageHash = messageType === 'MINT'
      ? ethers.keccak256(ethers.solidityPacked(
          ['bytes32', 'uint32', 'uint32', 'address', 'address', 'uint256', 'string'],
          [requestId, sourceDomain, destDomain, recipient, token, amount, 'MINT']
        ))
      : ethers.keccak256(ethers.solidityPacked(
          ['bytes32', 'uint32', 'uint32', 'address', 'address', 'uint256'],
          [requestId, sourceDomain, destDomain, recipient, token, amount]
        ));

    const signature = await wallet.signMessage(ethers.getBytes(messageHash));

    console.log(\`Signed request \${requestId.substring(0, 10)}...\`);

    res.json({
      success: true,
      signature,
      directorIndex: config.directorIndex,
      signerAddress: wallet.address,
      messageHash,
    });
  } catch (error) {
    console.error('Sign error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(config.port, '0.0.0.0', () => {
  console.log(\`Director Signer running on port \${config.port}\`);
});
EOFJS

        # Create systemd service
        cat > /etc/systemd/system/director-signer.service << EOFSVC
[Unit]
Description=ETRID Director Signer
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${DIRECTOR_SERVICE_DIR}
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOFSVC

        # Reload and start
        systemctl daemon-reload
        systemctl enable director-signer
        systemctl restart director-signer

        # Get public key for verification
        sleep 2
        curl -s http://localhost:3100/info | head -c 200

        echo ""
        echo "Director $index deployed successfully!"
EOFDIR

    echo ""
done

echo ""
echo -e "${YELLOW}Step 2: Deploying Bridge Relayers to 3 VMs${NC}"
echo ""

for entry in "${RELAYER_VMS[@]}"; do
    name="${entry%%:*}"
    ip="${entry#*:}"

    echo -e "${BLUE}Deploying Relayer to $name ($ip)${NC}"

    ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 root@${ip} bash << EOFREL || echo -e "${RED}Failed: $name${NC}"
        set -e

        mkdir -p ${RELAYER_SERVICE_DIR}
        cd ${RELAYER_SERVICE_DIR}

        # Create package.json
        cat > package.json << 'EOFPKG'
{
  "name": "etrid-bridge-relayer",
  "version": "1.0.0",
  "main": "index.js",
  "scripts": { "start": "node index.js" },
  "dependencies": {
    "ethers": "^6.9.0",
    "axios": "^1.6.2",
    "better-sqlite3": "^9.2.2",
    "dotenv": "^16.3.1"
  }
}
EOFPKG

        # Install dependencies
        npm install --production 2>/dev/null

        # Create .env with all Director URLs
        cat > .env << EOFENV
DB_PATH=./relayer.db
DIRECTOR_API_KEY=${API_KEY}
POLL_INTERVAL=5000

# RPC Endpoints
RPC_ETHEREUM=https://eth.llamarpc.com
RPC_ARBITRUM=https://arb1.arbitrum.io/rpc
RPC_POLYGON=https://polygon-rpc.com
RPC_BASE=https://mainnet.base.org
RPC_BSC=https://bsc-dataseed.binance.org

# Bridge addresses (fill after deployment)
BRIDGE_ETHEREUM=
BRIDGE_BASE=
BRIDGE_BSC=

# Director URLs
DIRECTOR_1_URL=http://100.102.128.51:3100
DIRECTOR_2_URL=http://100.89.102.75:3100
DIRECTOR_3_URL=http://100.80.84.82:3100
DIRECTOR_4_URL=http://100.74.84.28:3100
DIRECTOR_5_URL=http://100.71.242.104:3100
DIRECTOR_6_URL=http://100.93.43.18:3100
DIRECTOR_7_URL=http://100.71.127.127:3100
DIRECTOR_8_URL=http://100.68.185.50:3100
DIRECTOR_9_URL=http://100.70.73.10:3100
EOFENV

        # Note: Full relayer code would go here
        # For now create a placeholder that can be updated
        cat > index.js << 'EOFJS'
console.log('Bridge Relayer placeholder - update with full code');
console.log('Waiting for bridge contract deployments...');
// Full implementation in services/bridge-relayer/src/index.ts
EOFJS

        # Create systemd service
        cat > /etc/systemd/system/bridge-relayer.service << EOFSVC
[Unit]
Description=ETRID Bridge Relayer
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${RELAYER_SERVICE_DIR}
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOFSVC

        systemctl daemon-reload
        systemctl enable bridge-relayer
        # Don't start yet - waiting for bridge deployments
        # systemctl restart bridge-relayer

        echo "Relayer prepared on $name (not started - waiting for bridge deployments)"
EOFREL

    echo ""
done

echo ""
echo "╔═══════════════════════════════════════════════════════════════════╗"
echo "║                    DEPLOYMENT COMPLETE                            ║"
echo "╚═══════════════════════════════════════════════════════════════════╝"
echo ""
echo -e "${GREEN}Director Signers deployed to 9 VMs${NC}"
echo -e "${GREEN}Bridge Relayer prepared on 3 VMs (not started)${NC}"
echo ""
echo -e "${YELLOW}IMPORTANT - Save this API Key:${NC}"
echo -e "${BLUE}${API_KEY}${NC}"
echo ""
echo "Next steps:"
echo "1. Deploy bridge contracts on EVM chains"
echo "2. Update BRIDGE_* addresses in relayer .env"
echo "3. Start relayers: systemctl start bridge-relayer"
echo ""
echo "Check Director status:"
echo "  ssh root@100.102.128.51 'curl -s http://localhost:3100/info'"
echo ""
