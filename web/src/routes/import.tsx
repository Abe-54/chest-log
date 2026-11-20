import { createFileRoute, redirect } from '@tanstack/react-router'
import { hosted } from '~/lib/queries'
import { ImportPage } from '~/features/import/page'

export const Route = createFileRoute('/import')({
  beforeLoad: () => {
    if (!hosted) throw redirect({ to: '/' })
  },
  head: () => ({ meta: [{ title: 'Add replays · Chest Log' }] }),
  component: ImportPage,
})
