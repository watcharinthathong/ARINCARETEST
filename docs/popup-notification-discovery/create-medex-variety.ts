/**
 * สร้าง Popup Notification หลากหลายแบบสำหรับ Platform Med-Ex โดยเฉพาะ — ไม่ลบหลังสร้าง (ทิ้งไว้บน Staging)
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
const COMPANY_NAME = process.env.COMPANY_NAME ?? 'Arincare Pharmacy';

const fmt = (d: Date) => { const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

type ButtonSpec = { text: string; color: string; action: 'close' | 'redirect' | 'api_call'; url?: string };
type Campaign = {
  code: string; title: string; status: 'active' | 'inactive';
  size: 'SM' | 'MD' | 'LG' | 'XL' | '2XL';
  frequency: 'once' | 'daily' | 'weekly' | 'monthly';
  scope: 'global' | 'specific';
  webApp: boolean; posV2: boolean; medEx: boolean;
  html: string; buttons: ButtonSpec[];
};

const ts = Date.now();

const CAMPAIGNS: Campaign[] = [
  { code: `QA_MEDEX_V04_XL_${ts}`, title: '🏥 [MedEx+Web-App/XL/Monthly/Company] สรุปยอดสั่งซื้อรายเดือน', status: 'active',
    size: 'XL', frequency: 'monthly', scope: 'specific', webApp: true, posV2: false, medEx: true,
    html: '<h3>🏥 สรุปยอดสั่งซื้อรายเดือนผ่าน MedEx</h3><p>ตรวจสอบยอดสั่งซื้อและเครดิตเงินคืนของร้านค้าในเครือ</p>',
    buttons: [{ text: 'ดูสรุปยอด', color: 'btn-info', action: 'redirect', url: 'https://example.com/medex/monthly-summary' }] },

  { code: `QA_MEDEX_V06_MULTIBTN_${ts}`, title: '🔀 [MedEx-only/LG/Once] หลายปุ่มตอบรับ', status: 'active',
    size: 'LG', frequency: 'once', scope: 'global', webApp: false, posV2: false, medEx: true,
    html: '<h3>🔀 เลือกการตอบรับ (MedEx)</h3><p>ทดสอบแคมเปญที่มีปุ่มครบทั้ง 3 ประเภทบน Platform Med-Ex</p>',
    buttons: [
      { text: 'ปิด', color: 'btn-default', action: 'close' },
      { text: 'ไปหน้าสั่งซื้อ', color: 'btn-primary', action: 'redirect', url: 'https://example.com/medex/order' },
      { text: 'แจ้งระบบหลังบ้าน', color: 'btn-success', action: 'api_call', url: 'https://example.com/webhook/medex-ack' },
    ] },
];

async function adminLogin(page: Page) {
  await page.goto(`${ADMIN_BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.locator('input[type="email"], input[name="email"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"], input[name="password"]').first().fill(ADMIN_PASS);
  await page.locator('button:has-text("เข้าสู่ระบบ")').first().click();
  await page.waitForLoadState('networkidle').catch(() => {});
}

async function createCampaign(page: Page, c: Campaign): Promise<{ code: string; ok: boolean; error?: string }> {
  try {
    await page.goto(`${ADMIN_BASE}/popup-notifications/create`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    await page.getByPlaceholder('เช่น แจ้งปรับปรุงระบบประจำเดือน, ข่าวสารประชาสัมพันธ์').fill(c.title);
    await page.getByPlaceholder('เช่น POPUP_NOTICE_2026').fill(c.code);

    const statusSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'Active (เปิดใช้งาน)' }) });
    await statusSelect.selectOption(c.status);

    const dt = page.locator('input[type="datetime-local"]');
    await dt.nth(0).fill(fmt(new Date(Date.now() - 5 * 60_000)));
    await dt.nth(1).fill(fmt(new Date(Date.now() + 30 * 24 * 3600_000)));

    const checkboxes = page.locator('input[type="checkbox"]');
    if ((await checkboxes.nth(0).isChecked()) !== c.webApp) await checkboxes.nth(0).click();
    if ((await checkboxes.nth(1).isChecked()) !== c.posV2) await checkboxes.nth(1).click();
    if ((await checkboxes.nth(2).isChecked()) !== c.medEx) await checkboxes.nth(2).click();

    const freqSelect = page.locator('select').filter({ has: page.locator('option', { hasText: 'ครั้งเดียวต่อพนักงาน' }) });
    await freqSelect.selectOption(c.frequency);

    if (c.scope === 'specific') {
      await page.locator('input[type="radio"]').nth(1).click();
      await page.waitForTimeout(500);
      await page.getByPlaceholder('พิมพ์ชื่อร้าน หรือรหัสสาขา ARC... เพื่อค้นหา').fill(COMPANY_NAME);
      await page.waitForTimeout(1500);
      const firstResult = page.locator('.dropdown-menu, .autocomplete-results, [role="listbox"]').locator('li, a, div').first();
      if (await firstResult.isVisible({ timeout: 5000 }).catch(() => false)) await firstResult.click();
      await page.waitForTimeout(500);
    }

    await page.getByRole('button', { name: c.size, exact: true }).click();

    await page.getByRole('button', { name: 'สลับไปโหมดเขียนโค้ด Raw HTML' }).click();
    await page.waitForTimeout(300);
    await page.locator('textarea').first().fill(c.html);

    const firstBtn = c.buttons[0];
    await page.getByPlaceholder('เช่น สั่งซื้อเลย, ดูรายละเอียด').fill(firstBtn.text);
    const colorSelect1 = page.locator('select').filter({ has: page.locator('option', { hasText: 'Default (สีเทา)' }) }).first();
    await colorSelect1.selectOption(firstBtn.color);
    const actionSelect1 = page.locator('select').filter({ has: page.locator('option', { hasText: 'ปิดหน้าต่าง (Close Modal)' }) }).first();
    await actionSelect1.selectOption(firstBtn.action);
    if (firstBtn.action !== 'close' && firstBtn.url) {
      await page.getByPlaceholder('https://... หรือ /products').first().fill(firstBtn.url);
    }

    for (let i = 1; i < c.buttons.length; i++) {
      await page.getByRole('button', { name: 'เพิ่มปุ่ม Action' }).click();
      await page.waitForTimeout(1000);
      const btn = c.buttons[i];
      const textInputs = page.getByPlaceholder('เช่น สั่งซื้อเลย, ดูรายละเอียด');
      await textInputs.nth(i).fill(btn.text);
      const colorSelects = page.locator('select').filter({ has: page.locator('option', { hasText: 'Default (สีเทา)' }) });
      await colorSelects.nth(i).selectOption(btn.color);
      const actionSelects = page.locator('select').filter({ has: page.locator('option', { hasText: 'ปิดหน้าต่าง (Close Modal)' }) });
      await actionSelects.nth(i).selectOption(btn.action);
      if (btn.action !== 'close' && btn.url) {
        const urlInputs = page.getByPlaceholder('https://... หรือ /products');
        await urlInputs.nth(i).fill(btn.url);
      }
    }

    await page.getByRole('button', { name: 'สร้างป็อปอัพ' }).click();
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1000);

    const urlAfter = page.url();
    const ok = urlAfter.includes('/popup-notifications') && !urlAfter.includes('/create');
    return { code: c.code, ok };
  } catch (e: any) {
    return { code: c.code, ok: false, error: (e?.message ?? String(e)).split('\n')[0] };
  }
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const page = await (await browser.newContext({ locale: 'th-TH' })).newPage();
  await adminLogin(page);

  const results: { code: string; ok: boolean; error?: string }[] = [];
  for (const c of CAMPAIGNS) {
    console.log(`สร้าง: ${c.title}`);
    const r = await createCampaign(page, c);
    results.push(r);
    console.log(`  → ${r.ok ? '✅ สำเร็จ' : '❌ ล้มเหลว: ' + r.error}`);
  }

  console.log('\n=== สรุป ===');
  console.log('สำเร็จ:', results.filter(r => r.ok).length, '/', results.length);
  results.filter(r => !r.ok).forEach(r => console.log('  ล้มเหลว:', r.code, r.error));

  await browser.close();
})();
