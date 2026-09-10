import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const BASE = process.env.ADMIN_BASE_URL ?? 'https://admin-stg.arincare.com';
const EMAIL = process.env.ADMIN_EMAIL ?? '';
const PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const OUT = __dirname;

function save(name: string, content: string) {
  fs.writeFileSync(path.join(OUT, name), content, 'utf-8');
  console.log('saved', name);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const page = await (await browser.newContext({ locale: 'th-TH' })).newPage();

  console.log('1. login to admin-stg...');
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#preloader', { state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('#login-btn').click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);
  console.log('URL after login:', page.url());
  await page.screenshot({ path: path.join(OUT, '01-after-login.png'), fullPage: false });

  console.log('2. goto PO list page...');
  await page.goto(`${BASE}/arinlink/sales-manage-order/po`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  console.log('URL:', page.url());
  await page.screenshot({ path: path.join(OUT, '02-po-list.png'), fullPage: true });
  save('02-po-list.html', await page.content());

  console.log('3. find "สร้างใบเสนอราคา" button...');
  const createBtn = page.locator('button, a').filter({ hasText: 'สร้างใบเสนอราคา' }).first();
  const createVisible = await createBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('create button visible:', createVisible);
  if (!createVisible) {
    // dump all buttons/links text for manual inspection
    const allBtns = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button, a')).map((el) => ({
        tag: el.tagName,
        text: el.textContent?.trim().slice(0, 60),
        href: el.getAttribute('href'),
      })).filter((b) => b.text)
    );
    save('02b-all-buttons-links.json', JSON.stringify(allBtns, null, 2));
    await browser.close();
    return;
  }

  await createBtn.click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);
  console.log('URL after create click:', page.url());
  await page.screenshot({ path: path.join(OUT, '03-create-form.png'), fullPage: true });
  save('03-create-form.html', await page.content());

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
