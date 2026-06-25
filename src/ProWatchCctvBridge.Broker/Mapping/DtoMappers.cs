using System.Text.Json;
using ProWatchCctvBridge.Broker.Configuration;
using ProWatchCctvBridge.Broker.Data;
using ProWatchCctvBridge.Broker.Dtos;
using ProWatchCctvBridge.Broker.Services;

namespace ProWatchCctvBridge.Broker.Mapping;

/// <summary>Entity/config -> DTO projections, secret masking, and JsonElement passthrough.</summary>
public static class DtoMappers
{
    /// <summary>Mask a secret — returns null (never echo plaintext secrets on GET).</summary>
    public static string? Mask(string? _) => null;

    /// <summary>Blank/null incoming = keep existing; otherwise use the new value.</summary>
    public static string MergeSecret(string? incoming, string? existing) =>
        string.IsNullOrEmpty(incoming) ? existing ?? string.Empty : incoming;

    /// <summary>Parse raw JSON to JsonElement for passthrough (avoids double-encoded JSON).</summary>
    public static JsonElement ParseJson(string json)
    {
        try { return JsonDocument.Parse(json).RootElement.Clone(); }
        catch { return JsonDocument.Parse("{}").RootElement.Clone(); }
    }

    // ── Config ────────────────────────────────────────────────────────────────

    public static ProWatchConfigDto ToDto(ProWatchOptions o) => new(
        BaseUrl: o.BaseUrl,
        HubPath: o.HubPath,
        AccessToken: Mask(o.AccessToken),
        AccessTokenSet: !string.IsNullOrEmpty(o.AccessToken),
        UserName: o.UserName,
        WorkstationName: o.WorkstationName,
        AutoConnect: o.AutoConnect,
        ReconnectSeconds: o.ReconnectSeconds);

    public static ProWatchOptions FromDto(ProWatchConfigDto dto, ProWatchOptions existing) => new()
    {
        BaseUrl = dto.BaseUrl,
        HubPath = dto.HubPath,
        AccessToken = MergeSecret(dto.AccessToken, existing.AccessToken),
        UserName = dto.UserName,
        WorkstationName = dto.WorkstationName,
        AutoConnect = dto.AutoConnect,
        ReconnectSeconds = dto.ReconnectSeconds,
    };

    public static RabbitConfigDto ToDto(RabbitMqOptions o) => new(
        Enabled: o.Enabled,
        HostName: o.HostName,
        Port: o.Port,
        VirtualHost: o.VirtualHost,
        UserName: o.UserName,
        Password: Mask(o.Password),
        PasswordSet: !string.IsNullOrEmpty(o.Password),
        UseTls: o.UseTls,
        TlsVersion: o.TlsVersion,
        ServerName: o.ServerName,
        CaCertPath: o.CaCertPath,
        ClientCertPath: o.ClientCertPath,
        ClientCertPassword: Mask(o.ClientCertPassword),
        ClientCertPasswordSet: !string.IsNullOrEmpty(o.ClientCertPassword),
        AllowUntrustedRoot: o.AllowUntrustedRoot,
        Exchange: o.Exchange,
        ExchangeType: o.ExchangeType,
        DefaultRoutingKey: o.DefaultRoutingKey);

    public static RabbitMqOptions FromDto(RabbitConfigDto dto, RabbitMqOptions existing) => new()
    {
        Enabled = dto.Enabled,
        HostName = dto.HostName,
        Port = dto.Port,
        VirtualHost = dto.VirtualHost,
        UserName = dto.UserName,
        Password = MergeSecret(dto.Password, existing.Password),
        UseTls = dto.UseTls,
        TlsVersion = dto.TlsVersion,
        ServerName = dto.ServerName,
        CaCertPath = dto.CaCertPath,
        ClientCertPath = dto.ClientCertPath,
        ClientCertPassword = MergeSecret(dto.ClientCertPassword, existing.ClientCertPassword),
        AllowUntrustedRoot = dto.AllowUntrustedRoot,
        Exchange = dto.Exchange,
        ExchangeType = dto.ExchangeType,
        DefaultRoutingKey = dto.DefaultRoutingKey,
    };

    // ── Events ────────────────────────────────────────────────────────────────

    public static ReceivedEventDto ToDto(ReceivedEventRecord r) => new(
        Id: r.Id,
        EventId: r.EventId,
        EventType: r.EventType,
        EventCode: r.EventCode,
        EventDate: r.EventDate.ToString("O"),
        DoorId: r.DoorId,
        UserId: r.UserId,
        BadgeId: r.BadgeId,
        DeviceId: r.DeviceId,
        Location: r.Location,
        Priority: r.Priority,
        IsAlarm: r.IsAlarm,
        Message: r.Message,
        ReceivedAt: r.ReceivedAt.ToString("O"),
        ForwardStatus: r.ForwardStatus);

    public static ReceivedEventDetailDto ToDetailDto(ReceivedEventRecord r) => new(
        Id: r.Id,
        EventId: r.EventId,
        EventType: r.EventType,
        EventCode: r.EventCode,
        EventDate: r.EventDate.ToString("O"),
        DoorId: r.DoorId,
        UserId: r.UserId,
        BadgeId: r.BadgeId,
        DeviceId: r.DeviceId,
        Location: r.Location,
        Priority: r.Priority,
        IsAlarm: r.IsAlarm,
        Message: r.Message,
        ReceivedAt: r.ReceivedAt.ToString("O"),
        ForwardStatus: r.ForwardStatus,
        Raw: ParseJson(r.RawJson));

    public static AcsEventExportDto ToExportDto(ReceivedEventRecord r) => new(
        EventId: r.EventId,
        EventType: r.EventType,
        EventCode: r.EventCode,
        EventDate: r.EventDate.ToString("O"),
        DoorId: r.DoorId,
        UserId: r.UserId,
        BadgeId: r.BadgeId,
        DeviceId: r.DeviceId,
        Location: r.Location,
        Priority: r.Priority,
        IsAlarm: r.IsAlarm,
        Message: r.Message,
        ReceivedAt: r.ReceivedAt.ToString("O"),
        Raw: ParseJson(r.RawJson));

    public static ForwardedMessageDto ToDto(ForwardedMessageRecord f) => new(
        Id: f.Id,
        SourceEventId: f.SourceEventId,
        CommandId: f.CommandId,
        Exchange: f.Exchange,
        RoutingKey: f.RoutingKey,
        Status: f.Status,
        Error: f.Error,
        Payload: ParseJson(f.PayloadJson),
        ForwardedAt: f.ForwardedAt.ToString("O"),
        ProcessingMs: f.ProcessingMs);

    // ── Status ────────────────────────────────────────────────────────────────

    public static ConnectionStateDto ToConnectionStateDto(ConnectionStatus s) => new(
        ProWatchState: s.ProWatchState,
        ProWatchError: s.ProWatchError,
        ProWatchConnectedAt: s.ProWatchConnectedAt?.ToString("O"),
        Subscribed: s.Subscribed,
        RabbitState: s.RabbitState,
        RabbitError: s.RabbitError);

    public static CountersDto ToCountersDto(ConnectionStatus s) => new(
        TotalReceived: Interlocked.Read(ref s.TotalReceived),
        TotalForwarded: Interlocked.Read(ref s.TotalForwarded),
        TotalFailed: Interlocked.Read(ref s.TotalFailed),
        TotalSkipped: Interlocked.Read(ref s.TotalSkipped));

    public static BridgeStatusDto ToStatusDto(ConnectionStatus s) =>
        new(ToConnectionStateDto(s), ToCountersDto(s));
}
