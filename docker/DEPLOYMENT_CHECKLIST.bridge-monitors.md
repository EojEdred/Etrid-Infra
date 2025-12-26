# Bridge Monitoring Stack - Production Deployment Checklist

**Use this checklist to ensure a secure and successful production deployment**

## Pre-Deployment

### Environment Setup
- [ ] Docker version >= 20.10 installed
- [ ] Docker Compose version >= 2.0 installed
- [ ] Sufficient disk space (minimum 100GB recommended)
- [ ] Sufficient RAM (minimum 16GB recommended)
- [ ] Network access to all PBC endpoints verified
- [ ] Access to external chain RPC providers configured

### Configuration Files
- [ ] Copied `.env.bridge-monitors.example` to `.env.bridge-monitors`
- [ ] Generated unique private keys for all 6 services (5 aggregators + 1 relayer)
- [ ] Configured FlareChain endpoint (ws://10.0.0.100:9944)
- [ ] Configured all 7 PBC endpoints (10.0.0.101-107:9944)
- [ ] Configured external chain RPC URLs:
  - [ ] Bitcoin RPC URL and credentials
  - [ ] Ethereum RPC URL (Infura, Alchemy, or self-hosted)
  - [ ] Solana RPC URL
  - [ ] BNB Smart Chain RPC URL
  - [ ] Polygon RPC URL
  - [ ] Tron RPC URL and API key
  - [ ] XRP Ledger RPC URL
- [ ] Configured confirmation block thresholds for each chain
- [ ] Set attestation threshold (MIN_ATTESTATIONS=3 recommended)
- [ ] Configured alert notification endpoints (Slack, email, PagerDuty)

### Security Configuration
- [ ] Private keys stored securely (NOT in Git!)
- [ ] Unique key generated for each service
- [ ] Keys backed up to secure vault (HSM/KMS recommended)
- [ ] Changed default Grafana password
- [ ] Configured SSL certificates (if using HTTPS)
- [ ] Enabled API authentication
- [ ] Configured CORS allowed origins
- [ ] Set up firewall rules for port access
- [ ] Reviewed and adjusted rate limiting settings

### Network Connectivity Tests
- [ ] FlareChain reachable: `nc -zv 10.0.0.100 9944`
- [ ] Solana-PBC reachable: `nc -zv 10.0.0.101 9944`
- [ ] BNB-PBC reachable: `nc -zv 10.0.0.102 9944`
- [ ] Ethereum-PBC reachable: `nc -zv 10.0.0.103 9944`
- [ ] Polygon-PBC reachable: `nc -zv 10.0.0.104 9944`
- [ ] Tron-PBC reachable: `nc -zv 10.0.0.105 9944`
- [ ] XRP-PBC reachable: `nc -zv 10.0.0.106 9944`
- [ ] Bitcoin-PBC reachable: `nc -zv 10.0.0.107 9944`
- [ ] External Bitcoin RPC accessible
- [ ] External Ethereum RPC accessible
- [ ] External Solana RPC accessible

## Deployment

### Initial Deployment
- [ ] Run deployment script: `./scripts/deploy/start-bridge-monitors.sh`
- [ ] OR manually: `docker-compose -f docker-compose.bridge-monitors.yml up -d`
- [ ] Wait for all services to start (2-3 minutes)
- [ ] Verify all containers are running: `docker-compose ps`

### Service Health Verification
- [ ] Bitcoin monitor healthy: `curl http://localhost:3010/health`
- [ ] Solana monitor healthy: `curl http://localhost:3011/health`
- [ ] Ethereum monitor healthy: `curl http://localhost:3012/health`
- [ ] BNB monitor healthy: `curl http://localhost:3013/health`
- [ ] Polygon monitor healthy: `curl http://localhost:3014/health`
- [ ] Tron monitor healthy: `curl http://localhost:3015/health`
- [ ] XRP monitor healthy: `curl http://localhost:3016/health`
- [ ] Attestation aggregator 1 healthy: `curl http://localhost:3020/health`
- [ ] Attestation aggregator 2 healthy: `curl http://localhost:3021/health`
- [ ] Attestation aggregator 3 healthy: `curl http://localhost:3022/health`
- [ ] Attestation aggregator 4 healthy: `curl http://localhost:3023/health`
- [ ] Attestation aggregator 5 healthy: `curl http://localhost:3024/health`
- [ ] Relayer service healthy: `curl http://localhost:3030/health`
- [ ] Prometheus accessible: `curl http://localhost:9090/-/healthy`
- [ ] Grafana accessible: `curl http://localhost:3000/api/health`
- [ ] Alertmanager accessible: `curl http://localhost:9093/-/healthy`

### Monitoring Setup
- [ ] Access Grafana dashboard: http://localhost:3000
- [ ] Login with configured credentials
- [ ] Verify Prometheus datasource is connected
- [ ] Load bridge overview dashboard
- [ ] Verify all services showing metrics
- [ ] Configure alert notification channels in Alertmanager
- [ ] Test alert notifications (send test alert)

### Log Review
- [ ] Review bridge monitor logs for errors
- [ ] Review attestation aggregator logs
- [ ] Review relayer service logs
- [ ] Review Prometheus logs
- [ ] Check for any startup warnings or errors

## Post-Deployment

### Functional Testing
- [ ] Verify bridge monitors are detecting blocks from external chains
- [ ] Confirm attestation aggregators are receiving attestations
- [ ] Check relayer service is connected to FlareChain
- [ ] Test complete bridge transaction flow (if safe to do so)
- [ ] Verify metrics are being collected by Prometheus
- [ ] Confirm alerts are triggering correctly

### Performance Verification
- [ ] Check CPU usage is within acceptable range (< 80%)
- [ ] Verify memory usage is stable (< 90%)
- [ ] Monitor network bandwidth utilization
- [ ] Review API response times (< 2 seconds)
- [ ] Check database query performance (if applicable)

### Security Audit
- [ ] Confirm all private keys are stored securely
- [ ] Verify API endpoints require authentication
- [ ] Check HTTPS is enabled (if configured)
- [ ] Review firewall rules
- [ ] Verify non-root users are running containers
- [ ] Check for exposed sensitive information in logs
- [ ] Audit container permissions

### Documentation
- [ ] Document all generated private keys (in secure vault only!)
- [ ] Record service URLs and access credentials
- [ ] Document any custom configuration changes
- [ ] Create runbook for common operations
- [ ] Share access credentials with authorized team members (securely)

### Backup Configuration
- [ ] Backup `.env.bridge-monitors` file (encrypted)
- [ ] Backup Docker volumes: `docker run --rm -v <volume>:/data -v $(pwd):/backup alpine tar czf /backup/<name>.tar.gz /data`
- [ ] Document backup restoration procedure
- [ ] Test backup restoration process

### Monitoring & Alerting
- [ ] Configure Slack webhook for critical alerts
- [ ] Set up email notifications for warnings
- [ ] Configure PagerDuty for on-call rotation
- [ ] Test all notification channels
- [ ] Review alert thresholds and adjust if needed
- [ ] Set up external uptime monitoring (Pingdom, UptimeRobot, etc.)

## Ongoing Operations

### Daily Checks
- [ ] Review Grafana dashboards for anomalies
- [ ] Check for any failed alerts in Alertmanager
- [ ] Review service logs for errors
- [ ] Verify all services are healthy
- [ ] Monitor bridge transaction volume

### Weekly Checks
- [ ] Review disk space usage
- [ ] Check for Docker image updates
- [ ] Review performance metrics and trends
- [ ] Audit security logs
- [ ] Test backup restoration

### Monthly Checks
- [ ] Rotate private keys (if required by policy)
- [ ] Review and update alert rules
- [ ] Audit access logs
- [ ] Update dependencies and Docker images
- [ ] Review and optimize resource allocation
- [ ] Conduct security audit

## Rollback Plan

### If Deployment Fails
1. [ ] Stop all services: `docker-compose -f docker-compose.bridge-monitors.yml down`
2. [ ] Review logs for error details
3. [ ] Fix configuration issues
4. [ ] Restart deployment

### If Services Are Unhealthy
1. [ ] Check service logs: `docker logs <container-name>`
2. [ ] Verify environment variables are correct
3. [ ] Test network connectivity
4. [ ] Restart specific service: `docker-compose restart <service-name>`
5. [ ] If issue persists, stop all and redeploy

### Emergency Shutdown
```bash
# Stop all services immediately
docker-compose -f docker-compose.bridge-monitors.yml down

# Preserve data
docker-compose -f docker-compose.bridge-monitors.yml stop
```

## Support Contacts

- **Technical Lead**: [Name/Email]
- **Security Team**: [Email/Slack]
- **On-Call Engineer**: [PagerDuty/Phone]
- **External Support**: support@etrid.com
- **Discord**: #bridge-support

## Sign-Off

### Deployment Team
- [ ] Configuration reviewed by: _________________ Date: _______
- [ ] Security reviewed by: _________________ Date: _______
- [ ] Deployment performed by: _________________ Date: _______
- [ ] Post-deployment verification by: _________________ Date: _______

### Approvals
- [ ] Technical Lead approval: _________________ Date: _______
- [ ] Security approval: _________________ Date: _______
- [ ] Operations approval: _________________ Date: _______

---

**Deployment Status**: [ ] In Progress  [ ] Completed  [ ] Rolled Back

**Notes**:
_____________________________________________________________________________
_____________________________________________________________________________
_____________________________________________________________________________
