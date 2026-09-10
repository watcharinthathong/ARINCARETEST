import * as path from 'path';
import { fileURLToPath } from 'url';
import { test, expect, HIDE_DEBUGBAR_SCRIPT } from './fixtures.js';
import { MedExPaymentPage } from '../../pages/MedExPaymentPage.js';
import { AdminOrderManagementPage } from '../../pages/AdminOrderManagementPage.js';

/**
 * MedEx: End-to-End Cart → Payment → Bank Transfer → Admin Approve → Order
 * อ้างอิง: docs/test-cases/Arincare_MedEx_ProductCardInCartBadge_TestPlan.md หัวข้อ 13 (TC-E2E-*)
 * Selectors ยืนยันจาก DOM จริง + ทดสอบ live end-to-end สำเร็จบน staging (2026-09-09)
 * ดูหลักฐาน screenshot/HTML ทุกขั้นตอนที่ docs/e2e-cart-payment-discovery/
 *
 * ⚠️ ครอบคลุมเฉพาะ Bank Transfer — QR/Credit Card ยังทดสอบจริงไม่ได้เพราะไม่มี sandbox payment
 * gateway บน staging (Open Item ค้าง ดู Test Plan หัวข้อ 13.6)
 *
 * ⚠️ ต้องรัน headless:false (nginx บล็อก headless Chromium ด้วย 403 — พบจริง 2026-09-07)
 * ⚠️ รันแบบ serial เท่านั้น (workers:1, fullyParallel:false ตั้งไว้ใน playwright.config.ts อยู่แล้ว)
 *    เพราะทุกเทสในไฟล์นี้ใช้ Ref No./เลขที่ออเดอร์เดียวกันที่สร้างจาก TC-E2E-BANK-001 ต่อเนื่องกัน
 *
 * รันเฉพาะไฟล์นี้: npx playwright test cart-payment-bank-transfer-e2e --project=chromium
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ADMIN_BASE_URL = process.env.ADMIN_BASE_URL ?? 'https://admin-stg.arincare.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';

const PRODUCT = { name: 'ACCIN-BP 5G.', code: 'PCO00092' };
const SLIP_IMAGE = path.join(__dirname, '../../fixtures/test-image.jpg');

// วันที่/เวลาปัจจุบันในรูปแบบที่ฟอร์มต้องการ (วว/ดด/ปปปป)
function todayDDMMYYYY(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

test.describe.serial('MedEx E2E: Cart → Payment → Bank Transfer → Admin Approve → Order (หัวข้อ 13)', () => {
  // ⚠️ จำกัดแค่ Desktop เท่านั้น — selector ของฟอร์ม Payment/Bank Transfer ยังไม่เคยยืนยันบน mobile
  // viewport และเทสนี้สร้างรายการ Bank Transfer จริง + ให้ Admin approve จริงทุกครั้งที่รัน (มี side
  // effect จริงบน staging) การรันซ้ำ 3 รอบต่อ device (ตาม medex-mobile-* projects ใน config) จะสิ้นเปลือง
  // และเสี่ยง flaky โดยไม่จำเป็น เพราะ business logic ของ flow นี้ไม่ขึ้นกับ device อยู่แล้ว
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.use.isMobile === true, 'E2E flow นี้ทดสอบเฉพาะ Desktop — selector ยังไม่เคยยืนยันบน mobile และมี side effect จริงบน staging ทุกครั้งที่รัน');
  });

  // สถานะที่ส่งต่อข้ามเทสในไฟล์นี้ — สร้างครั้งเดียวใน TC-E2E-BANK-001 แล้วใช้ซ้ำในเทสถัดๆ ไป
  let cartRefNo = '';
  let orderRefNo = '';
  // ⚠️ ห้าม hardcode "210.00" — ตอนนี้มีโปรโมชั่นจริงบน staging ที่กระทบราคาสินค้า (ดูหัวข้อ 12.8) ทำให้
  // ยอดสุทธิจริงไม่เท่ากับราคาต่อหน่วยดิบอีกต่อไป ต้องอ่านค่าจริงจากหน้าตะกร้าแล้วใช้ซ้ำแทน
  let netTotal = '';

  test('TC-E2E-CART-003 + TC-E2E-PAYMENT-001 + TC-E2E-BANK-001 — เลือกทั้งหมด → ชำระเงิน → ส่งหลักฐานการโอนจริง', async ({
    loggedIn,
    medexPage,
    trackedProducts,
  }) => {
    // ⚠️ ทำเป็นเทสเดียวต่อเนื่องกันโดยตั้งใจ (ไม่แยกเป็นหลาย test()) เพราะแต่ละ test() ได้ page/context
    // ใหม่ — ถ้าแยก เทสถัดไปจะสร้าง checkout session/เลขที่ใบสั่งซื้อใหม่คนละอันกับที่ตั้งใจตรวจสอบต่อ
    await medexPage.goto();
    const card = await medexPage.findProductBySearch(PRODUCT.code, PRODUCT.name);
    await medexPage.addToCart(card);
    trackedProducts.push(PRODUCT.name);

    // TC-E2E-CART-003
    await medexPage.gotoCartPage();
    await expect(medexPage.payButton).toBeDisabled();
    // ⚠️ อ่านยอดสุทธิจริงจากตะกร้าไว้ใช้ต่อ — ห้าม hardcode "210.00" เพราะตอนนี้มีโปรโมชั่นจริงบน staging
    // ที่กระทบราคาสินค้าตัวนี้แล้ว (ดูหัวข้อ 12.8) ยอดจริงเปลี่ยนไปจากราคาต่อหน่วยดิบ
    const netTotalValue = await medexPage.cartSummaryValue('ยอดสุทธิ');
    netTotal = netTotalValue.toFixed(2);
    console.log(`TC-E2E-CART-003: ยอดสุทธิจริง = ${netTotal}`);
    await medexPage.selectAllInCart();
    await expect(medexPage.payButton).toBeEnabled();
    await medexPage.payButton.click();
    await medexPage.page.waitForLoadState('networkidle').catch(() => {});
    await medexPage.page.waitForTimeout(1500);
    await expect(medexPage.page).toHaveURL(/\/companies\/marketplace\/payment/);

    // TC-E2E-PAYMENT-001
    const payment = new MedExPaymentPage(medexPage.page);
    await expect(payment.orderRefLabel).toBeVisible();
    const ref = await payment.getOrderRef();
    expect(ref).toBeTruthy();
    orderRefNo = ref ?? '';
    console.log(`TC-E2E-PAYMENT-001: เลขที่ใบสั่งซื้อที่จองไว้ = ${orderRefNo}`);

    // TC-E2E-BANK-001
    await payment.selectBankTransferTab();
    await payment.fillBankTransferEvidence({
      dateDDMMYYYY: todayDDMMYYYY(),
      hour: '12',
      minute: '0',
      amount: netTotal,
      filePath: SLIP_IMAGE,
    });
    await payment.submitBankTransferEvidence();

    await expect(payment.pendingReviewMessage).toBeVisible();

    // ดึง Ref No. ล่าสุดจากหน้ารายการตะกร้า (การซื้อของฉัน) — แถวบนสุดคือรายการที่เพิ่งสร้าง
    await medexPage.page.goto('/companies/marketplace/order-management/cart', { waitUntil: 'domcontentloaded' });
    await medexPage.page.waitForLoadState('networkidle').catch(() => {});
    await medexPage.page.waitForTimeout(1200);
    const firstRowText = await medexPage.page.locator('table tbody tr').first().innerText();
    const refMatch = firstRowText.match(/LC-[\w-]+/);
    expect(refMatch).toBeTruthy();
    cartRefNo = refMatch ? refMatch[0] : '';
    console.log(`TC-E2E-BANK-001: สร้างรายการ Ref No. = ${cartRefNo}`);
    expect(firstRowText).toContain('รอตรวจสอบ');
  });

  test('TC-E2E-BANK-002 — ก่อน Admin approve: User+Admin Cart list ตรงกัน, Admin Order list ยังไม่มี Order', async ({
    page,
  }) => {
    test.skip(!cartRefNo, 'ต้องรัน TC-E2E-BANK-001 สำเร็จก่อนเพื่อสร้าง Ref No.');

    // ฝั่ง User (ใช้ page ของเทสนี้เอง — login ใหม่ผ่าน medex fixtures ไม่จำเป็นแค่เช็ค list จึง goto ตรงได้
    // แต่ session ของ page นี้ยังไม่ login ฝั่ง user เลย ข้ามการเช็คซ้ำฝั่ง User ในเทสนี้ (เช็คแล้วใน BANK-001)

    // ฝั่ง Admin (ซ่อน PHP Debugbar ก่อน — เคย intercept การคลิกบน staging มาแล้ว)
    await page.addInitScript(HIDE_DEBUGBAR_SCRIPT);
    const admin = new AdminOrderManagementPage(page);
    await admin.login(ADMIN_BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
    await admin.gotoCartList(ADMIN_BASE_URL);

    const found = await admin.hasRow(cartRefNo);
    expect(found).toBeTruthy();
    const rowText = await admin.getRowText(cartRefNo);
    expect(rowText).toContain('รอตรวจสอบ');

    // กดดูรายละเอียด Cart Detail — ⚠️ หน้านี้ไม่มีตาราง Summary แบบ Order Detail (ราคารวม/ส่วนลด/ภาษี
    // ฯลฯ) มีแค่ "ยอดรวม" เฉยๆ + ข้อมูลหลักฐานการโอน (ไฟล์/วันที่/เวลา/จำนวนเงิน) + ปุ่ม "ยอมรับหลักฐาน"
    // (ทางเลือกอื่นแทน dropdown เปลี่ยนสถานะที่ใช้ใน BANK-003) + ตาราง Order ย่อยที่ผูกกับ cart นี้
    await admin.openDetail(cartRefNo);
    await expect(page.getByText(cartRefNo).first()).toBeVisible();
    await expect(page.getByText('ยอดรวม :')).toBeVisible();
    await expect(page.getByText(netTotal).first()).toBeVisible();
    // Order ย่อยที่ผูกกับ cart นี้มีอยู่แล้วใน DB (สถานะ "ส่งใบสั่งซื้อแล้ว") แต่ Payment Status ยังรอตรวจสอบ
    // — Order นี้ถูกซ่อนจากหน้า Order List หลักจนกว่าจะ approve (ไม่ใช่ว่ายังไม่มี Order เลยในระบบ)
    if (orderRefNo) {
      await expect(page.getByText(orderRefNo).first()).toBeVisible();
    }
    await admin.gotoCartList(ADMIN_BASE_URL);

    await admin.gotoOrderList(ADMIN_BASE_URL);
    const orderFoundBeforeApprove = await admin.hasRow(orderRefNo);
    expect(orderFoundBeforeApprove).toBeFalsy();
  });

  test('TC-E2E-BANK-003 + TC-E2E-BANK-004 — Admin approve, Order ปรากฏทันที', async ({ page }) => {
    test.skip(!cartRefNo, 'ต้องรัน TC-E2E-BANK-001 สำเร็จก่อนเพื่อสร้าง Ref No.');

    const admin = new AdminOrderManagementPage(page);
    await admin.login(ADMIN_BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
    await admin.gotoCartList(ADMIN_BASE_URL);

    await admin.changeCartPaymentStatus(
      cartRefNo,
      'ชำระเงิน', // partial match — DB สะกด "ชำระเงินเเล้ว" ซ้ำ เ 2 ตัวจริง
      `ทดสอบอนุมัติการชำระเงินผ่าน Playwright automation (${new Date().toISOString()})`,
    );

    // reload แล้วตรวจว่า Cart status เปลี่ยนแล้ว
    await admin.gotoCartList(ADMIN_BASE_URL);
    const rowTextAfter = await admin.getRowText(cartRefNo);
    expect(rowTextAfter).toContain('ชำระเงิน');
    expect(rowTextAfter).not.toContain('รอตรวจสอบ');

    // TC-E2E-BANK-003: Order ต้องปรากฏใน Order list ทันที
    await admin.gotoOrderList(ADMIN_BASE_URL);
    const orderFoundAfterApprove = await admin.hasRow(orderRefNo);
    expect(orderFoundAfterApprove).toBeTruthy();
    const orderRowText = await admin.getRowText(orderRefNo);
    expect(orderRowText).toContain('รับออเดอร์แล้ว');
    expect(orderRowText).toContain('ชำระเงิน');

    // กดดูรายละเอียด Order Detail — ตรวจ breadcrumb เชื่อม Cart↔Order ตรงๆ + สถานะ + Summary ครบ
    await admin.openDetail(orderRefNo);
    await expect(page).toHaveURL(/\/arinlink\/order-management\/order\/\d+/);
    await expect(admin.cartRefLinkOnOrderDetail(cartRefNo)).toBeVisible();
    await expect(admin.orderDetailPaymentStatusDropdown).toContainText('ชำระเงิน');
    await expect(admin.orderDetailOrderStatusDropdown).toContainText('รับออเดอร์แล้ว');
    await expect(admin.summaryValue('ยอดสุทธิ')).toContainText(netTotal);
  });

  test('TC-E2E-MYPURCHASE-002 + TC-E2E-SYNC-001/002 — User Order list สะท้อนผล approve ตรงกับ Admin', async ({
    loggedIn,
    medexPage,
  }) => {
    test.skip(!orderRefNo, 'ต้องรัน TC-E2E-BANK-003 สำเร็จก่อนเพื่อให้ Order ถูกสร้าง');

    await medexPage.page.goto('/companies/marketplace/order-management/order', { waitUntil: 'domcontentloaded' });
    await medexPage.page.waitForLoadState('networkidle').catch(() => {});
    await medexPage.page.waitForTimeout(1200);

    const orderRow = medexPage.page.locator('tr').filter({ hasText: orderRefNo }).first();
    const found = await orderRow.isVisible({ timeout: 5000 }).catch(() => false);
    expect(found).toBeTruthy();

    const rowText = await orderRow.innerText();
    expect(rowText).toContain(netTotal);
    expect(rowText).toContain('ชำระเงิน');

    // กดดูรายละเอียด — ตรวจ breadcrumb {Ref No.}/{เลขที่ออเดอร์}, คอลัมน์ "ราคาหลังลด", Summary ครบ
    await orderRow.locator('a[href*="/order-management/order/"]').first().click();
    await medexPage.page.waitForLoadState('networkidle').catch(() => {});
    await medexPage.page.waitForTimeout(1200);
    await expect(medexPage.page).toHaveURL(/\/order-management\/order\/\d+/);
    await expect(medexPage.page.getByText(cartRefNo).first()).toBeVisible();
    await expect(medexPage.page.getByText(orderRefNo).first()).toBeVisible();
    await expect(medexPage.page.locator('th, td').filter({ hasText: 'ราคาหลังลด' }).first()).toBeVisible();
    await expect(medexPage.page.locator('tr').filter({ hasText: 'ยอดสุทธิ' }).locator('td').last()).toContainText(netTotal);
  });
});

// ── เคสที่ไม่ต้องพึ่ง state ของ Bank Transfer flow ด้านบน — รันแยกอิสระได้ ──────────
test.describe('MedEx E2E: Cart selection + Admin list ทั่วไป (ไม่ผูกกับ Bank Transfer flow)', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.use.isMobile === true, 'ทดสอบเฉพาะ Desktop — เหตุผลเดียวกับ describe ด้านบน');
  });

  test('TC-E2E-CART-001 — ตะกร้ามีสินค้าแล้วข้อมูลครบก่อนชำระเงิน', async ({ loggedIn, medexPage, trackedProducts }) => {
    await medexPage.goto();
    const card = await medexPage.findProductBySearch(PRODUCT.code, PRODUCT.name);
    await medexPage.addToCart(card);
    trackedProducts.push(PRODUCT.name);

    await medexPage.gotoCartPage();
    await expect(medexPage.cartPageRow(PRODUCT.name)).toBeVisible();
    const rowText = await medexPage.cartPageRow(PRODUCT.name).innerText();
    // ⚠️ ห้าม hardcode ราคาต่อหน่วย — มีโปรโมชั่น/คูปองจริงบน staging ที่อาจกระทบราคาที่แสดง (ดูหัวข้อ 12.8)
    // เช็คแค่ว่ามีตัวเลขราคาแบบทศนิยม 2 ตำแหน่งอยู่ในแถวจริง (ไม่ใช่แถวว่าง/error)
    expect(rowText).toMatch(/\d+\.\d{2}/);
    // Summary ท้ายบิลต้องแสดงครบ (ราคารวม/ส่วนลดโปรโมชั่น/คูปองส่วนลด/ค่าส่ง/ราคาก่อนภาษี/ภาษี/ยอดสุทธิ)
    for (const label of ['ราคารวม', 'ส่วนลดโปรโมชั่น', 'คูปองส่วนลด', 'ค่าส่ง', 'ราคาก่อนภาษี', 'ภาษี', 'ยอดสุทธิ']) {
      await expect(medexPage.page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });

  test('TC-E2E-CART-002 — เลือกเฉพาะร้านค้าเดียว มีแค่ร้านที่เลือกไปหน้าชำระเงิน', async ({
    loggedIn,
    medexPage,
    trackedProducts,
  }) => {
    // ⚠️ ตะกร้าเลือกได้เป็น "รายร้านค้า" เท่านั้น ไม่มี checkbox รายสินค้า (ดู sellerGroupCheckbox()) —
    // ใช้สินค้า 2 ชิ้นจาก 2 ร้านต่างกันเพื่อทดสอบ granularity จริงของฟีเจอร์นี้
    const SELLER_1 = 'บริษัททดสอบการซื้อสินค้า B (MKPv2)'; // ผู้ขาย PRODUCT (ACCIN-BP 5G.)
    const PRODUCT_2 = { name: "BILAXTEN KIDS 10 MG TABLETS 10'S", code: 'PCO12190' }; // ผู้ขาย: แล้วแต่ดวงค้ายา

    await medexPage.goto();
    const card1 = await medexPage.findProductBySearch(PRODUCT.code, PRODUCT.name);
    await medexPage.addToCart(card1);
    trackedProducts.push(PRODUCT.name);

    await medexPage.goto();
    const card2 = await medexPage.findProductBySearch(PRODUCT_2.code, PRODUCT_2.name);
    await medexPage.addToCart(card2);
    trackedProducts.push(PRODUCT_2.name);

    await medexPage.gotoCartPage();
    // ติ๊กเลือกเฉพาะร้าน SELLER_1 (ไม่แตะ "เลือกทั้งหมด" และไม่แตะ checkbox ของ SELLER_2)
    await medexPage.sellerGroupCheckbox(SELLER_1).click();
    await expect(medexPage.payButton).toBeEnabled();
    await medexPage.payButton.click();
    await medexPage.page.waitForLoadState('networkidle').catch(() => {});
    await medexPage.page.waitForTimeout(1500);
    await expect(medexPage.page).toHaveURL(/\/companies\/marketplace\/payment/);

    // หน้าชำระเงินต้องมีแค่สินค้าจากร้านที่เลือก ไม่มีสินค้าจากร้านที่ไม่ได้เลือก
    await expect(medexPage.page.getByText(PRODUCT.name, { exact: false }).first()).toBeVisible();
    await expect(medexPage.page.getByText(PRODUCT_2.name, { exact: false })).toHaveCount(0);
  });

  test('TC-E2E-ADMIN-CART-001 — Admin Cart list แสดงคอลัมน์/สถานะครบถ้วน', async ({ page }) => {
    await page.addInitScript(HIDE_DEBUGBAR_SCRIPT);
    const admin = new AdminOrderManagementPage(page);
    await admin.login(ADMIN_BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
    await admin.gotoCartList(ADMIN_BASE_URL);

    const headers = await page.locator('table thead th').allInnerTexts();
    for (const col of ['Ref No.', 'Sale Zone', 'Arc ID', 'Company Buyer', 'Buyer Province', 'Total', 'Payment Status', 'Payment Type']) {
      expect(headers.some((h) => h.includes(col))).toBeTruthy();
    }

    const rowCount = await page.locator('table tbody tr').count();
    expect(rowCount).toBeGreaterThan(0);

    // ⚠️ ต้อง .first() เสมอ — PHP Debugbar เรนเดอร์ <table><tbody> ของตัวเองหลายสิบตัวบนหน้าเดียวกัน
    // (แม้จะถูกซ่อนด้วย CSS ผ่าน HIDE_DEBUGBAR_SCRIPT แล้วก็ตาม ก็ยังอยู่ใน DOM ทำให้ query แบบไม่ scope
    // ชน strict-mode ของ Playwright) ตะกร้าจริงบน staging มีหลายสถานะปนกัน (รอตรวจสอบ/ชำระเงินแล้ว/ยกเลิก)
    // ⚠️ ข้อความจริงสะกด "ชำระเงินเเล้ว" ซ้ำ เ 2 ตัว — เช็คแค่ "ชำระเงิน" (partial) ปลอดภัยกว่า
    const bodyText = await page.locator('table tbody').first().innerText();
    const hasAnyKnownStatus = /รอตรวจสอบ|ชำระเงิน|ยกเลิก|รอชำระ/.test(bodyText);
    expect(hasAnyKnownStatus).toBeTruthy();

    // ลิงก์ดูรายละเอียดของแถวแรกต้องกดได้จริง
    const firstDetailLink = page.locator('table tbody tr').first().locator('a').filter({ hasText: 'ดูรายละเอียด' });
    await expect(firstDetailLink).toBeVisible();
    await firstDetailLink.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page).toHaveURL(/\/arinlink\/order-management\/cart\/\d+/);
  });

  test('TC-E2E-ADMIN-ORDER-001 — Admin Order list แสดงคอลัมน์/สถานะครบถ้วน', async ({ page }) => {
    await page.addInitScript(HIDE_DEBUGBAR_SCRIPT);
    const admin = new AdminOrderManagementPage(page);
    await admin.login(ADMIN_BASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD);
    await admin.gotoOrderList(ADMIN_BASE_URL);

    const headers = await page.locator('table thead th').allInnerTexts();
    for (const col of ['Ref No.', 'Seller', 'Total', 'Order Status', 'Payment Status', 'Payment Type']) {
      expect(headers.some((h) => h.includes(col))).toBeTruthy();
    }

    const rowCount = await page.locator('table tbody tr').count();
    expect(rowCount).toBeGreaterThan(0);

    const firstRowText = await page.locator('table tbody tr').first().innerText();
    // สถานะออเดอร์/สถานะการชำระต้องมีค่าจริง ไม่ใช่ placeholder ว่าง — ⚠️ "ชำระเงินแล้ว" ในระบบจริงสะกด
    // ซ้ำ เ 2 ตัว ("ชำระเงินเเล้ว") เช็คแค่ "ชำระเงิน" (partial) กันพลาดจากปัญหาการสะกดนี้
    expect(firstRowText).toMatch(/ใหม่|ส่งใบสั่งซื้อแล้ว|รับออเดอร์แล้ว|สินค้าออกจากคลัง|รับสินค้าแล้ว|ถูกยกเลิก|ถูกปฏิเสธ|หมดอายุ|รอจัดส่งการสั่งซื้อ/);
    expect(firstRowText).toMatch(/รอชำระ|รอตรวจสอบ|ชำระเงิน|ยกเลิก|ส่งสลิปใหม่/);

    const firstDetailLink = page.locator('table tbody tr').first().locator('a').filter({ hasText: 'ดูรายละเอียด' });
    await expect(firstDetailLink).toBeVisible();
    await firstDetailLink.click();
    await page.waitForLoadState('networkidle').catch(() => {});
    await expect(page).toHaveURL(/\/arinlink\/order-management\/order\/\d+/);
  });
});
