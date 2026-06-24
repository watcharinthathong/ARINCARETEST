/**
 * ชุดข้อมูลทดสอบ POS - สมัครสมาชิกใหม่
 * อ้างอิง: Arincare_CustomerPOS_TestCases.xlsx
 * Required fields: ชื่อ, เบอร์มือถือ, วันเกิด, เพศ
 */

export interface PosMemberInput {
  // Tab 1: ข้อมูลทั่วไป (required: firstName, mobile, birthDate, gender)
  firstName?: string;
  lastName?: string;
  mobile?: string;
  email?: string;
  birthDate?: string;   // รูปแบบ วว/ดด/ปปปป (Gregorian)
  gender?: string;
  nationality?: string;
  citizenId?: string;
  occupation?: string;
  bloodType?: string;
  priceLevel?: string;
  // Tab 3: หมายเหตุและการแพ้ยา
  note?: string;
  // Tab 2: ข้อมูลใบกำกับภาษี
  companyName?: string;
  taxId?: string;
  contactName?: string;
  phoneNumber?: string;
  locationName?: string;
  province?: string;
  city?: string;      // อำเภอ/เขต
  district?: string;  // ตำบล/แขวง
  address1?: string;
  address2?: string;
  zipcode?: string;
}

export interface PosMobileCase {
  id: string;
  title: string;
  mobile: string;
  expect: 'PASS' | 'FAIL';
  note: string;
}

export interface PosEmailCase {
  id: string;
  title: string;
  email: string;
  expect: 'PASS' | 'FAIL';
  note: string;
}

/** unique เบอร์มือถือเพื่อป้องกัน duplicate กับข้อมูลเดิมใน staging */
export const uniquePosMobile = (seed: string) =>
  seed.slice(0, 3) + Date.now().toString().slice(-7);

/* ---------------------------------------------------------------
 * TC-CUST-020..024: เบอร์มือถือ — BVA + Format
 * ------------------------------------------------------------- */
export const posMobileCases: PosMobileCase[] = [
  { id: 'TC-CUST-022', title: 'เบอร์ 10 หลักถูกต้อง (valid)',       mobile: '0812345678',   expect: 'PASS', note: 'BVA: exactly 10 digits' },
  { id: 'TC-CUST-020', title: 'เบอร์ 9 หลัก (สั้นเกิน)',            mobile: '081234567',    expect: 'FAIL', note: 'BVA: below min' },
  { id: 'TC-CUST-021', title: 'เบอร์มีตัวอักษร',                    mobile: '08abcd5678',   expect: 'FAIL', note: 'format: non-numeric' },
  { id: 'TC-CUST-023', title: 'เบอร์ 11 หลัก (เกิน)',               mobile: '08123456789',  expect: 'FAIL', note: 'BVA: above max' },
  { id: 'TC-CUST-024', title: 'เบอร์มีขีดคั่น / เว้นวรรค',         mobile: '081-234-5678', expect: 'FAIL', note: 'format: dashes or spaces' },
];

/* ---------------------------------------------------------------
 * TC-CUST-030..033: อีเมล — Format validation
 * ------------------------------------------------------------- */
export const posEmailCases: PosEmailCase[] = [
  { id: 'TC-CUST-032', title: 'อีเมล valid รูปแบบถูกต้อง',    email: 'somchai.test@gmail.com', expect: 'PASS', note: 'valid format' },
  { id: 'TC-CUST-033', title: 'อีเมลว่าง (optional field)',    email: '',                       expect: 'PASS', note: 'email is optional' },
  { id: 'TC-CUST-030', title: 'อีเมลไม่มี @ → format error',  email: 'somchaigmail.com',       expect: 'FAIL', note: 'missing @' },
  { id: 'TC-CUST-031', title: 'อีเมลไม่มี domain → error',    email: 'somchai@',               expect: 'FAIL', note: 'missing domain' },
];

/* ---------------------------------------------------------------
 * ชุดข้อมูลหลัก
 * ------------------------------------------------------------- */

/**
 * ข้อมูลขั้นต่ำ: required fields (TC-CUST-001)
 * NOTE: POS form กำหนด นามสกุล เป็น required ด้วย (แม้ Excel TC-CUST-001 ไม่ได้ระบุ)
 */
export const posMinimalMember: PosMemberInput = {
  firstName: 'สมชาย',
  lastName:  'ทดสอบ',
  birthDate: '01/01/1992',  // 2535 พ.ศ. = 1992 ค.ศ.
  gender:    'ชาย',
};

/** ข้อมูลครบ Tab ข้อมูลทั่วไป (TC-CUST-002) */
export const posFullMember: PosMemberInput = {
  firstName:  'สมชาย',
  lastName:   'ใจดี',
  birthDate:  '15/08/1997',
  gender:     'ชาย',
  email:      'pos.test@example.com',
  occupation: 'วิศวกร',
  bloodType:  'A',
};

/** ข้อมูล Tab ใบกำกับภาษี (TC-CUST-003, 060) */
export const posTaxMember: PosMemberInput = {
  companyName:  'บริษัท ABC จำกัด',
  taxId:        '0105536000000',
  contactName:  'สมชาย ใจดี',
  phoneNumber:  '021234567',
  locationName: 'สำนักงานใหญ่',
};
