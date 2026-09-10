import { Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TelepharmacyLoginPage, TELEPHARMACY_BASE } from '../../pages/TelepharmacyLoginPage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/** Common Telepharmacy CMS test accounts (Telepharmacy_CMS_Selectors.xlsx) */
export const BASE     = TELEPHARMACY_BASE;
export const OPERATOR = { email: 'operator@medcare.com', pass: 'Oper@1234' };
export const PHARMA   = { email: 'pharma@medcare.com',   pass: 'Pharm@1234' };

export interface Result {
  id: string;
  scenario: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  actualResult: string;
  remark: string;
  screenshots: string[];
}

/** Bind a screenshot helper to a per-suite screenshots/ directory (creating it if needed) */
export function makeScreenshotter(ssDir: string) {
  if (!fs.existsSync(ssDir)) fs.mkdirSync(ssDir, { recursive: true });
  return async function ss(page: Page, name: string): Promise<string> {
    const file = `${name}.png`;
    await page.screenshot({ path: path.join(ssDir, file), fullPage: true });
    return file;
  };
}

export async function goLogin(page: Page) {
  await new TelepharmacyLoginPage(page).goto();
}

export async function fillCreds(page: Page, email: string, pass: string) {
  await new TelepharmacyLoginPage(page).fillCredentials(email, pass);
}

export async function clickSignIn(page: Page) {
  await new TelepharmacyLoginPage(page).submit();
}

export async function getBodyText(page: Page): Promise<string> {
  return page.locator('body').innerText().catch(() => '');
}

/** Try selectors in order, return the first one visible within timeoutMs */
export async function findFirst(
  page: Page,
  selectors: readonly string[],
  timeoutMs = 2000,
): Promise<{ found: boolean; sel: string; text: string }> {
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      const visible = await el.isVisible({ timeout: timeoutMs }).catch(() => false);
      if (visible) {
        const text = await el.innerText().catch(() => '');
        return { found: true, sel, text };
      }
    } catch { /* try next */ }
  }
  return { found: false, sel: '', text: '' };
}

/** Write the RESULTS array to results/<outFileName> (consumed by scripts/gsheet/*.py) */
export function writeResultsJson(outFileName: string, results: Result[]): string {
  const out = path.join(__dirname, '../../results', outFileName);
  fs.writeFileSync(out, JSON.stringify(results, null, 2), 'utf-8');
  return out;
}
