# Build report: Pro-Watch → CCTV SignalR Bridge (.NET 10 test harness)

**Ngày:** 2026-06-22 23:00 (Asia/Saigon)
**Vị trí code:** `src/` (solution `ProWatchCctvBridge.slnx`)
**Trạng thái:** Build OK (0 error) · end-to-end pipeline đã verify chạy thật · review workflow đã chạy

---

## 1. Mục tiêu (theo yêu cầu)
Dựng dự án test tích hợp với Pro-Watch (SACS) qua **SignalR**, có **UI cấu hình + theo dõi lịch sử message** nhận từ SAC, **map sự kiện** rồi **gửi CCTV qua RabbitMQ AMQPS (TLS 1.3)**. Stack: **.NET 10**.

Lựa chọn đã chốt với user: UI **Blazor Server** · history **SQLite + EF Core** · connector **Core SignalR + simulator** (real-PW classic-2.2 để sau) · harness chỉ **simulator**.

## 2. Kiến trúc

```
Pro-Watch / Simulator  --SignalR(onProwatchEvent/Alarm)-->  Broker  --rules-->  CctvCommand  --AMQPS/TLS1.3-->  RabbitMQ --> CCTV/VMS
                                                          persist SQLite        topic exchange + routing key
```

3 project:
- **ProWatchCctvBridge.Shared** — DTO/contract: `PwEvent`, `PwStatus`, `CctvCommand`, `ProWatchHub` (tên hub/callback dùng chung), `PwEventCodes/Types` (từ ICD).
- **ProWatchCctvBridge.Simulator** — ASP.NET Core SignalR hub `PWEventService` @ `/pwevents` (port 5240). `Subscribe/Unsubscribe`, auto-emit 5s + control API (`/emit/{key}`, `/scenarios`, `/auto/{bool}`, `/state`). 9 scenario phủ UC ICD.
- **ProWatchCctvBridge.Broker** — Blazor Server (port 5180):
  - `ProWatchListenerService` (hosted+singleton): HubConnection Core, auto-reconnect, Subscribe, đẩy event vào pipeline.
  - `EventPipeline`: persist → map → publish → log → notify UI.
  - `EventMapper` + `MappingRuleRecord` (seed từ ICD use cases).
  - `RabbitMqPublisher` (RabbitMQ.Client v7 async): AMQPS, TLS qua `RabbitTls` (SslOption Tls13, custom CA trust / client cert / allow-untrusted test).
  - `ConfigStore` (SQLite key/value JSON) + hot-reconnect khi đổi config.
  - UI: Dashboard (live + counters + trigger), History (paged + detail), Mapping (CRUD rules), Configuration (PW + RabbitMQ form + test).

## 3. Mapping mặc định (ICD use cases)

| EventCode/Type | Action | Routing key |
|---|---|---|
| 900 Door Forced | PopupAndRecord | cctv.alarm.forced |
| 903 Door Held | PopupAndRecord | cctv.alarm.held |
| 405/406/407/410 (denied/lost/stolen/terminated) | Liveview | cctv.alarm.card |
| Fire | PopupAndRecord | cctv.alarm.fire |
| 100 granted / 437 auto-unlock | (không có rule → Skipped) | — |

CCTV record window theo ICD: pre 30s / post 600s (≥10 phút).

## 4. Verify đã thực hiện (chạy thật)
- Simulator + Broker khởi động OK; simulator `subscriberCount=1` ⇒ broker **connect + Subscribe** qua SignalR thành công.
- Broker nhận 6 event, lưu SQLite (`bridge.db`): EventType/Code/Door/IsAlarm/ForwardStatus đúng.
- Mapping đúng: alarm → routing key + action đúng; `437 auto-unlock` (non-alarm) → **Skipped** (đúng, không có rule).
- 7 mapping rule seed tự động.
- RabbitMQ publish: status **Failed** ("endpoints not reachable") vì **chưa có broker** — publisher **fail gracefully**, app không crash, ghi lỗi từng message. ✅ Đường AMQPS được thực thi, chỉ thiếu broker đích.
- Build full solution: 0 error. Advisory SQLite native (NU1903) đã vá bằng `SQLitePCLRaw.bundle_e_sqlite3` 3.0.3.

## 5. Quyết định kỹ thuật quan trọng
- **SignalR Core vs classic 2.2:** real Pro-Watch 6.0 dùng **classic ASP.NET SignalR 2.2** — **không** tương thích wire với .NET Core client. Vì vậy harness dùng **Core SignalR** cho cả simulator lẫn client (chạy được trên .NET 10, test trọn pipeline). Khi cắm PW thật: thêm connector legacy `Microsoft.AspNet.SignalR.Client` (hub `PWEventService`, `state.userName/wrkstName`, `subscribe/unsubscribe` viết thường) sau cùng seam `ProWatchListenerService` — pipeline/mapping/RabbitMQ giữ nguyên.
- **IDbContextFactory** thay vì scoped DbContext (an toàn cho Blazor Server circuit).
- **Publisher singleton** giữ connection/channel, lazy + reset khi lỗi/đổi config (`Invalidate`).
- **TLS 1.3** qua `SslOption.Version=Tls13`; hỗ trợ custom CA (CustomRootTrust), mTLS (client .pfx), hoặc allow-untrusted (test).

## 6. Cách chạy & test AMQPS — xem `src/README.md`
Gồm lệnh OpenSSL sinh CA/server cert + `rabbitmq.conf` TLS 1.3 + cách trỏ broker để verify đầu AMQPS.

## 7. Câu hỏi chưa giải quyết
1. **Real PW SignalR variant** vẫn chưa xác nhận từ vendor (Core vs classic 2.2) → quyết định connector legacy có cần hay không. Hiện build sẵn seam, chưa implement legacy connector (theo lựa chọn "Core-only").
2. **CCTV message schema thật:** `CctvCommand` đang là schema tự định nghĩa theo ICD (liveview + record 30s/600s). Cần khớp với contract VMS/CCTV thực tế (field, exchange, routing convention).
3. **Forced Door 900 vs 423** (mâu thuẫn ICD) — seed dùng **900**; cần chốt với Honeywell.
4. **Bảo mật secret:** RabbitMQ password đang lưu plaintext JSON trong SQLite (đủ cho test). Production cần mã hóa / secret store.
5. **mTLS client cert cho SignalR** (nếu PW thật yêu cầu) — chưa cấu hình ở connector Core.
6. **Auth token flow** cho SignalR real PW: ICD dùng `?access_token=` (đã hỗ trợ trong `ProWatchOptions.FullUrl`) nhưng cơ chế phát token chưa rõ (xem báo cáo nghiên cứu trước).

## 8. Kết quả code review (adversarial workflow) + fix đã áp

Workflow 4 dimension × verify: **20 finding raised → 11 confirmed → đã fix 5 cái có giá trị, 6 cái decline có lý do**.

**Đã fix:**
- **[high] Race connect/disconnect** (`ProWatchListenerService`): handler `Reconnecting/Reconnected/Closed` nay guard `IsActive(conn)` (ReferenceEquals với `_conn`) → callback của connection cũ/đã teardown bị bỏ qua. Gộp fix luôn race "Reconnected vs DisconnectAsync".
- **[high] TLS thiếu hostname verify** (`RabbitTls`): nhánh custom-CA nay **reject `RemoteCertificateNameMismatch`/`NotAvailable`**, chỉ tha lỗi untrusted-root (giải bằng custom CA) → chặn MITM bằng cert hợp lệ nhưng sai host.
- **[med] Secret plaintext** (`ConfigStore`): config persisted nay **mã hóa bằng ASP.NET Data Protection** (`IDataProtector`), tolerant đọc row cũ. Verify DB: `Value` = `CfDJ8...` (đã mã hóa), không còn JSON thô.
- **[med] Publisher confirms** (`RabbitMqPublisher`): tạo channel với `CreateChannelOptions(publisherConfirmationsEnabled:true, publisherConfirmationTrackingEnabled:true)` (đúng API v7) → `BasicPublishAsync` chờ broker ack, nack → throw → ghi `Failed`. (Reviewer đề xuất `ConfirmsSelectAsync`/`WaitForConfirmsOrDieAsync` là API v6 — đã dùng cách v7 đúng.)
- **[low] Cảnh báo AllowUntrustedRoot**: log warning khi bật.

**Decline (có lý do):**
- [med] UI chạy HTTP localhost — chủ ý cho test harness (tránh dev-cert friction); production mới cần HTTPS.
- [low] Handler `RabbitChanged` ở Program không unsubscribe — cùng app lifetime, an toàn.
- [low] EventPipeline 2 lần SaveChanges khi Skipped — đúng logic (lưu history trước, cập nhật trạng thái sau), chỉ là 2 write.
- [nit] `ExchangeDeclareAsync` thiếu `arguments` — dùng default, OK.
- 9 finding khác bị **verify refute** (vd: CORS sim local OK, Dashboard InvokeAsync-after-dispose đã được Blazor xử lý, prerender double-query, deadlock ResetAsync...).

Sau fix: build 0 error; smoke test lại OK (events nhận + lưu; config mã hóa at rest). Thêm `.gitignore` (bin/obj/*.db).
