import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const WEB_BASE = process.env.BASE_URL ?? 'https://app-stg.arincare.com';
const USERNAME = process.env.TEST_USERNAME ?? '';
const PASSWORD = process.env.TEST_PASSWORD ?? '';
const COMPANY_NAME = process.env.COMPANY_NAME ?? 'Arincare Pharmacy';

const OUT = __dirname;
function save(name: string, content: string) {
  fs.writeFileSync(path.join(OUT, name), content, 'utf-8');
  console.log('saved', name);
}
async function shot(page: any, name: string, fullPage = true) {
  await page.screenshot({ path: path.join(OUT, name), fullPage }).catch((e: any) => console.log('screenshot err', name, e.message));
  console.log('shot', name);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const page = await (await browser.newContext({ baseURL: WEB_BASE, locale: 'th-TH', timezoneId: 'Asia/Bangkok' })).newPage();

  console.log('1. login...');
  await page.goto(`${WEB_BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#preloader', { state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.locator('input[name="email"]').fill(USERNAME);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('#login-btn').click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);

  console.log('2. select company...');
  const companyEl = page.getByText(COMPANY_NAME, { exact: false }).first();
  if (await companyEl.isVisible({ timeout: 8000 }).catch(() => false)) {
    await companyEl.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
  }

  console.log('3. goto order-management/cart (รายการตะกร้า)...');
  await page.goto(`${WEB_BASE}/companies/marketplace/order-management/cart`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '40-cart-list.png');

  // dump table structure + status filter dropdown options
  const cartListInfo = await page.evaluate(() => {
    const headerCells = Array.from(document.querySelectorAll('table thead th')).map((th) => th.textContent?.trim());
    const rows = Array.from(document.querySelectorAll('table tbody tr')).slice(0, 5).map((tr) =>
      Array.from(tr.querySelectorAll('td')).map((td) => td.textContent?.trim())
    );
    const statusFilterBtn = document.querySelector('[class*="dropdown"] button')?.textContent?.trim();
    return { headerCells, rows, statusFilterBtn };
  });
  save('40-cart-list-info.json', JSON.stringify(cartListInfo, null, 2));

  console.log('4. open detail of first row (รายละเอียด icon)...');
  const detailIcon = page.locator('table tbody tr').first().locator('svg, button, a').last();
  await detailIcon.click().catch((e: any) => console.log('detail click err:', e.message?.slice(0, 150)));
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  console.log('URL after detail click:', page.url());
  await shot(page, '41-cart-detail.png');
  save('41-cart-detail.html', await page.content());

  console.log('5. back to list, click รายการออเดอร์ tab...');
  await page.goto(`${WEB_BASE}/companies/marketplace/order-management/cart`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
  const orderTab = page.getByText('รายการออเดอร์', { exact: false }).first();
  await orderTab.click().catch((e: any) => console.log('order tab click err:', e.message?.slice(0, 150)));
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  console.log('URL after clicking รายการออเดอร์:', page.url());
  await shot(page, '50-order-list.png');
  save('50-order-list.html', await page.content());

  const orderListInfo = await page.evaluate(() => {
    const headerCells = Array.from(document.querySelectorAll('table thead th')).map((th) => th.textContent?.trim());
    const rows = Array.from(document.querySelectorAll('table tbody tr')).slice(0, 5).map((tr) =>
      Array.from(tr.querySelectorAll('td')).map((td) => td.textContent?.trim())
    );
    return { headerCells, rows };
  });
  save('50-order-list-info.json', JSON.stringify(orderListInfo, null, 2));

  console.log('6. open detail of first order row...');
  const orderDetailIcon = page.locator('table tbody tr').first().locator('svg, button, a').last();
  await orderDetailIcon.click().catch((e: any) => console.log('order detail click err:', e.message?.slice(0, 150)));
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  console.log('URL after order detail click:', page.url());
  await shot(page, '51-order-detail.png');
  save('51-order-detail.html', await page.content());

  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
