import { Page, Locator } from '@playwright/test';
import { adminLogin } from './adminLogin.js';

/**
 * Page object สำหรับหน้าสร้าง/แก้ไขใบเสนอราคา (PO) — admin-stg.arincare.com/arinlink/sales-manage-order/po/{uuid}
 * Selectors ยืนยันจาก DOM จริงบน staging (2026-09-09) — ดู docs/admin-po-discovery/
 * และ docs/test-cases/Arincare_MedEx_ProductCardInCartBadge_TestPlan.md หัวข้อ 12.7.6
 *
 * ⚠️ ก่อนกด "บันทึกใบเสนอราคา" ได้สำเร็จ ต้องกรอกครบ: Sale Zone, ลูกค้า (customer), ที่อยู่ 3 แบบ —
 * ✅ เลือกลูกค้าแล้ว **ที่อยู่ทั้ง 3 auto-fill ให้อัตโนมัติ** ไม่ต้องกรอกเองเลย (ยืนยันจริง 2026-09-09)
 * ⚠️ "ร้านค้าบน MKP" ต้องใช้ supplier "บริษัททดสอบการซื้อสินค้า B (MKPv2)" (มีสินค้าขายจริง) ไม่ใช่ "Arincare"
 * (Arincare ไม่มีสินค้าในแคตตาล็อกให้ค้นหา — ทดสอบแล้วได้ผลลัพธ์ว่างเปล่า)
 */
export class AdminQuotationPage {
  constructor(readonly page: Page) {}

  async login(baseUrl: string, email: string, password: string) {
    await adminLogin(this.page, baseUrl, email, password);
    await this.page.waitForTimeout(1500);
  }

  /** เข้าหน้า PO list → กด "สร้างใบเสนอราคา" → ไปหน้าฟอร์ม /sales-manage-order/po/{uuid} */
  async gotoCreatePO(baseUrl: string) {
    await this.page.goto(`${baseUrl}/arinlink/sales-manage-order/po`, { waitUntil: 'domcontentloaded' });
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(1500);
    await this.page.locator('button, a').filter({ hasText: 'สร้างใบเสนอราคา' }).first().click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(2000);
  }

  /** ต้องเลือกก่อนบันทึกได้ (required field) — เป็น <select> จริง ไม่ใช่ custom dropdown */
  async selectSaleZone(optionIndex = 1) {
    await this.page.locator('select#form_sales_zone').selectOption({ index: optionIndex });
    await this.page.waitForTimeout(500);
  }

  /** ค้นหาลูกค้าด้วย ARC ID/ชื่อร้าน แล้วเลือกผลลัพธ์แรก — ที่อยู่ทั้ง 3 แบบ auto-fill ตามมาด้วย */
  async searchCustomer(query: string) {
    await this.page.locator('#company_search').fill(query);
    await this.page.waitForTimeout(1500);
    const dropdown = this.page.locator('ul.dropdown-menu li a:visible').first();
    await dropdown.waitFor({ state: 'visible', timeout: 8000 });
    await dropdown.click();
    await this.page.waitForTimeout(800);
    // ปุ่ม "เลือก" ตัวแรกในหน้า = ของฝั่งลูกค้า (customer)
    await this.page.locator('button').filter({ hasText: 'เลือก' }).first().click();
    await this.page.waitForTimeout(1500);
  }

  get customerArcIdField(): Locator {
    return this.page.locator('#company_info_arc_reference_code');
  }
  get customerNameField(): Locator {
    return this.page.locator('#company_info_name');
  }

  get storeTypeMkpButton(): Locator {
    return this.page.locator('button').filter({ hasText: 'ร้านค้าบน MKP' }).first();
  }
  get storeTypeOfflineButton(): Locator {
    return this.page.locator('button').filter({ hasText: 'ร้านค้า Offline' }).first();
  }

  /**
   * ค้นหาร้านค้า (supplier — คนละช่องกับลูกค้า) แล้วเลือกผลลัพธ์แรก — ต้องทำก่อน "เพิ่มสินค้า" เสมอ
   * ⚠️ ใช้ label text "ค้นหาชื่อร้านค้า" หา input (เสถียรกว่า placeholder ที่เปลี่ยนได้ตามค่าที่เคยพิมพ์)
   * และต้อง filter `:visible` ที่ตัว `a` เองด้วย ไม่ใช่แค่ container เพราะมี dropdown จากขั้นตอนก่อนหน้า
   * (เช่นค้นหาลูกค้า) ค้างอยู่ใน DOM แบบซ่อนไว้หลายอัน
   */
  async searchSupplier(query: string) {
    const supplierLabel = this.page.getByText('ค้นหาชื่อร้านค้า', { exact: true });
    await supplierLabel.waitFor({ state: 'visible', timeout: 10000 });
    const input = supplierLabel.locator('xpath=following::input[1]');
    await input.click();
    await input.fill(query);
    await this.page.waitForTimeout(2000);
    const dropdown = this.page.locator('ul.dropdown-menu li a:visible').first();
    await dropdown.waitFor({ state: 'visible', timeout: 8000 });
    await dropdown.click();
    await this.page.waitForTimeout(800);
    // ปุ่ม "เลือก" ตัวที่สองในหน้า = ของฝั่งร้านค้า (supplier)
    await this.page.locator('button').filter({ hasText: 'เลือก' }).nth(1).click();
    await this.page.waitForTimeout(1000);
  }

  get supplierIdField(): Locator {
    return this.page.locator('input[placeholder="Supplier ID"]');
  }

  get addProductButton(): Locator {
    return this.page.locator('button').filter({ hasText: 'เพิ่มสินค้า' }).first();
  }

  /** modal/alert แจ้งเตือน "กรุณาเลือกร้านค้าก่อน" ที่ขึ้นถ้ากด "เพิ่มสินค้า" โดยยังไม่ได้เลือก supplier */
  get selectSupplierFirstAlert(): Locator {
    return this.page.getByText('กรุณาเลือกร้านค้าก่อน', { exact: false });
  }

  /**
   * เพิ่มแถวสินค้าใหม่ + ค้นหา + เลือกสินค้าที่ตรงชื่อเป๊ะ + เลือกหน่วย + ใส่จำนวน
   * ⚠️ "เพิ่มสินค้า" เพิ่มแถวว่างเข้าตารางตรงๆ ไม่ใช่เปิด modal — ช่องค้นหาชื่อสินค้าในแถวที่ index `n`
   * คือ `#detail_product_name_{n}` (n=0 สำหรับแถวแรก) ต้องกด "เพิ่มสินค้า" ก่อนเสมอเพื่อสร้างแถวใหม่ก่อน
   */
  async addProduct(query: string, exactName: string, qty: number, unitIndex = 1) {
    const rowsBefore = await this.page.locator('table tbody tr').filter({ has: this.page.locator('input[id*="detail_product_name_"]') }).count();
    await this.addProductButton.click();
    await this.page.waitForTimeout(1200);

    const rowIndex = rowsBefore; // แถวใหม่ที่เพิ่งเพิ่มคือ index ถัดจากที่มีอยู่
    const productNameInput = this.page.locator(`#detail_product_name_${rowIndex}`);
    await productNameInput.fill(query);
    await this.page.waitForTimeout(1800);
    const option = this.page.locator('ul.dropdown-menu li a:visible').filter({ hasText: exactName }).first();
    await option.waitFor({ state: 'visible', timeout: 8000 });
    await option.click();
    await this.page.waitForTimeout(1200);

    const row = this.page.locator('table tbody tr').filter({ has: productNameInput });
    await row.locator('select').first().selectOption({ index: unitIndex });
    await this.page.waitForTimeout(500);
    await row.locator('input[type="number"]:not([readonly])').first().fill(String(qty));
    await this.page.waitForTimeout(1000);
  }

  get saveQuotationButton(): Locator {
    return this.page.locator('button').filter({ hasText: 'บันทึกใบเสนอราคา' }).first();
  }
  get exportQuotationButton(): Locator {
    return this.page.locator('button').filter({ hasText: 'Export ใบเสนอราคา' }).first();
  }

  get saveSuccessMessage(): Locator {
    return this.page.getByText('บันทึกข้อมูล PO สำเร็จ', { exact: false });
  }

  async save() {
    await this.saveQuotationButton.click();
    await this.page.waitForTimeout(2000);
  }

  /**
   * อ่านค่า Summary ท้ายฟอร์ม (ราคารวม/ส่วนลดโปรโมชั่น/โค้ดคูปองส่วนลด/ค่าส่ง/ราคาก่อนภาษี/ภาษี/ยอดสุทธิ)
   * ⚠️ **แก้ไข 2026-09-09**: field ไม่มี `id` ตรงๆ (ยกเว้น ค่าส่ง = `#form_shipping_amount`) ต้องหาด้วย
   * label text แล้วไต่ไปที่ input ใน div ถัดไปของ parent เดียวกัน (label → parent → nextSibling div → input)
   */
  async summaryValue(label: string): Promise<number> {
    const labelEl = this.page.getByText(label, { exact: true }).first();
    const input = labelEl.locator('xpath=../following-sibling::div[1]//input');
    const val = await input.inputValue().catch(() => '');
    return val === '' ? 0 : parseFloat(val);
  }

  /** แถวส่วนลด/แถมสินค้าที่ apply อยู่ในตาราง "โปรโมชั่นท้ายบิล" — แต่ละแถวคือ 1 โปรโมชั่น */
  get promoSectionRows(): Locator {
    return this.page.locator('div').filter({ hasText: 'ส่วนลด' }).locator('a');
  }

  /** คอลัมน์ "ราคาหลังลด" ของแถวสินค้า (คอลัมน์สุดท้ายก่อนปุ่มลบ) */
  productRowDiscountedPrice(productNameInputLocator: Locator): Locator {
    const row = this.page.locator('table tbody tr').filter({ has: productNameInputLocator });
    return row.locator('input[type="number"][readonly]').last();
  }

  /** เข้าหน้า PO List (`/arinlink/sales-manage-order/po`) — คอลัมน์: #/Sale Zone/ARC ID/PO No./Buyer Name/Status/Date Created/Total Amount/Detail */
  async gotoPOList(baseUrl: string) {
    await this.page.goto(`${baseUrl}/arinlink/sales-manage-order/po`, { waitUntil: 'domcontentloaded' });
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(1500);
  }

  /** แถวใน PO List ที่ลิงก์ Detail ชี้ไปที่ uuid นี้ (ดึง uuid จาก page.url() ตอนอยู่หน้า edit) */
  poListRowByUuid(uuid: string): Locator {
    return this.page.locator('tr').filter({ has: this.page.locator(`a[href*="${uuid}"]`) });
  }
}
