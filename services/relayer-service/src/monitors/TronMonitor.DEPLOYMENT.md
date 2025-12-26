# TRON Monitor - Production Deployment Guide

Complete guide for deploying TronMonitor to production for ËTRID bridge.

## Prerequisites

### System Requirements

- **Node.js**: v18.x or v20.x LTS
- **Memory**: 2GB minimum, 4GB recommended
- **CPU**: 2 cores minimum
- **Disk**: 20GB SSD
- **Network**: Stable internet (100Mbps+)

### Dependencies

Install required packages:

```bash
cd services/relayer-service

npm install --save \
  tronweb@^5.3.2 \
  @polkadot/api@^10.11.2 \
  @polkadot/keyring@^12.6.1 \
  @polkadot/util-crypto@^12.6.1 \
  prom-client@^15.1.0 \
  winston@^3.11.0

npm install --save-dev \
  @types/node@^20.10.5 \
  @jest/globals@^29.7.0 \
  jest@^29.7.0 \
  ts-jest@^29.1.1 \
  typescript@^5.3.3
```

### TronGrid API Key

Get a free API key from [TronGrid](https://www.trongrid.io/):

1. Visit https://www.trongrid.io/
2. Sign up for an account
3. Create a new API key
4. Copy the key to `.env` file

**Free Tier**: 100 requests/second
**Pro Tier**: 1,000+ requests/second (recommended for production)

## Configuration

### Environment Variables

Create `.env` file in `services/relayer-service/`:

```bash
# ====== TRON CONFIGURATION ======

# Network (mainnet, shasta, nile)
TRON_NETWORK=mainnet

# Bridge contract address (base58)
TRON_BRIDGE_CONTRACT=TYourProductionBridgeContract

# TronGrid API key (get from https://www.trongrid.io)
TRONGRID_API_KEY=your-api-key-here

# RPC endpoints (optional, defaults to TronGrid)
TRON_FULL_NODE_URL=https://api.trongrid.io
TRON_SOLIDITY_NODE_URL=https://api.trongrid.io
TRON_EVENT_SERVER_URL=https://api.trongrid.io

# Polling configuration
TRON_POLL_INTERVAL_MS=3000
TRON_START_BLOCK=58000000
TRON_MIN_CONFIRMATIONS=19

# Resource limits
TRON_MAX_ENERGY_LIMIT=150000000
TRON_MAX_BANDWIDTH_LIMIT=5000

# ====== ËTRID CONFIGURATION ======

# WebSocket endpoint to ËTRID runtime
ETRID_WS_URL=wss://rpc.etrid.io

# Relayer account seed (KEEP SECRET!)
RELAYER_SEED=//YourSecureRelayerSeed

# ====== MONITORING ======

# Metrics port
METRICS_PORT=9090

# Log level (debug, info, warn, error)
LOG_LEVEL=info

# ====== OPTIONAL ======

# Slack webhook for alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Sentry DSN for error tracking
SENTRY_DSN=https://your-sentry-dsn
```

### Security Best Practices

**CRITICAL**: Never commit `.env` to git!

Add to `.gitignore`:
```
.env
.env.production
.env.*.local
```

**Relayer Seed Protection**:
- Use environment variables or secret management (AWS Secrets Manager, HashiCorp Vault)
- Rotate seeds periodically
- Use hardware security modules (HSM) for production keys

### Network-Specific Configuration

#### Mainnet (Production)

```bash
TRON_NETWORK=mainnet
TRON_BRIDGE_CONTRACT=TYourProductionContract
TRONGRID_API_KEY=your-pro-api-key
TRON_START_BLOCK=58000000
```

**USDT Contract**: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`

#### Shasta (Testnet)

```bash
TRON_NETWORK=shasta
TRON_BRIDGE_CONTRACT=TYourTestnetContract
TRON_START_BLOCK=1000000
TRON_FULL_NODE_URL=https://api.shasta.trongrid.io
TRON_SOLIDITY_NODE_URL=https://api.shasta.trongrid.io
TRON_EVENT_SERVER_URL=https://api.shasta.trongrid.io
```

**Test USDT**: `TG3XXyExBkPp9nzdajDZsozEu4BkaSJozs`

## Deployment

### Method 1: PM2 (Recommended)

Install PM2:
```bash
npm install -g pm2
```

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'tron-bridge-monitor',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '2G',
    env: {
      NODE_ENV: 'production',
    },
    error_file: './logs/tron-monitor-error.log',
    out_file: './logs/tron-monitor-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 5000,
  }]
};
```

Build and start:
```bash
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

Monitor:
```bash
pm2 status
pm2 logs tron-bridge-monitor
pm2 monit
```

### Method 2: Docker

Create `Dockerfile`:

```dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --production=false

# Copy source
COPY src/ ./src/

# Build
RUN npm run build

# Production image
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --production

# Copy built files
COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
USER nodejs

# Expose metrics port
EXPOSE 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:9090/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

CMD ["node", "dist/index.js"]
```

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  tron-monitor:
    build: .
    container_name: tron-bridge-monitor
    restart: unless-stopped
    environment:
      - NODE_ENV=production
      - TRON_NETWORK=${TRON_NETWORK}
      - TRON_BRIDGE_CONTRACT=${TRON_BRIDGE_CONTRACT}
      - TRONGRID_API_KEY=${TRONGRID_API_KEY}
      - ETRID_WS_URL=${ETRID_WS_URL}
      - RELAYER_SEED=${RELAYER_SEED}
      - METRICS_PORT=9090
      - LOG_LEVEL=info
    ports:
      - "9090:9090"
    volumes:
      - ./logs:/app/logs
    networks:
      - etrid-bridge
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

networks:
  etrid-bridge:
    driver: bridge
```

Deploy:
```bash
docker-compose build
docker-compose up -d
docker-compose logs -f tron-monitor
```

### Method 3: Kubernetes

Create `k8s-deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tron-bridge-monitor
  namespace: etrid
  labels:
    app: tron-monitor
    component: bridge
spec:
  replicas: 1
  selector:
    matchLabels:
      app: tron-monitor
  template:
    metadata:
      labels:
        app: tron-monitor
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      containers:
      - name: tron-monitor
        image: etrid/tron-monitor:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 9090
          name: metrics
        env:
        - name: NODE_ENV
          value: "production"
        - name: TRON_NETWORK
          valueFrom:
            configMapKeyRef:
              name: tron-config
              key: network
        - name: TRON_BRIDGE_CONTRACT
          valueFrom:
            configMapKeyRef:
              name: tron-config
              key: bridge-contract
        - name: TRONGRID_API_KEY
          valueFrom:
            secretKeyRef:
              name: tron-secrets
              key: api-key
        - name: ETRID_WS_URL
          valueFrom:
            configMapKeyRef:
              name: etrid-config
              key: ws-url
        - name: RELAYER_SEED
          valueFrom:
            secretKeyRef:
              name: tron-secrets
              key: relayer-seed
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 9090
          initialDelaySeconds: 30
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 9090
          initialDelaySeconds: 10
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: tron-monitor-service
  namespace: etrid
  labels:
    app: tron-monitor
spec:
  type: ClusterIP
  ports:
  - port: 9090
    targetPort: 9090
    name: metrics
  selector:
    app: tron-monitor
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: tron-config
  namespace: etrid
data:
  network: "mainnet"
  bridge-contract: "TYourBridgeContract"
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: etrid-config
  namespace: etrid
data:
  ws-url: "wss://rpc.etrid.io"
---
apiVersion: v1
kind: Secret
metadata:
  name: tron-secrets
  namespace: etrid
type: Opaque
stringData:
  api-key: "your-trongrid-api-key"
  relayer-seed: "//YourSecureRelayerSeed"
```

Deploy:
```bash
kubectl apply -f k8s-deployment.yaml
kubectl get pods -n etrid
kubectl logs -f deployment/tron-bridge-monitor -n etrid
```

## Monitoring & Observability

### Prometheus Metrics

The monitor exposes metrics on `http://localhost:9090/metrics`:

```promql
# Connection status
relayer_tron_connected

# Block height
relayer_tron_block_height

# Deposits
rate(relayer_tron_deposits_seen_total[5m])
rate(relayer_tron_trx_deposits_total[5m])
rate(relayer_tron_usdt_deposits_total[5m])

# Resource usage
rate(relayer_tron_energy_used_total[5m])
rate(relayer_tron_bandwidth_used_total[5m])

# Errors
rate(relayer_errors_total{source="TronMonitor"}[5m])
```

### Grafana Dashboard

Import dashboard JSON from `monitoring/grafana/tron-monitor-dashboard.json`:

**Key Panels**:
- Connection status
- Block height lag
- Deposits per minute (TRX, USDT, TRC-20)
- Energy/bandwidth usage
- Error rate
- Deposit amounts (USD equivalent)

### Alerts

Create `prometheus/alerts/tron-monitor.yml`:

```yaml
groups:
- name: tron_monitor
  interval: 30s
  rules:
  - alert: TronMonitorDown
    expr: relayer_tron_connected == 0
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "TRON monitor disconnected"
      description: "Monitor has been disconnected for 2+ minutes"

  - alert: TronBlockHeightStale
    expr: time() - relayer_last_block_timestamp{chain="tron"} > 300
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "TRON block height is stale"
      description: "No new blocks processed in 5+ minutes"

  - alert: TronHighErrorRate
    expr: rate(relayer_errors_total{source="TronMonitor"}[5m]) > 0.1
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High error rate in TRON monitor"
      description: "Error rate: {{ $value }} errors/sec"

  - alert: TronUsdtDepositStuck
    expr: rate(relayer_tron_usdt_deposits_total[10m]) == 0
    for: 30m
    labels:
      severity: info
    annotations:
      summary: "No USDT deposits in 30 minutes"
      description: "May indicate issue with USDT monitoring"
```

### Logging

Configure structured logging in `src/utils/logger.ts`:

```typescript
import winston from 'winston';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'tron-monitor' },
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760,
      maxFiles: 5,
    }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}
```

## Health Checks

Create health check endpoint:

```typescript
import express from 'express';
import { monitor } from './monitors/TronMonitor';

const app = express();

app.get('/health', async (req, res) => {
  try {
    const status = monitor.getStatus();
    const currentBlock = await monitor.getCurrentBlock();

    const isHealthy =
      status.isRunning &&
      status.errors < 10 &&
      (Date.now() - (status.lastErrorTime || 0)) > 60000;

    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      monitor: {
        isRunning: status.isRunning,
        lastBlock: status.lastBlock,
        currentBlock,
        depositsProcessed: status.depositsProcessed,
        errors: status.errors,
        lastError: status.lastError,
      },
      uptime: process.uptime(),
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
    });
  }
});

app.listen(9090, () => {
  console.log('Health check running on :9090/health');
});
```

## Performance Tuning

### TronGrid Rate Limits

**Free Tier**: 100 req/sec = 6,000 req/min
- Poll interval: 3 seconds (20 polls/min)
- Well within limits

**Pro Tier**: 1,000+ req/sec
- Use for production
- Enables sub-second polling if needed

### Memory Optimization

```javascript
// PM2 config
max_memory_restart: '2G'

// Node.js flags
NODE_OPTIONS="--max-old-space-size=2048"
```

### Polling Strategy

**Default**: 3 seconds (TRON block time)
```bash
TRON_POLL_INTERVAL_MS=3000
```

**High-traffic**: 2 seconds (faster detection)
```bash
TRON_POLL_INTERVAL_MS=2000
```

**Low-traffic**: 5 seconds (reduced load)
```bash
TRON_POLL_INTERVAL_MS=5000
```

## Troubleshooting

### Issue: Rate limit errors

**Symptoms**: HTTP 429 errors, `rate limit` in logs

**Solution**:
1. Add TronGrid API key
2. Upgrade to Pro tier
3. Increase poll interval

### Issue: Events not detected

**Symptoms**: No deposits seen, stale block height

**Solution**:
```bash
# Check block sync
curl http://localhost:9090/health

# Verify contract address
echo $TRON_BRIDGE_CONTRACT

# Test contract
node -e "require('./dist/index.js').testContract()"
```

### Issue: High memory usage

**Symptoms**: Memory > 2GB, OOM errors

**Solution**:
```bash
# Enable memory profiling
NODE_OPTIONS="--max-old-space-size=2048 --inspect"

# Check for memory leaks
pm2 reload tron-bridge-monitor --update-env
```

### Issue: Connection drops

**Symptoms**: Frequent reconnections, connection errors

**Solution**:
1. Check network stability
2. Use multiple RPC endpoints
3. Add retry logic with exponential backoff

## Maintenance

### Log Rotation

```bash
# PM2 log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

### Backup & Recovery

```bash
# Backup state
tar -czf tron-monitor-backup-$(date +%Y%m%d).tar.gz \
  logs/ .env ecosystem.config.js

# Restore
tar -xzf tron-monitor-backup-YYYYMMDD.tar.gz
pm2 restart tron-bridge-monitor
```

### Updates

```bash
# Pull latest code
git pull origin main

# Install dependencies
npm ci

# Rebuild
npm run build

# Restart
pm2 restart tron-bridge-monitor
```

## Security Checklist

- [ ] `.env` excluded from version control
- [ ] TronGrid API key secured
- [ ] Relayer seed in secure vault
- [ ] HTTPS/WSS for all connections
- [ ] Firewall rules configured
- [ ] Rate limiting enabled
- [ ] Monitoring alerts configured
- [ ] Log aggregation enabled
- [ ] Regular security audits
- [ ] Dependency updates automated

## Production Checklist

- [ ] Environment variables configured
- [ ] TronGrid Pro API key obtained
- [ ] Bridge contract deployed and verified
- [ ] Relayer account funded (TRX for energy)
- [ ] Prometheus metrics configured
- [ ] Grafana dashboard imported
- [ ] Alerts configured (PagerDuty/Slack)
- [ ] Health checks enabled
- [ ] Log rotation configured
- [ ] Backup strategy implemented
- [ ] Disaster recovery plan documented
- [ ] Load testing completed
- [ ] Security audit passed
- [ ] Documentation updated

## Support

- **GitHub Issues**: https://github.com/etrid/etrid/issues
- **Discord**: https://discord.gg/etrid
- **Email**: ops@etrid.io
- **Emergency**: +1-XXX-XXX-XXXX

## License

MIT License - ËTRID Foundation
