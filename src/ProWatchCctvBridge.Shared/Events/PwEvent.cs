namespace ProWatchCctvBridge.Shared.Events;

/// <summary>
/// A Pro-Watch access / alarm event as pushed over the SignalR Event Service.
/// Field set mirrors the LTIA ICD section V.2.3 "GeteventRealTime (SignalR)" output contract
/// (EventId, EventType, EventCode, EventDate are the required fields).
/// </summary>
public sealed class PwEvent
{
    /// <summary>Unique event ID in the Pro-Watch EV_LOG. Required.</summary>
    public string EventId { get; set; } = default!;

    /// <summary>Event type, e.g. AccessGranted, AccessDenied, DoorForced, DoorHeld, Alarm, Fire. Required.</summary>
    public string EventType { get; set; } = default!;

    /// <summary>Pro-Watch internal event code, e.g. "900". Kept as string to allow numeric or symbolic codes. Required.</summary>
    public string EventCode { get; set; } = default!;

    /// <summary>Event timestamp (UTC). Required.</summary>
    public DateTimeOffset EventDate { get; set; }

    /// <summary>Door / reader logical-device ID.</summary>
    public string? DoorId { get; set; }

    /// <summary>Cardholder / user ID.</summary>
    public string? UserId { get; set; }

    /// <summary>Card / badge number.</summary>
    public string? BadgeId { get; set; }

    /// <summary>Reader / controller that generated the event.</summary>
    public string? DeviceId { get; set; }

    /// <summary>Human-readable device / door location.</summary>
    public string? Location { get; set; }

    /// <summary>Event priority level (lower = higher priority in Pro-Watch convention).</summary>
    public int Priority { get; set; }

    /// <summary>True when Pro-Watch flags the event as an alarm (delivered via the alarm callback).</summary>
    public bool IsAlarm { get; set; }

    /// <summary>Additional or accompanying message.</summary>
    public string? Message { get; set; }
}
