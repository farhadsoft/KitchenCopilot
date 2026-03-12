using Kitchen.Web;
using Kitchen.Web.Services;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

// API base address — Aspire service discovery resolves "api" in production;
// in standalone dev point to the Api project's dev URL.
var apiBase = builder.Configuration["ApiBaseUrl"]
              ?? builder.HostEnvironment.BaseAddress;

builder.Services.AddScoped(sp => new HttpClient { BaseAddress = new Uri(apiBase) });
builder.Services.AddScoped<YoloInferenceService>();
builder.Services.AddScoped<RecipeStreamService>();

await builder.Build().RunAsync();
