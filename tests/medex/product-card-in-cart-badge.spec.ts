import { test, expect, HIDE_DEBUGBAR_SCRIPT } from './fixtures.js';

/**
 * Product Card (In-Cart Badge) — MedEx Marketplace
 * อ้างอิง: docs/test-cases/Arincare_MedEx_ProductCardInCartBadge_TestPlan.md (หัวข้อ 7.1–7.3)
 * Selectors ยืนยันจาก DOM จริงบน staging (2026-09-07) — ดูหลักฐานที่ docs/medex-cart-badge-discovery/
 *
 * ⚠️ แก้ไขจาก Test Plan เดิม: Cart popover บน Desktop เปิดด้วย "hover" ที่ปุ่ม
 * "ตะกร้าสินค้าของฉัน" ไม่ใช่ click (click จะ navigate ตรงไปหน้าตะกร้าเต็มทันที) — ยืนยันโดยผู้ใช้
 *
 * ⚠️ พบเพิ่มเติมจาก mobile emulation จริง (Pixel 7, 412px, 2026-09-07): แตะปุ่มตะกร้าบนมือถือ
 * **นำทางตรงไปหน้าตะกร้าเต็มทันที เหมือนคลิกบน Desktop** — ไม่มี popup ครึ่งจอแบบใน mockup เดิมที่ส่งมา
 * ดังนั้นเคสกลุ่ม popover (7.1 ส่วนใหญ่) รันได้เฉพาะ Desktop เท่านั้น ส่วนพฤติกรรม mobile จริงอยู่ใน
 * describe "Mobile — แตะปุ่มตะกร้า" ด้านล่าง (แทนที่ TC-BADGE-P07/P08 เดิมที่เคย skip รอข้อมูล)
 *
 * ⚠️ แคตตาล็อก staging มีข้อมูลสินค้าซ้ำข้ามร้านค้า (พบจริงกับ PROSCAR และ TANSY — คนละร้านค้าใช้ชื่อ/รหัส
 * คล้ายกัน บางร้าน Out of Stock) หาสินค้าด้วย findProductBySearch() ซึ่งจะไล่ดูผลลัพธ์ทุกตัวแล้วข้ามตัวที่
 * Out of Stock อัตโนมัติ พร้อมกรองด้วยชื่อที่คาดหวัง (expectedName) เพื่อเลือกตัวที่ถูกต้องจริง ไม่ใช่แค่ตัวแรก
 *
 * รันข้าม 3 device (Desktop Chrome / Mobile Chrome-Android / Mobile Safari-iPhone — ตั้งค่าใน
 * playwright.config.ts): npx playwright test product-card-in-cart-badge
 * รันเฉพาะ Desktop: npx playwright test product-card-in-cart-badge --project=chromium
 *
 * ⚠️ ใช้ staging cart ร่วมกับคนอื่น (ดู qa-context.md) — ทุกเทสที่เพิ่มสินค้าจะลบออกจากตะกร้า
 * อัตโนมัติหลังจบเทสผ่าน fixture `trackedProducts` (best-effort)
 */

const P = {
  ACCIN: { name: 'ACCIN-BP 5G.', code: 'PCO00092' },
  BILAXTEN: { name: "BILAXTEN KIDS 10 MG TABLETS 10'S", code: 'PCO12190' },
  PROSCAR: { name: "PROSCAR 5 MG TABLETS 30'S", code: 'PCO12281' },
  SUCEE: { name: "SUCEE TABLETS 28'S", code: 'PCO01552' },
  TANSY: { name: "TANSY ONE 1.5 MG TABLETS 1'S", code: 'PCO12268' },
};

// สินค้าที่ผู้ใช้เตรียมให้เป็น candidate สำหรับหาตัวที่มีหลายหน่วยขาย (TC-BADGE-C06/C06B)
// รหัสสินค้า (PCO) เท่านั้น — ยังไม่ยืนยันว่าตัวไหนมี unit มากกว่า 1 จริง
const MULTI_UNIT_CANDIDATES = [
  'PCO12338', 'PCO12250', 'PCO12293', 'PCO12248', 'PCO00012',
  'PCO00094', 'PCO00300', 'PCO00351', 'PCO01126', 'PCO00861',
  'PCO00110', 'PCO00128',
];

test.describe('MedEx: Cart Summary Popover (7.1) — Desktop only (hover ไม่มีบน touch device)', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.use.isMobile === true, 'Popover เปิดด้วย hover ซึ่งมีเฉพาะ Desktop — บนมือถือแตะแล้ว navigate ตรงไปหน้าตะกร้าเต็มเลย (ดู describe "Mobile — แตะปุ่มตะกร้า")');
  });

  test('@smoke TC-BADGE-P02 popover แสดงข้อมูลสินค้า 1 รายการถูกต้อง', async ({ loggedIn, medexPage, trackedProducts }) => {
    await medexPage.goto();
    const card = await medexPage.findProductBySearch(P.ACCIN.code, P.ACCIN.name);
    await medexPage.addToCart(card);
    trackedProducts.push(P.ACCIN.name);

    await medexPage.hoverCart();
    await expect(medexPage.cartPopover).toBeVisible();
    await expect(medexPage.cartPopoverRow(P.ACCIN.name)).toBeVisible();
    await expect(medexPage.cartPopoverGrandTotal).toBeVisible();
    await expect(medexPage.viewCartButton).toBeVisible();
  });

  test('TC-BADGE-P03 popover แสดงครบทุกรายการเมื่อมีหลายสินค้า', async ({ loggedIn, medexPage, trackedProducts }) => {
    await medexPage.goto();
    for (const p of [P.ACCIN, P.BILAXTEN, P.PROSCAR]) {
      const card = await medexPage.findProductBySearch(p.code, p.name);
      await medexPage.addToCart(card);
      trackedProducts.push(p.name);
    }

    await medexPage.hoverCart();
    await expect(medexPage.cartPopover).toBeVisible();
    for (const p of [P.ACCIN, P.BILAXTEN, P.PROSCAR]) {
      await expect(medexPage.cartPopoverRow(p.name)).toBeVisible();
    }
  });

  test('TC-BADGE-P05 กด "ดูตะกร้าสินค้า" ต้องนำไปหน้าตะกร้าเต็ม', async ({ loggedIn, medexPage, trackedProducts }) => {
    await medexPage.goto();
    const card = await medexPage.findProductBySearch(P.ACCIN.code, P.ACCIN.name);
    await medexPage.addToCart(card);
    trackedProducts.push(P.ACCIN.name);

    await medexPage.openCartViaPopover();
    await expect(medexPage.page).toHaveURL(/\/companies\/marketplace\/cart/);
    await expect(medexPage.cartPageRow(P.ACCIN.name)).toBeVisible();
  });

  test('TC-BADGE-P06 เอาเมาส์ออกจากปุ่มตะกร้า popover ต้องปิด', async ({ loggedIn, medexPage, trackedProducts }) => {
    await medexPage.goto();
    const card = await medexPage.findProductBySearch(P.ACCIN.code, P.ACCIN.name);
    await medexPage.addToCart(card);
    trackedProducts.push(P.ACCIN.name);

    await medexPage.hoverCart();
    await expect(medexPage.cartPopover).toBeVisible();

    await medexPage.page.mouse.move(20, 400); // ย้ายเมาส์ออกไปจุดที่ไม่ใช่ปุ่มตะกร้า/popover
    await medexPage.page.waitForTimeout(1000);
    await expect(medexPage.cartPopover).toBeHidden();
  });

  test('TC-BADGE-P09 hover ใหม่หลังเพิ่มสินค้าเพิ่ม popover ต้องแสดงค่าล่าสุด', async ({ loggedIn, medexPage, trackedProducts }) => {
    await medexPage.goto();
    const card1 = await medexPage.findProductBySearch(P.ACCIN.code, P.ACCIN.name);
    await medexPage.addToCart(card1);
    trackedProducts.push(P.ACCIN.name);

    await medexPage.hoverCart();
    await expect(medexPage.cartPopoverItemCountLabel).toContainText('1');
    await medexPage.page.mouse.move(20, 400);
    await medexPage.page.waitForTimeout(500);

    const card2 = await medexPage.findProductBySearch(P.BILAXTEN.code, P.BILAXTEN.name);
    await medexPage.addToCart(card2);
    trackedProducts.push(P.BILAXTEN.name);

    await medexPage.hoverCart();
    await expect(medexPage.cartPopoverItemCountLabel).toContainText('2');
    await expect(medexPage.cartPopoverRow(P.BILAXTEN.name)).toBeVisible();
  });

  // Boundary test หนักและช้า (ต้องเพิ่ม 10-15+ SKU) — เก็บไว้เป็น manual/exploratory ก่อน
  test.skip('TC-BADGE-P04 popover scroll ได้เมื่อสินค้าเยอะ — manual/exploratory (heavy)', async () => {});

  // Staging cart ใช้ร่วมกับคนอื่น ไม่สามารถการันตีสถานะ "ว่างเปล่า" ได้แน่นอน
  test.skip('TC-BADGE-P01 popover empty state — ต้องการตะกร้าว่างเปล่าจริง ไม่ปลอดภัยบน shared staging', async () => {});
});

test.describe('MedEx: Mobile — แตะปุ่มตะกร้า (แทนที่ TC-BADGE-P07/P08 เดิม, ยืนยันจริง 2026-09-07)', () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.use.isMobile !== true, 'เทสนี้เฉพาะ mobile viewport (ทดสอบพฤติกรรม tap)');
  });

  // ⚠️ แก้ไขข้อสรุปเดิม (สำคัญ) — ยืนยันจริงซ้ำบน Pixel 3a/Pixel 7 (2026-09-07) ว่าปุ่มตะกร้าบนมือถือ
  // ทำงานตรงตาม mockup เดิมของผู้ใช้ทุกอย่าง: **แตะครั้งแรกแสดง popup เหมือน Desktop เป๊ะ** (ไม่ navigate)
  // แตะปุ่มเดิมซ้ำอีกครั้งถึงจะไป navigate ไปหน้าตะกร้าเต็ม ข้อสรุปก่อนหน้านี้ที่ว่า "มือถือไม่มี popup
  // ครึ่งจอ navigate ตรงเหมือนคลิก Desktop" คลาดเคลื่อน (เกิดจาก debug ครั้งแรกที่ทดสอบไม่ครบเงื่อนไข)
  test('TC-BADGE-P07/P08-MOBILE แตะปุ่มตะกร้าครั้งแรก → popup แสดง (เหมือน Desktop hover), แตะซ้ำ → ไปหน้าตะกร้าเต็ม', async ({ loggedIn, medexPage, trackedProducts }) => {
    await medexPage.goto();
    const card = await medexPage.findProductBySearch(P.ACCIN.code, P.ACCIN.name);
    await medexPage.addToCart(card);
    trackedProducts.push(P.ACCIN.name);

    // กลับไปหน้า grid ปกติก่อนแตะปุ่มตะกร้า — พบจริงว่าแตะจากหน้าผลค้นหา (?q=...) บางครั้งไม่ trigger
    // (อาจเพราะ layout/toast ค้างต่างจากหน้า grid เปล่า) หน้า grid ปกติคือหน้าที่ยืนยันแล้วว่าแตะได้ชัวร์
    await medexPage.goto();

    // TC-BADGE-P07: แตะครั้งแรก → popup แสดง ยังไม่ navigate
    await medexPage.cartButton.tap();
    await expect(medexPage.cartPopover).toBeVisible();
    await expect(medexPage.cartPopoverRow(P.ACCIN.name)).toBeVisible();
    await expect(medexPage.page).not.toHaveURL(/\/companies\/marketplace\/cart/);

    // TC-BADGE-P08: แตะปุ่มเดิมซ้ำอีกครั้ง → navigate ไปหน้าตะกร้าเต็ม
    await medexPage.cartButton.tap();
    await medexPage.page.waitForLoadState('domcontentloaded').catch(() => {});
    await expect(medexPage.page).toHaveURL(/\/companies\/marketplace\/cart/);
    await expect(medexPage.cartPageRow(P.ACCIN.name)).toBeVisible();
  });
});

test.describe('MedEx: In-Cart Badge บน Product Card (7.2)', () => {
  test('@smoke TC-BADGE-C01 badge ขึ้นทันทีหลังเพิ่มสินค้าลงตะกร้า', async ({ loggedIn, medexPage, trackedProducts }) => {
    await medexPage.goto();
    const card = await medexPage.findProductBySearch(P.TANSY.code, P.TANSY.name);

    expect(await medexPage.getInCartTitle(card)).toBeNull();

    await medexPage.addToCart(card);
    trackedProducts.push(P.TANSY.name);

    const title = await medexPage.getInCartTitle(card);
    expect(title).not.toBeNull();
    expect(title).toContain('อยู่ในตะกร้าแล้ว');
  });

  // ⚠️ แก้จาก premise เดิม: ยืนยันจริงบน staging (2026-09-07) ว่ากด "เพิ่มสินค้าลงตะกร้า" ซ้ำด้วยจำนวนใหม่
  // จะ "แทนที่" จำนวนในตะกร้าด้วยค่าล่าสุดที่เลือกบนการ์ด ไม่ใช่บวกสะสม (พฤติกรรมเดียวกับกฎเปลี่ยนหน่วยขาย
  // ในหัวข้อ 2 ข้อ 2 ของ Test Plan) — TC เดิมชื่อ "ต้องอัปเดตตรงกับจำนวนสะสม" ตั้งสมมติฐานผิด แก้ไขแล้ว
  test('TC-BADGE-C02 เพิ่มจำนวนซ้ำด้วยค่าใหม่ badge ต้องแทนที่เป็นจำนวนล่าสุด ไม่ใช่บวกสะสม', async ({ loggedIn, medexPage, trackedProducts }, testInfo) => {
    // setQuantity() ปรับค่าบน inline control ของการ์ด list ซึ่งมีเฉพาะ Desktop (มือถือไม่มี control บนการ์ด
    // list เลย ต้องแตะเข้าไปหน้ารายละเอียดสินค้าก่อนถึงจะปรับจำนวนได้ — ดู addToCart() ใน MedExMarketplacePage.ts)
    test.skip(testInfo.project.use.isMobile === true, 'setQuantity() ใช้ inline control บนการ์ด list ซึ่งมีเฉพาะ Desktop');
    await medexPage.goto();
    const card = await medexPage.findProductBySearch(P.SUCEE.code, P.SUCEE.name);

    await medexPage.addToCart(card); // qty เริ่มต้น = 1
    trackedProducts.push(P.SUCEE.name);
    let title = await medexPage.getInCartTitle(card);
    expect(title).toMatch(/1\s/);

    await medexPage.setQuantity(card, 2);
    await medexPage.addToCart(card); // เพิ่มซ้ำด้วยจำนวน 2
    title = await medexPage.getInCartTitle(card);
    expect(title).toMatch(/2\s/); // แทนที่เป็น 2 (ไม่ใช่ 1+2=3)
  });

  test('TC-BADGE-C03 ลบสินค้าออกจากตะกร้า (หน้าตะกร้าเต็ม) badge ต้องหายจาก card', async ({ loggedIn, medexPage }) => {
    await medexPage.goto();
    const card = await medexPage.findProductBySearch(P.PROSCAR.code, P.PROSCAR.name);
    await medexPage.addToCart(card);
    expect(await medexPage.getInCartTitle(card)).not.toBeNull();

    await medexPage.gotoCartPage();
    await medexPage.removeFromCartPage(P.PROSCAR.name);

    await medexPage.goto();
    const cardAfter = await medexPage.findProductBySearch(P.PROSCAR.code, P.PROSCAR.name);
    expect(await medexPage.getInCartTitle(cardAfter)).toBeNull();
  });

  test('TC-BADGE-C04 Refresh หน้าแล้ว badge ต้องคงอยู่ตามสถานะตะกร้าจริง', async ({ loggedIn, medexPage, trackedProducts }) => {
    await medexPage.goto();
    const card = await medexPage.findProductBySearch(P.ACCIN.code, P.ACCIN.name);
    await medexPage.addToCart(card);
    trackedProducts.push(P.ACCIN.name);
    expect(await medexPage.getInCartTitle(card)).not.toBeNull();

    await medexPage.page.reload({ waitUntil: 'domcontentloaded' });
    await medexPage.page.waitForLoadState('networkidle').catch(() => {});
    const cardAfterReload = await medexPage.findProductBySearch(P.ACCIN.code, P.ACCIN.name);
    expect(await medexPage.getInCartTitle(cardAfterReload)).not.toBeNull();
  });

  test('TC-BADGE-C05 สินค้าที่ไม่เคยเพิ่มลงตะกร้า ต้องไม่มี badge', async ({ loggedIn, medexPage }) => {
    await medexPage.goto();
    const card = await medexPage.findProductBySearch(P.BILAXTEN.code, P.BILAXTEN.name);
    expect(await medexPage.getInCartTitle(card)).toBeNull();
  });

  test('TC-BADGE-C06/C06B เปลี่ยนหน่วยขายแล้ว badge ต้องแทนที่ ไม่สะสมข้ามหน่วย', async ({ loggedIn, medexPage, trackedProducts }, testInfo) => {
    // C06B ส่วนท้ายเช็คผ่าน popover ซึ่งมีเฉพาะ Desktop — badge behavior หลักของ C06 ถูก cover แล้วบน Desktop
    test.skip(testInfo.project.use.isMobile === true, 'C06B เช็คผ่าน cart popover ซึ่งมีเฉพาะ Desktop');
    await medexPage.goto();

    let multiUnitCard = null;
    let multiUnitName = '';
    for (const code of MULTI_UNIT_CANDIDATES) {
      const card = await medexPage.findProductBySearch(code);
      if (!(await card.isVisible({ timeout: 3000 }).catch(() => false))) continue;
      const unitCount = await medexPage.unitOptionCount(card).catch(() => 0);
      if (unitCount > 1) {
        multiUnitCard = card;
        multiUnitName = (await card.locator('.product-name').innerText().catch(() => code)).trim();
        break;
      }
    }

    test.skip(
      multiUnitCard === null,
      `ไม่พบสินค้าหลายหน่วยขายในรายชื่อ candidate ที่ผู้ใช้เตรียมให้ (${MULTI_UNIT_CANDIDATES.join(', ')}) — ต้องหา SKU อื่นที่มี dropdown หน่วยมากกว่า 1 ตัวเลือกจริง`,
    );
    if (!multiUnitCard) return;

    const options = await medexPage.unitSelect(multiUnitCard).locator('option').allTextContents();
    const [unitA, unitB] = options.map((o) => o.trim());

    await medexPage.selectUnit(multiUnitCard, unitA);
    await medexPage.setQuantity(multiUnitCard, 1);
    await medexPage.addToCart(multiUnitCard);
    trackedProducts.push(multiUnitName);

    let title = await medexPage.getInCartTitle(multiUnitCard);
    expect(title).toContain(unitA);

    await medexPage.selectUnit(multiUnitCard, unitB);
    await medexPage.setQuantity(multiUnitCard, 2);
    await medexPage.addToCart(multiUnitCard);

    title = await medexPage.getInCartTitle(multiUnitCard);
    expect(title).toContain(unitB);
    expect(title).not.toContain(unitA); // ต้องแทนที่ ไม่ใช่โชว์ทั้งสองหน่วย

    // TC-BADGE-C06B: ตรวจใน popover ต้องมี line เดียวด้วยหน่วยล่าสุด
    await medexPage.hoverCart();
    const row = medexPage.cartPopoverRow(multiUnitName);
    await expect(row).toBeVisible();
    await expect(row).toHaveCount(1);
    await expect(row).toContainText(unitB);
  });

  test.skip('TC-BADGE-C07 badge ตรงกันทุกจุดที่การ์ดปรากฏซ้ำ (pagination/tab อื่น) — ต้องยืนยัน UI tab ก่อน', async () => {});
});

test.describe('MedEx: State Sync — badge ↔ popover ↔ cart page (7.3, Critical R1)', () => {
  test('@smoke TC-BADGE-S01 badge/ไอคอนตะกร้า/(popover เฉพาะ Desktop)/หน้าตะกร้าเต็ม ต้องตรงกันทั้งหมด', async ({ loggedIn, medexPage, trackedProducts }, testInfo) => {
    await medexPage.goto();
    const card = await medexPage.findProductBySearch(P.ACCIN.code, P.ACCIN.name);
    await medexPage.addToCart(card);
    trackedProducts.push(P.ACCIN.name);

    // 1) badge บน card
    expect(await medexPage.getInCartTitle(card)).toContain('อยู่ในตะกร้าแล้ว');

    // 2) ไอคอนตะกร้า (จำนวนรวม)
    await expect(medexPage.cartCountBadge).toHaveText(/\d+/);

    // 3) popover — มีเฉพาะ Desktop (hover ไม่มีบน touch device)
    if (!testInfo.project.use.isMobile) {
      await medexPage.hoverCart();
      await expect(medexPage.cartPopoverRow(P.ACCIN.name)).toBeVisible();
    }

    // 4) หน้าตะกร้าเต็ม
    await medexPage.gotoCartPage();
    await expect(medexPage.cartPageRow(P.ACCIN.name)).toBeVisible();
  });

  test('TC-BADGE-S02 ลบจากหน้าตะกร้าเต็ม ต้องสะท้อนกลับไปที่ badge บน card', async ({ loggedIn, medexPage }) => {
    await medexPage.goto();
    const card = await medexPage.findProductBySearch(P.SUCEE.code, P.SUCEE.name);
    await medexPage.addToCart(card);
    expect(await medexPage.getInCartTitle(card)).not.toBeNull();

    await medexPage.gotoCartPage();
    await medexPage.removeFromCartPage(P.SUCEE.name);

    await medexPage.goto();
    const cardAfter = await medexPage.findProductBySearch(P.SUCEE.code, P.SUCEE.name);
    expect(await medexPage.getInCartTitle(cardAfter)).toBeNull();
  });

  test('TC-BADGE-S03 แก้จำนวนจากหน้าตะกร้าเต็ม badge บน card ต้องอัปเดตตามหลัง reload', async ({ loggedIn, medexPage, trackedProducts }) => {
    await medexPage.goto();
    const card = await medexPage.findProductBySearch(P.PROSCAR.code, P.PROSCAR.name);
    await medexPage.addToCart(card);
    trackedProducts.push(P.PROSCAR.name);

    await medexPage.gotoCartPage();
    await medexPage.setCartPageQuantity(P.PROSCAR.name, 5);

    await medexPage.goto();
    const cardAfter = await medexPage.findProductBySearch(P.PROSCAR.code, P.PROSCAR.name);
    const title = await medexPage.getInCartTitle(cardAfter);
    expect(title).toMatch(/5\s/);
  });

  test('TC-BADGE-S04 multi-tab: sync เฉพาะหลัง reload ไม่ใช่ real-time', async ({ browser }) => {
    // ⚠️ browser.newContext() ที่สร้างเองไม่ inherit `use.baseURL` จาก playwright.config.ts อัตโนมัติ ต้องระบุเอง
    const context = await browser.newContext({
      baseURL: process.env.BASE_URL ?? 'https://app-stg.arincare.com',
      locale: 'th-TH',
      timezoneId: 'Asia/Bangkok',
    });
    await context.addInitScript(HIDE_DEBUGBAR_SCRIPT); // ซ่อน PHP Debugbar กัน intercept คลิก (ดู fixtures.ts)
    // ⚠️ page1/page2 มาจาก context เดียวกัน จึง share cookie/session กันอัตโนมัติ (นี่คือพฤติกรรมที่ถูกต้อง
    // สำหรับจำลอง "2 tab ของ user เดียวกัน") — ต้อง login แค่ครั้งเดียวที่ page1 เท่านั้น ถ้า login ซ้ำที่ page2
    // ระบบจะเห็นว่า login อยู่แล้วแล้ว redirect ออกจากหน้า /login ทำให้หา input email ไม่เจอ (timeout)
    const page1 = context.pages()[0] ?? (await context.newPage());

    const { LoginPage } = await import('../../pages/LoginPage.js');
    const { MedExMarketplacePage } = await import('../../pages/MedExMarketplacePage.js');

    const login = new LoginPage(page1);
    await login.goto();
    await login.login(process.env.TEST_USERNAME ?? '', process.env.TEST_PASSWORD ?? '');
    await login.selectCompany(process.env.COMPANY_NAME ?? 'Arincare Pharmacy');
    await login.expectLoggedIn();

    const page2 = await context.newPage(); // session เดียวกับ page1 อยู่แล้วผ่าน shared cookies

    const medex1 = new MedExMarketplacePage(page1);
    const medex2 = new MedExMarketplacePage(page2);
    await medex1.goto();
    await medex2.goto();

    const card1 = await medex1.findProductBySearch(P.TANSY.code, P.TANSY.name);
    await medex1.addToCart(card1);

    // tab 2 ยังไม่ reload — ไม่การันตีว่าจะเห็นอัปเดตทันที (ยืนยันแล้วว่า sync เฉพาะ reload)
    const card2BeforeReload = await medex2.findProductBySearch(P.TANSY.code, P.TANSY.name);
    const titleBeforeReload = await medex2.getInCartTitle(card2BeforeReload);
    // ไม่ assert ค่านี้ (อาจ sync หรือไม่ก็ได้ก่อน reload) — เก็บไว้เป็น context เท่านั้น
    void titleBeforeReload;

    await page2.reload({ waitUntil: 'domcontentloaded' });
    await page2.waitForLoadState('networkidle').catch(() => {});
    const card2AfterReload = await medex2.findProductBySearch(P.TANSY.code, P.TANSY.name);
    const titleAfterReload = await medex2.getInCartTitle(card2AfterReload);
    expect(titleAfterReload).not.toBeNull();
    expect(titleAfterReload).toContain('อยู่ในตะกร้าแล้ว');

    // cleanup
    await medex1.gotoCartPage();
    await medex1.removeFromCartPage(P.TANSY.name).catch(() => {});
    await context.close();
  });

  test('TC-BADGE-S05 กด "+" รัวๆ บน card ยอดสุดท้ายต้องตรงกันทุกจุด ไม่มี race condition', async ({ loggedIn, medexPage }, testInfo) => {
    // ปุ่ม +/- rapid-click เป็น inline control บนการ์ด list ซึ่งมีเฉพาะ Desktop
    test.skip(testInfo.project.use.isMobile === true, 'ปุ่ม +/- rapid-click ใช้ inline control บนการ์ด list ซึ่งมีเฉพาะ Desktop');
    await medexPage.goto();
    const card = await medexPage.findProductBySearch(P.BILAXTEN.code, P.BILAXTEN.name);

    const plusBtn = card.locator('.tw-flex.tw-justify-center.tw-mb-2 >> button').last();
    for (let i = 0; i < 5; i++) {
      await plusBtn.click();
    }
    const qtyInput = card.locator('.productQuantity');
    const qtyValue = await qtyInput.inputValue();

    await medexPage.addToCart(card);
    const title = await medexPage.getInCartTitle(card);
    expect(title).toContain(qtyValue.trim());

    if (!testInfo.project.use.isMobile) {
      await medexPage.hoverCart();
      await expect(medexPage.cartPopoverRow(P.BILAXTEN.name)).toContainText(qtyValue.trim());
    }

    await medexPage.gotoCartPage();
    const cartRow = medexPage.cartPageRow(P.BILAXTEN.name);
    await expect(cartRow).toBeVisible();
    // จำนวนบนหน้าตะกร้าอยู่ใน <input type="number"> — ไม่ใช่ text node จึงต้องเช็คผ่าน inputValue() ไม่ใช่ toContainText()
    await expect(cartRow.locator('input[type="number"]').last()).toHaveValue(qtyValue.trim());
    await medexPage.removeFromCartPage(P.BILAXTEN.name).catch(() => {});
  });
});
