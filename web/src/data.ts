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
  drops: Tally[]
  finishes: Tally[]
  clipCount: number
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
