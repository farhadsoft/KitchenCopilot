using Kitchen.Api.Services;
using Kitchen.Shared.Models;
using Microsoft.AspNetCore.SignalR;

namespace Kitchen.Api.Hubs;

public class RecipeHub(RecipeService recipeService) : Hub
{
    public IAsyncEnumerable<string> StreamRecipe(RecipeRequest request, CancellationToken ct)
        => recipeService.StreamRecipeAsync(request, ct);
}
