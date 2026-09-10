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

  console.log('1. add product to cart (retry up to 3x with different products)...');
  const candidates = ['PCO00092', 'PCO12190', 'PCO01552'];
  let added = false;
  for (const code of candidates) {
    try {
      await mp.goto();
      await page.waitForTimeout(500);
      const card = await mp.findProductBySearch(code);
      await mp.addToCart(card);
      console.log(`added ${code} ok`);
      added = true;
      break;
    } catch (e: any) {
      console.log(`add ${code} failed:`, e.message?.slice(0, 150));
    }
  }
  console.log('added any product:', added);

  console.log('2. goto shopping cart page /companies/marketplace/cart...');
  await page.goto(`${WEB_BASE}/companies/marketplace/cart`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, '60-shopping-cart.png');
  save('60-shopping-cart.html', await page.content());

  console.log('3. select item + click ชำระเงิน...');
  // ⚠️ ห้ามใช้ input[type=checkbox] .first() เฉยๆ — ตัวแรกบนหน้าคือ checkbox "ที่อยู่ในการออกใบกำกับภาษี"
  // (คนละตัวกับ "เลือกทั้งหมด") ใช้ exact text match บน label text แล้วหา input พี่น้องข้างหน้าด้วย XPath
  const exactLabel = page.getByText('เลือกซื้อรายการสินค้า (เลือกทั้งหมด)', { exact: true }).first();
  const selectAllCb = exactLabel.locator('xpath=preceding-sibling::input[@type="checkbox"][1]');
  const selectAllVisible = await selectAllCb.isVisible({ timeout: 3000 }).catch(() => false);
  console.log('เลือกทั้งหมด checkbox visible:', selectAllVisible);
  if (selectAllVisible) {
    await selectAllCb.click().catch((e: any) => console.log('click err:', e.message?.slice(0, 150)));
    await page.waitForTimeout(800);
  }
  console.log('ชำระเงิน button disabled now?', await page.locator('button').filter({ hasText: 'ชำระเงิน' }).first().isDisabled().catch(() => 'ERR'));
  const payBtn = page.locator('button').filter({ hasText: 'ชำระเงิน' }).first();
  const payVisible = await payBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('ชำระเงิน button visible:', payVisible);
  if (payVisible) {
    await payBtn.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    console.log('URL after clicking ชำระเงิน:', page.url());
    await shot(page, '70-payment-page.png');
    save('70-payment-page.html', await page.content());

    // dump radios/tabs for payment methods
    const paymentMethods = await page.evaluate(() => {
      const radios = Array.from(document.querySelectorAll('input[type="radio"]')).map((r) => ({
        name: r.getAttribute('name'), value: r.getAttribute('value'), id: r.id,
      }));
      const tabs = Array.from(document.querySelectorAll('[role="tab"], .tab, [class*="tab"]')).map((t) => t.textContent?.trim()).filter(Boolean);
      return { radios, tabs };
    });
    save('70-payment-methods.json', JSON.stringify(paymentMethods, null, 2));
    console.log('payment methods:', JSON.stringify(paymentMethods));

    // try clicking on each payment-method label found by text
    for (const label of ['คิวอาร์โค้ด', 'QR', 'บัตรเครดิต', 'โอนผ่านธนาคาร', 'โอนเงิน']) {
      const el = page.getByText(label, { exact: false }).first();
      if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`found payment option label: "${label}" -- clicking`);
        await el.click().catch((e: any) => console.log('click err', e.message?.slice(0, 100)));
        await page.waitForTimeout(1500);
        const safeLabel = label.replace(/[^a-zA-Zก-๙0-9]/g, '_');
        await shot(page, `71-payment-${safeLabel}.png`);
        save(`71-payment-${safeLabel}.html`, await page.content());
      }
    }

    // if bank-transfer form is visible now, dump its fields specifically
    const bankFormInfo = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('select')).map((s) => ({ id: s.id, name: s.getAttribute('name') }));
      const dateInputs = Array.from(document.querySelectorAll('input[type="date"], input[placeholder*="วันที่"]')).map((i) => ({ id: i.id, placeholder: i.getAttribute('placeholder') }));
      const timeInputs = Array.from(document.querySelectorAll('input[type="time"], input[placeholder*="เวลา"]')).map((i) => ({ id: i.id, placeholder: i.getAttribute('placeholder') }));
      const amountInputs = Array.from(document.querySelectorAll('input[placeholder*="จำนวนเงิน"], input[placeholder*="ยอด"]')).map((i) => ({ id: i.id, placeholder: i.getAttribute('placeholder') }));
      const fileInputs = Array.from(document.querySelectorAll('input[type="file"]')).map((i) => ({ id: i.id, accept: i.getAttribute('accept') }));
      const buttons = Array.from(document.querySelectorAll('button')).map((b) => b.textContent?.trim()).filter(Boolean);
      return { selects, dateInputs, timeInputs, amountInputs, fileInputs, buttons };
    });
    save('72-bank-form-fields.json', JSON.stringify(bankFormInfo, null, 2));
    console.log('bank form fields:', JSON.stringify(bankFormInfo));
  }

  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
