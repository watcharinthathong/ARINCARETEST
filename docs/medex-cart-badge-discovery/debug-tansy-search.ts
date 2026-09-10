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

  console.log('=== searching PCO12268 (TANSY) ===');
  await page.locator('#product-search').fill('PCO12268');
  await page.waitForTimeout(1000);
  const suggestion = page.locator('.dropdown-menu li a').first();
  await suggestion.waitFor({ state: 'visible', timeout: 8000 });
  const suggestionText = await suggestion.innerText();
  console.log('suggestion text:', JSON.stringify(suggestionText));
  await suggestion.click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1200);
  console.log('URL:', page.url());

  const candidates = page.locator('.link-product');
  const count = await candidates.count();
  console.log('candidate count:', count);
  for (let i = 0; i < count; i++) {
    const c = candidates.nth(i);
    const oos = await c.locator('.out-of-stock-label').isVisible({ timeout: 1000 }).catch(() => false);
    const name = await c.locator('.product-name').innerText().catch(() => '?');
    const seller = await c.locator('a').first().getAttribute('href').catch(() => '?');
    console.log(`  [${i}] oos=${oos} name="${name.trim().slice(0,60)}" href=${seller}`);
  }

  console.log('\n=== searching by NAME "TANSY ONE" instead ===');
  await page.goto(`${WEB_BASE}/companies/marketplace?page=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1200);
  await page.locator('#product-search').fill('TANSY ONE');
  await page.waitForTimeout(1000);
  const suggestion2 = page.locator('.dropdown-menu li a').first();
  const has2 = await suggestion2.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('suggestion visible for name search:', has2);
  if (has2) {
    await suggestion2.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1200);
    console.log('URL:', page.url());
    const candidates2 = page.locator('.link-product');
    const count2 = await candidates2.count();
    console.log('candidate count (name search):', count2);
    for (let i = 0; i < count2; i++) {
      const c = candidates2.nth(i);
      const oos = await c.locator('.out-of-stock-label').isVisible({ timeout: 1000 }).catch(() => false);
      const name = await c.locator('.product-name').innerText().catch(() => '?');
      console.log(`  [${i}] oos=${oos} name="${name.trim().slice(0,60)}"`);
    }
  }

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
