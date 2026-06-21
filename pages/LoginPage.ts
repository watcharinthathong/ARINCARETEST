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

  async expectLoggedIn() {
    await expect(this.page).not.toHaveURL(/login/i);
  }
}
