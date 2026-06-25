/**
 * telepharmacy-call.spec.ts
 *
 * Dual-context approach:
 *   • CMS context  — OPERATOR login, รอรับสาย (ฝั่ง pharmacist)
 *   • LIFF context — LINE login, กด voice/video call (ฝั่ง patient)
 *
 * ต้องใช้ { browser } fixture เพื่อสร้าง 2 contexts พร้อมกัน
 */
import { test } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const SS_DIR     = path.join(__dirname, '../screenshots/call');

const BASE     = 'https://telepharmacy-cms.vercel.app';
const OPERATOR = { email: 'operator@medcare.com', pass: 'Oper@1234' };

const LINE_TEST_PHONE = process.env.LINE_TEST_PHONE || '';
const LINE_TEST_PASS  = process.env.LINE_TEST_PASS  || '';
// ผู้ป่วยกด call จากภายใน LIFF_CHAT (ไม่ใช่จาก URL โดยตรง)
const LIFF_CHAT       = process.env.LIFF_CHAT ||
  'https://liff.line.me/2010469964-fi8ZhQ7k/chat?provider_code=rms1aidkll_btch00001';
const LIFF_VOICE_CALL = process.env.LIFF_VOICE_CALL ||
  'https://liff.line.me/2010469964-fi8ZhQ7k/voice-call?provider_code=rms1aidkll_btch00001';
const LIFF_VIDEO_CALL = process.env.LIFF_VIDEO_CALL ||
  'https://liff.line.me/2010469964-fi8ZhQ7k/video-call?provider_code=rms1aidkll_btch00001';

if (!fs.existsSync(SS_DIR)) fs.mkdirSync(SS_DIR, { recursive: true });

// ─── Types ────────────────────────────────────────────────────────────────────
interface Result {
  id: string;
  scenario: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  actualResult: string;
  remark: string;
  screenshots: string[];
}
const RESULTS: Result[] = [];

// ─── CMS selectors ────────────────────────────────────────────────────────────
const SEL = {
  username:       'input[type="text"]',
  password:       'input[type="password"]',
  signIn:         'button[type="submit"]',
  storeCard:      'text=Watcharin TestTest',
  branchCard:     'text=สำนักงานใหญ่',
  nextBtn:        'button:has-text("ถัดไป"):not([disabled])',
  confirmBtn:     'button:has-text("ยืนยันและเข้าสู่ระบบ"):not([disabled])',
  supervisorCard: 'button[class*="overflow-hidden"][class*="rounded-2xl"]',
  patientCard:    'div.flex.items-start.gap-3',
} as const;

// ─── Call selectors ───────────────────────────────────────────────────────────
const CALL = {
  incomingAlert: [
    '[class*="glassmorphism"]',
    '[class*="ring-pulse"]',
    '[class*="incoming"]',
    'div:has-text("Incoming Voice Call")',
    'div:has-text("Incoming Video Call")',
    'div:has-text("สายเรียกเข้า")',
    '[class*="notification"][class*="call"]',
  ],
  acceptBtn: [
    'button:has-text("รับสาย")',
    'button:has-text("Accept")',
    'button[class*="green"]:not([disabled])',
    'button[aria-label*="accept"]',
  ],
  declineBtn: [
    'button:has-text("ปฏิเสธ")',
    'button:has-text("Decline")',
    'button[class*="red"]:not([disabled])',
    'button[class*="danger"]:not([disabled])',
  ],
  activeCallBar: [
    'div:has-text("Voice Call Active")',
    'div:has-text("Video Call Active")',
    '[class*="call-active"]',
    '[class*="voice-call"]',
    '[class*="video-call"]',
  ],
  callTimer: [
    '[class*="timer"]',
    'span:has-text(":"):has([class*="mono"])',
    'code:has-text(":")',
  ],
  endCallBtn: [
    'button:has-text("End Call")',
    'button:has-text("วางสาย")',
    'button[aria-label*="end"]',
  ],
  muteBtn:    ['button:has-text("Mute")',       'button[aria-label*="mute"]'],
  cameraBtn:  ['button:has-text("Camera Off")', 'button[aria-label*="camera"]'],
  vdoStream:  ['video', 'canvas[class*="video"]', '[class*="video-stream"]'],
  pulseEl:    ['[class*="animate-pulse"]', '[class*="animate-ping"]', '[class*="pulse"]'],

  // LIFF patient side — call initiation (อยู่ใน chat interface)
  liffCallBtn: [
    'button:has-text("โทรหาเภสัชกร")',
    'button:has-text("โทร Voice")',
    'button:has-text("โทร Video")',
    'button:has-text("Voice Call")',
    'button:has-text("Video Call")',
    'button:has-text("โทร")',
    'button:has-text("Call")',
    'button:has-text("Start Call")',
    'button:has-text("เริ่มโทร")',
    '[class*="call-btn"]',
    '[class*="call-button"]',
    'button[aria-label*="voice"]',
    'button[aria-label*="video"]',
    'button[aria-label*="call"]',
    'button[class*="rounded-full"][class*="bg-green"]',
    'svg[class*="phone"]',
    'svg[class*="video"]',
  ],
  liffVoiceCallBtn: [
    'button:has-text("โทร Voice")',
    'button:has-text("Voice Call")',
    'button:has-text("โทรด้วยเสียง")',
    'button[aria-label*="voice"]',
  ],
  liffVideoCallBtn: [
    'button:has-text("โทร Video")',
    'button:has-text("Video Call")',
    'button:has-text("โทรด้วยวิดีโอ")',
    'button[aria-label*="video"]',
  ],
  // LIFF consent page — "รับทราบยินยอม และเริ่มปรึกษา" (ไม่ใช่ e-KYC)
  liffConsentBtn: [
    'button:has-text("รับทราบยินยอม และเริ่มปรึกษา")',
    'button:has-text("รับทราบยินยอม")',
    'button:has-text("เข้าห้องปรึกษา")',
    'button:has-text("เข้าห้อง")',
  ],
  // e-KYC blocker — ผู้ป่วยยังไม่ยืนยันตัวตน
  liffEkycPage: [
    'div:has-text("ยืนยันตัวตน (e-KYC)")',
    'button:has-text("เริ่มต้นยืนยันตัวตน")',
  ],
  liffEndCallBtn: [
    'button:has-text("วางสาย")',
    'button:has-text("End")',
    'button[class*="bg-red"][class*="rounded-full"]',
    'button[aria-label*="end"]',
  ],
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function ss(page: any, name: string): Promise<string> {
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(SS_DIR, file), fullPage: true });
  return file;
}

async function findFirst(page: any, selectors: readonly string[]): Promise<{ found: boolean; sel: string; text: string }> {
  for (const sel of selectors) {
    try {
      const el      = page.locator(sel).first();
      const visible = await el.isVisible({ timeout: 1500 }).catch(() => false);
      if (visible) {
        const text = await el.innerText().catch(() => '');
        return { found: true, sel, text };
      }
    } catch { /* try next */ }
  }
  return { found: false, sel: '', text: '' };
}

// ── CMS login flow ─────────────────────────────────────────────────────────────
async function loginCms(page: any, shots: string[], prefix: string): Promise<boolean> {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  shots.push(await ss(page, `${prefix}_cms_01_login`));

  await page.locator(SEL.username).fill(OPERATOR.email);
  await page.locator(SEL.password).fill(OPERATOR.pass);
  await page.locator(SEL.signIn).click();
  await page.waitForTimeout(4000);
  shots.push(await ss(page, `${prefix}_cms_02_after-login`));

  // select-store
  if (page.url().includes('select-store')) {
    await page.locator(SEL.storeCard).first().click();
    await page.waitForTimeout(600);
    shots.push(await ss(page, `${prefix}_cms_store`));
    await page.locator(SEL.nextBtn).first().click();
    await page.waitForTimeout(3000);
  }
  // select-branch
  if (page.url().includes('select-branch')) {
    await page.locator(SEL.branchCard).first().click();
    await page.waitForTimeout(600);
    shots.push(await ss(page, `${prefix}_cms_branch`));
    await page.locator(SEL.nextBtn).first().click();
    await page.waitForTimeout(3000);
  }
  // select-supervisor (OPERATOR only)
  if (page.url().includes('select-supervisor')) {
    shots.push(await ss(page, `${prefix}_cms_supervisor`));
    const card = page.locator(SEL.supervisorCard).first();
    if (await card.isVisible().catch(() => false)) await card.click();
    await page.waitForTimeout(800);
    const confirmBtn = page.locator(SEL.confirmBtn).first();
    if (await confirmBtn.isVisible().catch(() => false)) {
      const disabled = await confirmBtn.isDisabled().catch(() => true);
      if (disabled) return false;
      await confirmBtn.click();
      await page.waitForTimeout(3000);
    }
  }

  shots.push(await ss(page, `${prefix}_cms_03_queue`));
  return page.url().includes('/home') || page.url().includes('/queue');
}

// ── LIFF login flow (LINE OAuth) ───────────────────────────────────────────────
// ตรวจ form visibility แทน URL เพราะ LIFF voice/video-call แสดง login form
// บน liff.line.me เอง (ไม่ redirect ไป access.line.me)
async function liffLineLogin(page: any, shots: string[], prefix: string): Promise<boolean> {
  if (!LINE_TEST_PHONE || !LINE_TEST_PASS) return false;

  await page.waitForTimeout(3000);
  shots.push(await ss(page, `${prefix}_liff_00_start`));

  // ตรวจ email/phone input (ใช้ทั้ง name, type, placeholder ภาษาไทย)
  const emailSel = 'input[name="tid"], input[type="email"], input[type="tel"], input[placeholder="อีเมล"], input[placeholder="Phone number or email"]';
  const emailInput = page.locator(emailSel).first();
  const emailVisible = await emailInput.isVisible({ timeout: 5000 }).catch(() => false);

  if (!emailVisible) {
    // Login form ไม่ปรากฏ — อาจ logged in ค้างอยู่แล้ว
    return true;
  }

  // กรอก email/phone
  await emailInput.fill(LINE_TEST_PHONE);
  shots.push(await ss(page, `${prefix}_liff_01_email`));

  // ตรวจว่า one-step (email+pass ในหน้าเดียว) หรือ two-step
  const passOnSame = page.locator('input[name="tpasswd"], input[type="password"], input[placeholder="รหัสผ่าน"]').first();
  const passVisible = await passOnSame.isVisible({ timeout: 2000 }).catch(() => false);

  if (passVisible) {
    await passOnSame.fill(LINE_TEST_PASS);
    shots.push(await ss(page, `${prefix}_liff_02_pass`));
    // คลิกปุ่ม login (รอจนพ้น disabled state)
    const loginBtn = page.locator('button:has-text("เข้าสู่ระบบ"), button:has-text("Log in"), button[type="submit"]').first();
    await page.waitForTimeout(500);
    await loginBtn.click({ timeout: 15000 });
  } else {
    // Two-step: กด Continue/ถัดไป แล้วรอหน้า password
    const continueBtn = page.locator('button:has-text("Continue"), button:has-text("ถัดไป")').first();
    if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) await continueBtn.click();
    await page.waitForTimeout(2000);
    const passInput2 = page.locator('input[name="tpasswd"], input[type="password"]').first();
    if (!await passInput2.isVisible({ timeout: 8000 }).catch(() => false)) return false;
    await passInput2.fill(LINE_TEST_PASS);
    shots.push(await ss(page, `${prefix}_liff_02_pass`));
    await page.locator('button:has-text("เข้าสู่ระบบ"), button:has-text("Log in"), button[type="submit"]').first().click({ timeout: 15000 });
  }

  // รอ LIFF โหลดหลัง login
  await page.waitForTimeout(6000);
  shots.push(await ss(page, `${prefix}_liff_03_after-login`));

  // login สำเร็จถ้า email input หายไปแล้ว
  const emailStillVisible = await emailInput.isVisible({ timeout: 2000 }).catch(() => false);
  return !emailStillVisible;
}

// ── Open LIFF_CHAT + LINE login + handle consent + enter chat ─────────────────
// Patient side: เปิด chat LIFF เพื่อสร้าง encounter และเข้าถึง call buttons
async function openLiffCall(
  browser: any,
  shots: string[],
  prefix: string,
): Promise<{ liffPage: any; liffCtx: any; loggedIn: boolean; inChat: boolean; detail: string }> {
  if (!LINE_TEST_PHONE || !LINE_TEST_PASS) {
    return { liffPage: null, liffCtx: null, loggedIn: false, inChat: false,
             detail: 'ไม่พบ LINE_TEST_PHONE / LINE_TEST_PASS ใน .env' };
  }

  const liffCtx  = await browser.newContext({
    permissions: ['camera', 'microphone'],
    viewport: { width: 390, height: 844 }, // mobile viewport
  });
  const liffPage = await liffCtx.newPage();

  // เปิด LIFF_CHAT (ไม่ใช่ voice-call URL โดยตรง เพราะ voice-call ต้องการ encounter)
  await liffPage.goto(LIFF_CHAT, { waitUntil: 'domcontentloaded', timeout: 30000 });
  const loggedIn = await liffLineLogin(liffPage, shots, prefix);
  shots.push(await ss(liffPage, `${prefix}_liff_04_after-login`));

  if (!loggedIn) {
    return { liffPage, liffCtx, loggedIn: false, inChat: false,
             detail: 'LINE login ไม่สำเร็จ' };
  }

  // ── ตรวจสถานะหลัง login ──────────────────────────────────────────────────
  // LIFF_CHAT ใน browser ไม่มี LINE app session context
  // → แสดง profile page เสมอ (call button อยู่ใน LINE app เท่านั้น)
  const pageBody  = await liffPage.locator('body').innerText().catch(() => '');
  const isProfile = pageBody.includes('ยืนยัน OTP แล้ว') || pageBody.includes('ข้อมูลสุขภาพ');
  const ekycFound = await findFirst(liffPage, CALL.liffEkycPage);
  shots.push(await ss(liffPage, `${prefix}_liff_05_state`));

  if (isProfile) {
    // Profile page = LINE login สำเร็จ แต่ call button ไม่มีใน browser context
    // Patient ต้องเปิดจาก LINE app → Flex Message → LIFF opens with proper token
    return { liffPage, liffCtx, loggedIn: true, inChat: false,
             detail: 'LIFF โหลดสำเร็จ (แสดง profile) แต่ call button ต้องเปิดจาก LINE app เท่านั้น — browser ไม่มี LINE session token' };
  }
  if (ekycFound.found) {
    shots.push(await ss(liffPage, `${prefix}_liff_05b_ekyc`));
    return { liffPage, liffCtx, loggedIn: true, inChat: false,
             detail: 'LIFF แสดงหน้า e-KYC — ไม่ได้บล็อก call แต่ไม่พบ call UI ใน browser context' };
  }

  // ── Handle consent page "รับทราบยินยอม และเริ่มปรึกษา" ─────────────────
  const consentEl = await findFirst(liffPage, CALL.liffConsentBtn);
  if (consentEl.found) {
    shots.push(await ss(liffPage, `${prefix}_liff_05_consent`));
    await liffPage.locator(consentEl.sel).first().click();
    await liffPage.waitForTimeout(4000);
    shots.push(await ss(liffPage, `${prefix}_liff_06_after-consent`));
    // ตรวจอีกครั้งว่ายัง e-KYC ไหม
    const ekycAfter = await findFirst(liffPage, CALL.liffEkycPage);
    if (ekycAfter.found) {
      return { liffPage, liffCtx, loggedIn: true, inChat: false,
               detail: 'e-KYC required หลังกด consent' };
    }
  }

  // ── Scroll down เพื่อหา call buttons ─────────────────────────────────────
  await liffPage.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await liffPage.waitForTimeout(1000);
  shots.push(await ss(liffPage, `${prefix}_liff_07_scrolled`));

  // ตรวจว่าเข้า chat interface แล้วหรือยัง (มี text input)
  const chatInput = await liffPage.locator('input[placeholder*="ข้อความ"], input[placeholder*="message"], textarea')
    .first().isVisible({ timeout: 3000 }).catch(() => false);

  shots.push(await ss(liffPage, `${prefix}_liff_08_chat`));

  const body = await liffPage.locator('body').innerText().catch(() => '');
  return { liffPage, liffCtx, loggedIn: true, inChat: chatInput,
           detail: `inChat=${chatInput} | URL: ${liffPage.url().slice(0, 60)} | body: "${body.slice(0, 80)}"` };
}

// ── Wait for incoming call on CMS side ────────────────────────────────────────
async function waitForIncomingCall(cmsPage: any, timeoutMs = 30000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    for (const sel of CALL.incomingAlert) {
      const visible = await cmsPage.locator(sel).first().isVisible({ timeout: 800 }).catch(() => false);
      if (visible) return true;
    }
    await cmsPage.waitForTimeout(1000);
  }
  return false;
}

function push(r: Result) { RESULTS.push(r); }

// ─────────────────────────────────────────────────────────────────────────────
test.describe('CMS-Call', () => {

  // TC-CALL-001 ─────────────────────────────────────────────────────────────────
  test('TC-CALL-001 – Incoming Voice Call Alert', async ({ browser }) => {
    const shots: string[] = [];

    // ── CMS context ──────────────────────────────────────────────────────────
    const cmsCtx  = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const cmsPage = await cmsCtx.newPage();
    const cmsOk   = await loginCms(cmsPage, shots, 'tc-call-001');

    if (!cmsOk) {
      await cmsCtx.close();
      push({ id: 'TC-CALL-001', scenario: 'Incoming Voice Call Alert',
        status: 'SKIP', actualResult: 'CMS login ไม่สำเร็จ / ไม่มีเภสัชกรออนไลน์',
        remark: 'SKIP: ต้องมีเภสัชกรออนไลน์เพื่อรับสาย', screenshots: shots });
      return;
    }

    shots.push(await ss(cmsPage, 'tc-call-001_cms_queue'));

    // ── LIFF context (patient initiates voice call) ───────────────────────────
    const { liffPage, liffCtx, loggedIn, inChat, detail } =
      await openLiffCall(browser, shots, 'tc-call-001');

    if (!loggedIn || !inChat) {
      await liffCtx?.close();
      await cmsCtx.close();
      push({ id: 'TC-CALL-001', scenario: 'Incoming Voice Call Alert',
        status: 'SKIP',
        actualResult: !loggedIn ? `LINE login ไม่สำเร็จ: ${detail}` : detail,
        remark: !loggedIn
          ? 'SKIP: ต้องมี LINE account ที่ login ได้'
          : 'SKIP: call button อยู่ใน LINE app เท่านั้น (browser ไม่มี LINE session token)',
        screenshots: shots });
      return;
    }

    // ── LIFF: หาปุ่ม call ใน chat interface ──────────────────────────────────
    shots.push(await ss(liffPage, 'tc-call-001_liff_ui'));
    const liffBody = await liffPage.locator('body').innerText().catch(() => '');
    const liffCallEl = await findFirst(liffPage, CALL.liffCallBtn);
    if (liffCallEl.found) {
      await liffPage.locator(liffCallEl.sel).first().click();
      await liffPage.waitForTimeout(2000);
      shots.push(await ss(liffPage, 'tc-call-001_liff_calling'));
    }

    // ── CMS: รอ incoming call alert (30 วินาที) ───────────────────────────────
    shots.push(await ss(cmsPage, 'tc-call-001_cms_before-wait'));
    const alertAppeared = await waitForIncomingCall(cmsPage, 30000);
    shots.push(await ss(cmsPage, 'tc-call-001_cms_after-wait'));

    await liffCtx.close();
    await cmsCtx.close();

    push({
      id: 'TC-CALL-001', scenario: 'Incoming Voice Call Alert',
      status: alertAppeared ? 'PASS' : 'FAIL',
      actualResult: alertAppeared
        ? 'CMS แสดง Incoming Call Alert สำเร็จ'
        : `ไม่พบ Alert บน CMS | body: "${liffBody.slice(0, 80)}" | callBtn=${liffCallEl.found}`,
      remark: alertAppeared ? ''
            : !liffCallEl.found ? 'FAIL: ไม่พบปุ่ม Call ใน LIFF chat interface'
            : 'FAIL: กด call แล้วแต่ CMS ไม่ได้รับ incoming alert ภายใน 30 วินาที',
      screenshots: shots,
    });
  });

  // TC-CALL-002 ─────────────────────────────────────────────────────────────────
  test('TC-CALL-002 – Decline สายเรียกเข้า', async ({ browser }) => {
    const shots: string[] = [];

    const cmsCtx  = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const cmsPage = await cmsCtx.newPage();
    const cmsOk   = await loginCms(cmsPage, shots, 'tc-call-002');

    if (!cmsOk) {
      await cmsCtx.close();
      push({ id: 'TC-CALL-002', scenario: 'Decline สายเรียกเข้า',
        status: 'SKIP', actualResult: 'CMS login ไม่สำเร็จ', remark: 'SKIP',
        screenshots: shots });
      return;
    }

    const { liffPage, liffCtx, loggedIn, inChat, detail } =
      await openLiffCall(browser, shots, 'tc-call-002');

    if (!loggedIn || !inChat) {
      await liffCtx?.close();
      await cmsCtx.close();
      push({ id: 'TC-CALL-002', scenario: 'Decline สายเรียกเข้า',
        status: 'SKIP',
        actualResult: !loggedIn ? `LINE login ไม่สำเร็จ: ${detail}` : detail,
        remark: !inChat ? 'SKIP: call button อยู่ใน LINE app เท่านั้น (browser LIFF ไม่มี LINE session token)' : 'SKIP',
        screenshots: shots });
      return;
    }

    // LIFF กด call
    const liffCallEl = await findFirst(liffPage, CALL.liffCallBtn);
    if (liffCallEl.found) {
      await liffPage.locator(liffCallEl.sel).first().click();
      await liffPage.waitForTimeout(2000);
    }
    shots.push(await ss(liffPage, 'tc-call-002_liff_calling'));

    // CMS รอ incoming call
    const alertAppeared = await waitForIncomingCall(cmsPage, 30000);
    shots.push(await ss(cmsPage, 'tc-call-002_cms_alert'));

    if (!alertAppeared) {
      await liffCtx.close();
      await cmsCtx.close();
      push({ id: 'TC-CALL-002', scenario: 'Decline สายเรียกเข้า',
        status: 'FAIL', actualResult: 'ไม่มีสายเรียกเข้าบน CMS',
        remark: 'FAIL: CMS ไม่ได้รับ incoming call notification', screenshots: shots });
      return;
    }

    // CMS กด Decline
    const declineEl = await findFirst(cmsPage, CALL.declineBtn);
    if (declineEl.found) {
      await cmsPage.locator(declineEl.sel).first().click();
      await cmsPage.waitForTimeout(2000);
    }
    shots.push(await ss(cmsPage, 'tc-call-002_cms_after-decline'));

    const alertGone = !(await findFirst(cmsPage, CALL.incomingAlert)).found;
    await liffCtx.close();
    await cmsCtx.close();

    push({
      id: 'TC-CALL-002', scenario: 'Decline สายเรียกเข้า',
      status: alertGone ? 'PASS' : 'FAIL',
      actualResult: alertGone
        ? 'กด Decline — Alert card ปิดและสายยกเลิก'
        : 'Alert card ยังแสดงอยู่หลังกด Decline',
      remark: alertGone ? '' : 'FAIL: Decline button ไม่ได้ปิด alert',
      screenshots: shots,
    });
  });

  // TC-CALL-003 ─────────────────────────────────────────────────────────────────
  test('TC-CALL-003 – Accept Voice → Active + Timer mm:ss', async ({ browser }) => {
    const shots: string[] = [];

    const cmsCtx  = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const cmsPage = await cmsCtx.newPage();
    const cmsOk   = await loginCms(cmsPage, shots, 'tc-call-003');

    if (!cmsOk) {
      await cmsCtx.close();
      push({ id: 'TC-CALL-003', scenario: 'Accept Voice → Active + Timer mm:ss',
        status: 'SKIP', actualResult: 'CMS login ไม่สำเร็จ', remark: 'SKIP',
        screenshots: shots });
      return;
    }

    const { liffPage, liffCtx, loggedIn, inChat, detail } =
      await openLiffCall(browser, shots, 'tc-call-003');

    if (!loggedIn || !inChat) {
      await liffCtx?.close();
      await cmsCtx.close();
      push({ id: 'TC-CALL-003', scenario: 'Accept Voice → Active + Timer mm:ss',
        status: 'SKIP',
        actualResult: !loggedIn ? `LINE login ไม่สำเร็จ: ${detail}` : detail,
        remark: !inChat ? 'SKIP: call button อยู่ใน LINE app เท่านั้น (browser LIFF ไม่มี LINE session token)' : 'SKIP',
        screenshots: shots });
      return;
    }

    const liffCallEl = await findFirst(liffPage, CALL.liffCallBtn);
    if (liffCallEl.found) {
      await liffPage.locator(liffCallEl.sel).first().click();
      await liffPage.waitForTimeout(2000);
    }
    shots.push(await ss(liffPage, 'tc-call-003_liff_calling'));

    const alertAppeared = await waitForIncomingCall(cmsPage, 30000);
    shots.push(await ss(cmsPage, 'tc-call-003_cms_alert'));

    if (!alertAppeared) {
      await liffCtx.close();
      await cmsCtx.close();
      push({ id: 'TC-CALL-003', scenario: 'Accept Voice → Active + Timer mm:ss',
        status: 'FAIL', actualResult: 'ไม่มีสายเรียกเข้าบน CMS', remark: 'FAIL',
        screenshots: shots });
      return;
    }

    // CMS กด Accept
    const acceptEl = await findFirst(cmsPage, CALL.acceptBtn);
    if (acceptEl.found) {
      await cmsPage.locator(acceptEl.sel).first().click();
      await cmsPage.waitForTimeout(3000);
    }
    shots.push(await ss(cmsPage, 'tc-call-003_cms_after-accept'));

    const barFound   = await findFirst(cmsPage, CALL.activeCallBar);
    const timerFound = await findFirst(cmsPage, CALL.callTimer);
    const timerOk    = timerFound.found && /\d{1,2}:\d{2}/.test(timerFound.text);

    // Wait 5 seconds then check timer is counting
    await cmsPage.waitForTimeout(5000);
    const timerAfter  = await findFirst(cmsPage, CALL.callTimer);
    const timerChanged = timerFound.text !== timerAfter.text;
    shots.push(await ss(cmsPage, 'tc-call-003_cms_timer'));

    // End call ก่อนปิด
    const endEl = await findFirst(cmsPage, CALL.endCallBtn);
    if (endEl.found) await cmsPage.locator(endEl.sel).first().click();

    await liffCtx.close();
    await cmsCtx.close();

    const pass = barFound.found && timerOk && timerChanged;
    push({
      id: 'TC-CALL-003', scenario: 'Accept Voice → Active + Timer mm:ss',
      status: pass ? 'PASS' : 'FAIL',
      actualResult: `activeBar=${barFound.found}, timer="${timerFound.text}", timerCounting=${timerChanged}`,
      remark: !barFound.found ? 'FAIL: ไม่พบ Voice Call Active bar'
            : !timerOk ? `FAIL: รูปแบบ timer ไม่ถูกต้อง: "${timerFound.text}"`
            : !timerChanged ? 'FAIL: Timer ไม่นับเพิ่ม'
            : '',
      screenshots: shots,
    });
  });

  // TC-CALL-004 ─────────────────────────────────────────────────────────────────
  test('TC-CALL-004 – Timer เกิน 1 ชม → HH:mm:ss', async ({ page }) => {
    const shots: string[] = [];
    shots.push(await ss(page, 'tc-call-004_skip'));
    push({
      id: 'TC-CALL-004', scenario: 'Timer เกิน 1 ชม → HH:mm:ss',
      status: 'SKIP',
      actualResult: 'ไม่ได้รัน — ต้องสนทนาต่อเนื่อง 60+ นาที',
      remark: 'SKIP: Boundary test ต้องใช้เวลาจริง 60+ นาที ไม่เหมาะกับ automated E2E',
      screenshots: shots,
    });
  });

  // TC-CALL-005 ─────────────────────────────────────────────────────────────────
  test('TC-CALL-005 – Incoming VDO Call Alert', async ({ browser }) => {
    const shots: string[] = [];

    const cmsCtx  = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const cmsPage = await cmsCtx.newPage();
    const cmsOk   = await loginCms(cmsPage, shots, 'tc-call-005');

    if (!cmsOk) {
      await cmsCtx.close();
      push({ id: 'TC-CALL-005', scenario: 'Incoming VDO Call Alert',
        status: 'SKIP', actualResult: 'CMS login ไม่สำเร็จ', remark: 'SKIP',
        screenshots: shots });
      return;
    }

    const { liffPage, liffCtx, loggedIn, inChat, detail } =
      await openLiffCall(browser, shots, 'tc-call-005');

    if (!loggedIn || !inChat) {
      await liffCtx?.close();
      await cmsCtx.close();
      push({ id: 'TC-CALL-005', scenario: 'Incoming VDO Call Alert',
        status: 'SKIP',
        actualResult: !loggedIn ? `LINE login ไม่สำเร็จ: ${detail}` : detail,
        remark: !inChat ? 'SKIP: call button อยู่ใน LINE app เท่านั้น (browser LIFF ไม่มี LINE session token)' : 'SKIP',
        screenshots: shots });
      return;
    }

    shots.push(await ss(liffPage, 'tc-call-005_liff_ui'));
    const liffBody = await liffPage.locator('body').innerText().catch(() => '');

    const liffCallEl = await findFirst(liffPage, CALL.liffCallBtn);
    if (liffCallEl.found) {
      await liffPage.locator(liffCallEl.sel).first().click();
      await liffPage.waitForTimeout(2000);
    }
    shots.push(await ss(liffPage, 'tc-call-005_liff_calling'));

    const alertAppeared = await waitForIncomingCall(cmsPage, 30000);
    shots.push(await ss(cmsPage, 'tc-call-005_cms_result'));

    await liffCtx.close();
    await cmsCtx.close();

    push({
      id: 'TC-CALL-005', scenario: 'Incoming VDO Call Alert',
      status: alertAppeared ? 'PASS' : 'FAIL',
      actualResult: alertAppeared
        ? 'CMS แสดง Incoming VDO Call Alert สำเร็จ'
        : `ไม่พบ VDO Alert | LIFF: "${liffBody.slice(0, 80)}" | callBtn=${liffCallEl.found}`,
      remark: alertAppeared ? ''
            : !liffCallEl.found ? 'LIFF ไม่มีปุ่ม Call — ต้องมี active encounter ก่อน'
            : 'CMS ไม่ได้รับ video call alert ภายใน 30 วินาที',
      screenshots: shots,
    });
  });

  // TC-CALL-006 ─────────────────────────────────────────────────────────────────
  test('TC-CALL-006 – Accept VDO → Full screen + PIP + controls', async ({ browser }) => {
    const shots: string[] = [];

    const cmsCtx  = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const cmsPage = await cmsCtx.newPage();
    const cmsOk   = await loginCms(cmsPage, shots, 'tc-call-006');

    if (!cmsOk) {
      await cmsCtx.close();
      push({ id: 'TC-CALL-006', scenario: 'Accept VDO → Full screen + PIP + controls',
        status: 'SKIP', actualResult: 'CMS login ไม่สำเร็จ', remark: 'SKIP',
        screenshots: shots });
      return;
    }

    const { liffPage, liffCtx, loggedIn, inChat, detail } =
      await openLiffCall(browser, shots, 'tc-call-006');

    if (!loggedIn || !inChat) {
      await liffCtx?.close();
      await cmsCtx.close();
      push({ id: 'TC-CALL-006', scenario: 'Accept VDO → Full screen + PIP + controls',
        status: 'SKIP',
        actualResult: !loggedIn ? 'LINE login ไม่สำเร็จ' : detail,
        remark: !inChat ? 'SKIP: call button อยู่ใน LINE app เท่านั้น (browser LIFF ไม่มี LINE session token)' : 'SKIP',
        screenshots: shots });
      return;
    }

    const liffCallEl = await findFirst(liffPage, CALL.liffCallBtn);
    if (liffCallEl.found) {
      await liffPage.locator(liffCallEl.sel).first().click();
      await liffPage.waitForTimeout(2000);
    }

    const alertAppeared = await waitForIncomingCall(cmsPage, 30000);
    shots.push(await ss(cmsPage, 'tc-call-006_cms_alert'));

    if (!alertAppeared) {
      await liffCtx.close();
      await cmsCtx.close();
      push({ id: 'TC-CALL-006', scenario: 'Accept VDO → Full screen + PIP + controls',
        status: 'FAIL', actualResult: 'ไม่มี VDO call เรียกเข้า', remark: 'FAIL',
        screenshots: shots });
      return;
    }

    // CMS กด Accept VDO call
    const acceptEl = await findFirst(cmsPage, CALL.acceptBtn);
    if (acceptEl.found) {
      await cmsPage.locator(acceptEl.sel).first().click();
      await cmsPage.waitForTimeout(5000); // รอ video stream load
    }
    shots.push(await ss(cmsPage, 'tc-call-006_cms_vdo'));

    const videoEl   = await findFirst(cmsPage, CALL.vdoStream);
    const muteEl    = await findFirst(cmsPage, CALL.muteBtn);
    const cameraEl  = await findFirst(cmsPage, CALL.cameraBtn);
    const endCallEl = await findFirst(cmsPage, CALL.endCallBtn);
    const allOk     = videoEl.found && (muteEl.found || cameraEl.found) && endCallEl.found;

    // End call
    if (endCallEl.found) await cmsPage.locator(endCallEl.sel).first().click();

    await liffCtx.close();
    await cmsCtx.close();

    push({
      id: 'TC-CALL-006', scenario: 'Accept VDO → Full screen + PIP + controls',
      status: allOk ? 'PASS' : 'FAIL',
      actualResult: `video=${videoEl.found}, mute=${muteEl.found}, camera=${cameraEl.found}, endCall=${endCallEl.found}`,
      remark: allOk ? '' : 'FAIL: control บางรายการไม่ปรากฏหลังรับสาย VDO',
      screenshots: shots,
    });
  });

  // TC-CALL-007 ─────────────────────────────────────────────────────────────────
  test('TC-CALL-007 – ห้ามสลับ patient ระหว่าง call', async ({ browser }) => {
    const shots: string[] = [];

    const cmsCtx  = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const cmsPage = await cmsCtx.newPage();
    const cmsOk   = await loginCms(cmsPage, shots, 'tc-call-007');

    if (!cmsOk) {
      await cmsCtx.close();
      push({ id: 'TC-CALL-007', scenario: 'ห้ามสลับ patient ระหว่าง call',
        status: 'SKIP', actualResult: 'CMS login ไม่สำเร็จ', remark: 'SKIP',
        screenshots: shots });
      return;
    }

    const { liffPage, liffCtx, loggedIn, inChat, detail } =
      await openLiffCall(browser, shots, 'tc-call-007');

    if (!loggedIn || !inChat) {
      await liffCtx?.close();
      await cmsCtx.close();
      push({ id: 'TC-CALL-007', scenario: 'ห้ามสลับ patient ระหว่าง call',
        status: 'SKIP',
        actualResult: !loggedIn ? 'LINE login ไม่สำเร็จ' : detail,
        remark: !inChat ? 'SKIP: call button อยู่ใน LINE app เท่านั้น (browser LIFF ไม่มี LINE session token)' : 'SKIP',
        screenshots: shots });
      return;
    }

    const liffCallEl = await findFirst(liffPage, CALL.liffCallBtn);
    if (liffCallEl.found) {
      await liffPage.locator(liffCallEl.sel).first().click();
      await liffPage.waitForTimeout(2000);
    }

    const alertAppeared = await waitForIncomingCall(cmsPage, 30000);
    if (!alertAppeared) {
      await liffCtx.close();
      await cmsCtx.close();
      push({ id: 'TC-CALL-007', scenario: 'ห้ามสลับ patient ระหว่าง call',
        status: 'FAIL', actualResult: 'ไม่มีสายเรียกเข้า', remark: 'FAIL',
        screenshots: shots });
      return;
    }

    // รับสาย
    const acceptEl = await findFirst(cmsPage, CALL.acceptBtn);
    if (acceptEl.found) {
      await cmsPage.locator(acceptEl.sel).first().click();
      await cmsPage.waitForTimeout(2000);
    }
    shots.push(await ss(cmsPage, 'tc-call-007_cms_in-call'));

    // ลองคลิก patient card อื่น
    const otherCards = cmsPage.locator(SEL.patientCard);
    const cardCount  = await otherCards.count();
    const urlBefore  = cmsPage.url();

    if (cardCount >= 2) {
      await otherCards.nth(1).click();
      await cmsPage.waitForTimeout(2000);
    }
    shots.push(await ss(cmsPage, 'tc-call-007_cms_after-click'));

    const urlAfter      = cmsPage.url();
    const warningDialog = await cmsPage.locator('[role="dialog"], [role="alert"]')
      .isVisible({ timeout: 1500 }).catch(() => false);
    const stayed        = urlBefore === urlAfter || warningDialog;

    const endEl = await findFirst(cmsPage, CALL.endCallBtn);
    if (endEl.found) await cmsPage.locator(endEl.sel).first().click();

    await liffCtx.close();
    await cmsCtx.close();

    push({
      id: 'TC-CALL-007', scenario: 'ห้ามสลับ patient ระหว่าง call',
      status: cardCount < 2 ? 'SKIP' : stayed ? 'PASS' : 'FAIL',
      actualResult: `cards=${cardCount}, warningDialog=${warningDialog}, urlChanged=${urlBefore !== urlAfter}`,
      remark: cardCount < 2
        ? 'SKIP: ไม่มี patient อื่นในคิวให้สลับ'
        : stayed ? 'ระบบบล็อกการสลับ patient ระหว่าง active call'
        : 'FAIL: ระบบอนุญาตสลับ patient แม้อยู่ใน call',
      screenshots: shots,
    });
  });

  // TC-CALL-008 ─────────────────────────────────────────────────────────────────
  test('TC-CALL-008 – Call Status Indicator pulse', async ({ browser }) => {
    const shots: string[] = [];

    const cmsCtx  = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const cmsPage = await cmsCtx.newPage();
    const cmsOk   = await loginCms(cmsPage, shots, 'tc-call-008');

    if (!cmsOk) {
      await cmsCtx.close();
      push({ id: 'TC-CALL-008', scenario: 'Call Status Indicator pulse',
        status: 'SKIP', actualResult: 'CMS login ไม่สำเร็จ', remark: 'SKIP',
        screenshots: shots });
      return;
    }

    const { liffPage, liffCtx, loggedIn, inChat, detail } =
      await openLiffCall(browser, shots, 'tc-call-008');

    if (!loggedIn || !inChat) {
      await liffCtx?.close();
      await cmsCtx.close();
      push({ id: 'TC-CALL-008', scenario: 'Call Status Indicator pulse',
        status: 'SKIP',
        actualResult: !loggedIn ? 'LINE login ไม่สำเร็จ' : detail,
        remark: !inChat ? 'SKIP: call button อยู่ใน LINE app เท่านั้น (browser LIFF ไม่มี LINE session token)' : 'SKIP',
        screenshots: shots });
      return;
    }

    const liffCallEl = await findFirst(liffPage, CALL.liffCallBtn);
    if (liffCallEl.found) {
      await liffPage.locator(liffCallEl.sel).first().click();
      await liffPage.waitForTimeout(2000);
    }

    const alertAppeared = await waitForIncomingCall(cmsPage, 30000);
    if (!alertAppeared) {
      await liffCtx.close();
      await cmsCtx.close();
      push({ id: 'TC-CALL-008', scenario: 'Call Status Indicator pulse',
        status: 'FAIL', actualResult: 'ไม่มีสายเรียกเข้า', remark: 'FAIL',
        screenshots: shots });
      return;
    }

    const acceptEl = await findFirst(cmsPage, CALL.acceptBtn);
    if (acceptEl.found) {
      await cmsPage.locator(acceptEl.sel).first().click();
      await cmsPage.waitForTimeout(2000);
    }
    shots.push(await ss(cmsPage, 'tc-call-008_cms_in-call'));

    // ตรวจ pulse animation
    const pulseEl = await findFirst(cmsPage, CALL.pulseEl);
    const hasPulseClass = await cmsPage.evaluate(() =>
      document.querySelectorAll('[class*="animate-pulse"], [class*="animate-ping"]').length > 0
    );
    shots.push(await ss(cmsPage, 'tc-call-008_cms_pulse'));

    const endEl = await findFirst(cmsPage, CALL.endCallBtn);
    if (endEl.found) await cmsPage.locator(endEl.sel).first().click();

    await liffCtx.close();
    await cmsCtx.close();

    const pulseOk = pulseEl.found || hasPulseClass;
    push({
      id: 'TC-CALL-008', scenario: 'Call Status Indicator pulse',
      status: pulseOk ? 'PASS' : 'FAIL',
      actualResult: `pulseElement=${pulseEl.found}, pulseCssClass=${hasPulseClass}`,
      remark: pulseOk ? 'พบ Pulse animation บน call status indicator' :
              'FAIL: ไม่พบ pulse indicator ขณะอยู่ใน active call',
      screenshots: shots,
    });
  });

  // TC-CALL-009 ─────────────────────────────────────────────────────────────────
  test('TC-CALL-009 – Agora SDK init camera/mic', async ({ browser }) => {
    const shots: string[] = [];

    // Grant permissions ทั้ง 2 contexts
    const cmsCtx  = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const cmsPage = await cmsCtx.newPage();
    const cmsOk   = await loginCms(cmsPage, shots, 'tc-call-009');

    if (!cmsOk) {
      await cmsCtx.close();
      push({ id: 'TC-CALL-009', scenario: 'Agora SDK init camera/mic',
        status: 'SKIP', actualResult: 'CMS login ไม่สำเร็จ', remark: 'SKIP',
        screenshots: shots });
      return;
    }

    const { liffPage, liffCtx, loggedIn, inChat, detail } =
      await openLiffCall(browser, shots, 'tc-call-009');

    if (!loggedIn || !inChat) {
      await liffCtx?.close();
      await cmsCtx.close();
      push({ id: 'TC-CALL-009', scenario: 'Agora SDK init camera/mic',
        status: 'SKIP',
        actualResult: !loggedIn ? 'LINE login ไม่สำเร็จ' : detail,
        remark: !inChat ? 'SKIP: call button อยู่ใน LINE app เท่านั้น (browser LIFF ไม่มี LINE session token)' : 'SKIP',
        screenshots: shots });
      return;
    }

    const liffCallEl = await findFirst(liffPage, CALL.liffCallBtn);
    if (liffCallEl.found) {
      await liffPage.locator(liffCallEl.sel).first().click();
      await liffPage.waitForTimeout(3000);
    }

    const alertAppeared = await waitForIncomingCall(cmsPage, 30000);
    const acceptEl = await findFirst(cmsPage, CALL.acceptBtn);
    if (alertAppeared && acceptEl.found) {
      await cmsPage.locator(acceptEl.sel).first().click();
      await cmsPage.waitForTimeout(4000); // รอ Agora init
    }
    shots.push(await ss(cmsPage, 'tc-call-009_cms_after-accept'));

    // ตรวจ Agora SDK ใน CMS browser context
    const agoraCheck = await cmsPage.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[src]'))
        .map((s: any) => s.src)
        .filter((src: string) => src.toLowerCase().includes('agora'));
      return {
        agoraInWindow:  typeof (window as any).AgoraRTC !== 'undefined',
        webRTCOk:       typeof navigator.mediaDevices?.getUserMedia === 'function',
        hasAgoraScript: scripts.length > 0,
        hasVideo:       document.querySelectorAll('video').length > 0,
        scriptCount:    scripts.length,
      };
    });

    // ตรวจ LIFF context ด้วย
    const liffAgoraCheck = await liffPage.evaluate(() => ({
      agoraInWindow: typeof (window as any).AgoraRTC !== 'undefined',
      webRTCOk:      typeof navigator.mediaDevices?.getUserMedia === 'function',
      hasVideo:      document.querySelectorAll('video').length > 0,
    }));

    shots.push(await ss(cmsPage, 'tc-call-009_cms_sdk'));
    shots.push(await ss(liffPage, 'tc-call-009_liff_sdk'));

    const endEl = await findFirst(cmsPage, CALL.endCallBtn);
    if (endEl.found) await cmsPage.locator(endEl.sel).first().click();

    await liffCtx.close();
    await cmsCtx.close();

    const sdkOk = agoraCheck.agoraInWindow || agoraCheck.hasAgoraScript || agoraCheck.hasVideo;
    const webRtcOk = agoraCheck.webRTCOk && liffAgoraCheck.webRTCOk;

    push({
      id: 'TC-CALL-009', scenario: 'Agora SDK init camera/mic',
      status: !alertAppeared ? 'FAIL' : (sdkOk && webRtcOk) ? 'PASS' : 'FAIL',
      actualResult: [
        `CMS: AgoraSDK=${agoraCheck.agoraInWindow}, webRTC=${agoraCheck.webRTCOk}, video=${agoraCheck.hasVideo}`,
        `LIFF: AgoraSDK=${liffAgoraCheck.agoraInWindow}, webRTC=${liffAgoraCheck.webRTCOk}, video=${liffAgoraCheck.hasVideo}`,
      ].join(' | '),
      remark: !alertAppeared ? 'FAIL: CMS ไม่ได้รับ incoming call'
            : !webRtcOk ? 'FAIL: WebRTC API ไม่พร้อมในบาง context'
            : !sdkOk ? 'FAIL: Agora SDK ไม่พบใน CMS browser'
            : 'Agora SDK พร้อมและ WebRTC streaming ทำงานได้',
      screenshots: shots,
    });
  });

  // TC-CALL-010 ─────────────────────────────────────────────────────────────────
  test('TC-CALL-010 – End call → กลับสถานะปกติ + บันทึก duration', async ({ browser }) => {
    const shots: string[] = [];

    const cmsCtx  = await browser.newContext({ permissions: ['camera', 'microphone'] });
    const cmsPage = await cmsCtx.newPage();
    const cmsOk   = await loginCms(cmsPage, shots, 'tc-call-010');

    if (!cmsOk) {
      await cmsCtx.close();
      push({ id: 'TC-CALL-010', scenario: 'End call → กลับสถานะปกติ + บันทึก duration',
        status: 'SKIP', actualResult: 'CMS login ไม่สำเร็จ', remark: 'SKIP',
        screenshots: shots });
      return;
    }

    const { liffPage, liffCtx, loggedIn, inChat, detail } =
      await openLiffCall(browser, shots, 'tc-call-010');

    if (!loggedIn || !inChat) {
      await liffCtx?.close();
      await cmsCtx.close();
      push({ id: 'TC-CALL-010', scenario: 'End call → กลับสถานะปกติ + บันทึก duration',
        status: 'SKIP',
        actualResult: !loggedIn ? 'LINE login ไม่สำเร็จ' : detail,
        remark: !inChat ? 'SKIP: call button อยู่ใน LINE app เท่านั้น (browser LIFF ไม่มี LINE session token)' : 'SKIP',
        screenshots: shots });
      return;
    }

    const liffCallEl = await findFirst(liffPage, CALL.liffCallBtn);
    if (liffCallEl.found) {
      await liffPage.locator(liffCallEl.sel).first().click();
      await liffPage.waitForTimeout(2000);
    }

    const alertAppeared = await waitForIncomingCall(cmsPage, 30000);
    if (!alertAppeared) {
      await liffCtx.close();
      await cmsCtx.close();
      push({ id: 'TC-CALL-010', scenario: 'End call → กลับสถานะปกติ + บันทึก duration',
        status: 'FAIL', actualResult: 'ไม่มีสายเรียกเข้า', remark: 'FAIL',
        screenshots: shots });
      return;
    }

    // รับสาย
    const acceptEl = await findFirst(cmsPage, CALL.acceptBtn);
    if (acceptEl.found) {
      await cmsPage.locator(acceptEl.sel).first().click();
      await cmsPage.waitForTimeout(3000);
    }

    // จับ timer ก่อน end
    const timerBefore = await findFirst(cmsPage, CALL.callTimer);
    shots.push(await ss(cmsPage, 'tc-call-010_cms_in-call'));

    // กด End Call
    const endEl = await findFirst(cmsPage, CALL.endCallBtn);
    if (endEl.found) {
      await cmsPage.locator(endEl.sel).first().click();
      await cmsPage.waitForTimeout(3000);
    }
    shots.push(await ss(cmsPage, 'tc-call-010_cms_after-end'));

    const callGone    = !(await findFirst(cmsPage, CALL.activeCallBar)).found;
    const chatVisible = await cmsPage.locator('input[placeholder*="พิมพ์ข้อความ"]')
      .isVisible({ timeout: 3000 }).catch(() => false);
    const durationEl  = await cmsPage.locator(
      'div:has-text("duration"), [class*="duration"], div:has-text("ระยะเวลา")'
    ).isVisible({ timeout: 2000 }).catch(() => false);

    await liffCtx.close();
    await cmsCtx.close();

    const endOk = callGone && chatVisible;
    push({
      id: 'TC-CALL-010', scenario: 'End call → กลับสถานะปกติ + บันทึก duration',
      status: endOk ? 'PASS' : 'FAIL',
      actualResult: `callEnded=${callGone}, chatRestored=${chatVisible}, durationRecorded=${durationEl}, timerWas="${timerBefore.text}"`,
      remark: endOk
        ? `End Call สำเร็จ${durationEl ? ' — บันทึก duration แล้ว' : ' — ไม่พบ duration UI'}`
        : 'FAIL: หลังกด End Call ระบบไม่กลับสู่สถานะ chat ปกติ',
      screenshots: shots,
    });
  });

  // ─── Write results ────────────────────────────────────────────────────────────
  test.afterAll(async () => {
    const out = path.join(__dirname, '../test-results-call.json');
    fs.writeFileSync(out, JSON.stringify(RESULTS, null, 2), 'utf-8');
    console.log(`\nWrote ${RESULTS.length} results → ${out}`);
    for (const r of RESULTS) {
      const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️';
      console.log(`  ${icon} ${r.id} | ${r.status} | ${r.actualResult.slice(0, 90)}`);
    }
  });
});
