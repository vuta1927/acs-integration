using System.Diagnostics;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProWatchCctvBridge.Broker.Data;
using ProWatchCctvBridge.Broker.Services.Mapping;
using ProWatchCctvBridge.Broker.Services.Messaging;
using ProWatchCctvBridge.Shared.Events;

namespace ProWatchCctvBridge.Broker.Services;

/// <summary>
/// Core flow for each Pro-Watch event: persist it (history) -> map to a CCTV command ->
/// publish to RabbitMQ -> persist the forwarding outcome -> notify the UI.
/// </summary>
public sealed class EventPipeline
{
    private readonly IDbContextFactory<BridgeDbContext> _dbFactory;
    private readonly EventMapper _mapper;
    private readonly IRabbitPublisher _publisher;
    private readonly ConfigStore _config;
    private readonly ConnectionStatus _status;
    private readonly BridgeEvents _events;
    private readonly ILogger<EventPipeline> _log;

    public EventPipeline(IDbContextFactory<BridgeDbContext> dbFactory, EventMapper mapper, IRabbitPublisher publisher,
        ConfigStore config, ConnectionStatus status, BridgeEvents events, ILogger<EventPipeline> log)
    {
        _dbFactory = dbFactory;
        _mapper = mapper;
        _publisher = publisher;
        _config = config;
        _status = status;
        _events = events;
        _log = log;
    }

    public async Task HandleAsync(PwEvent ev, CancellationToken ct = default)
    {
        var sw = Stopwatch.StartNew();
        Interlocked.Increment(ref _status.TotalReceived);

        await using var db = await _dbFactory.CreateDbContextAsync(ct);

        var record = new ReceivedEventRecord
        {
            EventId = ev.EventId,
            EventType = ev.EventType,
            EventCode = ev.EventCode,
            EventDate = ev.EventDate,
            DoorId = ev.DoorId,
            UserId = ev.UserId,
            BadgeId = ev.BadgeId,
            DeviceId = ev.DeviceId,
            Location = ev.Location,
            Priority = ev.Priority,
            IsAlarm = ev.IsAlarm,
            Message = ev.Message,
            ReceivedAt = DateTimeOffset.UtcNow,
            RawJson = JsonSerializer.Serialize(ev),
        };
        db.ReceivedEvents.Add(record);
        await db.SaveChangesAsync(ct);
        _events.RaiseReceived(record);

        // Only alarm events are forwarded to CCTV; all others are skipped and logged to history.
        if (!ev.IsAlarm)
        {
            record.ForwardStatus = ForwardStatus.Skipped;
            Interlocked.Increment(ref _status.TotalSkipped);
            await db.SaveChangesAsync(ct);
            _events.RaiseStatusChanged();
            return;
        }

        var command = _mapper.Map(ev);

        var rabbit = _config.GetRabbit();
        var routingKey = rabbit.DefaultRoutingKey;
        var publish = await _publisher.PublishAsync(command, routingKey, ct);
        sw.Stop();

        var forwarded = new ForwardedMessageRecord
        {
            SourceEventId = ev.EventId,
            CommandId = command.CommandId,
            Exchange = rabbit.Exchange,
            RoutingKey = routingKey,
            Status = publish.Success ? ForwardStatus.Published : ForwardStatus.Failed,
            Error = publish.Error,
            PayloadJson = JsonSerializer.Serialize(command),
            ForwardedAt = DateTimeOffset.UtcNow,
            ProcessingMs = sw.ElapsedMilliseconds,
        };
        db.ForwardedMessages.Add(forwarded);
        record.ForwardStatus = forwarded.Status;
        await db.SaveChangesAsync(ct);

        if (publish.Success) Interlocked.Increment(ref _status.TotalForwarded);
        else Interlocked.Increment(ref _status.TotalFailed);

        _events.RaiseForwarded(forwarded);
        _events.RaiseStatusChanged();
    }
}
