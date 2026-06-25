# Phase 01 — Backend: Blazor Broker -> Web API + SignalR hub

## Context Links

- Plan: [./plan.md](./plan.md)
- Contracts (REST + SignalR + DTO shapes): [../reports/analysis-260624-1937-blazor-to-dotnet-api-react-migration.md](../reports/analysis-260624-1937-blazor-to-dotnet-api-react-migration.md) (sec 4, 5)
- Source: `src/ProWatchCctvBridge.Broker/Program.cs`, `Services/**`, `Data/**`, `Components/**` (to remove)

## Overview

- **Priority:** Critical
- **Status:** Pending
- **Description:** Convert the existing `ProWatchCctvBridge.Broker` project (Blazor Server) into a plain ASP.NET Core Web API in place: remove Blazor, keep ALL pipeline services, expose minimal-API endpoints + one SignalR hub for live updates, add the ACS export endpoint, and serve the React build as static files. Single project, single origin.

## Key Insights

- Service layer has **zero Blazor coupling** (all singletons) — it ports as-is. Coupling lives only in `Components/**` + `ToastService`.
- Real-time: Blazor's circuit was the server->browser transport. Replace with a small `BridgeHub` + `BridgeEventsBroadcaster` (IHostedService) that subscribes to the in-proc `BridgeEvents` and pushes to all clients.
- Keep the post-build wiring: `ConfigStore.InitializeAsync()` (seeds DB + mapping rules) and `RabbitChanged -> IRabbitPublisher.Invalidate()`.
- Serve SPA from the same app: `UseStaticFiles()` + `MapFallbackToFile("index.html")`. No CORS needed (same origin). Dev uses a Vite proxy (Phase 02), so still no CORS.
- Export is simple: query filtered list -> serialize -> return as a file. No streaming.

## Requirements

**Functional** (endpoints per analysis sec 4; minimal APIs, camelCase JSON):
- Config: `GET/PUT /api/config/prowatch`, `GET/PUT /api/config/rabbit`, `POST /api/config/rabbit/test`. Secrets masked on GET; blank-on-PUT keeps existing.
- Mapping: `GET /api/mapping-rules`, `PUT /api/mapping-rules` (replace-all).
- Events: `GET /api/events` (paged+filters), `GET /api/events/{id}` (detail+raw), `GET /api/events/{eventId}/forwarded`, `GET /api/events/recent?take=50`, `GET /api/events/export` (JSON file, current filters, ACS fields + raw, no forward outcome).
- Status: `GET /api/status`. ProWatch: `POST /api/prowatch/connect` (202), `POST /api/prowatch/disconnect`.
- Simulator proxy: `GET /api/simulator/scenarios`, `POST /api/simulator/emit/{key}` (degrade to `[]`/clear error, never 500).
- Meta: `GET /api/meta/contracts`. Health: `GET /health`.
- SignalR hub `/hubs/bridge`: server->client `eventReceived`, `eventForwarded`, `connectionStateChanged`, `countersUpdated`.

**Non-functional**
- DTOs (simple records), not raw entities; secrets never returned plaintext.
- `RawJson`/`PayloadJson` -> `JsonElement` passthrough (avoid double-encoded JSON).
- Project stays buildable at every step.

## Related Code Files

**To create**
- `src/ProWatchCctvBridge.Broker/Hubs/BridgeHub.cs` (empty push-only `Hub`)
- `src/ProWatchCctvBridge.Broker/Realtime/BridgeEventsBroadcaster.cs` (IHostedService bridging `BridgeEvents` -> `IHubContext<BridgeHub>`)
- `src/ProWatchCctvBridge.Broker/Endpoints/*.cs` (Config, MappingRule, Event, Status, ProWatch, SimulatorProxy, Meta) — each a `MapXxx(this IEndpointRouteBuilder)` extension
- `src/ProWatchCctvBridge.Broker/Dtos/**` (config/events/mapping/status/meta/common records, incl. `AcsEventExportDto`)
- `src/ProWatchCctvBridge.Broker/Mapping/DtoMappers.cs` (projections + `Mask`/`MergeSecret` + JsonElement parse)

**To modify**
- `src/ProWatchCctvBridge.Broker/Program.cs` — remove Blazor (`AddRazorComponents`/`MapRazorComponents`/`AddInteractiveServerComponents`/`UseAntiforgery`/status-code re-exec/`/Error`); add `AddSignalR` (camelCase), endpoints, `AddHostedService<BridgeEventsBroadcaster>`, OpenAPI (dev), `UseStaticFiles()` + `MapFallbackToFile("index.html")`. Keep DI for all services + `AddDbContextFactory` + DataProtection + `ConfigStore.InitializeAsync` + `RabbitChanged->Invalidate`.
- `src/ProWatchCctvBridge.Broker/ProWatchCctvBridge.Broker.csproj` — drop unused Blazor bits if any (SDK already `Microsoft.NET.Sdk.Web`).

**To delete**
- `src/ProWatchCctvBridge.Broker/Components/**`, `Services/ToastService.cs`, Blazor `wwwroot/app.css` (React owns styling).

## Implementation Steps

1. Strip Blazor from `Program.cs`; build (API with no endpoints yet) to confirm it boots + PW listener auto-connects + Rabbit invalidation still wired.
2. Add DTO records + `DtoMappers` (mask secrets, JsonElement for raw/payload).
3. Add `BridgeHub` + `BridgeEventsBroadcaster`; `AddSignalR().AddJsonProtocol(camelCase)`; `MapHub<BridgeHub>("/hubs/bridge")`; `AddHostedService<...>`.
4. Add endpoint modules; wire `MapXxx()` in `Program.cs`; enable OpenAPI in Dev.
5. Add export endpoint (filtered query, serialize `AcsEventExportDto[]`, `Content-Disposition: attachment; filename="acs-events-{yyyyMMdd-HHmmss}.json"`).
6. Add `UseStaticFiles()` + `MapFallbackToFile("index.html")` (serves React build placed in `wwwroot` by Phase 02/03).
7. Delete `Components/**` + `ToastService`; rebuild.
8. Verify via Swagger/curl: emit `door-forced` (simulator) -> appears in `/api/events` + live `eventReceived`; secrets masked; mapping PUT persists; export downloads.

## Todo List

- [ ] Strip Blazor from Program.cs (still boots)
- [ ] DTOs + DtoMappers (mask + JsonElement)
- [ ] BridgeHub + BridgeEventsBroadcaster + AddSignalR
- [ ] Endpoint modules (config/mapping/events/status/prowatch/simulator/meta) + health
- [ ] Export endpoint (JSON file, current filters)
- [ ] UseStaticFiles + SPA fallback
- [ ] Delete Components/** + ToastService
- [ ] Swagger/curl verification (emit -> event + hub; secret masking; export)

## Success Criteria

- App boots as a Web API; OpenAPI lists all endpoints.
- Emitting a simulator scenario produces a DB row + a `/api/events` entry + a live `eventReceived` over `/hubs/bridge`.
- Connect/disconnect + Rabbit test work; secrets masked on GET, preserved on blank PUT.
- `GET /api/events/export` downloads a JSON file of all events matching the active filters.
- `dotnet build` clean.

## Risk Assessment

- **Broadcaster blocking the pipeline** (Med) — fire-and-forget `SendAsync` + try/catch/log; never await in event handlers.
- **Secret leak** (Med) — explicit check: GET config returns null/empty secrets.
- **Large export** (Low, test harness) — acceptable to load filtered list into memory at harness scale; revisit only if needed.

## Security Considerations

- No auth (internal). Secret masking on GET + blank-on-PUT is the key control; secrets stay DP-encrypted at rest.

## Next Steps

- Unblocks Phase 02 (React consumes these endpoints + hub).
