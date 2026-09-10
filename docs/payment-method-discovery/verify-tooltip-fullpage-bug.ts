import { chromium } from '@playwright/test';
import 'dotenv/config';
import { PosRegisterPage } from '../../pages/PosRegisterPage.js';

const OUT = 'screenshots/payment-method-retest';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ locale: 'th-TH', timezoneId: 'Asia/Bangkok', userAgent: UA });
  const page = await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });
  page.on('request', (req) => console.log('REQ:', req.method(), req.url()));
  page.on('response', (res) => {
    if (!res.url().includes('.js') && !res.url().includes('.css') && !res.url().includes('.png') && !res.url().includes('.svg')) {
      console.log('RES:', res.status(), res.url());
    }
  });
  page.on('pageerror', (err) => console.log('PAGEERROR:', err.message));

  const pos = new PosRegisterPage(page);

  await pos.goto();
  await pos.loginToPos({ company: 'Watcharin TestTest', branch: 'สำนักงานใหญ่' });
  await page.waitForTimeout(1500);

  await page.locator('button:has-text("รายการบิล")').first().click();
  await page.waitForTimeout(2000);

  const infoIcon = page.locator('.modal.show i.fa-info-circle').first();
  await infoIcon.waitFor({ state: 'visible', timeout: 8000 });

  const box = (await infoIcon.boundingBox())!;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  // ย้ายเมาส์ไปจุดไกลๆ ก่อน แล้วค่อยๆขยับเข้าไปทีละ step จริงๆ (จำลอง mouseenter transition จริง)
  await page.mouse.move(50, 500);
  await page.waitForTimeout(300);
  console.log('=== MOVING MOUSE TO ICON (20 steps) ===');
  await page.mouse.move(cx, cy, { steps: 20 });
  await page.waitForTimeout(1500);

  const titleWhileHover = await infoIcon.getAttribute('title');
  console.log('title attr while hovering:', titleWhileHover);
  const elsWhileHover = await page.evaluate(() => document.querySelectorAll('*').length);
  console.log('total elements WHILE hovering (no screenshot yet):', elsWhileHover);

  // จับภาพ "viewport only" (ไม่ resize หน้า) ทันทีระหว่างยังเมาส์ค้างอยู่ ก่อนจะไป query อย่างอื่น
  await page.screenshot({ path: `${OUT}/verify-05-viewport-only-while-hover.png` });

  console.log('=== NOW REAL CLICK (mousedown+mouseup at same coords) ===');
  await page.mouse.down();
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(2000);

  const titleAfterClick = await infoIcon.getAttribute('title');
  console.log('title attr AFTER click:', titleAfterClick);
  const elsAfterClick = await page.evaluate(() => document.querySelectorAll('*').length);
  console.log('total elements AFTER click:', elsAfterClick);
  await page.screenshot({ path: `${OUT}/verify-06-viewport-only-after-click.png` });

  // ลองย้ายออกแล้วกลับเข้าไปใหม่ (บังคับ mouseleave -> mouseenter รอบใหม่)
  await page.mouse.move(50, 500, { steps: 10 });
  await page.waitForTimeout(500);
  await page.mouse.move(cx, cy, { steps: 20 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/verify-07-viewport-only-rehover.png` });
  const elsRehover = await page.evaluate(() => document.querySelectorAll('*').length);
  console.log('total elements after re-hover cycle:', elsRehover);

  await browser.close();
})();
