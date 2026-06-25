using ProWatchCctvBridge.Shared.Events;

namespace ProWatchCctvBridge.Simulator.Services;

/// <summary>Builds realistic Pro-Watch events for a fixed catalog of test scenarios.</summary>
public static class PwEventFactory
{
    public sealed record Scenario(string Key, string EventType, string EventCode, bool IsAlarm, int Priority, string Message);

    /// <summary>Scenario catalog covering the ICD use cases (UC-405/406/407/410/900/903/437 + valid + fire).</summary>
    public static readonly IReadOnlyList<Scenario> Scenarios = new[]
    {
        new Scenario("access-granted",  PwEventTypes.AccessGranted,    "100",                        false, 5,  "Access granted - valid badge"),
        new Scenario("wrong-door",       PwEventTypes.AccessDenied,     PwEventCodes.WrongDoor,        true,  4,  "Valid card at unauthorized reader"),
        new Scenario("lost-card",        PwEventTypes.AccessDenied,     PwEventCodes.LostCard,         true,  3,  "Lost card attempt"),
        new Scenario("stolen-card",      PwEventTypes.AccessDenied,     PwEventCodes.StolenCard,       true,  3,  "Stolen card attempt"),
        new Scenario("terminated-card",  PwEventTypes.AccessDenied,     PwEventCodes.TerminatedCard,   true,  3,  "Terminated card attempt"),
        new Scenario("door-forced",      PwEventTypes.DoorForced,       PwEventCodes.DoorForcedOpen,   true,  12, "Door forced open"),
        new Scenario("door-held",        PwEventTypes.DoorHeld,         PwEventCodes.DoorHeldOpen,     true,  8,  "Door held open too long"),
        new Scenario("auto-unlock",      PwEventTypes.DoorStatusChange, PwEventCodes.AutoUnlocked,     false, 6,  "Auto unlocked by schedule"),
        new Scenario("fire",             PwEventTypes.Fire,             "950",                        true,  1,  "Fire / emergency signal"),
    };

    private static readonly string[] Doors =
        { "DOOR-T1-01", "DOOR-T1-02", "GATE-A12", "SHUTTER-BHS-03", "EV-CAB-05" };
    private static readonly string[] Locations =
        { "Terminal 1 - Main Entrance", "Terminal 1 - North Gate", "Boarding Area A12", "BHS Restricted Zone", "Service Elevator Cabin" };

    public static Scenario? Find(string key) =>
        Scenarios.FirstOrDefault(s => string.Equals(s.Key, key, StringComparison.OrdinalIgnoreCase));

    public static Scenario Random() => Scenarios[System.Random.Shared.Next(Scenarios.Count)];

    public static PwEvent Create(Scenario s, long seq)
    {
        var i = System.Random.Shared.Next(Doors.Length);
        return new PwEvent
        {
            EventId = $"EV{DateTime.UtcNow:yyMMddHHmmss}{seq % 10000:D4}",
            EventType = s.EventType,
            EventCode = s.EventCode,
            EventDate = DateTimeOffset.UtcNow,
            DoorId = Doors[i],
            DeviceId = $"READER-{Doors[i]}",
            UserId = $"USR-{System.Random.Shared.Next(1000, 9999)}",
            BadgeId = $"0x{System.Random.Shared.Next():X8}",
            Location = Locations[i],
            Priority = s.Priority,
            IsAlarm = s.IsAlarm,
            Message = s.Message,
        };
    }
}
