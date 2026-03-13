using CommunityToolkit.Aspire.Hosting.Ollama;

var builder = DistributedApplication.CreateBuilder(args);

var postgres = builder.AddPostgres("postgres")
    .WithImage("pgvector/pgvector", "pg17")
    .AddDatabase("kitchendb");

var ollama = builder.AddOllama("ollama")
    .WithDataVolume()
    .AddModel("llama3.2");

var api = builder.AddProject<Projects.Kitchen_Api>("api")
    .WithReference(postgres)
    .WithReference(ollama)
    .WaitFor(postgres)
    .WaitFor(ollama);

builder.AddProject<Projects.Kitchen_Web>("web")
    .WithReference(api)
    .WithExternalHttpEndpoints();

builder.Build().Run();
