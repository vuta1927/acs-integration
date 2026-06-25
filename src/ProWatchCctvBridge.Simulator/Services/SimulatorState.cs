using System.Collections.Concurrent;

namespace ProWatchCctvBridge.Simulator.Services;

/// <summary>Singleton holding the simulator's runtime state (subscribers, auto-emit toggle, counters).</summary>
public sealed class SimulatorState
{
    private readonly ConcurrentDictionary<string, byte> _subscribers = new();

    public bool AutoEmit { get; set; } = true;
    public int IntervalSeconds { get; set; } = 5;

    /// <summary>Total events broadcast since start. Mutated via Interlocked.</summary>
    public long TotalEmitted;

    public int SubscriberCount => _subscribers.Count;

    public void AddSubscriber(string connectionId) => _subscribers[connectionId] = 1;
    public void RemoveSubscriber(string connectionId) => _subscribers.TryRemove(connectionId, out _);
}
