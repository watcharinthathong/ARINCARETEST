/**
 * Discovery Part 2 – ดู detail ของแคมเปญที่มีอยู่จริง + ตรวจว่าแสดงผลจริงบน POS-v2 หรือไม่
 * รัน: npx tsx docs/popup-notification-discovery/discover-popup-detail-and-pos.ts
 */
import { chromium } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

const ADMIN_BASE = process.env.ADMIN_BASE_URL ?? 'https://admin-stg.arincare.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const ADMIN_PASS = process.env.ADMIN_PASSWORD ?? '';

const POS_BASE = process.env.POS_BASE_URL ?? 'https://pos-stg.arincare.com';
const POS_USERNAME = process.env.TEST_USERNAME ?? 'watcharin.arincare@gmail.com';
const POS_PASSWORD = process.env.TEST_PASSWORD ?? '01072024';
const COMPANY_NAME = process.env.COMPANY_NAME ?? 'Arincare Pharmacy';
const POS_BRANCH = process.env.POS_BRANCH ?? 'arincare';
const POS_EMPLOYEE_ID = process.env.POS_EMPLOYEE_ID ?? POS_USERNAME;
const POS_EMPLOYEE_PASS = process.env.POS_EMPLOYEE_PASS ?? POS_PASSWORD;

const OUT_DIR = __dirname;

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 150 });

  // ── PART A: Admin — ดู detail ของแคมเปญ #1 ────────────────────────────────
  const adminCtx = await browser.newContext({ locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
  const adminPage = await adminCtx.newPage();
  console.log('🔐 [Admin] logging in...');
  await adminPage.goto(`${ADMIN_BASE}/login`, { waitUntil: 'domcontentloaded' });
  await adminPage.waitForTimeout(1_500);
  const e = adminPage.locator('input[type="email"], input[name="email"]').first();
  if (await e.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await e.fill(ADMIN_EMAIL);
    await adminPage.locator('input[type="password"], input[name="password"]').first().fill(ADMIN_PASS);
    await adminPage.locator('button[type="submit"], button:has-text("เข้าสู่ระบบ")').first().click().catch(() => {});
    await adminPage.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  }
  await adminPage.goto(`${ADMIN_BASE}/popup-notifications`, { waitUntil: 'domcontentloaded' });
  await adminPage.waitForTimeout(2_000);

  console.log('👁️  Opening detail of campaign #1...');
  const eyeIcon = adminPage.locator('table a, table button').filter({ hasText: '' }).first();
  // ลองคลิกไอคอนตาในแถวแรกของตาราง (คอลัมน์ "จัดการ")
  const firstRowActions = adminPage.locator('table tbody tr').first().locator('a, button');
  const count = await firstRowActions.count().catch(() => 0);
  console.log(`  found ${count} action elements in first row`);
  if (count > 0) {
    await firstRowActions.first().click().catch((err) => console.log('  click failed:', err.message));
    await adminPage.waitForTimeout(2_000);
  }
  await adminPage.screenshot({ path: path.join(OUT_DIR, '04-campaign-detail.png'), fullPage: true }).catch(() => {});
  console.log('  detail URL:', adminPage.url());

  const detailHtml = await adminPage.content().catch(() => '');
  fs.writeFileSync(path.join(OUT_DIR, '04-campaign-detail.html'), detailHtml, 'utf-8');

  await adminCtx.close();

  // ── PART B: POS-v2 — ตรวจว่า Popup แสดงจริงหรือไม่ ────────────────────────
  const posCtx = await browser.newContext({ locale: 'th-TH', timezoneId: 'Asia/Bangkok' });
  const posPage = await posCtx.newPage();
  console.log('🔐 [POS-v2] logging in...');
  await posPage.goto(`${POS_BASE}/login`, { waitUntil: 'domcontentloaded' });
  await posPage.waitForSelector('#preloader, .preloader, [class*="preloader"]', { state: 'hidden', timeout: 15_000 }).catch(() => {});
  await posPage.waitForTimeout(2_000);

  const posEmail = posPage.locator('input[name="email"]').first();
  if (await posEmail.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await posEmail.fill(POS_USERNAME);
    await posPage.locator('input[type="password"]').first().fill(POS_PASSWORD);
    await posPage.locator('button:has-text("เข้าสู่ระบบ")').first().click();
    await posPage.waitForLoadState('networkidle').catch(() => {});
    await posPage.waitForTimeout(3_000);
  }

  const companySelect = posPage.locator('select[name="companyId"]').first();
  if (await companySelect.isVisible({ timeout: 8_000 }).catch(() => false)) {
    await posPage.waitForTimeout(1_500);
    await companySelect.selectOption({ label: COMPANY_NAME }).catch(async () => {
      await companySelect.selectOption({ index: 1 }).catch(() => {});
    });
    const branchSelect = posPage.locator('select[name="branchId"]').first();
    if (await branchSelect.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await branchSelect.selectOption({ label: POS_BRANCH }).catch(async () => {
        await branchSelect.selectOption({ index: 1 }).catch(() => {});
      });
    }
    const saveBtn = posPage.locator('button:has-text("บันทึก"), button[type="submit"]').first();
    await saveBtn.click().catch(() => {});
    await posPage.waitForTimeout(4_000);
  }

  const finishBtn = posPage.locator('button:has-text("เสร็จสิ้น")').first();
  if (await finishBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await finishBtn.click().catch(() => {});
    await posPage.waitForTimeout(4_000);
  }

  // Employee login step (ถ้ามี)
  const empIdInput = posPage.locator('input[name="username"], input[placeholder*="รหัสพนักงาน"]').first();
  if (await empIdInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await empIdInput.fill(POS_EMPLOYEE_ID).catch(() => {});
    const empPassInput = posPage.locator('input[type="password"]').first();
    await empPassInput.fill(POS_EMPLOYEE_PASS).catch(() => {});
    await posPage.locator('button[type="submit"], button:has-text("เข้าสู่ระบบ")').first().click().catch(() => {});
    await posPage.waitForTimeout(3_000);
  }

  console.log('📸 Capturing POS-v2 screen (looking for Popup Notification modal)...');
  await posPage.waitForTimeout(3_000);
  await posPage.screenshot({ path: path.join(OUT_DIR, '05-pos-v2-after-login.png'), fullPage: true }).catch(() => {});
  console.log('  POS-v2 URL:', posPage.url());

  // Dump ว่ามี modal/dialog อะไรอยู่บนจอบ้าง
  const modalDump = await posPage.evaluate(() => {
    const sel = '[role="dialog"], .modal, [class*="modal"], [class*="popup"]';
    return Array.from(document.querySelectorAll(sel)).map((el) => ({
      tag: el.tagName,
      cls: (el as HTMLElement).className,
      visible: (el as HTMLElement).offsetParent !== null,
      textSnippet: (el.textContent || '').trim().slice(0, 200),
    }));
  }).catch((e) => [{ error: String(e) }]);
  fs.writeFileSync(path.join(OUT_DIR, 'pos-v2-modal-dump.json'), JSON.stringify(modalDump, null, 2), 'utf-8');
  console.log('📝 modal dump written. Found', Array.isArray(modalDump) ? modalDump.length : 0, 'candidate elements');

  await posCtx.close();
  await browser.close();
})();
