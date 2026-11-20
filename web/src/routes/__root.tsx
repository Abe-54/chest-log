import { createRootRouteWithContext, HeadContent, Link, Outlet, redirect, useRouterState } from '@tanstack/react-router'
import { useQuery, type QueryClient } from '@tanstack/react-query'
import { Clapperboard, Gem, PartyPopper, Plus, Route as RouteIcon, Swords } from 'lucide-react'
import { Toaster } from 'sonner'
import { hosted, isMissing, weekQuery } from '~/lib/queries'
import { flags } from '~/lib/flags'
import { markLibrary } from '~/library/import'
import { site } from '~/seo/content'
import { cn } from '~/lib/cn'
import { LiveDot } from '~/components/live'

const everyTab = [
  { to: '/', label: 'Week', icon: Gem, exact: true },
  { to: '/matches', label: 'Matches', icon: Swords, exact: false },
  { to: '/routes', label: 'Routes', icon: RouteIcon, exact: false },
  { to: '/clips', label: 'Clips', icon: Clapperboard, exact: false },
  { to: '/wrapped', label: 'Wrapped', icon: PartyPopper, exact: false },
] as const
// Clips are this PC's own recordings, so a hosted library has no Clips page.
const tabs = everyTab.filter(tab => (!hosted || tab.to !== '/clips') && (flags.wrapped || tab.to !== '/wrapped'))

const library = async (queryClient: QueryClient) => {
  const week = await queryClient.ensureQueryData(weekQuery).catch(error => {
    if (hosted && isMissing(error)) return null
    throw error
  })
  if (hosted) markLibrary(week !== null)
  return week
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: async ({ context, location }) => {
    // Without a library the public site has one page, the front page, where a visitor adds replays.
    if (hosted && location.pathname !== '/' && !(await library(context.queryClient))) throw redirect({ to: '/' })
  },
  loader: ({ context }) => library(context.queryClient),
  // The public front page keeps the title its HTML shipped with; other pages set their own.
  head: () => ({ meta: [{ title: hosted ? site.title : 'Chest Log' }] }),
  component: Shell,
  errorComponent: ({ error }) => (
    <main className="mx-auto max-w-xl px-4 py-16">
      <p className="display text-4xl text-coral">Couldn’t load the logbook</p>
      <p className="mt-3 text-mist">{error instanceof Error ? error.message : String(error)}.{hosted ? ' Reload the page to try again.' : ' The local server may be off.'}</p>
    </main>
  ),
})

function Shell() {
  // Read from the query cache, not the loader result, so the shell fills in the moment a first import lands.
  const { data: week } = useQuery(weekQuery)
  const immersive = useRouterState({ select: state => state.location.pathname.startsWith('/wrapped') })
  return (
    <div className="min-h-dvh">
      <HeadContent />
      {!immersive && (
        <header className="sticky top-0 z-40 border-b border-line/60 bg-ink/85 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4">
            <Link to="/" className="display-wide text-[15px] text-gold">CHEST LOG</Link>
            <nav aria-label="Main" className="hidden flex-1 items-center gap-1 md:flex">
              {week && tabs.map(tab => (
                <Link key={tab.to} to={tab.to} activeOptions={{ exact: tab.exact, includeSearch: false }}
                  className="press rounded-full px-3.5 py-1.5 text-sm font-medium text-mist hover:text-bone data-[status=active]:bg-ink-3 data-[status=active]:text-bone">
                  {tab.label}
                </Link>
              ))}
            </nav>
            <span className="ml-auto flex items-center gap-2 text-sm text-mist">
              {hosted
                ? week && <Link to="/import" className="press flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-[13px] font-semibold text-bone hover:border-mist"><Plus className="size-3.5" strokeWidth={2.6} aria-hidden />Add replays</Link>
                : <LiveDot />}
              {week?.player}
            </span>
          </div>
        </header>
      )}
      <div className={cn(!immersive && 'pb-24 md:pb-10')}>
        <Outlet />
      </div>
      {!immersive && week && (
        <nav aria-label="Main" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line/60 bg-ink/92 backdrop-blur-md md:hidden">
          <div className="grid auto-cols-fr grid-flow-col">
            {tabs.map(({ to, label, icon: Icon, exact }) => (
              <Link key={to} to={to} activeOptions={{ exact, includeSearch: false }}
                className="press group flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-dim data-[status=active]:text-gold">
                <Icon className="size-5" strokeWidth={2.2} aria-hidden />
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
