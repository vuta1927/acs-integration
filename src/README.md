# Pro-Watch → CCTV SignalR Bridge (test harness)

.NET 10 test harness to integrate with the **Honeywell Pro-Watch (SACS)** access-control system over **SignalR**,
filter alarm events, map them to the **CCTV ICD wire format**, and forward to a VMS via **RabbitMQ AMQP(S)**.

Built from the LTIA ICD + Pro-Watch 6.0 API Service document.
See the build report in `../plans/reports/` for design rationale and open questions.

## Solution layout

```
src/
├─ ProWatchCctvBridge.Shared/      # DTOs + contracts (PwEvent, CctvCommand/wire format, hub names)
├─ ProWatchCctvBridge.Simulator/   # Fake Pro-Watch Event Service (ASP.NET Core SignalR @ /pwevents :5240)
├─ Dockerfile.simulator
├─ Dockerfile.broker
└─ ProWatchCctvBridge.Broker/      # Blazor Server UI :5180 — SignalR client + mapping + RabbitMQ publisher
```

## Pipeline

```
Pro-Watch / Simulator ──SignalR──► Broker ──IsAlarm?──► map rules ──► CCTV alarm message ──AMQP(S)──► RabbitMQ ──► CCTV/VMS
 onProwatchAlarm/Event            persist              non-alarm → Skipped       JSON wire payload        topic exchange
                                  SQLite
```

**Only alarm events** (`IsAlarm=true`) are forwarded. Non-alarm events (AccessGranted, AutoUnlock…) are
logged to history with status `Skipped`.

## CCTV wire payload (ICD contract)

```json
{
  "type":          "alarm",
  "code":          "903",
  "timestamp":     "2025-07-04T16:05:00.000Z",
  "locationId":    "LTH1.3F.ABC.SC.0001",
  "cameraIps":     ["10.4.5.11", "10.4.5.14"],
  "equipmentId":   "ACS.1F.0115",
  "source":        "ACS",
  "severityLevel": 1,
  "message":       "Held door"
}
```

Field mapping from Pro-Watch: `DeviceId` → `equipmentId`, `Location` → `locationId`,
`EventCode` → `code`, `EventDate` → `timestamp`.

---

## Option A — Run locally (.NET 10 SDK required)

```bash
# Terminal 1 — Simulator (Pro-Watch stub)
dotnet run --project ProWatchCctvBridge.Simulator   # http://localhost:5240

# Terminal 2 — Broker UI
dotnet run --project ProWatchCctvBridge.Broker      # http://localhost:5180
```

---

## Option B — Docker Compose (recommended for server deploy)

```bash
# From the repo root (where docker-compose.yml lives)
docker compose up --build -d

# Follow broker logs
docker compose logs -f broker
```

| Service | URL | Credentials |
|---|---|---|
| Broker UI | `http://<host>:5180` | — |
| RabbitMQ management | `http://<host>:15672` | bridge / bridge123 |

### First-run environment variables (applied once, then stored in SQLite)

| Variable | Default in compose | Purpose |
|---|---|---|
| `PROWATCH_BASEURL` | `http://simulator:5240` | Pro-Watch (or simulator) SignalR base URL |
| `RABBITMQ_HOST` | `rabbitmq` | RabbitMQ hostname |
| `RABBITMQ_PORT` | `5672` | AMQP port (5672 plain, 5671 TLS) |
| `RABBITMQ_USER` | `bridge` | AMQP username |
| `RABBITMQ_PASS` | `bridge123` | AMQP password |
| `RABBITMQ_USE_TLS` | `false` | Enable AMQPS (TLS) |
| `ConnectionStrings__Sqlite` | `/data/bridge.db` | SQLite path (inside volume) |
| `DP_KEYS_PATH` | `/data/keys` | Data Protection key ring path (inside volume) |

> Env vars only apply on **first run** (empty DB). After that, config lives in SQLite and is editable via the
> Configuration UI. Delete the `broker-data` Docker volume to force a re-seed from env vars.

### Connect to a real Pro-Watch (no simulator)

In `docker-compose.yml`, remove the `simulator` service and change:
```yaml
PROWATCH_BASEURL: "http://prowatch-server-ip:port"
```

---

## UI pages

| Page | Purpose |
|---|---|
| **Dashboard** | Connection status, throughput counters, live alarm feed, emit simulator scenarios |
| **History** | All received events (alarm + non-alarm) with forwarding outcome + wire payload |
| **Mapping** | Event→CCTV rules: match EventType/Code, set Camera IPs, severity, routing key |
| **Configuration** | Pro-Watch + RabbitMQ settings with test connection buttons |

---

## Default mapping rules (seeded from ICD use cases)

| Scenario | EventCode | Severity | Routing key |
|---|---|---|---|
| door-forced | 900 | 0 Critical | `cctv.alarm.forced` |
| door-held | 903 | 1 Major | `cctv.alarm.held` |
| lost-card | 406 | 1 Major | `cctv.alarm.card` |
| stolen-card | 407 | 1 Major | `cctv.alarm.card` |
| wrong-door | 405 | 2 Minor | `cctv.alarm.card` |
| terminated-card | 410 | 1 Major | `cctv.alarm.card` |
| fire | type=Fire | 0 Critical | `cctv.alarm.fire` |
| access-granted / auto-unlock | — | (non-alarm → Skipped) | — |

`cameraIps` is empty by default — CCTV resolves cameras from `locationId`. Fill in per-rule in the Mapping UI.

---

## AMQPS TLS 1.3 (production)

### Option 1 — Use the bundled RabbitMQ container with TLS

```bash
# Generate test CA + server cert
openssl req -x509 -newkey rsa:2048 -days 365 -nodes \
  -keyout certs/ca.key -out certs/ca.pem -subj "/CN=Test CA"
openssl req -newkey rsa:2048 -nodes \
  -keyout certs/server.key -out certs/server.csr -subj "/CN=rabbitmq"
openssl x509 -req -in certs/server.csr -CA certs/ca.pem -CAkey certs/ca.key \
  -CAcreateserial -days 365 -out certs/server.pem \
  -extfile <(printf "subjectAltName=DNS:rabbitmq,DNS:localhost")
```

Add to `rabbitmq` service in `docker-compose.yml`:
```yaml
volumes:
  - ./certs:/certs:ro
  - ./rabbitmq.conf:/etc/rabbitmq/rabbitmq.conf:ro
```

`rabbitmq.conf`:
```
listeners.ssl.default  = 5671
ssl_options.cacertfile = /certs/ca.pem
ssl_options.certfile   = /certs/server.pem
ssl_options.keyfile    = /certs/server.key
ssl_options.verify     = verify_none
ssl_options.versions.1 = tlsv1.3
```

Change broker env vars: `RABBITMQ_PORT=5671`, `RABBITMQ_USE_TLS=true`.
In the Configuration UI set *CA cert path* = `/certs/ca.pem`.

### Option 2 — External RabbitMQ

Remove the `rabbitmq` service from compose and set env vars to point at your broker.

---

## Connecting to a real Pro-Watch server

The simulator and broker both use **ASP.NET Core SignalR**. The real Pro-Watch 6.0 Event Service uses
**classic ASP.NET SignalR 2.2**, which is wire-incompatible with the .NET Core client.

To target a real server: add a connector built on the legacy `Microsoft.AspNet.SignalR.Client`
(hub `PWEventService`, `state.userName`/`state.wrkstName`, lowercase `subscribe`/`unsubscribe`)
behind the `ProWatchListenerService` seam — the mapping, filtering, and RabbitMQ layers are unchanged.
See the build report for details.
