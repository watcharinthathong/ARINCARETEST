import { chromium, devices } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
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

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const context = await browser.newContext({ ...devices['Pixel 7'], locale: 'th-TH' });
  const page = await context.newPage();

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

  await page.goto(`${WEB_BASE}/companies/marketplace?page=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);

  console.log('1. tap search input + fill (PCO00092 = ACCIN-BP 5G.) -> autocomplete dropdown');
  await page.locator('#product-search').tap();
  await page.locator('#product-search').fill('PCO00092');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, 'mobile-search-01-typed.png'), fullPage: false });

  const dropdownItem = page.locator('.dropdown-menu li a').first();
  const dropdownVisible = await dropdownItem.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('autocomplete dropdown item visible:', dropdownVisible);

  if (dropdownVisible) {
    console.log('2. tap the autocomplete suggestion -> filters list (NOT detail page)');
    await dropdownItem.tap();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
    console.log('URL after tapping suggestion:', page.url());
    await page.screenshot({ path: path.join(OUT, 'mobile-search-03-list.png'), fullPage: true });

    console.log('3. list card has no inline controls on mobile -> tap product name/image to go to REAL detail page');
    const productLink = page.locator('.link-product').first().locator('a').first();
    const linkVisible = await productLink.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('product link visible:', linkVisible);
    if (linkVisible) {
      await productLink.tap();
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(1500);
    }
    console.log('URL after tapping product link:', page.url());
    await page.screenshot({ path: path.join(OUT, 'mobile-search-03b-detail-page.png'), fullPage: true });

    const detailAddBtn = page.locator('.btn-add-to-cart').first();
    const detailAddVisible = await detailAddBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('add-to-cart button visible on detail page:', detailAddVisible);
    const detailUnitVisible = await page.locator('select.select-unit').first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log('unit selector visible on detail page:', detailUnitVisible);
    const detailQtyVisible = await page.locator('.productQuantity').first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log('quantity input visible on detail page:', detailQtyVisible);

    if (detailAddVisible) {
      await detailAddBtn.tap();
      await page.waitForTimeout(1500);
      const confirmBtn = page.getByRole('button', { name: 'ตกลง', exact: true });
      if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.tap();
        await page.waitForTimeout(1500);
      }
      await page.screenshot({ path: path.join(OUT, 'mobile-search-04-after-add.png'), fullPage: true });
      const badge = page.locator('.in-cart-badge').first();
      console.log('in-cart-badge visible on detail page after add:', await badge.isVisible({ timeout: 3000 }).catch(() => false));
    }

    const bodyHtml = await page.content();
    fs.writeFileSync(path.join(OUT, 'mobile-detail-page-full.html'), bodyHtml.slice(0, 60000), 'utf-8');
    console.log('saved mobile-detail-page-full.html');
  }

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
