# ËTRID Build Assignments

## VM Build Plan (18 Working VMs)

### Tier 1: Primearc Core (Relay Chain)
| VM IP | Hostname | Build Target |
|-------|----------|--------------|
| 157.173.200.86 | vmi2897384 | **primearc-core-node** (relay chain) |

### Tier 2: PBC Collators (14 chains)
| VM IP | Hostname | Build Target |
|-------|----------|--------------|
| 157.173.200.84 | vmi2897383 | btc-pbc-collator |
| 157.173.200.81 | vmi2897382 | eth-pbc-collator |
| 157.173.200.80 | vmi2897381 | sol-pbc-collator |
| 154.12.250.18 | vmi2896925 | bnb-pbc-collator |
| 154.12.250.17 | vmi2896924 | trx-pbc-collator |
| 154.12.250.15 | vmi2896923 | xrp-pbc-collator |
| 154.12.249.223 | vmi2896922 | ada-pbc-collator |
| 154.12.249.182 | vmi2896921 | doge-pbc-collator |
| 85.239.239.194 | vmi2896918 | xlm-pbc-collator |
| 85.239.239.193 | vmi2896917 | link-pbc-collator |
| 85.239.239.190 | vmi2896916 | matic-pbc-collator |
| 85.239.239.188 | vmi2896914 | edsc-pbc-collator |
| 80.190.82.186 | vmi2896911 | sc-usdt-pbc-collator |
| 80.190.82.184 | vmi2896909 | ai-compute-pbc-collator |

### Tier 3: Spare VMs (for redundancy/distribution)
| VM IP | Hostname | Purpose |
|-------|----------|---------|
| 80.190.82.183 | vmi2896908 | Binary distribution / backup |
| 158.220.83.146 | vmi2896907 | Binary distribution / backup |
| 158.220.83.66 | vmi2896906 | Binary distribution / backup |

### Failed VMs (skip)
- 85.239.239.189
- 80.190.82.185

---

## Build Commands

### Primearc Core (on VM 157.173.200.86)
```bash
cd /root/etrid
cargo build --release -p primearc-core-node
# Binary at: target/release/primearc-core-node
```

### PBC Collators (on respective VMs)
```bash
cd /root/etrid
# Replace {chain} with: btc, eth, sol, bnb, trx, xrp, ada, doge, xlm, link, matic, edsc, sc-usdt, ai-compute
cargo build --release -p {chain}-pbc-collator
# Binary at: target/release/{chain}-pbc-collator
```

---

## Post-Build: Collect Binaries

After builds complete, collect all binaries to one location:
```bash
# On each build VM, after successful build:
scp /root/etrid/target/release/*-collator root@157.173.200.86:/root/binaries/
scp /root/etrid/target/release/primearc-core-node root@157.173.200.86:/root/binaries/
```

---

## Deployment Targets

Once binaries collected, distribute to validator nodes for the live network.
