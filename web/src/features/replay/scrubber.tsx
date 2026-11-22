import { memo, useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { Link } from '@tanstack/react-router'
import type { ClipRef, MatchEvent, StormFrame } from '~/data'
import { clock } from '~/lib/format'
import { isMyChest, layerOf } from './model'
import { seek, type PlaybackStore } from './playback'

interface Props {
  store: PlaybackStore
  duration: number
  events: MatchEvent[]
  clips: ClipRef[]
  onCommit: (time: number) => void
  storm: StormFrame[]
}

/** Ticks under the track: fights in coral, storm closings in storm-ring, milestones in bone. */
const below = (event: MatchEvent) => layerOf(event) === 'combat' ? 'bg-coral' : layerOf(event) === 'milestone' ? 'bg-bone/80' : null

/** Drives the store directly from pointer input and paints progress without React renders. */
export const Scrubber = memo(function Scrubber({ store, duration, events, clips, onCommit, storm }: Props) {
  const track = useRef<HTMLDivElement>(null)
  const fill = useRef<HTMLDivElement>(null)
  const thumb = useRef<HTMLDivElement>(null)
  const pending = useRef<number | null>(null)
  const frame = useRef(0)
  const rect = useRef<DOMRect | null>(null)

  useEffect(() => {
    const paint = () => {
      const { time } = store.state
      const fraction = duration ? time / duration : 0
      fill.current!.style.transform = `scaleX(${fraction})`
      track.current!.style.setProperty('--progress', `${fraction * 100}%`)
      thumb.current!.style.transform = `translateX(${fraction * 100}%)`
      track.current!.setAttribute('aria-valuenow', time.toFixed(1))
      track.current!.setAttribute('aria-valuetext', spoken(time))
    }
    paint()
    const subscription = store.subscribe(paint)
    return () => subscription.unsubscribe()
  }, [store, duration])

  const timeAt = (clientX: number) => {
    const box = rect.current ?? track.current!.getBoundingClientRect()
    return Math.max(0, Math.min(1, (clientX - box.left) / box.width)) * duration
  }
  const schedule = (time: number) => {
    pending.current = time
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      if (pending.current !== null) seek(store, pending.current, duration)
    })
  }
  const down = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    event.currentTarget.setPointerCapture(event.pointerId)
    rect.current = event.currentTarget.getBoundingClientRect()
    store.setState(state => ({ ...state, playing: false, scrubbing: true }))
    schedule(timeAt(event.clientX))
  }
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (store.state.scrubbing) schedule(timeAt(event.clientX))
  }
  const up = (event: PointerEvent<HTMLDivElement>) => {
    if (!store.state.scrubbing) return
    const time = timeAt(event.clientX)
    cancelAnimationFrame(frame.current)
    frame.current = 0
    seek(store, time, duration)
    store.setState(state => ({ ...state, scrubbing: false }))
    rect.current = null
    onCommit(time)
  }
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 30 : 5
    const moves: Record<string, number> = {
      ArrowLeft: -step, ArrowDown: -step, ArrowRight: step, ArrowUp: step, PageDown: -60, PageUp: 60,
      Home: -Infinity, End: Infinity,
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    const time = Math.max(0, Math.min(duration, store.state.time + moves[event.key]))
    seek(store, time, duration)
    onCommit(time)
  }

  const position = (t: number) => `${(t / duration) * 100}%`
  const mine = events.filter(isMyChest)
  const chestTicks = mine.map((event, i) => <span key={i} className="absolute top-0 h-2.5 w-0.5 rounded-pill bg-gold" style={{ left: position(event.t) }} />)
  return (
    <div className="select-none">
      {clips.length > 0 && (
        <div className="relative mb-1.5 h-3" aria-label="Clips">
          {clips.map(clip => (
            <Link key={clip.id} to="/clips/$clipId" params={{ clipId: clip.id }}
              title={`${clip.label} clip at ${clock(clip.start)}`} aria-label={`Watch ${clip.label} clip at ${clock(clip.start)}`}
              className="absolute top-0 h-3 min-w-2 rounded-sm bg-kelp/70 hover:bg-kelp"
              style={{ left: position(clip.start), width: position(Math.max(4, clip.end - clip.start)) }} />
          ))}
        </div>
      )}
      <div
        ref={track}
        role="slider"
        tabIndex={0}
        aria-label="Replay time"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onKeyDown={key}
        className="group relative h-12 cursor-pointer touch-none outline-none [overflow:clip] [overflow-clip-margin:16px]"
      >
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1.5 h-2.5 opacity-40">{chestTicks}</div>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1.5 h-2.5 [clip-path:inset(0_calc(100%-var(--progress,0%))_0_0)]">{chestTicks}</div>
        <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-pill bg-ink-3">
          <div ref={fill} className="h-full origin-left bg-gold will-change-transform" style={{ transform: 'scaleX(0)' }} />
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-1.5 h-2.5">
          {events.map((event, i) => {
            const tone = below(event)
            return tone && <span key={i} className={`absolute top-0 h-2.5 w-0.5 rounded-pill ${tone}`} style={{ left: position(event.t) }} />
          })}
          {storm.map((frame, i) => frame.shrinkStart !== null && frame.shrinkStart < duration && (
            <span key={`storm-${i}`} className="absolute top-0 h-2.5 w-0.5 rounded-pill bg-storm-ring" style={{ left: position(frame.shrinkStart) }} />
          ))}
        </div>
        <div ref={thumb} aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 h-0 will-change-transform">
          <div className="-mt-[11px] -ml-[11px] size-[22px] rounded-full border-4 border-gold bg-bone shadow-[0_2px_10px_rgb(0_0_0/0.5)] transition-shadow duration-120 group-focus-visible:shadow-[0_0_0_6px_rgb(255_194_61/0.3)]" />
        </div>
      </div>
    </div>
  )
})

/** "7 minutes 42 seconds", for screen readers. */
function spoken(time: number) {
  const total = Math.floor(time)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return [minutes && `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`, `${seconds} ${seconds === 1 ? 'second' : 'seconds'}`].filter(Boolean).join(' ')
}
