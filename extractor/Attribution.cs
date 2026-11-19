sealed record Candidate(uint State, Point Position, double Age);
sealed record Pile(double Time, Point Position, Item[] Items);
sealed record PendingSearch(Search Search, Point? ActorPosition, uint? ExplicitState, Candidate[] Candidates, int Order);

/// <summary>What stage two reads about one search. <c>Order</c> is its index in <c>Match.Searches</c>.</summary>
sealed record Evidence(int Order, Point? ActorPosition, uint? ExplicitState, Candidate[] Candidates);
sealed record AttributionState(Person[] People, Evidence[] Evidence, Pile[] Piles);

sealed class Attribution
{
    const double SearchWindow = 0.22;
    readonly List<Pile> piles;
    readonly HashSet<int> used = [];
    public List<PendingSearch> Searches { get; }

    Attribution(Dictionary<uint, Person> people, List<PendingSearch> searches, List<Pile> piles)
    {
        People = people;
        Searches = searches;
        this.piles = piles;
    }

    /// <summary>Rebuilds from a snapshot. <c>Searches</c> then holds only the searches the snapshot kept evidence for.</summary>
    public static Attribution Restore(Match match, AttributionState state) =>
        new(state.People.ToDictionary(p => p.State),
            state.Evidence.Select(e => new PendingSearch(match.Searches[e.Order], e.ActorPosition, e.ExplicitState, e.Candidates, e.Order)).ToList(),
            [.. state.Piles]);

    /// <summary>
    /// MatchLoot and Complete only touch searches that still have no loot position. Keep their evidence, the unclaimed piles
    /// they could still pair with (in time order, so pile order and tie breaks are unchanged) and the people that evidence names.
    /// </summary>
    public AttributionState Snapshot(Person? owner)
    {
        var open = Searches.Where(s => s.Search.LootPosition is null).ToArray();
        var named = open.SelectMany(s => s.Candidates.Select(c => c.State).Concat(s.ExplicitState is uint id ? [id] : []))
            .Concat(owner is null ? [] : [owner.State]).Distinct().Order();
        return new(named.Select(state => People[state]).ToArray(),
            open.Select(s => new Evidence(s.Order, s.ActorPosition, s.ExplicitState, s.Candidates)).ToArray(),
            piles.Where((pile, i) => !used.Contains(i) && open.Any(s => InWindow(pile, s.Search))).ToArray());
    }

    static bool InWindow(Pile pile, Search search) =>
        pile.Time <= search.Time + SearchWindow && Math.Abs(pile.Time - search.Time) <= SearchWindow;

    public Attribution(Capture capture, Dictionary<uint, Person> people, double duration)
    {
        var observations = capture.Observations.Where(o => o.Time >= 0 && o.Time <= duration)
            .GroupBy(o => o.Container.Id).Select(g =>
            {
                var first = g.First();
                return first with { Pawn = g.Select(o => o.Pawn).FirstOrDefault(p => p is > 0) };
            }).OrderBy(o => o.Time).ThenBy(o => o.Container.Id, StringComparer.Ordinal).ToList();
        var searchedActors = observations.ToDictionary(o => o.Actor);
        Searches = observations.Where(o => o.Source is not uint source || !searchedActors.TryGetValue(source, out var original) ||
                source == o.Actor || Math.Abs(original.Time - o.Time) > 2)
            .Select((o, i) =>
            {
                var peopleNear = capture.Pawns.Values.Where(p => p.State is uint state && people.ContainsKey(state))
                    .Select(p => (Pawn: p, Evidence: p.At(o.Time))).Where(x => x.Evidence != null)
                    .Select(x => new Candidate(x.Pawn.State!.Value, x.Evidence!.Value.Position, x.Evidence.Value.Age))
                    .GroupBy(c => c.State).Select(g => g.MinBy(c => c.Age)!).ToArray();
                var directState = o.Pawn is uint p && capture.Pawns.TryGetValue(p, out var pawn) ? pawn.State : o.Pawn;
                var search = new Search
                {
                    Time = ReplayUnits.Seconds(o.Time), Kind = o.Container.Kind, Class = o.Container.Class, ChestId = o.Container.Id,
                    StableId = o.Container.Stable, Signal = o.Signal, InitialState = o.Initial,
                    Broken = capture.Broken.Contains(o.Container.Id), LootTier = o.Tier
                };
                return new PendingSearch(search, o.ActorPosition,
                    directState is uint id && people.ContainsKey(id) ? id : null, peopleNear, i);
            }).ToList();
        piles = Cluster(capture.Pickups.Values.Where(x => x.Toss is not null && x.Loot is not null)
            .OrderBy(x => x.Toss).ThenBy(x => x.Actor));
        People = people;
    }

    Dictionary<uint, Person> People { get; }

    static List<Pile> Cluster(IEnumerable<Pickup> pickups)
    {
        var groups = new List<List<Pickup>>();
        foreach (var pickup in pickups)
        {
            List<Pickup>? cluster = null;
            for (var i = groups.Count - 1; i >= 0 && pickup.Toss - groups[i][0].Toss <= 0.13; i--)
            {
                if (groups[i][0].Loot!.Value.Distance(pickup.Loot!.Value) <= 320)
                {
                    cluster = groups[i];
                    break;
                }
            }
            if (cluster is null) groups.Add([pickup]);
            else cluster.Add(pickup);
        }
        return groups.Select(group => new Pile(group[0].Toss!.Value, Point.Median(group.Select(p => p.Loot!.Value)),
            group.Select(p => new Item(p.Definition, p.Count)).ToArray())).ToList();
    }

    public void MatchLoot(Person? owner, IReadOnlyDictionary<string, Point>? positions = null)
    {
        var pairs = new List<(PendingSearch Search, int Pile, double Score, double Dt)>();
        foreach (var pending in Searches.Where(s => s.Search.LootPosition is null))
        {
            var search = pending.Search;
            var known = positions is not null && positions.TryGetValue(search.ChestId, out var fix) ? fix : (Point?)null;
            for (var i = 0; i < piles.Count; i++)
            {
                var pile = piles[i];
                var dt = Math.Abs(pile.Time - search.Time);
                if (pile.Time > search.Time + SearchWindow) break;
                if (dt > SearchWindow || used.Contains(i)) continue;
                var nearest = Nearest(pending, pile.Position);
                var direct = nearest.FirstOrDefault(c => c.State == pending.ExplicitState);
                var marker = known ?? pending.ActorPosition;
                var markerDistance = marker?.Distance(pile.Position);
                if (markerDistance > 700) continue;
                var distance = direct?.Position.Distance(pile.Position) ??
                    (nearest.Length == 0 ? null : nearest[0].Position.Distance(pile.Position));
                if (direct is not null && distance > 600 || distance is null or > 600 && markerDistance is null or > 400)
                    continue;
                var score = (markerDistance ?? (distance ?? 600) + 140) / 380 + dt * 9;
                if (direct is not null && distance <= 600) score -= 1.2;
                pairs.Add((pending, i, score, dt));
            }
        }
        var bySearch = pairs.ToLookup(p => p.Search.Order);
        var byPile = pairs.ToLookup(p => p.Pile);
        foreach (var pair in pairs.OrderBy(p => p.Score).ThenBy(p => p.Search.Order).ThenBy(p => p.Pile))
        {
            if (used.Contains(pair.Pile) || pair.Search.Search.LootPosition is not null) continue;
            if (bySearch[pair.Search.Order].Any(p => p.Pile != pair.Pile && p.Score < pair.Score + 0.55 && !used.Contains(p.Pile)) ||
                byPile[pair.Pile].Any(p => p.Search.Order != pair.Search.Order && p.Score < pair.Score + 0.55 && p.Search.Search.LootPosition is null))
                continue;

            var pile = piles[pair.Pile];
            used.Add(pair.Pile);
            pair.Search.Search.LootPosition = pile.Position.Array();
            pair.Search.Search.Loot = pile.Items;
            Assign(pair.Search, owner, pile.Position, "loot_nearby", pair.Dt <= 0.11);
        }
    }

    public void Complete(Person? owner, IReadOnlyDictionary<string, Point> registry)
    {
        foreach (var pending in Searches.Where(s => s.Search.LootPosition is null))
        {
            var registered = registry.TryGetValue(pending.Search.ChestId, out var fix) ? fix : (Point?)null;
            var pos = pending.ActorPosition ?? registered;
            if (pos is not null) pending.Search.EstimatedContainerPosition = pos.Value.Array();
            Assign(pending, owner, pos, pending.ActorPosition is not null ? "actor_position" :
                registered is not null ? "registry_position" : "unattributed", false);
        }
    }

    static Candidate[] Nearest(PendingSearch pending, Point p) => pending.Candidates
        .OrderBy(c => c.Position.Distance(p)).ThenBy(c => c.State).ToArray();

    void Assign(PendingSearch pending, Person? owner, Point? position, string method, bool closeInTime)
    {
        var search = pending.Search;
        var nearest = position is Point p ? Nearest(pending, p) : [];
        var nearestDistance = position is Point n && nearest.Length > 0 ? nearest[0].Position.Distance(n) : (double?)null;
        var second = position is Point q && nearest.Length > 1 ? nearest[1].Position.Distance(q) : (double?)null;
        search.SecondNearestDistanceCm = second is double s ? ReplayUnits.Cm(s) : null;
        var margin = second - nearestDistance;
        var directPerson = pending.ExplicitState is uint id ? People[id] : null;
        var direct = nearest.FirstOrDefault(c => c.State == pending.ExplicitState);
        var proximate = nearestDistance <= (method == "loot_nearby" ? 600 : 450) &&
            (second is null || margin >= 150) && (method == "loot_nearby" || !search.InitialState)
            ? nearest[0] : null;
        var candidate = directPerson is not null ? direct : proximate;
        var person = directPerson ?? (candidate is null ? null : People[candidate.State]);
        if (person is null)
        {
            search.AttributionNote = position is null ? "no_unique_loot_or_container_position" :
                search.InitialState && method != "loot_nearby" ? "already_open_when_first_seen" : "no_clear_nearby_player";
            return;
        }

        search.Opener = person.Name;
        search.Role = Roles.Of(person, owner);
        search.Method = directPerson is not null ? "replicated_pawn" : method;
        search.PositionSampleAgeMs = candidate is null ? null : ReplayUnits.Cm(candidate.Age * 1000);
        search.OpenerPosition = candidate?.Position.Array();
        var distance = position is Point loot && candidate is not null ? candidate.Position.Distance(loot) : (double?)null;
        search.OpenerDistanceCm = distance is double d ? ReplayUnits.Cm(d) : null;
        if (method == "loot_nearby" && distance <= 350 && closeInTime && candidate?.Age <= 0.30 &&
            (directPerson is not null || margin >= 400))
            search.Confidence = "high";
        else if (method == "loot_nearby" && distance <= 600)
            search.Confidence = "medium";
        search.AttributionNote = search.Confidence switch
        {
            "high" => null,
            "medium" => "loot_or_movement_evidence_weaker",
            _ when directPerson is not null && search.LootPosition is null => "explicit_pawn_without_matched_loot",
            _ when directPerson is not null => "explicit_pawn_without_nearby_position",
            _ => "estimated_position_without_matched_loot"
        };
    }
}

static class Roles
{
    public static string? Of(Person? person, Person? owner)
    {
        if (person is null || owner is null) return null;
        if (person.State == owner.State) return "owner";
        if (person.Team is null || owner.Team is null) return null;
        return person.Team == owner.Team ? "teammate" : "enemy";
    }
}
