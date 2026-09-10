import { Page, expect, Locator } from '@playwright/test';

const ADMIN_URL = process.env.ADMIN_BASE_URL ?? 'https://admin-stg.arincare.com';

export type PopupCreateInput = {
  title: string;
  code: string;
  status?: 'active' | 'inactive';
  startDateTime?: string; // 'YYYY-MM-DDTHH:mm' (datetime-local format)
  endDateTime?: string;
  webApp?: boolean;
  posV2?: boolean;
  medEx?: boolean;
  frequency?: 'once' | 'daily' | 'weekly' | 'monthly';
  scope?: 'global' | 'specific';
  /** ใช้เฉพาะตอน scope='specific' — พิมพ์คำค้นแล้วเลือกรายการแรกที่เจอ */
  scopeSearch?: string;
  size?: 'SM' | 'MD' | 'LG' | 'XL' | '2XL';
  rawHtml: string;
  buttonText?: string;
  buttonAction?: 'redirect' | 'close' | 'api_call';
  buttonUrl?: string;
};

/**
 * Page Object: Web-Admin > การแจ้งเตือนป็อปอัพ (Popup Notifications)
 * Target: admin-stg.arincare.com
 *
 * ⚠️ ระวัง: มีแคมเปญจริงชื่อ "สายรุ้งทดสอบ" (Code: LJDLKFJ) อยู่แล้วบน Staging
 * ห้าม deletePopup/toggle ทับแคมเปญนี้เด็ดขาด — ทุก method ที่แก้ไข/ลบข้อมูล
 * ต้องระบุ code ของแคมเปญที่เทสสร้างเองเท่านั้น (ดู guard ใน deletePopup())
 */
export class PopupAdminPage {
  constructor(private page: Page) {}

  private readonly PROTECTED_CODES = ['LJDLKFJ'];

  // ─── Navigation ────────────────────────────────────────────────────────────

  async login(email = process.env.ADMIN_EMAIL ?? '', password = process.env.ADMIN_PASSWORD ?? '') {
    await this.page.goto(`${ADMIN_URL}/login`, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(1_000);
    const emailInput = this.page.locator('input[type="email"], input[name="email"]').first();
    if (await emailInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await emailInput.fill(email);
      await this.page.locator('input[type="password"], input[name="password"]').first().fill(password);
      await this.page
        .locator('button[type="submit"], button:has-text("เข้าสู่ระบบ"), button:has-text("Login")')
        .first()
        .click();
      await this.page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    }
  }

  async gotoList() {
    // ⚠️ บางครั้งมี navigation อื่นค้างอยู่ (เช่น auto-redirect หลัง submit/save) ทำให้ goto()
    // โดน "interrupted by another navigation" — ลองซ้ำครั้งเดียวถ้าเจอกรณีนี้
    try {
      await this.page.goto(`${ADMIN_URL}/popup-notifications`, { waitUntil: 'domcontentloaded' });
    } catch (e: any) {
      if (String(e.message).includes('interrupted by another navigation')) {
        await this.page.waitForLoadState('domcontentloaded').catch(() => {});
        await this.page.waitForTimeout(500);
        await this.page.goto(`${ADMIN_URL}/popup-notifications`, { waitUntil: 'domcontentloaded' });
      } else {
        throw e;
      }
    }
    await this.page.waitForTimeout(1_000);
  }

  async gotoCreate() {
    await this.page.goto(`${ADMIN_URL}/popup-notifications/create`, { waitUntil: 'domcontentloaded' });
    await this.page.waitForTimeout(1_000);
  }

  // ─── List page ─────────────────────────────────────────────────────────────

  rowByCode(code: string): Locator {
    return this.page.locator('table tbody tr').filter({ hasText: code });
  }

  async expectRowVisible(code: string) {
    await expect(this.rowByCode(code)).toBeVisible({ timeout: 10_000 });
  }

  async expectRowAbsent(code: string) {
    await expect(this.rowByCode(code)).toHaveCount(0, { timeout: 10_000 });
  }

  // ลำดับคอลัมน์จริงในตาราง: ID(0) Code(1) ชื่อป็อปอัพ(2) แพลตฟอร์ม(3) ความถี่(4)
  // ระยะเวลาแสดงผล(5) สถิติ View/Click(6) สถานะ(7) จัดการ(8) — ยืนยันจาก DOM จริงบน Staging (2026-08-27)
  // สถานะ(7) เป็นแค่ <span class="label"> เฉย ๆ ไม่มีปุ่ม toggle ในหน้า List เลย
  // ต้องแก้ผ่านหน้า Edit เท่านั้น (ดู toggleStatus ด้านล่าง)
  private readonly STATUS_COL = 7;

  async getRowStatusText(code: string): Promise<string> {
    const row = this.rowByCode(code);
    return (await row.locator('td').nth(this.STATUS_COL).innerText().catch(() => '')).trim();
  }

  /** เปลี่ยนสถานะผ่านหน้า Edit (ไม่มี quick-toggle ในหน้า List — ยืนยันจาก DOM จริง) */
  async toggleStatus(code: string) {
    this.assertNotProtected(code);
    await this.rowByCode(code).locator('a[title="แก้ไข"]').click();
    await this.page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await this.page.waitForTimeout(1_000);

    const statusSelect = this.page.locator('select').filter({ has: this.page.locator('option', { hasText: 'Active (เปิดใช้งาน)' }) });
    const current = await statusSelect.inputValue();
    await statusSelect.selectOption(current === 'active' ? 'inactive' : 'active');

    await this.page.getByRole('button', { name: /บันทึก|Save/ }).first().click();
    await this.page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await this.page.waitForTimeout(1_000);
  }

  /** ลบแคมเปญจากหน้า List (ไอคอนถังขยะ title="ลบ") */
  async deletePopup(code: string) {
    this.assertNotProtected(code);
    const row = this.rowByCode(code);
    await expect(row).toBeVisible({ timeout: 10_000 });

    this.page.once('dialog', (d) => d.accept().catch(() => {}));
    await row.locator('button[title="ลบ"]').click().catch(() => {});
    await this.page.waitForTimeout(500);

    // เผื่อเป็น confirm modal แทน window.confirm()
    const confirmBtn = this.page.locator('button:has-text("ยืนยัน"), button:has-text("ลบ"), button:has-text("Confirm")').first();
    if (await confirmBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await confirmBtn.click().catch(() => {});
    }
    await this.page.waitForTimeout(1_500);
  }

  private assertNotProtected(code: string) {
    if (this.PROTECTED_CODES.includes(code)) {
      throw new Error(
        `❌ ห้ามแก้ไข/ลบแคมเปญ ${code} — เป็นข้อมูลจริงบน Staging ที่มีอยู่ก่อนแล้ว (ไม่ใช่ข้อมูลที่เทสสร้างเอง)`
      );
    }
  }

  // ─── Create form ───────────────────────────────────────────────────────────

  async fillCreateForm(input: PopupCreateInput) {
    await this.page.getByPlaceholder('เช่น แจ้งปรับปรุงระบบประจำเดือน, ข่าวสารประชาสัมพันธ์').fill(input.title);
    await this.page.getByPlaceholder('เช่น POPUP_NOTICE_2026').fill(input.code);

    if (input.status) {
      const statusSelect = this.page.locator('select').filter({ has: this.page.locator('option', { hasText: 'Active (เปิดใช้งาน)' }) });
      await statusSelect.selectOption(input.status);
    }

    const dateInputs = this.page.locator('input[type="datetime-local"]');
    if (input.startDateTime) await dateInputs.nth(0).fill(input.startDateTime);
    if (input.endDateTime) await dateInputs.nth(1).fill(input.endDateTime);

    // Platform checkboxes: ลำดับ Web-App(0), POS-v2(1), Med-Ex(2) ตามที่ปรากฏในฟอร์มจริง
    const checkboxes = this.page.locator('input[type="checkbox"]');
    if (input.webApp !== undefined) await this.setChecked(checkboxes.nth(0), input.webApp);
    if (input.posV2 !== undefined) await this.setChecked(checkboxes.nth(1), input.posV2);
    if (input.medEx !== undefined) await this.setChecked(checkboxes.nth(2), input.medEx);

    if (input.frequency) {
      const freqSelect = this.page.locator('select').filter({ has: this.page.locator('option', { hasText: 'ครั้งเดียวต่อพนักงาน' }) });
      await freqSelect.selectOption(input.frequency);
    }

    if (input.scope === 'specific') {
      // radio ตัวที่ 2 = "กำหนดเฉพาะร้านค้า / สาขา"
      await this.page.locator('input[type="radio"]').nth(1).click();
      await this.page.waitForTimeout(500);
      if (input.scopeSearch) {
        const search = this.page.getByPlaceholder('พิมพ์ชื่อร้าน หรือรหัสสาขา ARC... เพื่อค้นหา');
        await search.fill(input.scopeSearch);
        await this.page.waitForTimeout(1_500); // debounce ของ autocomplete
        const firstResult = this.page.locator('.dropdown-menu, .autocomplete-results, [role="listbox"]').locator('li, a, div').first();
        if (await firstResult.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await firstResult.click();
        }
      }
    }
    // scope='global' คือค่า default (radio ตัวแรก) ไม่ต้องทำอะไรเพิ่ม

    if (input.size) {
      // exact:true ปลอดภัยเฉพาะปุ่มไม่มีไอคอน (SM/MD/LG/XL/2XL ไม่มี <i> ข้างใน)
      await this.page.getByRole('button', { name: input.size, exact: true }).click();
    }

    // สลับไป Raw HTML mode แล้วกรอกตรง — เชื่อถือได้กว่าการขับ Rich Text Editor
    await this.page.getByRole('button', { name: 'สลับไปโหมดเขียนโค้ด Raw HTML' }).click();
    await this.page.waitForTimeout(500);
    await this.page.locator('textarea').first().fill(input.rawHtml);

    if (input.buttonText) {
      await this.page.getByPlaceholder('เช่น สั่งซื้อเลย, ดูรายละเอียด').fill(input.buttonText);
    }
    if (input.buttonAction) {
      const actionSelect = this.page.locator('select').filter({ has: this.page.locator('option', { hasText: 'ปิดหน้าต่าง (Close Modal)' }) });
      await actionSelect.selectOption(input.buttonAction);
      if (input.buttonAction !== 'close' && input.buttonUrl) {
        await this.page.getByPlaceholder('https://... หรือ /products').fill(input.buttonUrl);
      }
    }
  }

  async submitCreate() {
    // ⚠️ ห้ามใช้ exact:true — ปุ่มนี้มี <i class="fa fa-save"> อยู่ข้างใน และ Chromium ผูก glyph
    // ของ CSS ::before ของไอคอนเข้าไปใน accessible name ด้วย ทำให้ exact-match หาไม่เจอ
    // (ยืนยันจากการ debug จริง 2026-08-27 — ดู docs/popup-notification-discovery/debug-fill-steps.ts)
    await this.page.getByRole('button', { name: 'สร้างป็อปอัพ' }).click();
    await this.page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await this.page.waitForTimeout(1_000);
  }

  private async setChecked(locator: Locator, checked: boolean) {
    const isChecked = await locator.isChecked().catch(() => false);
    if (isChecked !== checked) await locator.click();
  }

  // ─── Detail / Report page ─────────────────────────────────────────────────

  async gotoDetailByCode(code: string) {
    await this.gotoList();
    await this.rowByCode(code).locator('a[title="ดูรายละเอียด"]').click();
    await this.page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  }

  /** อ่านยอด "แสดงผล / คลิก" จาก card ข้อมูลป็อปอัพในหน้า Detail */
  async getStatSummary(): Promise<{ views: number; clicks: number }> {
    const text = await this.page.locator('body').innerText();
    const viewsMatch = text.match(/แสดงผล[:\s]*([\d,]+)\s*ครั้ง/);
    const clicksMatch = text.match(/คลิก[:\s]*([\d,]+)\s*ครั้ง/);
    return {
      views: viewsMatch ? parseInt(viewsMatch[1].replace(/,/g, ''), 10) : 0,
      clicks: clicksMatch ? parseInt(clicksMatch[1].replace(/,/g, ''), 10) : 0,
    };
  }

  /** อ่าน snippet ของตาราง Interactions Log ในหน้า Detail (ต้องอยู่ในหน้า Detail แล้ว) */
  async getInteractionsLogSnippet(): Promise<string> {
    const text = await this.page.locator('body').innerText();
    const match = text.match(/Action ที่ทำ[\s\S]{0,600}/);
    return (match?.[0] || '(ไม่เจอ log)').replace(/\s+/g, ' ');
  }

  /** เข้าหน้า List แล้วค้นด้วยคำค้น (ชื่อหรือรหัส) — ไม่ narrow แค่ exact code */
  async searchList(term: string) {
    await this.gotoList();
    await this.page.getByPlaceholder('ค้นหาชื่อหรือรหัส...').fill(term);
    await this.page.getByRole('button', { name: 'ค้นหา' }).click();
    await this.page.waitForTimeout(1_000);
  }
}
