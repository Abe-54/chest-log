using System.Diagnostics.CodeAnalysis;
using FortniteReplayReader.Models.NetFieldExports;
using FortniteReplayReader.Models.NetFieldExports.Weapons;
using Unreal.Core;
using Unreal.Core.Contracts;
using Unreal.Core.Models;
using Unreal.Core.Models.Enums;

sealed class Capture(ExportInventory inventory, string matchId) : FortniteReplayReader.ReplayReader(null!, ParseMode.Debug)
{
    public Dictionary<uint, State> States { get; } = [];
    public Dictionary<uint, PawnTrack> Pawns { get; } = [];
    public Dictionary<uint, Pickup> Pickups { get; } = [];
    public Dictionary<uint, string> Weapons { get; } = [];
    public Dictionary<uint, Flight> Flights { get; } = [];
    public Dictionary<string, ContainerState> Containers { get; } = new(StringComparer.Ordinal);
    public List<Observation> Observations { get; } = [];
    public HashSet<string> Broken { get; } = new(StringComparer.Ordinal);
    public List<Incident> Incidents { get; } = [];
    public List<Storm> Storms { get; } = [];
    public List<double> ClockOffsets { get; } = [];
    double? offset;
    readonly Dictionary<NetFieldExportGroup, ContainerClass?> classes = [];

    public void CaptureGroups()
    {
        foreach (var group in _netGuidCache.NetFieldExportGroupMap.Values)
            inventory.Add(group);
    }

    protected override void Cleanup()
    {
        CaptureGroups();
        base.Cleanup();
    }

    protected override void OnChannelClosed(uint channelIndex, NetworkGUID? actor)
    {
        if (actor is not null && Pawns.TryGetValue(actor.Value, out var pawn))
            pawn.Closed = CurrentTimeSeconds;
        base.OnChannelClosed(channelIndex, actor);
    }

    public override bool ReceiveProperties(FBitArchive archive, NetFieldExportGroup group, uint channelIndex,
        [NotNullWhen(true)] out INetFieldExportGroup? exportGroup, bool enablePropertyChecksum = true, bool netDeltaUpdate = false)
    {
        if (!classes.TryGetValue(group, out var type))
            classes[group] = type = ContainerExports.Classify(group);
        if (type is null || netDeltaUpdate || Channels[channelIndex]?.ActorId is not uint actor)
            return base.ReceiveProperties(archive, group, channelIndex, out exportGroup, enablePropertyChecksum, netDeltaUpdate);

        var delta = ContainerExports.Read(archive, group, type, enablePropertyChecksum, inventory);
        exportGroup = delta;
        if (archive.IsError)
            return false;

        var rawClass = ExportInventory.ClassName(group.PathName);
        _netGuidCache.TryGetPathName(actor, out var path);
        var stable = path?.Contains("_UAID_", StringComparison.Ordinal) == true;
        var id = stable ? path! : $"{matchId}:{actor}";
        if (!Containers.TryGetValue(id, out var state))
            Containers[id] = state = new(new(id, type.Kind, rawClass, stable));

        var initial = !state.Seen;
        state.Seen = true;
        if (delta.Pawn is uint pawn)
        {
            state.Pawn = pawn == 0 ? null : pawn;
            state.PawnTime = CurrentTimeSeconds;
            if (pawn != 0) inventory.Count(group.PathName, "nonzeroPawn", 0);
        }
        state.Tier = delta.Tier ?? state.Tier;
        state.Source = delta.Source ?? state.Source;
        var increased = delta.Animation > (state.Animation ?? 0);
        if (delta.Animation is uint animation)
            state.Animation = Math.Max(animation, state.Animation ?? 0);
        // A chest broken open (pickaxe, explosion, a falling building) spills its loot without a search animation.
        var broke = delta.Destroyed && !initial && (state.LastSearch is null || CurrentTimeSeconds - state.LastSearch <= 0.5);
        if (broke) Broken.Add(id);
        if (!delta.FromDestruction && (delta.Searched || increased || delta.SpecialOpen || broke))
        {
            var signal = delta.SpecialOpen ? type.Open! : increased ? "SearchAnimationCount" : delta.Searched ? "bAlreadySearched" : "bDestroyed";
            var opener = CurrentTimeSeconds - state.PawnTime <= 1 ? state.Pawn : null;
            if (state.LastSearch is null || CurrentTimeSeconds - state.LastSearch <= 0.25 && opener is not null)
            {
                Observations.Add(new(state.Container, state.LastSearch ?? CurrentTimeSeconds, signal, initial, state.Tier,
                    opener, actor, state.Source, Point.From(Channels[channelIndex]?.Actor?.Location)));
                state.LastSearch ??= CurrentTimeSeconds;
            }
        }
        else if (state.LastSearch is double searchTime && delta.Pawn > 0 && CurrentTimeSeconds - searchTime <= 0.12)
        {
            Observations.Add(new(state.Container, searchTime, "SearchingPawn", false, state.Tier, state.Pawn, actor,
                state.Source, Point.From(Channels[channelIndex]?.Actor?.Location)));
        }
        return true;
    }

    protected override void OnExportRead(uint channelIndex, INetFieldExportGroup? exportGroup)
    {
        base.OnExportRead(channelIndex, exportGroup);
        if (Channels[channelIndex]?.ActorId is not uint actor)
            return;
        var t = (double)CurrentTimeSeconds;
        switch (exportGroup)
        {
            case GameState g:
                var world = g.ReplicatedWorldTimeSecondsDouble ?? g.ReplicatedWorldTimeSeconds;
                if (world > 0 && double.IsFinite(world.Value))
                {
                    offset = world.Value - t;
                    ClockOffsets.Add(offset.Value);
                }
                if (g.FlightStartLocation is not null)
                {
                    var gameFlight = new Flight(t) { Start = Point.From(g.FlightStartLocation), Rotation = g.FlightStartRotation,
                        Speed = g.FlightSpeed, TimeTillEnd = g.TimeTillFlightEnd, Source = "game_state_flight_plan" };
                    Flights.TryAdd(actor, gameFlight);
                }
                break;
            case FortPlayerState s:
                if (!States.TryGetValue(actor, out var ps)) States[actor] = ps = new();
                ps.Id = s.PlayerId is uint id ? (int)id : s.PlayerID ?? ps.Id;
                ps.NetId = s.UniqueId ?? s.UniqueID ?? s.BotUniqueId ?? ps.NetId;
                ps.Team = s.TeamIndex is > 0 ? s.TeamIndex : ps.Team;
                ps.Bot = s.bIsABot ?? ps.Bot;
                ps.Spectator = s.bOnlySpectator ?? ps.Spectator;
                ps.Kills = s.KillScore ?? ps.Kills;
                ps.Thanked = s.bThankedBusDriver ?? ps.Thanked;
                if (s.bInAircraft is bool aboard && ps.InAircraft != aboard)
                {
                    ps.InAircraft = aboard;
                    ps.Aircraft.Add((t, aboard));
                }
                if (s.FinisherOrDowner is uint finisher) ps.LastFinisher = finisher == 0 ? null : finisher;
                if (s.DeathCause is int cause) ps.LastCause = cause;
                var death = Point.From(s.DeathLocation);
                if (s.bDBNO == true || death is not null || s.DeathCause is not null || s.DeathTags is not null)
                {
                    var tags = s.DeathTags?.Tags?.Select(x => x.TagName).Where(x => !string.IsNullOrEmpty(x)).ToArray();
                    var weapons = s.FinisherOrDownerTags?.Tags?.Select(tag => tag.TagName)
                        .Where(name => name?.StartsWith("Item.Weapon.", StringComparison.Ordinal) == true).Distinct().ToArray();
                    Incidents.Add(new(t, actor, ps.LastFinisher, s.bDBNO, death, ps.LastCause, tags,
                        weapons?.Length == 1 ? weapons[0] : null));
                }
                if (s.RebootCounter is uint reboots && reboots > (ps.Reboots ?? 0))
                {
                    ps.Reboots = reboots;
                    ps.RebootTimes.Add(t);
                    ps.LastFinisher = null;
                    ps.LastCause = null;
                }
                break;
            case PlayerPawn p:
                if (!Pawns.TryGetValue(actor, out var track))
                    Pawns[actor] = track = new(t);
                track.Closed = null;
                track.Update(t, p);
                break;
            case FortPickup p:
                if (!Pickups.TryGetValue(actor, out var pickup))
                    Pickups[actor] = pickup = new(actor, t, Point.From(Channels[channelIndex]?.Actor?.Location));
                pickup.Definition = p.ItemDefinition?.Name ?? pickup.Definition;
                pickup.Count ??= p.Count;
                if (p.bTossedFromContainer == true)
                {
                    pickup.Toss ??= t;
                    pickup.Loot ??= Point.From(p.LootInitialPosition) ?? pickup.Spawn;
                }
                if (p.PickupTarget > 0)
                    pickup.Targets.TryAdd(p.PickupTarget.Value, (t, p.Count ?? pickup.Count));
                break;
            case BaseWeapon w when w.WeaponData?.Name is string definition:
                Weapons[actor] = definition;
                break;
            case SafeZoneIndicator s when s.LastCenter is not null || s.NextCenter is not null || s.NextNextCenter is not null ||
                s.LastRadius > 0 || s.NextRadius > 0 || s.NextNextRadius > 0 || s.SafeZoneStartShrinkTime > 0 || s.SafeZoneFinishShrinkTime > 0:
                var storm = new Storm(ReplayUnits.Seconds(t), s.CurrentPhase > 0 ? s.CurrentPhase : null,
                    ReplayUnits.Position(s.LastCenter), Radius(s.LastRadius), ReplayUnits.Position(s.NextCenter), Radius(s.NextRadius),
                    ReplayUnits.Position(s.NextNextCenter), Radius(s.NextNextRadius),
                    s.SafeZoneStartShrinkTime > 0 ? s.SafeZoneStartShrinkTime - offset : null,
                    s.SafeZoneFinishShrinkTime > 0 ? s.SafeZoneFinishShrinkTime - offset : null);
                Storms.Add(storm);
                break;
            case Aircraft a:
                if (!Flights.TryGetValue(actor, out var flight))
                    Flights[actor] = flight = new(t);
                flight.Start = Point.From(a.FlightStartLocation) ?? flight.Start;
                flight.Rotation = a.FlightStartRotation ?? flight.Rotation;
                if (a.FlightSpeed > 0) flight.Speed = a.FlightSpeed;
                if (a.TimeTillFlightEnd > 0) flight.TimeTillEnd = a.TimeTillFlightEnd;
                if (a.FlightStartTime > 0) flight.ServerStart = a.FlightStartTime;
                if (a.FlightEndTime > 0) flight.ServerEnd = a.FlightEndTime;
                break;
        }
    }

    static int? Radius(float value) => value > 0 && float.IsFinite(value) ? ReplayUnits.Cm(value) : null;
}

sealed class State
{
    public int? Id, Team, LastCause;
    public uint? LastFinisher, Kills, Reboots;
    public string? NetId;
    public bool Bot, Spectator;
    public bool? InAircraft, Thanked;
    public List<(double Time, bool Aboard)> Aircraft { get; } = [];
    public List<double> RebootTimes { get; } = [];
}
sealed record Incident(double Time, uint Victim, uint? Killer, bool? Down, Point? Position, int? Cause, string[]? Tags,
    string? WeaponTag);
sealed class Flight(double time)
{
    public double FirstSeen { get; } = time;
    public string Source = "aircraft_flight_plan";
    public Point? Start;
    public FRotator? Rotation;
    public double? Speed, TimeTillEnd, ServerStart, ServerEnd;
}

sealed class Pickup(uint actor, double time, Point? spawn)
{
    public uint Actor { get; } = actor;
    public double Born { get; } = time;
    public Point? Spawn { get; } = spawn;
    public double? Toss { get; set; }
    public Point? Loot { get; set; }
    public string? Definition { get; set; }
    public int? Count { get; set; }
    public Dictionary<uint, (double Time, int? Count)> Targets { get; } = [];
}

sealed class PawnTrack(double start)
{
    public uint? State { get; private set; }
    public double Start { get; } = start;
    public double? Closed { get; set; }
    public double? DiveFromBus { get; private set; }
    public List<Sample> Samples { get; } = [];
    public List<(double Time, uint Weapon)> Equipped { get; } = [];
    public List<double> EmoteStarts { get; } = [];
    public bool EmoteObserved { get; private set; }
    bool emotePlaying;
    int flags, known;
    Point? lastPosition;

    public const int Skydiving = 1, Parachute = 2, Sprinting = 4, Crouched = 8, Water = 16, Downed = 32, Storm = 64, Vehicle = 128;

    public void Update(double t, PlayerPawn pawn)
    {
        if (pawn.PlayerState > 0) State = pawn.PlayerState;
        var previousFlags = flags;
        var previousKnown = known;
        Flag(Skydiving, pawn.bIsSkydiving);
        Flag(Parachute, pawn.bIsParachuteOpen);
        Flag(Sprinting, pawn.bIsTacticalSprinting ?? pawn.bIsSprinting);
        Flag(Crouched, pawn.bIsCrouched);
        Flag(Water, pawn.bIsInWaterVolume);
        Flag(Downed, pawn.bIsDBNO);
        Flag(Storm, pawn.bIsInAnyStorm);
        Flag(Vehicle, pawn.Vehicle is uint v ? v != 0 : null);
        if (pawn.bIsSkydivingFromBus == true) DiveFromBus ??= t;
        if (pawn.CurrentWeapon is uint w && (Equipped.Count == 0 || Equipped[^1].Weapon != w))
            Equipped.Add((t, w));
        if (pawn.bIsPlayingEmote is bool emote)
        {
            EmoteObserved = true;
            if (emote && !emotePlaying) EmoteStarts.Add(t);
            emotePlaying = emote;
        }

        var movement = Point.From(pawn.ReplicatedMovement?.Location);
        if (movement is not null) lastPosition = movement;
        if (lastPosition is Point position && (movement is not null || flags != previousFlags || known != previousKnown))
        {
            var sample = new Sample(t, position, flags, known);
            if (Samples.Count != 0 && Samples[^1].Time == t) Samples[^1] = sample;
            else Samples.Add(sample);
        }
    }

    void Flag(int bit, bool? value)
    {
        if (value is not bool active) return;
        known |= bit;
        flags = active ? flags | bit : flags & ~bit;
    }

    public (Point Position, double Age)? At(double t)
    {
        if (t < Start || t >= Closed || Samples.Count == 0)
            return null;
        var low = 0;
        var high = Samples.Count;
        while (low < high)
        {
            var middle = (low + high) / 2;
            if (Samples[middle].Time < t) low = middle + 1;
            else high = middle;
        }
        var before = low > 0 ? Samples[low - 1] : (Sample?)null;
        var after = low < Samples.Count ? Samples[low] : (Sample?)null;
        if (before is Sample a && after is Sample b && t - a.Time <= 0.65 && b.Time - t <= 0.65 &&
            a.Position.Distance(b.Position) <= 2500)
            return (a.Position.Towards(b.Position, (t - a.Time) / (b.Time - a.Time)), Math.Max(t - a.Time, b.Time - t));
        var nearest = before is Sample p && (after is null || t - p.Time < after.Value.Time - t) ? before : after;
        return nearest is Sample sample && Math.Abs(sample.Time - t) <= 0.65
            ? (sample.Position, Math.Abs(sample.Time - t)) : null;
    }
}
