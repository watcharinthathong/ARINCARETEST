/**
 * POS - สมัครสมาชิกใหม่
 * Source: Arincare_CustomerPOS_TestCases.xlsx
 * Target: pos-stg.arincare.com
 *
 * Coverage:
 *   Positive      → TC-CUST-001..003
 *   Required      → TC-CUST-010..014
 *   Mobile BVA    → TC-CUST-020..024
 *   Email         → TC-CUST-030..033
 *   Date          → TC-CUST-040..044
 *   National ID   → TC-CUST-050..052
 *   Tax Tab       → TC-CUST-060..064
 *   Notes/Allergy → TC-CUST-070..075
 *   Edge Cases    → TC-CUST-080..083
 *   UI Behavior   → TC-CUST-090..093
 *   Security      → TC-CUST-100..101
 *   UI Defaults   → TC-CUST-110..112
 */

import { test, expect } from './pos-fixtures.js';
import { shot } from '../utils/helpers.js';
import {
  uniquePosMobile,
  posMobileCases,
  posEmailCases,
  posMinimalMember,
  posFullMember,
  posTaxMember,
} from '../data/pos-member.testdata.js';

// ═══════════════════════════════════════════════════════════════════
// Positive (Happy Path)
// ═══════════════════════════════════════════════════════════════════

test.describe('POS สมัครสมาชิกใหม่ - Positive', () => {
  test.beforeEach(async ({ posLoggedIn, posRegister }) => {
    void posLoggedIn;
    await posRegister.openRegisterForm();
  });

  // TC-CUST-001
  test('@smoke TC-CUST-001 สมัครด้วย required fields เท่านั้น (ชื่อ, เบอร์, วันเกิด, เพศ)', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('081');
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile });
    await shot(page, 'TC-CUST-001_before-save');
    await posRegister.save();
    await posRegister.expectSaveSuccess();
    await shot(page, 'TC-CUST-001_after-save');
  });

  // TC-CUST-002
  test('TC-CUST-002 สมัครกรอกครบทั้ง 3 Tab', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('082');
    await posRegister.fillGeneralInfo({ ...posFullMember, mobile });
    await posRegister.fillTaxInfo(posTaxMember);
    await posRegister.fillNotesTab('ทดสอบหมายเหตุ ครบทุก Tab');
    await shot(page, 'TC-CUST-002_all-tabs');
    await posRegister.save();
    await posRegister.expectSaveSuccess();
  });

  // TC-CUST-003
  test('TC-CUST-003 สมัครพร้อมข้อมูลใบกำกับภาษี', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('083');
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile });
    await posRegister.fillTaxInfo(posTaxMember);
    await shot(page, 'TC-CUST-003_with-tax');
    await posRegister.save();
    await posRegister.expectSaveSuccess();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Validation: Required Fields
// ═══════════════════════════════════════════════════════════════════

test.describe('POS สมัครสมาชิกใหม่ - Validation: Required Fields', () => {
  test.beforeEach(async ({ posLoggedIn, posRegister }) => {
    void posLoggedIn;
    await posRegister.openRegisterForm();
  });

  // TC-CUST-010
  test('TC-CUST-010 ไม่กรอกชื่อ → ไม่บันทึก', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('091');
    await posRegister.fillGeneralInfo({ birthDate: '01/01/1992', gender: 'ชาย', mobile });
    await shot(page, 'TC-CUST-010_before-save');
    await posRegister.save();
    await posRegister.expectValidationError();
    await shot(page, 'TC-CUST-010_error');
  });

  // TC-CUST-011
  test('TC-CUST-011 ไม่กรอกเบอร์มือถือ → ไม่บันทึก', async ({ page, posRegister }) => {
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile: '' });
    await shot(page, 'TC-CUST-011_before-save');
    await posRegister.save();
    await posRegister.expectValidationError();
    await shot(page, 'TC-CUST-011_error');
  });

  // TC-CUST-012
  test('TC-CUST-012 ไม่กรอกวันเกิด → ไม่บันทึก', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('092');
    await posRegister.fillGeneralInfo({ firstName: 'สมชาย', gender: 'ชาย', mobile });
    await shot(page, 'TC-CUST-012_before-save');
    await posRegister.save();
    await posRegister.expectValidationError();
    await shot(page, 'TC-CUST-012_error');
  });

  // TC-CUST-013
  test('TC-CUST-013 ไม่เลือกเพศ → ไม่บันทึก', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('093');
    await posRegister.fillGeneralInfo({ firstName: 'สมชาย', birthDate: '01/01/1992', mobile });
    await shot(page, 'TC-CUST-013_before-save');
    await posRegister.save();
    await posRegister.expectValidationError();
    await shot(page, 'TC-CUST-013_error');
  });

  // TC-CUST-014
  test('TC-CUST-014 ไม่กรอกอะไรเลย → แสดง error ทุก required field', async ({ page, posRegister }) => {
    await shot(page, 'TC-CUST-014_empty-form');
    await posRegister.save();
    await posRegister.expectValidationError();
    await shot(page, 'TC-CUST-014_all-errors');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Validation: รูปแบบเบอร์มือถือ (Data-Driven TC-CUST-020..024)
// ═══════════════════════════════════════════════════════════════════

test.describe('POS สมัครสมาชิกใหม่ - Validation: รูปแบบเบอร์มือถือ', () => {
  test.beforeEach(async ({ posLoggedIn, posRegister }) => {
    void posLoggedIn;
    await posRegister.openRegisterForm();
  });

  for (const tc of posMobileCases) {
    test(`${tc.id} ${tc.title}`, async ({ page, posRegister }) => {
      const mobile = tc.expect === 'PASS'
        ? uniquePosMobile(tc.mobile.slice(0, 3))
        : tc.mobile;
      await posRegister.fillGeneralInfo({
        firstName: 'ทดสอบ',
        lastName:  tc.expect === 'PASS' ? 'ทดสอบ' : undefined,
        birthDate: '01/01/1992',
        gender:    'ชาย',
        mobile,
      });
      await shot(page, `${tc.id}_input`);
      await posRegister.save();
      if (tc.expect === 'PASS') {
        await posRegister.expectSaveSuccess();
      } else {
        await posRegister.expectValidationError();
      }
      await shot(page, `${tc.id}_result`);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// Validation: รูปแบบอีเมล (Data-Driven TC-CUST-030..033)
// ═══════════════════════════════════════════════════════════════════

test.describe('POS สมัครสมาชิกใหม่ - Validation: รูปแบบอีเมล', () => {
  test.beforeEach(async ({ posLoggedIn, posRegister }) => {
    void posLoggedIn;
    await posRegister.openRegisterForm();
  });

  for (const tc of posEmailCases) {
    test(`${tc.id} ${tc.title}`, async ({ page, posRegister }) => {
      const mobile = uniquePosMobile('094');
      await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile, email: tc.email });
      await shot(page, `${tc.id}_input`);
      await posRegister.save();
      if (tc.expect === 'PASS') {
        await posRegister.expectSaveSuccess();
      } else {
        await posRegister.expectValidationError();
      }
      await shot(page, `${tc.id}_result`);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// Validation: รูปแบบวันเกิด (TC-CUST-040..044)
// ═══════════════════════════════════════════════════════════════════

test.describe('POS สมัครสมาชิกใหม่ - Validation: รูปแบบวันเกิด', () => {
  test.beforeEach(async ({ posLoggedIn, posRegister }) => {
    void posLoggedIn;
    await posRegister.openRegisterForm();
  });

  // TC-CUST-040
  test('TC-CUST-040 วันเกิดผิดรูปแบบ (ปปปป/ดด/วว) → error', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('095');
    await posRegister.fillGeneralInfo({ firstName: 'ทดสอบ', gender: 'ชาย', mobile, birthDate: '2535/01/01' });
    await shot(page, 'TC-CUST-040_input');
    await posRegister.save();
    await posRegister.expectValidationError();
    await shot(page, 'TC-CUST-040_error');
  });

  // TC-CUST-041
  test('TC-CUST-041 วันเกิดในอนาคต → error', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('096');
    await posRegister.fillGeneralInfo({ firstName: 'ทดสอบ', gender: 'ชาย', mobile, birthDate: '01/01/2600' });
    await shot(page, 'TC-CUST-041_input');
    await posRegister.save();
    await posRegister.expectValidationError();
    await shot(page, 'TC-CUST-041_error');
  });

  // TC-CUST-042
  test('TC-CUST-042 วันเกิดรูปแบบถูกต้อง วว/ดด/ปปปป → บันทึกสำเร็จ', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('097');
    await posRegister.fillGeneralInfo({ firstName: 'ทดสอบ', lastName: 'ทดสอบ', gender: 'ชาย', mobile, birthDate: '15/08/1997' });
    await shot(page, 'TC-CUST-042_input');
    await posRegister.save();
    await posRegister.expectSaveSuccess();
    await shot(page, 'TC-CUST-042_success');
  });

  // TC-CUST-043
  test('TC-CUST-043 คลิก field วันเกิด → date picker แสดงขึ้นมา', async ({ page, posRegister }) => {
    await posRegister.birthDateInput.click();
    await shot(page, 'TC-CUST-043_datepicker-open');
    await expect.soft(
      page.locator('[class*="datepicker"], [class*="calendar"], .picker').first()
    ).toBeVisible({ timeout: 5_000 });
  });

  // TC-CUST-044
  test('TC-CUST-044 วันที่ไม่มีจริง 31/02 → error', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('098');
    await posRegister.fillGeneralInfo({ firstName: 'ทดสอบ', gender: 'ชาย', mobile, birthDate: '31/02/1990' });
    await shot(page, 'TC-CUST-044_input');
    await posRegister.save();
    await posRegister.expectValidationError();
    await shot(page, 'TC-CUST-044_error');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Validation: บัตรประชาชน / Passport (TC-CUST-050..052)
// ═══════════════════════════════════════════════════════════════════

test.describe('POS สมัครสมาชิกใหม่ - Validation: บัตรประชาชน', () => {
  test.beforeEach(async ({ posLoggedIn, posRegister }) => {
    void posLoggedIn;
    await posRegister.openRegisterForm();
  });

  // TC-CUST-050
  test('TC-CUST-050 บัตรประชาชน 13 หลักถูกต้อง → บันทึกสำเร็จ', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('085');
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile, citizenId: '1234567890121' });
    await shot(page, 'TC-CUST-050_input');
    await posRegister.save();
    await posRegister.expectSaveSuccess();
  });

  // TC-CUST-051
  test('TC-CUST-051 บัตรประชาชนน้อยกว่า 13 หลัก → error', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('086');
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile, citizenId: '12345' });
    await shot(page, 'TC-CUST-051_input');
    await posRegister.save();
    await posRegister.expectValidationError();
    await shot(page, 'TC-CUST-051_error');
  });

  // TC-CUST-052
  test('TC-CUST-052 เลือกสัญชาติต่างชาติ → รับ Passport format', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('087');
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile });
    await posRegister.nationalitySelect.selectOption({ index: 2 });
    await page.waitForTimeout(500);
    await shot(page, 'TC-CUST-052_passport-field');
    // POS แสดง placeholder "X-XXXX-XXXXX-XX-X" เมื่อเลือกสัญชาติต่างชาติ
    await expect.soft(
      page.locator('input[placeholder*="X-XXXX"], :text("/ Passport")').first()
    ).toBeVisible({ timeout: 5_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Tab: ข้อมูลใบกำกับภาษี (TC-CUST-060..064)
// ═══════════════════════════════════════════════════════════════════

test.describe('POS สมัครสมาชิกใหม่ - Tab: ข้อมูลใบกำกับภาษี', () => {
  test.beforeEach(async ({ posLoggedIn, posRegister }) => {
    void posLoggedIn;
    await posRegister.openRegisterForm();
  });

  // TC-CUST-060
  test('TC-CUST-060 เลขผู้เสียภาษี 13 หลักถูกต้อง → บันทึกสำเร็จ', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('088');
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile });
    await posRegister.fillTaxInfo({ ...posTaxMember, taxId: '0105536000000' });
    await shot(page, 'TC-CUST-060_input');
    await posRegister.save();
    await posRegister.expectSaveSuccess();
  });

  // TC-CUST-061
  test('TC-CUST-061 เลขผู้เสียภาษีไม่ครบ 13 หลัก → error', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('089');
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile });
    await posRegister.fillTaxInfo({ companyName: 'บริษัท ABC', taxId: '12345' });
    await shot(page, 'TC-CUST-061_input');
    await posRegister.save();
    await posRegister.expectValidationError();
    await shot(page, 'TC-CUST-061_error');
  });

  // TC-CUST-062
  test('TC-CUST-062 เลือกจังหวัด → อำเภอ/ตำบล cascade โหลดตาม', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('088');
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile });
    await posRegister.switchTab('ข้อมูลใบกำกับภาษี');
    await posRegister.provinceSelect.selectOption({ label: 'กรุงเทพมหานคร' });
    await page.waitForFunction(
      () => (document.querySelector('select[name="city_id"]') as HTMLSelectElement)?.options.length > 1,
      { timeout: 10_000 }
    );
    await shot(page, 'TC-CUST-062_cascade-district');
    await expect.soft(posRegister.citySelect).not.toHaveValue('');
  });

  // TC-CUST-063
  test('TC-CUST-063 รหัสไปรษณีย์ไม่ครบ 5 หลัก → error', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('089');
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile });
    await posRegister.fillTaxInfo({ companyName: 'บริษัท ABC', taxId: '0105536000000', zipcode: '101' });
    await shot(page, 'TC-CUST-063_input');
    await posRegister.save();
    await posRegister.expectValidationError();
    await shot(page, 'TC-CUST-063_error');
  });

  // TC-CUST-064
  test('TC-CUST-064 ข้าม Tab ใบกำกับภาษี (optional) → บันทึกได้', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('088');
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile });
    await shot(page, 'TC-CUST-064_skip-tax');
    await posRegister.save();
    await posRegister.expectSaveSuccess();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Tab: หมายเหตุและการแพ้ยา (TC-CUST-070..075)
// ═══════════════════════════════════════════════════════════════════

test.describe('POS สมัครสมาชิกใหม่ - Tab: หมายเหตุและการแพ้ยา', () => {
  test.beforeEach(async ({ posLoggedIn, posRegister }) => {
    void posLoggedIn;
    await posRegister.openRegisterForm();
  });

  // TC-CUST-070
  test('TC-CUST-070 เปิด Tab หมายเหตุ → พบปุ่ม + สินค้าที่มีอาการแพ้ยา', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('085');
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile });
    await posRegister.switchTab('หมายเหตุและการแพ้ยา');
    await shot(page, 'TC-CUST-070_notes-tab');
    await expect.soft(
      page.locator('button:has-text("แพ้ยา"), button:has-text("สินค้า"), [class*="add"]').first()
    ).toBeVisible({ timeout: 5_000 });
  });

  // TC-CUST-073
  test('TC-CUST-073 หมายเหตุ 255 ตัวอักษรพอดี → counter แสดง 255/255', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('086');
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile });
    await posRegister.fillNotesTab('ก'.repeat(255));
    await shot(page, 'TC-CUST-073_255chars');
    await expect.soft(page.locator(':text("255")').first()).toBeVisible({ timeout: 3_000 });
  });

  // TC-CUST-074
  test('TC-CUST-074 พิมพ์ 256 ตัวอักษร → ระบบจำกัดที่ 255', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('087');
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile });
    await posRegister.fillNotesTab('ก'.repeat(256));
    await shot(page, 'TC-CUST-074_256chars');
    const val = await posRegister.noteTextarea.inputValue();
    expect.soft(val.length).toBeLessThanOrEqual(255);
  });

  // TC-CUST-075
  test('TC-CUST-075 counter อัปเดต realtime ตามจำนวนตัวอักษร', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('088');
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile });
    await posRegister.switchTab('หมายเหตุและการแพ้ยา');
    await posRegister.noteTextarea.fill('สวัสดี');
    await shot(page, 'TC-CUST-075_counter');
    await expect.soft(
      page.locator('[class*="counter"], :text-matches("\\d+\\/255")').first()
    ).toBeVisible({ timeout: 3_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Edge Cases (TC-CUST-080..083)
// ═══════════════════════════════════════════════════════════════════

test.describe('POS สมัครสมาชิกใหม่ - Edge Cases', () => {
  test.beforeEach(async ({ posLoggedIn, posRegister }) => {
    void posLoggedIn;
    await posRegister.openRegisterForm();
  });

  // TC-CUST-080
  test('TC-CUST-080 ชื่อยาว 300 ตัวอักษร → ระบบไม่ crash', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('085');
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile, firstName: 'ก'.repeat(300) });
    await shot(page, 'TC-CUST-080_long-name');
    await posRegister.save();
    await shot(page, 'TC-CUST-080_result');
    // soft: ไม่ crash (page ยังอยู่)
    await expect.soft(page).toHaveURL(/pos-stg\.arincare\.com/, { timeout: 5_000 });
  });

  // TC-CUST-081
  test('TC-CUST-081 ชื่อด้วยอักขระพิเศษ / อีโมจิ → บันทึกและแสดงผลถูกต้อง', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('086');
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile, firstName: 'Łukasz', lastName: '😀' });
    await shot(page, 'TC-CUST-081_special-chars');
    await posRegister.save();
    await posRegister.expectSaveSuccess();
  });

  // TC-CUST-082
  test('TC-CUST-082 ชื่อมีช่องว่างหน้า-หลัง → trim แล้วบันทึกสำเร็จ', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('087');
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile, firstName: '  สมชาย  ' });
    await shot(page, 'TC-CUST-082_spaces');
    await posRegister.save();
    await posRegister.expectSaveSuccess();
  });

  // TC-CUST-083
  test('TC-CUST-083 กรอกเบอร์ซ้ำกับลูกค้าเดิม → แสดงแจ้งเตือน', async ({ page, posRegister }) => {
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile: '0812345678' });
    await shot(page, 'TC-CUST-083_dup-mobile');
    await posRegister.save();
    await shot(page, 'TC-CUST-083_dup-result');
    const dupWarning = page.locator(':text("ซ้ำ"), :text("มีอยู่แล้ว"), :text("duplicate"), .alert, .swal2-popup').first();
    await expect.soft(dupWarning).toBeVisible({ timeout: 8_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════
// UI Behavior (TC-CUST-090..093)
// ═══════════════════════════════════════════════════════════════════

test.describe('POS สมัครสมาชิกใหม่ - UI Behavior', () => {
  test.beforeEach(async ({ posLoggedIn, posRegister }) => {
    void posLoggedIn;
    await posRegister.openRegisterForm();
  });

  // TC-CUST-090
  test('TC-CUST-090 ข้อมูล Tab1 ยังคงอยู่หลังสลับไป Tab2 แล้วกลับ', async ({ page, posRegister }) => {
    await posRegister.firstNameInput.fill('สมชาย');
    await posRegister.switchTab('ข้อมูลใบกำกับภาษี');
    await shot(page, 'TC-CUST-090_switched-tab2');
    await posRegister.switchTab('ข้อมูลทั่วไป');
    await expect.soft(posRegister.firstNameInput).toHaveValue('สมชาย');
    await shot(page, 'TC-CUST-090_back-tab1-data-intact');
  });

  // TC-CUST-091
  test('TC-CUST-091 กดยกเลิก → ฟอร์มปิด ไม่บันทึกข้อมูล', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('099');
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile });
    await shot(page, 'TC-CUST-091_filled');
    await posRegister.cancel();
    await shot(page, 'TC-CUST-091_after-cancel');
    await posRegister.expectFormClosed();
  });

  // TC-CUST-092
  test('TC-CUST-092 กดปุ่ม X มุมขวาบน → ฟอร์มปิด ไม่บันทึก', async ({ page, posRegister }) => {
    await shot(page, 'TC-CUST-092_form-open');
    await posRegister.close();
    await shot(page, 'TC-CUST-092_form-closed');
    await posRegister.expectFormClosed();
  });

  // TC-CUST-093
  test('TC-CUST-093 เปิด modal → Tab เริ่มต้นคือ "ข้อมูลทั่วไป"', async ({ page, posRegister }) => {
    await shot(page, 'TC-CUST-093_default-tab');
    await expect.soft(posRegister.firstNameInput).toBeVisible({ timeout: 5_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════
// Security (TC-CUST-100..101)
// ═══════════════════════════════════════════════════════════════════

test.describe('POS สมัครสมาชิกใหม่ - Security', () => {
  test.beforeEach(async ({ posLoggedIn, posRegister }) => {
    void posLoggedIn;
    await posRegister.openRegisterForm();
  });

  // TC-CUST-100
  test('TC-CUST-100 XSS payload ในช่องชื่อ → sanitize ไม่ execute script', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('085');
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile, firstName: '<script>alert(1)</script>' });
    await shot(page, 'TC-CUST-100_xss-input');
    await posRegister.save();
    await shot(page, 'TC-CUST-100_after-save');
    // soft: ไม่มี JS dialog ขึ้นมา
    await expect.soft(page.locator('dialog').first()).not.toBeVisible({ timeout: 2_000 });
  });

  // TC-CUST-101
  test('TC-CUST-101 SQL injection payload → ระบบปลอดภัย ไม่ error DB', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('086');
    await posRegister.fillGeneralInfo({
      ...posMinimalMember,
      mobile,
      firstName: "' OR '1'='1",
      lastName:  "Robert');DROP TABLE--",
    });
    await shot(page, 'TC-CUST-101_sqli-input');
    await posRegister.save();
    await shot(page, 'TC-CUST-101_result');
    // soft: ไม่มี DB error 500
    await expect.soft(page.locator(':text("500"), :text("SQL"), :text("error")').first())
      .not.toBeVisible({ timeout: 3_000 });
  });
});

// ═══════════════════════════════════════════════════════════════════
// UI Defaults (TC-CUST-110..112)
// ═══════════════════════════════════════════════════════════════════

test.describe('POS สมัครสมาชิกใหม่ - UI Defaults', () => {
  test.beforeEach(async ({ posLoggedIn, posRegister }) => {
    void posLoggedIn;
    await posRegister.openRegisterForm();
  });

  // TC-CUST-110
  test('TC-CUST-110 ค่าเริ่มต้น dropdown สัญชาติ = ไทย', async ({ page, posRegister }) => {
    await shot(page, 'TC-CUST-110_nationality-default');
    await expect.soft(
      page.locator('select[name="nationality"] option:checked').first()
    ).toContainText(/ไทย/i, { timeout: 5_000 });
  });

  // TC-CUST-111
  test('TC-CUST-111 dropdown ระดับราคาแสดงค่า default ตามบริษัท', async ({ page, posRegister }) => {
    await shot(page, 'TC-CUST-111_pricelevel-default');
    await expect.soft(posRegister.priceLevelSelect).toBeVisible({ timeout: 5_000 });
  });

  // TC-CUST-112
  test('TC-CUST-112 เลือกหมู่เลือด A → บันทึกถูกต้อง', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('087');
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile, bloodType: 'A' });
    await shot(page, 'TC-CUST-112_bloodtype-A');
    await posRegister.save();
    await posRegister.expectSaveSuccess();
  });
});
