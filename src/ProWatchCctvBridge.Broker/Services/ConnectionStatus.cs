namespace ProWatchCctvBridge.Broker.Services;

/// <summary>Live connection + throughput state shown on the dashboard. Counters are mutated via Interlocked.</summary>
public sealed class ConnectionStatus
{
    public string ProWatchState { get; set; } = "Disconnected";
    public string? ProWatchError { get; set; }
    public DateTimeOffset? ProWatchConnectedAt { get; set; }
    public bool Subscribed { get; set; }

    public string RabbitState { get; set; } = "Idle";
    public string? RabbitError { get; set; }

    public long TotalReceived;
    public long TotalForwarded;
    public long TotalFailed;
    public long TotalSkipped;
}
