using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using ProWatchCctvBridge.Broker.Data;
using ProWatchCctvBridge.Broker.Endpoints;
using ProWatchCctvBridge.Broker.Hubs;
using ProWatchCctvBridge.Broker.Logging;
using ProWatchCctvBridge.Broker.Realtime;
using ProWatchCctvBridge.Broker.Services;
using ProWatchCctvBridge.Broker.Services.Mapping;
using ProWatchCctvBridge.Broker.Services.Messaging;
using ProWatchCctvBridge.Broker.Services.ProWatch;

var builder = WebApplication.CreateBuilder(args);

// In-memory log store — created before Build() so the logger provider can reference the same instance.
var logStore = new MemoryLogStore();
builder.Services.AddSingleton(logStore);
builder.Logging.AddProvider(new MemoryLoggerProvider(logStore));

builder.Services.AddHttpClient();

// Data Protection — encrypts persisted secrets (RabbitMQ password, access token) at rest.
// DP_KEYS_PATH env var pins the key ring to a volume so secrets survive container restarts.
var dpKeysPath = Environment.GetEnvironmentVariable("DP_KEYS_PATH");
if (!string.IsNullOrEmpty(dpKeysPath))
{
    Directory.CreateDirectory(dpKeysPath);
    builder.Services.AddDataProtection()
        .PersistKeysToFileSystem(new DirectoryInfo(dpKeysPath));
}
else
{
    builder.Services.AddDataProtection();
}

// Persistence (SQLite) via a context factory.
var connectionString = builder.Configuration.GetConnectionString("Sqlite") ?? "Data Source=bridge.db";
builder.Services.AddDbContextFactory<BridgeDbContext>(o => o.UseSqlite(connectionString));

// Application services (all singletons — no Blazor scoped services).
builder.Services.AddSingleton<ConfigStore>();
builder.Services.AddSingleton<ConnectionStatus>();
builder.Services.AddSingleton<BridgeEvents>();
builder.Services.AddSingleton<EventMapper>();
builder.Services.AddSingleton<IRabbitPublisher, RabbitMqPublisher>();
builder.Services.AddSingleton<EventPipeline>();

// Pro-Watch SignalR listener (singleton + hosted service so the API can drive Connect/Disconnect).
builder.Services.AddSingleton<ProWatchListenerService>();
builder.Services.AddHostedService(sp => sp.GetRequiredService<ProWatchListenerService>());

// Browser-facing SignalR with camelCase JSON protocol.
builder.Services.AddSignalR()
    .AddJsonProtocol(opts =>
        opts.PayloadSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase);

// Broadcaster: BridgeEvents (in-proc) -> hub clients.
builder.Services.AddHostedService<BridgeEventsBroadcaster>();
// Broadcaster: MemoryLogStore new entries -> hub clients (browser console viewer).
builder.Services.AddHostedService<LogBroadcaster>();

// OpenAPI for dev exploration (available at /openapi/v1.json + Scalar UI).
if (builder.Environment.IsDevelopment())
    builder.Services.AddOpenApi();

var app = builder.Build();

// Initialize DB + load persisted config + seed mapping rules before hosted services start.
await app.Services.GetRequiredService<ConfigStore>().InitializeAsync();
// Reconnect the RabbitMQ publisher when its config changes.
app.Services.GetRequiredService<ConfigStore>().RabbitChanged +=
    () => app.Services.GetRequiredService<IRabbitPublisher>().Invalidate();

if (app.Environment.IsDevelopment())
    app.MapOpenApi();

// Serve React SPA static files from wwwroot (populated by Phase 02/03 build).
app.UseStaticFiles();

// REST API endpoints.
app.MapConfigEndpoints();
app.MapMappingRulesEndpoints();
app.MapEventsEndpoints();
app.MapStatusEndpoints();
app.MapProWatchEndpoints();
app.MapSimulatorEndpoints();
app.MapMetaEndpoints();
app.MapLogsEndpoints();

// Browser-facing SignalR hub.
app.MapHub<BridgeHub>("/hubs/bridge");

// SPA fallback — serve index.html for any non-API, non-hub, non-static path.
app.MapFallbackToFile("index.html");

app.Run();
