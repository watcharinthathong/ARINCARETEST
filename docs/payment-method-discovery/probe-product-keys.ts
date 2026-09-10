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
  await page.waitForTimeout(1500);

  const resp = await page.request.get(productsUrl, { headers: authHeaders });
  const body = await resp.json();
  // หาสินค้าตัวที่ 3 (ตัวที่ไม่ใช่ products_set) เพื่อดู full raw JSON
  const p = body.products.find((x: any) => x.name === "BILAXTEN 20 MG TABLETS 10'S");
  console.log('Full product object:', JSON.stringify(p, null, 2));

  await browser.close();
})();
