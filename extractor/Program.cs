using System.Text.Json;

if (args.Length != 2)
{
    Console.Error.WriteLine("Usage: Extractor <replays directory> <data directory> | Extractor verify <data directory>");
    return 2;
}
if (args[0] == "verify")
    return Verify.Run(args[1]);

var files = Directory.GetFiles(args[0], "*.replay").Order(StringComparer.Ordinal).ToArray();
if (files.Length == 0)
{
    Console.Error.WriteLine("No .replay files found.");
    return 2;
}

var data = args[1];
Directory.CreateDirectory(Path.Combine(data, "matches"));
Directory.CreateDirectory(Path.Combine(data, "debug"));
var exports = new ExportInventory();
var parsed = new List<ParsedMatch>();
var failures = new List<Failure>();
foreach (var file in files)
{
    var id = Path.GetFileNameWithoutExtension(file);
    string pending;
    try
    {
        pending = Engine.Parse(File.ReadAllBytes(file), file, "America/New_York", exports);
    }
    catch (Exception error)
    {
        failures.Add(new(id, Path.GetFileName(file), $"{error.GetType().Name}: {error.Message}"));
        Console.Error.WriteLine($"{id} {error}");
        continue;
    }
    var match = Engine.Load(pending);
    parsed.Add(match);
    Console.WriteLine($"{id} {match.Match.Meta.Playlist} {match.Match.Searches.Count} container searches");
}

var dataset = Engine.Complete(parsed, failures);
foreach (var (id, json) in dataset.TakeAll())
    Output.Text(Path.Combine(data, "matches", id + ".json"), json);
Output.Text(Path.Combine(data, "chests.json"), dataset.ChestsJson());
Output.Lines(Path.Combine(data, "debug", "export-groups.txt"), exports.Fields.Keys);
Output.Lines(Path.Combine(data, "debug", "export-fields.tsv"), exports.Fields.Select(g => $"{g.Key}\t{string.Join(',', g.Value)}"));
Output.Lines(Path.Combine(data, "debug", "container-classes.tsv"), ClassAudit(exports, dataset.Chests.Values));
Output.Text(Path.Combine(data, "index.json"), dataset.IndexJson());
return Verify.Run(data);

static IEnumerable<string> ClassAudit(ExportInventory inventory, IEnumerable<RegistryEntry> registry)
{
    var byClass = registry.ToLookup(r => r.Class, StringComparer.Ordinal);
    yield return "class\tkind\tactors\tmatchesAppearedSum\towner\tteammate\tenemy\tunattributed\twireDiagnostics";
    foreach (var entry in inventory.Fields)
    {
        var name = ExportInventory.ClassName(entry.Key);
        var lookup = new Unreal.Core.Models.NetFieldExportGroup
        {
            PathName = entry.Key,
            NetFieldExports = entry.Value.Select(f => new Unreal.Core.Models.NetFieldExport { Name = f }).ToArray()
        };
        var classification = ContainerExports.Classify(lookup);
        if (classification is null) continue;
        var matches = byClass[name];
        var wire = inventory.WireSignals.GetValueOrDefault(entry.Key);
        yield return string.Join('\t', name, classification.Kind, matches.Count(), matches.Sum(x => x.MatchesAppeared),
            matches.Sum(x => x.OwnerSearches), matches.Sum(x => x.TeammateSearches), matches.Sum(x => x.EnemySearches),
            matches.Sum(x => x.UnattributedSearches), wire is null ? "" : string.Join(',', wire.Select(x => $"{x.Key}={x.Value}")));
    }
}

static class Output
{
    /** Verify reads the files back with reflection, independent of the source-generated writer. */
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    public static void Text(string path, string text)
    {
        File.WriteAllText(path + ".tmp", text);
        File.Move(path + ".tmp", path, true);
    }

    public static void Lines(string path, IEnumerable<string> rows)
    {
        File.WriteAllLines(path + ".tmp", rows);
        File.Move(path + ".tmp", path, true);
    }
}
