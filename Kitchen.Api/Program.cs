using Kitchen.Api.Data;
using Kitchen.Api.Endpoints;
using Microsoft.EntityFrameworkCore;

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

builder.Services.AddSignalR(opt =>
    opt.EnableDetailedErrors = builder.Environment.IsDevelopment());
builder.Services.AddOpenApi();

// CORS for Blazor WASM — origin varies with Aspire's dynamic port assignment
builder.Services.AddCors(opt => opt.AddDefaultPolicy(policy =>
    policy.SetIsOriginAllowed(_ => true)
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

app.MapInventoryEndpoints();

app.Run();
