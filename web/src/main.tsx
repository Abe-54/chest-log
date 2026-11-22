import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { legacyRedirect } from './lib/legacy'
import { basepath, demo, hosted } from './lib/mode'
import { plural } from './lib/format'
import { toast } from 'sonner'
import { retryUnlessClientError } from './lib/queries'
import { celebrationStore, connectLive } from './lib/live'
import { restoreCompanion, whenImported } from './library/companion'
import './styles.css'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: retryUnlessClientError } } })
const router = createRouter({
  routeTree,
  basepath,
  context: { queryClient },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
})

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}

// The live feed waits for load so it never competes with first paint.
if (!hosted) addEventListener('load', () => connectLive(queryClient), { once: true })

if (hosted && !demo) {
  // The companion handed over new matches: read the library again, and tell the visitor wherever they are in the app.
  whenImported(async ({ added, before, total }) => {
    await queryClient.invalidateQueries()
    await router.invalidate()
    const gained = total - (before ?? 0)
    if (gained <= 0) return
    celebrationStore.setState(() => ({ id: `companion:${total}`, from: before ?? 0, to: total, label: 'Replays counted' }))
    if (router.state.location.pathname !== '/') toast(`+${gained} chests! ${plural(added, 'new match', 'new matches')} counted.`)
  })
  void restoreCompanion()
}

const legacy = hosted ? null : legacyRedirect(location.hash)
if (legacy) history.replaceState(null, '', legacy)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
