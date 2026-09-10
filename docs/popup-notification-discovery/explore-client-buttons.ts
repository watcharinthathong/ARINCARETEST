/**
 * Exploratory Testing — ทดสอบทุกปุ่มที่กดได้บน Popup Notification Modal จริง (POS-v2)
 * ปุ่มที่ทดสอบ: native × (close), CTA type=close, CTA type=redirect, CTA type=api_call, backdrop click
 * แต่ละ scenario สร้าง Popup ใหม่ (scope=เฉพาะบริษัท/สาขาของเราเอง กัน spam ผู้ใช้จริง) แล้วลบทิ้งทันทีหลังทดสอบ
 */
import { chromium, Page } from '@playwright/test';
import * as fs from 'fs';
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
const POS_BRANCH = process.env.POS_BRANCH ?? 'arincare';

const findings: string[] = [];
const note = (s: string) => { console.log('📝', s); findings.push(s); };
const fmt = (d: Date) => { const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

async function adminLogin(page: Page) {
  await page.goto(`${ADMIN_BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.locator('input[type="email"], input[name="email"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"], input[name="password"]').first().fill(ADMIN_PASS);
  await page.locator('button:has-text("เข้าสู่ระบบ")').first().click();
  await page.waitForLoadState('networkidle').catch(() => {});
}

async function createPopup(page: Page, code: string, buttonText: string, buttonAction: 'close' | 'redirect' | 'api_call', url?: string) {
  await page.goto(`${ADMIN_BASE}/popup-notifications/create`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.getByPlaceholder('เช่น แจ้งปรับปรุงระบบประจำเดือน, ข่าวสารประชาสัมพันธ์').fill(`QA Button Test [${buttonAction}]`);
  await page.getByPlaceholder('เช่น POPUP_NOTICE_2026').fill(code);
  const dt = page.locator('input[type="datetime-local"]');
  await dt.nth(0).fill(fmt(new Date(Date.now() - 5 * 60_000)));
  await dt.nth(1).fill(fmt(new Date(Date.now() + 60 * 60_000)));
  // platform: ปิด Web-App เหลือแค่ POS-v2
  const checkboxes = page.locator('input[type="checkbox"]');
  if (await checkboxes.nth(0).isChecked()) await checkboxes.nth(0).click();
  if (!(await checkboxes.nth(1).isChecked())) await checkboxes.nth(1).click();
  // scope = เฉพาะร้านค้าของเราเอง (กันกระทบผู้ใช้จริงคนอื่น)
  await page.locator('input[type="radio"]').nth(1).click();
  await page.waitForTimeout(500);
  await page.getByPlaceholder('พิมพ์ชื่อร้าน หรือรหัสสาขา ARC... เพื่อค้นหา').fill(COMPANY_NAME);
  await page.waitForTimeout(1500);
  const firstResult = page.locator('.dropdown-menu, .autocomplete-results, [role="listbox"]').locator('li, a, div').first();
  if (await firstResult.isVisible({ timeout: 5000 }).catch(() => false)) await firstResult.click();
  await page.waitForTimeout(500);

  await page.getByRole('button', { name: 'สลับไปโหมดเขียนโค้ด Raw HTML' }).click();
  await page.waitForTimeout(300);
  await page.locator('textarea').first().fill(`<h3>QA Button Test</h3><p>Testing action=${buttonAction}</p>`);

  await page.getByPlaceholder('เช่น สั่งซื้อเลย, ดูรายละเอียด').fill(buttonText);
  const actionSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'ปิดหน้าต่าง (Close Modal)' }) });
  await actionSelect.selectOption(buttonAction);
  if (buttonAction !== 'close' && url) {
    await page.getByPlaceholder('https://... หรือ /products').fill(url);
  }
  await page.getByRole('button', { name: 'สร้างป็อปอัพ' }).click();
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
}

async function deletePopup(page: Page, code: string) {
  await page.goto(`${ADMIN_BASE}/popup-notifications`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
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

async function loginPos(page: Page) {
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
      await branchSelect.selectOption({ label: POS_BRANCH }).catch(async () => { await branchSelect.selectOption({ index: 1 }).catch(() => {}); });
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
  // ถอด auto-dismiss handler ที่จะไปกดปิด popup ของเราเองอัตโนมัติ (ดู qa-context.md)
  await page.removeLocatorHandler(page.locator('button:has-text("ปิด")').first()).catch(() => {});
}

async function runScenario(browser: any, scenario: {
  code: string; label: string; buttonText: string; action: 'close' | 'redirect' | 'api_call'; url?: string;
  interact: (page: Page, modalRoot: string) => Promise<void>;
}) {
  console.log(`\n════════ SCENARIO: ${scenario.label} ════════`);
  const adminCtx = await browser.newContext({ locale: 'th-TH' });
  const adminPage = await adminCtx.newPage();
  await adminLogin(adminPage);
  await createPopup(adminPage, scenario.code, scenario.buttonText, scenario.action, scenario.url);
  note(`[${scenario.label}] สร้าง Popup code=${scenario.code} สำเร็จ`);

  const posCtx = await browser.newContext({ locale: 'th-TH' });
  const posPage = await posCtx.newPage();
  const requests: string[] = [];
  posPage.on('request', (r) => { if (r.url().includes('example.com') || r.url().includes('webhook')) requests.push(`${r.method()} ${r.url()}`); });
  posPage.on('framenavigated', (f) => { if (f === posPage.mainFrame()) console.log('  >>> POS navigated to:', f.url()); });

  try {
    await loginPos(posPage);
    await posPage.waitForTimeout(2000);
    const modal = posPage.locator('.popup-notification-modal-custom').first();
    const visible = await modal.isVisible({ timeout: 15000 }).catch(() => false);
    note(`[${scenario.label}] Popup แสดงผลบน POS-v2 ไหม: ${visible}`);
    if (visible) {
      await posPage.screenshot({ path: path.join(__dirname, `explore-btn-${scenario.action}-before.png`) });
      await scenario.interact(posPage, '.popup-notification-modal-custom');
      await posPage.waitForTimeout(2000);
      const stillOpen = await modal.isVisible({ timeout: 3000 }).catch(() => false);
      note(`[${scenario.label}] หลังคลิก → Modal ยังเปิดอยู่ไหม: ${stillOpen}`);
      note(`[${scenario.label}] URL POS-v2 หลังคลิก: ${posPage.url()}`);
      if (requests.length) note(`[${scenario.label}] Network requests ไปยัง URL ที่ตั้งไว้: ${JSON.stringify(requests)}`);
      await posPage.screenshot({ path: path.join(__dirname, `explore-btn-${scenario.action}-after.png`) });
    }
  } catch (e: any) {
    note(`⚠️ [${scenario.label}] ERROR: ${e.message.split('\n')[0]}`);
  }

  // ตรวจ Interactions Log จาก Admin
  try {
    await adminPage.goto(`${ADMIN_BASE}/popup-notifications`, { waitUntil: 'domcontentloaded' });
    await adminPage.waitForTimeout(800);
    await adminPage.getByPlaceholder('ค้นหาชื่อหรือรหัส...').fill(scenario.code);
    await adminPage.getByRole('button', { name: 'ค้นหา' }).click();
    await adminPage.waitForTimeout(1000);
    const table = adminPage.locator('table').filter({ has: adminPage.locator('th', { hasText: 'ชื่อป็อปอัพ' }) });
    const row = table.locator('tbody tr').filter({ hasText: scenario.code });
    if (await row.count() > 0) {
      await row.locator('a[title="ดูรายละเอียด"]').click();
      await adminPage.waitForLoadState('networkidle').catch(() => {});
      await adminPage.waitForTimeout(800);
      const logText = await adminPage.locator('body').innerText();
      const actionMatch = logText.match(/Action ที่ทำ[\s\S]{0,300}/);
      note(`[${scenario.label}] Interactions Log (ตัดมาบางส่วน): ${(actionMatch?.[0] || '(ไม่เจอ)').replace(/\s+/g, ' ').slice(0, 300)}`);
      await adminPage.screenshot({ path: path.join(__dirname, `explore-btn-${scenario.action}-log.png`), fullPage: true });
    }
  } catch (e: any) {
    note(`⚠️ [${scenario.label}] อ่าน Interactions Log ไม่สำเร็จ: ${e.message.split('\n')[0]}`);
  }

  await deletePopup(adminPage, scenario.code);
  note(`[${scenario.label}] ลบ Popup ทดสอบเรียบร้อย`);
  await posCtx.close();
  await adminCtx.close();
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const ts = Date.now();

  await runScenario(browser, {
    code: `QA_BTN_NATIVEX_${ts}`, label: 'Native × (modal-header close icon)',
    buttonText: 'ปิด', action: 'close',
    interact: async (page) => {
      await page.locator('.popup-notification-modal-custom .modal-header button, .popup-notification-modal-custom .close').first().click();
    },
  });

  await runScenario(browser, {
    code: `QA_BTN_CLOSECTA_${ts}`, label: 'CTA button type=close',
    buttonText: 'ปิดหน้าต่างนี้', action: 'close',
    interact: async (page) => {
      await page.locator('.popup-notification-modal-custom').getByText('ปิดหน้าต่างนี้', { exact: true }).click();
    },
  });

  await runScenario(browser, {
    code: `QA_BTN_REDIRECT_${ts}`, label: 'CTA button type=redirect',
    buttonText: 'ดูรายละเอียด', action: 'redirect', url: 'https://example.com/qa-redirect-test',
    interact: async (page) => {
      await page.locator('.popup-notification-modal-custom').getByText('ดูรายละเอียด', { exact: true }).click();
    },
  });

  await runScenario(browser, {
    code: `QA_BTN_APICALL_${ts}`, label: 'CTA button type=api_call',
    buttonText: 'ยืนยัน', action: 'api_call', url: 'https://example.com/qa-api-call-test',
    interact: async (page) => {
      await page.locator('.popup-notification-modal-custom').getByText('ยืนยัน', { exact: true }).click();
    },
  });

  await runScenario(browser, {
    code: `QA_BTN_BACKDROP_${ts}`, label: 'คลิก backdrop (นอก modal)',
    buttonText: 'ปิด', action: 'close',
    interact: async (page) => {
      await page.mouse.click(5, 5);
    },
  });

  fs.writeFileSync(path.join(__dirname, 'explore-client-buttons-findings.json'), JSON.stringify(findings, null, 2), 'utf-8');
  console.log('\n\n✅✅✅ ALL SCENARIOS DONE — findings saved');
  await browser.close();
})();
