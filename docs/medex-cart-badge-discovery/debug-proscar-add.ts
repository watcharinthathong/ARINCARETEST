import { chromium } from '@playwright/test';
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

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const page = await (await browser.newContext({ locale: 'th-TH' })).newPage();

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

  // ---- STEP 1: clean up leftover cart item (ACCIN-BP 5G.) first ----
  console.log('cleanup: removing leftover ACCIN-BP 5G. from cart...');
  await page.goto(`${WEB_BASE}/companies/marketplace/cart`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  const accinRow = page.locator('tr').filter({ hasText: 'ACCIN-BP 5G.' });
  if (await accinRow.isVisible({ timeout: 3000 }).catch(() => false)) {
    await accinRow.locator('svg').last().click();
    await page.waitForTimeout(1000);
    const confirmBtn = page.getByRole('button', { name: 'ตกลง', exact: true });
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click();
    }
    await page.waitForTimeout(1500);
    console.log('cleaned up ACCIN-BP leftover');
  } else {
    console.log('no leftover ACCIN-BP found');
  }
  await page.screenshot({ path: path.join(OUT, 'debug-00-cart-after-cleanup.png'), fullPage: true });

  // ---- STEP 2: search PROSCAR and inspect result ----
  console.log('searching PROSCAR...');
  await page.goto(`${WEB_BASE}/companies/marketplace?page=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);

  await page.locator('#product-search').fill('PROSCAR');
  await page.waitForTimeout(1500); // รอ autocomplete dropdown โหลด
  await page.screenshot({ path: path.join(OUT, 'debug-00b-search-typed.png'), fullPage: true });

  const dropdownHtml = await page.evaluate(() => {
    const dd = document.querySelector('.dropdown-menu');
    return dd ? dd.outerHTML.slice(0, 3000) : 'NO DROPDOWN FOUND';
  });
  console.log('dropdown html:', dropdownHtml.slice(0, 500));

  // ลองกดปุ่ม "ค้นหา" แทน Enter
  const searchBtn = page.locator('button:has-text("ค้นหา")').first();
  await searchBtn.click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'debug-01-search-result.png'), fullPage: true });
  console.log('URL after clicking ค้นหา button:', page.url());

  const cardCount = await page.locator('.link-product').count();
  console.log('link-product card count after search:', cardCount);

  const firstCard = page.locator('.link-product').first();
  const cardText = await firstCard.innerText().catch((e) => 'ERROR: ' + e.message);
  console.log('first card text:', cardText.slice(0, 200));

  const addBtn = firstCard.locator('.btn-add-to-cart');
  const addBtnCount = await addBtn.count();
  console.log('add button count in first card:', addBtnCount);

  if (addBtnCount > 0) {
    await addBtn.click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, 'debug-02-after-add-click.png'), fullPage: true });

    const confirmBtn = page.getByRole('button', { name: 'ตกลง', exact: true });
    const confirmVisible = await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('confirm modal visible:', confirmVisible);
    if (confirmVisible) {
      await confirmBtn.click();
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: path.join(OUT, 'debug-03-final.png'), fullPage: true });

    const badge = firstCard.locator('.in-cart-badge');
    const badgeVisible = await badge.isVisible({ timeout: 3000 }).catch(() => false);
    console.log('in-cart-badge visible after add:', badgeVisible);
    if (badgeVisible) {
      console.log('badge title:', await badge.getAttribute('title'));
    }
  }

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
