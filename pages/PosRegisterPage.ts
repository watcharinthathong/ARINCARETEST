import { Page, expect, Locator } from '@playwright/test';
import type { PosMemberInput } from '../data/pos-member.testdata.js';

const POS_URL = process.env.POS_BASE_URL ?? 'https://pos-stg.arincare.com';

/**
 * Page Object: POS "สมัครสมาชิกใหม่" + Bug Investigation
 * Target: pos-stg.arincare.com
 * Login flow มีหลาย step — ดู loginToPos() สำหรับรายละเอียด
 */
export class PosRegisterPage {
  // เก็บ locator ที่ใช้ addLocatorHandler ไว้ เพื่อ removeLocatorHandler ได้ถูกต้อง
  private _dismissLocator: Locator | null = null;

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

    // ── Setup: auto-dismiss promotion popup "ปิด" ──────────────────────────────
    // POS มี promotion modal โผล่สุ่มระหว่าง test — ตั้ง handler ให้ dismiss อัตโนมัติ
    this._dismissLocator = this.page.locator('button:has-text("ปิด")').first();
    await this._addPopupDismissHandler().catch(() => {});

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

  /**
   * ปิด promotion popup ที่โผล่ขวางทันที (quick check เท่านั้น)
   * addLocatorHandler ใน loginToPos จัดการ auto-dismiss ระหว่าง action อยู่แล้ว
   */
  async dismissAllPopups() {
    await this.page.evaluate(() => {
      document.querySelectorAll('[class*="reapop__notification"]').forEach(el => (el as HTMLElement).remove());
    }).catch(() => {});
    for (let i = 0; i < 3; i++) {
      const closeBtn = this.page.locator('button:has-text("ปิด")').first();
      const visible = await closeBtn.isVisible({ timeout: 500 }).catch(() => false);
      if (!visible) break;
      await closeBtn.click().catch(() => {});
      await this.page.waitForTimeout(400);
    }
  }

  private async _dismissOnePopup(): Promise<boolean> {
    const selectors = [
      'button:has-text("ปิด")',                    'button:has-text("Close")',
      '.close',                                    'button.close',
      '[data-dismiss="modal"]',                    '.modal .btn-close',
      '.swal2-close',                              '.swal2-confirm',
      'button:has-text("ยืนยัน")',                 'button:has-text("ยอมรับ")',
      'button:has-text("ตกลง")',                   '[aria-label="Close"]',
      '[aria-label="ปิด"]',
      '[class*="reapop__notification-close"]',     '[class*="reapop"] button',
      '[class*="notification"] button.close',
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

  private async _addPopupDismissHandler() {
    if (!this._dismissLocator) return;
    const loc = this._dismissLocator;
    await this.page.addLocatorHandler(loc, async () => {
      await loc.click({ timeout: 3_000 }).catch(() => {});
      await this.page.evaluate(() => {
        document.querySelectorAll('[class*="reapop__notification"]').forEach(el => (el as HTMLElement).remove());
      }).catch(() => {});
      await this.page.waitForTimeout(500).catch(() => {});
    });
  }

  // ─── Register Form Entry ─────────────────────────────────────────────────────

  async openRegisterForm() {
    await this.dismissAllPopups();
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

  async fillNotesTab(note: string) {
    await this.switchTab('หมายเหตุและการแพ้ยา');
    await this.noteTextarea.fill(note);
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
    await this.dismissAllPopups();
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
    await this.page.waitForTimeout(1_500);

    // Primary: รอฟอร์มปิด — บันทึกสำเร็จ modal จะปิดตัวเอง
    // (ไม่ใช้ dismissAllPopups ที่นี่ เพราะอาจปิด success toast ก่อน assert)
    const formClosed = await this.firstNameInput
      .waitFor({ state: 'hidden', timeout: 12_000 })
      .then(() => true)
      .catch(() => false);

    if (formClosed) {
      // กด confirm ถ้ามี SweetAlert ค้างอยู่
      for (const btnText of ['ยืนยัน', 'ยอมรับ', 'ตกลง']) {
        const btn = this.page
          .locator('.swal2-confirm, .btn-success, .btn')
          .filter({ hasText: btnText })
          .filter({ visible: true })
          .first();
        if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
          await btn.click().catch(() => {});
          break;
        }
      }
      return;
    }

    // Fallback: ฟอร์มยังเปิดอยู่ (มี confirm dialog) → หา success toast
    const toast = this.page
      .locator('[role="alert"], .alert, .swal2-popup, .reapop__notification')
      .filter({ hasText: /เรียบร้อย|สำเร็จ|บันทึก|saved|success/i })
      .first();
    await expect.soft(toast).toBeVisible({ timeout: 5_000 });

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
    await this.openMemberEditForm(currentMobile);
    await this.mobileInput.fill(newMobile);
    await this.save();
    await this.expectSaveSuccess();
    await this.page.waitForTimeout(1_000);
  }

  /**
   * ค้นหาสมาชิก → POS แสดง member card inline → คลิก "ดูรายละเอียด" → คลิก "แก้ไข"
   *
   * POS flow: search → member card ปรากฏโดยอัตโนมัติ (ไม่ต้องคลิก dropdown item)
   *           → ปุ่ม "ดูรายละเอียด" ใน card → ปุ่ม "แก้ไข" ใน detail view
   */
  async openMemberEditForm(mobile: string) {
    await this.searchMember(mobile);
    // รอ modal backdrop จาก operation ก่อนหน้า (edit form / dialog) ให้หายสนิท
    await this.page.locator('.modal-backdrop').waitFor({ state: 'detached', timeout: 3_000 }).catch(() => {});
    await this.dismissAllPopups();
    await this.page.waitForTimeout(500);

    // คลิก "ดูรายละเอียด" เพื่อเปิด member detail dialog
    // ใช้ force: true เพราะ div[tabindex="-1"] ที่ค้างจาก modal ก่อนหน้าอาจ intercept pointer events
    const detailBtn = this.page.locator('button:has-text("ดูรายละเอียด")').first();
    if (await detailBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await detailBtn.click({ force: true });
      await this.page.waitForTimeout(1_500);
      await this.dismissAllPopups();
    }

    // รอให้ member detail dialog เปิดสมบูรณ์ (มี heading "ข้อมูลสมาชิก")
    // แล้ว scope "แก้ไข" ไว้ใน dialog — ป้องกัน match ปุ่มซ่อนอื่นในหน้า POS
    const memberDialog = this.page
      .locator('dialog:has-text("ข้อมูลสมาชิก"), [role="dialog"]:has-text("ข้อมูลสมาชิก")')
      .first();
    await memberDialog.waitFor({ state: 'visible', timeout: 8_000 }).catch(() => {});

    const editBtn = memberDialog.locator('button:has-text("แก้ไข")').first();
    if (await editBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await editBtn.click();
      await this.page.waitForTimeout(1_000);
      await this.dismissAllPopups();
    }

    await expect(this.firstNameInput).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Switch ไป Tab ใบกำกับภาษี แล้วตรวจสอบว่า fields มีค่าตรงกับที่คาดไว้
   * ใช้ expect.soft ทุก field เพื่อสะสม failures ไว้รายงาน
   */
  async expectTaxFieldsPopulated(expected: Partial<PosMemberInput>) {
    await this.switchTab('ข้อมูลใบกำกับภาษี');
    if (expected.companyName !== undefined)
      await expect.soft(this.companyNameInput).toHaveValue(expected.companyName, { timeout: 5_000 });
    if (expected.taxId !== undefined)
      await expect.soft(this.taxIdInput).toHaveValue(expected.taxId, { timeout: 5_000 });
    if (expected.contactName !== undefined)
      await expect.soft(this.contactNameInput).toHaveValue(expected.contactName, { timeout: 5_000 });
    if (expected.phoneNumber !== undefined)
      await expect.soft(this.phoneNumberInput).toHaveValue(expected.phoneNumber, { timeout: 5_000 });
    if (expected.address1 !== undefined)
      await expect.soft(this.address1Textarea).toHaveValue(expected.address1, { timeout: 5_000 });
    if (expected.zipcode !== undefined)
      await expect.soft(this.zipcodeInput).toHaveValue(expected.zipcode, { timeout: 5_000 });
  }
}
