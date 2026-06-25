using System.Collections.Concurrent;

namespace ProWatchCctvBridge.Broker.Logging;

/// <summary>Thread-safe ring buffer holding the last <see cref="MaxEntries"/> log entries.</summary>
public sealed class MemoryLogStore
{
    private const int MaxEntries = 500;
    private readonly ConcurrentQueue<LogEntryDto> _entries = new();
    private long _seq;

    public event Action<LogEntryDto>? OnEntry;

    public void Add(string level, string category, string message, string? exception)
    {
        var entry = new LogEntryDto(
            Interlocked.Increment(ref _seq),
            DateTime.UtcNow.ToString("O"),
            level,
            ShortenCategory(category),
            message,
            exception
        );

        _entries.Enqueue(entry);
        while (_entries.Count > MaxEntries)
            _entries.TryDequeue(out _);

        OnEntry?.Invoke(entry);
    }

    public IReadOnlyList<LogEntryDto> GetAll() => [.. _entries];

    // "ProWatchCctvBridge.Broker.Realtime.LogBroadcaster" -> "Realtime.LogBroadcaster"
    private static string ShortenCategory(string category)
    {
        var parts = category.Split('.');
        return parts.Length > 2 ? string.Join('.', parts[^2..]) : category;
    }
}
