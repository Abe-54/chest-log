export type Position = [xCm: number, yCm: number, zCm: number]
export type TrackSample = [time: number, xCm: number, yCm: number, zCm: number, flags: number, knownFlags: number]
export type Nullable<T> = T | null
export type ContainerKind = 'chest' | 'rare_chest' | 'ammo_box' | 'other_container'
export type AttributionMethod = 'replicated_pawn' | 'loot_nearby' | 'actor_position' | 'registry_position' | 'unattributed'
export type Role = 'owner' | 'teammate' | 'enemy'
export type Confidence = 'high' | 'medium' | 'low'

export const TrackFlag = {
  skydiving: 1,
  parachute: 2,
  sprinting: 4,
  crouched: 8,
  water: 16,
  downed: 32,
  storm: 64,
  vehicle: 128,
} as const

export interface ReplayIndex {
  week: Week
  matches: MatchRow[]
}

export interface Week {
  matches: number
  parsedMatches: number
  realMatches: number
  stubs: number
  errors: number
  ownerChests: number
  averagePerRealMatch: Nullable<number>
  otherOwnerContainers: ContainerCounts
  ownerChestsInStubs: number
}

export type ContainerCounts = Partial<Record<'ammo_box' | 'other_container', number>>

export interface MatchRow {
  id: string
  file: string
  startUtc: Nullable<string>
  playlist: Nullable<string>
  duration: Nullable<number>
  placement: Nullable<number>
  kills: Nullable<number>
  ownerChestCount: Nullable<number>
  otherOwnerContainers: Nullable<ContainerCounts>
  landingPosition: Nullable<Position>
  stub: Nullable<boolean>
  error: Nullable<string>
}

export interface ReplayMatch {
  meta: MatchMeta
  timings: Timings
  ownerTrack: Nullable<Track>
  teammateTracks: Track[]
  searches: ContainerSearch[]
  combat: CombatEvent[]
  stormCircles: StormCircle[]
  battleBus: Nullable<BattleBus>
  ownerPickups: OwnerPickup[]
  extras: Nullable<Extras>
}

export interface MatchMeta {
  id: string
  file: string
  sessionId: Nullable<string>
  startUtc: Nullable<string>
  duration: number
  playlist: Nullable<string>
  owner: Nullable<string>
  teamSize: Nullable<number>
  observedTeammates: Nullable<number>
  playerCount: Nullable<number>
  botCount: Nullable<number>
  placement: Nullable<number>
  teamStatsPosition: Nullable<number>
  kills: Nullable<number>
  knocks: Nullable<number>
  assists: Nullable<number>
  damageDealt: Nullable<number>
  damageTaken: Nullable<number>
  distanceTravelledCm: Nullable<number>
  stub: boolean
  stubReason: Nullable<string>
  bytes: number
}

export interface Timings {
  busLaunch: Nullable<number>
  ownerLeftBus: Nullable<number>
  ownerLanded: Nullable<number>
  ownerDied: Nullable<number>
  matchEnded: Nullable<number>
  ownerDiedOrMatchEnded: number
  landingPosition: Nullable<Position>
  ownerReboots: number[]
}

export interface Track {
  name: string
  samples: TrackSample[]
}

export interface Item {
  definition: Nullable<string>
  count: Nullable<number>
}

export interface OwnerPickup extends Item {
  time: number
  position: Nullable<Position>
}

export interface ContainerSearch {
  time: number
  kind: ContainerKind
  class: string
  chestId: string
  stableId: boolean
  signal: string
  initialState: boolean
  /** Broken open instead of searched: destroyed before, or within half a second of, its first search. */
  broken: boolean
  lootTier: Nullable<number>
  opener: Nullable<string>
  role: Nullable<Role>
  lootPosition: Nullable<Position>
  estimatedContainerPosition: Nullable<Position>
  openerPosition: Nullable<Position>
  openerDistanceCm: Nullable<number>
  secondNearestDistanceCm: Nullable<number>
  positionSampleAgeMs: Nullable<number>
  method: AttributionMethod
  confidence: Confidence
  attributionNote: Nullable<string>
  loot: Item[]
}

export interface ChestRegistryEntry {
  kind: ContainerKind
  class: string
  stableId: boolean
  position: Nullable<Position>
  matchesAppeared: number
  ownerSearches: number
  teammateSearches: number
  enemySearches: number
  unattributedSearches: number
}

export type ChestRegistry = Record<string, ChestRegistryEntry>

export interface CombatEvent {
  time: number
  kind: 'knock' | 'elimination'
  killer: Nullable<string>
  victim: Nullable<string>
  position: Nullable<Position>
  deathCause: Nullable<number>
  deathTags: Nullable<string[]>
  eventGunType: Nullable<number>
  weapon: Nullable<string>
  ownerInvolved: boolean
  teammateInvolved: boolean
  source: 'event' | 'event_and_player_state' | 'player_state'
}

export interface StormCircle {
  time: number
  phase: Nullable<number>
  lastCenter: Nullable<Position>
  lastRadius: Nullable<number>
  nextCenter: Nullable<Position>
  nextRadius: Nullable<number>
  nextNextCenter: Nullable<Position>
  nextNextRadius: Nullable<number>
  shrinkStart: Nullable<number>
  shrinkEnd: Nullable<number>
}

export interface BattleBus {
  source: 'aircraft_flight_plan' | 'game_state_flight_plan'
  start: Position
  end: Nullable<Position>
  startTime: Nullable<number>
  endTime: Nullable<number>
  speedCmPerSecond: Nullable<number>
}

export interface Extras {
  revives: Nullable<number>
  accuracy: Nullable<number>
  stormSecondsObserved: Nullable<number>
  emoteStartsObserved: Nullable<number>
  timesRebooted: Nullable<number>
  weaponEquippedSecondsObserved: Record<string, number>
  thankedBusDriver: Nullable<boolean>
}
