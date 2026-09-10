import { chromium } from '@playwright/test';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    locale: 'th-TH',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
  });

  for (const url of [
    'https://app-stg.arincare.com/login',
    'https://app-stg.arincare.com/',
    'https://pos-stg.arincare.com/login',
    'https://admin-stg.arincare.com/',
  ]) {
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      console.log(url, '->', resp?.status(), resp?.statusText());
    } catch (e: any) {
      console.log(url, '-> ERROR', e.message?.slice(0, 200));
    }
    await page.waitForTimeout(1000);
  }

  // Retry app-stg 3 times with delay (possible transient WAF/rate-limit)
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(2000);
    try {
      const resp = await page.goto('https://app-stg.arincare.com/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
      console.log(`retry ${i} app-stg ->`, resp?.status());
      if (resp?.status() === 200) {
        await page.screenshot({ path: `screenshots/payment-method-retest/probe-appstg-retry${i}.png`, fullPage: true });
      }
    } catch (e: any) {
      console.log(`retry ${i} app-stg -> ERROR`, e.message?.slice(0, 150));
    }
  }

  await browser.close();
})();
