namespace ProWatchCctvBridge.Broker.Configuration;

/// <summary>Connection settings for the Pro-Watch SignalR Event Service (editable from the UI, persisted in SQLite).</summary>
public sealed class ProWatchOptions
{
    /// <summary>Base server URL, e.g. http://localhost:5240 (simulator) or https://prowatch-server (real PW).</summary>
    public string BaseUrl { get; set; } = "http://localhost:5240";

    /// <summary>Hub path. Pro-Watch default: /pwevents.</summary>
    public string HubPath { get; set; } = "/pwevents";

    /// <summary>Optional bearer token appended as ?access_token= (used by the ICD-style Core endpoint).</summary>
    public string? AccessToken { get; set; }

    /// <summary>Pro-Watch user name sent on Subscribe (drives routing-group/partition filtering on real PW).</summary>
    public string? UserName { get; set; }

    /// <summary>Registered Pro-Watch workstation name sent on Subscribe.</summary>
    public string? WorkstationName { get; set; }

    /// <summary>Connect automatically on startup.</summary>
    public bool AutoConnect { get; set; } = true;

    /// <summary>Delay between manual reconnect attempts (SignalR auto-reconnect handles transient drops).</summary>
    public int ReconnectSeconds { get; set; } = 5;

    public string FullUrl
    {
        get
        {
            var url = $"{BaseUrl.TrimEnd('/')}{HubPath}";
            return string.IsNullOrWhiteSpace(AccessToken) ? url : $"{url}?access_token={AccessToken}";
        }
    }
}
