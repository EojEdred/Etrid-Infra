# Ëtrid Bridge Monitoring Stack

Complete Docker deployment stack for cross-chain bridge monitoring between FlareChain and all PBC (Partition Burst Chain) collators.

## Overview

This stack monitors bridge operations across 7 blockchain networks:
- **Bitcoin** (BTC)
- **Solana** (SOL)
- **Ethereum** (ETH)
- **BNB Smart Chain** (BNB)
- **Polygon** (MATIC)
- **Tron** (TRX)
- **XRP Ledger** (XRP)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    External Blockchains                         │
│  BTC, SOL, ETH, BNB, Polygon, TRX, XRP                         │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Bridge Monitors (7)                          │
│  • Monitor external chain events                                │
│  • Detect deposits/withdrawals                                  │
│  • Track confirmations                                          │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Attestation Aggregators (5)                        │
│  • M-of-N consensus (3-of-5 minimum)                           │
│  • Aggregate attestations from monitors                         │
│  • Validate merkle proofs                                       │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Relayer Service                              │
│  • Submit proofs to FlareChain                                  │
│  • Manage gas optimization                                      │
│  • Handle retries and failures                                  │
└────────────┬────────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FlareChain & PBCs                            │
│  • Process cross-chain transactions                             │
│  • Update bridge state                                          │
│  • Mint/burn wrapped tokens                                     │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### Bridge Monitors (7 instances)
- **Purpose**: Monitor external blockchain events and PBC state
- **Ports**: 3010-3016 (API), 9100-9106 (Metrics)
- **Key Functions**:
  - Listen to external chain events (deposits, withdrawals)
  - Monitor confirmation blocks
  - Validate transaction finality
  - Submit attestations to aggregators

### Attestation Aggregators (5 instances)
- **Purpose**: Aggregate and validate attestations using M-of-N consensus
- **Ports**: 3020-3024 (API), 9110-9114 (Metrics)
- **Key Functions**:
  - Collect attestations from bridge monitors
  - Verify signatures and merkle proofs
  - Achieve Byzantine fault-tolerant consensus (3-of-5)
  - Forward validated proofs to relayer

### Relayer Service (1 instance)
- **Purpose**: Submit validated proofs to FlareChain
- **Ports**: 3030 (API), 9120 (Metrics)
- **Key Functions**:
  - Receive consensus proofs from aggregators
  - Optimize gas prices
  - Submit transactions to FlareChain
  - Handle retries and error recovery

### Monitoring Stack
- **Prometheus**: Metrics collection and alerting
- **Grafana**: Visualization and dashboards
- **Alertmanager**: Alert routing and notifications

## Quick Start

### 1. Prerequisites

```bash
# Check Docker installation
docker --version
docker-compose --version

# Verify network connectivity to PBC endpoints
ping 10.0.0.100  # FlareChain
ping 10.0.0.101  # Solana-PBC
ping 10.0.0.103  # Ethereum-PBC
```

### 2. Configuration

```bash
# Navigate to docker directory
cd /Users/macbook/Desktop/etrid/docker

# Copy environment example
cp .env.bridge-monitors.example .env.bridge-monitors

# Edit configuration (IMPORTANT!)
vim .env.bridge-monitors
```

**Critical environment variables to configure**:
```bash
# FlareChain connection
FLARECHAIN_WS_URL=ws://10.0.0.100:9944

# External chain RPC endpoints
BITCOIN_RPC_URL=https://your-btc-node.com
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_KEY
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Private keys (GENERATE SECURE KEYS!)
RELAYER_PRIVATE_KEY=0x...
AGGREGATOR_1_PRIVATE_KEY=0x...
AGGREGATOR_2_PRIVATE_KEY=0x...
AGGREGATOR_3_PRIVATE_KEY=0x...
AGGREGATOR_4_PRIVATE_KEY=0x...
AGGREGATOR_5_PRIVATE_KEY=0x...

# Alert notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK
ALERT_EMAIL_TO=ops@etrid.com
```

### 3. Generate Cryptographic Keys

```bash
# Generate keys for aggregators and relayer
subkey generate --scheme sr25519  # Aggregator 1
subkey generate --scheme sr25519  # Aggregator 2
subkey generate --scheme sr25519  # Aggregator 3
subkey generate --scheme sr25519  # Aggregator 4
subkey generate --scheme sr25519  # Aggregator 5
subkey generate --scheme sr25519  # Relayer

# Add generated keys to .env.bridge-monitors
```

### 4. Deploy

```bash
# Run automated deployment script
/Users/macbook/Desktop/etrid/scripts/deploy/start-bridge-monitors.sh

# Or manually:
cd /Users/macbook/Desktop/etrid/docker
docker-compose -f docker-compose.bridge-monitors.yml up -d
```

### 5. Verify Deployment

```bash
# Check all services are running
docker-compose -f docker-compose.bridge-monitors.yml ps

# Check health status
curl http://localhost:3010/health  # BTC monitor
curl http://localhost:3011/health  # SOL monitor
curl http://localhost:3012/health  # ETH monitor
curl http://localhost:3020/health  # Aggregator 1
curl http://localhost:3030/health  # Relayer

# View logs
docker-compose -f docker-compose.bridge-monitors.yml logs -f
```

## Service URLs

### Monitoring Dashboards
- **Grafana**: http://localhost:3000 (admin/etrid2025)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093

### Bridge Monitors
- **Bitcoin**: http://localhost:3010
- **Solana**: http://localhost:3011
- **Ethereum**: http://localhost:3012
- **BNB**: http://localhost:3013
- **Polygon**: http://localhost:3014
- **Tron**: http://localhost:3015
- **XRP**: http://localhost:3016

### Attestation Aggregators
- **Aggregator 1**: http://localhost:3020
- **Aggregator 2**: http://localhost:3021
- **Aggregator 3**: http://localhost:3022
- **Aggregator 4**: http://localhost:3023
- **Aggregator 5**: http://localhost:3024

### Relayer
- **Relayer Service**: http://localhost:3030

## Monitoring & Alerts

### Grafana Dashboards

Access Grafana at http://localhost:3000 with credentials:
- **Username**: admin
- **Password**: etrid2025 (change immediately!)

Pre-configured dashboards:
- **Bridge Overview**: Real-time status of all bridges
- **Attestation Metrics**: Aggregator performance and consensus
- **Relayer Status**: Submission queue and gas metrics
- **Chain Sync**: Block sync status for all chains

### Prometheus Metrics

Key metrics exposed:
```
# Bridge monitors
bridge_events_detected{chain="bitcoin"}
bridge_events_processed{chain="bitcoin"}
chain_sync_lag_blocks{chain="bitcoin"}

# Attestation
attestation_processing_duration_seconds
attestation_consensus_failures_total
attestation_timeouts_total

# Relayer
relayer_pending_submissions
relayer_submission_failures_total
relayer_gas_price_gwei
```

### Alert Rules

Critical alerts configured:
- **Bridge Monitor Down**: Service unavailable
- **Insufficient Attestation Aggregators**: < 3 online
- **Relayer Submission Failures**: High failure rate
- **Chain Sync Lag**: Falling behind external chains
- **Invalid Signatures**: Potential security breach

## Operations

### Viewing Logs

```bash
# All services
docker-compose -f docker-compose.bridge-monitors.yml logs -f

# Specific service
docker-compose -f docker-compose.bridge-monitors.yml logs -f bridge-monitor-btc

# Bridge monitors only
docker-compose -f docker-compose.bridge-monitors.yml logs -f \
  bridge-monitor-btc bridge-monitor-eth bridge-monitor-sol

# Aggregators only
docker-compose -f docker-compose.bridge-monitors.yml logs -f \
  attestation-aggregator-1 attestation-aggregator-2 attestation-aggregator-3
```

### Restarting Services

```bash
# Restart specific service
docker-compose -f docker-compose.bridge-monitors.yml restart bridge-monitor-btc

# Restart all monitors
docker-compose -f docker-compose.bridge-monitors.yml restart \
  bridge-monitor-btc bridge-monitor-sol bridge-monitor-eth \
  bridge-monitor-bnb bridge-monitor-polygon bridge-monitor-trx bridge-monitor-xrp

# Restart all aggregators
docker-compose -f docker-compose.bridge-monitors.yml restart \
  attestation-aggregator-1 attestation-aggregator-2 attestation-aggregator-3 \
  attestation-aggregator-4 attestation-aggregator-5
```

### Stopping Services

```bash
# Stop all services
docker-compose -f docker-compose.bridge-monitors.yml down

# Stop but preserve volumes
docker-compose -f docker-compose.bridge-monitors.yml stop

# Stop and remove volumes (WARNING: deletes data!)
docker-compose -f docker-compose.bridge-monitors.yml down -v
```

### Updating Services

```bash
# Rebuild images
docker-compose -f docker-compose.bridge-monitors.yml build

# Pull latest images
docker-compose -f docker-compose.bridge-monitors.yml pull

# Recreate services with new images
docker-compose -f docker-compose.bridge-monitors.yml up -d --force-recreate
```

## Security Considerations

### Private Key Management

**CRITICAL**: Never commit private keys to version control!

1. Generate unique keys for each aggregator and relayer
2. Store keys securely (HSM, KMS, or encrypted vault)
3. Use environment variables, never hardcode
4. Rotate keys periodically
5. Monitor key usage in logs

### Network Security

1. Use firewall rules to restrict access:
   ```bash
   # Only allow specific IPs to access services
   ufw allow from 10.0.0.0/24 to any port 9944
   ```

2. Enable HTTPS for production:
   ```bash
   # Set in .env.bridge-monitors
   ENABLE_HTTPS=true
   SSL_CERT_PATH=/etc/ssl/certs/etrid.crt
   SSL_KEY_PATH=/etc/ssl/private/etrid.key
   ```

3. Use API authentication:
   ```bash
   API_AUTH_ENABLED=true
   API_AUTH_TOKEN=your_secure_token
   ```

### Monitoring Security

1. Review alerts for suspicious activity
2. Monitor for invalid signatures
3. Check for replay attacks (duplicate nonces)
4. Audit contract interactions

## Troubleshooting

### Bridge Monitor Not Starting

```bash
# Check logs
docker logs etrid-bridge-monitor-btc

# Common issues:
# 1. Invalid RPC URL - verify external chain endpoint
# 2. Network connectivity - test with curl/wget
# 3. Missing environment variables - check .env file
```

### Attestation Consensus Failing

```bash
# Check aggregator logs
docker logs etrid-attestation-aggregator-1

# Verify all aggregators are running
docker-compose -f docker-compose.bridge-monitors.yml ps | grep aggregator

# Common issues:
# 1. < 3 aggregators online
# 2. Clock skew between instances
# 3. Network partitions
```

### Relayer Submission Failures

```bash
# Check relayer logs
docker logs etrid-relayer-service

# Check FlareChain connectivity
curl http://10.0.0.100:9933

# Common issues:
# 1. Insufficient balance
# 2. Gas price too high
# 3. FlareChain congestion
# 4. Invalid nonce
```

### High Memory Usage

```bash
# Check container stats
docker stats

# Restart service to clear memory
docker-compose -f docker-compose.bridge-monitors.yml restart <service-name>

# Adjust memory limits in docker-compose.yml
```

## Performance Tuning

### Optimization Settings

Edit `.env.bridge-monitors`:

```bash
# Reduce polling intervals for faster detection
BLOCK_POLL_INTERVAL=6000  # 6 seconds instead of 12

# Increase concurrent requests
MAX_CONCURRENT_REQUESTS=20  # Default: 10

# Adjust attestation timeout
ATTESTATION_TIMEOUT=180000  # 3 minutes instead of 5

# Increase database pool
DATABASE_POOL_SIZE=50  # Default: 20
```

### Resource Limits

Edit `docker-compose.bridge-monitors.yml`:

```yaml
services:
  bridge-monitor-btc:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
```

## Backup & Recovery

### Backup Data

```bash
# Backup all volumes
docker run --rm -v etrid-bridge-monitor-btc-data:/data \
  -v $(pwd):/backup alpine tar czf /backup/btc-data-backup.tar.gz /data

# Backup configuration
cp .env.bridge-monitors .env.bridge-monitors.backup
```

### Restore Data

```bash
# Restore volume
docker run --rm -v etrid-bridge-monitor-btc-data:/data \
  -v $(pwd):/backup alpine tar xzf /backup/btc-data-backup.tar.gz -C /
```

## Support

For issues or questions:
- **Documentation**: /Users/macbook/Desktop/etrid/docs/
- **GitHub Issues**: https://github.com/etrid/etrid/issues
- **Discord**: #bridge-support channel
- **Email**: support@etrid.com
