# ËTRID Bridge Monitor Service - Deployment Guide

## Where Should This Service Run?

**DO NOT run on your local machine.** This service should run on a dedicated VM within the Tailscale network.

### VM Infrastructure (Contabo VMs via Tailscale)

| VM Name | Tailscale IP | Role | PBC Port |
|---------|--------------|------|----------|
| vmi2896907 | 100.71.127.127 | PrimeArc Core / XRP-PBC | 9944/9945 |
| vmi2896908 | 100.68.185.50 | BNB-PBC / ETH-PBC | 9946/9950 |
| vmi2896909 | 100.70.73.10 | SOL-PBC | 9947 |
| vmi2896910 | 100.88.104.58 | ADA-PBC | 9948 |
| vmi2896911 | 100.117.43.53 | DOGE-PBC | 9949 |
| vmi2896914 | 100.109.252.56 | TRX-PBC | 9950 |
| vmi2896915 | 100.80.84.82 | MATIC-PBC | 9951 |
| vmi2896916 | 100.125.147.88 | XLM-PBC | 9952 |
| vmi2896917 | 100.86.111.37 | LINK-PBC | 9953 |
| vmi2896918 | 100.95.0.72 | SC-USDT-PBC | 9954 |
| vmi2896921 | 100.113.226.111 | EDSC-PBC | 9955 |
| vmi2896925 | 100.124.117.73 | BTC-PBC | 9947 |
| gizzi-io-validator | 100.96.84.69 | Build VM | - |
| auditdev | 100.70.242.106 | Dev/Audit VM | - |

### Recommended Deployment Options

| Option | VM | Tailscale IP | Pros | Cons |
|--------|-----|-------------|------|------|
| **Option 1 (Recommended)** | vmi2896921 | 100.113.226.111 | Already runs EDSC-PBC, low latency to all PBCs | Shares resources with EDSC-PBC |
| **Option 2** | auditdev | 100.70.242.106 | Isolated dev environment | May not have all deps |
| **Option 3** | vmi2896907 | 100.71.127.127 | High availability, runs PrimeArc | More load on main validator |

### Deployment Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      TAILSCALE NETWORK                            │
│                                                                    │
│  ┌─────────────────┐     ┌─────────────────────────────────────┐  │
│  │ Bridge Monitor  │────▶│     PARTITION BURST CHAINS          │  │
│  │ vmi2896921      │     │                                     │  │
│  │ (100.113.226.111)     │  BTC-PBC ← 100.124.117.73:9947      │  │
│  │                 │     │  ETH-PBC ← 100.68.185.50:9950       │  │
│  │ Port 3002 (API) │     │  SOL-PBC ← 100.70.73.10:9947        │  │
│  │ Port 9092 (Metrics)   │  BNB-PBC ← 100.68.185.50:9946       │  │
│  └────────┬────────┘     │  XRP-PBC ← 100.71.127.127:9945      │  │
│           │              │  TRX-PBC ← 100.109.252.56:9950      │  │
│           │              │  ADA-PBC ← 100.88.104.58:9948       │  │
│           │              │  MATIC-PBC ← 100.80.84.82:9951      │  │
│           │              │  XLM-PBC ← 100.125.147.88:9952      │  │
│           │              │  EDSC-PBC ← 100.113.226.111:9955    │  │
│           ▼              └─────────────────────────────────────┘  │
│  ┌─────────────────┐                                              │
│  │  External APIs  │                                              │
│  │                 │                                              │
│  │  - Blockstream (BTC) - No API key needed                      │
│  │  - Ethereum RPCs - Public, no key needed                      │
│  │  - Solana RPCs - Public, no key needed                        │
│  │  - TronGrid (TRX) - API key REQUIRED                          │
│  │  - XRPL Cluster - No API key needed                           │
│  │  - Blockfrost (ADA) - API key REQUIRED                        │
│  │  - Stellar Horizon - No API key needed                        │
│  └─────────────────┘                                              │
└──────────────────────────────────────────────────────────────────┘
```

## Required API Keys

Before deployment, you need to obtain API keys for:

### 1. TronGrid (for TRON/TRX monitoring)

1. Go to https://www.trongrid.io/
2. Sign up for a free account
3. Create a new API key
4. Add to .env: `TRON_API_KEY=your_key_here`

### 2. Blockfrost (for Cardano/ADA monitoring)

1. Go to https://blockfrost.io/
2. Sign up for a free account (includes 50,000 requests/day)
3. Create a new project for "Cardano Mainnet"
4. Copy the Project ID (this is your API key)
5. Add to .env: `CARDANO_BLOCKFROST_API_KEY=your_project_id`

**Note**: Both services have free tiers sufficient for bridge monitoring.

## Deployment Steps

### 1. SSH to Target VM

```bash
# Recommended: vmi2896921 (EDSC-PBC VM)
ssh -i ~/.ssh/contabo-validators root@100.113.226.111

# Alternative: auditdev
ssh -i ~/.ssh/contabo-validators root@100.70.242.106
```

### 2. Install Dependencies

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install Docker (optional, for containerized deployment)
curl -fsSL https://get.docker.com | sh

# Install Redis
apt install -y redis-server
systemctl enable redis-server
systemctl start redis-server
```

### 3. Clone or Copy Service

```bash
# Create service directory
mkdir -p /opt/etrid/services
cd /opt/etrid/services

# Option A: Clone from git (if in repo)
git clone <repo-url> bridge-monitor-service

# Option B: SCP from local
# Run on local machine:
scp -r -i ~/.ssh/contabo-validators \
  /Users/macbook/Desktop/etrid/services/bridge-monitor-service \
  root@100.113.226.111:/opt/etrid/services/
```

### 4. Configure Environment

```bash
cd /opt/etrid/services/bridge-monitor-service

# Copy and edit .env
cp .env.example .env
nano .env

# IMPORTANT: Add your API keys
# TRON_API_KEY=<your trongrid api key>
# CARDANO_BLOCKFROST_API_KEY=<your blockfrost project id>

# Copy attester keys
mkdir -p /opt/etrid/secrets
scp -i ~/.ssh/contabo-validators \
  /Users/macbook/Desktop/etrid/secrets/attester-keys.json \
  root@100.113.226.111:/opt/etrid/secrets/
```

### 5. Install and Build

```bash
npm install
npm run build
```

### 6. Run Startup Check

```bash
./scripts/startup-check.sh
```

### 7. Start Service

#### Option A: Systemd (Recommended for Production)

```bash
# Create systemd service
cat > /etc/systemd/system/bridge-monitor.service << 'EOF'
[Unit]
Description=ËTRID Bridge Monitor Service
After=network.target redis.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/etrid/services/bridge-monitor-service
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
systemctl daemon-reload
systemctl enable bridge-monitor
systemctl start bridge-monitor

# Check status
systemctl status bridge-monitor
journalctl -u bridge-monitor -f
```

#### Option B: Docker

```bash
docker-compose up -d

# Check logs
docker-compose logs -f bridge-monitor
```

## Monitoring

### Check Health

```bash
# Local health check
curl http://localhost:3002/health

# Metrics endpoint
curl http://localhost:9092/metrics

# From another Tailscale machine
curl http://100.113.226.111:3002/health
```

### Add to Prometheus

Add to your Prometheus configuration on the monitoring VM:

```yaml
scrape_configs:
  - job_name: 'bridge-monitor'
    static_configs:
      - targets: ['100.113.226.111:9092']
    metrics_path: /metrics
```

## Firewall Rules

If using UFW:

```bash
# Allow from Tailscale network only
ufw allow from 100.64.0.0/10 to any port 3002
ufw allow from 100.64.0.0/10 to any port 9092
```

## Troubleshooting

### Service won't start

```bash
# Check logs
journalctl -u bridge-monitor -n 100

# Check if port is in use
netstat -tlnp | grep 3002

# Check Redis
redis-cli ping
```

### Can't connect to PBCs

```bash
# Test PBC connectivity
curl http://100.124.117.73:9947/health  # BTC-PBC (vmi2896925)
curl http://100.68.185.50:9946/health   # BNB-PBC (vmi2896908)

# Check Tailscale
tailscale status
```

### API Key Issues

```bash
# Test TronGrid
curl -H "TRON-PRO-API-KEY: YOUR_KEY" https://api.trongrid.io/wallet/getnowblock

# Test Blockfrost
curl -H "project_id: YOUR_PROJECT_ID" https://cardano-mainnet.blockfrost.io/api/v0/blocks/latest
```

### High memory usage

```bash
# Check Node.js memory
NODE_OPTIONS="--max-old-space-size=2048" npm start
```

## Backup & Recovery

### Backup Configuration

```bash
# Backup .env and keys
tar -czf bridge-monitor-backup.tar.gz \
  /opt/etrid/services/bridge-monitor-service/.env \
  /opt/etrid/secrets/attester-keys.json
```

### Restore

```bash
# Restore from backup
tar -xzf bridge-monitor-backup.tar.gz -C /
systemctl restart bridge-monitor
```

## Quick Reference

| Resource | Location |
|----------|----------|
| Service Port | 3002 |
| Metrics Port | 9092 |
| Logs | `journalctl -u bridge-monitor -f` |
| Config | `/opt/etrid/services/bridge-monitor-service/.env` |
| Attester Keys | `/opt/etrid/secrets/attester-keys.json` |
| Health Check | `curl http://localhost:3002/health` |
