import { useMemo, useState, type ReactNode } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { ArrowRight } from 'lucide-react'
import { clipsQuery, weekQuery } from '~/lib/queries'
import { clock, dateTime, decimal, monthDay, placeLabel, shortDate, timeOfDay } from '~/lib/format'
import { BarList, Columns, DayColumns, MatchColumns, rarities, rarityStyle, Segmented, type Rarity } from '~/components/charts'
import { activity } from '~/lib/activity'
import { CHESTS_PER_TOKEN, percent, tokenChance } from '~/lib/odds'
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
  const range = `${monthDay(real[0].startUtc)} – ${monthDay(real.at(-1)!.startUtc)}`
  const when = useMemo(() => activity(week), [week])
  const recent = real.slice(-5).reverse()
  const posters = (clips?.clips ?? []).filter(hasChest).slice(0, 8)
  const yours = liveTotal ?? week.total
  const counted = yours + (withTeam ? teamTotal : 0)

  return (
    <main className="page pt-8 md:pt-14">
      <section className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="caps text-[12px] text-dim md:text-sm">{range} · <Pop value={liveMatches ?? week.realMatches} /> matches</p>
          <h1 className="mt-4 flex flex-col md:flex-row md:flex-wrap md:items-baseline md:gap-x-[18px]">
            <span className="display num text-hero-sm tracking-[-0.02em] text-gold text-shadow-numeral-sm md:text-[10rem] md:leading-[0.876] md:text-shadow-numeral lg:text-hero">
              <HeroTotal total={counted} />
            </span>
            <span className="display text-[44px] text-shadow-word md:text-[72px] md:leading-none">Chests</span>
          </h1>
          <p className="mt-4 flex flex-wrap items-baseline gap-x-2.5 gap-y-2 md:mt-3">
            <span className="display num text-[28px] leading-none md:text-4xl">{percent(tokenChance(counted))}</span>
            <span className="text-base text-mist md:text-lg">chance one <span className="max-md:hidden">of them </span>dropped a Pirate Shop token</span>
            <span className="max-md:basis-full">
              <span title={`Epic’s published Pirate Shop Access drop rate is 1 in ${CHESTS_PER_TOKEN.toLocaleString()} per chest`}
                className="num inline-flex h-7 items-center rounded-pill border border-line px-2.5 text-[13px] text-mist">
                1 in {CHESTS_PER_TOKEN.toLocaleString()} per chest
              </span>
            </span>
          </p>
        </div>
        <Segmented look="gold" label="Whose chests to count" className="w-full shrink-0 lg:w-auto" value={withTeam ? 'team' : 'you'} onChange={value => setWithTeam(value === 'team')}
          options={[{ value: 'you', label: 'Just you', count: yours }, { value: 'team', label: 'With teammates', count: yours + teamTotal }]} />
      </section>
      {week.stubs > 0 && <p className="mt-3 text-xs text-dim">{week.stubs} partial recording not counted.</p>}
      <LiveMatch />

      <div className="mt-6 grid grid-cols-2 gap-2.5 md:mt-10 lg:grid-cols-5 lg:gap-3.5">
        <Card rarity="mythic" index={0} wide label="By you" value={week.total.toLocaleString()}
          note={<><span className="num">{week.opened.toLocaleString()} opened</span><span className="max-lg:hidden"> · </span><span className="num max-lg:block">{week.broken.toLocaleString()} broken</span></>} />
        <Card rarity="legendary" index={1} label="Best match" value={String(best?.chests ?? '–')} note={best ? `${monthDay(best.startUtc)} · ${timeOfDay(best.startUtc)}` : undefined}
          link={best && { matchId: best.id, label: `Best match: ${best.chests} chests. Replay it` }} />
        <Card rarity="epic" index={2} label={<><span className="lg:hidden">Teammates</span><span className="max-lg:hidden">Teammate chests</span></>} value={teamTotal.toLocaleString()}
          note={<><span className="num max-lg:hidden">{week.team.opened.toLocaleString()} opened · </span><span className="num">{week.team.broken.toLocaleString()} broken</span></>} />
        <Card rarity="rare" index={3} label="Per match" value={decimal(week.average)} note={<>average<span className="max-lg:hidden"> over {week.realMatches}</span></>} />
        <Card rarity="uncommon" index={4} label="Per minute" value={decimal(week.pace)} note="while alive" />
      </div>

      <section className="mt-6 rounded-panel border border-line bg-ink-sunk p-5 md:mt-8 md:p-7" aria-labelledby="per-match">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="per-match" className="display text-[28px] leading-none md:text-display-md">{chart === 'match' ? 'Chests per match' : 'Chests per day'}</h2>
            <p className="mt-2 text-[15px] text-mist max-md:hidden">
              {chart === 'match' ? `Oldest to newest. Dashed line is your ${decimal(week.average)} average. Click a bar to replay it.` : 'One bar per day you played.'}
            </p>
          </div>
          <Segmented label="Chart grouping" value={chart} onChange={setChart}
            options={[{ value: 'match', label: 'Per match', short: 'Match' }, { value: 'day', label: 'Per day', short: 'Day' }]} />
        </div>
        {chart === 'match'
          ? <MatchColumns matches={week.matches} average={week.average} bestId={week.bestMatchId} />
          : <DayColumns matches={week.matches} />}
        <p className="mt-4 text-[15px] text-mist md:hidden">
          {chart === 'match' ? `Dashed line is your ${decimal(week.average)} average. Tap a bar to replay it.` : 'One bar per day you played.'}
        </p>
      </section>

      <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 border-y border-line-soft py-6 sm:grid-cols-3 lg:grid-cols-5">
        <Fact label="First chest after landing" value={week.firstChestMedian === null ? '–' : clock(week.firstChestMedian)} note="median" />
        <Fact label="Best 2-minute opening" value={String(week.bestOpening)} note="chests" />
        <Fact label="Wins" value={String(week.wins)} note={`${week.topFive} top-5`} />
        <Fact label="Ran" value={`${decimal(week.distanceKm)} km`} note={`${decimal(week.mapCrossings)} island widths`} />
        <Fact label="Also opened" value={String(week.ammoBoxes + week.otherContainers)} note="ammo boxes & more" />
      </dl>

      <section className="mt-10 grid gap-6 lg:grid-cols-2" aria-labelledby="recent-games">
        <Panel>
          <div className="mb-3 flex items-baseline justify-between">
            <Heading id="recent-games" title="Recent games" />
            <Link to="/matches" className="text-sm font-semibold text-gold hover:text-bone">All matches</Link>
          </div>
          <ol className="divide-y divide-line-soft">
            {recent.map(match => <li key={match.id}><RecentGame match={match} /></li>)}
          </ol>
        </Panel>
        <Panel>
          <Heading title="When the chests came" note={`Most on ${when.peakDay.label}, peak hour ${when.peakHour.label}.`} />
          <Columns items={when.hourBars} every={6} highlight={when.peakHour.label} />
          <div className="mt-6"><BarList items={when.dayBars} tone="mist" /></div>
        </Panel>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel>
          <Heading title="What fell out" note="Item records matched to your chests." />
          <BarList items={week.loot} limit={8} />
        </Panel>
        <Panel>
          <Heading title="Weapon rarity" note="Weapons matched to your chests, by rarity." />
          <BarList items={week.rarity} tone="rarity" />
        </Panel>
        <Panel>
          <Heading title="Where you dropped" note="Landings per spot." />
          <BarList items={week.drops} tone="kelp" format={n => `${n}×`} />
        </Panel>
        <Panel>
          <Heading title="How it ended" note="Team placement at the end of each match." />
          <BarList items={week.finishes} tone="mist" />
        </Panel>
      </section>

      {posters.length > 0 && (
        <section className="mt-10">
          <div className="flex items-end justify-between gap-4">
            <Heading title="On camera" note={`${week.clipCount} clips lined up with the replays.`} />
            <Link to="/clips" className="mb-5 shrink-0 text-sm font-semibold text-gold hover:text-bone">All clips</Link>
          </div>
          <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
            {posters.map(clip => (
              <Link key={clip.id} to="/clips/$clipId" params={{ clipId: clip.id }} className="group relative w-64 shrink-0 snap-start overflow-hidden rounded-card border border-line bg-ink-2">
                <img src={clip.poster} alt="" loading="lazy" decoding="async" width={1720} height={720} className="aspect-[43/18] w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]" />
                <span className="block px-3 py-2 text-sm font-semibold">{clip.label}<span className="font-medium text-mist"> · {shortDate(clip.localStamp)}</span></span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 text-sm text-dim">
        Counted from {real.length} Fortnite replay files. {Math.round(week.confirmedShare * 100)}% of the {week.total.toLocaleString()} chests name {week.player}’s character as the opener in the replay itself.
        {' '}Token odds use Epic’s published Pirate Shop Access drop rate of 1 in {CHESTS_PER_TOKEN.toLocaleString()} per chest, with every chest an independent roll.
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
        <span className="block truncate text-[15px] font-semibold">{match.zone ?? 'Unknown drop'} <span className="font-medium text-mist">· {placeLabel(match.placement)}</span></span>
        <span className="block truncate text-[13px] text-dim">{dateTime(match.startUtc)}{mates.length > 0 && ` · with ${mates.join(', ')}`}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-mist transition-transform duration-200 ease-out group-hover:translate-x-1" />
    </Link>
  )
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="rounded-panel border border-line bg-ink-2 p-5 md:p-7">{children}</div>
}

function Heading({ title, note, id }: { title: string; note?: string; id?: string }) {
  return (
    <div className="mb-5">
      <h2 id={id} className="display text-[28px] leading-none md:text-display-md">{title}</h2>
      {note && <p className="mt-2 text-[15px] text-mist">{note}</p>}
    </div>
  )
}

/** A stat card washed in its rarity. The order across the row descends by rarity. */
function Card({ label, value, note, rarity, index, wide, link }: {
  label: ReactNode; value: string; note?: ReactNode; rarity: Rarity; index: number; wide?: boolean
  link?: { matchId: string; label: string }
}) {
  const body = (
    <>
      <p className={cn('caps text-[12px] md:text-caps', rarities[rarity].text)}>{label}</p>
      <p className={cn('flex gap-x-4 gap-y-1.5', wide ? 'items-end justify-between lg:flex-col lg:items-start' : 'flex-col')}>
        <span className={cn('display num leading-[0.92] lg:text-[58px]', wide ? 'text-[50px]' : 'text-[44px]')}>{value}</span>
        {note && <span className={cn('text-[14px] text-mist-2 md:text-[15px] lg:text-sm', wide && 'max-lg:text-right')}>{note}</span>}
      </p>
    </>
  )
  const style = cn('rarity-wash flex flex-col gap-1.5 px-5 py-[18px] motion-safe:animate-[card-in_320ms_var(--ease-pop)_both]', wide && 'col-span-2 lg:col-span-1')
  const delay = { ...rarityStyle(rarity), animationDelay: `${index * 60}ms` }
  return link
    ? <Link to="/matches/$matchId" params={{ matchId: link.matchId }} aria-label={link.label} style={delay}
        className={cn(style, 'transition-[translate,border-color] duration-160 ease-out hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--r)_60%,transparent)]')}>{body}</Link>
    : <div style={delay} className={style}>{body}</div>
}

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-[13px] font-semibold text-mist">{label}</dt>
      <dd className="display num mt-1 text-[32px] leading-none">{value}</dd>
      {note && <dd className="mt-1 text-[13px] text-dim">{note}</dd>}
    </div>
  )
}
