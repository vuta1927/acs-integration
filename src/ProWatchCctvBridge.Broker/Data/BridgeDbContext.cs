using Microsoft.EntityFrameworkCore;

namespace ProWatchCctvBridge.Broker.Data;

/// <summary>EF Core SQLite context for message history, forwarding log, mapping rules, and config.</summary>
public sealed class BridgeDbContext : DbContext
{
    public BridgeDbContext(DbContextOptions<BridgeDbContext> options) : base(options) { }

    public DbSet<ReceivedEventRecord> ReceivedEvents => Set<ReceivedEventRecord>();
    public DbSet<ForwardedMessageRecord> ForwardedMessages => Set<ForwardedMessageRecord>();
    public DbSet<AppSetting> AppSettings => Set<AppSetting>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<ReceivedEventRecord>(e =>
        {
            e.HasIndex(x => x.ReceivedAt);
            e.HasIndex(x => x.EventType);
        });
        b.Entity<ForwardedMessageRecord>(e => e.HasIndex(x => x.ForwardedAt));
        b.Entity<AppSetting>(e => e.HasKey(x => x.Key));
    }
}
