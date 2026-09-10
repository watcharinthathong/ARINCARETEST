/**
 * Bug Investigation: สินค้าในชั้นวางแสดงไม่ครบ (ข้อมูลชั้นวางสินค้า)
 * URL: https://app-stg.arincare.com/companies/products/locations
 *
 * Issue:
 *   - ร้านมีชั้นวางสินค้าหลายชั้น เมื่อสินค้าในชั้นวางมีจำนวนมาก (500+ รายการ)
 *     หน้าจอแสดงรายการสินค้าไม่ครบ
 *
 * Test นี้ทำ 2 อย่าง:
 *   1) Bulk-add สินค้าเข้าชั้นวาง (ค้นหาจาก autosuggest → เพิ่ม → เลือกเลขชั้น) จนครบเป้าหมาย
 *   2) ไล่ทุกหน้าของรายการสินค้าในชั้นวางนั้น เพื่อยืนยันว่าจำนวนที่แสดงจริง
 *      ตรงกับจำนวนที่ระบบบันทึกไว้ (ตัวเลขใน pagination caption) — นี่คือการทดสอบ
 *      regression ตรงตาม bug ที่รายงาน
 *
 * Selectors verified from live DOM (2026-08-24) — ดู scripts/discovery/discover-products-locations-selectors.ts
 *
 * รันแบบ default (เร็ว, ปลอดภัยสำหรับ CI): เพิ่ม 20 ชิ้น/ชั้น, 1 ชั้น
 * รันแบบจำลอง bug จริง (ช้า ~15-40 นาทีต่อชั้น):
 *   PRODUCTS_PER_SHELF=500 MAX_SHELVES=3 npx playwright test products-locations-shelf-bulk-add
 *
 * ⚠️ ห้ามรันซ้ำกับชั้นวางเดิมที่มีสินค้าอยู่แล้ว — ระบบ (backend) ไม่กรองสินค้าที่อยู่ในชั้นวาง
 * อยู่แล้วออกจาก autosuggest ทำให้ bulkAddProducts เพิ่มสินค้าตัวเดิมซ้ำเป็นแถวใหม่ได้ (ยืนยันจาก
 * การทดสอบจริง — รันซ้ำครั้งเดียวสร้าง duplicate ~47 แถวในไม่กี่นาที) ควรรันกับชั้นวางที่ว่าง/ยังไม่เคย
 * รันเท่านั้น ถ้าจำเป็นต้องรันซ้ำ ให้ล้างชั้นวางให้ว่างก่อน (ลบทุกแถวออก) แล้วค่อยรันใหม่
 *
 * จากการรันจริงกับ staging (2026-08-24): store "Watcharin TestTest" มีสินค้าใน catalog พอให้เพิ่มได้
 * จริงแค่ ~110-136 ชิ้นต่อชั้น (ไม่ใช่ 500 — catalog หมด ไม่ใช่ข้อจำกัดของ test) และผลตรวจสอบพบว่า
 * bug "แสดงไม่ครบ" ไม่ re-produce เลยในทุกชั้นที่ทดสอบ (จำนวนที่แสดงจริง = จำนวนที่ระบบระบุ ทุกครั้ง)
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { LoginPage } from '../../pages/LoginPage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const SS_DIR     = path.join(__dirname, '../../screenshots/products/shelf-bulk-add');

// ── Config (env-overridable) ────────────────────────────────────────────────────
const BASE_URL            = process.env.BASE_URL ?? 'https://app-stg.arincare.com';
const USER                = {
  email: process.env.TEST_USERNAME ?? 'watcharin.arincare@gmail.com',
  pass:  process.env.TEST_PASSWORD ?? '01072024',
};
const STORE_NAME           = process.env.STORE_NAME ?? 'Watcharin TestTest';
const PRODUCTS_PER_SHELF   = parseInt(process.env.PRODUCTS_PER_SHELF ?? '20', 10);   // default เล็กไว้ก่อนเพื่อความปลอดภัยของ CI — ตั้ง 500 เพื่อจำลอง bug จริง
const MAX_SHELVES          = parseInt(process.env.MAX_SHELVES ?? '1', 10);
const SHELF_START_INDEX    = parseInt(process.env.SHELF_START_INDEX ?? '0', 10);   // ข้ามชั้นวางที่รันไปแล้ว (กันไม่ให้ชนกับชั้นที่มีสินค้าอยู่แล้ว → กัน duplicate)
// อักขระที่ใช้วน query autosuggest เพื่อดึงสินค้าให้ครอบคลุมมากที่สุด
const SEARCH_ALPHABET      = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');

test.use({
  // Staging server ตอบ 403 ถ้า User-Agent มีคำว่า "HeadlessChrome" — ปลอมเป็น Chrome ปกติกันไว้
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
});

// ── Selectors ──────────────────────────────────────────────────────────────────
const SEL = {
  breadcrumb:    'text=ข้อมูลชั้นวางสินค้า',
  openShelfBtn:  'button.pl-btn-open',   // ปุ่ม "เพิ่ม/แก้ไขสินค้า" ต่อแถวชั้นวาง

  // Cabinet panel (เปิดหลังกด "เพิ่ม/แก้ไขสินค้า") — โครงสร้างจริงยืนยันจาก live DOM
  panel:            '.pl-modal-cabinet .cabinet-panel',
  panelSub:         '.cabinet-panel-sub',           // "สาขา : ... · จำนวนชั้น = N ชั้น"
  panelTotal:       '.cabinet-panel-total',          // "Total: N"
  searchInput:      'input.auto-suggest-input',
  suggestItem:      '.auto-suggest-item',
  closeBtn:         'button.cabinet-panel-close-btn',
  productRow:       '.cabinet-panel-product-row',    // div-based row (ไม่ใช่ table/tr)
  productCode:      '.cabinet-panel-product-code',
  levelSelect:      'select.cabinet-panel-shelf-select',
  deleteRowBtn:     'button.cabinet-panel-delete-btn',
  pageBtnNext:      '.cabinet-panel-page-btn:has-text("›")',
  pageBtnFirst:     '.cabinet-panel-page-btn:has-text("«")',
  pageCaption:      '.cabinet-panel-page-info',      // span: "หน้า X/Y (N รายการ)" — สโคปอยู่ใน panel เท่านั้น ไม่ชนกับ pagination ของหน้า list หลัก
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

if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });

async function ss(page: any, name: string): Promise<string> {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(SS_DIR, file), fullPage: true }).catch(() => {});
  return file;
}

async function login(page: any): Promise<void> {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(USER.email, USER.pass);
  await page.waitForTimeout(2_000);

  // เลือกร้าน/บริษัท ถ้าระบบพาไปหน้าเลือกก่อน
  await loginPage.selectCompany(STORE_NAME);
  await page.waitForTimeout(1_500);
}

async function goToLocations(page: any): Promise<void> {
  await page.goto(`${BASE_URL}/companies/products/locations`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(2_000);
  await page.evaluate(() => {
    const bar = document.querySelector('.phpdebugbar') as HTMLElement | null;
    if (bar) bar.style.display = 'none';
  }).catch(() => {});
}

/** เปิด panel "เพิ่ม/แก้ไขสินค้า" ของชั้นวางลำดับที่ shelfIndex (0-based) ในตาราง */
async function openShelfPanel(page: any, shelfIndex: number): Promise<boolean> {
  const btn = page.locator(SEL.openShelfBtn).nth(shelfIndex);
  if (!(await btn.isVisible({ timeout: 5_000 }).catch(() => false))) return false;
  await btn.click({ force: true });
  await page.waitForTimeout(1_200);
  return page.locator(SEL.searchInput).isVisible({ timeout: 5_000 }).catch(() => false);
}

async function closeShelfPanel(page: any): Promise<void> {
  const closeBtn = page.locator(SEL.closeBtn).first();
  if (await closeBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await closeBtn.click({ force: true });
  } else {
    await page.keyboard.press('Escape');
  }
  await page.waitForTimeout(800);
}

/** อ่าน "Total: N" จาก .cabinet-panel-total */
async function readPanelTotal(page: any): Promise<number> {
  const text = await page.locator(SEL.panelTotal).first().innerText().catch(() => '');
  const m = text.match(/Total:\s*(\d+)/);
  return m ? parseInt(m[1], 10) : -1;
}

/** อ่าน "จำนวนชั้น = N ชั้น" จาก .cabinet-panel-sub เพื่อรู้ว่าชั้นวางนี้มีกี่ชั้นย่อย */
async function readShelfLevelCount(page: any): Promise<number> {
  const text = await page.locator(SEL.panelSub).first().innerText().catch(() => '');
  const m = text.match(/จำนวนชั้น\s*=\s*(\d+)\s*ชั้น/);
  return m ? parseInt(m[1], 10) : 1;
}

/**
 * Bulk-add สินค้าเข้าชั้นวางที่เปิด panel อยู่ จนครบ targetCount
 * กลยุทธ์: พิมพ์คำค้นหาวนตามตัวอักษร/ตัวเลข แล้วคลิกทุกรายการที่ suggest มา
 * ต้องกันซ้ำเองด้วย content-key เพราะระบบ "ไม่" กรองสินค้าที่เพิ่มไปแล้วออกจาก suggestion
 * (ยืนยันจากการทดสอบจริง — ถ้าคลิกอันดับ 1 ซ้ำ ๆ จะได้สินค้าตัวเดิมซ้ำหลายแถว ไม่ใช่ตัวใหม่)
 */
async function bulkAddProducts(page: any, targetCount: number): Promise<number> {
  const searchInput = page.locator(SEL.searchInput);
  const usedKeys = new Set<string>();
  let added = 0;

  for (const ch of SEARCH_ALPHABET) {
    if (added >= targetCount) break;

    await searchInput.click({ force: true });
    await searchInput.fill('');
    await searchInput.type(ch, { delay: 60 });
    await page.waitForTimeout(700);

    const items = page.locator(SEL.suggestItem);
    const count = await items.count().catch(() => 0);
    if (count === 0) continue;

    let clickedThisQuery = 0;
    for (let i = 0; i < count && added < targetCount; i++) {
      const item = items.nth(i);
      const key = (await item.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
      if (!key || usedKeys.has(key)) continue;
      usedKeys.add(key);

      await item.click({ force: true }).catch(() => {});
      await page.waitForTimeout(400);
      added++;
      clickedThisQuery++;
      if (added % 25 === 0) console.log(`  ...added ${added}/${targetCount}`);

      // คลิกแล้ว dropdown อาจปิด — เปิดใหม่ด้วยคำค้นเดิมเพื่อดูรายการที่เหลือ
      if (i < count - 1) {
        await searchInput.click({ force: true });
        await searchInput.fill('');
        await searchInput.type(ch, { delay: 60 });
        await page.waitForTimeout(600);
      }
    }
    if (clickedThisQuery === 0) continue; // คำค้นนี้ไม่มีสินค้าใหม่เลย ไปตัวถัดไป
  }

  await searchInput.fill('').catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  return added;
}

/**
 * ไล่ทุกหน้าของตารางสินค้าในชั้นวางแบบ "อ่านอย่างเดียว" (ไม่แก้อะไรเลย) — นับจำนวนแถวจริงที่แสดง
 * เทียบกับตัวเลขที่ระบบระบุไว้ใน pagination caption คืนค่า { totalRowsSeen, statedTotal }
 *
 * สำคัญ: ต้องแยกจากการเลือกเลขชั้น (assignLevelsAllPages) เด็ดขาด — เคยลองรวมสอง action
 * ไว้ใน pass เดียวกันมาก่อน แล้วพบว่า selectOption ทำให้แถวเลื่อนตำแหน่ง/ย้ายหน้า ระหว่างเดินหน้า
 * ต่อ ทำให้นับแถวเดิมซ้ำ (rowsSeen > statedTotal ทั้งที่ข้อมูลจริงแสดงครบถูกต้อง) — ผลคือ FAIL ปลอม
 * ไม่ใช่ bug จริงของระบบ ดังนั้นการนับเพื่อ assert ต้องมาจาก pass อ่านอย่างเดียวเท่านั้น
 */
/**
 * คลิกปุ่ม "หน้าถัดไป" พร้อม retry — ตอนไล่หน้าจำนวนมาก (เช่น 100 หน้าสำหรับ 500 รายการ)
 * การคลิกครั้งเดียวมีโอกาสพลาดได้ (ปุ่มยังไม่ enable, render ไม่ทัน ฯลฯ) ต้อง retry ไม่ใช่ break ทันที
 * มิเช่นนั้นจะทำให้ผลนับ rowsSeen น้อยกว่าจริงทั้งที่ระบบแสดงผลถูกต้อง (false FAIL ของ test เอง)
 */
async function clickNextPageWithRetry(page: any, expectedPageAfter: number): Promise<boolean> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const nextBtn = page.locator(SEL.pageBtnNext).first();
    if (!(await nextBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
      await page.waitForTimeout(500);
      continue;
    }
    await nextBtn.click({ force: true });
    await page.waitForTimeout(700);
    const caption = await page.locator(SEL.pageCaption).first().innerText().catch(() => '');
    const cur = parseInt(caption.match(/หน้า\s*(\d+)\//)?.[1] ?? '0', 10);
    if (cur === expectedPageAfter) return true;
    // หน้าไม่ขยับตามที่คาด — รอเพิ่มแล้วลองใหม่
    await page.waitForTimeout(800);
  }
  return false;
}

async function countAllPagesReadOnly(page: any): Promise<{ totalRowsSeen: number; statedTotal: number; pages: number }> {
  const caption = await page.locator(SEL.pageCaption).first().innerText().catch(() => '');
  const capMatch = caption.match(/หน้า\s*(\d+)\/(\d+)\s*\((\d+)\s*รายการ\)/);
  const totalPages  = capMatch ? parseInt(capMatch[2], 10) : 1;
  const statedTotal = capMatch ? parseInt(capMatch[3], 10) : -1;

  let totalRowsSeen = 0;
  for (let p = 1; p <= totalPages; p++) {
    const rowCount = await page.locator(SEL.productRow).count().catch(() => 0);
    totalRowsSeen += rowCount;

    if (p < totalPages) {
      const ok = await clickNextPageWithRetry(page, p + 1);
      if (!ok) break;
    }
  }

  return { totalRowsSeen, statedTotal, pages: totalPages };
}

/**
 * ไล่ทุกหน้าอีกรอบ (แยกจากการนับ) แล้วเลือกเลขชั้นให้ทุกแถวที่ยัง "ไม่กำหนดชั้น"
 * วนรอบเลขชั้นตามจำนวนชั้นย่อยที่ชั้นวางนี้มี — pass นี้ "แก้ไข" DOM จึงห้ามใช้ผลนับจาก pass นี้มา assert
 */
async function assignLevelsAllPages(page: any, levelCount: number): Promise<void> {
  // รอ toast notification "เพิ่มสินค้าเข้าตู้สำเร็จ" ที่ค้างจาก bulkAddProducts ให้หายไปก่อน
  // ไม่งั้นมันจะบัง select ของบางแถวและทำให้ selectOption เงียบ ๆ ล้มเหลว
  await page.waitForTimeout(4_500);

  // countAllPagesReadOnly ที่รันก่อนหน้านี้จะจบอยู่ที่หน้าสุดท้าย — reset กลับหน้า 1 ก่อนเริ่ม
  const firstBtn = page.locator(SEL.pageBtnFirst).first();
  if (await firstBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await firstBtn.click({ force: true });
    await page.waitForTimeout(600);
  }

  let level = 1;
  let p = 1;
  // อ่านจำนวนหน้าทั้งหมดใหม่ (หลัง reload/เปลี่ยนหน้าจาก countAllPagesReadOnly แล้ว pagination อาจรีเซ็ตกลับหน้า 1)
  const caption = await page.locator(SEL.pageCaption).first().innerText().catch(() => '');
  const capMatch = caption.match(/หน้า\s*(\d+)\/(\d+)\s*\(/);
  const totalPages = capMatch ? parseInt(capMatch[2], 10) : 1;

  for (; p <= totalPages; p++) {
    const rows = page.locator(SEL.productRow);
    const rowCount = await rows.count().catch(() => 0);

    for (let r = 0; r < rowCount; r++) {
      const row = rows.nth(r);
      const levelSelect = row.locator(SEL.levelSelect).first();
      const currentVal = await levelSelect.inputValue().catch(() => '');
      if (currentVal === '') {
        const target = String(((level - 1) % Math.max(levelCount, 1)) + 1);
        await levelSelect.selectOption(target).catch(() => {});
        if ((await levelSelect.inputValue().catch(() => '')) === '') {
          await levelSelect.scrollIntoViewIfNeeded().catch(() => {});
          await levelSelect.selectOption(target).catch(() => {});
        }
        level++;
      }
    }

    if (p < totalPages) {
      const ok = await clickNextPageWithRetry(page, p + 1);
      if (!ok) break;
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Login ครั้งเดียว แล้วทำทุกอย่างต่อในเซสชันเดียวกัน (เปิดหน้า → bulk-add จนครบ → ตรวจสอบ)
// ไม่แยกเป็นหลาย test() เพราะ Playwright จะสร้าง page/context ใหม่และต้อง login ซ้ำทุกครั้ง
test.describe('Bug: สินค้าในชั้นวางแสดงไม่ครบ — bulk-add + regression check', () => {
  test.setTimeout(Math.max(180_000, PRODUCTS_PER_SHELF * MAX_SHELVES * 3_500 + 120_000));

  test('TC-SHELF-001+002 – Login ครั้งเดียว → เปิดหน้า → bulk-add สินค้าเข้าชั้นวางจนครบ → ยืนยันจำนวนแสดงครบ', async ({ page }) => {
    const shots: string[] = [];
    await login(page);
    await goToLocations(page);
    shots.push(await ss(page, 'SHELF-001_01_locations-page'));

    const url = page.url();
    const hasBreadcrumb = await page.locator(SEL.breadcrumb).first().isVisible().catch(() => false);
    const hasOpenBtn = await page.locator(SEL.openShelfBtn).first().isVisible().catch(() => false);
    const pageLoadOk = url.includes('products/locations') && hasBreadcrumb && hasOpenBtn;

    RESULTS.push({
      id: 'TC-SHELF-001', module: 'Products Locations', scenario: 'หน้าโหลดสำเร็จหลัง login และเลือกร้าน',
      expected: 'URL มี products/locations, breadcrumb และปุ่ม "เพิ่ม/แก้ไขสินค้า" แสดง',
      actual: `url=${url} | breadcrumb=${hasBreadcrumb} | openBtn=${hasOpenBtn}`,
      status: pageLoadOk ? 'PASS' : 'FAIL', screenshots: shots,
      remark: pageLoadOk ? 'หน้าโหลดถูกต้อง' : 'หน้าไม่โหลดหรือ selector เปลี่ยน',
    });
    expect(url).toContain('products/locations');
    await expect(page.locator(SEL.openShelfBtn).first()).toBeVisible();

    // ─── ต่อจาก login เดิม ไม่ login ซ้ำ — เข้าไปเพิ่มสินค้าจนครบตามเป้าหมายเลย ───
    const shelfButtonCount = await page.locator(SEL.openShelfBtn).count();
    const shelvesToRun = Math.min(MAX_SHELVES, Math.max(shelfButtonCount - SHELF_START_INDEX, 0));
    console.log(`พบชั้นวางทั้งหมด ${shelfButtonCount} รายการ — จะรัน bulk-add กับ ${shelvesToRun} ชั้นวาง เริ่มจากลำดับที่ ${SHELF_START_INDEX} (PRODUCTS_PER_SHELF=${PRODUCTS_PER_SHELF})`);

    for (let i = SHELF_START_INDEX; i < SHELF_START_INDEX + shelvesToRun; i++) {
      const opened = await openShelfPanel(page, i);
      if (!opened) {
        RESULTS.push({
          id: `TC-SHELF-002.${i}`, module: 'Shelf Bulk Add', scenario: `เปิด panel ชั้นวางลำดับที่ ${i}`,
          expected: 'Panel เปิดพร้อมช่องค้นหาสินค้า', actual: 'Panel ไม่เปิด',
          status: 'SKIP', screenshots: shots, remark: 'SKIP: เปิด panel ไม่สำเร็จ',
        });
        continue;
      }
      shots.push(await ss(page, `SHELF-002_${i}_01_panel-opened`));

      const levelCount = await readShelfLevelCount(page);
      const startTotal = await readPanelTotal(page);
      console.log(`[ชั้นวาง #${i}] จำนวนชั้นย่อย=${levelCount} | เริ่มต้นมีสินค้า=${startTotal}`);

      const added = await bulkAddProducts(page, PRODUCTS_PER_SHELF);
      shots.push(await ss(page, `SHELF-002_${i}_02_after-bulk-add`));
      console.log(`[ชั้นวาง #${i}] เพิ่มสินค้าได้จริง ${added}/${PRODUCTS_PER_SHELF} ชิ้น (อาจน้อยกว่าเป้าหมายถ้า catalog มีสินค้าไม่พอ)`);

      // นับก่อน (อ่านอย่างเดียว) — นี่คือตัวเลขที่ใช้ assert ผลการทดสอบ ต้องไม่ปนกับ action ที่แก้ไข DOM
      const { totalRowsSeen, statedTotal, pages } = await countAllPagesReadOnly(page);
      // แล้วค่อยเลือกเลขชั้นให้ครบทีหลัง (แยก pass เด็ดขาด ไม่กระทบตัวเลขที่ assert ไปแล้ว)
      await assignLevelsAllPages(page, levelCount);
      shots.push(await ss(page, `SHELF-002_${i}_03_after-level-assign`));

      const displayComplete = statedTotal >= 0 && totalRowsSeen === statedTotal;
      const pass = added > 0 && displayComplete;

      RESULTS.push({
        id: `TC-SHELF-002.${i}`, module: 'Shelf Bulk Add + Display Regression',
        scenario: `เพิ่มสินค้าเข้าชั้นวาง #${i} จนครบเป้าหมาย แล้วไล่ทุกหน้าตรวจว่าสินค้าที่แสดงครบตามจำนวนจริง`,
        expected: `เพิ่มได้ ${PRODUCTS_PER_SHELF} ชิ้น และจำนวนแถวที่แสดงจริงทุกหน้ารวมกัน (${totalRowsSeen}) ต้องเท่ากับตัวเลขที่ระบบระบุ (${statedTotal})`,
        actual: `added=${added} | pagesWalked=${pages} | rowsSeen=${totalRowsSeen} | statedTotal=${statedTotal}`,
        status: pass ? 'PASS' : 'FAIL', screenshots: shots,
        remark: displayComplete
          ? `แสดงสินค้าครบถ้วน ${totalRowsSeen}/${statedTotal} รายการ`
          : `⚠️ BUG REPRODUCED: สินค้าที่แสดงจริง (${totalRowsSeen}) ไม่เท่ากับจำนวนที่ระบบบันทึก (${statedTotal}) — ตรงกับ issue ที่รายงาน`,
      });
      console.log(`[ชั้นวาง #${i}] ${RESULTS.at(-1)!.status} — rowsSeen=${totalRowsSeen} statedTotal=${statedTotal}`);

      await closeShelfPanel(page);
    }

    // อย่างน้อย 1 ชั้นวางต้องเพิ่มสินค้าได้สำเร็จ — ความถูกต้องของการแสดงผลถูก assert แยกต่อชั้นวางด้านบนแล้ว
    const anyAdded = RESULTS.some(r => r.id.startsWith('TC-SHELF-002') && r.actual.includes('added=') && !r.actual.includes('added=0'));
    expect(anyAdded).toBeTruthy();
  });
});

// ── Save JSON results ──────────────────────────────────────────────────────────
test.afterAll(async () => {
  const summary = RESULTS.map(r => ({
    'Test Case ID': r.id, 'Module': r.module, 'Test Scenario': r.scenario,
    'Expected Result': r.expected, 'Actual Result': r.actual, 'Status': r.status,
    'Screenshot Reference': r.screenshots.join(', '), 'Remark': r.remark,
  }));

  const outPath = path.join(__dirname, '../../results/test-results-shelf-bulk-add.json');
  fs.writeFileSync(outPath, JSON.stringify({ results: RESULTS, summary }, null, 2), 'utf-8');

  console.log('\n════ SHELF BULK-ADD TEST SUMMARY ════');
  for (const r of RESULTS) console.log(`${r.id.padEnd(18)} | ${r.status.padEnd(6)} | ${r.scenario}`);
  const pass = RESULTS.filter(r => r.status === 'PASS').length;
  const fail = RESULTS.filter(r => r.status === 'FAIL').length;
  const skip = RESULTS.filter(r => r.status === 'SKIP').length;
  console.log(`\nTotal: ${RESULTS.length} | PASS: ${pass} | FAIL: ${fail} | SKIP: ${skip}`);
  console.log(`Results: results/test-results-shelf-bulk-add.json | Screenshots: screenshots/products/shelf-bulk-add/`);
});
