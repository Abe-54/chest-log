import { lazy, Suspense, useCallback, useEffect, useMemo } from 'react'
import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useSelector } from '@tanstack/react-store'
import { ChevronLeft, ChevronRight, Crosshair, Pause, Play, Share2 } from 'lucide-react'
import type { Match, MatchEvent, SquadMember } from '~/data'
import { isMissing, matchQuery, weekQuery } from '~/lib/queries'
import { clock, dateTime, placeLabel, plural } from '~/lib/format'
import { shareLink } from '~/lib/share'
import { cn } from '~/lib/cn'
import { usePlayback, togglePlay, seek, speeds, type PlaybackStore } from '~/features/replay/playback'
import { Scrubber } from '~/features/replay/scrubber'
import { EventLog } from '~/features/replay/event-log'
import { mapFrame } from '~/features/map/frame'
import { chestTimes, defaultTracked, isSquad, lastAtOrBefore, layerInfo, layerKeys, layerOf, squadMembers, type LayerKey, type Member } from '~/features/replay/model'

const ReplayMap = lazy(() => import('~/features/replay/replay-map'))

interface Search { t?: number; all?: boolean; off?: string; follow?: boolean; e?: number; track?: string[] }

export const Route = createFileRoute('/matches/$matchId')({
  validateSearch: (raw: Record<string, unknown>): Search => {
    const number = (value: unknown) => { const n = Number(value); return value !== undefined && value !== '' && Number.isFinite(n) ? n : undefined }
    return {
      t: raw.t === undefined ? undefined : Math.max(0, number(raw.t) ?? 0),
      all: raw.all === true || raw.all === 'true' || raw.all === '1' ? true : undefined,
      off: typeof raw.off === 'string' && raw.off ? raw.off : undefined,
      follow: raw.follow === true || raw.follow === 'true' || raw.follow === '1' ? true : undefined,
      e: number(raw.e),
      track: Array.isArray(raw.track) ? raw.track.filter((name): name is string => typeof name === 'string') : undefined,
    }
  },
  loader: async ({ context, params }) => {
    const match = await context.queryClient.ensureQueryData(matchQuery(params.matchId)).catch((error: unknown) => {
      throw isMissing(error) ? notFound() : error
    })
    return { title: match.zone ?? 'Match' }
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.title ?? 'Match'} · Chest Log` }] }),
  component: function MatchRoute() { return <MatchPage key={Route.useParams().matchId} /> },
  notFoundComponent: () => (
    <main className="mx-auto max-w-xl px-4 py-16">
      <p className="display text-4xl">No such match</p>
      <Link to="/matches" className="mt-4 inline-block text-gold underline-offset-4 hover:underline">Back to matches</Link>
    </main>
  ),
  pendingComponent: () => <div className="mx-auto max-w-7xl px-4 pt-4"><div className={cn(mapFrame, 'animate-pulse bg-ink-2')} /></div>,
})

function MatchPage() {
  const { matchId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: match } = useSuspenseQuery(matchQuery(matchId))
  const { data: week } = useSuspenseQuery(weekQuery)
  const { store, commit } = useReplayController(match, search)

  const hidden = useMemo(() => new Set((search.off ?? '').split(',')), [search.off])
  const visible = useMemo(() => new Set(layerKeys.filter(key => !hidden.has(key))), [hidden])
  const shown = useMemo(() => match.events.filter(event => {
    const layer = layerOf(event)
    return (layer === 'milestone' || visible.has(layer)) && (search.all || isSquad(event) || layer === 'milestone')
  }), [match, visible, search.all])
  const selected = search.e !== undefined ? match.events[search.e] ?? null : null
  const members = useMemo(() => squadMembers(match), [match])
  const colors = useMemo(() => new Map(members.map(member => [member.name, member.color])), [members])
  const tracked = useMemo(() => new Set(search.track ?? defaultTracked(members)), [search.track, members])

  const setSearch = (patch: Partial<Search>) => navigate({ search: previous => ({ ...previous, ...patch }), replace: true, resetScroll: false })
  const choose = useCallback((event: MatchEvent) => {
    store.setState(state => ({ ...state, playing: false, time: event.t }))
    navigate({ search: previous => ({ ...previous, t: event.t, e: match.events.indexOf(event) }), replace: true, resetScroll: false })
  }, [store, navigate, match])
  const toggleLayer = (key: LayerKey) => {
    const next = new Set(hidden)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setSearch({ off: [...next].filter(Boolean).join(',') || undefined })
  }
  const toggleTracked = (name: string) => {
    const next = members.map(member => member.name).filter(other => other === name ? !tracked.has(name) : tracked.has(other))
    const usual = defaultTracked(members)
    setSearch({ track: next.length === usual.length && next.every((other, i) => other === usual[i]) ? undefined : next })
  }


  const index = week.matches.findIndex(row => row.id === match.id)
  const previous = week.matches[index - 1]
  const next = week.matches[index + 1]

  return (
    <main className="mx-auto max-w-7xl px-4 pt-3 lg:pt-6">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link to="/matches" className="text-xs font-semibold tracking-wide text-mist uppercase hover:text-bone">Matches</Link>
          <h1 className="display mt-1 truncate text-[2.1rem] sm:text-5xl">{match.stub ? 'Partial recording' : match.zone ?? 'Unknown drop'}</h1>
          <p className="mt-1 text-sm text-mist">{dateTime(match.startUtc)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 pt-5">
          <NavArrow id={previous?.id} label="Previous match" icon="prev" />
          <NavArrow id={next?.id} label="Next match" icon="next" />
          <button type="button" onClick={() => shareLink(`${match.zone ?? 'Match'} on Chest Log`, linkAt(store.state.time))} aria-label="Share this moment"
            className="press ml-1 grid size-10 place-items-center rounded-full bg-gold text-ink hover:bg-bone"><Share2 className="size-4" strokeWidth={2.5} /></button>
        </div>
      </header>

      <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        <Stat label="Chests" value={String(match.chests)} accent />
        <Stat label="Finish" value={placeLabel(match.placement)} />
        <Stat label="Kills" value={match.kills === null ? '–' : String(match.kills)} />
        <Stat label="On the ground" value={match.landed === null ? '–' : clock(match.end - match.landed)} />
      </dl>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-label="Replay" className="min-w-0">
          <Suspense fallback={<div className={cn(mapFrame, 'bg-ink-2')} role="img" aria-label="Loading the island map" />}>
            <ReplayMap match={match} store={store} visible={visible} events={shown} selected={selected} members={members} tracked={tracked}
              follow={!!search.follow} onRelease={() => setSearch({ follow: undefined })} onChoose={choose} />
          </Suspense>
          <Transport store={store} match={match} follow={!!search.follow} onFollow={() => setSearch({ follow: search.follow ? undefined : true })} />
          <Scrubber store={store} duration={match.duration} events={shown} clips={match.clips} onCommit={commit} colors={colors} />
          <TrackPicker members={members} tracked={tracked} onToggle={toggleTracked} />
          <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" aria-label="Map layers">
            {layerKeys.map(key => {
              const [r, g, b] = layerInfo[key].color
              return (
                <button key={key} type="button" aria-pressed={visible.has(key)} onClick={() => toggleLayer(key)}
                  className="press flex h-9 shrink-0 items-center gap-2 rounded-full border border-line px-3.5 text-sm text-dim aria-pressed:border-transparent aria-pressed:bg-ink-3 aria-pressed:text-bone">
                  <span className="size-2.5 rounded-full" style={{ background: `rgb(${r} ${g} ${b})` }} />{layerInfo[key].label}
                </button>
              )
            })}
          </div>
          <Squad squad={match.squad} members={members} />
        </section>

        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-line/60 bg-ink-2 lg:max-h-[calc(100dvh-8.5rem)] lg:sticky lg:top-20">
          <div className="flex items-center justify-between gap-3 border-b border-line/60 px-3 py-2.5">
            <h2 className="text-sm font-semibold">Event log <span className="num ml-1 text-mist">{shown.length}</span></h2>
            <div className="flex rounded-full bg-ink p-0.5 text-xs font-semibold" role="group" aria-label="Whose events">
              {[{ label: 'Squad', value: undefined }, { label: 'Everyone', value: true }].map(option => (
                <button key={option.label} type="button" aria-pressed={search.all === option.value} onClick={() => setSearch({ all: option.value })}
                  className="press rounded-full px-3 py-1.5 text-mist aria-pressed:bg-ink-3 aria-pressed:text-bone">{option.label}</button>
              ))}
            </div>
          </div>
          {selected && <EventDetail event={selected} onClose={() => setSearch({ e: undefined })} />}
          <EventLog events={shown} store={store} selected={selected} onChoose={choose} colors={colors} className="h-[55vh] lg:h-auto lg:flex-1" />
        </aside>
      </div>
    </main>
  )
}

function NavArrow({ id, label, icon }: { id?: string; label: string; icon: 'prev' | 'next' }) {
  const Icon = icon === 'prev' ? ChevronLeft : ChevronRight
  const style = 'press grid size-10 place-items-center rounded-full border border-line text-mist'
  return id
    ? <Link to="/matches/$matchId" params={{ matchId: id }} aria-label={label} className={cn(style, 'hover:text-bone')}><Icon className="size-4" /></Link>
    : <span aria-hidden className={cn(style, 'opacity-30')}><Icon className="size-4" /></span>
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold tracking-wider text-dim uppercase">{label}</dt>
      <dd className={cn('display num text-3xl', accent && 'text-gold')}>{value}</dd>
    </div>
  )
}

const css = ([r, g, b]: number[]) => `rgb(${r} ${g} ${b})`

function TrackPicker({ members, tracked, onToggle }: { members: Member[]; tracked: Set<string>; onToggle: (name: string) => void }) {
  if (members.length < 2) return null
  return (
    <div className="-mx-4 mt-2 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="group" aria-label="Players to track on the map">
      <span className="shrink-0 text-[11px] font-semibold tracking-wider text-dim uppercase">Track</span>
      {members.map(member => (
        <button key={member.name} type="button" aria-pressed={tracked.has(member.name)} disabled={!member.track} onClick={() => onToggle(member.name)}
          title={member.track ? undefined : 'Your replay has no movement for this player'}
          className="press flex h-9 max-w-52 shrink-0 items-center gap-2 rounded-full border border-line px-3.5 text-sm text-dim aria-pressed:border-transparent aria-pressed:bg-ink-3 aria-pressed:text-bone disabled:opacity-40">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: css(member.color) }} />
          <span className="truncate">{member.name}</span>
          {member.you && <span className="shrink-0 text-[11px] font-semibold tracking-wider text-gold uppercase">You</span>}
        </button>
      ))}
    </div>
  )
}

function Squad({ squad, members }: { squad: SquadMember[]; members: Member[] }) {
  if (squad.length < 2) return null
  const total = squad.reduce((sum, member) => sum + member.chests, 0)
  const most = Math.max(1, ...squad.map(member => member.chests))
  return (
    <section aria-labelledby="squad-chests" className="mt-4 rounded-2xl border border-line/60 bg-ink-2 px-4 pt-3 pb-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="squad-chests" className="text-sm font-semibold">Squad chests</h2>
        <p className="text-sm text-mist">Team total <span className="display num ml-1 text-2xl text-bone">{total}</span></p>
      </div>
      <ol className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {squad.map((member, i) => {
          const color = css(members[i]?.color ?? [160, 173, 184])
          return (
            <li key={member.name} className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 truncate font-semibold">{member.name}</span>
                {member.you && <span className="shrink-0 text-[11px] font-semibold tracking-wider text-gold uppercase">You</span>}
                <span className="display num ml-auto text-2xl" style={{ color }}>{member.chests}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-ink-3">
                <div className="h-full rounded-full" style={{ width: `${(member.chests / most) * 100}%`, background: color }} />
              </div>
            </li>
          )
        })}
      </ol>
      <p className="mt-3 text-xs text-dim">Your replay mostly sees chests opened near you, so squadmates’ counts and the team total run low when you split up.</p>
    </section>
  )
}

function Transport({ store, match, follow, onFollow }: { store: PlaybackStore; match: Match; follow: boolean; onFollow: () => void }) {
  const playing = useSelector(store, state => state.playing)
  const speed = useSelector(store, state => state.speed)
  const second = useSelector(store, state => Math.floor(state.time))
  const times = useMemo(() => Float64Array.from(chestTimes(match)), [match])
  const opened = useSelector(store, state => lastAtOrBefore(times, state.time) + 1)
  return (
    <div className="mt-3 flex items-center gap-3">
      <button type="button" onClick={() => togglePlay(store, match.duration)} aria-label={playing ? 'Pause replay' : 'Play replay'}
        className="press grid size-12 shrink-0 place-items-center rounded-full bg-bone text-ink hover:bg-gold">
        {playing ? <Pause className="size-5" fill="currentColor" /> : <Play className="ml-0.5 size-5" fill="currentColor" />}
      </button>
      <div className="min-w-0">
        <p className="num text-lg leading-tight font-semibold">{clock(second)} <span className="text-sm font-normal text-dim">/ {clock(match.duration)}</span></p>
        <p className="num text-sm text-gold" aria-live="polite">{plural(opened, 'chest')} <span className="text-dim">of {times.length}</span></p>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <button type="button" onClick={onFollow} aria-pressed={follow} aria-label="Follow player"
          className="press grid size-10 place-items-center rounded-full border border-line text-mist aria-pressed:border-gold aria-pressed:text-gold"><Crosshair className="size-4" /></button>
        <button type="button" aria-label={`Playback speed ${speed}x`}
          onClick={() => store.setState(state => ({ ...state, speed: speeds[(speeds.indexOf(state.speed as typeof speeds[number]) + 1) % speeds.length] }))}
          className="press num h-10 min-w-14 rounded-full border border-line px-3 text-sm font-semibold text-mist hover:text-bone">{speed}×</button>
      </div>
    </div>
  )
}

function EventDetail({ event, onClose }: { event: MatchEvent; onClose: () => void }) {
  return (
    <div className="border-b border-line/60 bg-ink-3/50 px-3 py-3" role="region" aria-label="Selected event">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-semibold">{event.label} <span className="num ml-1 text-sm font-normal text-mist">{clock(event.t)}</span></p>
        <button type="button" onClick={onClose} className="text-xs text-mist hover:text-bone">Clear</button>
      </div>
      <p className="text-sm text-mist">{event.detail}{event.confidence && ` · ${event.confidence} confidence`}</p>
      {event.loot && <p className="mt-1 text-sm">{event.loot.length ? event.loot.join(', ') : 'No matched loot'}</p>}
    </div>
  )
}

const tenths = (time: number) => Math.round(time * 10) / 10

function linkAt(time: number) {
  const url = new URL(location.href)
  url.searchParams.set('t', String(tenths(time)))
  return url.href
}

function useReplayController(match: Match, search: Search) {
  const navigate = Route.useNavigate()
  const target = Math.min(match.duration, search.t ?? match.end)
  const store = usePlayback(target, match.duration)
  const commit = useCallback((time: number) => {
    navigate({ search: previous => ({ ...previous, t: tenths(time) }), replace: true, resetScroll: false })
  }, [navigate])
  const toggleFollow = useCallback(() => {
    navigate({ search: previous => ({ ...previous, follow: previous.follow ? undefined : true }), replace: true, resetScroll: false })
  }, [navigate])

  useEffect(() => {
    if (!store.state.scrubbing && Math.abs(tenths(store.state.time) - tenths(target)) > 0.05) seek(store, target, match.duration)
  }, [target, store, match])

  useEffect(() => {
    let wasPlaying = store.state.playing
    const subscription = store.subscribe(() => {
      if (wasPlaying && !store.state.playing) commit(store.state.time)
      wasPlaying = store.state.playing
    })
    return () => subscription.unsubscribe()
  }, [store, commit])

  useReplayKeys(store, match.duration, commit, toggleFollow)
  return { store, commit }
}

function useReplayKeys(store: PlaybackStore, duration: number, commit: (time: number) => void, toggleFollow: () => void) {
  useEffect(() => {
    const step = (seconds: number) => {
      seek(store, store.state.time + seconds, duration)
      commit(store.state.time)
    }
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('input, select, textarea, [role="slider"]')) return
      const onControl = !!target.closest('button, a')
      if (event.code === 'Space' && !onControl) { event.preventDefault(); togglePlay(store, duration) }
      else if (event.key === 'ArrowLeft') { event.preventDefault(); step(-5) }
      else if (event.key === 'ArrowRight') { event.preventDefault(); step(5) }
      else if (event.key.toLowerCase() === 'f') toggleFollow()
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [store, duration, commit, toggleFollow])
}
