using ProWatchCctvBridge.Broker.Mapping;
using ProWatchCctvBridge.Broker.Services;

namespace ProWatchCctvBridge.Broker.Endpoints;

public static class StatusEndpoints
{
    public static IEndpointRouteBuilder MapStatusEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/status", (ConnectionStatus status) =>
            Results.Ok(DtoMappers.ToStatusDto(status)));

        app.MapGet("/health", () =>
            Results.Ok(new { status = "ok" }));

        return app;
    }
}
