using ProWatchCctvBridge.Broker.Data;

namespace ProWatchCctvBridge.Broker.Services;

/// <summary>In-process notifier so Blazor Server pages can refresh live as events flow through the pipeline.</summary>
public sealed class BridgeEvents
{
    public event Action<ReceivedEventRecord>? EventReceived;
    public event Action<ForwardedMessageRecord>? MessageForwarded;
    public event Action? StatusChanged;

    public void RaiseReceived(ReceivedEventRecord record) => EventReceived?.Invoke(record);
    public void RaiseForwarded(ForwardedMessageRecord message) => MessageForwarded?.Invoke(message);
    public void RaiseStatusChanged() => StatusChanged?.Invoke();
}
