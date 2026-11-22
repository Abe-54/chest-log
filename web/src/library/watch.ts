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
  | { phase: 'watching'; folder: string; checkedAt: number | null; found: number }

export const watchStore = new Store<WatchState>({ phase: 'off' })
const set = (state: WatchState) => watchStore.setState(() => state)

const knownReplays = async () => new Set((await allReplays()).map(record => `${record.name}:${record.size}`))

let current: FileSystemDirectoryHandle | undefined
let timer: ReturnType<typeof setInterval> | undefined
let checking = false
let onImported: (outcome: ImportOutcome) => void = () => undefined

/** Called after a check adds replays to the library, so the pages can read it again. */
export const whenImported = (handler: (outcome: ImportOutcome) => void) => { onImported = handler }

function pause(reason: string | null = null) {
  clearInterval(timer)
  timer = undefined
  if (current) set({ phase: 'paused', folder: current.name, reason })
}

async function check() {
  if (!current || checking) return
  checking = true
  try {
    if (await current.queryPermission({ mode: 'read' }) !== 'granted') return pause()
    const fresh = await unseenReplays(await filesIn(current), await knownReplays())
    const outcome = fresh.length > 0 ? await importReplays(fresh) : undefined
    const state = watchStore.state
    if (state.phase === 'watching') set({ ...state, checkedAt: Date.now(), found: state.found + (outcome?.added ?? 0) })
    if (outcome) onImported(outcome)
  } catch {
    pause('The folder could not be read. Choose it again.')
  } finally {
    checking = false
  }
}

/** Reads the folder now and again every 30 seconds until stopped. */
export function startWatching(folder: FileSystemDirectoryHandle) {
  clearInterval(timer)
  current = folder
  set({ phase: 'watching', folder: folder.name, checkedAt: null, found: 0 })
  void check()
  timer = setInterval(() => void check(), CHECK_EVERY_MS)
}

export const stopWatching = () => pause()

/** The library was deleted, and the remembered folder with it. */
export function forgetWatching() {
  clearInterval(timer)
  timer = undefined
  current = undefined
  set({ phase: 'off' })
}

/** Must be called from a click: the browser may ask the visitor to allow reading the remembered folder again. */
export async function resumeWatching() {
  if (!current) return
  if (await current.requestPermission({ mode: 'read' }) === 'granted') startWatching(current)
}

/** On page load: picks the remembered folder back up, watching it at once when the browser still allows reading it. */
export async function restoreWatching() {
  const folder = await rememberedFolder()
  if (!folder) return
  current = folder
  if (await folder.queryPermission({ mode: 'read' }) === 'granted') startWatching(folder)
  else pause()
}
