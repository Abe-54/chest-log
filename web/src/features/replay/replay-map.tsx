import { useMemo } from 'react'
import { useSelector } from '@tanstack/react-store'
import type { Match, MatchEvent } from '~/data'
import { dateTime } from '~/lib/format'
import { IslandMap } from '~/features/map/island-map'
import { mapFrame } from '~/features/map/frame'
import { useReplayLayers } from './layers'
import { positionAt, stormTag, type LayerKey, type Member } from './model'
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
  const zone = useSelector(store, state => visible.has('storm') ? stormTag(match.storm, state.time) : null)
  return (
    <IslandMap
      label={label}
      layers={layers}
      fit={match.focus}
      follow={target}
      onRelease={onRelease}
      onPick={info => { const event = info.object as MatchEvent | undefined; if (event && 'kind' in event) onChoose(event) }}
      className={mapFrame}
    >
      {zone && <p className="absolute top-3 left-3 flex h-7 items-center rounded-[6px] bg-ink/85 px-2.5 text-xs font-semibold text-mist">{zone}</p>}
      {match.stub && (
        <p className="absolute right-16 bottom-3 left-3 rounded-[6px] bg-ink/85 px-3 py-2 text-[13px] font-semibold text-mist md:right-auto">This replay stopped early. Chests are counted, the path is partial.</p>
      )}
    </IslandMap>
  )
}
