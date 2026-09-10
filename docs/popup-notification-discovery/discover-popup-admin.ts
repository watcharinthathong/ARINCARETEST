/**
 * Selector Discovery Script – Popup Notification (Web-Admin)
 * รัน: npx tsx docs/popup-notification-discovery/discover-popup-admin.ts
 *
 * Script นี้ login เข้า Web-Admin → ไปหน้า /popup-notifications → dump โครงสร้างหน้าจอ
 * เพื่อยืนยันว่า Environment เข้าถึงได้จริง และหา selectors จริงสำหรับ Playwright automation
 */

import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const BASE = process.env.ADMIN_BASE_URL ?? 'https://admin-stg.arincare.com';
const EMAIL = process.env.ADMIN_EMAIL ?? '';
const PASS = process.env.ADMIN_PASSWORD ?? '';

const OUT_DIR = __dirname;

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 200 });
  const ctx = await browser.newContext({ locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
  const page = await ctx.newPage();

  console.log('🔐 Opening', `${BASE}/login`);
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' }).catch(async (e) => {
    console.log('  ⚠️ /login failed, trying base URL directly:', e.message);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  });
  await page.waitForTimeout(2_000);
  await page.screenshot({ path: path.join(OUT_DIR, '01-login-page.png'), fullPage: true }).catch(() => {});

  // ── พยายาม login แบบทั่วไป (email/password) ─────────────────────────────
  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passInput = page.locator('input[type="password"], input[name="password"]').first();
  if (await emailInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await emailInput.fill(EMAIL);
    await passInput.fill(PASS);
    const loginBtn = page.locator('button[type="submit"], button:has-text("เข้าสู่ระบบ"), button:has-text("Login"), button:has-text("Sign In")').first();
    await loginBtn.click().catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2_000);
  } else {
    console.log('  ⚠️ ไม่พบฟอร์ม login แบบมาตรฐาน — อาจต้องเข้าทาง URL อื่นหรือ selector ต่างจากที่คาด');
  }
  await page.screenshot({ path: path.join(OUT_DIR, '02-after-login.png'), fullPage: true }).catch(() => {});
  console.log('  URL after login attempt:', page.url());

  // ── ไปหน้า popup-notifications ────────────────────────────────────────────
  const targetUrl = `${BASE}/popup-notifications`;
  console.log('➡️  Navigating to', targetUrl);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' }).catch((e) => {
    console.log('  ⚠️ navigation failed:', e.message);
  });
  await page.waitForTimeout(3_000);
  await page.screenshot({ path: path.join(OUT_DIR, '03-popup-notifications-page.png'), fullPage: true }).catch(() => {});
  console.log('  Final URL:', page.url());
  console.log('  Page title:', await page.title().catch(() => '(n/a)'));

  // ── Dump interactive elements ────────────────────────────────────────────
  const dump = await page.evaluate(() => {
    const grab = (sel: string) =>
      Array.from(document.querySelectorAll(sel)).slice(0, 60).map((el) => ({
        tag: el.tagName,
        text: (el.textContent || '').trim().slice(0, 80),
        id: el.id || null,
        cls: (el as HTMLElement).className || null,
        testid: el.getAttribute('data-testid') || el.getAttribute('data-test') || null,
      }));
    return {
      buttons: grab('button'),
      links: grab('a'),
      headings: grab('h1, h2, h3'),
      tables: grab('table'),
      inputs: grab('input, select, textarea'),
    };
  }).catch((e) => ({ error: String(e) }));

  fs.writeFileSync(
    path.join(OUT_DIR, 'popup-admin-dom-dump.json'),
    JSON.stringify(dump, null, 2),
    'utf-8'
  );
  console.log('📝 DOM dump written to popup-admin-dom-dump.json');

  await browser.close();
})();
