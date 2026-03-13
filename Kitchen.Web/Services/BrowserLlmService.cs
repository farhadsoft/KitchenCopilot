using Kitchen.Shared.Models;
using Microsoft.JSInterop;
using System.Runtime.CompilerServices;
using System.Threading.Channels;

namespace Kitchen.Web.Services;

public class BrowserLlmService(IJSRuntime js)
{
    private IJSObjectReference? _module;

    private async Task<IJSObjectReference> GetModuleAsync(CancellationToken ct)
    {
        _module ??= await js.InvokeAsync<IJSObjectReference>("import", ct, "/js/llm-interop.js");
        return _module;
    }

    public async IAsyncEnumerable<string> StreamAsync(
        IReadOnlyList<Ingredient> ingredients,
        [EnumeratorCancellation] CancellationToken ct)
    {
        var module = await GetModuleAsync(ct);
        var channel = Channel.CreateUnbounded<string>();
        var callback = new LlmCallback(channel.Writer);
        using var dotnetRef = DotNetObjectReference.Create(callback);

        var labels = ingredients.Select(i => i.Name).ToArray();

        // Fire-and-forget — JS calls OnToken/OnComplete/OnError on the callback
        _ = module.InvokeVoidAsync("streamRecipe", ct, labels, dotnetRef);

        await foreach (var token in channel.Reader.ReadAllAsync(ct))
            yield return token;
    }
}

// Must be public for [JSInvokable]
public sealed class LlmCallback(ChannelWriter<string> writer)
{
    [JSInvokable] public void OnToken(string token) => writer.TryWrite(token);
    [JSInvokable] public void OnComplete() => writer.TryComplete();
    [JSInvokable] public void OnError(string error) => writer.TryComplete(new Exception(error));
}
