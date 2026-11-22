/// <reference lib="webworker" />
import type { ReplayIndex, ReplayMatch } from '../../../data/types'
import type { Calibration } from '../../pipeline/domain/model'
import { buildDataset } from '../../pipeline/dataset'
import { HEADER_BYTES, parseHeader } from '../../live/parse-header.mjs'
import calibration from '../../../map/calibration.json'
import { allReplays, putReplay, replayKeys, writeDataset, type LibraryMeta, type ReplayRecord } from './db'

/** The replay extractor compiled to WebAssembly. Built from extractor/wasm; see its exports for the contract. */
interface Engine {
  EngineVersion(): string
  Parse(bytes: Uint8Array, fileName: string, timeZone: string): string
  Reset(): void
  AddPending(pending: string): void
  Complete(failures: string): string
  TakeMatch(id: string): string
}

export type Job =
  | { type: 'parse'; files: File[]; timeZone: string }
  | { type: 'build'; timeZone: string }

export type Report =
  | { type: 'ready' }
  | { type: 'file'; name: string; outcome: 'parsed' | 'known' | 'failed' | 'unfinished' }
  | { type: 'parsed' }
  | { type: 'built'; meta: LibraryMeta; total: number }
  | { type: 'error'; message: string }

const scope = self as unknown as DedicatedWorkerGlobalScope
const report = (message: Report) => scope.postMessage(message)

// The bootstrap in import.ts imports the engine statically and leaves its loader here.
const engine = () => (scope as unknown as { loadEngine(): Promise<Engine> }).loadEngine()

const idOf = (name: string) => name.replace(/\.replay$/i, '')
const reason = (error: unknown) => error instanceof Error ? error.message : String(error)

// A cached parse is reused only by the same engine build and for the same time zone, which sets match start times.
const cacheVersion = (exports: Engine, timeZone: string) => `${exports.EngineVersion()}|${timeZone}`

async function parse(files: File[], timeZone: string) {
  const exports = await engine()
  const version = cacheVersion(exports, timeZone)
  const known = await replayKeys()
  for (const file of files) {
    let key = `${file.name}:${file.size}`
    try {
      const header = parseHeader(new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer()))
      // Fortnite is still writing this one; it parses once the match is over.
      if (header.live) { report({ type: 'file', name: file.name, outcome: 'unfinished' }); continue }
      if (header.recordedAt) key = header.recordedAt
      if (known.get(key) === version) { report({ type: 'file', name: file.name, outcome: 'known' }); continue }
      const pending = exports.Parse(new Uint8Array(await file.arrayBuffer()), file.name, timeZone)
      await putReplay({ key, name: file.name, size: file.size, engine: version, pending })
      report({ type: 'file', name: file.name, outcome: 'parsed' })
    } catch (error) {
      await putReplay({ key, name: file.name, size: file.size, engine: version, error: reason(error) })
      report({ type: 'file', name: file.name, outcome: 'failed' })
    }
    known.set(key, version)
  }
  report({ type: 'parsed' })
}

async function build(timeZone: string) {
  const exports = await engine()
  const version = cacheVersion(exports, timeZone)
  // A replay parsed by an older engine stays out until its file is picked again.
  const records = (await allReplays()).filter(record => record.engine === version)
  const failed = records.filter((record): record is Extract<ReplayRecord, { error: string }> => 'error' in record)
  exports.Reset()
  for (const record of records) if ('pending' in record) exports.AddPending(record.pending)
  const { index } = JSON.parse(exports.Complete(JSON.stringify(
    failed.map(record => ({ id: idOf(record.name), file: record.name, error: record.error })),
  ))) as { index: ReplayIndex }
  if (!index.matches.some(row => !row.error && !row.stub)) throw new Error('None of those files held a finished match.')
  const replays = index.matches.filter(row => !row.error).map(row => JSON.parse(exports.TakeMatch(row.id)) as ReplayMatch)
  const builtAt = new Date().toISOString()
  const dataset = buildDataset({ index, calibration: calibration as Calibration, replays, generatedAt: builtAt })
  const meta: LibraryMeta = { replays: replays.length, failed: failed.map(record => ({ name: record.name, error: record.error })), builtAt }
  await writeDataset(dataset, meta)
  report({ type: 'built', meta, total: dataset.week.total })
}

scope.onmessage = ({ data }: MessageEvent<Job>) => {
  (data.type === 'parse' ? parse(data.files, data.timeZone) : build(data.timeZone))
    .catch(error => report({ type: 'error', message: reason(error) }))
}
report({ type: 'ready' })
