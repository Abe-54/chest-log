using System.Runtime.InteropServices.JavaScript;
using System.Text.Json;

public static partial class Exports
{
    static readonly Dictionary<string, ParsedMatch> loaded = new(StringComparer.Ordinal);
    static Dataset? completed;

    [JSExport]
    public static string EngineVersion() => Engine.Version;

    /// <summary>Stage one for a single replay. Throws when the replay cannot be parsed; the message is "TypeName: message".</summary>
    [JSExport]
    public static string Parse(byte[] bytes, string fileName, string timeZone)
    {
        try
        {
            return Engine.Parse(bytes, fileName, timeZone);
        }
        catch (Exception error)
        {
            throw new InvalidOperationException($"{error.GetType().Name}: {error.Message}");
        }
    }

    [JSExport]
    public static void Reset()
    {
        loaded.Clear();
        completed = null;
    }

    [JSExport]
    public static void AddPending(string pendingJson)
    {
        var parsed = Engine.Load(pendingJson);
        loaded[parsed.Match.Meta.Id] = parsed;
    }

    /// <summary>Stage two over everything added since <see cref="Reset"/>. The added pendings are consumed; add them again to complete a different set.</summary>
    [JSExport]
    public static string Complete(string failuresJson)
    {
        var failures = JsonSerializer.Deserialize(failuresJson, EngineJson.Default.FailureArray) ?? [];
        completed = Engine.Complete(loaded.Values.ToList(), failures);
        loaded.Clear();
        return completed.CompletedJson();
    }

    [JSExport]
    public static string TakeMatch(string id) =>
        (completed ?? throw new InvalidOperationException("Complete has not run")).TakeMatch(id);
}
