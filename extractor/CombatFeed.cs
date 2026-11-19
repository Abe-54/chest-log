using FortniteReplayReader.Models;

static class CombatFeed
{
    public static List<Combat> Build(FortniteReplay replay, Capture capture, Dictionary<uint, Person> people,
        Person? owner, ILookup<uint, PawnTrack> pawns, double duration)
    {
        var byNetId = people.Values.Where(p => p.NetId is not null).ToLookup(p => p.NetId!, StringComparer.OrdinalIgnoreCase);
        var byName = people.Values.ToLookup(p => p.Name, StringComparer.OrdinalIgnoreCase);
        var incidents = capture.Incidents.Where(n => n.Time >= 0 && n.Time <= duration).ToArray();
        var seen = new HashSet<Incident>();
        var result = new List<Combat>();

        foreach (var ev in replay.Eliminations)
        {
            var time = ev.Info.StartTime / 1000d;
            if (time > duration) continue;
            var victim = Find(ev.EliminatedInfo.Id);
            var killer = Find(ev.EliminatorInfo.Id);
            var position = Meaningful(Point.From(ev.EliminatedInfo.Location));
            var nearby = incidents.Where(n => Math.Abs(n.Time - time) <= 1.5 &&
                (n.Down == ev.Knocked || n.Down is null) &&
                (victim is not null ? n.Victim == victim.State :
                    position is Point p && n.Position is Point q && p.Distance(q) <= 500)).ToList();
            var closest = nearby.MinBy(n => Math.Abs(n.Time - time));
            if (closest is not null)
            {
                if (victim is not null || nearby.All(n => n.Victim == closest.Victim))
                {
                    victim ??= people.GetValueOrDefault(closest.Victim);
                    if (closest.Killer is uint k) killer ??= people.GetValueOrDefault(k);
                    foreach (var n in nearby.Where(n => n.Victim == closest.Victim)) seen.Add(n);
                }
                else closest = null;
            }
            position ??= Meaningful(closest?.Position) ?? PositionAt(victim, time);
            result.Add(Make(time, ev.Knocked, killer, victim, DisplayId(ev.EliminatorInfo.Id),
                DisplayId(ev.EliminatedInfo.Id), position, closest, ev.GunType, closest is null ? "event" : "event_and_player_state"));
        }

        var network = new Dictionary<uint, double>();
        foreach (var n in incidents.Where(n => !seen.Contains(n)))
        {
            var victim = people.GetValueOrDefault(n.Victim);
            if (victim is null || n.Down != true)
                continue;
            if (network.TryGetValue(n.Victim, out var last) && n.Time - last <= 2) continue;
            if (result.Any(e => e.Victim == victim.Name && e.Kind == "knock" && Math.Abs(e.Time - n.Time) <= 2))
                continue;
            network[n.Victim] = n.Time;
            var killer = n.Killer is uint k ? people.GetValueOrDefault(k) : null;
            result.Add(Make(n.Time, true, killer, victim, null, null, Meaningful(n.Position) ?? PositionAt(victim, n.Time), n,
                null, "player_state"));
        }
        return result.Distinct().OrderBy(e => e.Time).ThenBy(e => e.Victim, StringComparer.Ordinal).ToList();

        Person? Find(string? id)
        {
            if (string.IsNullOrWhiteSpace(id) || id is "Bot") return null;
            var matches = byNetId[id].Concat(byName[id]).DistinctBy(p => p.State).Take(2).ToArray();
            return matches.Length == 1 ? matches[0] : null;
        }

        Point? PositionAt(Person? person, double time) => person is null ? null :
            pawns[person.State].Select(p => p.At(time)).Where(p => p is not null).MinBy(p => p?.Age)?.Position;

        Combat Make(double time, bool down, Person? killer, Person? victim, string? killerFallback, string? victimFallback,
            Point? pos, Incident? note, int? gun, string source)
        {
            var killerRole = Roles.Of(killer, owner);
            var victimRole = Roles.Of(victim, owner);
            return new(ReplayUnits.Seconds(time), down ? "knock" : "elimination", killer?.Name ?? killerFallback,
                victim?.Name ?? victimFallback, pos?.Array(), note?.Cause, note?.Tags, gun, note?.WeaponTag,
                killerRole == "owner" || victimRole == "owner", killerRole == "teammate" || victimRole == "teammate", source);
        }
    }

    static Point? Meaningful(Point? point) => point is { X: 0, Y: 0, Z: 0 } ? null : point;
    static string? DisplayId(string? id) => string.IsNullOrWhiteSpace(id) ||
        (id.Length >= 20 && id.All(Uri.IsHexDigit)) ? null : id;
}
