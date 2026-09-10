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
  await page.screenshot({ path: path.join(OUT, name), fullPage }).catch((e: any) => console.log('screenshot err', name, e.message));
  console.log('shot', name);
}

(async () => {
  // nginx บน staging บล็อก headless Chromium ด้วย 403 (พบจริง 2026-09-07) — ต้องรัน headless:false เสมอ
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const page = await (await browser.newContext({ baseURL: WEB_BASE, locale: 'th-TH', timezoneId: 'Asia/Bangkok' })).newPage();
  const mp = new MedExMarketplacePage(page);

  console.log('1. login...');
  await page.goto(`${WEB_BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#preloader', { state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.locator('input[name="email"]').fill(USERNAME);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('#login-btn').click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);

  console.log('2. select company...');
  const companyEl = page.getByText(COMPANY_NAME, { exact: false }).first();
  if (await companyEl.isVisible({ timeout: 8000 }).catch(() => false)) {
    await companyEl.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
  }

  console.log('3. goto marketplace...');
  await mp.goto();
  const anyModalCloseBtn = page.locator('.modal.in button.close, .modal.fade.in [aria-label="Close"], .modal.in button:has-text("×")').first();
  if (await anyModalCloseBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await anyModalCloseBtn.click().catch(() => {});
    await page.waitForTimeout(1000);
  }

  // ---- Dump full header/nav to find "การซื้อของฉัน" menu + its real href ----
  console.log('4. dump header/nav links...');
  const navLinks = await page.evaluate(() => {
    const results: any[] = [];
    const all = Array.from(document.querySelectorAll('header a, nav a, .navbar a, [class*="menu"] a'));
    for (const el of all) {
      const text = (el.textContent || '').trim();
      if (!text) continue;
      results.push({ text, href: el.getAttribute('href') });
    }
    return results;
  });
  save('nav-links.json', JSON.stringify(navLinks, null, 2));
  console.log('nav links found:', navLinks.length);

  // Also try clicking any element containing "การซื้อของฉัน" (may be a dropdown trigger, not a direct link)
  const myPurchaseTrigger = page.getByText('การซื้อของฉัน', { exact: false }).first();
  const hasMyPurchase = await myPurchaseTrigger.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('"การซื้อของฉัน" element visible:', hasMyPurchase);
  if (hasMyPurchase) {
    await myPurchaseTrigger.click().catch(() => {});
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1500);
    console.log('URL after clicking การซื้อของฉัน:', page.url());
    await shot(page, '10-my-purchase-landing.png');
    save('10-my-purchase-landing.html', await page.content());
  }

  // ---- Add a product to cart so cart pages have data ----
  console.log('5. add a product to cart (search PCO00092)...');
  await mp.goto();
  try {
    const card = await mp.findProductBySearch('PCO00092');
    await mp.addToCart(card);
    console.log('added to cart ok');
  } catch (e: any) {
    console.log('add to cart failed:', e.message?.slice(0, 200));
  }

  // ---- Compare the two cart URLs ----
  console.log('6a. goto /companies/marketplace/cart (previously verified popup-cart page)...');
  await page.goto(`${WEB_BASE}/companies/marketplace/cart`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  console.log('URL:', page.url());
  await shot(page, '20-cart-shortpath.png');
  save('20-cart-shortpath.html', await page.content());

  console.log('6b. goto /companies/marketplace/order-management/cart (new URL from user)...');
  await page.goto(`${WEB_BASE}/companies/marketplace/order-management/cart`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  console.log('URL:', page.url());
  await shot(page, '21-cart-order-management-path.png');
  save('21-cart-order-management-path.html', await page.content());

  // dump key selector candidates on this order-management/cart page
  const cartPageInfo = await page.evaluate(() => {
    const checkboxes = document.querySelectorAll('input[type="checkbox"]').length;
    const rows = document.querySelectorAll('table tbody tr').length;
    const buttons = Array.from(document.querySelectorAll('button')).map((b) => b.textContent?.trim()).filter(Boolean);
    return { checkboxes, rows, buttons };
  });
  save('21-cart-page-info.json', JSON.stringify(cartPageInfo, null, 2));

  console.log('7. try to reach Payment page by selecting item + clicking ชำระเงิน...');
  const payBtn = page.locator('button, a').filter({ hasText: 'ชำระเงิน' }).first();
  const payVisible = await payBtn.isVisible({ timeout: 5000 }).catch(() => false);
  console.log('ชำระเงิน button visible on this page:', payVisible);
  if (payVisible) {
    // try select-all checkbox first if present
    const selectAllCb = page.locator('thead input[type="checkbox"], th input[type="checkbox"]').first();
    if (await selectAllCb.isVisible({ timeout: 2000 }).catch(() => false)) {
      await selectAllCb.check().catch(() => {});
      await page.waitForTimeout(500);
    }
    await payBtn.click().catch((e: any) => console.log('pay click err:', e.message?.slice(0, 150)));
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
    console.log('URL after clicking ชำระเงิน:', page.url());
    await shot(page, '30-payment-page.png');
    save('30-payment-page.html', await page.content());

    const paymentInfo = await page.evaluate(() => {
      const radios = Array.from(document.querySelectorAll('input[type="radio"]')).map((r) => ({
        name: r.getAttribute('name'), value: r.getAttribute('value'), id: r.id,
      }));
      const labels = Array.from(document.querySelectorAll('label')).map((l) => l.textContent?.trim()).filter(Boolean);
      const buttons = Array.from(document.querySelectorAll('button')).map((b) => b.textContent?.trim()).filter(Boolean);
      const fileInputs = document.querySelectorAll('input[type="file"]').length;
      return { radios, labels, buttons, fileInputs };
    });
    save('30-payment-info.json', JSON.stringify(paymentInfo, null, 2));
  }

  await browser.close();
  console.log('DONE');
})().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
