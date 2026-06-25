namespace ProWatchCctvBridge.Shared.Events;

/// <summary>Canonical Pro-Watch event type names (the "EventType" field values).</summary>
public static class PwEventTypes
{
    public const string AccessGranted = "AccessGranted";
    public const string AccessDenied = "AccessDenied";
    public const string DoorForced = "DoorForced";
    public const string DoorHeld = "DoorHeld";
    public const string DoorStatusChange = "DoorStatusChange";
    public const string Alarm = "Alarm";
    public const string Fire = "Fire";
}

/// <summary>
/// Pro-Watch EventCode values (PW-5000 / PW-7000) taken from the LTIA ICD section V.2.2.
/// Codes are exposed as strings to match <see cref="PwEvent.EventCode"/>.
/// </summary>
public static class PwEventCodes
{
    public const string UnknownCard = "400";
    public const string VoidCard = "401";
    public const string ExpiredCard = "402";
    public const string WrongDoor = "405";          // valid card at unauthorized reader
    public const string LostCard = "406";
    public const string StolenCard = "407";
    public const string UnaccountedCard = "408";
    public const string DeactivatedCard = "409";
    public const string TerminatedCard = "410";
    public const string LockedAttempt = "423";
    public const string AutoUnlocked = "437";
    public const string AutoLocked = "438";
    public const string DoorForcedOpen = "900";
    public const string DoorHeldOpen = "903";

    /// <summary>Human-readable description per the ICD EventCode table.</summary>
    public static IReadOnlyDictionary<string, string> Descriptions { get; } = new Dictionary<string, string>
    {
        [UnknownCard] = "Unknown Card - not in system",
        [VoidCard] = "Void Card - permanently disabled",
        [ExpiredCard] = "Expired Card Attempt",
        [WrongDoor] = "Valid card at unauthorized reader (wrong door)",
        [LostCard] = "Lost Card Attempt",
        [StolenCard] = "Stolen Card Attempt",
        [UnaccountedCard] = "Unaccounted-for Card Attempt",
        [DeactivatedCard] = "Deactivated Card Attempt",
        [TerminatedCard] = "Terminated Card Attempt",
        [LockedAttempt] = "Locked Attempt",
        [AutoUnlocked] = "Auto unlocked",
        [AutoLocked] = "Auto locked",
        [DoorForcedOpen] = "Door Forced Open",
        [DoorHeldOpen] = "Held door",
    };

    public static string Describe(string code) =>
        Descriptions.TryGetValue(code, out var d) ? d : $"Event {code}";
}
