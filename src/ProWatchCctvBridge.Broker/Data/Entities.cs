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
