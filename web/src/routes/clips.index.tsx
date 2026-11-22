import { useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { Gem } from 'lucide-react'
import { clipsQuery, weekQuery } from '~/lib/queries'
import { clock, shortDate, timeOfDay } from '~/lib/format'
import { galleryGroups, hasChest } from '~/features/clips/model'

interface Search { kind?: string; chests?: true }

export const Route = createFileRoute('/clips/')({
  validateSearch: (raw: Record<string, unknown>): Search => ({
    kind: typeof raw.kind === 'string' && raw.kind ? raw.kind : undefined,
    chests: raw.chests === true || raw.chests === 'true' ? true : undefined,
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(clipsQuery),
  head: () => ({ meta: [{ title: 'Clips · Chest Log' }] }),
  component: ClipsPage,
})

function ClipsPage() {
  const { data } = useSuspenseQuery(clipsQuery)
  const { data: week } = useSuspenseQuery(weekQuery)
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const kinds = useMemo(() => [...new Set(data.clips.map(clip => clip.label))], [data])
  const zones = useMemo(() => new Map(week.matches.map(match => [match.id, match.zone])), [week])
  const groups = galleryGroups(data.clips, search)
  const set = (patch: Search) => navigate({ search: previous => ({ ...previous, ...patch }), replace: true })

  return (
    <main className="page pt-8">
      <h1 className="display text-5xl sm:text-6xl">Clips</h1>
      <p className="mt-2 max-w-xl text-mist">{data.clips.length} highlights your recorder saved, each lined up with its replay so you can jump to the same moment on the map.</p>

      <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]" role="group" aria-label="Filter clips">
        <Chip active={!search.kind} onClick={() => set({ kind: undefined })}>All</Chip>
        {kinds.map(kind => <Chip key={kind} active={search.kind === kind} onClick={() => set({ kind: search.kind === kind ? undefined : kind })}>{kind}</Chip>)}
        <Chip active={!!search.chests} onClick={() => set({ chests: search.chests ? undefined : true })}><Gem className="size-3.5" /> With a chest</Chip>
      </div>

      {groups.length === 0 && <p className="py-16 text-mist">No clips match those filters.</p>}
      {groups.map(({ matchId, clips }) => (
        <section key={matchId} className="mt-8">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h2 className="font-semibold">{zones.get(matchId) ?? 'Match'} <span className="font-normal text-mist">· {shortDate(clips[0].localStamp)}</span></h2>
            <Link to="/matches/$matchId" params={{ matchId }} className="shrink-0 text-sm text-gold hover:text-bone">Replay match</Link>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clips.map(clip => (
              <li key={clip.id}>
                <Link to="/clips/$clipId" params={{ clipId: clip.id }} className="group block overflow-hidden rounded-card bg-ink-2 hover:bg-ink-3">
                  <span className="relative block">
                    <img src={clip.poster} alt="" loading="lazy" decoding="async" width={1720} height={720} className="aspect-[43/18] w-full object-cover" />
                    <span className="num absolute right-2 bottom-2 rounded-md bg-ink/80 px-1.5 py-0.5 text-xs">{clock(clip.duration)}</span>
                    {hasChest(clip) && <span className="absolute top-2 left-2 grid size-7 place-items-center rounded-full bg-gold text-ink"><Gem className="size-3.5" aria-label="Has a chest opening" /></span>}
                  </span>
                  <span className="flex items-baseline justify-between gap-2 px-3 py-2.5">
                    <span className="font-semibold">{clip.label}</span>
                    <span className="num text-sm text-mist">{timeOfDay(clip.localStamp)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className="press flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-line px-3.5 text-sm text-mist aria-pressed:border-line-strong aria-pressed:bg-ink-3 aria-pressed:text-bone">
      {children}
    </button>
  )
}
