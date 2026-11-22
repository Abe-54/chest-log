import { createFileRoute, Link } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { createColumnHelper, createSortedRowModel, rowSortingFeature, sortFn_basic, tableFeatures, useTable, type SortingState } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, Clapperboard } from 'lucide-react'
import type { MatchRow } from '~/data'
import { weekQuery } from '~/lib/queries'
import { clock, placeLabel, plural, shortDate, timeOfDay } from '~/lib/format'
import { cn } from '~/lib/cn'

const sortKeys = ['startUtc', 'chests', 'placement', 'kills', 'firstChest'] as const
type SortKey = typeof sortKeys[number]
interface Search { sort?: SortKey; flip?: true }

const features = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel(), sortFns: { basic: sortFn_basic } })
const helper = createColumnHelper<typeof features, MatchRow>()
const columns = helper.columns([
  helper.accessor('startUtc', { header: 'When', sortFn: 'basic' }),
  helper.accessor('chests', { header: 'Chests', sortFn: 'basic' }),
  helper.accessor('placement', { header: 'Finish', sortFn: 'basic', sortUndefined: 'last' }),
  helper.accessor('kills', { header: 'Kills', sortFn: 'basic' }),
  helper.accessor('firstChest', { header: 'First chest', sortFn: 'basic' }),
])
const labels: Record<SortKey, string> = { startUtc: 'Date', chests: 'Chests', placement: 'Finish', kills: 'Kills', firstChest: 'First chest' }
const naturalAscending: Record<SortKey, boolean> = { startUtc: false, chests: false, placement: true, kills: false, firstChest: true }

export const Route = createFileRoute('/matches/')({
  validateSearch: (raw: Record<string, unknown>): Search => ({
    sort: sortKeys.includes(raw.sort as SortKey) && raw.sort !== 'startUtc' ? raw.sort as SortKey : undefined,
    flip: raw.flip === true || raw.flip === 'true' ? true : undefined,
  }),
  head: () => ({ meta: [{ title: 'Matches · Chest Log' }] }),
  component: MatchesPage,
})

function MatchesPage() {
  const { data: week } = useSuspenseQuery(weekQuery)
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const key = search.sort ?? 'startUtc'
  const ascending = naturalAscending[key] !== !!search.flip
  const sorting: SortingState = [{ id: key, desc: !ascending }]
  const table = useTable({
    features, columns, data: week.matches,
    state: { sorting },
    onSortingChange: () => undefined,
  })
  const rows = table.getRowModel().rows.map(row => row.original)
  const choose = (next: SortKey) => navigate({
    search: { sort: next === 'startUtc' ? undefined : next, flip: next === key && !search.flip ? true : undefined },
    replace: true,
  })
  const byDay = key === 'startUtc'

  return (
    <main className="page pt-8 md:pt-14">
      <h1 className="display text-[44px] md:text-display-lg">Matches</h1>
      <p className="mt-3 text-[15px] text-mist md:text-[17px]">{week.realMatches} full matches and {week.stubs} partial recording. Pick one to replay it on the map.</p>
      <div className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0" role="group" aria-label="Sort matches">
        {sortKeys.map(option => {
          const active = option === key
          const Arrow = ascending ? ArrowUp : ArrowDown
          return (
            <button key={option} type="button" aria-pressed={active} onClick={() => choose(option)}
              className="press flex h-[34px] shrink-0 items-center gap-1.5 rounded-pill border border-line px-3.5 text-sm font-semibold text-mist-2 aria-pressed:border-line-strong aria-pressed:bg-ink-3 aria-pressed:font-bold aria-pressed:text-bone">
              {labels[option]}{active && <Arrow className="size-3.5" />}
            </button>
          )
        })}
      </div>
      <ol className="mt-4 max-w-4xl">
        {rows.map((match, i) => {
          const day = shortDate(match.startUtc)
          const newDay = byDay && (i === 0 || shortDate(rows[i - 1].startUtc) !== day)
          return (
            <li key={match.id}>
              {newDay && <h2 className="caps sticky top-14 z-10 -mx-4 border-b border-line-soft bg-ink-glass px-4 pt-5 pb-2 text-dim backdrop-blur md:top-20">{day}</h2>}
              <MatchListRow match={match} day={day} byDay={byDay} />
            </li>
          )
        })}
      </ol>
    </main>
  )
}

function MatchListRow({ match, day, byDay }: { match: MatchRow; day: string; byDay: boolean }) {
  const mates = match.squad.filter(member => !member.you)
  return (
    <Link to="/matches/$matchId" params={{ matchId: match.id }}
      className="press -mx-2 flex items-center gap-4 rounded-card px-2 py-3 hover:bg-ink-2">
      <span className={cn('display num w-14 shrink-0 text-right text-4xl', match.stub ? 'text-dim' : 'text-gold')}>{match.chests}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-bold">{match.stub ? 'Partial recording' : match.zone ?? 'Unknown drop'}</span>
        <span className="num block truncate text-sm text-mist-2">
          {byDay ? timeOfDay(match.startUtc) : `${day}, ${timeOfDay(match.startUtc)}`}
          {match.firstChest !== null && ` · first chest ${clock(match.firstChest)}`}
        </span>
        {mates.length > 0 && (
          <span className="block truncate text-sm text-dim">
            with {mates.map(mate => mate.name).join(', ')} · <span className="num">squad {match.squad.reduce((sum, member) => sum + member.chests, 0)}</span>
          </span>
        )}
      </span>
      {match.clips > 0 && <Clapperboard aria-label={`${match.clips} clips`} className="size-4 shrink-0 text-kelp" />}
      <span className="num w-20 shrink-0 text-right text-sm">
        <span className={cn('block font-bold', match.placement === 1 && 'text-gold')}>{placeLabel(match.placement)}</span>
        <span className="block text-mist">{plural(match.kills ?? 0, "kill")}</span>
      </span>
    </Link>
  )
}
