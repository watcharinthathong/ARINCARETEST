import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const BASE = process.env.ADMIN_BASE_URL ?? 'https://admin-stg.arincare.com';
const EMAIL = process.env.ADMIN_EMAIL ?? '';
const PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const OUT = __dirname;
function save(name: string, content: string) {
  fs.writeFileSync(path.join(OUT, name), content, 'utf-8');
  console.log('saved', name);
}
async function shot(page: any, name: string, fullPage = true) {
  await page.screenshot({ path: path.join(OUT, name), fullPage }).catch((e: any) => console.log('err', e.message));
  console.log('shot', name);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const page = await (await browser.newContext({ baseURL: BASE, locale: 'th-TH' })).newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#preloader', { state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('#login-btn').click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);

  console.log('1. goto admin cart detail directly (id 4155, our test LC-260909-BJZIZ)...');
  await page.goto(`${BASE}/arinlink/order-management/cart/4155`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  console.log('URL:', page.url());
  await shot(page, '120-admin-cart-detail.png');
  save('120-admin-cart-detail.html', await page.content());

  console.log('2. goto admin cart LIST and change status inline via dropdown...');
  await page.goto(`${BASE}/arinlink/order-management/cart?page=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);

  const testRow = page.locator('tr').filter({ hasText: 'LC-260909-BJZIZ' }).first();
  const dropdownToggle = testRow.locator('.dropdown-toggle').first();
  await dropdownToggle.click();
  await page.waitForTimeout(500);
  await shot(page, '121-status-dropdown-open.png');
  const dropdownGroupHtml = await testRow.locator('.dropdown').first().evaluate((el: any) => el.outerHTML).catch((e: any) => 'ERR: ' + e.message);
  save('121-dropdown-group.html', dropdownGroupHtml);
  console.log('dropdown group HTML:', dropdownGroupHtml.slice(0, 1500));

  // ⚠️ <ul class="dropdown-menu"> หายไปจาก DOM ปกติหลังเปิด (แม้ .btn-group ได้ class "open" แล้วก็ตาม) —
  // ค้นหาแบบ global ทั้งหน้าแทน เผื่อถูก teleport ไปที่อื่นใน DOM
  const allMenusInfo = await page.evaluate(() => {
    const menus = Array.from(document.querySelectorAll('ul.dropdown-menu, .dropdown-menu'));
    return menus.map((m) => ({
      visible: (m as HTMLElement).offsetParent !== null,
      text: m.textContent?.trim().slice(0, 100),
      html: m.outerHTML.slice(0, 300),
    }));
  });
  console.log('ALL dropdown-menu elements on page:', JSON.stringify(allMenusInfo, null, 2));

  const openMenu = page.locator('ul.dropdown-menu:visible').first();
  const optionTexts = await openMenu.locator('li a').allTextContents().catch(() => []);
  console.log('dropdown option texts (raw):', JSON.stringify(optionTexts));
  const payDoneOption = openMenu.locator('li a').filter({ hasText: 'ชำระเงิน' }).first();
  await payDoneOption.click({ timeout: 10000 });
  await page.waitForTimeout(1500);
  await shot(page, '122-after-status-select.png');
  save('122-after-status-select.html', await page.content());

  // Modal "เปลี่ยนสถานะการชำระเงิน" มีช่อง "หมายเหตุ" (textarea) เป็น required field —
  // ถ้าไม่กรอกจะโดน native HTML5 validation บล็อกไว้เงียบๆ (พบจริงจากการรันครั้งก่อน)
  const remarkTextarea = page.locator('textarea').first();
  const remarkVisible = await remarkTextarea.isVisible({ timeout: 3000 }).catch(() => false);
  console.log('หมายเหตุ textarea visible:', remarkVisible);
  if (remarkVisible) {
    await remarkTextarea.fill('ทดสอบอนุมัติการชำระเงินผ่าน Playwright discovery script (2026-09-09)');
  }

  const saveBtn = page.getByRole('button', { name: 'บันทึก', exact: true });
  const saveVisible = await saveBtn.isVisible({ timeout: 3000 }).catch(() => false);
  console.log('save confirm modal visible:', saveVisible);
  if (saveVisible) {
    await saveBtn.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
  }
  await shot(page, '123-after-save.png');
  save('123-after-save.html', await page.content());

  console.log('3. reload cart list, check our row status now...');
  await page.goto(`${BASE}/arinlink/order-management/cart?page=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  const rowText = await page.locator('tr').filter({ hasText: 'LC-260909-BJZIZ' }).first().innerText().catch(() => 'NOT FOUND');
  console.log('our row after approve:', rowText.replace(/\n+/g, ' | '));
  await shot(page, '124-cart-list-after-approve.png');

  console.log('4. check admin order list for a NEW order...');
  await page.goto(`${BASE}/arinlink/order-management/order?page=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '130-admin-order-list-after-approve.png');
  const firstOrderRow = await page.locator('table tbody tr').first().innerText().catch(() => 'NOT FOUND');
  console.log('first order row now:', firstOrderRow.replace(/\n+/g, ' | '));

  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
