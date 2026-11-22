import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from '@tanstack/react-store'
import { Check, Copy, FileUp, FolderOpen, Lock, Pause, Play, Trash2 } from 'lucide-react'
import { weekQuery } from '~/lib/queries'
import { base, demo, hosted } from '~/lib/mode'
import { celebrationStore } from '~/lib/live'
import { getValue } from '~/library/db'
import { canPickFolder, chooseFolder, droppedFiles, filesIn, forgetLibrary, importReplays, importStore, type ImportOutcome, type ImportState } from '~/library/import'
import { forgetWatching, resumeWatching, startWatching, stopWatching, watchStore, type WatchState } from '~/library/watch'
import { cn } from '~/lib/cn'

const DEMOS = '%LOCALAPPDATA%\\FortniteGame\\Saved\\Demos'

export const Route = createFileRoute('/track')({
  beforeLoad: () => {
    if (!hosted) throw redirect({ to: '/' })
  },
  head: () => ({ meta: [{ title: 'Auto-track · Chest Log' }] }),
  component: () => demo ? <LeaveDemo /> : <TrackPage />,
})

/** The demo is read-only and has no library of its own, so this page belongs to the real app one level up. */
function LeaveDemo() {
  useEffect(() => location.replace(`${base}track`), [])
  return <p className="mx-auto max-w-3xl px-4 py-16 text-mist">Taking you to your own library…</p>
}

function TrackPage() {
  const state = useSelector(importStore, value => value)
  const watch = useSelector(watchStore, value => value)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const router = useRouter()
  const { data: week } = useQuery({ ...weekQuery, retry: false })
  const { data: meta } = useQuery({ queryKey: ['library-meta', week?.generatedAt], queryFn: async () => (await getValue('meta')) ?? null })
  const [over, setOver] = useState(false)
  const folderInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const busy = state.phase === 'parsing' || state.phase === 'building'

  /** A first import or a hand-picked one: read the library again, celebrate what it added, and show it. */
  const finish = async (outcome: ImportOutcome | undefined) => {
    if (!outcome) return
    const { before, total } = outcome
    // The shell read the library before this import, so its loader runs again too.
    await queryClient.invalidateQueries()
    await router.invalidate()
    if (total > (before ?? 0)) celebrationStore.setState(() => ({ id: `import:${total}`, from: before ?? 0, to: total, label: before === null ? 'Chests cracked' : 'Replays counted' }))
    void navigate({ to: '/' })
  }
  const addFiles = (files: File[]) => void importReplays(files).then(finish)

  const chooseDemos = async () => {
    if (!canPickFolder) return folderInput.current?.click()
    const folder = await chooseFolder()
    if (!folder) return
    const files = await filesIn(folder)
    const outcome = await importReplays(files)
    // A folder whose matches are all still recording has no finished match yet, but it is the right one to watch.
    if (outcome || files.length > 0) startWatching(folder)
    await finish(outcome)
  }
  const fromInput = (input: HTMLInputElement) => {
    addFiles([...(input.files ?? [])])
    input.value = ''
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pt-10 pb-16 sm:pt-16"
      onDragOver={event => { event.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={event => {
        event.preventDefault()
        setOver(false)
        if (!busy) void droppedFiles(event.dataTransfer.items).then(addFiles)
      }}>
      {week
        ? <h1 className="display text-5xl sm:text-6xl">Auto-track</h1>
        : <>
            <p className="text-sm font-medium text-mist">For Fortnite on PC</p>
            <h1 className="display mt-3 text-6xl leading-[0.9] sm:text-8xl">How many chests have <span className="text-gold">you</span> cracked?</h1>
          </>}
      <p className="mt-5 max-w-xl text-lg text-mist">
        {week
          ? `Your library has ${week.realMatches.toLocaleString()} matches. New ones are added as you play.`
          : 'Point this page at your Fortnite replays. You get your chest count and every match replayed on the map.'}
      </p>
      {!week && (
        <p className="mt-3 text-sm text-mist">Just looking? <a href={`${base}demo`} className="font-semibold text-gold hover:text-bone">Try the demo library</a>.</p>
      )}

      {busy
        ? <Progress state={state} />
        : (
          <div className={cn('mt-8 grid gap-4 rounded-3xl border-2 border-dashed p-4 transition-colors duration-150 sm:grid-cols-[3fr_2fr] sm:p-5', over ? 'border-gold bg-gold/10' : 'border-line bg-ink-2')}>
            <section aria-labelledby="watch-folder" className="rounded-2xl bg-ink p-5">
              <h2 id="watch-folder" className="display text-2xl">Watch your Demos folder</h2>
              {watch.phase === 'watching'
                ? <WatchStatus state={watch} />
                : <>
                    <p className="mt-2 text-sm text-mist">
                      {canPickFolder
                        ? 'Pick it once. While this tab is open, it checks for new matches every 30 seconds and counts each one when Fortnite finishes writing it.'
                        : 'Pick the folder, or drop it anywhere on this page. Every match in it is read.'}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {watch.phase === 'paused' && (
                        <button type="button" onClick={() => void resumeWatching()}
                          className="press inline-flex h-12 items-center gap-2 rounded-full bg-gold px-5 font-semibold text-ink hover:bg-bone">
                          <Play className="size-4" fill="currentColor" aria-hidden /> Resume “{watch.folder}”
                        </button>
                      )}
                      <button type="button" onClick={() => void chooseDemos()}
                        className={cn('press inline-flex h-12 items-center gap-2 rounded-full px-5 font-semibold', watch.phase === 'paused' ? 'border border-line hover:border-mist' : 'bg-gold text-ink hover:bg-bone')}>
                        <FolderOpen className="size-4" aria-hidden /> {watch.phase === 'paused' ? 'Choose another folder' : 'Choose Demos folder'}
                      </button>
                    </div>
                    {watch.phase === 'paused' && watch.reason && <p role="alert" className="mt-3 text-sm text-coral">{watch.reason}</p>}
                    {!canPickFolder && <p className="mt-3 text-xs text-dim">Firefox and Safari can’t keep a folder between visits or watch it, so pick it again to add new matches. Chrome or Edge can track automatically.</p>}
                  </>}
            </section>
            <section aria-labelledby="one-replay" className="rounded-2xl bg-ink p-5">
              <h2 id="one-replay" className="display text-2xl">Add a replay</h2>
              <p className="mt-2 text-sm text-mist">Drop a <code className="font-mono text-bone">.replay</code> file anywhere on this page, or choose one. A few at once work too.</p>
              <button type="button" onClick={() => fileInput.current?.click()}
                className="press mt-4 inline-flex h-12 items-center gap-2 rounded-full border border-line px-5 font-semibold hover:border-mist">
                <FileUp className="size-4" aria-hidden /> Choose a replay
              </button>
            </section>
            <input ref={folderInput} type="file" hidden multiple {...{ webkitdirectory: '' }} onChange={event => fromInput(event.currentTarget)} />
            <input ref={fileInput} type="file" hidden multiple accept=".replay" onChange={event => fromInput(event.currentTarget)} />
            {state.phase === 'error' && <p role="alert" className="rounded-xl bg-coral/15 px-4 py-3 text-sm text-coral sm:col-span-2">{state.message}</p>}
          </div>
        )}

      <p className="mt-5 flex items-start gap-2.5 text-sm text-mist">
        <Lock className="mt-0.5 size-4 shrink-0 text-kelp" aria-hidden />
        Your replay files never leave this device. They are read by this browser, on this computer. There is no upload and no account.
      </p>

      <section className="mt-12 border-t border-line/70 pt-8">
        <h2 className="display text-3xl">Where Fortnite keeps replays</h2>
        <ol className="mt-4 space-y-4 text-mist">
          <Step n={1}>Fortnite only saves replays while <b className="text-bone">Record Replays</b> is turned on in its settings.</Step>
          <Step n={2}>
            Choose the Demos folder. Paste this into the address bar of the window that opens, press Enter, then select the folder.
            <CopyLine text={DEMOS} />
          </Step>
          <Step n={3}>{canPickFolder ? <>Leave this tab open while you play. New matches show up here and in your library.</> : <>Come back after you play and pick the folder again.</>}</Step>
        </ol>
        <p className="mt-5 text-sm text-dim">Replays only exist on PC. Fortnite on console and phone does not save them as files.</p>
      </section>

      {week && (
        <section className="mt-12 border-t border-line/70 pt-8">
          <h2 className="display text-3xl">Your data</h2>
          {meta && meta.failed.length > 0 && (
            <details className="mt-4 text-sm text-mist">
              <summary className="cursor-pointer">{meta.failed.length} {meta.failed.length === 1 ? 'file' : 'files'} could not be read</summary>
              <ul className="mt-2 space-y-1 text-dim">
                {meta.failed.map(file => <li key={file.name}><span className="text-mist">{file.name}</span> · {file.error}</li>)}
              </ul>
            </details>
          )}
          <p className="mt-4 max-w-xl text-sm text-mist">Everything this site knows about your matches is stored in this browser. Deleting it here removes it for good. Your replay files are not touched.</p>
          <button type="button"
            onClick={() => { if (confirm('Delete your Chest Log library from this browser?')) void forgetLibrary().then(forgetWatching).then(() => queryClient.resetQueries()).then(() => router.invalidate()) }}
            className="press mt-4 inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold text-coral hover:border-coral">
            <Trash2 className="size-4" aria-hidden /> Delete my library
          </button>
        </section>
      )}

      <p className="mt-12 text-xs text-dim">A fan project. Not affiliated with or endorsed by Epic Games.</p>
    </main>
  )
}

function useNow(everyMs: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(timer)
  }, [everyMs])
  return now
}

function WatchStatus({ state }: { state: Extract<WatchState, { phase: 'watching' }> }) {
  const now = useNow(1000)
  const checked = state.checkedAt === null ? 'checking now' : `last checked ${Math.max(0, Math.round((now - state.checkedAt) / 1000))}s ago`
  return (
    <div role="status" className="mt-3">
      <p className="flex items-center gap-2.5 text-sm">
        <span aria-hidden className="relative flex size-2.5 shrink-0">
          <span className="absolute inline-flex size-full rounded-full bg-kelp opacity-60 motion-safe:animate-ping" />
          <span className="relative inline-flex size-2.5 rounded-full bg-kelp" />
        </span>
        <span className="min-w-0 truncate"><b>Watching {state.folder}</b> <span className="num text-mist">· {checked} · {state.found} new</span></span>
      </p>
      <p className="mt-2 text-sm text-mist">Leave this tab open while you play. A match is counted once Fortnite finishes writing it.</p>
      <button type="button" onClick={stopWatching}
        className="press mt-4 inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold hover:border-mist">
        <Pause className="size-4" aria-hidden /> Stop watching
      </button>
    </div>
  )
}

function Progress({ state }: { state: Extract<ImportState, { phase: 'parsing' | 'building' }> }) {
  const building = state.phase === 'building'
  const done = building ? state.total : state.done
  return (
    <section role="status" className="mt-8 overflow-hidden rounded-3xl border border-line/60 bg-ink-2">
      <div className="p-6 sm:p-8">
        <p className="display num text-6xl text-gold sm:text-7xl">{done}<span className="text-mist"> / {state.total}</span></p>
        <p className="mt-2 font-semibold">{building ? 'Adding it all up' : 'Reading your matches'}</p>
        <p className="mt-1 truncate text-sm text-mist">
          {building ? 'Matching loot to chests across every match.' : state.current ?? 'Starting the replay reader.'}
        </p>
        {state.failed > 0 && <p className="mt-1 text-sm text-coral">{state.failed} could not be read.</p>}
      </div>
      <div aria-hidden className="h-1.5 bg-ink-3">
        {building
          ? <div className="h-full w-1/3 bg-gold motion-safe:animate-[scan_1.1s_var(--ease-in-out)_infinite]" />
          : <div className="h-full bg-gold transition-[width] duration-300 ease-out" style={{ width: `${(done / state.total) * 100}%` }} />}
      </div>
      <p className="border-t border-line/60 px-6 py-3 text-xs text-dim sm:px-8">About two seconds a match. Keep this tab open.</p>
    </section>
  )
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="display num flex size-8 shrink-0 items-center justify-center rounded-full bg-ink-3 text-lg text-gold">{n}</span>
      <div className="min-w-0 flex-1 pt-1">{children}</div>
    </li>
  )
}

function CopyLine({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <span className="mt-2 flex items-center gap-2 rounded-xl bg-ink-3 py-1.5 pr-1.5 pl-3">
      <code className="min-w-0 flex-1 truncate font-mono text-sm text-bone">{text}</code>
      <button type="button" aria-label="Copy the folder path"
        onClick={() => void navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) })}
        className="press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-ink px-2.5 text-xs font-semibold text-bone hover:bg-ink-2">
        {copied ? <><Check className="size-3.5 text-kelp" aria-hidden />Copied</> : <><Copy className="size-3.5" aria-hidden />Copy</>}
      </button>
    </span>
  )
}
