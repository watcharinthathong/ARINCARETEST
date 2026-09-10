import { chromium } from '@playwright/test';
import { PosRegisterPage } from '../../pages/PosRegisterPage.ts';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ locale: 'th-TH', timezoneId: 'Asia/Bangkok', userAgent: UA });
  const page = await context.newPage();

  page.on('console', (msg) => console.log('CONSOLE:', msg.type(), msg.text().slice(0, 200)));
  page.on('pageerror', (err) => console.log('PAGEERROR:', err.message.slice(0, 300)));
  page.on('request', (req) => {
    if (req.url().includes('bill') || req.url().includes('remark') || req.url().includes('note')) {
      console.log('REQ:', req.method(), req.url());
    }
  });

  const pos = new PosRegisterPage(page);
  await pos.goto();
  await pos.loginToPos({ company: 'Watcharin TestTest', branch: 'สำนักงานใหญ่' });
  await page.waitForTimeout(1500);

  const billListBtn = page.locator('button:has-text("รายการบิล")').first();
  await billListBtn.click();
  await page.waitForTimeout(2500);

  const icon = page.locator('.modal.show i.fa-info-circle').first();
  const box = await icon.boundingBox();
  console.log('icon bounding box:', box);

  // ตรวจ attribute ทั้งหมดของ icon element ผ่าน evaluate
  const attrs = await icon.evaluate((el) => {
    const attrObj: Record<string, string> = {};
    for (const a of Array.from(el.attributes)) attrObj[a.name] = a.value;
    return { attrs: attrObj, outerHTML: el.outerHTML, parentHTML: el.parentElement?.outerHTML };
  });
  console.log('icon attrs:', JSON.stringify(attrs, null, 2));

  // hover จริงด้วย mouse.move ไปที่ตำแหน่งไอคอนเป๊ะๆ
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(500);
    await page.mouse.move(box.x + box.width / 2 + 1, box.y + box.height / 2 + 1); // trigger mousemove event
    await page.waitForTimeout(2000);
  }
  await page.screenshot({ path: 'screenshots/payment-method-retest/probe-tooltip-mousemove.png', fullPage: true });

  // ตรวจว่ามี element ใหม่โผล่ในหน้าหลัง hover ไหม (นับ element ทั้งหมด)
  const totalEls = await page.evaluate(() => document.querySelectorAll('*').length);
  console.log('total elements after hover:', totalEls);

  await browser.close();
})();
