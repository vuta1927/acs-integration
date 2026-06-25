using ProWatchCctvBridge.Broker.Services.ProWatch;

namespace ProWatchCctvBridge.Broker.Endpoints;

public static class ProWatchEndpoints
{
    public static IEndpointRouteBuilder MapProWatchEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/prowatch");

        // Fire-and-forget connect (final state delivered via hub connectionStateChanged).
        g.MapPost("/connect", (ProWatchListenerService listener) =>
        {
            _ = Task.Run(listener.ConnectAsync);
            return Results.Accepted();
        });

        g.MapPost("/disconnect", async (ProWatchListenerService listener) =>
        {
            await listener.DisconnectAsync();
            return Results.Ok();
        });

        return app;
    }
}
