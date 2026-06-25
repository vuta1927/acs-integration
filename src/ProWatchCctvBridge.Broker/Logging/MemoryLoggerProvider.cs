namespace ProWatchCctvBridge.Broker.Logging;

/// <summary>Captures app log entries into <see cref="MemoryLogStore"/> for the browser console viewer.</summary>
public sealed class MemoryLoggerProvider(MemoryLogStore store) : ILoggerProvider
{
    public ILogger CreateLogger(string categoryName) => new MemoryLogger(categoryName, store);
    public void Dispose() { }
}

internal sealed class MemoryLogger(string category, MemoryLogStore store) : ILogger
{
    // High-frequency middleware categories — skip at Information to avoid flooding the store.
    private static readonly string[] _skipAtInfo =
    [
        "Microsoft.AspNetCore.StaticFiles",
        "Microsoft.AspNetCore.Routing",
        "Microsoft.AspNetCore.Hosting.Diagnostics",
        "Microsoft.EntityFrameworkCore.Database.Command",
    ];

    public bool IsEnabled(LogLevel logLevel)
    {
        if (logLevel < LogLevel.Information) return false;
        if (logLevel >= LogLevel.Warning) return true; // warnings and above always captured
        return !_skipAtInfo.Any(p => category.StartsWith(p, StringComparison.Ordinal));
    }

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state,
        Exception? exception, Func<TState, Exception?, string> formatter)
    {
        if (!IsEnabled(logLevel)) return;
        var message = formatter(state, exception);
        if (string.IsNullOrWhiteSpace(message)) return;
        store.Add(logLevel.ToString(), category, message, exception?.ToString());
    }
}
