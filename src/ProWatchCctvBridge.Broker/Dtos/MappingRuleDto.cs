namespace ProWatchCctvBridge.Broker.Dtos;

// RoutingKey removed: all CCTV messages now use a single global routing key (RabbitMqOptions.DefaultRoutingKey).
public record MappingRuleDto(
    int Id,
    int Order,
    string Name,
    bool Enabled,
    string? MatchEventType,
    string? MatchEventCode,
    string? CameraIps,
    int SeverityLevel);
