// Browser parity for the replay engine, in headless Chromium and Web Workers.
//   node check/lowpri.cjs node check/browser-parity.cjs        (run at idle priority; a game may be running)
// env: ENGINE_DIR (default ../web/public/engine), BASELINE (default .scratch/baseline-data), REPLAYS (default .scratch/replays),
//      FAILING (default .scratch/replays-failing), BASELINE_FAILING (default .scratch/baseline-failing-data), REPORT (default .scratch/browser-report.json)
// Checks: parity with the baseline, incremental parity across workers and orders, failure rows, time zones, version guard, sizes and timings.
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { isDeepStrictEqual } = require('util');

const here = __dirname;
const ext = path.resolve(here, '..');
const root = path.resolve(ext, '..');
const { chromium } = require(path.join(root, 'web/node_modules/playwright'));

const engineDir = path.resolve(process.env.ENGINE_DIR ?? path.join(root, 'web/public/engine'));
const baselineDir = path.resolve(process.env.BASELINE ?? (fs.existsSync(path.join(ext, '.scratch/baseline-data')) ? path.join(ext, '.scratch/baseline-data') : path.join(root, 'data')));
const replaysDir = path.resolve(process.env.REPLAYS ?? path.join(ext, '.scratch/replays'));
const failingDir = path.resolve(process.env.FAILING ?? path.join(ext, '.scratch/replays-failing'));
const baselineFailingDir = path.resolve(process.env.BASELINE_FAILING ?? path.join(ext, '.scratch/baseline-failing-data'));
const reportPath = path.resolve(process.env.REPORT ?? path.join(ext, '.scratch/browser-report.json'));
const ZONE = 'America/New_York';

const verdicts = [];
const verdict = (name, status, detail) => {
  verdicts.push({ name, status, detail });
  console.log(`${status.padEnd(12)} ${name}: ${detail}`);
};
const median = values => [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) / 2)];
const mb = bytes => (bytes / 1048576).toFixed(1);

function loadDataset(dir) {
  const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  const chests = JSON.parse(fs.readFileSync(path.join(dir, 'chests.json'), 'utf8'));
  const matches = {};
  for (const name of fs.readdirSync(path.join(dir, 'matches'))) matches[name.replace(/\.json$/, '')] = fs.readFileSync(path.join(dir, 'matches', name), 'utf8');
  return { index, chests, matches };
}

function compareDataset(run, base) {
  const ids = Object.keys(base.matches).sort();
  const gotIds = Object.keys(run.matches).sort();
  const mismatched = [];
  let identical = 0;
  for (const id of ids) {
    const text = run.matches[id];
    if (text === base.matches[id]) identical++;
    if (text === undefined || !isDeepStrictEqual(JSON.parse(text), JSON.parse(base.matches[id]))) mismatched.push(id);
  }
  const completed = JSON.parse(run.completed);
  return {
    matches: ids.length,
    extraMatches: gotIds.filter(id => !ids.includes(id)),
    mismatched,
    byteIdentical: identical,
    indexEqual: isDeepStrictEqual(completed.index, base.index),
    chestsEqual: isDeepStrictEqual(completed.chests, base.chests),
    chestCount: Object.keys(completed.chests).length,
    indexRows: completed.index.matches.length,
  };
}

const passed = c => c.mismatched.length === 0 && c.extraMatches.length === 0 && c.indexEqual && c.chestsEqual;
const summary = c => `${c.matches} matches (${c.byteIdentical} byte-identical, ${c.mismatched.length} not deep-equal${c.extraMatches.length ? `, extra ${c.extraMatches}` : ''}), index ${c.indexEqual ? 'equal' : 'DIFFERENT'} (${c.indexRows} rows), chests ${c.chestsEqual ? 'equal' : 'DIFFERENT'} (${c.chestCount})`;

function shuffled(items, seed) {
  const result = [...items];
  let state = seed;
  const next = () => { state = (state + 0x6D2B79F5) | 0; let t = Math.imul(state ^ (state >>> 15), 1 | state); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}

function publishSizes(dir) {
  const files = [];
  const walk = sub => fs.readdirSync(path.join(dir, sub), { withFileTypes: true }).forEach(entry => {
    const relative = path.join(sub, entry.name);
    if (entry.isDirectory()) walk(relative); else files.push(relative);
  });
  walk('');
  let raw = 0;
  let brotli = 0;
  const largest = [];
  for (const file of files) {
    const bytes = fs.readFileSync(path.join(dir, file));
    const packed = zlib.brotliCompressSync(bytes, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11, [zlib.constants.BROTLI_PARAM_SIZE_HINT]: bytes.length } }).length;
    raw += bytes.length;
    brotli += packed;
    largest.push({ file: file.replaceAll('\\', '/'), raw: bytes.length, brotli: packed });
  }
  return { files: files.length, raw, brotli, largest: largest.sort((a, b) => b.raw - a.raw).slice(0, 4) };
}

const types = { '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json' };
function serve() {
  const mounts = [['/engine/', engineDir], ['/replays/', replaysDir], ['/failing/', failingDir]];
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(req.url.split('?')[0]);
    let file = null;
    if (url === '/check/page.html') file = path.join(here, 'browser-page.html');
    else if (url === '/check/worker.js') file = path.join(here, 'browser-worker.js');
    else for (const [prefix, dir] of mounts) if (url.startsWith(prefix)) file = path.join(dir, url.slice(prefix.length));
    if (!file || !file.startsWith(here) && !mounts.some(([, dir]) => file.startsWith(dir)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream', 'content-length': fs.statSync(file).size, 'cache-control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const cpuSnapshot = () => os.cpus().reduce((sum, cpu) => { const t = Object.values(cpu.times); sum.total += t.reduce((a, b) => a + b, 0); sum.idle += cpu.times.idle; return sum; }, { total: 0, idle: 0 });

function wallClock(instant, zone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }).formatToParts(new Date(instant)).map(p => [p.type, p.value]));
  return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second, +parts.fractionalSecond);
}
const zoneOffset = (instant, zone) => wallClock(instant, zone) - instant;
function localToUtc(wall, zone) {
  const first = wall - zoneOffset(wall, zone);
  return wall - zoneOffset(first, zone);
}

(async () => {
  if (!fs.existsSync(path.join(engineDir, 'engine.js'))) throw new Error(`no engine in ${engineDir}`);
  const base = loadDataset(baselineDir);
  const files = base.index.matches.map(row => row.file).sort();
  console.log(`engine ${engineDir}\nbaseline ${baselineDir} (${files.length} replays)\nreplays ${replaysDir}`);

  const sizes = publishSizes(engineDir);
  console.log(`publish: ${sizes.files} files, raw ${mb(sizes.raw)} MB, brotli q11 ${mb(sizes.brotli)} MB; largest ${sizes.largest.map(f => `${f.file} ${mb(f.raw)}/${mb(f.brotli)}`).join(', ')}`);

  const server = await serve();
  const browser = await chromium.launch({ headless: true });
  const page = await (await browser.newContext()).newPage();
  const problems = [];
  page.on('pageerror', error => problems.push(`pageerror: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') problems.push(`console: ${message.text()}`); });
  await page.goto(`http://127.0.0.1:${server.address().port}/check/page.html`);
  await page.waitForFunction(() => window.ready);
  const spawn = name => page.evaluate(n => window.spawn(n), name);
  const kill = name => page.evaluate(n => window.kill(n), name);
  const call = (name, message) => page.evaluate(([n, m]) => window.call(n, m), [name, message]);
  const parse = (worker, folder, name, timeZone = ZONE) => call(worker, { op: 'parse', folder, name, timeZone });

  const report = { engineDir, baselineDir, sizes };
  const cpuStart = cpuSnapshot();
  const wallStart = Date.now();

  await spawn('w1');
  const init = await call('w1', { op: 'init' });
  report.init = init;
  console.log(`runtime ready in ${init.loadMs.toFixed(0)} ms, engine ${init.version}, cross-origin isolated: ${init.isolated}, heap ${mb(init.heap)} MB`);

  const pendings = {};
  const parseRows = [];
  for (const name of files) {
    const result = await parse('w1', 'replays', name);
    if (!result.ok) { verdict(`parse ${name}`, 'FAIL', JSON.stringify(result.error)); continue; }
    pendings[name] = result.json;
    parseRows.push({ name, ms: result.ms, replayBytes: result.bytes, pendingBytes: Buffer.byteLength(result.json), heap: result.heap });
  }
  const parseMs = parseRows.map(r => r.ms);
  const pendingBytes = parseRows.map(r => r.pendingBytes);
  report.parse = { count: parseRows.length, firstMs: parseRows[0]?.ms, medianMs: median(parseMs), worstMs: Math.max(...parseMs), totalMs: parseMs.reduce((a, b) => a + b, 0),
    pendingMedianBytes: median(pendingBytes), pendingMaxBytes: Math.max(...pendingBytes), pendingTotalBytes: pendingBytes.reduce((a, b) => a + b, 0),
    heapAfterParses: parseRows.at(-1)?.heap, rows: parseRows };
  verdict('parse all', parseRows.length === files.length ? 'OK' : 'FAIL', `${parseRows.length}/${files.length} parsed, median ${report.parse.medianMs.toFixed(0)} ms, worst ${report.parse.worstMs.toFixed(0)} ms`);

  const idOf = name => name.replace(/\.replay$/, '');
  const completeIn = (worker, names, failures = []) => call(worker, { op: 'complete', pendings: names.map(n => pendings[n]), failures, ids: names.map(idOf) });

  const full = await completeIn('w1', files);
  const parity = compareDataset(full, base);
  report.complete = { addMs: full.addMs, completeMs: full.completeMs, takeMs: full.takeMs, heapAfterComplete: full.heapAfterComplete, heapAfterTake: full.heapAfterTake, completedBytes: Buffer.byteLength(full.completed) };
  verdict('1 browser parity', passed(parity) ? 'VERIFIED' : 'FAIL', summary(parity));
  verdict('TakeMatch releases', full.takenTwice.includes('No completed match') ? 'OK' : 'FAIL', `second TakeMatch -> ${full.takenTwice}`);

  const reversed = await completeIn('w1', [...files].reverse());
  const reversedParity = compareDataset(reversed, base);
  verdict('complete again after Reset, reversed order', passed(reversedParity) ? 'OK' : 'FAIL', summary(reversedParity));

  await kill('w1');
  const odd = files.filter((_, i) => i % 2 === 1);
  const even = files.filter((_, i) => i % 2 === 0);
  const saved = {};
  let pendingDrift = 0;
  await spawn('wA');
  for (const name of [...odd].reverse()) saved[name] = (await parse('wA', 'replays', name)).json;
  await kill('wA');
  await spawn('wB');
  for (const name of shuffled(even, 7)) saved[name] = (await parse('wB', 'replays', name)).json;
  await kill('wB');
  for (const name of files) if (saved[name] !== pendings[name]) pendingDrift++;
  verdict('3a pending is pure per replay', pendingDrift === 0 ? 'VERIFIED' : 'FAIL', `${files.length - pendingDrift}/${files.length} pending strings from fresh workers in other orders equal the single-worker ones`);
  await spawn('wC');
  Object.assign(pendings, saved);
  const incremental = await completeIn('wC', shuffled(files, 99));
  const incrementalParity = compareDataset(incremental, base);
  verdict('3b incremental parity', passed(incrementalParity) && pendingDrift === 0 ? 'VERIFIED' : 'FAIL', `third worker, shuffled order: ${summary(incrementalParity)}`);

  if (fs.existsSync(path.join(baselineFailingDir, 'index.json')) && fs.existsSync(failingDir)) {
    const failingBase = loadDataset(baselineFailingDir);
    const corrupt = fs.readdirSync(failingDir).filter(n => n.startsWith('Corrupt-') && n.endsWith('.replay')).sort();
    const failures = [];
    const extra = [];
    for (const name of corrupt) {
      const result = await parse('wC', 'failing', name);
      if (result.ok) { pendings[name] = result.json; extra.push(name); } else failures.push({ id: idOf(name), file: name, error: result.error.message });
      console.log(`  ${name}: ${result.ok ? 'parsed' : `threw name=${result.error.name} message=${JSON.stringify(result.error.message)} text=${JSON.stringify(result.error.text)}`}`);
    }
    const withFailures = await completeIn('wC', [...files, ...extra], failures);
    const failureParity = compareDataset(withFailures, failingBase);
    const rows = failureParity.indexRows;
    verdict('4 failure rows', passed(failureParity) ? 'VERIFIED' : 'FAIL', `${failures.length} threw, ${extra.length} parsed; ${summary(failureParity)}; rows ${rows}`);
    report.failures = { failures, parsedAnyway: extra };
  } else {
    verdict('4 failure rows', 'NOT RUN', 'run FAILURES=1 check/console-parity.sh first');
  }

  const tampered = pendings[files[0]].replace(/^\{"version":"[0-9a-f]+"/, '{"version":"0000000000000000"');
  const guard = await call('wC', { op: 'addBadPending', json: tampered });
  verdict('5 stale pending rejected', !guard.accepted && tampered !== pendings[files[0]] ? 'OK' : 'FAIL', guard.accepted ? 'accepted' : guard.error.message);

  const smallest = [...parseRows].sort((a, b) => a.replayBytes - b.replayBytes)[0].name;
  const baseStart = JSON.parse(base.matches[idOf(smallest)]).meta.startUtc;
  const wall = wallClock(Date.parse(baseStart), ZONE);
  const zoneRows = [];
  for (const zone of ['America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Kolkata', 'Australia/Lord_Howe', 'Pacific/Chatham', 'UTC', 'Etc/GMT+5']) {
    const result = await parse('wC', 'replays', smallest, zone);
    const got = result.ok ? JSON.parse(result.json).match.meta.startUtc : null;
    const expected = new Date(localToUtc(wall, zone)).toISOString();
    zoneRows.push({ zone, got, expected, ok: result.ok && Math.abs(Date.parse(got) - Date.parse(expected)) < 2, error: result.ok ? undefined : result.error.message });
  }
  const unknown = await parse('wC', 'replays', smallest, 'Mars/Olympus_Mons');
  verdict('6 time zones', zoneRows.every(z => z.ok) ? 'OK' : 'FAIL', `${zoneRows.filter(z => z.ok).length}/${zoneRows.length} zones give the UTC instant Chromium computes (${zoneRows.map(z => `${z.zone}=${z.got ?? z.error}`).join('; ')})`);
  verdict('6 unknown time zone', !unknown.ok ? 'OK' : 'FAIL', unknown.ok ? 'parsed' : `threw ${JSON.stringify(unknown.error.message)}`);
  report.zones = { zoneRows, unknown: unknown.ok ? 'parsed' : unknown.error };

  const cpuEnd = cpuSnapshot();
  report.machineCpuBusy = 1 - (cpuEnd.idle - cpuStart.idle) / (cpuEnd.total - cpuStart.total);
  report.wallMs = Date.now() - wallStart;
  report.problems = problems;
  report.verdicts = verdicts;
  await browser.close();
  server.close();

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 1));
  const p = report.parse;
  console.log(`\nparse: first ${p.firstMs.toFixed(0)} ms, median ${p.medianMs.toFixed(0)} ms, worst ${p.worstMs.toFixed(0)} ms, total ${(p.totalMs / 1000).toFixed(1)} s for ${p.count}`);
  console.log(`pending JSON: median ${(p.pendingMedianBytes / 1024).toFixed(0)} KB, max ${(p.pendingMaxBytes / 1024).toFixed(0)} KB, total ${mb(p.pendingTotalBytes)} MB`);
  console.log(`complete: AddPending x${files.length} ${report.complete.addMs.toFixed(0)} ms, Complete ${report.complete.completeMs.toFixed(0)} ms, TakeMatch x${files.length} ${report.complete.takeMs.toFixed(0)} ms, result JSON ${(report.complete.completedBytes / 1024).toFixed(0)} KB`);
  console.log(`wasm heap: after parses ${mb(p.heapAfterParses)} MB, after Complete ${mb(report.complete.heapAfterComplete)} MB, after TakeMatch ${mb(report.complete.heapAfterTake)} MB`);
  console.log(`machine CPU busy during the run: ${(report.machineCpuBusy * 100).toFixed(0)}%, wall ${(report.wallMs / 1000).toFixed(0)} s`);
  if (problems.length) console.log(`page problems:\n  ${problems.join('\n  ')}`);
  console.log(`report: ${reportPath}`);
  process.exit(verdicts.some(v => v.status === 'FAIL') ? 1 : 0);
})().catch(error => { console.error(error); process.exit(1); });
