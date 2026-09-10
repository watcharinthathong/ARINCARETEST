/**
 * Selector Discovery Script – Line Notification Page
 * รัน: npx ts-node tests/line-notification/discover-line-selectors.ts
 *
 * Script นี้ login → ไปหน้า integrations → dump ทุก interactive element
 * เพื่อหา selectors จริงสำหรับใส่ใน line-notification.spec.ts
 */

import { chromium } from '@playwright/test';
import * as fs      from 'fs';
import * as path    from 'path';
import { fileURLToPath } from 'url';
import dotenv       from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const BASE         = process.env.BASE_URL     ?? 'https://app-stg.arincare.com';
const EMAIL        = process.env.TEST_USERNAME ?? 'watcharin.arincare@gmail.com';
const PASS         = process.env.TEST_PASSWORD ?? '01072024';
const COMPANY_NAME = process.env.COMPANY_NAME  ?? 'Arincare Pharmacy';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 300 });
  const ctx     = await browser.newContext({ locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
  const page    = await ctx.newPage();

  // ── Login ──────────────────────────────────────────────────────────────────
  console.log('🔐 Logging in...');
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#preloader', { state: 'hidden', timeout: 15_000 }).catch(() => {});
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASS);
  await page.click('#login-btn');
  await page.waitForLoadState('networkidle').catch(() => {});

  // ── Select Company ─────────────────────────────────────────────────────────
  const companyEl = page.getByText(COMPANY_NAME, { exact: false }).first();
  if (await companyEl.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await companyEl.click();
    await page.waitForLoadState('networkidle').catch(() => {});
  }

  // ── Navigate ───────────────────────────────────────────────────────────────
  console.log('🔍 Navigating to LINE Notification page...');
  await page.goto(`${BASE}/companies/integrations?tab=linenoti`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3_000);

  // ── Dump interactive elements ──────────────────────────────────────────────
  const elements = await page.evaluate(() => {
    const results: Array<{ tag: string; type?: string; id?: string; name?: string; class?: string; text?: string; placeholder?: string; ariaLabel?: string; dataKey?: string }> = [];

    const interactives = document.querySelectorAll('button, input, select, textarea, a[href], [role="button"], [role="tab"], [role="checkbox"], [role="switch"]');

    interactives.forEach(el => {
      const e = el as HTMLElement;
      results.push({
        tag:         e.tagName.toLowerCase(),
        type:        (e as HTMLInputElement).type,
        id:          e.id || undefined,
        name:        (e as HTMLInputElement).name || undefined,
        class:       e.className?.toString().slice(0, 80) || undefined,
        text:        e.innerText?.slice(0, 60).trim() || undefined,
        placeholder: (e as HTMLInputElement).placeholder || undefined,
        ariaLabel:   e.getAttribute('aria-label') || undefined,
        dataKey:     e.dataset['key'] || undefined,
      });
    });

    return results;
  });

  // ── Save results ───────────────────────────────────────────────────────────
  const outPath = path.join(__dirname, 'discovered-selectors.json');
  fs.writeFileSync(outPath, JSON.stringify(elements, null, 2), 'utf-8');

  console.log(`\n✅ Found ${elements.length} interactive elements`);
  console.log(`📄 Saved to: ${outPath}`);
  console.log('\n── Preview ──────────────────────────────────');
  elements.slice(0, 30).forEach((el, i) => {
    const info = [
      el.tag,
      el.type   ? `type="${el.type}"`         : '',
      el.id     ? `#${el.id}`                 : '',
      el.name   ? `name="${el.name}"`         : '',
      el.dataKey ? `data-key="${el.dataKey}"` : '',
      el.text   ? `"${el.text}"`             : '',
    ].filter(Boolean).join(' ');
    console.log(`  ${i + 1}. ${info}`);
  });

  // Screenshot หน้าที่เจอ
  const ssPath = path.join(__dirname, 'discover-screenshot.png');
  await page.screenshot({ path: ssPath, fullPage: true });
  console.log(`\n📸 Screenshot: ${ssPath}`);

  await browser.close();
})();
