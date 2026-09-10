import { Page, expect, Locator } from '@playwright/test';

/**
 * Helper: Popup Notification Modal ที่แสดงบนหน้าร้าน (POS-v2 / Web-App ERP)
 * Selector ยืนยันจาก DOM จริงบน Staging (2026-08-27): `.popup-notification-modal-custom`
 *
 * ⚠️ บน POS-v2 อาจมี modal อื่นซ้อนอยู่ด้วย (เช่น "YOU HAVE NEW PRESCRIPTION / PURCHASE ORDER"
 * ของฟีเจอร์ Telepharmacy) — ต้อง filter ด้วย class นี้เท่านั้น อย่าใช้ selector กว้างๆ อย่าง `.modal`
 */
export class PopupModal {
  constructor(private page: Page) {}

  get root(): Locator {
    return this.page.locator('.popup-notification-modal-custom').first();
  }

  get content(): Locator {
    return this.root.locator('.popup-html-content');
  }

  async waitForVisible(timeout = 15_000) {
    await expect(this.root).toBeVisible({ timeout });
  }

  /**
   * ⚠️ แก้ไข 2026-09-02: Locator.isVisible({timeout}) ของ Playwright เป็น API ที่ deprecated แล้ว
   * และ "ไม่รอ" element จริง — คืนค่าทันทีจากสถานะ DOM ปัจจุบัน ไม่สนใจ timeout ที่ส่งเข้ามาเลย
   * (ดู node_modules/playwright-core/types/types.d.ts) เดิมเมธอดนี้เรียก root.isVisible({timeout})
   * ตรงๆ ทำให้ตัวเลข timeout ที่ส่งมาทุกจุดเรียกทั่วทั้ง suite (5s-90s) ถูกเมินหมด กลายเป็นเช็คแบบ
   * instant snapshot เท่านั้น — เปลี่ยนมาใช้ expect().toBeVisible() ซึ่ง poll จริงแทน
   */
  async isVisible(timeout = 5_000): Promise<boolean> {
    try {
      await expect(this.root).toBeVisible({ timeout });
      return true;
    } catch {
      return false;
    }
  }

  async expectNotVisible(timeout = 5_000) {
    await expect(this.root).not.toBeVisible({ timeout }).catch(async () => {
      // ถ้า element ไม่ mount เลยตั้งแต่แรก isVisible จะ throw แทน toBeVisible — เช็คซ้ำแบบ soft
      await expect(this.root).toHaveCount(0);
    });
  }

  async getHtmlText(): Promise<string> {
    return (await this.content.innerText().catch(() => '')).trim();
  }

  /** ปุ่ม native close (×) มุมขวาบนของ modal-header */
  async clickNativeClose() {
    await this.root.locator('.modal-header button, .modal-header .close, button:has-text("×")').first().click();
  }

  /**
   * ปุ่ม CTA ที่ Admin ตั้งค่าไว้ (ระบุด้วยข้อความบนปุ่ม)
   * ⚠️ ปุ่มอยู่ใน modal-footer แยกจาก .popup-html-content (เนื้อหา HTML ของ Admin)
   * จึงต้องค้นหาใน root ทั้งก้อน ไม่ใช่แค่ใน .content — ยืนยันจาก DOM จริง 2026-08-27
   */
  async clickButtonByText(text: string) {
    await this.root.locator(`button:has-text("${text}"), a:has-text("${text}")`).first().click();
  }

  /** คลิกพื้นที่มืดรอบนอก modal (backdrop) เพื่อปิด */
  async clickBackdrop() {
    // คลิกที่ตำแหน่งขอบซ้ายบนของ viewport ซึ่งควรอยู่นอก modal-dialog เสมอ
    await this.page.mouse.click(5, 5);
  }
}
