import { Store } from '@tanstack/store'
import { allReplays } from './db'
import { importReplays, type ImportOutcome } from './import'
import { unseenReplays } from './unseen'

/**
 * Chest Log Companion is a small Windows program that serves the Demos folder's replays to this site on 127.0.0.1.
 * Browsers will not let a website keep access to AppData, where Fortnite saves them, so the companion reads the folder
 * and the site keeps doing the parsing. Its source lives in companion/ at the repository root.
 */
export const COMPANION_URL = 'http://127.0.0.1:47811'
export const CHECK_EVERY_MS = 30_000

interface Status { app: 'chest-log-companion'; version: string; folder: string; folderExists: boolean; replays: number }
interface Listed { name: string; size: number; modified: string }

/** One check that added matches, newest first. */
export interface SessionImport { at: number; added: number; gained: number }

/**
 * `idle` has never been connected in this browser, so nothing is probed: calling 127.0.0.1 makes Chrome ask the visitor
 * for local network access, and that prompt should only follow a click on Connect.
 */
export type CompanionState =
  | { phase: 'idle' }
  | { phase: 'connecting' }
  | { phase: 'absent' }
  | { phase: 'blocked' }
  | { phase: 'no-folder'; version: string; folder: string }
  | { phase: 'connected'; version: string; replays: number; checkedAt: number | null; session: SessionImport[] }

export const companionStore = new Store<CompanionState>({ phase: 'idle' })
const set = (state: CompanionState) => companionStore.setState(() => state)

const REMEMBER = 'chest-log:companion'
const remembered = () => { try { return localStorage.getItem(REMEMBER) === '1' } catch { return false } }
const remember = (on: boolean) => { try { if (on) localStorage.setItem(REMEMBER, '1'); else localStorage.removeItem(REMEMBER) } catch { /* private mode */ } }

/** Chrome 142 and later gate 127.0.0.1 behind a permission; other browsers do not know the name and throw. */
async function permission(): Promise<PermissionState | null> {
  try { return (await navigator.permissions.query({ name: 'local-network-access' as PermissionName })).state } catch { return null }
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(COMPANION_URL + path, { signal: AbortSignal.timeout(4000), cache: 'no-store' })
  if (!response.ok) throw new Error(`${path} answered ${response.status}`)
  return response.json() as Promise<T>
}

function isStatus(value: unknown): value is Status {
  return typeof value === 'object' && value !== null && (value as Status).app === 'chest-log-companion' && typeof (value as Status).version === 'string'
}

async function download(entry: Listed) {
  const response = await fetch(`${COMPANION_URL}/v1/replays/${encodeURIComponent(entry.name)}`, { cache: 'no-store' })
  if (!response.ok) throw new Error(`${entry.name} answered ${response.status}`)
  return new File([await response.blob()], entry.name, { lastModified: Date.parse(entry.modified) || Date.now() })
}

let timer: ReturnType<typeof setInterval> | undefined
let checking: Promise<void> | undefined
// Bumped whenever the connection stops, so a check already in flight drops what it found instead of saving it.
let generation = 0
let onImported: (outcome: ImportOutcome) => void = () => undefined

/** Called after a check adds replays to the library, so the pages can read it again. */
export const whenImported = (handler: (outcome: ImportOutcome) => void) => { onImported = handler }

function stop(next: CompanionState) {
  generation++
  clearInterval(timer)
  timer = undefined
  set(next)
}

async function unreachable() {
  if (await permission() === 'denied') return stop({ phase: 'blocked' })
  stop({ phase: 'absent' })
}

/**
 * Only the files the library has not read come over: the listing carries each file's size, so a replay already counted
 * is skipped without downloading it, and one Fortnite is still writing is left for a later check.
 */
async function check(started: number) {
  const stale = () => started !== generation
  let status: unknown
  try {
    status = await get('/v1/status')
  } catch {
    if (!stale()) await unreachable()
    return
  }
  if (stale()) return
  if (!isStatus(status)) return stop({ phase: 'absent' })
  if (!status.folderExists) return set({ phase: 'no-folder', version: status.version, folder: status.folder })
  try {
    const { replays } = await get<{ replays: Listed[] }>('/v1/replays')
    const known = new Set((await allReplays()).map(record => `${record.name}:${record.size}`))
    const files = await Promise.all(replays.filter(entry => !known.has(`${entry.name}:${entry.size}`)).map(download))
    const fresh = await unseenReplays(files, known)
    if (stale()) return
    const outcome = fresh.length > 0 ? await importReplays(fresh) : undefined
    if (stale()) return
    const state = companionStore.state
    const session = state.phase === 'connected' ? state.session : []
    const gained = outcome && outcome.added > 0 ? [{ at: Date.now(), added: outcome.added, gained: outcome.total - (outcome.before ?? 0) }] : []
    set({ phase: 'connected', version: status.version, replays: replays.length, checkedAt: Date.now(), session: [...gained, ...session] })
    if (outcome) onImported(outcome)
  } catch {
    if (!stale()) await unreachable()
  }
}

function tick() {
  if (checking) return checking
  const started = generation
  checking = check(started).finally(() => { checking = undefined })
  return checking
}

/** From the Connect button: this is the call that lets Chrome show its permission prompt. */
export async function connectCompanion() {
  generation++
  clearInterval(timer)
  set({ phase: 'connecting' })
  remember(true)
  await tick()
  // An absent companion is checked again too, so starting it later connects without another click.
  if (companionStore.state.phase !== 'blocked') timer = setInterval(() => void tick(), CHECK_EVERY_MS)
}

/** On page load: reconnects only in a browser that connected before and did not disconnect since. */
export async function restoreCompanion() {
  if (remembered()) await connectCompanion()
}

/** Stops checking and forgets this browser was connected, so the next visit does not reach for 127.0.0.1. */
export async function disconnectCompanion() {
  remember(false)
  stop({ phase: 'idle' })
  await checking
}
