var builder = DistributedApplication.CreateBuilder(args);

var postgres = builder.AddPostgres("postgres")
    .WithImage("pgvector/pgvector", "pg17")
    .AddDatabase("kitchendb");

var api = builder.AddProject<Projects.Kitchen_Api>("api")
    .WithReference(postgres)
    .WaitFor(postgres);

builder.AddProject<Projects.Kitchen_Web>("web")
    .WithReference(api)
    .WithExternalHttpEndpoints();

builder.Build().Run();
