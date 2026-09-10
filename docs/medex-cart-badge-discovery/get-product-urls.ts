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

const NAMES = [
  'ACCIN-BP 5G.',
  "BILAXTEN KIDS 10 MG TABLETS 10'S",
  "PROSCAR 5 MG TABLETS 30'S",
  "SUCEE TABLETS 28'S",
  "TANSY ONE 1.5 MG TABLETS 1'S",
];

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 30 });
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

  const urls: Record<string, string> = {};
  for (const name of NAMES) {
    const card = page.locator('.link-product').filter({ hasText: name }).first();
    const visible = await card.isVisible({ timeout: 5000 }).catch(() => false);
    if (!visible) {
      console.log(`NOT FOUND on page1: ${name}`);
      continue;
    }
    const oos = await card.locator('.out-of-stock-label').isVisible({ timeout: 1000 }).catch(() => false);
    const href = await card.locator('a').first().getAttribute('href');
    console.log(`${name} => ${href} (oos=${oos})`);
    if (href) urls[name] = href;
  }

  console.log('\n=== RESULT ===');
  console.log(JSON.stringify(urls, null, 2));

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
