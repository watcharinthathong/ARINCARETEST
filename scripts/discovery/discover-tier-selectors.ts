/**
 * Tier Setup Selector Discovery Script
 * รันด้วย: npx tsx scripts/discover-tier-selectors.ts
 *
 * เปิด browser, login admin-stg, ไปหน้า tier-setup
 * แล้วเก็บ selector ทุก element ที่สำคัญออกมา
 */

import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://admin-stg.arincare.com';
const USERNAME = 'patiwat.arincare@gmail.com';
const PASSWORD = '123456';

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 400 });
  const ctx = await browser.newContext({
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();

  // ── 1. Navigate to tier-setup (will redirect to login) ──────────────
  console.log('\n=== NAVIGATING TO TIER SETUP ===');
  await page.goto(`${BASE_URL}/arinlink/tier-setup`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  console.log(`URL: ${page.url()}`);

  // ── 2. Login if redirected ──────────────────────────────────────────
  if (page.url().includes('login') || page.url().includes('sign-in')) {
    console.log('\n=== LOGIN PAGE ===');
    await collectAll(page, 'Login Page');

    const emailSelectors = [
      'input[type="email"]', 'input[name="email"]', 'input[name="username"]',
      'input[placeholder*="email"]', 'input[placeholder*="Email"]',
      'input[placeholder*="ชื่อผู้ใช้"]', '#email', '#username',
    ];
    for (const sel of emailSelectors) {
      const el = page.locator(sel).first();
      if ((await el.count()) > 0 && (await el.isVisible().catch(() => false))) {
        await el.fill(USERNAME);
        console.log(`✅ filled email: ${sel}`);
        break;
      }
    }

    const passSelectors = ['input[type="password"]', '#password', 'input[name="password"]'];
    for (const sel of passSelectors) {
      const el = page.locator(sel).first();
      if ((await el.count()) > 0 && (await el.isVisible().catch(() => false))) {
        await el.fill(PASSWORD);
        console.log(`✅ filled password: ${sel}`);
        break;
      }
    }

    await page.waitForSelector('#preloader', { state: 'hidden', timeout: 10000 }).catch(() => {});

    const submitSelectors = [
      '#login-btn', 'button[type="submit"]',
      'button:has-text("เข้าสู่ระบบ")', 'button:has-text("Login")', 'button:has-text("Sign In")',
    ];
    for (const sel of submitSelectors) {
      const el = page.locator(sel).first();
      if ((await el.count()) > 0 && (await el.isVisible().catch(() => false))) {
        console.log(`✅ clicking submit: ${sel}`);
        await el.click();
        break;
      }
    }

    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3000);
    console.log(`URL after login: ${page.url()}`);
  }

  // ── 3. Navigate to tier-setup after login ──────────────────────────
  if (!page.url().includes('tier-setup')) {
    console.log('\n=== NAVIGATING TO TIER SETUP AFTER LOGIN ===');
    await page.goto(`${BASE_URL}/arinlink/tier-setup`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    console.log(`URL: ${page.url()}`);
  }

  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);

  // ── 4. Collect main tier-setup page ────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('=== TIER SETUP MAIN PAGE ===');
  console.log('='.repeat(60));
  await collectAll(page, 'Tier Setup Main Page');
  await collectFormElements(page);

  // screenshot
  const ssDir = path.join(process.cwd(), 'screenshots', 'tier-setup');
  if (!fs.existsSync(ssDir)) fs.mkdirSync(ssDir, { recursive: true });
  await page.screenshot({ path: path.join(ssDir, '01_tier-setup-main.png'), fullPage: true });
  console.log('📸 screenshot: 01_tier-setup-main.png');

  // ── 5. Inspect body text for content ──────────────────────────────
  const bodyText = await page.locator('body').innerText().catch(() => '');
  const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 2);
  console.log('\n=== BODY TEXT (first 50 lines) ===');
  lines.slice(0, 50).forEach((l, i) => console.log(`  ${i + 1}. ${l}`));

  // ── 6. Collect table structure ─────────────────────────────────────
  console.log('\n=== TABLE STRUCTURE ===');
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

    // Non-table grids (div-based tables)
    const gridRoles = document.querySelectorAll('[role="grid"], [role="table"], [role="row"]');
    if (gridRoles.length) {
      rows.push(`  Div-based tables: ${gridRoles.length} elements with grid/table/row roles`);
    }
    return rows;
  });
  tableInfo.forEach(r => console.log(r));

  // ── 7. Try to click "เพิ่ม Tier" / Create Tier button ────────────
  console.log('\n=== LOOKING FOR CREATE TIER BUTTON ===');
  const createBtnSelectors = [
    'button:has-text("เพิ่ม Tier")',
    'button:has-text("เพิ่มTier")',
    'button:has-text("สร้าง Tier")',
    'button:has-text("Create Tier")',
    'button:has-text("Add Tier")',
    'button:has-text("เพิ่ม")',
    'a:has-text("เพิ่ม Tier")',
    '[data-testid*="create"], [data-testid*="add"]',
  ];

  let createClicked = false;
  for (const sel of createBtnSelectors) {
    const el = page.locator(sel).first();
    if ((await el.count()) > 0 && (await el.isVisible().catch(() => false))) {
      console.log(`✅ found create button: ${sel}`);
      await el.click();
      createClicked = true;
      break;
    }
  }

  if (createClicked) {
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle').catch(() => {});
    console.log(`URL after create click: ${page.url()}`);
    await page.screenshot({ path: path.join(ssDir, '02_create-tier-form.png'), fullPage: true });
    console.log('📸 screenshot: 02_create-tier-form.png');

    console.log('\n=== CREATE TIER FORM ===');
    await collectFormElements(page);
    await collectAll(page, 'Create Tier Form');

    // Go back
    await page.goBack().catch(() => {});
    await page.waitForTimeout(1500);
  } else {
    console.log('⚠️  ไม่พบปุ่มสร้าง Tier — ตรวจ screenshot');
  }

  // ── 8. Inspect cycle / rebate dropdowns ──────────────────────────
  console.log('\n=== CYCLE / REBATE DROPDOWNS ===');
  const dropdownInfo = await page.evaluate(() => {
    const rows: string[] = [];
    // native select
    document.querySelectorAll('select').forEach((sel, i) => {
      const options = [...sel.options].map(o => `"${o.text}"(${o.value})`).join(', ');
      rows.push(`  select[${i}] name="${sel.name}" id="${sel.id}" → options: ${options}`);
    });
    // ant-design / custom select (common in Vue/React admin panels)
    document.querySelectorAll('.ant-select, .el-select, [class*="select"]').forEach((el, i) => {
      const text = el.textContent?.trim().slice(0, 80) || '';
      const cls = el.className.slice(0, 60);
      if (text) rows.push(`  custom-select[${i}] class="${cls}" text="${text}"`);
    });
    return rows;
  });
  if (dropdownInfo.length) dropdownInfo.forEach(r => console.log(r));
  else console.log('  (no native selects found — likely custom dropdowns)');

  // ── 9. Save raw selectors to JSON ─────────────────────────────────
  const rawSelectors = await page.evaluate(() => {
    const data: Record<string, any> = {};

    // all inputs
    data.inputs = [...document.querySelectorAll('input, textarea, select')].map(el => {
      const e = el as HTMLInputElement;
      return {
        tag: e.tagName.toLowerCase(),
        type: e.type,
        id: e.id,
        name: e.name,
        placeholder: e.placeholder,
        ariaLabel: e.getAttribute('aria-label'),
        dataTestId: e.getAttribute('data-testid'),
        className: e.className.slice(0, 80),
      };
    });

    // all buttons
    data.buttons = [...document.querySelectorAll('button')].map(el => {
      const b = el as HTMLButtonElement;
      return {
        text: b.textContent?.trim().slice(0, 60),
        type: b.type,
        id: b.id,
        ariaLabel: b.getAttribute('aria-label'),
        dataTestId: b.getAttribute('data-testid'),
        disabled: b.disabled,
        className: b.className.slice(0, 80),
      };
    });

    // all links
    data.links = [...document.querySelectorAll('a[href]')].map(el => {
      const a = el as HTMLAnchorElement;
      return { text: a.textContent?.trim().slice(0, 60), href: a.href };
    });

    // page URL
    data.url = location.href;

    return data;
  });

  const outPath = path.join(process.cwd(), 'docs', 'arinlink-tier-selector-discovery', 'tier-selectors-raw.json');
  fs.writeFileSync(outPath, JSON.stringify(rawSelectors, null, 2), 'utf-8');
  console.log(`\n✅ Raw selectors saved to: docs/arinlink-tier-selector-discovery/tier-selectors-raw.json`);

  // ── 10. Inspect cycle & rebate section specifically ───────────────
  console.log('\n=== CYCLE & REBATE CONFIG SECTION ===');
  const configSection = await page.evaluate(() => {
    const rows: string[] = [];
    // Look for labels containing "cycle" or "rebate" or Thai equivalents
    const keywords = ['cycle', 'rebate', 'รอบ', 'สะสม', 'คำนวณ', 'tier'];
    document.querySelectorAll('label, .label, [class*="label"], h3, h4, h5, p, span').forEach(el => {
      const text = el.textContent?.trim() || '';
      if (keywords.some(k => text.toLowerCase().includes(k)) && text.length < 100) {
        const parent = el.parentElement;
        rows.push(`  "${text}" → parent: ${parent?.tagName} class="${parent?.className.slice(0, 60)}"`);
      }
    });
    return rows;
  });
  if (configSection.length) configSection.forEach(r => console.log(r));
  else console.log('  (no config labels found with keywords)');

  console.log('\n✅ Discovery complete. Check screenshots/tier-setup/ and docs/arinlink-tier-selector-discovery/tier-selectors-raw.json');

  // Keep browser open for manual inspection
  console.log('\n⏸  Browser will stay open for 30s for manual inspection...');
  await page.waitForTimeout(30000);

  await browser.close();
}

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
      const required = e.required ? ' [required]' : '';
      const label = document.querySelector(`label[for="${id}"]`)?.textContent?.trim() || '';

      const selectors: string[] = [];
      if (id) selectors.push(`#${id}`);
      if (name) selectors.push(`${tag}[name="${name}"]`);
      if (ph) selectors.push(`getByPlaceholder("${ph}")`);
      if (ariaLabel) selectors.push(`getByLabel("${ariaLabel}")`);
      if (dataTestId) selectors.push(`getByTestId("${dataTestId}")`);

      rows.push(`  [${tag}:${type}]${required} label="${label}" ph="${ph}" aria="${ariaLabel}"`);
      rows.push(`    best: ${selectors[0] || `${tag}[type="${type}"]`}`);
      if (selectors.length > 1) rows.push(`    alt: ${selectors.slice(1).join(' | ')}`);
    });

    document.querySelectorAll('select').forEach(el => {
      const sel = el as HTMLSelectElement;
      const id = sel.id || '';
      const name = sel.name || '';
      const label = document.querySelector(`label[for="${id}"]`)?.textContent?.trim() || '';
      const dataTestId = sel.getAttribute('data-testid') || '';
      const options = [...sel.options].map(o => `"${o.text}"(${o.value})`).slice(0, 8).join(', ');

      rows.push(`  [select] label="${label || name}" id="${id}"`);
      rows.push(`    best: ${id ? '#' + id : name ? `select[name="${name}"]` : 'select'}`);
      if (dataTestId) rows.push(`    testId: getByTestId("${dataTestId}")`);
      rows.push(`    options: ${options}`);
    });

    document.querySelectorAll('button').forEach(el => {
      const b = el as HTMLButtonElement;
      const text = b.textContent?.trim() || '';
      const type = b.type || '';
      const id = b.id || '';
      const dataTestId = b.getAttribute('data-testid') || '';
      if (!text && !id) return;

      rows.push(`  [btn:${type}] "${text}" id="${id}"`);
      if (id) rows.push(`    #${id}`);
      if (dataTestId) rows.push(`    getByTestId("${dataTestId}")`);
      if (text) rows.push(`    getByRole("button", { name: "${text}" })`);
    });

    document.querySelectorAll('[role="combobox"], [role="listbox"], [role="option"]').forEach(el => {
      const e = el as HTMLElement;
      const role = e.getAttribute('role') || '';
      const text = e.textContent?.trim().slice(0, 50) || '';
      const ariaLabel = e.getAttribute('aria-label') || '';
      const dataTestId = e.getAttribute('data-testid') || '';

      rows.push(`  [custom:${role}] "${ariaLabel || text}"`);
      if (dataTestId) rows.push(`    getByTestId("${dataTestId}")`);
    });

    return rows;
  });

  results.forEach(r => console.log(r));
}

async function collectAll(page: import('@playwright/test').Page, label: string) {
  const results = await page.evaluate(lbl => {
    const rows = [`\n--- ${lbl} (URL: ${location.href}) ---`];

    document.querySelectorAll('input, textarea, select').forEach(el => {
      const e = el as HTMLInputElement;
      const id = e.id, name = e.name, ph = e.placeholder || '', type = e.type || e.tagName;
      rows.push(`  [${e.tagName.toLowerCase()}:${type}] id="${id}" name="${name}" ph="${ph}"`);
    });

    document.querySelectorAll('button, a[href]').forEach(el => {
      const e = el as HTMLElement;
      const text = e.textContent?.trim().slice(0, 60) || '';
      const href = (e as HTMLAnchorElement).href || '';
      rows.push(`  [${e.tagName.toLowerCase()}] "${text}" ${href ? 'href=' + href : ''}`);
    });

    return rows;
  }, label);

  results.forEach(r => console.log(r));
}

main().catch(console.error);
