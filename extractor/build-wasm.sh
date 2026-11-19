#!/usr/bin/env bash
# Rebuilds the browser replay engine from a clean checkout and publishes it to web/public/engine.
#   ./build-wasm.sh                      publish to ../web/public/engine
#   ENGINE_OUT=/some/dir ./build-wasm.sh publish somewhere else
#   LOWPRI=0 ./build-wasm.sh             do not lower the process priority or guard memory (default: idle priority, a game may be running)
#   INCREMENTAL=1 ./build-wasm.sh        keep wasm/bin and wasm/obj from the last build (the default starts clean)
#   AOT=0 ./build-wasm.sh                interpreter build, no ahead-of-time compilation: needs little memory but parses about 4 times slower
#   LOW_MEMORY=0 ./build-wasm.sh         default 1: compile one assembly at a time. Either way the biggest single compiler run (about 26 MB of LLVM bitcode)
#                                        needs about 3 GB of free commit, plus whatever else is running; the build stops itself if less than 1 GB is left.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
export DOTNET_ROOT="${DOTNET_ROOT:-$ROOT/tools/dotnet}"
DOTNET="$DOTNET_ROOT/dotnet.exe"
[ -x "$DOTNET" ] || DOTNET="$DOTNET_ROOT/dotnet"
export DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 DOTNET_CLI_USE_MSBUILD_SERVER=0
OUT="${ENGINE_OUT:-$ROOT/web/public/engine}"
STAGE="$HERE/.scratch/wasm-publish"

MEMORY_FLAGS=""; [ "${LOW_MEMORY:-1}" = 0 ] || MEMORY_FLAGS="-p:DisableParallelAot=true"
[ "${AOT:-1}" = 0 ] && MEMORY_FLAGS="$MEMORY_FLAGS -p:RunAOTCompilation=false"
low() { if [ "${LOWPRI:-1}" = 1 ]; then node "$HERE/check/lowpri.cjs" "$@"; else "$@"; fi; }

[ "${INCREMENTAL:-0}" = 1 ] || rm -rf "$HERE/wasm/bin" "$HERE/wasm/obj"
rm -rf "$STAGE"
low "$DOTNET" publish "$HERE/wasm/ReplayEngine.csproj" -c Release -o "$STAGE" \
  --disable-build-servers -nr:false -p:UseSharedCompilation=false $MEMORY_FLAGS -nologo -v q

test -f "$STAGE/wwwroot/_framework/dotnet.js"
rm -rf "$OUT/_framework"
mkdir -p "$OUT"
cp -r "$STAGE/wwwroot/_framework" "$OUT/_framework"
cp "$HERE/wasm/engine.js" "$OUT/engine.js"
echo "engine published to $OUT"
