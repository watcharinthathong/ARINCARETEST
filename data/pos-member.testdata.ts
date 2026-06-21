/**
 * ชุดข้อมูลทดสอบ POS - สมัครสมาชิกใหม่
 * อ้างอิง selectors จาก pos-selector-discovery/selectors.json
 */

export interface PosMemberInput {
  // Tab: ข้อมูลทั่วไป (required: firstName, lastName, mobile, gender)
  firstName?: string;
  lastName?: string;
  mobile?: string;
  email?: string;
  birthDate?: string;   // รูปแบบ วว/ดด/ปปปป (DD/MM/YYYY)
  gender?: string;
  nationality?: string;
  citizenId?: string;
  occupation?: string;
  bloodType?: string;
  priceLevel?: string;
  note?: string;
  // Tab: ข้อมูลใบกำกับภาษี
  companyName?: string;
  taxId?: string;
  contactName?: string;
  phoneNumber?: string;
  locationName?: string;
  province?: string;
  city?: string;     // อำเภอ/เขต
  district?: string; // ตำบล/แขวง
  address1?: string;
  address2?: string;
  zipcode?: string;
}

export interface PosMobileCase {
  id: string;
  title: string;
  mobile: string;
  expect: 'PASS' | 'FAIL' | 'INFO';
  note: string;
}

/** unique เบอร์มือถือเพื่อป้องกัน duplicate กับข้อมูลเดิมใน staging */
export const uniquePosMobile = (seed: string) =>
  seed.slice(0, 3) + Date.now().toString().slice(-7);

/* ---------------------------------------------------------------
 * DD: เบอร์มือถือ (required) — EP + BVA
 * ------------------------------------------------------------- */
export const posMobileCases: PosMobileCase[] = [
  { id: 'POS-VAL-01', title: 'เบอร์ valid 10 หลัก',   mobile: '0812345678',      expect: 'PASS', note: 'บันทึกสำเร็จ' },
  { id: 'POS-VAL-02', title: 'เบอร์ว่าง (required)',   mobile: '',                expect: 'FAIL', note: 'required error' },
  { id: 'POS-VAL-03', title: 'เบอร์เป็นตัวอักษร',     mobile: 'abcdefghij',      expect: 'FAIL', note: 'format error' },
  { id: 'POS-VAL-04', title: 'เบอร์สั้นกว่า 10 หลัก', mobile: '08123',           expect: 'FAIL', note: 'length error' },
  { id: 'POS-VAL-05', title: 'เบอร์ยาวเกิน 10 หลัก',  mobile: '081234567890123', expect: 'FAIL', note: 'length error' },
  { id: 'POS-VAL-06', title: 'เบอร์มีขีดคั่น',        mobile: '081-234-5678',    expect: 'FAIL', note: 'format error หรือ normalize' },
];

/* ---------------------------------------------------------------
 * ชุดข้อมูลหลัก
 * ------------------------------------------------------------- */

/** ข้อมูลขั้นต่ำ: กรอกเฉพาะ required fields (ชื่อ, นามสกุล, มือถือ, วันเกิด, เพศ) */
export const posMinimalMember: PosMemberInput = {
  firstName: 'Test',
  lastName:  'PosMin',
  birthDate: '01/01/1990', // รูปแบบ วว/ดด/ปปปป ตาม placeholder ของ POS
  gender:    'ชาย',
};

/** ข้อมูลครบ: กรอกทุก field ใน Tab ข้อมูลทั่วไป */
export const posFullMember: PosMemberInput = {
  firstName:  'Test',
  lastName:   'PosFull',
  gender:     'ชาย',
  email:      'pos.test@example.com',
  occupation: 'วิศวกร',
  bloodType:  'A',
  note:       'ทดสอบ POS สมัครสมาชิกใหม่ (ครบฟิลด์)',
};

/** ข้อมูลพร้อม Tab ใบกำกับภาษี */
export const posTaxMember: PosMemberInput = {
  firstName:    'Test',
  lastName:     'PosTax',
  gender:       'ชาย',
  companyName:  'Test POS Company',
  taxId:        '1234567890123',
  contactName:  'Test Contact',
  phoneNumber:  '021234567',
  locationName: 'สำนักงานใหญ่',
};
