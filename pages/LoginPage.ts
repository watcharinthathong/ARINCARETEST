import { Page, expect, Locator } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  // Selectors verified from live DOM (app-stg.arincare.com/login)
  private get userInput(): Locator  { return this.page.locator('input[name="email"]'); }
  private get passInput(): Locator  { return this.page.locator('input[name="password"]'); }
  private get loginButton(): Locator { return this.page.locator('#login-btn'); }

  async goto() {
    await this.page.goto('/login', { waitUntil: 'domcontentloaded' });
  }

  async login(username: string, password: string) {
    // Wait for preloader overlay to disappear before interacting
    await this.page.waitForSelector('#preloader', { state: 'hidden', timeout: 15_000 }).catch(() => {});
    await this.userInput.fill(username);
    await this.passInput.fill(password);
    await this.loginButton.click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  /** เลือกบริษัทหลัง login (หน้า /companies/lbeIdC5mld) */
  async selectCompany(companyName: string) {
    const companyEl = this.page.getByText(companyName, { exact: false }).first();
    if (await companyEl.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await companyEl.click();
      await this.page.waitForLoadState('networkidle').catch(() => {});
    }
  }

  /**
   * เลือกสาขาที่ทำงาน (หน้า "เลือกสาขาที่ทำงาน" หลังเลือกบริษัท) — กด "เข้าทำงาน" (a-tag ไม่ใช่ button)
   * ของสาขาที่ระบุ ไปจนถึงหน้า /branches/{id}
   *
   * ⚠️ สำคัญ: ขั้นตอนนี้ขาดไม่ได้สำหรับทดสอบ Popup Notification บน Web-App — ถ้า Login+เลือกบริษัทแล้ว
   * แต่ไม่กด "เข้าทำงาน" เลือกสาขา จะยังไม่ถึงจุดที่ระบบ trigger การดึง Popup Notification จริง
   * (ยืนยันจากการ debug จริง 2026-08-31 — ดู qa-context.md)
   *
   * ⚠️ อัปเดต 2026-09-02: สำหรับ popup scope=Global พบว่า trigger จริงเร็วกว่านี้อีก — ทันทีหลัง
   * selectCompany() เลย (ก่อนเรียก selectBranch()) เพราะไม่ต้องรอ branch_id มา match scope
   * ถ้ามี popup ค้างอยู่ backdrop จะบัง link "เข้าทำงาน" จนกดไม่ติด — ต้องปิด popup ก่อนเรียกเมธอดนี้
   */
  async selectBranch(branchName?: string) {
    const workLink = branchName
      ? this.page
          .locator(`text=${branchName}`)
          .locator('xpath=ancestor::*[self::div or self::li][1]')
          .locator('a:has-text("เข้าทำงาน"), button:has-text("เข้าทำงาน")')
          .first()
      : this.page.locator('a:has-text("เข้าทำงาน"), button:has-text("เข้าทำงาน")').first();

    if (await workLink.isVisible({ timeout: 8000 }).catch(() => false)) {
      await workLink.click();
      await this.page.waitForLoadState('networkidle').catch(() => {});
    }
  }

  async expectLoggedIn() {
    await expect(this.page).not.toHaveURL(/login/i);
  }
}
