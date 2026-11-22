import { createRootRouteWithContext, HeadContent, Link, Outlet, redirect, useMatchRoute } from '@tanstack/react-router'
import { useQuery, type QueryClient } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { isMissing, weekQuery } from '~/lib/queries'
import { base, demo, hosted } from '~/lib/mode'
import { cn } from '~/lib/cn'
import { LiveDot } from '~/components/live'
import { DISCLAIMER, TabGlyph, Wordmark, type Glyph } from '~/components/brand'

interface Tab { to: '/' | '/matches' | '/track' | '/clips'; label: string; glyph: Glyph; exact: boolean }
const week: Tab = { to: '/', label: 'Week', glyph: 'diamond', exact: true }
const matches: Tab = { to: '/matches', label: 'Matches', glyph: 'circle', exact: false }
// Clips are this PC's own recordings and Add matches reads a folder in the browser, so each build has one of them.
const tabs: Tab[] = hosted
  ? [week, matches, { to: '/track', label: 'Add matches', glyph: 'square', exact: false }]
  : [week, matches, { to: '/clips', label: 'Clips', glyph: 'square', exact: false }]

const library = (queryClient: QueryClient) => queryClient.ensureQueryData(weekQuery).catch(error => {
  if (hosted && !demo && isMissing(error)) return null
  throw error
})

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: async ({ context, location }) => {
    if (hosted && !demo && location.pathname !== '/track' && !(await library(context.queryClient))) throw redirect({ to: '/track' })
  },
  loader: ({ context }) => library(context.queryClient),
  head: () => ({ meta: [{ title: 'Chest Log' }] }),
  component: Shell,
  errorComponent: ({ error }) => (
    <main className="page py-16">
      <p className="display text-4xl text-coral">Couldn’t load the logbook</p>
      <p className="mt-3 text-mist">{error instanceof Error ? error.message : String(error)}.{hosted ? ' Reload the page to try again.' : ' The local server may be off.'}</p>
    </main>
  ),
})

function Shell() {
  // Read from the query cache, not the loader result, so the shell fills in the moment a first import lands.
  const { data: week } = useQuery(weekQuery)
  // A match replay brings its own back link on a phone, so the app bar steps aside there.
  const onMatch = !!useMatchRoute()({ to: '/matches/$matchId' })
  return (
    <div className="flex min-h-dvh flex-col">
      <HeadContent />
      <header className={cn('sticky top-0 z-40 border-b border-line-soft bg-ink-glass backdrop-blur-md', onMatch && 'max-md:hidden')}>
        <div className="page grid h-14 grid-cols-[1fr_auto] items-center gap-6 md:h-20 md:grid-cols-[1fr_auto_1fr]">
          <Link to="/" aria-label="Chest Log, your week" className="justify-self-start"><Wordmark /></Link>
          {week && (
            <nav aria-label="Main" className="hidden items-center gap-10 md:flex">
              {tabs.map(tab => (
                <Link key={tab.to} to={tab.to} activeOptions={{ exact: tab.exact, includeSearch: false }}
                  className="relative py-2 text-base font-semibold text-mist hover:text-bone data-[status=active]:text-bone data-[status=active]:after:absolute data-[status=active]:after:inset-x-0 data-[status=active]:after:-bottom-1.5 data-[status=active]:after:h-[3px] data-[status=active]:after:rounded-pill data-[status=active]:after:bg-gold">
                  {tab.label}
                </Link>
              ))}
            </nav>
          )}
          <div className="col-start-2 justify-self-end md:col-start-3">
            {!hosted ? <LiveDot /> : demo ? <CountButton /> : week && <AddButton />}
          </div>
        </div>
      </header>
      {demo && (
        <div className="border-b border-gold/25 bg-gold/10">
          <p className="page flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
            <b className="font-bold text-gold">Demo library</b>
            <span className="text-mist">Sample matches from one player, with every name replaced.</span>
            <a href={`${base}track`} className="font-semibold text-bone underline decoration-gold/60 underline-offset-4 hover:text-gold sm:ml-auto">Add your own replays</a>
          </p>
        </div>
      )}
      <div className="flex-1">
        <Outlet />
      </div>
      <footer className="page pt-10 pb-28 md:pb-10">
        <p className="border-t border-line-soft pt-6 text-[13px] text-dim">{DISCLAIMER}</p>
      </footer>
      {week && (
        <nav aria-label="Main" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line-soft bg-ink-glass pt-2.5 backdrop-blur-md md:hidden">
          <div className="grid auto-cols-fr grid-flow-col">
            {tabs.map(({ to, label, glyph, exact }) => (
              <Link key={to} to={to} activeOptions={{ exact, includeSearch: false }}
                className="press group flex min-h-12 flex-col items-center justify-center gap-1 text-xs font-semibold text-mist-2 data-[status=active]:font-bold data-[status=active]:text-bone">
                <TabGlyph shape={glyph} />
                {label}
              </Link>
            ))}
          </div>
        </nav>
      )}
      <Toaster theme="dark" position="top-center" toastOptions={{ className: '!bg-ink-3 !border-line !text-bone' }} />
    </div>
  )
}

/** Browsers cannot watch the Demos folder, so after a session the header offers the one click that adds new matches. */
function AddButton() {
  return (
    <Link to="/track" className="press display flex h-9 items-center rounded-button border-2 border-gold px-3 text-lg text-gold hover:bg-gold hover:text-ink md:h-11 md:px-4 md:text-xl">
      Add<span className="max-md:hidden">&nbsp;new matches</span>
    </Link>
  )
}

/** The demo has no folder to watch, so its header points at counting your own. */
function CountButton() {
  return (
    <a href={`${base}track`} className="press display flex h-9 items-center rounded-button border-2 border-gold px-3 text-lg text-gold hover:bg-gold hover:text-ink md:h-11 md:px-4 md:text-xl">
      Count<span className="max-md:hidden">&nbsp;my chests</span>
    </a>
  )
}
