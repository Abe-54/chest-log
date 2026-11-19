#!/usr/bin/env bash
# Reruns every parity check. Build the browser engine first (extractor/build-wasm.sh) and publish it where ENGINE_DIR points.
#   ENGINE_DIR=<folder with engine.js and _framework>   default ../web/public/engine
# Console parity needs the reference output in extractor/.scratch/baseline-data (or ../data) and, for the failure path, the unmodified exe in extractor/.scratch/baseline-bin.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FAILURES="${FAILURES:-1}" "$HERE/console-parity.sh"
node "$HERE/lowpri.cjs" node "$HERE/browser-parity.cjs"
