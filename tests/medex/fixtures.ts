import { test as base } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage.js';
import { MedExMarketplacePage } from '../../pages/MedExMarketplacePage.js';

/**
 * PHP Debugbar (dev toolbar ของ staging เอง ไม่ใช่ส่วนของแอป) ลอยอยู่ล่างจอทุกหน้า และเคย intercept
 * pointer events ทำให้คลิกปุ่มจริงไม่ติด (พบจริง 2026-09-07) — ซ่อนด้วย CSS ทันทีที่ทุกหน้าโหลด แทนที่จะ
 * พยายามคลิกทะลุมันทุกจุด ใช้ addInitScript() เพราะ inject ครั้งเดียวแล้วมีผลกับทุก navigation ใน page/context นั้น
 */
export const HIDE_DEBUGBAR_SCRIPT = () => {
  const inject = () => {
    const style = document.createElement('style');
    style.textContent = '.phpdebugbar { display: none !important; }';
    document.head?.appendChild(style);
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    inject();
  }
};

type Fixtures = {
  loginPage: LoginPage;
  medexPage: MedExMarketplacePage;
  loggedIn: void;
  /** รายชื่อสินค้าที่เทสเพิ่มลงตะกร้า — push ชื่อเข้ามาแล้วจะถูกลบออกจากตะกร้าอัตโนมัติหลังจบเทส (best-effort) */
  trackedProducts: string[];
};

export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  medexPage: async ({ page }, use) => {
    await page.addInitScript(HIDE_DEBUGBAR_SCRIPT);
    await use(new MedExMarketplacePage(page));
  },
  // Login + เลือกบริษัท เท่านั้น — Med-Ex Marketplace ไม่ต้องเลือกสาขา (ยืนยันแล้วโดยผู้ใช้ 2026-09-07)
  loggedIn: async ({ loginPage }, use) => {
    await loginPage.goto();
    await loginPage.login(
      process.env.TEST_USERNAME ?? '',
      process.env.TEST_PASSWORD ?? '',
    );
    await loginPage.selectCompany(process.env.COMPANY_NAME ?? 'Arincare Pharmacy');
    await loginPage.expectLoggedIn();
    await use();
  },
  // ล้างตะกร้า staging ที่ใช้ร่วมกันหลังจบแต่ละเทส กัน pollute ข้าม suite/ผู้ใช้อื่น
  trackedProducts: async ({ medexPage }, use) => {
    const products: string[] = [];
    await use(products);
    if (products.length > 0) {
      try {
        await medexPage.gotoCartPage();
        for (const name of products) {
          await medexPage.removeFromCartPage(name).catch(() => {});
        }
      } catch {
        // cleanup best-effort — ไม่ทำให้เทสอื่น fail ถ้าลบไม่สำเร็จ
      }
    }
  },
});

export const expect = test.expect;
