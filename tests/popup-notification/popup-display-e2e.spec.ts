import { test, expect, Page } from '@playwright/test';
import { PopupAdminPage } from '../../pages/PopupAdminPage.js';
import { PopupModal } from '../../pages/PopupModal.js';
import { PosRegisterPage } from '../../pages/PosRegisterPage.js';
import { uniqueCode } from './popup-fixtures.js';

/**
 * ⚠️ สำคัญ: PosRegisterPage.loginToPos() ผูก addLocatorHandler ไว้กับ
 * `button:has-text("ปิด")` แบบ page-wide (ไม่ได้ scope แค่ .reapop__notification
 * ตามที่เข้าใจตอนแรก) — Popup Notification ของเราก็ใช้ปุ่มข้อความ "ปิด" เหมือนกัน
 * ทำให้ handler เดิมไปคลิกปิด Popup ของเราอัตโนมัติก่อนที่เทสจะทันตรวจสอบ
 * (ยืนยันจากการรันจริง 2026-08-27 — เห็น log "37 × locator resolved to visible
 * <button class=\"btn btn-danger\">ปิด</button>" ก่อน modal จะ visible)
 * ต้องถอด handler นี้ออกทันทีหลัง loginToPos() ทุกครั้งที่จะทดสอบ Popup Notification
 */
async function removePosAutoDismissHandler(page: Page) {
  await page.removeLocatorHandler(page.locator('button:has-text("ปิด")').first()).catch(() => {});
}

/**
 * Automate E2E: TC-E2E-001 (main flow), TC-BTN-001 (close button), TC-FREQ-001 (once ไม่แสดงซ้ำ)
 * (อ้างอิง docs/test-cases/Arincare_PopupNotification_TestCases.xlsx)
 *
 * ทำทุกขั้นตอนบน page เดียวกัน (Admin → POS-v2 → กลับมา Admin ตรวจ Report → POS-v2 ซ้ำ)
 * เพราะ cookie ของแต่ละ origin (admin-stg / pos-stg) แยกกันอยู่แล้วใน browser context เดียว
 */
test.describe('Popup Notification — Display E2E (POS-v2)', () => {
  test('สร้างแคมเปญ Global/POS-v2/once → แสดงจริงบน POS-v2 → ปิด → ยอด View ขึ้น Report → ไม่แสดงซ้ำ', async ({ page }) => {
    test.setTimeout(180_000); // login POS-v2 2 รอบ + admin steps ค่อนข้างช้า

    const admin = new PopupAdminPage(page);
    const code = uniqueCode('QA_E2E');
    const title = 'QA Automation E2E Test Popup';

    // ── STEP 1: Admin สร้างแคมเปญ ──────────────────────────────────────────
    await admin.login();
    await admin.gotoCreate();
    await admin.fillCreateForm({
      title,
      code,
      status: 'active',
      startDateTime: toDatetimeLocal(new Date(Date.now() - 5 * 60_000)), // เริ่มเมื่อ 5 นาทีที่แล้ว กันปัญหา clock skew
      endDateTime: toDatetimeLocal(new Date(Date.now() + 24 * 60 * 60_000)), // สิ้นสุดอีก 1 วัน
      webApp: false,
      posV2: true,
      frequency: 'once',
      scope: 'global',
      size: 'MD',
      rawHtml: `<h2>${title}</h2><p data-qa-marker="${code}">Automated E2E content</p>`,
      buttonText: 'ปิด',
      buttonAction: 'close',
    });
    await admin.submitCreate();
    await admin.gotoList();
    await admin.expectRowVisible(code);

    try {
      // ── STEP 2: Login POS-v2 ครั้งที่ 1 → Popup ต้องแสดง ────────────────
      const posRegister = new PosRegisterPage(page);
      await posRegister.goto();
      await posRegister.loginToPos();
      await removePosAutoDismissHandler(page);

      const modal = new PopupModal(page);
      await modal.waitForVisible(20_000);
      const htmlText = await modal.getHtmlText();
      expect(htmlText).toContain(title);

      // ── STEP 3: ปิด Popup ด้วยปุ่ม "ปิด" ─────────────────────────────────
      await modal.clickButtonByText('ปิด');
      await expect(modal.root).not.toBeVisible({ timeout: 5_000 });

      // ── STEP 4: กลับไป Admin ตรวจสอบ Report ว่ายอด View ขึ้นจริง ────────
      await admin.gotoDetailByCode(code);
      const stats = await admin.getStatSummary();
      expect(stats.views).toBeGreaterThanOrEqual(1);

      // ── STEP 5: Login POS-v2 ครั้งที่ 2 → Popup ต้องไม่แสดงซ้ำ (once) ───
      await posRegister.goto();
      await posRegister.loginToPos();
      await removePosAutoDismissHandler(page);
      await page.waitForTimeout(3_000);
      const modal2 = new PopupModal(page);
      expect(await modal2.isVisible(5_000)).toBe(false);
    } finally {
      // ── Cleanup: ลบแคมเปญที่เทสสร้างขึ้น เว้นแต่ตั้ง SKIP_CLEANUP=true ────
      if (!process.env.SKIP_CLEANUP) {
        await admin.gotoList();
        await admin.deletePopup(code).catch((e) => console.warn('cleanup delete failed:', e.message));
      } else {
        console.log('SKIP_CLEANUP set — leaving campaign on staging:', code);
      }
    }
  });
});

function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
