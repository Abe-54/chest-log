import { Store } from '@tanstack/store'
import { allReplays } from './db'
import { filesIn, importReplays, rememberedFolder, type ImportOutcome } from './import'
import { unseenReplays } from './unseen'

/** How often a watched folder is read again. */
export const CHECK_EVERY_MS = 30_000

/**
 * Chromium keeps a folder handle between visits, so the Demos folder can be read again while the tab is open.
 * `paused` is a remembered folder that is not being read: stopped by the visitor, or waiting for the browser to
 * grant read access again, which takes a click.
 */
export type WatchState =
  | { phase: 'off' }
  | { phase: 'paused'; folder: string; reason: string | null }
  | { phase: 'watching'; folder: string; checkedAt: number | null; session: SessionImport[] }

/** One check that added matches while watching, newest first in the session list. */
export interface SessionImport { at: number; added: number; gained: number }

export const watchStore = new Store<WatchState>({ phase: 'off' })
const set = (state: WatchState) => watchStore.setState(() => state)

const knownReplays = async () => new Set((await allReplays()).map(record => `${record.name}:${record.size}`))

let current: FileSystemDirectoryHandle | undefined
let timer: ReturnType<typeof setInterval> | undefined
let checking: Promise<void> | undefined
// Bumped whenever watching stops, so a check already in flight drops what it found instead of saving it.
let generation = 0
let onImported: (outcome: ImportOutcome) => void = () => undefined

/** Called after a check adds replays to the library, so the pages can read it again. */
export const whenImported = (handler: (outcome: ImportOutcome) => void) => { onImported = handler }

function pause(reason: string | null = null) {
  generation++
  clearInterval(timer)
  timer = undefined
  if (current) set({ phase: 'paused', folder: current.name, reason })
}

function check() {
  if (!current || checking) return checking
  checking = read(current, generation).finally(() => { checking = undefined })
  return checking
}

async function read(folder: FileSystemDirectoryHandle, started: number) {
  const stale = () => started !== generation
  try {
    if (await folder.queryPermission({ mode: 'read' }) !== 'granted') return pause()
    const fresh = await unseenReplays(await filesIn(folder), await knownReplays())
    if (stale()) return
    const outcome = fresh.length > 0 ? await importReplays(fresh) : undefined
    if (stale()) return
    const state = watchStore.state
    if (state.phase === 'watching') {
      const gained = outcome && { at: Date.now(), added: outcome.added, gained: outcome.total - (outcome.before ?? 0) }
      set({ ...state, checkedAt: Date.now(), session: gained && gained.added > 0 ? [gained, ...state.session] : state.session })
    }
    if (outcome) onImported(outcome)
  } catch {
    if (!stale()) pause('The folder could not be read. Choose it again.')
  }
}

/** Reads the folder now and again every 30 seconds until stopped. */
export function startWatching(folder: FileSystemDirectoryHandle) {
  generation++
  clearInterval(timer)
  current = folder
  set({ phase: 'watching', folder: folder.name, checkedAt: null, session: [] })
  void check()
  timer = setInterval(() => void check(), CHECK_EVERY_MS)
}

export const stopWatching = () => pause()

/** Stops watching for good and waits out a check in flight, so deleting the library cannot be undone by it. */
export async function forgetWatching() {
  generation++
  clearInterval(timer)
  timer = undefined
  current = undefined
  set({ phase: 'off' })
  await checking
}

/** Must be called from a click: the browser may ask the visitor to allow reading the remembered folder again. */
export async function resumeWatching() {
  if (!current) return
  if (await current.requestPermission({ mode: 'read' }) === 'granted') startWatching(current)
}

/** On page load: picks the remembered folder back up, watching it at once when the browser still allows reading it. */
export async function restoreWatching() {
  try {
    const folder = await rememberedFolder()
    if (!folder) return
    current = folder
    if (await folder.queryPermission({ mode: 'read' }) === 'granted') startWatching(folder)
    else pause()
  } catch {
    // The remembered folder is gone or the browser will not say; Auto-track offers to choose it again.
  }
}
