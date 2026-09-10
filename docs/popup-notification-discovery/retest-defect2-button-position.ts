import { chromium } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });
const ADMIN_BASE = process.env.ADMIN_BASE_URL ?? 'https://admin-stg.arincare.com';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? '';
const ADMIN_PASS = process.env.ADMIN_PASSWORD ?? '';

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const page = await (await browser.newContext({ locale: 'th-TH' })).newPage();
  await page.goto(`${ADMIN_BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[name="email"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"], input[name="password"]').first().fill(ADMIN_PASS);
  await page.locator('button:has-text("เข้าสู่ระบบ")').first().click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.goto(`${ADMIN_BASE}/popup-notifications`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  await page.getByPlaceholder('ค้นหาชื่อหรือรหัส...').fill('QA_SCOPE');
  await page.getByRole('button', { name: 'ค้นหา' }).click();
  await page.waitForTimeout(1000);
  const table = page.locator('table').filter({ has: page.locator('th', { hasText: 'ชื่อป็อปอัพ' }) });
  await table.locator('tbody tr').first().locator('a[title="แก้ไข"]').click();
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(__dirname, 'defect2-edit-form-top.png'), fullPage: true });

  const previewBtn = page.getByRole('button', { name: 'จำลองเปิด Modal จริง' });
  if (await previewBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await previewBtn.click();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(__dirname, 'defect2-admin-preview.png'), fullPage: true });
    console.log('captured admin preview screenshot');
  } else {
    console.log('ไม่เจอปุ่ม จำลองเปิด Modal จริง — อาจไม่มีในหน้า Edit (มีแค่หน้า Create)');
    // ลองดูใน section 5 (ตัวอย่างการแสดงผลจริง) เผื่อ render แบบ inline อยู่แล้วในหน้า edit
    const inlinePreview = page.locator('.popup-notification-modal-custom, [class*="preview"]').first();
    if (await inlinePreview.isVisible({ timeout: 5000 }).catch(() => false)) {
      await inlinePreview.screenshot({ path: path.join(__dirname, 'defect2-inline-preview.png') });
      console.log('captured inline preview element screenshot');
    }
  }
  await browser.close();
})();
