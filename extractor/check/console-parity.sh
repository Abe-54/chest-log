#!/usr/bin/env bash
# Console parity: builds the current console program to a scratch folder (never extractor/bin), runs it over the replays
# named in the baseline index, and requires every output file to be byte-identical to the baseline.
#   BASELINE   folder of the reference output (default extractor/.scratch/baseline-data, else ../data)
#   FAILURES=1 also runs the failure path: the same replays plus two corrupt files, through the unmodified baseline exe
#              (extractor/.scratch/baseline-bin, built before the engine split) and through the current one
# Everything runs at idle priority.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT="$(cd "$HERE/.." && pwd)"
ROOT="$(cd "$EXT/.." && pwd)"
export DOTNET_ROOT="${DOTNET_ROOT:-$ROOT/tools/dotnet}" DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 DOTNET_CLI_USE_MSBUILD_SERVER=0
BASELINE="${BASELINE:-$EXT/.scratch/baseline-data}"
[ -d "$BASELINE" ] || BASELINE="$ROOT/data"
SCRATCH="$EXT/.scratch"
low() { node "$HERE/lowpri.cjs" "$@"; }

echo "== build current console into $SCRATCH/console-bin"
rm -rf "$SCRATCH/console-bin"
low "$DOTNET_ROOT/dotnet.exe" build "$EXT/Extractor.csproj" -c Release -o "$SCRATCH/console-bin" \
  --disable-build-servers -nr:false -m:2 -p:UseSharedCompilation=false -nologo -v q 2>&1 | grep -E " error |error:" || true

echo "== snapshot of the replays named in $BASELINE/index.json"
node "$HERE/snapshot-replays.cjs" "$BASELINE" "$ROOT/replays" "$SCRATCH/replays"

run() { # exe replays data
  rm -rf "$3" && mkdir -p "$3"
  low "$1" "$2" "$3" > "$3.out" 2> "$3.err" || echo "exit code $? from $1 (Verify reports failures through it)"
}

echo "== run current console"
run "$SCRATCH/console-bin/Extractor.exe" "$SCRATCH/replays" "$SCRATCH/console-data"
node "$HERE/compare-dirs.cjs" "$BASELINE" "$SCRATCH/console-data"

if [ "${FAILURES:-0}" = 1 ]; then
  echo "== failure path: two corrupt replays next to the real ones"
  [ -x "$SCRATCH/baseline-bin/Extractor.exe" ] || { echo "no unmodified baseline exe in $SCRATCH/baseline-bin"; exit 2; }
  node "$HERE/make-corrupt-replays.cjs" "$SCRATCH/replays" "$SCRATCH/replays-failing"
  run "$SCRATCH/baseline-bin/Extractor.exe" "$SCRATCH/replays-failing" "$SCRATCH/baseline-failing-data"
  run "$SCRATCH/console-bin/Extractor.exe" "$SCRATCH/replays-failing" "$SCRATCH/console-failing-data"
  node "$HERE/compare-dirs.cjs" "$SCRATCH/baseline-failing-data" "$SCRATCH/console-failing-data"
  grep -c . "$SCRATCH/console-failing-data.err" | sed 's/^/stderr lines from the failing run: /'
fi
