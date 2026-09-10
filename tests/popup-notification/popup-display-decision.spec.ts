import { test, expect } from '@playwright/test';
import { PopupAdminPage } from '../../pages/PopupAdminPage.js';
import { uniqueCode } from './popup-fixtures.js';
import { checkPopupVisibleOnFreshPos, fmtDatetimeLocal } from './popup-test-helpers.js';

/**
 * Automate: TC-DISPLAY-002, TC-DATE-001, TC-DATE-003, TC-DATE-004,
 *           TC-PLAT-001, TC-PLAT-002, TC-SCOPE-001, TC-CLIENT-001, TC-FREQ-001B
 * (อ้างอิง docs/test-cases/Arincare_PopupNotification_TestCases.xlsx)
 *
 * แต่ละเทสสร้าง Popup ของตัวเอง (unique code) → login POS-v2 ใหม่แบบสะอาด → เช็ค visible → ลบทิ้งเสมอ
 */
test.describe('Popup Notification — Display Decision Table', () => {
  let cleanupCode: string | null = null;

  test.afterEach(async ({ page }) => {
    if (cleanupCode) {
      const admin = new PopupAdminPage(page);
      await admin.login();
      await admin.deletePopup(cleanupCode).catch((e) => console.warn('cleanup failed:', e.message));
      cleanupCode = null;
    }
  });

  test('TC-CLIENT-001: ไม่มี Popup ใดเข้าเงื่อนไข → ไม่แสดงผลเลย', async ({ page, browser }) => {
    test.setTimeout(150_000);
    // ไม่สร้าง Popup ใดๆ — เช็คตรงๆ ว่าไม่มีอะไรแสดง
    const visible = await checkPopupVisibleOnFreshPos(browser);
    expect(visible).toBe(false);
  });

  test('TC-DISPLAY-002: Popup status=inactive → ไม่แสดงผล (พิสูจน์เงื่อนไข A)', async ({ page, browser }) => {
    test.setTimeout(150_000);
    const admin = new PopupAdminPage(page);
    const code = uniqueCode('QA_D002');
    cleanupCode = code;
    await admin.login();
    await admin.gotoCreate();
    await admin.fillCreateForm({
      title: 'QA Inactive Test', code, status: 'inactive',
      startDateTime: fmtDatetimeLocal(new Date(Date.now() - 5 * 60_000)),
      endDateTime: fmtDatetimeLocal(new Date(Date.now() + 3_600_000)),
      posV2: true, webApp: false, scope: 'global', rawHtml: '<p>test</p>',
      buttonText: 'ปิด', buttonAction: 'close',
    });
    await admin.submitCreate();

    const visible = await checkPopupVisibleOnFreshPos(browser);
    expect(visible).toBe(false);
  });

  test('TC-DATE-001: start_date = ตอนนี้ (ขอบล่าง) → แสดงผล', async ({ page, browser }) => {
    test.setTimeout(150_000);
    const admin = new PopupAdminPage(page);
    const code = uniqueCode('QA_DT001');
    cleanupCode = code;
    await admin.login();
    await admin.gotoCreate();
    await admin.fillCreateForm({
      title: 'QA Start=Now Test', code, status: 'active',
      startDateTime: fmtDatetimeLocal(new Date(Date.now() - 60_000)),
      endDateTime: fmtDatetimeLocal(new Date(Date.now() + 3_600_000)),
      posV2: true, webApp: false, scope: 'global', rawHtml: '<p>test</p>',
      buttonText: 'ปิด', buttonAction: 'close',
    });
    await admin.submitCreate();

    const visible = await checkPopupVisibleOnFreshPos(browser);
    expect(visible).toBe(true);
  });

  test('TC-DATE-003: ยังไม่ถึง start_date → ไม่แสดงผล', async ({ page, browser }) => {
    test.setTimeout(150_000);
    const admin = new PopupAdminPage(page);
    const code = uniqueCode('QA_DT003');
    cleanupCode = code;
    await admin.login();
    await admin.gotoCreate();
    await admin.fillCreateForm({
      title: 'QA Future Start Test', code, status: 'active',
      startDateTime: fmtDatetimeLocal(new Date(Date.now() + 24 * 3_600_000)),
      endDateTime: fmtDatetimeLocal(new Date(Date.now() + 48 * 3_600_000)),
      posV2: true, webApp: false, scope: 'global', rawHtml: '<p>test</p>',
      buttonText: 'ปิด', buttonAction: 'close',
    });
    await admin.submitCreate();

    const visible = await checkPopupVisibleOnFreshPos(browser);
    expect(visible).toBe(false);
  });

  test('TC-DATE-004: พ้น end_date แล้ว → ไม่แสดงผล', async ({ page, browser }) => {
    test.setTimeout(150_000);
    const admin = new PopupAdminPage(page);
    const code = uniqueCode('QA_DT004');
    cleanupCode = code;
    await admin.login();
    await admin.gotoCreate();
    await admin.fillCreateForm({
      title: 'QA Past End Test', code, status: 'active',
      startDateTime: fmtDatetimeLocal(new Date(Date.now() - 48 * 3_600_000)),
      endDateTime: fmtDatetimeLocal(new Date(Date.now() - 60_000)),
      posV2: true, webApp: false, scope: 'global', rawHtml: '<p>test</p>',
      buttonText: 'ปิด', buttonAction: 'close',
    });
    await admin.submitCreate();

    const visible = await checkPopupVisibleOnFreshPos(browser);
    expect(visible).toBe(false);
  });

  test('TC-PLAT-001: platform=[pos-v2] เท่านั้น → แสดงบน POS-v2', async ({ page, browser }) => {
    test.setTimeout(150_000);
    const admin = new PopupAdminPage(page);
    const code = uniqueCode('QA_PLAT01');
    cleanupCode = code;
    await admin.login();
    await admin.gotoCreate();
    await admin.fillCreateForm({
      title: 'QA PosOnly Test', code, status: 'active',
      startDateTime: fmtDatetimeLocal(new Date(Date.now() - 60_000)),
      endDateTime: fmtDatetimeLocal(new Date(Date.now() + 3_600_000)),
      posV2: true, webApp: false, scope: 'global', rawHtml: '<p>test</p>',
      buttonText: 'ปิด', buttonAction: 'close',
    });
    await admin.submitCreate();

    const visible = await checkPopupVisibleOnFreshPos(browser);
    expect(visible).toBe(true);
  });

  test('TC-PLAT-002: platform=[web-app] เท่านั้น → ไม่แสดงบน POS-v2', async ({ page, browser }) => {
    test.setTimeout(150_000);
    const admin = new PopupAdminPage(page);
    const code = uniqueCode('QA_PLAT02');
    cleanupCode = code;
    await admin.login();
    await admin.gotoCreate();
    await admin.fillCreateForm({
      title: 'QA WebAppOnly Test', code, status: 'active',
      startDateTime: fmtDatetimeLocal(new Date(Date.now() - 60_000)),
      endDateTime: fmtDatetimeLocal(new Date(Date.now() + 3_600_000)),
      posV2: false, webApp: true, scope: 'global', rawHtml: '<p>test</p>',
      buttonText: 'ปิด', buttonAction: 'close',
    });
    await admin.submitCreate();

    const visible = await checkPopupVisibleOnFreshPos(browser);
    expect(visible).toBe(false);
  });

  test('TC-SCOPE-001: scope=Global → แสดงผลให้พนักงานถูกต้อง', async ({ page, browser }) => {
    test.setTimeout(150_000);
    const admin = new PopupAdminPage(page);
    const code = uniqueCode('QA_SC001');
    cleanupCode = code;
    await admin.login();
    await admin.gotoCreate();
    await admin.fillCreateForm({
      title: 'QA Global Scope Test', code, status: 'active',
      startDateTime: fmtDatetimeLocal(new Date(Date.now() - 60_000)),
      endDateTime: fmtDatetimeLocal(new Date(Date.now() + 3_600_000)),
      posV2: true, webApp: false, scope: 'global', rawHtml: '<p>test</p>',
      buttonText: 'ปิด', buttonAction: 'close',
    });
    await admin.submitCreate();

    const visible = await checkPopupVisibleOnFreshPos(browser);
    expect(visible).toBe(true);
  });

  test('TC-FREQ-001B: once ไม่กดปิดเลย (แค่ viewed) → ครั้งถัดไปไม่แสดงซ้ำ', async ({ page, browser }) => {
    // ⚠️ 2026-09-02: เทสนี้ login POS-v2 สดใหม่ 2 รอบติดกัน (มากกว่าเทสอื่นในไฟล์นี้ที่ทำแค่รอบเดียว)
    // บวกกับหลังแก้ PopupModal.isVisible() ให้ poll จริงแล้ว รอบที่ 2 (คาดหวัง false) จะรอเต็ม 12s
    // จริงๆ แทนที่จะ instant-return เหมือนเดิม — เพิ่ม timeout กันชนเพดานเดิม (240s เคย fail แบบ timeout)
    test.setTimeout(300_000);
    const admin = new PopupAdminPage(page);
    const code = uniqueCode('QA_F1B');
    cleanupCode = code;
    await admin.login();
    await admin.gotoCreate();
    await admin.fillCreateForm({
      title: 'QA Once No-Close Test', code, status: 'active',
      startDateTime: fmtDatetimeLocal(new Date(Date.now() - 60_000)),
      endDateTime: fmtDatetimeLocal(new Date(Date.now() + 3_600_000)),
      posV2: true, webApp: false, frequency: 'once', scope: 'global', rawHtml: '<p>test</p>',
      buttonText: 'ปิด', buttonAction: 'close',
    });
    await admin.submitCreate();

    // Login ครั้งที่ 1 — เห็นแน่ๆ แต่ "ไม่กดปิดใดๆ เลย" (แค่ปิด context)
    const firstView = await checkPopupVisibleOnFreshPos(browser);
    expect(firstView).toBe(true);

    // Login ครั้งที่ 2 — คาดหวังว่าไม่เห็นซ้ำ (viewed นับว่าจบแล้ว แม้ไม่เคยกดปิด)
    const secondView = await checkPopupVisibleOnFreshPos(browser);
    expect(secondView).toBe(false);
  });
});
