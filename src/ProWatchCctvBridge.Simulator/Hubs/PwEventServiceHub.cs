using Microsoft.AspNetCore.SignalR;
using ProWatchCctvBridge.Shared.Events;
using ProWatchCctvBridge.Simulator.Services;

namespace ProWatchCctvBridge.Simulator.Hubs;

/// <summary>
/// Simulates the Pro-Watch "PWEventService" hub. Clients call Subscribe() to start receiving
/// onProwatchEvent / onProwatchAlarm callbacks, mirroring the real Event Service flow.
///
/// Real Pro-Watch also expects the client to set state.userName / state.wrkstName before Subscribe
/// (used for routing-group/partition filtering). The simulator accepts them as optional args but
/// does not enforce filtering.
/// </summary>
public sealed class PwEventServiceHub : Hub
{
    public const string SubscribersGroup = "subscribers";

    private readonly SimulatorState _state;
    private readonly ILogger<PwEventServiceHub> _log;

    public PwEventServiceHub(SimulatorState state, ILogger<PwEventServiceHub> log)
    {
        _state = state;
        _log = log;
    }

    public async Task<PwStatus> Subscribe(string? userName = null, string? wrkstName = null)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, SubscribersGroup);
        _state.AddSubscriber(Context.ConnectionId);
        _log.LogInformation("Client {Conn} subscribed (user={User}, wrkst={Wrkst})",
            Context.ConnectionId, userName ?? "-", wrkstName ?? "-");
        return PwStatus.Ok("Subscribed to Pro-Watch events");
    }

    public async Task<PwStatus> Unsubscribe()
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, SubscribersGroup);
        _state.RemoveSubscriber(Context.ConnectionId);
        _log.LogInformation("Client {Conn} unsubscribed", Context.ConnectionId);
        return PwStatus.Ok("Unsubscribed");
    }

    public override Task OnConnectedAsync()
    {
        _log.LogInformation("Client connected: {Conn}", Context.ConnectionId);
        return base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        _state.RemoveSubscriber(Context.ConnectionId);
        _log.LogInformation("Client disconnected: {Conn}", Context.ConnectionId);
        return base.OnDisconnectedAsync(exception);
    }
}
