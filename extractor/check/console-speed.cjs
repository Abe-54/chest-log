// Wall time of the unmodified baseline exe against the current console exe over the same replays, alternating so both see the same machine load.
//   node check/lowpri.cjs node check/console-speed.cjs [runs=2]       needs DOTNET_ROOT and extractor/.scratch/{baseline-bin,console-bin,replays}
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ext = path.resolve(__dirname, '..');
const root = path.resolve(ext, '..');
const env = { ...process.env, DOTNET_ROOT: process.env.DOTNET_ROOT ?? path.join(root, 'tools/dotnet') };
const exes = { baseline: path.join(ext, '.scratch/baseline-bin/Extractor.exe'), current: path.join(ext, '.scratch/console-bin/Extractor.exe') };
const runs = Number(process.argv[2] ?? 2);
const times = { baseline: [], current: [] };
for (let i = 0; i < runs; i++) {
  for (const name of ['baseline', 'current']) {
    const out = path.join(ext, '.scratch/speed-data');
    fs.rmSync(out, { recursive: true, force: true });
    fs.mkdirSync(out, { recursive: true });
    const started = Date.now();
    const run = spawnSync(exes[name], [path.join(ext, '.scratch/replays'), out], { env, stdio: 'ignore' });
    times[name].push((Date.now() - started) / 1000);
    console.log(`${name} run ${i + 1}: ${times[name].at(-1).toFixed(1)} s (exit ${run.status})`);
  }
}
const median = values => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) / 2)];
console.log(`median baseline ${median(times.baseline).toFixed(1)} s, current ${median(times.current).toFixed(1)} s`);
fs.rmSync(path.join(ext, '.scratch/speed-data'), { recursive: true, force: true });
