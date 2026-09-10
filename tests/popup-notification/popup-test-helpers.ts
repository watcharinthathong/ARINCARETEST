import { Browser, Page } from '@playwright/test';
import { PosRegisterPage } from '../../pages/PosRegisterPage.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { PopupModal } from '../../pages/PopupModal.js';

/**
 * ⚠️ PosRegisterPage.loginToPos() ผูก addLocatorHandler ไว้กับ `button:has-text("ปิด")` แบบ
 * page-wide — ต้องถอดออกทันทีหลัง login ทุกครั้งที่จะทดสอบ Popup Notification บน POS-v2
 * ไม่งั้น handler เดิมจะไปคลิกปิด Popup ของเราเองอัตโนมัติก่อนที่เทสจะทันตรวจสอบ
 * (ดู qa-context.md — ยืนยันจากการ debug จริง 2026-08-27)
 */
export async function removePosAutoDismissHandler(page: Page) {
  await page.removeLocatorHandler(page.locator('button:has-text("ปิด")').first()).catch(() => {});
}

/** Login POS-v2 ครบ flow (รองรับระบุสาขาได้) แล้วถอด auto-dismiss handler ให้อัตโนมัติ */
export async function loginPos(page: Page, opts: { branch?: string } = {}) {
  const posRegister = new PosRegisterPage(page);
  await posRegister.goto();
  await posRegister.loginToPos(opts.branch ? { branch: opts.branch } : {});
  await removePosAutoDismissHandler(page);
}

/**
 * Login Web-App ครบ flow (Login → เลือกบริษัท → เลือกสาขา/เข้าทำงาน)
 *
 * ⚠️ พบจริง 2026-09-02: Popup Notification (platform=web-app) อาจทริกเกอร์ทันทีหลังเลือกบริษัท
 * — คือ "ก่อน" เลือกสาขา ไม่ใช่ "หลัง" — backdrop ของ popup จะบัง link "เข้าทำงาน" ทำให้กดไม่ติด
 * (พฤติกรรม modal ปกติที่บล็อก background จนกว่าจะปิดก่อน — ไม่ใช่บั๊ก)
 * เทสที่ต้องการตรวจสอบเนื้อหา/คลิก popup เอง (เช่น TC-E2E-002) ต้องแยกเรียก LoginPage เอง
 * ไม่ใช้ helper นี้ตรงๆ เพื่อสอดแทรกจุดเช็ค popup ระหว่าง selectCompany กับ selectBranch
 */
export async function loginWebApp(page: Page) {
  const login = new LoginPage(page);
  await login.goto();
  await login.login(
    process.env.TEST_USERNAME ?? 'watcharin.arincare@gmail.com',
    process.env.TEST_PASSWORD ?? '01072024',
  );
  await login.selectCompany(process.env.COMPANY_NAME ?? 'Arincare Pharmacy');
  await login.selectBranch(process.env.POS_BRANCH);
  await login.expectLoggedIn();
}

/**
 * เปิด browser context ใหม่ → login POS-v2 → เช็คว่า Popup Notification แสดงไหม → ปิด context
 * ใช้เมื่อต้องการ "session สะอาด" หลายรอบในเทสเดียว (เช่น เช็คหลาย Popup config ต่อกัน)
 */
export async function checkPopupVisibleOnFreshPos(browser: Browser, opts: { branch?: string } = {}): Promise<boolean> {
  const ctx = await browser.newContext({ locale: 'th-TH' });
  const page = await ctx.newPage();
  await loginPos(page, opts);
  await page.waitForTimeout(2_000);
  const visible = await new PopupModal(page).isVisible(12_000);
  await ctx.close();
  return visible;
}

export async function checkPopupVisibleOnFreshWebApp(browser: Browser): Promise<boolean> {
  const ctx = await browser.newContext({ locale: 'th-TH' });
  const page = await ctx.newPage();
  await loginWebApp(page);
  await page.waitForTimeout(2_000);
  const visible = await new PopupModal(page).isVisible(12_000);
  await ctx.close();
  return visible;
}

export function fmtDatetimeLocal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
