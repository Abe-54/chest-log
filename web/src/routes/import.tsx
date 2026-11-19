import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from '@tanstack/react-store'
import { Check, Copy, FolderOpen, FolderSync, Lock, Trash2, Upload } from 'lucide-react'
import { hosted, weekQuery } from '~/lib/queries'
import { celebrationStore } from '~/lib/live'
import { getValue } from '~/library/db'
import { canPickFolder, droppedFiles, forgetLibrary, importReplays, importStore, pickFolder, rememberedFolder, rescanFolder, type ImportState } from '~/library/import'
import { cn } from '~/lib/cn'

const DEMOS = '%LOCALAPPDATA%\\FortniteGame\\Saved\\Demos'

export const Route = createFileRoute('/import')({
  beforeLoad: () => {
    if (!hosted) throw redirect({ to: '/' })
  },
  head: () => ({ meta: [{ title: 'Add replays · Chest Log' }] }),
  component: ImportPage,
})

function ImportPage() {
  const state = useSelector(importStore, value => value)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const router = useRouter()
  const { data: week } = useQuery({ ...weekQuery, retry: false })
  const { data: meta } = useQuery({ queryKey: ['library-meta', week?.generatedAt], queryFn: async () => (await getValue('meta')) ?? null })
  const { data: folder } = useQuery({ queryKey: ['library-folder', week?.generatedAt], queryFn: rememberedFolder })
  const [over, setOver] = useState(false)
  const folderInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const busy = state.phase === 'parsing' || state.phase === 'building'

  useEffect(() => {
    if (state.phase !== 'done') return
    const { before, total } = state
    importStore.setState(() => ({ phase: 'idle' }))
    // The shell read the library before this import, so its loader runs again too.
    void queryClient.invalidateQueries().then(() => router.invalidate()).then(() => {
      if (total > (before ?? 0)) celebrationStore.setState(() => ({ id: `import:${total}`, from: before ?? 0, to: total, label: before === null ? 'Chests cracked' : 'Replays counted' }))
      void navigate({ to: '/' })
    })
  }, [state, queryClient, navigate, router])

  const chooseFolder = () => canPickFolder ? void pickFolder() : folderInput.current?.click()
  const fromInput = (input: HTMLInputElement) => {
    void importReplays([...(input.files ?? [])])
    input.value = ''
  }

  return (
    <main className="mx-auto max-w-3xl px-4 pt-10 pb-16 sm:pt-16"
      onDragOver={event => { event.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={event => {
        event.preventDefault()
        setOver(false)
        if (!busy) void droppedFiles(event.dataTransfer.items).then(importReplays)
      }}>
      {week
        ? <h1 className="display text-5xl sm:text-6xl">Add replays</h1>
        : <>
            <p className="text-sm font-medium text-mist">For Fortnite on PC</p>
            <h1 className="display mt-3 text-6xl leading-[0.9] sm:text-8xl">How many chests have <span className="text-gold">you</span> cracked?</h1>
          </>}
      <p className="mt-5 max-w-xl text-lg text-mist">
        {week
          ? `Your library has ${week.realMatches.toLocaleString()} matches. Pick your replay folder again and only the new ones are read.`
          : 'Point this page at your Fortnite replays. You get your chest count, every match replayed on the map, your best drop spots and a Wrapped recap.'}
      </p>

      {busy
        ? <Progress state={state} />
        : (
          <div className={cn('mt-8 rounded-3xl border-2 border-dashed p-6 transition-colors duration-150 sm:p-8', over ? 'border-gold bg-gold/10' : 'border-line bg-ink-2')}>
            <div className="flex flex-wrap gap-3">
              {week && folder && canPickFolder && (
                <button type="button" onClick={() => void rescanFolder()} className="press inline-flex h-12 items-center gap-2 rounded-full bg-gold px-5 font-semibold text-ink hover:bg-bone">
                  <FolderSync className="size-4" aria-hidden /> Rescan “{folder}”
                </button>
              )}
              <button type="button" onClick={chooseFolder}
                className={cn('press inline-flex h-12 items-center gap-2 rounded-full px-5 font-semibold', week && folder && canPickFolder ? 'border border-line hover:border-mist' : 'bg-gold text-ink hover:bg-bone')}>
                <FolderOpen className="size-4" aria-hidden /> Choose your replay folder
              </button>
              <button type="button" onClick={() => fileInput.current?.click()} className="press inline-flex h-12 items-center gap-2 rounded-full border border-line px-5 font-semibold hover:border-mist">
                <Upload className="size-4" aria-hidden /> Pick replay files
              </button>
            </div>
            <p className="mt-4 text-sm text-mist">Or drop the folder or files anywhere on this page.</p>
            <input ref={folderInput} type="file" hidden multiple {...{ webkitdirectory: '' }} onChange={event => fromInput(event.currentTarget)} />
            <input ref={fileInput} type="file" hidden multiple accept=".replay" onChange={event => fromInput(event.currentTarget)} />
            {state.phase === 'error' && <p role="alert" className="mt-4 rounded-xl bg-coral/15 px-4 py-3 text-sm text-coral">{state.message}</p>}
          </div>
        )}

      <p className="mt-5 flex items-start gap-2.5 text-sm text-mist">
        <Lock className="mt-0.5 size-4 shrink-0 text-kelp" aria-hidden />
        Your replays are read by this browser, on this computer. Nothing is uploaded, and there is no account.
      </p>

      <section className="mt-12 border-t border-line/70 pt-8">
        <h2 className="display text-3xl">Where Fortnite keeps replays</h2>
        <ol className="mt-4 space-y-4 text-mist">
          <Step n={1}>Click <b className="text-bone">Choose your replay folder</b>.</Step>
          <Step n={2}>
            Paste this into the address bar of the window that opens, press Enter, then select the folder.
            <CopyLine text={DEMOS} />
          </Step>
          <Step n={3}>Come back after you play. Fortnite records every match there while <b className="text-bone">Record Replays</b> is on in its settings.</Step>
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
            onClick={() => { if (confirm('Delete your Chest Log library from this browser?')) void forgetLibrary().then(() => queryClient.resetQueries()).then(() => router.invalidate()) }}
            className="press mt-4 inline-flex h-10 items-center gap-2 rounded-full border border-line px-4 text-sm font-semibold text-coral hover:border-coral">
            <Trash2 className="size-4" aria-hidden /> Delete my library
          </button>
        </section>
      )}

      <p className="mt-12 text-xs text-dim">A fan project. Not affiliated with or endorsed by Epic Games.</p>
    </main>
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
