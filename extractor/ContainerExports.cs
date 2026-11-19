using Unreal.Core;
using Unreal.Core.Models;

sealed record ContainerClass(string Kind, string? Open = null, string? Pawn = null);

sealed class ExportInventory
{
    public SortedDictionary<string, SortedSet<string>> Fields { get; } = new(StringComparer.Ordinal);
    public SortedDictionary<string, SortedDictionary<string, int>> WireSignals { get; } = new(StringComparer.Ordinal);
    public static string ClassName(string path) => path[(Math.Max(path.LastIndexOf('.'), path.LastIndexOf('/')) + 1)..];

    public void Add(NetFieldExportGroup group)
    {
        if (!Fields.TryGetValue(group.PathName, out var fields))
            Fields[group.PathName] = fields = new(StringComparer.Ordinal);
        fields.UnionWith(group.NetFieldExports.Where(x => x is not null).Select(x => x!.Name));
    }

    public void Count(string path, string field, uint bits)
    {
        if (!WireSignals.TryGetValue(path, out var signals))
            WireSignals[path] = signals = new(StringComparer.Ordinal);
        var key = $"{field}/{bits}";
        signals[key] = signals.GetValueOrDefault(key) + 1;
    }
}

static class ContainerExports
{
    public static readonly IReadOnlyDictionary<string, ContainerClass> Special = new Dictionary<string, ContainerClass>
    {
        ["Tiered_Chest_Athena_C"] = new("chest"),
        ["AlwaysSpawn_NormalChest_C"] = new("chest"),
        ["AlwaysSpawn_RareChest_C"] = new("rare_chest"),
        ["Tiered_Chest_5_Child_C"] = new("rare_chest"),
        ["B_Athena_BuriedChest_Chest_C"] = new("chest"),
        ["B_TieredChest_Relics_C"] = new("chest"),
        ["B_SpritePosters_Booty_Chest_C"] = new("chest"),
        ["B_SpritePosters_Booty_Chest_Variant1_C"] = new("chest"),
        ["B_Delilah_TieredChest_Relics_Variant1_C"] = new("chest"),
        ["B_Delilah_TieredChest_Relics_Variant2_C"] = new("chest"),
        ["Tiered_Ammo_Athena_C"] = new("ammo_box"),
        ["Barrel_FishingRod_Container_Athena_C"] = new("other_container"),
        ["FoodBox_Produce_Athena_C"] = new("other_container"),
        ["B_Athena_BuriedChest_RelicFinder_C"] = new("chest", "ChestOpened", "InteractingPawn"),
        ["AthenaSupplyDrop_C"] = new("other_container", "Opened"),
        ["AthenaSupplyDrop_Vault_C"] = new("other_container", "Opened"),
        ["AthenaSupplyDrop_PoolDust_C"] = new("other_container", "Opened"),
        ["BGA_LootCannon_StandardChest_Pirate_C"] = new("other_container", "SingleUseLootCannonFired"),
        ["BGA_LootCannonDuck_Child_C"] = new("other_container", "SingleUseLootCannonFired"),
        ["BGA_DelilahTreasureHuntAnimatedChest_C"] = new("chest", "bSuccess", "OpeningPawn")
    };

    public static ContainerClass? Classify(NetFieldExportGroup group)
    {
        var name = ExportInventory.ClassName(group.PathName);
        if (Special.TryGetValue(name, out var special))
            return special;
        if (!group.NetFieldExports.Any(field => field?.Name is "bAlreadySearched" or "SearchAnimationCount"))
            return null;
        if (name.Contains("Chest", StringComparison.OrdinalIgnoreCase))
            return new("chest");
        return new(name.Contains("Ammo", StringComparison.OrdinalIgnoreCase) ? "ammo_box" : "other_container");
    }

    public static ContainerDelta Read(FBitArchive archive, NetFieldExportGroup group, ContainerClass type,
        bool checksum, ExportInventory inventory)
    {
        if (checksum)
            archive.ReadBit();
        var change = new ContainerDelta();
        while (!archive.AtEnd() && !archive.IsError)
        {
            var handle = archive.ReadIntPacked();
            if (handle == 0 || !group.IsValidIndex(handle - 1))
                break;
            var bits = archive.ReadIntPacked();
            var field = group.NetFieldExports[handle - 1]?.Name;
            switch (field)
            {
                case "bAlreadySearched" or "bFromDestruction" when bits == 1:
                    var active = archive.ReadBit();
                    if (field == "bAlreadySearched") change.Searched = active;
                    else change.FromDestruction = active;
                    break;
                case "bDestroyed" when bits == 1:
                    change.Destroyed = archive.ReadBit();
                    break;
                case "SearchAnimationCount" when bits == 32:
                    change.Animation = archive.ReadUInt32();
                    break;
                case "ReplicatedLootTier" or "Tier" when bits == 32:
                    change.Tier = archive.ReadInt32();
                    break;
                case "SearchingPawn" or "SourceContainer" when bits > 0 && bits <= 40 && bits % 8 == 0:
                    var actor = archive.ReadIntPacked();
                    if (field == "SearchingPawn") change.Pawn = actor;
                    else change.Source = actor;
                    break;
                default:
                    if (field is not null && field == type.Open && bits == 1)
                        change.SpecialOpen = archive.ReadBit();
                    else if (field is not null && field == type.Pawn && bits > 0 && bits <= 40 && bits % 8 == 0)
                        change.Pawn = archive.ReadIntPacked();
                    else
                    {
                        archive.SkipBits(bits);
                        if (field is not null && (field == type.Open || field == type.Pawn || field is "SearchAnimationCount" or "SearchingPawn"))
                            inventory.Count(group.PathName, field, bits);
                    }
                    break;
            }
        }
        return change;
    }
}

sealed class ContainerDelta : Unreal.Core.Contracts.INetFieldExportGroup
{
    public bool Searched, SpecialOpen, FromDestruction, Destroyed;
    public uint? Animation, Pawn, Source;
    public int? Tier;
}

sealed record Observation(Container Container, double Time, string Signal, bool Initial, int? Tier,
    uint? Pawn, uint Actor, uint? Source, Point? ActorPosition);

sealed class ContainerState(Container container)
{
    public Container Container { get; } = container;
    public bool Seen { get; set; }
    public uint? Pawn { get; set; }
    public double PawnTime { get; set; }
    public uint? Source { get; set; }
    public int? Tier { get; set; }
    public uint? Animation { get; set; }
    public double? LastSearch { get; set; }
}
