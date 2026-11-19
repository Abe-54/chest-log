using System.Text.Json;
using System.Text.Json.Serialization;

sealed record Failure(string Id, string File, string Error);
sealed record Completed(Index Index, SortedDictionary<string, RegistryEntry> Chests);

/// <summary>One replay after stage one, in the form a cache can store. It says nothing about any other replay.</summary>
sealed record Pending(string Version, Match Match, uint? OwnerState, Container[] Containers, AttributionState Attribution);

sealed class Dataset(Index index, SortedDictionary<string, RegistryEntry> chests, Dictionary<string, Match> matches)
{
    public Index Index { get; } = index;
    public SortedDictionary<string, RegistryEntry> Chests { get; } = chests;

    public string IndexJson() => JsonSerializer.Serialize(Index, EngineJson.Default.Index);
    public string ChestsJson() => JsonSerializer.Serialize(Chests, EngineJson.Default.SortedDictionaryStringRegistryEntry);
    public string CompletedJson() => JsonSerializer.Serialize(new Completed(Index, Chests), EngineJson.Default.Completed);

    /// <summary>The completed match as JSON. The match is released from memory.</summary>
    public string TakeMatch(string id)
    {
        if (!matches.Remove(id, out var match))
            throw new KeyNotFoundException($"No completed match {id}");
        return JsonSerializer.Serialize(match, EngineJson.Default.Match);
    }

    public IEnumerable<(string Id, string Json)> TakeAll()
    {
        foreach (var id in matches.Keys.ToArray())
            yield return (id, TakeMatch(id));
    }
}

[JsonSourceGenerationOptions(JsonSerializerDefaults.Web)]
[JsonSerializable(typeof(Pending))]
[JsonSerializable(typeof(Match))]
[JsonSerializable(typeof(Index))]
[JsonSerializable(typeof(SortedDictionary<string, RegistryEntry>))]
[JsonSerializable(typeof(Completed))]
[JsonSerializable(typeof(Failure[]))]
sealed partial class EngineJson : JsonSerializerContext;

/// <summary>
/// The extraction in two stages. <see cref="Parse"/> turns one replay into pending JSON on its own.
/// <see cref="Complete"/> turns a set of loaded pendings into the dataset. The console program and the browser build both go through these.
/// </summary>
static class Engine
{
    /// <summary>Changes with any rebuild of the replay parser or of this engine, so pending JSON from another build is never reused.</summary>
    public static string Version { get; } = BuildVersion();

    /// <param name="timeZone">IANA id of the zone the replays were recorded in, for header timestamps that carry no kind.</param>
    /// <param name="exports">Optional sink for the export-group inventory the console writes as debug files.</param>
    public static string Parse(byte[] bytes, string fileName, string timeZone, ExportInventory? exports = null)
    {
        var zone = TimeZoneInfo.FindSystemTimeZoneById(timeZone);
        var id = Path.GetFileNameWithoutExtension(fileName);
        var capture = new Capture(exports ?? new ExportInventory(), id);
        try
        {
            using var stream = new MemoryStream(bytes, false);
            var replay = capture.ReadReplay(stream);
            var parsed = MatchBuilder.Build(fileName, bytes.Length, id, replay, capture, zone);
            var pending = new Pending(Version, parsed.Match, parsed.Owner?.State, parsed.Containers, parsed.Attribution.Snapshot(parsed.Owner));
            return JsonSerializer.Serialize(pending, EngineJson.Default.Pending);
        }
        finally
        {
            capture.CaptureGroups();
        }
    }

    public static ParsedMatch Load(string pendingJson)
    {
        var pending = JsonSerializer.Deserialize(pendingJson, EngineJson.Default.Pending) ?? throw new InvalidDataException("Pending JSON is null");
        if (pending.Version != Version)
            throw new InvalidDataException($"Pending was parsed by engine {pending.Version}, this is engine {Version}");
        var owner = pending.OwnerState is uint state ? pending.Attribution.People.Single(p => p.State == state) : null;
        return new(pending.Match, owner, Attribution.Restore(pending.Match, pending.Attribution), pending.Containers);
    }

    /// <summary>Consumes <paramref name="parsed"/>: the matches are completed in place and handed to the dataset.</summary>
    public static Dataset Complete(IEnumerable<ParsedMatch> parsed, IEnumerable<Failure> failures)
    {
        var extracted = parsed.OrderBy(p => p.Match.Meta.File, StringComparer.Ordinal).ThenBy(p => p.Match.Meta.Id, StringComparer.Ordinal).ToList();
        var rows = failures.Select(f => new MatchRow(f.Id, f.File, null, null, null, null, null, null, null, null, null, f.Error)).ToList();

        var registryFixes = extracted.SelectMany(m => m.Match.Searches)
            .Where(s => s.StableId && s.Confidence == "high" && s.LootPosition is not null)
            .GroupBy(s => s.ChestId, StringComparer.Ordinal).ToDictionary(g => g.Key,
                g => Point.Median(g.Select(s => AsPoint(s.LootPosition!))), StringComparer.Ordinal);

        var matches = new Dictionary<string, Match>(StringComparer.Ordinal);
        foreach (var item in extracted)
        {
            item.Attribution.MatchLoot(item.Owner, registryFixes);
            item.Attribution.Complete(item.Owner, registryFixes);
            var match = item.Match;
            var meta = match.Meta;
            var owner = match.Searches.Where(s => s.Role == "owner").ToArray();
            rows.Add(new(meta.Id, meta.File, meta.StartUtc, meta.Playlist, meta.Duration, meta.Placement, meta.Kills,
                owner.Count(IsChest), Other(owner), match.Timings.LandingPosition, meta.Stub, null));
            matches.Add(meta.Id, match);
        }

        var searches = extracted.SelectMany(m => m.Match.Searches).ToLookup(s => s.ChestId, StringComparer.Ordinal);
        var registry = new SortedDictionary<string, RegistryEntry>(StringComparer.Ordinal);
        foreach (var group in extracted.SelectMany(m => m.Containers).GroupBy(c => c.Id, StringComparer.Ordinal))
        {
            var c = group.First();
            var events = searches[c.Id].ToArray();
            var points = events.Where(s => s.LootPosition is not null).Select(s => AsPoint(s.LootPosition!)).ToArray();
            registry.Add(c.Id, new(c.Kind, c.Class, c.Stable, points.Length == 0 ? null : Point.Median(points).Array(),
                group.Count(), events.Count(s => s.Role == "owner"), events.Count(s => s.Role == "teammate"),
                events.Count(s => s.Role == "enemy"), events.Count(s => s.Role is null)));
        }

        var real = rows.Where(r => r.Stub == false && r.Error is null).ToArray();
        var stubs = rows.Where(r => r.Stub == true).ToArray();
        var total = real.Sum(r => r.OwnerChestCount ?? 0);
        var week = new Week(rows.Count, extracted.Count, real.Length, stubs.Length, rows.Count - extracted.Count, total,
            real.Length > 0 ? Math.Round((double)total / real.Length, 3) : null,
            real.SelectMany(r => r.OtherOwnerContainers!).GroupBy(k => k.Key).OrderBy(g => g.Key, StringComparer.Ordinal)
                .ToDictionary(g => g.Key, g => g.Sum(k => k.Value), StringComparer.Ordinal),
            stubs.Sum(r => r.OwnerChestCount ?? 0));
        return new(new Index(week, rows.OrderBy(r => r.File, StringComparer.Ordinal).ToList()), registry, matches);
    }

    static Point AsPoint(int[] p) => new(p[0], p[1], p[2]);
    static bool IsChest(Search s) => s.Kind is "chest" or "rare_chest";
    static Dictionary<string, int> Other(IEnumerable<Search> s) => s.Where(x => !IsChest(x))
        .GroupBy(x => x.Kind).OrderBy(g => g.Key, StringComparer.Ordinal).ToDictionary(g => g.Key, g => g.Count(), StringComparer.Ordinal);

    static string BuildVersion()
    {
        var assemblies = new[]
        {
            typeof(Engine), typeof(FortniteReplayReader.ReplayReader), typeof(Unreal.Core.FArchive), typeof(Unreal.Encryption.Oodle), typeof(OozSharp.Kraken)
        }.Select(t => t.Assembly.ManifestModule.ModuleVersionId);
        var hash = 14695981039346656037UL;
        foreach (var mvid in assemblies)
            foreach (var b in mvid.ToByteArray())
                hash = (hash ^ b) * 1099511628211UL;
        return hash.ToString("x16");
    }
}
