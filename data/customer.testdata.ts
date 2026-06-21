/**
 * ชุดข้อมูลทดสอบ (Data-Driven) สำหรับการเพิ่มลูกค้าใหม่
 * อ้างอิงตาม Arincare_Customer_TestCases.xlsx (sheet "Test Data")
 */

export type ExpectKind = 'PASS' | 'FAIL' | 'INFO';

export interface CustomerInput {
  prefix?: string;        // คำนำหน้า
  firstName?: string;     // ชื่อจริง
  lastName?: string;      // นามสกุล
  companyName?: string;   // ชื่อบริษัท
  contactName?: string;   // ชื่อผู้ติดต่อสำหรับบริษัท
  taxId?: string;         // เลขประจำตัวผู้เสียภาษี
  occupation?: string;    // อาชีพ
  mobile?: string;        // * มือถือ / เบอร์หลัก  (Mandatory)
  phone?: string;         // เบอร์โทรศัพท์
  fax?: string;           // หมายเลข FAX
  email?: string;         // อีเมล
  website?: string;       // Website
  nationalId?: string;    // เลขที่บัตรประชาชน / Passport
  nationality?: string;   // สัญชาติ
  birthDate?: string;     // วันเกิด (YYYY-MM-DD)
  gender?: string;        // เพศ
  bloodType?: string;     // หมู่เลือด
  // Tab ที่อยู่
  placeName?: string;
  address1?: string;
  address2?: string;
  province?: string;
  district?: string;
  subDistrict?: string;
  postalCode?: string;
  // Tab ราคาขาย
  priceLevel?: string;
  // Tab ข้อมูลทางยา
  allergyProduct?: string;
  allergyGeneric?: string;
  chronicDisease?: string;
  // Tab หมายเหตุ
  note?: string;
}

export interface MandatoryCase {
  id: string;
  title: string;
  mobile: string;
  expect: ExpectKind;
  note: string;
}

/** unique เบอร์มือถือกันชนกับข้อมูลเดิม (เติม timestamp ใน spec) */
export const uniqueMobile = (seed: string) =>
  seed.slice(0, 3) + Date.now().toString().slice(-7);

/* ---------------------------------------------------------------
 * DD: เบอร์มือถือ (required) — EP + BVA  → TC-CUST-020..026, 010, 011
 * ------------------------------------------------------------- */
export const mobileCases: MandatoryCase[] = [
  { id: 'DD-01', title: 'มือถือ valid 10 หลัก',    mobile: '0812345678',        expect: 'PASS', note: 'บันทึกสำเร็จ' },
  { id: 'DD-02', title: 'มือถือว่าง',              mobile: '',                  expect: 'FAIL', note: 'required error' },
  { id: 'DD-03', title: 'มือถือเป็นช่องว่าง',       mobile: '   ',               expect: 'FAIL', note: 'required error (trim)' },
  { id: 'DD-04', title: 'มือถือเป็นตัวอักษร',       mobile: 'abcdefghij',        expect: 'FAIL', note: 'format error' },
  { id: 'DD-05', title: 'มือถือมีขีดคั่น',          mobile: '081-234-5678',      expect: 'FAIL', note: 'error/normalize' },
  { id: 'DD-06', title: 'มือถือสั้นกว่ากำหนด',      mobile: '08123',             expect: 'FAIL', note: 'format error' },
  { id: 'DD-07', title: 'มือถือยาวเกินกำหนด',       mobile: '081234567890123',   expect: 'FAIL', note: 'format error/limit' },
  { id: 'DD-08', title: 'มือถือรูปแบบ +66',         mobile: '+66812345678',      expect: 'INFO', note: 'ตามนโยบายระบบ' },
];

/* ---------------------------------------------------------------
 * DD: อีเมล — EP  → TC-CUST-030..036
 * ------------------------------------------------------------- */
export interface EmailCase { id: string; title: string; email: string; expect: ExpectKind; note: string; }
export const emailCases: EmailCase[] = [
  { id: 'EM-01', title: 'อีเมลถูกต้อง',         email: 'test@example.com',      expect: 'PASS', note: 'บันทึกสำเร็จ' },
  { id: 'EM-02', title: 'อีเมลไม่มี @',         email: 'testexample.com',       expect: 'FAIL', note: 'email format error' },
  { id: 'EM-03', title: 'อีเมลไม่มี domain',    email: 'test@',                 expect: 'FAIL', note: 'email format error' },
  { id: 'EM-04', title: 'อีเมลไม่มี local',     email: '@example.com',          expect: 'FAIL', note: 'email format error' },
  { id: 'EM-05', title: 'อีเมลมีช่องว่าง',      email: 'te st@example.com',     expect: 'FAIL', note: 'email format error' },
  { id: 'EM-06', title: 'อีเมลมี + (valid)',    email: 'test+tag@example.com',  expect: 'PASS', note: 'บันทึกสำเร็จ' },
  { id: 'EM-07', title: 'อีเมลว่าง (optional)', email: '',                      expect: 'PASS', note: 'บันทึกสำเร็จ' },
];

/* ---------------------------------------------------------------
 * DD: ระดับราคาขาย  → TC-PRICE-002/003
 * ------------------------------------------------------------- */
export const priceLevels = [
  'ราคาระดับสูงสุด (level 1)',
  'ราคาระดับสูง (level 2)',
  'ราคาระดับกลาง (level 3)',
  'ราคาระดับต่ำ (level 4)',
  'ราคาระดับต่ำสุด (level 5)',
];

/* ---------------------------------------------------------------
 * DD: Security payloads  → TC-SEC-001/002
 * ------------------------------------------------------------- */
export const securityPayloads = [
  { id: 'SEC-01', title: 'XSS',  payload: `<script>alert('xss')</script>` },
  { id: 'SEC-02', title: 'SQLi', payload: `' OR '1'='1` },
];

/* ---------------------------------------------------------------
 * ชุดข้อมูลหลักตาม scenario (TC-CUST-004 / E2E)
 * ------------------------------------------------------------- */
export const fullCustomer: CustomerInput = {
  prefix: 'นาย',
  firstName: 'Test',
  lastName: 'Customer',
  companyName: 'Test Customer Company',
  contactName: 'Test Customer',
  phone: '0812345678',
  email: 'test.customer@example.com',
  placeName: 'สำนักงานใหญ่',
  address1: '99/99 อาคารทดสอบ ถนนพระราม 9',
  province: 'กรุงเทพมหานคร',
  district: 'เขตห้วยขวาง',
  subDistrict: 'ห้วยขวาง',
  postalCode: '10310',
  priceLevel: 'ราคาระดับสูงสุด (level 1)',
  note: 'สร้างข้อมูลสำหรับทดสอบระบบโดย Codex',
};
