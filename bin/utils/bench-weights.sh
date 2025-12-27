#!/usr/bin/env bash
set -euo pipefail

# Benchmark selected pallets and regenerate weights.rs.
# Usage: ./scripts/bench-weights.sh
#
# Requires: release toolchain, `runtime-benchmarks` feature enabled, and wasm build deps.
# Adjust --chain and --execution if you need different targets.

NODE_BIN="primearc-core-node"
FEATURES="runtime-benchmarks"
CHAIN="dev"
STEPS=50
REPEAT=20
WARMUP=5

run_bench() {
  local pallet="$1"
  local extrinsic="$2"
  local output="$3"

  echo "==> Benchmarking ${pallet} (${extrinsic}) -> ${output}"
  cargo run --release -p "${NODE_BIN}" --features "${FEATURES}" -- \
    benchmark pallet \
    --chain "${CHAIN}" \
    --pallet "${pallet}" \
    --extrinsic "${extrinsic}" \
    --steps "${STEPS}" \
    --repeat "${REPEAT}" \
    --warmup "${WARMUP}" \
    --execution=wasm \
    --wasm-execution=compiled \
    --template .maintain/frame-weight-template.hbs \
    --output "${output}"
}

# Treasury
run_bench "pallet_treasury" "*" "10-foundation/pallets/pallet-treasury/src/weights.rs"

# Native currency / reserves
run_bench "pallet_reserve_oracle" "*" "06-native-currency/pallets/pallet-reserve-oracle/src/weights.rs"
run_bench "pallet_multiasset_reserve" "*" "06-native-currency/pallets/pallet-multiasset-reserve/src/weights.rs"

# EDSC bridge pallets
run_bench "pallet_edsc_token" "*" "05-multichain/bridges/protocols/edsc-bridge/substrate-pallets/pallet-edsc-token/src/weights.rs"
run_bench "pallet_edsc_redemption" "*" "05-multichain/bridges/protocols/edsc-bridge/substrate-pallets/pallet-edsc-redemption/src/weights.rs"

# Consensus Day (example)
run_bench "consensus_day_minting_logic" "*" "12-consensus-day/minting-logic/src/weights.rs"

echo "✅ Benchmarks completed. Review updated weights.rs files."
