import { Page, Locator } from '@playwright/test';

/**
 * Page object สำหรับ MedEx Marketplace (https://app-stg.arincare.com/companies/marketplace)
 * Selectors ทั้งหมดยืนยันจาก DOM จริงบน staging (2026-09-07) — ดู
 * docs/medex-cart-badge-discovery/ สำหรับหลักฐาน raw HTML ที่ใช้อ้างอิง
 *
 * ⚠️ Cart popover บน Desktop เปิดด้วย HOVER ไม่ใช่ click — ปุ่ม "ตะกร้าสินค้าของฉัน"
 * (#nav-cart-button) เมื่อคลิกจะ navigate ตรงไปหน้าตะกร้าเต็มทันที (ไม่เปิด popup)
 */
export class MedExMarketplacePage {
  constructor(readonly page: Page) {}

  /**
   * กด "ตกลง" ใน modal ยืนยัน ถ้ามี — ใช้ตรงนี้ทุกจุดแทนการเขียนซ้ำ
   * ⚠️ พบจริงว่าคลิกแบบ force เฉยๆ ไม่พอ — คลิกไม่ error แต่ modal ไม่ปิดจริง (อาจเพราะคลิกกลาง
   * animation ตำแหน่งปุ่มยังไม่นิ่ง) เหลือ modal ค้าง intercept ปุ่มอื่นทั้งหน้าต่อเนื่อง (พบ 2026-09-07)
   * ต้อง "verify ผลลัพธ์" คือรอให้ปุ่มหายไปจริง (modal ปิดแล้ว) ไม่ใช่แค่คลิกแล้วเดาว่าสำเร็จ
   */
  private async clickConfirmIfPresent() {
    const confirmBtn = this.page.getByRole('button', { name: 'ตกลง', exact: true });
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click();
      const closed = await confirmBtn
        .waitFor({ state: 'hidden', timeout: 5000 })
        .then(() => true)
        .catch(() => false);
      if (!closed) {
        // ลองอีกครั้งด้วย force เผื่อคลิกแรกพลาดจังหวะ animation แล้ว verify ซ้ำ
        await confirmBtn.click({ force: true }).catch(() => {});
        await confirmBtn.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
      }
    }
  }

  async goto() {
    await this.page.goto('/companies/marketplace?page=1', { waitUntil: 'domcontentloaded' });
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async gotoCartPage() {
    await this.page.goto('/companies/marketplace/cart', { waitUntil: 'domcontentloaded' });
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(800);
  }

  /**
   * ค้นหาสินค้าด้วยชื่อ หรือ รหัสสินค้า (PCOxxxxx) ผ่านช่องค้นหาบน header ของ Marketplace
   * ⚠️ กด Enter ที่ช่อง input ไม่ trigger การค้นหาจริง (ยืนยันจาก debug จริง 2026-09-07)
   * ⚠️ ห้ามใช้ปุ่ม "ค้นหา" (icon แว่นขยาย) — บน mobile viewport (ยืนยันทั้ง Chrome/Safari) ปุ่มนี้ไม่มี
   * ข้อความ "ค้นหา" ที่ actionable ให้คลิก ทำให้ `button:has-text("ค้นหา")` ค้าง/timeout เสมอ ให้คลิก
   * suggestion ตัวแรกใน autocomplete dropdown แทน — ใช้งานได้เหมือนกันทั้ง Desktop และ Mobile
   * ⚠️ ระวัง: ชื่อสินค้าบางตัวมีซ้ำในแคตตาล็อก (พบ "PROSCAR 5 MG TABLETS 30'S" 2 รายการต่างกัน
   * — ตัวในสต็อกกับตัว OUT OF STOCK ที่มีราคา/หน่วยต่างกัน) ผลค้นหาลำดับแรกไม่การันตีว่าตรงกับที่ต้องการ
   * เท่าที่เป็นไปได้ควรค้นด้วยรหัสสินค้า (unique) แทนชื่อ หรือใช้ productCard() ตรงจากหน้า grid แทน
   */
  async searchProduct(query: string) {
    const searchInput = this.page.locator('#product-search');
    await searchInput.fill(query);
    // ⚠️ สำคัญ: ต้องรอ debounce ของ autocomplete ก่อนเช็ค dropdown — พบจริงว่าถ้าคลิกเร็วเกินไป dropdown
    // ยังโชว์ suggestion "ล่าสุดที่เคยค้น/เพิ่ม" ค้างอยู่ (เช่น ค้น PCO12281 แต่ dropdown ยังโชว์
    // PCO00092 ตัวก่อนหน้า) ทำให้กดผิดสินค้าไปเงียบๆ โดยไม่มี error ใดๆ (พบจริง 2026-09-07)
    await this.page.waitForTimeout(1000);
    const suggestion = this.page.locator('.dropdown-menu li a').first();
    await suggestion.waitFor({ state: 'visible', timeout: 8000 });
    await suggestion.click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(1200);
  }

  /** การ์ดสินค้าตัวแรกที่ตรงกับชื่อ (ต้องอยู่ในหน้าปัจจุบันแล้ว — เรียก searchProduct() ก่อนถ้าจำเป็น) */
  productCard(productName: string): Locator {
    return this.page.locator('.link-product').filter({ hasText: productName }).first();
  }

  /**
   * ค้นหาแล้วคืนการ์ดสินค้า "ตัวแรกที่ยังมีของขาย" ของผลลัพธ์ (ใช้เมื่อรู้แค่รหัสสินค้า ไม่รู้ชื่อเป๊ะ)
   * ⚠️ ข้ามการ์ด Out of Stock อัตโนมัติ — พบจริงว่าค้นด้วยรหัสบางตัวอาจได้ผลลัพธ์แรกเป็นสินค้าซ้ำที่หมดสต็อก
   * จากคนละร้านค้า/ผู้ขาย (พบจริงกับ PROSCAR และ TANSY — แคตตาล็อก staging มีข้อมูลซ้ำข้ามร้าน) ถ้าเลือกตัว
   * OOS มาโดยไม่ตั้งใจ ปุ่มเพิ่มลงตะกร้าจะ disabled แล้ว addToCart() ค้าง — ถ้ารู้ชื่อสินค้าที่คาดหวังแน่นอน
   * ส่ง expectedName เพิ่มเพื่อกรองให้แม่นขึ้น (ป้องกันได้สินค้าคนละตัวที่ชื่อ/รหัสคล้ายกันข้ามร้าน)
   */
  async findProductBySearch(query: string, expectedName?: string): Promise<Locator> {
    await this.searchProduct(query);
    const candidates = this.page.locator('.link-product');
    const count = await candidates.count();
    let firstNonOos: Locator | null = null;
    for (let i = 0; i < count; i++) {
      const c = candidates.nth(i);
      const oos = await c.locator('.out-of-stock-label').isVisible({ timeout: 1000 }).catch(() => false);
      if (oos) continue;
      if (!firstNonOos) firstNonOos = c;
      if (expectedName) {
        const text = await c.innerText().catch(() => '');
        if (text.includes(expectedName)) return c;
      } else {
        return c;
      }
    }
    return firstNonOos ?? candidates.first();
  }

  /** ทำ add-to-cart บนหน้ารายละเอียดสินค้าที่เปิดอยู่ปัจจุบัน (เลือกหน่วยแรกที่มีจริง + จำนวน 1 + กดเพิ่ม) — ใช้ภายใน addToCart() เมื่อการ์ด list ไม่มี control (มือถือ) */
  async addToCartOnCurrentDetailPage(qty: number | string = 1) {
    const unitSelect = this.page.locator('select:has(option:text-is("เลือกหน่วยสินค้า"))').first();
    if (await unitSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await unitSelect.selectOption({ index: 1 }); // เลือกหน่วยแรกที่มีจริง (ไม่ใช่ placeholder "เลือกหน่วยสินค้า")
    }
    const qtyInput = this.page.locator('input[placeholder="จำนวน"]').first();
    if (await qtyInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      // ค่าเริ่มต้นของช่องนี้คือ "0" (ไม่ใช่ empty string) — ต้อง fill ทับเสมอ ไม่ใช่แค่ตอน current ว่าง
      // มิฉะนั้นจำนวนจะค้างที่ 0 แล้วกดเพิ่มลงตะกร้าไม่ผ่าน (บั๊กที่เจอจริง 2026-09-07)
      await qtyInput.fill(String(qty));
    }
    const detailAddBtn = this.page.locator('button.btn-success').filter({ hasText: 'เพิ่มลงในตะกร้า' }).first();
    await detailAddBtn.click();
    await this.clickConfirmIfPresent();
    await this.page.waitForTimeout(1200);
  }

  /**
   * ค้นหาสินค้าด้วยรหัส/ชื่อ → ใส่จำนวนที่ระบุในช่อง inline บนการ์ด (Desktop) → เพิ่มลงตะกร้า
   * ⚠️ ใช้ flow inline-card (setQuantity + addToCart) ไม่ใช่ flow หน้ารายละเอียด — เพราะ
   * addToCartOnCurrentDetailPage() ถูกออกแบบ/ทดสอบไว้เฉพาะ mobile fallback เท่านั้น ลองใช้บน Desktop
   * แล้วเงียบๆ ไม่เพิ่มอะไรเข้าตะกร้าเลย (พบจริง 2026-09-09)
   */
  async addToCartWithQty(query: string, qty: number) {
    const card = await this.findProductBySearch(query);
    await this.setQuantity(card, qty);
    await this.addToCart(card);
  }

  /**
   * เพิ่มสินค้าลงตะกร้า — รองรับ 2 flow ที่ต่างกันจริงระหว่าง Desktop กับ Mobile (ยืนยัน 2026-09-07):
   *  - Desktop: การ์ดบน grid/list มีปุ่ม `.btn-add-to-cart` + unit/qty inline อยู่แล้ว กดตรงนั้นได้เลย
   *  - Mobile: การ์ดบน grid/list **ไม่มี** ปุ่ม/ตัวเลือกใดๆ ต้องแตะเข้าไปหน้ารายละเอียดสินค้าก่อน
   *    (URL รูปแบบ /companies/marketplace/{companySlug}/{id}) ซึ่งมี select หน่วย + ช่องจำนวน + ปุ่ม
   *    "เพิ่มลงในตะกร้า" (class ต่างจาก Desktop) แยกเป็นคนละ component กันโดยสิ้นเชิง เพิ่มเสร็จแล้วต้อง
   *    goBack() กลับมาหน้าเดิมเพื่อให้ locator ของการ์ดที่ผู้เรียกถืออยู่ยังใช้เช็ค badge ต่อได้
   */
  async addToCart(productCardLocator: Locator) {
    const inlineAddBtn = productCardLocator.locator('.btn-add-to-cart');
    const inlineVisible = await inlineAddBtn.isVisible({ timeout: 3000 }).catch(() => false);

    if (inlineVisible) {
      await inlineAddBtn.click();
      // โปรโมชั่นบางตัวมี modal "ยืนยันการเพิ่มสินค้าในรายการสั่งซื้อ" คั่นก่อนเพิ่มจริง — กด "ตกลง" ถ้ามี
      await this.clickConfirmIfPresent();
      await this.page.waitForTimeout(1200);
      return;
    }

    // Mobile fallback: ไม่มีปุ่มบนการ์ด list -> แตะเข้าไปหน้ารายละเอียดสินค้า
    const link = productCardLocator.locator('a').first();
    await link.click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(1200);

    await this.addToCartOnCurrentDetailPage();

    await this.page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(800);
  }

  inCartBadge(productCardLocator: Locator): Locator {
    return productCardLocator.locator('.in-cart-badge');
  }

  async getInCartTitle(productCardLocator: Locator): Promise<string | null> {
    const badge = this.inCartBadge(productCardLocator);
    if (!(await badge.isVisible().catch(() => false))) return null;
    return (await badge.getAttribute('title'))?.trim() ?? null;
  }

  unitSelect(productCardLocator: Locator): Locator {
    return productCardLocator.locator('select.select-unit');
  }

  async unitOptionCount(productCardLocator: Locator): Promise<number> {
    return this.unitSelect(productCardLocator).locator('option').count();
  }

  async selectUnit(productCardLocator: Locator, unitLabel: string) {
    await this.unitSelect(productCardLocator).selectOption({ label: unitLabel.trim() });
  }

  async setQuantity(productCardLocator: Locator, qty: number) {
    await productCardLocator.locator('.productQuantity').fill(String(qty));
  }

  // ---- Header cart button + hover popover ----

  get cartButton(): Locator {
    return this.page.locator('#nav-cart-button');
  }

  /** ตัวเลข badge บนไอคอนตะกร้า (มุมขวาบนปุ่ม) — ไม่มี class เฉพาะ ใช้ span ตัวสุดท้ายในปุ่ม */
  get cartCountBadge(): Locator {
    return this.cartButton.locator('span').last();
  }

  async hoverCart() {
    await this.cartButton.hover();
    await this.page.waitForTimeout(800); // รอ transition ของ popover
  }

  get cartPopover(): Locator {
    return this.page.locator('.cart-popover-content');
  }

  get cartPopoverItemCountLabel(): Locator {
    // "N รายการ" badge ใน header ของ popover
    return this.cartPopover.locator('.cart-popover-header span').nth(1);
  }

  cartPopoverRow(productName: string): Locator {
    return this.cartPopover.locator('.cart-items-table tbody tr').filter({ hasText: productName });
  }

  get cartPopoverGrandTotal(): Locator {
    return this.cartPopover.locator('.cart-popover-footer span').last();
  }

  get viewCartButton(): Locator {
    return this.cartPopover.locator('.cart-view-btn');
  }

  async openCartViaPopover() {
    await this.hoverCart();
    await this.viewCartButton.click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  // ---- หน้าตะกร้าเต็ม (/companies/marketplace/cart) ----

  cartPageRow(productName: string): Locator {
    return this.page.locator('tr').filter({ hasText: productName });
  }

  /**
   * ⚠️ **สำคัญ**: ตะกร้าไม่มี checkbox เลือกสินค้ารายตัว — granularity ของการเลือกคือ "รายร้านค้า
   * (seller group)" เท่านั้น (ยืนยันจริง 2026-09-09) สินค้าแต่ละรายการถูกจัดกลุ่มเป็นตาราง mini-table
   * แยกตามร้านค้าที่ขาย แต่ละตารางมี checkbox ของตัวเองอยู่ใน `<thead><tr><th>` (ไม่ใช่ต่อแถวสินค้า)
   * ติ๊กแล้วเลือก/ยกเลิกสินค้า "ทั้งหมดของร้านนั้น" พร้อมกัน — ถ้าร้านมีสินค้าชิ้นเดียวก็จะดูเหมือนเลือก
   * รายชิ้นได้ แต่จริงๆ แล้วคือเลือกทั้งร้าน (ค้นพบตอนเขียน automation TC-E2E-CART-002 ที่ตั้งใจทดสอบ
   * "เลือกสินค้าบางส่วน" — ใช้สินค้า 2 ชิ้นจาก 2 ร้านต่างกันแทน จึงเป็นการทดสอบที่ตรงกับ UI จริงพอดี)
   */
  sellerGroupCheckbox(sellerName: string): Locator {
    return this.page.locator('tr').filter({ hasText: sellerName }).locator('input[type="checkbox"]').first();
  }

  /** ไอคอนถังขยะ "ลบสินค้า" เป็น svg ตัวเดียวในแถว ไม่มี class เฉพาะ */
  async removeFromCartPage(productName: string) {
    const row = this.cartPageRow(productName);
    await row.locator('svg').last().click();
    await this.clickConfirmIfPresent();
    await this.page.waitForTimeout(1200);
  }

  async setCartPageQuantity(productName: string, qty: number) {
    const row = this.cartPageRow(productName);
    const qtyInput = row.locator('input[type="number"]').last();
    await qtyInput.fill(String(qty));
    await qtyInput.press('Tab');
    await this.page.waitForTimeout(1200);
  }

  // ---- Promotion/Coupon บนหน้าตะกร้า (หัวข้อ 12.4, TC-CARTPRICE-013–021) ----

  /**
   * อ่านค่าตัวเลขจากแถว Summary ท้ายบิล (ราคารวม/ส่วนลดโปรโมชั่น/ได้รับคูปองส่วนลด/ค่าส่ง/
   * ราคาก่อนภาษี/ภาษี/ยอดสุทธิ) — คืนค่าเป็น number (ตัด comma/เครื่องหมายลบแปลงเป็นค่าลบจริง)
   */
  async cartSummaryValue(label: string): Promise<number> {
    // ⚠️ ใช้ regex ดึงตัวเลขตัวสุดท้ายจาก text ทั้งแถวแทนการอิง td ตำแหน่งตรงๆ — โครงสร้างแถวเปลี่ยนได้
    // (เช่นแถวคูปองมีทั้ง label + ลิงก์ "เลือกคูปองส่วนลด" + ค่าตัวเลข ปนกันใน td เดียว/หลาย td)
    const rowText = await this.page.locator('tr').filter({ hasText: label }).last().innerText();
    const matches = rowText.replace(/,/g, '').match(/-?\d+\.\d{2}/g);
    return matches ? parseFloat(matches[matches.length - 1]) : NaN;
  }

  /** แถวส่วนลดโปรโมชั่นท้ายบิล (ใต้รายการสินค้า เหนือ Summary) — แต่ละแถวคือ 1 โปรโมชั่นที่ apply อยู่ */
  get cartPromoRows(): Locator {
    return this.page.locator('tr').filter({ has: this.page.locator('td svg') }).filter({ hasNot: this.page.locator('th') });
  }

  get selectCouponLink(): Locator {
    return this.page.getByText('เลือกคูปองส่วนลด', { exact: false }).first();
  }

  /** true ถ้ามีคูปองถูก apply อยู่แล้ว (ลิงก์ "เลือกคูปองส่วนลด" หายไป แสดงชื่อคูปองที่ใช้แทน) */
  async hasCouponApplied(): Promise<boolean> {
    return !(await this.selectCouponLink.isVisible({ timeout: 3000 }).catch(() => false));
  }

  get couponModal(): Locator {
    return this.page.getByText('โค้ดคูปองส่วนลด', { exact: false }).first();
  }

  /**
   * เปิด modal คูปอง → กด "ใช้โค้ด" ของคูปองที่ระบบแนะนำให้อัตโนมัติ (แสดงเป็นการ์ดในโมดัล)
   * ⚠️ ไม่ scope ด้วย couponCode text เพราะโครงสร้าง DOM ซ้อนหลายชั้น การหา ancestor div ที่ "พอดี"
   * (มีทั้ง code text และปุ่มอยู่ในกรอบเดียวกัน) เปราะบาง — ใช้ปุ่ม "ใช้โค้ด" ตัวแรกที่เจอแทน เพราะโมดัล
   * ปกติแสดงคูปองแนะนำที่เข้าเงื่อนไขแค่ใบเดียว (พบจริง 2026-09-09)
   */
  async applyCoupon(couponCode: string) {
    // ⚠️ idempotent — ถ้ามีคูปองถูก apply ค้างอยู่แล้วจากรันก่อนหน้า (ตะกร้าเป็น server-side shared
    // state) ก็ถือว่า precondition ผ่านแล้ว ไม่ต้องกดซ้ำ (กดซ้ำจะหาลิงก์ "เลือกคูปองส่วนลด" ไม่เจอ timeout)
    if (await this.hasCouponApplied()) return;
    await this.selectCouponLink.click();
    await this.page.waitForTimeout(1200);
    await this.page.getByText(couponCode).first().waitFor({ state: 'visible', timeout: 5000 });
    await this.page.getByRole('button', { name: 'ใช้โค้ด' }).first().click();
    await this.page.waitForTimeout(1500);
  }

  /**
   * อ่านคอลัมน์ "รวม" กับ "ราคาหลังลด" ของแถวสินค้า — หา td ที่เป็นตัวเลข (มีจุดทศนิยม 2 ตำแหน่ง) แล้ว
   * เอา 2 ตัวสุดท้าย เพราะ "ราคาหลังลด" อยู่ท้ายสุดก่อนปุ่มลบเสมอ ("รวม" อยู่ก่อนหน้า) — ทนทานกว่าการนับ
   * ตำแหน่ง td ตรงๆ เพราะ layout มี select/input ปนอยู่ในแถวเดียวกัน
   */
  async cartPageRowTotals(productName: string): Promise<{ total: number; discountedTotal: number }> {
    const cells = await this.cartPageRow(productName).locator('td').allInnerTexts();
    const numeric = cells
      .map((c) => c.replace(/,/g, '').trim())
      .filter((c) => /^-?\d+\.\d{2}$/.test(c))
      .map(Number);
    const n = numeric.length;
    return { total: numeric[n - 2], discountedTotal: numeric[n - 1] };
  }

  // ---- หน้าตะกร้าเต็ม — เลือกสินค้า + ไปหน้าชำระเงิน (หัวข้อ 13, TC-E2E-CART-*) ----

  /**
   * checkbox "เลือกซื้อรายการสินค้า (เลือกทั้งหมด)" — ⚠️ ห้ามใช้ input[type=checkbox].first() เฉยๆ
   * เพราะ checkbox ตัวแรกบนหน้าคือ "ที่อยู่ในการออกใบกำกับภาษี" (คนละตัว) ต้องหาด้วย exact-text label
   * แล้วใช้ XPath preceding-sibling เท่านั้น (ยืนยันจริง 2026-09-09)
   */
  get selectAllCheckbox(): Locator {
    return this.page
      .getByText('เลือกซื้อรายการสินค้า (เลือกทั้งหมด)', { exact: true })
      .locator('xpath=preceding-sibling::input[@type="checkbox"][1]');
  }

  async selectAllInCart() {
    await this.selectAllCheckbox.click();
    await this.page.waitForTimeout(500);
  }

  get payButton(): Locator {
    return this.page.locator('button').filter({ hasText: 'ชำระเงิน' }).first();
  }

  /** เลือกทั้งหมด + กดชำระเงิน → รอ navigate ไป /companies/marketplace/payment */
  async goToPayment() {
    await this.selectAllInCart();
    await this.payButton.click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(1500);
  }
}
