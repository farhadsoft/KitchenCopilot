using Kitchen.Api.Data;
using Kitchen.Api.Endpoints;
using Kitchen.Api.Hubs;
using Kitchen.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.SemanticKernel;

var builder = WebApplication.CreateBuilder(args);

// Aspire service defaults (telemetry, health checks, service discovery)
builder.AddServiceDefaults();

// EF Core + pgvector.
// AddNpgsqlDbContext doesn't expose the Npgsql data source builder, so pgvector's
// type mapping can't be registered through it. Use plain AddDbContext with UseVector()
// instead. Aspire injects the connection string via ConnectionStrings__kitchendb env var.
builder.Services.AddDbContext<AppDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("kitchendb")
                           ?? "Host=localhost;Database=kitchendb";
    options.UseNpgsql(connectionString, npgsql => npgsql.UseVector());
});

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
