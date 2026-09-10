import { chromium } from '@playwright/test';
import { PosRegisterPage } from '../../pages/PosRegisterPage.ts';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'th-TH', timezoneId: 'Asia/Bangkok', userAgent: UA });
  const page = await context.newPage();

  let productsUrl = '';
  let authHeaders: Record<string, string> = {};
  page.on('request', (req) => {
    if (req.url().includes('/products?') && req.url().includes('branch_id')) {
      productsUrl = req.url();
      authHeaders = req.headers();
    }
  });

  const pos = new PosRegisterPage(page);
  await pos.goto();
  await pos.loginToPos({ company: 'Watcharin TestTest', branch: 'สำนักงานใหญ่' });
  await page.waitForTimeout(2000);

  console.log('captured products URL:', productsUrl);

  for (const bid of [1769, 1770]) {
    const url = productsUrl.replace(/branch_id=\d+/, `branch_id=${bid}`);
    const resp = await page.request.get(url, { headers: authHeaders }).catch(() => null);
    if (!resp || !resp.ok()) { console.log(`branch_id=${bid} -> HTTP error`); continue; }
    const body = await resp.json().catch(() => null);
    console.log(`branch_id=${bid} -> product count: ${body?.products?.length ?? 'n/a'}`);
    if (body?.products?.length) {
      console.log('  sample product:', JSON.stringify(body.products[0]).slice(0, 300));
    }
  }

  await browser.close();
})();
