// Links the replays named in a baseline index into one folder, so a replay recorded while the checks run cannot change the file set.
const fs = require('fs');
const path = require('path');

const [baseline, replays, out] = process.argv.slice(2);
const index = JSON.parse(fs.readFileSync(path.join(baseline, 'index.json'), 'utf8'));
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const row of index.matches) {
  const source = path.join(replays, row.file);
  const target = path.join(out, row.file);
  try { fs.linkSync(source, target); } catch { fs.copyFileSync(source, target); }
}
console.log(`${index.matches.length} replays in ${out}`);
