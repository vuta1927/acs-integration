using Microsoft.EntityFrameworkCore;
using ProWatchCctvBridge.Broker.Data;
using ProWatchCctvBridge.Shared.Events;

namespace ProWatchCctvBridge.Broker.Services;

/// <summary>Seeds default Pro-Watch -> CCTV mapping rules (from ICD use cases) on first run.</summary>
public static class MappingRuleSeeder
{
    public static async Task EnsureSeededAsync(BridgeDbContext db)
    {
        if (await db.MappingRules.AnyAsync()) return;

        // Default rules: alarm events → CCTV. Routing is global (single routing key), so rules only
        // decide matching, severity, and camera IPs.
        // CameraIps: leave empty so CCTV resolves cameras by locationId from the event.
        // SeverityLevel: 0=Critical (door breach/fire), 1=Major (card violations), 2=Minor.
        db.MappingRules.AddRange(
            new() { Order = 10, Name = "Door Forced Open", MatchEventCode = PwEventCodes.DoorForcedOpen, SeverityLevel = 0 },
            new() { Order = 20, Name = "Door Held Open",   MatchEventCode = PwEventCodes.DoorHeldOpen,   SeverityLevel = 1 },
            new() { Order = 30, Name = "Lost Card",        MatchEventCode = PwEventCodes.LostCard,        SeverityLevel = 1 },
            new() { Order = 31, Name = "Stolen Card",      MatchEventCode = PwEventCodes.StolenCard,      SeverityLevel = 1 },
            new() { Order = 32, Name = "Wrong Door",       MatchEventCode = PwEventCodes.WrongDoor,       SeverityLevel = 2 },
            new() { Order = 33, Name = "Terminated Card",  MatchEventCode = PwEventCodes.TerminatedCard,  SeverityLevel = 1 },
            new() { Order = 40, Name = "Fire / Emergency", MatchEventType = PwEventTypes.Fire,            SeverityLevel = 0 }
        );
        await db.SaveChangesAsync();
    }
}
