/**
 * discover-erp-verification.ts
 *
 * ตรวจสอบฝั่ง ERP (app-stg.arincare.com) ว่าบิลที่สร้างจาก POS (custom payment method + remark)
 * แสดงผลตรงกันหรือไม่ที่:
 *   1. /companies/list-bills -> tooltip หมายเหตุที่คอลัมน์ประเภทการชำระเงิน + ปุ่ม "รายละเอียดสินค้า"
 *   2. /companies/reports/sales?report=profitBillSummary -> ตัวเลข + วิธีชำระเงิน
 *
 * รันด้วย: npx tsx docs/payment-method-discovery/discover-erp-verification.ts [maxStage]
 */
import { chromium, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { LoginPage } from '../../pages/LoginPage.ts';

const BASE_URL = 'https://app-stg.arincare.com';
const USERNAME = 'watcharin.arincare@gmail.com';
const PASSWORD = '01072024';
const COMPANY = 'Watcharin TestTest';
const SHOT_DIR = path.resolve('screenshots/payment-method-retest');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

// ── ค่าจากรอบ POS ล่าสุดที่รันสำเร็จ (main17) ──
const RECEIPT_NO = 'SR260902-143003607';
const PAYMENT_METHOD_NAME = 'QA34166012';
const REMARK_TEXT = 'QA-TEST-หมายเหตุ-1788334166012';

fs.mkdirSync(SHOT_DIR, { recursive: true });
let shotCounter = 100; // เลขสูงกว่าชุด POS เพื่อไม่ให้ไฟล์ชนกัน
async function shot(page: Page, name: string) {
  const fname = `${String(++shotCounter).padStart(3, '0')}-${name}.png`;
  await page.screenshot({ path: path.join(SHOT_DIR, fname), fullPage: true });
  console.log(`  📸 ${fname}`);
}

async function main() {
  const maxStage = parseInt(process.argv[2] || '99', 10);
  console.log(`=== discover-erp-verification.ts | maxStage=${maxStage} ===`);
  console.log('  ตามหาบิล:', RECEIPT_NO, '| วิธีชำระ:', PAYMENT_METHOD_NAME, '| หมายเหตุ:', REMARK_TEXT);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ baseURL: BASE_URL, locale: 'th-TH', timezoneId: 'Asia/Bangkok', userAgent: UA });
  const page = await context.newPage();
  const login = new LoginPage(page);

  try {
    console.log('--- STAGE 1: Login to app-stg ---');
    await login.goto();
    await page.waitForTimeout(1000);
    await shot(page, 'erp-login-page');
    await login.login(USERNAME, PASSWORD);
    await page.waitForTimeout(2000);
    await shot(page, 'erp-after-login');
    await login.selectCompany(COMPANY);
    await page.waitForTimeout(1500);
    await shot(page, 'erp-after-select-company');
    await login.selectBranch();
    await page.waitForTimeout(2000);
    await shot(page, 'erp-after-select-branch');
    if (maxStage <= 1) return;

    console.log('--- STAGE 2: Navigate to list-bills ---');
    await page.goto(`${BASE_URL}/companies/list-bills`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(2500);
    await shot(page, 'erp-list-bills-initial');
    const bodyHtml = await page.content();
    fs.writeFileSync('docs/payment-method-discovery/erp-list-bills.html', bodyHtml);
    if (maxStage <= 2) return;

    // ── STAGE 3: ค้นหาบิลด้วยเลขที่บิล แล้วตรวจ tooltip ประเภทการชำระเงิน ──
    console.log('--- STAGE 3: Search bill + check payment-type tooltip ---');
    const searchInput = page.locator('input[placeholder*="ค้นหาเลขที่บิล"]').first();
    await searchInput.fill(RECEIPT_NO);
    await page.locator('button:has-text("ค้นหา")').first().click();
    await page.waitForTimeout(2500);
    await shot(page, 'erp-list-bills-searched');
    await page.waitForLoadState('networkidle').catch(() => {});

    const row = page.locator('table tbody tr', { hasText: RECEIPT_NO }).first();
    const rowVisible = await row.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('  found bill row:', rowVisible);
    if (rowVisible) {
      const rowText = await row.innerText();
      console.log('  row text:', rowText.replace(/\n/g, ' | '));

      const infoIcon = row.locator('i.fa-info-circle, .fa-info-circle').first();
      const infoVisible = await infoIcon.isVisible({ timeout: 3000 }).catch(() => false);
      console.log('  info icon in row visible:', infoVisible);
      if (infoVisible) {
        await infoIcon.hover();
        await page.waitForTimeout(1500);
        await shot(page, 'erp-payment-tooltip-hover');
        const tipText = await page.locator('[role="tooltip"], .tooltip, .tooltip-inner, [class*="tooltip"]')
          .filter({ visible: true }).first().innerText().catch(() => null);
        console.log('  tooltip text (hover):', tipText);
        if (!tipText) {
          await infoIcon.click();
          await page.waitForTimeout(1500);
          await shot(page, 'erp-payment-tooltip-click');
          const tipText2 = await page.locator('[role="tooltip"], .tooltip, .tooltip-inner, [class*="tooltip"], .popover')
            .filter({ visible: true }).first().innerText().catch(() => null);
          console.log('  tooltip text (click):', tipText2);
        }
      }

      // ปุ่มขวาสุดของแถว (เอกสาร/รายละเอียดสินค้า)
      const rowButtons = await row.locator('button, a, i[class*="fa-"]').all();
      console.log(`  พบ ${rowButtons.length} ปุ่ม/ไอคอนใน row`);
      for (const btn of rowButtons) {
        const title = await btn.getAttribute('title').catch(() => null);
        const cls = await btn.getAttribute('class').catch(() => null);
        console.log('   -', { title, cls });
      }
    }
    {
      const html = await page.content();
      fs.writeFileSync('docs/payment-method-discovery/erp-list-bills-searched.html', html);
    }
    if (maxStage <= 3) return;

    // ── STAGE 4: คลิก "รายละเอียดสินค้า" -> ตรวจสินค้า/ราคา/จำนวน ──
    console.log('--- STAGE 4: Click รายละเอียดสินค้า, verify product/price/qty ---');
    const detailBtn = row.locator('.sale_info, button[title="รายละเอียดสินค้า"]').first();
    const detailVisible = await detailBtn.isVisible({ timeout: 5000 }).catch(() => false);
    console.log('  รายละเอียดสินค้า button visible:', detailVisible);
    const detailReqs: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('sale') || req.url().includes('bill')) detailReqs.push(`${req.method()} ${req.url()}`);
    });
    page.on('response', (res) => {
      if (res.url().includes('sale') || res.url().includes('bill')) {
        console.log('  RESP', res.status(), res.url().slice(0, 150));
      }
    });
    if (detailVisible) {
      await detailBtn.click();
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(5000); // รอนานขึ้นกันเคส AJAX โหลดช้า
    }
    await shot(page, 'erp-product-detail-modal');
    const modalText = await page.locator('.modal.show, .modal.in, [role="dialog"]').filter({ visible: true }).first().innerText().catch(() => null);
    console.log('  product detail modal text:', modalText?.replace(/\n/g, ' | ').slice(0, 500));
    if (maxStage <= 4) return;

    // ── STAGE 5: ไปหน้ารายงานกำไร-ขาดทุนรายบิล ──
    console.log('--- STAGE 5: Navigate to profitBillSummary report ---');
    // ปิด modal ก่อน
    const closeBtn = page.locator('.modal.show button.close, .modal.show [aria-label="Close"]').last();
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click();
      await page.waitForTimeout(1000);
    }
    await page.goto(`${BASE_URL}/companies/reports/sales?report=profitBillSummary`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3000);
    await shot(page, 'erp-profit-report-initial');
    {
      const html = await page.content();
      fs.writeFileSync('docs/payment-method-discovery/erp-profit-report.html', html);
    }
    if (maxStage <= 5) return;

    // ── STAGE 6: ค้นหาบิลในรายงาน กำไร-ขาดทุน ──
    console.log('--- STAGE 6: Search bill in profit report ---');
    const reportSearchInput = page.locator('input[placeholder*="ค้นหา"], input[type="search"], input[type="text"]').first();
    if (await reportSearchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await reportSearchInput.fill(RECEIPT_NO);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(2500);
    }
    await shot(page, 'erp-profit-report-searched');
    const reportBodyText = await page.locator('body').innerText();
    const foundInReport = reportBodyText.includes(RECEIPT_NO);
    console.log('  bill found in profit report:', foundInReport);
    if (foundInReport) {
      const reportRow = page.locator('table tr', { hasText: RECEIPT_NO }).first();
      const reportRowText = await reportRow.innerText().catch(() => null);
      console.log('  report row text:', reportRowText?.replace(/\n/g, ' | '));
    }
    {
      const html = await page.content();
      fs.writeFileSync('docs/payment-method-discovery/erp-profit-report-searched.html', html);
    }
    if (maxStage <= 6) return;
  } catch (err) {
    console.error('ERROR:', err);
    await shot(page, 'erp-error-state');
  } finally {
    await browser.close();
  }
}

main();
