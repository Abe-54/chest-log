using System.Text.Json;

static class Verify
{
    public static int Run(string data)
    {
        var index = Read<Index>(Path.Combine(data, "index.json"));
        var registry = Read<Dictionary<string, RegistryEntry>>(Path.Combine(data, "chests.json"));
        var evidence = new Dictionary<string, List<(string? Role, Point? Loot)>>(StringComparer.Ordinal);
        var totals = new SortedDictionary<string, int>(StringComparer.Ordinal);
        var other = new SortedDictionary<string, int>(StringComparer.Ordinal);
        var lines = new List<string> { "match\tstatus\towner_chests\tattribution_method/confidence\tunattributed\towner_samples\talive_gaps_over_5s\tchecks" };
        var failures = 0;
        var gapCount = 0;
        var realChests = 0;
        var stubChests = 0;
        var realMatches = 0;
        var checkedMatches = 0;
        foreach (var row in index.Matches)
        {
            try
            {
                if (row.Error is not null) throw new InvalidDataException(row.Error);
                CheckMatch(row);
                checkedMatches++;
            }
            catch (Exception error)
            {
                failures++;
                lines.Add($"{row.Id}\terror\t-\t-\t-\t-\t-\tERROR {Clean(error.Message)}");
            }
        }

        foreach (var (id, entry) in registry)
        {
            var events = evidence.GetValueOrDefault(id) ?? [];
            var points = events.Where(e => e.Loot is not null).Select(e => e.Loot!.Value).ToArray();
            var median = points.Length > 0 ? Point.Median(points).Array() : [];
            if (entry.OwnerSearches != events.Count(e => e.Role == "owner") ||
                entry.TeammateSearches != events.Count(e => e.Role == "teammate") ||
                entry.EnemySearches != events.Count(e => e.Role == "enemy") ||
                entry.UnattributedSearches != events.Count(e => e.Role is null) ||
                events.Count > entry.MatchesAppeared || entry.MatchesAppeared is < 1 || entry.MatchesAppeared > checkedMatches ||
                !(entry.Position ?? []).SequenceEqual(median))
            {
                lines.Add($"FAIL registry counts or position {id}");
                failures++;
            }
        }

        if (index.Week.Matches != index.Matches.Count || index.Week.ParsedMatches != checkedMatches ||
            index.Week.RealMatches != realMatches || index.Week.OwnerChests != realChests || index.Week.OwnerChestsInStubs != stubChests ||
            index.Week.Stubs != checkedMatches - realMatches || index.Week.Errors != index.Matches.Count - checkedMatches ||
            index.Week.AveragePerRealMatch != (realMatches == 0 ? null : Math.Round(realChests / (double)realMatches, 3)) ||
            !index.Week.OtherOwnerContainers.OrderBy(x => x.Key, StringComparer.Ordinal).SequenceEqual(other))
        {
            lines.Add("FAIL index week totals");
            failures++;
        }

        lines.Add($"Summary: {checkedMatches}/{index.Matches.Count} matches checked; real={realMatches}; owner chests={realChests}; registry={registry.Count}; alive gaps over 5s={gapCount}; failures={failures}");
        lines.Add($"Searches by method/confidence: {Counts(totals)}");
        lines.Add("An alive gap is an interval without position samples inside an observed post-drop life. Stationary players may stop sending movement updates. Channel relevancy and recording truncation can also leave gaps.");
        Output.Lines(Path.Combine(data, "debug", "verify.txt"), lines);
        foreach (var line in lines) Console.WriteLine(line);
        return failures == 0 ? 0 : 1;

        void CheckMatch(MatchRow row)
        {
            using var doc = JsonDocument.Parse(File.ReadAllBytes(Path.Combine(data, "matches", row.Id + ".json")));
            var root = doc.RootElement;
            T ReadPart<T>(string name) => root.GetProperty(name).Deserialize<T>(Output.Options)!;
            var meta = ReadPart<Meta>("meta");
            var timing = ReadPart<Timings>("timings");
            var track = ReadPart<Track?>("ownerTrack")?.Samples ?? [];
            var combat = ReadPart<Combat[]>("combat");
            var bus = ReadPart<Bus?>("battleBus");
            var errors = new List<string>();
            bool Time(double? t) => t is null || double.IsFinite(t.Value) && t is >= 0 && t <= meta.Duration;
            void Check(bool okay, string message) { if (!okay) errors.Add(message); }
            Check(row.Id == meta.Id && row.Duration == meta.Duration && row.Stub == meta.Stub, "index metadata mismatch");
            Check(meta.Stub || track.Count > 0, "missing owner track");
            Check(meta.Placement == meta.TeamStatsPosition && meta.Placement == row.Placement, "placement differs from TeamStats.Position");
            Check(new[] { timing.BusLaunch, timing.OwnerLeftBus, timing.OwnerLanded, timing.OwnerDied, timing.MatchEnded,
                timing.OwnerDiedOrMatchEnded, bus?.StartTime, bus?.EndTime }.Concat(timing.OwnerReboots.Select(t => (double?)t)).All(Time),
                "milestone outside replay duration");
            Check(timing.OwnerLeftBus is null || timing.BusLaunch is null || timing.OwnerLeftBus >= timing.BusLaunch - 1,
                "owner exit precedes aircraft launch");
            Check(timing.OwnerLanded is null || timing.OwnerLeftBus is null || timing.OwnerLanded >= timing.OwnerLeftBus,
                "landing precedes owner exit");
            foreach (var t in ReadPart<Track[]>("teammateTracks").Select(t => t.Samples).Prepend(track))
            {
                Check(t.All(sample => sample.Length == 6 && Time(sample[0]) && sample.Skip(1).All(v => v == Math.Truncate(v))),
                    "invalid track sample");
                Check(t.Zip(t.Skip(1), (a, b) => a[0] <= b[0]).All(x => x), "unsorted track");
            }
            Check(combat.All(e => Time(e.Time)), "combat outside replay duration");
            Check(ReadPart<Collected[]>("ownerPickups").All(p => Time(p.Time)), "pickup outside replay duration");
            Check(ReadPart<Storm[]>("stormCircles").All(s => Time(s.Time) && Time(s.ShrinkEnd) && Time(s.ShrinkStart)),
                "storm circle outside replay duration");

            var groups = new SortedDictionary<string, int>(StringComparer.Ordinal);
            var kinds = new SortedDictionary<string, int>(StringComparer.Ordinal);
            var chestIds = new HashSet<string>(StringComparer.Ordinal);
            var count = 0;
            var unknown = 0;
            foreach (var search in root.GetProperty("searches").EnumerateArray())
            {
                string? String(string name) => search.GetProperty(name).GetString();
                var id = String("chestId")!;
                var kind = String("kind")!;
                var role = String("role");
                var confidence = String("confidence");
                var key = $"{String("method")}/{confidence}";
                Increment(groups, key);
                Increment(totals, key);
                Check(chestIds.Add(id), $"duplicate search {id}");
                Check(Time(search.GetProperty("time").GetDouble()), $"search outside replay duration {id}");
                Check(registry.TryGetValue(id, out var entry) && entry.Kind == kind && entry.Class == String("class"),
                    $"search missing matching registry entry {id}");
                var loot = Position(search.GetProperty("lootPosition"));
                if (!evidence.TryGetValue(id, out var events)) evidence[id] = events = [];
                events.Add((role, loot));
                if (String("opener") is null) unknown++;
                if (role != "owner") continue;
                if (kind is not ("chest" or "rare_chest"))
                {
                    Increment(kinds, kind);
                    continue;
                }

                count++;
                Check(String("opener") == meta.Owner, $"wrong owner name {id}");
                var witness = Position(search.GetProperty("openerPosition"));
                var distance = search.GetProperty("openerDistanceCm");
                Check(confidence == "low" || distance.ValueKind == JsonValueKind.Number && distance.GetInt32() <= 600 &&
                    loot is Point l && witness is Point w && l.Distance(w) <= 602, $"owner is farther than 6 m from loot {id}");
            }
            Check(row.OwnerChestCount == count, "owner chest count differs from index");
            Check(kinds.SequenceEqual((row.OtherOwnerContainers ?? []).OrderBy(x => x.Key, StringComparer.Ordinal)),
                "other owner container counts differ from index");
            if (meta.Stub) stubChests += count;
            else
            {
                realMatches++;
                realChests += count;
                foreach (var (kind, n) in kinds) other[kind] = other.GetValueOrDefault(kind) + n;
            }

            var deaths = combat.Where(c => c.Kind == "elimination" && c.Victim == meta.Owner).Select(c => c.Time).ToArray();
            var gaps = AliveGaps(track, timing, deaths);
            gapCount += gaps.Count;
            failures += errors.Count;
            var reportedGaps = gaps.Count == 0 ? "0" : $"{gaps.Count} [{string.Join(',', gaps)}]";
            lines.Add($"{row.Id}\t{(meta.Stub ? "stub" : "real")}\t{count}\t{Counts(groups)}\t{unknown}\t{track.Count}\t{reportedGaps}\t{(errors.Count == 0 ? "PASS" : string.Join(" | ", errors))}");
        }
    }

    static List<string> AliveGaps(List<double[]> track, Timings timing, double[] deaths)
    {
        var gaps = new List<string>();
        var starts = timing.OwnerReboots.Prepend(timing.OwnerLeftBus ?? 0).ToArray();
        for (var life = 0; life < starts.Length; life++)
        {
            var start = starts[life];
            var next = life + 1 < starts.Length ? starts[life + 1] : timing.OwnerDiedOrMatchEnded;
            var end = deaths.FirstOrDefault(t => t >= start && t <= next, next);
            var observed = track.Where(s => s[0] >= start && s[0] <= end).Select(s => s[0]).ToArray();
            for (var i = 1; i < observed.Length; i++)
                if (observed[i] - observed[i - 1] > 5)
                    gaps.Add(FormattableString.Invariant($"{observed[i - 1]:0.###}-{observed[i]:0.###}"));
        }
        return gaps;
    }

    static T Read<T>(string path) => JsonSerializer.Deserialize<T>(File.ReadAllBytes(path), Output.Options)!;
    static Point? Position(JsonElement value) => value.ValueKind == JsonValueKind.Null ? null :
        new(value[0].GetInt32(), value[1].GetInt32(), value[2].GetInt32());
    static void Increment(SortedDictionary<string, int> counts, string key) => counts[key] = counts.GetValueOrDefault(key) + 1;
    static string Counts(IEnumerable<KeyValuePair<string, int>> values) => string.Join(' ', values.Select(v => $"{v.Key}={v.Value}"));
    static string Clean(string value) => value.Replace('\r', ' ').Replace('\n', ' ').Replace('\t', ' ');
}
