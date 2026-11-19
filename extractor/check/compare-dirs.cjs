// Byte comparison of an extractor output folder against an expected one: every file the extractor wrote
// (matches/*.json, chests.json, index.json, debug/*) must exist in the expected folder with the same bytes.
// Files that exist only in the expected folder (clips, schema docs, other tools' debug files) are listed but not compared.
const fs = require('fs');
const path = require('path');

const list = (dir, sub = '') => fs.readdirSync(path.join(dir, sub), { withFileTypes: true }).flatMap(entry => {
  const relative = path.join(sub, entry.name);
  return entry.isDirectory() ? list(dir, relative) : [relative];
}).filter(name => !name.endsWith('.tmp'));

const [expected, actual] = process.argv.slice(2);
const produced = list(actual).sort();
const expectedOnly = list(expected).filter(name => !produced.includes(name)).sort();
let mismatches = 0;
for (const name of produced) {
  const left = fs.existsSync(path.join(expected, name)) ? fs.readFileSync(path.join(expected, name)) : null;
  const right = fs.readFileSync(path.join(actual, name));
  if (!left || !left.equals(right)) {
    mismatches++;
    console.log(`DIFF ${name} ${left ? left.length : 'missing'} vs ${right.length}`);
  }
}
if (expectedOnly.length) console.log(`not produced by the extractor, not compared: ${expectedOnly.join(', ')}`);
console.log(`compared ${produced.length} files, ${mismatches} mismatches (${expected} vs ${actual})`);
process.exit(mismatches ? 1 : 0);
