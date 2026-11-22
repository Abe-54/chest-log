import { useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from 'react'
import { Link } from '@tanstack/react-router'
import type { MatchRow, Tally } from '~/data'
import { placeLabel, shortDate, timeOfDay } from '~/lib/format'
import { cn } from '~/lib/cn'

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'

/** Each rarity's fill (bars, card washes) and its text-safe tint. Class names stay literal so Tailwind sees them. */
export const rarities: Record<Rarity, { fill: string; text: string; bar: string }> = {
  common: { fill: 'var(--color-rarity-common)', text: 'text-rarity-common-text', bar: 'bg-rarity-common' },
  uncommon: { fill: 'var(--color-rarity-uncommon)', text: 'text-rarity-uncommon-text', bar: 'bg-rarity-uncommon' },
  rare: { fill: 'var(--color-rarity-rare)', text: 'text-rarity-rare-text', bar: 'bg-rarity-rare' },
  epic: { fill: 'var(--color-rarity-epic)', text: 'text-rarity-epic-text', bar: 'bg-rarity-epic' },
  legendary: { fill: 'var(--color-rarity-legendary)', text: 'text-rarity-legendary-text', bar: 'bg-rarity-legendary' },
  mythic: { fill: 'var(--color-rarity-mythic)', text: 'text-rarity-mythic-text', bar: 'bg-rarity-mythic' },
}
const rarityOf = (label: string) => rarities[label.toLowerCase() as Rarity] as (typeof rarities)[Rarity] | undefined

/** Labelled horizontal bars for one series. Labels carry identity; the bar carries magnitude. */
export function BarList({ items, format = n => n.toLocaleString(), tone = 'gold', limit }: {
  items: Tally[]; format?: (count: number) => string; tone?: 'gold' | 'mist' | 'kelp' | 'coral' | 'rarity'; limit?: number
}) {
  const shown = limit ? items.slice(0, limit) : items
  const max = Math.max(1, ...shown.map(item => item.count))
  const fill = { gold: 'bg-gold', mist: 'bg-mist-2', kelp: 'bg-kelp', coral: 'bg-coral', rarity: 'bg-mist-2' }[tone]
  return (
    <ul className="space-y-3">
      {shown.map(item => {
        const rarity = tone === 'rarity' ? rarityOf(item.label) : undefined
        return (
          <li key={item.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1.5">
            <span className={cn('truncate text-[15px] font-semibold', rarity?.text)}>{item.label}</span>
            <span className="num text-sm font-semibold text-mist">{format(item.count)}</span>
            <span className="col-span-2 h-2 overflow-hidden rounded-pill bg-ink-3">
              <span className={cn('block h-full rounded-pill', rarity?.bar ?? fill)} style={{ width: `${(item.count / max) * 100}%` }} />
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** Gridline values: zero, half, and a round top just over the largest value. */
const ticksFor = (max: number) => {
  const top = Math.max(10, Math.ceil(max / 20) * 20)
  return [0, top / 2, top]
}

/** One bar per match, oldest to newest, with the average as a dashed line. Each bar opens its replay. */
export function MatchColumns({ matches, average, bestId }: { matches: MatchRow[]; average: number; bestId: string | null }) {
  const [hover, setHover] = useState<number | null>(null)
  const real = matches.filter(match => !match.stub)
  const ticks = ticksFor(Math.max(1, ...real.map(match => match.chests)))
  const top = ticks[2]
  const at = (value: number) => `${(value / top) * 100}%`
  // On touch, the first tap names the bar and the second opens it.
  const tap = (index: number) => (event: MouseEvent) => {
    if (hover !== index && matchMedia('(hover: none)').matches) {
      event.preventDefault()
      setHover(index)
    }
  }
  const shown = hover === null ? null : real[hover]
  return (
    <figure className="relative mt-6 grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-2">
      <div aria-hidden className="relative h-[150px] md:h-[232px]">
        {ticks.map(value => (
          <span key={value} className={cn('num absolute right-0 translate-y-1/2 text-[11px] leading-none font-semibold text-dim', value === 0 && 'max-md:hidden')} style={{ bottom: at(value) }}>{value}</span>
        ))}
      </div>
      <div className="relative h-[150px] md:h-[232px]">
        {ticks.map(value => <div key={value} aria-hidden className="absolute inset-x-0 border-t border-line-soft" style={{ bottom: at(value) }} />)}
        <div className="relative flex h-full items-end" role="list" aria-label="Chests per match">
          {real.map((match, i) => (
            <div key={match.id} role="listitem" className="flex h-full min-w-0 flex-1 justify-center">
              <Link to="/matches/$matchId" params={{ matchId: match.id }}
                aria-label={`Match ${i + 1}, ${shortDate(match.startUtc)} ${timeOfDay(match.startUtc)}: ${match.chests} chests, ${placeLabel(match.placement)}`}
                onClick={tap(i)} onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                className="group flex h-full w-[66%] items-end">
                <span className={cn('block w-full origin-bottom rounded-t-[2px] transition-colors duration-150 motion-safe:animate-[bar-grow_500ms_var(--ease-out)_both]',
                  match.id === bestId ? 'bg-bone' : 'bg-gold group-hover:bg-gold-deep group-focus-visible:bg-gold-deep')}
                  style={{ height: at(Math.max(top / 100, match.chests)), animationDelay: `${(match.id === bestId ? real.length : i) * 4}ms` }} />
              </Link>
            </div>
          ))}
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-storm-ring" style={{ bottom: at(average) }} />
        {shown && (
          <figcaption className="pointer-events-none absolute bottom-full z-10 mb-2 -translate-x-1/2 rounded-[6px] border border-line bg-ink-2 px-3 py-2 text-[13px] font-bold whitespace-nowrap shadow-popover motion-safe:animate-[caption-in_160ms_var(--ease-out)]"
            style={{ left: `clamp(6rem, ${((hover! + 0.5) / real.length) * 100}%, calc(100% - 6rem))` }}>
            Match {hover! + 1} · <span className="num text-gold">{shown.chests} chests</span>
            <span className="font-semibold text-mist"> · {shown.zone ?? 'Unknown drop'} · {placeLabel(shown.placement)}</span>
          </figcaption>
        )}
      </div>
    </figure>
  )
}

/** Simple single-series columns with labels under every nth bar. */
export function Columns({ items, every = 1, highlight }: { items: Tally[]; every?: number; highlight?: string }) {
  const max = Math.max(1, ...items.map(item => item.count))
  return (
    <div>
      <div className="flex h-28 items-end gap-[2px]" role="list">
        {items.map(item => (
          <div key={item.label} role="listitem" title={`${item.label}: ${item.count}`} aria-label={`${item.label}: ${item.count}`} className="flex h-full min-w-0 flex-1 items-end">
            <span className={cn('block w-full rounded-t-[2px]', item.label === highlight ? 'bg-gold' : 'bg-mist-2/60')}
              style={{ height: `${item.count ? Math.max(3, (item.count / max) * 100) : 0}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[2px] border-t border-line-soft pt-1.5" aria-hidden>
        {items.map((item, i) => (
          <span key={item.label} className="min-w-0 flex-1 text-center text-[11px] font-semibold whitespace-nowrap text-dim">{i % every === 0 ? item.label : ''}</span>
        ))}
      </div>
    </div>
  )
}

/** One column per local day, for the days that had a match. The busiest day is white. */
export function DayColumns({ matches }: { matches: MatchRow[] }) {
  const days = [...Map.groupBy(matches.filter(match => !match.stub), match => shortDate(match.startUtc))]
    .map(([day, rows]) => ({ day, games: rows.length, chests: rows.reduce((sum, row) => sum + row.chests, 0) }))
  const max = Math.max(1, ...days.map(day => day.chests))
  return (
    <figure className="mt-6">
      <div className="flex h-[150px] items-end gap-2 md:h-[232px]" role="list" aria-label="Chests per day">
        {days.map(({ day, games, chests }) => (
          <div key={day} role="listitem" aria-label={`${day}: ${chests} chests in ${games} matches`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="num text-xs font-bold sm:text-sm">{chests.toLocaleString()}</span>
            <span className={cn('block w-full max-w-28 origin-bottom rounded-t-[2px] motion-safe:animate-[bar-grow_500ms_var(--ease-out)_both]', chests === max ? 'bg-bone' : 'bg-gold')}
              style={{ height: `calc((100% - 1.75rem) * ${chests / max})` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 border-t border-line-soft pt-2">
        {days.map(({ day, games, chests }) => (
          <span key={day} className="min-w-0 flex-1 text-center text-[11px] font-semibold text-dim">
            <span className="block truncate text-mist">{day.split(',')[0]}</span>
            <span className="num block truncate">{games} {games === 1 ? 'game' : 'games'}<span className="hidden sm:inline"> · {(chests / games).toFixed(1)} avg</span></span>
          </span>
        ))}
      </div>
    </figure>
  )
}

const segmentLook = {
  gold: {
    box: 'rounded-[10px] border border-line bg-ink-2 p-1',
    item: 'h-10 rounded-button px-4 text-base font-bold text-bone md:h-11 aria-checked:bg-gold aria-checked:text-ink',
    count: 'text-[13px] font-bold text-dim group-aria-checked:text-ink/70',
  },
  quiet: {
    box: 'rounded-[10px] border border-line bg-ink-2 p-1',
    item: 'h-8 rounded-button px-3 text-sm font-semibold md:h-9 md:px-3.5 md:text-[15px] text-mist hover:text-bone aria-checked:bg-ink-3 aria-checked:font-bold aria-checked:text-bone',
    count: 'text-xs text-dim',
  },
}

/**
 * A switch between a few views, as a radio group with arrow keys. Only the page's main switch is gold; the rest are
 * quiet, so a view has one gold toggle.
 */
export function Segmented<T extends string>({ label, value, options, onChange, className, look = 'quiet' }: {
  label: string; value: T; options: { value: T; label: string; count?: number; short?: string }[]; onChange: (value: T) => void
  className?: string; look?: keyof typeof segmentLook
}) {
  const box = useRef<HTMLDivElement>(null)
  const style = segmentLook[look]
  const key = (event: KeyboardEvent) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key]
    if (!step) return
    event.preventDefault()
    const next = (options.findIndex(option => option.value === value) + step + options.length) % options.length
    onChange(options[next].value)
    box.current?.querySelectorAll<HTMLButtonElement>('[role=radio]')[next]?.focus()
  }
  return (
    <div ref={box} className={cn('inline-flex', style.box, className)} role="radiogroup" aria-label={label} onKeyDown={key}>
      {options.map(option => {
        const on = value === option.value
        return (
          <button key={option.value} type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} onClick={() => onChange(option.value)}
            className={cn('press group flex flex-1 items-center justify-center gap-2.5 whitespace-nowrap', style.item)}>
            {option.short ? <><span className="md:hidden">{option.short}</span><span className="max-md:hidden">{option.label}</span></> : option.label}
            {option.count !== undefined && <span className={cn('num', style.count)}>{option.count.toLocaleString()}</span>}
          </button>
        )
      })}
    </div>
  )
}

export const rarityStyle = (rarity: Rarity) => ({ '--r': rarities[rarity].fill }) as CSSProperties
