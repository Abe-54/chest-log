import { lazy, Suspense, useCallback, useEffect, useMemo } from 'react'
import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useSelector } from '@tanstack/react-store'
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react'
import type { Match, MatchEvent, SquadMember } from '~/data'
import { isMissing, matchQuery, weekQuery } from '~/lib/queries'
import { clock, monthDay, placeLabel, plural, timeOfDay } from '~/lib/format'
import { shareLink } from '~/lib/share'
import { cn } from '~/lib/cn'
import { usePlayback, togglePlay, seek, speeds, type PlaybackStore } from '~/features/replay/playback'
import { Scrubber } from '~/features/replay/scrubber'
import { EventLog } from '~/features/replay/event-log'
import { mapFrame } from '~/features/map/frame'
import { Segmented } from '~/components/charts'
import { chestTimes, defaultTracked, isSquad, lastAtOrBefore, layerInfo, layerKeys, layerOf, squadMembers, type LayerGlyph, type LayerKey, type Member } from '~/features/replay/model'

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
    <main className="page py-16">
      <p className="display text-4xl">No such match</p>
      <Link to="/matches" className="mt-4 inline-block text-gold underline-offset-4 hover:underline">Back to matches</Link>
    </main>
  ),
  pendingComponent: () => <div className="page pt-4 md:pt-14"><div className={cn(mapFrame, 'bg-water motion-safe:animate-pulse')} /></div>,
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
  const counts = useMemo(() => {
    const tally = new Map<LayerKey | 'milestone', number>()
    for (const event of match.events) if (event.kind === 'chest' || event.kind === 'rare_chest') tally.set(layerOf(event), (tally.get(layerOf(event)) ?? 0) + 1)
    return tally
  }, [match])
  const share = (label: string, className: string) => (
    <button type="button" onClick={() => shareLink(`${match.zone ?? 'Match'} on Chest Log`, linkAt(store.state.time))}
      className={cn('press h-11 shrink-0 rounded-pill bg-gold px-5 text-[15px] font-bold text-ink hover:bg-gold-deep', className)}>{label}</button>
  )

  return (
    <main className="page pt-3 md:pt-10">
      <nav aria-label="Match" className="flex items-center gap-2 md:hidden">
        <Link to="/matches" className="mr-auto flex items-center gap-1 text-base font-semibold text-mist hover:text-bone"><ChevronLeft className="size-4" strokeWidth={3} aria-hidden />Matches</Link>
        <NavArrow id={previous?.id} label="Previous match" icon="prev" />
        <NavArrow id={next?.id} label="Next match" icon="next" />
        {share('Share', 'ml-1')}
      </nav>
      <header className="mt-4 flex flex-col gap-5 md:mt-0 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
        <div className="min-w-0">
          <p className="caps text-dim max-md:hidden"><Link to="/matches" className="hover:text-bone">Matches</Link> / {monthDay(match.startUtc)}, {timeOfDay(match.startUtc)}</p>
          <h1 className="display mt-2 truncate text-[44px] leading-[0.95] md:text-display-lg">{match.stub ? 'Partial recording' : match.zone ?? 'Unknown drop'}</h1>
          <p className="mt-1 text-sm text-dim md:hidden">{monthDay(match.startUtc)}, {timeOfDay(match.startUtc)}</p>
        </div>
        <div className="flex items-end gap-8">
          <dl className="grid flex-1 grid-cols-4 gap-x-4 md:flex md:gap-x-10 lg:flex-none">
            <Stat label={week.bestMatchId === match.id ? 'Chests · best' : 'Chests'} short="Chests" value={String(match.chests)} accent />
            <Stat label="Finish" value={placeLabel(match.placement)} />
            <Stat label="Kills" value={match.kills === null ? '–' : String(match.kills)} />
            <Stat label="On the ground" short="On ground" value={match.landed === null ? '–' : clock(match.end - match.landed)} />
          </dl>
          <div className="flex shrink-0 items-center gap-2 max-md:hidden">
            <NavArrow id={previous?.id} label="Previous match" icon="prev" />
            <NavArrow id={next?.id} label="Next match" icon="next" />
            {share('Share moment', 'ml-2')}
          </div>
        </div>
      </header>

      <div className="mt-5 grid gap-6 md:mt-8 lg:grid-cols-[minmax(0,1fr)_388px]">
        <section aria-label="Replay" className="min-w-0">
          <div className="max-md:-mx-4">
            <Suspense fallback={<div className={cn(mapFrame, 'bg-water')} role="img" aria-label="Loading the island map" />}>
              <ReplayMap match={match} store={store} visible={visible} events={shown} selected={selected} members={members} tracked={tracked}
                follow={!!search.follow} onRelease={() => setSearch({ follow: undefined })} onChoose={choose} />
            </Suspense>
          </div>
          <Transport store={store} match={match} follow={!!search.follow} onFollow={() => setSearch({ follow: search.follow ? undefined : true })} />
          <div className="mt-3"><Scrubber store={store} duration={match.duration} events={shown} clips={match.clips} onCommit={commit} storm={visible.has('storm') ? match.storm : []} /></div>
          <div className="no-scrollbar -mx-4 mt-3 flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:scroll-px-0 md:px-0" role="group" aria-label="Map layers">
            {layerKeys.map(key => {
              const on = visible.has(key)
              const count = key === 'mine' || key === 'team' ? counts.get(key) : undefined
              return (
                <button key={key} type="button" aria-pressed={on} onClick={() => toggleLayer(key)} style={on ? { borderColor: css(layerInfo[key].color) } : undefined}
                  className="press flex h-[34px] shrink-0 snap-start items-center gap-2 rounded-pill border border-line px-3 text-sm font-semibold text-mist-2 aria-pressed:bg-ink-3 aria-pressed:font-bold aria-pressed:text-bone">
                  <Glyph shape={layerInfo[key].glyph} color={css(layerInfo[key].color)} />{layerInfo[key].label}{count !== undefined && <span className="num">{count}</span>}
                </button>
              )
            })}
          </div>
          <TrackPicker members={members} tracked={tracked} onToggle={toggleTracked} />
          <Squad squad={match.squad} members={members} />
        </section>

        <aside className="flex min-h-0 flex-col overflow-hidden border-t border-line bg-ink-2 max-lg:-mx-4 max-lg:rounded-t-sheet lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7.5rem)] lg:rounded-panel lg:border">
          <div className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
            <h2 className="display text-[28px] leading-none lg:text-2xl">Event log <span className="num text-dim">{shown.length}</span></h2>
            <Segmented label="Whose events" value={search.all ? 'all' : 'squad'} onChange={value => setSearch({ all: value === 'all' ? true : undefined })}
              options={[{ value: 'squad', label: 'Squad' }, { value: 'all', label: 'Everyone' }]} />
          </div>
          {selected && <EventDetail event={selected} onClose={() => setSearch({ e: undefined })} />}
          <EventLog events={shown} store={store} selected={selected} onChoose={choose} colors={colors} className="h-[264px] lg:h-auto lg:min-h-[480px] lg:flex-1" />
        </aside>
      </div>
    </main>
  )
}

function NavArrow({ id, label, icon }: { id?: string; label: string; icon: 'prev' | 'next' }) {
  const Icon = icon === 'prev' ? ChevronLeft : ChevronRight
  const style = 'press grid size-10 place-items-center rounded-full border border-line text-bone'
  return id
    ? <Link to="/matches/$matchId" params={{ matchId: id }} aria-label={label} className={cn(style, 'hover:border-mist')}><Icon className="size-4" strokeWidth={3} /></Link>
    : <span aria-hidden className={cn(style, 'opacity-30')}><Icon className="size-4" strokeWidth={3} /></span>
}

function Stat({ label, short = label, value, accent }: { label: string; short?: string; value: string; accent?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col-reverse">
      <dt className="caps mt-1 truncate text-[11px] text-dim max-md:tracking-[0.08em]"><span className="md:hidden">{short}</span><span className="max-md:hidden">{label}</span></dt>
      <dd className={cn('display num text-[34px] leading-none normal-case md:text-[44px]', accent && 'text-gold')}>{value}</dd>
    </div>
  )
}

function Glyph({ shape, color }: { shape: LayerGlyph; color: string }) {
  return (
    <span aria-hidden className={cn('size-2.5 shrink-0', shape === 'diamond' ? 'rotate-45 rounded-[2px]' : 'rounded-full', shape === 'ring' && 'border-2')}
      style={shape === 'ring' ? { borderColor: color } : { background: color }} />
  )
}

const css = ([r, g, b]: number[]) => `rgb(${r} ${g} ${b})`

function TrackPicker({ members, tracked, onToggle }: { members: Member[]; tracked: Set<string>; onToggle: (name: string) => void }) {
  if (members.length < 2) return null
  return (
    <div className="no-scrollbar -mx-4 mt-2 flex items-center gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" role="group" aria-label="Players to track on the map">
      <span className="caps shrink-0 text-[11px] text-dim">Track</span>
      {members.map(member => (
        <button key={member.name} type="button" aria-pressed={tracked.has(member.name)} disabled={!member.track} onClick={() => onToggle(member.name)}
          title={member.track ? undefined : 'Your replay has no movement for this player'}
          className="press flex h-[34px] max-w-52 shrink-0 items-center gap-2 rounded-pill border border-line px-3 text-sm font-semibold text-mist-2 aria-pressed:border-line-strong aria-pressed:bg-ink-3 aria-pressed:text-bone disabled:opacity-40">
          <span className="size-2.5 shrink-0 rounded-full" style={{ background: css(member.color) }} />
          <span className="truncate">{member.name}</span>
          {member.you && <span className="caps shrink-0 text-[11px] text-gold">You</span>}
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
    <section aria-labelledby="squad-chests" className="mt-6 rounded-panel border border-line bg-ink-2 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="squad-chests" className="display text-2xl leading-none">Squad chests</h2>
        <p className="text-sm text-mist">Team total <span className="display num ml-1 text-2xl text-bone">{total}</span></p>
      </div>
      <ol className="mt-2 grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {squad.map((member, i) => {
          const color = css(members[i]?.color ?? [160, 173, 184])
          return (
            <li key={member.name} className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 truncate font-semibold">{member.name}</span>
                {member.you && <span className="caps shrink-0 text-[11px] text-gold">You</span>}
                <span className="display num ml-auto text-2xl" style={{ color }}>{member.chests}</span>
              </div>
              <div className="mt-1 h-2 rounded-pill bg-ink-3">
                <div className="h-full rounded-pill" style={{ width: `${(member.chests / most) * 100}%`, background: color }} />
              </div>
            </li>
          )
        })}
      </ol>
      <p className="mt-3 text-[13px] text-dim">Your replay mostly sees chests opened near you, so squadmates’ counts and the team total run low when you split up.</p>
    </section>
  )
}

const speedOptions = speeds.map(speed => ({ value: String(speed), label: `${speed}×` }))

function Transport({ store, match, follow, onFollow }: { store: PlaybackStore; match: Match; follow: boolean; onFollow: () => void }) {
  const playing = useSelector(store, state => state.playing)
  const speed = useSelector(store, state => state.speed)
  const second = useSelector(store, state => Math.floor(state.time))
  const times = useMemo(() => Float64Array.from(chestTimes(match)), [match])
  const opened = useSelector(store, state => lastAtOrBefore(times, state.time) + 1)
  const setSpeed = (next: number) => store.setState(state => ({ ...state, speed: next }))
  return (
    <div className="mt-4 flex items-center gap-3 md:gap-4">
      <button type="button" onClick={() => togglePlay(store, match.duration)} aria-label={playing ? 'Pause replay' : 'Play replay'}
        className="press grid size-11 shrink-0 place-items-center rounded-full bg-gold text-ink hover:bg-gold-deep md:size-[52px]">
        {playing ? <Pause className="size-5" fill="currentColor" strokeWidth={0} /> : <Play className="ml-0.5 size-5" fill="currentColor" strokeWidth={0} />}
      </button>
      <div className="min-w-0">
        <p className="display num text-2xl leading-none font-extrabold md:text-[26px]">{clock(second)} <span className="text-mist-2">/ {clock(match.duration)}</span></p>
        <p className="num mt-1 text-[13px] font-semibold text-gold" aria-live="polite">{plural(opened, 'chest')} <span className="text-dim">of {times.length}</span></p>
      </div>
      <Segmented label="Playback speed" value={String(speed)} onChange={value => setSpeed(Number(value))} options={speedOptions} className="ml-2 max-md:hidden" />
      <button type="button" aria-label={`Playback speed ${speed}x`}
        onClick={() => setSpeed(speeds[(speeds.indexOf(speed as typeof speeds[number]) + 1) % speeds.length])}
        className="press num ml-auto h-10 min-w-12 rounded-button bg-ink-3 px-3 text-[15px] font-bold md:hidden">{speed}×</button>
      <button type="button" onClick={onFollow} aria-pressed={follow}
        className="press flex h-10 shrink-0 items-center gap-2 rounded-pill border-2 border-line px-4 text-[15px] font-semibold text-bone hover:border-mist aria-pressed:border-gold aria-pressed:bg-gold/10 md:ml-auto md:h-11">
        <span aria-hidden className="size-3 rounded-full border-[2.5px] border-gold" /><span>Follow<span className="max-md:hidden"> me</span></span>
      </button>
    </div>
  )
}

function EventDetail({ event, onClose }: { event: MatchEvent; onClose: () => void }) {
  return (
    <div className="border-b border-line-soft bg-ink-3/50 px-5 py-3" role="region" aria-label="Selected event">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-bold">{event.label} <span className="num ml-1 text-sm font-semibold text-dim">{clock(event.t)}</span></p>
        <button type="button" onClick={onClose} className="text-[13px] font-semibold text-mist hover:text-bone">Clear</button>
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
      else if (event.key === 'ArrowLeft') { event.preventDefault(); step(event.shiftKey ? -30 : -5) }
      else if (event.key === 'ArrowRight') { event.preventDefault(); step(event.shiftKey ? 30 : 5) }
      else if (event.key.toLowerCase() === 'f') toggleFollow()
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [store, duration, commit, toggleFollow])
}
