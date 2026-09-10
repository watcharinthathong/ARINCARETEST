import { Page } from '@playwright/test';

/**
 * Shared login sequence for the Admin panel (admin-stg.arincare.com) — a separate
 * Laravel app from the customer site, with its own login form (`input[type="password"]`,
 * not `input[name="password"]`).
 */
export async function adminLogin(page: Page, baseUrl: string, email: string, password: string) {
  await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#preloader', { state: 'hidden', timeout: 15000 }).catch(() => {});
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('#login-btn').click();
  await page.waitForLoadState('networkidle').catch(() => {});
}
