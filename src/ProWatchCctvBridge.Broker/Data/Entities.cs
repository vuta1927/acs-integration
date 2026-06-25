namespace ProWatchCctvBridge.Broker.Data;

/// <summary>A Pro-Watch event received from the SAC over SignalR (the message history).</summary>
public sealed class ReceivedEventRecord
{
    public long Id { get; set; }
    public string EventId { get; set; } = default!;
    public string EventType { get; set; } = default!;
    public string EventCode { get; set; } = default!;
    public DateTimeOffset EventDate { get; set; }
    public string? DoorId { get; set; }
    public string? UserId { get; set; }
    public string? BadgeId { get; set; }
    public string? DeviceId { get; set; }
    public string? Location { get; set; }
    public int Priority { get; set; }
    public bool IsAlarm { get; set; }
    public string? Message { get; set; }
    public DateTimeOffset ReceivedAt { get; set; }
    public string RawJson { get; set; } = "{}";

    /// <summary>Forwarding outcome for this event (see <see cref="ForwardStatus"/>).</summary>
    public string ForwardStatus { get; set; } = Data.ForwardStatus.Pending;
}

/// <summary>A CCTV alarm message published (or attempted) to RabbitMQ for a received event.</summary>
public sealed class ForwardedMessageRecord
{
    public long Id { get; set; }
    public string SourceEventId { get; set; } = default!;
    public string CommandId { get; set; } = default!;
    public string Exchange { get; set; } = default!;
    public string RoutingKey { get; set; } = default!;
    public string Status { get; set; } = ForwardStatus.Published;
    public string? Error { get; set; }
    /// <summary>The exact JSON payload sent over the wire to CCTV.</summary>
    public string PayloadJson { get; set; } = "{}";
    public DateTimeOffset ForwardedAt { get; set; }
}

/// <summary>A rule that maps a Pro-Watch alarm event to a CCTV alarm message. Evaluated in ascending <see cref="Order"/>.</summary>
public sealed class MappingRuleRecord
{
    public int Id { get; set; }
    public int Order { get; set; }
    public string Name { get; set; } = default!;
    public bool Enabled { get; set; } = true;

    /// <summary>Match on EventType (null/empty = any).</summary>
    public string? MatchEventType { get; set; }

    /// <summary>Match on EventCode (null/empty = any).</summary>
    public string? MatchEventCode { get; set; }

    /// <summary>Comma-separated camera IP addresses sent to CCTV (e.g. "10.4.5.11,10.4.5.14"). Empty = CCTV resolves by locationId.</summary>
    public string? CameraIps { get; set; }

    /// <summary>CCTV severity level: 0=Critical, 1=Major, 2=Minor. Default 1=Major.</summary>
    public int SeverityLevel { get; set; } = 1;

    public string RoutingKey { get; set; } = "cctv.alarm";
}

/// <summary>Key/value store for persisted JSON configuration (prowatch, rabbitmq).</summary>
public sealed class AppSetting
{
    public string Key { get; set; } = default!;
    public string Value { get; set; } = "{}";
}

public static class ForwardStatus
{
    public const string Pending = "Pending";
    public const string Published = "Published";
    public const string Skipped = "Skipped";
    public const string Failed = "Failed";
}
