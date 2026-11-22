import { memo, useEffect, useMemo, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useSelector } from '@tanstack/react-store'
import type { MatchEvent } from '~/data'
import type { Rgb } from '~/features/map/palette'
import { clock } from '~/lib/format'
import { cn } from '~/lib/cn'
import { colorOf, isChestEvent, lastAtOrBefore } from './model'
import type { PlaybackStore } from './playback'

const ROW = 44

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

  if (!events.length) return <p className="px-5 py-8 text-[15px] text-mist">Nothing in the layers you have on.</p>
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

/** Who did it, shown at the end of the row when it is not you, and for fights, who hit whom. */
const byline = (event: MatchEvent) => event.actor !== 'me' || event.kind === 'knock' || event.kind === 'elimination' ? event.detail : null

const EventRow = memo(function EventRow({ event, top, state, selected, onChoose, colors }: {
  event: MatchEvent; top: number; state: 'past' | 'now' | 'later'; selected: boolean; onChoose: (event: MatchEvent) => void; colors?: Map<string, Rgb>
}) {
  const [r, g, b] = colorOf(event, colors)
  const who = byline(event)
  return (
    <div role="listitem" className="absolute inset-x-0" style={{ top, height: ROW }}>
      <button
        type="button"
        aria-current={state === 'now' ? 'true' : undefined}
        aria-pressed={selected}
        onClick={() => onChoose(event)}
        className={cn(
          'flex size-full items-center gap-3 border-b border-l-[3px] border-b-line-soft border-l-transparent pr-5 pl-[17px] text-left hover:bg-ink-3/60',
          state === 'now' && 'border-l-gold bg-gold/12 max-lg:bg-ink-3',
          selected && 'ring-1 ring-bone/40 ring-inset',
        )}
      >
        <time className={cn('num w-10 shrink-0 text-sm', state === 'now' ? 'font-bold text-gold' : 'font-semibold text-dim')}>{clock(event.t)}</time>
        <span aria-hidden className={cn('size-2.5 shrink-0', isChestEvent(event) ? 'rotate-45 rounded-[2px]' : 'rounded-full')} style={{ background: `rgb(${r} ${g} ${b})` }} />
        <span className={cn('min-w-0 flex-1 truncate text-[15px]', state === 'now' ? 'font-bold' : state === 'later' ? 'font-medium text-mist-2' : 'font-semibold')}>{event.label}</span>
        {who && <span className="max-w-[45%] shrink-0 truncate text-[13px] font-semibold text-dim">{who}</span>}
      </button>
    </div>
  )
})
