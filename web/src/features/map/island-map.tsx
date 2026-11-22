import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import DeckGL from '@deck.gl/react'
import { LinearInterpolator, OrthographicView, type Layer, type PickingInfo } from '@deck.gl/core'
import { BitmapLayer } from '@deck.gl/layers'
import { Minus, Plus, Scan } from 'lucide-react'
import { cn } from '~/lib/cn'
import { base as appBase } from '~/lib/mode'

export const MAP_SIZE = 2048
export type Bounds = [minX: number, minY: number, maxX: number, maxY: number]
interface ViewState { target: [number, number]; zoom: number; minZoom: number; maxZoom: number; transitionDuration?: number }

const view = new OrthographicView({ id: 'island', flipY: true, controller: true })
const interpolator = new LinearInterpolator(['target', 'zoom'])
const whole: Bounds = [0, 0, MAP_SIZE, MAP_SIZE]
const ease = (t: number) => 1 - Math.pow(1 - t, 4)

function fitView(bounds: Bounds, width: number, height: number, minZoom: number): Omit<ViewState, 'minZoom' | 'maxZoom'> {
  const [minX, minY, maxX, maxY] = bounds
  const zoom = Math.log2(Math.min(width / Math.max(40, maxX - minX), height / Math.max(40, maxY - minY)))
  return { target: [(minX + maxX) / 2, (minY + maxY) / 2], zoom: Math.max(minZoom, Math.min(4, zoom)) }
}

const background = (image: string) => new BitmapLayer({
  id: 'island-image', image, bounds: [0, MAP_SIZE, MAP_SIZE, 0],
  textureParameters: { minFilter: 'linear', magFilter: 'linear' },
})

export interface IslandMapProps {
  layers: Layer[]
  /** Region to frame. Changing the object reference re-frames with a short glide. */
  fit?: Bounds | null
  /** Keep this point centred while set; dragging the map calls onRelease. */
  follow?: [number, number] | null
  onRelease?: () => void
  onPick?: (info: PickingInfo) => void
  label: string
  className?: string
  children?: ReactNode
}

export function IslandMap({ layers, fit, follow, onRelease, onPick, label, className, children }: IslandMapProps) {
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState<{ width: number; height: number } | null>(null)
  const [image, setImage] = useState(`${appBase}map/island-1024.webp`)
  const [viewState, setViewState] = useState<ViewState | null>(null)
  const minZoom = size ? Math.log2(Math.min(size.width, size.height) / MAP_SIZE) - 0.25 : -2

  useLayoutEffect(() => {
    const element = box.current!
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setSize({ width, height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const upgrade = () => {
      const full = new Image()
      full.src = `${appBase}map/island-2048.webp`
      full.decode().then(() => setImage(full.src), () => undefined)
    }
    const handle = 'requestIdleCallback' in window ? requestIdleCallback(upgrade, { timeout: 1500 }) : setTimeout(upgrade, 600)
    return () => { if ('cancelIdleCallback' in window) cancelIdleCallback(handle as number); else clearTimeout(handle) }
  }, [])

  const framed = useRef<Bounds | null | undefined>(undefined)
  useEffect(() => {
    if (!size) return
    const first = framed.current === undefined
    if (!first && framed.current === fit) return
    framed.current = fit
    const next = fitView(fit ?? whole, size.width, size.height, minZoom)
    setViewState(previous => ({
      ...next, minZoom, maxZoom: 5,
      ...(previous && !first ? { transitionDuration: 450, transitionInterpolator: interpolator, transitionEasing: ease } : {}),
    }))
  }, [fit, size, minZoom])

  useEffect(() => {
    if (follow) setViewState(previous => previous && { ...previous, target: follow, transitionDuration: 0 })
  }, [follow?.[0], follow?.[1], size === null])

  const base = useMemo(() => background(image), [image])
  const zoomBy = useEvent((delta: number) => setViewState(previous => previous && {
    ...previous, zoom: Math.max(previous.minZoom, Math.min(previous.maxZoom, previous.zoom + delta)),
    transitionDuration: 200, transitionInterpolator: interpolator, transitionEasing: ease,
  }))
  const reset = useEvent(() => size && setViewState(previous => previous && {
    ...previous, ...fitView(fit ?? whole, size.width, size.height, minZoom),
    transitionDuration: 350, transitionInterpolator: interpolator, transitionEasing: ease,
  }))

  return (
    <div ref={box} role="group" aria-label={label} className={cn('relative overflow-hidden bg-ink touch-none select-none', className)}>
      {size && viewState && (
        <div role="img" aria-label={label} className="absolute inset-0">
          <DeckGL
            width={size.width}
            height={size.height}
            views={view}
            viewState={viewState}
            controller={{ dragRotate: false, touchRotate: false, keyboard: false, inertia: 250 }}
            onViewStateChange={({ viewState: next, interactionState }) => {
              if (interactionState?.isDragging && follow) onRelease?.()
              setViewState(next as ViewState)
            }}
            layers={[base, ...layers]}
            pickingRadius={10}
            onClick={info => onPick?.(info)}
            getCursor={({ isDragging, isHovering }) => isDragging ? 'grabbing' : isHovering ? 'pointer' : 'grab'}
            useDevicePixels={Math.min(2, window.devicePixelRatio)}
          />
        </div>
      )}
      <div className="pointer-events-none absolute inset-0">{children}</div>
      <MapControls onZoom={zoomBy} onReset={reset} />
    </div>
  )
}

/** Stable callback identity for handlers handed to memoized children. */
function useEvent<A extends unknown[], R>(handler: (...args: A) => R) {
  const ref = useRef(handler)
  useLayoutEffect(() => { ref.current = handler })
  return useMemo(() => (...args: A) => ref.current(...args), [])
}

const MapControls = memo(function MapControls({ onZoom, onReset }: { onZoom: (delta: number) => void; onReset: () => void }) {
  return (
    <div className="absolute right-2 bottom-2 flex flex-col overflow-hidden rounded-xl border border-line/70 bg-ink/80 backdrop-blur">
      <button type="button" onClick={() => onZoom(0.75)} aria-label="Zoom in" className="press grid size-10 place-items-center text-mist hover:text-bone"><Plus className="size-4" /></button>
      <button type="button" onClick={() => onZoom(-0.75)} aria-label="Zoom out" className="press grid size-10 place-items-center border-t border-line/70 text-mist hover:text-bone"><Minus className="size-4" /></button>
      <button type="button" onClick={onReset} aria-label="Reset view" className="press grid size-10 place-items-center border-t border-line/70 text-mist hover:text-bone"><Scan className="size-4" /></button>
    </div>
  )
})
