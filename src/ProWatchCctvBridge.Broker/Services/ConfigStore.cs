using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using ProWatchCctvBridge.Broker.Configuration;
using ProWatchCctvBridge.Broker.Data;

namespace ProWatchCctvBridge.Broker.Services;

/// <summary>
/// Loads and persists editable configuration (Pro-Watch + RabbitMQ) to the SQLite AppSettings table,
/// caches it in memory, and notifies listeners to reconnect when it changes.
/// </summary>
public sealed class ConfigStore
{
    private const string ProWatchKey = "prowatch";
    private const string RabbitKey = "rabbitmq";

    private readonly IDbContextFactory<BridgeDbContext> _dbFactory;
    private readonly IDataProtector _protector;
    private readonly object _gate = new();
    private ProWatchOptions _prowatch = new();
    private RabbitMqOptions _rabbit = new();

    public ConfigStore(IDbContextFactory<BridgeDbContext> dbFactory, IDataProtectionProvider dataProtection)
    {
        _dbFactory = dbFactory;
        // Encrypts persisted config (RabbitMQ password, client-cert password, PW access token) at rest.
        _protector = dataProtection.CreateProtector("ProWatchCctvBridge.Config.v1");
    }

    public event Action? ProWatchChanged;
    public event Action? RabbitChanged;

    public ProWatchOptions GetProWatch() { lock (_gate) return Copy(_prowatch); }
    public RabbitMqOptions GetRabbit() { lock (_gate) return Copy(_rabbit); }

    /// <summary>Create the DB, load persisted config (seed defaults on first run), seed default mapping rules.</summary>
    public async Task InitializeAsync()
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        await db.Database.EnsureCreatedAsync();

        // Track whether rows already exist so env overrides only apply on first run.
        bool pwExists = await db.AppSettings.FindAsync(ProWatchKey) is not null;
        bool rbExists = await db.AppSettings.FindAsync(RabbitKey) is not null;

        _prowatch = await Load<ProWatchOptions>(db, ProWatchKey) ?? new ProWatchOptions();
        _rabbit = await Load<RabbitMqOptions>(db, RabbitKey) ?? new RabbitMqOptions();

        // On first run apply environment variable overrides (Docker / container deployment).
        // Env vars are only applied when the SQLite row does not exist yet; after that the UI config wins.
        if (!pwExists) ApplyProWatchEnvOverrides(_prowatch);
        if (!rbExists) ApplyRabbitEnvOverrides(_rabbit);

        await Upsert(db, ProWatchKey, _prowatch);
        await Upsert(db, RabbitKey, _rabbit);
        await db.SaveChangesAsync();

        await MappingRuleSeeder.EnsureSeededAsync(db);
    }

    // PROWATCH_BASEURL — base URL of the Pro-Watch SignalR Event Service endpoint (e.g. http://host:8735).
    // PROWATCH_USERNAME / PROWATCH_WRKST — Pro-Watch user + registered workstation, sent as SignalR hub
    // state on Subscribe (drives routing-group/partition filtering). No password is used on this channel.
    private static void ApplyProWatchEnvOverrides(ProWatchOptions opt)
    {
        var baseUrl = Environment.GetEnvironmentVariable("PROWATCH_BASEURL");
        if (!string.IsNullOrWhiteSpace(baseUrl)) opt.BaseUrl = baseUrl;

        var userName = Environment.GetEnvironmentVariable("PROWATCH_USERNAME");
        if (!string.IsNullOrWhiteSpace(userName)) opt.UserName = userName;

        var wrkst = Environment.GetEnvironmentVariable("PROWATCH_WRKST");
        if (!string.IsNullOrWhiteSpace(wrkst)) opt.WorkstationName = wrkst;
    }

    // RABBITMQ_HOST / PORT / VHOST / USER / PASS — connection details for AMQP(S) broker.
    // TLS trust: USE_TLS / SERVER_NAME / CA_CERT_PATH / ALLOW_UNTRUSTED_ROOT — needed to reach an
    // external AMQPS broker whose certificate is self-signed or has a CN that differs from HOST.
    private static void ApplyRabbitEnvOverrides(RabbitMqOptions opt)
    {
        var host = Environment.GetEnvironmentVariable("RABBITMQ_HOST");
        if (!string.IsNullOrWhiteSpace(host)) opt.HostName = host;

        var port = Environment.GetEnvironmentVariable("RABBITMQ_PORT");
        if (!string.IsNullOrWhiteSpace(port) && int.TryParse(port, out var p)) opt.Port = p;

        var vhost = Environment.GetEnvironmentVariable("RABBITMQ_VHOST");
        if (!string.IsNullOrWhiteSpace(vhost)) opt.VirtualHost = vhost;

        var user = Environment.GetEnvironmentVariable("RABBITMQ_USER");
        if (!string.IsNullOrWhiteSpace(user)) opt.UserName = user;

        var pass = Environment.GetEnvironmentVariable("RABBITMQ_PASS");
        if (!string.IsNullOrWhiteSpace(pass)) opt.Password = pass;

        var useTls = Environment.GetEnvironmentVariable("RABBITMQ_USE_TLS");
        if (!string.IsNullOrWhiteSpace(useTls) && bool.TryParse(useTls, out var tls)) opt.UseTls = tls;

        // Expected certificate CN/SAN. Set this when it differs from HOST (e.g. cert CN=localhost
        // while connecting by IP) so TLS hostname verification matches the presented certificate.
        var serverName = Environment.GetEnvironmentVariable("RABBITMQ_SERVER_NAME");
        if (!string.IsNullOrWhiteSpace(serverName)) opt.ServerName = serverName;

        // PEM CA certificate to trust a self-signed broker CA without disabling verification.
        var caCertPath = Environment.GetEnvironmentVariable("RABBITMQ_CA_CERT_PATH");
        if (!string.IsNullOrWhiteSpace(caCertPath)) opt.CaCertPath = caCertPath;

        // TEST ONLY: accept self-signed chain / name mismatch when no CA cert is provided.
        var allowUntrusted = Environment.GetEnvironmentVariable("RABBITMQ_ALLOW_UNTRUSTED_ROOT");
        if (!string.IsNullOrWhiteSpace(allowUntrusted) && bool.TryParse(allowUntrusted, out var allow))
            opt.AllowUntrustedRoot = allow;

        // The single routing key used for all CCTV messages (e.g. cctv.sacs.queue).
        var routingKey = Environment.GetEnvironmentVariable("RABBITMQ_ROUTING_KEY");
        if (!string.IsNullOrWhiteSpace(routingKey)) opt.DefaultRoutingKey = routingKey;

        // Exchange override (defaults to cctv.events).
        var exchange = Environment.GetEnvironmentVariable("RABBITMQ_EXCHANGE");
        if (!string.IsNullOrWhiteSpace(exchange)) opt.Exchange = exchange;
    }

    public async Task SaveProWatchAsync(ProWatchOptions options)
    {
        await PersistAsync(ProWatchKey, options);
        lock (_gate) _prowatch = Copy(options);
        ProWatchChanged?.Invoke();
    }

    public async Task SaveRabbitAsync(RabbitMqOptions options)
    {
        await PersistAsync(RabbitKey, options);
        lock (_gate) _rabbit = Copy(options);
        RabbitChanged?.Invoke();
    }

    private async Task PersistAsync<T>(string key, T value)
    {
        await using var db = await _dbFactory.CreateDbContextAsync();
        await Upsert(db, key, value);
        await db.SaveChangesAsync();
    }

    private async Task<T?> Load<T>(BridgeDbContext db, string key)
    {
        var row = await db.AppSettings.FindAsync(key);
        return row is null ? default : JsonSerializer.Deserialize<T>(Unprotect(row.Value));
    }

    private async Task Upsert<T>(BridgeDbContext db, string key, T value)
    {
        var protectedJson = _protector.Protect(JsonSerializer.Serialize(value));
        var row = await db.AppSettings.FindAsync(key);
        if (row is null) db.AppSettings.Add(new AppSetting { Key = key, Value = protectedJson });
        else row.Value = protectedJson;
    }

    private string Unprotect(string stored)
    {
        try { return _protector.Unprotect(stored); }
        catch { return stored; } // tolerate legacy plaintext rows written before encryption
    }

    private static T Copy<T>(T source) => JsonSerializer.Deserialize<T>(JsonSerializer.Serialize(source))!;
}
