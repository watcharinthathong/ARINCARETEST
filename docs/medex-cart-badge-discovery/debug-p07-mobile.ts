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
  const context = await browser.newContext({ ...devices['Pixel 7'], locale: 'th-TH' });
  await context.addInitScript(() => {
    const inject = () => {
      const style = document.createElement('style');
      style.textContent = '.phpdebugbar { display: none !important; }';
      document.head?.appendChild(style);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', inject);
    else inject();
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

  // simulate: search ACCIN, add via detail page, goBack, then goto() grid again, then tap cart button
  await page.goto(`${WEB_BASE}/companies/marketplace?page=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1200);

  await page.locator('#product-search').fill('PCO00092');
  await page.waitForTimeout(1000);
  const suggestion = page.locator('.dropdown-menu li a').first();
  await suggestion.waitFor({ state: 'visible', timeout: 8000 });
  await suggestion.click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1200);

  const card = page.locator('.link-product').first();
  const link = card.locator('a').first();
  await link.click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1200);

  const unitSelect = page.locator('select:has(option:text-is("เลือกหน่วยสินค้า"))').first();
  if (await unitSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
    await unitSelect.selectOption({ index: 1 });
  }
  const qtyInput = page.locator('input[placeholder="จำนวน"]').first();
  if (await qtyInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await qtyInput.fill('1');
  }
  const detailAddBtn = page.locator('button.btn-success').filter({ hasText: 'เพิ่มลงในตะกร้า' }).first();
  await detailAddBtn.click();
  await page.waitForTimeout(1000);
  const confirmBtn = page.getByRole('button', { name: 'ตกลง', exact: true });
  if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await confirmBtn.click();
    await confirmBtn.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
  }
  await page.waitForTimeout(1200);

  await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(800);
  console.log('after goBack, URL:', page.url());

  // now go to grid fresh
  await page.goto(`${WEB_BASE}/companies/marketplace?page=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  console.log('after fresh goto grid, URL:', page.url());
  await page.screenshot({ path: path.join(OUT, 'debug-p07-before-tap.png'), fullPage: false });

  const cartBtn = page.locator('#nav-cart-button');
  console.log('cart button visible:', await cartBtn.isVisible({ timeout: 5000 }).catch(() => false));
  console.log('cart button box:', await cartBtn.boundingBox());

  await cartBtn.tap();
  await page.waitForTimeout(2000);
  console.log('URL after 1st tap:', page.url());
  await page.screenshot({ path: path.join(OUT, 'debug-p07-after-tap.png'), fullPage: false });

  const popoverVisible = await page.locator('.cart-popover-content').isVisible({ timeout: 2000 }).catch(() => false);
  console.log('popover visible after 1st tap:', popoverVisible);

  console.log('tapping again (2nd tap on same button)...');
  await cartBtn.tap();
  await page.waitForTimeout(2000);
  console.log('URL after 2nd tap:', page.url());
  await page.screenshot({ path: path.join(OUT, 'debug-p07-after-2nd-tap.png'), fullPage: false });

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
