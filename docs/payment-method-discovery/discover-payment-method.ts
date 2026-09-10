/**
 * discover-payment-method.ts
 *
 * Exploratory discovery script สำหรับฟีเจอร์ "เพิ่มวิธีการชำระเงินแบบกำหนดเอง" บน POS
 * Flow: Login POS → เพิ่มสินค้าลงตะกร้า → ชำระเงิน → เพิ่มวิธีชำระเงินใหม่ (+) → เลือกใช้ → กรอกหมายเหตุ → complete sale
 *
 * หมายเหตุ: POS session ใช้ sessionStorage (ไม่ persist ผ่าน Playwright storageState) → ต้องรันทั้ง flow
 * ใน browser session เดียวกันรวดเดียว ควบคุมด้วย MAX_STAGE ว่าจะหยุดตรงไหน (สำหรับ debug ทีละส่วน)
 *
 * รันด้วย: npx tsx docs/payment-method-discovery/discover-payment-method.ts [maxStage]
 * maxStage: 1=login, 2=+cart, 3=+checkout summary, 4=+add payment method, 5=+select&remark, 6=complete sale (default=99=all)
 */

import { chromium, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { PosRegisterPage } from '../../pages/PosRegisterPage.ts';

const POS_URL = 'https://pos-stg.arincare.com';
const COMPANY = 'Watcharin TestTest';
const BRANCH = 'สำนักงานใหญ่';
const PRODUCT_SEARCH_TERM = "BILAXTEN 20 MG TABLETS 10'S";
const NEW_PAYMENT_METHOD_NAME = `QA${Date.now().toString().slice(-8)}`; // <=15 ตัวอักษร ไม่ซ้ำ
const REMARK_TEXT = `QA-TEST-หมายเหตุ-${Date.now()}`;
const SHOT_DIR = path.resolve('screenshots/payment-method-retest');
const IMAGE_PATH = path.resolve(process.env.HOME || '', 'Downloads/010011598.jpg');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

fs.mkdirSync(SHOT_DIR, { recursive: true });

let shotCounter = 0;
async function shot(page: Page, name: string) {
  const fname = `${String(++shotCounter).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(SHOT_DIR, fname), fullPage: true });
  console.log(`  📸 ${fname}`);
  return fname;
}

async function dumpInteractives(page: Page, label: string) {
  const items = await page.evaluate(() => {
    const result: any[] = [];
    document.querySelectorAll('input, textarea, select, button, a, [role="button"]').forEach((el) => {
      const e = el as HTMLElement;
      const style = window.getComputedStyle(e);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      const rect = e.getBoundingClientRect();
      result.push({
        tag: e.tagName.toLowerCase(),
        type: (e as HTMLInputElement).type ?? '',
        id: e.id ?? '',
        name: (e as HTMLInputElement).name ?? '',
        placeholder: (e as HTMLInputElement).placeholder ?? '',
        text: e.textContent?.trim().slice(0, 60) ?? '',
        ariaLabel: e.getAttribute('aria-label') ?? '',
        dataTestId: e.getAttribute('data-testid') ?? '',
        classes: e.className?.toString().slice(0, 120) ?? '',
        visible: rect.width > 0 && rect.height > 0,
      });
    });
    return result;
  });
  const outFile = path.join('docs/payment-method-discovery', `dom-${label}.json`);
  fs.writeFileSync(outFile, JSON.stringify(items, null, 2));
  console.log(`  📝 dumped ${items.length} interactive elements -> ${outFile}`);
}

async function main() {
  const maxStage = parseInt(process.argv[2] || '99', 10);
  console.log(`=== discover-payment-method.ts | maxStage=${maxStage} ===`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    userAgent: UA,
  });
  const page = await context.newPage();
  const pos = new PosRegisterPage(page);

  try {
    // ── STAGE 1: Login ──────────────────────────────────────────────────────
    console.log('--- STAGE 1: Login to POS ---');
    await pos.goto();
    await pos.loginToPos({ company: COMPANY, branch: BRANCH });
    await page.waitForTimeout(1500);
    await shot(page, 'pos-main-after-login');
    if (maxStage <= 1) return;

    // ── STAGE 2: Search product + add to cart ───────────────────────────────
    // Flow จริง (ยืนยันจาก live DOM): พิมพ์ชื่อสินค้าในช่องค้นหา -> กด Enter ->
    // เปิด modal "ผลการค้นหา: <term>" พร้อมตาราง รหัสอ้างอิง/ชื่อ + ปุ่ม "ลงตะกร้า" สีเขียวต่อแถว
    console.log('--- STAGE 2: Search product + add to cart ---');
    const searchInput = page.locator('[placeholder="ค้นหาสินค้า (ctrl + Q)"]').first();
    await searchInput.click();
    await searchInput.type(PRODUCT_SEARCH_TERM, { delay: 80 });
    await page.waitForTimeout(800);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    await shot(page, 'product-search-modal');
    await dumpInteractives(page, 'product-search-modal');

    // ขั้น 1: คลิก "ลงตะกร้า" แถวในผลการค้นหา -> เปิด modal รายละเอียดสินค้า (จำนวน/หน่วย/ราคา)
    const addToCartBtn = page.locator('button:has-text("ลงตะกร้า")').first();
    const addBtnVisible = await addToCartBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('  addToCartBtn (search result row) visible:', addBtnVisible);
    if (addBtnVisible) {
      await addToCartBtn.click();
      await page.waitForTimeout(1500);
    }
    await shot(page, 'product-detail-modal');
    await dumpInteractives(page, 'product-detail-modal');

    // หน่วย default "ขวด" ไม่มีราคา (price=0) ต้องสลับไปหน่วย "แผง" ที่มีราคาตั้งไว้จริง (110/200/350 ตาม price level)
    // มิฉะนั้นจะเจอ error "ไม่สามารถขายสินค้าราคา 0 บาทได้"
    const unitBtn = page.locator('button:has-text("แผง")').first();
    if (await unitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await unitBtn.click();
      await page.waitForTimeout(800);
    }
    await shot(page, 'product-detail-modal-unit-switched');

    // ขั้น 2: modal รายละเอียดสินค้าเปิดขึ้น (มี "จำนวน" + ปุ่ม "ลงตะกร้า" สีเขียวอีกปุ่ม) -> คลิกยืนยัน
    const confirmAddBtn = page.locator('button:has-text("ลงตะกร้า")').last();
    const confirmVisible = await confirmAddBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('  confirmAddBtn (product detail modal) visible:', confirmVisible);
    if (confirmVisible) {
      await confirmAddBtn.click();
      await page.waitForTimeout(1500);
    }
    await shot(page, 'after-click-add-to-cart');

    // ปิด modal ผลการค้นหาถ้ายังค้างอยู่
    const closeModalBtn = page.locator('.modal.show button.close, .modal.show [aria-label="Close"], .modal.show button:has-text("×")').first();
    if (await closeModalBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeModalBtn.click();
      await page.waitForTimeout(1000);
    }
    await shot(page, 'after-add-to-cart');
    await dumpInteractives(page, 'after-add-to-cart');
    if (maxStage <= 2) return;

    // ── STAGE 3: Click ชำระเงิน → checkout summary ───────────────────────────
    console.log('--- STAGE 3: ชำระเงิน -> checkout summary ---');
    const payBtn = page.locator('button.checkout-button, button:has-text("ชำระเงิน")').first();
    await payBtn.click();
    await page.waitForTimeout(2500);
    await shot(page, 'checkout-summary-or-warning');

    // สินค้าบางตัวเป็นยาอันตราย/ยาควบคุมพิเศษ -> ระบบเด้ง modal "คำเตือน" ให้กรอกชื่อผู้ซื้อก่อน
    const warningInput = page.locator('.modal:has-text("คำเตือน") input[type="text"]').first();
    if (await warningInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('  พบ modal คำเตือนยาอันตราย -> กรอกชื่อผู้ซื้อ');
      await warningInput.fill('QA Tester ทดสอบระบบ');
      await page.locator('.modal:has-text("คำเตือน") button:has-text("บันทึก")').first().click();
      await page.waitForTimeout(2000);
    }
    // Modal "สำหรับลูกค้า Medical Adherence" ขอเบอร์โทร -> กด "ข้าม" เพื่อไปต่อ
    const skipMedicalAdherenceBtn = page.locator('button:has-text("ข้าม")').first();
    if (await skipMedicalAdherenceBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('  พบ modal Medical Adherence -> กด ข้าม');
      await skipMedicalAdherenceBtn.click();
      await page.waitForTimeout(2000);
    }
    await shot(page, 'checkout-summary');
    await dumpInteractives(page, 'checkout-summary');
    {
      const html = await page.content();
      fs.writeFileSync('docs/payment-method-discovery/checkout-summary-modal.html', html);
      console.log('  saved checkout-summary-modal.html');
    }
    if (maxStage <= 3) return;

    // ── STAGE 4: เพิ่มวิธีการชำระเงินใหม่ (+) ────────────────────────────────
    // ยืนยันจาก live HTML: ปุ่ม "+" คือ <img src="img/icon_add_payment.svg" alt="Add New Payment">
    // อยู่มุมขวาสุดของแถวไอคอนวิธีชำระเงิน (THAI QR / ARINDEMO / CAB / PLUS / +)
    console.log('--- STAGE 4: Add custom payment method ---');
    const addPaymentBtn = page.locator('img[alt="Add New Payment"]').first();
    const addPaymentBtnVisible = await addPaymentBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('  addPaymentBtn (icon_add_payment.svg) visible:', addPaymentBtnVisible);
    if (addPaymentBtnVisible) {
      await addPaymentBtn.click();
      await page.waitForTimeout(1500);
    }
    await shot(page, 'add-payment-modal');
    await dumpInteractives(page, 'add-payment-modal');
    {
      const html = await page.content();
      fs.writeFileSync('docs/payment-method-discovery/add-payment-modal.html', html);
      console.log('  saved add-payment-modal.html');
    }
    if (maxStage <= 4) return;

    // ── STAGE 5: คลิก "+" (Add New Payment) ที่อยู่ *ใน* modal "จัดการวิธีการชำระเงิน" ──
    // (คนละอันกับปุ่ม "+" ในหน้าสรุปยอด — ต้อง scope ด้วย .modal.show ให้ตรงตัวสุดท้าย)
    console.log('--- STAGE 5: Open new-payment-method creation form ---');
    const innerAddBtn = page.locator('.modal.show img[alt="Add New Payment"]').last();
    const innerAddVisible = await innerAddBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('  innerAddBtn visible:', innerAddVisible);
    if (innerAddVisible) {
      await innerAddBtn.click();
      await page.waitForTimeout(1500);
    }
    await shot(page, 'new-payment-method-form');
    await dumpInteractives(page, 'new-payment-method-form');
    {
      const html = await page.content();
      fs.writeFileSync('docs/payment-method-discovery/new-payment-method-form.html', html);
      console.log('  saved new-payment-method-form.html');
    }
    if (maxStage <= 5) return;

    // ── STAGE 6: กรอกชื่อ + อัปโหลดรูปไอคอน + ยืนยัน ────────────────────────
    console.log('--- STAGE 6: Fill name + upload icon + confirm ---');
    console.log('  ชื่อวิธีชำระเงินใหม่:', NEW_PAYMENT_METHOD_NAME);
    console.log('  ไฟล์รูป:', IMAGE_PATH, 'exists:', fs.existsSync(IMAGE_PATH));

    const nameInput = page.locator('.modal.show input[placeholder="ระบุ"]').last();
    await nameInput.fill(NEW_PAYMENT_METHOD_NAME);
    await page.waitForTimeout(300);

    const fileInput = page.locator('.modal.show input[type="file"]').last();
    await fileInput.setInputFiles(IMAGE_PATH);
    await page.waitForTimeout(1500);
    await shot(page, 'new-payment-form-filled');

    // หลังอัปโหลดรูป ระบบเปิด crop tool ให้ตัดรูปก่อน ต้องกด "Crop Photo" เพื่อยืนยันรูปที่ครอปแล้ว
    const cropBtn = page.locator('.modal.show button:has-text("Crop Photo")').last();
    if (await cropBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('  พบ Crop Photo tool -> คลิกยืนยันการครอปรูป');
      await cropBtn.click();
      await page.waitForTimeout(1500);
    }
    await shot(page, 'new-payment-form-cropped');

    const confirmBtn = page.locator('.modal.show button:has-text("ยืนยัน")').last();
    const confirmDisabled = await confirmBtn.getAttribute('disabled').catch(() => null);
    console.log('  confirm button disabled attr:', confirmDisabled);
    await confirmBtn.click({ timeout: 5000 }).catch(async (e) => {
      console.log('  confirmBtn click error:', e.message?.slice(0, 200));
    });
    await page.waitForTimeout(2000);
    await shot(page, 'after-confirm-new-payment-method');
    await dumpInteractives(page, 'after-confirm-new-payment-method');
    if (maxStage <= 6) return;

    // ── STAGE 7: ปิด modal จัดการฯ กลับไปหน้าสรุปยอด แล้วตรวจว่าวิธีชำระใหม่ปรากฏ ──
    console.log('--- STAGE 7: Close manage-modal, verify new method appears ---');
    for (let i = 0; i < 3; i++) {
      const anyModalClose = page.locator('.modal.show button.close, .modal.show [aria-label="Close"]').last();
      if (await anyModalClose.isVisible({ timeout: 2000 }).catch(() => false)) {
        await anyModalClose.click();
        await page.waitForTimeout(1000);
      } else break;
      // หยุดถ้าเหลือแค่ modal สรุปยอด (มีข้อความ "สรุปยอด" แต่ไม่มี "จัดการวิธีการชำระเงิน")
      const manageModalGone = !(await page.locator('.modal.show:has-text("จัดการวิธีการชำระเงิน")').isVisible({ timeout: 500 }).catch(() => false));
      const newFormGone = !(await page.locator('.modal.show:has-text("เพิ่ม Payment Method")').isVisible({ timeout: 500 }).catch(() => false));
      if (manageModalGone && newFormGone) break;
    }
    await page.waitForTimeout(1000);
    await shot(page, 'checkout-summary-after-new-method');
    await dumpInteractives(page, 'checkout-summary-after-new-method');

    const newMethodIcon = page.locator(`[title="${NEW_PAYMENT_METHOD_NAME}"], img[alt="${NEW_PAYMENT_METHOD_NAME}"]`).first();
    const newMethodVisible = await newMethodIcon.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  new payment method "${NEW_PAYMENT_METHOD_NAME}" visible in checkout summary:`, newMethodVisible);
    if (maxStage <= 7) return;

    // ── STAGE 8: เลือกวิธีชำระใหม่ที่เพิ่ง add + กรอกหมายเหตุ ────────────────
    console.log('--- STAGE 8: Select new payment method + fill remark ---');
    if (newMethodVisible) {
      await newMethodIcon.click();
      await page.waitForTimeout(1500);
    }
    await shot(page, 'new-method-selected');
    await dumpInteractives(page, 'new-method-selected');
    {
      const html = await page.content();
      fs.writeFileSync('docs/payment-method-discovery/new-method-selected.html', html);
    }

    // ยืนยันจาก live DOM: เป็น <textarea class="form-control"> เปล่าๆ ไม่มี placeholder/name เฉพาะ
    // อยู่ใต้ label "หมายเหตุ" ทางขวาของปุ่มวิธีชำระเงิน -> scope ด้วย .modal.show ตัวเดียวที่ visible
    const remarkInput = page.locator('.modal.show textarea.form-control').first();
    const remarkVisible = await remarkInput.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('  remark field visible:', remarkVisible);
    if (remarkVisible) {
      await remarkInput.fill(REMARK_TEXT);
      await page.waitForTimeout(500);
    }
    await shot(page, 'remark-filled');
    if (maxStage <= 8) return;

    // ── STAGE 9: กดชำระเงิน (complete the sale) ──────────────────────────────
    console.log('--- STAGE 9: Complete the sale ---');
    const payWithBtn = page.locator(`.modal.show button:has-text("ชำระด้วย ${NEW_PAYMENT_METHOD_NAME}")`).first();
    const payWithVisible = await payWithBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('  pay-with button visible:', payWithVisible);
    if (payWithVisible) {
      await payWithBtn.click();
      await page.waitForTimeout(3000);
    }
    await shot(page, 'after-complete-sale');
    await dumpInteractives(page, 'after-complete-sale');
    {
      const html = await page.content();
      fs.writeFileSync('docs/payment-method-discovery/after-complete-sale.html', html);
    }
    if (maxStage <= 9) return;

    // ── STAGE 10: ตรวจ "รายการบิล" ฝั่ง POS -> tooltip หมายเหตุที่คอลัมน์ประเภทการชำระเงิน ──
    console.log('--- STAGE 10: Check POS รายการบิล for tooltip ---');
    // ปิด success dialog "บันทึกรายการขายเสร็จสิ้น" ด้วยปุ่ม "ทำรายการต่อไป"
    const continueBtn = page.locator('button:has-text("ทำรายการต่อไป")').first();
    if (await continueBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('  พบ success dialog -> กด ทำรายการต่อไป');
      await continueBtn.click();
      await page.waitForTimeout(2000);
    }
    for (let i = 0; i < 3; i++) {
      const closeBtn = page.locator('.modal.show button.close, .modal.show [aria-label="Close"]').last();
      if (await closeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
        await closeBtn.click();
        await page.waitForTimeout(800);
      } else break;
    }
    await page.waitForTimeout(1000);
    const billListBtn = page.locator('button:has-text("รายการบิล")').first();
    if (await billListBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await billListBtn.click();
      await page.waitForTimeout(2500);
    }
    await shot(page, 'pos-bill-list');
    await dumpInteractives(page, 'pos-bill-list');
    {
      const html = await page.content();
      fs.writeFileSync('docs/payment-method-discovery/pos-bill-list.html', html);
    }
    if (maxStage <= 10) return;

    // ── STAGE 11: hover info-icon แถวบิลล่าสุด (แถวแรก) -> ตรวจ tooltip หมายเหตุ ──
    console.log('--- STAGE 11: Hover info icon on latest bill row, check tooltip ---');
    // หน้ามี <table> หลายตัวซ้อนกัน (ตะกร้าสินค้า + รายการบิล modal) -> scope ด้วย .modal.show ให้ชัด
    const firstRowInfoIcon = page.locator('.modal.show i.fa-info-circle').first();
    const infoIconVisible = await firstRowInfoIcon.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('  info icon visible on first row:', infoIconVisible);
    if (infoIconVisible) {
      await firstRowInfoIcon.hover();
      await page.waitForTimeout(1500);
      await shot(page, 'bill-list-tooltip-hover');
      const tooltipText = await page.locator(
        '[role="tooltip"], .tooltip, .tooltip-inner, [class*="tooltip"]'
      ).filter({ visible: true }).first().innerText().catch(() => null);
      console.log('  tooltip text (hover):', tooltipText);

      if (!tooltipText) {
        console.log('  hover ไม่แสดง tooltip -> ลองคลิกแทน');
        await firstRowInfoIcon.click();
        await page.waitForTimeout(1500);
        await shot(page, 'bill-list-tooltip-click');
        const tooltipText2 = await page.locator(
          '[role="tooltip"], .tooltip, .tooltip-inner, [class*="tooltip"], .popover, .popover-body'
        ).filter({ visible: true }).first().innerText().catch(() => null);
        console.log('  tooltip text (click):', tooltipText2);
      }
    }
    {
      const html = await page.content();
      fs.writeFileSync('docs/payment-method-discovery/pos-bill-list-tooltip.html', html);
    }
    console.log('  หมายเหตุที่คาดหวัง (REMARK_TEXT):', REMARK_TEXT);
    if (maxStage <= 11) return;
  } catch (err) {
    console.error('ERROR:', err);
    await shot(page, 'error-state');
    await dumpInteractives(page, 'error-state').catch(() => {});
  } finally {
    await browser.close();
  }
}

main();
