# Ëtrid Infrastructure

Infrastructure and deployment tooling for Ëtrid Network validators and node operators. Ansible playbooks, Docker configurations, Terraform modules, monitoring dashboards (Grafana/Prometheus), and systemd service templates for Primearc Core validators and PBC collators. Production-ready for mainnet.

## Repository

**Push to:** `git@github.com:etaborai/etrid-infra.git`

## Structure

```
etrid-infra/
├── config/
│   ├── secure/               # Secure configs (gitignored)
│   └── templates/            # Configuration templates
├── docker/                   # Docker configurations
├── monitoring/
│   ├── alertmanager/         # Alert rules and routing
│   ├── grafana/              # Dashboards
│   ├── grafana-provisioning/ # Auto-provisioned dashboards
│   └── prometheus/           # Metrics collection
├── scripts/
│   ├── deploy/               # Deployment automation
│   ├── governance/           # Governance scripts
│   ├── launch/               # Chain launch scripts
│   ├── monitoring/           # Monitoring utilities
│   ├── pbc-config/           # PBC configuration
│   └── test/                 # Test scripts
└── services/
    ├── attestation-service/  # Attestation service
    ├── attester-service/     # Bridge attester
    ├── bridge-monitor-service/
    ├── bridge-relayer/       # Cross-chain relayer
    ├── director-signer/      # Director signing service
    ├── relayer-service/      # Generic relayer
    ├── telegram-governance-bot/
    ├── waitlist-worker/      # Waitlist backend
    └── wallet-api/           # Wallet API service
```

## Related Repositories

| Repo | Description |
|------|-------------|
| [etrid](https://github.com/etaborai/etrid) | Blockchain core (Primearc + PBCs) |
| [etrid-apps](https://github.com/etaborai/etrid-apps) | Frontend applications |
| [etrid-docs](https://github.com/etaborai/etrid-docs) | Documentation |

## License

Apache-2.0
