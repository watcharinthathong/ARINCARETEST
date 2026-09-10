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

  console.log('1. add product + cart + select all + pay...');
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
  const orderRefText = await page.locator('text=เลขที่ใบสั่งซื้อ').first().innerText().catch(() => '');
  console.log('เลขที่ใบสั่งซื้อ on payment page:', orderRefText);

  console.log('2. โอนผ่านธนาคาร tab + แนบหลักฐานการโอน...');
  await page.getByText('โอนผ่านธนาคาร', { exact: false }).first().click();
  await page.waitForTimeout(1000);
  await page.locator('button').filter({ hasText: 'แนบหลักฐานการโอน' }).first().click();
  await page.waitForTimeout(1200);

  console.log('3. fill date/time/amount with real placeholders...');
  await page.locator('input[placeholder="วว/ดด/ปปปป"]').fill('09/09/2026').catch((e: any) => console.log('date err', e.message?.slice(0, 100)));
  const hourMinuteInputs = page.locator('input[placeholder="00"]');
  const hmCount = await hourMinuteInputs.count();
  console.log('hour/minute inputs found:', hmCount);
  if (hmCount >= 2) {
    await hourMinuteInputs.nth(0).fill('12').catch((e: any) => console.log('hour err', e.message?.slice(0, 100)));
    await hourMinuteInputs.nth(1).fill('30').catch((e: any) => console.log('min err', e.message?.slice(0, 100)));
  }
  await page.locator('input[placeholder="0.00"]').fill('210').catch((e: any) => console.log('amount err', e.message?.slice(0, 100)));
  await page.waitForTimeout(500);

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(SLIP_IMAGE);
  await page.waitForTimeout(1500);
  await shot(page, '90-modal-fully-filled.png');

  console.log('4. find + click ตกลง inside modal (may need scroll)...');
  const modalOkBtn = page.getByRole('button', { name: 'ตกลง', exact: true });
  await modalOkBtn.scrollIntoViewIfNeeded().catch(() => {});
  const okVisible = await modalOkBtn.isVisible({ timeout: 3000 }).catch(() => false);
  console.log('modal ตกลง visible:', okVisible);
  if (okVisible) {
    await modalOkBtn.click();
    await page.waitForTimeout(1500);
  }
  await shot(page, '91-after-modal-confirm.png');
  save('91-after-modal-confirm.html', await page.content());

  console.log('5. check main-page confirm checkbox + click ส่งหลักฐานการโอน...');
  const confirmLabel = page.getByText('ข้าพเจ้ายอมรับว่าหลักฐานที่แนบมาถูกต้องทุกประการ', { exact: false }).first();
  const confirmCbVisible = await confirmLabel.isVisible({ timeout: 3000 }).catch(() => false);
  console.log('confirm checkbox label visible:', confirmCbVisible);
  if (confirmCbVisible) {
    const cb = confirmLabel.locator('xpath=preceding-sibling::input[@type="checkbox"][1]');
    await cb.click().catch(async () => {
      // fallback: checkbox might be a sibling of parent container instead
      const parentCb = confirmLabel.locator('xpath=../input[@type="checkbox"][1]');
      await parentCb.click().catch((e: any) => console.log('checkbox click fallback failed:', e.message?.slice(0, 150)));
    });
    await page.waitForTimeout(500);
  }
  await shot(page, '92-before-final-submit.png');

  const submitBtn = page.locator('button').filter({ hasText: 'ส่งหลักฐานการโอน' }).first();
  const submitDisabled = await submitBtn.isDisabled().catch(() => 'ERR');
  console.log('ส่งหลักฐานการโอน disabled?', submitDisabled);

  if (submitDisabled === false) {
    console.log('6. SUBMITTING for real (per user go-ahead: ใช้รูปอะไรก็ได้ในดาวโหลด)...');
    await submitBtn.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2500);
    console.log('URL after submit:', page.url());
    await shot(page, '93-after-final-submit.png');
    save('93-after-final-submit.html', await page.content());
  } else {
    console.log('NOT submitting — button still disabled, needs selector fix. Inspect screenshots 90-92.');
  }

  console.log('7. verify in order-management/cart list...');
  await page.goto(`${WEB_BASE}/companies/marketplace/order-management/cart`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '94-cart-list-after-bank-submit.png');

  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
