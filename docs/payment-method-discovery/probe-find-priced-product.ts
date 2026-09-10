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
  await pos.loginToPos({ company: 'Arincare Pharmacy', branch: 'arincare' });
  await page.waitForTimeout(1500);

  const resp = await page.request.get(productsUrl, { headers: authHeaders });
  const body = await resp.json();
  const withPrice = body.products.filter((p: any) => {
    const price = p.price ?? p.selling_price ?? (Array.isArray(p.prices) ? p.prices[0]?.price : null);
    return price && Number(price) > 0;
  });
  console.log('total products:', body.products.length, 'with price>0:', withPrice.length);
  console.log(JSON.stringify(withPrice.slice(0, 10).map((p: any) => ({
    name: p.name, id: p.id, price: p.price, remaining_quantity: p.remaining_quantity, unit: p.unit
  })), null, 2));

  await browser.close();
})();
