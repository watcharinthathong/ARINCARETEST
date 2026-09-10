import { test, expect, Page } from '@playwright/test';
import { PopupAdminPage } from '../../pages/PopupAdminPage.js';
import { PopupModal } from '../../pages/PopupModal.js';
import { PosRegisterPage } from '../../pages/PosRegisterPage.js';
import { uniqueCode } from './popup-fixtures.js';

/** ดู popup-display-e2e.spec.ts สำหรับคำอธิบายเต็มว่าทำไมต้องถอด handler นี้ */
async function removePosAutoDismissHandler(page: Page) {
  await page.removeLocatorHandler(page.locator('button:has-text("ปิด")').first()).catch(() => {});
}

/**
 * Automate: TC-SCOPE-005 (Company+Branch ตรง → แสดง)
 * (อ้างอิง docs/test-cases/Arincare_PopupNotification_TestCases.xlsx)
 */
test.describe('Popup Notification — Scope Targeting', () => {
  test('TC-SCOPE-005: Scope=Company+Branch ตรงกับพนักงาน → Popup แสดงผล', async ({ page }) => {
    test.setTimeout(180_000);
    const admin = new PopupAdminPage(page);
    const code = uniqueCode('QA_SCOPE');
    const title = 'QA Automation Scope Test';
    const companyName = process.env.COMPANY_NAME ?? 'Arincare Pharmacy';

    await admin.login();
    await admin.gotoCreate();
    await admin.fillCreateForm({
      title,
      code,
      status: 'active',
      startDateTime: toDatetimeLocal(new Date(Date.now() - 5 * 60_000)),
      endDateTime: toDatetimeLocal(new Date(Date.now() + 24 * 60 * 60_000)),
      posV2: true,
      frequency: 'once',
      scope: 'specific',
      scopeSearch: companyName,
      rawHtml: `<h2>${title}</h2>`,
      buttonText: 'ปิด',
      buttonAction: 'close',
    });
    await admin.submitCreate();

    try {
      const posRegister = new PosRegisterPage(page);
      await posRegister.goto();
      await posRegister.loginToPos();
      await removePosAutoDismissHandler(page);

      const modal = new PopupModal(page);
      await modal.waitForVisible(20_000);
      expect(await modal.getHtmlText()).toContain(title);
    } finally {
      if (!process.env.SKIP_CLEANUP) {
        await admin.gotoList();
        await admin.deletePopup(code).catch((e) => console.warn('cleanup delete failed:', e.message));
      } else {
        console.log('SKIP_CLEANUP set — leaving campaign on staging:', code);
      }
    }
  });

  /**
   * TC-SCOPE-004/006: ต้องมีพนักงานทดสอบคนละ Company/Branch เพื่อยืนยันว่า "ไม่เห็น" Popup
   * ที่ scope ไปยังร้าน/สาขาอื่น — ตอนนี้ .env มีบัญชีทดสอบแค่ 1 company/branch เท่านั้น
   * (ดู qa-context.md A5 — ยังไม่มีบัญชี Staff คนละบริษัท/สาขา)
   *
   * เมื่อได้บัญชีที่ 2 มาแล้ว ให้เพิ่ม env var เช่น TEST_USERNAME_2/COMPANY_NAME_2/POS_BRANCH_2
   * แล้วลบ .fixme() ออก พร้อม implement เหมือน TC-SCOPE-005 แต่ยืนยันด้วย modal.isVisible() === false
   */
  test.fixme(
    'TC-SCOPE-006: Scope=Company+Branch คนละสาขา → Popup ต้องไม่แสดงผล (รอบัญชีทดสอบที่ 2)',
    async () => {}
  );
});

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
