# Solana Bridge Monitor - Deployment Guide

Complete guide for deploying the ËTRID Solana bridge monitor in production.

## Quick Start

```bash
# 1. Clone and navigate to service
cd /Users/macbook/Desktop/etrid/services/bridge-monitor-service

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.solana.example .env
# Edit .env with your configuration

# 4. Build TypeScript
npm run build

# 5. Start the service
npm start
```

## Prerequisites

### Software Requirements

- **Node.js**: >= 18.0.0
- **TypeScript**: >= 5.0.0
- **Redis**: >= 6.0 (optional but recommended)
- **ËTRID Node**: Access to a running Primearc Core node

### Solana RPC Access

For production, use a dedicated RPC provider:

**Recommended Providers:**
- **QuickNode**: https://www.quicknode.com/chains/sol
  - 300k requests/day free tier
  - WebSocket support
  - Global load balancing

- **Triton**: https://triton.one/
  - Purpose-built for Solana
  - Optimized for high-throughput
  - Advanced caching

- **Alchemy**: https://www.alchemy.com/solana
  - Enterprise-grade reliability
  - Enhanced APIs
  - Free tier available

**Configuration:**
```env
SOLANA_RPC_URL=https://your-provider.solana-mainnet.quiknode.pro/YOUR_API_KEY/
SOLANA_WS_URL=wss://your-provider.solana-mainnet.quiknode.pro/YOUR_API_KEY/
```

## Installation

### NPM Installation

```bash
# Install dependencies
npm install

# Install additional dependencies for production
npm install --production

# Or with Yarn
yarn install --production
```

### Docker Installation

```bash
# Build Docker image
docker build -t etrid/solana-bridge-monitor:latest .

# Run with Docker Compose
docker-compose -f docker-compose.solana.yml up -d
```

## Configuration

### Environment Variables

Copy and configure the example environment file:

```bash
cp .env.solana.example .env
```

**Required Variables:**

```env
# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_WS_URL=wss://api.mainnet-beta.solana.com
SOLANA_BRIDGE_PROGRAM_ID=BRGPidxhcsLVFBQ5zZqRHZ8bKRAHhAhiEDCfqELV8M7u

# ËTRID
SUBSTRATE_WS_URL=ws://127.0.0.1:9944
RELAYER_SEED=//YourSecretSeed

# Bridge
MIN_CONFIRMATIONS=31
```

**Optional but Recommended:**

```env
# Redis (for state persistence)
REDIS_URL=redis://localhost:6379

# Monitoring
METRICS_ENABLED=true
ALERT_WEBHOOK_URL=https://your-webhook.com

# Logging
LOG_LEVEL=info
```

### Security Best Practices

1. **Never commit .env to git**
   ```bash
   echo ".env" >> .gitignore
   ```

2. **Use secret management in production**
   - AWS Secrets Manager
   - HashiCorp Vault
   - Kubernetes Secrets

3. **Rotate relayer keys regularly**

4. **Enable firewall rules**
   ```bash
   # Only allow necessary ports
   ufw allow 3000/tcp  # API
   ufw allow 9090/tcp  # Metrics
   ufw enable
   ```

## Deployment

### Systemd Service (Linux)

Create `/etc/systemd/system/etrid-solana-bridge.service`:

```ini
[Unit]
Description=ËTRID Solana Bridge Monitor
After=network.target

[Service]
Type=simple
User=etrid
WorkingDirectory=/opt/etrid/bridge-monitor-service
EnvironmentFile=/opt/etrid/bridge-monitor-service/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=etrid-solana-bridge

[Install]
WantedBy=multi-user.target
```

**Enable and start:**

```bash
sudo systemctl daemon-reload
sudo systemctl enable etrid-solana-bridge
sudo systemctl start etrid-solana-bridge

# Check status
sudo systemctl status etrid-solana-bridge

# View logs
sudo journalctl -u etrid-solana-bridge -f
```

### Docker Deployment

```bash
# Start all services
docker-compose -f docker-compose.solana.yml up -d

# View logs
docker-compose logs -f solana-bridge-monitor

# Stop services
docker-compose down

# Update and restart
docker-compose pull
docker-compose up -d
```

### Kubernetes Deployment

Create `k8s/solana-monitor.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: solana-bridge-monitor
  namespace: etrid-bridge
spec:
  replicas: 2
  selector:
    matchLabels:
      app: solana-bridge-monitor
  template:
    metadata:
      labels:
        app: solana-bridge-monitor
    spec:
      containers:
      - name: monitor
        image: etrid/solana-bridge-monitor:latest
        env:
        - name: SOLANA_RPC_URL
          valueFrom:
            secretKeyRef:
              name: solana-config
              key: rpc-url
        - name: RELAYER_SEED
          valueFrom:
            secretKeyRef:
              name: relayer-keys
              key: solana-seed
        ports:
        - containerPort: 3000
          name: api
        - containerPort: 9090
          name: metrics
        resources:
          requests:
            memory: "256Mi"
            cpu: "500m"
          limits:
            memory: "512Mi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: solana-bridge-monitor
  namespace: etrid-bridge
spec:
  selector:
    app: solana-bridge-monitor
  ports:
  - port: 3000
    targetPort: 3000
    name: api
  - port: 9090
    targetPort: 9090
    name: metrics
```

**Deploy:**

```bash
kubectl apply -f k8s/solana-monitor.yaml
kubectl get pods -n etrid-bridge
kubectl logs -f deployment/solana-bridge-monitor -n etrid-bridge
```

## Monitoring

### Prometheus Metrics

The service exposes Prometheus metrics at `http://localhost:9090/metrics`

**Key Metrics:**

```promql
# Connection status
bridge_monitor_solana_connected

# Current slot height
bridge_monitor_solana_slot_height

# Deposits detected
rate(bridge_monitor_messages_seen_total{chain="solana"}[5m])

# Deposits confirmed
rate(bridge_monitor_deposits_confirmed_total{chain="solana"}[5m])

# Pending deposits
bridge_monitor_pending_deposits{chain="solana"}

# Errors
rate(bridge_monitor_errors_total{source="SolanaMonitor"}[5m])

# Processing duration
histogram_quantile(0.95, rate(bridge_monitor_deposit_processing_duration_seconds_bucket{chain="solana"}[5m]))
```

### Grafana Dashboard

Import the provided dashboard:

```bash
curl -X POST http://localhost:3001/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d @grafana/solana-bridge-dashboard.json
```

**Dashboard includes:**
- Connection status indicators
- Deposit volume charts
- Confirmation latency
- Error rate graphs
- Pending deposits gauge

### Alerts

Create `prometheus-alerts.yml`:

```yaml
groups:
- name: solana_bridge
  interval: 30s
  rules:
  - alert: SolanaDisconnected
    expr: bridge_monitor_solana_connected == 0
    for: 2m
    annotations:
      summary: "Solana RPC disconnected"
      description: "Monitor has been disconnected from Solana RPC for 2 minutes"

  - alert: HighErrorRate
    expr: rate(bridge_monitor_errors_total{source="SolanaMonitor"}[5m]) > 0.1
    for: 5m
    annotations:
      summary: "High error rate in Solana monitor"

  - alert: PendingDepositsPiling
    expr: bridge_monitor_pending_deposits{chain="solana"} > 100
    for: 10m
    annotations:
      summary: "Too many pending deposits"
      description: "{{ $value }} deposits waiting for confirmations"
```

## Troubleshooting

### Common Issues

#### 1. RPC Connection Errors

**Symptom:** `bridge_monitor_solana_connected = 0`

**Solutions:**
```bash
# Check RPC endpoint
curl -X POST https://api.mainnet-beta.solana.com \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}'

# Check WebSocket
wscat -c wss://api.mainnet-beta.solana.com

# Verify firewall allows outbound connections
sudo ufw status

# Switch to different RPC provider
```

#### 2. Deposits Not Detected

**Symptom:** No `depositConfirmed` events

**Debug:**
```bash
# Enable debug logging
LOG_LEVEL=debug npm start

# Check if program ID is correct
echo $SOLANA_BRIDGE_PROGRAM_ID

# Manually check a transaction
npm run test:transaction -- <signature>

# Verify memo format
# Should be: ETRID:<64_hex_chars>
```

#### 3. Signature Conversion Errors

**Symptom:** "Invalid signature length" errors

**Fix:**
```javascript
// Ensure using bs58 (not base64)
const bs58 = require('bs58');
const sig = bs58.decode(signatureString);
// sig.length should be exactly 64
```

#### 4. High Memory Usage

**Symptom:** Container OOM killed

**Solutions:**
```bash
# Limit pending deposits
MAX_PENDING_DEPOSITS=100

# Enable Redis for state management
REDIS_URL=redis://localhost:6379

# Increase Docker memory limit
docker update --memory 1g solana-bridge-monitor
```

#### 5. Extrinsic Submission Failures

**Symptom:** Deposits detected but not relayed to ËTRID

**Debug:**
```bash
# Check Substrate connection
wscat -c ws://your-etrid-node:9944

# Verify relayer balance
# Relayer needs ETR for transaction fees

# Check for pallet errors in logs
grep "DispatchError" logs/error.log

# Test extrinsic manually via Polkadot.js
```

### Log Analysis

```bash
# View all logs
tail -f logs/combined.log

# Filter errors
grep ERROR logs/combined.log

# Monitor deposit events
grep "depositConfirmed" logs/combined.log

# Check reconnection attempts
grep "reconnect" logs/combined.log
```

## Performance Tuning

### Optimize for Throughput

```env
# Reduce confirmations (less safe but faster)
MIN_CONFIRMATIONS=20  # Confirmed instead of finalized

# Increase polling frequency
SLOT_POLL_INTERVAL=200  # Poll every 200ms

# Use dedicated RPC
SOLANA_RPC_URL=https://your-dedicated-node.com
```

### Optimize for Safety

```env
# Maximum confirmations
MIN_CONFIRMATIONS=31  # Finalized (safest)

# Conservative polling
SLOT_POLL_INTERVAL=1000  # 1 second

# Enable Redis for deduplication
REDIS_URL=redis://localhost:6379
```

### Resource Limits

**Recommended for production:**

```yaml
resources:
  requests:
    memory: 256Mi
    cpu: 500m
  limits:
    memory: 512Mi
    cpu: 1000m
```

## Maintenance

### Backup

```bash
# Backup Redis data
redis-cli SAVE
cp /var/lib/redis/dump.rdb /backup/

# Backup logs
tar -czf logs-backup-$(date +%Y%m%d).tar.gz logs/

# Backup configuration
cp .env /backup/.env.backup
```

### Updates

```bash
# Pull latest code
git pull origin main

# Update dependencies
npm update

# Rebuild
npm run build

# Restart service
sudo systemctl restart etrid-solana-bridge
```

### Health Checks

```bash
# Check service status
curl http://localhost:3000/health

# Check metrics
curl http://localhost:9090/metrics

# Check monitor status
curl http://localhost:3000/api/status
```

## Production Checklist

- [ ] Use dedicated RPC provider (QuickNode/Triton/Alchemy)
- [ ] Configure Redis for state persistence
- [ ] Set up Prometheus monitoring
- [ ] Configure Grafana dashboards
- [ ] Set up alerting (Slack/PagerDuty/etc.)
- [ ] Enable HTTPS for API endpoints
- [ ] Configure log rotation
- [ ] Set up automated backups
- [ ] Document incident response procedures
- [ ] Test failover scenarios
- [ ] Configure rate limiting
- [ ] Set up load balancing (if running multiple instances)
- [ ] Enable audit logging
- [ ] Configure firewall rules
- [ ] Set up VPN/SSH access restrictions
- [ ] Document recovery procedures

## Support

For issues and questions:

- GitHub Issues: https://github.com/etrid/etrid/issues
- Discord: https://discord.gg/etrid
- Documentation: https://docs.etrid.io/bridge/solana

## License

Apache 2.0
