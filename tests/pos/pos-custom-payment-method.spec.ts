/**
 * POS - เพิ่มวิธีการชำระเงินแบบกำหนดเอง (Custom Payment Method) + หมายเหตุ
 * Source: Exploratory QA retest (ดู docs/payment-method-discovery/ สำหรับ live-DOM discovery script)
 * Target: pos-stg.arincare.com (company: Watcharin TestTest, branch: สำนักงานใหญ่ — บริษัทนี้เท่านั้น
 *         ที่มีสินค้าราคาไม่เป็น 0 บาทพร้อมใช้ทดสอบ checkout)
 *
 * Flow ที่ครอบคลุม:
 *   1. เพิ่มสินค้าลงตะกร้า → ชำระเงิน → หน้าสรุปยอด
 *   2. กด "+" (Add New Payment) มุมล่างแถวไอคอนวิธีชำระเงิน → เปิด "จัดการวิธีการชำระเงิน"
 *   3. กด "+" (Add New Payment) ชั้นในอีกครั้ง → ฟอร์ม "เพิ่ม Payment Method"
 *   4. กรอกชื่อ + อัปโหลดรูป + Crop Photo + ยืนยัน → วิธีชำระใหม่ต้องปรากฏในหน้าสรุปยอด
 *   5. เลือกวิธีชำระใหม่ → กรอกหมายเหตุ (optional) → ชำระเงินสำเร็จ
 *   6. ตรวจ "รายการบิล" ฝั่ง POS → คอลัมน์ประเภทการชำระเงินต้องมี tooltip แสดงหมายเหตุ (hover/click)
 *
 * Test IDs: TC-PAY-001 (E2E ฟีเจอร์ทำงานได้), TC-PAY-002 (tooltip หมายเหตุในรายการบิล)
 *
 * ⚠️ อัปเดต 2026-09-02 (หลัง user ยืนยันด้วยภาพจริง): เดิมเข้าใจผิดว่า tooltip หมายเหตุเป็น BUG
 * (ไม่แสดงเลยตอนรัน Playwright hover/click) แต่ผู้ใช้ส่ง screenshot จากเบราว์เซอร์จริง (ไม่ใช่ automation)
 * ยืนยันชัดเจนว่า tooltip แสดงผลถูกต้องทั้งฝั่ง POS และ ERP list-bills บนบิลเดียวกันเป๊ะ (QA35073759,
 * QA35016112) — ฟีเจอร์ทำงานถูกต้องจริง ไม่ใช่ bug
 *
 * สืบสวนซ้ำหลายรอบ (ดู docs/payment-method-discovery/verify-tooltip-fullpage-bug.ts) พบว่า Playwright
 * ไม่สามารถ trigger tooltip นี้ได้เลยไม่ว่าจะลองวิธีไหน: hover ปกติ, click, mousedown/up จริง,
 * mouse.move แบบ steps จำลองการเคลื่อนเมาส์จริง, headed mode, ปิด navigator.webdriver flag — DOM element
 * count และ network request คงที่ 100% ไม่มีการเปลี่ยนแปลงใดๆ เลยทุกครั้ง ทั้งที่ icon (<i class="fa
 * fa-info-circle">) ไม่มี title / data-xxx / aria-xxx attribute ผูกไว้เลยใน static DOM — กลไกจริงของ tooltip
 * นี้ยังไม่ทราบแน่ชัดว่าทำงานอย่างไร (อาจ bind ผ่านกลไกที่ Playwright's CDP-driven input จำลองไม่ได้)
 * จึงยัง**เขียน automated assertion สำหรับ tooltip นี้ไม่ได้อย่างน่าเชื่อถือ** — TC-PAY-002 ด้านล่างจึง
 * skip ไว้ก่อน และควรทดสอบ tooltip นี้แบบ manual QA ต่อไป จนกว่าจะเข้าใจกลไกจริงชัดเจนกว่านี้
 */

import { test, expect } from './pos-fixtures.js';
import { shot } from '../../utils/helpers.js';

const COMPANY = 'Watcharin TestTest';
const BRANCH = 'สำนักงานใหญ่';
const PRODUCT_SEARCH_TERM = "BILAXTEN 20 MG TABLETS 10'S";
const IMAGE_PATH = `${process.env.HOME}/Downloads/010011598.jpg`;

function uniquePaymentMethodName() {
  return `QA${Date.now().toString().slice(-8)}`; // <=15 ตัวอักษร ตาม maxlength ของฟอร์ม
}

/**
 * เพิ่มสินค้า BILAXTEN ลงตะกร้า (หน่วย "แผง" ที่มีราคาตั้งไว้จริง — หน่วย "ขวด" default ราคา 0
 * จะโดน error "ไม่สามารถขายสินค้าราคา 0 บาทได้") แล้วกด ชำระเงิน ไปจนถึงหน้าสรุปยอด
 * (ผ่าน modal คำเตือนยาอันตราย + Medical Adherence ที่เด้งมาระหว่างทาง)
 */
async function addProductAndReachCheckoutSummary(page: import('@playwright/test').Page) {
  const searchInput = page.locator('[placeholder="ค้นหาสินค้า (ctrl + Q)"]').first();
  await searchInput.click();
  await searchInput.type(PRODUCT_SEARCH_TERM, { delay: 60 });
  await page.waitForTimeout(800);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(2000);

  await page.locator('button:has-text("ลงตะกร้า")').first().click();
  await page.waitForTimeout(1200);
  const unitBtn = page.locator('button:has-text("แผง")').first();
  if (await unitBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await unitBtn.click();
    await page.waitForTimeout(500);
  }
  await page.locator('button:has-text("ลงตะกร้า")').last().click();
  await page.waitForTimeout(1200);

  const closeSearchModal = page.locator('.modal.show button.close, .modal.show [aria-label="Close"]').first();
  if (await closeSearchModal.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closeSearchModal.click();
    await page.waitForTimeout(800);
  }

  await page.locator('button.checkout-button, button:has-text("ชำระเงิน")').first().click();
  await page.waitForTimeout(2000);

  // ยาอันตราย/ยาควบคุมพิเศษ -> กรอกชื่อผู้ซื้อ
  const warningInput = page.locator('.modal:has-text("คำเตือน") input[type="text"]').first();
  if (await warningInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await warningInput.fill('QA Tester ทดสอบระบบ');
    await page.locator('.modal:has-text("คำเตือน") button:has-text("บันทึก")').first().click();
    await page.waitForTimeout(1500);
  }
  // Medical Adherence -> ข้าม
  const skipBtn = page.locator('button:has-text("ข้าม")').first();
  if (await skipBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await skipBtn.click();
    await page.waitForTimeout(1500);
  }

  await expect(page.locator('.modal.show:has-text("สรุปยอด")')).toBeVisible({ timeout: 10_000 });
}

test.describe('POS: เพิ่มวิธีการชำระเงินแบบกำหนดเอง (Custom Payment Method)', () => {
  test.beforeEach(async ({ page, posRegister }) => {
    await posRegister.goto();
    await posRegister.loginToPos({ company: COMPANY, branch: BRANCH });
  });

  // ══════════════════════════════════════════════════════════════════
  // TC-PAY-001
  // สร้างวิธีชำระเงินใหม่ (ชื่อ + ไอคอน) -> ต้องปรากฏในหน้าสรุปยอดและใช้ชำระเงินได้จริง
  // ══════════════════════════════════════════════════════════════════
  test('@smoke TC-PAY-001 เพิ่มวิธีการชำระเงินใหม่ + เลือกใช้ชำระเงินสำเร็จ', async ({ page }) => {
    const methodName = uniquePaymentMethodName();
    const remarkText = `QA-TEST-หมายเหตุ-${Date.now()}`;

    await addProductAndReachCheckoutSummary(page);
    await shot(page, `pos/TC-PAY-001_01_checkout-summary`);

    // เปิด "จัดการวิธีการชำระเงิน"
    await page.locator('img[alt="Add New Payment"]').first().click();
    await page.waitForTimeout(1000);
    await expect(page.locator('.modal.show:has-text("จัดการวิธีการชำระเงิน")')).toBeVisible({ timeout: 8_000 });
    await shot(page, `pos/TC-PAY-001_02_manage-payment-modal`);

    // เปิดฟอร์ม "เพิ่ม Payment Method"
    await page.locator('.modal.show img[alt="Add New Payment"]').last().click();
    await page.waitForTimeout(1000);
    await expect(page.locator('.modal.show:has-text("เพิ่ม Payment Method")')).toBeVisible({ timeout: 8_000 });

    // กรอกชื่อ + อัปโหลดรูป + crop + ยืนยัน
    await page.locator('.modal.show input[placeholder="ระบุ"]').last().fill(methodName);
    await page.locator('.modal.show input[type="file"]').last().setInputFiles(IMAGE_PATH);
    await page.waitForTimeout(1200);
    const cropBtn = page.locator('.modal.show button:has-text("Crop Photo")').last();
    await expect(cropBtn, 'ต้องมี Crop Photo tool ให้ครอปรูปหลังอัปโหลด').toBeVisible({ timeout: 5_000 });
    await cropBtn.click();
    await page.waitForTimeout(1000);
    await shot(page, `pos/TC-PAY-001_03_new-method-form-filled`);

    const confirmBtn = page.locator('.modal.show button:has-text("ยืนยัน")').last();
    await expect(confirmBtn, 'ปุ่มยืนยันต้อง enable หลังกรอกชื่อ+รูปครบ').not.toBeDisabled({ timeout: 5_000 });
    await confirmBtn.click();
    await page.waitForTimeout(1500);

    // ปิด modal จัดการฯ กลับไปหน้าสรุปยอด
    for (let i = 0; i < 3; i++) {
      const manageModalOpen = await page.locator('.modal.show:has-text("จัดการวิธีการชำระเงิน")').isVisible({ timeout: 1000 }).catch(() => false);
      if (!manageModalOpen) break;
      await page.locator('.modal.show button.close, .modal.show [aria-label="Close"]').last().click();
      await page.waitForTimeout(800);
    }
    await shot(page, `pos/TC-PAY-001_04_back-to-checkout-summary`);

    // วิธีชำระใหม่ต้องปรากฏในหน้าสรุปยอด
    const newMethodIcon = page.locator(`[title="${methodName}"]`).first();
    await expect(newMethodIcon, `วิธีชำระ "${methodName}" ต้องปรากฏในรายการช่องทางชำระเงิน`).toBeVisible({ timeout: 8_000 });

    // เลือกวิธีชำระใหม่ + กรอกหมายเหตุ (optional field)
    await newMethodIcon.click();
    await page.waitForTimeout(1000);
    const remarkField = page.locator('.modal.show textarea.form-control').first();
    await expect(remarkField, 'ต้องมีช่องหมายเหตุให้กรอกหลังเลือกวิธีชำระ').toBeVisible({ timeout: 5_000 });
    await remarkField.fill(remarkText);
    await shot(page, `pos/TC-PAY-001_05_remark-filled`);

    // ชำระเงินให้สำเร็จ
    const payWithBtn = page.locator(`.modal.show button:has-text("ชำระด้วย ${methodName}")`).first();
    await expect(payWithBtn).toBeVisible({ timeout: 5_000 });
    await payWithBtn.click();
    await page.waitForTimeout(2500);

    await expect(page.locator('text=บันทึกรายการขายเสร็จสิ้น')).toBeVisible({ timeout: 10_000 });
    await shot(page, `pos/TC-PAY-001_06_sale-completed`);
  });

  // ══════════════════════════════════════════════════════════════════
  // TC-PAY-002 (SKIPPED — ดูคำอธิบายเต็มในหัวไฟล์)
  // เดิมสงสัยว่าเป็น BUG เพราะ Playwright hover/click ไอคอน info (ⓘ) แล้ว tooltip ไม่ขึ้นเลย
  // แต่ผู้ใช้ยืนยันด้วย screenshot จากเบราว์เซอร์จริงว่า tooltip แสดงหมายเหตุถูกต้องทั้งฝั่ง POS
  // และ ERP บนบิลเดียวกัน — ฟีเจอร์ทำงานถูกต้อง ไม่ใช่ bug
  //
  // สืบสวนซ้ำ (docs/payment-method-discovery/verify-tooltip-fullpage-bug.ts) ยืนยันว่า Playwright
  // ไม่สามารถ trigger กลไก tooltip นี้ได้เลยไม่ว่าจะลองวิธีไหน (hover, click, mousedown/up จริง,
  // mouse.move แบบ steps, headed mode, ปิด navigator.webdriver) — DOM/network ไม่ขยับเลยทุกครั้ง
  // สาเหตุที่แท้จริงยังไม่ทราบ จึง skip ไว้ก่อนเพื่อไม่ให้ CI fail จาก false positive — ควรทดสอบ
  // tooltip นี้แบบ manual QA ต่อไปจนกว่าจะเข้าใจกลไกจริง (อาจต้องถาม Dev ว่า implement ด้วยอะไร)
  // ══════════════════════════════════════════════════════════════════
  test.skip('TC-PAY-002 ไอคอน info ที่คอลัมน์ประเภทการชำระเงินในรายการบิลต้องแสดง tooltip หมายเหตุ (ยืนยันด้วย manual QA แล้วว่า Pass — Playwright ยัง trigger ไม่ได้)', async ({ page }) => {
    const methodName = uniquePaymentMethodName();
    const remarkText = `QA-TEST-หมายเหตุ-${Date.now()}`;

    await addProductAndReachCheckoutSummary(page);

    await page.locator('img[alt="Add New Payment"]').first().click();
    await page.waitForTimeout(1000);
    await page.locator('.modal.show img[alt="Add New Payment"]').last().click();
    await page.waitForTimeout(1000);
    await page.locator('.modal.show input[placeholder="ระบุ"]').last().fill(methodName);
    await page.locator('.modal.show input[type="file"]').last().setInputFiles(IMAGE_PATH);
    await page.waitForTimeout(1200);
    await page.locator('.modal.show button:has-text("Crop Photo")').last().click();
    await page.waitForTimeout(1000);
    await page.locator('.modal.show button:has-text("ยืนยัน")').last().click();
    await page.waitForTimeout(1500);
    for (let i = 0; i < 3; i++) {
      const manageModalOpen = await page.locator('.modal.show:has-text("จัดการวิธีการชำระเงิน")').isVisible({ timeout: 1000 }).catch(() => false);
      if (!manageModalOpen) break;
      await page.locator('.modal.show button.close, .modal.show [aria-label="Close"]').last().click();
      await page.waitForTimeout(800);
    }

    const newMethodIcon = page.locator(`[title="${methodName}"]`).first();
    await newMethodIcon.click();
    await page.waitForTimeout(1000);
    await page.locator('.modal.show textarea.form-control').first().fill(remarkText);
    await page.locator(`.modal.show button:has-text("ชำระด้วย ${methodName}")`).first().click();
    await page.waitForTimeout(2500);

    const continueBtn = page.locator('button:has-text("ทำรายการต่อไป")').first();
    await continueBtn.click({ timeout: 10_000 });
    await page.waitForTimeout(1500);

    await page.locator('button:has-text("รายการบิล")').first().click();
    await page.waitForTimeout(2000);
    await shot(page, `pos/TC-PAY-002_01_bill-list`);

    const infoIcon = page.locator('.modal.show i.fa-info-circle').first();
    await expect(infoIcon).toBeVisible({ timeout: 8_000 });
    await infoIcon.hover();
    await page.waitForTimeout(1200);
    await shot(page, `pos/TC-PAY-002_02_hover-info-icon`);

    const tooltip = page.locator('[role="tooltip"], .tooltip, .tooltip-inner, [class*="tooltip"]').filter({ visible: true }).first();
    // BUG: ปัจจุบัน tooltip ไม่แสดงเลย -> assertion นี้ควร fail จนกว่าจะแก้ไข
    await expect(tooltip, 'BUG: tooltip หมายเหตุต้องแสดงเมื่อ hover ไอคอน info ที่คอลัมน์ประเภทการชำระเงิน').toBeVisible({ timeout: 5_000 });
    await expect(tooltip).toContainText(remarkText);
  });
});
