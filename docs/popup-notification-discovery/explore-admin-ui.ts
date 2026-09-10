/**
 * Exploratory Testing — Web-Admin UI (List + Create form controls)
 * รัน: npx tsx docs/popup-notification-discovery/explore-admin-ui.ts
 * ไม่สร้าง/ลบข้อมูลถาวร (ยกเว้นขั้นตอนที่ระบุชัดเจน) — เน้นสังเกตพฤติกรรม UI และเก็บ wording
 */
import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const ADMIN_BASE = process.env.ADMIN_BASE_URL ?? 'https://admin-stg.arincare.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const ADMIN_PASS = process.env.ADMIN_PASSWORD ?? '';
const OUT = __dirname;
const findings: string[] = [];
const note = (s: string) => { console.log('📝', s); findings.push(s); };

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  const page = await (await browser.newContext({ locale: 'th-TH' })).newPage();

  await page.goto(`${ADMIN_BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[name="email"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"], input[name="password"]').first().fill(ADMIN_PASS);
  await page.locator('button:has-text("เข้าสู่ระบบ")').first().click();
  await page.waitForLoadState('networkidle').catch(() => {});

  // ══════════════════════ LIST PAGE ══════════════════════
  await page.goto(`${ADMIN_BASE}/popup-notifications`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  console.log('\n=== LIST PAGE: ค้นหาด้วยคำที่ไม่มีอยู่จริง ===');
  await page.getByPlaceholder('ค้นหาชื่อหรือรหัส...').fill('ZZZ_NOT_EXIST_XYZ');
  await page.getByRole('button', { name: 'ค้นหา' }).click();
  await page.waitForTimeout(1200);
  const emptyText = await page.locator('body').innerText();
  const hasEmptyMsg = emptyText.includes('ไม่พบ');
  note(`ค้นหาไม่พบ → แสดงข้อความ "ไม่พบ..." หรือไม่: ${hasEmptyMsg}`);
  await page.screenshot({ path: path.join(OUT, 'explore-01-search-empty.png'), fullPage: true });

  console.log('\n=== LIST PAGE: ล้างตัวกรอง ===');
  await page.getByRole('button', { name: 'ล้างตัวกรอง' }).click();
  await page.waitForTimeout(1000);
  const searchBoxVal = await page.getByPlaceholder('ค้นหาชื่อหรือรหัส...').inputValue();
  note(`หลังกด "ล้างตัวกรอง" ช่องค้นหาว่างหรือไม่: ${searchBoxVal === ''} (ค่าจริง: "${searchBoxVal}")`);

  console.log('\n=== LIST PAGE: กรองสถานะ = Active ===');
  const statusFilter = page.locator('select').filter({ has: page.locator('option', { hasText: 'Active (เปิดใช้งาน)' }) }).first();
  await statusFilter.selectOption('active');
  await page.getByRole('button', { name: 'ค้นหา' }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, 'explore-02-filter-active.png'), fullPage: true });
  await page.getByRole('button', { name: 'ล้างตัวกรอง' }).click();
  await page.waitForTimeout(1000);

  console.log('\n=== LIST PAGE: กรองแพลตฟอร์ม ===');
  const platformFilter = page.locator('select').filter({ has: page.locator('option', { hasText: 'POS-v2 (หน้าร้าน)' }) }).first();
  const platformOpts = await platformFilter.locator('option').allTextContents();
  note(`ตัวเลือก filter แพลตฟอร์มบนหน้า List: ${JSON.stringify(platformOpts)}`);

  // ══════════════════════ CREATE FORM — WYSIWYG / templates ══════════════════════
  await page.goto(`${ADMIN_BASE}/popup-notifications/create`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  console.log('\n=== CREATE FORM: ทดสอบปุ่ม Quick Template ทั้ง 4 แบบ ===');
  const templates = ['โปรโมชั่นสินค้า + แบนเนอร์', 'ประกาศแจ้งปิดปรับปรุงระบบ', 'แนะนำฟีเจอร์ใหม่', 'ข่าวประชาสัมพันธ์ทั่วไป'];
  for (const t of templates) {
    await page.getByRole('button', { name: t }).click();
    await page.waitForTimeout(600);
    const bodyText = await page.locator('.custom-wysiwyg, [contenteditable="true"]').first().innerText().catch(() => '(หา editor ไม่เจอ)');
    note(`Template "${t}" → เนื้อหาที่ใส่ให้: "${bodyText.slice(0, 80).replace(/\n/g, ' ')}"`);
  }
  await page.screenshot({ path: path.join(OUT, 'explore-03-last-template.png'), fullPage: true });

  console.log('\n=== CREATE FORM: Raw HTML toggle ไป-กลับ เนื้อหาหายไหม ===');
  const editorBefore = await page.locator('.custom-wysiwyg, [contenteditable="true"]').first().innerHTML().catch(() => '');
  await page.getByRole('button', { name: 'สลับไปโหมดเขียนโค้ด Raw HTML' }).click();
  await page.waitForTimeout(500);
  const rawHtmlValue = await page.locator('textarea').first().inputValue();
  note(`Raw HTML แสดง HTML จริงตรงกับ WYSIWYG หรือไม่ (เทียบยาว): editor=${editorBefore.length} chars, raw=${rawHtmlValue.length} chars`);
  // สลับกลับ (ถ้ามีปุ่มสลับกลับ)
  const backToggle = page.getByRole('button', { name: /กลับไปโหมด|WYSIWYG|โหมดปกติ/ });
  const hasBackToggle = await backToggle.count();
  note(`มีปุ่มสลับกลับจาก Raw HTML ไป WYSIWYG หรือไม่: ${hasBackToggle > 0 ? 'มี' : 'ไม่มี (ปุ่มเดิมอาจกลายเป็น toggle 2 ทาง)'}`);
  if (hasBackToggle === 0) {
    // ลองกดปุ่มเดิมซ้ำ (สมมติเป็น toggle)
    const sameBtn = page.getByRole('button', { name: 'สลับไปโหมดเขียนโค้ด Raw HTML' });
    if (await sameBtn.count() > 0) {
      await sameBtn.click();
      await page.waitForTimeout(500);
      const editorAfter = await page.locator('.custom-wysiwyg, [contenteditable="true"]').first().innerHTML().catch(() => '(ไม่เจอ editor แล้ว!)');
      note(`หลังกดปุ่มเดิมซ้ำเพื่อกลับ WYSIWYG: editor กลับมาไหม (length=${editorAfter.length}), เนื้อหาตรงกับก่อนสลับหรือไม่: ${editorAfter === editorBefore}`);
    }
  }
  await page.screenshot({ path: path.join(OUT, 'explore-04-raw-html-roundtrip.png'), fullPage: true });

  console.log('\n=== CREATE FORM: ทดสอบ Scope search — เพิ่ม/ลบร้านค้า ===');
  await page.locator('input[type="radio"]').nth(1).click(); // scope = specific
  await page.waitForTimeout(500);
  const search = page.getByPlaceholder('พิมพ์ชื่อร้าน หรือรหัสสาขา ARC... เพื่อค้นหา');
  await search.fill('Arincare');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT, 'explore-05-scope-search-results.png'), fullPage: true });
  const dropdownItems = await page.locator('.dropdown-menu li, .autocomplete-results div, [role="listbox"] *').count();
  note(`พิมพ์ "Arincare" ใน scope search → เจอ dropdown ผลลัพธ์กี่รายการ (นับ element): ${dropdownItems}`);
  const firstResult = page.locator('.dropdown-menu, .autocomplete-results, [role="listbox"]').locator('li, a, div').first();
  if (await firstResult.isVisible({ timeout: 3000 }).catch(() => false)) {
    await firstResult.click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT, 'explore-06-scope-added.png'), fullPage: true });
    // หาปุ่มลบรายการที่เพิ่ม
    const removeChip = page.locator('.btn-del-scope, [class*="remove"], button:has-text("×")').last();
    const removeCount = await removeChip.count();
    note(`หลังเพิ่มร้านค้าเข้า scope แล้ว มีปุ่มลบรายการที่เพิ่ม (chip ×) ให้กดหรือไม่: ${removeCount > 0}`);
    if (removeCount > 0) {
      await removeChip.click().catch(() => {});
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(OUT, 'explore-07-scope-removed.png'), fullPage: true });
    }
  } else {
    note('พิมพ์ "Arincare" ใน scope search แล้วไม่มี dropdown ผลลัพธ์ขึ้นมาเลย ⚠️ (อาจเป็นบั๊ก หรือ debounce ช้ากว่าที่รอ)');
  }

  console.log('\n=== CREATE FORM: ปุ่ม "เพิ่มปุ่ม Action" — เพิ่มได้กี่ปุ่ม / มี limit ไหม ===');
  await page.locator('input[type="radio"]').nth(0).click(); // กลับ scope=global กันพลาด
  const addBtnAction = page.getByRole('button', { name: 'เพิ่มปุ่ม Action' });
  for (let i = 0; i < 6; i++) {
    await addBtnAction.click().catch(() => {});
    await page.waitForTimeout(300);
  }
  const buttonBlocks = await page.locator('text=/ปุ่ม #\\d/').count();
  note(`กด "เพิ่มปุ่ม Action" รัว 6 ครั้ง (เริ่มจาก 1 ปุ่ม) → ตอนนี้มีกี่ปุ่ม: ${buttonBlocks} (ถ้า =7 แปลว่าไม่มี limit)`);
  await page.screenshot({ path: path.join(OUT, 'explore-08-many-buttons.png'), fullPage: true });

  console.log('\n=== CREATE FORM: ลบปุ่มทั้งหมด (×) เหลือ 0 ปุ่ม แล้วลองสร้าง ===');
  const removeButtons = page.locator('button:has-text("×")');
  let removeCount2 = await removeButtons.count();
  note(`มีปุ่มลบ (×) ทั้งหมด ${removeCount2} ปุ่มก่อนเริ่มลบ`);
  while ((await removeButtons.count()) > 0) {
    await removeButtons.first().click().catch(() => {});
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(500);
  const buttonBlocksAfter = await page.locator('text=/ปุ่ม #\\d/').count();
  note(`หลังกดลบปุ่มทั้งหมด → เหลือ ${buttonBlocksAfter} ปุ่ม (0 = ระบบยอมให้ Popup ไม่มีปุ่มเลย)`);
  await page.screenshot({ path: path.join(OUT, 'explore-09-zero-buttons.png'), fullPage: true });

  fs.writeFileSync(path.join(OUT, 'explore-admin-ui-findings.json'), JSON.stringify(findings, null, 2), 'utf-8');
  console.log('\n✅ DONE — findings saved to explore-admin-ui-findings.json');
  await browser.close();
})();
