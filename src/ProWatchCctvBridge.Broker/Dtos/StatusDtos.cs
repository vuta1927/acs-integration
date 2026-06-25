namespace ProWatchCctvBridge.Broker.Dtos;

public record ConnectionStateDto(
    string ProWatchState,
    string? ProWatchError,
    string? ProWatchConnectedAt,
    bool Subscribed,
    string RabbitState,
    string? RabbitError);

public record CountersDto(
    long TotalReceived,
    long TotalForwarded,
    long TotalFailed,
    long TotalSkipped);

public record BridgeStatusDto(ConnectionStateDto Connection, CountersDto Counters);
