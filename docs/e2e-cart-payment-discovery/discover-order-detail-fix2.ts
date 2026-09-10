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
  await page.screenshot({ path: path.join(OUT, name), fullPage }).catch((e: any) => console.log('err', e.message));
  console.log('shot', name);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const page = await (await browser.newContext({ baseURL: WEB_BASE, locale: 'th-TH' })).newPage();

  await page.goto(`${WEB_BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#preloader', { state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.locator('input[name="email"]').fill(USERNAME);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('#login-btn').click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  const companyEl = page.getByText(COMPANY_NAME, { exact: false }).first();
  if (await companyEl.isVisible({ timeout: 8000 }).catch(() => false)) {
    await companyEl.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
  }

  console.log('1. order detail via direct link a[href]...');
  await page.goto(`${WEB_BASE}/companies/marketplace/order-management/order`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  const detailLink = page.locator('table tbody tr').first().locator('a[href*="/order-management/order/"]');
  await detailLink.click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  console.log('URL:', page.url());
  await shot(page, '51c-order-detail.png');
  save('51c-order-detail.html', await page.content());

  console.log('2. click print dropdown button on order list...');
  await page.goto(`${WEB_BASE}/companies/marketplace/order-management/order`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  const printBtn = page.locator('table tbody tr').first().locator('button').filter({ has: page.locator('img[src*="print-icon"]') });
  await printBtn.click({ timeout: 5000 }).catch((e: any) => console.log('print btn click err:', e.message?.slice(0, 150)));
  await page.waitForTimeout(1200);
  await shot(page, '52b-print-dropdown-open.png');
  const bodyAfterPrint = await page.evaluate(() => document.body.innerText.slice(0, 2000));
  console.log('visible text snapshot after print click:', bodyAfterPrint.includes('PDF') || bodyAfterPrint.includes('พิมพ์'));

  console.log('3. cart-list detail link pattern...');
  await page.goto(`${WEB_BASE}/companies/marketplace/order-management/cart`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  const cartRowHtml = await page.evaluate(() => document.querySelector('table tbody tr')?.outerHTML ?? 'NOT FOUND');
  save('42-cart-row.html', cartRowHtml);
  console.log(cartRowHtml.slice(0, 1500));

  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
