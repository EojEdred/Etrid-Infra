# Bridge Monitoring Stack - Quick Start Guide

**5-Minute Setup for Ëtrid Bridge Monitoring**

## Prerequisites Checklist

- [ ] Docker installed and running
- [ ] Access to FlareChain endpoint (10.0.0.100:9944)
- [ ] Access to all PBC endpoints (10.0.0.101-107:9944)
- [ ] RPC endpoints for external chains (Bitcoin, Ethereum, etc.)
- [ ] Subkey installed for key generation

## Step 1: Configuration (2 minutes)

```bash
cd /Users/macbook/Desktop/etrid/docker

# Copy environment template
cp .env.bridge-monitors.example .env.bridge-monitors

# Generate 6 cryptographic keys (5 aggregators + 1 relayer)
for i in {1..6}; do
  subkey generate --scheme sr25519
done

# Edit .env.bridge-monitors and set:
# - RELAYER_PRIVATE_KEY
# - AGGREGATOR_1_PRIVATE_KEY through AGGREGATOR_5_PRIVATE_KEY
# - BITCOIN_RPC_URL, ETHEREUM_RPC_URL, SOLANA_RPC_URL, etc.
# - SLACK_WEBHOOK_URL (optional)
# - ALERT_EMAIL_TO (optional)

vim .env.bridge-monitors
```

## Step 2: Deploy (1 minute)

```bash
# Automated deployment
/Users/macbook/Desktop/etrid/scripts/deploy/start-bridge-monitors.sh

# Or manual deployment
docker-compose -f docker-compose.bridge-monitors.yml up -d
```

## Step 3: Verify (2 minutes)

```bash
# Check all services are running
docker-compose -f docker-compose.bridge-monitors.yml ps

# Verify health endpoints
curl http://localhost:3010/health  # Bitcoin monitor
curl http://localhost:3020/health  # Aggregator 1
curl http://localhost:3030/health  # Relayer

# Access Grafana dashboard
open http://localhost:3000  # Login: admin/etrid2025
```

## Essential Commands

### View Logs
```bash
# All services
docker-compose -f docker-compose.bridge-monitors.yml logs -f

# Specific service
docker-compose -f docker-compose.bridge-monitors.yml logs -f bridge-monitor-btc
```

### Restart Service
```bash
docker-compose -f docker-compose.bridge-monitors.yml restart <service-name>
```

### Stop All Services
```bash
docker-compose -f docker-compose.bridge-monitors.yml down
```

### Check Service Status
```bash
docker-compose -f docker-compose.bridge-monitors.yml ps
```

## Quick Health Check

```bash
# Run this to check overall system health
curl -s http://localhost:3010/health && echo " ✓ BTC Monitor OK" || echo " ✗ BTC Monitor FAIL"
curl -s http://localhost:3011/health && echo " ✓ SOL Monitor OK" || echo " ✗ SOL Monitor FAIL"
curl -s http://localhost:3012/health && echo " ✓ ETH Monitor OK" || echo " ✗ ETH Monitor FAIL"
curl -s http://localhost:3020/health && echo " ✓ Aggregator 1 OK" || echo " ✗ Aggregator 1 FAIL"
curl -s http://localhost:3030/health && echo " ✓ Relayer OK" || echo " ✗ Relayer FAIL"
```

## Dashboard Access

- **Grafana**: http://localhost:3000 (admin/etrid2025)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093

## Troubleshooting

### Service won't start
```bash
docker logs etrid-<service-name>
```

### Network connectivity issues
```bash
# Test PBC connectivity
nc -zv 10.0.0.100 9944  # FlareChain
nc -zv 10.0.0.103 9944  # Ethereum-PBC
```

### Missing environment variables
```bash
# Check if .env file exists and is properly configured
cat .env.bridge-monitors | grep -E "PRIVATE_KEY|RPC_URL"
```

## Security Checklist

- [ ] Changed default Grafana password
- [ ] Generated unique private keys (never reuse!)
- [ ] Configured SSL certificates for production
- [ ] Set up firewall rules
- [ ] Enabled API authentication
- [ ] Configured alert notifications

## Next Steps

1. **Monitor the dashboards**: Check Grafana for real-time metrics
2. **Configure alerts**: Set up Slack/email notifications in Alertmanager
3. **Test a bridge transaction**: Send a test deposit to verify end-to-end flow
4. **Review logs**: Check for any errors or warnings
5. **Backup configuration**: Save .env.bridge-monitors securely

## Support

- Full Documentation: `README.bridge-monitors.md`
- Issues: Check `docker logs <service-name>`
- Discord: #bridge-support
