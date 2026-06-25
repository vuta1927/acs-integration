using Microsoft.EntityFrameworkCore;
using ProWatchCctvBridge.Broker.Data;
using ProWatchCctvBridge.Broker.Dtos;
using ProWatchCctvBridge.Broker.Mapping;

namespace ProWatchCctvBridge.Broker.Endpoints;

public static class MappingRulesEndpoints
{
    public static IEndpointRouteBuilder MapMappingRulesEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/mapping-rules");

        g.MapGet("/", async (IDbContextFactory<BridgeDbContext> dbFactory) =>
        {
            await using var db = await dbFactory.CreateDbContextAsync();
            var rules = await db.MappingRules.OrderBy(r => r.Order).ToListAsync();
            return Results.Ok(rules.Select(DtoMappers.ToDto));
        });

        // Replace-all in a transaction: remove existing, add incoming, auto-assign new PKs.
        g.MapPut("/", async (MappingRuleDto[] dtos, IDbContextFactory<BridgeDbContext> dbFactory) =>
        {
            if (dtos.Length > 500)
                return Results.BadRequest(new { error = "Too many rules (max 500)" });
            await using var db = await dbFactory.CreateDbContextAsync();
            await using var tx = await db.Database.BeginTransactionAsync();

            var existing = await db.MappingRules.ToListAsync();
            db.MappingRules.RemoveRange(existing);
            db.MappingRules.AddRange(dtos.Select(DtoMappers.FromDto));
            await db.SaveChangesAsync();
            await tx.CommitAsync();

            return Results.Ok(new { count = dtos.Length });
        });

        return app;
    }
}
