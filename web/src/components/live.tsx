import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Link } from '@tanstack/react-router'
import { useSelector } from '@tanstack/react-store'
import { celebrated, celebrationStore, liveStore, type LiveStatus } from '~/lib/live'
import { cn } from '~/lib/cn'

type Phase = Exclude<LiveStatus['phase'], 'off'>

const dot: Record<Phase, string> = {
  watching: 'bg-kelp',
  recording: 'bg-coral motion-safe:animate-pulse',
  counting: 'bg-gold motion-safe:animate-pulse',
  error: 'bg-coral',
}
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches

function useLive() {
  const status = useSelector(liveStore, state => state)
  return status && status.phase !== 'off' ? status : null
}

/** Header status: a LIVE badge during a match, otherwise a dot. */
export function LiveDot() {
  const status = useLive()
  if (status?.phase === 'recording') {
    return (
      <Link to="/" aria-label="Live: you are in a match"
        className="press flex items-center gap-1.5 rounded-full bg-coral/15 px-2.5 py-1 text-[11px] font-bold tracking-wider text-coral uppercase">
        <span aria-hidden className="size-1.5 rounded-full bg-coral motion-safe:animate-pulse" />Live
      </Link>
    )
  }
  return <span aria-hidden className={cn('size-2 rounded-full', dot[status?.phase ?? 'watching'])} />
}

/** The match you are in, or the one being counted, on the home page; a quiet status line between matches. */
export function LiveMatch() {
  const status = useLive()
  if (!status) return null
  const { phase } = status
  if (phase !== 'recording' && phase !== 'counting') {
    return (
      <p role="status" title={status.error ?? undefined} className="mt-5 flex max-w-md items-start gap-2.5 text-sm text-mist">
        <span aria-hidden className={cn('mt-1.5 size-2 shrink-0 rounded-full', dot[phase])} />
        {phase === 'error' ? 'Couldn’t count your last match. It will try again after your next one.' : 'Watching for your next match. Its chests land here seconds after you leave it.'}
      </p>
    )
  }
  const live = phase === 'recording'
  return (
    <section role="status" aria-label={live ? 'Match in progress' : 'Counting your match'}
      className="relative mt-6 max-w-md overflow-hidden rounded-2xl border border-line/60 bg-ink-2 motion-safe:animate-[caption-in_300ms_var(--ease-out)]">
      <div className="flex items-center gap-2.5 px-4 py-3.5">
        {live
          ? <span className="flex items-center gap-1.5 rounded-full bg-coral px-2 py-0.5 text-[11px] font-extrabold tracking-wider text-ink uppercase">
              <span aria-hidden className="size-1.5 rounded-full bg-ink motion-safe:animate-pulse" />Live
            </span>
          : <span className="rounded-full bg-gold px-2 py-0.5 text-[11px] font-extrabold tracking-wider text-ink uppercase">Match over</span>}
        <span className="text-sm">{live ? `In a match, ${status.match?.minutes ?? 0} min in` : 'Counting your chests from the replay'}</span>
      </div>
      {live
        ? <p className="border-t border-line/60 px-4 py-2.5 text-xs text-dim">Your chests count from the replay the moment you leave the match.</p>
        : <div aria-hidden className="h-1 overflow-hidden bg-ink-3"><div className="h-full w-1/3 bg-gold motion-safe:animate-[scan_1.1s_var(--ease-in-out)_infinite]" /></div>}
    </section>
  )
}

const sparks = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * Math.PI * 2 + (i % 3) * 0.35
  const reach = 90 + (i * 37) % 110
  return {
    '--dx': `${Math.round(Math.cos(angle) * reach)}px`,
    '--dy': `${Math.round(Math.sin(angle) * reach * 0.75)}px`,
    '--size': `${7 + (i * 5) % 7}px`,
    background: ['var(--color-gold)', 'var(--color-bone)', 'var(--color-kelp)'][i % 3],
    animationDelay: `${(i % 4) * 25}ms`,
  } as CSSProperties
})

/**
 * The all-time total. When a match is counted it plays the video-game bit: a +X badge slams in, drains into the
 * total as it ticks up chest by chest, then bursts. A celebration waits here if you were on another page.
 */
export function HeroTotal({ total }: { total: number }) {
  const party = useSelector(celebrationStore, state => state)
  const number = useRef<HTMLSpanElement>(null)
  const left = useRef<HTMLSpanElement>(null)
  const playing = useRef<string | null>(null)
  const stop = useRef<() => void>(() => undefined)
  const [badge, setBadge] = useState<{ gained: number; leaving: boolean; label: string } | null>(null)
  const [burst, setBurst] = useState(0)

  useLayoutEffect(() => {
    if (!party || party.to !== total || playing.current === party.id) return
    playing.current = party.id
    const { id, from, to, label = 'Match counted' } = party
    const gained = to - from
    const element = number.current!
    const timers: number[] = []
    let frame = 0
    const finish = () => { setBadge(null); celebrated(id) }
    stop.current = () => { cancelAnimationFrame(frame); timers.forEach(clearTimeout) }
    setBadge({ gained, leaving: false, label })
    if (reducedMotion()) {
      timers.push(window.setTimeout(finish, 4000))
      return
    }
    element.textContent = from.toLocaleString()
    const start = performance.now() + 700
    const duration = Math.min(2600, Math.max(1000, gained * 45))
    let shown = from
    const tick = (now: number) => {
      const progress = Math.min(1, Math.max(0, (now - start) / duration))
      const value = Math.round(from + gained * (1 - (1 - progress) ** 2))
      if (value !== shown) {
        shown = value
        element.textContent = value.toLocaleString()
        if (left.current) left.current.textContent = `+${to - value}`
        element.animate([{ transform: 'scale(1.035)' }, { transform: 'scale(1)' }], { duration: 120, easing: 'ease-out' })
      }
      if (progress < 1) { frame = requestAnimationFrame(tick); return }
      element.animate([{ transform: 'scale(1.12)', textShadow: '0 0 48px oklch(0.83 0.15 80 / 0.9)' }, { transform: 'scale(1)', textShadow: '0 0 0 transparent' }],
        { duration: 700, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' })
      setBurst(count => count + 1)
      setBadge({ gained, leaving: true, label })
      timers.push(window.setTimeout(finish, 650))
    }
    frame = requestAnimationFrame(tick)
  }, [party, total])
  useEffect(() => () => stop.current(), [])

  return (
    <span className="relative inline-block">
      {/* Keyed so a new total always gets a fresh text node; the count-up writes to the DOM directly. */}
      <span key={total} ref={number} className="inline-block origin-left">{total.toLocaleString()}</span>
      {badge && (
        <span aria-live="polite"
          className={cn('pointer-events-none absolute top-[6%] left-full ml-3 flex -rotate-3 flex-col items-start gap-1 rounded-xl bg-gold px-3 pt-2 pb-1.5 text-ink shadow-[0_0_40px_oklch(0.83_0.15_80/0.55)] sm:ml-5 sm:px-4',
            badge.leaving ? '[animation:chest-out_600ms_var(--ease-out)_forwards]' : '[animation:chest-pop_650ms_cubic-bezier(0.34,1.56,0.64,1)_both]')}>
          <span ref={left} className="display num text-5xl leading-none sm:text-7xl">+{badge.gained}</span>
          <span className="text-[11px] leading-none font-extrabold tracking-wider whitespace-nowrap uppercase">{badge.label}</span>
        </span>
      )}
      {burst > 0 && (
        <span key={burst} aria-hidden className="pointer-events-none absolute top-1/2 left-1/2">
          {sparks.map((style, i) => (
            <span key={i} style={style} className="absolute size-[var(--size)] rounded-[2px] [animation:chest-burst_900ms_var(--ease-out)_forwards]" />
          ))}
        </span>
      )}
    </span>
  )
}

/** A number that pops when it goes up, for counts that change after a match. */
export function Pop({ value, className }: { value: number; className?: string }) {
  const node = useRef<HTMLSpanElement>(null)
  const previous = useRef(value)
  useEffect(() => {
    const rose = value > previous.current
    previous.current = value
    if (!rose || reducedMotion()) return
    node.current?.animate([{ transform: 'scale(1.35)', color: 'var(--color-bone)' }, { transform: 'scale(1)' }],
      { duration: 520, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' })
  }, [value])
  return <span ref={node} className={cn('num inline-block', className)}>{value.toLocaleString()}</span>
}
