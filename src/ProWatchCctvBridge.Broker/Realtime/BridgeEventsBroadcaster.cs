using Microsoft.AspNetCore.SignalR;
using ProWatchCctvBridge.Broker.Data;
using ProWatchCctvBridge.Broker.Hubs;
using ProWatchCctvBridge.Broker.Mapping;
using ProWatchCctvBridge.Broker.Services;

namespace ProWatchCctvBridge.Broker.Realtime;

/// <summary>
/// Bridges in-process BridgeEvents -> SignalR clients via IHubContext.
/// Fire-and-forget per send; never blocks the pipeline event handlers.
/// </summary>
public sealed class BridgeEventsBroadcaster : IHostedService
{
    private readonly BridgeEvents _events;
    private readonly ConnectionStatus _status;
    private readonly IHubContext<BridgeHub> _hub;
    private readonly ILogger<BridgeEventsBroadcaster> _log;

    public BridgeEventsBroadcaster(BridgeEvents events, ConnectionStatus status,
        IHubContext<BridgeHub> hub, ILogger<BridgeEventsBroadcaster> log)
    {
        _events = events;
        _status = status;
        _hub = hub;
        _log = log;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _events.EventReceived += OnEventReceived;
        _events.MessageForwarded += OnMessageForwarded;
        _events.StatusChanged += OnStatusChanged;
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _events.EventReceived -= OnEventReceived;
        _events.MessageForwarded -= OnMessageForwarded;
        _events.StatusChanged -= OnStatusChanged;
        return Task.CompletedTask;
    }

    private void OnEventReceived(ReceivedEventRecord record) =>
        _ = SendSafeAsync("eventReceived", DtoMappers.ToDto(record));

    private void OnMessageForwarded(ForwardedMessageRecord fwd) =>
        _ = SendSafeAsync("eventForwarded", DtoMappers.ToDto(fwd));

    // StatusChanged is payload-less; split into connection + counters for separate TanStack cache slices.
    private void OnStatusChanged() => _ = Task.Run(async () =>
    {
        await SendSafeAsync("connectionStateChanged", DtoMappers.ToConnectionStateDto(_status));
        await SendSafeAsync("countersUpdated", DtoMappers.ToCountersDto(_status));
    });

    private async Task SendSafeAsync(string method, object payload)
    {
        try { await _hub.Clients.All.SendAsync(method, payload); }
        catch (Exception ex) { _log.LogError(ex, "Hub broadcast failed for {Method}", method); }
    }
}
