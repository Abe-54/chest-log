import { spawn } from 'node:child_process'
import { appendFile, copyFile, cp, mkdir, mkdtemp, readdir, readFile, rename, rm, stat } from 'node:fs/promises'
import { constants, setPriority, tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compressTree } from '../scripts/compress.mjs'
import { readReplayHeader } from './replay-header.mjs'

const POLL_MS = 2000
/** A live replay untouched this long belongs to a crashed or force-quit game, not a match in progress. */
const ABANDONED_MS = 10 * 60 * 1000

const path = relative => fileURLToPath(new URL(relative, import.meta.url))
const root = path('../../')
const web = path('../')
const places = {
  replays: join(root, 'replays'),
  data: join(root, 'data'),
  headerLog: join(root, 'data', 'debug', 'live-headers.tsv'),
  countLog: join(root, 'data', 'debug', 'quick-vs-full.tsv'),
  extractor: join(root, 'extractor', 'bin', 'Release', 'net10.0', 'Extractor.exe'),
  dotnet: join(root, 'tools', 'dotnet'),
  publicData: join(web, 'public', 'data'),
  distData: join(web, 'dist', 'data'),
}
const dotnetEnv = { ...process.env, DOTNET_ROOT: places.dotnet }

function run(command, args, { priority = constants.priority.PRIORITY_LOW, ...options } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true })
    // Counting runs right after a match, often while the next one loads, so it must not compete with the game.
    try { setPriority(child.pid, priority) } catch {}
    let stderr = ''
    child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-2000) })
    child.on('error', reject)
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${args.at(-1) ?? command} exited ${code}: ${stderr.trim().split('\n').at(-1) ?? ''}`)))
  })
}

async function readJson(file) {
  try { return JSON.parse(await readFile(file, 'utf8')) } catch { return null }
}

const realRows = index => (index?.matches ?? []).filter(row => !row.error && !row.stub)

async function counted() {
  const [week, index] = await Promise.all([readJson(join(places.distData, 'week.json')), readJson(join(places.data, 'index.json'))])
  const newest = realRows(index).at(-1)
  return {
    version: week?.generatedAt ?? null,
    total: week?.total ?? null,
    matches: week?.realMatches ?? null,
    last: newest ? { id: newest.id, chests: newest.ownerChestCount } : null,
  }
}

/**
 * Counts just the new replays, which takes seconds instead of the minute a full rebuild takes. On all 54 archived
 * matches a lone replay gave the same owner chest count as the full run.
 */
async function quickCount(names) {
  const dir = await mkdtemp(join(tmpdir(), 'chest-quick-'))
  try {
    await mkdir(join(dir, 'in'))
    for (const name of names) await copyFile(join(places.replays, name), join(dir, 'in', name))
    await run(places.extractor, [join(dir, 'in'), join(dir, 'out')], { env: dotnetEnv, priority: constants.priority.PRIORITY_BELOW_NORMAL })
    const rows = realRows(await readJson(join(dir, 'out', 'index.json')))
    return {
      chests: rows.reduce((sum, row) => sum + row.ownerChestCount, 0),
      matches: rows.length,
      last: rows.at(-1) ? { id: rows.at(-1).id, chests: rows.at(-1).ownerChestCount } : null,
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/**
 * Watches Fortnite's replay folder. A finished replay is copied into replays/ and counted on its own, which updates
 * the total within seconds. Then the whole set is re-extracted and the app data rebuilt and published to dist/data;
 * re-running over every replay keeps cross-match chest positions consistent and converges on the same output.
 */
export async function createTracker({ demos, onChange }) {
  let state = { phase: 'watching', match: null, error: null, ...(await counted()) }
  const sizes = new Map()
  const logged = new Set()
  let busy = false
  let rebuilding = Promise.resolve()
  const set = patch => {
    const next = { ...state, ...patch }
    if (JSON.stringify(next) === JSON.stringify(state)) return
    state = next
    onChange(state)
  }

  try {
    await stat(demos)
    await mkdir(places.replays, { recursive: true })
  } catch {
    state = { ...state, phase: 'off' }
    return { snapshot: () => state, stop() {} }
  }

  // Recording times of archived matches. Saving a replay in Fortnite gives the same match a new file name,
  // and counting that file would count its chests twice.
  const recorded = new Set()
  for (const name of (await readdir(places.replays)).filter(name => name.endsWith('.replay'))) {
    const header = await readReplayHeader(join(places.replays, name)).catch(() => null)
    if (header?.recordedAt) recorded.add(header.recordedAt)
  }

  async function scan() {
    const archived = new Set(await readdir(places.replays))
    const finished = []
    const claimed = new Set()
    let recording = null
    for (const name of (await readdir(demos)).filter(name => name.endsWith('.replay'))) {
      const file = join(demos, name)
      const [info, header] = await Promise.all([stat(file), readReplayHeader(file).catch(() => null)])
      if (!header) continue
      if (header.live) {
        if (Date.now() - info.mtimeMs > ABANDONED_MS) continue
        const minutes = Math.floor((header.lengthMs || Date.now() - info.birthtimeMs) / 60000)
        if (!recording || info.mtimeMs > recording.at) recording = { id: name.replace(/\.replay$/, ''), minutes, at: info.mtimeMs }
        await logHeader(name, info.size, header)
        continue
      }
      const steady = sizes.get(name) === info.size
      sizes.set(name, info.size)
      if (archived.has(name) || !steady) continue
      if (header.recordedAt && (recorded.has(header.recordedAt) || claimed.has(header.recordedAt))) continue
      if (header.recordedAt) claimed.add(header.recordedAt)
      finished.push(name)
    }
    return { finished, recording }
  }

  /** Records what a live replay header holds, so the encryption question can be settled from a real match. */
  async function logHeader(name, size, header) {
    if (logged.has(name)) return
    logged.add(name)
    await mkdir(join(places.data, 'debug'), { recursive: true })
    await appendFile(places.headerLog, [new Date().toISOString(), name, size, header.lengthMs, header.live, header.encrypted, header.keyLength].join('\t') + '\n')
  }

  async function archive(names) {
    for (const name of names) {
      const target = join(places.replays, name)
      await copyFile(join(demos, name), target + '.part')
      await rename(target + '.part', target)
      const { recordedAt } = await readReplayHeader(target)
      if (recordedAt) recorded.add(recordedAt)
    }
  }

  async function rebuild(names, quick) {
    await run(places.extractor, [places.replays, places.data], { env: dotnetEnv })
    await run(process.execPath, ['--import', 'tsx', 'pipeline/build-data.ts'], { cwd: web })
    await cp(places.publicData, places.distData, { recursive: true, force: true })
    await compressTree(places.distData)
    // Every match logs both counts, so a disagreement between the quick and full runs shows up on real games.
    const files = new Set(names)
    const full = realRows(await readJson(join(places.data, 'index.json'))).filter(row => files.has(row.file))
      .reduce((sum, row) => sum + row.ownerChestCount, 0)
    await mkdir(join(places.data, 'debug'), { recursive: true })
    await appendFile(places.countLog, [new Date().toISOString(), names.join(','), quick ?? '', full].join('\t') + '\n')
    const next = await counted()
    set({ error: null, ...next, ...(state.phase === 'counting' || state.phase === 'error' ? { phase: 'watching' } : {}) })
  }

  async function count(names) {
    set({ phase: 'counting', match: null, error: null })
    await archive(names)
    let quick = null
    try {
      const result = await quickCount(names)
      quick = result.chests
      set({ phase: 'watching', total: (state.total ?? 0) + result.chests, matches: (state.matches ?? 0) + result.matches, last: result.last ?? state.last })
    } catch (error) {
      console.error('quick count', error)
    }
    rebuilding = rebuilding.then(() => rebuild(names, quick)).catch(error => {
      set({ error: error instanceof Error ? error.message : String(error), ...(state.phase === 'counting' ? { phase: 'error' } : {}) })
    })
  }

  async function tick() {
    if (busy) return
    busy = true
    try {
      const { finished, recording } = await scan()
      if (finished.length) return await count(finished)
      if (recording) set({ phase: 'recording', match: { id: recording.id, minutes: recording.minutes } })
      else if (state.phase === 'recording') set({ phase: 'watching', match: null })
    } catch (error) {
      console.error('tracker', error)
      if (state.phase === 'counting') set({ phase: 'error', error: error instanceof Error ? error.message : String(error) })
    } finally {
      busy = false
    }
  }

  const timer = setInterval(tick, POLL_MS)
  void tick()
  return { snapshot: () => state, stop: () => clearInterval(timer) }
}
