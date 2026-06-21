/**
 * Selector Collection Script
 * รันด้วย: npx tsx scripts/collect-selectors.ts
 *
 * จะเปิด browser, login, navigate ไปยังฟอร์ม "เพิ่มรายชื่อลูกค้าใหม่"
 * แล้วเก็บ selector ทุก element ที่ interactive ออกมา
 */

import { chromium } from '@playwright/test';

const BASE_URL = 'https://app-stg.arincare.com';
const USERNAME  = 'watcharin.arincare@gmail.com';
const PASSWORD  = '01072024';
const COMPANY   = 'Arincare Pharmacy';

async function main() {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const ctx     = await browser.newContext({ locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
  const page    = await ctx.newPage();

  /* ── 1. LOGIN PAGE ─────────────────────────────────────────────── */
  console.log('\n=== LOGIN PAGE ===');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  await collectInteractives(page, 'Login Page');

  /* ── 2. PERFORM LOGIN ──────────────────────────────────────────── */
  // หา input username/email
  const userInputs = [
    'input[type="email"]', 'input[name="username"]', 'input[name="email"]',
    '#username', '#email', 'input[placeholder*="ชื่อผู้ใช้"]', 'input[placeholder*="อีเมล"]',
  ];
  for (const sel of userInputs) {
    const el = page.locator(sel).first();
    if (await el.count() > 0 && await el.isVisible().catch(() => false)) {
      await el.fill(USERNAME);
      console.log(`✅ filled username with: ${sel}`);
      break;
    }
  }

  // หา input password
  const passInputs = ['input[type="password"]', 'input[name="password"]', '#password'];
  for (const sel of passInputs) {
    const el = page.locator(sel).first();
    if (await el.count() > 0 && await el.isVisible().catch(() => false)) {
      await el.fill(PASSWORD);
      console.log(`✅ filled password with: ${sel}`);
      break;
    }
  }

  // รอ preloader หายก่อน แล้วค่อยกด submit
  await page.waitForSelector('#preloader', { state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);

  const submitBtns = [
    '#login-btn',
    'button[type="submit"]',
    'button:has-text("เข้าสู่ระบบ")',
    'button:has-text("Login")',
  ];
  for (const sel of submitBtns) {
    const el = page.locator(sel).first();
    if (await el.count() > 0 && await el.isVisible().catch(() => false)) {
      console.log(`✅ clicking submit: ${sel}`);
      await el.click();
      break;
    }
  }

  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  console.log(`\n➡️  URL after login: ${page.url()}`);

  /* ── 3. SELECT COMPANY (ถ้ามีหน้าเลือก) ────────────────────────── */
  const companyEl = page.getByText(COMPANY, { exact: false }).first();
  if (await companyEl.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log(`\n=== COMPANY SELECTION PAGE ===`);
    await collectInteractives(page, 'Company Selection Page');
    console.log(`✅ clicking company: ${COMPANY}`);
    await companyEl.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3000);
    console.log(`➡️  URL after company select: ${page.url()}`);
  }

  /* ── 4. หน้าหลัก — เก็บ nav/sidebar ──────────────────────────── */
  console.log(`\n=== MAIN DASHBOARD ===`);
  await collectInteractives(page, 'Dashboard / Main Page');

  /* ── 5. คลิก "สมาชิกการค้า" ────────────────────────────────────── */
  const tradeMenuSels = [
    'a:has-text("สมาชิกการค้า")',
    '[href*="trade"], [href*="member"], [href*="customer"]',
    'li:has-text("สมาชิกการค้า")',
    'span:has-text("สมาชิกการค้า")',
  ];
  let tradeClicked = false;
  for (const sel of tradeMenuSels) {
    const el = page.locator(sel).first();
    if (await el.count() > 0 && await el.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log(`✅ clicking trade menu: ${sel}`);
      await el.click();
      tradeClicked = true;
      break;
    }
  }
  if (!tradeClicked) {
    console.log('⚠️  ไม่พบ สมาชิกการค้า — ลองหาด้วย text');
    await page.getByText('สมาชิกการค้า', { exact: false }).first().click().catch(() => {});
  }
  await page.waitForTimeout(2000);

  /* ── 6. คลิก "ข้อมูลลูกค้า" ────────────────────────────────────── */
  const custMenuSels = [
    'a:has-text("ข้อมูลลูกค้า")',
    'li:has-text("ข้อมูลลูกค้า")',
    'span:has-text("ข้อมูลลูกค้า")',
  ];
  let custClicked = false;
  for (const sel of custMenuSels) {
    const el = page.locator(sel).first();
    if (await el.count() > 0 && await el.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log(`✅ clicking customer data menu: ${sel}`);
      await el.click();
      custClicked = true;
      break;
    }
  }
  if (!custClicked) {
    await page.getByText('ข้อมูลลูกค้า', { exact: false }).first().click().catch(() => {});
  }
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);
  console.log(`➡️  URL (customer list): ${page.url()}`);

  console.log(`\n=== CUSTOMER LIST PAGE ===`);
  await collectInteractives(page, 'Customer List Page');

  /* ── 7. คลิก "เพิ่มรายชื่อลูกค้าใหม่" ─────────────────────────── */
  const addBtnSels = [
    'button:has-text("เพิ่มรายชื่อลูกค้าใหม่")',
    'a:has-text("เพิ่มรายชื่อลูกค้าใหม่")',
    'button:has-text("เพิ่มลูกค้า")',
    'button:has-text("เพิ่ม")',
    '[data-testid*="add"]',
  ];
  let addClicked = false;
  for (const sel of addBtnSels) {
    const el = page.locator(sel).first();
    if (await el.count() > 0 && await el.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log(`✅ clicking add customer: ${sel}`);
      await el.click();
      addClicked = true;
      break;
    }
  }
  if (!addClicked) {
    await page.getByText('เพิ่มรายชื่อลูกค้าใหม่', { exact: false }).first().click().catch(() => {});
  }
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2000);
  console.log(`➡️  URL (add customer form): ${page.url()}`);

  /* ── 8. เก็บ selectors ฟอร์มลูกค้า ──────────────────────────────── */
  console.log(`\n${'='.repeat(60)}`);
  console.log(`=== ADD CUSTOMER FORM (Tab: ข้อมูลทั่วไป) ===`);
  console.log(`${'='.repeat(60)}`);
  await collectFormElements(page);

  /* ── 9. คลิกแต่ละ Tab แล้วเก็บ selectors ──────────────────────── */
  const tabs = ['ที่อยู่', 'ราคาขาย', 'ข้อมูลทางยา', 'ประวัติการซื้อ', 'หมายเหตุ'];
  for (const tabName of tabs) {
    const tabEl = page.getByRole('tab', { name: tabName })
      .or(page.locator(`[role="tab"]:has-text("${tabName}")`))
      .or(page.locator(`button:has-text("${tabName}")`))
      .first();
    if (await tabEl.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tabEl.click();
      await page.waitForTimeout(1000);
      console.log(`\n${'='.repeat(60)}`);
      console.log(`=== TAB: ${tabName} ===`);
      console.log(`${'='.repeat(60)}`);
      await collectFormElements(page);
    } else {
      console.log(`\n⚠️  ไม่พบ Tab: ${tabName}`);
    }
  }

  /* ── 10. เก็บ URL สุดท้าย ────────────────────────────────────────── */
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Final URL: ${page.url()}`);
  console.log(`${'='.repeat(60)}\n`);

  await browser.close();
}

/* ─── Helper: เก็บ element ทั้งหมดใน form ─────────────────────── */
async function collectFormElements(page: import('@playwright/test').Page) {
  const results = await page.evaluate(() => {
    const rows: string[] = [];

    // inputs
    document.querySelectorAll('input, textarea').forEach((el) => {
      const input = el as HTMLInputElement;
      const tag   = input.tagName.toLowerCase();
      const type  = input.type || '';
      const name  = input.name || '';
      const id    = input.id || '';
      const ph    = input.placeholder || '';
      const cls   = [...input.classList].join('.') || '';
      const label = document.querySelector(`label[for="${id}"]`)?.textContent?.trim() || '';
      const ariaLabel = input.getAttribute('aria-label') || '';
      const dataTestId = input.getAttribute('data-testid') || '';
      const required = input.required ? ' [required]' : '';

      const selectors = [];
      if (id)          selectors.push(`#${id}`);
      if (name)        selectors.push(`${tag}[name="${name}"]`);
      if (ph)          selectors.push(`getByPlaceholder("${ph}")`);
      if (ariaLabel)   selectors.push(`getByLabel("${ariaLabel}")`);
      if (dataTestId)  selectors.push(`getByTestId("${dataTestId}")`);

      const labelInfo = label ? `label="${label}"` : (ariaLabel ? `aria-label="${ariaLabel}"` : '');
      rows.push(`  [${tag}${type ? ':' + type : ''}]${required} ${labelInfo || ph ? `ph="${ph}"` : ''}`);
      rows.push(`    best selector: ${selectors[0] || `${tag}[type="${type}"]`}`);
      rows.push(`    all: ${selectors.join(' | ')}`);
      if (cls) rows.push(`    class: .${cls}`);
    });

    // selects (dropdown)
    document.querySelectorAll('select').forEach((el) => {
      const sel  = el as HTMLSelectElement;
      const id   = sel.id || '';
      const name = sel.name || '';
      const label = document.querySelector(`label[for="${id}"]`)?.textContent?.trim() || '';
      const dataTestId = sel.getAttribute('data-testid') || '';
      const options = [...sel.options].map((o) => o.text).slice(0, 5).join(', ');

      rows.push(`  [select] label="${label || name}"`);
      rows.push(`    best selector: ${id ? '#' + id : name ? `select[name="${name}"]` : 'select'}`);
      if (dataTestId) rows.push(`    getByTestId("${dataTestId}")`);
      rows.push(`    options (first 5): ${options}`);
    });

    // buttons
    document.querySelectorAll('button').forEach((el) => {
      const btn  = el as HTMLButtonElement;
      const text = btn.textContent?.trim() || '';
      const type = btn.type || '';
      const id   = btn.id || '';
      const dataTestId = btn.getAttribute('data-testid') || '';
      if (!text && !id) return;

      rows.push(`  [button:${type || 'button'}] "${text}"`);
      if (id)           rows.push(`    #${id}`);
      if (dataTestId)   rows.push(`    getByTestId("${dataTestId}")`);
      rows.push(`    getByRole("button", { name: "${text}" })`);
    });

    // custom dropdowns (div/span ที่มี role=listbox หรือ combobox)
    document.querySelectorAll('[role="combobox"], [role="listbox"], [role="option"]').forEach((el) => {
      const e = el as HTMLElement;
      const role   = e.getAttribute('role') || '';
      const text   = e.textContent?.trim().slice(0, 50) || '';
      const ariaLabel = e.getAttribute('aria-label') || '';
      const dataTestId = e.getAttribute('data-testid') || '';

      rows.push(`  [custom:${role}] "${ariaLabel || text}"`);
      if (dataTestId) rows.push(`    getByTestId("${dataTestId}")`);
    });

    return rows;
  });

  results.forEach((r) => console.log(r));
}

/* ─── Helper: เก็บ link / button ทั่วหน้า ──────────────────────── */
async function collectInteractives(page: import('@playwright/test').Page, label: string) {
  const results = await page.evaluate((lbl) => {
    const rows = [`\n--- ${lbl} (URL: ${location.href}) ---`];

    document.querySelectorAll('input, textarea, select').forEach((el) => {
      const e  = el as HTMLInputElement;
      const id = e.id, name = e.name, ph = e.placeholder || '', type = e.type || e.tagName;
      rows.push(`  [${e.tagName.toLowerCase()}:${type}] id="${id}" name="${name}" placeholder="${ph}"`);
    });

    document.querySelectorAll('button, a[href]').forEach((el) => {
      const e    = el as HTMLElement;
      const text = e.textContent?.trim().slice(0, 60) || '';
      const href = (e as HTMLAnchorElement).href || '';
      rows.push(`  [${e.tagName.toLowerCase()}] "${text}" ${href ? 'href=' + href : ''}`);
    });

    return rows;
  }, label);

  results.forEach((r) => console.log(r));
}

main().catch(console.error);
