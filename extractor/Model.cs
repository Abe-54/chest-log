using Unreal.Core.Models;

static class ReplayUnits
{
    public static double Seconds(double value) => Math.Round(value, 3);
    public static int Cm(double value) => (int)Math.Round(value);
    public static int[]? Position(FVector? value) => Point.From(value)?.Array();
    public static double? Within(double? value, double duration) =>
        value is >= 0 && value <= duration ? Seconds(value.Value) : null;
}

readonly record struct Point(double X, double Y, double Z)
{
    public static Point? From(FVector? v) =>
        v is not null && double.IsFinite(v.X) && double.IsFinite(v.Y) && double.IsFinite(v.Z)
        && Math.Abs(v.X) < int.MaxValue && Math.Abs(v.Y) < int.MaxValue && Math.Abs(v.Z) < int.MaxValue
            ? new(v.X, v.Y, v.Z) : null;

    public int[] Array() => [ReplayUnits.Cm(X), ReplayUnits.Cm(Y), ReplayUnits.Cm(Z)];
    public double Distance(Point p) => Math.Sqrt(Math.Pow(X - p.X, 2) + Math.Pow(Y - p.Y, 2) + Math.Pow(Z - p.Z, 2));
    public Point Towards(Point end, double fraction) =>
        new(X + (end.X - X) * fraction, Y + (end.Y - Y) * fraction, Z + (end.Z - Z) * fraction);

    public static Point Median(IEnumerable<Point> positions)
    {
        var values = positions.ToArray();
        return new(Mid(values.Select(p => p.X)), Mid(values.Select(p => p.Y)), Mid(values.Select(p => p.Z)));
    }

    static double Mid(IEnumerable<double> values)
    {
        var sorted = values.Order().ToArray();
        return (sorted[(sorted.Length - 1) / 2] + sorted[sorted.Length / 2]) / 2;
    }
}

sealed record Person(uint State, string Name, string? NetId, int? Team, bool Bot);
readonly record struct Sample(double Time, Point Position, int Flags, int Known);
sealed record Track(string Name, List<double[]> Samples);
sealed record Item(string? Definition, int? Count);
sealed record Collected(double Time, string? Definition, int? Count, int[]? Position);
sealed record Combat(double Time, string Kind, string? Killer, string? Victim, int[]? Position, int? DeathCause,
    string[]? DeathTags, int? EventGunType, string? Weapon, bool OwnerInvolved, bool TeammateInvolved, string Source);
sealed record Storm(double Time, float? Phase, int[]? LastCenter, int? LastRadius, int[]? NextCenter, int? NextRadius,
    int[]? NextNextCenter, int? NextNextRadius, double? ShrinkStart, double? ShrinkEnd);
sealed record Bus(string Source, int[] Start, int[]? End, double? StartTime, double? EndTime, int? SpeedCmPerSecond);
sealed record Timings(double? BusLaunch, double? OwnerLeftBus, double? OwnerLanded, double? OwnerDied, double? MatchEnded,
    double OwnerDiedOrMatchEnded, int[]? LandingPosition, double[] OwnerReboots);
sealed record Extras(uint? Revives, float? Accuracy, double? StormSecondsObserved, int? EmoteStartsObserved,
    uint? TimesRebooted, Dictionary<string, double> WeaponEquippedSecondsObserved, bool? ThankedBusDriver);
sealed record Meta(string Id, string File, string? SessionId, DateTime? StartUtc, double Duration, string? Playlist,
    string? Owner, int? TeamSize, int? ObservedTeammates, int? PlayerCount, int? BotCount, uint? Placement,
    uint? TeamStatsPosition, uint? Kills, int? Knocks, uint? Assists, ulong? DamageDealt, uint? DamageTaken,
    uint? DistanceTravelledCm, bool Stub, string? StubReason, long Bytes);

sealed class Match(Meta meta, Timings timings)
{
    public Meta Meta { get; } = meta;
    public Timings Timings { get; } = timings;
    public Track? OwnerTrack { get; init; }
    public List<Track> TeammateTracks { get; init; } = [];
    public List<Search> Searches { get; init; } = [];
    public List<Combat> Combat { get; init; } = [];
    public List<Storm> StormCircles { get; init; } = [];
    public Bus? BattleBus { get; init; }
    public List<Collected> OwnerPickups { get; init; } = [];
    public Extras? Extras { get; init; }
}

sealed record Container(string Id, string Kind, string Class, bool Stable);

sealed class Search
{
    public required double Time { get; init; }
    public required string Kind { get; init; }
    public required string Class { get; init; }
    public required string ChestId { get; init; }
    public required bool StableId { get; init; }
    public required string Signal { get; init; }
    public required bool InitialState { get; init; }
    /** Broken open instead of searched: destroyed before, or within half a second of, its first search. */
    public bool Broken { get; init; }
    public int? LootTier { get; init; }
    public string? Opener { get; set; }
    public string? Role { get; set; }
    public int[]? LootPosition { get; set; }
    public int[]? EstimatedContainerPosition { get; set; }
    public int[]? OpenerPosition { get; set; }
    public int? OpenerDistanceCm { get; set; }
    public int? SecondNearestDistanceCm { get; set; }
    public int? PositionSampleAgeMs { get; set; }
    public string Method { get; set; } = "unattributed";
    public string Confidence { get; set; } = "low";
    public string? AttributionNote { get; set; }
    public Item[] Loot { get; set; } = [];
}

sealed record RegistryEntry(string Kind, string Class, bool StableId, int[]? Position, int MatchesAppeared,
    int OwnerSearches, int TeammateSearches, int EnemySearches, int UnattributedSearches);
sealed record MatchRow(string Id, string File, DateTime? StartUtc, string? Playlist, double? Duration,
    uint? Placement, uint? Kills, int? OwnerChestCount, Dictionary<string, int>? OtherOwnerContainers,
    int[]? LandingPosition, bool? Stub, string? Error);
sealed record Week(int Matches, int ParsedMatches, int RealMatches, int Stubs, int Errors, int OwnerChests,
    double? AveragePerRealMatch, Dictionary<string, int> OtherOwnerContainers, int OwnerChestsInStubs);
sealed record Index(Week Week, List<MatchRow> Matches);
