import { Store } from '@tanstack/store'
import { base } from '~/lib/mode'
import { clearLibrary, getValue, type LibraryMeta } from './db'
import type { Job, Report } from './worker'
import workerUrl from './worker.ts?worker&url'

/** The import running now, from picked files to a rebuilt library. */
export type ImportState =
  | { phase: 'idle' }
  | { phase: 'parsing'; total: number; done: number; added: number; failed: number; current: string | null }
  | { phase: 'building'; total: number; added: number; failed: number }
  | { phase: 'error'; message: string }

/** What a finished import changed. `before` is the chest total ahead of it, null for a first import. */
export interface ImportOutcome { added: number; skipped: number; meta: LibraryMeta; before: number | null; total: number }

export const importStore = new Store<ImportState>({ phase: 'idle' })
const set = (state: ImportState) => importStore.setState(() => state)

/** The parser's memory only grows, so a big folder is split across fresh workers. */
const FILES_PER_WORKER = 20
const isReplay = (file: { name: string }) => /\.replay$/i.test(file.name)

/**
 * .NET's browser runtime starts in a worker only when it is imported statically; through a dynamic import it never
 * finishes loading. The bundled worker cannot import a file from /engine statically, so this small module does it
 * and then loads the bundled worker.
 */
function workerScript() {
  const engine = new URL(`${base}engine/engine.js`, location.href).href
  const worker = new URL(workerUrl, location.href).href
  const source = `import { loadEngine } from ${JSON.stringify(engine)}; self.loadEngine = loadEngine; await import(${JSON.stringify(worker)})`
  return URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
}

function run(job: Job, onReport: (report: Report) => void) {
  return new Promise<Extract<Report, { type: 'parsed' | 'built' }>>((resolve, reject) => {
    const script = workerScript()
    const worker = new Worker(script, { type: 'module' })
    const finish = (settle: () => void) => { worker.terminate(); URL.revokeObjectURL(script); settle() }
    worker.onerror = event => finish(() => reject(new Error(event.message || 'the replay reader could not start')))
    worker.onmessage = ({ data }: MessageEvent<Report>) => {
      if (data.type === 'ready') worker.postMessage(job)
      else if (data.type === 'error') finish(() => reject(new Error(data.message)))
      else if (data.type === 'parsed' || data.type === 'built') finish(() => resolve(data))
      else onReport(data)
    }
  })
}

/** Reads the picked files in this browser and rebuilds the library. Files already read are skipped. */
export async function importReplays(picked: File[]): Promise<ImportOutcome | undefined> {
  if (importStore.state.phase === 'parsing' || importStore.state.phase === 'building') return
  const files = picked.filter(isReplay).sort((a, b) => a.name.localeCompare(b.name))
  if (files.length === 0) {
    set({ phase: 'error', message: 'No .replay files in there. Fortnite keeps them in the Demos folder.' })
    return
  }
  try {
    const before = (await getValue('week'))?.total ?? null
    const progress = { phase: 'parsing' as const, total: files.length, done: 0, added: 0, failed: 0, current: null as string | null }
    let skipped = 0
    set({ ...progress })
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    for (let at = 0; at < files.length; at += FILES_PER_WORKER) {
      await run({ type: 'parse', files: files.slice(at, at + FILES_PER_WORKER), timeZone }, report => {
        if (report.type !== 'file') return
        progress.done++
        progress.current = report.name
        if (report.outcome === 'parsed') progress.added++
        else if (report.outcome === 'failed') progress.failed++
        else skipped++
        set({ ...progress })
      })
    }
    set({ phase: 'building', total: files.length, added: progress.added, failed: progress.failed })
    const built = await run({ type: 'build', timeZone }, () => undefined)
    if (built.type !== 'built') throw new Error('the library was not rebuilt')
    set({ phase: 'idle' })
    return { added: progress.added, skipped, meta: built.meta, before, total: built.total }
  } catch (error) {
    set({ phase: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}

/** Files and folders dropped on the page. */
export async function droppedFiles(items: DataTransferItemList) {
  const entries = [...items].map(item => item.webkitGetAsEntry()).filter(entry => entry !== null)
  const files: File[] = []
  const read = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      files.push(await new Promise<File>((resolve, reject) => (entry as FileSystemFileEntry).file(resolve, reject)))
      return
    }
    const reader = (entry as FileSystemDirectoryEntry).createReader()
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject))
      if (batch.length === 0) return
      for (const child of batch) if (child.isFile) await read(child)
    }
  }
  for (const entry of entries) await read(entry)
  return files
}

export async function forgetLibrary() {
  await clearLibrary()
  set({ phase: 'idle' })
}
