import { useEffect, useMemo, useRef, useState } from 'react'
import { createFileRoute, Link, notFound } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Container, defineTextTrack, useActiveTextCues, useCreateTextTrack, type TextCueInit } from '@videojs/react'
import { Video, VideoPlayer, VideoSkin, usePlayer } from '@videojs/react/video'
import '@videojs/react/video/skin.css'
import { ChevronLeft, ChevronRight, Gem, Map as MapIcon, Package, Share2, Skull, Swords } from 'lucide-react'
import type { Clip, ClipEvent } from '~/data'
import { clipsQuery, weekQuery } from '~/lib/queries'
import { clock, shortDate, timeOfDay } from '~/lib/format'
import { shareLink } from '~/lib/share'
import { cn } from '~/lib/cn'
import { captionWindow, isChestEvent, matchSiblings } from '~/features/clips/model'

interface Search { t?: number }
const annotations = defineTextTrack<ClipEvent>({ kind: 'metadata', label: 'annotations' })
const toneClass = { gold: 'bg-gold text-ink', coral: 'bg-coral text-ink', bone: 'bg-bone text-ink', mist: 'bg-mist text-ink' } as const
const tenths = (time: number) => Math.round(time * 10) / 10

function icon(event: ClipEvent) {
  if (isChestEvent(event)) return Gem
  if (event.kind === 'knock') return Swords
  if (event.kind === 'elimination' || event.kind === 'death') return Skull
  return Package
}

function tone(event: ClipEvent): keyof typeof toneClass {
  if (event.kind === 'death') return 'coral'
  if (isChestEvent(event)) return 'gold'
  if (event.kind === 'knock' || event.kind === 'elimination') return event.mine ? 'bone' : 'coral'
  return 'mist'
}

export const Route = createFileRoute('/clips/$clipId')({
  validateSearch: (raw: Record<string, unknown>): Search => {
    const t = Number(raw.t)
    return { t: raw.t !== undefined && Number.isFinite(t) && t > 0 ? t : undefined }
  },
  loader: async ({ context, params }) => {
    const { clips } = await context.queryClient.ensureQueryData(clipsQuery)
    const clip = clips.find(candidate => candidate.id === params.clipId)
    if (!clip) throw notFound()
    return { title: clip.label }
  },
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.title ?? 'Clip'} · Chest Log` }] }),
  component: ClipPage,
  notFoundComponent: () => (
    <main className="mx-auto max-w-xl px-4 py-16">
      <p className="display text-4xl">No such clip</p>
      <Link to="/clips" className="mt-4 inline-block text-gold">Back to clips</Link>
    </main>
  ),
})

function ClipPage() {
  const { clipId } = Route.useParams()
  const { t } = Route.useSearch()
  const { data } = useSuspenseQuery(clipsQuery)
  const { data: week } = useSuspenseQuery(weekQuery)
  const clip = data.clips.find(candidate => candidate.id === clipId)!
  const zone = week.matches.find(match => match.id === clip.matchId)?.zone

  return (
    <main className="mx-auto max-w-5xl px-4 pt-3 lg:pt-6">
      <VideoPlayer key={clip.id}>
        <ClipView clip={clip} clips={data.clips} tolerance={data.tolerance} zone={zone} start={t} />
      </VideoPlayer>
    </main>
  )
}

function ClipView({ clip, clips, tolerance, zone, start }: { clip: Clip; clips: Clip[]; tolerance: number; zone?: string | null; start?: number }) {
  const player = usePlayer()
  const duration = usePlayer(state => state.duration) || clip.duration
  const time = usePlayer(state => state.currentTime)
  const commit = useClipUrlTime(start)
  const siblings = matchSiblings(clips, clip)
  const [source] = useState(() => start === undefined ? clip.video : `${clip.video}#t=${start}`)
  const cues = useMemo<TextCueInit<ClipEvent>[]>(() => clip.events.map(event => {
    const { start: startTime, end: endTime } = captionWindow(event, tolerance, clip.duration)
    return { startTime, endTime, value: event }
  }), [clip, tolerance])
  useCreateTextTrack(annotations, { cues })


  const jump = (seconds: number) => {
    player.seek(seconds)
    commit(seconds)
  }
  const shareUrl = () => {
    const url = new URL(location.href)
    url.searchParams.set('t', String(tenths(time)))
    return url.href
  }

  return (
    <>
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <Link to="/clips" className="text-xs font-semibold tracking-wide text-mist uppercase hover:text-bone">Clips</Link>
          <h1 className="display mt-1 text-[2.1rem] sm:text-5xl">{clip.label}</h1>
          <p className="mt-1 text-sm text-mist">{zone ?? 'Match'} · {shortDate(clip.localStamp)}, {timeOfDay(clip.localStamp)} · clip {siblings.index + 1} of {siblings.count}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 pt-5">
          <Step clip={siblings.previous} label="Previous clip" Icon={ChevronLeft} />
          <Step clip={siblings.next} label="Next clip" Icon={ChevronRight} />
          <button type="button" onClick={() => shareLink(`${clip.label} clip`, shareUrl())} aria-label="Share this moment"
            className="press ml-1 grid size-10 place-items-center rounded-full bg-gold text-ink hover:bg-gold-deep"><Share2 className="size-4" strokeWidth={2.5} /></button>
        </div>
      </header>

      <Container className="relative mt-4 overflow-hidden rounded-panel border border-line bg-ink">
        <VideoSkin style={{ width: '100%', aspectRatio: '43 / 18', ['--media-accent-color' as string]: 'oklch(0.83 0.15 80)' }}>
          <Video src={source} poster={clip.poster} playsInline preload="metadata" />
        </VideoSkin>
        <Caption />
      </Container>

      <div className="relative mt-3 h-9 rounded-lg bg-ink-2" role="group" aria-label="Annotations on the clip timeline">
        <div className="absolute inset-y-0 left-0 rounded-lg bg-gold/12" style={{ width: `${(time / duration) * 100}%` }} />
        {clip.events.map((event, i) => {
          const Icon = icon(event)
          return (
            <button key={i} type="button" onClick={() => jump(captionWindow(event, tolerance, duration).start)}
              aria-label={`Jump to ${event.caption} at ${clock(event.t)}`} title={event.caption}
              className={cn('press absolute top-1/2 grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full ring-2 ring-ink', toneClass[tone(event)])}
              style={{ left: `${(event.t / duration) * 100}%` }}>
              <Icon className="size-3.5" strokeWidth={2.5} />
            </button>
          )
        })}
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
        <section>
          <h2 className="text-sm font-semibold text-mist">In this clip</h2>
          <ol className="mt-2 divide-y divide-line/60">
            {clip.events.map((event, i) => {
              const Icon = icon(event)
              const window = captionWindow(event, tolerance, duration)
              const live = time >= window.start && time <= window.end
              return (
                <li key={i}>
                  <button type="button" onClick={() => jump(window.start)} aria-current={live ? 'true' : undefined}
                    className={cn('press flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left hover:bg-ink-2', live && 'bg-ink-2')}>
                    <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg', toneClass[tone(event)])}><Icon className="size-4" /></span>
                    <span className="min-w-0 flex-1 text-sm">{event.caption}</span>
                    <time className="num text-xs text-mist">{clock(event.t)}</time>
                  </button>
                </li>
              )
            })}
          </ol>
        </section>
        <aside>
          <Link to="/matches/$matchId" params={{ matchId: clip.matchId }} search={{ t: tenths(clip.replayStart + time) }}
            className="press flex items-center gap-3 rounded-panel bg-ink-2 p-4 hover:bg-ink-3">
            <MapIcon className="size-5 text-gold" />
            <span className="text-sm"><b className="block">See this moment on the map</b><span className="num text-mist">Replay at {clock(clip.replayStart + time)}</span></span>
          </Link>
          <p className="mt-3 text-xs text-dim">Clips line up with the replay to within about {tolerance} s, so markers can sit a beat early or late.</p>
        </aside>
      </div>
    </>
  )
}

/** Keeps ?t= and the player in step: external link changes seek, and a pause or finished seek writes the time back. */
function useClipUrlTime(start?: number) {
  const player = usePlayer()
  const ready = usePlayer(state => state.duration) > 0
  const time = usePlayer(state => state.currentTime)
  const paused = usePlayer(state => state.paused)
  const started = usePlayer(state => state.started)
  const seeking = usePlayer(state => state.seeking)
  const navigate = Route.useNavigate()
  const wasSeeking = useRef(false)
  const target = start ?? 0
  const commit = (seconds: number) => navigate({ search: { t: tenths(seconds) || undefined }, replace: true, resetScroll: false })

  useEffect(() => {
    if (ready && Math.abs(time - target) > 0.3) player.seek(target)
  }, [target, ready])
  useEffect(() => {
    if (started && !seeking && (paused || wasSeeking.current) && tenths(time) !== target) commit(time)
    wasSeeking.current = seeking
  }, [paused, seeking])
  return commit
}

function Caption() {
  const [cue] = useActiveTextCues(annotations)
  if (!cue?.value) return null
  const event = cue.value
  const Icon = icon(event)
  return (
    <p className="pointer-events-none absolute top-3 left-3 flex max-w-[80%] items-center gap-2 rounded-full bg-ink/85 py-1.5 pr-3.5 pl-1.5 text-sm font-semibold backdrop-blur [animation:caption-in_180ms_var(--ease-out)]">
      <span className={cn('grid size-6 place-items-center rounded-full', toneClass[tone(event)])}><Icon className="size-3.5" /></span>
      <span className="truncate">{event.caption}</span>
    </p>
  )
}

function Step({ clip, label, Icon }: { clip?: Clip; label: string; Icon: typeof ChevronLeft }) {
  const style = 'press grid size-10 place-items-center rounded-full border border-line text-mist'
  return clip
    ? <Link to="/clips/$clipId" params={{ clipId: clip.id }} aria-label={label} className={cn(style, 'hover:text-bone')}><Icon className="size-4" /></Link>
    : <span aria-hidden className={cn(style, 'opacity-30')}><Icon className="size-4" /></span>
}
