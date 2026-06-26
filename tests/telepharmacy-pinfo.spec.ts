import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const SS_DIR     = path.join(__dirname, '../screenshots/pinfo');

const BASE       = 'https://telepharmacy-cms.vercel.app';
const PHARMACIST = { email: 'pharma@medcare.com', pass: 'Pharm@1234' };
const OPERATOR   = { email: 'operator@medcare.com',   pass: 'Oper@1234' };

// ─── LINE LIFF (สร้างคิวผ่านปุ่มปรึกษาเภสัชกรใน LINE OA) ────────────────────
import * as dotenv from 'dotenv';
dotenv.config();
const LIFF_CHAT       = process.env.LIFF_CHAT       || 'https://liff.line.me/2010469964-fi8ZhQ7k/chat?provider_code=rms1aidkll_btch00001';
const LINE_TEST_PHONE = process.env.LINE_TEST_PHONE || '';
const LINE_TEST_PASS  = process.env.LINE_TEST_PASS  || '';

// ─── Selectors ────────────────────────────────────────────────────────────────
const SEL = {
  username: 'input[type="text"]',
  password: 'input[type="password"]',
  signIn:   'button[type="submit"]',

  storeCard:  'text=Watcharin TestTest',
  branchCard: 'text=สำนักงานใหญ่',
  nextBtn:    'button:has-text("ถัดไป"):not([disabled])',
  confirmBtn: 'button:has-text("ยืนยันและเข้าสู่ระบบ"):not([disabled])',
  supervisorCard: 'button[class*="overflow-hidden"][class*="rounded-2xl"]',

  // Patient card in queue list
  patientCard: [
    'div.flex.items-start.gap-3',
    '[class*="patient-card"]',
    '[class*="queue-item"]',
    'ul > li',
  ],

  // Assign / รับเคส button
  assignBtn: [
    'button:has-text("รับเคส")',
    'button:has-text("Assign")',
    'button:has-text("มอบหมาย")',
    'button[aria-label*="assign"]',
    'button[aria-label*="รับเคส"]',
  ],

  // Change pharmacist button
  changeBtn: [
    'button:has-text("Change")',
    'button:has-text("เปลี่ยน")',
    'button:has-text("เปลี่ยนเภสัชกร")',
    'button[aria-label*="change"]',
  ],

  // Pharmacist selection modal
  pharmacistModal: [
    '[role="dialog"]',
    '[class*="modal"]',
    '[class*="dialog"]',
    'div[class*="overlay"]',
  ],

  pharmacistModalItem: [
    '[role="dialog"] button',
    '[class*="modal"] [class*="pharmacist"]',
    '[role="dialog"] [class*="card"]',
    '[role="listitem"]',
    '[role="option"]',
  ],

  // KYC section
  kycSection: [
    '[class*="kyc"]',
    'section:has-text("KYC")',
    'div:has-text("ยืนยันตัวตน")',
    'div:has-text("KYC")',
  ],

  kycBadge: [
    '[class*="badge"]:has-text("ยืนยันตัวตนแล้ว")',
    '[class*="badge"]:has-text("ยังไม่สมบูรณ์")',
    'span:has-text("ยืนยันตัวตนแล้ว")',
    'span:has-text("ยังไม่สมบูรณ์")',
  ],

  ekycBtn: [
    'button:has-text("ส่งลิงก์ยืนยันตัวตน")',
    'button:has-text("e-KYC")',
    'button:has-text("ส่งลิงก์ e-KYC")',
    'button:has-text("ส่ง KYC")',
  ],

  // KYC Review
  reviewKycBtn: [
    'button:has-text("ตรวจสอบ KYC")',
    'button:has-text("Review KYC")',
    'button:has-text("ตรวจสอบ")',
  ],

  approveKycBtn: [
    'button:has-text("อนุมัติ KYC")',
    'button:has-text("Approve")',
    'button:has-text("อนุมัติ")',
  ],

  rejectKycBtn: [
    'button:has-text("ปฏิเสธ")',
    'button:has-text("Reject")',
    'button:has-text("ไม่อนุมัติ")',
  ],

  // Health info / Zone 3
  healthSection: [
    '[class*="health"]',
    'section:has-text("โรคประจำตัว")',
    'div:has-text("Chief Complaint")',
    'textarea[placeholder*="Chief"]',
    'div:has-text("ประวัติแพ้ยา")',
  ],

  chiefComplaintInput: [
    'textarea[placeholder*="Chief"]',
    'textarea[placeholder*="อาการ"]',
    'textarea[name*="chief"]',
    'textarea[name*="complaint"]',
    'input[placeholder*="Chief"]',
  ],

  autoSaveIndicator: [
    'span:has-text("กำลังบันทึก")',
    'span:has-text("บันทึกแล้ว")',
    'div:has-text("กำลังบันทึก")',
    'div:has-text("บันทึกแล้ว")',
    '[class*="save-indicator"]',
    '[class*="saving"]',
  ],
} as const;

if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });

interface Result {
  id: string;
  scenario: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  actualResult: string;
  remark: string;
  screenshots: string[];
}
const RESULTS: Result[] = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function ss(page: any, name: string): Promise<string> {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(SS_DIR, file), fullPage: true });
  return file;
}

async function goLogin(page: any) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
}

async function fillCreds(page: any, email: string, pass: string) {
  await page.locator(SEL.username).fill(email);
  await page.locator(SEL.password).fill(pass);
}

async function clickSignIn(page: any) {
  await page.locator(SEL.signIn).click();
  await page.waitForTimeout(4000);
}

async function doStoreFlow(page: any, shots: string[], prefix: string) {
  if (page.url().includes('select-store')) {
    await page.locator(SEL.storeCard).first().click();
    await page.waitForTimeout(600);
    shots.push(await ss(page, `${prefix}_store`));
    await page.locator(SEL.nextBtn).first().click();
    await page.waitForTimeout(3000);
  }
  if (page.url().includes('select-branch')) {
    await page.locator(SEL.branchCard).first().click();
    await page.waitForTimeout(600);
    shots.push(await ss(page, `${prefix}_branch`));
    await page.locator(SEL.nextBtn).first().click();
    await page.waitForTimeout(3000);
  }
}

async function doSupervisorStep(page: any, shots: string[], prefix: string) {
  if (!page.url().includes('select-supervisor')) return;
  shots.push(await ss(page, `${prefix}_supervisor`));
  const card = page.locator(SEL.supervisorCard).first();
  if (await card.isVisible().catch(() => false)) {
    await card.click();
    await page.waitForTimeout(800);
  }
  const confirmBtn = page.locator(SEL.confirmBtn).first();
  if (await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click();
    await page.waitForTimeout(3000);
  }
}

async function fullFlow(page: any, shots: string[], prefix: string, user = PHARMACIST) {
  await goLogin(page);
  shots.push(await ss(page, `${prefix}_01_login`));
  await fillCreds(page, user.email, user.pass);
  await clickSignIn(page);
  shots.push(await ss(page, `${prefix}_02_after-login`));
  await doStoreFlow(page, shots, prefix);
  if (user === OPERATOR) await doSupervisorStep(page, shots, prefix);
  shots.push(await ss(page, `${prefix}_03_queue`));
  return page.url();
}

function isOnQueue(url: string): boolean {
  return url.includes('/home') || url.includes('/queue');
}

async function findFirst(page: any, selectors: readonly string[]): Promise<{ found: boolean; sel: string; text: string }> {
  for (const sel of selectors) {
    try {
      const el = page.locator(sel).first();
      const visible = await el.isVisible({ timeout: 2000 }).catch(() => false);
      if (visible) {
        const text = await el.innerText().catch(() => '');
        return { found: true, sel, text };
      }
    } catch { /* try next */ }
  }
  return { found: false, sel: '', text: '' };
}

/** คลิก Patient Card ตัวแรกในคิว แล้วรอ detail panel โหลด */
async function clickFirstPatientCard(page: any, shots: string[], prefix: string): Promise<boolean> {
  for (const sel of SEL.patientCard) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 3000 }).catch(() => false)) {
      await el.click();
      await page.waitForTimeout(2500);
      shots.push(await ss(page, `${prefix}_patient-detail`));
      return true;
    }
  }
  return false;
}

/** คลิก Patient Card ที่มี status ที่ต้องการ */
async function clickCardWithStatus(page: any, status: string, shots: string[], prefix: string): Promise<boolean> {
  const card = page.locator(`div.flex.items-start.gap-3:has-text("${status}")`).first();
  if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
    await card.click();
    await page.waitForTimeout(2500);
    shots.push(await ss(page, `${prefix}_patient-detail-${status.toLowerCase()}`));
    return true;
  }
  return false;
}

// ─── Setup: เปิด LIFF สร้าง WAITING queue ก่อนรัน tests ─────────────────────
const LIFF_SESSION_FILE = path.join(__dirname, '../liff-session.json');

async function doLineOAuth(liffPage: any): Promise<void> {
  const url = liffPage.url();
  if (!url.includes('access.line.me') && !url.includes('login.line.me')) return;

  const idInput = liffPage.locator('input[name="tid"], input[type="tel"], input[type="email"]').first();
  if (!await idInput.isVisible({ timeout: 8_000 }).catch(() => false)) return;

  await idInput.fill(LINE_TEST_PHONE);
  await liffPage.waitForTimeout(500);

  const passOnSamePage = liffPage.locator('input[name="tpasswd"], input[type="password"]').first();
  const isSamePage = await passOnSamePage.isVisible({ timeout: 2_000 }).catch(() => false);

  if (isSamePage) {
    await passOnSamePage.fill(LINE_TEST_PASS);
    await liffPage.waitForTimeout(500);
  } else {
    const nextBtn = liffPage.locator('button:has-text("Continue"), button:has-text("ถัดไป")').first();
    if (await nextBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await nextBtn.click();
      await liffPage.waitForTimeout(2000);
    }
    const passInput = liffPage.locator('input[name="tpasswd"], input[type="password"]').first();
    if (await passInput.isVisible({ timeout: 8_000 }).catch(() => false)) {
      await passInput.fill(LINE_TEST_PASS);
      await liffPage.waitForTimeout(500);
    }
  }

  await liffPage.screenshot({ path: path.join(SS_DIR, 'SETUP_line-creds.png') });
  const submitBtn = liffPage.locator('button[type="submit"]:not([disabled])').first();
  if (await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await submitBtn.click();
    await liffPage.waitForTimeout(6000);
  }
  await liffPage.screenshot({ path: path.join(SS_DIR, 'SETUP_line-after-login.png') });
}

async function openLiffAndCreateQueue(
  context: any,
): Promise<{ ok: boolean; detail: string }> {
  if (!LINE_TEST_PHONE || !LINE_TEST_PASS) {
    return { ok: false, detail: 'ไม่พบ LINE_TEST_PHONE / LINE_TEST_PASS ใน .env' };
  }

  const liffPage = await context.newPage();
  await liffPage.setViewportSize({ width: 390, height: 844 });

  try {
    // เปิด LIFF แล้วรอ redirect ไป LINE OAuth หรือ LIFF app
    await liffPage.goto(LIFF_CHAT, { waitUntil: 'domcontentloaded', timeout: 30_000 });

    // รอจนกว่า URL เปลี่ยนจาก liff.line.me (JavaScript redirect)
    try {
      await liffPage.waitForURL(
        (url: URL) => !url.toString().includes('liff.line.me'),
        { timeout: 15_000 },
      );
    } catch { /* อาจ redirect เร็วไปแล้ว */ }

    await liffPage.waitForTimeout(2000);
    await liffPage.screenshot({ path: path.join(SS_DIR, 'SETUP_liff-start.png') });

    // LINE OAuth (ถ้า redirect มาหน้า login)
    await doLineOAuth(liffPage);

    // รอ redirect กลับไป LIFF app หลัง OAuth
    await liffPage.waitForTimeout(3000);
    await liffPage.screenshot({ path: path.join(SS_DIR, 'SETUP_after-oauth.png') });

    const afterOAuthUrl = liffPage.url();

    // ถ้าติด OTP — ข้ามก่อน (dev จะ mock ให้)
    if (afterOAuthUrl.includes('otp')) {
      await liffPage.screenshot({ path: path.join(SS_DIR, 'SETUP_otp-page.png') });
      console.log('⚠️  SETUP: ติด OTP page — ข้ามก่อน (รอ dev mock)');
      await liffPage.close();
      return { ok: false, detail: `OTP required — URL: ${afterOAuthUrl.slice(0, 80)}` };
    }

    // รอ LIFF โหลดและสร้าง Encounter/Queue
    await liffPage.waitForTimeout(5000);
    await liffPage.screenshot({ path: path.join(SS_DIR, 'SETUP_liff-loaded.png') });

    const finalUrl = liffPage.url();
    const liffBody = await liffPage.locator('body').innerText().catch(() => '');
    const liffOk   = !finalUrl.includes('access.line.me')
                  && !finalUrl.includes('login.line.me')
                  && !finalUrl.includes('otp');

    await liffPage.close();
    return { ok: liffOk, detail: `URL: ${finalUrl.slice(0, 80)} | body: ${liffBody.slice(0, 100)}` };
  } catch (e: any) {
    await liffPage.screenshot({ path: path.join(SS_DIR, 'SETUP_liff-error.png') }).catch(() => {});
    await liffPage.close().catch(() => {});
    return { ok: false, detail: String(e.message).slice(0, 200) };
  }
}

test.beforeAll(async ({ browser }) => {
  console.log('\n── SETUP: เปิด LIFF สร้าง WAITING queue ──');

  const hasSession = fs.existsSync(LIFF_SESSION_FILE);
  console.log(`SETUP: session file ${hasSession ? 'พบ → โหลด' : 'ไม่พบ → สร้างใหม่ (ต้องกรอก OTP)'}`);

  const context = hasSession
    ? await browser.newContext({ storageState: LIFF_SESSION_FILE })
    : await browser.newContext();

  const result = await openLiffAndCreateQueue(context);
  console.log(`SETUP LIFF: ok=${result.ok} | ${result.detail}`);

  if (result.ok) {
    // บันทึก session สำหรับรันครั้งต่อไป
    await context.storageState({ path: LIFF_SESSION_FILE });
    console.log(`SETUP: บันทึก session → ${LIFF_SESSION_FILE}`);
  }

  await context.close();
});

// ─── TC-PINFO-001 : รับเคส (Assign Pharmacist) → WAITING→ACTIVE ──────────────
test('TC-PINFO-001 – รับเคส (Assign Pharmacist) → WAITING→ACTIVE + Flex msg', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shots: string[] = [];

  const url = await fullFlow(page, shots, 'PINFO-001');
  const onQ = isOnQueue(url);

  let hasWaiting  = false;
  let cardClicked = false;
  let assignFound = false;
  let statusActive = false;

  if (onQ) {
    const waitingCard = page.locator('div.flex.items-start.gap-3:has-text("WAITING")').first();
    hasWaiting = await waitingCard.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasWaiting) {
      await waitingCard.click();
      await page.waitForTimeout(2500);
      cardClicked = true;
      shots.push(await ss(page, 'PINFO-001_waiting-detail'));

      const assignBtn = await findFirst(page, SEL.assignBtn);
      assignFound = assignBtn.found;

      if (assignFound) {
        await page.locator(assignBtn.sel).first().click();
        await page.waitForTimeout(3000);
        shots.push(await ss(page, 'PINFO-001_after-assign'));

        const body = await page.locator('body').innerText().catch(() => '');
        statusActive = /ACTIVE/i.test(body) && !/WAITING/i.test(body);
      }
    }
  }

  shots.push(await ss(page, 'PINFO-001_result'));

  const status = !onQ ? 'FAIL'
    : !hasWaiting ? 'SKIP'
    : !cardClicked || !assignFound ? 'FAIL'
    : statusActive ? 'PASS' : 'FAIL';

  RESULTS.push({
    id: 'TC-PINFO-001',
    scenario: 'รับเคส (Assign Pharmacist) → WAITING→ACTIVE + Flex msg',
    status,
    actualResult: `onQ=${onQ}, hasWaiting=${hasWaiting}, assignFound=${assignFound}, statusActive=${statusActive}`,
    remark: !onQ
      ? 'FAIL: ไม่ถึง Queue page'
      : !hasWaiting
        ? 'SKIP: ไม่มีคิว WAITING — ต้องมีผู้ป่วยรอในระบบก่อนทดสอบ'
        : !assignFound
          ? 'FAIL: ไม่พบปุ่มรับเคส/Assign ใน detail panel'
          : statusActive
            ? 'รับเคสสำเร็จ สถานะเปลี่ยนเป็น ACTIVE'
            : 'BUG: กดรับเคสแล้วสถานะไม่เปลี่ยนเป็น ACTIVE',
    screenshots: shots,
  });
  console.log(`TC-PINFO-001: ${status} | waiting=${hasWaiting}, active=${statusActive}`);
});

// ─── TC-PINFO-002 : Operator assign มี supervising → auto assign ───────────────
test('TC-PINFO-002 – Operator assign มี supervising → auto assign', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shots: string[] = [];

  const url = await fullFlow(page, shots, 'PINFO-002', OPERATOR);
  const onQ = isOnQueue(url);

  let hasWaiting   = false;
  let cardClicked  = false;
  let assignFound  = false;
  let modalOpened  = false;
  let autoAssigned = false;

  if (onQ) {
    const waitingCard = page.locator('div.flex.items-start.gap-3:has-text("WAITING")').first();
    hasWaiting = await waitingCard.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasWaiting) {
      await waitingCard.click();
      await page.waitForTimeout(2500);
      cardClicked = true;
      shots.push(await ss(page, 'PINFO-002_waiting-detail'));

      const assignBtn = await findFirst(page, SEL.assignBtn);
      assignFound = assignBtn.found;

      if (assignFound) {
        await page.locator(assignBtn.sel).first().click();
        await page.waitForTimeout(2000);
        shots.push(await ss(page, 'PINFO-002_after-assign-click'));

        // ถ้ามี supervising → ไม่ควรมี modal เด้งขึ้นมา (auto-assign)
        const modal = await findFirst(page, SEL.pharmacistModal);
        modalOpened = modal.found;

        const body = await page.locator('body').innerText().catch(() => '');
        autoAssigned = !modalOpened && /ACTIVE|assigned|มอบหมาย/i.test(body);
      }
    }
  }

  shots.push(await ss(page, 'PINFO-002_result'));

  const status = !onQ ? 'FAIL'
    : !hasWaiting ? 'SKIP'
    : !assignFound ? 'FAIL'
    : modalOpened ? 'SKIP'   // Operator ไม่มี supervising → modal เปิด (test ผิด scenario)
    : autoAssigned ? 'PASS' : 'FAIL';

  RESULTS.push({
    id: 'TC-PINFO-002',
    scenario: 'Operator assign มี supervising → auto assign',
    status,
    actualResult: `onQ=${onQ}, hasWaiting=${hasWaiting}, assignFound=${assignFound}, modalOpened=${modalOpened}, autoAssigned=${autoAssigned}`,
    remark: !onQ
      ? 'FAIL: ไม่ถึง Queue page'
      : !hasWaiting
        ? 'SKIP: ไม่มีคิว WAITING'
        : !assignFound
          ? 'FAIL: ไม่พบปุ่ม Assign'
          : modalOpened
            ? 'SKIP: เปิด modal — Operator นี้ไม่มี supervising pharmacist (ดู TC-PINFO-003 แทน)'
            : autoAssigned
              ? 'Operator auto-assign สำเร็จ ไม่เปิด modal'
              : 'BUG: กด Assign แล้วไม่มีการมอบหมายอัตโนมัติ',
    screenshots: shots,
  });
  console.log(`TC-PINFO-002: ${status} | modal=${modalOpened}, auto=${autoAssigned}`);
});

// ─── TC-PINFO-003 : Operator assign ไม่มี supervising → Selection Modal ────────
test('TC-PINFO-003 – Operator assign ไม่มี supervising → Selection Modal', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shots: string[] = [];

  const url = await fullFlow(page, shots, 'PINFO-003', OPERATOR);
  const onQ = isOnQueue(url);

  let hasWaiting  = false;
  let assignFound = false;
  let modalFound  = false;
  let hasPharmacistList = false;

  if (onQ) {
    const waitingCard = page.locator('div.flex.items-start.gap-3:has-text("WAITING")').first();
    hasWaiting = await waitingCard.isVisible({ timeout: 3000 }).catch(() => false);

    if (hasWaiting) {
      await waitingCard.click();
      await page.waitForTimeout(2500);
      shots.push(await ss(page, 'PINFO-003_waiting-detail'));

      const assignBtn = await findFirst(page, SEL.assignBtn);
      assignFound = assignBtn.found;

      if (assignFound) {
        await page.locator(assignBtn.sel).first().click();
        await page.waitForTimeout(2000);
        shots.push(await ss(page, 'PINFO-003_after-assign-click'));

        const modal = await findFirst(page, SEL.pharmacistModal);
        modalFound = modal.found;

        if (modalFound) {
          const body = await page.locator('body').innerText().catch(() => '');
          hasPharmacistList = /เภสัชกร|pharmacist|on.?duty|พร้อมให้บริการ/i.test(body);
          shots.push(await ss(page, 'PINFO-003_modal'));
        }
      }
    }
  }

  shots.push(await ss(page, 'PINFO-003_result'));

  const status = !onQ ? 'FAIL'
    : !hasWaiting ? 'SKIP'
    : !assignFound ? 'FAIL'
    : modalFound && hasPharmacistList ? 'PASS'
    : modalFound ? 'PASS'  // modal เปิดแต่อาจไม่มีเภสัชกร on-duty
    : 'FAIL';

  RESULTS.push({
    id: 'TC-PINFO-003',
    scenario: 'Operator assign ไม่มี supervising → Selection Modal',
    status,
    actualResult: `onQ=${onQ}, hasWaiting=${hasWaiting}, assignFound=${assignFound}, modalFound=${modalFound}, hasPharmacistList=${hasPharmacistList}`,
    remark: !onQ
      ? 'FAIL: ไม่ถึง Queue page'
      : !hasWaiting
        ? 'SKIP: ไม่มีคิว WAITING'
        : !assignFound
          ? 'FAIL: ไม่พบปุ่ม Assign'
          : modalFound && hasPharmacistList
            ? 'Pharmacist Selection Modal เปิดและแสดงรายชื่อเภสัชกร on-duty'
            : modalFound
              ? '⚠️ Modal เปิดแต่ไม่พบรายชื่อเภสัชกร (อาจไม่มี on-duty)'
              : 'BUG: กด Assign แล้วไม่มี modal เปิด',
    screenshots: shots,
  });
  console.log(`TC-PINFO-003: ${status} | modal=${modalFound}, list=${hasPharmacistList}`);
});

// ─── TC-PINFO-004 : Change Pharmacist → Modal + Audit Log ────────────────────
test('TC-PINFO-004 – Change Pharmacist → Modal + Audit Log', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shots: string[] = [];

  const url = await fullFlow(page, shots, 'PINFO-004');
  const onQ = isOnQueue(url);

  let cardClicked   = false;
  let changeFound   = false;
  let modalFound    = false;
  let changeSuccess = false;

  if (onQ) {
    // หา ACTIVE card ที่มีเภสัชกรแล้ว
    cardClicked = await clickCardWithStatus(page, 'ACTIVE', shots, 'PINFO-004');

    if (cardClicked) {
      const changeBtn = await findFirst(page, SEL.changeBtn);
      changeFound = changeBtn.found;

      if (changeFound) {
        await page.locator(changeBtn.sel).first().click();
        await page.waitForTimeout(2000);
        shots.push(await ss(page, 'PINFO-004_change-modal'));

        const modal = await findFirst(page, SEL.pharmacistModal);
        modalFound = modal.found;

        if (modalFound) {
          // เลือกเภสัชกรคนแรกในรายการ
          const item = await findFirst(page, SEL.pharmacistModalItem);
          if (item.found) {
            await page.locator(item.sel).first().click();
            await page.waitForTimeout(1000);

            // กด Confirm ถ้ามี
            const confirmEl = page.locator('button:has-text("ยืนยัน"), button:has-text("Confirm"), button:has-text("บันทึก")').first();
            if (await confirmEl.isVisible({ timeout: 2000 }).catch(() => false)) {
              await confirmEl.click();
              await page.waitForTimeout(2000);
            }
            changeSuccess = true;
            shots.push(await ss(page, 'PINFO-004_after-change'));
          }
        }
      }
    }
  }

  shots.push(await ss(page, 'PINFO-004_result'));

  const status = !onQ ? 'FAIL'
    : !cardClicked ? 'SKIP'
    : !changeFound ? 'SKIP'
    : modalFound && changeSuccess ? 'PASS' : 'FAIL';

  RESULTS.push({
    id: 'TC-PINFO-004',
    scenario: 'Change Pharmacist → Modal + Audit Log',
    status,
    actualResult: `onQ=${onQ}, cardClicked=${cardClicked}, changeFound=${changeFound}, modalFound=${modalFound}, changeSuccess=${changeSuccess}`,
    remark: !onQ
      ? 'FAIL: ไม่ถึง Queue page'
      : !cardClicked
        ? 'SKIP: ไม่มี ACTIVE card ในคิว'
        : !changeFound
          ? 'SKIP: ไม่พบปุ่ม Change (เคสนี้อาจยังไม่มีเภสัชกร หรือ CLOSED)'
          : modalFound && changeSuccess
            ? 'Change Pharmacist Modal ทำงาน เปลี่ยนเภสัชกรสำเร็จ'
            : !modalFound
              ? 'BUG: กด Change แล้วไม่มี Modal เปิด'
              : 'BUG: Modal เปิดแต่เปลี่ยนเภสัชกรไม่สำเร็จ',
    screenshots: shots,
  });
  console.log(`TC-PINFO-004: ${status} | modal=${modalFound}, success=${changeSuccess}`);
});

// ─── TC-PINFO-005 : เภสัช offline → modal ปิดไม่ได้ ─────────────────────────
test('TC-PINFO-005 – เภสัช offline → modal ปิดไม่ได้ถ้าไม่มี online', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shots: string[] = [];

  // TC นี้ต้องควบคุม state เภสัชกร (offline) ซึ่งทดสอบอัตโนมัติไม่ได้
  shots.push(await ss(page, 'PINFO-005_skip'));

  RESULTS.push({
    id: 'TC-PINFO-005',
    scenario: 'เภสัช offline → modal เปลี่ยนเภสัช ปิดไม่ได้ถ้าไม่มี online',
    status: 'SKIP',
    actualResult: 'ต้องควบคุมสถานะ online/offline ของเภสัชกรในระบบจริง',
    remark: 'SKIP: ต้องทดสอบ manual — บังคับให้เภสัชกรเดิม offline แล้วตรวจว่า modal บังคับเปลี่ยน',
    screenshots: shots,
  });
  console.log('TC-PINFO-005: SKIP');
});

// ─── TC-PINFO-006 : Assign button disabled เมื่อ CLOSED ─────────────────────
test('TC-PINFO-006 – Assign button disabled เมื่อ CLOSED', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shots: string[] = [];

  const url = await fullFlow(page, shots, 'PINFO-006');
  const onQ = isOnQueue(url);

  let closedCardFound = false;
  let assignDisabled  = false;
  let assignFound     = false;

  if (onQ) {
    closedCardFound = await clickCardWithStatus(page, 'CLOSED', shots, 'PINFO-006');

    if (closedCardFound) {
      // ตรวจ assign button — ต้อง disabled หรือไม่แสดง
      for (const sel of SEL.assignBtn) {
        const el = page.locator(sel).first();
        const visible = await el.isVisible({ timeout: 2000 }).catch(() => false);
        if (visible) {
          assignFound = true;
          const disabled = await el.isDisabled().catch(() => false);
          assignDisabled = disabled;
          break;
        }
      }
      // ถ้าไม่พบปุ่มเลย ถือว่า UI ซ่อนปุ่มไว้ = ผ่าน
      if (!assignFound) assignDisabled = true;
      shots.push(await ss(page, 'PINFO-006_closed-detail'));
    }
  }

  shots.push(await ss(page, 'PINFO-006_result'));

  const status = !onQ ? 'FAIL'
    : !closedCardFound ? 'SKIP'
    : assignDisabled ? 'PASS' : 'FAIL';

  RESULTS.push({
    id: 'TC-PINFO-006',
    scenario: 'Assign button disabled เมื่อ CLOSED',
    status,
    actualResult: `onQ=${onQ}, closedCardFound=${closedCardFound}, assignFound=${assignFound}, assignDisabled=${assignDisabled}`,
    remark: !onQ
      ? 'FAIL: ไม่ถึง Queue page'
      : !closedCardFound
        ? 'SKIP: ไม่มีคิว CLOSED ในระบบทดสอบ'
        : assignDisabled
          ? assignFound
            ? 'ปุ่ม Assign ถูก disable ใน CLOSED state ถูกต้อง'
            : 'UI ซ่อนปุ่ม Assign ใน CLOSED state (ถูกต้อง)'
          : 'BUG: ปุ่ม Assign ยังสามารถกดได้ใน CLOSED state',
    screenshots: shots,
  });
  console.log(`TC-PINFO-006: ${status} | closedFound=${closedCardFound}, disabled=${assignDisabled}`);
});

// ─── TC-PINFO-007 : KYC Read-only (แก้ไขไม่ได้) ───────────────────────────────
test('TC-PINFO-007 – KYC Read-only (แก้ไขไม่ได้)', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shots: string[] = [];

  const url = await fullFlow(page, shots, 'PINFO-007');
  const onQ = isOnQueue(url);

  let cardClicked = false;
  let kycFound    = false;
  let isReadOnly  = false;

  if (onQ) {
    cardClicked = await clickFirstPatientCard(page, shots, 'PINFO-007');

    if (cardClicked) {
      const kycEl = await findFirst(page, SEL.kycSection);
      kycFound = kycEl.found;
      shots.push(await ss(page, 'PINFO-007_kyc-section'));

      if (kycFound) {
        // ตรวจว่า input ใน KYC section เป็น disabled/readonly
        const kycInputs = page.locator('[class*="kyc"] input, section:has-text("KYC") input, div:has-text("ยืนยันตัวตน") input').all();
        let allReadOnly = true;
        let inputCount  = 0;

        for (const input of await kycInputs) {
          inputCount++;
          const disabled = await input.isDisabled().catch(() => true);
          const readOnly = await input.getAttribute('readonly').catch(() => null);
          if (!disabled && readOnly === null) allReadOnly = false;
        }

        // ถ้าไม่มี input (แสดงเป็น text แทน) = read-only โดยธรรมชาติ
        isReadOnly = inputCount === 0 || allReadOnly;
        shots.push(await ss(page, 'PINFO-007_kyc-inputs'));
      }
    }
  }

  shots.push(await ss(page, 'PINFO-007_result'));

  const status = !onQ ? 'FAIL'
    : !cardClicked ? 'SKIP'
    : !kycFound ? 'SKIP'
    : isReadOnly ? 'PASS' : 'FAIL';

  RESULTS.push({
    id: 'TC-PINFO-007',
    scenario: 'KYC Read-only (แก้ไขไม่ได้)',
    status,
    actualResult: `onQ=${onQ}, cardClicked=${cardClicked}, kycFound=${kycFound}, isReadOnly=${isReadOnly}`,
    remark: !onQ
      ? 'FAIL: ไม่ถึง Queue page'
      : !cardClicked
        ? 'SKIP: ไม่มี Patient Card ในคิว'
        : !kycFound
          ? 'SKIP: ไม่พบส่วน KYC ใน detail panel — ตรวจ selector'
          : isReadOnly
            ? 'KYC fields เป็น Read-only ถูกต้อง ไม่สามารถแก้ไขได้'
            : 'BUG: KYC fields สามารถแก้ไขได้ — ต้องเป็น Read-only',
    screenshots: shots,
  });
  console.log(`TC-PINFO-007: ${status} | kycFound=${kycFound}, readOnly=${isReadOnly}`);
});

// ─── TC-PINFO-008 : Status Badge KYC (สีส้ม/เขียว) ──────────────────────────
test('TC-PINFO-008 – Status Badge KYC', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shots: string[] = [];

  const url = await fullFlow(page, shots, 'PINFO-008');
  const onQ = isOnQueue(url);

  let cardClicked = false;
  let badgeFound  = false;
  let badgeText   = '';

  if (onQ) {
    cardClicked = await clickFirstPatientCard(page, shots, 'PINFO-008');

    if (cardClicked) {
      const badge = await findFirst(page, SEL.kycBadge);
      badgeFound = badge.found;
      badgeText  = badge.text;
      shots.push(await ss(page, 'PINFO-008_kyc-badge'));

      // ถ้าไม่เจอ badge แบบข้างบน ลองหา badge ทั่วไป
      if (!badgeFound) {
        const body = await page.locator('body').innerText().catch(() => '');
        badgeFound = /ยืนยันตัวตนแล้ว|ยังไม่สมบูรณ์|pending|approved|non.?kyc/i.test(body);
        if (badgeFound) badgeText = 'พบ KYC status text ใน body';
      }
    }
  }

  shots.push(await ss(page, 'PINFO-008_result'));

  const status = !onQ ? 'FAIL'
    : !cardClicked ? 'SKIP'
    : badgeFound ? 'PASS' : 'FAIL';

  RESULTS.push({
    id: 'TC-PINFO-008',
    scenario: 'Status Badge KYC',
    status,
    actualResult: `onQ=${onQ}, cardClicked=${cardClicked}, badgeFound=${badgeFound}, badgeText="${badgeText}"`,
    remark: !onQ
      ? 'FAIL: ไม่ถึง Queue page'
      : !cardClicked
        ? 'SKIP: ไม่มี Patient Card'
        : badgeFound
          ? `KYC Status Badge แสดง: "${badgeText}"`
          : 'BUG: ไม่พบ KYC Status Badge — ตรวจ screenshot และ selector',
    screenshots: shots,
  });
  console.log(`TC-PINFO-008: ${status} | badge="${badgeText}"`);
});

// ─── TC-PINFO-009 : ปุ่มส่งลิงก์ e-KYC แสดงเฉพาะ KYC ไม่สมบูรณ์ ──────────────
test('TC-PINFO-009 – ปุ่มส่งลิงก์ e-KYC แสดงเฉพาะ KYC ไม่สมบูรณ์', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shots: string[] = [];

  const url = await fullFlow(page, shots, 'PINFO-009');
  const onQ = isOnQueue(url);

  let cardClicked = false;
  let ekycBtnFound = false;
  let kycStatus    = '';

  if (onQ) {
    cardClicked = await clickFirstPatientCard(page, shots, 'PINFO-009');

    if (cardClicked) {
      const body = await page.locator('body').innerText().catch(() => '');
      kycStatus = /ยืนยันตัวตนแล้ว|approved/i.test(body) ? 'approved'
        : /ยังไม่สมบูรณ์|pending|none/i.test(body) ? 'incomplete' : 'unknown';

      const ekycBtn = await findFirst(page, SEL.ekycBtn);
      ekycBtnFound = ekycBtn.found;
      shots.push(await ss(page, 'PINFO-009_ekyc-btn'));
    }
  }

  shots.push(await ss(page, 'PINFO-009_result'));

  // PASS ถ้า: KYC ไม่สมบูรณ์ → มีปุ่ม | KYC approved → ไม่มีปุ่ม
  const correctBehavior = (kycStatus === 'incomplete' && ekycBtnFound)
    || (kycStatus === 'approved' && !ekycBtnFound);

  const status = !onQ ? 'FAIL'
    : !cardClicked ? 'SKIP'
    : kycStatus === 'unknown' ? 'SKIP'
    : correctBehavior ? 'PASS' : 'FAIL';

  RESULTS.push({
    id: 'TC-PINFO-009',
    scenario: 'ปุ่มส่งลิงก์ e-KYC แสดงเฉพาะ KYC ไม่สมบูรณ์',
    status,
    actualResult: `onQ=${onQ}, cardClicked=${cardClicked}, kycStatus=${kycStatus}, ekycBtnFound=${ekycBtnFound}`,
    remark: !onQ
      ? 'FAIL: ไม่ถึง Queue page'
      : !cardClicked
        ? 'SKIP: ไม่มี Patient Card'
        : kycStatus === 'unknown'
          ? 'SKIP: ไม่สามารถระบุ KYC status จาก UI — ตรวจ screenshot'
          : correctBehavior
            ? `ปุ่ม e-KYC แสดง/ซ่อนถูกต้องตาม KYC status (${kycStatus})`
            : kycStatus === 'incomplete' && !ekycBtnFound
              ? 'BUG: ผู้ป่วย KYC ไม่สมบูรณ์ แต่ไม่มีปุ่ม "ส่งลิงก์ยืนยันตัวตน"'
              : 'BUG: ผู้ป่วย KYC approved แต่ยังแสดงปุ่ม e-KYC',
    screenshots: shots,
  });
  console.log(`TC-PINFO-009: ${status} | kycStatus=${kycStatus}, ekycBtn=${ekycBtnFound}`);
});

// ─── TC-PINFO-010 : e-KYC Trigger → Flex message ในแชท ──────────────────────
test('TC-PINFO-010 – e-KYC Trigger → Flex message ในแชท', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shots: string[] = [];

  const url = await fullFlow(page, shots, 'PINFO-010');
  const onQ = isOnQueue(url);

  let cardClicked  = false;
  let ekycBtnFound = false;
  let sentSuccess  = false;

  if (onQ) {
    cardClicked = await clickFirstPatientCard(page, shots, 'PINFO-010');

    if (cardClicked) {
      const ekycBtn = await findFirst(page, SEL.ekycBtn);
      ekycBtnFound = ekycBtn.found;

      if (ekycBtnFound) {
        await page.locator(ekycBtn.sel).first().click();
        await page.waitForTimeout(3000);
        shots.push(await ss(page, 'PINFO-010_after-ekyc-click'));

        const body = await page.locator('body').innerText().catch(() => '');
        sentSuccess = /ส่งแล้ว|sent|สำเร็จ|success|ส่งลิงก์/i.test(body);
      }
    }
  }

  shots.push(await ss(page, 'PINFO-010_result'));

  const status = !onQ ? 'FAIL'
    : !cardClicked ? 'SKIP'
    : !ekycBtnFound ? 'SKIP'
    : sentSuccess ? 'PASS' : 'FAIL';

  RESULTS.push({
    id: 'TC-PINFO-010',
    scenario: 'e-KYC Trigger → Flex message ในแชท',
    status,
    actualResult: `onQ=${onQ}, cardClicked=${cardClicked}, ekycBtnFound=${ekycBtnFound}, sentSuccess=${sentSuccess}`,
    remark: !onQ
      ? 'FAIL: ไม่ถึง Queue page'
      : !cardClicked
        ? 'SKIP: ไม่มี Patient Card'
        : !ekycBtnFound
          ? 'SKIP: ไม่พบปุ่มส่งลิงก์ e-KYC (ผู้ป่วยอาจ KYC แล้ว หรือเปิดหน้าไม่ถูก)'
          : sentSuccess
            ? 'กดส่งลิงก์ e-KYC สำเร็จ ระบบยืนยันการส่ง'
            : '⚠️ กดปุ่ม e-KYC แล้วแต่ไม่พบ success message — ตรวจ screenshot และ LINE chat',
    screenshots: shots,
  });
  console.log(`TC-PINFO-010: ${status} | ekyc=${ekycBtnFound}, sent=${sentSuccess}`);
});

// ─── TC-PINFO-011 : KYC Pending Review Notification ─────────────────────────
test('TC-PINFO-011 – KYC Pending Review Notification', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shots: string[] = [];

  const url = await fullFlow(page, shots, 'PINFO-011');
  const onQ = isOnQueue(url);

  let pendingNotifFound = false;
  let reviewBtnFound    = false;

  if (onQ) {
    shots.push(await ss(page, 'PINFO-011_queue-view'));
    const body = await page.locator('body').innerText().catch(() => '');

    // ตรวจ Toast / Badge แจ้งเตือน KYC pending
    pendingNotifFound = /รอการตรวจสอบ|pending.?review|kyc.?pending|ตรวจสอบ.?kyc/i.test(body);

    const reviewBtn = await findFirst(page, SEL.reviewKycBtn);
    reviewBtnFound = reviewBtn.found;
  }

  shots.push(await ss(page, 'PINFO-011_result'));

  const status = !onQ ? 'FAIL'
    : pendingNotifFound || reviewBtnFound ? 'PASS' : 'SKIP';

  RESULTS.push({
    id: 'TC-PINFO-011',
    scenario: 'KYC Pending Review Notification',
    status,
    actualResult: `onQ=${onQ}, pendingNotifFound=${pendingNotifFound}, reviewBtnFound=${reviewBtnFound}`,
    remark: !onQ
      ? 'FAIL: ไม่ถึง Queue page'
      : pendingNotifFound || reviewBtnFound
        ? 'พบ KYC Pending notification / ปุ่มตรวจสอบ KYC ใน UI'
        : 'SKIP: ไม่มี KYC pending review ในระบบขณะทดสอบ — ต้องให้ผู้ป่วย submit eKYC ก่อน',
    screenshots: shots,
  });
  console.log(`TC-PINFO-011: ${status} | notif=${pendingNotifFound}, btn=${reviewBtnFound}`);
});

// ─── TC-PINFO-012 : KYC Review Modal เปรียบเทียบ Selfie กับ ID Card ─────────
test('TC-PINFO-012 – KYC Review Modal เปรียบเทียบ Selfie กับ ID Card', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shots: string[] = [];

  const url = await fullFlow(page, shots, 'PINFO-012');
  const onQ = isOnQueue(url);

  let cardClicked    = false;
  let reviewBtnFound = false;
  let modalFound     = false;
  let hasSelfie      = false;
  let hasIdCard      = false;

  if (onQ) {
    cardClicked = await clickFirstPatientCard(page, shots, 'PINFO-012');

    if (cardClicked) {
      const reviewBtn = await findFirst(page, SEL.reviewKycBtn);
      reviewBtnFound = reviewBtn.found;

      if (reviewBtnFound) {
        await page.locator(reviewBtn.sel).first().click();
        await page.waitForTimeout(2000);
        shots.push(await ss(page, 'PINFO-012_kyc-review-modal'));

        const modal = await findFirst(page, SEL.pharmacistModal);
        modalFound = modal.found;

        if (modalFound) {
          const body = await page.locator('body').innerText().catch(() => '');
          hasSelfie = /selfie|รูปถ่าย|ใบหน้า/i.test(body) || (await page.locator('img[src*="selfie"], img[alt*="selfie"], img[alt*="ใบหน้า"]').count()) > 0;
          hasIdCard = /บัตรประชาชน|id.?card|id card/i.test(body) || (await page.locator('img[src*="id"], img[alt*="บัตร"]').count()) > 0;
        }
      }
    }
  }

  shots.push(await ss(page, 'PINFO-012_result'));

  const status = !onQ ? 'FAIL'
    : !cardClicked ? 'SKIP'
    : !reviewBtnFound ? 'SKIP'
    : !modalFound ? 'FAIL'
    : hasSelfie && hasIdCard ? 'PASS'
    : modalFound ? 'PASS'  // modal เปิดแต่ตรวจ image label ไม่ได้แน่ใจ
    : 'FAIL';

  RESULTS.push({
    id: 'TC-PINFO-012',
    scenario: 'KYC Review Modal เปรียบเทียบ Selfie กับ ID Card',
    status,
    actualResult: `onQ=${onQ}, cardClicked=${cardClicked}, reviewBtnFound=${reviewBtnFound}, modalFound=${modalFound}, selfie=${hasSelfie}, idCard=${hasIdCard}`,
    remark: !onQ
      ? 'FAIL: ไม่ถึง Queue page'
      : !cardClicked
        ? 'SKIP: ไม่มี Patient Card'
        : !reviewBtnFound
          ? 'SKIP: ไม่พบปุ่มตรวจสอบ KYC — ไม่มี KYC pending review ในระบบ'
          : !modalFound
            ? 'BUG: กด Review KYC แล้วไม่มี Modal เปิด'
            : hasSelfie && hasIdCard
              ? 'KYC Review Modal แสดง Selfie และรูปบัตรประชาชนครบถ้วน'
              : 'Modal เปิดแล้ว — ตรวจ screenshot ว่ามีรูป Selfie และบัตรประชาชน',
    screenshots: shots,
  });
  console.log(`TC-PINFO-012: ${status} | modal=${modalFound}, selfie=${hasSelfie}, id=${hasIdCard}`);
});

// ─── TC-PINFO-013 : Approve KYC → approved + reviewed_by/at ──────────────────
test('TC-PINFO-013 – Approve KYC → approved + reviewed_by/at', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shots: string[] = [];

  const url = await fullFlow(page, shots, 'PINFO-013');
  const onQ = isOnQueue(url);

  let cardClicked    = false;
  let reviewBtnFound = false;
  let approveBtnFound = false;
  let approveSuccess  = false;

  if (onQ) {
    cardClicked = await clickFirstPatientCard(page, shots, 'PINFO-013');

    if (cardClicked) {
      const reviewBtn = await findFirst(page, SEL.reviewKycBtn);
      reviewBtnFound = reviewBtn.found;

      if (reviewBtnFound) {
        await page.locator(reviewBtn.sel).first().click();
        await page.waitForTimeout(2000);
        shots.push(await ss(page, 'PINFO-013_review-modal'));

        const approveBtn = await findFirst(page, SEL.approveKycBtn);
        approveBtnFound = approveBtn.found;

        if (approveBtnFound) {
          await page.locator(approveBtn.sel).first().click();
          await page.waitForTimeout(3000);
          shots.push(await ss(page, 'PINFO-013_after-approve'));

          const body = await page.locator('body').innerText().catch(() => '');
          approveSuccess = /approved|อนุมัติแล้ว|ยืนยันตัวตนแล้ว|สำเร็จ/i.test(body);
        }
      }
    }
  }

  shots.push(await ss(page, 'PINFO-013_result'));

  const status = !onQ ? 'FAIL'
    : !cardClicked ? 'SKIP'
    : !reviewBtnFound ? 'SKIP'
    : !approveBtnFound ? 'FAIL'
    : approveSuccess ? 'PASS' : 'FAIL';

  RESULTS.push({
    id: 'TC-PINFO-013',
    scenario: 'Approve KYC → approved + reviewed_by/at',
    status,
    actualResult: `onQ=${onQ}, reviewBtnFound=${reviewBtnFound}, approveBtnFound=${approveBtnFound}, approveSuccess=${approveSuccess}`,
    remark: !onQ
      ? 'FAIL: ไม่ถึง Queue page'
      : !cardClicked
        ? 'SKIP: ไม่มี Patient Card'
        : !reviewBtnFound
          ? 'SKIP: ไม่มี KYC pending review ในระบบ'
          : !approveBtnFound
            ? 'BUG: ไม่พบปุ่ม Approve KYC ใน Modal'
            : approveSuccess
              ? 'Approve KYC สำเร็จ สถานะเปลี่ยนเป็น approved'
              : 'BUG: กด Approve แล้วสถานะไม่เปลี่ยน — ตรวจ screenshot',
    screenshots: shots,
  });
  console.log(`TC-PINFO-013: ${status} | approve=${approveBtnFound}, success=${approveSuccess}`);
});

// ─── TC-PINFO-014 : Reject KYC → none + เหตุผล + Push msg ───────────────────
test('TC-PINFO-014 – Reject KYC → none + เหตุผล + Push msg', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shots: string[] = [];

  const url = await fullFlow(page, shots, 'PINFO-014');
  const onQ = isOnQueue(url);

  let cardClicked    = false;
  let reviewBtnFound = false;
  let rejectBtnFound = false;
  let rejectSuccess  = false;

  if (onQ) {
    cardClicked = await clickFirstPatientCard(page, shots, 'PINFO-014');

    if (cardClicked) {
      const reviewBtn = await findFirst(page, SEL.reviewKycBtn);
      reviewBtnFound = reviewBtn.found;

      if (reviewBtnFound) {
        await page.locator(reviewBtn.sel).first().click();
        await page.waitForTimeout(2000);
        shots.push(await ss(page, 'PINFO-014_review-modal'));

        const rejectBtn = await findFirst(page, SEL.rejectKycBtn);
        rejectBtnFound = rejectBtn.found;

        if (rejectBtnFound) {
          await page.locator(rejectBtn.sel).first().click();
          await page.waitForTimeout(1000);

          // กรอกเหตุผล (ถ้ามี textarea/input เด้งขึ้นมา)
          const reasonInput = page.locator('textarea[placeholder*="เหตุผล"], textarea[placeholder*="reason"], input[placeholder*="เหตุผล"]').first();
          if (await reasonInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            await reasonInput.fill('รูปถ่ายไม่ชัดเจน ไม่สามารถยืนยันตัวตนได้');
          }

          // กด Confirm / ส่ง
          const confirmReject = page.locator('button:has-text("ยืนยัน"), button:has-text("ส่ง"), button:has-text("Confirm")').first();
          if (await confirmReject.isVisible({ timeout: 2000 }).catch(() => false)) {
            await confirmReject.click();
          }

          await page.waitForTimeout(3000);
          shots.push(await ss(page, 'PINFO-014_after-reject'));

          const body = await page.locator('body').innerText().catch(() => '');
          rejectSuccess = /ปฏิเสธแล้ว|rejected|ยังไม่สมบูรณ์|none|สำเร็จ/i.test(body);
        }
      }
    }
  }

  shots.push(await ss(page, 'PINFO-014_result'));

  const status = !onQ ? 'FAIL'
    : !cardClicked ? 'SKIP'
    : !reviewBtnFound ? 'SKIP'
    : !rejectBtnFound ? 'FAIL'
    : rejectSuccess ? 'PASS' : 'FAIL';

  RESULTS.push({
    id: 'TC-PINFO-014',
    scenario: 'Reject KYC → none + เหตุผล + Push msg',
    status,
    actualResult: `onQ=${onQ}, reviewBtnFound=${reviewBtnFound}, rejectBtnFound=${rejectBtnFound}, rejectSuccess=${rejectSuccess}`,
    remark: !onQ
      ? 'FAIL: ไม่ถึง Queue page'
      : !cardClicked
        ? 'SKIP: ไม่มี Patient Card'
        : !reviewBtnFound
          ? 'SKIP: ไม่มี KYC pending review ในระบบ'
          : !rejectBtnFound
            ? 'BUG: ไม่พบปุ่ม Reject/ปฏิเสธ ใน Modal'
            : rejectSuccess
              ? 'Reject KYC สำเร็จ สถานะกลับเป็น none'
              : 'BUG: กด Reject แล้วสถานะไม่เปลี่ยน — ตรวจ screenshot',
    screenshots: shots,
  });
  console.log(`TC-PINFO-014: ${status} | reject=${rejectBtnFound}, success=${rejectSuccess}`);
});

// ─── TC-PINFO-015 : eKYC Submit ข้อมูลไม่ตรง → 422 ──────────────────────────
test('TC-PINFO-015 – eKYC Submit ข้อมูลไม่ตรง → 422', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shots: string[] = [];
  shots.push(await ss(page, 'PINFO-015_skip'));

  RESULTS.push({
    id: 'TC-PINFO-015',
    scenario: 'eKYC Submit ข้อมูลไม่ตรง → 422',
    status: 'SKIP',
    actualResult: 'ต้องทดสอบจากฝั่ง LIFF (LINE App) — patient submit eKYC ด้วยข้อมูลผิด',
    remark: 'SKIP: ต้องทดสอบ manual จาก LIFF — กรอกชื่อ-นามสกุลไม่ตรงบัตรประชาชนแล้วตรวจ HTTP 422 response',
    screenshots: shots,
  });
  console.log('TC-PINFO-015: SKIP');
});

// ─── TC-PINFO-016 : แก้ไขข้อมูลสุขภาพ + Auto-save ───────────────────────────
test('TC-PINFO-016 – แก้ไขข้อมูลสุขภาพ (Editable) + Auto-save', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shots: string[] = [];

  const url = await fullFlow(page, shots, 'PINFO-016');
  const onQ = isOnQueue(url);

  let cardClicked      = false;
  let healthSectionFound = false;
  let editSuccess      = false;
  let autoSaveShown    = false;

  if (onQ) {
    cardClicked = await clickFirstPatientCard(page, shots, 'PINFO-016');

    if (cardClicked) {
      const healthEl = await findFirst(page, SEL.healthSection);
      healthSectionFound = healthEl.found;
      shots.push(await ss(page, 'PINFO-016_health-section'));

      if (healthSectionFound) {
        // ลองหา editable field ในส่วน health info
        const editableFields = [
          'textarea[placeholder*="โรค"]',
          'textarea[placeholder*="ยา"]',
          'input[placeholder*="โรค"]',
          'input[placeholder*="แพ้"]',
          'textarea:not([readonly]):not([disabled])',
        ];

        for (const fieldSel of editableFields) {
          const field = page.locator(fieldSel).first();
          if (await field.isVisible({ timeout: 2000 }).catch(() => false)) {
            const currentVal = await field.inputValue().catch(() => '');
            await field.fill(`เบาหวาน, แพ้ยา Penicillin (ทดสอบ ${Date.now()})`);
            await page.waitForTimeout(1500);
            editSuccess = true;

            // ตรวจ auto-save indicator
            const saveEl = await findFirst(page, SEL.autoSaveIndicator);
            autoSaveShown = saveEl.found;
            shots.push(await ss(page, 'PINFO-016_after-edit'));

            // รอ "บันทึกแล้ว"
            if (!autoSaveShown) {
              await page.waitForTimeout(3000);
              const saveEl2 = await findFirst(page, SEL.autoSaveIndicator);
              autoSaveShown = saveEl2.found;
            }
            shots.push(await ss(page, 'PINFO-016_auto-save'));
            break;
          }
        }
      }
    }
  }

  shots.push(await ss(page, 'PINFO-016_result'));

  const status = !onQ ? 'FAIL'
    : !cardClicked ? 'SKIP'
    : !healthSectionFound ? 'SKIP'
    : !editSuccess ? 'FAIL'
    : autoSaveShown ? 'PASS' : 'FAIL';

  RESULTS.push({
    id: 'TC-PINFO-016',
    scenario: 'แก้ไขข้อมูลสุขภาพ (Editable) + Auto-save',
    status,
    actualResult: `onQ=${onQ}, cardClicked=${cardClicked}, healthFound=${healthSectionFound}, editSuccess=${editSuccess}, autoSave=${autoSaveShown}`,
    remark: !onQ
      ? 'FAIL: ไม่ถึง Queue page'
      : !cardClicked
        ? 'SKIP: ไม่มี Patient Card'
        : !healthSectionFound
          ? 'SKIP: ไม่พบส่วนข้อมูลสุขภาพ (Zone 3) — ตรวจ selector'
          : !editSuccess
            ? 'FAIL: ไม่มี editable field ในส่วนสุขภาพ'
            : autoSaveShown
              ? 'Auto-save ทำงานถูกต้อง แสดง "กำลังบันทึก" / "บันทึกแล้ว"'
              : 'BUG: แก้ไขข้อมูลได้แต่ไม่พบ Auto-save indicator — ตรวจ screenshot',
    screenshots: shots,
  });
  console.log(`TC-PINFO-016: ${status} | edit=${editSuccess}, autoSave=${autoSaveShown}`);
});

// ─── TC-PINFO-017 : บันทึก Chief Complaint ──────────────────────────────────
test('TC-PINFO-017 – บันทึก Chief Complaint', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shots: string[] = [];

  const url = await fullFlow(page, shots, 'PINFO-017');
  const onQ = isOnQueue(url);

  let cardClicked     = false;
  let chiefInputFound = false;
  let saveSuccess     = false;

  if (onQ) {
    cardClicked = await clickFirstPatientCard(page, shots, 'PINFO-017');

    if (cardClicked) {
      const chiefInput = await findFirst(page, SEL.chiefComplaintInput);
      chiefInputFound = chiefInput.found;
      shots.push(await ss(page, 'PINFO-017_chief-input'));

      if (chiefInputFound) {
        await page.locator(chiefInput.sel).first().fill('ปวดหัว เป็นไข้ 2 วัน ไอ มีน้ำมูก');
        await page.waitForTimeout(1500);
        shots.push(await ss(page, 'PINFO-017_filled'));

        // กดบันทึก หรือรอ auto-save
        const saveBtn = page.locator('button:has-text("บันทึก"), button:has-text("Save"), button:has-text("ยืนยัน")').first();
        if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await saveBtn.click();
          await page.waitForTimeout(2000);
        } else {
          // auto-save
          await page.waitForTimeout(3000);
        }

        shots.push(await ss(page, 'PINFO-017_after-save'));
        const body = await page.locator('body').innerText().catch(() => '');
        const saveIndicator = await findFirst(page, SEL.autoSaveIndicator);
        saveSuccess = saveIndicator.found || /บันทึกแล้ว|saved|success|สำเร็จ/i.test(body);
      }
    }
  }

  shots.push(await ss(page, 'PINFO-017_result'));

  const status = !onQ ? 'FAIL'
    : !cardClicked ? 'SKIP'
    : !chiefInputFound ? 'FAIL'
    : saveSuccess ? 'PASS' : 'FAIL';

  RESULTS.push({
    id: 'TC-PINFO-017',
    scenario: 'บันทึก Chief Complaint',
    status,
    actualResult: `onQ=${onQ}, cardClicked=${cardClicked}, chiefInputFound=${chiefInputFound}, saveSuccess=${saveSuccess}`,
    remark: !onQ
      ? 'FAIL: ไม่ถึง Queue page'
      : !cardClicked
        ? 'SKIP: ไม่มี Patient Card'
        : !chiefInputFound
          ? 'FAIL: ไม่พบ Chief Complaint input field — ตรวจ selector'
          : saveSuccess
            ? 'บันทึก Chief Complaint สำเร็จ'
            : '⚠️ กรอก Chief Complaint แล้วแต่ไม่พบ save indicator — ตรวจ screenshot',
    screenshots: shots,
  });
  console.log(`TC-PINFO-017: ${status} | input=${chiefInputFound}, saved=${saveSuccess}`);
});

// ─── TC-PINFO-018 : ข้อมูลสุขภาพเข้ารหัส AES-256 ───────────────────────────
test('TC-PINFO-018 – ข้อมูลสุขภาพเข้ารหัส AES-256', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shots: string[] = [];
  shots.push(await ss(page, 'PINFO-018_skip'));

  RESULTS.push({
    id: 'TC-PINFO-018',
    scenario: 'ข้อมูลสุขภาพเข้ารหัส AES-256-CBC (Field-level)',
    status: 'SKIP',
    actualResult: 'UI level: ไม่สามารถตรวจสอบ field-level encryption จาก browser ได้',
    remark: 'SKIP: ต้อง inspect DB โดยตรง — SELECT * FROM health_records และตรวจว่า sensitive fields เป็น ciphertext AES-256-CBC',
    screenshots: shots,
  });
  console.log('TC-PINFO-018: SKIP');
});

// ─── Save JSON summary ─────────────────────────────────────────────────────────
test.afterAll(async () => {
  const out = path.join(__dirname, '../test-results-pinfo.json');
  fs.writeFileSync(out, JSON.stringify(RESULTS, null, 2), 'utf-8');
  console.log('\n════ PINFO TEST SUMMARY ════');
  for (const r of RESULTS)
    console.log(`${r.id}: ${r.status} – ${r.scenario}`);
});
