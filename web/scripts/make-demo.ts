// Builds the demo library the hosted app serves at /app/demo from the local app's own data, with every player name
// replaced. The source holds real names and is never committed; only the output in public/demo is.
// Run: npx tsx scripts/make-demo.ts <source dir>   (the folder with week.json and matches/)
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { Match } from '../src/data'
import { aliasesFor, anonymizeDemo, leaks, placeNames } from '../pipeline/demo'

const source = process.argv[2] ?? process.env.DEMO_SRC
if (!source) throw new Error('usage: tsx scripts/make-demo.ts <source dir>')
const out = new URL('../public/demo/', import.meta.url)
const read = async <T>(path: string) => JSON.parse(await readFile(`${source}/${path}`, 'utf8')) as T

const week = await read<Record<string, unknown>>('week.json')
const matches = await Promise.all((await readdir(`${source}/matches`)).filter(name => name.endsWith('.json')).map(name => read<Match>(`matches/${name}`)))
const demo = anonymizeDemo({ week, matches })
const places = placeNames({ week, matches })

// Refuse to publish anything that still carries a name from the source.
const originals = [...aliasesFor(matches, week.player as string).keys()]
const found = leaks(demo, originals, places)
if (found.length > 0) throw new Error(`${found.length} strings still carry a source name; nothing was written`)

await rm(out, { recursive: true, force: true })
await mkdir(new URL('matches/', out), { recursive: true })
const write = (name: string, value: unknown) => writeFile(new URL(name, out), JSON.stringify(value))
await Promise.all([write('week.json', demo.week), ...demo.matches.map(match => write(`matches/${encodeURIComponent(match.id)}.json`, match))])
console.log(`demo: ${demo.week.total} chests over ${demo.week.realMatches} matches, ${demo.matches.length} match files, ${originals.length} names replaced, written to ${fileURLToPath(out)}`)
