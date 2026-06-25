using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using ProWatchCctvBridge.Broker.Data;
using ProWatchCctvBridge.Broker.Dtos;
using ProWatchCctvBridge.Broker.Mapping;

namespace ProWatchCctvBridge.Broker.Endpoints;

public static class EventsEndpoints
{
    public static IEndpointRouteBuilder MapEventsEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/events");

        g.MapGet("/", async (
            IDbContextFactory<BridgeDbContext> dbFactory,
            int page = 1,
            int pageSize = 25,
            string? eventType = null,
            bool? isAlarm = null,
            string? forwardStatus = null,
            string? from = null,
            string? to = null,
            string? q = null) =>
        {
            pageSize = Math.Clamp(pageSize, 1, 200);
            page = Math.Max(page, 1);

            await using var db = await dbFactory.CreateDbContextAsync();
            var query = ApplyFilters(db.ReceivedEvents.AsQueryable(), eventType, isAlarm, forwardStatus, from, to, q);
            var total = await query.CountAsync();
            var items = await query
                .OrderByDescending(r => r.Id)
                .Skip((page - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return Results.Ok(new PagedResult<ReceivedEventDto>(
                items.Select(DtoMappers.ToDto).ToList(),
                page, pageSize, total,
                total > (long)page * (long)pageSize));
        });

        // Literal routes first — matched before parameterized segments.
        g.MapGet("/recent", async (IDbContextFactory<BridgeDbContext> dbFactory, int take = 50) =>
        {
            take = Math.Clamp(take, 1, 200);
            await using var db = await dbFactory.CreateDbContextAsync();
            var items = await db.ReceivedEvents
                .OrderByDescending(r => r.Id)
                .Take(take)
                .ToListAsync();
            return Results.Ok(items.Select(DtoMappers.ToDto));
        });

        g.MapGet("/export", async (
            IDbContextFactory<BridgeDbContext> dbFactory,
            string? eventType = null,
            bool? isAlarm = null,
            string? forwardStatus = null,
            string? from = null,
            string? to = null,
            string? q = null) =>
        {
            await using var db = await dbFactory.CreateDbContextAsync();
            var records = await ApplyFilters(
                    db.ReceivedEvents.AsQueryable(), eventType, isAlarm, forwardStatus, from, to, q)
                .OrderByDescending(r => r.Id)
                .ToListAsync();

            var export = records.Select(DtoMappers.ToExportDto).ToList();
            var opts = new JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            };
            var json = JsonSerializer.Serialize(export, opts);
            var filename = $"acs-events-{DateTimeOffset.UtcNow:yyyyMMdd-HHmmss}.json";
            return Results.File(Encoding.UTF8.GetBytes(json), "application/json", fileDownloadName: filename);
        });

        g.MapGet("/{id:long}", async (long id, IDbContextFactory<BridgeDbContext> dbFactory) =>
        {
            await using var db = await dbFactory.CreateDbContextAsync();
            var r = await db.ReceivedEvents.FindAsync(id);
            return r is null ? Results.NotFound() : Results.Ok(DtoMappers.ToDetailDto(r));
        });

        g.MapGet("/{eventId}/forwarded", async (string eventId, IDbContextFactory<BridgeDbContext> dbFactory) =>
        {
            await using var db = await dbFactory.CreateDbContextAsync();
            var msgs = await db.ForwardedMessages
                .Where(f => f.SourceEventId == eventId)
                .OrderByDescending(f => f.Id)
                .ToListAsync();
            return Results.Ok(msgs.Select(DtoMappers.ToDto));
        });

        return app;
    }

    private static IQueryable<ReceivedEventRecord> ApplyFilters(
        IQueryable<ReceivedEventRecord> q,
        string? eventType, bool? isAlarm, string? forwardStatus,
        string? from, string? to, string? search)
    {
        if (!string.IsNullOrWhiteSpace(eventType))
            q = q.Where(r => r.EventType == eventType);
        if (isAlarm.HasValue)
            q = q.Where(r => r.IsAlarm == isAlarm.Value);
        if (!string.IsNullOrWhiteSpace(forwardStatus))
            q = q.Where(r => r.ForwardStatus == forwardStatus);
        if (!string.IsNullOrWhiteSpace(from) && DateTimeOffset.TryParse(from, out var f))
            q = q.Where(r => r.ReceivedAt >= f);
        if (!string.IsNullOrWhiteSpace(to) && DateTimeOffset.TryParse(to, out var t))
            q = q.Where(r => r.ReceivedAt <= t);
        if (!string.IsNullOrWhiteSpace(search))
            q = q.Where(r =>
                r.EventId.Contains(search) ||
                r.EventType.Contains(search) ||
                r.EventCode.Contains(search) ||
                (r.Message != null && r.Message.Contains(search)));
        return q;
    }
}
