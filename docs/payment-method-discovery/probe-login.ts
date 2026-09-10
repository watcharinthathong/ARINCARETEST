import { chromium } from '@playwright/test';

const POS_URL = 'https://pos-stg.arincare.com';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    locale: 'th-TH',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  });
  await page.goto(`${POS_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  console.log('URL after goto:', page.url());
  const emailInput = page.locator('input[name="email"]').first();
  await emailInput.fill('watcharin.arincare@gmail.com');
  await page.locator('input[type="password"]').first().fill('01072024');
  const val1 = await emailInput.inputValue();
  console.log('email value before submit:', val1);
  await page.locator('button:has-text("เข้าสู่ระบบ")').first().click();
  await page.waitForTimeout(4000);
  console.log('URL after submit:', page.url());
  await page.screenshot({ path: 'screenshots/payment-method-retest/probe-after-submit.png', fullPage: true });
  const bodyText = await page.locator('body').innerText();
  console.log('body text snippet:', bodyText.slice(0, 500));
  await browser.close();
})();
