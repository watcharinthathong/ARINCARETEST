# Arincare — Playwright E2E Test Suite

ชุดทดสอบอัตโนมัติ (Playwright + TypeScript) ครอบคลุม 3 ระบบ:
- **Arincare Web** — Customer Management
- **Arincare POS** — Point of Sale
- **Arincare Telepharmacy CMS** — บริการเภสัชกรรมทางไกล

---

## โครงสร้างโปรเจกต์

```
ARINCARETEST/
│
├─ tests/
│  ├─ # ── Arincare Web ──────────────────────────────────────
│  ├─ customer-create.positive.spec.ts      # TC-CUST: เพิ่มลูกค้า (positive)
│  ├─ customer-create.validation.spec.ts    # TC-CUST: validation
│  ├─ customer-create.e2e.spec.ts           # TC-CUST: E2E ครบทุก Tab
│  ├─ customer-edit-mobile.spec.ts          # แก้ไขเบอร์มือถือลูกค้า
│  │
│  ├─ # ── Arincare POS ──────────────────────────────────────
│  ├─ pos-register.spec.ts                  # TC-POS: ลงทะเบียนสมาชิก
│  ├─ pos-member-edit-mobile.spec.ts        # แก้ไขเบอร์สมาชิก POS
│  ├─ pos-issue-bc365-sync.spec.ts          # Bug: BC365 sync
│  ├─ pos-issue-tax-address.spec.ts         # Bug: ที่อยู่ใบกำกับภาษี
│  │
│  ├─ # ── Telepharmacy CMS ───────────────────────────────────
│  ├─ telepharmacy-login.spec.ts            # TC-AUTH-001~019: Login & Auth
│  ├─ telepharmacy-home.spec.ts             # TC-HOME-001~008: หน้าหลัก Dashboard
│  ├─ telepharmacy-queue.spec.ts            # TC-QUE-001~023:  Queue Management
│  ├─ telepharmacy-chat.spec.ts             # TC-CHAT-001~021: Chat Module
│  ├─ telepharmacy-call.spec.ts             # TC-CALL-001~010: Voice/Video Call
│  └─ fixtures.ts                           # shared fixtures
│
├─ pages/                                   # Page Object Model
│  ├─ LoginPage.ts
│  ├─ CustomerFormPage.ts
│  └─ PosRegisterPage.ts
│
├─ data/                                    # Test data
│  ├─ customer.testdata.ts
│  └─ pos-member.testdata.ts
│
├─ fixtures/                                # ไฟล์แนบสำหรับทดสอบ
│  ├─ test-image.jpg
│  ├─ test-image2.jpg
│  └─ test-document.pdf
│
├─ scripts/
│  └─ update-telepharmacy-results.py        # อัพเดทผลเทสลง Excel
│
├─ screenshots/                             # Screenshot ทุก test (auto-generated)
│
├─ # ── ผล Excel ──────────────────────────────────────────────
├─ Arincare_Customer_TestCases.xlsx
├─ Arincare_CustomerPOS_TestCases.xlsx
├─ Arincare_Telepharmacy_TestCases.xlsx
│
├─ # ── ผล JSON (Telepharmacy) ────────────────────────────────
├─ test-results-login-final.json
├─ test-results-home.json
├─ test-results-queue.json
├─ test-results-chat.json
├─ test-results-call.json
│
├─ playwright.config.ts
├─ .env.example
└─ package.json
```

---

## ติดตั้ง

```bash
npm install
npx playwright install chromium
cp .env.example .env    # ใส่ค่า credential จริงใน .env
```

---

## รันเทส

```bash
# รันทั้งหมด
npm test

# รันแยกโมดูล Telepharmacy
npx playwright test tests/telepharmacy-login.spec.ts
npx playwright test tests/telepharmacy-queue.spec.ts
npx playwright test tests/telepharmacy-chat.spec.ts
npx playwright test tests/telepharmacy-call.spec.ts

# รันเทสเดี่ยว
npx playwright test --grep "TC-QUE-015"

# เปิดรายงาน HTML
npx playwright show-report
```

---

## อัพเดทผลลง Excel (Telepharmacy)

```bash
python3 scripts/update-telepharmacy-results.py
```

---

## ผลเทสล่าสุด — Telepharmacy CMS

| โมดูล | PASS | FAIL | SKIP | รวม |
|---|---|---|---|---|
| TC-AUTH (Login) | 9 | 1 | 0 | 10 |
| TC-HOME (Dashboard) | 8 | 0 | 0 | 8 |
| TC-QUE (Queue) | 14 | 4 | 5 | 23 |
| TC-CHAT (Chat) | 16 | 3 | 2 | 21 |
| TC-CALL (Call) | 0 | 0 | 10 | 10 |
| **รวม** | **44** | **9** | **21** | **74** |

### Bug ที่พบ

| Test Case | ปัญหา | ความรุนแรง |
|---|---|---|
| TC-AUTH-019 | ไม่มี Rate Limiting / Brute-force Protection | High |
| TC-QUE-021 | ไม่มีปุ่ม Resume หลัง PAUSED | High |
| TC-QUE-023 | สถานะ PAUSED หายหลัง Refresh | High |
| TC-QUE-011 | สี Status Badge ไม่ตรง Design Spec | Low |
| TC-CHAT-004 | ตำแหน่ง Chat Bubble ผิด (outbound ไม่อยู่ขวา) | Medium |
| TC-CHAT-005 | Auto-scroll ไม่ทำงานหลังส่งข้อความ | Medium |
| TC-CHAT-009 | ปุ่ม X ลบ File Preview ก่อนส่งไม่ทำงาน | Medium |

> **TC-CALL ทั้งหมด SKIP** — Voice/Video call ต้องเปิดจาก LINE app (Flex Message) เท่านั้น ไม่สามารถทดสอบผ่าน browser โดยตรงได้

---

## Environment Variables

| ตัวแปร | ใช้งาน |
|---|---|
| `BASE_URL` | Arincare Web staging URL |
| `POS_BASE_URL` | POS staging URL |
| `LINE_TEST_PHONE` | อีเมล/เบอร์ LINE test account |
| `LINE_TEST_PASS` | รหัสผ่าน LINE |
| `LIFF_CHAT` | LIFF URL สำหรับ chat |
| `LIFF_VOICE_CALL` | LIFF URL สำหรับ voice call |
| `LIFF_VIDEO_CALL` | LIFF URL สำหรับ video call |
| `HEADLESS` | `true` = ไม่เห็น browser, `false` = เห็น browser |
