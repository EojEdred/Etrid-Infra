# Ëtrid PrimeArc Core Chain Validator Monitoring Setup

Complete monitoring solution for Ëtrid PrimeArc Core Chain validators using Prometheus and Grafana.

## Overview

This directory contains everything you need to set up comprehensive monitoring for your PrimeArc Core Chain validators:

- **Prometheus** - Time-series database for metrics collection
- **Grafana** - Visualization dashboard for metrics analysis
- **Alerting Rules** - Pre-configured alerts for critical issues
- **Installation Scripts** - Automated setup for macOS and Linux

## Quick Start

### 1. Install Prometheus

```bash
cd /Users/macbook/Desktop/etrid/monitoring
./install-prometheus.sh
```

This will:
- Install Prometheus (via Homebrew on macOS, from source on Linux)
- Configure it to scrape PrimeArc Core Chain validator metrics
- Set up alerting rules
- Start the Prometheus service

**Access Prometheus**: http://localhost:9090

### 2. Install Grafana

```bash
./install-grafana.sh
```

This will:
- Install Grafana (via Homebrew on macOS, from apt on Linux)
- Configure Prometheus as a datasource
- Import the PrimeArc Core Chain dashboard
- Start the Grafana service

**Access Grafana**: http://localhost:3000
- Username: `admin`
- Password: `etrid2025` (change this after first login!)

### 3. Verify Setup

1. Open Prometheus: http://localhost:9090/targets
   - Verify all validator targets show as "UP"
   - Main validator (100.93.43.18:9615) should be green

2. Open Grafana: http://localhost:3000
   - Login with admin credentials
   - Navigate to Dashboards > Ëtrid PrimeArc Core Chain Validators
   - Verify metrics are being displayed

## What's Being Monitored

### Block Production Metrics
- **Block Height** - Current best and finalized block numbers
- **Block Production Rate** - Blocks produced per second
- **Finalization Rate** - Blocks finalized per second
- **Finalization Lag** - Difference between best and finalized blocks
- **Block Construction Time** - Time taken to build blocks
- **Block Verification Time** - Time taken to verify blocks

### Network Health Metrics
- **Connected Peers** - Number of active P2P connections
- **Network Bandwidth** - Inbound/outbound traffic
- **Network Latency** - P2P communication delays

### Transaction Metrics
- **Transaction Pool Size** - Ready transactions waiting for inclusion
- **Transaction Throughput** - Transactions processed per second (TPS)
- **Transaction Finalization Time** - Time from submission to finality

### System Resource Metrics
- **CPU Usage** - Processor utilization percentage
- **Memory Usage** - RAM consumption (RSS + DB cache)
- **Database Cache** - State database cache size

### Consensus Metrics
- **Import Queue** - Block import processing rate
- **Chain Forks** - Number of chain leaves (fork indicators)
- **RPC Performance** - RPC call rate and latency

## Current Validator Configuration

The monitoring is pre-configured for the following validators:

| Validator | IP Address | Metrics Port | Status |
|-----------|------------|--------------|--------|
| Main      | 100.93.43.18 | 9615 | ✅ Active |

### Current Metrics (as of setup):
- **Block Height**: #16,949
- **Finalized Height**: #16,849
- **Finalization Lag**: 100 blocks
- **Connected Peers**: 5
- **Chain**: primearc_core_chain_mainnet_v1

## Adding More Validators

To monitor additional validators, edit the Prometheus configuration:

```bash
nano /etc/prometheus/prometheus.yml  # Linux
# or
nano $(brew --prefix)/etc/prometheus.yml  # macOS
```

Add a new scrape job for each validator:

```yaml
- job_name: 'primearc_core_chain-validator-02'
  static_configs:
    - targets: ['100.x.x.x:9615']  # Replace with validator IP
      labels:
        node_type: 'validator'
        validator: 'validator-02'
        chain: 'primearc_core_chain_mainnet'
        network: 'tailscale'
        instance: 'validator-02'
```

Then restart Prometheus:

```bash
sudo systemctl restart prometheus  # Linux
brew services restart prometheus   # macOS
```

## Alerting Rules

Pre-configured alerts in `/etc/prometheus/alerting-rules-primearc_core_chain.yml`:

### Critical Alerts (Immediate Action Required)
- **NoBlocksProduced** - Block production has stopped
- **FinalizationStalled** - Block finalization is stuck (>50 blocks lag)
- **NoPeersConnected** - Validator is isolated from network
- **ValidatorDown** - Cannot scrape metrics from validator

### Warning Alerts (Monitor Closely)
- **SlowBlockProduction** - Block rate below expected
- **FinalizationLagHigh** - Finalization lag >20 blocks
- **LowPeerCount** - Less than 3 peers connected
- **TransactionPoolFull** - Transaction pool near capacity
- **HighCPUUsage** - CPU usage >80%
- **HighMemoryUsage** - Memory usage >8GB

### Info Alerts (Informational)
- **HighRPCCallRate** - Unusual RPC activity
- **DatabaseCacheHigh** - Large DB cache (normal for validators)

## Grafana Dashboard

The PrimeArc Core Chain dashboard includes 12 panels organized into sections:

1. **Block Production Overview** - Block height, finalization lag, peer count
2. **Performance Metrics** - Block/finalization rates, construction time
3. **Transaction Processing** - Pool size, throughput
4. **Network Health** - Bandwidth, latency
5. **System Resources** - CPU, memory, DB cache
6. **Chain Health** - Forks, import queue, validator status

**Features:**
- 10-second auto-refresh
- Multi-validator support with instance selector
- Last 30 minutes view by default
- Interactive time range selection
- Alert status indicators

## Troubleshooting

### Prometheus Not Scraping Metrics

**Symptom**: Targets show as "DOWN" in http://localhost:9090/targets

**Solutions**:
```bash
# 1. Check if validator is exposing metrics
curl http://100.93.43.18:9615/metrics

# 2. Verify Tailscale connectivity
ping 100.93.43.18

# 3. Check Prometheus logs
sudo journalctl -u prometheus -f  # Linux
tail -f /usr/local/var/log/prometheus.log  # macOS

# 4. Validate configuration
promtool check config /etc/prometheus/prometheus.yml
```

### Grafana Shows "No Data"

**Symptom**: Dashboard panels are empty

**Solutions**:
```bash
# 1. Verify Prometheus is running
curl http://localhost:9090/-/healthy

# 2. Test Prometheus datasource in Grafana
# Go to Configuration > Data Sources > Prometheus > Test

# 3. Check if metrics exist in Prometheus
# Go to http://localhost:9090/graph
# Query: substrate_block_height

# 4. Check Grafana logs
sudo journalctl -u grafana-server -f  # Linux
tail -f /usr/local/var/log/grafana/grafana.log  # macOS
```

### Metrics Are Stale

**Symptom**: Metrics not updating

**Solutions**:
```bash
# 1. Check validator is still running
curl http://100.93.43.18:9615/metrics | grep substrate_block_height

# 2. Verify scrape interval
# Should see new data every 15 seconds

# 3. Check Prometheus storage
df -h /var/lib/prometheus  # Linux
df -h $(brew --prefix)/var/prometheus  # macOS

# 4. Restart Prometheus if needed
sudo systemctl restart prometheus  # Linux
brew services restart prometheus   # macOS
```

## Advanced Configuration

### Setting Up Alertmanager

To receive alert notifications (Slack, email, PagerDuty):

1. Install Alertmanager:
```bash
brew install alertmanager  # macOS
sudo apt-get install prometheus-alertmanager  # Linux
```

2. Configure notification receivers in `/etc/alertmanager/alertmanager.yml`

3. Update Prometheus to use Alertmanager:
```yaml
alerting:
  alertmanagers:
    - static_configs:
        - targets:
            - localhost:9093
```

### Enabling Node Exporter

For detailed system metrics (CPU, disk, network at OS level):

```bash
# macOS
brew install node_exporter
brew services start node_exporter

# Linux
sudo apt-get install prometheus-node-exporter
sudo systemctl enable prometheus-node-exporter
sudo systemctl start prometheus-node-exporter
```

Then add to Prometheus config:
```yaml
- job_name: 'node-exporter'
  static_configs:
    - targets: ['localhost:9100']
```

### Long-Term Storage

For metrics retention beyond 30 days, consider:

1. **Increase Retention**: Edit prometheus.yml
```yaml
storage:
  tsdb:
    retention.time: 90d
    retention.size: 200GB
```

2. **Remote Write**: Use Thanos, Cortex, or cloud services
```yaml
remote_write:
  - url: "http://your-remote-storage:9009/api/v1/push"
```

## Useful Queries

### PromQL Examples

```promql
# Current block height
substrate_block_height{chain="primearc_core_chain_mainnet", status="best"}

# Block production rate (blocks/minute)
rate(substrate_block_height{status="best"}[1m]) * 60

# Finalization lag
substrate_block_height{status="best"} - substrate_block_height{status="finalized"}

# Transaction throughput (TPS)
rate(substrate_proposer_number_of_transactions[1m])

# Memory usage in GB
process_resident_memory_bytes / 1024 / 1024 / 1024

# CPU usage percentage
rate(process_cpu_seconds_total[1m]) * 100

# Network bandwidth (MB/s)
rate(substrate_sub_libp2p_network_bytes_total[1m]) / 1024 / 1024

# Average block construction time (seconds)
rate(substrate_proposer_block_constructed_sum[5m]) /
rate(substrate_proposer_block_constructed_count[5m])
```

## Maintenance

### Regular Tasks

**Daily:**
- Check Grafana dashboard for anomalies
- Verify all validators are "UP" in Prometheus targets

**Weekly:**
- Review alert history and tune thresholds if needed
- Check disk space for Prometheus data

**Monthly:**
- Update Prometheus and Grafana to latest versions
- Review and clean up old metrics
- Backup dashboard configurations

### Backup Configuration

```bash
# Backup Prometheus config
cp /etc/prometheus/prometheus.yml ~/etrid-monitoring-backup/

# Backup Grafana dashboards
grafana-cli admin export-dashboard > ~/etrid-monitoring-backup/dashboards.json

# Backup alerting rules
cp /etc/prometheus/alerting-rules-primearc_core_chain.yml ~/etrid-monitoring-backup/
```

## Security Recommendations

1. **Change Default Passwords**
   - Grafana admin password (default: etrid2025)
   - Enable authentication for Prometheus

2. **Network Security**
   - Use firewall to restrict access to ports 9090, 3000
   - Only allow connections from trusted IPs
   - Use HTTPS with reverse proxy (nginx/traefik)

3. **Access Control**
   - Enable Grafana user authentication
   - Set up role-based access control (RBAC)
   - Use read-only users for viewing dashboards

4. **Monitoring Security**
   - Monitor for unauthorized access attempts
   - Set up audit logging
   - Regularly update monitoring components

## Files in This Directory

| File | Description |
|------|-------------|
| `prometheus-primearc_core_chain.yml` | Prometheus configuration for PrimeArc Core Chain validators |
| `alerting-rules-primearc_core_chain.yml` | Alert rules for critical issues |
| `grafana-dashboard-primearc_core_chain.json` | Pre-configured Grafana dashboard |
| `install-prometheus.sh` | Automated Prometheus installation script |
| `install-grafana.sh` | Automated Grafana installation script |
| `README.md` | This documentation file |

## Resources

- **Prometheus Documentation**: https://prometheus.io/docs/
- **Grafana Documentation**: https://grafana.com/docs/
- **PromQL Tutorial**: https://prometheus.io/docs/prometheus/latest/querying/basics/
- **Substrate Metrics**: https://docs.substrate.io/reference/command-line-tools/node-template/#monitoring
- **Ëtrid Monitoring Guide**: /Users/macbook/Desktop/etrid/docs/MONITORING_GUIDE.md

## Support

For issues or questions:
- Check the troubleshooting section above
- Review Prometheus/Grafana logs
- Consult the Ëtrid documentation
- Reach out to the validator community

---

**Last Updated**: 2025-11-22
**Version**: 1.0.0
**Maintained By**: Ëtrid Protocol Team
