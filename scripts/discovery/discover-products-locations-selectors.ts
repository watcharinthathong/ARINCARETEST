/**
 * Products/Locations Selector Discovery Script
 * รันด้วย: npx tsx scripts/discover-products-locations-selectors.ts
 *
 * เปิด browser, login app-stg, เลือกบริษัท "Watcharin TestTest"
 * ไปหน้า /companies/products/locations แล้วเก็บ selector element สำคัญ
 * โดยเฉพาะปุ่ม "เพิ่ม/แก้ไขสินค้า", ช่องค้นหาสินค้า, ตัวเลือกเลขชั้น
 */

import { chromium } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const BASE_URL = process.env.BASE_URL ?? 'https://app-stg.arincare.com';
const USERNAME = process.env.TEST_USERNAME ?? 'watcharin.arincare@gmail.com';
const PASSWORD = process.env.TEST_PASSWORD ?? '01072024';
const STORE_NAME = process.env.STORE_NAME ?? 'Watcharin TestTest';

const SS_DIR = path.join(process.cwd(), 'screenshots', 'products-locations-discovery');
if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });

async function collectFormElements(page: import('@playwright/test').Page) {
  const results = await page.evaluate(() => {
    const rows: string[] = [];

    document.querySelectorAll('input, textarea').forEach(el => {
      const e = el as HTMLInputElement;
      const tag = e.tagName.toLowerCase();
      const type = e.type || '';
      const id = e.id || '';
      const name = e.name || '';
      const ph = e.placeholder || '';
      const ariaLabel = e.getAttribute('aria-label') || '';
      const dataTestId = e.getAttribute('data-testid') || '';
      rows.push(`  [${tag}:${type}] id="${id}" name="${name}" ph="${ph}" aria="${ariaLabel}" testId="${dataTestId}" cls="${e.className.slice(0, 60)}"`);
    });

    document.querySelectorAll('select').forEach(el => {
      const sel = el as HTMLSelectElement;
      const id = sel.id || '';
      const name = sel.name || '';
      const options = [...sel.options].map(o => `"${o.text}"(${o.value})`).slice(0, 10).join(', ');
      rows.push(`  [select] id="${id}" name="${name}" options: ${options}`);
    });

    document.querySelectorAll('button').forEach(el => {
      const b = el as HTMLButtonElement;
      const text = b.textContent?.trim().slice(0, 60) || '';
      if (!text && !b.id) return;
      rows.push(`  [button] "${text}" id="${b.id}" cls="${b.className.slice(0, 60)}"`);
    });

    document.querySelectorAll('[role="combobox"], [role="listbox"], .ant-select, .el-select, [class*="dropdown"]').forEach(el => {
      const e = el as HTMLElement;
      const text = e.textContent?.trim().slice(0, 50) || '';
      rows.push(`  [custom-select] role="${e.getAttribute('role') || ''}" text="${text}" cls="${e.className.slice(0, 60)}"`);
    });

    return rows;
  });
  results.forEach(r => console.log(r));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    viewport: { width: 1440, height: 900 },
    // Server returns 403 to UAs containing "HeadlessChrome" — spoof a normal Chrome UA
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();

  // ── 1. Login ──────────────────────────────────────────────────────
  console.log('\n=== LOGIN ===');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#preloader', { state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.locator('input[name="email"]').fill(USERNAME);
  await page.locator('input[name="password"]').fill(PASSWORD);
  await page.locator('#login-btn').click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  console.log(`URL after login: ${page.url()}`);
  await page.screenshot({ path: path.join(SS_DIR, '01_after-login.png'), fullPage: true });

  // ── 2. Select company/store if a picker shows ──────────────────────
  console.log('\n=== COMPANY SELECT SCREEN ===');
  const bodyText1 = await page.locator('body').innerText().catch(() => '');
  console.log(`Body text has "${STORE_NAME}": ${bodyText1.includes(STORE_NAME)}`);
  const storeEl = page.getByText(STORE_NAME, { exact: false }).first();
  if (await storeEl.isVisible({ timeout: 8000 }).catch(() => false)) {
    console.log(`✅ found store "${STORE_NAME}" — clicking`);
    await storeEl.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2000);
  } else {
    console.log(`⚠️  store "${STORE_NAME}" not visible on this screen (may already be selected, or URL nav will land in it directly)`);
  }
  console.log(`URL: ${page.url()}`);
  await page.screenshot({ path: path.join(SS_DIR, '02_after-company-select.png'), fullPage: true });

  // ── 3. Navigate to products/locations ───────────────────────────────
  console.log('\n=== NAVIGATE TO /companies/products/locations ===');
  await page.goto(`${BASE_URL}/companies/products/locations`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2500);
  console.log(`URL: ${page.url()}`);
  await page.screenshot({ path: path.join(SS_DIR, '03_locations-page.png'), fullPage: true });

  // If redirected to a store-picker or login, note it
  const bodyText2 = await page.locator('body').innerText().catch(() => '');
  console.log('\n=== BODY TEXT (first 60 lines) ===');
  bodyText2.split('\n').map(l => l.trim()).filter(l => l.length > 1).slice(0, 60).forEach((l, i) => console.log(`  ${i + 1}. ${l}`));

  console.log('\n=== FORM ELEMENTS ON LOCATIONS PAGE ===');
  await collectFormElements(page);

  // ── 4. Table / shelf list structure ─────────────────────────────────
  console.log('\n=== TABLE / LIST STRUCTURE ===');
  const tableInfo = await page.evaluate(() => {
    const rows: string[] = [];
    document.querySelectorAll('table').forEach((tbl, ti) => {
      rows.push(`  Table[${ti}] id="${tbl.id}" class="${tbl.className.slice(0, 60)}"`);
      const headers = [...tbl.querySelectorAll('th')].map(th => th.textContent?.trim() || '');
      if (headers.length) rows.push(`    Headers: ${headers.join(' | ')}`);
      const firstRow = tbl.querySelector('tbody tr');
      if (firstRow) {
        const cells = [...firstRow.querySelectorAll('td')].map(td => td.textContent?.trim().slice(0, 30) || '');
        rows.push(`    First data row: ${cells.join(' | ')}`);
      }
    });
    return rows;
  });
  tableInfo.forEach(r => console.log(r));

  // ── 5. Try to find "เพิ่ม/แก้ไขสินค้า" button ────────────────────
  console.log('\n=== LOOKING FOR "เพิ่ม/แก้ไขสินค้า" BUTTON ===');
  const btnSelectors = [
    'button:has-text("เพิ่ม/แก้ไขสินค้า")',
    'a:has-text("เพิ่ม/แก้ไขสินค้า")',
    'button:has-text("เพิ่ม")',
    'button:has-text("แก้ไขสินค้า")',
  ];
  let clicked = false;
  for (const sel of btnSelectors) {
    const el = page.locator(sel).first();
    const count = await el.count();
    if (count > 0 && (await el.isVisible({ timeout: 3000 }).catch(() => false))) {
      console.log(`✅ found button via: ${sel} (count=${count})`);
      await el.click();
      clicked = true;
      break;
    } else if (count > 0) {
      console.log(`  found but not visible: ${sel} (count=${count})`);
    }
  }

  if (clicked) {
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle').catch(() => {});
    console.log(`URL after click: ${page.url()}`);
    await page.screenshot({ path: path.join(SS_DIR, '04_add-edit-product-modal.png'), fullPage: true });

    console.log('\n=== FORM ELEMENTS IN ADD/EDIT PRODUCT MODAL ===');
    await collectFormElements(page);

    const modalBody = await page.locator('body').innerText().catch(() => '');
    console.log('\n=== MODAL BODY TEXT (first 40 lines) ===');
    modalBody.split('\n').map(l => l.trim()).filter(l => l.length > 1).slice(0, 40).forEach((l, i) => console.log(`  ${i + 1}. ${l}`));

    // Look for shelf-number selector specifically
    console.log('\n=== LOOKING FOR SHELF-NUMBER (เลขชั้น) FIELD ===');
    const shelfKeywords = ['เลขชั้น', 'ชั้น', 'shelf', 'ตำแหน่ง', 'location'];
    const shelfHits = await page.evaluate((keywords) => {
      const rows: string[] = [];
      document.querySelectorAll('label, .label, [class*="label"], span, div').forEach(el => {
        const text = el.textContent?.trim() || '';
        if (text.length < 40 && keywords.some(k => text.includes(k))) {
          rows.push(`  "${text}" tag=${el.tagName} cls="${(el as HTMLElement).className.toString().slice(0, 60)}"`);
        }
      });
      return [...new Set(rows)].slice(0, 30);
    }, shelfKeywords);
    shelfHits.forEach(r => console.log(r));
  } else {
    console.log('⚠️  ไม่พบปุ่ม "เพิ่ม/แก้ไขสินค้า" — ตรวจ screenshot 03_locations-page.png');
  }

  // ── 6. Save raw DOM dump ────────────────────────────────────────────
  const rawSelectors = await page.evaluate(() => {
    const data: Record<string, any> = {};
    data.url = location.href;
    data.inputs = [...document.querySelectorAll('input, textarea, select')].map(el => {
      const e = el as HTMLInputElement;
      return { tag: e.tagName.toLowerCase(), type: e.type, id: e.id, name: e.name, placeholder: e.placeholder, className: e.className.slice(0, 80) };
    });
    data.buttons = [...document.querySelectorAll('button')].map(el => {
      const b = el as HTMLButtonElement;
      return { text: b.textContent?.trim().slice(0, 60), id: b.id, className: b.className.slice(0, 80) };
    });
    return data;
  });
  fs.writeFileSync(path.join(process.cwd(), 'products-locations-selectors-raw.json'), JSON.stringify(rawSelectors, null, 2), 'utf-8');
  console.log('\n✅ Raw selectors saved to: products-locations-selectors-raw.json');
  console.log(`✅ Screenshots saved to: ${SS_DIR}`);

  await browser.close();
}

main().catch(console.error);
