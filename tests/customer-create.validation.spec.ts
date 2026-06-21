import { test, expect } from './fixtures.js';
import { shot } from '../utils/helpers.js';
import {
  mobileCases, emailCases, securityPayloads, uniqueMobile,
} from '../data/customer.testdata.js';

test.describe('เพิ่มลูกค้าใหม่ - Validation (Data-Driven)', () => {
  test.beforeEach(async ({ loggedIn, customerForm }) => {
    void loggedIn;
    await customerForm.openCustomerList();
    await customerForm.openNewCustomerForm();
  });

  // TC-CUST-010..026 : เบอร์มือถือ (required + EP + BVA)
  for (const c of mobileCases) {
    test(`[${c.id}] มือถือ: ${c.title} → คาดหวัง ${c.expect}`, async ({ page, customerForm }) => {
      // PASS cases use unique mobile to avoid duplicate errors across test runs
      const mobile = c.expect === 'PASS' ? uniqueMobile(c.mobile.slice(0, 3)) : c.mobile;
      await customerForm.fillGeneral({ mobile });
      await customerForm.save();

      if (c.expect === 'PASS') {
        await customerForm.expectSaveSuccess();
      } else if (c.expect === 'FAIL') {
        // ต้องยังอยู่หน้าฟอร์ม + ไม่บันทึก
        await expect(customerForm.mobileField).toBeVisible();
        await customerForm.expectMobileError();
      } else {
        // INFO: บันทึกพฤติกรรมจริงไว้ดู ไม่ fail เทส
        await shot(page, `${c.id}_info-behavior`);
      }
      await shot(page, `${c.id}_${c.expect}`);
    });
  }

  // TC-CUST-030..036 : อีเมล (ต้องมีมือถือ valid ควบคู่)
  for (const c of emailCases) {
    test(`[${c.id}] อีเมล: ${c.title} → คาดหวัง ${c.expect}`, async ({ page, customerForm }) => {
      await customerForm.fillGeneral({ mobile: uniqueMobile('081'), email: c.email });
      await customerForm.save();

      if (c.expect === 'PASS') {
        await customerForm.expectSaveSuccess();
      } else {
        const stillForm = await customerForm.mobileField.isVisible().catch(() => false);
        expect(stillForm).toBeTruthy(); // ยังไม่บันทึกเพราะอีเมลผิด
      }
      await shot(page, `${c.id}_${c.expect}`);
    });
  }

  // TC-SEC-001 / TC-SEC-002 : Security (XSS / SQLi)
  for (const p of securityPayloads) {
    test(`[${p.id}] Security ${p.title} ในช่องชื่อ → ต้องถูก escape/ป้องกัน`, async ({ page, customerForm }) => {
      await customerForm.fillGeneral({ mobile: uniqueMobile('081'), firstName: p.payload });
      await customerForm.save();

      // ต้องไม่มี alert/dialog เด้ง (XSS ไม่ทำงาน)
      let dialogFired = false;
      page.on('dialog', async d => { dialogFired = true; await d.dismiss(); });
      await page.waitForTimeout(1000);
      expect(dialogFired).toBeFalsy();
      await shot(page, `${p.id}_${p.title}`);
    });
  }
});
