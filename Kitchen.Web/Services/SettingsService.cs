using System.Text.Json;
using Kitchen.Web.Models;
using Microsoft.JSInterop;

namespace Kitchen.Web.Services;

public sealed class SettingsService(IJSRuntime js)
{
    private const string StorageKey = "kc_settings";

    public async Task<LlmSettings> GetAsync()
    {
        try
        {
            var json = await js.InvokeAsync<string?>("kcStorage.lsGet", StorageKey);
            if (string.IsNullOrEmpty(json))
                return new LlmSettings();
            return JsonSerializer.Deserialize<LlmSettings>(json) ?? new LlmSettings();
        }
        catch
        {
            return new LlmSettings();
        }
    }

    public async Task SaveAsync(LlmSettings settings)
    {
        var json = JsonSerializer.Serialize(settings);
        await js.InvokeVoidAsync("kcStorage.lsSet", StorageKey, json);
    }
}
