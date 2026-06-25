# Plan: Blazor Broker UI -> .NET Web API + React SPA (test-harness, simplified)

## Goal

Replace the Blazor Server UI of the ProWatch CCTV Bridge with a small React SPA over a plain ASP.NET Core Web API. This is a **connection/integration test harness** — keep everything simple (KISS / YAGNI). Repurpose the existing `ProWatchCctvBridge.Broker` project **in place** into the Web API (strip Blazor, keep all pipeline services), add one SignalR hub for live updates, and have the API **serve the built React app as static files** (single origin: no nginx, no CORS). The backend pipeline (Pro-Watch listener, mapping, RabbitMQ publisher, ConfigStore, EF Core/SQLite) is reused unchanged.

## Decisions (simplified)

1. **Simple full replacement** — convert `Broker` -> Web API in place. No separate `Core` library, no Blazor/React coexistence, no parity ceremony.
2. **API serves the React build** (`UseStaticFiles` + SPA fallback). Dev uses a **Vite proxy** -> no nginx, no CORS anywhere.
3. **No auth** (internal test tool).
4. **Frontend**: Vite + React + TypeScript, Tailwind + shadcn/ui, TanStack Query, `@microsoft/signalr`, react-router. Control-room dark theme per `docs/design-guidelines.md`.
5. **New feature**: export ACS-received messages as a JSON file (current filters), implemented simply (load filtered list -> serialize -> return file; no streaming).

## Phases

| Phase | Title | Status | Summary |
|---|---|---|---|
| 01 | [Backend: Blazor -> Web API + hub](./phase-01-backend-blazor-to-api.md) | **Complete** | Strip Blazor from Broker; minimal-API endpoints + DTOs; one SignalR hub + broadcaster; ACS export; OpenAPI; serve SPA from wwwroot |
| 02 | [Frontend: React control-room SPA](./phase-02-react-control-room-spa.md) | **Complete** | Vite+TS+Tailwind+shadcn+TanStack+signalr+router; 4 screens to parity + export; Vite dev proxy |
| 03 | [Docker + smoke test](./phase-03-docker-and-smoke-test.md) | **Complete** | One Dockerfile (build React -> publish API w/ wwwroot); compose api+simulator+rabbitmq (reuse volume); manual smoke checklist |

## Dependencies

- Sequential: 01 -> 02 -> 03. Frontend (02) consumes the API + hub from 01. Docker (03) packages a working app.
- External (unchanged, already exist): `simulator` + `rabbitmq` compose services.

## Reference

- Contracts (REST + SignalR + DTO shapes), old->new map, parity checklist: [`../reports/analysis-260624-1937-blazor-to-dotnet-api-react-migration.md`](../reports/analysis-260624-1937-blazor-to-dotnet-api-react-migration.md). NOTE: the report's architecture passages about a `Core` library and an nginx reverse proxy are **superseded** by the simpler approach above; the **API/SignalR contracts + DTOs still apply**.
- UI design system (control-room dark): [`../../docs/design-guidelines.md`](../../docs/design-guidelines.md)
