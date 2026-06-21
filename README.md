# Arincare Pharmacy — Playwright E2E: เพิ่มรายชื่อลูกค้าใหม่

ชุดทดสอบอัตโนมัติ (Playwright + TypeScript, รูปแบบ Page Object Model + Data-Driven)
สำหรับฟีเจอร์ **เพิ่มรายชื่อลูกค้าใหม่** บนระบบ Arincare Pharmacy (staging)

อ้างอิง Test Case ทั้งหมดที่ไฟล์ **`Arincare_Customer_TestCases.xlsx`** (63 เคส + 17 ชุด data-driven)

---

## โครงสร้างโปรเจกต์
```
arincare-customer-tests/
├─ data/customer.testdata.ts        # ชุดข้อมูลทดสอบ data-driven (มือถือ/อีเมล/ราคา/security)
├─ pages/
│  ├─ LoginPage.ts                  # login + เลือกบริษัท
│  └─ CustomerFormPage.ts           # ฟอร์มลูกค้า + ทุก Tab + ค้นหา/รายละเอียด
├─ tests/
│  ├─ fixtures.ts                   # login อัตโนมัติ + inject page objects
│  ├─ customer-create.positive.spec.ts
│  ├─ customer-create.validation.spec.ts
│  └─ customer-create.e2e.spec.ts
├─ utils/helpers.ts                 # บันทึก screenshot
├─ playwright.config.ts
├─ .env.example
└─ package.json
```

## ติดตั้ง
```bash
npm install
npx playwright install chromium
cp .env.example .env        # แล้วแก้ค่า credential ใน .env
```

## รัน
```bash
npm test                    # รันทั้งหมด (headless)
npm run test:headed         # เห็น browser
npm run test:ui             # โหมด UI ของ Playwright
npm run test:smoke          # เฉพาะ smoke (@smoke)
npm run test:validation     # เฉพาะชุด validation
npm run test:e2e            # เฉพาะ E2E ครบทุก Tab
npm run report              # เปิดรายงาน HTML
```
Screenshot ทุกเทสจะถูกบันทึกไว้ที่โฟลเดอร์ `screenshots/` และแนบใน `playwright-report/`

---

## ⚠️ สิ่งที่ต้องยืนยันก่อนรันจริง (Selector)
Selector ในโค้ดอ้างอิงจาก **placeholder/label ภาษาไทยที่เห็นบนหน้าจอ** ซึ่งครอบคลุมเคสส่วนใหญ่
แต่บางจุด (dropdown จังหวัด/อำเภอ/ตำบล, ระดับราคา, เมนูซ้าย, ช่องค้นหา, ข้อความ toast)
อาจต่างจาก DOM จริง — แนะนำรันครั้งแรกด้วย:
```bash
npm run codegen
```
แล้วคลิกแต่ละช่องเพื่อยืนยัน selector จากนั้นปรับที่ map ใน `pages/CustomerFormPage.ts` (object `P`) จุดเดียว

> ระบบจริงมี Mandatory field เพียงตัวเดียวคือ **มือถือ / เบอร์หลัก** (มี `*` สีแดง)
> เคส validation อีเมล/เลขภาษี/วันเกิด ตั้ง expected ตาม business rule มาตรฐาน —
> หากระบบไม่ validate ฝั่ง client ให้ปรับ `expect` ใน `data/customer.testdata.ts`

## หมายเหตุการออกแบบเทส
- **เทคนิค:** Equivalence Partitioning, Boundary Value Analysis, Decision Table, Negative & Security testing
- **มาตรฐาน:** ISTQB / IEEE 829
- เบอร์มือถือใน positive case ใช้ `uniqueMobile()` เติม timestamp กันชนกับข้อมูลเดิม/เคสซ้ำ
- เคส `INFO` (เช่น +66) จะ **ไม่ fail** แต่บันทึก screenshot พฤติกรรมจริงไว้พิจารณา
