import { createFileRoute, redirect } from '@tanstack/react-router'
import { hosted } from '~/lib/mode'

/** The page was once called Add replays; old links still land on it. */
export const Route = createFileRoute('/import')({
  beforeLoad: () => {
    throw redirect({ to: hosted ? '/track' : '/', replace: true })
  },
})
