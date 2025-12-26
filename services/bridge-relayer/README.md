# ETRID Bridge Services

Production-grade bridge infrastructure with 5-of-9 Director attestation.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DIRECTOR VMs (9 nodes)                           │
│  Each runs: director-signer service                                 │
│  - Receives sign requests via REST API                              │
│  - Verifies source transaction on-chain                             │
│  - Signs attestation if valid                                       │
│  - Returns signature                                                │
└─────────────────────────────────────────────────────────────────────┘
                              ▲
                              │ Sign Requests
                              │
┌─────────────────────────────┴───────────────────────────────────────┐
│                    BRIDGE RELAYER                                    │
│  Can run multiple instances for redundancy                          │
│  - Watches all chains for TokensLocked events                       │
│  - Collects signatures from 9 Directors (needs 5)                   │
│  - Submits attestation to destination chain                         │
│  - Tracks state in SQLite database                                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Services

### 1. Director Signer (`director-signer/`)

Runs on each of the 9 Director VMs.

**Endpoints:**
- `GET /health` - Health check
- `GET /info` - Get public key info
- `POST /sign` - Sign attestation request

**Setup:**
```bash
cd director-signer
npm install
cp .env.example .env
# Edit .env with Director's private key and index
npm run dev
```

**Security:**
- Private key never leaves the service
- Only signs after verifying source tx
- API key authentication
- Rate limiting recommended

### 2. Bridge Relayer (`bridge-relayer/`)

Orchestration service that can run anywhere.

**Features:**
- Watches all supported EVM chains
- Collects 5/9 signatures in parallel
- Submits attestations to destination
- SQLite for state persistence
- Automatic retry on failure

**Setup:**
```bash
cd bridge-relayer
npm install
cp .env.example .env
# Edit .env with Director URLs and bridge addresses
npm run dev
```

## Deployment

### Director VMs

Each of the 9 Director VMs should run:

```bash
# On each Director VM
git clone https://github.com/etrid/etrid.git
cd etrid/services/director-signer
npm install
npm run build

# Create systemd service
sudo tee /etc/systemd/system/director-signer.service << EOF
[Unit]
Description=ETRID Director Signer
After=network.target

[Service]
Type=simple
User=etrid
WorkingDirectory=/home/etrid/etrid/services/director-signer
ExecStart=/usr/bin/node dist/index.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable director-signer
sudo systemctl start director-signer
```

### Relayer (can run on any server)

```bash
git clone https://github.com/etrid/etrid.git
cd etrid/services/bridge-relayer
npm install
npm run build

# Create systemd service
sudo tee /etc/systemd/system/bridge-relayer.service << EOF
[Unit]
Description=ETRID Bridge Relayer
After=network.target

[Service]
Type=simple
User=etrid
WorkingDirectory=/home/etrid/etrid/services/bridge-relayer
ExecStart=/usr/bin/node dist/index.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable bridge-relayer
sudo systemctl start bridge-relayer
```

## Flow

1. **User locks tokens** on source chain (EVM bridge contract)
2. **Relayer detects** TokensLocked event
3. **Relayer requests** signatures from all 9 Directors
4. **Each Director**:
   - Verifies source tx exists on-chain
   - Signs attestation message
   - Returns signature
5. **Relayer collects** 5+ signatures
6. **Relayer submits** to destination bridge contract
7. **Tokens unlocked/minted** on destination chain

## Database Schema

The relayer uses SQLite:

```sql
bridge_requests (
  request_id TEXT PRIMARY KEY,
  source_chain TEXT,
  source_domain INTEGER,
  dest_domain INTEGER,
  source_tx_hash TEXT,
  sender TEXT,
  recipient TEXT,
  token TEXT,
  amount TEXT,
  message_type TEXT,
  status TEXT,           -- pending/collecting/ready/submitted/confirmed/failed
  signatures TEXT,       -- JSON array
  signature_count INTEGER,
  dest_tx_hash TEXT,
  created_at INTEGER,
  updated_at INTEGER
)
```

## Monitoring

Check logs:
```bash
# Director
journalctl -u director-signer -f

# Relayer
journalctl -u bridge-relayer -f
```

Check database:
```bash
sqlite3 relayer.db "SELECT status, COUNT(*) FROM bridge_requests GROUP BY status"
```

## Security Considerations

1. **Director Private Keys**: Never share, never log
2. **API Key**: Use strong random key, rotate periodically
3. **Network**: Use VPN/private network between Directors and Relayer
4. **Firewall**: Only allow Relayer IPs to connect to Directors
5. **Monitoring**: Alert on failed signatures or unusual activity
