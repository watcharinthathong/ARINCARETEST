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
  const browser = await chromium.launch({ headless: false, slowMo: 50 });
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

  await page.goto(`${WEB_BASE}/companies/marketplace?page=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);

  const card = page.locator('.link-product').filter({ hasText: 'ACCIN-BP 5G.' }).first();
  const addBtn = card.locator('.btn-add-to-cart');
  await addBtn.click();
  await page.waitForTimeout(1000);
  console.log('confirm modal visible after click:', await page.getByRole('button', { name: 'ตกลง', exact: true }).isVisible({ timeout: 3000 }).catch(() => false));

  const confirmBtn = page.getByRole('button', { name: 'ตกลง', exact: true });
  await confirmBtn.click();
  console.log('clicked ตกลง (normal click, no force)');

  const closed = await confirmBtn.waitFor({ state: 'hidden', timeout: 5000 }).then(() => true).catch(() => false);
  console.log('modal closed (button hidden) within 5s:', closed);

  await page.screenshot({ path: path.join(OUT, 'debug-confirm-after.png'), fullPage: false });

  console.log('now trying hoverCart...');
  const cartBtn = page.locator('#nav-cart-button');
  try {
    await cartBtn.hover({ timeout: 8000 });
    console.log('hover SUCCESS');
  } catch (e: any) {
    console.log('hover FAILED:', e.message?.slice(0, 200));
  }
  await page.screenshot({ path: path.join(OUT, 'debug-confirm-hover.png'), fullPage: false });

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
