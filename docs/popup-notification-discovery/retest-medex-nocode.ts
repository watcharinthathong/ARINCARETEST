/**
 * ทดสอบ hypothesis: "cc" (ทำงานได้จริง) มี Code ว่างเปล่า ("-" ในตาราง) ต่างจากทุกเทสของเราที่กรอก Code เสมอ
 */
import { chromium, Page } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });
const ADMIN_BASE = process.env.ADMIN_BASE_URL ?? 'https://admin-stg.arincare.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const ADMIN_PASS = process.env.ADMIN_PASSWORD ?? '';
const WEB_BASE = process.env.BASE_URL ?? 'https://app-stg.arincare.com';
const USERNAME = process.env.TEST_USERNAME ?? 'watcharin.arincare@gmail.com';
const PASSWORD = process.env.TEST_PASSWORD ?? '01072024';
const COMPANY_NAME = process.env.COMPANY_NAME ?? 'Arincare Pharmacy';
const fmt = (d: Date) => { const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const adminPage = await (await browser.newContext({ locale: 'th-TH' })).newPage();
  await adminPage.goto(`${ADMIN_BASE}/login`, { waitUntil: 'domcontentloaded' });
  await adminPage.waitForTimeout(800);
  await adminPage.locator('input[type="email"], input[name="email"]').first().fill(ADMIN_EMAIL);
  await adminPage.locator('input[type="password"], input[name="password"]').first().fill(ADMIN_PASS);
  await adminPage.locator('button:has-text("เข้าสู่ระบบ")').first().click();
  await adminPage.waitForLoadState('networkidle').catch(() => {});

  await adminPage.goto(`${ADMIN_BASE}/popup-notifications/create`, { waitUntil: 'domcontentloaded' });
  await adminPage.waitForTimeout(800);
  const uniqueTitle = `QA MedEx NoCode ${Date.now()}`;
  await adminPage.getByPlaceholder('เช่น แจ้งปรับปรุงระบบประจำเดือน, ข่าวสารประชาสัมพันธ์').fill(uniqueTitle);
  // ⚠️ ไม่กรอก Code เลย ปล่อยว่างไว้เหมือน "cc"
  const dt = adminPage.locator('input[type="datetime-local"]');
  await dt.nth(0).fill(fmt(new Date(Date.now() - 5 * 60_000)));
  await dt.nth(1).fill(fmt(new Date(Date.now() + 24 * 3600_000)));
  const cb = adminPage.locator('input[type="checkbox"]');
  if (await cb.nth(0).isChecked()) await cb.nth(0).click();
  if (await cb.nth(1).isChecked()) await cb.nth(1).click();
  if (!(await cb.nth(2).isChecked())) await cb.nth(2).click();
  await adminPage.getByPlaceholder('เช่น สั่งซื้อเลย, ดูรายละเอียด').fill('ปิด');
  await adminPage.getByRole('button', { name: 'สร้างป็อปอัพ' }).click();
  await adminPage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await adminPage.waitForTimeout(1500);
  console.log('URL after submit:', adminPage.url());

  // หา ID จากตาราง (ค้นด้วยชื่อ title แทน code)
  await adminPage.getByPlaceholder('ค้นหาชื่อหรือรหัส...').fill(uniqueTitle);
  await adminPage.getByRole('button', { name: 'ค้นหา' }).click();
  await adminPage.waitForTimeout(1200);
  const table = adminPage.locator('table').filter({ has: adminPage.locator('th', { hasText: 'ชื่อป็อปอัพ' }) });
  const rowText = await table.locator('tbody tr').first().innerText().catch(() => '(ไม่เจอ)');
  console.log('แถวที่สร้าง:', rowText.replace(/\s+/g, ' '));
  const idMatch = rowText.match(/#(\d+)/);
  const popupId = idMatch?.[1];
  console.log('Popup ID:', popupId);

  const clientPage = await (await browser.newContext({ locale: 'th-TH', viewport: { width: 1280, height: 900 } })).newPage();
  await clientPage.goto(`${WEB_BASE}/login`, { waitUntil: 'domcontentloaded' });
  await clientPage.waitForSelector('#preloader', { state: 'hidden', timeout: 15000 }).catch(() => {});
  await clientPage.locator('input[name="email"]').fill(USERNAME);
  await clientPage.locator('input[name="password"]').fill(PASSWORD);
  await clientPage.locator('#login-btn').click();
  await clientPage.waitForLoadState('networkidle').catch(() => {});
  await clientPage.waitForTimeout(2000);
  const companyEl = clientPage.getByText(COMPANY_NAME, { exact: false }).first();
  if (await companyEl.isVisible({ timeout: 8000 }).catch(() => false)) {
    await companyEl.click();
    await clientPage.waitForLoadState('networkidle').catch(() => {});
    await clientPage.waitForTimeout(2000);
  }
  const medexNav = clientPage.locator('a:has-text("MedEx"), a:has-text("Med-Ex"), [href*="marketplace"]').first();
  if (await medexNav.count() > 0) {
    await medexNav.click();
    await clientPage.waitForLoadState('networkidle').catch(() => {});
  } else {
    await clientPage.goto('https://app-stg.arincare.com/companies/marketplace?page=1', { waitUntil: 'domcontentloaded' });
  }
  await clientPage.waitForTimeout(5000);
  const modal = clientPage.locator('.popup-notification-modal-custom').first();
  const visible = await modal.isVisible({ timeout: 10000 }).catch(() => false);
  console.log('Popup แสดงไหม (ไม่กรอก Code เลย):', visible);
  await clientPage.screenshot({ path: path.join(__dirname, 'medex-nocode-result.png'), fullPage: true });

  // cleanup ด้วย ID โดยตรง
  if (popupId) {
    adminPage.once('dialog', (d) => d.accept().catch(() => {}));
    await table.locator('tbody tr').first().locator('button[title="ลบ"]').click().catch(() => {});
    await adminPage.waitForTimeout(800);
    const confirmBtn = adminPage.locator('button:has-text("ยืนยัน"), button:has-text("ลบ")').first();
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) await confirmBtn.click();
    await adminPage.waitForTimeout(1200);
  }
  console.log('cleanup done');
  await browser.close();
})();
