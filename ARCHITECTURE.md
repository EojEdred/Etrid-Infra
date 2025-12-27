# Etrid Infrastructure Architecture

Comprehensive guide to the etrid-infra repository structure, services, and deployment tooling.

## Repository Structure

```
etrid-infra/
├── bin/                           # Executable shell scripts
│   ├── check/                     # Health & status checks
│   ├── deploy/                    # Deployment automation
│   ├── keys/                      # Key management & injection
│   ├── manage/                    # Node management & releases
│   ├── monitoring/                # Real-time monitoring
│   └── utils/                     # Maintenance utilities
│
├── src/                           # TypeScript automation
│   ├── attesters/                 # Attester registration & funding
│   ├── governance/                # On-chain governance scripts
│   └── contracts/                 # Smart contract deployment
│
├── config/                        # Configuration management
│   ├── secure/                    # Sensitive configs (gitignored)
│   └── templates/                 # Public configuration templates
│
├── docker/                        # Container orchestration
│   ├── Dockerfile                 # Standard node container
│   ├── Dockerfile.pbc-builder     # PBC build container
│   ├── Dockerfile.primearc-core   # Relay chain container
│   └── docker-compose*.yml        # Orchestration files
│
├── monitoring/                    # Observability stack
│   ├── prometheus/                # Metrics collection
│   ├── grafana/                   # Dashboards
│   ├── grafana-provisioning/      # Auto-provisioned dashboards
│   └── alertmanager/              # Alert routing
│
├── services/                      # Microservices
│   ├── attestation-service/       # Off-chain attestation
│   ├── attester-service/          # Bridge attester node
│   ├── bridge-monitor-service/    # Multi-chain monitoring
│   ├── bridge-relayer/            # Cross-chain relayer
│   ├── director-signer/           # Director signing service
│   ├── relayer-service/           # Generic relayer
│   ├── telegram-governance-bot/   # Governance bot
│   ├── waitlist-worker/           # Serverless waitlist
│   └── wallet-api/                # Wallet service
│
├── scripts/                       # Legacy scripts location
│   ├── deploy/                    # Additional deploy scripts
│   ├── governance/                # Governance utilities
│   ├── launch/                    # Chain launch scripts
│   ├── monitoring/                # Monitoring utilities
│   ├── pbc-config/                # PBC configuration (Rust)
│   └── test/                      # Testing utilities
│
└── docs/                          # Documentation (planned)
```

## Scripts Reference

### Health & Status Checks (`bin/check/`)

| Script | Purpose |
|--------|---------|
| `check-all-nodes.sh` | Verify all validator nodes are running and synced |
| `check-all-validators.sh` | Check validator status across the network |
| `check-mainnet-health.sh` | Comprehensive mainnet health check |

### Deployment (`bin/deploy/`)

| Script | Purpose |
|--------|---------|
| `deploy-attesters.sh` | Deploy attester services to VMs |
| `deploy-bridge-services.sh` | Deploy bridge monitoring services |
| `deploy-new-contabo-validator.sh` | Set up new Contabo validator |
| `deploy-tailscale-validators.sh` | Deploy via Tailscale network |
| `deploy-bootnodes-chainspec.sh` | Update bootnode chain specs |
| `deploy-chainspec-fix.sh` | Apply chainspec patches |
| `deploy-from-vm.sh` | Deploy from build VM |

### Key Management (`bin/keys/`)

| Script | Purpose |
|--------|---------|
| `configure-pbc-session-keys.sh` | Configure PBC session keys |
| `generate-attester-envs.sh` | Generate attester environment files |
| `inject-all-pbc-keys.sh` | Inject keys for all PBCs |
| `inject-all-pbc-keys-v2.sh` | Inject keys (v2 with improvements) |
| `inject-pbc-asfk-keys.sh` | Inject ASF consensus keys |

### Node Management (`bin/manage/`)

| Script | Purpose |
|--------|---------|
| `create-pbc-release.sh` | Create PBC release packages |
| `setup-attester-vms.sh` | Initial VM setup for attesters |
| `sync-pbc-chainspecs.sh` | Synchronize chainspecs across nodes |
| `vm-setup.sh` | Generic VM initialization |

### Monitoring (`bin/monitoring/`)

| Script | Purpose |
|--------|---------|
| `monitor-chain-health.sh` | Real-time chain health monitoring |
| `monitor-validator.sh` | Individual validator monitoring |

### Utilities (`bin/utils/`)

| Script | Purpose |
|--------|---------|
| `cleanup-bloat.sh` | Clean up disk space on nodes |
| `clear-pbc-data.sh` | Reset PBC chain data |
| `fix-gizzi-fork.sh` | Fix fork issues on specific node |
| `fix-network-key-path.sh` | Correct network key paths |
| `bench-weights.sh` | Run runtime benchmarks |

## TypeScript Automation (`src/`)

### Attester Scripts (`src/attesters/`)

| Script | Purpose |
|--------|---------|
| `check-attester-balances.ts` | Verify attester account balances |
| `check-registration-status.ts` | Check attester registration |
| `fund-attesters.ts` | Fund attester accounts |
| `register-attesters-evm.ts` | Register on EVM chains |
| `register-attesters-onchain.ts` | Register on Substrate chain |
| `register-attesters-retry.ts` | Retry failed registrations |
| `test-attestation.ts` | Test attestation flow |

### Governance Scripts (`src/governance/`)

| Script | Purpose |
|--------|---------|
| `check-chain-state.ts` | Query chain state |
| `check-governance.ts` | Check governance proposals |
| `check-governance-details.ts` | Detailed proposal info |
| `check-sudo.ts` | Verify sudo configuration |
| `find-sudo-key.ts` | Locate sudo key |

### Contract Deployment (`src/contracts/`)

| Script | Purpose |
|--------|---------|
| `deploy-attester-registry-evm.ts` | Deploy attester registry on EVM |

## Services

### Core Services

| Service | Port | Purpose |
|---------|------|---------|
| **attestation-service** | 3001 | Off-chain attestation & signing |
| **attester-service** | 3002 | Bridge attester validator |
| **bridge-relayer** | 3003 | Cross-chain event relay |
| **director-signer** | 3004 | Director key management |
| **relayer-service** | 3005 | Generic bridge automation |
| **wallet-api** | 3006 | Account & balance management |

### Monitoring Services

| Service | Port | Purpose |
|---------|------|---------|
| **bridge-monitor-service** | 3010 | Multi-chain bridge monitoring |
| **telegram-governance-bot** | - | Governance notifications |

### Serverless

| Service | Platform | Purpose |
|---------|----------|---------|
| **waitlist-worker** | Cloudflare | Serverless waitlist backend |

## Docker Configuration

### Available Containers

| Dockerfile | Purpose |
|------------|---------|
| `Dockerfile` | Standard validator/node container |
| `Dockerfile.pbc-builder` | PBC build environment |
| `Dockerfile.primearc-core` | Primearc relay chain |

### Compose Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Local development stack |
| `docker-compose.bridge-monitors.yml` | Bridge monitoring production |

### Exposed Ports

| Port | Service |
|------|---------|
| 9944 | WebSocket RPC |
| 9933 | HTTP RPC |
| 30333 | P2P networking |
| 9615 | Prometheus metrics |
| 9090 | Prometheus server |
| 3000 | Grafana dashboard |

## Monitoring Stack

### Prometheus

- **Config:** `monitoring/prometheus-primearc.yml`
- **Alerts:** `monitoring/alerting-rules-primearc.yml`
- **Scrape interval:** 15 seconds

### Grafana

- **Dashboard:** `monitoring/grafana-dashboard-primearc.json`
- **12 panels:** Block production, finalization, peers, resources

### Metrics Collected

- Block production rate & time
- Finalization lag
- Transaction throughput
- Peer connectivity
- System resources (CPU, memory, disk)
- RPC performance

## Configuration

### Environment Variables

Copy `config/templates/.env.example` to `config/secure/.env.secure`:

```bash
# Node Configuration
NODE_NAME=etrid-validator-01
CHAIN_SPEC=/config/chainspec.json

# RPC Endpoints
PRIMEARC_RPC_URL=wss://rpc.etrid.network
ETH_RPC_URL=https://eth.etrid.network

# Keys (sensitive)
ATTESTER_PRIVATE_KEY=0x...
VALIDATOR_SESSION_KEY=...
```

### Security

Files in `config/secure/` are gitignored:
- `*.pem`, `*.key`, `*.secret`
- `.env`, `.env.*`
- `secrets/`, `config/secure/*`

## Deployment Workflow

### New Validator Setup

```bash
# 1. Prepare VM
bin/manage/vm-setup.sh <hostname>

# 2. Deploy node binary
bin/deploy/deploy-new-contabo-validator.sh <hostname>

# 3. Inject session keys
bin/keys/configure-pbc-session-keys.sh <hostname>

# 4. Verify health
bin/check/check-all-validators.sh
```

### Bridge Service Deployment

```bash
# 1. Setup attesters
bin/manage/setup-attester-vms.sh

# 2. Deploy services
bin/deploy/deploy-bridge-services.sh

# 3. Register on-chain
npx ts-node src/attesters/register-attesters-onchain.ts

# 4. Fund accounts
npx ts-node src/attesters/fund-attesters.ts
```

## Related Repositories

| Repo | Description |
|------|-------------|
| [etrid](https://github.com/etaborai/etrid) | Blockchain core |
| [etrid-apps](https://github.com/etaborai/etrid-apps) | Frontend applications |
| [etrid-docs](https://github.com/etaborai/etrid-docs) | Documentation |
