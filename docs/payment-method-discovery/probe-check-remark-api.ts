import { chromium } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage.ts';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';
const RECEIPT_NO = 'SR260902-143003607';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: 'https://app-stg.arincare.com', locale: 'th-TH', timezoneId: 'Asia/Bangkok', userAgent: UA });
  const page = await context.newPage();
  const login = new LoginPage(page);

  let detailsUrl = '';
  let authHeaders: Record<string, string> = {};
  page.on('request', (req) => {
    if (req.url().includes('/details?') && req.url().includes('sales_receipts')) {
      detailsUrl = req.url();
      authHeaders = req.headers();
    }
  });

  await login.goto();
  await login.login('watcharin.arincare@gmail.com', '01072024');
  await page.waitForTimeout(2000);
  await login.selectCompany('Watcharin TestTest');
  await page.waitForTimeout(1500);
  await login.selectBranch();
  await page.waitForTimeout(2000);

  await page.goto('/companies/list-bills', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const searchInput = page.locator('input[placeholder*="ค้นหาเลขที่บิล"]').first();
  await searchInput.fill(RECEIPT_NO);
  await page.locator('button:has-text("ค้นหา")').first().click();
  await page.waitForTimeout(2000);

  const row = page.locator('table tbody tr', { hasText: RECEIPT_NO }).first();
  await row.locator('.sale_info').first().click();
  await page.waitForTimeout(4000);

  console.log('details API URL:', detailsUrl);
  if (detailsUrl) {
    const resp = await page.request.get(detailsUrl, { headers: authHeaders });
    const body = await resp.json();
    console.log('FULL RESPONSE:', JSON.stringify(body, null, 2).slice(0, 4000));
  }

  await browser.close();
})();
