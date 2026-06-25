using Microsoft.AspNetCore.SignalR;
using ProWatchCctvBridge.Broker.Hubs;
using ProWatchCctvBridge.Broker.Logging;

namespace ProWatchCctvBridge.Broker.Realtime;

/// <summary>Pushes new MemoryLogStore entries to all SignalR clients as "logEntry" messages.</summary>
public sealed class LogBroadcaster(MemoryLogStore store, IHubContext<BridgeHub> hub) : IHostedService
{
    public Task StartAsync(CancellationToken ct)
    {
        store.OnEntry += OnLog;
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken ct)
    {
        store.OnEntry -= OnLog;
        return Task.CompletedTask;
    }

    private void OnLog(LogEntryDto entry) =>
        _ = hub.Clients.All.SendAsync("logEntry", entry);
}
