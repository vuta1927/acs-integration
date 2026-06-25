using ProWatchCctvBridge.Broker.Dtos;
using ProWatchCctvBridge.Broker.Mapping;
using ProWatchCctvBridge.Broker.Services;
using ProWatchCctvBridge.Broker.Services.Messaging;

namespace ProWatchCctvBridge.Broker.Endpoints;

public static class ConfigEndpoints
{
    public static IEndpointRouteBuilder MapConfigEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/config");

        g.MapGet("/prowatch", (ConfigStore config) =>
            Results.Ok(DtoMappers.ToDto(config.GetProWatch())));

        g.MapPut("/prowatch", async (ProWatchConfigDto dto, ConfigStore config) =>
        {
            var updated = DtoMappers.FromDto(dto, config.GetProWatch());
            await config.SaveProWatchAsync(updated);
            return Results.NoContent();
        });

        g.MapGet("/rabbit", (ConfigStore config) =>
            Results.Ok(DtoMappers.ToDto(config.GetRabbit())));

        g.MapPut("/rabbit", async (RabbitConfigDto dto, ConfigStore config, IRabbitPublisher rabbit) =>
        {
            var updated = DtoMappers.FromDto(dto, config.GetRabbit());
            await config.SaveRabbitAsync(updated);
            rabbit.Invalidate();
            return Results.NoContent();
        });

        g.MapPost("/rabbit/test", async (IRabbitPublisher rabbit, CancellationToken ct) =>
        {
            var result = await rabbit.TestConnectionAsync(ct);
            return Results.Ok(new TestResultDto(result.Success, result.Error));
        });

        return app;
    }
}
