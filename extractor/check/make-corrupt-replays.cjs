// Replay folder for the failure path: links of the real replays plus two corrupt files.
const fs = require('fs');
const path = require('path');

const [source, out] = process.argv.slice(2);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const real = fs.readdirSync(source).filter(name => name.endsWith('.replay')).sort();
for (const name of real) {
  try { fs.linkSync(path.join(source, name), path.join(out, name)); } catch { fs.copyFileSync(path.join(source, name), path.join(out, name)); }
}
let seed = 12345;
const garbage = Buffer.alloc(4096, 0).map(() => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) >> 16 & 0xff);
fs.writeFileSync(path.join(out, 'Corrupt-Garbage.replay'), garbage);
const smallest = real.map(name => ({ name, size: fs.statSync(path.join(source, name)).size })).sort((a, b) => a.size - b.size)[1].name;
const whole = fs.readFileSync(path.join(source, smallest));
fs.writeFileSync(path.join(out, 'Corrupt-Truncated.replay'), whole.subarray(0, Math.floor(whole.length * 0.6)));
console.log(`${real.length} real replays and 2 corrupt files in ${out}`);
