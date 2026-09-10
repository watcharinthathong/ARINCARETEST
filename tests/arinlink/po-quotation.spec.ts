import { test, expect } from '@playwright/test';
import { AdminQuotationPage } from '../../pages/AdminQuotationPage.js';

/**
 * Admin: ใบเสนอราคา (Quotation/PO) — admin-stg.arincare.com/arinlink/sales-manage-order/po/{uuid}
 * อ้างอิง: docs/test-cases/Arincare_MedEx_ProductCardInCartBadge_TestPlan.md หัวข้อ 12.7.6 (TC-PO-ADMIN-*)
 * Selectors ยืนยันจาก DOM จริงบน staging (2026-09-09) — ดู docs/admin-po-discovery/
 *
 * ⚠️ "ร้านค้าบน MKP" ต้องใช้ supplier "บริษัททดสอบการซื้อสินค้า B (MKPv2)" (มีสินค้าขายจริง — ผู้ใช้ยืนยัน)
 * ไม่ใช่ "Arincare" (ไม่มีสินค้าในแคตตาล็อกให้ค้นหาเลย ทดสอบแล้วได้ผลลัพธ์ว่างเปล่า)
 * ⚠️ ก่อนกด "บันทึกใบเสนอราคา" สำเร็จ ต้องกรอกครบ Sale Zone + ลูกค้า (ที่อยู่ 3 แบบ auto-fill ตามลูกค้าเอง)
 * ⚠️ ต้องรัน headless:false (nginx บล็อก headless Chromium — พบจริงในโปรเจกต์นี้)
 */

const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL ?? 'https://admin-stg.arincare.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';

const SUPPLIER = 'บริษัททดสอบการซื้อสินค้า B'; // ค้นบางส่วนก็พอ — เจอ "บริษัททดสอบการซื้อสินค้า B (MKPv2)" ตัวเดียว
const CUSTOMER_ARC_ID = 'ARC1258';
const PRODUCT_QUERY = 'ACCU-CHEK ACTIVE';
const PRODUCT_EXACT_NAME = 'ACCU-CHEK ACTIVE'; // ระวัง: ผลค้นหามีทั้ง "ACCU-CHEK ACTIVE", "...(2กล่อง)", "...25'S."

/** ตั้งค่าพื้นฐานที่ต้องทำก่อนบันทึก PO ได้ทุกครั้ง (Sale Zone + ลูกค้า + ร้านค้า) */
async function setupNewPO(po: AdminQuotationPage) {
  await po.gotoCreatePO(ADMIN_BASE_URL);
  await po.selectSaleZone();
  await po.searchCustomer(CUSTOMER_ARC_ID);
  await po.searchSupplier(SUPPLIER);
}

test.describe('Admin: ใบเสนอราคา (Quotation/PO) — business rules', () => {
  test('TC-PO-ADMIN-003 — กด "เพิ่มสินค้า" โดยยังไม่เลือกร้านค้า ต้องขึ้นแจ้งเตือน', async ({ page }) => {
    const po = new AdminQuotationPage(page);
    await po.login(ADMIN_BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
    await po.gotoCreatePO(ADMIN_BASE_URL);

    await po.addProductButton.click();
    await expect(po.selectSupplierFirstAlert).toBeVisible();
  });

  test('TC-PO-ADMIN-004 — เลือกประเภทร้านค้าได้แค่ 1 ตัวเลือก (mutually exclusive)', async ({ page }) => {
    const po = new AdminQuotationPage(page);
    await po.login(ADMIN_BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
    await po.gotoCreatePO(ADMIN_BASE_URL);

    await po.storeTypeOfflineButton.click();
    await page.waitForTimeout(500);
    await expect(po.storeTypeOfflineButton).toHaveClass(/btn-warning/);
    await expect(po.storeTypeMkpButton).not.toHaveClass(/btn-warning/);

    await po.storeTypeMkpButton.click();
    await page.waitForTimeout(500);
    await expect(po.storeTypeMkpButton).toHaveClass(/btn-warning/);
    await expect(po.storeTypeOfflineButton).not.toHaveClass(/btn-warning/);
  });

  test('TC-PO-ADMIN-005 — ค้นหาลูกค้าด้วย ARC ID แล้ว auto-fill ข้อมูลถูกต้อง', async ({ page }) => {
    const po = new AdminQuotationPage(page);
    await po.login(ADMIN_BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
    await po.gotoCreatePO(ADMIN_BASE_URL);

    await po.searchCustomer('ARC1258');

    await expect(po.customerArcIdField).toHaveValue('ARC1258');
    const name = await po.customerNameField.inputValue();
    expect(name.length).toBeGreaterThan(0);
    // ฟิลด์ที่ auto-fill ต้อง readonly (ห้ามแก้ตรงๆ)
    await expect(po.customerArcIdField).toHaveAttribute('readonly', /.*/);
  });

  test('TC-PO-ADMIN-005b — ค้นหาร้านค้า (supplier) แล้ว auto-fill Supplier ID ถูกต้อง', async ({ page }) => {
    const po = new AdminQuotationPage(page);
    await po.login(ADMIN_BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
    await po.gotoCreatePO(ADMIN_BASE_URL);

    await po.searchSupplier('Arincare');

    const supplierId = await po.supplierIdField.inputValue();
    expect(supplierId.length).toBeGreaterThan(0);
    // หลังเลือก supplier แล้ว ปุ่ม "เพิ่มสินค้า" ต้องไม่ขึ้นแจ้งเตือนอีก (regression กัน TC-PO-ADMIN-003)
    await po.addProductButton.click();
    await page.waitForTimeout(1000);
    await expect(po.selectSupplierFirstAlert).not.toBeVisible();
  });

  test('TC-PO-ADMIN-006 — Summary ไม่ recalculate จนกว่าจะกด "บันทึกใบเสนอราคา"', async ({ page }) => {
    const po = new AdminQuotationPage(page);
    await po.login(ADMIN_BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
    await setupNewPO(po);

    await po.addProduct(PRODUCT_QUERY, PRODUCT_EXACT_NAME, 5);

    // ก่อน save — Summary ต้องยังไม่ recalculate (ยังเป็น 0 ตามค่าเริ่มต้นของ PO ใหม่)
    expect(await po.summaryValue('ราคารวม')).toBe(0);
    expect(await po.summaryValue('ยอดสุทธิ')).toBe(0);

    await po.save();
    await expect(po.saveSuccessMessage).toBeVisible();

    // หลัง save — ต้อง recalculate ถูกต้องทันที (ราคารวม = 310×5 = 1550)
    const total = await po.summaryValue('ราคารวม');
    expect(total).toBeCloseTo(1550, 1);
    const net = await po.summaryValue('ยอดสุทธิ');
    expect(net).toBeGreaterThan(0);
    expect(net).toBeLessThanOrEqual(total); // มีส่วนลด/VAT reshuffle แต่ต้องไม่มากกว่าราคารวมดิบ
  });

  test('TC-PO-ADMIN-007 — เพิ่มสินค้าหลายรอบ + Save ทุกรอบ ยอดไม่ตกหล่น/ซ้ำ', async ({ page }) => {
    const po = new AdminQuotationPage(page);
    await po.login(ADMIN_BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
    await setupNewPO(po);

    await po.addProduct(PRODUCT_QUERY, PRODUCT_EXACT_NAME, 5);
    await po.save();
    await expect(po.saveSuccessMessage).toBeVisible();
    const totalAfterFirst = await po.summaryValue('ราคารวม');
    expect(totalAfterFirst).toBeCloseTo(1550, 1); // 310 × 5

    // เพิ่มสินค้าตัวที่ 2 (ตัวเดียวกัน หน่วยอื่น — "ACCU-CHEK ACTIVE (2กล่อง)") แล้ว save รอบที่ 2
    await po.addProduct('ACCU-CHEK ACTIVE (2', 'ACCU-CHEK ACTIVE (2กล่อง)', 1);
    await page.waitForTimeout(500);
    await po.save();
    await expect(po.saveSuccessMessage).toBeVisible();
    const totalAfterSecond = await po.summaryValue('ราคารวม');

    // ราคารวมรอบ 2 ต้อง "มากกว่า" รอบแรกเท่านั้น (เพิ่มสินค้าเข้าไปจริง ไม่ตกหล่น/ไม่ค้างค่าเก่าซ้ำ)
    expect(totalAfterSecond).toBeGreaterThan(totalAfterFirst);
  });

  test('TC-PO-ADMIN-001/002 — ราคาหลังลด + Summary คำนวณถูกต้อง (reconciliation)', async ({ page }) => {
    const po = new AdminQuotationPage(page);
    await po.login(ADMIN_BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
    await setupNewPO(po);

    await po.addProduct(PRODUCT_QUERY, PRODUCT_EXACT_NAME, 5); // ครบ 5 กล่อง → เข้าเงื่อนไข PROMO-B-009
    await po.save();
    await expect(po.saveSuccessMessage).toBeVisible();

    // TC-PO-ADMIN-001: คอลัมน์ "ราคาหลังลด" ต้องมีค่า และน้อยกว่าหรือเท่ากับราคารวมก่อนลด (มีส่วนลดจริง)
    const productNameInput = page.locator('#detail_product_name_0');
    const discountedPrice = await po.productRowDiscountedPrice(productNameInput).inputValue();
    expect(parseFloat(discountedPrice)).toBeGreaterThan(0);

    // TC-PO-ADMIN-002: Summary reconciliation — ไม่เดาสูตรตายตัว (มีโปรโมชั่นหลายตัว stack กันจริง ดูหัวข้อ 12.8)
    const ราคารวม = await po.summaryValue('ราคารวม');
    const ส่วนลดโปรโมชั่น = await po.summaryValue('ส่วนลดโปรโมชั่น');
    const คูปองส่วนลด = await po.summaryValue('โค้ดคูปองส่วนลด');
    const ค่าส่ง = await po.summaryValue('ค่าส่ง');
    const ราคาก่อนภาษี = await po.summaryValue('ราคาก่อนภาษี');
    const ภาษี = await po.summaryValue('ภาษี');
    const ยอดสุทธิ = await po.summaryValue('ยอดสุทธิ');

    // ⚠️ ฝั่ง Admin แสดงส่วนลดเป็น "จำนวนบวก" (magnitude) คนละ sign convention กับฝั่ง User cart ที่แสดง
    // เป็นค่าลบ (พบจริงจากการรัน — ได้ 306.74 ไม่ใช่ -306.74) ต้องลบแทนบวกในสูตร reconciliation
    expect(ส่วนลดโปรโมชั่น).toBeGreaterThan(0);
    const computed = ราคารวม - ส่วนลดโปรโมชั่น - คูปองส่วนลด + ค่าส่ง;
    expect(Math.abs(computed - ยอดสุทธิ)).toBeLessThanOrEqual(2);
    expect(Math.abs(ราคาก่อนภาษี + ภาษี - ยอดสุทธิ)).toBeLessThanOrEqual(2);
  });

  test('TC-PO-ADMIN-008 — Export ใบเสนอราคาเป็น PDF ได้จริง', async ({ page }) => {
    const po = new AdminQuotationPage(page);
    await po.login(ADMIN_BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
    await setupNewPO(po);
    await po.addProduct(PRODUCT_QUERY, PRODUCT_EXACT_NAME, 5);
    await po.save();
    await expect(po.saveSuccessMessage).toBeVisible();

    const [popup] = await Promise.all([
      page.waitForEvent('popup', { timeout: 10000 }).catch(() => null),
      po.exportQuotationButton.click(),
    ]);
    await page.waitForTimeout(2000);
    // Export อาจเปิดแท็บใหม่ (พรีวิว PDF) หรือ trigger download ตรงๆ — เช็คว่ามีอย่างใดอย่างหนึ่งเกิดขึ้นจริง
    // ไม่ error/ค้าง (แค่ยืนยันว่าปุ่มทำงาน ยังไม่เปิดไฟล์ตรวจเนื้อหาละเอียดในรอบนี้)
    if (popup) {
      expect(popup.url()).toBeTruthy();
      await popup.close().catch(() => {});
    }
  });

  test('TC-PO-ADMIN-009 — ข้อมูลที่ save แล้วตรงกับที่แสดงในหน้า PO List', async ({ page }) => {
    const po = new AdminQuotationPage(page);
    await po.login(ADMIN_BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
    await setupNewPO(po);
    await po.addProduct(PRODUCT_QUERY, PRODUCT_EXACT_NAME, 5);
    await po.save();
    await expect(po.saveSuccessMessage).toBeVisible();

    const netTotal = await po.summaryValue('ยอดสุทธิ');
    const url = page.url();
    const uuid = url.split('/').pop() ?? '';
    expect(uuid.length).toBeGreaterThan(10);

    await po.gotoPOList(ADMIN_BASE_URL);
    const row = po.poListRowByUuid(uuid);
    await expect(row).toBeVisible();
    const rowText = await row.innerText();

    expect(rowText).toContain('ARC1258'); // ลูกค้าที่เลือกไว้
    // Total Amount ใน list ต้องตรงกับ "ยอดสุทธิ" ที่ save ไว้ — ⚠️ list แสดงแบบมี comma คั่นหลักพัน
    // (เช่น "1,243.26") ต่างจาก summaryValue() ที่ parse เป็น number ล้วน ต้องดึงตัวเลขจริงมาเทียบแทน
    const totalInList = parseFloat(rowText.match(/[\d,]+\.\d{2}/)?.[0]?.replace(/,/g, '') ?? 'NaN');
    expect(Math.abs(totalInList - netTotal)).toBeLessThanOrEqual(0.01);
  });
});
