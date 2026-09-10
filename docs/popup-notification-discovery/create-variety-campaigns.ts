/**
 * สร้าง Popup Notification หลากหลายรูปแบบเท่าที่สร้างได้ — ครอบคลุมทุกมิติที่ Admin ตั้งค่าได้
 * (Size × Frequency × Scope × Platform × Button Action × Button Color × Status)
 * ⚠️ ไม่ลบหลังสร้าง — ทิ้งไว้บน Staging ให้ดูตัวอย่างจริงในหน้า Admin List
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
  code: string;
  title: string;
  status: 'active' | 'inactive';
  size: 'SM' | 'MD' | 'LG' | 'XL' | '2XL';
  frequency: 'once' | 'daily' | 'weekly' | 'monthly';
  scope: 'global' | 'specific';
  webApp: boolean;
  posV2: boolean;
  html: string;
  buttons: ButtonSpec[];
};

const ts = Date.now();
const COLORS = ['btn-primary', 'btn-success', 'btn-warning', 'btn-danger', 'btn-info', 'btn-default'];

const CAMPAIGNS: Campaign[] = [
  { code: `QA_VAR_01_SM_${ts}`, title: '🔥 [SM/Once/Global/POS-v2] โปรโมชั่นสินค้าประจำสัปดาห์', status: 'active',
    size: 'SM', frequency: 'once', scope: 'global', webApp: false, posV2: true,
    html: '<h3>🔥 โปรโมชั่นสัปดาห์นี้</h3><p>ลดสูงสุด 20% สินค้าเลือกสรร</p>',
    buttons: [{ text: 'ดูโปรโมชั่น', color: 'btn-primary', action: 'close' }] },

  { code: `QA_VAR_02_MD_${ts}`, title: '⚠️ [MD/Daily/Global/Web-App] แจ้งปิดปรับปรุงระบบ', status: 'active',
    size: 'MD', frequency: 'daily', scope: 'global', webApp: true, posV2: false,
    html: '<h3>⚠️ แจ้งปิดปรับปรุงระบบ</h3><p>ระบบจะปิดปรับปรุงวันเสาร์ที่จะถึงนี้ เวลา 00:00–04:00 น.</p>',
    buttons: [{ text: 'รับทราบ', color: 'btn-warning', action: 'close' }] },

  { code: `QA_VAR_03_LG_${ts}`, title: '✨ [LG/Weekly/Global/Both] แนะนำฟีเจอร์ใหม่', status: 'active',
    size: 'LG', frequency: 'weekly', scope: 'global', webApp: true, posV2: true,
    html: '<h3>✨ ฟีเจอร์ใหม่มาแล้ว!</h3><p>ลองใช้ระบบแจ้งเตือนสต็อกสินค้าอัตโนมัติได้แล้ววันนี้</p>',
    buttons: [{ text: 'ดูรายละเอียด', color: 'btn-success', action: 'redirect', url: 'https://example.com/features/new' }] },

  { code: `QA_VAR_04_XL_${ts}`, title: '📢 [XL/Monthly/Company/POS-v2] ข่าวประชาสัมพันธ์รายเดือน', status: 'active',
    size: 'XL', frequency: 'monthly', scope: 'specific', webApp: false, posV2: true,
    html: '<h3>📢 ข่าวประชาสัมพันธ์ประจำเดือน</h3><p>สรุปยอดขายและกิจกรรมเดือนนี้ของร้านค้าในเครือ</p>',
    buttons: [{ text: 'อ่านต่อ', color: 'btn-info', action: 'redirect', url: 'https://example.com/news/monthly' }] },

  { code: `QA_VAR_05_2XL_${ts}`, title: '🎉 [2XL/Once/Company/Both] แคมเปญใหญ่ประจำปี', status: 'active',
    size: '2XL', frequency: 'once', scope: 'specific', webApp: true, posV2: true,
    html: '<h2>🎉 มหกรรมลดราคาประจำปี 2569</h2><p style="font-size:18px">สั่งซื้อวันนี้ รับส่วนลดสูงสุด 40% พร้อมเครดิตเงินคืน</p><p>ระยะเวลาโปรโมชั่น: วันนี้ – 31 กันยายน 2569</p>',
    buttons: [{ text: 'สั่งซื้อเลย', color: 'btn-danger', action: 'redirect', url: 'https://example.com/promo/annual' }] },

  { code: `QA_VAR_06_APICALL_${ts}`, title: '🔗 [MD/Daily/Global/Web-App] ทดสอบปุ่ม เรียก API ภายนอก', status: 'active',
    size: 'MD', frequency: 'daily', scope: 'global', webApp: true, posV2: false,
    html: '<h3>🔗 ทดสอบ Action: เรียก API ภายนอก</h3><p>ตัวอย่างปุ่มที่ตั้งค่าเป็น api_call</p>',
    buttons: [{ text: 'ยืนยันรับทราบ', color: 'btn-default', action: 'api_call', url: 'https://example.com/webhook/ack' }] },

  { code: `QA_VAR_07_MULTIBTN_${ts}`, title: '🧩 [LG/Once/Global/Both] หลายปุ่มในแคมเปญเดียว', status: 'active',
    size: 'LG', frequency: 'once', scope: 'global', webApp: true, posV2: true,
    html: '<h3>🧩 เลือกการตอบรับ</h3><p>แคมเปญนี้มี 3 ปุ่ม ครบทั้ง 3 Action ประเภท และสีต่างกัน</p>',
    buttons: [
      { text: 'ปิด', color: 'btn-default', action: 'close' },
      { text: 'ดูรายละเอียด', color: 'btn-primary', action: 'redirect', url: 'https://example.com/detail' },
      { text: 'แจ้งเตือนระบบ', color: 'btn-danger', action: 'api_call', url: 'https://example.com/webhook/notify' },
    ] },

  { code: `QA_VAR_08_INACTIVE_${ts}`, title: '🚫 [SM/Once/Global/POS-v2] ตัวอย่างสถานะ Inactive', status: 'inactive',
    size: 'SM', frequency: 'once', scope: 'global', webApp: false, posV2: true,
    html: '<h3>🚫 แคมเปญนี้ปิดใช้งานอยู่</h3><p>ใช้เป็นตัวอย่างสถานะ Inactive ในตาราง List</p>',
    buttons: [{ text: 'ปิด', color: 'btn-default', action: 'close' }] },

  { code: `QA_VAR_09_THAILONG_${ts}`, title: '📋 [XL/Weekly/Company/POS-v2] เนื้อหาไทยยาว + อีโมจิ', status: 'active',
    size: 'XL', frequency: 'weekly', scope: 'specific', webApp: false, posV2: true,
    html: '<h3>📋 สรุปนโยบายใหม่ 🇹🇭</h3><p>เรียนผู้ประกอบการร้านขายยาทุกท่าน 🙏 ขณะนี้บริษัทได้ปรับปรุงนโยบาย'
      + 'การจัดส่งสินค้าใหม่ ✅ เพื่อความรวดเร็วและแม่นยำยิ่งขึ้น กรุณาตรวจสอบที่อยู่จัดส่งของท่านให้ถูกต้อง '
      + '📦 ก่อนวันที่ 1 กันยายน 2569 หากมีข้อสงสัยติดต่อฝ่ายบริการลูกค้า ☎️ 02-123-4567</p>',
    buttons: [{ text: 'เข้าใจแล้ว', color: 'btn-info', action: 'close' }] },

  { code: `QA_VAR_10_2XL_DAILY_${ts}`, title: '📊 [2XL/Daily/Global/Web-App] แดชบอร์ดสรุปยอดขายวันนี้', status: 'active',
    size: '2XL', frequency: 'daily', scope: 'global', webApp: true, posV2: false,
    html: '<h2>📊 สรุปยอดขายวันนี้</h2><table style="width:100%;border-collapse:collapse"><tr><td style="border:1px solid #ccc;padding:8px">ยอดขายรวม</td><td style="border:1px solid #ccc;padding:8px">฿125,400</td></tr><tr><td style="border:1px solid #ccc;padding:8px">จำนวนบิล</td><td style="border:1px solid #ccc;padding:8px">87 บิล</td></tr></table>',
    buttons: [{ text: 'ดูรายงานเต็ม', color: 'btn-success', action: 'redirect', url: 'https://example.com/reports/daily' }] },

  { code: `QA_VAR_11_XL_MONTHLY_BOTH_${ts}`, title: '🏆 [XL/Monthly/Company/Both] จัดอันดับยอดขายประจำเดือน', status: 'active',
    size: 'XL', frequency: 'monthly', scope: 'specific', webApp: true, posV2: true,
    html: '<h3>🏆 Top 5 ร้านค้ายอดขายสูงสุด</h3><p>ขอแสดงความยินดีกับร้านค้าที่ติดอันดับยอดขายสูงสุดประจำเดือนนี้</p>',
    buttons: [{ text: 'ดูอันดับทั้งหมด', color: 'btn-warning', action: 'redirect', url: 'https://example.com/ranking' }] },

  { code: `QA_VAR_12_LG_WEEKLY_POS_${ts}`, title: '💊 [LG/Weekly/Global/POS-v2] เตือนสต็อกยาใกล้หมดอายุ', status: 'active',
    size: 'LG', frequency: 'weekly', scope: 'global', webApp: false, posV2: true,
    html: '<h3>💊 แจ้งเตือนสต็อกยาใกล้หมดอายุ</h3><p>พบสินค้า 12 รายการที่จะหมดอายุภายใน 30 วัน กรุณาตรวจสอบคลังสินค้า</p>',
    buttons: [{ text: 'ตรวจสอบคลังสินค้า', color: 'btn-danger', action: 'redirect', url: 'https://example.com/inventory/expiring' }] },

  { code: `QA_VAR_13_MD_ONCE_COMPANY_${ts}`, title: '🎁 [MD/Once/Company/Web-App] ของขวัญพิเศษเฉพาะร้านค้าในเครือ', status: 'active',
    size: 'MD', frequency: 'once', scope: 'specific', webApp: true, posV2: false,
    html: '<h3>🎁 ของขวัญพิเศษสำหรับคุณ</h3><p>รับคูปองส่วนลด 15% เฉพาะร้านค้าในเครือ Arincare Pharmacy</p>',
    buttons: [{ text: 'รับคูปอง', color: 'btn-primary', action: 'api_call', url: 'https://example.com/coupon/claim' }] },
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

    // ── ปุ่มแรก (มีอยู่แล้วในฟอร์ม) ──
    const firstBtn = c.buttons[0];
    await page.getByPlaceholder('เช่น สั่งซื้อเลย, ดูรายละเอียด').fill(firstBtn.text);
    const colorSelect1 = page.locator('select').filter({ has: page.locator('option', { hasText: 'Default (สีเทา)' }) }).first();
    await colorSelect1.selectOption(firstBtn.color);
    const actionSelect1 = page.locator('select').filter({ has: page.locator('option', { hasText: 'ปิดหน้าต่าง (Close Modal)' }) }).first();
    await actionSelect1.selectOption(firstBtn.action);
    if (firstBtn.action !== 'close' && firstBtn.url) {
      await page.getByPlaceholder('https://... หรือ /products').first().fill(firstBtn.url);
    }

    // ── ปุ่มเพิ่มเติม (ถ้ามี) ──
    for (let i = 1; i < c.buttons.length; i++) {
      await page.getByRole('button', { name: 'เพิ่มปุ่ม Action' }).click();
      await page.waitForTimeout(400);
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
    await page.waitForTimeout(800);

    const urlAfter = page.url();
    const ok = urlAfter.includes('/popup-notifications') && !urlAfter.includes('/create');
    return { code: c.code, ok };
  } catch (e: any) {
    return { code: c.code, ok: false, error: e.message.split('\n')[0] };
  }
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 30 });
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
