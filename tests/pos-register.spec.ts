/**
 * Test Suite: POS - สมัครสมาชิกใหม่
 * Target: pos-stg.arincare.com
 *
 * Coverage:
 *   Positive   → POS-MEM-001..005
 *   Validation → POS-MEM-010..013, POS-VAL-* (data-driven)
 *   UI         → POS-MEM-020 (ยกเลิก)
 */

import { test, expect } from './pos-fixtures.js';
import { shot } from '../utils/helpers.js';
import {
  uniquePosMobile,
  posMobileCases,
  posMinimalMember,
  posFullMember,
  posTaxMember,
} from '../data/pos-member.testdata.js';

// ═══════════════════════════════════════════════════════════════════
// Positive Cases
// ═══════════════════════════════════════════════════════════════════

test.describe('POS สมัครสมาชิกใหม่ - Positive', () => {
  test.beforeEach(async ({ posLoggedIn, posRegister }) => {
    void posLoggedIn;
    await posRegister.openRegisterForm();
  });

  // POS-MEM-001
  test('@smoke POS-MEM-001 สมัครสมาชิกด้วยข้อมูลขั้นต่ำ (required fields)', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('081');
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile });
    await shot(page, 'POS-MEM-001_before-save');
    await posRegister.save();
    await posRegister.expectSaveSuccess();
    await shot(page, 'POS-MEM-001_after-save');
  });

  // POS-MEM-002
  test('POS-MEM-002 สมัครสมาชิกพร้อมอีเมล', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('082');
    await posRegister.fillGeneralInfo({
      ...posMinimalMember,
      mobile,
      email: 'pos.member@example.com',
    });
    await shot(page, 'POS-MEM-002_with-email');
    await posRegister.save();
    await posRegister.expectSaveSuccess();
  });

  // POS-MEM-003
  test('POS-MEM-003 สมัครสมาชิกพร้อมวันเกิด — ระบบคำนวณอายุอัตโนมัติ', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('083');
    await posRegister.fillGeneralInfo({
      ...posMinimalMember,
      mobile,
      birthDate: '15/01/1990',
    });
    // อายุควรถูก auto-fill หลังกรอกวันเกิด
    await shot(page, 'POS-MEM-003_birthdate');
    await posRegister.save();
    await posRegister.expectSaveSuccess();
  });

  // POS-MEM-004
  test('POS-MEM-004 สมัครสมาชิกกรอกครบ Tab ข้อมูลทั่วไป', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('084');
    await posRegister.fillGeneralInfo({ ...posFullMember, mobile });
    await shot(page, 'POS-MEM-004_full-general');
    await posRegister.save();
    await posRegister.expectSaveSuccess();
  });

  // POS-MEM-005
  test('POS-MEM-005 สมัครสมาชิกพร้อม Tab ข้อมูลใบกำกับภาษี', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('085');
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile });
    await posRegister.fillTaxInfo(posTaxMember);
    await shot(page, 'POS-MEM-005_with-tax');
    await posRegister.save();
    await posRegister.expectSaveSuccess();
  });
});

// ═══════════════════════════════════════════════════════════════════
// Validation Cases — Required Fields
// ═══════════════════════════════════════════════════════════════════

test.describe('POS สมัครสมาชิกใหม่ - Validation: Required Fields', () => {
  test.beforeEach(async ({ posLoggedIn, posRegister }) => {
    void posLoggedIn;
    await posRegister.openRegisterForm();
  });

  // POS-MEM-010
  test('POS-MEM-010 ไม่กรอกชื่อ → ระบบไม่บันทึก', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('091');
    await posRegister.fillGeneralInfo({
      lastName: 'NoFirstName',
      gender:   'ชาย',
      mobile,
    });
    await shot(page, 'POS-MEM-010_no-firstname');
    await posRegister.save();
    await posRegister.expectValidationError();
    await shot(page, 'POS-MEM-010_error');
  });

  // POS-MEM-011
  test('POS-MEM-011 ไม่กรอกนามสกุล → ระบบไม่บันทึก', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('092');
    await posRegister.fillGeneralInfo({
      firstName: 'NoLastName',
      gender:    'ชาย',
      mobile,
    });
    await shot(page, 'POS-MEM-011_no-lastname');
    await posRegister.save();
    await posRegister.expectValidationError();
    await shot(page, 'POS-MEM-011_error');
  });

  // POS-MEM-012
  test('POS-MEM-012 ไม่กรอกเบอร์มือถือ → ระบบไม่บันทึก', async ({ page, posRegister }) => {
    await posRegister.fillGeneralInfo({
      firstName: 'NoMobile',
      lastName:  'Test',
      gender:    'ชาย',
      mobile:    '',
    });
    await shot(page, 'POS-MEM-012_no-mobile');
    await posRegister.save();
    await posRegister.expectValidationError();
    await shot(page, 'POS-MEM-012_error');
  });

  // POS-MEM-013
  test('POS-MEM-013 ไม่เลือกเพศ → ระบบไม่บันทึก', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('093');
    await posRegister.fillGeneralInfo({
      firstName: 'NoGender',
      lastName:  'Test',
      mobile,
    });
    await shot(page, 'POS-MEM-013_no-gender');
    await posRegister.save();
    await posRegister.expectValidationError();
    await shot(page, 'POS-MEM-013_error');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Validation Cases — Mobile Format (Data-Driven)
// ═══════════════════════════════════════════════════════════════════

test.describe('POS สมัครสมาชิกใหม่ - Validation: รูปแบบเบอร์มือถือ', () => {
  test.beforeEach(async ({ posLoggedIn, posRegister }) => {
    void posLoggedIn;
    await posRegister.openRegisterForm();
  });

  for (const tc of posMobileCases) {
    test(`${tc.id} ${tc.title}`, async ({ page, posRegister }) => {
      const mobile = tc.expect === 'PASS' ? uniquePosMobile(tc.mobile.slice(0, 3)) : tc.mobile;
      await posRegister.fillGeneralInfo({
        firstName: 'DD',
        lastName:  'Test',
        gender:    'ชาย',
        mobile,
      });
      await shot(page, `${tc.id}_input`);
      await posRegister.save();

      if (tc.expect === 'PASS') {
        await posRegister.expectSaveSuccess();
      } else if (tc.expect === 'FAIL') {
        await posRegister.expectValidationError();
      }
      await shot(page, `${tc.id}_result`);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════
// UI Behavior
// ═══════════════════════════════════════════════════════════════════

test.describe('POS สมัครสมาชิกใหม่ - UI Behavior', () => {
  test.beforeEach(async ({ posLoggedIn, posRegister }) => {
    void posLoggedIn;
    await posRegister.openRegisterForm();
  });

  // POS-MEM-020
  test('POS-MEM-020 กดยกเลิก → ฟอร์มปิด ไม่บันทึกข้อมูล', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('099');
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile });
    await shot(page, 'POS-MEM-020_filled');
    await posRegister.cancel();
    await shot(page, 'POS-MEM-020_after-cancel');
    // ฟอร์มควรปิด
    await posRegister.expectFormClosed();
    // ตรวจสอบว่าเบอร์ที่กรอกไม่ถูกบันทึก (ค้นหาไม่พบ)
    await posRegister.searchMember(mobile);
    const found = page.locator('[class*="member"], [class*="result"]').filter({ hasText: mobile });
    await expect.soft(found.first()).not.toBeVisible({ timeout: 5_000 });
  });

  // POS-MEM-021
  test('POS-MEM-021 Tab navigation: เปลี่ยน tab ข้อมูลทั่วไป ↔ ข้อมูลใบกำกับภาษี', async ({ page, posRegister }) => {
    await posRegister.switchTab('ข้อมูลใบกำกับภาษี');
    await expect.soft(posRegister.companyNameInput).toBeVisible({ timeout: 5_000 });
    await shot(page, 'POS-MEM-021_tax-tab');
    await posRegister.switchTab('ข้อมูลทั่วไป');
    await expect.soft(posRegister.firstNameInput).toBeVisible({ timeout: 5_000 });
    await shot(page, 'POS-MEM-021_general-tab');
  });
});
