import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import type { ReplayIndex, ReplayMatch } from '../../data/types'
import type { Calibration } from './domain/model'
import type { ClipIndex } from './domain/clips'
import { hasChestOpening } from './domain/clips'
import { buildDataset } from './dataset'

const root = new URL('../../', import.meta.url)
const out = new URL('../public/data/', import.meta.url)
const load = async <T>(path: string) => JSON.parse(await readFile(new URL(path, root), 'utf8')) as T

const [index, calibration, clipIndex] = await Promise.all([
  load<ReplayIndex>('data/index.json'),
  load<Calibration>('map/calibration.json'),
  load<ClipIndex>('data/clips.json'),
])
const replays = await Promise.all(index.matches.filter(row => !row.error).map(row => load<ReplayMatch>(`data/matches/${row.id}.json`)))
const { week, clips, matches } = buildDataset({ index, calibration, replays, clipIndex, generatedAt: new Date().toISOString() })
if (!clipIndex.clips.some(hasChestOpening)) throw Error('clip index lost its chest annotations')
const mapImage = fileURLToPath(new URL('map/map_blank.png', root))

await rm(out, { recursive: true, force: true })
await mkdir(new URL('matches/', out), { recursive: true })
const map = new URL('../public/map/', import.meta.url)
await mkdir(map, { recursive: true })
const write = (name: string, value: unknown) => writeFile(new URL(name, out), JSON.stringify(value))
await Promise.all([
  write('week.json', week),
  write('clips.json', clips),
  ...matches.map(match => write(`matches/${match.id}.json`, match)),
  sharp(mapImage).resize(1024).webp({ quality: 80 }).toFile(fileURLToPath(new URL('island-1024.webp', map))),
  sharp(mapImage).webp({ quality: 82 }).toFile(fileURLToPath(new URL('island-2048.webp', map))),
])
console.log(`week: ${week.total} chests over ${week.realMatches} matches; ${matches.length} match packs; ${clips.clips.length} clips`)
