import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ locale: 'th-TH' });
  await page.goto('https://app-stg.arincare.com/login', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#preloader', { state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'screenshots/payment-method-retest/probe-erp-before-fill.png', fullPage: true });
  console.log('URL before fill:', page.url());
  await page.locator('input[name="email"]').fill('watcharin.arincare@gmail.com');
  await page.locator('input[name="password"]').fill('01072024');
  await page.locator('#login-btn').click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  console.log('URL after submit:', page.url());
  await page.screenshot({ path: 'screenshots/payment-method-retest/probe-erp-after-submit.png', fullPage: true });
  const bodyText = await page.locator('body').innerText();
  console.log('body text snippet:', bodyText.slice(0, 800));
  await browser.close();
})();
