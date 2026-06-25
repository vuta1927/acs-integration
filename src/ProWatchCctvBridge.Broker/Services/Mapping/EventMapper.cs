using ProWatchCctvBridge.Broker.Data;
using ProWatchCctvBridge.Shared.Cctv;
using ProWatchCctvBridge.Shared.Events;

namespace ProWatchCctvBridge.Broker.Services.Mapping;

public sealed class MappingResult
{
    public bool Matched { get; init; }
    public CctvCommand? Command { get; init; }
    public string? RuleName { get; init; }

    public static MappingResult NoMatch { get; } = new() { Matched = false };
}

/// <summary>Maps a Pro-Watch event to a CCTV command using the first enabled matching rule (by Order).</summary>
public sealed class EventMapper
{
    public MappingResult Map(PwEvent ev, IReadOnlyList<MappingRuleRecord> rules)
    {
        foreach (var rule in rules.Where(r => r.Enabled).OrderBy(r => r.Order))
        {
            if (!Matches(rule, ev)) continue;

            var cameraIps = string.IsNullOrWhiteSpace(rule.CameraIps)
                ? []
                : rule.CameraIps
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .ToList();

            var command = new CctvCommand
            {
                Code = ev.EventCode,
                Timestamp = ev.EventDate.UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
                CameraIps = cameraIps,
                // ACS DeviceId maps to CCTV equipmentId (the physical device that triggered the event).
                EquipmentId = ev.DeviceId,
                // Per CCTV integration: locationId is the same value as equipmentId.
                LocationId = ev.DeviceId,
                SeverityLevel = rule.SeverityLevel,
                Message = ev.Message ?? PwEventCodes.Describe(ev.EventCode),
                SourceEventId = ev.EventId,
                SourceEventType = ev.EventType,
                SourceEventCode = ev.EventCode,
            };

            return new MappingResult
            {
                Matched = true,
                Command = command,
                RuleName = rule.Name,
            };
        }

        return MappingResult.NoMatch;
    }

    private static bool Matches(MappingRuleRecord rule, PwEvent ev)
    {
        if (!string.IsNullOrWhiteSpace(rule.MatchEventType) &&
            !string.Equals(rule.MatchEventType, ev.EventType, StringComparison.OrdinalIgnoreCase))
            return false;

        if (!string.IsNullOrWhiteSpace(rule.MatchEventCode) &&
            !string.Equals(rule.MatchEventCode, ev.EventCode, StringComparison.OrdinalIgnoreCase))
            return false;

        // Both filters empty => catch-all rule.
        return true;
    }
}
