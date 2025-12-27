# Etrid Infrastructure

Infrastructure and deployment tooling for Etrid Network validators and node operators. Docker configurations, monitoring dashboards (Grafana/Prometheus), deployment scripts, and microservices for Primearc Core validators and PBC collators.

## Quick Start

```bash
# Check all nodes health
bin/check/check-all-nodes.sh

# Deploy new validator
bin/deploy/deploy-new-contabo-validator.sh <hostname>

# Start monitoring stack
cd monitoring && docker-compose up -d
```

## Repository Structure

```
etrid-infra/
├── bin/                          # Executable scripts (organized)
│   ├── check/                    # Health & status checks
│   ├── deploy/                   # Deployment automation
│   ├── keys/                     # Key management
│   ├── manage/                   # Node management
│   ├── monitoring/               # Real-time monitoring
│   └── utils/                    # Maintenance utilities
│
├── src/                          # TypeScript automation
│   ├── attesters/                # Attester registration
│   ├── governance/               # Governance scripts
│   └── contracts/                # Contract deployment
│
├── config/                       # Configuration
│   ├── secure/                   # Sensitive (gitignored)
│   └── templates/                # Public templates
│
├── docker/                       # Containerization
│   ├── Dockerfile                # Standard node
│   ├── Dockerfile.pbc-builder    # PBC builder
│   └── docker-compose*.yml       # Orchestration
│
├── monitoring/                   # Observability
│   ├── prometheus/               # Metrics collection
│   ├── grafana/                  # Dashboards
│   └── alertmanager/             # Alert routing
│
├── services/                     # Microservices
│   ├── attestation-service/      # Off-chain attestation
│   ├── bridge-monitor-service/   # Multi-chain monitoring
│   ├── bridge-relayer/           # Cross-chain relayer
│   ├── telegram-governance-bot/  # Governance alerts
│   └── wallet-api/               # Wallet service
│
└── scripts/                      # Additional scripts
    ├── pbc-config/               # PBC configuration (Rust)
    └── launch/                   # Chain launch scripts
```

## Scripts

### Health Checks (`bin/check/`)
```bash
bin/check/check-all-nodes.sh       # All nodes status
bin/check/check-all-validators.sh  # Validator status
bin/check/check-mainnet-health.sh  # Full health check
```

### Deployment (`bin/deploy/`)
```bash
bin/deploy/deploy-attesters.sh           # Deploy attesters
bin/deploy/deploy-bridge-services.sh     # Bridge services
bin/deploy/deploy-new-contabo-validator.sh  # New validator
```

### Key Management (`bin/keys/`)
```bash
bin/keys/configure-pbc-session-keys.sh   # Configure keys
bin/keys/inject-all-pbc-keys.sh          # Inject PBC keys
```

### TypeScript Automation (`src/`)
```bash
npx ts-node src/attesters/register-attesters-onchain.ts
npx ts-node src/attesters/fund-attesters.ts
npx ts-node src/governance/check-governance.ts
```

## Services

| Service | Description |
|---------|-------------|
| attestation-service | Off-chain attestation & signing |
| bridge-monitor-service | XRP/Cardano/Stellar monitoring |
| bridge-relayer | Cross-chain event relay |
| wallet-api | Account & balance management |
| telegram-governance-bot | Governance notifications |

## Monitoring

```bash
# Start Prometheus + Grafana
cd monitoring
docker-compose up -d

# Access dashboards
open http://localhost:3000  # Grafana
open http://localhost:9090  # Prometheus
```

**Metrics collected:** Block production, finalization, peers, transactions, resources

## Configuration

Copy template to secure config:
```bash
cp config/templates/.env.example config/secure/.env.secure
```

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Detailed architecture guide
- [SCRIPTS.md](./SCRIPTS.md) - Complete script reference
- Service READMEs in `services/*/README.md`

## Related Repositories

| Repo | Description |
|------|-------------|
| [etrid](https://github.com/etaborai/etrid) | Blockchain core |
| [etrid-apps](https://github.com/etaborai/etrid-apps) | Frontend apps |
| [etrid-docs](https://github.com/etaborai/etrid-docs) | Documentation |

## License

Apache-2.0
