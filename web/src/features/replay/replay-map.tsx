import { useMemo } from 'react'
import { useSelector } from '@tanstack/react-store'
import type { Match, MatchEvent } from '~/data'
import { dateTime } from '~/lib/format'
import { IslandMap } from '~/features/map/island-map'
import { mapFrame } from '~/features/map/frame'
import { useReplayLayers } from './layers'
import { positionAt, type LayerKey, type Member } from './model'
import type { PlaybackStore } from './playback'

export default function ReplayMap({ match, store, visible, events, selected, members, tracked, follow, onRelease, onChoose }: {
  match: Match; store: PlaybackStore; visible: Set<LayerKey>; events: MatchEvent[]; selected: MatchEvent | null
  members: Member[]; tracked: Set<string>
  follow: boolean; onRelease: () => void; onChoose: (event: MatchEvent) => void
}) {
  const layers = useReplayLayers(match, store, visible, events, selected, members, tracked)
  const label = useMemo(() => `Island replay for ${dateTime(match.startUtc)}`, [match])
  // Follow keeps the first tracked player centred, or you when nobody is tracked.
  const leader = members.find(member => tracked.has(member.name)) ?? members.find(member => member.you)
  const target = useSelector(store, state => follow && leader
    ? positionAt(leader.track, leader.you ? Math.min(state.time, match.end) : state.time) : null)
  return (
    <IslandMap
      label={label}
      layers={layers}
      fit={match.focus}
      follow={target}
      onRelease={onRelease}
      onPick={info => { const event = info.object as MatchEvent | undefined; if (event && 'kind' in event) onChoose(event) }}
      className={mapFrame}
    />
  )
}
