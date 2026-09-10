/**
 * Follow-up: 3 คำถามที่ยังไม่ได้คำตอบชัดจาก explore-client-buttons.ts
 *  A) ปุ่ม × จริงอยู่ตรงไหน (modal-header) — selector เดิมหาไม่เจอ
 *  B) ปุ่ม redirect กด "ดูรายละเอียด" แล้ว URL ไม่เปลี่ยนเลย — เปิด tab ใหม่หรือไม่ทำงาน?
 *  C) backdrop click ได้ action_taken="dismissed" แต่ข้อมูลจริงบนระบบมี "dismiss_backdrop"/"dismiss_close_button" แยกกัน — ทำไมไม่ตรงกัน?
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
  await page.getByPlaceholder('เช่น แจ้งปรับปรุงระบบประจำเดือน, ข่าวสารประชาสัมพันธ์').fill(`QA Followup [${buttonAction}]`);
  await page.getByPlaceholder('เช่น POPUP_NOTICE_2026').fill(code);
  const dt = page.locator('input[type="datetime-local"]');
  await dt.nth(0).fill(fmt(new Date(Date.now() - 5 * 60_000)));
  await dt.nth(1).fill(fmt(new Date(Date.now() + 60 * 60_000)));
  const checkboxes = page.locator('input[type="checkbox"]');
  if (await checkboxes.nth(0).isChecked()) await checkboxes.nth(0).click();
  if (!(await checkboxes.nth(1).isChecked())) await checkboxes.nth(1).click();
  await page.locator('input[type="radio"]').nth(1).click();
  await page.waitForTimeout(500);
  await page.getByPlaceholder('พิมพ์ชื่อร้าน หรือรหัสสาขา ARC... เพื่อค้นหา').fill(COMPANY_NAME);
  await page.waitForTimeout(1500);
  const firstResult = page.locator('.dropdown-menu, .autocomplete-results, [role="listbox"]').locator('li, a, div').first();
  if (await firstResult.isVisible({ timeout: 5000 }).catch(() => false)) await firstResult.click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: 'สลับไปโหมดเขียนโค้ด Raw HTML' }).click();
  await page.waitForTimeout(300);
  await page.locator('textarea').first().fill(`<h3>QA Followup</h3><p>action=${buttonAction}</p>`);
  await page.getByPlaceholder('เช่น สั่งซื้อเลย, ดูรายละเอียด').fill(buttonText);
  const actionSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'ปิดหน้าต่าง (Close Modal)' }) });
  await actionSelect.selectOption(buttonAction);
  if (buttonAction !== 'close' && url) await page.getByPlaceholder('https://... หรือ /products').fill(url);
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
  await page.removeLocatorHandler(page.locator('button:has-text("ปิด")').first()).catch(() => {});
}

async function readLog(adminPage: Page, code: string) {
  await adminPage.goto(`${ADMIN_BASE}/popup-notifications`, { waitUntil: 'domcontentloaded' });
  await adminPage.waitForTimeout(800);
  await adminPage.getByPlaceholder('ค้นหาชื่อหรือรหัส...').fill(code);
  await adminPage.getByRole('button', { name: 'ค้นหา' }).click();
  await adminPage.waitForTimeout(1000);
  const table = adminPage.locator('table').filter({ has: adminPage.locator('th', { hasText: 'ชื่อป็อปอัพ' }) });
  const row = table.locator('tbody tr').filter({ hasText: code });
  if (await row.count() > 0) {
    await row.locator('a[title="ดูรายละเอียด"]').click();
    await adminPage.waitForLoadState('networkidle').catch(() => {});
    await adminPage.waitForTimeout(800);
    const logText = await adminPage.locator('body').innerText();
    const actionMatch = logText.match(/Action ที่ทำ[\s\S]{0,300}/);
    return (actionMatch?.[0] || '(ไม่เจอ)').replace(/\s+/g, ' ').slice(0, 300);
  }
  return '(ไม่เจอแถว)';
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const ts = Date.now();

  // ── A + B: native × + redirect (เช็ค tab ใหม่) รวมกันเพื่อประหยัดเวลา ──
  {
    const code = `QA_FUP_NATIVEX_${ts}`;
    const adminCtx = await browser.newContext({ locale: 'th-TH' });
    const adminPage = await adminCtx.newPage();
    await adminLogin(adminPage);
    await createPopup(adminPage, code, 'ปิด', 'close');

    const posCtx = await browser.newContext({ locale: 'th-TH' });
    const posPage = await posCtx.newPage();
    const newPages: string[] = [];
    posCtx.on('page', (p) => { newPages.push(p.url()); console.log('  >>> NEW TAB/PAGE OPENED:', p.url()); });

    await loginPos(posPage);
    await posPage.waitForTimeout(2000);
    const modal = posPage.locator('.popup-notification-modal-custom').first();
    if (await modal.isVisible({ timeout: 15000 }).catch(() => false)) {
      // Dump โครงสร้าง modal-header จริง เพื่อหาปุ่ม × ที่ถูกต้อง
      const headerHtml = await modal.locator('.modal-header').innerHTML().catch((e) => 'ERROR: ' + e.message);
      note(`[A: native ×] modal-header HTML: ${headerHtml.replace(/\s+/g, ' ').slice(0, 400)}`);
      fs.writeFileSync(path.join(__dirname, 'modal-header-dump.html'), headerHtml, 'utf-8');

      // ลองหาปุ่ม × หลายแบบ
      const candidates = [
        '.modal-header .close',
        '.modal-header button[aria-label="Close"]',
        '.modal-header button.btn-close',
        '.modal-header [class*="close"]',
        '.modal-header >> text=×',
      ];
      let clicked = false;
      for (const sel of candidates) {
        const loc = posPage.locator(sel).first();
        const cnt = await loc.count().catch(() => 0);
        note(`[A: native ×] selector "${sel}" → พบ ${cnt} element`);
        if (cnt > 0 && !clicked) {
          await loc.click({ timeout: 5000 }).catch((e) => note(`[A] click ${sel} failed: ${e.message.split('\n')[0]}`));
          await posPage.waitForTimeout(1500);
          const stillVisible = await modal.isVisible({ timeout: 2000 }).catch(() => false);
          note(`[A: native ×] คลิก "${sel}" แล้ว modal ยังเปิดอยู่ไหม: ${stillVisible}`);
          clicked = !stillVisible;
        }
      }
    }
    const logA = await readLog(adminPage, code);
    note(`[A: native ×] Interactions Log: ${logA}`);
    await deletePopup(adminPage, code);
    await posCtx.close(); await adminCtx.close();
  }

  // ── B: redirect — เช็คว่ามี new tab เปิดไหม ──
  {
    const code = `QA_FUP_REDIRECT_${ts}`;
    const adminCtx = await browser.newContext({ locale: 'th-TH' });
    const adminPage = await adminCtx.newPage();
    await adminLogin(adminPage);
    await createPopup(adminPage, code, 'ดูรายละเอียด', 'redirect', 'https://example.com/qa-redirect-followup');

    const posCtx = await browser.newContext({ locale: 'th-TH' });
    const posPage = await posCtx.newPage();
    const newPages: string[] = [];
    posCtx.on('page', (p) => { newPages.push(p.url()); console.log('  >>> NEW TAB/PAGE OPENED:', p.url()); });

    await loginPos(posPage);
    await posPage.waitForTimeout(2000);
    const modal = posPage.locator('.popup-notification-modal-custom').first();
    if (await modal.isVisible({ timeout: 15000 }).catch(() => false)) {
      await modal.getByText('ดูรายละเอียด', { exact: true }).click();
      await posPage.waitForTimeout(3000);
      note(`[B: redirect] เปิด tab ใหม่กี่อัน: ${newPages.length} ${JSON.stringify(newPages)}`);
      note(`[B: redirect] URL ของ posPage เดิมหลังคลิก: ${posPage.url()}`);
    }
    await deletePopup(adminPage, code);
    await posCtx.close(); await adminCtx.close();
  }

  // ── C: backdrop click ด้วย locator แม่นยำ (ไม่ใช่ raw pixel coords) ──
  {
    const code = `QA_FUP_BACKDROP_${ts}`;
    const adminCtx = await browser.newContext({ locale: 'th-TH' });
    const adminPage = await adminCtx.newPage();
    await adminLogin(adminPage);
    await createPopup(adminPage, code, 'ปิด', 'close');

    const posCtx = await browser.newContext({ locale: 'th-TH' });
    const posPage = await posCtx.newPage();
    await loginPos(posPage);
    await posPage.waitForTimeout(2000);
    const modal = posPage.locator('.popup-notification-modal-custom').first();
    if (await modal.isVisible({ timeout: 15000 }).catch(() => false)) {
      const backdrop = posPage.locator('.modal-backdrop').first();
      const backdropCount = await backdrop.count();
      note(`[C: backdrop] เจอ .modal-backdrop กี่ element: ${backdropCount}`);
      if (backdropCount > 0) {
        await backdrop.click({ force: true, position: { x: 5, y: 5 } }).catch((e) => note(`[C] click backdrop failed: ${e.message.split('\n')[0]}`));
      } else {
        // fallback: คลิกที่ modal-dialog เอง (นอก modal-content) — บางทีก็นับเป็น backdrop
        await modal.click({ position: { x: 2, y: 2 }, force: true }).catch(() => {});
      }
      await posPage.waitForTimeout(1500);
      const stillVisible = await modal.isVisible({ timeout: 2000 }).catch(() => false);
      note(`[C: backdrop] หลังคลิก modal ยังเปิดอยู่ไหม: ${stillVisible}`);
    }
    const logC = await readLog(adminPage, code);
    note(`[C: backdrop] Interactions Log: ${logC}`);
    await deletePopup(adminPage, code);
    await posCtx.close(); await adminCtx.close();
  }

  fs.writeFileSync(path.join(__dirname, 'explore-client-buttons-2-findings.json'), JSON.stringify(findings, null, 2), 'utf-8');
  console.log('\n✅ FOLLOWUP DONE');
  await browser.close();
})();
