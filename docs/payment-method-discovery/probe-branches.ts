import { chromium } from '@playwright/test';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ locale: 'th-TH', userAgent: UA });
  await page.goto('https://pos-stg.arincare.com/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  await page.locator('input[name="email"]').first().fill('watcharin.arincare@gmail.com');
  await page.locator('input[type="password"]').first().fill('01072024');
  await page.locator('button:has-text("เข้าสู่ระบบ")').first().click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);

  const companySelect = page.locator('select[name="companyId"]').first();
  await companySelect.selectOption({ label: 'Watcharin TestTest' });
  await page.waitForTimeout(1500);

  const branchSelect = page.locator('select[name="branchId"]').first();
  const options = await branchSelect.locator('option').allTextContents();
  console.log('Branch options for "Watcharin TestTest":', JSON.stringify(options, null, 2));

  await page.screenshot({ path: 'screenshots/payment-method-retest/probe-branches.png', fullPage: true });
  await browser.close();
})();
