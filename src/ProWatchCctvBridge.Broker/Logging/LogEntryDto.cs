namespace ProWatchCctvBridge.Broker.Logging;

public record LogEntryDto(
    long Id,
    string Timestamp,   // ISO-8601 UTC
    string Level,       // "Information" | "Warning" | "Error" | "Critical"
    string Category,    // shortened (last 2 segments)
    string Message,
    string? Exception
);
