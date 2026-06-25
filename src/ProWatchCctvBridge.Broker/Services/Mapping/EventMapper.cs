using ProWatchCctvBridge.Shared.Cctv;
using ProWatchCctvBridge.Shared.Events;

namespace ProWatchCctvBridge.Broker.Services.Mapping;

/// <summary>Maps a Pro-Watch alarm event directly to a CCTV command (no rule matching).</summary>
public sealed class EventMapper
{
    public CctvCommand Map(PwEvent ev) => new()
    {
        Code = ev.EventCode,
        Timestamp = ev.EventDate.UtcDateTime.ToString("yyyy-MM-ddTHH:mm:ss.fffZ"),
        CameraIps = [],
        EquipmentId = ev.Location,
        LocationId = ev.DeviceId,
        SeverityLevel = 1,
        Message = ev.Message ?? PwEventCodes.Describe(ev.EventCode),
        SourceEventId = ev.EventId,
        SourceEventType = ev.EventType,
        SourceEventCode = ev.EventCode,
    };
}
