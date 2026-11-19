import { queryOptions } from '@tanstack/react-query'
import type { Clips, Island, Match, Planner, Week } from '~/data'
import { getMatch, getValue } from '~/library/db'

/**
 * Where the pages get their data. The local build reads files this PC's server builds from its own replays.
 * The hosted build has no server data: each visitor's replays are parsed in their browser and kept there.
 */
export const hosted = import.meta.env.VITE_HOSTED === '1'

export class HttpError extends Error {
  constructor(readonly path: string, readonly status: number) {
    super(`${path} returned ${status}`)
  }
}

export const isMissing = (error: unknown) => error instanceof HttpError && error.status === 404
export const retryUnlessClientError = (failures: number, error: unknown) =>
  failures < 2 && !(error instanceof HttpError && error.status >= 400 && error.status < 500)

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path)
  if (!response.ok) throw new HttpError(path, response.status)
  return response.json() as Promise<T>
}

async function stored<T>(name: string, read: Promise<T | undefined>): Promise<T> {
  const value = await read
  if (value === undefined) throw new HttpError(name, 404)
  return value
}

const source = <T>(name: string, local: () => Promise<T | undefined>) =>
  hosted ? () => stored(name, local()) : () => getJson<T>(`/data/${name}.json`)

const forever = { staleTime: Infinity, gcTime: 30 * 60 * 1000 }
export const weekQuery = queryOptions({ queryKey: ['week'], queryFn: source<Week>('week', () => getValue('week')), ...forever })
export const plannerQuery = queryOptions({ queryKey: ['planner'], queryFn: source<Planner>('planner', () => getValue('planner')), ...forever })
export const islandQuery = queryOptions({ queryKey: ['island'], queryFn: source<Island>('island', () => getValue('island')), ...forever })
// Clips are videos recorded on the PC that runs the local build; a hosted library has none.
export const clipsQuery = queryOptions({ queryKey: ['clips'], queryFn: source<Clips>('clips', async () => ({ tolerance: 0, clips: [] })), ...forever })
export const matchQuery = (id: string) => queryOptions({
  queryKey: ['match', id],
  queryFn: source<Match>(`matches/${encodeURIComponent(id)}`, () => getMatch(id)),
  ...forever,
})
