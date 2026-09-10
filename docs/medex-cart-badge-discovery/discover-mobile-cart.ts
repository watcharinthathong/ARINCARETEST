import { chromium, devices } from '@playwright/test';
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
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const context = await browser.newContext({
    ...devices['Pixel 7'],
    locale: 'th-TH',
  });
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
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, 'mobile-01-marketplace.png'), fullPage: false });
  console.log('viewport:', page.viewportSize());

  // add a product first so cart has something
  const firstCard = page.locator('.link-product').first();
  const addBtn = firstCard.locator('.btn-add-to-cart');
  if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await addBtn.tap();
    await page.waitForTimeout(1500);
    const confirmBtn = page.getByRole('button', { name: 'ตกลง', exact: true });
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.tap();
      await page.waitForTimeout(1500);
    }
  }
  await page.screenshot({ path: path.join(OUT, 'mobile-02-after-add.png'), fullPage: false });

  // find and tap the cart button
  const cartBtn = page.locator('#nav-cart-button');
  const cartVisible = await cartBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('cart button visible on mobile:', cartVisible);
  if (cartVisible) {
    console.log('URL before tap:', page.url());
    await cartBtn.tap();
    await page.waitForTimeout(1500);
    console.log('URL after 1st tap:', page.url());
    await page.screenshot({ path: path.join(OUT, 'mobile-03-after-tap1.png'), fullPage: false });

    // is there a popover visible now?
    const popoverVisible = await page.locator('.cart-popover-content').isVisible({ timeout: 2000 }).catch(() => false);
    console.log('popover visible after 1st tap:', popoverVisible);

    if (page.url().includes('/cart')) {
      console.log('=> 1st tap navigated straight to cart page (same as desktop click)');
    } else {
      // try tapping again
      await cartBtn.tap();
      await page.waitForTimeout(1500);
      console.log('URL after 2nd tap:', page.url());
      await page.screenshot({ path: path.join(OUT, 'mobile-04-after-tap2.png'), fullPage: false });
    }
  } else {
    // maybe cart button is hidden behind a hamburger menu on mobile — dump header area
    const headerHtml = await page.evaluate(() => {
      const el = document.querySelector('#marketplace') || document.body;
      return el ? el.outerHTML.slice(0, 3000) : 'NOT FOUND';
    });
    console.log('marketplace header (mobile) snippet:', headerHtml.slice(0, 1500));
  }

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
