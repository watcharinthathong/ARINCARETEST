import { Page } from '@playwright/test';

/** Telepharmacy CMS base URL (separate app from the main Arincare site) */
export const TELEPHARMACY_BASE = 'https://telepharmacy-cms.vercel.app';

/**
 * Selectors shared by every Telepharmacy CMS test across the
 * login → select-store → select-branch → select-supervisor flow.
 * Values verified from live DOM (Telepharmacy_CMS_Selectors.xlsx).
 */
export const TELEPHARMACY_SEL = {
  username: 'input[type="text"]',
  password: 'input[type="password"]',
  signIn:   'button[type="submit"]',

  storeCard:  'text=Watcharin TestTest',
  branchCard: 'text=สำนักงานใหญ่',
  nextBtn:    'button:has-text("ถัดไป"):not([disabled])',
  backBtn:    'button:has-text("ย้อนกลับ")',
  confirmBtn: 'button:has-text("ยืนยันและเข้าสู่ระบบ"):not([disabled])',

  supervisorHeading: 'text=เลือกเภสัชกรผู้ควบคุม',
  supervisorCard:    'button[class*="overflow-hidden"][class*="rounded-2xl"]',
  supervisorLicense: 'text=เลขใบประกอบฯ',
} as const;

export class TelepharmacyLoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto(`${TELEPHARMACY_BASE}/login`, { waitUntil: 'networkidle' });
    await this.page.waitForTimeout(1200);
  }

  async fillCredentials(email: string, pass: string) {
    await this.page.locator(TELEPHARMACY_SEL.username).fill(email);
    await this.page.locator(TELEPHARMACY_SEL.password).fill(pass);
  }

  async submit() {
    await this.page.locator(TELEPHARMACY_SEL.signIn).click();
    await this.page.waitForTimeout(4000);
  }
}
