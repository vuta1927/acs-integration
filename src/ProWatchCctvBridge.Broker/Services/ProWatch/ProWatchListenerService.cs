using Microsoft.AspNet.SignalR.Client;
using Newtonsoft.Json.Linq;
using ProWatchCctvBridge.Broker.Configuration;
using ProWatchCctvBridge.Shared.Contracts;
using ProWatchCctvBridge.Shared.Events;

namespace ProWatchCctvBridge.Broker.Services.ProWatch;

/// <summary>
/// Connects to the Pro-Watch 6.0 Event Service hub using the CLASSIC ASP.NET SignalR 2.2 client
/// (Microsoft.AspNet.SignalR.Client) — the only wire-compatible client for a real Pro-Watch server.
///
/// Per the Pro-Watch API Service doc: connect to "/pwevents", create proxy for hub "PWEventService",
/// set userName + wrkstName as hub STATE (not method args) before Start, register the onProwatch*
/// callbacks, then Invoke("Subscribe"). Events are fed into the EventPipeline.
/// </summary>
public sealed class ProWatchListenerService : IHostedService, IAsyncDisposable
{
    /// <summary>Classic SignalR hub name exposed by the Pro-Watch Event Service.</summary>
    private const string HubName = "PWEventService";

    private readonly ConfigStore _config;
    private readonly EventPipeline _pipeline;
    private readonly ConnectionStatus _status;
    private readonly BridgeEvents _events;
    private readonly ILogger<ProWatchListenerService> _log;
    private readonly SemaphoreSlim _gate = new(1, 1);
    private HubConnection? _conn;
    private IHubProxy? _proxy;

    public ProWatchListenerService(ConfigStore config, EventPipeline pipeline, ConnectionStatus status,
        BridgeEvents events, ILogger<ProWatchListenerService> log)
    {
        _config = config;
        _pipeline = pipeline;
        _status = status;
        _events = events;
        _log = log;
        _config.ProWatchChanged += OnConfigChanged;
    }

    public ConnectionState State => _conn?.State ?? ConnectionState.Disconnected;

    public Task StartAsync(CancellationToken cancellationToken)
    {
        if (_config.GetProWatch().AutoConnect)
            _ = Task.Run(ConnectAsync);
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => DisconnectAsync();

    public async Task ConnectAsync()
    {
        await _gate.WaitAsync();
        try
        {
            TearDown();
            var opt = _config.GetProWatch();
            var url = HubUrl(opt);

            // Optional ?access_token= for token-gated deployments; real PW uses userName/wrkstName instead.
            var conn = string.IsNullOrWhiteSpace(opt.AccessToken)
                ? new HubConnection(url)
                : new HubConnection(url, new Dictionary<string, string> { ["access_token"] = opt.AccessToken });

            var proxy = conn.CreateHubProxy(HubName);

            // Credentials via hub state — REQUIRED before Start; Pro-Watch routes events by these.
            proxy["userName"] = opt.UserName ?? string.Empty;
            proxy["wrkstName"] = opt.WorkstationName ?? string.Empty;

            // Receive as raw JToken — Pro-Watch's PwEvent field names are undocumented (PwStatus differed
            // from our contract), so we log the raw JSON and best-effort map to PwEvent.
            proxy.On<JToken>(ProWatchHub.OnProwatchEvent, raw => DispatchRaw(raw, ProWatchHub.OnProwatchEvent, isAlarm: false));
            proxy.On<JToken>(ProWatchHub.OnProwatchAlarm, raw => DispatchRaw(raw, ProWatchHub.OnProwatchAlarm, isAlarm: true));
            proxy.On<JToken>(ProWatchHub.OnProwatchAlarmDisposition, raw => DispatchRaw(raw, ProWatchHub.OnProwatchAlarmDisposition, isAlarm: true));

            // Ignore callbacks from a superseded/torn-down connection.
            conn.Reconnecting += () => { if (IsActive(conn)) SetState("Reconnecting", null, subscribed: false); };
            conn.Reconnected += () =>
            {
                if (!IsActive(conn)) return;
                SetState("Connected", null);
                _ = Task.Run(() => SubscribeAsync(proxy, _config.GetProWatch()));
            };
            conn.Closed += () => { if (IsActive(conn)) SetState("Disconnected", null, subscribed: false); };
            conn.Error += ex => { if (IsActive(conn)) _log.LogWarning(ex, "Pro-Watch connection error"); };

            SetState("Connecting", null);
            await conn.Start();
            _conn = conn;
            _proxy = proxy;
            _status.ProWatchConnectedAt = DateTimeOffset.UtcNow;
            SetState("Connected", null);
            await SubscribeAsync(proxy, opt);
            _log.LogInformation("Connected to Pro-Watch at {Url}", url);
        }
        catch (Exception ex)
        {
            SetState("Error", ex.Message, subscribed: false);
            _log.LogError(ex, "Failed to connect to Pro-Watch");
        }
        finally
        {
            _gate.Release();
        }
    }

    public async Task DisconnectAsync()
    {
        await _gate.WaitAsync();
        try
        {
            TearDown();
            SetState("Disconnected", null, subscribed: false);
        }
        finally
        {
            _gate.Release();
        }
    }

    private async Task SubscribeAsync(IHubProxy proxy, ProWatchOptions opt)
    {
        try
        {
            // No args — Pro-Watch reads userName/wrkstName from hub state set before Start.
            // Invoke as raw JToken so we can see Pro-Watch's exact PwStatus shape (field names undocumented).
            var raw = await proxy.Invoke<JToken>(ProWatchHub.Subscribe);
            var rawText = raw?.ToString(Newtonsoft.Json.Formatting.None) ?? "(null)";
            var (success, message) = InterpretStatus(raw);

            _status.Subscribed = success;
            _events.RaiseStatusChanged();
            if (success)
                _log.LogInformation("Subscribed to Pro-Watch: {Msg}", message ?? "(ok)");
            else
                _log.LogWarning(
                    "Subscribe rejected: success={Ok} message={Msg} raw={Raw} | userName={User} wrkstName={Wrkst} | url={Url}",
                    success,
                    message ?? "(null)",
                    rawText,
                    string.IsNullOrEmpty(opt.UserName) ? "(not set)" : opt.UserName,
                    string.IsNullOrEmpty(opt.WorkstationName) ? "(not set)" : opt.WorkstationName,
                    HubUrl(opt));
        }
        catch (Exception ex)
        {
            _status.Subscribed = false;
            _log.LogError(ex, "Subscribe call threw an exception");
        }
    }

    /// <summary>
    /// Pro-Watch's PwStatus JSON field names are not documented; accept common variants
    /// (case-insensitive) so a naming mismatch doesn't masquerade as a rejection.
    /// </summary>
    private static (bool success, string? message) InterpretStatus(JToken? token)
    {
        if (token is null || token.Type == JTokenType.Null) return (false, null);
        if (token.Type == JTokenType.Boolean) return (token.Value<bool>(), null);
        if (token is JObject o)
        {
            bool? success = null;

            // Pro-Watch PwStatus: TransStatus (int, 0 = success) + TransStatusText (message).
            var trans = o.Property("TransStatus", StringComparison.OrdinalIgnoreCase);
            if (trans?.Value.Type == JTokenType.Integer) success = trans.Value.Value<int>() == 0;

            // Fallback: boolean success-style fields.
            if (success is null)
            {
                foreach (var key in new[] { "Success", "Status", "IsSuccess", "Result", "Ok" })
                {
                    var prop = o.Property(key, StringComparison.OrdinalIgnoreCase);
                    if (prop?.Value.Type == JTokenType.Boolean) { success = prop.Value.Value<bool>(); break; }
                }
            }

            string? message = null;
            foreach (var key in new[] { "TransStatusText", "Message", "Description", "Error", "StatusMessage", "Reason" })
            {
                var prop = o.Property(key, StringComparison.OrdinalIgnoreCase);
                if (prop?.Value.Type == JTokenType.String) { message = prop.Value.Value<string>(); break; }
            }
            return (success ?? false, message);
        }
        return (false, token.ToString());
    }

    /// <summary>Hub endpoint URL without query string (e.g. http://server:8735/pwevents).</summary>
    private static string HubUrl(ProWatchOptions opt) => $"{opt.BaseUrl.TrimEnd('/')}{opt.HubPath}";

    // Log the raw Pro-Watch event JSON (field names undocumented), then best-effort map to PwEvent.
    // Newtonsoft binds case-insensitively, so any matching field names populate automatically.
    // ACS does not send a plain EventType field; derive it from isAlarm if missing.
    private void DispatchRaw(JToken? raw, string source, bool isAlarm)
    {
        var rawText = raw?.ToString(Newtonsoft.Json.Formatting.None) ?? "(null)";
        _log.LogInformation("Pro-Watch {Source} received: {Raw}", source, rawText);

        PwEvent? ev = null;
        try { ev = raw?.ToObject<PwEvent>(); }
        catch (Exception ex) { _log.LogWarning(ex, "Failed to map {Source} to PwEvent — raw: {Raw}", source, rawText); }
        if (ev is null) return;

        // ACS does not send a plain EventType field — derive it from the alarm flag.
        if (string.IsNullOrEmpty(ev.EventType))
            ev.EventType = isAlarm ? "Alarm" : "Event";

        if (isAlarm) ev.IsAlarm = true;
        Dispatch(ev);
    }

    // Run the pipeline off the SignalR callback thread so we never block the connection.
    private void Dispatch(PwEvent ev) => _ = Task.Run(async () =>
    {
        try { await _pipeline.HandleAsync(ev); }
        catch (Exception ex) { _log.LogError(ex, "Pipeline failed for event {Id}", ev.EventId); }
    });

    // True only while this connection is the current one (guards reconnect vs disconnect/config-change races).
    private bool IsActive(HubConnection conn) => ReferenceEquals(_conn, conn);

    private void SetState(string state, string? error, bool? subscribed = null)
    {
        _status.ProWatchState = state;
        _status.ProWatchError = error;
        if (subscribed is not null) _status.Subscribed = subscribed.Value;
        _events.RaiseStatusChanged();
    }

    private void OnConfigChanged() => _ = Task.Run(ConnectAsync);

    private void TearDown()
    {
        if (_conn is not null)
        {
            try { _conn.Stop(); } catch { /* ignore */ }
            _conn.Dispose();
            _conn = null;
            _proxy = null;
        }
    }

    public ValueTask DisposeAsync()
    {
        _config.ProWatchChanged -= OnConfigChanged;
        TearDown();
        _gate.Dispose();
        return ValueTask.CompletedTask;
    }
}
