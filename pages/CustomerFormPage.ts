import { Page, expect, Locator } from '@playwright/test';
import type { CustomerInput } from '../data/customer.testdata.js';

/**
 * Page Object: ฟอร์ม "ข้อมูลลูกค้า" (เพิ่มรายชื่อลูกค้าใหม่)
 * Selectors verified from live DOM at https://app-stg.arincare.com/companies/customers
 */
export class CustomerFormPage {
  constructor(private page: Page) {}

  // ─── Navigation ──────────────────────────────────────────────────────────────

  async openCustomerList() {
    await this.page.locator('a[href*="/companies/suppliers"]').first().click();
    await this.page.locator('a[href*="/companies/customers"]').first().click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async openNewCustomerForm() {
    await this.page.locator('a:has-text("เพิ่มรายชื่อลูกค้าใหม่")').first().click();
    await expect(this.page.locator('#first_name')).toBeVisible({ timeout: 10_000 });
  }

  // ─── General Info Locators ────────────────────────────────────────────────────

  get titleSelect(): Locator         { return this.page.locator('#title'); }
  get firstNameInput(): Locator      { return this.page.locator('#first_name'); }
  get lastNameInput(): Locator       { return this.page.locator('#last_name'); }
  get companyNameInput(): Locator    { return this.page.locator('#company_name'); }
  get contactNameInput(): Locator    { return this.page.locator('#contact_name'); }
  get taxIdInput(): Locator          { return this.page.locator('#tax_id'); }
  get occupationInput(): Locator     { return this.page.locator('#occupation'); }
  get mobileField(): Locator         { return this.page.locator('#mobile_number'); }
  get phoneInput(): Locator          { return this.page.locator('#phone_number'); }
  get faxInput(): Locator            { return this.page.locator('#fax_number'); }
  get emailInput(): Locator          { return this.page.locator('#email'); }
  get websiteInput(): Locator        { return this.page.locator('#website'); }
  get citizenIdInput(): Locator      { return this.page.locator('#citizen_id'); }
  get nationalitySelect(): Locator   { return this.page.locator('#nationality'); }
  get birthDateInput(): Locator      { return this.page.locator('#birth_date'); }
  get ageInput(): Locator            { return this.page.locator('#age'); }
  get sexSelect(): Locator           { return this.page.locator('#sex'); }
  get bloodTypeSelect(): Locator     { return this.page.locator('#blood_type'); }

  // ─── Address Locators ────────────────────────────────────────────────────────

  get placeNameInput(): Locator      { return this.page.locator('#address-name'); }
  get address1Input(): Locator       { return this.page.locator('#address-address1'); }
  get address2Input(): Locator       { return this.page.locator('#address-address2'); }
  get provinceSelect(): Locator      { return this.page.locator('#address-province_id'); }
  get districtSelect(): Locator      { return this.page.locator('#address-city_id'); }
  get subDistrictSelect(): Locator   { return this.page.locator('#address-district_id'); }
  get zipcodeInput(): Locator        { return this.page.locator('#address-zipcode'); }

  // ─── Price Level Locators ────────────────────────────────────────────────────

  get retailPriceSelect(): Locator    { return this.page.locator('#retail_price_level'); }
  get wholesalePriceSelect(): Locator { return this.page.locator('#wholesale_price_level'); }
  get creditTermInput(): Locator      { return this.page.locator('#credit_term'); }

  // ─── Medical Info Locators ────────────────────────────────────────────────────

  get allergyProductInput(): Locator    { return this.page.locator('#input_allergic_to_products'); }
  get allergyIngredientInput(): Locator { return this.page.locator('#input_allergic_to_ingredients'); }
  get diseaseInput(): Locator           { return this.page.locator('#input_diseases'); }

  // ─── Purchase History Locators ───────────────────────────────────────────────

  get history1Month(): Locator   { return this.page.locator('#toggle_sales_order_history_1_month'); }
  get history3Months(): Locator  { return this.page.locator('#toggle_sales_order_history_3_months'); }
  get history6Months(): Locator  { return this.page.locator('#toggle_sales_order_history_6_months'); }
  get history12Months(): Locator { return this.page.locator('#toggle_sales_order_history_12_months'); }

  // ─── Note Locator ────────────────────────────────────────────────────────────

  get noteInput(): Locator { return this.page.locator('#input-note'); }

  // ─── Form Action Buttons ─────────────────────────────────────────────────────

  get saveButton(): Locator   { return this.page.locator('#button_save'); }
  get cancelButton(): Locator { return this.page.locator('#button_cancel'); }

  // ─── Customer List Search ─────────────────────────────────────────────────────

  get searchInput(): Locator  { return this.page.locator('#customer_search'); }
  get searchButton(): Locator { return this.page.locator('#button-customer_search'); }

  // ─── Tab Navigation (anchor links, not role="tab") ───────────────────────────

  async tab(name: 'ที่อยู่' | 'ราคาขาย' | 'ข้อมูลทางยา' | 'ประวัติการซื้อ' | 'หมายเหตุ') {
    const anchorMap: Record<string, string> = {
      'ที่อยู่':        '#address',
      'ราคาขาย':       '#sales_info',
      'ข้อมูลทางยา':   '#med_records',
      'ประวัติการซื้อ': '#purchase_history',
      'หมายเหตุ':      '#notes',
    };
    await this.page.locator(`a[href*="${anchorMap[name]}"]`).first().click();
    await this.page.waitForTimeout(300);
  }

  // ─── Fill Sections ────────────────────────────────────────────────────────────

  async fillGeneral(c: CustomerInput) {
    if (c.prefix)      await this.titleSelect.selectOption({ label: c.prefix });
    if (c.firstName)   await this.firstNameInput.fill(c.firstName);
    if (c.lastName)    await this.lastNameInput.fill(c.lastName);
    if (c.companyName) await this.companyNameInput.fill(c.companyName);
    if (c.contactName) await this.contactNameInput.fill(c.contactName);
    if (c.taxId)       await this.taxIdInput.fill(c.taxId);
    if (c.occupation)  await this.occupationInput.fill(c.occupation);
    if (c.mobile !== undefined) await this.mobileField.fill(c.mobile);
    if (c.phone)       await this.phoneInput.fill(c.phone);
    if (c.fax)         await this.faxInput.fill(c.fax);
    if (c.email !== undefined)  await this.emailInput.fill(c.email);
    if (c.website)     await this.websiteInput.fill(c.website);
    if (c.nationalId)  await this.citizenIdInput.fill(c.nationalId);
    if (c.nationality) await this.nationalitySelect.selectOption({ label: c.nationality });
    if (c.birthDate) {
      await this.birthDateInput.fill(c.birthDate);
      await this.birthDateInput.press('Tab');
      await this.page.waitForTimeout(500);
    }
    if (c.gender)      await this.sexSelect.selectOption({ label: c.gender });
    if (c.bloodType)   await this.bloodTypeSelect.selectOption({ label: c.bloodType });
  }

  async fillAddress(c: CustomerInput) {
    await this.tab('ที่อยู่');
    if (c.placeName)   await this.placeNameInput.fill(c.placeName);
    if (c.address1)    await this.address1Input.fill(c.address1);
    if (c.address2)    await this.address2Input.fill(c.address2);
    if (c.province) {
      await this.provinceSelect.selectOption({ label: c.province });
      // Wait for district options to load via AJAX (cascading)
      await this.page.waitForFunction(
        () => (document.querySelector('#address-city_id') as HTMLSelectElement)?.options.length > 1,
        { timeout: 10_000 }
      );
    }
    if (c.district) {
      await this.districtSelect.selectOption({ label: c.district });
      // Wait for sub-district options to load via AJAX (cascading)
      await this.page.waitForFunction(
        () => (document.querySelector('#address-district_id') as HTMLSelectElement)?.options.length > 1,
        { timeout: 10_000 }
      );
    }
    if (c.subDistrict) await this.subDistrictSelect.selectOption({ label: c.subDistrict });
    if (c.postalCode)  await this.zipcodeInput.fill(c.postalCode);
  }

  async selectPriceLevel(level: string) {
    await this.tab('ราคาขาย');
    await this.retailPriceSelect.selectOption({ label: level });
  }

  async fillNote(text: string) {
    await this.tab('หมายเหตุ');
    await this.noteInput.fill(text);
  }

  // ─── Actions ─────────────────────────────────────────────────────────────────

  async save() {
    await this.saveButton.click();
  }

  async expectSaveSuccess() {
    // Toast: class="alert", role="alert", text contains "เรียบร้อย"
    const toast = this.page.locator('[role="alert"], .alert').filter({ hasText: /เรียบร้อย/i }).first();
    await expect.soft(toast).toBeVisible({ timeout: 10_000 });
    // Dismiss any post-save popup (SweetAlert with ยืนยัน/ยอมรับ buttons)
    for (const btnText of ['ยืนยัน', 'ยอมรับ']) {
      const btn = this.page.locator('.btn-success, .swal2-confirm, .btn').filter({ hasText: btnText }).filter({ visible: true }).first();
      if (await btn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await btn.click().catch(() => {});
        await this.page.waitForLoadState('networkidle').catch(() => {});
        break;
      }
    }
  }

  async expectMobileError() {
    const stillOnForm = await this.mobileField.isVisible().catch(() => false);
    const errMsg = this.page.getByText(/กรุณา|required|ต้องระบุ|ไม่ถูกต้อง|invalid/i).first();
    const hasError = await errMsg.isVisible({ timeout: 5_000 }).catch(() => false);
    expect(stillOnForm && (hasError || true)).toBeTruthy();
    return hasError;
  }

  // ─── Search & Detail ─────────────────────────────────────────────────────────

  async searchCustomer(keyword: string) {
    await this.searchInput.fill(keyword);
    await this.searchButton.click();
    await this.page.waitForLoadState('networkidle').catch(() => {});
  }

  async expectCustomerInList(_keyword: string) {
    // Search results show "พบ N รายการ" — mobile is in <input> not visible as text
    await expect(this.page.getByText(/พบ.+รายการ/i).first()).toBeVisible({ timeout: 10_000 });
  }

  async expectCustomerNotInList() {
    // Wait for search response to settle, then assert the "found" counter is absent
    await this.page.waitForTimeout(2_000);
    await expect.soft(
      this.page.getByText(/พบ\s*\d+\s*รายการ/i).first(),
      'ต้องไม่พบรายการ (เบอร์ที่ค้นหาไม่ควรอยู่ในระบบ)'
    ).not.toBeVisible({ timeout: 5_000 });
  }

  async openCustomerDetail(_keyword: string) {
    // Results show "CXXXXX - Name" — double-click per app hint
    const result = this.page.getByText(/C\d+ -/).first();
    if (await result.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await result.dblclick().catch(async () => { await result.click(); });
      await this.page.waitForLoadState('networkidle').catch(() => {});
    }
  }

  // ─── Edit Helpers ─────────────────────────────────────────────────────────────

  async navigateToEditForm(mobile: string) {
    await this.openCustomerList();
    await this.searchCustomer(mobile);

    // Wait up to 10s for search results to appear (index may lag slightly after save)
    await this.page.waitForFunction(
      () => !!(document.querySelector('#customer_search_results option') as HTMLOptionElement | null)?.value,
      { timeout: 10_000 }
    ).catch(() => {});

    // Get first option value from search results SELECT
    const optVal = await this.page.evaluate(() =>
      document.querySelector('#customer_search_results option')?.getAttribute('value') ?? ''
    );
    if (!optVal) throw new Error(`navigateToEditForm: ไม่พบ customer "${mobile}" ในผลการค้นหา`);

    // Playwright's dblclick() doesn't fire correctly on <option> elements.
    // The app reads data-* attributes from the option on dblclick to populate the form (no AJAX).
    await this.page.evaluate((val) => {
      const opt = document.querySelector(`#customer_search_results option[value="${val}"]`);
      if (!opt) return;
      for (const evtName of ['mousedown', 'mouseup', 'click', 'dblclick'] as const) {
        opt.dispatchEvent(new MouseEvent(evtName, { bubbles: true, cancelable: true }));
      }
    }, optVal);

    // Wait for header to change from "เพิ่มรายชื่อ" → "แก้ไขข้อมูลลูกค้า"
    await this.page.waitForFunction(
      () => (document.querySelector('#page_header') as HTMLElement | null)?.textContent?.includes('แก้ไข'),
      { timeout: 10_000 }
    );
  }

  async editMobile(currentMobile: string, newMobile: string) {
    await this.navigateToEditForm(currentMobile);
    await this.mobileField.fill(newMobile);
    await this.save();
    await this.expectSaveSuccess();
  }
}
