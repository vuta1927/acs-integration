# Phase 02 — Frontend: React control-room SPA

## Context Links

- Plan: [./plan.md](./plan.md)
- UI design system: [../../docs/design-guidelines.md](../../docs/design-guidelines.md)
- Contracts + old->new map + parity checklist: [../reports/analysis-260624-1937-blazor-to-dotnet-api-react-migration.md](../reports/analysis-260624-1937-blazor-to-dotnet-api-react-migration.md) (sec 6, 7, 9)
- Depends on: [Phase 01](./phase-01-backend-blazor-to-api.md)

## Overview

- **Priority:** Critical
- **Status:** Pending
- **Description:** Build a small React SPA in `web/` covering the 4 screens to feature parity with the old Blazor UI, in the control-room dark theme. Dev talks to the API via a Vite proxy (no CORS); prod build is served by the API (Phase 03).

## Key Insights

- Keep it simple: hand-written TS types from the DTOs (small surface), a thin `fetch` api client, TanStack Query for server state, one `@microsoft/signalr` connection that patches/invalidates query caches.
- Dev: Vite `server.proxy` forwards `/api` + `/hubs` -> `http://localhost:5180` (the API). No CORS needed. Prod: build into the API's `wwwroot`.
- Theme tokens come straight from `docs/design-guidelines.md` (CSS `:root` + Tailwind extend + shadcn HSL vars). Dark-only.
- Toasts via sonner: error 7s, others 4s (parity). Connection banner replaces the Blazor reconnect modal.
- Export = `web` History toolbar button -> download `GET /api/events/export` with current filters.

## Requirements

**Functional** — parity per analysis sec 9:
- Operations Wall (`/`): PW + Rabbit connection cards, 4 counters, live alarm feed (recent + hub patch), Connect/Disconnect, simulate chips, Rabbit test.
- Event Log (`/history`): paged table + filters, detail sheet (RawJson + forwarded message), **Export JSON** button.
- Rule Matrix (`/mapping`): editable rule grid, Add/Delete, Save (replace-all).
- System Settings (`/config`): tabs PW | Rabbit, masked secret inputs (write-only), Save / Test.

**Non-functional**
- shadcn/ui components; accessible labels; lucide-react icons.
- TanStack Query keys per analysis sec 6; mutations toast + invalidate.

## Related Code Files

**To create**
- `web/` scaffold: `package.json`, `vite.config.ts` (proxy /api + /hubs), `tailwind.config.ts`, `postcss.config.js`, `components.json`, `index.html`, `src/main.tsx`, `src/index.css` (theme tokens), `src/App.tsx`
- `web/src/lib/api.ts` (fetch client), `web/src/lib/types.ts` (DTO types), `web/src/lib/signalr.ts` + `src/hooks/use-bridge-hub.ts`
- `web/src/components/layout/*` (command bar, nav, connection-banner), `src/components/ui/*` (shadcn)
- Pages: `web/src/pages/operations-wall.tsx`, `event-log.tsx`, `rule-matrix.tsx`, `system-settings.tsx`
- Feature components/hooks: dashboard (connection-cards, throughput, simulate-panel, live-feed-table), history (history-table, history-pager, event-detail-sheet, json-block, export-button), mapping (rules-table, rule-row), config (prowatch-form, rabbit-form, secret-input); hooks `use-events`, `use-mapping-rules`, `use-config`, `use-prowatch`, `use-rabbit`, `use-scenarios`, `use-meta`

**To modify** — none (new app).
**To delete** — none.

## Implementation Steps

1. Scaffold Vite react-ts in `web/`; add Tailwind + shadcn init; paste theme tokens from `docs/design-guidelines.md` into `index.css` + `tailwind.config.ts`.
2. Vite proxy `/api` + `/hubs` -> `http://localhost:5180`; run API (Phase 01) + `npm run dev`.
3. `lib/types.ts` (from DTOs), `lib/api.ts` (fetch wrapper incl. `eventsApi.exportUrl(filters)`), `lib/signalr.ts` + `use-bridge-hub` (patch `['status']`, prepend `['events','recent']`).
4. `App.tsx` layout: command bar (global PW/Rabbit health + clock + counters), nav, connection-banner, `<Toaster richColors/>`; router routes.
5. Operations Wall: connection cards, throughput, simulate chips (emit), live feed; connect/disconnect/test mutations + toasts.
6. Event Log: filter bar, paged table, detail sheet (raw + forwarded), `export-button` (download via current filters).
7. Rule Matrix: editable grid, Add/Delete (confirm), Save -> `PUT /api/mapping-rules`.
8. System Settings: tabs + forms + masked secret inputs; Save (PW reconnect) / Save+Test (Rabbit).
9. Walk the parity checklist (analysis sec 9); `npm run build`/typecheck/lint clean.

## Todo List

- [ ] Vite+TS+Tailwind+shadcn scaffold + theme tokens
- [ ] Vite proxy /api + /hubs (no CORS)
- [ ] types.ts + api.ts (incl export url) + signalr hook
- [ ] Layout (command bar + nav + connection-banner + toaster) + router
- [ ] Operations Wall (cards/counters/simulate/live feed + mutations)
- [ ] Event Log (table + filters + detail sheet + Export button)
- [ ] Rule Matrix (editable grid + Add/Delete + Save)
- [ ] System Settings (tabs + forms + secret inputs + Save/Test)
- [ ] Parity walkthrough + build/typecheck/lint

## Success Criteria

- All 4 screens reach parity with the Blazor UI (analysis sec 9 items).
- Live feed + counters update via the hub; emit -> appears.
- Export button downloads JSON matching the active filters.
- Secrets never displayed; blank-on-save keeps existing.
- `npm run build` clean; app runs against the API via Vite proxy.

## Risk Assessment

- **Secret-field UX** (Low) — clear "•••• unchanged" placeholder.
- **Timestamp typing** (Low) — treat `eventDate`/`receivedAt` as strings (ISO); format on display.
- **Theme contrast** (Low) — use the fixed tokens from the design doc (already AA-checked).

## Security Considerations

- No auth. SPA never receives plaintext secrets (masked server-side). No secrets cached in query state.

## Next Steps

- Unblocks Phase 03 (build into the API + containerize).
