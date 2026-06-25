using System.Text.Json;
using ProWatchCctvBridge.Broker.Configuration;
using ProWatchCctvBridge.Shared.Cctv;
using RabbitMQ.Client;

namespace ProWatchCctvBridge.Broker.Services.Messaging;

/// <summary>
/// RabbitMQ publisher (RabbitMQ.Client v7 async API) that forwards CCTV commands over AMQPS.
/// Lazily opens a connection/channel, declares the exchange, and rebuilds on failure or config change.
/// </summary>
public sealed class RabbitMqPublisher : IRabbitPublisher
{
    private readonly ConfigStore _config;
    private readonly ConnectionStatus _status;
    private readonly BridgeEvents _events;
    private readonly ILogger<RabbitMqPublisher> _log;
    private readonly SemaphoreSlim _gate = new(1, 1);

    private IConnection? _connection;
    private IChannel? _channel;
    private volatile bool _invalidated;

    public RabbitMqPublisher(ConfigStore config, ConnectionStatus status, BridgeEvents events, ILogger<RabbitMqPublisher> log)
    {
        _config = config;
        _status = status;
        _events = events;
        _log = log;
    }

    public void Invalidate() => _invalidated = true;

    public async Task<PublishResult> PublishAsync(CctvCommand command, string routingKey, CancellationToken ct = default)
    {
        var opt = _config.GetRabbit();
        if (!opt.Enabled) return PublishResult.Fail("RabbitMQ publishing disabled");

        try
        {
            var channel = await EnsureChannelAsync(opt, ct);
            var body = JsonSerializer.SerializeToUtf8Bytes(command);
            var props = new BasicProperties
            {
                ContentType = "application/json",
                DeliveryMode = DeliveryModes.Persistent,
                MessageId = command.CommandId,
                // Type header carries the CCTV event code for broker-side routing/filtering.
                Type = command.Code,
                Timestamp = new AmqpTimestamp(DateTimeOffset.UtcNow.ToUnixTimeSeconds()),
            };

            await channel.BasicPublishAsync(opt.Exchange, routingKey, mandatory: false,
                basicProperties: props, body: body, cancellationToken: ct);

            SetRabbitState("Connected", null);
            return PublishResult.Ok();
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Publish to RabbitMQ failed");
            await ResetAsync();
            SetRabbitState("Error", ex.Message);
            return PublishResult.Fail(ex.Message);
        }
    }

    public async Task<PublishResult> TestConnectionAsync(CancellationToken ct = default)
    {
        // Use a 10-second timeout so the UI doesn't appear frozen on unreachable hosts.
        using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
        cts.CancelAfter(TimeSpan.FromSeconds(10));
        try
        {
            await EnsureChannelAsync(_config.GetRabbit(), cts.Token);
            SetRabbitState("Connected", null);
            return PublishResult.Ok();
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            await ResetAsync();
            SetRabbitState("Error", "Connection timed out (10 s)");
            return PublishResult.Fail("Connection timed out (10 s)");
        }
        catch (Exception ex)
        {
            await ResetAsync();
            SetRabbitState("Error", ex.Message);
            return PublishResult.Fail(ex.Message);
        }
    }

    private void SetRabbitState(string state, string? error)
    {
        _status.RabbitState = state;
        _status.RabbitError = error;
        _events.RaiseStatusChanged();
    }

    private async Task<IChannel> EnsureChannelAsync(RabbitMqOptions opt, CancellationToken ct)
    {
        await _gate.WaitAsync(ct);
        try
        {
            if (_invalidated) { await ResetCoreAsync(); _invalidated = false; }
            if (_channel is { IsOpen: true } && _connection is { IsOpen: true }) return _channel;
            await ResetCoreAsync();

            var factory = new ConnectionFactory
            {
                HostName = opt.HostName,
                Port = opt.Port,
                VirtualHost = opt.VirtualHost,
                UserName = opt.UserName,
                Password = opt.Password,
            };
            if (opt.UseTls)
            {
                factory.Ssl = RabbitTls.Build(opt);
                if (opt.AllowUntrustedRoot)
                    _log.LogWarning("RabbitMQ TLS: AllowUntrustedRoot is ON — server certificate is NOT verified (test only).");
            }

            _connection = await factory.CreateConnectionAsync(ct);
            // Enable publisher confirmations + tracking so BasicPublishAsync awaits the broker ack and throws on nack.
            var channelOptions = new CreateChannelOptions(
                publisherConfirmationsEnabled: true,
                publisherConfirmationTrackingEnabled: true);
            _channel = await _connection.CreateChannelAsync(channelOptions, ct);
            await _channel.ExchangeDeclareAsync(opt.Exchange, opt.ExchangeType,
                durable: true, autoDelete: false, cancellationToken: ct);

            _log.LogInformation("RabbitMQ connected {Host}:{Port} TLS={Tls} exchange='{Ex}' ({Type})",
                opt.HostName, opt.Port, opt.UseTls, opt.Exchange, opt.ExchangeType);
            return _channel;
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task ResetAsync()
    {
        await _gate.WaitAsync();
        try { await ResetCoreAsync(); }
        finally { _gate.Release(); }
    }

    private async Task ResetCoreAsync()
    {
        try { if (_channel is not null) await _channel.DisposeAsync(); } catch { /* ignore */ }
        try { if (_connection is not null) await _connection.DisposeAsync(); } catch { /* ignore */ }
        _channel = null;
        _connection = null;
    }

    public async ValueTask DisposeAsync()
    {
        await ResetAsync();
        _gate.Dispose();
    }
}
