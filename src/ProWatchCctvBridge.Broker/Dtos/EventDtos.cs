using System.Text.Json;

namespace ProWatchCctvBridge.Broker.Dtos;

public record ReceivedEventDto(
    long Id,
    string EventId,
    string EventType,
    string EventCode,
    string EventDate,
    string? DoorId,
    string? UserId,
    string? BadgeId,
    string? DeviceId,
    string? Location,
    int Priority,
    bool IsAlarm,
    string? Message,
    string ReceivedAt,
    string ForwardStatus);

public record ReceivedEventDetailDto(
    long Id,
    string EventId,
    string EventType,
    string EventCode,
    string EventDate,
    string? DoorId,
    string? UserId,
    string? BadgeId,
    string? DeviceId,
    string? Location,
    int Priority,
    bool IsAlarm,
    string? Message,
    string ReceivedAt,
    string ForwardStatus,
    JsonElement Raw);

/// <summary>ACS-received fields + raw only; excludes forward outcome (export contract).</summary>
public record AcsEventExportDto(
    string EventId,
    string EventType,
    string EventCode,
    string EventDate,
    string? DoorId,
    string? UserId,
    string? BadgeId,
    string? DeviceId,
    string? Location,
    int Priority,
    bool IsAlarm,
    string? Message,
    string ReceivedAt,
    JsonElement Raw);

public record ForwardedMessageDto(
    long Id,
    string SourceEventId,
    string CommandId,
    string Exchange,
    string RoutingKey,
    string Status,
    string? Error,
    JsonElement Payload,
    string ForwardedAt);

public record PagedResult<T>(
    IReadOnlyList<T> Items,
    int Page,
    int PageSize,
    int TotalCount,
    bool HasMore);
