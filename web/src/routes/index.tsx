import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { clipsQuery, weekQuery } from '~/lib/queries'
import { clock, dateTime, decimal, placeLabel, shortDate } from '~/lib/format'
import { BarList, Columns, DayColumns, MatchColumns, Segmented } from '~/components/charts'
import { activity } from '~/lib/activity'
import { hasChest } from '~/features/clips/model'
import { useSelector } from '@tanstack/react-store'
import { HeroTotal, LiveMatch, Pop } from '~/components/live'
import { liveStore } from '~/lib/live'
import { cn } from '~/lib/cn'
import type { MatchRow } from '~/data'

export const Route = createFileRoute('/')({
  component: WeekPage,
})

function WeekPage() {
  const { data: week } = useSuspenseQuery(weekQuery)
  const { data: clips } = useQuery(clipsQuery)
  // The tracker's total moves seconds after a match, before the rebuilt week data lands.
  const liveTotal = useSelector(liveStore, status => status && status.phase !== 'off' ? status.total : null)
  const liveMatches = useSelector(liveStore, status => status && status.phase !== 'off' ? status.matches : null)
  const [withTeam, setWithTeam] = useState(false)
  const [chart, setChart] = useState<'match' | 'day'>('match')
  const teamTotal = week.team.opened + week.team.broken
  const real = week.matches.filter(match => !match.stub)
  const best = real.find(match => match.id === week.bestMatchId)
  const range = `${shortDate(real[0].startUtc)} – ${shortDate(real.at(-1)!.startUtc)}`
  const when = useMemo(() => activity(week), [week])
  const recent = real.slice(-5).reverse()
  const posters = (clips?.clips ?? []).filter(hasChest).slice(0, 8)

  return (
    <main className="mx-auto max-w-7xl px-4">
      <div className="grid grid-cols-1 gap-x-12 pt-8 pb-10 sm:pt-14 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section>
        <p className="text-sm font-medium text-mist">{range}</p>
        <h1 className="mt-3">
          <span className="display num block text-[6.5rem] leading-[0.8] text-gold sm:text-[11rem]"><HeroTotal total={(liveTotal ?? week.total) + (withTeam ? teamTotal : 0)} /></span>
          <span className="display mt-2 block text-4xl sm:text-6xl">
            chests cracked <span className="text-mist">in</span> <Pop value={liveMatches ?? week.realMatches} className="text-gold" /> matches.
          </span>
        </h1>
        <p className="mt-4 max-w-md text-mist">
          That is <b className="num text-bone">{decimal(week.average)}</b> a match for {week.player}, with a best of{' '}
          <b className="num text-bone">{best?.chests ?? '–'}</b> in one game.
        </p>
        <Segmented label="Whose chests to count" className="mt-5" value={withTeam ? 'team' : 'you'} onChange={value => setWithTeam(value === 'team')}
          options={[{ value: 'you', label: 'Just you', count: liveTotal ?? week.total }, { value: 'team', label: 'With teammates', count: (liveTotal ?? week.total) + teamTotal }]} />
        {week.stubs > 0 && <p className="mt-2 text-xs text-dim">{week.stubs} partial recording not counted.</p>}
        <LiveMatch />
      </section>
      <aside className="mt-10 lg:mt-0" aria-labelledby="recent-games">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 id="recent-games" className="text-[11px] font-semibold tracking-wider text-dim uppercase">Recent games</h2>
          <Link to="/matches" className="text-sm font-semibold text-gold hover:text-bone">All matches</Link>
        </div>
        <ol className="divide-y divide-line/60 border-y border-line/60">
          {recent.map(match => <li key={match.id}><RecentGame match={match} /></li>)}
        </ol>
      </aside>
      </div>

      <dl className="grid grid-cols-2 gap-3 pb-8 sm:grid-cols-3 lg:grid-cols-5">
        <Card label="By you" value={week.total.toLocaleString()} note={`${week.opened.toLocaleString()} opened · ${week.broken.toLocaleString()} broken`} tone="text-gold" />
        <Card label="Teammate chests" value={teamTotal.toLocaleString()} note={`${week.team.opened.toLocaleString()} opened · ${week.team.broken.toLocaleString()} broken`} tone="text-kelp" />
        <Card label="Per match" value={decimal(week.average)} note="average" />
        <Card label="Best match" value={String(best?.chests ?? '–')} note={best ? shortDate(best.startUtc) : undefined} />
        <Card label="Per minute" value={decimal(week.pace, 2)} note="while alive" />
      </dl>

      <dl className="grid grid-cols-2 gap-x-6 gap-y-6 border-y border-line/70 py-6 sm:grid-cols-3 lg:grid-cols-5">
        <Fact label="First chest after landing" value={week.firstChestMedian === null ? '–' : clock(week.firstChestMedian)} note="median" />
        <Fact label="Best 2-minute opening" value={String(week.bestOpening)} note="chests" />
        <Fact label="Wins" value={String(week.wins)} note={`${week.topFive} top-5`} />
        <Fact label="Ran" value={`${decimal(week.distanceKm)} km`} note={`${decimal(week.mapCrossings)} island widths`} />
        <Fact label="Also opened" value={String(week.ammoBoxes + week.otherContainers)} note="ammo boxes & more" />
      </dl>

      <section className="py-10">
        <div className="flex flex-wrap items-end justify-between gap-x-4">
          <Heading title={chart === 'match' ? 'Every match' : 'Every day'} note={chart === 'match' ? 'One bar per match. Tap one to replay it.' : 'One bar per day you played.'} />
          <Segmented label="Chart grouping" className="mb-5" value={chart} onChange={setChart}
            options={[{ value: 'match', label: 'Per match' }, { value: 'day', label: 'Per day' }]} />
        </div>
        {chart === 'match'
          ? <MatchColumns matches={week.matches} average={week.average} bestId={week.bestMatchId} />
          : <DayColumns matches={week.matches} />}
        {best && (
          <Link to="/matches/$matchId" params={{ matchId: best.id }} className="group mt-5 flex items-center gap-4 rounded-2xl bg-ink-2 p-4 hover:bg-ink-3">
            <span className="display num text-5xl text-gold">{best.chests}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">Your record run</span>
              <span className="block truncate text-sm text-mist">{best.zone} · {placeLabel(best.placement)} · {shortDate(best.startUtc)}</span>
            </span>
            <ArrowRight className="size-5 text-mist transition-transform duration-200 ease-out group-hover:translate-x-1" />
          </Link>
        )}
      </section>

      <section className="grid gap-x-12 gap-y-10 border-t border-line/70 py-10 lg:grid-cols-2">
        <div>
          <Heading title="When the chests came" note={`Most on ${when.peakDay.label}, peak hour ${when.peakHour.label}.`} />
          <Columns items={when.hourBars} every={6} highlight={when.peakHour.label} />
          <div className="mt-6"><BarList items={when.dayBars} tone="mist" /></div>
        </div>
        <div>
          <Heading title="What fell out" note="Item records matched to your chests." />
          <BarList items={week.loot} limit={8} />
          <h3 className="mt-8 mb-3 text-sm font-semibold text-mist">Weapon rarity</h3>
          <BarList items={week.rarity} tone="mist" />
        </div>
      </section>

      <section className="grid gap-x-12 gap-y-10 border-t border-line/70 py-10 lg:grid-cols-2">
        <div>
          <Heading title="Where you dropped" note="Landings per spot." />
          <BarList items={week.drops} tone="kelp" format={n => `${n}×`} />
        </div>
        <div>
          <Heading title="How it ended" note="Team placement at the end of each match." />
          <BarList items={week.finishes} tone="mist" />
        </div>
      </section>

      {posters.length > 0 && (
        <section className="border-t border-line/70 py-10">
          <div className="flex items-end justify-between gap-4">
            <Heading title="On camera" note={`${week.clipCount} clips lined up with the replays.`} />
            <Link to="/clips" className="mb-5 shrink-0 text-sm font-semibold text-gold hover:text-bone">All clips</Link>
          </div>
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
            {posters.map(clip => (
              <Link key={clip.id} to="/clips/$clipId" params={{ clipId: clip.id }} className="group relative w-64 shrink-0 snap-start overflow-hidden rounded-xl bg-ink-2">
                <img src={clip.poster} alt="" loading="lazy" decoding="async" width={1720} height={720} className="aspect-[43/18] w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]" />
                <span className="block px-3 py-2 text-sm font-semibold">{clip.label}<span className="font-normal text-mist"> · {shortDate(clip.localStamp)}</span></span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="border-t border-line/70 py-8 text-sm text-dim">
        Counted from {real.length} Fortnite replay files. {Math.round(week.confirmedShare * 100)}% of the {week.total.toLocaleString()} chests name {week.player}’s character as the opener in the replay itself.
      </p>
    </main>
  )
}

function RecentGame({ match }: { match: MatchRow }) {
  const mates = match.squad.filter(member => !member.you).map(member => member.name)
  return (
    <Link to="/matches/$matchId" params={{ matchId: match.id }} className="group flex items-center gap-4 py-3">
      <span className="display num w-14 shrink-0 text-right text-4xl text-gold">{match.chests}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{match.zone ?? 'Unknown drop'} <span className="font-normal text-mist">· {placeLabel(match.placement)}</span></span>
        <span className="block truncate text-xs text-dim">{dateTime(match.startUtc)}{mates.length > 0 && ` · with ${mates.join(', ')}`}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-mist transition-transform duration-200 ease-out group-hover:translate-x-1" />
    </Link>
  )
}

function Heading({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-5">
      <h2 className="display text-3xl sm:text-4xl">{title}</h2>
      {note && <p className="mt-1 text-sm text-mist">{note}</p>}
    </div>
  )
}

function Card({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-line/60 bg-ink-2 px-4 py-3.5">
      <dt className="text-[11px] font-semibold tracking-wider text-dim uppercase">{label}</dt>
      <dd className={cn('display num mt-1.5 text-4xl', tone)}>{value}</dd>
      {note && <dd className="mt-1 text-xs text-mist">{note}</dd>}
    </div>
  )
}

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-xs text-mist">{label}</dt>
      <dd className="display num mt-1 text-3xl">{value}</dd>
      {note && <dd className="text-xs text-dim">{note}</dd>}
    </div>
  )
}
