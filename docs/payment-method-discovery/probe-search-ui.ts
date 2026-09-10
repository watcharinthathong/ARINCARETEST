import { chromium } from '@playwright/test';
import { PosRegisterPage } from '../../pages/PosRegisterPage.ts';
import * as fs from 'fs';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'th-TH', timezoneId: 'Asia/Bangkok', userAgent: UA });
  const page = await context.newPage();
  const pos = new PosRegisterPage(page);

  await pos.goto();
  await pos.loginToPos({ company: 'Watcharin TestTest', branch: 'สำนักงานใหญ่' });
  await page.waitForTimeout(1500);

  const searchInput = page.locator('[placeholder="ค้นหาสินค้า (ctrl + Q)"]').first();
  await searchInput.click();
  // พิมพ์ทีละตัวอักษรแบบจริง (type ไม่ใช่ fill) เผื่อ UI ฟัง keydown/keyup
  await searchInput.type('BILAXTEN', { delay: 150 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'screenshots/payment-method-retest/probe-search-typed.png', fullPage: true });

  // คลิกปุ่มค้นหา (แว่นขยาย) ข้างช่อง
  const searchBtn = page.locator('button[type="submit"]').first();
  if (await searchBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await searchBtn.click();
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: 'screenshots/payment-method-retest/probe-search-after-submit-click.png', fullPage: true });

  const html = await page.content();
  fs.writeFileSync('docs/payment-method-discovery/pos-after-search.html', html);

  // dump ทุก element ที่มีคำว่า SMOOTH อยู่ใน text
  const matches = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('body *'));
    return all
      .filter(el => el.textContent?.includes('BILAXTEN') && el.children.length === 0)
      .map(el => ({ tag: el.tagName, cls: (el as HTMLElement).className, text: el.textContent?.slice(0, 80) }))
      .slice(0, 20);
  });
  console.log('Hone matches:', JSON.stringify(matches, null, 2));

  await browser.close();
})();
