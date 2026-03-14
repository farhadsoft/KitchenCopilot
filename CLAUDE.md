# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kitchen Copilot is a privacy-first kitchen AI app. It detects ingredients from fridge photos using YOLO26 running locally in the browser (WebGPU/WASM), then streams AI-generated recipes via Semantic Kernel + Ollama — no image data ever leaves the device.

## Build Commands

```bash
# Build entire solution
dotnet build

# Run the app (launches Aspire dashboard + all services)
dotnet run --project Kitchen.AppHost

# EF Core migrations (run once Postgres is up via Aspire)
dotnet ef migrations add <MigrationName> --project Kitchen.Api --startup-project Kitchen.Api
dotnet ef database update --project Kitchen.Api --startup-project Kitchen.Api
```

**Prerequisite:** The solution is pinned to the stable .NET 10 SDK via `global.json` at the repo root. With the .NET 10 SDK active, install the native WASM tools:
```bash
dotnet workload install wasm-tools
```
> **Do NOT use the .NET 11 preview SDK** for this project. The `wasm-tools-net10` cross-targeting workload under .NET 11 preview bundles a native WASM runtime that is version-mismatched with the managed `10.0.5` NuGet packages, causing `MONO_WASM: index out of bounds` at startup. The `global.json` file pins `sdk.version` to `10.0.200` and ensures the stable toolchain is used.

## Architecture

Five projects, all targeting `net10.0`:

| Project | SDK | Role |
|---|---|---|
| `Kitchen.AppHost` | Aspire AppHost | Orchestrates Postgres, Ollama, Api, Web |
| `Kitchen.ServiceDefaults` | Aspire ServiceDefaults | Shared telemetry, health checks, service discovery |
| `Kitchen.Api` | `Microsoft.NET.Sdk.Web` | Minimal API + SignalR hub + EF Core + Semantic Kernel |
| `Kitchen.Web` | `Microsoft.NET.Sdk.BlazorWebAssembly` | Blazor WASM PWA with ONNX camera inference |
| `Kitchen.Shared` | classlib | Shared records: `Ingredient`, `RecipeRequest`, `RecipeChunk` |

**Important:** `Kitchen.Web` must NOT reference `Kitchen.ServiceDefaults`. ServiceDefaults has a `FrameworkReference` to `Microsoft.AspNetCore.App` which has no `browser-wasm` runtime pack and breaks the WASM build.

### Request flow

```
Browser camera → YOLO26 (Web Worker, WebGPU→WASM fallback)
  → FridgeScan.razor → RecipeStreamService → SignalR HubConnection
    → RecipeHub → RecipeService → Semantic Kernel → Ollama (llama3.2)
      → IAsyncEnumerable<string> tokens → RecipeDisplay.razor
```

### pgvector fuzzy ingredient matching

`AppDbContext` stores `IngredientEmbedding` entities with `vector(384)` columns. `RecipeService.FindSimilarAsync()` is currently a stub — when SK embedding support is wired, it will use cosine distance:
```csharp
db.IngredientEmbeddings.OrderBy(e => e.Embedding.CosineDistance(queryVector)).FirstOrDefaultAsync()
```
Migrations auto-apply on API startup in Development via `MigrateAsync()` in `Program.cs`.

### ONNX inference in the browser

`Kitchen.Web/wwwroot/js/ort-interop.js` runs as an ES module Web Worker. It loads `yolo26n.onnx` from `/models/yolo26n.onnx` (not included in repo — must be placed manually). Inference runs on WebGPU with WASM SIMD as fallback. `YoloInferenceService.cs` bridges Blazor → JS via `IJSRuntime`.

## Coding Conventions

- **Primary constructors for DI** everywhere (no field assignments).
- **Minimal APIs grouped with `MapGroup`** — see `InventoryEndpoints.cs` pattern.
- **Always pass `CancellationToken`** to every EF Core and Semantic Kernel call.
- **Never log raw image data** — only ingredient labels and confidence scores.
- Semantic Kernel Ollama connector is pre-release; suppress `SKEXP0070` at the call site, not globally.

## Theme

"Kitchen Dark" — applied via CSS variables in `wwwroot/css/app.css`:
- Background: `#0F172A`
- Accent (Emerald): `#10B981`

## Aspire Resource Names

These names must match exactly between AppHost wiring and API connection string lookups:
- Postgres database: `"kitchendb"`
- Ollama resource: `"ollama"`
- API project resource: `"api"`

The Blazor app resolves the API base URL from `ApiBaseUrl` config (set by Aspire) or falls back to `HostEnvironment.BaseAddress` for standalone dev.

## Tooling Instructions

- **Documentation:** Use the `mcp context7` MCP server whenever you need up-to-date library or framework documentation. Resolve the library ID first with `mcp__context7__resolve-library-id`, then fetch docs with `mcp__context7__query-docs`.
- **Frontend design:** Use the `frontend-design` plugin whenever creating or significantly modifying UI/UX — components, layouts, colour usage, or CSS.

## Pending / Not Yet Implemented

- `food-detector.onnx` — food-specific YOLOv8n model (60+ ingredient classes). Must be placed at `Kitchen.Web/wwwroot/models/food-detector.onnx`. Download a YOLOv8n food-detection model from [Roboflow Universe](https://universe.roboflow.com) (search "food detection", filter YOLOv8, export ONNX). After placing the model, update `FOOD_CLASSES` in both `wwwroot/js/visionWorker.js` and `wwwroot/js/ort-interop.js` to match the model's exact class labels from its `data.yaml`.
- `FindSimilarAsync` pgvector cosine search — stub until SK text embedding is configured
- PWA offline caching in `service-worker.js` — currently the generated stub
- `RecipeEndpoints.cs` non-streaming REST fallback for recipes
