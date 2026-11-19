import { Store } from '@tanstack/store'
import type { QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

/** Mirrors the server tracker in live/tracker.mjs. */
export type LiveStatus =
  | { phase: 'off' }
  | {
    phase: 'watching' | 'recording' | 'counting' | 'error'
    match: { id: string; minutes: number } | null
    version: string | null
    total: number | null
    /** Full matches counted, partial recordings left out. */
    matches: number | null
    last: { id: string; chests: number } | null
    error: string | null
  }

/** null until the server answers, and again if it has no live feed (the dev server, an older build). */
export const liveStore = new Store<LiveStatus | null>(null)

/** A counted match the home page has yet to celebrate. It waits there if you were on another page when it landed. */
export interface Celebration { id: string; from: number; to: number; label?: string }
export const celebrationStore = new Store<Celebration | null>(null)
export const celebrated = (id: string) => celebrationStore.setState(current => current?.id === id ? null : current)

const counted = (status: LiveStatus | null) => status && status.phase !== 'off' ? status : null

export function connectLive(queryClient: QueryClient) {
  const source = new EventSource('/api/live')
  source.addEventListener('status', event => {
    const next = JSON.parse(event.data) as LiveStatus
    const before = counted(liveStore.state)
    liveStore.setState(() => next)
    const after = counted(next)
    if (!before || !after) return
    // The total rises seconds after a match, from that replay alone; the rebuilt pages follow with a new version.
    if (before.version && after.version && before.version !== after.version) void queryClient.invalidateQueries()
    const gained = (after.total ?? 0) - (before.total ?? Infinity)
    if (gained <= 0) return
    celebrationStore.setState(() => ({ id: `${after.last?.id}:${after.total}`, from: before.total!, to: after.total! }))
    // The home page plays its own celebration, so the toast is for every other page.
    if (location.pathname !== '/') toast(`+${gained} chests! Match counted.`)
  })
  source.addEventListener('error', () => {
    if (source.readyState === EventSource.CLOSED) liveStore.setState(() => null)
  })
}
