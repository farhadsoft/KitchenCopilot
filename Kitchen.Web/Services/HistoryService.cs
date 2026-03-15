using System.Text.Json;
using Kitchen.Web.Models;
using Microsoft.JSInterop;

namespace Kitchen.Web.Services;

public sealed class HistoryService(IJSRuntime js)
{
    private const string StorageKey = "kc_history";
    private const string CookieName = "kc_session_id";

    public async Task<string> GetOrCreateSessionIdAsync()
    {
        var existing = await js.InvokeAsync<string?>("kcStorage.cookieGet", CookieName);
        if (!string.IsNullOrEmpty(existing))
            return existing;

        var newId = Guid.NewGuid().ToString();
        await js.InvokeVoidAsync("kcStorage.cookieSet", CookieName, newId, 30);
        return newId;
    }

    public async Task SaveAsync(List<string> ingredients, string recipeMarkdown)
    {
        var sessionId = await GetOrCreateSessionIdAsync();
        var entries = await LoadAllRawAsync();

        entries.Insert(0, new HistoryEntry
        {
            SessionId = sessionId,
            Ingredients = ingredients,
            RecipeMarkdown = recipeMarkdown
        });

        await PersistAsync(entries);
    }

    public async Task<List<HistoryEntry>> GetAllAsync()
    {
        return await LoadAllRawAsync();
    }

    public async Task DeleteAsync(string id)
    {
        var entries = await LoadAllRawAsync();
        entries.RemoveAll(e => e.Id == id);
        await PersistAsync(entries);
    }

    public async Task ClearAllAsync()
    {
        await js.InvokeVoidAsync("kcStorage.lsRemove", StorageKey);
    }

    private async Task<List<HistoryEntry>> LoadAllRawAsync()
    {
        try
        {
            var json = await js.InvokeAsync<string?>("kcStorage.lsGet", StorageKey);
            if (string.IsNullOrEmpty(json))
                return [];
            return JsonSerializer.Deserialize<List<HistoryEntry>>(json) ?? [];
        }
        catch
        {
            return [];
        }
    }

    private async Task PersistAsync(List<HistoryEntry> entries)
    {
        var json = JsonSerializer.Serialize(entries);
        await js.InvokeVoidAsync("kcStorage.lsSet", StorageKey, json);
    }
}
