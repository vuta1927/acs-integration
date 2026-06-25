using ProWatchCctvBridge.Shared.Contracts;
using ProWatchCctvBridge.Simulator.Hubs;
using ProWatchCctvBridge.Simulator.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSignalR();
builder.Services.AddSingleton<SimulatorState>();
builder.Services.AddSingleton<EventBroadcaster>();
builder.Services.AddHostedService<AutoEmitService>();

// Permissive CORS for local testing (SignalR needs credentials + explicit origin).
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.SetIsOriginAllowed(_ => true).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

var app = builder.Build();

app.UseCors();

// SignalR Event Service hub (mirrors Pro-Watch /pwevents).
app.MapHub<PwEventServiceHub>(ProWatchHub.Path);

// --- Control API (drive the simulator from a browser / curl / the broker UI) ---
app.MapGet("/", () => Results.Json(new
{
    service = "Pro-Watch Event Service Simulator",
    hub = ProWatchHub.Path,
    callbacks = new[] { ProWatchHub.OnProwatchEvent, ProWatchHub.OnProwatchAlarm },
    control = new[] { "GET /scenarios", "POST /emit/{key}", "POST /auto/{true|false}", "GET /state" },
}));

app.MapGet("/scenarios", () => Results.Json(
    PwEventFactory.Scenarios.Select(s => new { s.Key, s.EventType, s.EventCode, s.IsAlarm, s.Priority })));

app.MapPost("/emit/{key}", async (string key, EventBroadcaster broadcaster) =>
{
    var scenario = PwEventFactory.Find(key);
    if (scenario is null) return Results.NotFound(new { error = $"Unknown scenario '{key}'" });
    var ev = await broadcaster.EmitAsync(scenario);
    return Results.Json(ev);
});

app.MapPost("/auto/{on:bool}", (bool on, SimulatorState state) =>
{
    state.AutoEmit = on;
    return Results.Json(new { state.AutoEmit, state.IntervalSeconds });
});

app.MapGet("/state", (SimulatorState state) => Results.Json(new
{
    state.AutoEmit,
    state.IntervalSeconds,
    state.SubscriberCount,
    totalEmitted = Interlocked.Read(ref state.TotalEmitted),
}));

app.Run();
