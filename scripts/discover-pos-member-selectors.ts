/**
 * discover-pos-member-selectors.ts
 *
 * Discovery script สำหรับ pos-stg.arincare.com
 * Flow: Login → เลือกบริษัท → เลือกสาขา → เสร็จสิ้น → Employee login → dismiss popups → สมัครสมาชิกใหม่
 *
 * รันด้วย: npx tsx scripts/discover-pos-member-selectors.ts
 */

import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/* ─── Config ─────────────────────────────────────────────────────────────── */
const BASE_URL     = 'https://pos-stg.arincare.com';
const USERNAME     = 'watcharin.arincare@gmail.com';
const PASSWORD     = '01072024';
const COMPANY      = 'Arincare Pharmacy';
const BRANCH       = 'arincare';
const EMPLOYEE_ID  = 'watcharin.arincare@gmail.com';
const EMPLOYEE_PASS = '01072024';

const OUTPUT_DIR    = 'pos-selector-discovery';
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, 'screenshots');

/* ─── Selector record ────────────────────────────────────────────────────── */
interface SelectorRow {
  screen: string;
  element: string;
  selector: string;
  elementType: string;
  remark: string;
}

const selectorData: SelectorRow[] = [];

function addRow(screen: string, element: string, selector: string, elementType: string, remark = '') {
  selectorData.push({ screen, element, selector, elementType, remark });
  console.log(`  [${elementType}] ${element}: ${selector}${remark ? ' (' + remark + ')' : ''}`);
}

/* ─── Screenshot helper ──────────────────────────────────────────────────── */
let shotCounter = 0;
async function shot(page: import('@playwright/test').Page, name: string) {
  const fname = `${String(++shotCounter).padStart(2, '0')}_${name}.png`;
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, fname), fullPage: true });
  console.log(`  📸 ${fname}`);
}

/* ─── DOM dump helper ────────────────────────────────────────────────────── */
async function dumpInteractives(page: import('@playwright/test').Page) {
  const items = await page.evaluate(() => {
    const result: Array<{tag: string; type: string; id: string; name: string; placeholder: string; text: string; href: string; role: string; ariaLabel: string; dataTestId: string; classes: string}> = [];
    document.querySelectorAll('input, textarea, select, button, a').forEach((el) => {
      const e = el as HTMLElement;
      result.push({
        tag:         e.tagName.toLowerCase(),
        type:        (e as HTMLInputElement).type ?? '',
        id:          e.id ?? '',
        name:        (e as HTMLInputElement).name ?? '',
        placeholder: (e as HTMLInputElement).placeholder ?? '',
        text:        e.textContent?.trim().slice(0, 80) ?? '',
        href:        (e as HTMLAnchorElement).href ?? '',
        role:        e.getAttribute('role') ?? '',
        ariaLabel:   e.getAttribute('aria-label') ?? '',
        dataTestId:  e.getAttribute('data-testid') ?? '',
        classes:     e.className?.slice(0, 100) ?? '',
      });
    });
    return result;
  });
  return items;
}

/* ─── Best selector picker ───────────────────────────────────────────────── */
function bestSelector(item: {tag: string; type: string; id: string; name: string; placeholder: string; text: string; href: string; ariaLabel: string; dataTestId: string}): string {
  if (item.dataTestId)  return `[data-testid="${item.dataTestId}"]`;
  if (item.id)          return `#${item.id}`;
  if (item.name)        return `${item.tag}[name="${item.name}"]`;
  if (item.ariaLabel)   return `[aria-label="${item.ariaLabel}"]`;
  if (item.placeholder) return `[placeholder="${item.placeholder}"]`;
  if (item.text && (item.tag === 'button' || item.tag === 'a')) return `${item.tag}:has-text("${item.text.slice(0, 40)}")`;
  if (item.type)        return `${item.tag}[type="${item.type}"]`;
  return `${item.tag}`;
}

/* ─── Try-click helper ────────────────────────────────────────────────────── */
async function tryClick(page: import('@playwright/test').Page, selectors: string[], label: string): Promise<string | null> {
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.count() > 0 && await el.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await el.click();
        console.log(`  ✅ clicked "${label}" via: ${sel}`);
        return sel;
      }
    } catch { /* skip */ }
  }
  console.log(`  ⚠️  ไม่พบ "${label}"`);
  return null;
}

/* ─── Try-fill helper ─────────────────────────────────────────────────────── */
async function tryFill(page: import('@playwright/test').Page, selectors: string[], value: string, label: string): Promise<string | null> {
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.count() > 0 && await el.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await el.fill(value);
        console.log(`  ✅ filled "${label}" via: ${sel}`);
        return sel;
      }
    } catch { /* skip */ }
  }
  console.log(`  ⚠️  ไม่พบ "${label}"`);
  return null;
}

/* ════════════════════════════════════════════════════════════════════════════
 * MAIN
 * ════════════════════════════════════════════════════════════════════════════ */
async function main() {
  /* setup output dirs */
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const ctx = await browser.newContext({ locale: 'th-TH', timezoneId: 'Asia/Bangkok', viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  /* ═══════════════════════════════════════════════════════════════
   * STEP 1: หน้า Login
   * ═══════════════════════════════════════════════════════════════ */
  console.log('\n═══ STEP 1: Login Page ═══');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#preloader, .preloader, [class*="preloader"]', { state: 'hidden', timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(2_000);
  await shot(page, 'login-page');

  const loginItems = await dumpInteractives(page);
  console.log('  Raw DOM elements on login page:');
  loginItems.filter(i => ['input', 'textarea', 'select', 'button'].includes(i.tag))
            .forEach(i => console.log(`    <${i.tag}> id="${i.id}" name="${i.name}" type="${i.type}" ph="${i.placeholder}" text="${i.text.slice(0,40)}"`));

  /* collect login page selectors */
  const loginSel = {
    username: await tryFill(page, [
      'input[name="email"]', 'input[type="email"]', 'input[name="username"]',
      '#username', '#email', 'input[placeholder*="ชื่อผู้ใช้"]', 'input[placeholder*="อีเมล"]', 'input:first-of-type',
    ], USERNAME, 'Username / Email'),
    password: await tryFill(page, [
      'input[type="password"]', 'input[name="password"]', '#password',
    ], PASSWORD, 'Password'),
  };

  await page.waitForTimeout(500);
  const loginBtn = await tryClick(page, [
    '#login-btn', 'button[type="submit"]', 'button:has-text("เข้าสู่ระบบ")',
    'button:has-text("Login")', 'input[type="submit"]',
  ], 'ปุ่ม Login');

  if (loginSel.username) addRow('Login Page', 'ช่องกรอก Username / Email', loginSel.username, 'input[type=email]');
  if (loginSel.password) addRow('Login Page', 'ช่องกรอก Password', loginSel.password, 'input[type=password]');
  if (loginBtn)          addRow('Login Page', 'ปุ่ม Login / เข้าสู่ระบบ', loginBtn, 'button');

  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3_000);
  console.log(`  ➡️  URL after login: ${page.url()}`);
  await shot(page, 'after-login');

  /* ═══════════════════════════════════════════════════════════════
   * STEP 2+3: เลือกบริษัท + สาขา (อยู่ใน modal เดียวกัน)
   * Modal "ตั้งค่า ARINCARE POS" มี select[name="companyId"] + select[name="branchId"]
   * ═══════════════════════════════════════════════════════════════ */
  console.log('\n═══ STEP 2+3: Company + Branch Selection ═══');
  // รอ modal/form แสดงขึ้นมา
  await page.waitForSelector('select[name="companyId"], select[name="branchId"]', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1_500);
  await shot(page, 'company-branch-modal');

  // dump current state
  const setupItems = await dumpInteractives(page);
  console.log('  Elements on company/branch setup:');
  setupItems.filter(i => ['input','select','button'].includes(i.tag))
            .forEach(i => console.log(`    <${i.tag}> name="${i.name}" id="${i.id}" text="${i.text.slice(0,60)}"`));

  // เลือกบริษัท ด้วย native select
  let companySel = '';
  const companySelect = page.locator('select[name="companyId"]').first();
  if (await companySelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await companySelect.selectOption({ label: COMPANY });
    companySel = 'select[name="companyId"]';
    console.log(`  ✅ selected company via: ${companySel}`);
    addRow('Company/Branch Setup', `Dropdown เลือกบริษัท`, 'select[name="companyId"]', 'select');
  } else {
    // fallback: custom dropdown — click trigger แล้วเลือก option
    const trigger = page.locator('[data-testid*="company"], .select-company, .company-select').first();
    if (await trigger.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await trigger.click();
      await page.locator(`li:has-text("${COMPANY}"), option:has-text("${COMPANY}")`).first().click();
      companySel = `custom dropdown → li:has-text("${COMPANY}")`;
    }
  }

  await page.waitForTimeout(500);

  // เลือกสาขา ด้วย native select
  let branchSel = '';
  const branchSelect = page.locator('select[name="branchId"]').first();
  if (await branchSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await branchSelect.selectOption({ label: BRANCH });
    branchSel = 'select[name="branchId"]';
    console.log(`  ✅ selected branch via: ${branchSel}`);
    addRow('Company/Branch Setup', `Dropdown เลือกสาขา`, 'select[name="branchId"]', 'select');
  }

  await page.waitForTimeout(500);
  await shot(page, 'before-save-setup');

  // กด "บันทึกการเปลี่ยนแปลง" (ปุ่มเดียวในฟอร์ม)
  const doneBtnSel = await tryClick(page, [
    'button:has-text("บันทึกการเปลี่ยนแปลง")',
    'button:has-text("เสร็จสิ้น")', 'button:has-text("ยืนยัน")',
    'button[type="submit"]', '#btn-done',
  ], 'ปุ่มบันทึกการเปลี่ยนแปลง / เสร็จสิ้น');
  if (doneBtnSel) addRow('Company/Branch Setup', 'ปุ่มบันทึกการเปลี่ยนแปลง', doneBtnSel, 'button');

  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(4_000);
  console.log(`  ➡️  URL after setup: ${page.url()}`);
  await shot(page, 'after-company-branch-save');

  /* ═══════════════════════════════════════════════════════════════
   * STEP 3b: กด "เสร็จสิ้น" บน confirmation screen
   * ═══════════════════════════════════════════════════════════════ */
  console.log('\n═══ STEP 3b: Confirmation "เสร็จสิ้น" ═══');
  await page.waitForTimeout(2_000);
  await shot(page, 'setup-complete-screen');

  const finishBtnSel = await tryClick(page, [
    'button:has-text("เสร็จสิ้น")', 'button:has-text("Done")',
    'button:has-text("OK")', 'button:has-text("ตกลง")',
    '.btn-success', 'button[type="submit"]',
  ], 'ปุ่มเสร็จสิ้น (confirmation)');
  if (finishBtnSel) addRow('Setup Complete', 'ปุ่มเสร็จสิ้น', finishBtnSel, 'button');

  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(4_000);
  console.log(`  ➡️  URL after เสร็จสิ้น: ${page.url()}`);
  await shot(page, 'after-finish-button');

  /* ═══════════════════════════════════════════════════════════════
   * STEP 4: Employee Login (อาจเป็น PIN pad หรือ form)
   * ═══════════════════════════════════════════════════════════════ */
  console.log('\n═══ STEP 4: Employee Login ═══');
  await page.waitForTimeout(3_000);
  await shot(page, 'employee-login-page');

  // dump ALL elements เพื่อเข้าใจ UI จริง
  const empAllItems = await dumpInteractives(page);
  console.log('  ALL interactive elements after company/branch save:');
  empAllItems.forEach(i => {
    const info = [i.tag, i.type, `id="${i.id}"`, `name="${i.name}"`, `ph="${i.placeholder}"`, `text="${i.text.slice(0,50)}"`].filter(Boolean).join(' ');
    console.log(`    ${info}`);
  });

  // dump ALL text content visible on page (เพื่อ debug)
  const pageTexts = await page.evaluate(() => {
    const texts: string[] = [];
    document.querySelectorAll('h1,h2,h3,h4,label,p,span,div').forEach(el => {
      const t = el.textContent?.trim() ?? '';
      if (t.length > 0 && t.length < 100 && t !== el.children[0]?.textContent?.trim()) {
        texts.push(t);
      }
    });
    return [...new Set(texts)].slice(0, 30);
  });
  console.log('  Visible text snippets:', pageTexts.slice(0, 20));

  // ลองหาแบบ input ทุก type
  const empIdSel = await tryFill(page, [
    'input[name="employee_id"]', 'input[name="username"]', 'input[name="code"]',
    '#employee-id', '#employee_id', '#staff-id', '#staffId', '#employeeId',
    'input[placeholder*="รหัสประจำตัว"]', 'input[placeholder*="พนักงาน"]',
    'input[placeholder*="ชื่อผู้ใช้"]', 'input[placeholder*="username"]',
    'input[type="email"]', 'input[type="text"]:visible',
  ], EMPLOYEE_ID, 'รหัสประจำตัวพนักงาน');

  const empPassSel = await tryFill(page, [
    'input[type="password"]', 'input[name="password"]', 'input[name="pin"]',
    '#password', '#pin', '#passcode',
    'input[placeholder*="รหัสผ่าน"]', 'input[placeholder*="PIN"]', 'input[placeholder*="pin"]',
  ], EMPLOYEE_PASS, 'รหัสผ่านพนักงาน');

  const empLoginBtn = await tryClick(page, [
    'button:has-text("เข้าสู่ระบบ")', 'button:has-text("Login")', 'button:has-text("ยืนยัน")',
    'button[type="submit"]', '#btn-login', '#login-button', '.btn-login',
  ], 'ปุ่มเข้าสู่ระบบ (พนักงาน)');

  if (empIdSel)    addRow('Employee Login', 'ช่องรหัสประจำตัวพนักงาน', empIdSel, 'input');
  if (empPassSel)  addRow('Employee Login', 'ช่องรหัสผ่านพนักงาน', empPassSel, 'input[type=password]');
  if (empLoginBtn) addRow('Employee Login', 'ปุ่มเข้าสู่ระบบ', empLoginBtn, 'button');

  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(4_000);
  console.log(`  ➡️  URL after employee login: ${page.url()}`);
  await shot(page, 'after-employee-login');

  /* ═══════════════════════════════════════════════════════════════
   * STEP 5: Dismiss Popups / Modals
   * ═══════════════════════════════════════════════════════════════ */
  console.log('\n═══ STEP 5: Dismiss Popups ═══');

  // ลองปิด popup หลายรอบ (อาจมีหลายอัน)
  for (let i = 0; i < 5; i++) {
    const popupClosed = await dismissPopup(page);
    if (!popupClosed) break;
    await page.waitForTimeout(1_500);
  }
  await shot(page, 'after-dismiss-popups');

  /* ═══════════════════════════════════════════════════════════════
   * STEP 6: หา "สมัครสมาชิกใหม่" และ collect selector
   * ═══════════════════════════════════════════════════════════════ */
  console.log('\n═══ STEP 6: หา "สมัครสมาชิกใหม่" ═══');
  await page.waitForTimeout(2_000);
  await shot(page, 'main-page');

  /* dump ทุก link/button บนหน้าหลัก */
  const mainItems = await dumpInteractives(page);
  console.log('  Buttons and links on main page:');
  mainItems.filter(i => ['button', 'a'].includes(i.tag) && i.text.trim())
           .forEach(i => console.log(`    <${i.tag}> "${i.text.slice(0,60)}" id="${i.id}" href="${i.href.slice(0,60)}"`));

  const registerSel = await findAndRecordRegisterButton(page);
  if (registerSel) {
    addRow('Main Page', 'ปุ่มสมัครสมาชิกใหม่', registerSel, 'button/link');
    await page.locator(registerSel).first().click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3_000);
    console.log(`  ➡️  URL after สมัครสมาชิกใหม่: ${page.url()}`);
    await shot(page, 'register-form-opened');
  } else {
    console.log('  ⚠️  ไม่พบปุ่มสมัครสมาชิกใหม่ — dump ทุก element:');
    mainItems.forEach(i => console.log(`    <${i.tag}> id="${i.id}" text="${i.text.slice(0,60)}"`));
  }

  /* ═══════════════════════════════════════════════════════════════
   * STEP 7: ฟอร์มสมัครสมาชิก — Tab ข้อมูลทั่วไป
   * ═══════════════════════════════════════════════════════════════ */
  console.log('\n═══ STEP 7: Registration Form — Tab ข้อมูลทั่วไป ═══');
  await page.waitForTimeout(2_000);
  await shot(page, 'register-tab1-general');
  await collectRegistrationTab(page, 'Tab: ข้อมูลทั่วไป');

  /* ═══════════════════════════════════════════════════════════════
   * STEP 8: Tab ข้อมูลใบกำกับภาษี
   * ═══════════════════════════════════════════════════════════════ */
  console.log('\n═══ STEP 8: Tab ข้อมูลใบกำกับภาษี ═══');
  await clickTab(page, 'ข้อมูลใบกำกับภาษี');
  await page.waitForTimeout(1_500);
  await shot(page, 'register-tab2-tax');
  await collectRegistrationTab(page, 'Tab: ข้อมูลใบกำกับภาษี');

  /* ═══════════════════════════════════════════════════════════════
   * STEP 9: Tab หมายเหตุและการแพ้ยา
   * ═══════════════════════════════════════════════════════════════ */
  console.log('\n═══ STEP 9: Tab หมายเหตุและการแพ้ยา ═══');
  await clickTab(page, 'หมายเหตุ');
  await page.waitForTimeout(1_500);
  await shot(page, 'register-tab3-note');
  await collectRegistrationTab(page, 'Tab: หมายเหตุและการแพ้ยา');

  /* ═══════════════════════════════════════════════════════════════
   * OUTPUT: บันทึก JSON
   * ═══════════════════════════════════════════════════════════════ */
  const jsonPath = path.join(OUTPUT_DIR, 'selectors.json');
  fs.writeFileSync(jsonPath, JSON.stringify(selectorData, null, 2), 'utf-8');
  console.log(`\n✅ บันทึก JSON: ${jsonPath}`);
  console.log(`📸 Screenshots: ${SCREENSHOT_DIR}`);
  console.log(`\n═══ Selector Summary (${selectorData.length} rows) ═══`);
  console.table(selectorData.map(r => ({ Screen: r.screen, Element: r.element, Selector: r.selector })));

  await browser.close();
}

/* ─── dismissPopup: ลองปิด modal/popup ─────────────────────────────────── */
async function dismissPopup(page: import('@playwright/test').Page): Promise<boolean> {
  const closeSelectors = [
    // ปิด YOU HAVE NEW PRESCRIPTION / PURCHASE ORDER
    'button:has-text("ปิด")', 'button:has-text("Close")',
    '.close', 'button.close', '[data-dismiss="modal"]',
    '.modal .btn-close', '.modal button:has-text("ตกลง")',
    '.swal2-close', '.swal2-confirm', '.swal2-deny',
    // ปิดโฆษณาทั่วไป
    'button:has-text("×")', 'span.close', 'i.close',
    '[aria-label="Close"]', '[aria-label="ปิด"]',
    '.modal-header .close', '.popup-close', '.overlay-close',
    // ยืนยัน/ยอมรับ dialogs
    'button:has-text("ยืนยัน")', 'button:has-text("ยอมรับ")',
    'button:has-text("OK")', 'button:has-text("ตกลง")',
  ];

  for (const sel of closeSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 1_500 }).catch(() => false)) {
        const text = await el.textContent().catch(() => '');
        console.log(`  🔕 closing popup via: ${sel} ("${text?.trim().slice(0,30)}")`);
        addRow('Popup / Modal', `ปุ่มปิด Popup "${text?.trim().slice(0,30)}"`, sel, 'button');
        await el.click();
        return true;
      }
    } catch { /* skip */ }
  }
  return false;
}

/* ─── findAndRecordRegisterButton ──────────────────────────────────────── */
async function findAndRecordRegisterButton(page: import('@playwright/test').Page): Promise<string | null> {
  const candidates = [
    'button:has-text("สมัครสมาชิกใหม่")', 'a:has-text("สมัครสมาชิกใหม่")',
    '[data-testid*="register"]', '[data-testid*="member"]',
    'button:has-text("สมัครสมาชิก")', 'a:has-text("สมัครสมาชิก")',
    'button:has-text("เพิ่มสมาชิก")', 'a:has-text("เพิ่มสมาชิก")',
    'button:has-text("New Member")', 'a:has-text("New Member")',
    '#btn-register', '#register-member', '.btn-register',
  ];
  for (const sel of candidates) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 2_000 }).catch(() => false)) {
        console.log(`  ✅ พบปุ่มสมัครสมาชิกใหม่: ${sel}`);
        return sel;
      }
    } catch { /* skip */ }
  }
  return null;
}

/* ─── clickTab ──────────────────────────────────────────────────────────── */
async function clickTab(page: import('@playwright/test').Page, tabName: string): Promise<void> {
  const tabSelectors = [
    `[role="tab"]:has-text("${tabName}")`,
    `li:has-text("${tabName}")`,
    `a:has-text("${tabName}")`,
    `button:has-text("${tabName}")`,
    `span:has-text("${tabName}")`,
  ];
  for (const sel of tabSelectors) {
    try {
      const el = page.locator(sel).first();
      if (await el.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await el.click();
        addRow(`Form Tab`, `Tab "${tabName}"`, sel, 'tab/link');
        console.log(`  ✅ clicked tab "${tabName}" via: ${sel}`);
        return;
      }
    } catch { /* skip */ }
  }
  console.log(`  ⚠️  ไม่พบ Tab: ${tabName}`);
}

/* ─── collectRegistrationTab ────────────────────────────────────────────── */
async function collectRegistrationTab(page: import('@playwright/test').Page, screenLabel: string) {
  const items = await page.evaluate(() => {
    const result: Array<{
      tag: string; type: string; id: string; name: string; placeholder: string;
      text: string; labelText: string; ariaLabel: string; dataTestId: string; classes: string;
    }> = [];

    document.querySelectorAll('input, textarea, select, button').forEach((el) => {
      const e = el as HTMLInputElement;
      const labelEl = e.id ? document.querySelector(`label[for="${e.id}"]`) : null;
      // หา label ที่ wrap input ด้วย
      const wrapLabel = e.closest('label') ?? e.parentElement?.querySelector('label');
      result.push({
        tag:         e.tagName.toLowerCase(),
        type:        e.type ?? '',
        id:          e.id ?? '',
        name:        e.name ?? '',
        placeholder: e.placeholder ?? '',
        text:        e.textContent?.trim().slice(0, 80) ?? '',
        labelText:   (labelEl?.textContent ?? wrapLabel?.textContent ?? '').trim().slice(0, 60),
        ariaLabel:   e.getAttribute('aria-label') ?? '',
        dataTestId:  e.getAttribute('data-testid') ?? '',
        classes:     e.className?.slice(0, 100) ?? '',
      });
    });
    return result;
  });

  console.log(`  Found ${items.length} interactive elements`);

  items.forEach((item) => {
    if (!item.id && !item.name && !item.placeholder && !item.text.trim() && !item.ariaLabel) return;

    const sel = (() => {
      if (item.dataTestId) return `[data-testid="${item.dataTestId}"]`;
      if (item.id)         return `#${item.id}`;
      if (item.name)       return `${item.tag}[name="${item.name}"]`;
      if (item.ariaLabel)  return `[aria-label="${item.ariaLabel}"]`;
      if (item.placeholder) return `[placeholder="${item.placeholder}"]`;
      if (item.text && (item.tag === 'button')) return `button:has-text("${item.text.slice(0,40)}")`;
      return `${item.tag}[type="${item.type}"]`;
    })();

    const labelDisplay = item.labelText || item.placeholder || item.ariaLabel || item.text.slice(0, 40);
    const elementName = labelDisplay || `${item.tag} (${item.type || item.tag})`;
    const remark = (!item.id && !item.name && !item.dataTestId) ? 'ต้องตรวจสอบด้วย DevTools เพิ่มเติม' : '';

    addRow(screenLabel, elementName, sel, `${item.tag}${item.type ? ':' + item.type : ''}`, remark);
  });
}

main().catch(console.error);
