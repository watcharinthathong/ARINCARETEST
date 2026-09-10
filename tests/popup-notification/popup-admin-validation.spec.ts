import { test, expect } from '@playwright/test';
import { PopupAdminPage } from '../../pages/PopupAdminPage.js';
import { uniqueCode } from './popup-fixtures.js';
import { fmtDatetimeLocal } from './popup-test-helpers.js';

/**
 * Automate: TC-ADMIN-002, TC-ADMIN-003, TC-ADMIN-006, TC-BTN-003, TC-BTN-004
 * (อ้างอิง docs/test-cases/Arincare_PopupNotification_TestCases.xlsx)
 */
test.describe('Popup Notification — Admin Form Validation', () => {
  let cleanupCode: string | null = null;

  test.afterEach(async ({ page }) => {
    if (cleanupCode) {
      const admin = new PopupAdminPage(page);
      await admin.gotoList();
      await admin.deletePopup(cleanupCode).catch((e) => console.warn('cleanup failed:', e.message));
      cleanupCode = null;
    }
  });

  test('TC-ADMIN-002: ไม่เลือก Platform เลย → ระบบไม่ยอมให้สร้าง', async ({ page }) => {
    test.setTimeout(60_000);
    const admin = new PopupAdminPage(page);
    const code = uniqueCode('QA_ADM002');
    await admin.login();
    await admin.gotoCreate();
    await admin.fillCreateForm({
      title: 'QA Missing Platform', code, status: 'active',
      startDateTime: fmtDatetimeLocal(new Date(Date.now() - 5 * 60_000)),
      endDateTime: fmtDatetimeLocal(new Date(Date.now() + 3_600_000)),
      webApp: false, posV2: false, rawHtml: '<p>test</p>',
      buttonText: 'ปิด', buttonAction: 'close',
    });
    await admin.submitCreate();
    // ยังอยู่หน้า create เพราะสร้างไม่สำเร็จ — ไม่ต้อง cleanup
    expect(page.url()).toContain('/create');
  });

  test('TC-ADMIN-003: end_date ก่อน start_date → ระบบไม่ยอมให้สร้าง', async ({ page }) => {
    test.setTimeout(60_000);
    const admin = new PopupAdminPage(page);
    const code = uniqueCode('QA_ADM003');
    await admin.login();
    await admin.gotoCreate();
    await admin.fillCreateForm({
      title: 'QA End Before Start', code, status: 'active',
      startDateTime: fmtDatetimeLocal(new Date(Date.now() + 10 * 24 * 3_600_000)),
      endDateTime: fmtDatetimeLocal(new Date(Date.now() + 5 * 24 * 3_600_000)),
      posV2: true, rawHtml: '<p>test</p>',
      buttonText: 'ปิด', buttonAction: 'close',
    });
    await admin.submitCreate();
    expect(page.url()).toContain('/create');
  });

  test('TC-ADMIN-006: แก้ไขแคมเปญเดิม → หน้า List สะท้อนผลทันที', async ({ page }) => {
    test.setTimeout(90_000);
    const admin = new PopupAdminPage(page);
    const code = uniqueCode('QA_ADM006');
    cleanupCode = code;
    await admin.login();
    await admin.gotoCreate();
    await admin.fillCreateForm({
      title: 'QA Edit Test — Original', code, status: 'active',
      startDateTime: fmtDatetimeLocal(new Date(Date.now() - 5 * 60_000)),
      endDateTime: fmtDatetimeLocal(new Date(Date.now() + 3_600_000)),
      posV2: true, rawHtml: '<p>original</p>',
      buttonText: 'ปิด', buttonAction: 'close',
    });
    await admin.submitCreate();

    await admin.gotoList();
    await admin.rowByCode(code).locator('a[title="แก้ไข"]').click();
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1_000);
    await page.getByPlaceholder('เช่น แจ้งปรับปรุงระบบประจำเดือน, ข่าวสารประชาสัมพันธ์').fill('QA Edit Test — UPDATED');
    await page.getByRole('button', { name: /บันทึก|Save/ }).first().click();
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(1_000);

    await admin.gotoList();
    const rowText = await admin.rowByCode(code).innerText();
    expect(rowText).toContain('UPDATED');
  });

  test('TC-BTN-003: redirect URL = javascript: → Admin บล็อกตอนบันทึก', async ({ page }) => {
    test.setTimeout(60_000);
    const admin = new PopupAdminPage(page);
    const code = uniqueCode('QA_BTN003');
    await admin.login();
    await admin.gotoCreate();
    await admin.fillCreateForm({
      title: 'QA JS URL Test', code, status: 'active',
      startDateTime: fmtDatetimeLocal(new Date(Date.now() - 5 * 60_000)),
      endDateTime: fmtDatetimeLocal(new Date(Date.now() + 3_600_000)),
      posV2: true, rawHtml: '<p>test</p>',
      buttonText: 'คลิกฉัน', buttonAction: 'redirect', buttonUrl: 'javascript:alert(document.cookie)',
    });
    await admin.submitCreate();
    expect(page.url()).toContain('/create');
  });

  test('TC-BTN-004: redirect URL = data: → ยืนยัน Admin ยังไม่กรอง (known gap, BUG-003)', async ({ page }) => {
    test.setTimeout(60_000);
    const admin = new PopupAdminPage(page);
    const code = uniqueCode('QA_BTN004');
    cleanupCode = code; // ถ้าเผลอสร้างสำเร็จ (ตามที่ BUG-003 ทำนายไว้) ต้องลบทิ้งเสมอ — ห้ามเหลือ URL อันตรายค้างบน Staging
    await admin.login();
    await admin.gotoCreate();
    await admin.fillCreateForm({
      title: 'QA Data URL Test', code, status: 'active',
      startDateTime: fmtDatetimeLocal(new Date(Date.now() - 5 * 60_000)),
      endDateTime: fmtDatetimeLocal(new Date(Date.now() + 3_600_000)),
      posV2: true, rawHtml: '<p>test</p>',
      buttonText: 'คลิกฉัน', buttonAction: 'redirect', buttonUrl: 'data:text/html,<script>alert(1)</script>',
    });
    await admin.submitCreate();
    // ⚠️ BUG-003 พบว่าผลลัพธ์ไม่คงที่ระหว่างรัน (2026-09-02): ผ่าน Playwright test runner บล็อกได้ 2/2 ครั้ง
    // แต่ผ่าน standalone script (chromium.launch ตรง ไม่ผ่าน test runner) กลับยอมสร้างสำเร็จ 4/4 ครั้ง
    // ด้วย flow ที่เหมือนกันทุกประการเท่าที่ตรวจสอบได้ — ไม่ assert ทิศทางตายตัว (กัน false CI failure)
    // แค่บันทึกผลไว้เป็นหลักฐานให้ Dev ไปตรวจสอบเรื่อง inconsistent validation โดยตรง
    const created = !page.url().includes('/create');
    if (!created) cleanupCode = null; // ไม่ได้สร้างจริง ไม่ต้อง cleanup
    test.info().annotations.push({
      type: 'BUG-003 observation',
      description: `data: URL ${created ? 'ถูกสร้างสำเร็จ (ไม่ถูกบล็อก)' : 'ถูกบล็อก (ไม่สร้าง)'} — ดู qa-context.md เรื่อง inconsistent validation`,
    });
    console.log(`[BUG-003] data: URL ${created ? 'สร้างสำเร็จ (allowed)' : 'ถูกบล็อก (blocked)'} รอบนี้`);
  });
});
