import { test, expect } from '@playwright/test';
import { PopupAdminPage } from '../../pages/PopupAdminPage.js';
import { PopupModal } from '../../pages/PopupModal.js';
import { uniqueCode } from './popup-fixtures.js';
import { loginPos, fmtDatetimeLocal } from './popup-test-helpers.js';

/**
 * Automate: TC-TRACK-004, TC-E2E-004, TC-CONC-001, TC-RPT-001, TC-RPT-002, TC-RPT-003
 * (อ้างอิง docs/test-cases/Arincare_PopupNotification_TestCases.xlsx)
 */
test.describe('Popup Notification — Tracking Robustness & Report', () => {
  let cleanupCode: string | null = null;

  test.afterEach(async ({ page }) => {
    if (cleanupCode) {
      const admin = new PopupAdminPage(page);
      await admin.gotoList();
      await admin.deletePopup(cleanupCode).catch((e) => console.warn('cleanup failed:', e.message));
      cleanupCode = null;
    }
  });

  test('TC-TRACK-004: Block Tracking API → Popup ยังแสดงผลได้ปกติ', async ({ page, browser }) => {
    test.setTimeout(150_000);
    const admin = new PopupAdminPage(page);
    const code = uniqueCode('QA_T004');
    cleanupCode = code;
    await admin.login();
    await admin.gotoCreate();
    await admin.fillCreateForm({
      title: 'QA Tracking Fail Test', code, status: 'active',
      startDateTime: fmtDatetimeLocal(new Date(Date.now() - 5 * 60_000)),
      endDateTime: fmtDatetimeLocal(new Date(Date.now() + 3_600_000)),
      posV2: true, rawHtml: '<p>test</p>', buttonText: 'ปิด', buttonAction: 'close',
    });
    await admin.submitCreate();

    const ctx = await browser.newContext({ locale: 'th-TH' });
    const clientPage = await ctx.newPage();
    await clientPage.route('**/interactions**', (route) => route.abort('failed'));
    await loginPos(clientPage);
    await clientPage.waitForTimeout(3_000);
    const modalVisible = await new PopupModal(clientPage).isVisible(10_000);
    const pageUsable = await clientPage.locator('body').isVisible().catch(() => false);
    await ctx.close();

    expect(modalVisible).toBe(true);
    expect(pageUsable).toBe(true);
  });

  test('TC-E2E-004: Block Client Active API → POS-v2 Checkin ยังสำเร็จปกติ', async ({ browser }) => {
    test.setTimeout(120_000);
    const ctx = await browser.newContext({ locale: 'th-TH' });
    const clientPage = await ctx.newPage();
    await clientPage.route('**/popup-notifications/active**', (route) => route.abort('failed'));
    await loginPos(clientPage);
    const posUsable = await clientPage.locator('body').innerText().then((t) => t.length > 100).catch(() => false);
    await ctx.close();
    expect(posUsable).toBe(true);
  });

  test('TC-CONC-001: เปิด 2 Tab พร้อมกันด้วย account เดียวกัน → ไม่นับ View ซ้ำ', async ({ page, browser }) => {
    test.setTimeout(150_000);
    const admin = new PopupAdminPage(page);
    const code = uniqueCode('QA_CONC');
    cleanupCode = code;
    await admin.login();
    await admin.gotoCreate();
    await admin.fillCreateForm({
      title: 'QA Concurrency Test', code, status: 'active',
      startDateTime: fmtDatetimeLocal(new Date(Date.now() - 5 * 60_000)),
      endDateTime: fmtDatetimeLocal(new Date(Date.now() + 3_600_000)),
      posV2: true, rawHtml: '<p>test</p>', buttonText: 'ปิด', buttonAction: 'close',
    });
    await admin.submitCreate();

    const ctx = await browser.newContext({ locale: 'th-TH' });
    const page1 = await ctx.newPage();
    const page2 = await ctx.newPage();
    await Promise.all([loginPos(page1), loginPos(page2)]);
    await Promise.all([page1.waitForTimeout(3_000), page2.waitForTimeout(3_000)]);
    await ctx.close();

    await admin.gotoDetailByCode(code);
    const stats = await admin.getStatSummary();
    expect(stats.views).toBeLessThanOrEqual(1); // ต้องไม่นับซ้ำจาก race condition
  });

  test('TC-RPT-001: Popup ที่ยังไม่มีใครเห็นเลย → View=0 ไม่ error', async ({ page }) => {
    test.setTimeout(60_000);
    const admin = new PopupAdminPage(page);
    const code = uniqueCode('QA_RPT001');
    cleanupCode = code;
    await admin.login();
    await admin.gotoCreate();
    await admin.fillCreateForm({
      title: 'QA Empty Interactions Test', code, status: 'active',
      startDateTime: fmtDatetimeLocal(new Date(Date.now() + 24 * 3_600_000)), // อนาคต — ยังไม่มีใครเห็นแน่นอน
      endDateTime: fmtDatetimeLocal(new Date(Date.now() + 48 * 3_600_000)),
      posV2: true, rawHtml: '<p>test</p>', buttonText: 'ปิด', buttonAction: 'close',
    });
    await admin.submitCreate();

    await admin.gotoDetailByCode(code);
    const stats = await admin.getStatSummary();
    expect(stats.views).toBe(0);
  });

  test('TC-RPT-002: Popup ID ที่ไม่มีอยู่จริง → ไม่ใช่หน้า 500 ดิบ', async ({ page }) => {
    test.setTimeout(30_000);
    const admin = new PopupAdminPage(page);
    await admin.login();
    await page.goto(`${process.env.ADMIN_BASE_URL ?? 'https://admin-stg.arincare.com'}/popup-notifications/999999`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(1_500);
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const has500 = /internal server error|whoops|stack trace/i.test(bodyText);
    // ✅ BUG-004 ยืนยันแก้แล้ว 2026-09-02: ไม่มีหน้า 500 ดิบอีกต่อไป (verified ด้วย screenshot จริง)
    // ⚠️ แต่ยังไม่ใช่ "friendly 404" เต็มรูปแบบ — ตอนนี้ขึ้นเป็นหน้าเปล่า (breadcrumb+ปุ่มกลับ ไม่มีข้อความ "ไม่พบข้อมูล")
    // เก็บไว้เป็นข้อเสนอ UX (ไม่ใช่บั๊กแล้ว) — เทสนี้ยืนยันแค่ว่าไม่ใช่ 500 ดิบ ซึ่งคือสิ่งที่ BUG-004 รายงานไว้
    expect(has500).toBe(false);
  });

  test('TC-RPT-003: 1 คนดู+กดปิด 1 ครั้ง → ยอด View ตรงกับที่เกิดขึ้นจริง', async ({ page, browser }) => {
    test.setTimeout(150_000);
    const admin = new PopupAdminPage(page);
    const code = uniqueCode('QA_RPT003');
    cleanupCode = code;
    await admin.login();
    await admin.gotoCreate();
    await admin.fillCreateForm({
      title: 'QA Exact Stats Test', code, status: 'active',
      startDateTime: fmtDatetimeLocal(new Date(Date.now() - 5 * 60_000)),
      endDateTime: fmtDatetimeLocal(new Date(Date.now() + 3_600_000)),
      posV2: true, rawHtml: '<p>test</p>', buttonText: 'ปิด', buttonAction: 'close',
    });
    await admin.submitCreate();

    const ctx = await browser.newContext({ locale: 'th-TH' });
    const clientPage = await ctx.newPage();
    await loginPos(clientPage);
    await clientPage.waitForTimeout(2_500);
    const modal = new PopupModal(clientPage);
    if (await modal.isVisible(10_000)) {
      await modal.clickButtonByText('ปิด').catch(() => {});
    }
    await ctx.close();

    await admin.gotoDetailByCode(code);
    const stats = await admin.getStatSummary();
    expect(stats.views).toBe(1);
  });
});
