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
  await page.waitForTimeout(2000);

  console.log('captured products URL:', productsUrl);
  console.log('auth header keys:', Object.keys(authHeaders).filter(k => /auth|token/i.test(k)));

  // ดึงรายการ branch options ทั้งหมด (value+label) จาก company settings page แยกต่างหาก
  // (ไม่ผ่าน UI POS main เพราะ session ปัจจุบันล็อกอินเข้า branch เดียวแล้ว)
  // ใช้ API ตรงแทน: company id คือส่วนหนึ่งของ productsUrl
  const m = productsUrl.match(/companies\/([^/]+)\/products/);
  const companyId = m ? m[1] : null;
  console.log('companyId:', companyId);

  if (companyId && productsUrl) {
    // ลอง branch_id ตั้งแต่ 1 ถึง 20 (Arincare Pharmacy มีหลายสาขา — ดูจาก dropdown ก่อนหน้ามีประมาณ 14 สาขา)
    for (let bid = 1; bid <= 20; bid++) {
      const url = productsUrl.replace(/branch_id=\d+/, `branch_id=${bid}`);
      const resp = await page.request.get(url, { headers: authHeaders }).catch((e) => null);
      if (!resp) { console.log(`branch_id=${bid} -> request failed`); continue; }
      if (!resp.ok()) { console.log(`branch_id=${bid} -> HTTP ${resp.status()}`); continue; }
      const body = await resp.json().catch(() => null);
      const count = body?.products?.length ?? 'n/a';
      console.log(`branch_id=${bid} -> product count: ${count}`);
    }
  }

  await browser.close();
})();
