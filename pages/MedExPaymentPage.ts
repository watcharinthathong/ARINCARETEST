import { Page, Locator } from '@playwright/test';

/**
 * Page object สำหรับ MedEx Payment page (https://app-stg.arincare.com/companies/marketplace/payment)
 * Selectors ทั้งหมดยืนยันจาก DOM จริงบน staging (2026-09-09) — ดู
 * docs/e2e-cart-payment-discovery/ สำหรับหลักฐาน raw HTML/screenshot ที่ใช้อ้างอิง
 *
 * ⚠️ 3 ช่องทางชำระ (QR/บัตรเครดิต/โอนผ่านธนาคาร) เป็นแท็บในหน้าเดียว คลิกด้วยข้อความ ไม่ใช่ radio input
 * ⚠️ "เลขที่ใบสั่งซื้อ" ถูกจองแสดงไว้ตั้งแต่หน้านี้ ก่อนชำระเงินเสร็จด้วยซ้ำ — อย่าใช้เป็นตัวยืนยันว่า
 * Order ถูกสร้างแล้วจริง ต้องเช็คที่ Order Management List เท่านั้น (ดู business rule หัวข้อ 13.3)
 */
export class MedExPaymentPage {
  constructor(readonly page: Page) {}

  get orderRefLabel(): Locator {
    return this.page.locator('text=เลขที่ใบสั่งซื้อ').first();
  }

  /** อ่านเลขที่ใบสั่งซื้อจาก label "เลขที่ใบสั่งซื้อ : OR-xxxxxx-xxxx" */
  async getOrderRef(): Promise<string | null> {
    const text = await this.orderRefLabel.innerText().catch(() => '');
    const m = text.match(/OR-[\w-]+/);
    return m ? m[0] : null;
  }

  get stepperSteps(): Locator {
    return this.page.locator('text=รอการชำระ, text=ตรวจสอบสถานะ, text=ชำระเรียบร้อย');
  }

  async selectBankTransferTab() {
    await this.page.getByText('โอนผ่านธนาคาร', { exact: false }).first().click();
    await this.page.waitForTimeout(1000);
  }

  async selectQrTab() {
    await this.page.getByText('สแกน QR', { exact: false }).first().click();
    await this.page.waitForTimeout(1000);
  }

  async selectCreditCardTab() {
    await this.page.getByText('บัตรเครดิต', { exact: false }).first().click();
    await this.page.waitForTimeout(1000);
  }

  get attachEvidenceButton(): Locator {
    return this.page.locator('button').filter({ hasText: 'แนบหลักฐานการโอน' }).first();
  }

  /**
   * กรอกฟอร์ม "รายละเอียดการโอนเงิน" ในโมดัลที่เปิดจากปุ่ม "แนบหลักฐานการโอน" แล้วกด "ตกลง"
   * เวลาที่ชำระเงินเป็น 2 ช่อง (ชม./นาที) แยกกัน ไม่ใช่ time picker เดียว
   */
  async fillBankTransferEvidence(opts: {
    dateDDMMYYYY: string; // "09/09/2026"
    hour: string;         // "12"
    minute: string;       // "30"
    amount: string;       // "210"
    filePath: string;     // absolute path ไฟล์ .jpg/.jpeg/.png
  }) {
    await this.attachEvidenceButton.click();
    await this.page.waitForTimeout(1200);

    await this.page.locator('input[placeholder="วว/ดด/ปปปป"]').fill(opts.dateDDMMYYYY);
    // ⚠️ ช่องชม./นาที มี minlength=2 (native HTML5 validation) — ถ้าส่ง "0" เฉยๆ (1 ตัวอักษร) ปุ่ม
    // "ตกลง" จะดูเหมือนกดได้ปกติแต่ browser บล็อก submit เงียบๆ ด้วย tooltip "Please lengthen this
    // text to 2 characters" โมดัลเลยไม่ปิดจริง (พบจริงจากการรัน automation) ต้อง pad เป็น 2 หลักเสมอ
    const hourMinuteInputs = this.page.locator('input[placeholder="00"]');
    await hourMinuteInputs.nth(0).fill(opts.hour.padStart(2, '0'));
    await hourMinuteInputs.nth(1).fill(opts.minute.padStart(2, '0'));
    await this.page.locator('input[placeholder="0.00"]').fill(opts.amount);

    await this.page.locator('input[type="file"]').first().setInputFiles(opts.filePath);
    await this.page.waitForTimeout(1500);

    // ⚠️ modal #slip-form-dialog เป็น Bootstrap fade — คลิก "ตกลง" ปกติบางครั้งไม่ปิดจริง (พบจริง
    // จากการรัน automation) เหลือ modal ค้าง intercept pointer event ทั้งหน้าต่อ ต้อง verify ผลลัพธ์
    // ว่าปิดจริงเหมือน pattern clickConfirmIfPresent() ใน MedExMarketplacePage
    const modalOkBtn = this.page.getByRole('button', { name: 'ตกลง', exact: true });
    await modalOkBtn.scrollIntoViewIfNeeded().catch(() => {});
    await modalOkBtn.click();
    const modalDialog = this.page.locator('#slip-form-dialog');
    const closed = await modalDialog
      .waitFor({ state: 'hidden', timeout: 5000 })
      .then(() => true)
      .catch(() => false);
    if (!closed) {
      await modalOkBtn.click({ force: true }).catch(() => {});
      await modalDialog.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    }
    await this.page.waitForTimeout(800);
  }

  get acceptEvidenceCheckbox(): Locator {
    const label = this.page.getByText('ข้าพเจ้ายอมรับว่าหลักฐานที่แนบมาถูกต้องทุกประการ', { exact: false }).first();
    return label.locator('xpath=preceding-sibling::input[@type="checkbox"][1]');
  }

  get submitEvidenceButton(): Locator {
    return this.page.locator('button').filter({ hasText: 'ส่งหลักฐานการโอน' }).first();
  }

  /** ติ๊กยอมรับ + กดส่งหลักฐานการโอน — ต้องเรียกหลัง fillBankTransferEvidence() แล้วเท่านั้น */
  async submitBankTransferEvidence() {
    await this.acceptEvidenceCheckbox.click();
    await this.page.waitForTimeout(500);
    await this.submitEvidenceButton.click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
    await this.page.waitForTimeout(2000);
  }

  /** ข้อความยืนยันหลังส่งหลักฐานสำเร็จ: "คำสั่งซื้ออยู่ระหว่างตรวจสอบ" */
  get pendingReviewMessage(): Locator {
    return this.page.getByText('คำสั่งซื้ออยู่ระหว่างตรวจสอบ', { exact: false });
  }
}
