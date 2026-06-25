namespace ProWatchCctvBridge.Broker.Dtos;

public record ScenarioDto(string Key, string EventType, string EventCode, bool IsAlarm, int Priority);

public record EventCodeDto(string Code, string Description);

public record ContractsDto(
    IReadOnlyList<string> EventTypes,
    IReadOnlyList<EventCodeDto> EventCodes,
    IReadOnlyList<ScenarioDto> Scenarios);
