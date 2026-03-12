using Kitchen.Api.Data;
using Kitchen.Shared.Models;
using Microsoft.EntityFrameworkCore;

namespace Kitchen.Api.Endpoints;

public static class InventoryEndpoints
{
    public static IEndpointRouteBuilder MapInventoryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/inventory");

        group.MapGet("/", async (AppDbContext db, CancellationToken ct) =>
            await db.IngredientEmbeddings
                    .Select(e => new Ingredient(e.Name, 1f))
                    .ToListAsync(ct));

        group.MapDelete("/{name}", async (string name, AppDbContext db, CancellationToken ct) =>
        {
            var entity = await db.IngredientEmbeddings.FirstOrDefaultAsync(e => e.Name == name, ct);
            if (entity is null) return Results.NotFound();
            db.IngredientEmbeddings.Remove(entity);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        return app;
    }
}
