using Microsoft.EntityFrameworkCore;
using Pgvector.EntityFrameworkCore;

namespace Kitchen.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<IngredientEmbedding> IngredientEmbeddings => Set<IngredientEmbedding>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresExtension("vector");

        modelBuilder.Entity<IngredientEmbedding>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(256);
            entity.HasIndex(e => e.Name).IsUnique();
            entity.Property(e => e.Embedding)
                  .HasColumnType("vector(384)");
        });
    }
}
