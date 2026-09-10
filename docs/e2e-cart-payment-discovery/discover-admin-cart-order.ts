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

  console.log('1. admin login...');
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#preloader', { state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('#login-btn').click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);
  console.log('URL after login:', page.url());

  console.log('2. goto admin cart list...');
  await page.goto(`${BASE}/arinlink/order-management/cart?page=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);
  console.log('URL:', page.url());
  await shot(page, '100-admin-cart-list.png');
  save('100-admin-cart-list.html', await page.content());

  const cartListInfo = await page.evaluate(() => {
    const headerCells = Array.from(document.querySelectorAll('table thead th')).map((th) => th.textContent?.trim());
    const rows = Array.from(document.querySelectorAll('table tbody tr')).slice(0, 8).map((tr) =>
      Array.from(tr.querySelectorAll('td')).map((td) => td.textContent?.trim())
    );
    return { headerCells, rows };
  });
  save('100-admin-cart-list-info.json', JSON.stringify(cartListInfo, null, 2));
  console.log('admin cart list info:', JSON.stringify(cartListInfo));

  console.log('3. try to find our test ref (LC-260909-BJZIZ) and open its detail...');
  const testRow = page.locator('tr').filter({ hasText: 'LC-260909' }).first();
  const foundTestRow = await testRow.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('found our test LC-260909 row:', foundTestRow);
  if (foundTestRow) {
    const link = testRow.locator('a').first();
    await link.click().catch((e: any) => console.log('detail click err:', e.message?.slice(0, 150)));
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
    console.log('URL after opening our test row:', page.url());
    await shot(page, '101-admin-cart-detail-ourtest.png');
    save('101-admin-cart-detail-ourtest.html', await page.content());

    const detailButtons = await page.evaluate(() => Array.from(document.querySelectorAll('button, a')).map((b) => b.textContent?.trim()).filter(Boolean));
    save('101-admin-cart-detail-buttons.json', JSON.stringify(detailButtons, null, 2));
    console.log('admin cart detail buttons:', JSON.stringify(detailButtons));
  }

  console.log('4. goto admin order list...');
  await page.goto(`${BASE}/arinlink/order-management/order?page=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);
  console.log('URL:', page.url());
  await shot(page, '110-admin-order-list.png');
  save('110-admin-order-list.html', await page.content());

  const orderListInfo = await page.evaluate(() => {
    const headerCells = Array.from(document.querySelectorAll('table thead th')).map((th) => th.textContent?.trim());
    const rows = Array.from(document.querySelectorAll('table tbody tr')).slice(0, 5).map((tr) =>
      Array.from(tr.querySelectorAll('td')).map((td) => td.textContent?.trim())
    );
    return { headerCells, rows };
  });
  save('110-admin-order-list-info.json', JSON.stringify(orderListInfo, null, 2));
  console.log('admin order list info:', JSON.stringify(orderListInfo));

  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
