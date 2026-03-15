namespace Kitchen.Web.Models;

public record LlmSettings
{
    public float Temperature { get; init; } = 0.7f;
    public int MaxTokens { get; init; } = 512;
    public float FrequencyPenalty { get; init; } = 0.5f;
}
