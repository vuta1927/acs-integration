using System.Text.Json.Serialization;

namespace ProWatchCctvBridge.Shared.Cctv;

/// <summary>
/// CCTV alarm message — the exact wire payload published to RabbitMQ AMQPS for the VMS.
/// Field names and types match the CCTV ICD contract (camelCase JSON).
/// Only alarm events from Pro-Watch are forwarded to CCTV.
/// </summary>
public sealed class CctvCommand
{
    // ── Wire fields (serialized to JSON) ─────────────────────────────────────

    /// <summary>Always "alarm" — only alarm-type Pro-Watch events reach CCTV.</summary>
    [JsonPropertyName("type")]
    public string Type { get; set; } = "alarm";

    /// <summary>Pro-Watch EventCode (e.g. "903" for Door Held Open).</summary>
    [JsonPropertyName("code")]
    public string Code { get; set; } = default!;

    /// <summary>ISO 8601 UTC timestamp of the event (format: "yyyy-MM-ddTHH:mm:ss.fffZ").</summary>
    [JsonPropertyName("timestamp")]
    public string Timestamp { get; set; } = default!;

    /// <summary>Zone/location ID where the event occurred (mapped from Pro-Watch Location).</summary>
    [JsonPropertyName("locationId")]
    public string? LocationId { get; set; }

    /// <summary>IP addresses of cameras at the event location. CCTV pops these up on alarm.</summary>
    [JsonPropertyName("cameraIps")]
    public List<string> CameraIps { get; set; } = [];

    /// <summary>Equipment ID as received by CCTV — mapped from Pro-Watch Location.</summary>
    [JsonPropertyName("equipmentId")]
    public string? EquipmentId { get; set; }

    /// <summary>Always "ACS".</summary>
    [JsonPropertyName("source")]
    public string Source { get; set; } = "ACS";

    /// <summary>0=Critical, 1=Major, 2=Minor.</summary>
    [JsonPropertyName("severityLevel")]
    public int SeverityLevel { get; set; } = 1;

    /// <summary>Human-readable description of the event.</summary>
    [JsonPropertyName("message")]
    public string? Message { get; set; }

    // ── Internal tracking (not serialized to the wire) ────────────────────────

    [JsonIgnore] public string CommandId { get; set; } = Guid.NewGuid().ToString("N");
    [JsonIgnore] public string SourceEventId { get; set; } = default!;
    [JsonIgnore] public string SourceEventType { get; set; } = default!;
    [JsonIgnore] public string SourceEventCode { get; set; } = default!;
}
