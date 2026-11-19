import { lazy, Suspense, useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { ArrowRight, Share2 } from 'lucide-react'
import type { Planner, RouteWindow, Suggestion } from '~/data'
import { islandQuery, plannerQuery } from '~/lib/queries'
import { clock, decimal, plural } from '~/lib/format'
import { shareLink } from '~/lib/share'
import { cn } from '~/lib/cn'
import type { Extra } from '~/features/routes/route-map'
import { mapFrame } from '~/features/map/frame'

const extras: Extra[] = ['heat', 'sites', 'landings', 'trails']
const RouteMap = lazy(() => import('~/features/routes/route-map'))
const extraLabels: Record<Extra, string> = { heat: 'Where you opened', sites: 'Known chest spots', landings: 'Your landings', trails: 'Every trail' }
interface Search { drop?: string; budget?: number; view?: 'best'; show?: string; stop?: string }

export const Route = createFileRoute('/routes')({
  validateSearch: (raw: Record<string, unknown>): Search => ({
    drop: typeof raw.drop === 'string' ? raw.drop : undefined,
    budget: [1, 2].includes(Number(raw.budget)) ? Number(raw.budget) : undefined,
    view: raw.view === 'best' ? 'best' : undefined,
    show: typeof raw.show === 'string' ? raw.show : undefined,
    stop: typeof raw.stop === 'string' && raw.stop ? raw.stop : undefined,
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(plannerQuery),
  head: () => ({ meta: [{ title: 'Chest routes · Chest Log' }] }),
  component: RoutesPage,
  pendingComponent: () => <div className="mx-auto max-w-7xl px-4 pt-8"><div className="h-[60vh] animate-pulse rounded-2xl bg-ink-2" /></div>,
})

function ranked(planner: Planner, budget: number) {
  return planner.drops.toSorted((a, b) =>
    Number(a.lowSample) - Number(b.lowSample) || (b.windows[budget].average ?? -1) - (a.windows[budget].average ?? -1))
}

function RoutesPage() {
  const { data: planner } = useSuspenseQuery(plannerQuery)
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const budget = search.budget ?? 0
  const show = useMemo(() => new Set((search.show ?? 'heat').split(',').filter(Boolean) as Extra[]), [search.show])
  const { data: island } = useQuery({ ...islandQuery, enabled: show.size > 0 })
  const order = useMemo(() => ranked(planner, budget), [planner, budget])
  const recommended = order.find(drop => !drop.lowSample) ?? order[0]
  const hotspot = planner.hotspot
  const drop = (search.drop === hotspot?.drop.id ? hotspot?.drop : planner.drops.find(d => d.id === search.drop)) ?? recommended
  const window = drop.windows[budget]
  const view = search.view === 'best' && window.best ? 'best' : 'plan'
  const minutes = planner.budgets[budget] / 60
  const set = (patch: Partial<Search>) => navigate({ search: previous => ({ ...previous, stop: undefined, ...patch }), replace: true, resetScroll: false })
  const chooseStop = (id: string) => set({ stop: search.stop === id ? undefined : id })

  const toggle = (extra: Extra) => {
    const next = new Set(show)
    if (next.has(extra)) next.delete(extra)
    else next.add(extra)
    set({ show: [...next].join(',') === 'heat' ? undefined : [...next].join(',') || '', stop: search.stop })
  }

  return (
    <main className="mx-auto max-w-7xl px-4 pt-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="display text-5xl sm:text-6xl">Chest routes</h1>
          <p className="mt-2 max-w-xl text-mist">Pick a drop and a time budget. See the route that should open the most chests, or the best run you actually had there.</p>
        </div>
        <button type="button" onClick={() => shareLink(`${drop.name} chest route`)} aria-label="Share this route"
          className="press mt-2 grid size-10 shrink-0 place-items-center rounded-full bg-gold text-ink hover:bg-bone"><Share2 className="size-4" strokeWidth={2.5} /></button>
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Pick label={`Best measured drop at ${minutes} min`} name={recommended.name} active={drop.id === recommended.id}
          detail={`${decimal(recommended.windows[budget].average)} chests on average over ${plural(recommended.landings, 'landing')}`}
          onPick={() => set({ drop: undefined, view: undefined })} />
        {hotspot && <Pick label="Densest chest area" name={hotspot.drop.name} active={drop.id === hotspot.drop.id}
          detail={`${hotspot.count} known chest spots in one circle`} onPick={() => set({ drop: hotspot.drop.id, view: undefined })} />}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section aria-label="Route map" className="min-w-0">
          <Suspense fallback={<div className={cn(mapFrame, 'bg-ink-2')} role="img" aria-label="Loading the island map" />}>
            <RouteMap island={island} show={show} view={view} window={window} hotspot={hotspot} drop={drop}
              stopId={search.stop} onStop={chooseStop} />
          </Suspense>
          <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" aria-label="Map layers">
            {extras.map(extra => (
              <button key={extra} type="button" aria-pressed={show.has(extra)} onClick={() => toggle(extra)}
                className="press h-9 shrink-0 rounded-full border border-line px-3.5 text-sm text-dim aria-pressed:border-transparent aria-pressed:bg-ink-3 aria-pressed:text-bone">
                {extraLabels[extra]}
              </button>
            ))}
          </div>
        </section>

        <aside className="rounded-2xl border border-line/60 bg-ink-2 p-4">
          <p className="text-xs font-semibold tracking-wider text-dim uppercase">{drop.id === hotspot?.drop.id ? 'Chest hotspot' : drop.lowSample ? 'Few landings' : 'Drop'}</p>
          <h2 className="display mt-1 text-4xl">{drop.name}</h2>
          {drop.landings > 0 && <p className="text-sm text-mist">{plural(drop.landings, 'landing')} this week{drop.placement !== null && ` · avg finish #${Math.round(drop.placement)}`}</p>}

          <Segmented label="Time budget" value={budget} onChange={value => set({ budget: value || undefined })}
            options={planner.budgets.map((seconds, i) => ({ value: i, label: `${seconds / 60} min` }))} />
          <Segmented label="Show" value={view} onChange={value => set({ view: value === 'best' ? 'best' : undefined })}
            options={[{ value: 'plan', label: 'Suggested route' }, { value: 'best', label: 'Your best run', disabled: !window.best }]} />

          {view === 'plan' && window.suggested && <SuggestedDetails suggestion={window.suggested} window={window} planner={planner} minutes={minutes} stopId={search.stop} onStop={chooseStop} />}
          {view === 'plan' && !window.suggested && <p className="mt-5 text-sm text-mist">No route fits this budget from here.</p>}
          {view === 'best' && window.best && <BestRunDetails best={window.best} minutes={minutes} />}
        </aside>
      </div>

      <section className="mt-12">
        <h2 className="display text-3xl">Every drop, ranked</h2>
        <p className="mt-1 text-sm text-mist">Average chests in the first {minutes} min after landing. Drops with fewer than {planner.minimumLandings} landings sit at the bottom.</p>
        <ol className="mt-4 divide-y divide-line/60">
          {order.map((item, i) => (
            <li key={item.id}>
              <button type="button" onClick={() => { set({ drop: item.id === recommended.id ? undefined : item.id, view: undefined }); scrollTo({ top: 0, behavior: 'smooth' }) }}
                className={cn('press flex w-full items-center gap-4 px-1 py-3 text-left hover:bg-ink-2', item.id === drop.id && 'bg-ink-2')}>
                <span className="num w-6 shrink-0 text-sm text-dim">{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{item.name}</span>
                  <span className="block text-xs text-mist">{plural(item.landings, 'landing')}{item.lowSample && ' · few landings'}{item.pace !== null && ` · ${decimal(item.pace, 2)}/min alive`}</span>
                </span>
                <span className="display num text-3xl text-gold">{decimal(item.windows[budget].average)}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </main>
  )
}

function Pick({ label, name, detail, active, onPick }: { label: string; name: string; detail: string; active: boolean; onPick: () => void }) {
  return (
    <button type="button" onClick={onPick} aria-pressed={active}
      className="press rounded-2xl border border-line/60 p-4 text-left hover:border-mist aria-pressed:border-gold aria-pressed:bg-gold/8">
      <span className="block text-xs font-semibold tracking-wider text-mist uppercase">{label}</span>
      <span className="display mt-1 block text-3xl">{name}</span>
      <span className="mt-1 block text-sm text-mist">{detail}</span>
    </button>
  )
}

function Segmented<T extends string | number>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string; disabled?: boolean }[]; onChange: (value: T) => void
}) {
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-xs text-mist">{label}</p>
      <div className="flex rounded-full bg-ink p-1" role="group" aria-label={label}>
        {options.map(option => (
          <button key={String(option.value)} type="button" disabled={option.disabled} aria-pressed={option.value === value} onClick={() => onChange(option.value)}
            className="press h-9 flex-1 rounded-full text-sm font-semibold text-mist disabled:opacity-35 aria-pressed:bg-ink-3 aria-pressed:text-bone">{option.label}</button>
        ))}
      </div>
    </div>
  )
}

function Fact({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-mist">{label}</dt>
      <dd className={cn('display num text-3xl', accent && 'text-gold')}>{value}</dd>
    </div>
  )
}


function SuggestedDetails({ suggestion, window, planner, minutes, stopId, onStop }: {
  suggestion: Suggestion; window: RouteWindow; planner: Planner; minutes: number; stopId?: string; onStop: (id: string) => void
}) {
  return (
    <>
      <dl className="mt-5 grid grid-cols-3 gap-3">
        <Fact label="Expected" value={decimal(suggestion.expected)} accent />
        <Fact label="Stops" value={String(suggestion.stops.length)} />
        <Fact label="Time" value={clock(suggestion.seconds)} />
      </dl>
      {window.average !== null && (
        <p className="mt-3 text-sm text-mist">You averaged <b className="num text-bone">{decimal(window.average)}</b> here in the first {minutes} min{window.best && <>, best <b className="num text-bone">{window.best.count}</b></>}.</p>
      )}
      <ol className="mt-4 max-h-72 space-y-1 overflow-y-auto pr-1" aria-label="Planned chest stops">
        {suggestion.stops.map((stop, i) => (
          <li key={stop.id}>
            <button type="button" aria-pressed={stop.id === stopId} onClick={() => onStop(stop.id)}
              className="press flex w-full items-center gap-3 rounded-lg px-1.5 py-1.5 text-left text-sm hover:bg-ink-3 aria-pressed:bg-ink-3 aria-pressed:ring-1 aria-pressed:ring-bone/40">
              <span className="num grid size-6 shrink-0 place-items-center rounded-full bg-gold text-xs font-bold text-ink">{i + 1}</span>
              <span className="min-w-0 flex-1">Seen in {stop.appeared} of {planner.timing.recordings} replays</span>
              <span className="num text-mist">{stop.mine ? `opened ${stop.mine}×` : 'never opened'}</span>
            </button>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs leading-relaxed text-dim">
        Tap a stop to zoom the map to it. Expected chests weight each stop by how often it appeared. Time assumes straight-line running at {decimal(planner.timing.speed)} m/s plus {decimal(planner.timing.openSeconds)} s per chest, so fights and terrain will slow you down.
      </p>
    </>
  )
}

function BestRunDetails({ best, minutes }: { best: NonNullable<RouteWindow['best']>; minutes: number }) {
  return (
    <>
      <dl className="mt-5 grid grid-cols-2 gap-3">
        <Fact label={`Chests in ${minutes} min`} value={String(best.count)} accent />
        <Fact label="Last chest at" value={best.lastChest === null ? '–' : clock(best.lastChest)} />
      </dl>
      <Link to="/matches/$matchId" params={{ matchId: best.matchId }} search={{ t: Math.round(best.landedAt) }}
        className="press mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-bone px-4 font-semibold text-ink hover:bg-gold">
        Replay this run <ArrowRight className="size-4" />
      </Link>
    </>
  )
}
