using Kitchen.Api.Data;
using Kitchen.Api.Endpoints;
using Kitchen.Api.Hubs;
using Kitchen.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.SemanticKernel;

var builder = WebApplication.CreateBuilder(args);

// Aspire service defaults (telemetry, health checks, service discovery)
builder.AddServiceDefaults();

// EF Core + pgvector via Aspire connection string
builder.AddNpgsqlDbContext<AppDbContext>("kitchendb");

// Semantic Kernel with Ollama chat completion
var ollamaUrl = builder.Configuration.GetConnectionString("ollama")
                ?? "http://localhost:11434";

#pragma warning disable SKEXP0070
builder.Services.AddKernel()
    .AddOllamaChatCompletion("llama3.2", new Uri(ollamaUrl));
#pragma warning restore SKEXP0070

builder.Services.AddScoped<RecipeService>();
builder.Services.AddSignalR();
builder.Services.AddOpenApi();

// CORS for Blazor WASM
builder.Services.AddCors(opt => opt.AddDefaultPolicy(policy =>
    policy.WithOrigins("https://localhost:7001", "http://localhost:5001")
          .AllowAnyHeader()
          .AllowAnyMethod()
          .AllowCredentials()));

var app = builder.Build();

app.MapDefaultEndpoints();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();

    // Apply pending migrations on startup in dev
    using var scope = app.Services.CreateScope();
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await dbContext.Database.MigrateAsync();
}

app.UseHttpsRedirection();
app.UseCors();

app.MapHub<RecipeHub>("/hubs/recipe");
app.MapInventoryEndpoints();

app.Run();
