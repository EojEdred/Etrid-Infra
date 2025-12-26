# Docker Configuration

Docker and containerization files for ËTRID.

## Files

### Docker Compose
- **`docker-compose.yml`** - Multi-service orchestration for local development and monitoring

### Dockerfiles
- **`Dockerfile`** - Standard ËTRID node container
- **`Dockerfile.primearc-core-chain`** - Primearc Core Chain relay chain container

### Configuration
- **`.dockerignore`** - Files to exclude from Docker builds

## Quick Start

### Run with Docker Compose

```bash
# From repository root
docker-compose -f docker/docker-compose.yml up -d
```

### Build Individual Images

```bash
# Standard node
docker build -f docker/Dockerfile -t etrid-node .

# Primearc Core Chain relay
docker build -f docker/Dockerfile.primearc-core-chain -t primearc-core-chain-node .
```

## Services in docker-compose.yml

- **Prometheus** - Metrics collection (port 9090)
- **Grafana** - Metrics visualization (port 3000)
- **Ollama** - Local AI model (port 11434)
- **AI Monitoring** - Orchestrator service

## Related Documentation

- [Main README](../README.md) - Project overview
- [docs/deployment/](../docs/deployment/) - Deployment guides

---

*Last Updated: 2025-11-01*
