import { Browser, BrowserContext, Page, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

/** telepharmacy-liff.vercel.app — the LIFF (LINE Front-end Framework) patient app */
export const LIFF_BASE = 'https://telepharmacy-liff.vercel.app';

/** Stored LINE OAuth session, shared by every LIFF test file */
export const LIFF_SESSION = path.join(__dirname, '../../liff-session.json');

/** Bind a screenshot helper to a per-suite screenshots/ directory (creating it if needed) */
export function makeScreenshotter(ssDir: string) {
  if (!fs.existsSync(ssDir)) fs.mkdirSync(ssDir, { recursive: true });
  return async function ss(page: Page, name: string): Promise<string> {
    const file = path.join(ssDir, `${name}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log(`  📸 ${name}.png`);
    return file;
  };
}

/**
 * New browser context emulating iPhone 13, loaded with the stored LIFF session.
 * Pass `withCamera: true` for e-KYC flows that need `getUserMedia` (fake camera device).
 */
export async function newLiffMobileContext(
  browser: Browser,
  opts: { withCamera?: boolean } = {},
): Promise<BrowserContext> {
  return browser.newContext({
    ...devices['iPhone 13'],
    locale: 'th-TH',
    timezoneId: 'Asia/Bangkok',
    storageState: LIFF_SESSION,
    ...(opts.withCamera ? { permissions: ['camera', 'geolocation'] } : {}),
  });
}
