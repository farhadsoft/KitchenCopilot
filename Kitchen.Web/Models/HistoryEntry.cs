namespace Kitchen.Web.Models;

public sealed class HistoryEntry
{
    public string Id { get; init; } = Guid.NewGuid().ToString();
    public string SessionId { get; init; } = string.Empty;
    public DateTimeOffset Timestamp { get; init; } = DateTimeOffset.UtcNow;
    public List<string> Ingredients { get; init; } = [];
    public string RecipeMarkdown { get; init; } = string.Empty;
}
