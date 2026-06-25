namespace ProWatchCctvBridge.Broker.Services.Messaging;

public sealed record PublishResult(bool Success, string? Error)
{
    public static PublishResult Ok() => new(true, null);
    public static PublishResult Fail(string error) => new(false, error);
}
