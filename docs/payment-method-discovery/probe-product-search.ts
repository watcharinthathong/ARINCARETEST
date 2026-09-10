import { chromium } from '@playwright/test';
import { PosRegisterPage } from '../../pages/PosRegisterPage.ts';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'th-TH', timezoneId: 'Asia/Bangkok', userAgent: UA });
  const page = await context.newPage();

  const reqs: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('product') || req.url().includes('search') || req.url().includes('item')) {
      reqs.push(`${req.method()} ${req.url()}`);
    }
  });
  page.on('response', async (res) => {
    if (res.url().includes('/products?')) {
      console.log('RESP', res.status(), res.url());
      try {
        const body = await res.json();
        const arr = Array.isArray(body) ? body : body.data || body.items || [];
        console.log('  product count:', Array.isArray(arr) ? arr.length : 'n/a', 'keys:', Object.keys(body));
        if (Array.isArray(arr) && arr.length) console.log('  sample:', JSON.stringify(arr[0]).slice(0, 300));
      } catch (e) { console.log('  body parse error', e); }
    }
  });

  const pos = new PosRegisterPage(page);
  await pos.goto();
  await pos.loginToPos({ company: 'Arincare Pharmacy', branch: 'arincare' });
  await page.waitForTimeout(1500);

  const searchInput = page.locator('[placeholder="ค้นหาสินค้า (ctrl + Q)"]').first();
  await searchInput.click();
  await searchInput.fill('a');
  console.log('--- pressing Enter ---');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'screenshots/payment-method-retest/probe-search-enter.png', fullPage: true });
  console.log('--- requests captured ---');
  console.log(reqs.join('\n'));

  await browser.close();
})();
