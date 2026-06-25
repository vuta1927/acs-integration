namespace ProWatchCctvBridge.Simulator.Services;

/// <summary>Background loop that periodically emits a random scenario while AutoEmit is enabled and clients are subscribed.</summary>
public sealed class AutoEmitService : BackgroundService
{
    private readonly EventBroadcaster _broadcaster;
    private readonly SimulatorState _state;
    private readonly ILogger<AutoEmitService> _log;

    public AutoEmitService(EventBroadcaster broadcaster, SimulatorState state, ILogger<AutoEmitService> log)
    {
        _broadcaster = broadcaster;
        _state = state;
        _log = log;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (_state.AutoEmit && _state.SubscriberCount > 0)
                {
                    var ev = await _broadcaster.EmitAsync(PwEventFactory.Random(), stoppingToken);
                    _log.LogInformation("Auto-emitted {Type} ({Code}) -> {Door}", ev.EventType, ev.EventCode, ev.DoorId);
                }
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _log.LogError(ex, "Auto-emit iteration failed");
            }

            await Task.Delay(TimeSpan.FromSeconds(Math.Max(1, _state.IntervalSeconds)), stoppingToken);
        }
    }
}
