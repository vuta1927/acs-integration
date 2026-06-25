# Control-Room Design System — Pro-Watch -> CCTV SignalR Bridge (React SPA)

Status: SPEC (implemented in the simplified 3-phase plan: backend = Phase 01, React SPA = Phase 02). Dark-only. No emoji.
> Plan was simplified to 3 phases. Inline refs below to "Phase 04/05/06" map as: Phase 04 (API contracts) -> Phase 01 (backend); Phase 05/06 (React scaffold/pages) -> Phase 02 (frontend).
Target Tailwind/shadcn: **Tailwind v3 + shadcn HSL-triple convention** (Phase 05 ships `tailwind.config.ts` + `postcss.config.js` + `components.json` -> v3, not v4 `@theme`).
Grounding (verified): `Components/Pages/{Dashboard,History,MappingRules,Configuration}.razor`, `Data/Entities.cs`, `Services/Messaging/RabbitMqPublisher.cs`; REST + SignalR + DTO shapes per `plans/reports/analysis-260624-1937-*.md` (sec 4-6) and `plans/.../phase-04-*.md`, `phase-05-*.md`.

---

## 1. Design Philosophy — Control-Room / NOC mindset

This UI lives on large operations-room monitors, viewed from across the room, often unattended until something breaks. Priorities, in order: (1) real-time alarm salience, (2) glanceability, (3) information density, (4) operator control speed. Aesthetics serve those.

Principles (ui-ux-pro-max rule names cited):

- **Dark, calm-until-critical** (`color-not-only`, `contrast-readability`). Base = low-luminance navy `--cr-bg #0B1020`. A calm screen carries almost no saturated color — green "OK" and grey "Skipped" recede. Color spent only where attention must go: Critical alarms (`#EF4444`) and connection loss. Healthy room = visually quiet; a problem = loud. Reduces alarm fatigue; reads from distance.
- **Strong hierarchy** (`visual-hierarchy`). Three tiers: (a) persistent global health (top command bar, always visible), (b) the screen's primary live region (alarm feed / event log), (c) controls + detail. Hero counter 32px, KPI 24px, labels 11px so the eye lands on magnitude first.
- **All data monospaced + tabular** (`number-tabular`). EventId, EventCode, IPs, timestamps, counters, routing keys, JSON render in Fira Code with `font-variant-numeric: tabular-nums`. Ticking counters must not reflow; ID/timestamp columns align vertically. Highest-leverage glanceability decision for an ops table.
- **Status never color-only** (`color-not-only`). Every status (ForwardStatus, connection state, severity, alarm flag) is encoded three ways: color + icon (lucide) + text label. Colorblind operators, glare, and cheap projectors degrade color; icon + label survive.
- **Contrast for distance** (`contrast-readability`). Primary text `#E8EDF7` on `#0B1020` and on panels `#121A2E` exceeds WCAG AAA (sec 9). Larger type, heavier borders, more region whitespace than a desktop admin app — viewer is 2-4m away.
- **Reduced, purposeful motion** (`reduced-motion`). Motion = signal, never decoration. Only three animations: connection "live" pulse, new-alarm row flash, Critical glow — all gated behind `prefers-reduced-motion`. Plus the live clock (information, exempt — sec 5).
- **Dark-only** (decision). No light theme. Control rooms run dimmed 24/7 for monitor longevity + eye comfort; a light mode is unused surface (YAGNI) and doubles contrast QA. Phase 05 ships one `:root`, no toggle.

---

## 2. Foundations / Design Tokens

### 2.1 Color tokens (canonical — use verbatim)

| Token | Hex | Usage |
|---|---|---|
| `--cr-bg` | `#0B1020` | App canvas |
| `--cr-bg-deep` | `#060A16` | Wells, footers, table header bg, code blocks |
| `--cr-panel` | `#121A2E` | Cards, panels, table surface |
| `--cr-panel-raised` | `#16203A` | Modals, sheets, hover, popovers |
| `--cr-border` | `#243049` | 1px dividers, card borders |
| `--cr-border-subtle` | `#1B2540` | Inner/row dividers |
| `--cr-text` | `#E8EDF7` | Primary text, data |
| `--cr-text-muted` | `#94A3B8` | Secondary text + ALL micro/small labels (<14px) |
| `--cr-text-dim` | `#64748B` | Tertiary ONLY at >=14px / weight 500+, on `--cr-bg` only (never on panels, never <14px) |
| `--cr-info` | `#3B82F6` | Links, active nav, "receiving", Pending |
| `--cr-info-hover` | `#60A5FA` | Hover/focus on info elements |
| `--cr-critical` | `#EF4444` | Severity 0, Failed, Disconnected/Error; **also the Critical-badge FILL** |
| `--cr-critical-strong` | `#DC2626` | Critical row left-accent + glow ring ONLY (NOT a text background — see sec 9) |
| `--cr-major` | `#F97316` | Severity 1; persistent-danger toggles (AllowUntrustedRoot) |
| `--cr-minor` | `#EAB308` | Severity 2 |
| `--cr-ok` | `#22C55E` | OK/normal, Published, Connected |
| `--cr-warn` | `#F59E0B` | TRANSIENT states only (Connecting/Reconnecting). Not for persistent danger. |
| `--cr-neutral` | `#64748B` | Skipped, disabled, idle |

### 2.2 Semantic mapping tables

Severity (`MappingRuleRecord.SeverityLevel` 0/1/2; default 1=Major per Entities.cs:59). Primary non-color encoding = **text label + number**; icon shape is secondary reinforcement only.

| Level | Label | Color token | Icon (lucide) |
|---|---|---|---|
| 0 | CRITICAL | `--cr-critical` (badge fill `#EF4444`) | `OctagonAlert` |
| 1 | MAJOR | `--cr-major` | `TriangleAlert` |
| 2 | MINOR | `--cr-minor` | `CircleAlert` |
| — | OK / non-alarm | `--cr-ok` | `Check` / blank |

ForwardStatus (`Data.ForwardStatus` = Pending|Published|Skipped|Failed, Entities.cs:71-77):

| Status | Color | Icon (lucide) | Note |
|---|---|---|---|
| Published | `--cr-ok` | `CircleCheck` | terminal success |
| Skipped | `--cr-neutral` | `CircleSlash` | non-alarm / no rule; quiet |
| Failed | `--cr-critical` | `CircleX` | terminal error; loud |
| Pending | `--cr-info` | `Clock` (STATIC, no spin) | in flight; can persist if Rabbit down -> never spin in tables/feed |

Connection state — aligned to the REAL strings from `Dashboard.razor:172-178` (`StateClass`) + `RabbitMqPublisher.SetRabbitState` (only `Connected`/`Error` emitted; default = idle/disconnected). There is **no "Faulted" and no "Subscribed" state** — `subscribed` is a separate bool on `ConnectionStateDto` (analysis line 136), rendered as its own indicator (sec 6.2), not in this enum.

| State string | Color | Icon (lucide) | Motion |
|---|---|---|---|
| `Connected` | `--cr-ok` | `PlugZap` | live pulse dot |
| `Connecting` | `--cr-warn` | `LoaderCircle` | spin (transient only) |
| `Reconnecting` | `--cr-warn` | `LoaderCircle` | spin (transient only) |
| `Error` | `--cr-critical` | `OctagonAlert` | none (static red) |
| any other (idle / disconnected default) | `--cr-neutral` | `Plug` | none |

Separate `subscribed` boolean indicator: true -> `--cr-info` dot + "Subscribed", false -> `--cr-neutral` + "Not subscribed".

Note: lucide-react renames icons across majors. **Pin a lucide-react version at scaffold and verify each name above against it** (`AlertCircle` was renamed to `CircleAlert`; the spinning loader is `LoaderCircle`). Use canonical current names listed.

### 2.3 CSS `:root` (paste-ready — `web/src/index.css`)

```css
:root {
  /* surfaces */
  --cr-bg:#0B1020; --cr-bg-deep:#060A16;
  --cr-panel:#121A2E; --cr-panel-raised:#16203A;
  --cr-border:#243049; --cr-border-subtle:#1B2540;
  /* text */
  --cr-text:#E8EDF7; --cr-text-muted:#94A3B8; --cr-text-dim:#64748B;
  /* brand/info */
  --cr-info:#3B82F6; --cr-info-hover:#60A5FA;
  /* severity / status */
  --cr-critical:#EF4444; --cr-critical-strong:#DC2626;
  --cr-major:#F97316; --cr-minor:#EAB308; --cr-ok:#22C55E; --cr-warn:#F59E0B; --cr-neutral:#64748B;
  /* radius / borders / fonts */
  --cr-radius-control:8px; --cr-radius-card:12px; --cr-border-w:1px;
  --cr-font-ui:"Fira Sans",system-ui,"Segoe UI",sans-serif;
  --cr-font-mono:"Fira Code",ui-monospace,"Cascadia Code",monospace;
  /* motion */
  --cr-dur-fast:150ms; --cr-dur:220ms; --cr-dur-slow:300ms; --cr-ease:cubic-bezier(.2,.7,.3,1);
}
html,body{background:var(--cr-bg);color:var(--cr-text);font-family:var(--cr-font-ui);}
.font-mono{font-variant-numeric:tabular-nums;} /* every data/numeric element */
```

### 2.4 Tailwind theme extend (`web/tailwind.config.ts`)

```ts
theme: { extend: {
  colors: {
    cr: {
      bg:'#0B1020', 'bg-deep':'#060A16', panel:'#121A2E', 'panel-raised':'#16203A',
      border:'#243049', 'border-subtle':'#1B2540',
      text:'#E8EDF7', muted:'#94A3B8', dim:'#64748B',
      info:'#3B82F6', 'info-hover':'#60A5FA',
      critical:'#EF4444', 'critical-strong':'#DC2626',
      major:'#F97316', minor:'#EAB308', ok:'#22C55E', warn:'#F59E0B', neutral:'#64748B',
    },
  },
  fontFamily: { sans:['Fira Sans','system-ui','sans-serif'], mono:['Fira Code','ui-monospace','monospace'] },
  borderRadius: { control:'8px', card:'12px' },
  fontSize: { micro:['11px',{lineHeight:'1.4'}], '2xs':['12px',{lineHeight:'1.4'}],
    xs:['13px',{lineHeight:'1.4'}], base:['14px',{lineHeight:'1.5'}],
    kpi:['24px',{lineHeight:'1.2'}], hero:['32px',{lineHeight:'1.1'}] },
  keyframes: {
    'cr-pulse':{'0%,100%':{opacity:'1'},'50%':{opacity:'.35'}},
    'cr-flash':{'0%':{backgroundColor:'rgba(239,68,68,.18)'},'100%':{backgroundColor:'transparent'}},
  },
  animation: { 'cr-pulse':'cr-pulse 2s var(--cr-ease) infinite', 'cr-flash':'cr-flash 400ms var(--cr-ease) 1' },
}}
```

### 2.5 shadcn/ui CSS variables — Tailwind v3 HSL-triple format (paste-ready)

shadcn v3 consumes `hsl(var(--x))`; the variable value MUST be an `H S% L%` channel triple (NOT hex — hex yields `hsl(#0B1020)` = invalid -> silently broken theme). Triples below are the exact HSL of the sec-2.1 hexes. This block is authoritative and paste-ready for the Phase 05 (v3) scaffold. If a future scaffold targets Tailwind v4, convert these to `@theme`/OKLCH — but the Phase 05 plan is v3.

```css
:root {
  --background:222 47% 8%;        /* #0B1020 */   --foreground:222 50% 94%;     /* #E8EDF7 */
  --card:223 43% 13%;             /* #121A2E */   --card-foreground:222 50% 94%;
  --popover:222 42% 16%;          /* #16203A */   --popover-foreground:222 50% 94%;
  --primary:217 91% 60%;          /* #3B82F6 */   --primary-foreground:222 47% 8%;  /* #0B1020 */
  --secondary:222 42% 16%;        /* #16203A */   --secondary-foreground:222 50% 94%;
  --muted:222 42% 16%;            /* #16203A */   --muted-foreground:215 20% 65%;   /* #94A3B8 */
  --accent:222 42% 16%;           /* #16203A */   --accent-foreground:222 50% 94%;
  --destructive:0 84% 60%;        /* #EF4444 */   --destructive-foreground:222 47% 8%; /* #0B1020 */
  --border:217 33% 22%;           /* #243049 */   --input:217 33% 22%;
  --ring:217 91% 60%;             /* #3B82F6 */
  --radius:0.5rem;                /* 8px controls; cards override to 12px */
}
```

---

## 3. Typography

Two families only:
- **Fira Sans** — all UI chrome: nav, headings, labels, button text, form labels, prose.
- **Fira Code** — ALL data: EventId, EventType, EventCode, IPs, timestamps, counters, routing keys, exchange, severity numbers, JSON payloads, error strings.

Load — **self-host only** (control-room boxes are often air-gapped; a Google-Fonts `@import` would hang/fail offline and drop to system fonts, defeating the tabular-nums + Fira Code data-alignment thesis). Bundle woff2 under `web/public/fonts` and declare `@font-face` with `font-display:swap`. No CDN fallback line.

```css
/* web/src/index.css — self-hosted, no external @import */
@font-face{font-family:"Fira Sans";src:url("/fonts/FiraSans-Regular.woff2") format("woff2");font-weight:400;font-display:swap;}
@font-face{font-family:"Fira Sans";src:url("/fonts/FiraSans-Medium.woff2") format("woff2");font-weight:500;font-display:swap;}
@font-face{font-family:"Fira Sans";src:url("/fonts/FiraSans-SemiBold.woff2") format("woff2");font-weight:600;font-display:swap;}
@font-face{font-family:"Fira Sans";src:url("/fonts/FiraSans-Bold.woff2") format("woff2");font-weight:700;font-display:swap;}
@font-face{font-family:"Fira Code";src:url("/fonts/FiraCode-Regular.woff2") format("woff2");font-weight:400;font-display:swap;}
@font-face{font-family:"Fira Code";src:url("/fonts/FiraCode-Medium.woff2") format("woff2");font-weight:500;font-display:swap;}
@font-face{font-family:"Fira Code";src:url("/fonts/FiraCode-SemiBold.woff2") format("woff2");font-weight:600;font-display:swap;}
```

Type scale (px) and use:

| px | Token | Use |
|---|---|---|
| 11 | micro | Column micro-labels, badge captions, "since HH:MM:SS" — color `--cr-text-muted` (never `--cr-text-dim`) |
| 12 | 2xs | Table cell secondary, chip text, form hints — `--cr-text-muted` |
| 13 | xs | Dense table body, nav |
| 14 | base | Body, form inputs, default |
| 16 | lg | Panel titles, sheet headings |
| 20 | xl | Section/page headings |
| 24 | kpi | KPI tile value (Received/Forwarded/Skipped) |
| 32 | hero | Hero counter (Total Received), critical alarm count |

Rules:
- Weights: 400 body, 500 emphasis/labels, 600 headings/badges, 700 brand only.
- Line-height: 1.4 dense (tables, feed), 1.5 forms/prose.
- `font-variant-numeric: tabular-nums;` on every numeric/timestamp/counter (global on `.font-mono`, sec 2.3). Prevents counter jitter + column misalignment.
- Mono mandatory for data even inside sans components (e.g. a count badge uses mono).
- `--cr-text-dim` is BANNED under 14px and on panels (contrast — sec 9). All micro/small labels use `--cr-text-muted`.

---

## 4. Spacing, Grid, Elevation, Radius, Iconography, Z-index

Spacing scale (4px base): 2, 4, 8, 12, 16, 20, 24, 32, 48. Panel padding 16-20; card padding 16; table cell 8x12 (denser than Blazor `.35rem .5rem`). Region gaps 16-20.

Grid: 12-col fluid; ops screens use fixed-fraction "wall" grids (sec 7). Dashboard uses full monitor width (no max-width); History/Mapping/Config cap ~1600px for readability.

Elevation (border-driven, NOT shadow):
- L0 canvas `--cr-bg`.
- L1 panel/card: `--cr-panel` + 1px `--cr-border`.
- L2 hover/raised: `--cr-panel-raised` + 1px `--cr-border`.
- L3 modal/sheet/popover: `--cr-panel-raised` + 1px `--cr-border` + optional faint `box-shadow:0 8px 24px rgba(0,0,0,.45)`.
- Glow (Critical only): `box-shadow:0 0 0 1px var(--cr-critical-strong), 0 0 16px rgba(220,38,38,.35)` — used as ring/accent, never as a text background.

Radius: 8px controls (buttons, inputs, badges, chips), 12px cards/sheets/popovers. Borders 1px.

Iconography: lucide-react, single import, stroke-width 1.75, size 16 (inline/badges), 18 (buttons/nav), 20 (KPI tiles/status). `currentColor` so icons inherit semantic color. Never an icon without an adjacent text label except the live-status dot. Canonical names in sec 2.2 (verify vs pinned lucide version).

Z-index: 0 base; 10 sticky table header; 20 top command bar; 30 nav dropdowns/popovers; 40 connection banner strip; 50 sheets/dialogs; 60 toasts (sonner). No higher layer reserved — there is intentionally **no full-bleed flash layer** (it would be ambient motion forbidden by sec 5 and would sit over error toasts; YAGNI).

---

## 5. Motion

Durations: 150ms (hover/press/focus), 220ms (default), 300ms (sheet/dialog enter). Easing `cubic-bezier(.2,.7,.3,1)` (ease-out).

The only three animations:
1. **Status "live" pulse** — 2s opacity 1->.35->1 on the connection dot; green when hub+PW Connected, static red (no pulse) when down. Pulse = "heartbeat present".
2. **New-alarm row flash** — 400ms one-shot critical-tinted bg fade on a newly inserted row. **Constraints (alarm-storm safety):** flash applies ONLY to alarm rows (`isAlarm === true`), NOT every received event (most are non-alarm Skipped); coalesce inserts per animation frame and skip the flash if <300ms since the previous flash, so a burst cannot strobe. Cue for "an alarm just arrived" without continuous motion.
3. **Critical glow** — faint `--cr-critical-strong` ring (sec 4 glow) on the newest Critical/Failed alarm row/card while it is the newest unacknowledged critical (there is no persisted ack field — sec 11; "unacknowledged" = simply "newest critical in view"). Cleared when a newer critical supersedes it or the operator opens its detail.

Live clock (sec 7.1) updates every second — this is **information, not decoration**: explicitly EXEMPT from the no-ambient-motion rule and NOT frozen under reduced-motion (a stopped clock is broken). `tabular-nums` prevents width jitter.

Reduced-motion (mandatory):
```css
@media (prefers-reduced-motion: reduce){
  *{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;}
  .cr-live-dot{animation:none!important;} /* solid color; state still encoded via color+icon+label */
  .cr-clock{animation:none!important;} /* clock text still updates via JS — only CSS anim suppressed */
}
```
Forbidden: spinners as decoration (incl. Pending status — static `Clock` glyph), sliding/parallax panels, animated count-ups on counters (snap instead), hover scale/lift on cards, ambient background motion. Spin is allowed ONLY on the user-initiated test-connection button (sec 6.12) and the transient `Connecting`/`Reconnecting` connection state — both genuinely momentary.

---

## 6. Component Specs (shadcn/ui based)

All build on shadcn primitives + Tailwind `cr-*` tokens. Each: anatomy / states / tokens.

1. **Status pill** — rounded-control, 1px border, [dot]+[icon 16]+[label]. Maps sec 2.2. Tokens: text/border = semantic color, bg = color@12% over panel. Critical adds glow ring. Never color-only (icon+label always).

2. **Connection card** — card (12px), title (Pro-Watch SAC / RabbitMQ), large status pill (sec 2.2 strings), separate "Subscribed" indicator (bool, not a state), "since HH:MM:SS" (mono, muted), error line (`--cr-critical` mono, wraps), action buttons. Feeds: `GET /api/status` (`ConnectionStateDto`) + `connectionStateChanged`.

3. **KPI / counter tile** — micro-label (11px `--cr-text-muted`, uppercase) above value (kpi 24px or hero 32px, mono tabular). Variants: Received (info), Forwarded (ok), Skipped (neutral), Failed (critical, glows when >0). Feeds: `CountersDto` via `countersUpdated`. No count-up. (Sparkline deferred — sec 8.)

4. **Severity badge** — Critical: solid fill `#EF4444` (`--cr-critical`) with `#0B1020` dark text at >=14px/600 (contrast 5.41:1, sec 9); Major/Minor: tinted (color@15% bg, color text). Icon per sec 2.2 + label CRITICAL/MAJOR/MINOR. Mono. `--cr-critical-strong #DC2626` is NOT used as the badge text background (it fails AA — sec 9); it is the row accent/glow only.

5. **ForwardStatus badge** — pill, tint bg, semantic text+icon. Published green, Skipped grey (lowest weight), Failed red, Pending blue with STATIC `Clock` (no spin). Used in feed, event log, detail.

6. **Live-feed row** — dense (32px), cols: time(mono) . type . code(mono) . door . location . alarm-flag . ForwardStatus badge. **Two-phase lifecycle (verified ordering):** `eventReceived` fires at pipeline `:61` BEFORE `eventForwarded` at `:108`, so a new row inserts with `forwardStatus` from `ReceivedEventDto` (initially `Pending`) and gets PATCHED in place when the matching `eventForwarded` (`ForwardedMessageDto.sourceEventId === row.eventId`) arrives. **The Forward column is driven by the event record's single `forwardStatus` field (Entities.cs:23), NOT per-message status** — an event can produce >1 forwarded message (History.razor:92-95 returns a list), so per-message status is 1:N-ambiguous for a single row; `eventForwarded` is used only to know a publish occurred and to trigger the row patch/`invalidateQueries(['events'])`.
   **Severity coloring (data-honest):** `ReceivedEventRecord`/`ReceivedEventDto` have NO `SeverityLevel` — only `priority` (int, PW scale, != 0/1/2) and `isAlarm` (bool). SeverityLevel lives ONLY on `MappingRuleRecord` / the forwarded `CctvCommand`. Therefore rows are colored **binary by `isAlarm`**: alarm rows get a left 3px `--cr-critical` accent bar; non-alarm rows get none. The richer severity color (Critical/Major/Minor) is applied ONLY once a forwarded message exists and its rule severity is surfaced (via `ForwardedMessageDto`/`CctvCommand.severityLevel` if exposed). Critical glow (sec 5) only on rows known-Critical. Cap 50 (matches `recent?take=50`). Feeds: `eventReceived` (insert) + `eventForwarded` (patch).

7. **Dense data table** — shadcn Table; sticky header (`--cr-bg-deep`, z-10), row dividers via `--cr-border-subtle` (no fill zebra — busy on dark), cell 8x12, mono data columns, sortable headers (caret icon). Hover row -> `--cr-panel-raised`. Selected row -> 2px left `--cr-info` bar. Empty/loading/error states required. Keyboard: standard tab-order + a focusable "Details" button per row (Enter opens the detail sheet) — mirrors Blazor's `details` button (History.razor:30). Arrow-key roving-grid navigation is NOT provided by shadcn Table and is explicitly out of scope for v1 (KISS); if desired later, budget it as its own `role="grid"` task.

8. **JSON / payload viewer** — mono block on `--cr-bg-deep`, 12px, 1px border, `overflow:auto`, syntax tint (keys `--cr-info`, strings `--cr-text`, numbers `--cr-minor`, null/bool `--cr-text-muted`). Copy button top-right (`Copy`). Used for `raw` (RawJson) + `payload` (`ForwardedMessageDto.payload`).

9. **Filter bar** — toolbar above tables: shadcn Select (eventType, isAlarm, forwardStatus), date-range popover, search input (`Search`), Reset. Sticky under command bar. Active-filter count badge. Feeds: `GET /api/events` query params (paged+filters per Phase 04).

10. **Form field** — label (13px, 500, above), shadcn Input/Select (bg `--cr-bg-deep`, 1px `--cr-border`, focus ring `--cr-info`), hint (12px muted), error (12px critical). Booleans (Enabled, UseTls, AutoConnect) = shadcn Switch — more glanceable on a wall than checkboxes.

11. **Masked secret input** — secrets are MASKED on GET as **empty string** (Phase 04 line 19/141: GET returns null/empty, PUT `MergeSecret` treats blank = keep). Input renders empty with placeholder `••••••••` + helper "Leave blank to keep current". Dirty flag set ONLY on a real keystroke; **never round-trip a mask sentinel** (no `********` is ever placed in the value, so Save cannot overwrite a credential with a mask). Show/hide toggle (`Eye`/`EyeOff`). On change -> field included in PUT. Fields: `accessToken`, `password`, `clientCertPassword`.

12. **Test-connection button** — idle ("Test connection"), testing (disabled + `LoaderCircle` spin + "Testing..."), success (inline `--cr-ok` pill `Check` "Connection OK" 4s), error (inline `--cr-critical` pill `X` + error, persists until retry). Backed by `POST /api/config/rabbit/test` -> `TestResultDto(success, error?)`. `aria-busy` while testing.

13. **Toast (sonner)** — bottom-right, dark `--cr-panel-raised`, 1px semantic left border + icon. Durations: error 7000ms, others 4000ms (verified Blazor parity). Variants info/success/warning/error -> info/ok/warn/critical. Mono for embedded data. `<Toaster richColors theme="dark" position="bottom-right" />`.

14. **Connection banner** — thin full-width strip (z-40) under command bar, shown ONLY when the SignalR hub drops (replaces Blazor reconnect modal). `--cr-critical` bg@15%, 1px critical border, `Plug` icon + "Reconnecting to live feed..." + `LoaderCircle` spin; auto-dismiss on `onreconnected` (then refetch `/api/status` + `/api/events/recent`). Non-blocking (operator keeps reading last-known data). Hard fail -> "Live feed lost — retry" button.

15. **Top command/status bar** — see sec 7.1.

16. **Navigation** — see sec 7.2.

---

## 7. Layout System

### 7.1 Persistent top command/status bar (z-20, always visible)

```
[ PW->CCTV BRIDGE ] | PW *Connected | RMQ *Connected || RX 1,284  FWD 1,190  SKP 80  FAIL 14 || 14:22:07
```
Left: brand. Center-left: global PW + RabbitMQ status pills (compact, sec 2.2 strings). Center-right: four inline counters (mono tabular, from `CountersDto`). Right: live clock (mono tabular, ticking — exempt motion, sec 5). FAIL turns `--cr-critical` + glows when >0. Single always-on health summary readable across the room. Feeds: `GET /api/status` + `connectionStateChanged` + `countersUpdated`.

### 7.2 Navigation

Top nav (horizontal, under/within command bar): Dashboard . History . Mapping . Configuration (react-router NavLink). Active = `--cr-info` text + 2px bottom border (preserves Blazor pattern). Each item lucide icon + label. 4 items -> no collapse needed.

### 7.3 Responsive panel grid ("video wall" density)

| Breakpoint | Target | Dashboard grid | Tables |
|---|---|---|---|
| 1280 | small ops monitor | 2-col cards; feed full-width below | full width |
| 1440 | standard | 3-col status/KPI; feed full-width | full width |
| 1920 | FHD wall | 4-col status/KPI; feed + side detail | 2-pane (table + detail) |
| 2560 | QHD wall | wider gutters; feed + scenarios + KPIs side-by-side; larger hero counters | 2-pane, more rows visible |

Content priority (survives shrinking, in order): live alarm feed/event log -> global health bar -> KPIs -> controls/forms -> detail panels (move to sheet at <1440). Dashboard full monitor width; forms/tables cap ~1600px.

---

## 8. Charts (Recharts / shadcn charts) — DEFERRED to post-v1

Charts are supporting, not primary; the feed + counters are primary. **The current REST surface exposes no durable time-series**: `/api/events` is paged and `CountersDto` is cumulative (analysis sec 4). A client-side-derived chart would be empty on every reload (a NOC monitor rebooted at 03:00 shows blank charts) — unacceptable for a wall display. **Decision (KISS/YAGNI): ship real counters for v1; defer all charts** until a lightweight server time-bucket endpoint (events-per-minute) is added to the contract. When added, the spec is:

1. Event-rate streaming area — events/min, area fill `--cr-info`@15%, line `--cr-info`; optional stacked by severity.
2. Severity distribution — donut/bar Critical/Major/Minor (+Published/Failed); severity tokens; always paired with mono legend + counts (never color-only).
3. KPI sparklines — 40px trailing trend under each counter tile, semantic stroke, no axes.

Rules when built: mono tabular numeric labels; color repeated in legend with icon + count (never color-only); Pause control on streaming chart; reduced-motion -> `isAnimationActive={false}`; explicit empty + loading states; tooltip on `--cr-panel-raised`.

---

## 9. Accessibility

Contrast — recomputed with a real WCAG calc (sRGB relative luminance, ratio = (L1+.05)/(L2+.05)) against BOTH backgrounds where a token is used. Thresholds: AA normal 4.5 (<18.66px or <14px-bold), AA large 3.0 (>=18.66px or >=14px-bold).

| Pair | Ratio | Verdict |
|---|---|---|
| `--cr-text` #E8EDF7 on `--cr-bg` #0B1020 | 15.7:1 | AAA |
| `--cr-text` on `--cr-panel` #121A2E | 14.3:1 | AAA |
| `--cr-text-muted` #94A3B8 on #0B1020 | 6.8:1 | AAA |
| `--cr-text-muted` on `--cr-panel` #121A2E | 6.2:1 | AA/AAA — OK for micro labels |
| `--cr-text-dim` #64748B on #0B1020 | 4.0:1 | AA-large ONLY -> restrict to >=14px/500, canvas only |
| `--cr-text-dim` on `--cr-panel` #121A2E | 3.3:1 | FAILS AA -> **BANNED on panels** (use `--cr-text-muted`) |
| `--cr-info` #3B82F6 text on #0B1020 | 4.6:1 | AA (prefer >=14px + icon) |
| `--cr-info` on `--cr-panel` #121A2E | 4.6:1 | AA |
| `--cr-ok` #22C55E on #0B1020 | 8.4:1 | AAA |
| `--cr-ok` on `--cr-panel` #121A2E | 7.6:1 | AAA |
| `--cr-critical` #EF4444 on #0B1020 | 5.4:1 | AA |
| `--cr-critical` on `--cr-panel` #121A2E | 4.9:1 | AA |
| `--cr-major` #F97316 on #121A2E | 5.9:1 | AA |
| `--cr-minor` #EAB308 on #121A2E | 8.1:1 | AAA |
| **Critical badge: #0B1020 text on #EF4444 fill** | 5.4:1 | AA (badge uses `--cr-critical` fill, NOT `#DC2626`) |
| ~~#0B1020 on #DC2626 fill~~ | 3.9:1 | FAILS AA -> **not used for badge text bg** (was a wrong "5.6" in the draft) |
| shadcn `--primary-foreground` #0B1020 on `--primary` #3B82F6 | 5.0:1 | AA |
| shadcn `--destructive-foreground` #0B1020 on `--destructive` #EF4444 | 5.4:1 | AA |
| `--ring` #3B82F6 vs `--cr-bg` #0B1020 (non-text 3:1) | 5.0:1 | passes |

Two corrections vs draft, applied in tokens (not just prose): (1) the Critical badge fill is `--cr-critical #EF4444` (5.4:1) — `--cr-critical-strong #DC2626` (3.9:1) is demoted to row-accent/glow only (sec 2.1, 4, 6.4); (2) `--cr-text-dim` is BANNED on panels and under 14px — all micro/small labels use `--cr-text-muted` (sec 2.1, 3, 6.3).

Colorblind safety: every status carries icon + text label (sec 2.2). Primary non-color severity encoding = the **text label (CRITICAL/MAJOR/MINOR) + number (0/1/2)**; icon shape (octagon/triangle/circle) is a secondary cue only (not a universally learned ordering — not relied upon). Charts (when built) repeat color in a mono legend with counts.

Focus / keyboard: visible focus ring = 2px `--cr-info` offset 2px on all interactive elements (Radix focus-visible). Path: nav (Tab), tables (tab to row Details button -> Enter opens sheet), filter bar, forms, dialogs (Esc close, focus trap). Async buttons set `aria-busy`.

Large-screen legibility: min 13px data / 14px UI; interactive targets >=32px tall.

Timezone: DTO timestamps are ISO-8601 **UTC** (analysis line 85; TS must never blind-`new Date()` for display logic without intent). **Policy: render all timestamps (command-bar clock, feed, log, detail, "since") in browser-local time with a small tz suffix** (e.g. `14:22:07 +07`) so operators reason about "when" consistently; format once in a shared `formatTs()` util. (Blazor used `.LocalDateTime` — Dashboard.razor:20,62; History.razor:23.)

---

## 10. Per-Screen Redesign Specs

Full parity with the four Blazor pages. Each: ASCII wireframe, regions->components (sec 6), feeds (REST + SignalR).

### 10.1 Dashboard `/` — "Operations Wall"

```
+---------------------------------- TOP COMMAND BAR (sec 7.1) ------------------------------------+
| PW->CCTV BRIDGE | PW *Connected  RMQ *Connected || RX 1,284 FWD 1,190 SKP 80 FAIL 14 || 14:22:07|
+---------------------------------- NAV: [Dashboard] History Mapping Configuration ---------------+
| (connection banner strip appears here only if hub drops) sec 6.14                               |
+------------------+------------------+--------------------------------------------------------------+
| CONN CARD: PW    | CONN CARD: RMQ   |  KPI TILES (4)                                              |
| *Connected       | *Connected       |  [RX 1,284] [FWD 1,190] [SKP 80] [FAIL 14 (glow if >0)]     |
| Subscribed:true  | (error line)     |                                                            |
| since 09:14:02   | [Test connection]|                                                            |
| [Connect][Disc.] |                  |                                                            |
+------------------+------------------+--------------------------------------------------------------+
| SIMULATE: (access-granted)(door-forced)(door-held)(lost-card)(stolen-card)(fire)...  chips       |
+-------------------------------------------------------------------------------------------------+
| LIVE FEED — last 50   (newest top; alarm rows left-accented; new ALARM row flashes; cap 50)      |
| TIME      TYPE         CODE   DOOR  LOCATION       ALARM   FORWARD                                |
| 14:22:07  DoorForced   2201   D-14  North Gate    ALARM   Published                              |
| 14:21:55  AccessGrant  1100   D-03  Lobby                 Skipped                                |
| ...                                                                                             |
+-------------------------------------------------------------------------------------------------+
```

Regions -> components:
- Command bar (sec 7.1) — global PW/RMQ pills, counters, clock.
- 2x Connection card (sec 6.2): Pro-Watch (Connect/Disconnect, busy-disable), RabbitMQ (Test connection). Parity: Dashboard.razor:16-35.
- 4x KPI tile (sec 6.3) — Received/Forwarded/Skipped/Failed. Parity: :37-41.
- Simulate chip row — dynamic scenarios from API (`GET /api/simulator/scenarios`), graceful when simulator offline (`[]`). Parity: :44-52,:160-170.
- Live feed (sec 6.6), cap 50. Parity: :54-73.

Feeds: `GET /api/status`, `GET /api/events/recent?take=50`, `GET /api/simulator/scenarios`; SignalR `connectionStateChanged`, `countersUpdated`, `eventReceived`, `eventForwarded`. Actions: `POST /api/prowatch/connect|disconnect`, `POST /api/config/rabbit/test`, `POST /api/simulator/emit/{key}`.

### 10.2 History `/history` — "Event Log"

```
+- COMMAND BAR -+ NAV: Dashboard [History] Mapping Configuration +--------------------------------+
+-------------------------------- FILTER BAR (sec 6.9) -------------------------------------------+
| [Search...] [EventType v] [IsAlarm v] [ForwardStatus v] [From [] To []] [Reset] 1,284 rows [Export]|
+--------------------------------------------------------+----------------------------------------+
| EVENT LOG TABLE (sec 6.7, dense, sticky header)        | DETAIL SHEET (sec 6.8) — row select    |
| RECEIVED            TYPE       CODE DOOR LOC ALRM FWD   | Event ID: 8f12-... (mono)              |
| 2026-06-24 14:22:07 DoorForced 2201 D14  NG  *   Pub   | -- Raw JSON -------- [copy]            |
| 2026-06-24 14:21:55 AccessGr.. 1100 D03  Lb      Skp   | { "eventId": "...", ... }              |
| ...                                                    | -- Forwarded messages -----            |
|                                                        | Published  cctv.alarm / cctv.x         |
| [<< Newer]  Page 3  [Older >>]   25/page               | { "type":"...", "cameraIps":... }      |
+--------------------------------------------------------+----------------------------------------+
```

Regions -> components:
- Filter bar (sec 6.9): search, eventType, isAlarm, forwardStatus, date-range (Phase 04 server filters; superset of Blazor — preserves Refresh + paging).
- Export button (filter-bar toolbar, right; lucide `Download` icon, info-accent outline): "Export JSON" -> `GET /api/events/export` with the CURRENT filters (no paging) -> browser download `acs-events-<ts>.json`. Payload = ACS-received fields + `raw` only (NO forward outcome columns). Brief "preparing export" toast. NEW feature beyond Blazor parity.
- Event log table (sec 6.7) — ALL events (alarm + non-alarm). Parity: History.razor:17-35; cols Received/Type/Code/Door/Location/Alarm/Forward + Details button.
- Pager: << Newer / Page N / Older >> using real `totalCount`/`hasMore` (`PagedResult`) — fixes the Blazor full-last-page bug (History.razor:14 disabled "Older" on `count < PageSize`, leaving "Older" enabled after an exactly-full 25-row page -> empty next page). Parity: :10-15,:70-95.
- Detail sheet (shadcn Sheet + sec 6.8 viewer): `raw` (RawJson) + each `ForwardedMessageDto` (status badge, exchange/routingKey mono, error, payload). Parity: :37-54.

Feeds: `GET /api/events` (paged+filters), `GET /api/events/{id}` (detail+raw), `GET /api/events/{eventId}/forwarded`, `GET /api/events/export` (JSON file, current filters, ACS fields + raw only). No live patching (refetch on demand).
Density: 25/page on 1280; auto-raise visible rows on 1920/2560. Detail = side-pane on >=1920, sheet overlay below.

### 10.3 Mapping `/mapping` — "Rule Matrix"

```
+- COMMAND BAR -+ NAV: Dashboard History [Mapping] Configuration +-----------------------------------+
| Event -> CCTV mapping rules. Alarm-only. Top-down by Order; first match wins. Empty = wildcard.  |
+-------------------------------------------------------------------------------------------------+
| ORD NAME            ON  MATCH-TYPE   MATCH-CODE  CAMERA IPS              SEV         ROUTING    X |
| 10  Door forced     [#] DoorForced   (any)       10.4.5.11,10.4.5.14    [0 Crit v]  cctv.alarm X |
| 20  Fire alarm      [#] Fire         (any)       (VMS resolves)         [0 Crit v]  cctv.fire  X |
| 30  Lost card       [ ] AccessDenied 4xx         10.4.5.20              [1 Major v] cctv.alarm X |
| ...                                                                                             |
| [+ Add rule]                                          [Save rules]  (replace-all)               |
+-------------------------------------------------------------------------------------------------+
```

Regions -> components:
- Explainer line (muted) — parity MappingRules.razor:8.
- Editable rule grid (sec 6.7 table + inline sec 6.10 fields): Order (number, narrow mono), Name (text), Enabled (Switch), MatchEventType (text, "any" placeholder), MatchEventCode (text), CameraIps (wide text, IP placeholder), SeverityLevel (Select 0/1/2 with severity color swatch sec 2.2; default 1=Major per Entities.cs:59), RoutingKey (text mono), delete (danger `Trash2` icon). Parity: :10-46.
- Footer: Add rule, Save rules (busy "Saving..."). Replace-all. Parity: :48-51,:91-123. Unsaved edits -> dirty indicator + warn-on-navigate (small UX win over Blazor which silently lost edits).

Feeds: `GET /api/mapping-rules`, `PUT /api/mapping-rules` (bulk replace-all). Severity Select uses severity tokens so a row's criticality is glanceable.

### 10.4 Configuration `/config` — "System Settings"

```
+- COMMAND BAR -+ NAV: Dashboard History Mapping [Configuration] +---------------------------------+
+---- TABS:  [ Pro-Watch (SAC) ]   RabbitMQ (CCTV/AMQPS) -----------------------------------------+
| PRO-WATCH                                       |  (RabbitMQ tab content when selected)         |
| Base URL      [____________________]            |  [x]Enabled                                   |
| Hub path      [____________________]            |  Host [____]  Port [5671]                     |
| Access token  [........] (eye)  keep-blank      |  VHost[____]  User [____]                      |
| User name     [____________________]            |  Password [........] (eye)                     |
| Workstation   [____________________]            |  [x]Use TLS  TLS ver [Tls13]                  |
| [x] Auto-connect on startup                     |  Server name [____] CA cert [____]            |
| [Save & reconnect]                              |  Client cert(.pfx)[__] Pwd[......](eye)        |
|                                                 |  [!]Allow untrusted root (TEST ONLY)          |
|                                                 |  Exchange[__] Type[topic] Routing[cctv.*]     |
|                                                 |  [Save]  [Test connection]  OK / err          |
+-------------------------------------------------+-----------------------------------------------+
```

Regions -> components:
- Tabs (shadcn Tabs): Pro-Watch | RabbitMQ (replaces side-by-side cards — fits ops monitor, less scroll). Parity covers Configuration.razor:10-47.
- Pro-Watch form (sec 6.10 + 6.11 masked accessToken): baseUrl, hubPath, accessToken (masked), userName, workstationName, autoConnect (Switch), reconnectSeconds, Save & reconnect. DTO: `ProWatchConfigDto` (analysis line 128). Parity: :11-22.
- RabbitMQ form: enabled (Switch), hostName, port, virtualHost, userName, password (masked), useTls (Switch), tlsVersion, serverName, caCertPath, clientCertPath, clientCertPassword (masked), allowUntrustedRoot (Switch), exchange, exchangeType, defaultRoutingKey, Save, Test connection (sec 6.12 inline). DTO: `RabbitConfigDto` (line 129). Parity: :24-46.
- Masked secrets (sec 6.11): accessToken, password, clientCertPassword — empty-on-GET, write-only-on-change.
- `allowUntrustedRoot`: persistent security-danger toggle rendered with `--cr-major #F97316` caution treatment + `TriangleAlert` icon + "TEST ONLY" — distinct from `--cr-warn` (which is reserved for transient connection states only, sec 2.1).

Feeds: `GET/PUT /api/config/prowatch`, `GET/PUT /api/config/rabbit` (masked GET), `POST /api/config/rabbit/test`. Save -> toast (sec 6.13); Test -> inline pill (sec 6.12).

---

## 11. Implementation Notes (Phase 05 / 06)

Phase 05 scaffold order:
1. Self-host fonts: bundle Fira Sans/Code woff2 under `web/public/fonts` + `@font-face` (sec 3). No CDN.
2. `web/src/index.css`: paste `:root` control-room tokens (sec 2.3) + shadcn HSL-triple vars (sec 2.5) + reduced-motion block (sec 5) + `.font-mono{font-variant-numeric:tabular-nums}`.
3. `web/tailwind.config.ts`: paste `theme.extend` (sec 2.4) — `cr.*` colors, fonts, radii, fontSizes, keyframes/animation.
4. shadcn init dark; do NOT generate a light block. Card radius 12px, controls 8px. `--ring` = info.
5. Build shared primitives first: StatusPill, KpiTile, SeverityBadge, ForwardStatusBadge, JsonViewer, CommandBar, ConnectionBanner, live-dot, masked-secret input, test-connection button. Reused by all four pages in Phase 06.
6. sonner `<Toaster richColors theme="dark" position="bottom-right" />`; default 4000, error 7000.
7. Phase 06: pages in parity order Dashboard -> History -> Mapping -> Config, consuming sec 6 components + the per-screen REST/SignalR feeds.

Token single source of truth: hexes live once in `tailwind.config.ts` (`cr.*`) AND `:root` CSS vars (sec 2.3); shadcn vars (sec 2.5) are the SAME colors as HSL triples (v3 requirement). Components use `cr-*` Tailwind utilities (preferred) or `var(--cr-*)` for dynamic/computed cases (e.g. inline severity color). Keep the three blocks in sync.

No persisted "acknowledge": there is no ack field in the data model (Entities.cs). Critical-glow "until superseded" = simply "newest critical in view" (sec 5). YAGNI for v1 — do not add an ack column.

---

## 12. Parity Guardrail — every existing feature preserved

- **Dashboard:** PW Connect/Disconnect; PW status (real strings) + Subscribed bool + "since" + error; RabbitMQ Test connection + status + error; 4 counters (Received/Forwarded/Skipped/Failed); simulate chips (dynamic, graceful offline); live feed newest-first cap 50; busy-disable during async; toasts (info/success/warning/error).
- **History:** paged table of all events (alarm + non-alarm); cols Received/Type/Code/Door/Location/Alarm/Forward; Refresh; Newer/Older paging; row->detail (raw + each forwarded message: status, exchange/routingKey, error, payload). Adds: real `totalCount`/`hasMore` + filters (superset; nothing removed).
- **Mapping:** ordered editable grid — Order, Name, Enabled, MatchEventType, MatchEventCode, CameraIps, SeverityLevel(0/1/2), RoutingKey; Add; delete row; Save = replace-all; explainer text; save busy state.
- **Configuration:** Pro-Watch form (baseUrl, hubPath, accessToken, userName, workstationName, autoConnect, reconnectSeconds, Save & reconnect); RabbitMQ form (enabled, hostName, port, virtualHost, userName, password, useTls, tlsVersion, serverName, caCertPath, clientCertPath, clientCertPassword, allowUntrustedRoot, exchange, exchangeType, defaultRoutingKey, Save, Test connection). Secrets masked (empty-on-GET) + write-only-on-change.
- **Cross-cutting:** nav (Dashboard/History/Mapping/Configuration) active state; toast durations (error 7s / others 4s); connection-drop feedback (Blazor reconnect modal -> thin non-blocking banner); global health in persistent command bar (additive).

---

## Unresolved Questions

1. Severity color for non-forwarded rows confirmed as `isAlarm`-binary accent (+ ForwardStatus); rich Critical/Major/Minor only after a forwarded message surfaces its rule severity. Confirm whether `ForwardedMessageDto`/`CctvCommand` will expose `severityLevel` to the SPA so the feed can upgrade accent color post-forward (sec 6.6).
2. `priority` (PW int scale, on `ReceivedEventDto`) is currently NOT surfaced in any screen (parity gap — Blazor also did not show it). Decide: add to the detail sheet (sec 10.2) or document as intentionally omitted (YAGNI).
3. Exact `GET /api/events` filter param names/shape (Phase 04 says "filters" — finalize before building the sec 6.9 filter bar).
4. Lucide-react version to pin (sec 2.2 names verified against current canonical, but a different installed major may alias/break — confirm at scaffold).
5. Charts (sec 8) deferred pending an events-per-minute time-bucket endpoint — confirm that's acceptable for v1 (recommended).
6. Timezone display policy: spec sets browser-local + tz suffix (sec 9) — confirm vs a fixed ops timezone preference.
