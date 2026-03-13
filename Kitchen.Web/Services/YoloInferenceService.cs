using Kitchen.Shared.Models;
using Microsoft.JSInterop;

namespace Kitchen.Web.Services;

public class YoloInferenceService(IJSRuntime js)
{
    private IJSObjectReference? _module;

    private async Task<IJSObjectReference> GetModuleAsync()
    {
        _module ??= await js.InvokeAsync<IJSObjectReference>(
            "import", "/js/ort-interop.js");
        return _module;
    }

    public async Task<List<Ingredient>> DetectAsync(int[] rgbaPixels, int width, int height, CancellationToken ct)
    {
        var module = await GetModuleAsync();
        var results = await module.InvokeAsync<DetectionResult[]>(
            "runInference", ct, rgbaPixels, width, height);

        return [.. results.Select(r => new Ingredient(r.Label, r.Confidence))];
    }

    private record DetectionResult(string Label, float Confidence);
}
