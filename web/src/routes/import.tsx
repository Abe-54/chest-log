import { createFileRoute, redirect } from '@tanstack/react-router'
import { hosted } from '~/lib/mode'

/** The page was called Add replays before it became Auto-track; old links still land on it. */
export const Route = createFileRoute('/import')({
  beforeLoad: () => {
    throw redirect({ to: hosted ? '/track' : '/', replace: true })
  },
})
