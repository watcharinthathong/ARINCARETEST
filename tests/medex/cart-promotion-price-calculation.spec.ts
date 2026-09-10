import { test, expect } from './fixtures.js';

/**
 * MedEx: Cart Promotion/Coupon Price Calculation (หัวข้อ 12.4, TC-CARTPRICE-013–021)
 * อ้างอิง: docs/test-cases/Arincare_MedEx_ProductCardInCartBadge_TestPlan.md หัวข้อ 12.5 (ตาราง PROMO-B-*)
 * โปรโมชั่น/คูปองเหล่านี้ผู้ใช้สร้างไว้จริงบน staging สำหรับ "บริษัททดสอบการซื้อสินค้า B (MKPv2)" แล้ว
 * (ยืนยันจริง 2026-09-09 ผ่านการ live-check หน้าสินค้า — เห็นป้าย "Promo" + แบนเนอร์โปรโมชั่นจริง)
 *
 * ⚠️ **ค้นพบสำคัญที่กระทบการออกแบบเทส**: โปรโมชั่นระดับ Order (PROMO-B-001–004) **apply พร้อมกันหลายตัว
 * ในคราวเดียว** ไม่ใช่แค่ตัวที่ threshold สูงสุดที่เข้าเงื่อนไข (พบจริงว่า PROMO-B-002 ซึ่งควรต้องยอด
 * ≥3,000 ก็ยัง apply ตอนยอดแค่ ~1,550) — อาจเป็นพฤติกรรมจริงของระบบหรือ config ที่ผู้ใช้ตั้งไว้ต่างจาก
 * เอกสารต้นฉบับ (ยังไม่ยืนยัน root cause กับ Dev) ดังนั้นเทสกลุ่มนี้เลี่ยงการเดาสูตร/เลขที่แน่นอน โดยใช้
 * **reconciliation assertion** (เช็คว่าตัวเลขที่ระบบแสดงสอดคล้องกันเอง) แทนการคำนวณเลขคาดหวังเอง — วิธีนี้
 * ตรวจจับบั๊กการปันส่วน/รวมยอดผิดได้จริง โดยไม่ผูกกับสูตร business logic ที่ยังไม่ชัดเจน 100%
 *
 * 🔴 TC-CARTPRICE-015/018 (แถมสินค้า PROMO-B-005/006/012) — **ทดสอบแล้วว่าสินค้าแถมไม่ถูกเพิ่มเข้าตะกร้า
 * เลยแม้ยอด/จำนวนจะเข้าเงื่อนไขแล้วจริง** (ลอง ACCU-CHEK ACTIVE x5 = 1,550 บาท ≥ 1,500 ของ PROMO-B-005
 * แต่ไม่มี COOL BABY ปรากฏใน "โปรโมชั่นท้ายบิล" เลย มีแค่โปรโมชั่นลดราคาแบบ Order-level เท่านั้น ไม่มีปุ่ม
 * "รับสิทธิ์"/"เลือกรับ" ให้กดด้วย) — บันทึกไว้เป็น TC-CARTPRICE-015 ด้านล่าง (ยืนยันสภาพปัจจุบัน ไม่ใช่
 * เทสยืนยันว่าฟีเจอร์ทำงานถูก) **ควรแจ้ง Dev ตรวจสอบว่าเป็นบั๊กหรือยังไม่ implement**
 * ⚠️ TC-CARTPRICE-019 (Product Combination) — ต้องเตรียม cart ผสม 4 SKU ครบเงื่อนไข mandatory item
 * ซับซ้อน ยังไม่ได้ทำ (ติดเวลา ไม่ใช่ติด technical blocker)
 *
 * ⚠️ ตะกร้าเป็น server-side shared state (ดู qa-context.md) — ทุกเทสเช็คแบบ relative/reconciliation
 * ไม่ผูกกับสมมติฐานว่าตะกร้าว่างตอนเริ่ม เพื่อลด flakiness จากสินค้าค้างของเทสอื่น
 */

const ACCU_CHEK_ACTIVE = { name: 'ACCU-CHEK ACTIVE', code: 'PCO00094' }; // PROMO-B-009: ลด 5% เมื่อครบ 5 กล่อง
const TOLERANCE = 2; // บาท — เผื่อการปัดเศษสะสมหลายขั้นตอน (โปรโมชั่นหลายตัว stack กัน)

function approxEqual(a: number, b: number, tolerance = TOLERANCE) {
  return Math.abs(a - b) <= tolerance;
}

test.describe('MedEx Cart: Promotion/Coupon Price Calculation', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.use.isMobile === true, 'ทดสอบเฉพาะ Desktop — ยังไม่เคยยืนยัน selector โปรโมชั่นบน mobile viewport');
  });

  test('TC-CARTPRICE-016/017 — Product-level discount (PROMO-B-009: ACCU-CHEK ACTIVE ครบ 5 กล่อง ลด 5%)', async ({
    loggedIn,
    medexPage,
    trackedProducts,
  }) => {
    await medexPage.goto();
    const card = await medexPage.findProductBySearch(ACCU_CHEK_ACTIVE.code, ACCU_CHEK_ACTIVE.name);
    const link = card.locator('a').first();
    await link.click();
    await medexPage.page.waitForLoadState('networkidle').catch(() => {});
    await medexPage.page.waitForTimeout(1200);

    const unitSelect = medexPage.page.locator('select:has(option:text-is("เลือกหน่วยสินค้า"))').first();
    if (await unitSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await unitSelect.selectOption({ index: 1 });
    }
    await medexPage.page.locator('input[placeholder="จำนวน"], input[type="number"]').first().fill('5');
    await medexPage.page.waitForTimeout(500);
    await medexPage.page.locator('button').filter({ hasText: 'เพิ่มลงในตะกร้า' }).first().click();
    await medexPage.page.waitForTimeout(1200);
    const confirmBtn = medexPage.page.getByRole('button', { name: 'ตกลง', exact: true });
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click();
      await medexPage.page.waitForTimeout(1000);
    }
    trackedProducts.push(ACCU_CHEK_ACTIVE.name);

    await medexPage.gotoCartPage();
    const { total, discountedTotal } = await medexPage.cartPageRowTotals(ACCU_CHEK_ACTIVE.name);
    expect(total).toBeGreaterThan(0);
    expect(discountedTotal).toBeGreaterThan(0);
    // ราคาหลังลด (ปันส่วนจากยอดสุทธิทั้งบิล) ต้อง <= รวมก่อนภาษี/ก่อนโปรโมชั่นอื่น — เช็คว่ามีส่วนลดเกิดขึ้นจริง
    // ไม่เท่ากับ "รวม" เป๊ะ (ถ้าเท่ากันแปลว่าไม่มีส่วนลดใดๆ ถูก apply เลย ผิดจากที่คาด)
    expect(discountedTotal).not.toBeCloseTo(total, 1);
  });

  test('TC-CARTPRICE-013/014 — Order-level promotion reconciliation (PROMO-B-001–004 stacking)', async ({
    loggedIn,
    medexPage,
    trackedProducts,
  }) => {
    await medexPage.goto();
    const card = await medexPage.findProductBySearch(ACCU_CHEK_ACTIVE.code, ACCU_CHEK_ACTIVE.name);
    await medexPage.addToCart(card); // จำนวน default (ไม่ต้อง 5 กล่องพอดี — แค่ต้องการยอดรวม ≥1,000 เพื่อเข้าเงื่อนไข Order-level)
    trackedProducts.push(ACCU_CHEK_ACTIVE.name);

    await medexPage.gotoCartPage();

    const ราคารวม = await medexPage.cartSummaryValue('ราคารวม');
    const ส่วนลดโปรโมชั่น = await medexPage.cartSummaryValue('ส่วนลดโปรโมชั่น');
    const คูปองส่วนลด = await medexPage.cartSummaryValue('โค้ดคูปองส่วนลด');
    const ค่าส่ง = await medexPage.cartSummaryValue('ค่าส่ง');
    const ราคาก่อนภาษี = await medexPage.cartSummaryValue('ราคาก่อนภาษี');
    const ภาษี = await medexPage.cartSummaryValue('ภาษี');
    const ยอดสุทธิ = await medexPage.cartSummaryValue('ยอดสุทธิ');

    if (ราคารวม >= 1000) {
      // เข้าเงื่อนไข PROMO-B-001 อย่างน้อย 1 ตัว — ต้องมีส่วนลดโปรโมชั่นเกิดขึ้นจริง (ค่าเป็นลบ)
      expect(ส่วนลดโปรโมชั่น).toBeLessThan(0);
    }

    // Reconciliation หลัก: ราคารวม + ส่วนลดโปรโมชั่น(ลบ) + คูปอง(ลบ, ถ้ามี — ตะกร้าเป็น shared state
    // อาจมีคูปองค้างจากเทสอื่นได้) + ค่าส่ง ต้อง ≈ ยอดสุทธิ
    const computed = ราคารวม + ส่วนลดโปรโมชั่น + คูปองส่วนลด + ค่าส่ง;
    expect(approxEqual(computed, ยอดสุทธิ)).toBeTruthy();
    // ราคาก่อนภาษี + ภาษี ต้อง ≈ ยอดสุทธิ (VAT breakdown ถูกต้อง)
    expect(approxEqual(ราคาก่อนภาษี + ภาษี, ยอดสุทธิ)).toBeTruthy();
  });

  test('TC-CARTPRICE-020 — Coupon REGULAR_PRICE_10_PC ใช้ได้จริง ลดยอดสุทธิ', async ({ loggedIn, medexPage, trackedProducts }) => {
    await medexPage.goto();
    const card = await medexPage.findProductBySearch(ACCU_CHEK_ACTIVE.code, ACCU_CHEK_ACTIVE.name);
    await medexPage.addToCart(card);
    trackedProducts.push(ACCU_CHEK_ACTIVE.name);

    await medexPage.gotoCartPage();
    // ⚠️ ไม่เทียบ before/after ตรงๆ เพราะตะกร้าเป็น server-side shared state — คูปองอาจถูก apply ค้าง
    // จากเทสอื่นมาก่อนแล้ว (applyCoupon() เป็น idempotent) เช็คแค่ผลลัพธ์สุดท้ายว่าคูปอง apply อยู่จริง
    await medexPage.applyCoupon('REGULAR_PRICE_10_PC');

    const คูปองส่วนลด = await medexPage.cartSummaryValue('โค้ดคูปองส่วนลด');
    const ยอดสุทธิ = await medexPage.cartSummaryValue('ยอดสุทธิ');
    const ราคาก่อนภาษี = await medexPage.cartSummaryValue('ราคาก่อนภาษี');
    const ภาษี = await medexPage.cartSummaryValue('ภาษี');

    expect(คูปองส่วนลด).toBeLessThan(0); // คูปอง apply จริง ลดยอดจริง (ไม่ใช่ -0.00)
    expect(await medexPage.hasCouponApplied()).toBeTruthy(); // ลิงก์ "เลือกคูปองส่วนลด" หายไปแล้ว
    expect(approxEqual(ราคาก่อนภาษี + ภาษี, ยอดสุทธิ)).toBeTruthy(); // VAT breakdown ยังถูกต้องหลังใช้คูปอง
  });

  test('TC-CARTPRICE-021 — Promotion + Coupon ใช้พร้อมกัน (stacking), reconciliation ครบ', async ({
    loggedIn,
    medexPage,
    trackedProducts,
  }) => {
    await medexPage.goto();
    const card = await medexPage.findProductBySearch(ACCU_CHEK_ACTIVE.code, ACCU_CHEK_ACTIVE.name);
    await medexPage.addToCart(card);
    trackedProducts.push(ACCU_CHEK_ACTIVE.name);

    await medexPage.gotoCartPage();
    await medexPage.applyCoupon('REGULAR_PRICE_10_PC');

    const ราคารวม = await medexPage.cartSummaryValue('ราคารวม');
    const ส่วนลดโปรโมชั่น = await medexPage.cartSummaryValue('ส่วนลดโปรโมชั่น');
    const คูปองส่วนลด = await medexPage.cartSummaryValue('โค้ดคูปองส่วนลด');
    const ค่าส่ง = await medexPage.cartSummaryValue('ค่าส่ง');
    const ราคาก่อนภาษี = await medexPage.cartSummaryValue('ราคาก่อนภาษี');
    const ภาษี = await medexPage.cartSummaryValue('ภาษี');
    const ยอดสุทธิ = await medexPage.cartSummaryValue('ยอดสุทธิ');

    // ทั้ง Promotion และ Coupon ต้อง apply พร้อมกันจริง (ทั้งคู่เป็นค่าลบ ไม่ใช่แค่ตัวใดตัวหนึ่ง)
    if (ราคารวม >= 1000) {
      expect(ส่วนลดโปรโมชั่น).toBeLessThan(0);
    }
    expect(คูปองส่วนลด).toBeLessThan(0);

    // Reconciliation: Coupon หักจากยอดหลัง Promotion เสมอ (ลำดับ รายตัว→Promotion→Coupon→VAT ตามหัวข้อ 12.1)
    const computed = ราคารวม + ส่วนลดโปรโมชั่น + คูปองส่วนลด + ค่าส่ง;
    expect(approxEqual(computed, ยอดสุทธิ)).toBeTruthy();
    expect(approxEqual(ราคาก่อนภาษี + ภาษี, ยอดสุทธิ)).toBeTruthy();
  });

  test('TC-CARTPRICE-015 — 🔴 แถมสินค้า (PROMO-B-005) ยังไม่ trigger แม้เข้าเงื่อนไขยอดขั้นต่ำ (ยืนยันสภาพปัจจุบัน)', async ({
    loggedIn,
    medexPage,
    trackedProducts,
  }) => {
    // ⚠️ เทสนี้ "ยืนยันสภาพปัจจุบันของระบบ" ไม่ใช่เทสว่าฟีเจอร์ทำงานถูกต้อง — ถ้าเทสนี้ FAIL ในอนาคต
    // (คือมีสินค้าแถมปรากฏขึ้นจริง) แปลว่า Dev แก้ไข/implement ฟีเจอร์แถมสินค้าแล้ว ให้กลับไปแก้เทสนี้
    // เป็นเทสยืนยันบวก (assert ว่ามีของแถม) แทน ไม่ใช่ bug ของ automation
    await medexPage.goto();
    const card = await medexPage.findProductBySearch(ACCU_CHEK_ACTIVE.code, ACCU_CHEK_ACTIVE.name);
    const link = card.locator('a').first();
    await link.click();
    await medexPage.page.waitForLoadState('networkidle').catch(() => {});
    await medexPage.page.waitForTimeout(1200);
    const unitSelect = medexPage.page.locator('select:has(option:text-is("เลือกหน่วยสินค้า"))').first();
    if (await unitSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await unitSelect.selectOption({ index: 1 });
    }
    await medexPage.page.locator('input[placeholder="จำนวน"], input[type="number"]').first().fill('5'); // 310×5=1,550 ≥ 1,500 (PROMO-B-005 threshold)
    await medexPage.page.waitForTimeout(500);
    await medexPage.page.locator('button').filter({ hasText: 'เพิ่มลงในตะกร้า' }).first().click();
    await medexPage.page.waitForTimeout(1200);
    const confirmBtn = medexPage.page.getByRole('button', { name: 'ตกลง', exact: true });
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click();
      await medexPage.page.waitForTimeout(1000);
    }
    trackedProducts.push(ACCU_CHEK_ACTIVE.name);

    await medexPage.gotoCartPage();
    const ราคารวม = await medexPage.cartSummaryValue('ราคารวม');
    expect(ราคารวม).toBeGreaterThanOrEqual(1500); // ยืนยันว่าเข้าเงื่อนไขจริง

    const bodyText = await medexPage.page.locator('body').innerText();
    // 🔴 สภาพปัจจุบัน: ไม่มีสินค้าแถม COOL BABY (PCO01126) ปรากฏในตะกร้าเลย แม้เข้าเงื่อนไขยอดแล้ว
    expect(bodyText).not.toContain('COOL BABY');
  });

  test('TC-CARTPRICE-018 — 🔴 แถมสินค้าตามจำนวน (PROMO-B-012) ยังไม่ trigger แม้เข้าเงื่อนไขจำนวน (ยืนยันสภาพปัจจุบัน)', async ({
    loggedIn,
    medexPage,
    trackedProducts,
  }) => {
    // ⚠️ เทสนี้ "ยืนยันสภาพปัจจุบันของระบบ" เหมือน TC-CARTPRICE-015 — ถ้า FAIL ในอนาคตแปลว่า Dev แก้ไขแล้ว
    // ให้กลับไปแก้เทสเป็นยืนยันบวกแทน ไม่ใช่ automation ผิด
    const ACCUPRIL = { name: 'ACCUPRIL', code: 'PCO00110' }; // PROMO-B-012: ครบ 12 กล่อง แถม CARDURA (PCO00865)
    await medexPage.goto();
    const card = await medexPage.findProductBySearch(ACCUPRIL.code, ACCUPRIL.name);
    const link = card.locator('a').first();
    await link.click();
    await medexPage.page.waitForLoadState('networkidle').catch(() => {});
    await medexPage.page.waitForTimeout(1200);
    const unitSelect = medexPage.page.locator('select:has(option:text-is("เลือกหน่วยสินค้า"))').first();
    if (await unitSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
      await unitSelect.selectOption({ index: 1 });
    }
    await medexPage.page.locator('input[placeholder="จำนวน"], input[type="number"]').first().fill('12'); // ครบเงื่อนไขจำนวนของ PROMO-B-012 พอดี
    await medexPage.page.waitForTimeout(500);
    await medexPage.page.locator('button').filter({ hasText: 'เพิ่มลงในตะกร้า' }).first().click();
    await medexPage.page.waitForTimeout(1200);
    const confirmBtn = medexPage.page.getByRole('button', { name: 'ตกลง', exact: true });
    if (await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await confirmBtn.click();
      await medexPage.page.waitForTimeout(1000);
    }
    trackedProducts.push(ACCUPRIL.name);

    await medexPage.gotoCartPage();
    await expect(medexPage.cartPageRow(ACCUPRIL.name)).toBeVisible(); // ยืนยันว่าสินค้าเข้าตะกร้าจริง

    const bodyText = await medexPage.page.locator('body').innerText();
    // 🔴 สภาพปัจจุบัน: ไม่มีสินค้าแถม CARDURA (PCO00865) ปรากฏในตะกร้าเลย แม้ซื้อครบ 12 กล่องแล้ว
    expect(bodyText).not.toContain('CARDURA');
  });

  test('TC-CARTPRICE-019 — 🔴 Product Combination (PROMO-B-013) ครบทุกเงื่อนไขแล้วก็ยังไม่แถม (ยืนยันสภาพปัจจุบัน)', async ({
    loggedIn,
    medexPage,
    trackedProducts,
  }) => {
    // PROMO-B-013: ซื้อคละกลุ่ม ACCU-CHEK (PCO00094/95/96/97) รวมกันครบ 10 ชิ้น + ยอดขั้นต่ำ 4,000 บาท
    // + ต้องมี PCO00094 อย่างน้อย 1 ชิ้น (mandatory) → แถม ACCU-CHEK ADVANTAGE 50'S.+เข็ม (PCO00099)
    // ราคาจริงที่สำรวจ: PCO00094=310, PCO00097=759 — ใช้ 1×PCO00094 + 9×PCO00097 = 10 ชิ้น, 7,141 บาท
    // (ครบทุกเงื่อนไขพอดี รวมถึง mandatory item) — ⚠️ เทสนี้ยืนยันสภาพปัจจุบันเหมือน TC-CARTPRICE-015/018
    // เท่านั้น (แถมสินค้าทุกประเภทที่ทดสอบมาไม่ทำงานเลยในระบบตอนนี้) ไม่ได้ทดสอบ negative case ทั้ง 3
    // แบบ (ไม่มี mandatory / จำนวนไม่ครบ / ยอดไม่ครบ) เพราะ positive case พื้นฐานยังไม่ผ่านเลย
    const ACCU_CHEK_ADVANTAGE_2X25 = { name: "ACCU-CHEK ADVANTAGE (2x25'S.)", code: 'PCO00097' };

    await medexPage.goto();
    await medexPage.addToCartWithQty(ACCU_CHEK_ACTIVE.code, 1); // mandatory item
    trackedProducts.push(ACCU_CHEK_ACTIVE.name);
    await medexPage.goto();
    await medexPage.addToCartWithQty(ACCU_CHEK_ADVANTAGE_2X25.code, 9);
    trackedProducts.push(ACCU_CHEK_ADVANTAGE_2X25.name);

    await medexPage.gotoCartPage();
    const ราคารวม = await medexPage.cartSummaryValue('ราคารวม');
    expect(ราคารวม).toBeGreaterThanOrEqual(4000); // ยืนยันว่าเข้าเงื่อนไขยอดขั้นต่ำจริง (310+759×9=7,141)
    await expect(medexPage.cartPageRow(ACCU_CHEK_ACTIVE.name)).toBeVisible(); // ยืนยันว่ามี mandatory item จริง

    const bodyText = await medexPage.page.locator('body').innerText();
    // 🔴 สภาพปัจจุบัน: ไม่มีสินค้าแถม ACCU-CHEK ADVANTAGE 50'S.+เข็ม (PCO00099) ปรากฏเลย แม้ครบทุกเงื่อนไข
    expect(bodyText).not.toContain('50\'S.+เข็ม');
  });
});
