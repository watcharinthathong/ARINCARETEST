import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const BASE = process.env.ADMIN_BASE_URL ?? 'https://admin-stg.arincare.com';
const EMAIL = process.env.ADMIN_EMAIL ?? '';
const PASSWORD = process.env.ADMIN_PASSWORD ?? '';
const OUT = __dirname;

function save(name: string, content: string) {
  fs.writeFileSync(path.join(OUT, name), content, 'utf-8');
  console.log('saved', name);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const page = await (await browser.newContext({ locale: 'th-TH' })).newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#preloader', { state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.locator('input[name="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('#login-btn').click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);

  await page.goto(`${BASE}/arinlink/sales-manage-order/po`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);

  const createBtn = page.locator('button, a').filter({ hasText: 'สร้างใบเสนอราคา' }).first();
  await createBtn.click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);
  console.log('on form:', page.url());

  console.log('1. select bank account...');
  await page.locator('#form_bank_account').selectOption('TRAN_SCB');

  console.log('2. select Sale Zone BKK01...');
  await page.locator('#form_sales_zone').selectOption('1');

  console.log('3. search customer ARC1258...');
  const companySearch = page.locator('#company_search');
  await companySearch.fill('ARC1258');
  await page.waitForTimeout(1200);
  const dropdownVisible = await page.locator('.dropdown-menu li').first().isVisible({ timeout: 5000 }).catch(() => false);
  console.log('customer dropdown visible:', dropdownVisible);
  if (dropdownVisible) {
    const items = await page.locator('.dropdown-menu li').allTextContents();
    console.log('dropdown items:', JSON.stringify(items));
    await page.locator('.dropdown-menu li').first().click();
    await page.waitForTimeout(800);
  }
  // click "เลือก" button next to company search (in case dropdown-click alone isn't enough)
  const selectCompanyBtn = page.locator('button').filter({ hasText: 'เลือก' }).first();
  await selectCompanyBtn.click().catch((e) => console.log('select company btn click err:', e.message?.slice(0, 100)));
  await page.waitForTimeout(1000);

  console.log('4. company info after select:');
  console.log('  ARC ID:', await page.locator('#company_info_arc_reference_code').inputValue().catch(() => 'ERR'));
  console.log('  Name:', await page.locator('#company_info_name').inputValue().catch(() => 'ERR'));

  await page.screenshot({ path: path.join(OUT, '04-after-customer-select.png'), fullPage: true });

  console.log('5. store type buttons state...');
  const mkpBtn = page.locator('button').filter({ hasText: 'ร้านค้าบน MKP' }).first();
  const offlineBtn = page.locator('button').filter({ hasText: 'ร้านค้า Offline' }).first();
  console.log('  MKP class:', await mkpBtn.getAttribute('class'));
  console.log('  Offline class:', await offlineBtn.getAttribute('class'));
  await offlineBtn.click();
  await page.waitForTimeout(500);
  console.log('  after click Offline -> MKP class:', await mkpBtn.getAttribute('class'));
  console.log('  after click Offline -> Offline class:', await offlineBtn.getAttribute('class'));
  await mkpBtn.click(); // switch back to MKP (default we want for supplier-linked flow)
  await page.waitForTimeout(500);

  console.log('6. try "เพิ่มสินค้า" button...');
  const addProductBtn = page.locator('button').filter({ hasText: 'เพิ่มสินค้า' }).first();
  await addProductBtn.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, '05-add-product-modal.png'), fullPage: true });
  save('05-add-product-modal.html', await page.content());

  await browser.close();
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
