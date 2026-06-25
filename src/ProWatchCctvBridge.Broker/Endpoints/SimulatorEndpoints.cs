using ProWatchCctvBridge.Broker.Dtos;

namespace ProWatchCctvBridge.Broker.Endpoints;

/// <summary>
/// Simulator control proxy. The local Simulator was dropped (real Pro-Watch uses classic SignalR 2.2,
/// incompatible with the Core-SignalR simulator). These endpoints now no-op so the UI degrades cleanly
/// and the broker never probes the real Pro-Watch server for simulator-only routes.
/// </summary>
public static class SimulatorEndpoints
{
    public static IEndpointRouteBuilder MapSimulatorEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/simulator");

        // No simulator in this deployment — return no scenarios (UI hides the control panel).
        g.MapGet("/scenarios", () => Results.Ok(Array.Empty<ScenarioDto>()));

        // No simulator to emit against.
        g.MapPost("/emit/{key}", (string key) =>
            Results.NotFound(new { error = "Simulator is not available in this deployment" }));

        return app;
    }
}
