# Analysis: Blazor Broker UI -> .NET Web API + React SPA Migration

Reference doc consolidating six subsystem analyses + target design. Evidence base: all paths cite files read under `src/ProWatchCctvBridge.Broker/**`, `src/ProWatchCctvBridge.Shared/**`, `src/ProWatchCctvBridge.Simulator/**`, `docker-compose.yml`. Grammar sacrificed for concision.

Companion plan: `../260624-1937-blazor-to-dotnet-api-react-migration/plan.md`.

> **SIMPLIFIED (test-harness) APPROACH — supersedes parts of this report.** This is a connection/integration test harness, built simply (KISS/YAGNI): the existing `Broker` project is converted **in place** into a Web API (no separate `Core` library, no Blazor/React coexistence), and the API **serves the React build as static files** (no nginx, no CORS; dev uses a Vite proxy). The plan is **3 phases** (backend / frontend / docker+smoke). The REST + SignalR **contracts, DTO shapes, old->new map, and parity checklist below still apply**; ignore the report's passages about a `Core` lib and an nginx reverse proxy.

---

## 1. Migration Goal + Fixed Constraints

Replace the Blazor Server Broker UI with a standalone ASP.NET Core Web API + a React SPA, **reusing the backend pipeline unchanged**. Delete Blazor only after React reaches parity.

Fixed decisions (non-negotiable):
1. **Full replacement** — new `src/ProWatchCctvBridge.Api` (Web API + browser SignalR hub) + React SPA in new top-level `web/`. Backend pipeline services **reused** (moved to shared lib), not rewritten. Blazor Broker deleted at the end.
2. **Auth = none** (internal-only). No login/JWT. CORS for the React origin only. Auth seams noted but disabled.
3. **Frontend stack** — Vite + React + TypeScript, Tailwind CSS + shadcn/ui, TanStack Query (server state), `@microsoft/signalr` (real-time), react-router. Pure SPA (no Next.js).
4. **Repo structure** — same repo. Api under `src/`. React in new `web/`. `docker-compose.yml` updated (`Dockerfile.api`, `Dockerfile.web` w/ nginx).

---

## 2. Current Architecture (verified)

Pipeline: `Pro-Watch/Simulator --SignalR--> Broker --(IsAlarm?)--> map rules --> CCTV alarm JSON --AMQP(S)--> RabbitMQ --> VMS`. Only `IsAlarm=true` forwarded; others logged `Skipped`.

Three projects under `src/` (`ProWatchCctvBridge.slnx`: Broker, Shared, Simulator):
- **ProWatchCctvBridge.Shared** (net10.0, no deps) — wire contracts: `PwEvent`, `CctvCommand`, `PwStatus`, `PwEventTypes`/`PwEventCodes` catalog, `ProWatchHub` consts. Referenced by Simulator + Broker.
- **ProWatchCctvBridge.Simulator** (ASP.NET Core) — SignalR hub `/pwevents` @ :5240 + HTTP control API (`/scenarios`, `/emit/{key}`, `/auto/{bool}`, `/state`).
- **ProWatchCctvBridge.Broker** (Blazor Server :5180 + SignalR client + EF Core/SQLite + mapping + RabbitMQ publisher).

### 2.1 Broker DI wiring (`Broker/Program.cs`, verified)
Singletons (lines 41-50): `ConfigStore`, `ConnectionStatus`, `BridgeEvents`, `EventMapper`, `IRabbitPublisher`/`RabbitMqPublisher`, `EventPipeline`, `ProWatchListenerService` (+`AddHostedService`). Plus `AddHttpClient` (17), `AddDataProtection`+`DP_KEYS_PATH` (21-31), `AddDbContextFactory<BridgeDbContext>` (35). Post-build (55-58): `ConfigStore.InitializeAsync()` + `RabbitChanged -> Invalidate()` before `app.Run()`.
Blazor-only (DROP): `AddRazorComponents().AddInteractiveServerComponents()` (13-14), `AddScoped<ToastService>()` (38), `UseAntiforgery`/`MapStaticAssets`/`MapRazorComponents<App>().AddInteractiveServerRenderMode()` (67-71), `UseStatusCodePagesWithReExecute("/not-found")` (66), `/Error` handler (62).

### 2.2 Data model (EF Core SQLite — `Broker/Data/`)
`BridgeDbContext` (sealed) via **`AddDbContextFactory`** (factory pattern). 4 DbSets:
- `ReceivedEventRecord` (PK `Id` long): EventId/EventType/EventCode, EventDate/ReceivedAt (DateTimeOffset), nullable Door/User/Badge/Device/Location/Message, Priority int, IsAlarm bool, RawJson (def `"{}"`), ForwardStatus (def `Pending`).
- `ForwardedMessageRecord` (PK `Id` long): SourceEventId/CommandId/Exchange/RoutingKey, Status (def `Published`), Error?, PayloadJson, ForwardedAt.
- `MappingRuleRecord` (PK `Id` int): Order int, Name, Enabled (def true), MatchEventType?/MatchEventCode?, CameraIps?, SeverityLevel int (def 1), RoutingKey (def `cctv.alarm`).
- `AppSetting` (PK `Key` string): Value JSON (Data-Protection encrypted for secrets).
`ForwardStatus` = Pending|Published|Skipped|Failed. No FK (Forwarded.SourceEventId joins Received.EventId by string convention). Indexes: ReceivedAt, EventType, ForwardedAt. **No migrations** — schema via `EnsureCreatedAsync()` in `ConfigStore.InitializeAsync`.

### 2.3 Real-time (Blazor circuit, NOT browser SignalR)
`BridgeEvents` singleton = in-proc C# pub/sub: `EventReceived(ReceivedEventRecord)`, `MessageForwarded(ForwardedMessageRecord)`, `StatusChanged()` (payload-less ping). Raised in `EventPipeline` (RaiseReceived :61; RaiseStatusChanged :69,81,109; RaiseForwarded :108), `ProWatchListenerService.SetState` (:144), `RabbitMqPublisher.SetRabbitState` (:97). `Dashboard.razor` subscribes (:82-83), prepends to `_recent` ring buffer (cap 50, :87-92), re-reads `ConnectionStatus` singleton on `StateHasChanged`. **The Blazor circuit's own WebSocket is the server->browser transport React loses.** `MessageForwarded` raised but has **no subscriber today** (dead channel). `ToastService` scoped per-circuit; fired only by user-action handlers, never the pipeline.

`ConnectionStatus` singleton (in-memory, not persisted): PW state strings + `Subscribed` + `ProWatchConnectedAt`/error; `RabbitState`/`RabbitError`; 4 throughput counters (`TotalReceived/Forwarded/Failed/Skipped`, `Interlocked`). Counters reset on restart.

---

## 3. Per-Subsystem Findings

### 3.1 UI pages (6 Blazor pages -> React routes)

| Blazor page (route) | Real-time | React route + key components |
|---|---|---|
| `Dashboard.razor` (`/`) | yes (EventReceived, StatusChanged) | `/` dashboard-page: connection-cards, throughput-card, simulate-panel, live-feed-table |
| `History.razor` (`/history`) | no | `/history`: history-table, history-pager, event-detail-sheet, json-block |
| `MappingRules.razor` (`/mapping`) | no | `/mapping`: mapping-rules-table, mapping-rule-row |
| `Configuration.razor` (`/config`) | no | `/config`: Tabs(PW|Rabbit), prowatch-form, rabbit-form, secret-input |
| `Error.razor` (`/Error`) | server-render-only (HttpContext) | DELETED -> React ErrorBoundary |
| `NotFound.razor` (`/not-found`) | static | router `*` -> not-found-page |

Cross-cutting: `MainLayout` topbar+NavLink -> `app-layout`+`top-nav` (react-router NavLink active). `ToastService`+`Toast.razor` -> sonner `<Toaster/>` (error 7s / else 4s — parity `Toast.razor:30`). **`ReconnectModal` (.razor/.js/.css) DELETED** — Blazor-circuit-only concept; replaced by lightweight `connection-banner` (Alert/Badge driven by hub conn state, NOT a blocking modal). `#blazor-error-ui` -> ErrorBoundary.

Dashboard drives simulator via **direct HTTP control API** (browser->Blazor-server->simulator): `POST {BaseUrl}/emit/{key}` (:149), `GET {BaseUrl}/scenarios` (:166), `BaseUrl = ConfigStore.GetProWatch().BaseUrl`. Falls back to hardcoded scenario array if offline (:77).

### 3.2 Services (backend pipeline — REUSE)
All app services are **singletons** (request-agnostic) except `ToastService` (scoped) + DbContext (factory). **Zero Blazor coupling in the service layer** — coupling lives only in `.razor` + `ToastService`. The entire `Services/` tree ports cleanly.

| Service | Disposition | Notes |
|---|---|---|
| `EventPipeline` | REUSE-AS-IS | persist->map->publish->persist->raise events; mutates counters |
| `ConfigStore` | REUSE-AS-IS | load/persist PW+Rabbit config; DP-encrypted; **keep purpose string `"ProWatchCctvBridge.Config.v1"` verbatim** (`:28`); fires ProWatchChanged/RabbitChanged; InitializeAsync seeds DB+rules |
| `ConnectionStatus` | REUSE-AS-IS | mutable shared state + Interlocked counters |
| `BridgeEvents` | REUSE-AS-IS | in-proc events; new broadcaster subscribes (replaces Blazor subs) |
| `EventMapper` (+`MappingResult`) | REUSE-AS-IS | pure: first enabled rule by Order -> CctvCommand |
| `RabbitMqPublisher`/`IRabbitPublisher`/`RabbitTls`/`PublishResult` | REUSE-AS-IS | lazy AMQPS, confirms, TestConnectionAsync (10s timeout), Invalidate |
| `ProWatchListenerService` | REUSE-AS-IS | IHostedService+IAsyncDisposable; ConnectAsync/DisconnectAsync; self-wires `ProWatchChanged` in ctor (:30) |
| `MappingRuleSeeder` | REUSE-AS-IS | idempotent EnsureSeededAsync |
| `BridgeDbContext`+Entities | REUSE-AS-IS | factory pattern carries over |
| `ProWatchOptions`/`RabbitMqOptions` | REUSE-AS-IS | POCO options |
| `ToastService` | **DROP** | circuit-scoped; React/sonner concern |
| `Components/**` | **DROP** | rewritten in React |

### 3.3 Data layer
Recommend new shared class lib **`src/ProWatchCctvBridge.Core`** (SDK `Microsoft.NET.Sdk`) holding `Data/`, `Configuration/`, `Services/`. Chosen over folding into `Shared` because `Shared` has zero deps + is referenced by Simulator — adding EF Core there pulls EF into Simulator's transitive graph. Api references Core; Broker temporarily references Core during parity, deleted after. Schema **frozen** -> keep `EnsureCreatedAsync()` (no migrations); flag upgrade path to EF Migrations if columns ever added. **DTOs Api-owned, NOT raw entities**: secrets masked on GET + write-only-on-change; `RawJson`/`PayloadJson` -> `JsonElement` passthrough (avoid double-encoded JSON); `DateTimeOffset` -> ISO-8601 string (UTC, pipeline writes UtcNow).

### 3.4 Real-time / messaging
New browser-facing **`BridgeHub`** (ASP.NET Core SignalR, `/hubs/bridge`) + **`BridgeEventsBroadcaster : IHostedService`** subscribing `BridgeEvents` -> `IHubContext<BridgeHub>.Clients.All.SendAsync` (thread-safe/host-agnostic; no Blazor `InvokeAsync` marshalling; fire-and-forget + try/catch/log, never block pipeline). Split Blazor's single payload-less `StatusChanged` into **two typed messages** (`connectionStateChanged` + `countersUpdated`) for separate TanStack cache slices. **Full snapshots, not deltas** -> reconnect self-heals. Wires up previously-dead `MessageForwarded`. ProWatchListener + RabbitPublisher reusable as-is; Api `Program.cs` **must reproduce** `RabbitChanged -> Invalidate()` + `ConfigStore.InitializeAsync()` wiring.

### 3.5 Shared + simulator
Api **MUST add ProjectReference to Shared** (single source of wire contracts). **Simulator UNCHANGED.** Api proxies simulator HTTP control API via `/api/simulator/*` (keeps single origin, no simulator CORS, BaseUrl server-side only). Emit+scenarios parity only (auto/state unused by Blazor UI). **TS types: hand-written** for ~4 DTOs + runtime `GET /api/meta/contracts` catalog endpoint (drift mitigation; covers codes 100/950 not in `PwEventCodes`). Pin **camelCase** JSON (PwEvent has no `[JsonPropertyName]`) on both HTTP + SignalR. `severityLevel` (CctvCommand: 0=Critical/1=Major/2=Minor) differs from `Priority` (PW scale) — don't conflate.

### 3.6 Infra / build
Current 3-service compose (simulator :5240, broker :5180 w/ `broker-data:/data`, rabbitmq). Broker port 5180 from Kestrel in `appsettings.json` (not launchSettings). **CI is dead boilerplate**: `.github/workflows/release*.yml`+`sync-*.yml` run `npm test`/`npm run lint`/`semantic-release` but **no root `package.json`** exists -> all fail. Husky `commit-msg` broken (no `commitlint.config.*`, no `.husky/_/`). Treat current CI as non-functional; add real .NET+JS CI.

Target topology — **Option A (nginx reverse proxy)** chosen: browser hits only `web` (:5180->:80); nginx serves SPA static + `proxy_pass /api` + `/hubs` -> `http://api:8080`. React uses relative URLs. CORS unused in prod (same-origin) but defined for dev (Vite :5173 -> api :8080). Reuse `broker-data` volume as `api-data` to preserve DP keys + DB. SignalR WS upgrade requires nginx `map $http_upgrade` + `Connection $connection_upgrade` + `proxy_read_timeout >=100s`.

---

## 4. REST API Contract

Base `/api`. JSON camelCase (pinned). Minimal APIs w/ `MapGroup`. Services injected as DI singletons (reused from Core). DB via `IDbContextFactory<BridgeDbContext>`.

| METHOD | Path | Request | Response | Backing |
|---|---|---|---|---|
| GET | `/api/config/prowatch` | — | `ProWatchConfigDto` (AccessToken masked) | `ConfigStore.GetProWatch()` |
| PUT | `/api/config/prowatch` | `ProWatchConfigDto` | `204` | `SaveProWatchAsync()` -> listener reconnect; blank token=keep |
| GET | `/api/config/rabbit` | — | `RabbitConfigDto` (Password/ClientCertPassword masked) | `ConfigStore.GetRabbit()` |
| PUT | `/api/config/rabbit` | `RabbitConfigDto` | `204` | `SaveRabbitAsync()` + `IRabbitPublisher.Invalidate()`; blank secret=keep |
| POST | `/api/config/rabbit/test` | — | `TestResultDto {success,error}` | `IRabbitPublisher.TestConnectionAsync()` (no save) |
| GET | `/api/mapping-rules` | — | `MappingRuleDto[]` (by Order) | `db.MappingRules.OrderBy(Order)` |
| PUT | `/api/mapping-rules` | `MappingRuleDto[]` | `200 {count}` | replace-all txn (RemoveRange+AddRange); parity `MappingRules.razor:96-111` |
| GET | `/api/events` | `page,pageSize,eventType?,isAlarm?,forwardStatus?,from?,to?,q?` | `PagedResult<ReceivedEventDto>` | OrderByDescending(Id) Skip/Take + Count |
| GET | `/api/events/{id}` | long id | `ReceivedEventDetailDto` (+`raw:JsonElement`) | `Find(id)` |
| GET | `/api/events/{eventId}/forwarded` | string eventId | `ForwardedMessageDto[]` | `Where(SourceEventId==eventId).OrderByDescending(Id)` |
| GET | `/api/events/recent?take=50` | take (def 50, max 200) | `ReceivedEventDto[]` | live-feed backfill on mount |
| GET | `/api/events/export` | same filters as `/api/events` (no paging) | `application/json` **file** (attachment, `acs-events-{ts}.json`) | stream all `ReceivedEventRecord` matching filters -> `AcsEventExportDto[]` (ACS fields + raw, **no forward outcome**) |
| GET | `/api/status` | — | `BridgeStatusDto` | `ConnectionStatus` snapshot |
| POST | `/api/prowatch/connect` | — | `202` | `ConnectAsync()` (fire-and-forget; final state via hub) |
| POST | `/api/prowatch/disconnect` | — | `200` | `DisconnectAsync()` |
| GET | `/api/simulator/scenarios` | — | `ScenarioDto[]` | proxy `GET {BaseUrl}/scenarios`; degrade -> `[]` |
| POST | `/api/simulator/emit/{key}` | key | `200`/`404 {error}` | proxy `POST {BaseUrl}/emit/{key}` |
| GET | `/api/meta/contracts` | — | `ContractsDto` | PwEventTypes/PwEventCodes/scenarios |
| GET | `/health` | — | `200 {status:"ok"}` | compose healthcheck |

Optional (deferred, YAGNI): per-row mapping CRUD (`POST`/`PUT/{id}`/`DELETE/{id}`/`reorder`), `/api/config/prowatch/test`.

### DTO shapes (camelCase)
- `ProWatchConfigDto(baseUrl, hubPath, accessToken?, userName?, workstationName?, autoConnect, reconnectSeconds)`
- `RabbitConfigDto(enabled, hostName, port, virtualHost, userName, password?, useTls, tlsVersion, serverName?, caCertPath?, clientCertPath?, clientCertPassword?, allowUntrustedRoot, exchange, exchangeType, defaultRoutingKey)`
- `TestResultDto(success, error?)`
- `MappingRuleDto(id, order, name, enabled, matchEventType?, matchEventCode?, cameraIps?, severityLevel, routingKey)`
- `ReceivedEventDto(id, eventId, eventType, eventCode, eventDate, doorId?, userId?, badgeId?, deviceId?, location?, priority, isAlarm, message?, receivedAt, forwardStatus)` — NO raw in list
- `ReceivedEventDetailDto(...above..., raw:JsonElement)`
- `AcsEventExportDto(eventId, eventType, eventCode, eventDate, doorId?, userId?, badgeId?, deviceId?, location?, priority, isAlarm, message?, receivedAt, raw:JsonElement)` — ACS-received fields only; **excludes ForwardStatus / CCTV-forward outcome** (export decision); used by `GET /api/events/export`
- `ForwardedMessageDto(id, sourceEventId, commandId, exchange, routingKey, status, error?, payload:JsonElement, forwardedAt)`
- `PagedResult<T>(items, page, pageSize, totalCount, hasMore)`
- `ConnectionStateDto(proWatchState, proWatchError?, proWatchConnectedAt?, subscribed, rabbitState, rabbitError?)`
- `CountersDto(totalReceived, totalForwarded, totalFailed, totalSkipped)`
- `BridgeStatusDto(connection, counters)`
- `ScenarioDto(key, eventType, eventCode, isAlarm, priority)` / `EventCodeDto(code, description)` / `ContractsDto(eventTypes, eventCodes, scenarios)`

Mapper helpers (`Api/Mapping/DtoMappers.cs`): `Mask(secret)`, `MergeSecret(incoming, existing)`, `JsonDocument.Parse(rawJson).RootElement`.

---

## 5. SignalR Hub Contract

Hub `BridgeHub` @ `/hubs/bridge`. **Server->client only** (push). No client->server methods v1 (all control via REST). Bridge = `BridgeEventsBroadcaster : IHostedService`.

| Method | Triggered by | Payload |
|---|---|---|
| `eventReceived` | `BridgeEvents.EventReceived` (`EventPipeline.cs:61`) | `ReceivedEventDto` (no raw) |
| `eventForwarded` | `BridgeEvents.MessageForwarded` (`:108`; was dead) | `ForwardedMessageDto` |
| `connectionStateChanged` | `StatusChanged` (`:69,81,109`; SetState; SetRabbitState) | `ConnectionStateDto` |
| `countersUpdated` | same `StatusChanged` | `CountersDto` |

On each `StatusChanged` broadcaster sends **both** connection + counters. Hydration: REST initial (`/api/status`, `/api/events/recent`) + SignalR stream patches caches via `queryClient.setQueryData`. Reconnect (`withAutomaticReconnect`): on `onreconnected` refetch `/api/status`+`/api/events/recent` (closes reconnect gap). Auth seam: later `[Authorize]` on hub + JS `accessTokenFactory` — disabled now.

---

## 6. React App Design

Routes: `/` (real-time), `/history`, `/mapping`, `/config`, `*` (404). `App.tsx`: `<AppLayout>` (top-nav + connection-banner + `<Outlet/>`). `main.tsx`: `QueryClientProvider` + `RouterProvider` + `<Toaster richColors/>` + one mounted `useBridgeHub()`.

TanStack Query keys: `['status']` (hub-patched), `['events','recent']`, `['events',{page,filters}]` (keepPreviousData), `['events',id,'forwarded']`, `['mapping-rules']`, `['config','prowatch']`, `['config','rabbit']`, `['simulator','scenarios']`, `['meta','contracts']` (staleTime inf). Mutations fire sonner toasts in `onSuccess`/`onError` (error 7000ms / else 4000ms).

shadcn components: Card, Badge, Button, Table, Input, Select, Checkbox/Switch, Tabs, Dialog/Sheet, AlertDialog, Alert, sonner. Theme tokens ported from Broker `app.css` palette (primary #2f6fed, ok #1f8a44, err #d63b3b, warn #b5780f, muted #6b7488, topbar #1c2333). TS: `eventDate`/`receivedAt`/`forwardedAt` typed `string` (never blind `new Date()`); `raw`/`payload` typed `unknown`; severity union `0|1|2`; catalog data runtime-fetched. Reject NSwag/codegen (YAGNI for ~10 DTOs).

---

## 7. Old -> New Master Mapping

| Blazor feature (file:line) | React | API endpoint(s) | Hub event(s) |
|---|---|---|---|
| Dashboard PW card (:18-21,172-178) | connection-cards | GET /api/status | connectionStateChanged |
| Dashboard Rabbit card | connection-cards | GET /api/status | connectionStateChanged |
| Throughput (:39-40) | throughput-card | GET /api/status | countersUpdated |
| Connect (:101) / Disconnect (:116) | PW buttons | POST /api/prowatch/connect\|disconnect | connectionStateChanged |
| Test connection (:131) | Rabbit button | POST /api/config/rabbit/test | connectionStateChanged (side-effect) |
| Simulate chips (:149,166) | simulate-panel | GET /api/simulator/scenarios, POST /api/simulator/emit/{key} | resulting eventReceived |
| Live feed (:87-92) | live-feed-table | GET /api/events/recent?take=50 | eventReceived (prepend, cap 50) |
| History list (History.razor:70-74) | history-table+pager | GET /api/events?... | — |
| History RawJson detail (:41) | event-detail-sheet | GET /api/events/{id} | — |
| History forwarded (:92-95) | event-detail-sheet | GET /api/events/{eventId}/forwarded | — |
| Export ACS messages (NEW, beyond parity) | history toolbar `export-button` | GET /api/events/export (current filters) | — |
| Mapping grid (MappingRules.razor:64,28-42) | mapping-rules-table | GET /api/mapping-rules | — |
| Mapping Save replace-all (:96-111) | Save button | PUT /api/mapping-rules | — |
| Config PW form (Configuration.razor:13-18) | prowatch-form | GET/PUT /api/config/prowatch | reconnect->connectionStateChanged |
| Config Rabbit form (:26-41) | rabbit-form | GET/PUT /api/config/rabbit | — |
| Config Test (:91-107) | Rabbit Test button | PUT /api/config/rabbit then POST /api/config/rabbit/test | connectionStateChanged |
| ToastService + Toast.razor | sonner <Toaster/> | — | optional Toast |
| MainLayout topbar/NavLink | layout/top-nav | — | — |
| ReconnectModal (.razor/.js/.css) | **DELETED** -> connection-banner | — | hub conn state |
| #blazor-error-ui / Error.razor | React ErrorBoundary | — | — |
| NotFound.razor (Program.cs:66) | router * | — | — |

---

## 8. Risks (whole migration)

| # | Risk | Sev | Mitigation |
|---|---|---|---|
| R1 | DataProtection key loss on cutover -> persisted secrets undecryptable; Unprotect swallows error (ConfigStore.cs:144-145) -> silent corrupt config | CRITICAL | Reuse broker-data as api-data; keep purpose string "ProWatchCctvBridge.Config.v1"; verify Rabbit auth post-cutover |
| R2 | SignalR WebSocket proxying via nginx | CRITICAL | map $http_upgrade + Connection $connection_upgrade + proxy_read_timeout >=100s on /hubs/; verify transport=WebSockets |
| R3 | Dual-writer SQLite during parity (Broker+Api same bridge.db) -> SQLITE_BUSY | CRITICAL | Single writer: stop Broker before Api owns pipeline; or separate DB files |
| R4 | Secret leakage via REST GET config | IMPORTANT | Mask on GET, write-only-on-change; test explicitly |
| R5 | CORS+credentials breaks hub (AllowAnyOrigin) | IMPORTANT | Explicit origins + AllowCredentials; Option A same-origin sidesteps prod |
| R6 | JSON casing mismatch (PwEvent no [JsonPropertyName]) | IMPORTANT | Pin camelCase on HTTP + SignalR; smoke-test |
| R7 | SQLite/keys file perms in api container (non-root app UID) | IMPORTANT | Match Broker runtime user; test fresh volume write |
| R8 | RawJson/PayloadJson double-encoded for JS | LOW | JsonElement passthrough server-side |
| R9 | Mapping replace-all lost-update (concurrent edits) | LOW | Pre-existing; accept parity, toast on save |
| R10 | Dead npm/semantic-release CI fails PRs | LOW | Disable/repoint release*.yml/sync-*.yml; add real ci.yml |
| R11 | Reconnect gap loses pushed events | LOW | Full-snapshot messages + refetch on onreconnected |
| R12 | aspnet:10.0 may lack curl for healthcheck | LOW | Verify (simulator already assumes it); fallback wget |

---

## 9. Parity Checklist (must pass before Broker deletion)

- [ ] Dashboard PW card: state badge, Subscribed, "since" timestamp, error line — live via hub
- [ ] Dashboard Rabbit card: state + error (note: RabbitState set by RabbitMqPublisher.SetRabbitState — verify it reflects test/publish; appeared static in Blazor)
- [ ] Throughput counters (received/forwarded/skipped/failed) — snapshot + live countersUpdated
- [ ] Connect / Disconnect drive PW listener; state updates live
- [ ] Rabbit Test connection (Dashboard + Config) returns success/error toast
- [ ] Simulate chips: scenarios loaded; emit -> event flows -> live feed + counters bump
- [ ] Live feed: last <=50, newest first, backfilled on load, prepends on eventReceived
- [ ] History: paged (25/page), Newer/Older (Older disabled at end via hasMore), Refresh
- [ ] History detail: RawJson rendered; forwarded list w/ status badge, Exchange/RoutingKey, error, PayloadJson
- [ ] Mapping: load by Order; edit all cells; Add; Delete; Save (replace-all) persists + reflects in pipeline mapping
- [ ] Severity select 0 Critical/1 Major/2 Minor
- [ ] Config PW form: all fields; Save -> auto-reconnect
- [ ] Config Rabbit form: all fields incl TLS; Save + Invalidate; Test
- [ ] Secrets (AccessToken, Password, ClientCertPassword) never shown plaintext; blank-on-save keeps existing
- [ ] Toasts: 4 variants, error 7s / others 4s
- [ ] Nav active highlighting; 404 catch-all route
- [ ] Connection banner (replaces ReconnectModal) reflects hub state
- [ ] Containerized: web :5180, api :8080 (internal), simulator :5240, rabbitmq; healthchecks green; DP secrets decrypt; WS (not long-poll)

---

## 10. Unresolved Questions

1. **DP volume reuse** — plan reuses `broker-data` as `api-data` to preserve keys+DB. Confirm acceptable (else operator re-enters RabbitMQ/PW creds post-cutover).
2. **`ConnectionStatus.RabbitState`/`RabbitError`** — appears set only by `RabbitMqPublisher.SetRabbitState`; confirm it updates on test/publish so the Rabbit card is meaningful, else mark best-effort.
3. **Mapping granularity** — bulk-replace `PUT` (parity, chosen) vs per-row CRUD. Confirm bulk-only acceptable (accepts lost-update risk).
4. **Simulator `auto`/`state`** — surface to React or emit+scenarios parity only (chosen)?
5. **`/api/config/prowatch/test`** — add PW-only test (Blazor has none) or omit (chosen)?
6. **Broker overlap window** — concurrent Broker+Api (needs separate DB files) or hard cutover (stop Broker, single DB)?
7. **CI release automation** — kill `release*.yml`/`sync-*.yml`+`scripts/*.cjs`, or repoint to GHCR docker publish?
8. **`aspnet:10.0` healthcheck** — confirm `curl` present or switch to `wget`/dotnet.
9. **History pagination** — `totalCount`/`hasMore` added to `GET /api/events` (chosen) vs keep Blazor's `count < PageSize` inference?
10. **Live-feed backfill** — backfill last 50 from DB on mount (chosen, UX improvement) vs keep Blazor's empty start?
11. **Realtime DTOs in `Shared`** (mirror to TS) vs Api-only hand-author TS (chosen)?
12. **Multiple concurrent dashboards** — confirm broadcast-to-all (no per-user groups) desired.
