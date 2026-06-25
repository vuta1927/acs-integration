namespace ProWatchCctvBridge.Shared.Events;

/// <summary>
/// Status returned by the Pro-Watch Event Service server methods (Subscribe / Unsubscribe),
/// mirroring the "PwStatus" return value described in the Pro-Watch API Service document.
/// </summary>
public sealed class PwStatus
{
    public bool Success { get; set; }
    public string? Message { get; set; }

    public static PwStatus Ok(string? message = null) => new() { Success = true, Message = message };
    public static PwStatus Fail(string message) => new() { Success = false, Message = message };
}
