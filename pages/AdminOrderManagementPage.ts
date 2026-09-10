import { Page, Locator } from '@playwright/test';
import { adminLogin } from './adminLogin.js';

/**
 * Page object สำหรับ Admin Order Management (admin-stg.arincare.com/arinlink/order-management/*)
 * Selectors ยืนยันจาก DOM จริงบน staging (2026-09-09) — ดู docs/e2e-cart-payment-discovery/
 *
 * ⚠️ Payment Status / Order Status ในตาราง list เป็น Bootstrap dropdown เปลี่ยนได้ทันที แต่
 * <ul class="dropdown-menu"> ถูก "teleport" ออกจาก <tr> ไปอยู่ที่อื่นใน DOM ตอนเปิด (แม้ parent
 * .dropdown จะได้ class "open" ก็ตาม) — ต้อง query แบบ global ทั้งหน้าด้วย ul.dropdown-menu:visible
 * ไม่ใช่ scope อยู่ในแถว (พบจริงจากการทดสอบ ใช้เวลาแก้หลายรอบกว่าจะเจอ root cause)
 */
export class AdminOrderManagementPage {
  constructor(readonly page: Page) {}

  async login(baseUrl: string, email: string, password: string) {
    await adminLogin(this.page, baseUrl, email, password);
    await this.page.waitForTimeout(1500);
  }

  async gotoCartList(baseUrl: string) {
    await this.page.goto(`${baseUrl}/arinlink/order-management/cart?page=1`, { waitUntil: 'domcontentloaded' });
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(1200);
  }

  async gotoOrderList(baseUrl: string) {
    await this.page.goto(`${baseUrl}/arinlink/order-management/order?page=1`, { waitUntil: 'domcontentloaded' });
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(1200);
  }

  /** แถวในตาราง Cart/Order list — ค้นด้วย Ref No. หรือ เลขที่ออเดอร์ */
  rowByRef(refNo: string): Locator {
    return this.page.locator('tr').filter({ hasText: refNo }).first();
  }

  async hasRow(refNo: string): Promise<boolean> {
    return this.rowByRef(refNo).isVisible({ timeout: 5000 }).catch(() => false);
  }

  /**
   * เปลี่ยนสถานะการชำระเงินของแถวใน Cart list ผ่าน dropdown เช่น "ชำระเงินเเล้ว" (partial-text match
   * เพราะ DB สะกดซ้ำ เ 2 ตัวจริง) → กรอกช่อง "หมายเหตุ" (required — ถ้าไม่กรอกปุ่มบันทึกจะไม่ทำงานแบบ
   * ไม่มี error message ชัดเจน) → กด "บันทึก"
   */
  async changeCartPaymentStatus(refNo: string, statusPartialText: string, remark: string) {
    const row = this.rowByRef(refNo);
    await row.locator('.dropdown-toggle').first().click();
    await this.page.waitForTimeout(500);

    const openMenu = this.page.locator('ul.dropdown-menu:visible').first();
    await openMenu.locator('li a').filter({ hasText: statusPartialText }).first().click({ timeout: 10000 });
    await this.page.waitForTimeout(1200);

    const remarkTextarea = this.page.locator('textarea').first();
    if (await remarkTextarea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await remarkTextarea.fill(remark);
    }
    await this.page.getByRole('button', { name: 'บันทึก', exact: true }).click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(1500);
  }

  async getRowText(refNo: string): Promise<string> {
    return this.rowByRef(refNo).innerText().catch(() => '');
  }

  /**
   * กด "ดูรายละเอียด" ของแถวปัจจุบัน (ใช้ได้ทั้ง Cart list → /order-management/cart/{id} และ
   * Order list → /order-management/order/{id} เพราะ selector รูปแบบเดียวกัน: a.btn-info.btn-xs
   * ที่มีข้อความ "ดูรายละเอียด")
   */
  async openDetail(refNo: string) {
    const row = this.rowByRef(refNo);
    await row.locator('a').filter({ hasText: 'ดูรายละเอียด' }).first().click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(1200);
  }

  // ---- Order Detail page (/arinlink/order-management/order/{id}) ----

  /** ลิงก์ Ref No. (LC-xxx) ใน breadcrumb ของหน้า Order Detail — ยืนยันความสัมพันธ์ Cart↔Order ตรงๆ */
  cartRefLinkOnOrderDetail(cartRefNo: string): Locator {
    return this.page.locator('a').filter({ hasText: cartRefNo });
  }

  // ⚠️ ต้องหาด้วย exact-text label แล้ว XPath following-sibling เท่านั้น — ถ้าใช้ hasText แบบกว้างๆ
  // จะไปจับ .dropdown-toggle ตัวอื่นในหน้า (เช่น dropdown filter ที่แถบด้านซ้าย) แทนตัวที่ต้องการ
  // (พบจริงจากการรัน automation — ได้ค่า "Select..." ของ filter แทนสถานะจริง)
  get orderDetailPaymentStatusDropdown(): Locator {
    return this.page
      .getByText('สถานะชำระเงิน :', { exact: true })
      .locator('xpath=following-sibling::div[1]//button[contains(@class,"dropdown-toggle")]');
  }

  get orderDetailOrderStatusDropdown(): Locator {
    return this.page
      .getByText('สถานะออเดอร์ :', { exact: true })
      .locator('xpath=following-sibling::div[1]//button[contains(@class,"dropdown-toggle")]');
  }

  /** อ่านค่าใน Summary ท้ายตารางสินค้า (ราคารวม/ส่วนลดโปรโมชั่น/คูปองส่วนลด/ค่าขนส่ง/ราคาก่อนภาษี/ภาษี/ยอดสุทธิ) */
  summaryValue(label: string): Locator {
    return this.page.locator('tr').filter({ hasText: label }).locator('td').last();
  }
}
