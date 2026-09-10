/**
 * Exploratory Testing — Web-Admin Create form ต่อจาก explore-admin-ui.ts (แก้ให้ทนบั๊ก UI มากขึ้น)
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
const OUT = __dirname;
const findings: string[] = [];
const note = (s: string) => { console.log('📝', s); findings.push(s); };

async function step(name: string, fn: () => Promise<void>) {
  console.log(`\n=== ${name} ===`);
  try {
    await fn();
  } catch (e: any) {
    note(`⚠️ STEP "${name}" THREW ERROR: ${e.message.split('\n')[0]}`);
  }
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 60 });
  const page = await (await browser.newContext({ locale: 'th-TH' })).newPage();

  await page.goto(`${ADMIN_BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.locator('input[type="email"], input[name="email"]').first().fill(ADMIN_EMAIL);
  await page.locator('input[type="password"], input[name="password"]').first().fill(ADMIN_PASS);
  await page.locator('button:has-text("เข้าสู่ระบบ")').first().click();
  await page.waitForLoadState('networkidle').catch(() => {});

  await page.goto(`${ADMIN_BASE}/popup-notifications/create`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  await step('ปุ่ม "จำลองเปิด Modal จริง" (Live Preview simulator)', async () => {
    const btn = page.getByRole('button', { name: 'จำลองเปิด Modal จริง' });
    await btn.click({ timeout: 10_000 });
    await page.waitForTimeout(1000);
    const backdropVisible = await page.locator('.preview-backdrop').isVisible().catch(() => false);
    note(`คลิก "จำลองเปิด Modal จริง" → เปิด backdrop เต็มจอไหม: ${backdropVisible}`);
    await page.screenshot({ path: path.join(OUT, 'explore-10-live-preview-open.png'), fullPage: true });

    // ลองปิดด้วยปุ่ม × มุมขวาบน
    const closeBtn = page.locator('.preview-corner-close, .preview-backdrop button:has-text("×")').first();
    const closeVisible = await closeBtn.isVisible({ timeout: 3000 }).catch(() => false);
    note(`มีปุ่มปิด (×) มุมขวาบนของ Live Preview simulator ไหม: ${closeVisible}`);
    if (closeVisible) {
      await closeBtn.click({ force: true });
      await page.waitForTimeout(800);
      const stillVisible = await page.locator('.preview-backdrop').isVisible().catch(() => false);
      note(`หลังกดปุ่มปิด → backdrop หายไปหรือไม่: ${!stillVisible}`);
    } else {
      note('⚠️ ไม่มีปุ่มปิดที่มองเห็นได้ชัดเจน — ลองกด Escape');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(800);
      const stillVisible2 = await page.locator('.preview-backdrop').isVisible().catch(() => false);
      note(`กด Escape แล้ว backdrop หายไหม: ${!stillVisible2}`);
    }
  });

  // กันเหนียว: force-remove backdrop ค้างถ้ายังอยู่ ก่อนไปขั้นตอนถัดไป
  await page.evaluate(() => {
    document.querySelectorAll('.preview-backdrop').forEach((el) => el.remove());
  }).catch(() => {});
  await page.waitForTimeout(300);

  await step('scope=global กลับสู่ค่าเริ่มต้น (เผื่อค้างจาก step ก่อนหน้า)', async () => {
    await page.locator('input[type="radio"]').nth(0).click({ force: true, timeout: 10_000 });
  });

  await step('ปุ่ม "เพิ่มปุ่ม Action" — เพิ่มได้กี่ปุ่ม / มี limit ไหม', async () => {
    const addBtnAction = page.getByRole('button', { name: 'เพิ่มปุ่ม Action' });
    for (let i = 0; i < 6; i++) {
      await addBtnAction.click({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
    }
    const buttonBlocks = await page.locator('text=/ปุ่ม #\\d/').count();
    note(`กด "เพิ่มปุ่ม Action" รัว 6 ครั้ง (เริ่มจาก 1 ปุ่ม) → ตอนนี้มีกี่ปุ่ม: ${buttonBlocks} (ถ้า =7 แปลว่าไม่มี limit ฝั่ง UI)`);
    await page.screenshot({ path: path.join(OUT, 'explore-11-many-buttons.png'), fullPage: true });
  });

  await step('ลบปุ่มทั้งหมด (×) เหลือ 0 ปุ่ม แล้วลองกด สร้างป็อปอัพ (ดูว่า validate ไหม)', async () => {
    // scope เฉพาะปุ่มลบใน section 4 (ปุ่ม Action) เท่านั้น ไม่ปนกับ × ที่อื่นในหน้า
    const section4 = page.locator('text=ปุ่ม Action (Custom CTA Buttons)').locator('xpath=ancestor::div[contains(@class,"panel") or contains(@class,"card")][1]');
    const removeButtons = section4.locator('button:has-text("×")');
    const countBefore = await removeButtons.count();
    note(`มีปุ่มลบ (×) ในโซนปุ่ม Action ทั้งหมด ${countBefore} ปุ่มก่อนเริ่มลบ`);
    for (let i = 0; i < countBefore; i++) {
      await section4.locator('button:has-text("×")').first().click({ force: true }).catch(() => {});
      await page.waitForTimeout(300);
    }
    const buttonBlocksAfter = await page.locator('text=/ปุ่ม #\\d/').count();
    note(`หลังกดลบปุ่มทั้งหมด → เหลือ ${buttonBlocksAfter} ปุ่ม`);
    await page.screenshot({ path: path.join(OUT, 'explore-12-zero-buttons.png'), fullPage: true });

    // กรอกฟิลด์จำเป็นให้ครบแล้วลองกด submit ดูว่า block ไหมตอนไม่มีปุ่มเลย
    await page.getByPlaceholder('เช่น แจ้งปรับปรุงระบบประจำเดือน, ข่าวสารประชาสัมพันธ์').fill('QA Explore Zero Buttons');
    await page.getByPlaceholder('เช่น POPUP_NOTICE_2026').fill(`QA_ZEROBTN_${Date.now()}`);
    const dt = page.locator('input[type="datetime-local"]');
    const fmt = (d: Date) => { const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
    await dt.nth(0).fill(fmt(new Date(Date.now() - 5 * 60_000)));
    await dt.nth(1).fill(fmt(new Date(Date.now() + 60 * 60_000)));
    await page.getByRole('button', { name: 'สร้างป็อปอัพ' }).click({ force: true });
    await page.waitForTimeout(2000);
    const urlAfter = page.url();
    const bodyText = await page.locator('body').innerText();
    const hasValidationMsg = /กรุณา|จำเป็น|required|ต้องมีอย่างน้อย/i.test(bodyText);
    note(`ลอง submit โดยไม่มีปุ่มเลย → URL หลัง submit: ${urlAfter} | เจอข้อความ validation เรื่องปุ่มไหม: ${hasValidationMsg}`);
    await page.screenshot({ path: path.join(OUT, 'explore-13-submit-zero-buttons.png'), fullPage: true });

    // ถ้าดันสร้างสำเร็จ (redirect ไป list) ต้องลบทิ้งทันที
    if (urlAfter.includes('/popup-notifications') && !urlAfter.includes('/create')) {
      note('⚠️ ระบบยอมให้สร้าง Popup ที่ไม่มีปุ่มเลยสำเร็จ! (ต้องพิจารณาว่าเป็น bug หรือ by-design)');
    }
  });

  fs.writeFileSync(path.join(OUT, 'explore-admin-ui-2-findings.json'), JSON.stringify(findings, null, 2), 'utf-8');
  console.log('\n✅ DONE');
  await browser.close();
})();
