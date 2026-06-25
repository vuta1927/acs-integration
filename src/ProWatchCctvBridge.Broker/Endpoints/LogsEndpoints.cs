using ProWatchCctvBridge.Broker.Logging;

namespace ProWatchCctvBridge.Broker.Endpoints;

public static class LogsEndpoints
{
    public static void MapLogsEndpoints(this WebApplication app)
    {
        // GET /api/logs?level=Warning&category=Rabbit&take=200
        app.MapGet("/api/logs", (MemoryLogStore store,
            string? level, string? category, int take = 200) =>
        {
            var logs = store.GetAll().AsEnumerable();

            if (!string.IsNullOrEmpty(level))
                logs = logs.Where(e => e.Level.Equals(level, StringComparison.OrdinalIgnoreCase));

            if (!string.IsNullOrEmpty(category))
                logs = logs.Where(e => e.Category.Contains(category, StringComparison.OrdinalIgnoreCase));

            return logs.TakeLast(Math.Min(take, 500)).ToArray();
        });
    }
}
