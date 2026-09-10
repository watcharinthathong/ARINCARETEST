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

  await page.goto(`${WEB_BASE}/companies/marketplace/order-management/order`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);

  // click the "รายละเอียด" (detail) icon -- it's the 2nd-to-last action icon, not the print dropdown (last)
  const firstRow = page.locator('table tbody tr').first();
  const actionIcons = firstRow.locator('td').last().locator('svg, button');
  console.log('action icons count in last td:', await actionIcons.count());
  const detailIcon = firstRow.locator('td').nth(-2).locator('svg, button').first();
  await detailIcon.click({ timeout: 8000 }).catch(async (e: any) => {
    console.log('nth(-2) detail click failed:', e.message?.slice(0, 150), '-- trying document-icon svg directly');
    await firstRow.locator('svg').first().click().catch((e2: any) => console.log('fallback failed too:', e2.message?.slice(0, 150)));
  });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  console.log('URL after detail click:', page.url());
  await shot(page, '51b-order-detail.png');
  save('51b-order-detail.html', await page.content());

  // Also inspect the print dropdown options fully (PDF export candidate)
  await page.goto(`${WEB_BASE}/companies/marketplace/order-management/order`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
  const printDropdown = page.locator('table tbody tr').first().locator('td').last().locator('button, [class*="dropdown"]').last();
  await printDropdown.click({ timeout: 5000 }).catch((e: any) => console.log('print dropdown click err:', e.message?.slice(0, 150)));
  await page.waitForTimeout(1000);
  const dropdownItems = await page.evaluate(() => {
    const menu = document.querySelector('.dropdown-menu.show, .dropdown-menu[style*="block"], ul[class*="dropdown"]');
    if (!menu) return 'NO MENU FOUND';
    return Array.from(menu.querySelectorAll('a, button, li')).map((el) => el.textContent?.trim());
  });
  console.log('print dropdown items:', JSON.stringify(dropdownItems));
  save('52-print-dropdown-items.json', JSON.stringify(dropdownItems, null, 2));
  await shot(page, '52-print-dropdown-open.png');

  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
