import { useEffect, useState } from 'react'
import { Store } from '@tanstack/store'

export interface Playback { time: number; playing: boolean; speed: number; scrubbing: boolean }
export type PlaybackStore = Store<Playback>
export const speeds = [1, 4, 8, 16, 32] as const

export function usePlayback(initialTime: number, duration: number) {
  const [store] = useState(() => new Store<Playback>({ time: initialTime, playing: false, speed: 8, scrubbing: false }))
  useEffect(() => {
    let frame = 0
    let last = 0
    const tick = (now: number) => {
      frame = 0
      const { playing, speed, time } = store.state
      if (!playing) return
      const elapsed = last ? Math.min(100, now - last) / 1000 : 0
      last = now
      const next = Math.min(duration, time + elapsed * speed)
      frame = requestAnimationFrame(tick)
      store.setState(state => ({ ...state, time: next, playing: next < duration }))
    }
    const start = () => {
      if (store.state.playing && !frame) {
        last = 0
        frame = requestAnimationFrame(tick)
      }
    }
    const subscription = store.subscribe(start)
    start()
    return () => { subscription.unsubscribe(); cancelAnimationFrame(frame) }
  }, [store, duration])
  return store
}

export const seek = (store: PlaybackStore, time: number, duration: number) =>
  store.setState(state => ({ ...state, time: Math.max(0, Math.min(duration, time)) }))
export const togglePlay = (store: PlaybackStore, duration: number) =>
  store.setState(state => ({ ...state, playing: !state.playing, time: !state.playing && state.time >= duration ? 0 : state.time }))
