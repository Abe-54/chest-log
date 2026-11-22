import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createFileRoute, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSelector } from '@tanstack/react-store'
import { Check, Copy, Download, Folder, Lock, Trash2, Upload } from 'lucide-react'
import { weekQuery } from '~/lib/queries'
import { base, demo, hosted } from '~/lib/mode'
import { celebrationStore } from '~/lib/live'
import { plural, timeOfDay } from '~/lib/format'
import { useNow } from '~/lib/now'
import { getValue } from '~/library/db'
import { droppedFiles, forgetLibrary, importReplays, importStore, type ImportOutcome, type ImportState } from '~/library/import'
import { CHECK_EVERY_MS, companionStore, connectCompanion, disconnectCompanion, type CompanionState } from '~/library/companion'
import { cn } from '~/lib/cn'

const DEMOS = '%LOCALAPPDATA%\\FortniteGame\\Saved\\Demos'
const DOWNLOAD = 'https://github.com/Abe-54/chest-log/releases/latest/download/ChestLogCompanion.exe'
const ABOUT = '/companion/'

export const Route = createFileRoute('/track')({
  beforeLoad: () => {
    if (!hosted) throw redirect({ to: '/' })
  },
  head: () => ({ meta: [{ title: 'Add matches · Chest Log' }] }),
  component: () => demo ? <LeaveDemo /> : <TrackPage />,
})

/** The demo is read-only and has no library of its own, so this page belongs to the real app one level up. */
function LeaveDemo() {
  useEffect(() => location.replace(`${base}track`), [])
  return <p className="page py-16 text-mist">Taking you to your own library…</p>
}

const primary = 'press inline-flex h-12 items-center justify-center gap-2 rounded-button bg-gold px-5 display text-[22px] text-ink shadow-glow-gold hover:bg-gold-deep disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none'
const secondary = 'press inline-flex h-12 items-center justify-center gap-2 rounded-button border-2 border-line-strong px-5 text-base font-bold text-bone hover:border-mist'
const small = 'press inline-flex h-9 items-center justify-center gap-2 rounded-button border border-line bg-ink-2 px-3.5 text-sm font-semibold text-bone hover:border-mist'

function TrackPage() {
  const state = useSelector(importStore, value => value)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const router = useRouter()
  const { data: week } = useQuery({ ...weekQuery, retry: false })
  const { data: meta } = useQuery({ queryKey: ['library-meta', week?.generatedAt], queryFn: async () => (await getValue('meta')) ?? null })
  const [over, setOver] = useState(false)
  const folderInput = useRef<HTMLInputElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const companion = useSelector(companionStore, value => value)
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

  /** The plain folder picker: Chrome's folder-access picker refuses anything in AppData, where the Demos folder lives. */
  const chooseDemos = () => folderInput.current?.click()
  const fromInput = (input: HTMLInputElement) => {
    addFiles([...(input.files ?? [])])
    input.value = ''
  }
  const chooseFiles = () => fileInput.current?.click()

  return (
    <main className="page pt-8 md:pt-14"
      onDragOver={event => { event.preventDefault(); setOver(true) }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(false) }}
      onDrop={event => {
        event.preventDefault()
        setOver(false)
        if (!busy) void droppedFiles(event.dataTransfer.items).then(addFiles)
      }}>
      <h1 className="display text-[44px] md:text-display-lg">{week ? 'Add matches' : 'Count my chests'}</h1>
      <p className="mt-3 max-w-[640px] text-[15px] leading-[22px] text-mist md:text-[17px] md:leading-[26px]">
        <span className="md:hidden">Chest Log reads your Fortnite replays on a Windows PC.</span>
        <span className="max-md:hidden">With Chest Log Companion running, every match you finish lands here on its own. Without it, pick your Demos folder after you play.</span>
      </p>
      {!week && (
        <p className="mt-3 text-[15px] text-mist">Just looking? <a href={`${base}demo`} className="font-semibold text-gold hover:text-bone">Try the demo library</a>.</p>
      )}

      <div className="mt-6 grid items-start gap-6 md:mt-10 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] lg:grid-cols-[minmax(0,1fr)_440px]">
        <div className="grid gap-6">
          {state.phase === 'error' && <p role="alert" className="rounded-[10px] bg-coral/15 px-4 py-3 text-[15px] font-semibold text-coral">{state.message}</p>}
          <CompanionPanel companion={companion} state={state} />
          <AddPanel state={state} matches={week ? week.realMatches + week.stubs : null} onFolder={chooseDemos} quiet={companion.phase === 'connected'} />
        </div>
        <DropZone over={over} busy={busy} onFiles={chooseFiles} />
        <input ref={folderInput} type="file" hidden multiple {...{ webkitdirectory: '' }} onChange={event => fromInput(event.currentTarget)} />
        <input ref={fileInput} type="file" hidden multiple accept=".replay" onChange={event => fromInput(event.currentTarget)} />
      </div>

      <p className="mt-6 flex items-start gap-2.5 text-[15px] text-mist">
        <Lock className="mt-0.5 size-4 shrink-0 text-kelp" aria-hidden />
        Your replay files never leave this device. They are read by this browser, on this computer. There is no upload and no account.
      </p>

      <section className="mt-12 border-t border-line-soft pt-8">
        <h2 className="display text-[28px] leading-none md:text-display-md">Where Fortnite keeps replays</h2>
        <ol className="mt-5 max-w-3xl space-y-4 text-mist">
          <Step n={1}>Fortnite only saves replays while <b className="font-bold text-bone">Record Replays</b> is turned on in its settings.</Step>
          <Step n={2}>
            Choose the Demos folder. Paste this into the address bar of the window that opens, press Enter, then select the folder.
            <CopyPath className="mt-2" boxed />
          </Step>
          <Step n={3}>After you play, come back and pick the folder again. Matches already counted are skipped.</Step>
        </ol>
        <p className="mt-5 text-sm text-dim">Replays only exist on PC. Fortnite on console and phone does not save them as files.</p>
      </section>

      {week && (
        <section className="mt-12 border-t border-line-soft pt-8">
          <h2 className="display text-[28px] leading-none md:text-display-md">Your data</h2>
          {meta && meta.failed.length > 0 && (
            <details className="mt-4 text-sm text-mist">
              <summary className="cursor-pointer font-semibold">{meta.failed.length} {meta.failed.length === 1 ? 'file' : 'files'} could not be read</summary>
              <ul className="mt-2 space-y-1 text-[13px]">
                {meta.failed.map(file => <li key={file.name}>{file.name} · {file.error}</li>)}
              </ul>
            </details>
          )}
          <p className="mt-4 max-w-xl text-[15px] text-mist">Everything this site knows about your matches is stored in this browser. Deleting it here removes it for good. Your replay files are not touched.</p>
          <button type="button"
            onClick={() => { if (confirm('Delete your Chest Log library from this browser?')) void forgetLibrary().then(() => queryClient.resetQueries()).then(() => router.invalidate()) }}
            className="press mt-4 inline-flex h-10 items-center gap-2 rounded-button border border-line px-4 text-sm font-semibold text-coral hover:border-coral">
            <Trash2 className="size-4" aria-hidden /> Delete my library
          </button>
        </section>
      )}
    </main>
  )
}

/**
 * The Demos folder, picked after each session. Browsers will not let a website keep access to it (Windows keeps it in AppData),
 * so this is the whole flow: one click, and matches already counted are skipped. While replays are read, progress takes the panel.
 */
function AddPanel({ state, matches, onFolder, quiet }: { state: ImportState; matches: number | null; onFolder: () => void; quiet: boolean }) {
  const [copied, setCopied] = useState(false)
  const returning = matches !== null
  if (quiet) return (
    <p className="text-[15px] text-mist">Need an older replay from somewhere else? <button type="button" onClick={onFolder} className="font-semibold text-gold hover:text-bone">Pick a folder</button> or drop files on the right.</p>
  )
  return (
    <section aria-labelledby="add-title" className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-5 rounded-panel border border-line bg-ink-2 p-5 md:p-8">
      <FolderGlyph className="size-11 text-gold md:size-14" />
      <div className="min-w-0">
        <h2 id="add-title" className="display text-[30px] leading-none md:text-[40px]">{returning ? 'Add new matches by hand' : 'Or pick the folder yourself'}</h2>
        <p className="mt-1.5 text-[15px] text-mist">
          {returning
            ? <>{plural(matches, 'match', 'matches')} counted so far. Choose the folder after you play; the ones already counted are skipped.</>
            : 'Chest Log reads every replay in it. After you play, choose it again to add the new ones.'}
        </p>
      </div>
      {state.phase === 'parsing' || state.phase === 'building'
        ? <Progress state={state} />
        : <div className="col-span-full flex flex-wrap items-center gap-x-5 gap-y-3">
            <button type="button" onClick={onFolder} className={secondary}>{returning ? 'Add new matches' : 'Choose Demos folder'}</button>
            <CopyPath className="max-md:hidden" />
            <button type="button" className={cn(secondary, 'md:hidden')}
              onClick={() => void navigator.clipboard.writeText(location.href).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })}>
              {copied ? 'Link copied' : 'Copy link for PC'}
            </button>
          </div>}
    </section>
  )
}

const COPY: Record<Exclude<CompanionState['phase'], 'connected'>, { title: string; body: ReactNode }> = {
  idle: {
    title: 'Count new matches automatically',
    body: <>Chest Log Companion is a small, free Windows app. While it runs, every match you finish shows up here on its own. It only reads your replay folder, and only this site on this PC can ask it for replays.</>,
  },
  connecting: {
    title: 'Connecting to the companion',
    body: <>Chrome may ask to let this site <b className="font-bold text-bone">access other apps and services on this device</b>. Choose Allow. That is how this page talks to the companion on your PC.</>,
  },
  absent: {
    title: 'The companion isn’t running',
    body: <>Start <b className="font-bold text-bone">Chest Log Companion</b>. Once it runs it sits in the tray by the clock, and this page connects within 30 seconds. Not installed yet? Download it below.</>,
  },
  blocked: {
    title: 'Chrome blocked the connection',
    body: <>Click the icon left of the address bar, open <b className="font-bold text-bone">Site settings</b>, set <b className="font-bold text-bone">Local network access</b> to Allow, then reload this page.</>,
  },
  'no-folder': {
    title: 'No replay folder yet',
    body: <>The companion is running, but Fortnite hasn’t made its replay folder. Turn on <b className="font-bold text-bone">Record Replays</b> in Fortnite and finish a match.</>,
  },
}

/** Connect is a click, because the first call to 127.0.0.1 is what makes Chrome ask the visitor. */
function CompanionPanel({ companion, state }: { companion: CompanionState; state: ImportState }) {
  if (companion.phase === 'connected') return <ConnectedPanel companion={companion} state={state} />
  const { title, body } = COPY[companion.phase]
  const waiting = companion.phase === 'connecting'
  const fixing = companion.phase === 'no-folder' || companion.phase === 'blocked'
  return (
    <section aria-labelledby="companion-title" className={cn('rounded-panel border border-line bg-ink-2 p-5 md:p-8', companion.phase === 'blocked' && 'border-t-4 border-t-coral')}>
      <h2 id="companion-title" className="display text-[30px] leading-none md:text-[40px]">{title}</h2>
      <p className="mt-2 max-w-2xl text-[15px] leading-[22px] text-mist">{body}</p>
      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
        {!fixing && <a href={DOWNLOAD} className={primary}><Download className="size-5" aria-hidden />Download for Windows</a>}
        <button type="button" disabled={waiting} onClick={() => void connectCompanion()} className={fixing ? primary : secondary}>
          {waiting ? 'Connecting…' : companion.phase === 'idle' ? 'Connect' : 'Try again'}
        </button>
        <a href={ABOUT} className="text-sm font-semibold text-gold hover:text-bone">What it does and why it’s safe</a>
      </div>
    </section>
  )
}

const RING = 2 * Math.PI * 24

function ConnectedPanel({ companion, state }: { companion: Extract<CompanionState, { phase: 'connected' }>; state: ImportState }) {
  const now = useNow(1000)
  const since = companion.checkedAt === null ? null : Math.max(0, now - companion.checkedAt)
  const next = since === null ? null : Math.max(0, Math.ceil((CHECK_EVERY_MS - since) / 1000))
  return (
    <section aria-labelledby="companion-title" className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-5 rounded-panel border border-line border-t-4 border-t-live bg-ink-2 p-5 md:grid-cols-[auto_minmax(0,1fr)_auto] md:p-8">
      <svg viewBox="0 0 56 56" aria-hidden className="size-11 -rotate-90 motion-reduce:hidden md:size-14">
        <circle cx="28" cy="28" r="24" fill="none" strokeWidth="5" className="stroke-line" />
        {companion.checkedAt !== null && (
          <circle key={companion.checkedAt} cx="28" cy="28" r="24" fill="none" strokeWidth="5" strokeLinecap="round" className="stroke-live"
            strokeDasharray={RING} style={{ '--ring': RING, animation: `ring-down ${CHECK_EVERY_MS}ms linear both`, animationDelay: `-${since}ms` } as CSSProperties} />
        )}
        <circle cx="28" cy="28" r="7" className="fill-live" />
      </svg>
      <div className="min-w-0 motion-reduce:col-span-2 md:motion-reduce:col-span-1">
        <h2 id="companion-title" className="display text-[32px] leading-none md:text-[40px]">Companion connected</h2>
        <p role="status" className="num mt-1.5 text-sm font-semibold text-rarity-uncommon-text md:text-base">
          {next === null ? 'Checking now…' : <>{plural(companion.replays, 'replay')} in your folder · next check in {next} s</>}
        </p>
      </div>
      <button type="button" onClick={() => void disconnectCompanion()} className={cn(small, 'max-md:order-last max-md:col-span-2 max-md:h-12 max-md:text-base md:col-start-3 md:row-start-1')}>Disconnect</button>
      {state.phase === 'parsing' || state.phase === 'building'
        ? <Progress state={state} />
        : <ol className="col-span-full border-t border-line-soft">
            {companion.session.map(entry => (
              <li key={entry.at} className="flex items-center gap-4 border-b border-line-soft py-4 motion-safe:animate-[caption-in_240ms_var(--ease-out)]">
                <span className="display num w-16 shrink-0 text-[28px] leading-none text-gold motion-safe:animate-[chest-pop_650ms_var(--ease-pop)_both]">+{entry.gained}</span>
                <span className="min-w-0 flex-1 text-[15px] font-semibold">{entry.added === 1 ? 'New match added' : `${entry.added} new matches added`}</span>
                <time className="shrink-0 text-[13px] text-dim">{timeOfDay(new Date(entry.at).toISOString())}</time>
              </li>
            ))}
            {companion.session.length === 0 && (
              <li className="border-b border-line-soft py-4 text-[15px] text-mist-2">Keep this tab open while you play. Each match shows up here within a minute of the end.</li>
            )}
          </ol>}
    </section>
  )
}

function DropZone({ over, busy, onFiles }: { over: boolean; busy: boolean; onFiles: () => void }) {
  return (
    <section aria-labelledby="drop-title" aria-disabled={busy || undefined}
      className={cn('flex min-h-80 flex-col items-center justify-center gap-4 rounded-panel border-2 p-8 text-center transition-colors duration-150 max-md:hidden md:self-stretch',
        over ? 'border-solid border-gold bg-gold/8' : 'border-dashed border-line-strong', busy && 'pointer-events-none opacity-50')}>
      <Upload className="size-9 text-gold" strokeWidth={2} aria-hidden />
      <h2 id="drop-title" className="display text-[32px] leading-none">{over ? 'Drop to count' : 'Or drop it here'}</h2>
      <p className="text-[15px] text-mist">The Demos folder or a few .replay files.</p>
      <button type="button" onClick={onFiles} disabled={busy} className={small}>Choose files</button>
      <CopyPath className="mt-2" />
    </section>
  )
}

function Progress({ state }: { state: Extract<ImportState, { phase: 'parsing' | 'building' }> }) {
  const building = state.phase === 'building'
  const done = building ? state.total : state.done
  return (
    <div role="status" className="col-span-full">
      <p className="text-[15px] font-semibold">
        {building ? 'Adding it all up' : <>Reading <span className="num">{done + (done < state.total ? 1 : 0)}</span> of <span className="num">{plural(state.total, 'replay')}</span></>}
      </p>
      <div aria-hidden className="mt-3 h-1.5 overflow-hidden rounded-pill bg-ink">
        {building
          ? <div className="h-full w-1/3 bg-gold motion-safe:animate-[scan_1.1s_var(--ease-in-out)_infinite]" />
          : <div className="h-full bg-gold transition-[width] duration-300 ease-out" style={{ width: `${(done / state.total) * 100}%` }} />}
      </div>
      <p className="mt-2 truncate font-mono text-[13px] text-dim">
        {building ? 'Matching loot to chests across every match.' : state.current ?? 'Starting the replay reader.'}
      </p>
      {state.failed > 0 && <p className="mt-1 text-[13px] text-coral">{state.failed} could not be read.</p>}
      <p className="mt-1 text-[13px] text-dim">About two seconds a match. Keep this tab open.</p>
    </div>
  )
}

function FolderGlyph({ className, filled }: { className?: string; filled?: boolean }) {
  return <Folder className={className} fill={filled ? 'currentColor' : 'none'} strokeWidth={filled ? 0 : 2} aria-hidden />
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="display num flex size-8 shrink-0 items-center justify-center rounded-button bg-ink-3 text-lg text-gold">{n}</span>
      <div className="min-w-0 flex-1 pt-1">{children}</div>
    </li>
  )
}

function CopyPath({ className, boxed }: { className?: string; boxed?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <button type="button" aria-label="Copy the Demos folder path"
      onClick={() => void navigator.clipboard.writeText(DEMOS).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })}
      className={cn('group flex max-w-full items-center gap-2 text-left', boxed && 'rounded-[10px] border border-line-soft bg-ink-deep px-3 py-2', className)}>
      <code className="min-w-0 truncate font-mono text-[13px] text-dim group-hover:text-mist">{DEMOS}</code>
      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-mist">
        {copied ? <><Check className="size-3.5 text-kelp" aria-hidden />Copied</> : <Copy className="size-3.5" aria-hidden />}
      </span>
    </button>
  )
}
