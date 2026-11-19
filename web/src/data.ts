/** Map pixel coordinates on the 2048 px island image. */
export type Px = [x: number, y: number]
export interface Tally { label: string; count: number }

/**
 * One player's chests in a match; the recorder comes first. A squadmate's count is what the recorder's replay saw,
 * which is mostly chests opened near the recorder, so it runs low when the squad splits up.
 */
export interface SquadMember { name: string; you: boolean; chests: number }

export interface MatchRow {
  id: string
  startUtc: string
  duration: number
  placement: number | null
  kills: number | null
  chests: number
  zone: string | null
  alive: number | null
  firstChest: number | null
  early: [twoMin: number, fiveMin: number, tenMin: number] | null
  distanceKm: number | null
  stub: boolean
  clips: number
  squad: SquadMember[]
}

export interface Week {
  player: string
  generatedAt: string
  total: number
  /** How the total splits: searched the normal way, or broken open (pickaxe, explosion). */
  opened: number
  broken: number
  /** Squadmates' chests as your replays saw them; low when the squad splits up. */
  team: { opened: number; broken: number }
  average: number
  realMatches: number
  stubs: number
  wins: number
  topFive: number
  pace: number | null
  aliveSeconds: number
  distanceKm: number
  mapCrossings: number
  firstChestMedian: number | null
  bestOpening: number
  ammoBoxes: number
  otherContainers: number
  confirmedShare: number
  bestMatchId: string | null
  matches: MatchRow[]
  /** Unix ms of every chest opening, for local day and hour buckets. */
  chestTimes: number[]
  loot: Tally[]
  rarity: Tally[]
  rarest: Tally[]
  kinds: Tally[]
  confidence: Tally[]
  crew: Tally[]
  drops: Tally[]
  finishes: Tally[]
  persona: { title: string; detail: string }
  bestTrail: { trail: Px[][]; chests: Px[] } | null
  clipCount: number
  standoutClipId: string | null
}

export type EventKind =
  | 'chest' | 'rare_chest' | 'ammo_box' | 'container'
  | 'knock' | 'elimination'
  | 'bus' | 'jump' | 'landed' | 'reboot' | 'death' | 'end'
export type Actor = 'me' | 'team' | 'enemy' | 'unknown'

export interface MatchEvent {
  t: number
  kind: EventKind
  actor: Actor
  label: string
  detail: string
  p: Px | null
  loot?: string[]
  confidence?: 'high' | 'medium' | 'low'
}

/** Columnar track: times in seconds, positions in map pixels. Segments split at gaps. */
export interface Track { name: string; segments: { t: number[]; x: number[]; y: number[] }[] }

export interface StormFrame {
  t: number
  from: [x: number, y: number, r: number] | null
  to: [x: number, y: number, r: number] | null
  shrinkStart: number | null
  shrinkEnd: number | null
}

export interface ClipRef { id: string; label: string; start: number; end: number; poster: string; chestCount: number }

export interface Match {
  id: string
  player: string
  startUtc: string
  duration: number
  placement: number | null
  kills: number | null
  chests: number
  zone: string | null
  stub: boolean
  squad: SquadMember[]
  playerCount: number | null
  damageDealt: number | null
  landed: number | null
  leftBus: number | null
  /** Owner death, match end, or recording end. */
  end: number
  track: Track | null
  team: Track[]
  events: MatchEvent[]
  storm: StormFrame[]
  bus: [Px, Px] | null
  clips: ClipRef[]
  focus: [minX: number, minY: number, maxX: number, maxY: number] | null
}

export interface RouteStop { id: string; p: Px; appeared: number; mine: number }
export interface Suggestion { start: Px; stops: RouteStop[]; seconds: number; metres: number; expected: number }
export interface BestRun { matchId: string; landedAt: number; start: Px; trail: Px[][]; chests: Px[]; count: number; lastChest: number | null }
export interface RouteWindow { budget: number; average: number | null; suggested: Suggestion | null; best: BestRun | null }
export interface Drop {
  id: string
  name: string
  center: Px
  landings: number
  pace: number | null
  placement: number | null
  lowSample: boolean
  windows: RouteWindow[]
}

export interface Planner {
  budgets: number[]
  minimumLandings: number
  drops: Drop[]
  hotspot: { drop: Drop; count: number; radiusPx: number } | null
  timing: { speed: number | null; openSeconds: number | null; recordings: number }
  pois: { name: string; p: Px }[]
}

export interface Island {
  /** Every post-landing trail of the week, flattened to paths. */
  trails: Px[][]
  myChests: Px[]
  /** Registry chest sites: x, y, replays seen in, times I opened it. */
  sites: [x: number, y: number, appeared: number, mine: number][]
  landings: Px[]
}

export interface ClipEvent { t: number; kind: 'chest' | 'rare_chest' | 'ammo_box' | 'container' | 'knock' | 'elimination' | 'death'; mine: boolean; caption: string }
export interface Clip {
  id: string
  label: string
  matchId: string
  localStamp: string
  duration: number
  replayStart: number
  replayEnd: number
  video: string
  poster: string
  events: ClipEvent[]
}
export interface Clips { tolerance: number; clips: Clip[] }
