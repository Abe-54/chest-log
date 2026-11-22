import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { legacyRedirect } from './lib/legacy'
import { basepath, hosted } from './lib/mode'
import { retryUnlessClientError } from './lib/queries'
import { connectLive } from './lib/live'
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

const legacy = hosted ? null : legacyRedirect(location.hash)
if (legacy) history.replaceState(null, '', legacy)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
