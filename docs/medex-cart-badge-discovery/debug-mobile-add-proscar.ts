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

  await page.goto(`${WEB_BASE}/companies/marketplace?page=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);

  console.log('1. search PCO12281 (PROSCAR in-stock)');
  await page.locator('#product-search').fill('PCO12281');
  const suggestion = page.locator('.dropdown-menu li a').first();
  await suggestion.waitFor({ state: 'visible', timeout: 8000 });
  await suggestion.click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  console.log('URL after search:', page.url());

  const candidates = page.locator('.link-product');
  const count = await candidates.count();
  console.log('candidate count:', count);
  let chosen = candidates.first();
  for (let i = 0; i < count; i++) {
    const c = candidates.nth(i);
    const oos = await c.locator('.out-of-stock-label').isVisible({ timeout: 1000 }).catch(() => false);
    console.log(`  candidate ${i}: oos=${oos}`);
    if (!oos) { chosen = c; break; }
  }

  const link = chosen.locator('a').first();
  await link.click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  console.log('2. URL after tapping into detail:', page.url());
  await page.screenshot({ path: path.join(OUT, 'debug-proscar-detail-01.png'), fullPage: true });

  const unitSelect = page.locator('select:has(option:text-is("เลือกหน่วยสินค้า"))').first();
  const unitVisible = await unitSelect.isVisible({ timeout: 3000 }).catch(() => false);
  console.log('unit select visible:', unitVisible);
  if (unitVisible) {
    const options = await unitSelect.locator('option').allTextContents();
    console.log('unit options:', JSON.stringify(options));
    await unitSelect.selectOption({ index: 1 });
    const selectedValue = await unitSelect.inputValue();
    console.log('selected unit value:', selectedValue);
  }

  const qtyInput = page.locator('input[placeholder="จำนวน"]').first();
  const qtyVisible = await qtyInput.isVisible({ timeout: 3000 }).catch(() => false);
  console.log('qty input visible:', qtyVisible);
  if (qtyVisible) {
    await qtyInput.fill('1');
    console.log('qty after fill:', await qtyInput.inputValue());
  }
  await page.screenshot({ path: path.join(OUT, 'debug-proscar-detail-02-filled.png'), fullPage: true });

  const detailAddBtn = page.locator('button.btn-success').filter({ hasText: 'เพิ่มลงในตะกร้า' }).first();
  const addBtnVisible = await detailAddBtn.isVisible({ timeout: 3000 }).catch(() => false);
  const addBtnEnabled = addBtnVisible ? await detailAddBtn.isEnabled().catch(() => false) : false;
  console.log('add button visible:', addBtnVisible, 'enabled:', addBtnEnabled);

  await detailAddBtn.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'debug-proscar-detail-03-after-click.png'), fullPage: true });
  console.log('3. URL after clicking add:', page.url());

  const confirmBtn = page.getByRole('button', { name: 'ตกลง', exact: true });
  const confirmVisible = await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false);
  console.log('confirm modal visible:', confirmVisible);
  if (confirmVisible) {
    await confirmBtn.click({ force: true });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(OUT, 'debug-proscar-detail-04-after-confirm.png'), fullPage: true });
  }

  // check for any error/toast message
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
  fs.writeFileSync(path.join(OUT, 'debug-proscar-body-text.txt'), bodyText, 'utf-8');
  console.log('4. checking cart page...');

  await page.goto(`${WEB_BASE}/companies/marketplace/cart`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'debug-proscar-cart-page.png'), fullPage: true });
  const cartEmpty = await page.getByText('ไม่มีรายการ').isVisible({ timeout: 3000 }).catch(() => false);
  console.log('cart shows empty:', cartEmpty);

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
