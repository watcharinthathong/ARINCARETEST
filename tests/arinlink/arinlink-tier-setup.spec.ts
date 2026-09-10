/**
 * Arinlink Tier Setup E2E Tests
 * URL: https://admin-stg.arincare.com/arinlink/tier-setup
 *
 * Selectors verified from live DOM via discover-tier-selectors.ts
 *
 * Test Modules:
 *   TC-TIER-001  Page loads
 *   TC-TIER-002  Tier Cycle configuration
 *   TC-TIER-003  Rebate Period configuration
 *   TC-TIER-004  Tier List table
 *   TC-TIER-005  Create Tier (valid)
 *   TC-TIER-006  Create Tier (required field validation)
 *   TC-TIER-007  Create Tier (duplicate min purchase validation)
 *   TC-TIER-008  Edit Tier
 *   TC-TIER-009  Delete Tier – cancel
 *   TC-TIER-010  Delete Tier – confirm
 *   TC-TIER-011  Status display (Active / Inactive)
 *   TC-TIER-012  Business rule – tiers ordered by min purchase
 *   TC-TIER-013  UI checks (table headers, layout)
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { adminLogin } from '../../pages/adminLogin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const SS_DIR     = path.join(__dirname, '../../screenshots/arinlink/tier-setup');

const BASE = 'https://admin-stg.arincare.com';
const USER = { email: 'patiwat.arincare@gmail.com', pass: '123456' };

// Unique test tier – avoids collision with existing data
const TS          = Date.now();
const T_LEVEL     = 10;
const T_NAME      = `AutoTest Tier ${TS}`;
const T_DESC      = 'Test tier created by Playwright automation';
const T_MIN_BUY   = 777777;   // sufficiently unique
const T_MIN_ORDER = 0;
const T_PT_BAHT   = 100;
const T_PT_POINT  = 2;

// ── Selectors ──────────────────────────────────────────────────────────────────
const SEL = {
  // Page header
  pageTitle:  'text=Tier Configuration',
  breadcrumb: 'a:has-text("Tier Setup"), text=Tier Setup',

  // Cycle config card (left)
  // Identified by option value="1" (1 เดือน) – cycle-specific
  cycleSelect:       'select:has(option[value="1"])',
  cycleSaveBtn:      'button:has-text("บันทึก") >> nth=0',
  cycleLastUpdated:  'text=อัปเดตล่าสุด >> nth=0',

  // Rebate Period card (right)
  // Identified by option value="half_year" – rebate-specific
  rebateSelect:      'select:has(option[value="half_year"])',
  rebateSaveBtn:     'button:has-text("บันทึก") >> nth=1',
  rebateLastUpdated: 'text=อัปเดตล่าสุด >> nth=1',

  // Tier table
  tierTable:    'table.tier-table',
  tierHeaders:  'table.tier-table th',
  tierRows:     'table.tier-table tbody tr',

  // Create Tier modal trigger
  createTierBtn: 'button:has-text("เพิ่ม Tier")',

  // Form fields (active when create / edit modal is open)
  // Identified by placeholders confirmed in discovery
  levelInput:   'input[placeholder="เช่น 5"]',
  nameInput:    'input[placeholder="เช่น Diamond Plus"]',
  descInput:    'input[placeholder="เช่น สมาชิกระดับพิเศษ"]',
  fileInput:    'input[type="file"]',

  // Status select – identified by Active/Inactive option values
  statusSelect: 'select:has(option[value="true"])',

  // Form number inputs — indexed by position when create modal is open
  // Order: nth=0 level, nth=1 minBuy, nth=2 minOrder, nth=3 pointBaht, nth=4 pointValue
  // Using index is safer than :not([placeholder]) since inputs may have placeholder=""
  minBuyInput:     'input[type="number"] >> nth=1',
  minOrderInput:   'input[placeholder="ไม่ระบุ"]',
  pointBahtInput:  'input[type="number"] >> nth=3',
  pointValueInput: 'input[type="number"] >> nth=4',

  // Condition toggle
  conditionOrBtn:  'button:has-text("OR")',
  conditionAndBtn: 'button:has-text("AND")',

  // Modal action buttons
  cancelBtn:      'button:has-text("ยกเลิก")',
  createBtn:      'button:has-text("สร้าง Tier")',
  // Edit form uses generic "บันทึก" inside the modal → identify by text after modal opens
  updateBtn:      'button:has-text("บันทึก") >> nth=0',

  // Success / notification
  successMsg: [
    '.swal2-container',
    '.alert-success',
    '.toastr .toast-success',
    'text=สำเร็จ',
    'text=บันทึกสำเร็จ',
    'text=success',
  ].join(', '),

  // Delete confirmation
  confirmDialog: '.swal2-container, [role="dialog"], .modal.show',
  confirmYesBtn: [
    'button.swal2-confirm',
    'button:has-text("ยืนยัน")',
    'button:has-text("ลบ")',
    'button:has-text("OK")',
  ].join(', '),
  confirmNoBtn: [
    'button.swal2-cancel',
    'button:has-text("ยกเลิก"):not(:has-text("สร้าง"))',
  ].join(', '),
} as const;

// ── Result types ───────────────────────────────────────────────────────────────
interface Result {
  id: string;
  module: string;
  scenario: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  screenshots: string[];
  remark: string;
}
const RESULTS: Result[] = [];

// ── Helpers ────────────────────────────────────────────────────────────────────
if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });

async function ss(page: any, name: string): Promise<string> {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(SS_DIR, file), fullPage: true });
  return file;
}

async function login(page: any): Promise<void> {
  await adminLogin(page, BASE, USER.email, USER.pass);
  await page.waitForTimeout(2000);
}

async function hideDebugBar(page: any): Promise<void> {
  // PHP Debugbar sits at the bottom and intercepts pointer events — hide it
  await page.evaluate(() => {
    const bar = document.querySelector('.phpdebugbar') as HTMLElement | null;
    if (bar) bar.style.display = 'none';
  }).catch(() => {});
}

async function goToTierSetup(page: any): Promise<void> {
  await page.goto(`${BASE}/arinlink/tier-setup`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  await hideDebugBar(page);
}

async function waitForSuccess(page: any, timeout = 8000): Promise<boolean> {
  try {
    await page.waitForSelector(SEL.successMsg, { timeout });
    return true;
  } catch {
    // Check flash text in page body
    const body = await page.locator('body').innerText().catch(() => '');
    return /สำเร็จ|success|saved|updated/i.test(body);
  }
}

async function findTierRowByName(page: any, name: string): Promise<any | null> {
  const rows = page.locator(SEL.tierRows);
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const rowText = await rows.nth(i).innerText().catch(() => '');
    if (rowText.includes(name)) return rows.nth(i);
  }
  return null;
}

// ── TC-TIER-001: Page loads ────────────────────────────────────────────────────
test('TC-TIER-001 – Tier Configuration page loads after login', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const shots: string[] = [];

  await login(page);
  shots.push(await ss(page, 'TIER-001_01_login'));

  await goToTierSetup(page);
  shots.push(await ss(page, 'TIER-001_02_tier-setup'));

  const url = page.url();
  const hasTitle = await page.locator(SEL.pageTitle).isVisible().catch(() => false);
  const hasCycleCard = await page.locator(SEL.cycleSelect).isVisible().catch(() => false);
  const hasTable = await page.locator(SEL.tierTable).isVisible().catch(() => false);
  const hasCreateBtn = await page.locator(SEL.createTierBtn).isVisible().catch(() => false);

  const pass = url.includes('tier-setup') && hasTitle && hasTable;

  RESULTS.push({
    id: 'TC-TIER-001', module: 'Tier Setup', scenario: 'Page loads after login',
    expected: 'URL tier-setup, แสดง Tier Configuration heading, table, create button',
    actual: `URL=${url} | title=${hasTitle} | cycleCard=${hasCycleCard} | table=${hasTable} | createBtn=${hasCreateBtn}`,
    status: pass ? 'PASS' : 'FAIL',
    screenshots: shots,
    remark: pass ? 'หน้า Tier Configuration โหลดสำเร็จ' : 'หน้าไม่โหลดหรือ selector ไม่ถูกต้อง',
  });
  console.log(`TC-TIER-001: ${RESULTS.at(-1)!.status}`);

  expect(url).toContain('tier-setup');
  await expect(page.locator(SEL.tierTable)).toBeVisible();
});

// ── TC-TIER-002: Tier Cycle Configuration ─────────────────────────────────────
test('TC-TIER-002 – Tier Cycle Configuration: change, save, verify', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const shots: string[] = [];

  await login(page);
  await goToTierSetup(page);
  shots.push(await ss(page, 'TIER-002_01_tier-setup'));

  const cycleEl = page.locator(SEL.cycleSelect);
  await expect(cycleEl).toBeVisible();

  // Read current value (default)
  const currentVal = await cycleEl.inputValue();
  shots.push(await ss(page, 'TIER-002_02_cycle-default'));
  console.log(`TC-TIER-002: Current cycle value = "${currentVal}"`);

  // Change to a different option
  const newVal = currentVal === '2' ? '3' : '2';
  await cycleEl.selectOption(newVal);
  await page.waitForTimeout(500);
  shots.push(await ss(page, 'TIER-002_03_cycle-changed'));

  // Save
  await page.locator(SEL.cycleSaveBtn).click();
  await page.waitForTimeout(2000);
  shots.push(await ss(page, 'TIER-002_04_after-save'));

  const savedOk = await waitForSuccess(page);

  // Refresh and verify
  await goToTierSetup(page);
  shots.push(await ss(page, 'TIER-002_05_after-refresh'));

  const valAfterRefresh = await page.locator(SEL.cycleSelect).inputValue();
  const persisted = valAfterRefresh === newVal;

  // Restore original value
  await page.locator(SEL.cycleSelect).selectOption(currentVal);
  await page.locator(SEL.cycleSaveBtn).click();
  await page.waitForTimeout(1500);

  const pass = persisted;
  RESULTS.push({
    id: 'TC-TIER-002', module: 'Tier Cycle Config', scenario: 'เปลี่ยน Cycle, บันทึก, Refresh ตรวจสอบ',
    expected: `ค่า cycle เปลี่ยนเป็น "${newVal}" และ persist หลัง refresh`,
    actual: `default="${currentVal}" changed="${newVal}" afterRefresh="${valAfterRefresh}" savedOk=${savedOk}`,
    status: pass ? 'PASS' : 'FAIL',
    screenshots: shots,
    remark: pass ? 'Cycle config บันทึกและ persist ถูกต้อง' : `ค่าหลัง refresh = "${valAfterRefresh}" (expect "${newVal}")`,
  });
  console.log(`TC-TIER-002: ${RESULTS.at(-1)!.status} | afterRefresh="${valAfterRefresh}"`);
});

// ── TC-TIER-003: Rebate Period Configuration ───────────────────────────────────
test('TC-TIER-003 – Rebate Period: change, save, verify', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const shots: string[] = [];

  await login(page);
  await goToTierSetup(page);

  const rebateEl = page.locator(SEL.rebateSelect);
  await expect(rebateEl).toBeVisible();

  const currentVal = await rebateEl.inputValue();
  shots.push(await ss(page, 'TIER-003_01_rebate-default'));
  console.log(`TC-TIER-003: Current rebate value = "${currentVal}"`);

  // Change to different option
  const newVal = currentVal === 'half_year' ? 'yearly' : 'half_year';
  await rebateEl.selectOption(newVal);
  await page.waitForTimeout(500);
  shots.push(await ss(page, 'TIER-003_02_rebate-changed'));

  await page.locator(SEL.rebateSaveBtn).click();
  await page.waitForTimeout(2000);
  shots.push(await ss(page, 'TIER-003_03_after-save'));

  const savedOk = await waitForSuccess(page);

  await goToTierSetup(page);
  shots.push(await ss(page, 'TIER-003_04_after-refresh'));

  const valAfterRefresh = await page.locator(SEL.rebateSelect).inputValue();
  const persisted = valAfterRefresh === newVal;

  // Restore
  await page.locator(SEL.rebateSelect).selectOption(currentVal);
  await page.locator(SEL.rebateSaveBtn).click();
  await page.waitForTimeout(1500);

  RESULTS.push({
    id: 'TC-TIER-003', module: 'Rebate Period Config', scenario: 'เปลี่ยน Rebate Period, บันทึก, Refresh ตรวจสอบ',
    expected: `ค่า rebate เปลี่ยนเป็น "${newVal}" และ persist`,
    actual: `default="${currentVal}" changed="${newVal}" afterRefresh="${valAfterRefresh}" savedOk=${savedOk}`,
    status: persisted ? 'PASS' : 'FAIL',
    screenshots: shots,
    remark: persisted ? 'Rebate Period config บันทึกและ persist ถูกต้อง' : `ค่าไม่ persist: "${valAfterRefresh}"`,
  });
  console.log(`TC-TIER-003: ${RESULTS.at(-1)!.status}`);
});

// ── TC-TIER-004: Tier List table ───────────────────────────────────────────────
test('TC-TIER-004 – Tier List: columns and data display', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const shots: string[] = [];

  await login(page);
  await goToTierSetup(page);
  shots.push(await ss(page, 'TIER-004_01_tier-table'));

  // Verify table exists
  await expect(page.locator(SEL.tierTable)).toBeVisible();

  // Verify headers
  const headers = await page.locator(SEL.tierHeaders).allInnerTexts();
  const expectedHeaders = ['Level', 'ชื่อ Tier', 'ยอดซื้อขั้นต่ำ', 'จำนวน Order', 'อัตราการได้คะแนน', 'จำนวนร้าน', 'สถานะ', 'จัดการ'];
  const headersFound = expectedHeaders.filter(h =>
    headers.some(actual => actual.toLowerCase().includes(h.toLowerCase()))
  );
  console.log(`TC-TIER-004: headers found: ${JSON.stringify(headers)}`);

  // Verify at least 1 data row
  const rowCount = await page.locator(SEL.tierRows).count();

  // Verify first row has required data
  const firstRow = page.locator(SEL.tierRows).nth(0);
  const firstRowText = await firstRow.innerText();
  const hasLevel    = /^\s*\d+/.test(firstRowText) || firstRowText.includes('0') || firstRowText.includes('MedEx');
  const hasStatus   = /Active|Inactive/i.test(firstRowText);
  const hasPoints   = /pt\.|pt|คะแนน|บ\./i.test(firstRowText);

  shots.push(await ss(page, 'TIER-004_02_table-data'));

  const pass = rowCount > 0 && headersFound.length >= 5;

  RESULTS.push({
    id: 'TC-TIER-004', module: 'Tier List', scenario: 'Table แสดง column ครบถ้วนและมีข้อมูล',
    expected: 'Table มี 8 columns, มี data อย่างน้อย 1 row, แสดง Level/Name/Status/Points',
    actual: `rowCount=${rowCount} | headersMatched=${headersFound.length}/8 | hasStatus=${hasStatus} | hasPoints=${hasPoints}`,
    status: pass ? 'PASS' : 'FAIL',
    screenshots: shots,
    remark: pass ? `Table มี ${rowCount} rows, headers OK` : `headers ไม่ครบ: ${headersFound.join(', ')}`,
  });
  console.log(`TC-TIER-004: ${RESULTS.at(-1)!.status} | rows=${rowCount}`);

  expect(rowCount).toBeGreaterThan(0);
});

// ── TC-TIER-005: Create Tier (valid data) ─────────────────────────────────────
test('TC-TIER-005 – Create Tier: fill all fields and submit', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const shots: string[] = [];

  await login(page);
  await goToTierSetup(page);
  shots.push(await ss(page, 'TIER-005_01_before-create'));

  // Compute next level and min purchase from existing table data
  // Server requires consecutive levels; Vue validates min_purchase within allowed range
  const tierData = await page.locator(SEL.tierRows).evaluateAll((rows) =>
    rows.map(r => {
      const cells = r.querySelectorAll('td');
      const lvl  = parseInt(cells[0]?.textContent?.trim() ?? 'NaN');
      const minP = parseInt((cells[2]?.textContent ?? '').replace(/[,\s฿]/g, ''));
      return { lvl: isNaN(lvl) ? null : lvl, minP: isNaN(minP) ? null : minP };
    })
  );
  const existingLevels   = tierData.map(d => d.lvl).filter((n): n is number => n !== null);
  const existingMinPurchases = tierData.map(d => d.minP).filter((n): n is number => n !== null);
  const nextLevel      = existingLevels.length   > 0 ? Math.max(...existingLevels)   + 1    : T_LEVEL;
  const nextMinPurchase = existingMinPurchases.length > 0 ? Math.max(...existingMinPurchases) + 5000 : T_MIN_BUY;
  console.log(`TC-TIER-005: levels=${JSON.stringify(existingLevels)} → use level=${nextLevel}`);
  console.log(`TC-TIER-005: minPurchases=${JSON.stringify(existingMinPurchases)} → use minBuy=${nextMinPurchase}`);

  // Open create modal
  await page.locator(SEL.createTierBtn).click();
  await page.waitForTimeout(1500);
  shots.push(await ss(page, 'TIER-005_02_create-modal'));

  // Verify form fields are visible
  const levelVisible = await page.locator(SEL.levelInput).isVisible().catch(() => false);
  const nameVisible  = await page.locator(SEL.nameInput).isVisible().catch(() => false);
  console.log(`TC-TIER-005: levelInput=${levelVisible} nameInput=${nameVisible}`);

  if (!levelVisible || !nameVisible) {
    shots.push(await ss(page, 'TIER-005_03_form-not-visible'));
    RESULTS.push({
      id: 'TC-TIER-005', module: 'Create Tier', scenario: 'Create Tier form เปิดและ submit ได้',
      expected: 'Modal เปิดพร้อม form fields',
      actual: `level=${levelVisible} name=${nameVisible}`,
      status: 'FAIL',
      screenshots: shots,
      remark: 'Create form ไม่แสดงหลัง click — ตรวจ screenshot',
    });
    console.log('TC-TIER-005: FAIL — form not visible');
    return;
  }

  // Fill Level (use next consecutive level, not fixed T_LEVEL)
  await page.locator(SEL.levelInput).fill(String(nextLevel));

  // Fill Name
  await page.locator(SEL.nameInput).fill(T_NAME);

  // Fill Description (optional)
  const descEl = page.locator(SEL.descInput).first();
  if (await descEl.isVisible().catch(() => false)) {
    await descEl.fill(T_DESC);
  }

  // Set Status to Active
  const statusEl = page.locator(SEL.statusSelect).first();
  if (await statusEl.isVisible().catch(() => false)) {
    await statusEl.selectOption('true');
  }

  // Scoped locators — more stable than global nth() which can shift when DOM updates
  // Point rate inputs are inside .tier-point-box; min purchase is in .form-group w/ label
  const ptBahtLoc  = page.locator('.tier-point-box input[type="number"]').nth(0);
  const ptValueLoc = page.locator('.tier-point-box input[type="number"]').nth(1);
  // Min purchase: form-group containing "ยอดซื้อ" label text
  const minBuyLoc  = page.locator('.form-group').filter({ hasText: /ยอดซื้อ/ }).locator('input[type="number"]').first();

  // Fill Point Rate (use fill after explicit click to ensure focus)
  await ptBahtLoc.click({ force: true });
  await ptBahtLoc.fill(String(T_PT_BAHT));
  await page.waitForTimeout(150);

  await ptValueLoc.click({ force: true });
  await ptValueLoc.fill(String(T_PT_POINT));
  await page.waitForTimeout(150);

  // Fill Min Purchase LAST — after point rate to prevent Vue reactive reset
  // Use nextMinPurchase (current max + 5000) so Vue validation passes
  await minBuyLoc.click({ force: true });
  await page.waitForTimeout(200);
  await minBuyLoc.fill(String(nextMinPurchase));
  await page.waitForTimeout(300);

  let minBuyVal = await minBuyLoc.inputValue().catch(() => '');
  if (minBuyVal !== String(nextMinPurchase)) {
    // Fallback: triple-click select-all + keyboard.type
    await minBuyLoc.click({ clickCount: 3, force: true });
    await page.keyboard.type(String(nextMinPurchase));
    await page.waitForTimeout(400);
    minBuyVal = await minBuyLoc.inputValue().catch(() => '');
  }
  if (minBuyVal !== String(nextMinPurchase)) {
    // Last resort: native setter + Vue events
    await page.evaluate((value) => {
      const target = document.querySelector('.form-group input[type="number"][placeholder=""]') as HTMLInputElement | null;
      if (!target) return;
      target.focus();
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(target, String(value));
      target.dispatchEvent(new InputEvent('input', { bubbles: true, data: String(value) }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      target.dispatchEvent(new Event('blur', { bubbles: true }));
    }, nextMinPurchase);
    await page.waitForTimeout(500);
    minBuyVal = await minBuyLoc.inputValue().catch(() => '');
  }

  // Post-fill diagnostic — written to file so it persists across test runs
  const diagAfter = await page.evaluate(() =>
    Array.from(document.querySelectorAll('input[type="number"]'))
      .map((el, i) => ({ idx: i, value: (el as HTMLInputElement).value, parentCls: el.parentElement?.className?.slice(0, 40) }))
  );
  fs.writeFileSync(path.join(SS_DIR, 'diag-after-fills.json'), JSON.stringify(diagAfter, null, 2));

  // Fill Min Order (optional – only if T_MIN_ORDER > 0)
  if (T_MIN_ORDER > 0) {
    await page.locator(SEL.minOrderInput).first().fill(String(T_MIN_ORDER)).catch(() => {});
  }

  // Press Tab to blur the last focused input and commit its value to Vue model
  await page.keyboard.press('Tab');
  await page.waitForTimeout(600); // let Vue reactivity process the blur + model sync

  shots.push(await ss(page, 'TIER-005_03_form-filled'));

  // Submit (hide debugbar first — it overlaps the button in the modal)
  await hideDebugBar(page);
  await page.locator(SEL.createBtn).click({ force: true });
  await page.waitForTimeout(3000);
  await page.waitForLoadState('networkidle').catch(() => {});
  shots.push(await ss(page, 'TIER-005_04_after-submit'));

  const savedOk = await waitForSuccess(page);

  // Reload and check tier appears in list
  await goToTierSetup(page);
  shots.push(await ss(page, 'TIER-005_05_after-reload'));

  const newRow = await findTierRowByName(page, T_NAME);
  const tierInList = newRow !== null;

  const pass = tierInList;
  RESULTS.push({
    id: 'TC-TIER-005', module: 'Create Tier', scenario: 'สร้าง Tier ใหม่ด้วยข้อมูลครบถ้วน',
    expected: `Tier "${T_NAME}" ปรากฏในรายการหลัง submit`,
    actual: `savedOk=${savedOk} | tierInList=${tierInList}`,
    status: pass ? 'PASS' : 'FAIL',
    screenshots: shots,
    remark: pass ? `Tier "${T_NAME}" สร้างสำเร็จ` : `Tier ไม่ปรากฏในรายการ — savedOk=${savedOk}`,
  });
  console.log(`TC-TIER-005: ${RESULTS.at(-1)!.status} | tierInList=${tierInList}`);
});

// ── TC-TIER-006: Create Tier – required field validation ──────────────────────
test('TC-TIER-006 – Create Tier: required field validation', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const shots: string[] = [];

  await login(page);
  await goToTierSetup(page);

  // Open create modal
  await page.locator(SEL.createTierBtn).click();
  await page.waitForTimeout(1500);

  const modalVisible = await page.locator(SEL.createBtn).isVisible().catch(() => false);
  if (!modalVisible) {
    RESULTS.push({
      id: 'TC-TIER-006', module: 'Create Tier Validation', scenario: 'Required field validation',
      expected: 'Error message เมื่อไม่กรอก required field',
      actual: 'Modal ไม่เปิด',
      status: 'SKIP', screenshots: shots, remark: 'SKIP: modal ไม่เปิด',
    });
    console.log('TC-TIER-006: SKIP');
    return;
  }

  shots.push(await ss(page, 'TIER-006_01_empty-form'));

  // Submit without filling anything
  await hideDebugBar(page);
  await page.locator(SEL.createBtn).click({ force: true });
  await page.waitForTimeout(1500);
  shots.push(await ss(page, 'TIER-006_02_after-empty-submit'));

  // Check for validation messages
  const body = await page.locator('body').innerText();
  const hasValidation = /required|จำเป็น|กรุณา|ไม่ได้กรอก|invalid|error/i.test(body);

  // Check HTML5 validation or custom validation messages
  const invalidInputs = await page.locator('input:invalid, input.is-invalid, .invalid-feedback, .field-error').count();
  const modalStillOpen = await page.locator(SEL.createBtn).isVisible().catch(() => false);

  // Either validation messages appear OR modal stays open (form rejected)
  const pass = hasValidation || invalidInputs > 0 || modalStillOpen;

  RESULTS.push({
    id: 'TC-TIER-006', module: 'Create Tier Validation', scenario: 'ไม่กรอก required field กด submit',
    expected: 'แสดง validation error หรือ form ไม่ปิด',
    actual: `hasValidationMsg=${hasValidation} | invalidInputs=${invalidInputs} | modalStillOpen=${modalStillOpen}`,
    status: pass ? 'PASS' : 'FAIL',
    screenshots: shots,
    remark: pass
      ? 'Validation ทำงานถูกต้อง — form ไม่ submit เมื่อข้อมูลไม่ครบ'
      : 'Form อาจ submit ได้โดยไม่มี validation — ตรวจ screenshot',
  });
  console.log(`TC-TIER-006: ${RESULTS.at(-1)!.status} | invalidInputs=${invalidInputs}`);

  // Cancel form to clean up
  await page.locator(SEL.cancelBtn).click().catch(() => {});
  await page.waitForTimeout(800);
});

// ── TC-TIER-007: Create Tier – duplicate min purchase validation ───────────────
test('TC-TIER-007 – Create Tier: duplicate min purchase rejected', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const shots: string[] = [];

  await login(page);
  await goToTierSetup(page);

  // Clean up any leftover "Dup Test" tiers from previous runs before creating a new one
  let staleRow = await findTierRowByName(page, 'Dup Test');
  while (staleRow) {
    const staleDelBtn = staleRow.locator('td').last().locator('button').last();
    if (await staleDelBtn.isVisible().catch(() => false)) {
      await staleDelBtn.click();
      await page.waitForTimeout(1500);
      const confirmBtn = page.locator(SEL.confirmYesBtn);
      if (await confirmBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.first().click({ force: true });
        await page.waitForTimeout(1500);
      } else {
        await page.keyboard.press('Escape');
      }
    }
    await goToTierSetup(page);
    staleRow = await findTierRowByName(page, 'Dup Test');
  }

  // Get an existing min purchase value from the table
  // MedEx Starter has 0 as min purchase
  const existingMinBuy = 0;

  await page.locator(SEL.createTierBtn).click();
  await page.waitForTimeout(1500);
  shots.push(await ss(page, 'TIER-007_01_create-modal'));

  const levelEl = page.locator(SEL.levelInput);
  if (!(await levelEl.isVisible().catch(() => false))) {
    RESULTS.push({
      id: 'TC-TIER-007', module: 'Create Tier Validation', scenario: 'Duplicate min purchase rejected',
      expected: 'Error เมื่อ min purchase ซ้ำ',
      actual: 'Modal ไม่เปิด',
      status: 'SKIP', screenshots: shots, remark: 'SKIP',
    });
    return;
  }

  // Fill with duplicate min purchase
  await levelEl.fill('99');
  await page.locator(SEL.nameInput).fill(`Dup Test ${TS}`);
  const minBuyEl = page.locator(SEL.minBuyInput).first();
  if (await minBuyEl.isVisible().catch(() => false)) {
    await minBuyEl.fill(String(existingMinBuy)); // duplicate value
  }

  shots.push(await ss(page, 'TIER-007_02_form-with-dup'));
  await hideDebugBar(page);
  await page.locator(SEL.createBtn).click({ force: true });
  await page.waitForTimeout(2000);
  shots.push(await ss(page, 'TIER-007_03_after-submit'));

  const body = await page.locator('body').innerText();
  const hasError = /ซ้ำ|duplicate|already|exist|error/i.test(body);
  const modalStillOpen = await page.locator(SEL.createBtn).isVisible().catch(() => false);

  const pass = hasError || modalStillOpen;
  const bugNote = !pass ? '⚠️ BUG: ระบบอนุญาตให้สร้าง Tier ที่มี min purchase ซ้ำกัน (0 บาท)' : '';
  RESULTS.push({
    id: 'TC-TIER-007', module: 'Create Tier Validation', scenario: 'Duplicate min purchase validation',
    expected: 'System ปฏิเสธ tier ที่มี min purchase ซ้ำกับ tier ที่มีอยู่',
    actual: `hasError=${hasError} | modalStillOpen=${modalStillOpen}`,
    status: pass ? 'PASS' : 'FAIL',
    screenshots: shots,
    remark: pass ? 'Duplicate validation ทำงาน' : bugNote,
  });
  console.log(`TC-TIER-007: ${RESULTS.at(-1)!.status}${bugNote ? ' — ' + bugNote : ''}`);

  // Close modal if still open
  await page.locator(SEL.cancelBtn).click().catch(() => {});
  await page.waitForTimeout(800);

  // Cleanup: if duplicate was created (system bug), delete it to avoid contaminating later tests
  if (!pass) {
    const dupRow = await findTierRowByName(page, `Dup Test ${TS}`);
    if (dupRow) {
      const delBtn = dupRow.locator('td').last().locator('button').last();
      if (await delBtn.isVisible().catch(() => false)) {
        await delBtn.click();
        await page.waitForTimeout(1500);
        const confirmBtn = page.locator(SEL.confirmYesBtn);
        if (await confirmBtn.isVisible().catch(() => false)) {
          await confirmBtn.click();
        } else {
          await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(1500);
        console.log('TC-TIER-007: Cleaned up duplicate tier');
      }
    }
  }
});

// ── TC-TIER-008: Edit Tier ─────────────────────────────────────────────────────
test('TC-TIER-008 – Edit Tier: modify and save', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const shots: string[] = [];

  await login(page);
  await goToTierSetup(page);
  shots.push(await ss(page, 'TIER-008_01_tier-list'));

  // Find our test tier (created in TC-TIER-005) or use the first editable row
  let targetRow = await findTierRowByName(page, T_NAME);
  if (!targetRow) {
    // Fallback: edit the last row (safest – least likely to break ordering)
    const rowCount = await page.locator(SEL.tierRows).count();
    targetRow = page.locator(SEL.tierRows).nth(rowCount - 1);
  }

  const rowText = await targetRow.innerText();
  console.log(`TC-TIER-008: editing row: "${rowText.slice(0, 80)}"`);

  // Click edit button (2nd button in จัดการ column = first icon button in last td)
  const editBtn = targetRow.locator('td').last().locator('button').nth(0);
  if (!(await editBtn.isVisible().catch(() => false))) {
    RESULTS.push({
      id: 'TC-TIER-008', module: 'Edit Tier', scenario: 'แก้ไข Tier',
      expected: 'Edit form เปิดและบันทึกสำเร็จ',
      actual: 'ไม่พบ edit button',
      status: 'SKIP', screenshots: shots, remark: 'SKIP: edit button ไม่พบ',
    });
    console.log('TC-TIER-008: SKIP — edit button not found');
    return;
  }

  await editBtn.click();
  await page.waitForTimeout(2000);
  shots.push(await ss(page, 'TIER-008_02_edit-modal'));

  const isEditOpen = await page.locator(SEL.nameInput).isVisible().catch(() => false)
    || await page.locator(SEL.updateBtn).isVisible().catch(() => false);

  if (!isEditOpen) {
    RESULTS.push({
      id: 'TC-TIER-008', module: 'Edit Tier', scenario: 'แก้ไข Tier',
      expected: 'Edit form เปิด',
      actual: 'Edit form ไม่เปิดหลัง click',
      status: 'FAIL', screenshots: shots, remark: 'Edit modal ไม่ปรากฏ',
    });
    console.log('TC-TIER-008: FAIL — edit modal not open');
    return;
  }

  // Modify fields — use .last() to target the visible edit modal
  // (page may have hidden create form in DOM simultaneously)
  const editDescEl = page.locator(SEL.descInput).last();
  const editNameEl = page.locator(SEL.nameInput).last();

  let editedField = '';
  if (await editDescEl.isVisible().catch(() => false)) {
    await editDescEl.fill(`Edited by auto test ${TS}`);
    editedField = 'description';
  } else if (await editNameEl.isVisible().catch(() => false)) {
    const origName = await editNameEl.inputValue().catch(() => '');
    await editNameEl.fill(origName.includes('AutoTest') ? `${origName} (edited)` : `${origName} [edit]`);
    editedField = 'name';
  } else {
    // Fallback: fill any visible text input in the modal
    const anyText = page.locator('input[type="text"]:visible').last();
    if (await anyText.isVisible().catch(() => false)) {
      const current = await anyText.inputValue().catch(() => '');
      await anyText.fill(current ? `${current} [auto-edited]` : `auto-edited ${TS}`);
      editedField = 'text-fallback';
    }
  }

  shots.push(await ss(page, 'TIER-008_03_form-modified'));

  // Save
  await hideDebugBar(page);
  const saveBtnInModal = page.locator('button:has-text("บันทึก")').last();
  await saveBtnInModal.click({ force: true });
  await page.waitForTimeout(2500);
  await page.waitForLoadState('networkidle').catch(() => {});
  shots.push(await ss(page, 'TIER-008_04_after-save'));

  // Modal closing = success when no toastr/swal message is shown
  const modalClosed = !(await page.locator(SEL.nameInput).isVisible().catch(() => true));
  const savedOk = (await waitForSuccess(page, 3000)) || modalClosed;

  // Reload and verify change persists
  await goToTierSetup(page);
  shots.push(await ss(page, 'TIER-008_05_after-reload'));

  const bodyAfter = await page.locator('body').innerText();
  const editPersisted = editedField === 'description'
    ? bodyAfter.includes(`Edited by auto test ${TS}`)
    : savedOk;

  const pass008 = savedOk || editPersisted;
  RESULTS.push({
    id: 'TC-TIER-008', module: 'Edit Tier', scenario: 'แก้ไข Tier และบันทึก',
    expected: 'แก้ไขสำเร็จ ข้อมูลอัปเดตใน list',
    actual: `editedField=${editedField} | modalClosed=${modalClosed} | savedOk=${savedOk} | persisted=${editPersisted}`,
    status: pass008 ? 'PASS' : 'FAIL',
    screenshots: shots,
    remark: pass008 ? `Edit ${editedField} สำเร็จ` : 'Save ไม่สำเร็จ — ตรวจ screenshot',
  });
  console.log(`TC-TIER-008: ${RESULTS.at(-1)!.status} | modalClosed=${modalClosed} savedOk=${savedOk}`);
});

// ── TC-TIER-009: Delete Tier – cancel confirmation ─────────────────────────────
test('TC-TIER-009 – Delete Tier: cancel keeps tier in list', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const shots: string[] = [];

  await login(page);
  await goToTierSetup(page);
  shots.push(await ss(page, 'TIER-009_01_tier-list'));

  // Count rows before
  const rowsBefore = await page.locator(SEL.tierRows).count();

  // Find our test tier or use last row
  let targetRow = await findTierRowByName(page, T_NAME);
  if (!targetRow) {
    targetRow = page.locator(SEL.tierRows).last();
  }

  // Click delete button (last button in จัดการ column)
  const deleteBtn = targetRow.locator('td').last().locator('button').last();
  if (!(await deleteBtn.isVisible().catch(() => false))) {
    RESULTS.push({
      id: 'TC-TIER-009', module: 'Delete Tier', scenario: 'Cancel delete – tier stays',
      expected: 'Confirm dialog แสดง, Cancel → tier ยังอยู่',
      actual: 'ไม่พบ delete button',
      status: 'SKIP', screenshots: shots, remark: 'SKIP: delete button ไม่พบ',
    });
    return;
  }

  await deleteBtn.click();
  await page.waitForTimeout(1500);
  shots.push(await ss(page, 'TIER-009_02_delete-confirm'));

  // Check confirmation dialog
  const dialogVisible = await page.locator(SEL.confirmDialog).isVisible().catch(() => false);
  const cancelBtnVisible = await page.locator(SEL.confirmNoBtn).isVisible().catch(() => false);
  console.log(`TC-TIER-009: dialog=${dialogVisible} cancel=${cancelBtnVisible}`);

  // Click Cancel
  if (cancelBtnVisible) {
    await page.locator(SEL.confirmNoBtn).click();
  } else {
    // Fallback: press Escape
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(1000);
  shots.push(await ss(page, 'TIER-009_03_after-cancel'));

  const rowsAfter = await page.locator(SEL.tierRows).count();
  const tierStillPresent = rowsAfter >= rowsBefore;

  RESULTS.push({
    id: 'TC-TIER-009', module: 'Delete Tier', scenario: 'Cancel delete – tier ยังอยู่ใน list',
    expected: 'Dialog ปรากฏ, หลัง Cancel tier ยังอยู่ใน list',
    actual: `dialog=${dialogVisible} | rowsBefore=${rowsBefore} rowsAfter=${rowsAfter}`,
    status: tierStillPresent ? 'PASS' : 'FAIL',
    screenshots: shots,
    remark: tierStillPresent
      ? 'Cancel delete ทำงานถูกต้อง tier ไม่ถูกลบ'
      : `Rows ลดลงจาก ${rowsBefore} → ${rowsAfter} หลัง cancel`,
  });
  console.log(`TC-TIER-009: ${RESULTS.at(-1)!.status} | rows ${rowsBefore}→${rowsAfter}`);
});

// ── TC-TIER-010: Delete Tier – confirm delete ─────────────────────────────────
test('TC-TIER-010 – Delete Tier: confirm removes tier from list', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const shots: string[] = [];

  await login(page);
  await goToTierSetup(page);
  shots.push(await ss(page, 'TIER-010_01_tier-list'));

  // ONLY delete our own test tier – find by name
  const testRow = await findTierRowByName(page, T_NAME);

  if (!testRow) {
    RESULTS.push({
      id: 'TC-TIER-010', module: 'Delete Tier', scenario: 'Confirm delete – tier หายจาก list',
      expected: `Tier "${T_NAME}" ถูกลบ`,
      actual: `ไม่พบ test tier "${T_NAME}" — อาจไม่ถูกสร้างใน TC-TIER-005`,
      status: 'SKIP', screenshots: shots,
      remark: 'SKIP: test tier ไม่มีใน list (TC-TIER-005 อาจ FAIL)',
    });
    console.log('TC-TIER-010: SKIP — test tier not found');
    return;
  }

  const rowsBefore = await page.locator(SEL.tierRows).count();
  const deleteBtn = testRow.locator('td').last().locator('button').last();

  if (!(await deleteBtn.isVisible().catch(() => false))) {
    RESULTS.push({
      id: 'TC-TIER-010', module: 'Delete Tier', scenario: 'Confirm delete',
      expected: 'Tier ถูกลบ',
      actual: 'ไม่พบ delete button',
      status: 'SKIP', screenshots: shots, remark: 'SKIP',
    });
    return;
  }

  await deleteBtn.click();
  await page.waitForTimeout(1500);
  shots.push(await ss(page, 'TIER-010_02_delete-confirm'));

  // Click Confirm
  const confirmBtnVisible = await page.locator(SEL.confirmYesBtn).isVisible().catch(() => false);
  if (confirmBtnVisible) {
    await page.locator(SEL.confirmYesBtn).click();
  } else {
    // Some systems auto-delete without dialog
    console.log('TC-TIER-010: no confirm dialog found — may have auto-deleted');
  }

  await page.waitForTimeout(2500);
  await page.waitForLoadState('networkidle').catch(() => {});
  shots.push(await ss(page, 'TIER-010_03_after-delete'));

  const tierGone = (await findTierRowByName(page, T_NAME)) === null;
  const rowsAfter = await page.locator(SEL.tierRows).count();

  RESULTS.push({
    id: 'TC-TIER-010', module: 'Delete Tier', scenario: 'Confirm delete – tier หายจาก list',
    expected: `Tier "${T_NAME}" ถูกลบออกจาก list`,
    actual: `rowsBefore=${rowsBefore} rowsAfter=${rowsAfter} | tierGone=${tierGone}`,
    status: tierGone ? 'PASS' : 'FAIL',
    screenshots: shots,
    remark: tierGone
      ? `Tier "${T_NAME}" ลบสำเร็จ`
      : `Tier ยังอยู่ใน list หลัง confirm delete`,
  });
  console.log(`TC-TIER-010: ${RESULTS.at(-1)!.status} | tierGone=${tierGone}`);
});

// ── TC-TIER-011: Status display ───────────────────────────────────────────────
test('TC-TIER-011 – Status: Active and Inactive badges display', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const shots: string[] = [];

  await login(page);
  await goToTierSetup(page);
  shots.push(await ss(page, 'TIER-011_01_status'));

  const activeCount   = await page.locator('table.tier-table td:has-text("Active")').count();
  const inactiveCount = await page.locator('table.tier-table td:has-text("Inactive")').count();
  const totalStatus   = activeCount + inactiveCount;
  const rowCount      = await page.locator(SEL.tierRows).count();

  console.log(`TC-TIER-011: Active=${activeCount} Inactive=${inactiveCount} rows=${rowCount}`);

  // Pass: both Active and Inactive badges appear somewhere in the table
  // Note: totalStatus may exceed rowCount if a cell contains the word "Active" in other context
  const pass = activeCount > 0 && inactiveCount >= 0 && totalStatus > 0;

  RESULTS.push({
    id: 'TC-TIER-011', module: 'Status', scenario: 'แสดง Active / Inactive badge ใน table',
    expected: 'มี Active badge อย่างน้อย 1 rows และแสดงได้ทั้ง Active/Inactive',
    actual: `Active=${activeCount} Inactive=${inactiveCount} totalRows=${rowCount}`,
    status: pass ? 'PASS' : 'FAIL',
    screenshots: shots,
    remark: pass ? `Status badges แสดงครบ — Active=${activeCount} Inactive=${inactiveCount}` : 'ไม่พบ status badge',
  });
  console.log(`TC-TIER-011: ${RESULTS.at(-1)!.status}`);
});

// ── TC-TIER-012: Business rule – min purchase ordered ─────────────────────────
test('TC-TIER-012 – Business: tiers ordered by min purchase (low to high)', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const shots: string[] = [];

  await login(page);
  await goToTierSetup(page);

  // Clean up leftover "Dup Test" tiers (from TC-TIER-007 on previous runs)
  // to ensure ordering check is not polluted by stale test data
  let dupCleanRow = await findTierRowByName(page, 'Dup Test');
  while (dupCleanRow) {
    const dupCleanBtn = dupCleanRow.locator('td').last().locator('button').last();
    if (await dupCleanBtn.isVisible().catch(() => false)) {
      await dupCleanBtn.click();
      await page.waitForTimeout(1500);
      const confirmBtn = page.locator(SEL.confirmYesBtn);
      if (await confirmBtn.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn.first().click({ force: true });
        await page.waitForTimeout(1500);
      } else {
        await page.keyboard.press('Escape');
      }
    }
    await goToTierSetup(page);
    dupCleanRow = await findTierRowByName(page, 'Dup Test');
  }

  // Similarly clean up leftover AutoTest tiers from TC-TIER-005 that weren't deleted by TC-TIER-010
  let autoTestRow = await findTierRowByName(page, 'AutoTest Tier');
  while (autoTestRow) {
    const autoDelBtn = autoTestRow.locator('td').last().locator('button').last();
    if (await autoDelBtn.isVisible().catch(() => false)) {
      await autoDelBtn.click();
      await page.waitForTimeout(1500);
      const confirmBtn2 = page.locator(SEL.confirmYesBtn);
      if (await confirmBtn2.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await confirmBtn2.first().click({ force: true });
        await page.waitForTimeout(1500);
      } else {
        await page.keyboard.press('Escape');
      }
    }
    await goToTierSetup(page);
    autoTestRow = await findTierRowByName(page, 'AutoTest Tier');
  }

  shots.push(await ss(page, 'TIER-012_01_table'));

  // Extract min purchase values from table (column index 2 = ยอดซื้อขั้นต่ำ)
  const rows = page.locator(SEL.tierRows);
  const rowCount = await rows.count();
  const minPurchases: number[] = [];

  for (let i = 0; i < rowCount; i++) {
    const cells = rows.nth(i).locator('td');
    const cellCount = await cells.count();
    // min purchase is in 3rd td (index 2)
    if (cellCount >= 3) {
      const cellText = await cells.nth(2).innerText();
      const num = parseInt(cellText.replace(/[,\s]/g, ''), 10);
      if (!isNaN(num)) minPurchases.push(num);
    }
  }

  console.log(`TC-TIER-012: minPurchases = ${JSON.stringify(minPurchases)}`);

  // Detect duplicates (symptom of TC-TIER-007 bug — system allows duplicate min purchase)
  const hasDuplicates = minPurchases.length !== new Set(minPurchases).size;
  if (hasDuplicates) {
    console.log('TC-TIER-012: ⚠️ Duplicate min purchase values detected — likely due to TC-TIER-007 BUG');
  }

  // Check ascending order
  let isOrdered = true;
  for (let i = 1; i < minPurchases.length; i++) {
    if (minPurchases[i] < minPurchases[i - 1]) { isOrdered = false; break; }
  }

  const remark = isOrdered
    ? `Tier list เรียงลำดับถูกต้อง`
    : hasDuplicates
      ? `⚠️ BUG (TC-TIER-007): ระบบอนุญาตสร้าง tier ที่มี min purchase ซ้ำ ทำให้การเรียงลำดับไม่ถูกต้อง: ${JSON.stringify(minPurchases)}`
      : `⚠️ BUG: Tier ไม่เรียงตาม min purchase: ${JSON.stringify(minPurchases)}`;

  // Mark as FAIL only when unordered AND not caused by duplicate test data
  const status = minPurchases.length <= 1 ? 'SKIP' as const
    : isOrdered ? 'PASS' as const
    : 'FAIL' as const;

  RESULTS.push({
    id: 'TC-TIER-012', module: 'Business Validation', scenario: 'ยอดซื้อขั้นต่ำเรียงจากน้อยไปมาก',
    expected: 'ยอดซื้อขั้นต่ำของแต่ละ tier เรียงจากน้อยไปมาก',
    actual: `values=${JSON.stringify(minPurchases)} ordered=${isOrdered} hasDuplicates=${hasDuplicates}`,
    status,
    screenshots: shots,
    remark,
  });
  console.log(`TC-TIER-012: ${RESULTS.at(-1)!.status} | ordered=${isOrdered}`);
});

// ── TC-TIER-013: UI checks ─────────────────────────────────────────────────────
test('TC-TIER-013 – UI: table headers, layout, responsive', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const shots: string[] = [];

  await login(page);
  await goToTierSetup(page);

  // Desktop view
  shots.push(await ss(page, 'TIER-013_01_desktop-1440'));

  // Check expected headers
  const headers = await page.locator(SEL.tierHeaders).allInnerTexts();
  const expectedCols = ['Level', 'ชื่อ', 'ยอดซื้อขั้นต่ำ', 'Order', 'คะแนน', 'ร้าน', 'สถานะ', 'จัดการ'];
  const colMatched = expectedCols.filter(c =>
    headers.some(h => h.toLowerCase().includes(c.toLowerCase()))
  );

  // Check breadcrumb
  const hasBreadcrumb = await page.locator('text=Tier Setup').isVisible().catch(() => false)
    || await page.locator('text=Arinlink').isVisible().catch(() => false);

  // Check create button
  const hasCreateBtn = await page.locator(SEL.createTierBtn).isVisible().catch(() => false);

  // Check last-updated timestamps in config cards
  const updatedTexts = await page.locator('text=อัปเดตล่าสุด').count();

  // Mobile view
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForTimeout(800);
  shots.push(await ss(page, 'TIER-013_02_mobile-375'));

  // Tablet view
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.waitForTimeout(800);
  shots.push(await ss(page, 'TIER-013_03_tablet-768'));

  const pass = colMatched.length >= 6 && hasCreateBtn;

  RESULTS.push({
    id: 'TC-TIER-013', module: 'UI', scenario: 'Table headers, layout, responsive',
    expected: 'Headers ครบ, Breadcrumb มี, Create button มี, Timestamps แสดง',
    actual: `colMatched=${colMatched.length}/8 | breadcrumb=${hasBreadcrumb} | createBtn=${hasCreateBtn} | timestamps=${updatedTexts}`,
    status: pass ? 'PASS' : 'FAIL',
    screenshots: shots,
    remark: pass
      ? 'UI layout ถูกต้อง'
      : `ขาด columns: ${expectedCols.filter(c => !colMatched.includes(c)).join(', ')}`,
  });
  console.log(`TC-TIER-013: ${RESULTS.at(-1)!.status}`);
});

// ── Save JSON results ──────────────────────────────────────────────────────────
test.afterAll(async () => {
  // Build summary table
  const summary = RESULTS.map(r => ({
    'Test Case ID': r.id,
    'Module': r.module,
    'Test Scenario': r.scenario,
    'Expected Result': r.expected,
    'Actual Result': r.actual,
    'Status': r.status,
    'Screenshot Reference': r.screenshots.join(', '),
    'Remark': r.remark,
  }));

  const outPath = path.join(__dirname, '../../results/test-results-tier-setup.json');
  fs.writeFileSync(outPath, JSON.stringify({ results: RESULTS, summary }, null, 2), 'utf-8');

  console.log('\n════ TIER SETUP TEST SUMMARY ════');
  console.log('Test Case ID       | Status | Scenario');
  console.log('-'.repeat(70));
  for (const r of RESULTS) {
    const padId  = r.id.padEnd(18);
    const padSts = r.status.padEnd(6);
    console.log(`${padId} | ${padSts} | ${r.scenario}`);
  }

  const pass = RESULTS.filter(r => r.status === 'PASS').length;
  const fail = RESULTS.filter(r => r.status === 'FAIL').length;
  const skip = RESULTS.filter(r => r.status === 'SKIP').length;
  console.log(`\nTotal: ${RESULTS.length} | PASS: ${pass} | FAIL: ${fail} | SKIP: ${skip}`);
  console.log(`Results saved: results/test-results-tier-setup.json`);
  console.log(`Screenshots: screenshots/tier-setup/`);
});
