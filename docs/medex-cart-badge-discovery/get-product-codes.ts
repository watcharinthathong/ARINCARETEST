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
  const browser = await chromium.launch({ headless: false, slowMo: 40 });
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

  const codes: Record<string, string> = {};

  for (const name of NAMES) {
    await page.goto(`${WEB_BASE}/companies/marketplace?page=1`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);

    const card = page.locator('.link-product').filter({ hasText: name }).first();
    const addBtn = card.locator('.btn-add-to-cart');
    if (!(await addBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      console.log(`SKIP (not found on page1): ${name}`);
      continue;
    }
    await addBtn.click();
    await page.waitForTimeout(1200);
    const confirmBtn = page.getByRole('button', { name: 'ตกลง', exact: true });
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(1200);
    }

    await page.goto(`${WEB_BASE}/companies/marketplace/cart`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1200);

    const row = page.locator('tr').filter({ hasText: name }).first();
    const code = await row.evaluate((el) => {
      const cells = Array.from(el.querySelectorAll('td'));
      for (const c of cells) {
        const t = c.textContent?.trim() ?? '';
        if (/^PCO\d+$/.test(t)) return t;
      }
      return null;
    }).catch(() => null);

    console.log(`${name} => ${code}`);
    if (code) codes[name] = code;

    // remove it again to not leave leftover
    if (await row.isVisible({ timeout: 3000 }).catch(() => false)) {
      await row.locator('svg').last().click();
      await page.waitForTimeout(800);
      const confirmDel = page.getByRole('button', { name: 'ตกลง', exact: true });
      if (await confirmDel.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmDel.click();
        await page.waitForTimeout(800);
      }
    }
  }

  console.log('\n=== RESULT ===');
  console.log(JSON.stringify(codes, null, 2));

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
