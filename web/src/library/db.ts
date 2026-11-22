import type { Match, Week } from '~/data'

/**
 * A visitor's library lives in their browser's IndexedDB. `replays` caches the slow per-file parse, keyed by the
 * recording time in the replay header, so adding one match never re-parses the rest. `matches` and `kv` hold the
 * dataset the pages read, rebuilt from every cached replay after each import.
 */
export type ReplayRecord =
  | { key: string; name: string; size: number; engine: string; pending: string }
  | { key: string; name: string; size: number; engine: string; error: string }

export interface LibraryMeta { replays: number; failed: { name: string; error: string }[]; builtAt: string }

interface Values {
  week: Week
  meta: LibraryMeta
  folder: FileSystemDirectoryHandle
}

const stores = ['replays', 'matches', 'kv'] as const
type StoreName = (typeof stores)[number]

let opening: Promise<IDBDatabase> | undefined
function open() {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('chest-log', 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('replays', { keyPath: 'key' })
      request.result.createObjectStore('matches', { keyPath: 'id' })
      request.result.createObjectStore('kv')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('could not open browser storage'))
  })
  return opening
}

const done = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

async function store(name: StoreName, mode: IDBTransactionMode = 'readonly') {
  return (await open()).transaction(name, mode).objectStore(name)
}

export const getValue = async <K extends keyof Values>(key: K) => done<Values[K] | undefined>((await store('kv')).get(key))
export const setValue = async <K extends keyof Values>(key: K, value: Values[K]) => { await done((await store('kv', 'readwrite')).put(value, key)) }
export const getMatch = async (id: string) => done<Match | undefined>((await store('matches')).get(id))

export const replayKeys = async () => new Map((await done<ReplayRecord[]>((await store('replays')).getAll())).map(record => [record.key, record.engine]))
export const allReplays = async () => done<ReplayRecord[]>((await store('replays')).getAll())
export const putReplay = async (record: ReplayRecord) => { await done((await store('replays', 'readwrite')).put(record)) }

/** Swaps in a freshly built dataset in one transaction, so a reader never sees half of it. */
export async function writeDataset(dataset: { week: Week; matches: Match[] }, meta: LibraryMeta) {
  const transaction = (await open()).transaction(['matches', 'kv'], 'readwrite')
  const matches = transaction.objectStore('matches')
  const kv = transaction.objectStore('kv')
  matches.clear()
  for (const match of dataset.matches) matches.put(match)
  kv.put(dataset.week, 'week')
  kv.put(meta, 'meta')
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = transaction.onabort = () => reject(transaction.error ?? new Error('could not save the library'))
  })
}

export async function clearLibrary() {
  const transaction = (await open()).transaction(stores, 'readwrite')
  for (const name of stores) transaction.objectStore(name).clear()
  await new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}
