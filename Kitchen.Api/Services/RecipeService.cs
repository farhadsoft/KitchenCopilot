using Kitchen.Api.Data;
using Kitchen.Shared.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Pgvector;
using Pgvector.EntityFrameworkCore;
using System.Runtime.CompilerServices;

namespace Kitchen.Api.Services;

public class RecipeService(
    Kernel kernel,
    AppDbContext db,
    ILogger<RecipeService> logger)
{
    private const string FridgeToTablePrompt = """
        You are a creative, practical chef. The user has these ingredients available:
        {ingredients}

        Create a complete recipe using some or all of them. It's fine if not every ingredient is used.
        Format your response as:
        ## [Recipe Title]
        **Ingredients:** (with quantities)
        **Steps:** (numbered)
        **Tips:** (optional)
        """;

    public async IAsyncEnumerable<string> StreamRecipeAsync(
        RecipeRequest request,
        [EnumeratorCancellation] CancellationToken ct)
    {
        var resolved = await ResolveIngredientsAsync(request.Ingredients, ct);
        var ingredientList = string.Join(", ", resolved);

        logger.LogInformation("Streaming recipe for ingredients: {Ingredients}", ingredientList);

        var prompt = FridgeToTablePrompt.Replace("{ingredients}", ingredientList);
        var chat = kernel.GetRequiredService<IChatCompletionService>();
        var history = new ChatHistory();
        history.AddUserMessage(prompt);

        await foreach (var chunk in chat.GetStreamingChatMessageContentsAsync(history, cancellationToken: ct))
        {
            if (!string.IsNullOrEmpty(chunk.Content))
                yield return chunk.Content;
        }
    }

    private async Task<List<string>> ResolveIngredientsAsync(
        IReadOnlyList<Ingredient> ingredients,
        CancellationToken ct)
    {
        var resolved = new List<string>();

        foreach (var ingredient in ingredients)
        {
            // Try to find a semantically similar ingredient in the DB
            var match = await FindSimilarAsync(ingredient.Name, ct);
            resolved.Add(match ?? ingredient.Name);
        }

        return resolved;
    }

    private async Task<string?> FindSimilarAsync(string name, CancellationToken ct)
    {
        // Stub: returns null (use raw name) until embedding generation is wired
        // When SK embedding support is enabled, generate a vector here and use:
        // db.IngredientEmbeddings.OrderBy(e => e.Embedding.CosineDistance(queryVector)).FirstOrDefaultAsync()
        await Task.CompletedTask;
        return null;
    }
}
