import { test as base } from '@playwright/test';
import { PopupAdminPage } from '../../pages/PopupAdminPage.js';
import { PopupModal } from '../../pages/PopupModal.js';
import { PosRegisterPage } from '../../pages/PosRegisterPage.js';
import { LoginPage } from '../../pages/LoginPage.js';

type PopupFixtures = {
  popupAdmin: PopupAdminPage;
  popupAdminLoggedIn: PopupAdminPage;
  popupModalOnPos: PopupModal;
  popupModalOnWebApp: PopupModal;
};

export const test = base.extend<PopupFixtures>({
  popupAdmin: async ({ page }, use) => {
    await use(new PopupAdminPage(page));
  },

  popupAdminLoggedIn: async ({ page }, use) => {
    const admin = new PopupAdminPage(page);
    await admin.login();
    await use(admin);
  },

  // Login เข้า POS-v2 ครบ flow แล้วคืน PopupModal ที่ผูกกับหน้านั้น
  popupModalOnPos: async ({ page }, use) => {
    const posRegister = new PosRegisterPage(page);
    await posRegister.goto();
    await posRegister.loginToPos();
    await use(new PopupModal(page));
  },

  // Login เข้า Web-App ERP ครบ flow แล้วคืน PopupModal ที่ผูกกับหน้านั้น
  popupModalOnWebApp: async ({ page }, use) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login(
      process.env.TEST_USERNAME ?? 'watcharin.arincare@gmail.com',
      process.env.TEST_PASSWORD ?? '01072024',
    );
    await login.selectCompany(process.env.COMPANY_NAME ?? 'Arincare Pharmacy');
    await login.selectBranch(process.env.POS_BRANCH); // ขาดไม่ได้ — ดู LoginPage.selectBranch()
    await login.expectLoggedIn();
    await use(new PopupModal(page));
  },
});

export const expect = test.expect;

/** สร้าง Code ที่ไม่ซ้ำสำหรับแต่ละเทส กัน conflict กับแคมเปญจริงที่มีอยู่แล้ว */
export function uniqueCode(prefix: string): string {
  return `${prefix}_${Date.now()}`.toUpperCase();
}
