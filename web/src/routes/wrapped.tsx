import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { animate } from 'motion'
import { LazyMotion, domAnimation, m, type Variants } from 'motion/react'
import { ArrowRight, Compass, Footprints, Gem, Pause, Play, RotateCcw, Share2, Trophy, Users, X } from 'lucide-react'
import type { Clip, MatchRow, Px, Tally, Week } from '~/data'
import { clipsQuery, hosted, weekQuery } from '~/lib/queries'
import { activity, type Activity } from '~/lib/activity'
import { clock, decimal, placeLabel, shortDate } from '~/lib/format'
import { shareLink } from '~/lib/share'
import { cn } from '~/lib/cn'

const SLIDE_MS = 6500
const tones = {
  ink: { bg: 'bg-ink', fg: 'text-bone', soft: 'text-mist', track: 'bg-bone/20', fill: 'bg-bone' },
  gold: { bg: 'bg-gold', fg: 'text-ink', soft: 'text-ink/70', track: 'bg-ink/15', fill: 'bg-ink' },
  coral: { bg: 'bg-coral', fg: 'text-ink', soft: 'text-ink/70', track: 'bg-ink/15', fill: 'bg-ink' },
  kelp: { bg: 'bg-kelp', fg: 'text-ink', soft: 'text-ink/70', track: 'bg-ink/15', fill: 'bg-ink' },
  storm: { bg: 'bg-storm', fg: 'text-ink', soft: 'text-ink/70', track: 'bg-ink/15', fill: 'bg-ink' },
  bone: { bg: 'bg-bone', fg: 'text-ink', soft: 'text-ink/65', track: 'bg-ink/15', fill: 'bg-ink' },
} as const
type Tone = keyof typeof tones

interface Story { week: Week; when: Activity; clip?: Clip; paused: boolean; restart: () => void }
interface Slide { id: string; tone: Tone; title: string; ms?: number; body: ReactNode }

export const Route = createFileRoute('/wrapped')({
  validateSearch: (raw: Record<string, unknown>): { s?: string } => ({ s: typeof raw.s === 'string' && raw.s ? raw.s : undefined }),
  loader: ({ context }) => context.queryClient.ensureQueryData(clipsQuery),
  head: () => ({ meta: [{ title: 'Wrapped · Chest Log' }] }),
  component: WrappedPage,
})

function buildSlides({ week, when, clip, paused, restart }: Story): Slide[] {
  const real = week.matches.filter(match => !match.stub)
  const best = real.find(match => match.id === week.bestMatchId)
  const range = `${shortDate(real[0].startUtc)} – ${shortDate(real.at(-1)!.startUtc)}`
  const topRarity = week.rarity.findLast(entry => entry.label !== 'Unknown')
  const favourite = week.drops[0]
  const mate = week.crew[0]
  const slides: (Slide | false | undefined)[] = [
    { id: 'start', tone: 'ink', title: 'Your week in chests', body: <>
      <Rise><Eyebrow><Gem className="size-4" /> {range}</Eyebrow></Rise>
      <Rise><h1 className="display mt-4 text-[4.4rem] sm:text-8xl">{week.player}’s week in chests</h1></Rise>
      <Rise><p className="mt-6 text-lg text-mist">{real.length} matches. Tap to keep going.</p></Rise>
    </> },
    { id: 'total', tone: 'gold', title: `${week.total} chests opened`, body: <>
      <Rise><Eyebrow>Chests opened</Eyebrow></Rise>
      <Rise><p className="display num mt-2 text-[8.5rem] leading-[0.8] sm:text-[11rem]"><Count value={week.total} /></p></Rise>
      <Rise><p className="mt-4 text-xl font-semibold">That is <Count value={week.average} format={v => decimal(v)} /> every match.</p></Rise>
      <Rise className="mt-10"><MatchStrip week={week} /></Rise>
    </> },
    best && bestSlide(week, best),
    favourite && { id: 'drop', tone: 'kelp', title: `Favourite drop: ${favourite.label}`, body: <>
      <Rise><Eyebrow>Favourite drop</Eyebrow></Rise>
      <Rise><h1 className="display mt-2 text-7xl sm:text-8xl">{favourite.label}</h1></Rise>
      <Rise><p className="mt-3 text-lg font-semibold">You landed there {favourite.count} times.</p></Rise>
      <Rise className="mt-8"><Bars items={week.drops.slice(0, 5)} format={n => `${n}×`} /></Rise>
    </> },
    { id: 'when', tone: 'storm', title: `Most chests on ${when.peakDay.label}`, body: <>
      <Rise><Eyebrow>When you opened the most</Eyebrow></Rise>
      <Rise><h1 className="display mt-2 text-7xl sm:text-8xl">{when.peakDay.label}</h1></Rise>
      <Rise><p className="mt-3 text-lg font-semibold"><Count value={when.peakDay.count} /> chests that day. Peak hour {when.peakHour.label}.</p></Rise>
      <Rise className="mt-10"><HourColumns bars={when.hourBars} peak={when.peakHour.label} /></Rise>
    </> },
    { id: 'loot', tone: 'coral', title: 'What came out', body: <>
      <Rise><Eyebrow>Rarest pull{topRarity ? ` · ${topRarity.label}` : ''}</Eyebrow></Rise>
      <Rise><h1 className="display mt-2 text-7xl sm:text-8xl">{week.rarest[0]?.label ?? 'Nothing rare'}</h1></Rise>
      {week.rarest[0] && <Rise><p className="mt-3 text-lg font-semibold">Pulled {week.rarest[0].count} {week.rarest[0].count === 1 ? 'time' : 'times'}.</p></Rise>}
      <Rise className="mt-8"><h2 className="mb-2 text-sm font-semibold opacity-70">Most common out of chests</h2><Bars items={week.loot.slice(0, 4)} /></Rise>
    </> },
    { id: 'speed', tone: 'ink', title: 'Touch down. Open fast.', body: <>
      <Rise><Eyebrow>Opening speed</Eyebrow></Rise>
      <Rise><h1 className="display mt-2 text-7xl sm:text-8xl">Touch down. <span className="text-gold">Open fast.</span></h1></Rise>
      <Rise className="mt-10"><Facts items={[
        ['First chest after landing', week.firstChestMedian === null ? '–' : clock(week.firstChestMedian)],
        ['Best two-minute opening', `${week.bestOpening} chests`],
        ['Chests per minute alive', week.pace === null ? '–' : decimal(week.pace, 2)],
      ]} /></Rise>
    </> },
    { id: 'persona', tone: 'gold', title: week.persona.title, body: <>
      <Rise><Compass className="size-12" strokeWidth={1.5} /></Rise>
      <Rise><Eyebrow className="mt-6">Your chest persona</Eyebrow></Rise>
      <Rise><h1 className="display mt-2 text-7xl sm:text-8xl">{week.persona.title}</h1></Rise>
      <Rise><p className="mt-4 max-w-sm text-xl font-semibold">{week.persona.detail}</p></Rise>
    </> },
    { id: 'distance', tone: 'kelp', title: `${decimal(week.distanceKm)} km on foot`, body: <>
      <Rise><Eyebrow><Footprints className="size-4" /> Distance travelled</Eyebrow></Rise>
      <Rise><p className="display num mt-2 text-[7rem] leading-[0.85]"><Count value={week.distanceKm} format={v => decimal(v)} /><span className="text-5xl"> km</span></p></Rise>
      <Rise><p className="mt-4 text-lg font-semibold">That is {decimal(week.mapCrossings)} trips across the whole island.</p></Rise>
      <Rise className="mt-8"><Crossings value={week.mapCrossings} /></Rise>
    </> },
    mate && crewSlide(week, mate),
    { id: 'finishes', tone: 'coral', title: `${week.wins} wins`, body: <>
      <Rise><Eyebrow>How it ended</Eyebrow></Rise>
      <Rise><h1 className="display mt-2 text-8xl"><Count value={week.wins} /> {week.wins === 1 ? 'win' : 'wins'}</h1></Rise>
      <Rise><p className="mt-3 text-lg font-semibold">{week.topFive} top-five finishes in {real.length} matches.</p></Rise>
      <Rise className="mt-8"><Bars items={week.finishes} /></Rise>
    </> },
    clip && clipSlide(clip, paused),
    { id: 'end', tone: 'gold', title: `${week.player}’s week in chests`, ms: Infinity, body: <>
      <Rise><Eyebrow>{range}</Eyebrow></Rise>
      <Rise><h1 className="display mt-2 text-7xl break-words">{week.player}</h1></Rise>
      <Rise><p className="mt-1 text-xl font-semibold">{week.persona.title}</p></Rise>
      <Rise className="mt-8"><Facts items={[
        ['Chests', week.total.toLocaleString()], ['Per match', decimal(week.average)],
        ['Best match', String(best?.chests ?? '–')], ['Wins', String(week.wins)],
        ['Distance', `${decimal(week.distanceKm)} km`], ['First chest', week.firstChestMedian === null ? '–' : clock(week.firstChestMedian)],
      ]} columns /></Rise>
      <Rise className="relative z-10 mt-10 flex flex-wrap gap-3">
        <button type="button" onClick={() => hosted
          // A hosted library never leaves this browser, so the link invites a friend to count their own.
          ? shareLink(`I cracked ${week.total.toLocaleString()} chests in Fortnite. How many have you?`, location.origin, 'It opens Chest Log, where a friend can count their own.')
          : shareLink(`${week.player}’s week in chests`, `${location.origin}/wrapped`)}
          className="press inline-flex h-12 items-center gap-2 rounded-full bg-ink px-5 font-semibold text-bone"><Share2 className="size-4" /> Share</button>
        <button type="button" onClick={restart} className="press inline-flex h-12 items-center gap-2 rounded-full border-2 border-ink/80 px-5 font-semibold"><RotateCcw className="size-4" /> Watch again</button>
        <Link to="/" className="press inline-flex h-12 items-center gap-2 px-2 font-semibold underline decoration-2 underline-offset-4">See every stat</Link>
      </Rise>
    </> },
  ]
  return slides.filter((slide): slide is Slide => !!slide)
}

function bestSlide(week: Week, best: MatchRow): Slide {
  return { id: 'best', tone: 'bone', title: `Best match: ${best.chests} chests`, body: <>
    <Rise><Eyebrow><Trophy className="size-4" /> Best match</Eyebrow></Rise>
    <Rise><h1 className="display mt-2 text-7xl"><Count value={best.chests} /> chests</h1></Rise>
    <Rise><p className="mt-2 text-lg font-semibold">{best.zone ?? 'Unknown drop'} · {placeLabel(best.placement)} · {shortDate(best.startUtc)}</p></Rise>
    {week.bestTrail && <Rise className="mt-6"><TrailInset trail={week.bestTrail.trail} chests={week.bestTrail.chests} /></Rise>}
    <Rise className="mt-4"><Link to="/matches/$matchId" params={{ matchId: best.id }} className="press relative z-10 inline-flex items-center gap-1.5 font-semibold underline decoration-2 underline-offset-4">Replay it <ArrowRight className="size-4" /></Link></Rise>
  </> }
}

function crewSlide(week: Week, mate: Tally): Slide {
  return { id: 'crew', tone: 'bone', title: `Chest crew: ${mate.label}`, body: <>
    <Rise><Eyebrow><Users className="size-4" /> Your chest crew</Eyebrow></Rise>
    <Rise><h1 className="display mt-2 text-6xl break-words sm:text-7xl">{mate.label}</h1></Rise>
    <Rise><p className="mt-3 text-lg font-semibold">Opened {mate.count} chests in your matches together.</p></Rise>
    <Rise className="mt-8"><Bars items={week.crew.slice(1, 5)} /></Rise>
  </> }
}

function clipSlide(clip: Clip, paused: boolean): Slide {
  return { id: 'clip', tone: 'ink', title: `Highlight: ${clip.label}`, ms: Math.max(SLIDE_MS, clip.duration * 1000), body: <>
    <Rise><Eyebrow>Your highlight</Eyebrow></Rise>
    <Rise><h1 className="display mt-2 text-7xl">{clip.label}</h1></Rise>
    <Rise className="mt-6"><Highlight clip={clip} paused={paused} /></Rise>
    <Rise className="mt-4"><Link to="/clips/$clipId" params={{ clipId: clip.id }} className="press relative z-10 inline-flex items-center gap-1.5 font-semibold text-gold">Watch it with annotations <ArrowRight className="size-4" /></Link></Rise>
  </> }
}

function WrappedPage() {
  const { data: week } = useSuspenseQuery(weekQuery)
  const { data: clips } = useSuspenseQuery(clipsQuery)
  const navigate = Route.useNavigate()
  const [stopped, setStopped] = useState(false)
  const [held, setHeld] = useState(false)
  const hidden = useDocumentHidden()
  const when = useMemo(() => activity(week), [week])
  const clip = clips.clips.find(candidate => candidate.id === week.standoutClipId)
  const paused = stopped || held || hidden
  const slides = buildSlides({ week, when, clip, paused, restart: () => go(0) })
  const { index, go } = useStoryPosition(slides)
  const slide = slides[index]
  const tone = tones[slide.tone]
  const fill = useStoryTimer(index, slide.ms ?? SLIDE_MS, paused, () => go(index + 1))
  const gestures = useTapAndHold(setHeld, fromLeft => go(index + (fromLeft ? -1 : 1)))
  useStoryKeys({ next: () => go(index + 1), previous: () => go(index - 1), togglePause: () => setStopped(value => !value), close: () => navigate({ to: '/' }) })

  return (
    <LazyMotion features={domAnimation} strict>
      <div className={cn('fixed inset-0 flex flex-col overflow-hidden transition-colors duration-500 ease-out select-none', tone.bg, tone.fg)}
        aria-roledescription="story" aria-label={`${week.player}’s week in chests`}>
        <div className="relative z-20 mx-auto w-full max-w-xl px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex gap-1" role="tablist" aria-label="Slides">
            {slides.map((candidate, i) => (
              <button key={candidate.id} type="button" role="tab" aria-selected={i === index} aria-label={candidate.title} onClick={() => go(i)}
                className="flex h-5 flex-1 items-center">
                <span className={cn('relative block h-[3px] w-full overflow-hidden rounded-full', tone.track)}>
                  <span ref={i === index ? fill : undefined}
                    className={cn('absolute inset-0 origin-left rounded-full', tone.fill)}
                    style={{ transform: `scaleX(${i < index ? 1 : 0})` }} />
                </span>
              </button>
            ))}
          </div>
          <div className="mt-1 flex items-center gap-1">
            <span className="text-sm font-semibold">Chest Log</span>
            <span className="flex-1" />
            <button type="button" aria-label={stopped ? 'Resume story' : 'Pause story'} aria-pressed={stopped} onClick={() => setStopped(value => !value)}
              className="press grid size-10 place-items-center rounded-full hover:bg-current/10">
              {stopped ? <Play className="size-5" fill="currentColor" /> : <Pause className="size-5" fill="currentColor" />}
            </button>
            <button type="button" aria-label="Share this slide" onClick={() => shareLink(slide.title)}
              className="press grid size-10 place-items-center rounded-full hover:bg-current/10"><Share2 className="size-5" /></button>
            <Link to="/" aria-label="Close Wrapped" className="press grid size-10 place-items-center rounded-full hover:bg-current/10"><X className="size-6" /></Link>
          </div>
        </div>

        <div className="relative flex-1">
          <div className="absolute inset-0 z-0 touch-manipulation" aria-hidden {...gestures} onContextMenu={event => event.preventDefault()} />
          <m.section key={slide.id} aria-live="polite" initial="hidden" animate="show" variants={stagger}
            className="pointer-events-none relative z-10 mx-auto flex h-full w-full max-w-xl flex-col justify-center px-6 pb-[max(2rem,env(safe-area-inset-bottom))] [&_a]:pointer-events-auto [&_button]:pointer-events-auto">
            {slide.body}
          </m.section>
        </div>
      </div>
    </LazyMotion>
  )
}

function useStoryPosition(slides: Slide[]) {
  const { s } = Route.useSearch()
  const navigate = Route.useNavigate()
  const index = Math.max(0, slides.findIndex(slide => slide.id === s))
  const go = (target: number) => {
    const id = target <= 0 ? undefined : slides[Math.min(target, slides.length - 1)].id
    navigate({ search: { s: id }, replace: true, resetScroll: false })
  }
  return { index, go }
}

function useDocumentHidden() {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden)
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])
  return hidden
}

function useStoryTimer(index: number, total: number, paused: boolean, onDone: () => void) {
  const fill = useRef<HTMLSpanElement>(null)
  const elapsed = useRef(0)
  const done = useRef(onDone)
  useLayoutEffect(() => { done.current = onDone })
  useEffect(() => { elapsed.current = 0 }, [index])
  useEffect(() => {
    const paint = () => { if (fill.current) fill.current.style.transform = `scaleX(${Math.min(1, elapsed.current / total)})` }
    paint()
    if (paused || !Number.isFinite(total)) return
    let last = performance.now()
    let frame = requestAnimationFrame(function tick(now) {
      elapsed.current += Math.min(now - last, 100)
      last = now
      paint()
      if (elapsed.current >= total) done.current()
      else frame = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(frame)
  }, [index, total, paused])
  return fill
}

function useTapAndHold(setHeld: (held: boolean) => void, onTap: (fromLeft: boolean) => void) {
  const press = useRef<{ x: number; timer: number; long: boolean } | null>(null)
  const release = () => {
    const current = press.current
    press.current = null
    if (current) clearTimeout(current.timer)
    return current
  }
  const cancel = () => { release(); setHeld(false) }
  return {
    onPointerDown: (event: React.PointerEvent) => {
      const timer = window.setTimeout(() => { if (press.current) { press.current.long = true; setHeld(true) } }, 220)
      press.current = { x: event.clientX, timer, long: false }
    },
    onPointerUp: (event: React.PointerEvent) => {
      const current = release()
      if (!current) return
      if (current.long) return setHeld(false)
      const rect = event.currentTarget.getBoundingClientRect()
      onTap(current.x - rect.left < rect.width * 0.3)
    },
    onPointerCancel: cancel,
    onPointerLeave: cancel,
  }
}

function useStoryKeys(actions: { next: () => void; previous: () => void; togglePause: () => void; close: () => void }) {
  const latest = useRef(actions)
  useLayoutEffect(() => { latest.current = actions })
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const onControl = event.target instanceof Element && !!event.target.closest('a, button, input, select, textarea')
      if (event.key === 'ArrowRight') latest.current.next()
      else if (event.key === 'ArrowLeft') latest.current.previous()
      else if (event.key === 'Escape') latest.current.close()
      else if (event.key === ' ' && !onControl) { event.preventDefault(); latest.current.togglePause() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } } }
const rise: Variants = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.23, 1, 0.32, 1] } } }

function Rise({ children, className }: { children: ReactNode; className?: string }) {
  return <m.div variants={rise} className={className}>{children}</m.div>
}

function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('flex items-center gap-2 text-sm font-bold tracking-wide uppercase opacity-80', className)}>{children}</p>
}

function Count({ value, format = v => Math.round(v).toLocaleString() }: { value: number; format?: (value: number) => string }) {
  const node = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!node.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const target = node.current
    const controls = animate(0, value, { duration: 0.9, delay: 0.15, ease: [0.23, 1, 0.32, 1], onUpdate: v => { target.textContent = format(v) } })
    return () => controls.stop()
  }, [value])
  return <span ref={node}>{format(value)}</span>
}

function Bars({ items, format = n => n.toLocaleString() }: { items: Tally[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...items.map(item => item.count))
  return (
    <ol className="space-y-2.5">
      {items.map(item => (
        <li key={item.label}>
          <div className="flex items-baseline justify-between gap-3 font-semibold"><span className="truncate">{item.label}</span><span className="num">{format(item.count)}</span></div>
          <div className="mt-1 h-1.5 rounded-full bg-current/15"><div className="h-full rounded-full bg-current" style={{ width: `${(item.count / max) * 100}%` }} /></div>
        </li>
      ))}
    </ol>
  )
}

function Facts({ items, columns }: { items: [string, string][]; columns?: boolean }) {
  return (
    <dl className={cn('grid gap-x-6 gap-y-5', columns ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1')}>
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-sm font-semibold opacity-70">{label}</dt>
          <dd className="display num text-4xl">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function MatchStrip({ week }: { week: Week }) {
  const real = week.matches.filter(match => !match.stub)
  const max = Math.max(1, ...real.map(match => match.chests))
  return (
    <figure>
      <div className="flex h-24 items-end gap-[2px]" aria-hidden>
        {real.map(match => (
          <span key={match.id} className={cn('flex-1 rounded-t-[2px] bg-ink', match.id !== week.bestMatchId && 'opacity-35')} style={{ height: `${Math.max(4, (match.chests / max) * 100)}%` }} />
        ))}
      </div>
      <figcaption className="mt-2 text-sm font-semibold opacity-70">Chests per match, in the order you played</figcaption>
    </figure>
  )
}

function HourColumns({ bars, peak }: { bars: Tally[]; peak: string }) {
  const max = Math.max(1, ...bars.map(bar => bar.count))
  return (
    <figure>
      <div className="flex h-28 items-end gap-[3px]" aria-hidden>
        {bars.map(bar => <span key={bar.label} className={cn('flex-1 rounded-t-[2px] bg-ink', bar.label !== peak && 'opacity-35')} style={{ height: `${Math.max(3, (bar.count / max) * 100)}%` }} />)}
      </div>
      <div className="mt-1.5 flex justify-between text-xs font-semibold opacity-70">{[0, 6, 12, 18].map(hour => <span key={hour}>{bars[hour].label}</span>)}<span /></div>
      <figcaption className="sr-only">Chests opened by hour of day, peak at {peak}</figcaption>
    </figure>
  )
}

function Crossings({ value }: { value: number }) {
  const whole = Math.ceil(value)
  return (
    <figure>
      <div className="flex flex-wrap gap-1.5" aria-hidden>
        {Array.from({ length: whole }, (_, i) => (
          <span key={i} className="size-2.5 rounded-full bg-ink" style={{ opacity: Math.max(0.25, Math.min(1, value - i)) }} />
        ))}
      </div>
      <figcaption className="mt-3 text-sm font-semibold opacity-70">Each dot is one run across the island, edge to edge</figcaption>
    </figure>
  )
}

function TrailInset({ trail, chests }: { trail: Px[][]; chests: Px[] }) {
  const points = [...trail.flat(), ...chests]
  const xs = points.map(point => point[0])
  const ys = points.map(point => point[1])
  const pad = 60
  let [x0, x1, y0, y1] = [Math.min(...xs) - pad, Math.max(...xs) + pad, Math.min(...ys) - pad, Math.max(...ys) + pad]
  const aspect = 1.45
  if ((x1 - x0) / (y1 - y0) < aspect) { const grow = ((y1 - y0) * aspect - (x1 - x0)) / 2; x0 -= grow; x1 += grow }
  else { const grow = ((x1 - x0) / aspect - (y1 - y0)) / 2; y0 -= grow; y1 += grow }
  const radius = (x1 - x0) / 110
  return (
    <svg viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} className="aspect-[1.45] w-full overflow-hidden rounded-2xl bg-ink" role="img"
      aria-label={`Route of the best match with ${chests.length} chest openings`}>
      <image href="/map/island-1024.webp" x={0} y={0} width={2048} height={2048} preserveAspectRatio="none" />
      {trail.filter(path => path.length > 1).map((path, i) => (
        <polyline key={i} points={path.map(point => point.join(',')).join(' ')} pathLength={1} fill="none" stroke="var(--color-bone)" strokeWidth={3}
          strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="[stroke-dasharray:1] [animation:draw_1.6s_var(--ease-out)_0.3s_both]" />
      ))}
      {chests.map((point, i) => <circle key={i} cx={point[0]} cy={point[1]} r={radius} fill="var(--color-gold)" stroke="var(--color-ink)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />)}
    </svg>
  )
}

function Highlight({ clip, paused }: { clip: Clip; paused: boolean }) {
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const element = video.current
    if (!element) return
    if (paused) element.pause()
    else element.play().catch(() => undefined)
  }, [paused])
  return <video ref={video} src={clip.video} poster={clip.poster} muted playsInline autoPlay preload="metadata"
    className="aspect-[43/18] w-full rounded-2xl bg-ink-2 object-cover" aria-label={`${clip.label} clip, muted`} />
}
