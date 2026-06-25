using Microsoft.AspNetCore.SignalR;
using ProWatchCctvBridge.Shared.Contracts;
using ProWatchCctvBridge.Shared.Events;
using ProWatchCctvBridge.Simulator.Hubs;

namespace ProWatchCctvBridge.Simulator.Services;

/// <summary>Builds a Pro-Watch event for a scenario and pushes it to all subscribed clients.</summary>
public sealed class EventBroadcaster
{
    private readonly IHubContext<PwEventServiceHub> _hub;
    private readonly SimulatorState _state;
    private long _seq;

    public EventBroadcaster(IHubContext<PwEventServiceHub> hub, SimulatorState state)
    {
        _hub = hub;
        _state = state;
    }

    public async Task<PwEvent> EmitAsync(PwEventFactory.Scenario scenario, CancellationToken ct = default)
    {
        var ev = PwEventFactory.Create(scenario, Interlocked.Increment(ref _seq));

        // Alarms go on the alarm callback, everything else on the event callback (mirrors real PW).
        var callback = ev.IsAlarm ? ProWatchHub.OnProwatchAlarm : ProWatchHub.OnProwatchEvent;

        await _hub.Clients.Group(PwEventServiceHub.SubscribersGroup).SendAsync(callback, ev, ct);
        Interlocked.Increment(ref _state.TotalEmitted);
        return ev;
    }
}
