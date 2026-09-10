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

  // ตรวจว่าเพจทั้งหมดมีคำว่า BILAXTEN อยู่หรือไม่ (case-insensitive) ก่อนพิมพ์
  const before = await page.locator('body').innerText();
  console.log('BILAXTEN present BEFORE typing:', /BILAXTEN/i.test(before));

  const searchInput = page.locator('[placeholder="ค้นหาสินค้า (ctrl + Q)"]').first();
  await searchInput.click();
  await searchInput.type('BILAXTEN', { delay: 200 });
  await page.waitForTimeout(2500);

  const after = await page.locator('body').innerText();
  console.log('BILAXTEN present AFTER typing:', /BILAXTEN/i.test(after));
  console.log('full body text length:', after.length);

  // จำนวน element ทั้งหมดในหน้าก่อน/หลัง (ดูว่ามี DOM เปลี่ยนแปลงไหม)
  const elCountAfter = await page.evaluate(() => document.querySelectorAll('*').length);
  console.log('element count after typing:', elCountAfter);

  // เช็คว่ามี dropdown/portal/modal ใหม่โผล่ที่ document.body ระดับบนสุดไหม (React portal มักแปะที่ body ตรงๆ)
  const portals = await page.evaluate(() => {
    return Array.from(document.body.children).map(c => ({ tag: c.tagName, id: (c as HTMLElement).id, cls: (c as HTMLElement).className?.toString().slice(0,80) }));
  });
  console.log('body direct children:', JSON.stringify(portals, null, 2));

  await page.screenshot({ path: 'screenshots/payment-method-retest/probe-deep-after-type.png', fullPage: true });

  // ลอง keyboard ArrowDown แล้ว Enter (บาง autocomplete ต้องกด arrow ก่อนถึงจะ render list)
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'screenshots/payment-method-retest/probe-deep-after-arrowdown.png', fullPage: true });

  // ลองพิมพ์ชื่อเต็ม + Enter (สมมติ flow คือ scan/type แล้ว Enter เพิ่มลงตะกร้าเลย)
  await searchInput.fill('');
  await searchInput.type("BILAXTEN 20 MG TABLETS 10'S", { delay: 100 });
  await page.waitForTimeout(1000);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'screenshots/payment-method-retest/probe-deep-fullname-enter.png', fullPage: true });
  const afterEnter = await page.locator('body').innerText();
  console.log('after full-name+Enter, cart shows "ไม่พบรายการสินค้า":', afterEnter.includes('ไม่พบรายการสินค้า'));
  console.log('after full-name+Enter, BILAXTEN in body:', /BILAXTEN/i.test(afterEnter));

  const html = await page.content();
  fs.writeFileSync('docs/payment-method-discovery/pos-deep-search.html', html);

  await browser.close();
})();
