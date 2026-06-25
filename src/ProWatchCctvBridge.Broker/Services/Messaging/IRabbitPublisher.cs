using ProWatchCctvBridge.Shared.Cctv;

namespace ProWatchCctvBridge.Broker.Services.Messaging;

/// <summary>Publishes mapped CCTV commands to RabbitMQ over AMQPS.</summary>
public interface IRabbitPublisher : IAsyncDisposable
{
    Task<PublishResult> PublishAsync(CctvCommand command, string routingKey, CancellationToken ct = default);

    /// <summary>Open (or reuse) a connection without publishing — used by the "Test connection" UI button.</summary>
    Task<PublishResult> TestConnectionAsync(CancellationToken ct = default);

    /// <summary>Force the next publish to reconnect (call after RabbitMQ config changes).</summary>
    void Invalidate();
}
