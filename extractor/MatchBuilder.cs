using FortniteReplayReader.Models;

sealed record ParsedMatch(Match Match, Person? Owner, Attribution Attribution, Container[] Containers);

static class MatchBuilder
{
    /// <param name="zone">Zone of the recording machine, for header timestamps that carry no kind.</param>
    public static ParsedMatch Build(string file, long size, string id, FortniteReplay replay, Capture capture, TimeZoneInfo zone)
    {
        var duration = replay.Info.LengthInMs / 1000d;
        var players = replay.PlayerData.ToArray();
        var people = new Dictionary<uint, Person>();
        var byNetId = players.Where(p => !string.IsNullOrEmpty(p.PlayerId))
            .ToLookup(p => p.PlayerId!, StringComparer.OrdinalIgnoreCase);
        var byPlayerId = players.Where(p => p.Id is not null).ToLookup(p => p.Id!.Value);
        foreach (var (actor, state) in capture.States.Where(x => !x.Value.Spectator))
        {
            var player = (state.NetId is not null ? byNetId[state.NetId].FirstOrDefault() : null) ??
                (state.Id is int stateId ? byPlayerId[stateId].FirstOrDefault() : null);
            var name = player?.PlayerName ?? player?.PlayerNameCustomOverride ?? player?.StreamerModeName ??
                (state.Bot ? $"Bot {state.Id ?? (long)actor}" : $"Player {state.Id ?? (long)actor}");
            people[actor] = new(actor, name, state.NetId ?? player?.PlayerId, state.Team ?? player?.TeamIndex, state.Bot || player?.IsBot == true);
        }
        var ownerPlayer = players.FirstOrDefault(p => p.IsReplayOwner);
        var owner = replay.GameData.RecorderId is uint recorder ? people.GetValueOrDefault(recorder) : null;
        owner ??= people.Values.FirstOrDefault(p => p.NetId is not null &&
            string.Equals(p.NetId, ownerPlayer?.PlayerId, StringComparison.OrdinalIgnoreCase));

        var pawnByState = capture.Pawns.Values.Where(p => p.State is not null).ToLookup(p => p.State!.Value);
        var ownerPawns = owner is null ? [] : pawnByState[owner.State].OrderBy(p => p.Start).ToArray();
        var ownerSamples = ownerPawns.SelectMany(p => p.Samples).Where(p => p.Time >= 0 && p.Time <= duration)
            .OrderBy(p => p.Time).ToArray();
        var teammates = people.Values.Where(p => Roles.Of(p, owner) == "teammate").ToArray();
        var attribution = new Attribution(capture, people, duration);
        attribution.MatchLoot(owner);
        var combat = CombatFeed.Build(replay, capture, people, owner, pawnByState, duration);
        var offset = capture.ClockOffsets.Count == 0 ? (double?)null : capture.ClockOffsets.Order().ElementAt(capture.ClockOffsets.Count / 2);
        var bus = BuildBus(capture, offset, duration);
        var busLaunch = bus?.StartTime ?? ReplayUnits.Within(replay.GameData.AircraftStartTime - offset, duration);
        var ownerState = owner is null ? null : capture.States[owner.State];
        var aircraftChanges = ownerState?.Aircraft.Where(x => x.Time >= (busLaunch ?? 10) - 1).ToArray() ?? [];
        var aboard = aircraftChanges.FirstOrDefault(x => x.Aboard);
        var left = aircraftChanges.Where(x => !x.Aboard && aboard.Aboard && x.Time >= aboard.Time)
            .Select(x => (double?)x.Time).FirstOrDefault()
            ?? ownerPawns.Select(p => p.DiveFromBus).FirstOrDefault(t => t is not null);
        var landed = Landing(ownerSamples, left);

        var reboots = ownerState?.RebootTimes.Where(t => t >= 0 && t <= duration).Select(ReplayUnits.Seconds).ToArray() ?? [];
        var died = combat.Where(e => e.Kind == "elimination" && e.Victim == owner?.Name &&
                e.Time >= (left ?? 0) && (reboots.Length == 0 || e.Time >= reboots[^1]))
            .Select(x => (double?)x.Time).LastOrDefault();
        var matchEnd = ReplayUnits.Within(replay.GameData.MatchEndTime - offset, duration);
        matchEnd ??= ReplayUnits.Within(replay.TeamStats?.Info.StartTime / 1000d, duration);
        var timings = new Timings(busLaunch, ReplayUnits.Within(left, duration), landed is Sample land ? ReplayUnits.Seconds(land.Time) : null,
            died, matchEnd, died ?? matchEnd ?? duration, landed?.Position.Array(), reboots);
        var stub = landed is null && replay.TeamStats is null && replay.Stats is null && combat.Count == 0;
        var stats = replay.Stats;
        var teamSize = replay.GameData.CurrentPlaylist?.Split('_').LastOrDefault() switch
        {
            "Solo" => 1, "Duo" => 2, "Trio" => 3, "Squad" => 4, _ => (int?)null
        };
        var meta = new Meta(id, Path.GetFileName(file), replay.GameData.GameSessionId, HeaderUtc(replay.Info.Timestamp, zone),
            duration, replay.GameData.CurrentPlaylist, owner?.Name, teamSize, owner is null ? null : teammates.Length,
            people.Count > 0 ? people.Count : null, people.Count > 0 ? people.Values.Count(p => p.Bot) : null,
            replay.TeamStats?.Position, replay.TeamStats?.Position,
            stats?.Eliminations ?? ownerState?.Kills ?? ownerPlayer?.Kills,
            owner is null ? null : combat.Count(c => c.Kind == "knock" && c.Killer == owner.Name),
            stats?.Assists, stats is null ? null : (ulong)stats.WeaponDamage + stats.OtherDamage, stats?.DamageTaken,
            stats?.TotalTraveled, stub, stub ? "recording ended before landing without match stats or combat events" : null, size);

        var match = new Match(meta, timings)
        {
            OwnerTrack = owner is null ? null : new(owner.Name, Downsample(ownerPawns, .25, duration)),
            TeammateTracks = teammates.OrderBy(p => p.Name, StringComparer.Ordinal)
                .Select(p => new Track(p.Name, Downsample(pawnByState[p.State], 1, duration))).ToList(),
            Searches = attribution.Searches.Select(s => s.Search).ToList(),
            Combat = combat,
            StormCircles = capture.Storms.Where(s => s.Time >= 0 && s.Time <= duration)
                .Select(s => s with { ShrinkStart = ReplayUnits.Within(s.ShrinkStart, duration),
                    ShrinkEnd = ReplayUnits.Within(s.ShrinkEnd, duration) }).ToList(),
            BattleBus = bus,
            OwnerPickups = owner is null ? [] : capture.Pickups.Values.SelectMany(p => p.Targets
                .Where(t => capture.Pawns.GetValueOrDefault(t.Key)?.State == owner.State && t.Value.Time <= duration)
                .Select(t => new Collected(ReplayUnits.Seconds(t.Value.Time), p.Definition, t.Value.Count, p.Spawn?.Array())))
                .OrderBy(p => p.Time).ToList(),
            Extras = owner is null ? null : MakeExtras(capture, ownerPawns, ownerSamples, duration, ownerState, stats)
        };
        return new(match, owner, attribution, capture.Containers.Values.Select(c => c.Container).ToArray());
    }

    static DateTime? HeaderUtc(DateTime timestamp, TimeZoneInfo zone) => timestamp == default ? null : timestamp.Kind == DateTimeKind.Utc ? timestamp :
        timestamp.Kind == DateTimeKind.Local ? timestamp.ToUniversalTime() : TimeZoneInfo.ConvertTimeToUtc(timestamp, zone);

    static Sample? Landing(Sample[] samples, double? left)
    {
        if (left is not double departure) return null;
        var airborne = false;
        const int air = PawnTrack.Skydiving | PawnTrack.Parachute;
        foreach (var sample in samples.Where(s => s.Time >= departure - 0.5))
        {
            if (sample.Time > departure + 160) break;
            if ((sample.Flags & air) != 0) airborne = true;
            else if (airborne && sample.Time >= departure && (sample.Known & air) != 0) return sample;
        }
        return null;
    }

    static List<double[]> Downsample(IEnumerable<PawnTrack> pawns, double interval, double duration)
    {
        var result = new List<double[]>();
        foreach (var pawn in pawns.OrderBy(p => p.Start))
        {
            double next = 0;
            Sample? previous = null;
            foreach (var s in pawn.Samples)
            {
                if (s.Time < 0 || s.Time > duration) continue;
                var changed = previous is Sample p && interval < 1 && (s.Flags != p.Flags || s.Known != p.Known);
                if (s.Time + 0.01 < next && !changed) continue;
                result.Add([ReplayUnits.Seconds(s.Time), ReplayUnits.Cm(s.Position.X), ReplayUnits.Cm(s.Position.Y),
                    ReplayUnits.Cm(s.Position.Z), s.Flags, s.Known]);
                previous = s;
                next = s.Time + interval;
            }
        }
        return result.OrderBy(r => r[0]).ToList();
    }

    static Bus? BuildBus(Capture capture, double? offset, double duration)
    {
        var flight = capture.Flights.Values.Where(f => f.Start is not null)
            .OrderByDescending(f => f.ServerStart is not null).ThenBy(f => f.FirstSeen).FirstOrDefault();
        if (flight?.Start is not Point start) return null;
        var time = flight.ServerStart - offset;
        if (time is < 0) time = 0;
        var endTime = flight.ServerEnd - offset;
        var elapsed = flight.ServerEnd - flight.ServerStart ?? flight.TimeTillEnd;
        int[]? end = null;
        if (flight.Rotation is { } r && elapsed is > 0 and < 300 && flight.Speed is > 0)
        {
            var pitch = r.Pitch * Math.PI / 180;
            var yaw = r.Yaw * Math.PI / 180;
            var distance = elapsed.Value * flight.Speed.Value;
            end = new Point(start.X + distance * Math.Cos(pitch) * Math.Cos(yaw),
                start.Y + distance * Math.Cos(pitch) * Math.Sin(yaw), start.Z + distance * Math.Sin(pitch)).Array();
        }
        return new(flight.Source, start.Array(), end, ReplayUnits.Within(time, duration), ReplayUnits.Within(endTime, duration),
            flight.Speed is double speed ? ReplayUnits.Cm(speed) : null);
    }

    static Extras MakeExtras(Capture capture, PawnTrack[] pawns, Sample[] samples, double duration, State? owner,
        FortniteReplayReader.Models.Events.Stats? stats)
    {
        var weapons = new Dictionary<string, double>(StringComparer.Ordinal);
        foreach (var pawn in pawns)
        {
            for (var i = 0; i < pawn.Equipped.Count; i++)
            {
                var (start, weapon) = pawn.Equipped[i];
                var end = i + 1 < pawn.Equipped.Count ? pawn.Equipped[i + 1].Time : pawn.Samples.LastOrDefault().Time;
                if (end > start && capture.Weapons.TryGetValue(weapon, out var name))
                    weapons[name] = weapons.GetValueOrDefault(name) + Math.Min(end, duration) - start;
            }
        }
        double? storm = null;
        for (var i = 0; i < samples.Length; i++)
        {
            if ((samples[i].Known & PawnTrack.Storm) == 0) continue;
            storm ??= 0;
            if (i + 1 < samples.Length && (samples[i].Flags & PawnTrack.Storm) != 0 && samples[i + 1].Time - samples[i].Time <= 2)
                storm += samples[i + 1].Time - samples[i].Time;
        }
        return new(stats?.Revives, stats?.Accuracy is float a && float.IsFinite(a) ? a : null,
            storm is double s ? ReplayUnits.Seconds(s) : null,
            pawns.Any(p => p.EmoteObserved) ? pawns.Sum(p => p.EmoteStarts.Count) : null,
            owner?.Reboots, weapons.OrderByDescending(w => w.Value).ThenBy(w => w.Key, StringComparer.Ordinal)
                .ToDictionary(w => w.Key, w => ReplayUnits.Seconds(w.Value), StringComparer.Ordinal), owner?.Thanked);
    }
}
