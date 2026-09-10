import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { MedExMarketplacePage } from '../../pages/MedExMarketplacePage.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const WEB_BASE = process.env.BASE_URL ?? 'https://app-stg.arincare.com';
const USERNAME = process.env.TEST_USERNAME ?? '';
const PASSWORD = process.env.TEST_PASSWORD ?? '';
const COMPANY_NAME = process.env.COMPANY_NAME ?? 'Arincare Pharmacy';
const SLIP_IMAGE = '/Users/dev/Downloads/010011598.jpg';
const OUT = __dirname;
function save(name: string, content: string) {
  fs.writeFileSync(path.join(OUT, name), content, 'utf-8');
  console.log('saved', name);
}
async function shot(page: any, name: string, fullPage = true) {
  await page.screenshot({ path: path.join(OUT, name), fullPage }).catch((e: any) => console.log('err', e.message));
  console.log('shot', name);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const page = await (await browser.newContext({ baseURL: WEB_BASE, locale: 'th-TH', timezoneId: 'Asia/Bangkok' })).newPage();
  const mp = new MedExMarketplacePage(page);

  await page.goto(`${WEB_BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#preloader', { state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.locator('input[name="email"]').fill(USERNAME);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('#login-btn').click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  const companyEl = page.getByText(COMPANY_NAME, { exact: false }).first();
  if (await companyEl.isVisible({ timeout: 8000 }).catch(() => false)) {
    await companyEl.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
  }

  console.log('1. add product + go to cart + select all + pay...');
  await mp.goto();
  const card = await mp.findProductBySearch('PCO00092');
  await mp.addToCart(card);
  await page.goto(`${WEB_BASE}/companies/marketplace/cart`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1200);
  const exactLabel = page.getByText('เลือกซื้อรายการสินค้า (เลือกทั้งหมด)', { exact: true }).first();
  await exactLabel.locator('xpath=preceding-sibling::input[@type="checkbox"][1]').click();
  await page.waitForTimeout(500);
  await page.locator('button').filter({ hasText: 'ชำระเงิน' }).first().click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  console.log('on payment page:', page.url());

  console.log('2. click โอนผ่านธนาคาร tab...');
  await page.getByText('โอนผ่านธนาคาร', { exact: false }).first().click();
  await page.waitForTimeout(1000);

  console.log('3. click แนบหลักฐานการโอน...');
  const attachBtn = page.locator('button').filter({ hasText: 'แนบหลักฐานการโอน' }).first();
  await attachBtn.click();
  await page.waitForTimeout(1500);
  await shot(page, '80-attach-modal.png');
  save('80-attach-modal.html', await page.content());

  const modalFields = await page.evaluate(() => {
    const modal = document.querySelector('.modal.in, .modal.show, .modal[style*="display: block"], [class*="modal"][class*="open"]') || document;
    const inputs = Array.from(modal.querySelectorAll('input')).map((i) => ({
      type: i.getAttribute('type'), id: i.id, name: i.getAttribute('name'), placeholder: i.getAttribute('placeholder'),
    }));
    const selects = Array.from(modal.querySelectorAll('select')).map((s) => ({ id: s.id, name: s.getAttribute('name') }));
    const buttons = Array.from(modal.querySelectorAll('button')).map((b) => b.textContent?.trim()).filter(Boolean);
    return { inputs, selects, buttons };
  });
  save('80-modal-fields.json', JSON.stringify(modalFields, null, 2));
  console.log('modal fields:', JSON.stringify(modalFields));

  console.log('4. fill date/time/amount if present, upload slip...');
  // ลองกรอกฟิลด์วันที่/เวลา/จำนวนเงินแบบ generic (จะปรับ selector จริงหลังเห็นผล modalFields ด้านบน)
  const dateInput = page.locator('input[type="date"], input[placeholder*="วันที่"]').first();
  if (await dateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await dateInput.fill('2026-09-09').catch(() => {});
  }
  const timeInput = page.locator('input[type="time"], input[placeholder*="เวลา"]').first();
  if (await timeInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await timeInput.fill('12:00').catch(() => {});
  }
  const amountInput = page.locator('input[placeholder*="จำนวนเงิน"], input[placeholder*="ยอด"]').first();
  if (await amountInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await amountInput.fill('210').catch(() => {});
  }
  const fileInput = page.locator('input[type="file"]').first();
  if (await fileInput.count() > 0) {
    await fileInput.setInputFiles(SLIP_IMAGE).catch((e: any) => console.log('file upload err:', e.message?.slice(0, 150)));
    await page.waitForTimeout(1500);
    console.log('uploaded slip file');
  }
  await shot(page, '81-attach-modal-filled.png');
  save('81-attach-modal-filled.html', await page.content());

  console.log('5. click ตกลง (confirm in modal) if present...');
  const okBtn = page.getByRole('button', { name: 'ตกลง', exact: true });
  if (await okBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await okBtn.click();
    await page.waitForTimeout(1500);
  }
  await shot(page, '82-after-modal-ok.png');
  save('82-after-modal-ok.html', await page.content());

  console.log('6. check ยืนยัน checkbox + ส่งหลักฐานการโอน state...');
  const confirmCb = page.locator('input[type="checkbox"]').last();
  if (await confirmCb.isVisible({ timeout: 3000 }).catch(() => false)) {
    await confirmCb.click().catch(() => {});
    await page.waitForTimeout(500);
  }
  const submitBtn = page.locator('button').filter({ hasText: 'ส่งหลักฐานการโอน' }).first();
  console.log('ส่งหลักฐานการโอน disabled?', await submitBtn.isDisabled().catch(() => 'ERR'));
  await shot(page, '83-before-submit.png');

  await browser.close();
  console.log('DONE (not submitting for real — stopped before final submit to avoid creating unreviewed test data without confirmation)');
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
