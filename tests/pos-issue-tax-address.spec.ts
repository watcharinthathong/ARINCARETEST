/**
 * Bug Investigation (POS): ข้อมูลที่อยู่ใบกำกับภาษีไม่แสดงในหน้าแก้ไขสมาชิก
 *
 * Issue:
 *   - สมัครสมาชิกใหม่พร้อมข้อมูลที่อยู่ใบกำกับภาษี (address1, zipcode ฯลฯ)
 *   - เปิดหน้าแก้ไขข้อมูลสมาชิกภายหลัง → fields ใน Tab ใบกำกับภาษีแสดงว่างเปล่า
 *   - พบทั้งกรณีสมัครใหม่และกรณีแก้ไขข้อมูลสมาชิกเดิม
 *
 * Expected: ข้อมูลที่อยู่ที่กรอกตอนสมัครต้องปรากฏใน edit form ครบถ้วน
 *
 * Test IDs: POS-TAX-001..003
 */

import { test, expect } from './pos-fixtures.js';
import { shot } from '../utils/helpers.js';
import { uniquePosMobile, posMinimalMember } from '../data/pos-member.testdata.js';

const taxWithAddress = {
  companyName:  'บริษัท ทดสอบ จำกัด',
  taxId:        '0105536000001',
  contactName:  'ผู้ติดต่อ ทดสอบ',
  phoneNumber:  '021234567',
  locationName: 'สาขาหลัก',
  address1:     '123 ถนนทดสอบ แขวงทดสอบ',
  zipcode:      '10110',
};

test.describe('POS Bug: ข้อมูลที่อยู่ใบกำกับภาษีในหน้าแก้ไขสมาชิก', () => {
  test.beforeEach(async ({ posLoggedIn }) => {
    void posLoggedIn;
  });

  // ══════════════════════════════════════════════════════════════════
  // POS-TAX-001
  // สมัครใหม่พร้อมที่อยู่ใบกำกับภาษี → เปิด edit → ต้องแสดงข้อมูล
  // FAIL = bug ยังอยู่ (fields ว่างในหน้า edit)
  // ══════════════════════════════════════════════════════════════════
  test('[POS-TAX-001] สมัครใหม่พร้อมที่อยู่ใบกำกับภาษี → เปิด edit → ข้อมูลต้องแสดงครบ', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('086');

    // 1. สมัครสมาชิกพร้อมข้อมูลใบกำกับภาษี (รวม address)
    await posRegister.openRegisterForm();
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile });
    await posRegister.fillTaxInfo(taxWithAddress);
    await shot(page, 'POS-TAX-001_01_filled-tax-address');
    await posRegister.save();
    await posRegister.expectSaveSuccess();
    await shot(page, 'POS-TAX-001_02_saved');

    // 2. ค้นหาสมาชิกแล้วเปิด edit form
    await posRegister.openMemberEditForm(mobile);
    await shot(page, 'POS-TAX-001_03_edit-form-opened');

    // 3. ตรวจสอบ Tab ใบกำกับภาษี — ต้องแสดงข้อมูลครบ (ไม่ว่าง)
    await posRegister.switchTab('ข้อมูลใบกำกับภาษี');
    await shot(page, 'POS-TAX-001_04_tax-tab-in-edit');
    await posRegister.expectTaxFieldsPopulated(taxWithAddress);
  });

  // ══════════════════════════════════════════════════════════════════
  // POS-TAX-002
  // company_name + tax_id ต้องปรากฏใน edit form (ไม่มี address)
  // ══════════════════════════════════════════════════════════════════
  test('[POS-TAX-002] company_name และ tax_id ต้องปรากฏใน edit form', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('087');

    await posRegister.openRegisterForm();
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile });
    await posRegister.fillTaxInfo({ companyName: 'ABC Corp ทดสอบ', taxId: '0105536000002' });
    await posRegister.save();
    await posRegister.expectSaveSuccess();

    await posRegister.openMemberEditForm(mobile);
    await posRegister.switchTab('ข้อมูลใบกำกับภาษี');
    await shot(page, 'POS-TAX-002_tax-tab-edit');

    await expect.soft(posRegister.companyNameInput).toHaveValue('ABC Corp ทดสอบ', { timeout: 5_000 });
    await expect.soft(posRegister.taxIdInput).toHaveValue('0105536000002', { timeout: 5_000 });
  });

  // ══════════════════════════════════════════════════════════════════
  // POS-TAX-003
  // แก้ไขชื่อ → ที่อยู่ใบกำกับภาษียังคงอยู่ (ไม่หาย)
  // ══════════════════════════════════════════════════════════════════
  test('[POS-TAX-003] แก้ไขชื่อสมาชิก → ที่อยู่ใบกำกับภาษียังคงแสดงครบ', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('088');

    // สมัครสมาชิกพร้อมที่อยู่ใบกำกับภาษี
    await posRegister.openRegisterForm();
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile });
    await posRegister.fillTaxInfo(taxWithAddress);
    await posRegister.save();
    await posRegister.expectSaveSuccess();

    // Edit ครั้งที่ 1: แก้ไขชื่อ (ไม่แตะ Tax tab)
    await posRegister.openMemberEditForm(mobile);
    await posRegister.firstNameInput.fill('สมชายแก้ไขแล้ว');
    await posRegister.save();
    await posRegister.expectSaveSuccess();
    await shot(page, 'POS-TAX-003_01_after-name-edit');

    // Edit ครั้งที่ 2: ตรวจสอบ Tax address ยังคงอยู่
    await posRegister.openMemberEditForm(mobile);
    await posRegister.switchTab('ข้อมูลใบกำกับภาษี');
    await shot(page, 'POS-TAX-003_02_tax-tab-after-edit');
    await posRegister.expectTaxFieldsPopulated(taxWithAddress);
  });
});
