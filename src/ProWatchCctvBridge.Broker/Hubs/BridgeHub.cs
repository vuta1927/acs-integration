using Microsoft.AspNetCore.SignalR;

namespace ProWatchCctvBridge.Broker.Hubs;

/// <summary>Server-push-only hub for live bridge events. No client-to-server methods in v1.</summary>
public sealed class BridgeHub : Hub { }
