import { chromium } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });
const WEB_BASE = process.env.BASE_URL ?? 'https://app-stg.arincare.com';
const USERNAME = process.env.TEST_USERNAME ?? 'watcharin.arincare@gmail.com';
const PASSWORD = process.env.TEST_PASSWORD ?? '01072024';
const COMPANY_NAME = process.env.COMPANY_NAME ?? 'Arincare Pharmacy';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 100 });
  const page = await (await browser.newContext({ locale: 'th-TH' })).newPage();
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) console.log('  >>> nav:', f.url()); });

  await page.goto(`${WEB_BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#preloader', { state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.locator('input[name="email"]').fill(USERNAME);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('#login-btn').click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);
  console.log('URL after login:', page.url());
  await page.screenshot({ path: path.join(__dirname, 'webapp-01-after-login.png'), fullPage: true });

  const companyEl = page.getByText(COMPANY_NAME, { exact: false }).first();
  if (await companyEl.isVisible({ timeout: 8000 }).catch(() => false)) {
    await companyEl.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
  }
  console.log('URL after company select:', page.url());
  await page.screenshot({ path: path.join(__dirname, 'webapp-02-after-company.png'), fullPage: true });

  // ดูว่ามีขั้นตอนเลือกสาขาแยกไหม
  const bodyText = await page.locator('body').innerText();
  console.log('Body text snippet:', bodyText.slice(0, 500).replace(/\s+/g, ' '));

  // คลิก "เข้าทำงาน" ของสาขาแรกที่เจอ (arincare HQ)
  const workBtn = page.locator('a:has-text("เข้าทำงาน"), button:has-text("เข้าทำงาน")').first();
  if (await workBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await workBtn.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3000);
    console.log('URL after เข้าทำงาน:', page.url());
    await page.screenshot({ path: path.join(__dirname, 'webapp-03-after-work.png'), fullPage: true });
    const modalVisible = await page.locator('.popup-notification-modal-custom').first().isVisible({ timeout: 8000 }).catch(() => false);
    console.log('Popup Notification modal (.popup-notification-modal-custom) แสดงไหม:', modalVisible);
  } else {
    console.log('ไม่เจอปุ่ม "เข้าทำงาน" ที่มองเห็นได้');
  }

  await browser.close();
})();
