import { Page, expect, Locator } from '@playwright/test';
import type { PosMemberInput } from '../data/pos-member.testdata.js';

const POS_URL = process.env.POS_BASE_URL ?? 'https://pos-stg.arincare.com';

/**
 * Page Object: POS "สมัครสมาชิกใหม่" + Bug Investigation
 * Target: pos-stg.arincare.com
 * Login flow มีหลาย step — ดู loginToPos() สำหรับรายละเอียด
 */
export class PosRegisterPage {
  constructor(private page: Page) {}

  // ─── Navigation ──────────────────────────────────────────────────────────────

  async goto() {
    // POS ต้องเข้าผ่าน /login เสมอ
    await this.page.goto(`${POS_URL}/login`, { waitUntil: 'domcontentloaded' });
    await this.page.waitForSelector('#preloader, .preloader, [class*="preloader"]', {
      state: 'hidden', timeout: 15_000
    }).catch(() => {});
    await this.page.waitForTimeout(2_000);
  }

  /**
   * POS login flow 4 ขั้นตอน (ตาม discover-pos-member-selectors.ts):
   *   1) Web login (email + password)
   *   2) เลือกบริษัท + สาขา → บันทึกการเปลี่ยนแปลง (รอ 4 วิ)
   *   3) กด "เสร็จสิ้น" บน confirmation screen (รอ 4 วิ)
   *   4) Employee login (username + password) + dismiss popups (ลูป ≤ 5 ครั้ง)
   */
  async loginToPos(options: {
    username?:     string;
    password?:     string;
    company?:      string;
    branch?:       string;
    employeeId?:   string;
    employeePass?: string;
  } = {}) {
    const {
      username     = process.env.TEST_USERNAME      ?? 'watcharin.arincare@gmail.com',
      password     = process.env.TEST_PASSWORD      ?? '01072024',
      company      = process.env.COMPANY_NAME       ?? 'Arincare Pharmacy',
      branch       = process.env.POS_BRANCH         ?? 'arincare',
      employeeId   = process.env.POS_EMPLOYEE_ID    ?? 'watcharin.arincare@gmail.com',
      employeePass = process.env.POS_EMPLOYEE_PASS  ?? '01072024',
    } = options;

    // ── STEP 1: Web login ─────────────────────────────────────────────────────
    const emailInput = this.page.locator('input[name="email"]').first();
    if (await emailInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await emailInput.fill(username);
      await this.page.locator('input[type="password"]').first().fill(password);
      await this.page.locator('button:has-text("เข้าสู่ระบบ")').first().click();
      await this.page.waitForLoadState('networkidle').catch(() => {});
      await this.page.waitForTimeout(3_000);
    }

    // ── STEP 2: เลือกบริษัท + สาขา ──────────────────────────────────────────
    const companySelect = this.page.locator('select[name="companyId"]').first();
    if (await companySelect.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await this.page.waitForTimeout(1_500);
      await companySelect.selectOption({ label: company });
      await this.page.waitForTimeout(500);
      const branchSelect = this.page.locator('select[name="branchId"]').first();
      if (await branchSelect.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await branchSelect.selectOption({ label: branch });
      }
      await this.page.waitForTimeout(500);
      await this.page.locator('button:has-text("บันทึกการเปลี่ยนแปลง")').first().click();
      await this.page.waitForLoadState('networkidle').catch(() => {});
      await this.page.waitForTimeout(4_000); // รอ confirmation screen load
    }

    // ── STEP 3: กด "เสร็จสิ้น" บน Setup Complete screen ─────────────────────
    await this.page.waitForTimeout(2_000); // รอ screen render ก่อนหาปุ่ม
    const doneBtn = this.page.locator('button:has-text("เสร็จสิ้น")').first();
    if (await doneBtn.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await doneBtn.click();
      await this.page.waitForLoadState('networkidle').catch(() => {});
      await this.page.waitForTimeout(4_000); // รอ employee login screen
    }

    // ── STEP 4: Employee login ────────────────────────────────────────────────
    await this.page.waitForTimeout(3_000); // รอ page settle
    const empInput = this.page.locator([
      'input[name="username"]', 'input[name="employee_id"]',
      'input[name="code"]', 'input[type="email"]',
    ].join(', ')).first();
    if (await empInput.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await empInput.fill(employeeId);
      await this.page.locator('input[type="password"]').last().fill(employeePass);
      await this.page.locator('button:has-text("เข้าสู่ระบบ")').last().click();
      await this.page.waitForLoadState('networkidle').catch(() => {});
      await this.page.waitForTimeout(4_000);
    }

    // ── STEP 5: Dismiss startup popups (≤ 5 รอบ) ─────────────────────────────
    for (let i = 0; i < 5; i++) {
      const closed = await this._dismissOnePopup();
      if (!closed) break;
      await this.page.waitForTimeout(1_500);
    }
    await this.page.waitForTimeout(2_000); // รอ POS main page พร้อม
  }

  private async _dismissOnePopup(): Promise<boolean> {
    const selectors = [
      'button:has-text("ปิด")',    'button:has-text("Close")',
      '.close',                    'button.close',
      '[data-dismiss="modal"]',    '.modal .btn-close',
      '.swal2-close',              '.swal2-confirm',
      'button:has-text("ยืนยัน")', 'button:has-text("ยอมรับ")',
      'button:has-text("ตกลง")',   '[aria-label="Close"]',
      '[aria-label="ปิด"]',
    ];
    for (const sel of selectors) {
      const el = this.page.locator(sel).first();
      if (await el.isVisible({ timeout: 1_500 }).catch(() => false)) {
        await el.click().catch(() => {});
        return true;
      }
    }
    return false;
  }

  // ─── Register Form Entry ─────────────────────────────────────────────────────

  async openRegisterForm() {
    await this.page.locator('button:has-text("สมัครสมาชิกใหม่")').first().click();
    await expect(this.page.locator('input[name="first_name"]').first())
      .toBeVisible({ timeout: 10_000 });
  }

  // ─── General Info Locators ────────────────────────────────────────────────────

  get firstNameInput(): Locator    { return this.page.locator('input[name="first_name"]').first(); }
  get lastNameInput(): Locator     { return this.page.locator('input[name="last_name"]').first(); }
  get mobileInput(): Locator       { return this.page.locator('input[name="mobile_number"]').first(); }
  get emailInput(): Locator        { return this.page.locator('input[name="email"]').first(); }
  get birthDateInput(): Locator    { return this.page.locator('[placeholder="วว/ดด/ปปปป"]').first(); }
  get sexSelect(): Locator         { return this.page.locator('select[name="sex"]').first(); }
  get nationalitySelect(): Locator { return this.page.locator('select[name="nationality"]').first(); }
  get citizenIdInput(): Locator    { return this.page.locator('input[name="citizen_id"]').first(); }
  get occupationInput(): Locator   { return this.page.locator('input[name="occupation"]').first(); }
  get bloodTypeSelect(): Locator   { return this.page.locator('select[name="blood_type"]').first(); }
  get priceLevelSelect(): Locator  { return this.page.locator('select[name="price_level"]').first(); }
  get noteTextarea(): Locator      { return this.page.locator('textarea[name="note"]').first(); }

  // ─── Tax Info Tab Locators ────────────────────────────────────────────────────

  get companyNameInput(): Locator  { return this.page.locator('input[name="company_name"]').first(); }
  get taxIdInput(): Locator        { return this.page.locator('input[name="tax_id"]').first(); }
  get contactNameInput(): Locator  { return this.page.locator('input[name="contact_name"]').first(); }
  get phoneNumberInput(): Locator  { return this.page.locator('input[name="phone_number"]').first(); }
  get locationNameInput(): Locator { return this.page.locator('input[name="location_name"]').first(); }
  get provinceSelect(): Locator    { return this.page.locator('select[name="province_id"]').first(); }
  get citySelect(): Locator        { return this.page.locator('select[name="city_id"]').first(); }
  get districtSelect(): Locator    { return this.page.locator('select[name="district_id"]').first(); }
  get address1Textarea(): Locator  { return this.page.locator('textarea[name="address1"]').first(); }
  get address2Textarea(): Locator  { return this.page.locator('textarea[name="address2"]').first(); }
  get zipcodeInput(): Locator      { return this.page.locator('input[name="zipcode"]').first(); }

  // ─── Tab Navigation ───────────────────────────────────────────────────────────

  async switchTab(tabName: 'ข้อมูลทั่วไป' | 'ข้อมูลใบกำกับภาษี' | 'หมายเหตุและการแพ้ยา') {
    await this.page.locator(`li:has-text("${tabName}")`).first().click();
    await this.page.waitForTimeout(300);
  }

  // ─── Form Action Buttons ──────────────────────────────────────────────────────
  // ใช้ :not(.dropdown-item) เพราะ POS nav มี hidden "บันทึก" dropdown-item ซึ่ง
  // Playwright จะ resolve ก่อนถ้าไม่ exclude ออก

  get saveButton(): Locator   { return this.page.locator('button:has-text("บันทึก"):not(.dropdown-item)').first(); }
  get cancelButton(): Locator { return this.page.locator('button:has-text("ยกเลิก"):not(.dropdown-item)').first(); }
  get closeButton(): Locator  { return this.page.locator('[aria-label="Close"], button.close, button:has-text("×")').first(); }

  // ─── Fill Sections ────────────────────────────────────────────────────────────

  async fillGeneralInfo(m: PosMemberInput) {
    if (m.firstName)            await this.firstNameInput.fill(m.firstName);
    if (m.lastName)             await this.lastNameInput.fill(m.lastName);
    if (m.mobile !== undefined) await this.mobileInput.fill(m.mobile);
    if (m.email !== undefined)  await this.emailInput.fill(m.email);
    if (m.birthDate) {
      await this.birthDateInput.fill(m.birthDate);
      await this.birthDateInput.press('Tab');
      await this.page.waitForTimeout(500);
    }
    if (m.gender)      await this.sexSelect.selectOption({ label: m.gender });
    if (m.nationality) await this.nationalitySelect.selectOption({ label: m.nationality });
    if (m.citizenId)   await this.citizenIdInput.fill(m.citizenId);
    if (m.occupation)  await this.occupationInput.fill(m.occupation);
    if (m.bloodType)   await this.bloodTypeSelect.selectOption({ label: m.bloodType });
    if (m.priceLevel)  await this.priceLevelSelect.selectOption({ label: m.priceLevel });
    if (m.note)        await this.noteTextarea.fill(m.note);
  }

  async fillTaxInfo(m: PosMemberInput) {
    await this.switchTab('ข้อมูลใบกำกับภาษี');
    if (m.companyName)  await this.companyNameInput.fill(m.companyName);
    if (m.taxId)        await this.taxIdInput.fill(m.taxId);
    if (m.contactName)  await this.contactNameInput.fill(m.contactName);
    if (m.phoneNumber)  await this.phoneNumberInput.fill(m.phoneNumber);
    if (m.locationName) await this.locationNameInput.fill(m.locationName);
    if (m.address1)     await this.address1Textarea.fill(m.address1);
    if (m.address2)     await this.address2Textarea.fill(m.address2);
    if (m.province) {
      await this.provinceSelect.selectOption({ label: m.province });
      await this.page.waitForFunction(
        () => (document.querySelector('select[name="city_id"]') as HTMLSelectElement)?.options.length > 1,
        { timeout: 10_000 }
      );
    }
    if (m.city) {
      await this.citySelect.selectOption({ label: m.city });
      await this.page.waitForFunction(
        () => (document.querySelector('select[name="district_id"]') as HTMLSelectElement)?.options.length > 1,
        { timeout: 10_000 }
      );
    }
    if (m.district) await this.districtSelect.selectOption({ label: m.district });
    if (m.zipcode)  await this.zipcodeInput.fill(m.zipcode);
  }

  // ─── Save / Cancel / Close ────────────────────────────────────────────────────

  async save() {
    await this.saveButton.scrollIntoViewIfNeeded();
    await this.saveButton.click();
  }

  async cancel() {
    await this.cancelButton.click();
  }

  async close() {
    await this.closeButton.click();
  }

  // ─── Assertions ───────────────────────────────────────────────────────────────

  async expectSaveSuccess() {
    const toast = this.page
      .locator('[role="alert"], .alert')
      .filter({ hasText: /เรียบร้อย|สำเร็จ|บันทึก/i })
      .first();
    await expect.soft(toast).toBeVisible({ timeout: 10_000 });
    for (const btnText of ['ยืนยัน', 'ยอมรับ', 'ตกลง']) {
      const btn = this.page
        .locator('.btn-success, .swal2-confirm, .btn')
        .filter({ hasText: btnText })
        .filter({ visible: true })
        .first();
      if (await btn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await btn.click().catch(() => {});
        await this.page.waitForLoadState('networkidle').catch(() => {});
        break;
      }
    }
  }

  async expectFormVisible() {
    await expect(this.firstNameInput).toBeVisible({ timeout: 10_000 });
  }

  async expectFormClosed() {
    await expect(this.firstNameInput).not.toBeVisible({ timeout: 5_000 });
  }

  async expectValidationError() {
    const stillOnForm = await this.firstNameInput.isVisible().catch(() => false);
    const errMsg = this.page
      .locator('.has-error, .field-error, [class*="error"], .alert-danger, .text-danger')
      .first();
    const hasError = await errMsg.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(stillOnForm || hasError).toBeTruthy();
  }

  // ─── Member Search ────────────────────────────────────────────────────────────

  async searchMember(keyword: string) {
    const searchInput = this.page.locator('[placeholder="ค้นหาลูกค้าสมาชิก (ctrl + M)"]').first();
    await searchInput.clear();
    await searchInput.fill(keyword);
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(2_000); // รอ index refresh
  }

  async expectMemberFound(mobile: string) {
    // ค้นหาเบอร์ในผลลัพธ์ (dropdown / list / card)
    await this.page.waitForTimeout(1_000);
    const byText = this.page.locator(`text=${mobile}`).first();
    const textVisible = await byText.isVisible({ timeout: 5_000 }).catch(() => false);

    const listItem = this.page.locator(
      '[class*="member"], [class*="customer"], [class*="result"], .dropdown-item'
    ).first();
    const listVisible = await listItem.isVisible({ timeout: 3_000 }).catch(() => false);

    expect(textVisible || listVisible, `ค้นหาเบอร์ ${mobile} ต้องพบผลลัพธ์`).toBeTruthy();
  }

  async expectMemberNotFound() {
    await this.page.waitForTimeout(2_000); // ให้ index settle ก่อน assert
    // "ไม่พบ" message หรือ list ว่างเปล่า
    const noResultMsg = this.page
      .locator(':text("ไม่พบ"), :text("ไม่มีข้อมูล"), :text("no result"), [class*="no-result"]')
      .first();
    const hasMsg = await noResultMsg.isVisible({ timeout: 3_000 }).catch(() => false);

    const resultList = this.page
      .locator('[class*="member-list"], [class*="search-result"], [class*="dropdown"]')
      .filter({ hasNotText: /ค้นหา/ })
      .first();
    const listHidden = !(await resultList.isVisible({ timeout: 2_000 }).catch(() => false));

    expect.soft(hasMsg || listHidden, 'ค้นหาด้วยเบอร์เก่าต้องไม่พบรายการ').toBeTruthy();
  }

  // ─── Edit Member Mobile (Bug Investigation) ────────────────────────────────

  /**
   * ค้นหาสมาชิก → เปิด edit form → เปลี่ยนเบอร์ → บันทึก
   * ใช้สำหรับ bug test cases POS-EDIT-*
   */
  async editMemberMobile(currentMobile: string, newMobile: string) {
    // 1. ค้นหาสมาชิก
    await this.searchMember(currentMobile);

    // 2. คลิก result แรกที่พบ เพื่อเปิดข้อมูลสมาชิก
    const resultSelectors = [
      `[class*="result"]:has-text("${currentMobile}")`,
      `[class*="member"]:has-text("${currentMobile}")`,
      `.dropdown-item:has-text("${currentMobile}")`,
      `li:has-text("${currentMobile}")`,
      `td:has-text("${currentMobile}")`,
    ];
    for (const sel of resultSelectors) {
      const el = this.page.locator(sel).first();
      if (await el.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await el.click();
        break;
      }
    }
    await this.page.waitForTimeout(1_000);

    // 3. คลิก "แก้ไข" เพื่อเข้าโหมดแก้ไข
    const editBtn = this.page.locator('button:has-text("แก้ไข")').first();
    if (await editBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await editBtn.click();
      await this.page.waitForTimeout(500);
    }

    // 4. เปลี่ยนเบอร์มือถือ
    await this.mobileInput.fill(newMobile);

    // 5. บันทึก
    await this.save();
    await this.expectSaveSuccess();
    await this.page.waitForTimeout(1_000);
  }
}
