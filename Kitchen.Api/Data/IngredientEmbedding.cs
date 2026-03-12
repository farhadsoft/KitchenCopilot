using Pgvector;

namespace Kitchen.Api.Data;

public class IngredientEmbedding
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public Vector Embedding { get; set; } = new(Array.Empty<float>());
}
