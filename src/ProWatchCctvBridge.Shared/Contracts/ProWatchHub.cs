namespace ProWatchCctvBridge.Shared.Contracts;

/// <summary>
/// Shared SignalR contract names so the simulator (server) and the broker (client) stay in sync (DRY).
/// Hub path and callback names mirror the Pro-Watch Event Service ("/pwevents", hub "PWEventService",
/// callbacks onProwatchEvent / onProwatchAlarm / onProwatchAlarmDisposition, server methods subscribe / unsubscribe).
///
/// NOTE: The simulator hosts this over ASP.NET Core SignalR. The REAL Pro-Watch 6.0 Event Service uses
/// classic ASP.NET SignalR 2.2 (wire-incompatible with the .NET Core client). To target a real server,
/// add a classic-2.2 connector using the legacy Microsoft.AspNet.SignalR.Client package.
/// </summary>
public static class ProWatchHub
{
    /// <summary>Hub endpoint path. Real PW DTU default: /pwevents.</summary>
    public const string Path = "/pwevents";

    // Server methods (client -> server)
    public const string Subscribe = "Subscribe";
    public const string Unsubscribe = "Unsubscribe";

    // Client callbacks (server -> client) — exact names as used by Pro-Watch.
    public const string OnProwatchEvent = "onProwatchEvent";
    public const string OnProwatchAlarm = "onProwatchAlarm";
    public const string OnProwatchAlarmDisposition = "onProwatchAlarmDisposition";
}
