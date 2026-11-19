import { memo, useEffect, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useSelector } from '@tanstack/react-store'
import { Bus, Flag, Gem, MapPin, Package, RotateCcw, Skull, Swords, Wind, type LucideIcon } from 'lucide-react'
import type { EventKind, MatchEvent } from '~/data'
import type { Rgb } from '~/features/map/palette'
import { clock } from '~/lib/format'
import { cn } from '~/lib/cn'
import { colorOf, lastAtOrBefore } from './model'
import type { PlaybackStore } from './playback'

const icons: Record<EventKind, LucideIcon> = {
  chest: Gem, rare_chest: Gem, ammo_box: Package, container: Package, knock: Swords, elimination: Skull,
  bus: Bus, jump: Wind, landed: MapPin, reboot: RotateCcw, death: Skull, end: Flag,
}
const ROW = 56

interface Props {
  events: MatchEvent[]
  store: PlaybackStore
  selected: MatchEvent | null
  onChoose: (event: MatchEvent) => void
  /** Squadmate name to color, so their chests match their map color. */
  colors?: Map<string, Rgb>
  className?: string
}

export function EventLog({ events, store, selected, onChoose, colors, className }: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const times = useMemo(() => Float64Array.from(events, event => event.t), [events])
  const active = useSelector(store, state => lastAtOrBefore(times, state.time))
  const scrubbing = useSelector(store, state => state.scrubbing)
  const virtualizer = useVirtualizer({ count: events.length, getScrollElement: () => scroller.current, estimateSize: () => ROW, overscan: 8 })

  useEffect(() => {
    if (active >= 0 && !scrubbing) virtualizer.scrollToIndex(active, { align: 'center' })
  }, [active, scrubbing, virtualizer])

  if (!events.length) return <p className="px-4 py-8 text-sm text-mist">Nothing in the layers you have on.</p>
  return (
    <div ref={scroller} className={cn('overflow-y-auto overscroll-contain', className)} role="list" aria-label="Match events">
      <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map(item => (
          <EventRow key={item.key} event={events[item.index]} top={item.start} state={item.index === active ? 'now' : item.index > active ? 'later' : 'past'}
            selected={selected === events[item.index]} onChoose={onChoose} colors={colors} />
        ))}
      </div>
    </div>
  )
}

const EventRow = memo(function EventRow({ event, top, state, selected, onChoose, colors }: {
  event: MatchEvent; top: number; state: 'past' | 'now' | 'later'; selected: boolean; onChoose: (event: MatchEvent) => void; colors?: Map<string, Rgb>
}) {
  const Icon = icons[event.kind]
  const [r, g, b] = colorOf(event, colors)
  return (
    <div role="listitem" className="absolute inset-x-0" style={{ top, height: ROW }}>
      <button
        type="button"
        aria-current={state === 'now' ? 'true' : undefined}
        aria-pressed={selected}
        onClick={() => onChoose(event)}
        className={cn(
          'press flex size-full items-center gap-3 px-3 text-left hover:bg-ink-3/60',
          state === 'later' && 'opacity-45',
          state === 'now' && 'bg-ink-3',
          selected && 'bg-ink-3 ring-1 ring-inset ring-bone/40',
        )}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={{ background: `rgb(${r} ${g} ${b} / 0.14)`, color: `rgb(${r} ${g} ${b})` }}>
          <Icon className="size-4" strokeWidth={2.4} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{event.label}</span>
          <span className="block truncate text-xs text-mist">{event.detail}</span>
        </span>
        <time className="num shrink-0 text-xs text-mist">{clock(event.t)}</time>
      </button>
    </div>
  )
})
