using ProWatchCctvBridge.Broker.Dtos;
using ProWatchCctvBridge.Shared.Events;

namespace ProWatchCctvBridge.Broker.Endpoints;

public static class MetaEndpoints
{
    private static readonly IReadOnlyList<string> EventTypes =
    [
        PwEventTypes.AccessGranted,
        PwEventTypes.AccessDenied,
        PwEventTypes.DoorForced,
        PwEventTypes.DoorHeld,
        PwEventTypes.DoorStatusChange,
        PwEventTypes.Alarm,
        PwEventTypes.Fire,
    ];

    private static readonly IReadOnlyList<EventCodeDto> EventCodes = PwEventCodes.Descriptions
        .Select(kv => new EventCodeDto(kv.Key, kv.Value))
        .ToList();

    public static IEndpointRouteBuilder MapMetaEndpoints(this IEndpointRouteBuilder app)
    {
        // Static contracts (event types + codes). Scenarios are simulator-only and empty against
        // a real Pro-Watch server, so no outbound probe is made.
        app.MapGet("/api/meta/contracts", () =>
            Results.Ok(new ContractsDto(EventTypes, EventCodes, [])));

        return app;
    }
}
