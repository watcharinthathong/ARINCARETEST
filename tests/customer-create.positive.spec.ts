import { test, expect } from './fixtures.js';
import { shot } from '../utils/helpers.js';
import { fullCustomer, uniqueMobile } from '../data/customer.testdata.js';

test.describe('เพิ่มลูกค้าใหม่ - Positive', () => {
  test.beforeEach(async ({ loggedIn, customerForm }) => {
    void loggedIn;
    await customerForm.openCustomerList();
    await customerForm.openNewCustomerForm();
  });

  // TC-CUST-001
  test('@smoke TC-CUST-001 บันทึกด้วยเบอร์มือถืออย่างเดียว', async ({ page, customerForm }) => {
    const mobile = uniqueMobile('081');
    await customerForm.fillGeneral({ mobile });
    await shot(page, 'TC-CUST-001_before-save');
    await customerForm.save();
    await customerForm.expectSaveSuccess();
    await shot(page, 'TC-CUST-001_after-save');
  });

  // TC-CUST-002
  test('TC-CUST-002 บันทึกบุคคลธรรมดา กรอกครบฟิลด์ทั่วไป', async ({ page, customerForm }) => {
    const mobile = uniqueMobile('081');
    await customerForm.fillGeneral({
      prefix: 'นาย', firstName: 'Test', lastName: 'Customer',
      mobile, email: 'test.customer@example.com',
    });
    await shot(page, 'TC-CUST-002_general');
    await customerForm.save();
    await customerForm.expectSaveSuccess();
  });

  // TC-CUST-003
  test('TC-CUST-003 บันทึกนิติบุคคล + เลขผู้เสียภาษี 13 หลัก', async ({ page, customerForm }) => {
    const mobile = uniqueMobile('081');
    await customerForm.fillGeneral({
      companyName: 'Test Customer Company', contactName: 'Test Customer',
      taxId: '1234567890123', mobile,
    });
    await shot(page, 'TC-CUST-003_company');
    await customerForm.save();
    await customerForm.expectSaveSuccess();
  });

  // TC-CUST-060: วันเกิด → อายุ auto-calc
  test('TC-CUST-060 วันเกิดถูกต้อง คำนวณอายุอัตโนมัติ', async ({ page, customerForm }) => {
    await customerForm.fillGeneral({ mobile: uniqueMobile('081'), birthDate: '1990-01-15' });
    await expect.soft(customerForm.ageInput).not.toHaveValue('');
    await shot(page, 'TC-CUST-060_age');
  });

  // TC-CUST-063: ช่องอายุ read-only
  test('TC-CUST-063 ช่องอายุเป็น read-only', async ({ page, customerForm }) => {
    const editable = await customerForm.ageInput.isEditable().catch(() => false);
    expect(editable).toBeFalsy();
    await shot(page, 'TC-CUST-063_age-readonly');
  });
});
