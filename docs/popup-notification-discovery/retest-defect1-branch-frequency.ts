/**
 * Retest Defect 1: Scope=Company (ทุกสาขา) + Frequency=Daily
 * คาดหวัง (ตาม defect report): แสดง Popup 1 ครั้งต่อวัน "ต่อสาขา" — ปิดที่สาขา 1 ไม่ควรซ่อนที่สาขา 2
 * บั๊กที่รายงาน: ระบบนับการแสดงผลจาก User เดียวกัน ไม่แยกตามสาขา
 */
import { chromium, Page, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });
const ADMIN_BASE = process.env.ADMIN_BASE_URL ?? 'https://admin-stg.arincare.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const ADMIN_PASS = process.env.ADMIN_PASSWORD ?? '';
const POS_BASE = process.env.POS_BASE_URL ?? 'https://pos-stg.arincare.com';
const POS_USERNAME = process.env.TEST_USERNAME ?? 'watcharin.arincare@gmail.com';
const POS_PASSWORD = process.env.TEST_PASSWORD ?? '01072024';
const COMPANY_NAME = process.env.COMPANY_NAME ?? 'Arincare Pharmacy';

const fmt = (d: Date) => { const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

async function adminLogin(page: Page) {
  await page.goto(`${ADMIN_BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.locator('input[type="email"], input[name="email"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"], input[name="password"]').first().fill(ADMIN_PASS);
  await page.locator('button:has-text("เข้าสู่ระบบ")').first().click();
  await page.waitForLoadState('networkidle').catch(() => {});
}

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

async function readInteractionsLog(page: Page, code: string): Promise<string> {
  await page.goto(`${ADMIN_BASE}/popup-notifications`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);
  await page.getByPlaceholder('ค้นหาชื่อหรือรหัส...').fill(code);
  await page.getByRole('button', { name: 'ค้นหา' }).click();
  await page.waitForTimeout(1000);
  const table = page.locator('table').filter({ has: page.locator('th', { hasText: 'ชื่อป็อปอัพ' }) });
  const row = table.locator('tbody tr').filter({ hasText: code });
  if (await row.count() === 0) return '(ไม่พบแคมเปญ)';
  await row.locator('a[title="ดูรายละเอียด"]').click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(800);
  const logText = await page.locator('body').innerText();
  const match = logText.match(/Action ที่ทำ[\s\S]{0,500}/);
  return (match?.[0] || '(ไม่เจอ log)').replace(/\s+/g, ' ');
}

async function loginPosAtBranch(page: Page, branchLabel: string) {
  await page.goto(`${POS_BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#preloader, .preloader, [class*="preloader"]', { state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const emailInput = page.locator('input[name="email"]').first();
  if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await emailInput.fill(POS_USERNAME);
    await page.locator('input[type="password"]').first().fill(POS_PASSWORD);
    await page.locator('button:has-text("เข้าสู่ระบบ")').first().click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2500);
  }
  const companySelect = page.locator('select[name="companyId"]').first();
  if (await companySelect.isVisible({ timeout: 8000 }).catch(() => false)) {
    await page.waitForTimeout(1200);
    await companySelect.selectOption({ label: COMPANY_NAME }).catch(async () => { await companySelect.selectOption({ index: 1 }).catch(() => {}); });
    const branchSelect = page.locator('select[name="branchId"]').first();
    if (await branchSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
      await branchSelect.selectOption({ label: branchLabel });
    }
    await page.locator('button:has-text("บันทึก"), button[type="submit"]').first().click().catch(() => {});
    await page.waitForTimeout(3500);
  }
  const finishBtn = page.locator('button:has-text("เสร็จสิ้น")').first();
  if (await finishBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await finishBtn.click().catch(() => {});
    await page.waitForTimeout(3500);
  }
  const empIdInput = page.locator('input[name="username"], input[placeholder*="รหัสพนักงาน"]').first();
  if (await empIdInput.isVisible({ timeout: 5000 }).catch(() => false)) {
    await empIdInput.fill(POS_USERNAME).catch(() => {});
    await page.locator('input[type="password"]').first().fill(POS_PASSWORD).catch(() => {});
    await page.locator('button[type="submit"], button:has-text("เข้าสู่ระบบ")').first().click().catch(() => {});
    await page.waitForTimeout(2500);
  }
  await page.removeLocatorHandler(page.locator('button:has-text("ปิด")').first()).catch(() => {});
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 50 });
  const adminCtx = await browser.newContext({ locale: 'th-TH' });
  const adminPage = await adminCtx.newPage();
  await adminLogin(adminPage);
  const code = `QA_DEFECT1_${Date.now()}`;
  const title = 'QA Retest Defect1 — Branch Frequency';
  const now = Date.now();

  // ── สร้าง Popup: scope=specific เลือกทั้งบริษัท (=ทุกสาขา), frequency=daily ──
  await adminPage.goto(`${ADMIN_BASE}/popup-notifications/create`, { waitUntil: 'domcontentloaded' });
  await adminPage.waitForTimeout(800);
  await adminPage.getByPlaceholder('เช่น แจ้งปรับปรุงระบบประจำเดือน, ข่าวสารประชาสัมพันธ์').fill(title);
  await adminPage.getByPlaceholder('เช่น POPUP_NOTICE_2026').fill(code);
  const dt = adminPage.locator('input[type="datetime-local"]');
  await dt.nth(0).fill(fmt(new Date(now - 5 * 60_000)));
  await dt.nth(1).fill(fmt(new Date(now + 24 * 3600_000)));
  const checkboxes = adminPage.locator('input[type="checkbox"]');
  if (!(await checkboxes.nth(1).isChecked())) await checkboxes.nth(1).click(); // POS-v2 = true
  if (await checkboxes.nth(0).isChecked()) await checkboxes.nth(0).click();     // Web-App = false

  const freqSelect = adminPage.locator('select').filter({ has: adminPage.locator('option', { hasText: 'ครั้งเดียวต่อพนักงาน' }) });
  await freqSelect.selectOption('daily');

  await adminPage.locator('input[type="radio"]').nth(1).click(); // scope=specific
  await adminPage.waitForTimeout(500);
  await adminPage.getByPlaceholder('พิมพ์ชื่อร้าน หรือรหัสสาขา ARC... เพื่อค้นหา').fill('ARC198');
  await adminPage.waitForTimeout(1500);
  const firstResult = adminPage.locator('.dropdown-menu, .autocomplete-results, [role="listbox"]').locator('li, a, div').first();
  await firstResult.click();
  await adminPage.waitForTimeout(500);

  await adminPage.getByRole('button', { name: 'สลับไปโหมดเขียนโค้ด Raw HTML' }).click();
  await adminPage.waitForTimeout(300);
  await adminPage.locator('textarea').first().fill(`<h3>${title}</h3><p>Scope=Company (ทุกสาขา), Frequency=Daily</p>`);
  await adminPage.getByPlaceholder('เช่น สั่งซื้อเลย, ดูรายละเอียด').fill('ปิด');
  await adminPage.getByRole('button', { name: 'สร้างป็อปอัพ' }).click();
  await adminPage.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await adminPage.waitForTimeout(1000);
  console.log('สร้างแคมเปญสำเร็จ:', code);

  try {
    // ── STEP 1: Login สาขา "arincare" → Popup ควรแสดง → ปิด ──
    const ctx1 = await browser.newContext({ locale: 'th-TH' });
    const page1 = await ctx1.newPage();
    await loginPosAtBranch(page1, 'arincare');
    await page1.waitForTimeout(2500);
    const modal1 = page1.locator('.popup-notification-modal-custom').first();
    const visible1 = await modal1.isVisible({ timeout: 12000 }).catch(() => false);
    console.log('[สาขา arincare] Popup แสดงไหม:', visible1);
    if (visible1) {
      await modal1.getByText('ปิด', { exact: true }).click({ timeout: 8000 });
      await expect(modal1).not.toBeVisible({ timeout: 5000 });
      console.log('  → ปิด Popup ที่สาขา arincare สำเร็จจริง (ยืนยันจาก modal หายไป)');
    }
    await ctx1.close();

    const logAfterBranch1 = await readInteractionsLog(adminPage, code);
    console.log('Interactions Log หลังปิดที่สาขา arincare:', logAfterBranch1.slice(0, 400));

    // ── STEP 2: Login สาขา "สยามสแควร์" (คนละสาขา บริษัทเดียวกัน คนเดียวกัน) ──
    const ctx2 = await browser.newContext({ locale: 'th-TH' });
    const page2 = await ctx2.newPage();
    await loginPosAtBranch(page2, 'สยามสแควร์');
    await page2.waitForTimeout(2500);
    const modal2 = page2.locator('.popup-notification-modal-custom').first();
    const visible2 = await modal2.isVisible({ timeout: 12000 }).catch(() => false);
    console.log('[สาขา สยามสแควร์ — คนละสาขา] Popup แสดงไหม:', visible2, visible2 ? '→ ถูกต้องตาม Expected' : '→ ยืนยัน DEFECT: ไม่แสดง (นับ Frequency แบบไม่แยกสาขา)');
    await page2.screenshot({ path: path.join(__dirname, 'defect1-branch2-result.png'), fullPage: true });
    await ctx2.close();

    const logFinal = await readInteractionsLog(adminPage, code);
    console.log('Interactions Log สุดท้าย (ควรมี 2 viewed คนละสาขา ถ้า Expected ถูกต้อง):', logFinal.slice(0, 600));
  } finally {
    await deleteByCode(adminPage, code);
    console.log('ลบแคมเปญทดสอบเรียบร้อย:', code);
  }

  await browser.close();
})();
