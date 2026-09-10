/**
 * ทดสอบซ้ำ: navigate ไปหน้า MedEx Marketplace ด้วยการ "คลิกเมนูในแอป" แทนการ page.goto() ตรงๆ
 * เพื่อดูว่าต่างจากที่เคยสรุปว่า Modal ไม่ขึ้น (BUG-008) หรือไม่
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

async function deleteByCode(page: Page, code: string) {
  await page.goto(`${ADMIN_BASE}/popup-notifications`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.getByPlaceholder('ค้นหาชื่อหรือรหัส...').fill(code);
  await page.getByRole('button', { name: 'ค้นหา' }).click();
  await page.waitForTimeout(1000);
  const table = page.locator('table').filter({ has: page.locator('th', { hasText: 'ชื่อป็อปอัพ' }) });
  const row = table.locator('tbody tr').filter({ hasText: code });
  if (await row.count() > 0) {
    page.once('dialog', (d) => d.accept().catch(() => {}));
    await row.locator('button[title="ลบ"]').click();
    await page.waitForTimeout(800);
    const confirmBtn = page.locator('button:has-text("ยืนยัน"), button:has-text("ลบ")').first();
    if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) await confirmBtn.click();
    await page.waitForTimeout(1200);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const adminPage = await (await browser.newContext({ locale: 'th-TH' })).newPage();
  await adminPage.goto(`${ADMIN_BASE}/login`, { waitUntil: 'domcontentloaded' });
  await adminPage.waitForTimeout(800);
  await adminPage.locator('input[type="email"], input[name="email"]').first().fill(ADMIN_EMAIL);
  await adminPage.locator('input[type="password"], input[name="password"]').first().fill(ADMIN_PASS);
  await adminPage.locator('button:has-text("เข้าสู่ระบบ")').first().click();
  await adminPage.waitForLoadState('networkidle').catch(() => {});

  const code = `QA_MEDEX_CLICKNAV_${Date.now()}`;
  await adminPage.goto(`${ADMIN_BASE}/popup-notifications/create`, { waitUntil: 'domcontentloaded' });
  await adminPage.waitForTimeout(800);
  await adminPage.getByPlaceholder('เช่น แจ้งปรับปรุงระบบประจำเดือน, ข่าวสารประชาสัมพันธ์').fill('QA MedEx ClickNav Test');
  await adminPage.getByPlaceholder('เช่น POPUP_NOTICE_2026').fill(code);
  const dt = adminPage.locator('input[type="datetime-local"]');
  await dt.nth(0).fill(fmt(new Date(Date.now() - 5 * 60_000)));
  await dt.nth(1).fill(fmt(new Date(Date.now() + 24 * 3600_000)));
  const cb = adminPage.locator('input[type="checkbox"]');
  if (await cb.nth(0).isChecked()) await cb.nth(0).click();
  if (await cb.nth(1).isChecked()) await cb.nth(1).click();
  if (!(await cb.nth(2).isChecked())) await cb.nth(2).click();
  await adminPage.getByRole('button', { name: 'สลับไปโหมดเขียนโค้ด Raw HTML' }).click();
  await adminPage.waitForTimeout(300);
  await adminPage.locator('textarea').first().fill(`<h3>QA MedEx ClickNav Test</h3><p>ทดสอบด้วยการคลิกเมนูแทน goto ตรง</p>`);
  await adminPage.getByPlaceholder('เช่น สั่งซื้อเลย, ดูรายละเอียด').fill('ปิด');
  await adminPage.getByRole('button', { name: 'สร้างป็อปอัพ' }).click();
  await adminPage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await adminPage.waitForTimeout(1000);
  console.log('สร้างสำเร็จ:', code);

  const clientPage = await (await browser.newContext({ locale: 'th-TH', viewport: { width: 1280, height: 900 } })).newPage();
  clientPage.on('console', (msg) => { if (msg.type() === 'error') console.log('  [console.error]', msg.text().slice(0, 200)); });
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
  console.log('URL after company select:', clientPage.url());

  // ปิด popup ที่อาจโผล่จาก Web-App platform ตรงนี้ก่อน (ถ้ามี) ไม่ให้บัง nav
  const anyModal = clientPage.locator('.popup-notification-modal-custom').first();
  if (await anyModal.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('มี Popup Web-App โผล่ตรงนี้ก่อน ปิดก่อน nav ต่อ');
    await anyModal.locator('button:has-text("ปิด"), .modal-header button').first().click().catch(() => {});
    await clientPage.waitForTimeout(1000);
  }

  // ── คลิกเมนู "MedEx" ในแอป แทนการ goto ตรง ──
  const medexNav = clientPage.locator('a:has-text("MedEx"), a:has-text("Med-Ex"), [href*="marketplace"]').first();
  const navCount = await medexNav.count();
  console.log('เจอเมนู MedEx/marketplace กี่ตัว:', navCount);
  if (navCount > 0) {
    await medexNav.click();
    await clientPage.waitForLoadState('networkidle').catch(() => {});
    await clientPage.waitForTimeout(4000);
    console.log('URL after click MedEx nav:', clientPage.url());
  } else {
    console.log('ไม่เจอเมนู MedEx บนหน้า จะ goto ตรงแทน');
    await clientPage.goto('https://app-stg.arincare.com/companies/marketplace?page=1', { waitUntil: 'domcontentloaded' });
    await clientPage.waitForTimeout(4000);
  }

  const modal = clientPage.locator('.popup-notification-modal-custom').first();
  const visible = await modal.isVisible({ timeout: 10000 }).catch(() => false);
  console.log('Popup แสดงไหม (หลังคลิกเมนูแทน goto):', visible);
  if (visible) {
    const text = await modal.locator('.popup-html-content').innerText().catch(() => '(หา content ไม่เจอ)');
    console.log('เนื้อหา:', text.slice(0, 150));
  }
  await clientPage.screenshot({ path: path.join(__dirname, 'medex-clicknav-result.png'), fullPage: true });

  await deleteByCode(adminPage, code);
  console.log('cleanup done');
  await browser.close();
})();
