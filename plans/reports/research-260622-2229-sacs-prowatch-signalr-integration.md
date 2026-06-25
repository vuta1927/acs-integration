# Báo cáo nghiên cứu: Tích hợp hệ thống SACS (Honeywell Pro-Watch) qua SignalR

**Ngày thực hiện:** 2026-06-22 22:29 (Asia/Saigon)
**Nguồn:** Phân tích 2 tài liệu cục bộ (không dùng web). Tài liệu là nguồn có thẩm quyền duy nhất.
- `ICD SACS Prowatch - LTIA ver01.pdf` (33 trang) — Interface Control Document, Long Thanh Int'l Airport (LTIA).
- `Pro-Watch_6.0_API_Service.pdf` (151 trang) — API reference của nhà sản xuất. **Lưu ý:** title nội bộ file = `Pro-Watch_55_API_Service_Updated` → đây là tài liệu gốc đời 5.5 đóng gói lại thành 6.0.

> Quy ước: prose tiếng Việt, thuật ngữ kỹ thuật / endpoint / field / code giữ nguyên tiếng Anh.

---

## Mục lục
1. [Executive Summary](#1-executive-summary)
2. [Kiến trúc tích hợp tổng thể](#2-kiến-trúc-tích-hợp-tổng-thể)
3. [SignalR — phần lõi](#3-signalr--phần-lõi)
4. [Event Service (real-time events/alarms)](#4-event-service)
5. [Data Service (data change qua SignalR)](#5-data-service)
6. [REST API bổ trợ (door control + alarm disposition)](#6-rest-api-bổ-trợ)
7. [Mô hình dữ liệu & EventCode](#7-mô-hình-dữ-liệu--eventcode)
8. [Bảo mật & Non-functional](#8-bảo-mật--non-functional)
9. [Khuyến nghị triển khai IB-side](#9-khuyến-nghị-triển-khai-ib-side)
10. [Phát hiện quan trọng & cạm bẫy](#10-phát-hiện-quan-trọng--cạm-bẫy)
11. [Câu hỏi chưa giải quyết](#11-câu-hỏi-chưa-giải-quyết)

---

## 1. Executive Summary

SACS tại LTIA = **Honeywell Pro-Watch Access Control System (ACS)**. ACS không nối trực tiếp với hệ thống khác mà đi qua **Integration Broker (IB)** — middleware chuẩn hóa (JSON/XML), định tuyến, kiểm soát API, phân phối tới CCTV/FAS/BMS/HR/BHS/AMS...

ACS phơi ra 2 kênh tích hợp:
- **REST/JSON API** — query & lệnh on-demand (GET/POST/PUT): lấy alarm, mở/khóa cửa, ack alarm.
- **SignalR Realtime** — ACS *push* sự kiện access/alarm tới IB tức thời (Door Forced Open, Door Held, Access Denied/Granted, System Alarm, Fire...).

**Phát hiện then chốt (BẮT BUỘC làm rõ với Honeywell trước khi code):** spec SignalR trong ICD **không khớp** spec thực tế trong tài liệu API:
- ICD vẽ kiểu **ASP.NET Core SignalR** (`signalR.HubConnectionBuilder().withUrl(...?access_token=)`, hub `eventhub`).
- API doc mô tả **classic ASP.NET SignalR 2.2** (`$.hubConnection("…/pwevents")`, hub `PWEventService`, auth bằng `state.userName`/`state.wrkstName`, không có bearer token query).
- Hai stack này **khác nhau về thư viện client, handshake (`/negotiate`), transport và mô hình auth** → không thể đổi lẫn. (Chi tiết §3, §10.)

Khuyến nghị: IB nên là một **SignalR client** ổn định (có auto-reconnect + replay-gap recovery qua REST), tách riêng adapter để cô lập rủi ro stack chưa chốt. Door-control vẫn dùng REST (`POST /pwapi/logdevs/{logdev}/unlock|lock|momentaryunlock`).

---

## 2. Kiến trúc tích hợp tổng thể

```
                 SignalR push (events/alarms, real-time)
   ┌──────────────┐  ───────────────────────────────►  ┌──────────────┐  ──►  CCTV / VMS
   │  Pro-Watch   │                                     │  Integration │  ──►  FAS (Fire)
   │  ACS (SACS)  │  ◄───────────────────────────────   │  Broker (IB) │  ──►  BMS / HBMS
   │              │   REST: door open/lock, ack alarm    │              │  ──►  HR / ERP
   │  EV_LOG      │  ◄──────── REST GET /alarms ───────  │  normalize + │  ──►  BHS, AMS, BDRM
   └──────────────┘   (poll/backfill, verify command)    │  route       │  ──►  ...
        ▲  ▲                                             └──────────────┘
        │  └─ Controllers / Readers / Door contacts            ▲
        └──── SQL (PWNT) ── Data Service SignalR (audit) ──────┘
```

- **ACS = source of truth** cho access events + door status; phơi REST/JSON/XML.
- **IB = middleware duy nhất**: nhận event ACS → chuẩn hóa schema chung → route. Đồng thời chuyển lệnh ngược (vd emergency door release) từ hệ khác xuống ACS.
- **Other systems KHÔNG nói chuyện trực tiếp ACS** — chỉ qua IB; mỗi kết nối có ICD riêng.

**Phân chia trách nhiệm (ICD §IV.3):** SACS Contractor: mô tả interface ACS↔IB, cấu hình hardware, truyền access events. IB Contractor: đồng bộ user, gửi door-control commands, tích hợp các hệ khác.

**Luồng nghiệp vụ chính (ICD §6.2):**
- *Entry hợp lệ* → ACS push JSON event (employee code, time, location, action in/out) → IB chuẩn hóa → AMS/HR/BHS.
- *Security breach* (card lost/stolen, after-hours, forced) → ACS đánh dấu warning → push qua SignalR → IB → CCTV liveview + record (30s trước, ≥10 phút sau), AMS.
- *Reverse control* → hệ khác gửi lệnh đóng/mở/lock → IB → REST xuống ACS → ACS thực thi + log.

---

## 3. SignalR — phần lõi

### 3.1 Hai biến thể (ĐỐI CHIẾU — đây là rủi ro #1)

| Khía cạnh | ICD (đề xuất, §V.2.3-A) | Pro-Watch API doc (thực tế, p.134–139) |
|---|---|---|
| SignalR flavor | ASP.NET **Core** SignalR | **Classic** ASP.NET SignalR 2.2 (jQuery) |
| Client lib | `@microsoft/signalr` | `jquery` 1.6.4+ & `jquery.signalR-2.2.0.min.js` / `Microsoft.AspNet.SignalR.Client` |
| Khởi tạo (JS) | `new signalR.HubConnectionBuilder().withUrl("https://<srv>/signalr/eventhub?access_token=<t>").build()` | `$.hubConnection("http://<srv>:8735/pwevents",{useDefaultPath:false}); conn.createHubProxy("PWEventService")` |
| Endpoint | `/signalr/eventhub` | `PWEventSignalRUrl` (default `https://localhost:8735/`) + path `/pwevents` |
| Hub name | (ngầm `eventhub`) | **`PWEventService`** |
| Auth | `?access_token=<token>` (bearer) | `myhub.state.userName` + `myhub.state.wrkstName`; REST headers Basic; **không** có token query |
| Server method gọi từ client | — | `subscribe()` / `unsubscribe()` → trả `PwStatus` |
| Client callback (server→client) | `onProwatchEvent` | `onProwatchEvent`, `onProwatchAlarm`, `onProwatchAlarmDisposition` |
| Input params | AccessToken*, SubscribedEvents[], ClientID, MaxResults | userName + wrkstName (state); routing group + partition quyết định event nào nhận |

→ **Callback `onProwatchEvent` trùng tên ở cả hai**, nhưng cách connect/auth khác hẳn. Phải chốt build thực tế đang deploy phơi stack nào.

### 3.2 Luồng kết nối thực tế (classic SignalR 2.2 — theo API doc)

```
IB (SignalR client)                         Pro-Watch Event Service (:8735/pwevents)
   │  $.hubConnection(url,{useDefaultPath:false})        │
   │  createHubProxy("PWEventService")                    │
   │  myhub.state.userName = <PW user>                    │  (route theo user)
   │  myhub.state.wrkstName = <workstation đã tạo trong PW>│
   │  myhub.on("onProwatchEvent"/"onProwatchAlarm"/...)   │
   │  conn.start().done(=> myhub.invoke('subscribe')) ──► │  kiểm tra quyền "Subscribe to Events"
   │  ◄──── onProwatchEvent(PwEvent) ──────────────────── │  push real-time (chỉ event user được phép)
   │  ◄──── onProwatchAlarm(PwEvent) ─────────────────────│
   │  ◄──── onProwatchAlarmDisposition(PwEventDisposition)│
   │  myhub.invoke('unsubscribe') ──────────────────────► │  ngừng nhận
```

**Điều kiện bắt buộc (server-side, không bỏ qua):**
- License **Data Transfer Utility API** (Event service + hardware actions cần riêng license này, ngoài DTU cho REST/SOAP).
- Config: `StartEventService=1`, `PWEventSignalRUrl` đổi `localhost` → machine name/IP, `localhost` references phải thay hết.
- PW user phải có quyền **"Subscribe to Events"** (Programs→Administration→Data Transfer Utility→Add Function). Cộng thêm **"Enable Web Password"** + Web Password để auth REST.
- **CORS:** URL của IB client **phải** nằm trong `CorsOriginSettings` (CSV) — thiếu là server từ chối handshake.
- **Routing groups + partitions** của PW user lọc event: IB chỉ nhận đúng tập event được cấp quyền & thấy được.

---

## 4. Event Service

**Mục đích:** IB nhận mọi access event ghi trong **EV_LOG** (Access Granted/Denied, Door Forced, Door Held, Door Status Change, Alarm, Fire/Emergency).

**Server methods (client→server, qua proxy):**
- `subscribe()` → `PwStatus`. Yêu cầu userName + wrkstName hợp lệ + quyền Subscribe + workstation nằm trong danh sách user được phép.
- `unsubscribe()` → `PwStatus`.

**Client methods (server→client):**
- `onProwatchEvent(PwEvent)` — event mới.
- `onProwatchAlarm(PwEvent)` — alarm mới.
- `onProwatchAlarmDisposition(PwEventDisposition)` — đổi state alarm (ack/clear/wait...).

**Output event JSON (theo ICD, payload tối thiểu IB cần map):**
```json
{
  "EventId": "EV123456",
  "EventType": "AccessDenied",
  "EventCode": "CARD_INVALID",
  "EventDate": "2025-08-20T09:15:00Z",
  "DoorId": "DOOR-01", "UserId": "USR-1001", "BadgeId": "BADGE-778899",
  "DeviceId": "READER-DOOR-01", "Location": "Main Entrance",
  "Priority": 2, "Message": "Access denied - invalid badge"
}
```
Required: `EventId`, `EventType`, `EventCode`, `EventDate`. (PwEvent thực tế của API doc giàu hơn — full Pro-Watch event struct: LogicalDevice object, HardwareID, Badge, Card...)

---

## 5. Data Service

Kênh SignalR **thứ hai, độc lập** — theo dõi **data change** (DB audit log) chứ không phải access event. Dùng khi IB cần đồng bộ user/badge/cardholder.

- Config: `StartDataService=1`, `PWDataSignalRUrl` (default `http://localhost:8736/`), hub path `/PWDataService`.
- Yêu cầu DB: bật **SQL Service Broker** → `ALTER DATABASE PWNT SET ENABLE_BROKER`; cấp quyền SQL (ALTER, CONNECT, CONTROL, CREATE CONTRACT/MESSAGE TYPE/PROCEDURE/QUEUE/SERVICE, EXECUTE, SELECT, SUBSCRIBE QUERY NOTIFICATIONS, VIEW DATABASE STATE/DEFINITION).
- Bảng phải vừa **Audited** (Database Configuration→Database Tables→tick Audit Logging Add/Update/Delete) vừa **Published** (`UPDATE TABLES_ACCESS SET PUBLISH=1 WHERE TABNAME IN (...)`).
- PW user cần quyền **"Subscribe to Data"**.
- Server method `Subscribe(filter)` với `DataServiceSubscriptionFilter(userName, ["AuditLog"])` (hiện chỉ hỗ trợ entity `AuditLog`).
- Callback `OnAuditLogDataChange(List<AuditLog>)` — fields: BatchID, TableName, ColumnName, AuditTime, Operation (Add/Update/Delete), Key1/2/3, BeforeImage, AfterImage.

> ⚠️ Ví dụ Data Service trong API doc lại dùng `HubConnectionBuilder().WithUrl().WithAutomaticReconnect()` (= **ASP.NET Core** SignalR), trong khi Event Service dùng classic 2.2 → tài liệu **không nhất quán** giữa 2 service. Càng củng cố nhu cầu xác minh stack thực tế.

---

## 6. REST API bổ trợ

Base (config thực tế): `PWRestUrl = http://localhost:8734/pwapi/`. (ICD §V.2.1 ghi `/prowatch/api/<Method>` — generic/không chính xác; dùng `/pwapi/`.)

**Headers chung mọi REST call:**
```
Authorization: Basic <base64(username:webpassword)>
Content-Type: application/json
X-PW-WRKST: <workstation name>
```

**Door control (logical device) — xác nhận từ API doc p.~14:**
| Method | Endpoint | Mô tả |
|---|---|---|
| POST | `/pwapi/logdevs/{logdev}/unlock` | Mở (giữ) cửa — dùng cho emergency release khi có fire alarm |
| POST | `/pwapi/logdevs/{logdev}/lock` | Khóa cửa sau khi hết tình huống khẩn |
| POST | `/pwapi/logdevs/{logdev}/momentaryunlock` | Mở tạm thời (pulse) |
| POST | `/pwapi/logdevs/{logdev}/timeoverride/{second}` | Override theo thời gian (giây) |
| POST | `/pwapi/logdevs/{logdev}/reenable` | Trả về chế độ schedule |
| GET | `/pwapi/logdevs/{logdev}/{card}/{datetime}/{unlock}` | Kiểm tra quyền card tại door |

`{logdev}` = GUID Logical Device (vd `0x0071ABCD1234`). Trả `200 OK` = lệnh nhận; **không** đảm bảo cửa đã mở vật lý → phải verify bằng `GET /pwapi/alarms` filter theo LogDevID + timestamp (Alarm Event được sinh ra).

**Alarm query & disposition:**
| Method | Endpoint | Mô tả |
|---|---|---|
| GET | `/pwapi/alarms` | Tất cả alarm chưa clear; hỗ trợ OData (`$top`, `$orderby`, `$filter eventdate/eventCode`) |
| GET | `/pwapi/alarms/state` | Disposition hiện tại của mọi alarm |
| PUT | `/pwapi/alarms/{eventId}/state/acknowledge` | Ack |
| PUT | `/pwapi/alarms/{eventId}/state/clear` | Clear |
| PUT | `/pwapi/alarms/{eventId}/state/wait` | Wait — body `{"WaitIndefinitelyFlag":1}` hoặc `{...:0,"WaitTime":5}` |
| PUT | `/pwapi/alarms/{eventId}/state/unacknowledge` | Unack |

State machine: `UNACK → ACK → CLR` (+ `WAIT`, hết wait → về UNACK).

**HTTP codes:** 200 OK, 204 No Content, 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found, 500 Internal Error. Error body: `{ "errorCode","errorMessage","timestamp" }`.

---

## 7. Mô hình dữ liệu & EventCode

**Hardware tree (phân cấp):** `Site → Channel → Panel/SubPanel → Logical Device → Hardware (Reader, Door contact, Lock, Horn)`. HardwareID theo PW Naming Convention (vd `PW5000::Reader01`).

**EventCode (PW-5000/7000) — tập IB cần nhận diện:**
| Code | Ý nghĩa | Receiving system (ICD §7.1) |
|---|---|---|
| 400 | Unknown Card | — |
| 401 | Void Card | — |
| 402 | Expired Card | — |
| 405 | Wrong Door / valid card sai reader | HR, CCTV |
| 406 | Lost Card Attempt | HR, CCTV |
| 407 | Stolen Card Attempt | HR, CCTV |
| 408 | Unaccounted-for Card | — |
| 409 | Deactivated Card | — |
| 410 | Terminated Card (nhân viên nghỉ việc) | HR |
| 423 | Locked Attempt / (ICD: Forced filter) | — |
| 437 | Auto unlocked | BHS |
| 438 | Auto locked | BHS |
| 900 | Door Forced Open | CCTV |
| 903 | Door Held Open (quá giờ) | CCTV |

> ⚠️ Mâu thuẫn nội bộ ICD: §7.1 ghi EventCode **900** = Door Forced; nhưng `GetForcedDoorEvents` lại filter `eventCode=423` và mô tả "423 = Force Door", còn output sample lại `EventCode:900`. → Phải chốt mapping Forced Door = **900** hay **423** với Honeywell. (Sample output nghiêng về **900**.)

**Timestamp:** `YYYY-MM-DDTHH:MM:SS`, giờ **UTC**. Fields `EventDate` (xảy ra), `SystemDate` (hệ ghi nhận). ICD yêu cầu gửi IB dùng `UTC_Time`.

**Alarm payload đầy đủ (REST GET /alarms):** EventID, EventDate, SystemDate, EventDesc, EventTypeID (GUID), EventTypeDesc, EventCode (int), Priority, IsAlarm (bool), LogicalDevice{LogDevID,Description,AltDescription,Location}, HardwareID, HardwareType, Badge{}, Card{}, Message.

---

## 8. Bảo mật & Non-functional

**Bảo mật (ICD §8.2 + API doc):**
- TLS ≥ 1.2 cho mọi giao tiếp ACS↔IB. Pro-Watch hỗ trợ HTTPS/SSL cho DTU service (cert qua makecert chỉ để test; prod dùng CA thật). `PWEventSignalRUrl` default đã là `https://`.
- Auth: Basic (username + **Web Password** riêng, không phải password đăng nhập PW thường) + Token cho session. Header `X-PW-WRKST` bắt buộc.
- RBAC: Operator / Supervisor / Admin. Quyền chi tiết qua Programs/Functions (Subscribe to Events, Subscribe to Data, Enable Web Password).
- Alarm payload ACS↔IB phải authenticate đảm bảo integrity.
- Tuân thủ ISO/IEC 27001, ACIS-TSA; PDPA — Nghị định 13/2023/ND-CP; audit-trail (UserID, time, action); hỗ trợ xóa dữ liệu (GDPR/PDPA right-to-be-forgotten).

**Performance (ICD §8.1):** response alarm từ ACS ≤ **200 ms**; throughput IB ≥ **500 msg/s**; P95 độ trễ truyền < **50 ms**. → IB phải xử lý bất đồng bộ, backpressure, không block trên I/O downstream.

---

## 9. Khuyến nghị triển khai IB-side

1. **Tách adapter SignalR** sau interface `IAcsEventStream` để cô lập rủi ro stack chưa chốt (classic vs core). Triển khai 2 implementation, chọn qua config.
2. **Connection resiliency:** auto-reconnect + backoff. Khi mất kết nối → **backfill bằng REST** `GET /pwapi/alarms?$orderby=EventDate desc` lọc theo timestamp lần nhận cuối để không mất event (SignalR không guarantee delivery khi disconnect).
3. **Idempotency:** dedupe theo `EventId`/`EventID` (GUID) — tránh xử lý trùng khi reconnect + backfill chồng lấn.
4. **Door control = REST**, không qua SignalR. Sau mỗi `unlock/lock` → verify qua `GET /alarms` (LogDevID + timestamp) vì 200 OK ≠ cửa đã mở vật lý.
5. **Normalize sang schema chung** (JSON/XML) ngay tại IB: map EventCode → semantic type; chuẩn hóa UTC; gắn system identifier + location + partition.
6. **Routing/partition:** tạo PW user + workstation riêng cho IB, cấp đúng routing group để nhận đủ (và chỉ) event cần. Thêm URL IB vào `CorsOriginSettings`.
7. **Resiliency nghiệp vụ (ICD exceptional flow):** nếu downstream (CCTV/HR/FAS) mất kết nối, ACS chỉ log — IB phải queue & retry, không drop.

**Mẫu client classic SignalR 2.2 (C# — nếu xác nhận stack này):**
```csharp
var conn = new HubConnection("https://<pw-srv>:8735/", useDefaultUrl:false);
var hub  = conn.CreateHubProxy("PWEventService");
conn.Headers["userName"] = pwUser;          // hoặc hub.state tùy binding
hub["wrkstName"] = workstation;
hub.On<PwEvent>("onProwatchEvent", OnEvent);
hub.On<PwEvent>("onProwatchAlarm", OnAlarm);
hub.On<PwEventDisposition>("onProwatchAlarmDisposition", OnDisp);
await conn.Start();
await hub.Invoke<PwStatus>("subscribe");
```

**Mẫu client ASP.NET Core SignalR (nếu xác nhận theo ICD):**
```csharp
var conn = new HubConnectionBuilder()
    .WithUrl("https://<pw-srv>/signalr/eventhub", o =>
        o.AccessTokenProvider = () => Task.FromResult(token))
    .WithAutomaticReconnect()
    .Build();
conn.On<PwEvent>("onProwatchEvent", OnEvent);
await conn.StartAsync();
```

---

## 10. Phát hiện quan trọng & cạm bẫy

1. **[CRITICAL] Hai spec SignalR mâu thuẫn** (§3.1): ICD = ASP.NET Core; API doc Event Service = classic 2.2. Client lib, handshake, auth khác hẳn → **không code được tới khi chốt build thực tế**.
2. **[HIGH] API doc là đời 5.5** (title file = `Pro-Watch_55_API_Service`): reference có thể lag so với Pro-Watch 6.0 đang deploy. SignalR có thể đã được modernize lên Core ở 6.0 (Data Service ví dụ đã dùng Core) → ICD có thể đúng hơn API doc ở điểm này. **Cần vendor confirm.**
3. **[HIGH] Mapping Forced Door 900 vs 423** không nhất quán trong ICD (§7).
4. **[MED] Auth model khác nhau:** SignalR classic dùng `state.userName`/`wrkstName` (không token); ICD dùng `access_token` query. REST luôn dùng Basic + `X-PW-WRKST`.
5. **[MED] License gating:** Event service + hardware action cần license **DTU API** riêng; REST/SOAP cần license **DTU**. Thiếu license → service không start (chỉ thấy lỗi trong Windows Application Event log).
6. **[MED] CORS:** quên thêm IB URL vào `CorsOriginSettings` → handshake bị từ chối "im lặng".
7. **[MED] SignalR không đảm bảo delivery** khi disconnect → bắt buộc backfill REST + dedupe theo EventId.
8. **[LOW] 200 OK của door command ≠ cửa mở vật lý** → phải verify qua alarm log.
9. **[LOW] REST base path:** dùng `/pwapi/` (config thực) không phải `/prowatch/api/` (ICD generic).
10. **[INFO] REST & ISOM service không chạy chung 1 instance** Pro-Watch API windows service.

---

## 11. Câu hỏi chưa giải quyết

1. **Build Pro-Watch 6.0 đang deploy phơi SignalR stack nào** — classic 2.2 (`/pwevents`, hub `PWEventService`, state-auth) hay Core (`/signalr/eventhub`, `access_token`)? → quyết định toàn bộ client IB.
2. **Forced Door EventCode chính xác = 900 hay 423?**
3. **`SubscribedEvents`/`MaxResults`/`ClientID`** (ICD) có thực sự được Event Service hỗ trợ, hay chỉ là đề xuất? (API doc thực tế không có — lọc bằng routing group/partition.)
4. **Token auth** cho SignalR: cơ chế phát token (login endpoint nào?) — API doc chỉ mô tả Basic + Web Password, không thấy endpoint `/login` trả bearer token.
5. **Đồng bộ user/badge 2 chiều:** dùng Data Service SignalR (`AuditLog`) hay REST `/badges` polling? Ai own master data (HR vs ACS)?
6. **HA/failover** cho SignalR connection khi ACS chạy HA cluster (ICD §III.5 nêu HA cho Core + PW IC APP servers) — IB reconnect tới VIP hay từng node?
7. **Schema chuẩn hóa chung của IB** (JSON/XML common schema) — đã có chưa, hay IB contractor tự định nghĩa?
8. ICD có nhiều hình/diagram (system diagram, data flow) **không trích xuất được sang text** — cần xem bản PDF gốc để xác nhận chi tiết luồng.
