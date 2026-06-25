# Báo cáo bổ sung: Phân tích bản .docx ICD SACS — có gì THÊM so với PDF?

**Ngày:** 2026-06-22 22:29 (Asia/Saigon)
**Nguồn mới:** `ICD SACS Prowatch - LTIA ver01.docx` (OneDrive, 2.2 MB, 33 trang)
**So sánh với:** [research-260622-2229-sacs-prowatch-signalr-integration.md](research-260622-2229-sacs-prowatch-signalr-integration.md) (báo cáo từ PDF)
**Phương pháp:** trích text (textutil), trích 19 ảnh nhúng, map ảnh↔section, mô tả 16 diagram song song (16 agent vision) + tổng hợp.

---

## TL;DR

| Hạng mục | Kết luận |
|---|---|
| **Text/nội dung chữ** | ≈ **giống hệt PDF** (cùng sections, tables, EventCodes, SignalR sample, REST endpoints, NFRs). .docx là file gốc xuất ra PDF. **Không có chữ mới.** |
| **Metadata** | .docx sửa **2025-12-29** (~2 tháng mới hơn PDF, 2025-10-30); creator `Nguyen Hoang`, lastModifiedBy `vu tran`, revision 4. Không comments, không tracked changes. → re-save/chỉnh hình, không đổi nội dung. |
| **Giá trị mới THỰC SỰ** | **16 diagram nhúng** — không extract được sang text PDF. Bổ sung nhiều về **deployment/topology/HA/sequence**. |
| **Hyperlink ẩn** | Section VI có link OneDrive trỏ tới **"API and HSDK document"** (PDF chỉ thấy chữ, không thấy URL). → pointer tới tài liệu **HSDK** chưa được phân tích. |
| **Điểm mấu chốt** | Diagram **KHÔNG giải tỏa** mâu thuẫn SignalR (ASP.NET Core sample vs classic 2.2 reference) — không diagram nào hiện hub-name/port/auth. Vẫn cần API/HSDK doc thật. |

---

## 1. Inventory 19 ảnh nhúng

- **16 diagram nội dung** (image1–16, theo thứ tự tài liệu) — phân tích chi tiết §2.
- **3 ảnh branding** (image17 2000×1017, image18 524×98, image19.svg) nằm trong page header → **logo/letterhead**, không phải nội dung.
- **image16 = QR code** (không decode được payload; phỏng đoán trỏ tới tài liệu trên OneDrive).

---

## 2. Diagram bổ sung gì so với PDF (nhóm theo section)

### a. Topology tổng thể (Sec II)
- **D01 — SACS Overall System Topology (DC2 / DCH SAN Farm).** Deployment vật lý: SACS = **Main VM + Secondary VM + SAN Farm** trong DC2. **THÊM:** HA pairing (Main/Secondary dùng chung SAN Farm); **SACS SDK nhúng vật lý trên AMS & HBMS server** (tích hợp mức SDK, không chỉ qua broker); **hai backbone tách biệt** — AMS/HBMS/AGAC đi qua **"ESB AND/OR IB"**, còn MCS/NMS gắn thẳng AIRPORT DNE; lớp phân phối **"SCS DO"** giữa network và edge devices.

### b. Field-device wiring / Generic-Channel (bản vẽ điện từng thiết bị)
- **D02 — Elevator (TYPE EL) wiring riser.** Cable schedule chi tiết (power EI 2×1.5mm², data CAT6 UTP, signal 18AWG, CR 2×2.5mm²); IB = AC/DC converter + IP Controller; CR ở cửa thang qua Travelling Cable; số dry-contact tới FAS scale theo số tầng. Thuần wiring, không API.
- **D03 — Lift → Pro-Watch PW7K controller termination.** Wiring hardware: dry-contact relay NO/C/NC từ board PW7K…OUT; **RS-485 giữa board OUT ↔ board IN/reader**; có BATTERY, ETHERNET uplink, CABINET TAMPER, POWER FAULT. (legibility *partial* — model PW7K suy luận từ ngữ cảnh.)
- **D04 — Pro-Watch field topology + FAS.** **Quan trọng FAS:** FAS nối Pro-Watch qua **HAI đường — (1) dry-contact hardwired vào ACS Interface Box, (2) FAS Panel qua "RS232 Converter to TCP/IP" lên NETWORK** — tích hợp field/điện, **KHÔNG** qua REST/JSON+SignalR/IB. Cũng cho thấy **cluster 4-VM** (VM1/VM2 = PW Core + RC Main/Redundancy; VM3/VM4 = DB Main/Redundancy) + SAN, và phân scope theo thiết bị (ACS / Door Supplier / SCS / DNE / MSI / DCH).

### c. HA / DCH
- **D05 — Neverfail Active/Passive HA.** 2 VM full stack (Prowatch ACS / PW Intelligent Command / Neverfail Heartbeat / Windows); **"Neverfail Channel (Virtual to virtual)"** heartbeat+replication riêng, tách LAN/WAN production. Ranh giới: **DCH cấp VM/OS/Database; SACS cấp ACS core software**; DB redundancy ngoài scope SACS.
- **D06 — VM sizing specs (DCH 5.11).** Bảng spec: VM1/VM2 app (64 vCore/128GB), VM3/VM4 DB (32 vCore/64GB SQL Server), SAN chung 4TB. ⚠️ Mâu thuẫn nội bộ: bullet "128GB/4TB RAID for DB" vs bảng tách DB ra VM 64GB + SAN dùng chung.

### d. System diagram (Sec IV.4 — Pro-Watch Ecosystem)
- **D07 — Pro-Watch Web API / Ecosystem.** **THÊM:** Web API phơi **3 interface: Rest, ISOM, SOAP** (không chỉ REST/JSON); **"Event Framework (publisher)"** mới là thành phần nối Subscriber qua **REST/SignalR** (không phải Pro-Watch Server); datastore **PWNT**; controller PW-5000/6000/6101 nằm NGOÀI ecosystem boundary.

### e. Data-flow model (Sec IV.6.1)
- **D08 — ACS ↔ ESB/IB ↔ Other System model.** **THÊM (rất rõ):** ánh xạ 3 API surface với verb/hướng — **XML = Request/Response; REST/JSON = Put/Post (inbound) + Get (outbound); SignalR = CHỈ outbound "Event push / Realtime"** (không có mũi tên inbound). ESB/IB ở GIỮA (broker); Other System không nói trực tiếp Pro-Watch.
- **D09 — Usage flow (sequence 4 lifeline).** Hai path runtime: **(1) VALID** → swipe → authenticate → "Open if valid" → ACS push qua **API, SignalR** → IB store → forward **AMS/HR/BHS**. **(2) INVALID/ALARM** → ACS local warning (lights/horn) → push qua **API, SignalR** → IB store → forward **AMS/VMS/FAS**. Consumer set khác nhau theo path.
- **D10 — Logical Device Address format.** Giải mã ID: `PW6000::05010005000800` = Site `PW6000` :: Channel `05` / Panel `01` / Subpanel `0005` / LogicalDevice `000800`. Hữu ích để parse DoorId/DeviceId trong payload event.

### f. Per-API data flow (Sec V.2.3)
- **D11 — SignalR Event Real-Time (7 bước) — DIAGRAM QUAN TRỌNG NHẤT.** Sequence: (1) IB Client *Open connection* → (2) *Authentication and Subscribe* → (3) SignalR ↔ Event Service → (4)(5) Event Source *Push* → (6) Event Service *Message Json* → (7) SignalR *Forward message* tới IB Client. **IB Client = subscriber/khởi tạo kết nối; Pro-Watch host SignalR hub; payload JSON.** (Không hiện hub-name/port/auth.)
- **D12 ≈ D13 — "Get Alarm" (pull đồng bộ, REST).** Template trùng lặp; D13 hint "GetForcedDoorEvents" nhưng nhãn thực tế chỉ "Get Alarm".
- **D14 — Unlock Door.** **Post Unlock Door** (= POST /pwapi/logdevs/{logdev}/unlock); contract **"200 = Ok / non-200 = Error"**; có **"Third Party → Push Action → IB Client"**: unlock kích hoạt bởi hệ upstream (vd emergency release khi cháy) qua IB, không phải Pro-Watch tự khởi.
- **D15 — Lock Door.** **Post lock Door** (= POST /pwapi/logdevs/{logdev}/lock); cùng pattern + trigger + contract.

---

## 3. [QUAN TRỌNG] SignalR / API — diagram làm rõ được gì?

**Tổng hợp chi tiết SignalR/REST nhìn thấy:**
- **SignalR = outbound event-push only** (D08), realtime (D08, D09, D11).
- **IB Client là bên SUBSCRIBE & khởi tạo connection**; Pro-Watch host hub; payload **JSON** (D11).
- Trình tự: open → **authenticate + subscribe** → push → forward (D11).
- Web API có thêm **ISOM, SOAP** ngoài REST (D07); event đi qua **"Event Framework" publisher** (D07).
- Door control = **REST POST**, contract 200/non-200, trigger từ Third Party qua IB (D14/D15).

**Có resolve mâu thuẫn ASP.NET Core vs classic SignalR 2.2 không? → KHÔNG.**
- **Không diagram nào** hiện **hub name** (`eventhub` vs `PWEventService`), **port**, **transport** (WebSocket/SSE/LongPolling), hay **auth scheme** (`access_token` query vs `state.userName/wrkstName`) — đây đúng là các điểm phân biệt 2 stack.
- D11 chỉ là *trình tự logic*, khớp được cả hai kiểu → không phân biệt.
- Chỉ *deepen nhẹ*: củng cố mô hình "ACS push realtime tới IB qua SignalR outbound", nhưng tương thích cả hai biến thể.

➡️ **Phải xác minh từ API & HSDK doc thật** (chính là tài liệu trỏ tới qua hyperlink OneDrive ở Section VI).

---

## 4. Mâu thuẫn / điểm cần xác minh (diagram làm lộ ra)

1. **Interface list không khớp:** D07 = Rest/ISOM/SOAP; D08 = XML/REST-JSON/SignalR. Bộ interface chính thức cho IB là gì? ISOM/SOAP có dùng không?
2. **"ESB AND/OR IB" (D01):** broker là ESB sẵn có hay Integration Broker riêng? Ảnh hưởng ai host/cấu hình endpoint SignalR/REST.
3. **FAS hai chiều?** D04/D02: FAS tích hợp field-level (dry-contact + RS232→TCP/IP), KHÔNG qua IB. Nhưng D09 liệt FAS là consumer "warnings from IB". → FAS vừa nguồn (hardwired) vừa consumer (qua IB)?
4. **SignalR variant** — chưa giải quyết (xem §3).
5. **Forced Door 900 vs 423** — diagram không đề cập EventCode → không giúp xác minh (vẫn tồn từ báo cáo PDF).
6. **Sizing mâu thuẫn (D06)** — số RAM/storage DB không nhất quán.
7. **"200 <> Error" (D14/D15)** — nhãn mơ hồ, cần xác nhận contract response.

---

## 5. Độ tin cậy

- **Cao:** 14/16 diagram legibility "clear", mô tả nhất quán.
- **D03** *partial* — nhãn board PW7K chỉ đọc một phần (ảnh hưởng thấp, chỉ wiring).
- **D16 (QR)** — payload chưa decode; có thể trỏ tài liệu OneDrive (phỏng đoán).
- **Giới hạn:** không diagram nào có port/hub/auth → mọi câu hỏi cấp protocol (gồm SignalR variant) phải dựa vào API & HSDK doc.

---

## 6. Câu hỏi chưa giải quyết (cần API/HSDK doc để chốt)

1. SignalR thực tế: ASP.NET **Core** hay **classic 2.2**? Hub = `eventhub` hay `PWEventService`? Auth = `access_token` query vs state-based? Port?
2. Bộ interface IB chính thức: chỉ REST/JSON + SignalR, hay còn XML/ISOM/SOAP?
3. FAS một chiều (field dry-contact) hay hai chiều (cũng nhận warning qua IB)?
4. Forced Door EventCode chuẩn = 900 hay 423?
5. "ESB AND/OR IB" — kiến trúc broker chốt là gì? Ai host/cấu hình endpoint?
6. **Tài liệu HSDK** (link OneDrive Section VI) — cần lấy về để phân tích; nhiều khả năng chứa spec SignalR/API thật giải tỏa các mâu thuẫn trên.
7. QR code (D16) trỏ tới đâu?

---

### Ghi chú nguồn
- Hyperlink Section VI: `https://1drv.ms/f/c/b1dc83bd9d47fd20/...` (OneDrive folder — **chưa truy cập**, là cloud cá nhân; cần bạn xác nhận hoặc tải HSDK doc về).
- Ảnh đã giải nén tại `/tmp/sac/diagrams/` (16 file, đặt tên theo thứ tự tài liệu).
