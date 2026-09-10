/**
 * Discovery Part 3 – ฟอร์ม "สร้างป็อปอัพใหม่" บน Web-Admin
 * รัน: npx tsx docs/popup-notification-discovery/discover-popup-create-form.ts
 *
 * ⚠️ Read-only discovery: กรอกฟอร์มเพื่อดู field/selector เท่านั้น จะไม่กด Submit/บันทึกจริง
 */
import { chromium } from '@playwright/test';
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
const OUT_DIR = __dirname;

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 150 });
  const ctx = await browser.newContext({ locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
  const page = await ctx.newPage();

  console.log('🔐 logging in...');
  await page.goto(`${ADMIN_BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1_500);
  const e = page.locator('input[type="email"], input[name="email"]').first();
  if (await e.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await e.fill(ADMIN_EMAIL);
    await page.locator('input[type="password"], input[name="password"]').first().fill(ADMIN_PASS);
    await page.locator('button[type="submit"], button:has-text("เข้าสู่ระบบ")').first().click().catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  }

  await page.goto(`${ADMIN_BASE}/popup-notifications`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2_000);

  console.log('➕ Clicking "สร้างป็อปอัพใหม่"...');
  const createBtn = page.locator('a:has-text("สร้างป็อปอัพใหม่"), button:has-text("สร้างป็อปอัพใหม่")').first();
  await createBtn.click().catch((err) => console.log('  click failed:', err.message));
  await page.waitForTimeout(2_500);
  console.log('  URL:', page.url());

  await page.screenshot({ path: path.join(OUT_DIR, '06-create-form.png'), fullPage: true }).catch(() => {});

  // scroll down เผื่อฟอร์มยาว แล้ว screenshot ต่อ
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, '06b-create-form-mid.png'), fullPage: false }).catch(() => {});
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT_DIR, '06c-create-form-bottom.png'), fullPage: false }).catch(() => {});

  // ── Dump ทุก form field พร้อม attribute ที่ใช้เป็น selector ─────────────────
  const dumpInputs = await page.$$eval('input', (els) => els.map((el) => ({
    tag: el.tagName, type: (el as HTMLInputElement).type || null,
    name: (el as HTMLInputElement).name || null, id: el.id || null,
    placeholder: (el as HTMLInputElement).placeholder || null,
    checked: (el as HTMLInputElement).checked,
    testid: el.getAttribute('data-testid'),
  }))).catch((err) => [{ error: String(err) }]);

  const dumpSelects = await page.$$eval('select', (els) => els.map((el) => ({
    tag: el.tagName, name: (el as HTMLSelectElement).name || null, id: el.id || null,
    testid: el.getAttribute('data-testid'),
    options: Array.from((el as HTMLSelectElement).options).map((o) => ({ value: o.value, text: o.text })),
  }))).catch((err) => [{ error: String(err) }]);

  const dumpTextareas = await page.$$eval('textarea', (els) => els.map((el) => ({
    name: (el as HTMLTextAreaElement).name || null, id: el.id || null,
  }))).catch((err) => [{ error: String(err) }]);

  const dumpButtons = await page.$$eval('button', (els) => els.map((b) => ({
    text: (b.textContent || '').trim().slice(0, 60), id: b.id || null, cls: b.className || null,
  }))).catch((err) => [{ error: String(err) }]);

  const dump: any = { inputs: dumpInputs, selects: dumpSelects, textareas: dumpTextareas, buttons: dumpButtons };

  // ── คลิก "กำหนดเฉพาะร้านค้า / สาขา" เพื่อดูฟิลด์ที่โผล่มาเพิ่ม ──────────────
  console.log('🎯 Clicking "กำหนดเฉพาะร้านค้า / สาขา" radio...');
  const scopeRadio = page.locator('text=กำหนดเฉพาะร้านค้า').locator('..').locator('input[type="radio"]').first();
  const scopeRadioAlt = page.getByText('กำหนดเฉพาะร้านค้า', { exact: false }).first();
  await scopeRadioAlt.click().catch(async (err) => {
    console.log('  label click failed, trying radio input directly:', err.message);
    await page.locator('input[type="radio"]').nth(1).click().catch(() => {});
  });
  await page.waitForTimeout(1_500);
  await page.screenshot({ path: path.join(OUT_DIR, '07-scope-specific.png'), fullPage: true }).catch(() => {});

  const dumpSelects2 = await page.$$eval('select', (els) => els.map((el) => ({
    tag: el.tagName, name: (el as HTMLSelectElement).name || null, id: el.id || null,
    testid: el.getAttribute('data-testid'),
    options: Array.from((el as HTMLSelectElement).options).map((o) => ({ value: o.value, text: o.text })),
  }))).catch((err) => [{ error: String(err) }]);
  dump.selectsAfterScopeSpecific = dumpSelects2;

  // ── ลองเปลี่ยน Action เมื่อคลิก เป็น redirect แล้ว api_call เพื่อดูฟิลด์ที่โผล่มาเพิ่ม ──
  // ⚠️ ต้อง exclude PHP Debugbar (.phpdebugbar) ออกจาก query ทั้งหมด เพราะมันมี select[name=method]/
  // input[name=uri]/input[name=ip] ของตัวเอง (dev toolbar) ที่ไม่เกี่ยวกับฟอร์มนี้เลย
  console.log('🔘 Checking "Action เมื่อคลิก" dropdown on button (excluding debugbar)...');
  const actionSelect = page.locator('select:not(.phpdebugbar select)').filter({ hasText: 'ปิดหน้าต่าง' }).first();
  const actionSelectAlt = page.locator('select').filter({ has: page.locator('option', { hasText: 'ปิดหน้าต่าง (Close Modal)' }) }).first();
  const targetSelect = (await actionSelectAlt.count().catch(() => 0)) > 0 ? actionSelectAlt : actionSelect;

  for (const [label, value] of [['redirect', 'redirect'], ['api_call', 'api_call']] as const) {
    console.log(`  → selecting action="${value}"`);
    await targetSelect.selectOption(value).catch((err) => console.log('    select failed:', err.message));
    await page.waitForTimeout(1_000);
    await page.screenshot({ path: path.join(OUT_DIR, `08-button-action-${label}.png`), fullPage: true }).catch(() => {});
    const scoped = await page.evaluate(() => {
      const debugbar = document.querySelector('.phpdebugbar');
      const within = (el: Element) => !debugbar || !debugbar.contains(el);
      const grabInputs = () => Array.from(document.querySelectorAll('input, textarea'))
        .filter(within)
        .filter((el) => (el as HTMLElement).offsetParent !== null) // เฉพาะที่มองเห็นอยู่จริง
        .map((el) => {
          const e = el as HTMLInputElement;
          return { tag: el.tagName, type: e.type || null, name: e.name || null, placeholder: e.placeholder || null,
                   nearbyLabel: el.closest('div')?.querySelector('label')?.textContent?.trim() || null };
        });
      return grabInputs();
    }).catch((err) => [{ error: String(err) }]);
    (dump as any)[`visibleFieldsAfter_${label}`] = scoped;
  }
  // กลับไปตั้งเป็น close เหมือนเดิมก่อนจบ (ไม่ได้ submit อยู่แล้ว แต่เผื่อ screenshot สุดท้ายดูสะอาด)
  await targetSelect.selectOption('close').catch(() => {});

  fs.writeFileSync(path.join(OUT_DIR, 'popup-create-form-dump.json'), JSON.stringify(dump, null, 2), 'utf-8');
  console.log('📝 form dump written to popup-create-form-dump.json');

  // เก็บ HTML ทั้งหน้าไว้ด้วยเผื่อต้อง grep เพิ่มทีหลัง
  fs.writeFileSync(path.join(OUT_DIR, '06-create-form.html'), await page.content(), 'utf-8');

  console.log('✅ Done (ไม่ได้กด Submit ใดๆ — read-only)');
  await browser.close();
})();
