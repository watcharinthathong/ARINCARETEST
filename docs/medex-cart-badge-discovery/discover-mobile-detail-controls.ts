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
  const browser = await chromium.launch({ headless: false, slowMo: 40 });
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

  // known detail page URL from previous discovery for ACCIN-BP 5G.
  await page.goto(`${WEB_BASE}/companies/marketplace/FcHqAvszFm/2564`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);

  const areaHtml = await page.evaluate(() => {
    const selects = Array.from(document.querySelectorAll('select'));
    const buttons = Array.from(document.querySelectorAll('button'));
    const addBtn = buttons.find((b) => b.textContent?.includes('เพิ่มลงในตะกร้า') || b.textContent?.includes('เพิ่มสินค้าลงตะกร้า'));
    const qtyInputs = Array.from(document.querySelectorAll('input[type="number"], input.productQuantity'));
    return {
      selectsHtml: selects.map((s) => s.outerHTML.slice(0, 500)),
      addBtnHtml: addBtn ? addBtn.outerHTML.slice(0, 500) : 'NOT FOUND',
      qtyInputsHtml: qtyInputs.map((q) => q.outerHTML.slice(0, 400)),
    };
  });
  fs.writeFileSync(path.join(OUT, 'mobile-detail-controls.json'), JSON.stringify(areaHtml, null, 2), 'utf-8');
  console.log(JSON.stringify(areaHtml, null, 2));

  // also try actually adding to cart to confirm the flow end to end
  const addBtn = page.locator('button').filter({ hasText: 'เพิ่มลงในตะกร้า' }).first();
  const addVisible = await addBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('addBtn (by text) visible:', addVisible);
  if (addVisible) {
    const qty = page.locator('input[type="number"]').first();
    await qty.fill('1');
    await addBtn.tap();
    await page.waitForTimeout(1500);
    const confirmBtn = page.getByRole('button', { name: 'ตกลง', exact: true });
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.tap();
      await page.waitForTimeout(1500);
    }
    await page.screenshot({ path: path.join(OUT, 'mobile-detail-after-add.png'), fullPage: true });
    const badgeVisible = await page.locator('.in-cart-badge').first().isVisible({ timeout: 3000 }).catch(() => false);
    console.log('in-cart-badge visible after add on detail page:', badgeVisible);
  }

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
