# Phase 03 — Docker + smoke test

## Context Links

- Plan: [./plan.md](./plan.md)
- Current infra: `docker-compose.yml`, `src/Dockerfile.broker`, `src/Dockerfile.simulator`
- Depends on: [Phase 01](./phase-01-backend-blazor-to-api.md), [Phase 02](./phase-02-react-control-room-spa.md)

## Overview

- **Priority:** Important
- **Status:** Pending
- **Description:** Package the single API-that-serves-the-SPA into one image, update compose, and verify end-to-end with a simple manual smoke test. No nginx, no extra web service.

## Key Insights

- One image: multi-stage build = (a) node builds the React app, (b) .NET builds/publishes the Broker, copy the React `dist` into the published `wwwroot`, run. API serves UI + `/api` + `/hubs` on one port.
- Reuse the existing `broker-data` volume -> DataProtection keys + `bridge.db` survive (secrets keep decrypting). Keep port 5180.
- `simulator` + `rabbitmq` services unchanged.
- SignalR is same-origin (served by the API) -> no proxy/WS-upgrade config needed.

## Requirements

**Functional**
- `docker compose up --build` brings up `broker` (UI+API :5180), `simulator` (:5240), `rabbitmq`.
- The UI loads at `http://localhost:5180`, talks to its own `/api` + `/hubs`.

**Non-functional**
- Image builds reproducibly; existing env vars (`PROWATCH_BASEURL`, `RABBITMQ_*`, `ConnectionStrings__Sqlite`, `DP_KEYS_PATH`) still apply.

## Related Code Files

**To modify**
- `src/Dockerfile.broker` — add a node build stage for `web/`, copy `web/dist` into the published app `wwwroot`, keep the .NET runtime stage (expose 5180).
- `docker-compose.yml` — `broker` service builds the updated Dockerfile; keep ports/volumes/env; no web/nginx service added.

**To create**
- (optional) `tests/` minimal xUnit project with 2 tests: mapping replace-all persists; export returns filtered set. Keep tiny.

**To delete** — none.

## Implementation Steps

1. Update `src/Dockerfile.broker`: stage 1 `node:lts` -> `npm ci && npm run build` in `web/`; stage 2 `dotnet sdk` -> `dotnet publish` Broker; copy `web/dist/*` into `/app/wwwroot`; stage 3 `aspnet` runtime.
2. Build the image; run `docker compose up --build -d`.
3. Smoke test (manual checklist below).
4. (Optional) add the 2 minimal tests; `dotnet test`.

## Todo List

- [ ] Multi-stage Dockerfile.broker (node build -> dotnet publish -> wwwroot)
- [ ] docker-compose updated (broker UI+API :5180, reuse broker-data)
- [ ] `docker compose up --build` green; healthchecks ok
- [ ] Smoke checklist passes
- [ ] (optional) 2 minimal tests

## Smoke Test Checklist

- [ ] UI loads at `:5180`; nav between all 4 screens
- [ ] Operations Wall: PW + Rabbit show connected; counters present
- [ ] Connect/Disconnect toggles PW state live (hub)
- [ ] Emit simulate chip -> event appears in live feed + counters bump
- [ ] Event Log: paging + Refresh; open a row -> RawJson + forwarded payload
- [ ] Export JSON downloads a file matching current filters
- [ ] Rule Matrix: edit + Save persists; next emitted alarm uses new rule
- [ ] System Settings: save PW (reconnect) + Rabbit test returns result; secrets stay masked
- [ ] Restart container -> persisted config + secrets still work (DP keys reused)

## Success Criteria

- Single `docker compose up --build` yields a working UI+API + simulator + rabbitmq.
- All smoke checklist items pass.
- Secrets persist across restart (volume reuse).

## Risk Assessment

- **Dockerfile node+dotnet multi-stage glitches** (Med) — pin base images; verify `wwwroot` copy path matches publish output.
- **DP key loss if volume not reused** (Med) — keep `broker-data`; verify Rabbit auth after restart.
- **`aspnet` image lacks curl for healthcheck** (Low) — reuse simulator's pattern or switch to `wget`.

## Security Considerations

- No auth (internal). Secrets DP-encrypted at rest on the reused volume; never logged.

## Next Steps

- Migration complete: Blazor fully replaced by API+SPA. Update `docs/` (codebase-summary, system-architecture) if kept.
