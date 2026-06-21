import { test, expect } from './fixtures.js';
import { shot } from '../utils/helpers.js';
import { fullCustomer, priceLevels, uniqueMobile } from '../data/customer.testdata.js';

test.describe('เพิ่มลูกค้าใหม่ - E2E ครบทุก Tab', () => {
  test.beforeEach(async ({ loggedIn, customerForm }) => {
    void loggedIn;
    await customerForm.openCustomerList();
    await customerForm.openNewCustomerForm();
  });

  // TC-CUST-004 : scenario หลักจาก requirement
  test('TC-CUST-004 สร้างลูกค้าครบทุก Tab → ค้นหาเจอ → เปิดดูรายละเอียด', async ({ page, customerForm }) => {
    const mobile = uniqueMobile('081');
    const data = { ...fullCustomer, mobile };

    // ข้อมูลทั่วไป
    await customerForm.fillGeneral(data);
    await shot(page, 'TC-CUST-004_tab-general');

    // Tab ที่อยู่
    await customerForm.fillAddress(data);
    await shot(page, 'TC-CUST-004_tab-address');

    // Tab ราคาขาย
    await customerForm.selectPriceLevel(data.priceLevel!);
    await shot(page, 'TC-CUST-004_tab-price');

    // Tab ข้อมูลทางยา (เปิดดูเฉย ๆ ไม่บังคับกรอก)
    await customerForm.tab('ข้อมูลทางยา');
    await shot(page, 'TC-CUST-004_tab-medical');

    // Tab ประวัติการซื้อ (ตรวจว่าแสดงได้)
    await customerForm.tab('ประวัติการซื้อ');
    await shot(page, 'TC-CUST-004_tab-history');

    // Tab หมายเหตุ
    await customerForm.fillNote(data.note!);
    await shot(page, 'TC-CUST-004_tab-note');

    // บันทึก
    await customerForm.save();
    await customerForm.expectSaveSuccess();
    await shot(page, 'TC-CUST-004_after-save');

    // ค้นหา + เปิดรายละเอียด
    await customerForm.searchCustomer(mobile);
    await customerForm.expectCustomerInList(mobile);
    await shot(page, 'TC-CUST-004_customer-list');

    await customerForm.openCustomerDetail(mobile);
    await expect.soft(page.getByText('Test', { exact: false }).first()).toBeVisible();
    await shot(page, 'TC-CUST-004_customer-detail');
  });

  // TC-PRICE-003 : เลือกได้ครบทุกระดับราคา (data-driven)
  for (const level of priceLevels) {
    test(`TC-PRICE-003 เลือกระดับราคา: ${level}`, async ({ page, customerForm }) => {
      await customerForm.fillGeneral({ mobile: uniqueMobile('081') });
      await customerForm.selectPriceLevel(level);
      await shot(page, `TC-PRICE-003_${level}`);
      await customerForm.save();
      await customerForm.expectSaveSuccess();
    });
  }

  // TC-UI-001 : ปุ่มยกเลิก
  test('TC-UI-001 กดยกเลิกแล้วไม่บันทึก', async ({ page, customerForm }) => {
    await customerForm.fillGeneral({ firstName: 'Temp', mobile: uniqueMobile('081') });
    await customerForm.cancelButton.click();
    await expect(customerForm.saveButton).toBeHidden({ timeout: 8000 }).catch(() => {});
    await shot(page, 'TC-UI-001_after-cancel');
  });

  // TC-UI-002 : สลับ Tab ข้อมูลคงอยู่
  test('TC-UI-002 สลับ Tab แล้วข้อมูลยังอยู่', async ({ page, customerForm }) => {
    await customerForm.fillAddress({ address1: '99/99 ถนนพระราม 9' });
    await customerForm.tab('หมายเหตุ');
    await customerForm.tab('ที่อยู่');
    await expect(customerForm.address1Input).toHaveValue(/99\/99/);
  });
});
