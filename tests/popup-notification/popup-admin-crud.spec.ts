import { test, expect, uniqueCode } from './popup-fixtures.js';

/**
 * Automate: TC-ADMIN-001, TC-ADMIN-007, TC-ADMIN-008
 * (อ้างอิง docs/test-cases/Arincare_PopupNotification_TestCases.xlsx)
 *
 * ทุกเทสสร้างแคมเปญด้วย Code แบบ unique (uniqueCode) แล้วลบทิ้งใน afterEach เสมอ
 * เพื่อไม่ทิ้งขยะบน Staging และไม่ไปแตะแคมเปญจริง "สายรุ้งทดสอบ" (Code: LJDLKFJ)
 */
test.describe('Popup Notification — Admin CRUD', () => {
  let createdCode: string | null = null;

  test.afterEach(async ({ popupAdmin }) => {
    if (createdCode && !process.env.SKIP_CLEANUP) {
      await popupAdmin.gotoList();
      await popupAdmin.deletePopup(createdCode).catch((e) => console.warn('cleanup delete failed:', e.message));
    } else if (createdCode) {
      console.log('SKIP_CLEANUP set — leaving campaign on staging:', createdCode);
    }
    createdCode = null;
  });

  test('TC-ADMIN-001: สร้างแคมเปญใหม่ครบทุกฟิลด์ที่จำเป็น แล้วปรากฏในตารางรายการ', async ({ popupAdminLoggedIn: admin }) => {
    const code = uniqueCode('QA_CREATE');
    createdCode = code;

    await admin.gotoCreate();
    await admin.fillCreateForm({
      title: 'QA Automation — ทดสอบสร้างแคมเปญ',
      code,
      status: 'active',
      webApp: false,
      posV2: true,
      frequency: 'once',
      scope: 'global',
      size: 'MD',
      rawHtml: '<h2>QA Automation Test</h2><p>เนื้อหาทดสอบจาก Playwright</p>',
      buttonText: 'ปิด',
      buttonAction: 'close',
    });
    await admin.submitCreate();

    await admin.gotoList();
    await admin.expectRowVisible(code);
  });

  test('TC-ADMIN-007: Toggle Active → Inactive ต้องอัปเดตสถานะในตารางทันที', async ({ popupAdminLoggedIn: admin }) => {
    const code = uniqueCode('QA_TOGGLE');
    createdCode = code;

    await admin.gotoCreate();
    await admin.fillCreateForm({
      title: 'QA Automation — ทดสอบ Toggle สถานะ',
      code,
      status: 'active',
      posV2: true,
      frequency: 'once',
      scope: 'global',
      rawHtml: '<p>ทดสอบ toggle</p>',
      buttonText: 'ปิด',
      buttonAction: 'close',
    });
    await admin.submitCreate();
    await admin.gotoList();

    const before = await admin.getRowStatusText(code);
    expect(before).toMatch(/เปิดใช้งาน/);

    await admin.toggleStatus(code);
    await admin.gotoList();
    const after = await admin.getRowStatusText(code);
    expect(after).toMatch(/ปิดใช้งาน/);
  });

  test('TC-ADMIN-008: ลบแคมเปญ ทำให้หายไปจากตารางรายการทันที', async ({ popupAdminLoggedIn: admin }) => {
    const code = uniqueCode('QA_DELETE');

    await admin.gotoCreate();
    await admin.fillCreateForm({
      title: 'QA Automation — ทดสอบลบแคมเปญ',
      code,
      status: 'active',
      posV2: true,
      frequency: 'once',
      scope: 'global',
      rawHtml: '<p>ทดสอบลบ</p>',
      buttonText: 'ปิด',
      buttonAction: 'close',
    });
    await admin.submitCreate();
    await admin.gotoList();
    await admin.expectRowVisible(code);

    await admin.deletePopup(code);
    await admin.gotoList();
    await admin.expectRowAbsent(code);
    // ไม่ต้อง cleanup ซ้ำใน afterEach เพราะลบไปแล้วในเทสนี้เอง
  });
});
