import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import type { MatchRow, Tally } from '~/data'
import { placeLabel, shortDate, timeOfDay } from '~/lib/format'
import { cn } from '~/lib/cn'

/** Labelled horizontal bars for one series. Labels carry identity; the bar carries magnitude. */
export function BarList({ items, format = n => n.toLocaleString(), tone = 'gold', limit }: {
  items: Tally[]; format?: (count: number) => string; tone?: 'gold' | 'mist' | 'kelp' | 'coral'; limit?: number
}) {
  const shown = limit ? items.slice(0, limit) : items
  const max = Math.max(1, ...shown.map(item => item.count))
  const fill = { gold: 'bg-gold', mist: 'bg-mist/70', kelp: 'bg-kelp', coral: 'bg-coral' }[tone]
  return (
    <ul className="space-y-2.5">
      {shown.map(item => (
        <li key={item.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1">
          <span className="truncate text-sm">{item.label}</span>
          <span className="num text-sm text-mist">{format(item.count)}</span>
          <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-ink-3">
            <span className={cn('block h-full rounded-full', fill)} style={{ width: `${(item.count / max) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  )
}

/** One column per match, grouped by local day. Each column opens its replay. */
export function MatchColumns({ matches, average, bestId }: { matches: MatchRow[]; average: number; bestId: string | null }) {
  const [hover, setHover] = useState<MatchRow | null>(null)
  const real = matches.filter(match => !match.stub)
  const max = Math.max(1, ...real.map(match => match.chests))
  const days = Map.groupBy(real, match => shortDate(match.startUtc))
  return (
    <figure className="relative">
      <div className="relative flex h-44 items-end gap-2 sm:h-56" role="list" aria-label="Chests per match">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-mist/40" style={{ bottom: `${(average / max) * 100}%` }}>
          <span className="num absolute -top-5 right-0 text-[11px] text-mist">avg {average.toFixed(1)}</span>
        </div>
        {[...days].map(([day, rows]) => (
          <div key={day} className="flex h-full min-w-0 flex-1 items-end gap-[2px]" style={{ flexGrow: rows.length }}>
            {rows.map(match => (
              <div key={match.id} role="listitem" className="flex h-full min-w-0 max-w-6 flex-1">
                <Link to="/matches/$matchId" params={{ matchId: match.id }}
                  aria-label={`${shortDate(match.startUtc)} ${timeOfDay(match.startUtc)}: ${match.chests} chests, ${placeLabel(match.placement)}`}
                  onPointerEnter={() => setHover(match)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(match)} onBlur={() => setHover(null)}
                  className="group flex size-full items-end">
                  <span className={cn('block w-full rounded-t-[4px] transition-colors duration-150',
                    match.id === bestId ? 'bg-gold' : 'bg-gold/55 group-hover:bg-gold group-focus-visible:bg-gold')}
                    style={{ height: `${Math.max(2, (match.chests / max) * 100)}%` }} />
                </Link>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 border-t border-line pt-2" aria-hidden>
        {[...days].map(([day, rows]) => (
          <span key={day} className="min-w-0 flex-1 truncate text-[11px] text-dim" style={{ flexGrow: rows.length }}>{day.split(',')[0]}</span>
        ))}
      </div>
      {hover && (
        <figcaption className="pointer-events-none absolute top-0 left-0 rounded-lg border border-line bg-ink-3 px-3 py-2 text-sm shadow-lg">
          <span className="num font-semibold text-gold">{hover.chests} chests</span>
          <span className="text-mist"> · {placeLabel(hover.placement)} · {shortDate(hover.startUtc)}, {timeOfDay(hover.startUtc)}</span>
          {hover.zone && <span className="block text-xs text-mist">{hover.zone}</span>}
        </figcaption>
      )}
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
            <span className={cn('block w-full rounded-t-[4px]', item.label === highlight ? 'bg-gold' : 'bg-mist/45')}
              style={{ height: `${item.count ? Math.max(3, (item.count / max) * 100) : 0}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[2px] border-t border-line pt-1.5" aria-hidden>
        {items.map((item, i) => (
          <span key={item.label} className="min-w-0 flex-1 text-center text-[10px] whitespace-nowrap text-dim">{i % every === 0 ? item.label : ''}</span>
        ))}
      </div>
    </div>
  )
}

/** One column per local day, for the days that had a match. The busiest day is solid. */
export function DayColumns({ matches }: { matches: MatchRow[] }) {
  const days = [...Map.groupBy(matches.filter(match => !match.stub), match => shortDate(match.startUtc))]
    .map(([day, rows]) => ({ day, games: rows.length, chests: rows.reduce((sum, row) => sum + row.chests, 0) }))
  const max = Math.max(1, ...days.map(day => day.chests))
  return (
    <figure>
      <div className="flex h-44 items-end gap-2 sm:h-56" role="list" aria-label="Chests per day">
        {days.map(({ day, games, chests }) => (
          <div key={day} role="listitem" aria-label={`${day}: ${chests} chests in ${games} matches`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="num text-xs font-semibold sm:text-sm">{chests.toLocaleString()}</span>
            <span className={cn('block w-full max-w-28 rounded-t-[4px]', chests === max ? 'bg-gold' : 'bg-gold/55')}
              style={{ height: `calc((100% - 1.75rem) * ${chests / max})` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2 border-t border-line pt-2">
        {days.map(({ day, games, chests }) => (
          <span key={day} className="min-w-0 flex-1 text-center text-[11px] text-dim">
            <span className="block truncate text-mist">{day.split(',')[0]}</span>
            <span className="num block truncate">{games} {games === 1 ? 'game' : 'games'}<span className="hidden sm:inline"> · {(chests / games).toFixed(1)} avg</span></span>
          </span>
        ))}
      </div>
    </figure>
  )
}

/** A pill switch between a few views. */
export function Segmented<T extends string>({ label, value, options, onChange, className }: {
  label: string; value: T; options: { value: T; label: string; count?: number }[]; onChange: (value: T) => void; className?: string
}) {
  return (
    <div className={cn('inline-flex rounded-full bg-ink-2 p-1 text-sm font-semibold', className)} role="group" aria-label={label}>
      {options.map(option => (
        <button key={option.value} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}
          className="press flex items-center gap-2 rounded-full px-3.5 py-2 whitespace-nowrap text-mist aria-pressed:bg-bone aria-pressed:text-ink">
          {option.label}{option.count !== undefined && <span className="num text-xs opacity-70">{option.count.toLocaleString()}</span>}
        </button>
      ))}
    </div>
  )
}
