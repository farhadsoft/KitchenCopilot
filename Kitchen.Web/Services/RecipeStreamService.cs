using Kitchen.Shared.Models;
using Microsoft.AspNetCore.SignalR.Client;
using System.Runtime.CompilerServices;

namespace Kitchen.Web.Services;

public class RecipeStreamService(HttpClient http) : IAsyncDisposable
{
    private HubConnection? _hub;

    private async Task<HubConnection> GetHubAsync(CancellationToken ct)
    {
        if (_hub is null)
        {
            var hubUrl = new Uri(http.BaseAddress!, "/hubs/recipe");
            _hub = new HubConnectionBuilder()
                .WithUrl(hubUrl)
                .WithAutomaticReconnect()
                .Build();
        }

        if (_hub.State == HubConnectionState.Disconnected)
            await _hub.StartAsync(ct);

        return _hub;
    }

    public async IAsyncEnumerable<string> StreamAsync(
        RecipeRequest request,
        [EnumeratorCancellation] CancellationToken ct)
    {
        var hub = await GetHubAsync(ct);

        await foreach (var token in hub.StreamAsync<string>("StreamRecipe", request, ct))
            yield return token;
    }

    public async ValueTask DisposeAsync()
    {
        if (_hub is not null)
            await _hub.DisposeAsync();
    }
}
