import { test } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  OPERATOR, PHARMA, Result,
  makeScreenshotter, goLogin, fillCreds, clickSignIn, getBodyText, writeResultsJson,
} from './helpers.js';
import { TELEPHARMACY_SEL } from '../../pages/TelepharmacyLoginPage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const SS_DIR     = path.join(__dirname, '../../screenshots/telepharmacy/login');

// ─── Selectors (Telepharmacy_CMS_Selectors.xlsx) ──────────────────────────────
const SEL = {
  ...TELEPHARMACY_SEL,
  showHide: 'button[type="button"]',        // first button = eye icon toggle
} as const;

// ─── Error pattern ────────────────────────────────────────────────────────────
const ERR_PATTERN = /invalid|ไม่ถูกต้อง/i;

const ss = makeScreenshotter(SS_DIR);

const RESULTS: Result[] = [];

/** Login → select-store → select-branch จนถึงหน้าถัดไป */
async function completeStoreFlow(page: any, shots: string[], idPrefix: string) {
  if (page.url().includes('select-store')) {
    await page.locator(SEL.storeCard).first().click();
    await page.waitForTimeout(600);
    shots.push(await ss(page, `${idPrefix}_store-selected`));
    await page.locator(SEL.nextBtn).first().click();
    await page.waitForTimeout(3000);
    shots.push(await ss(page, `${idPrefix}_after-store`));
  }
  if (page.url().includes('select-branch')) {
    await page.locator(SEL.branchCard).first().click();  // ต้องเลือกก่อน — ปุ่มถัดไป disabled จนกว่าจะเลือก
    await page.waitForTimeout(600);
    shots.push(await ss(page, `${idPrefix}_branch-selected`));
    await page.locator(SEL.nextBtn).first().click();
    await page.waitForTimeout(3000);
    shots.push(await ss(page, `${idPrefix}_after-branch`));
  }
}

// ─── TC-AUTH-001 : Login เภสัชกร ──────────────────────────────────────────────
test('TC-AUTH-001 – Login Pharmacist (Happy Path)', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await goLogin(page);
  const shots = [await ss(page, 'AUTH-001_01_login-page')];

  await fillCreds(page, PHARMA.email, PHARMA.pass);
  shots.push(await ss(page, 'AUTH-001_02_filled'));
  await clickSignIn(page);
  shots.push(await ss(page, 'AUTH-001_03_after-login'));
  const isLoggedIn = !page.url().includes('/login');
  const body = await getBodyText(page);
  const errLine = ERR_PATTERN.test(body)
    ? body.split('\n').find((l: string) => ERR_PATTERN.test(l)) ?? ''
    : '';

  if (isLoggedIn) {
    await completeStoreFlow(page, shots, 'AUTH-001');
    shots.push(await ss(page, 'AUTH-001_final'));
    RESULTS.push({
      id: 'TC-AUTH-001', scenario: 'Login เภสัชกร (Happy Path)', status: 'PASS',
      actualResult: `Login สำเร็จ → ${page.url()}`,
      remark: 'เภสัชกร login และเข้าสู่ระบบสำเร็จ',
      screenshots: shots,
    });
  } else {
    RESULTS.push({
      id: 'TC-AUTH-001', scenario: 'Login เภสัชกร (Happy Path)', status: 'FAIL',
      actualResult: `Login ล้มเหลว: "${errLine}"`,
      remark: 'pharma@medcare.com ไม่ผ่าน — ตรวจสอบ credential',
      screenshots: shots,
    });
  }
  console.log(`TC-AUTH-001: ${RESULTS.at(-1)!.status}`);
});

// ─── TC-AUTH-002 : Login Operator ─────────────────────────────────────────────
test('TC-AUTH-002 – Login Operator', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await goLogin(page);
  const shots = [await ss(page, 'AUTH-002_01_login-page')];

  await fillCreds(page, OPERATOR.email, OPERATOR.pass);
  shots.push(await ss(page, 'AUTH-002_02_filled'));
  await clickSignIn(page);
  shots.push(await ss(page, 'AUTH-002_03_after-login'));

  const isLoggedIn = !page.url().includes('/login');
  if (isLoggedIn) {
    await completeStoreFlow(page, shots, 'AUTH-002');
    shots.push(await ss(page, 'AUTH-002_final'));
    RESULTS.push({
      id: 'TC-AUTH-002', scenario: 'Login Operator', status: 'PASS',
      actualResult: `Operator login สำเร็จ → ${page.url()}`,
      remark: 'Login ผ่าน เดิน flow select-store → select-branch สำเร็จ',
      screenshots: shots,
    });
  } else {
    RESULTS.push({
      id: 'TC-AUTH-002', scenario: 'Login Operator', status: 'FAIL',
      actualResult: 'Operator login ล้มเหลว',
      remark: '', screenshots: shots,
    });
  }
  console.log(`TC-AUTH-002: ${RESULTS.at(-1)!.status}`);
});

// ─── TC-AUTH-003 : รหัสผ่านผิด ────────────────────────────────────────────────
test('TC-AUTH-003 – Wrong Password', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await goLogin(page);
  await fillCreds(page, OPERATOR.email, 'WrongPass99');
  await clickSignIn(page);
  const shots = [await ss(page, 'AUTH-003_01_wrong-password')];

  const stillOnLogin = page.url().includes('/login');
  const body = await getBodyText(page);
  const hasError = ERR_PATTERN.test(body);
  const errLine = body.split('\n').find((l: string) => ERR_PATTERN.test(l)) ?? '';

  RESULTS.push({
    id: 'TC-AUTH-003', scenario: 'Login ด้วยรหัสผ่านผิด',
    status: stillOnLogin ? 'PASS' : 'FAIL',
    actualResult: stillOnLogin
      ? `ยังอยู่หน้า Login${hasError ? `, error: "${errLine}"` : ', ไม่แสดง error ที่ชัดเจน'}`
      : `Login ผ่านทั้งที่ password ผิด → ${page.url()}`,
    remark: stillOnLogin && hasError ? 'ระบบแสดง error message ถูกต้อง'
      : stillOnLogin ? 'ระบบปฏิเสธถูกต้อง แต่ไม่แสดง error ที่ชัดเจน'
      : 'BUG CRITICAL: ระบบให้ login ได้ทั้งที่ password ผิด',
    screenshots: shots,
  });
  console.log(`TC-AUTH-003: ${RESULTS.at(-1)!.status}`);
});

// ─── TC-AUTH-004 : Email ไม่มีในระบบ ──────────────────────────────────────────
test('TC-AUTH-004 – Non-existent Email', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await goLogin(page);
  await fillCreds(page, 'notexist@medcare.com', 'Any@1234');
  await clickSignIn(page);
  const shots = [await ss(page, 'AUTH-004_01_nonexist')];

  const stillOnLogin = page.url().includes('/login');
  const body = await getBodyText(page);
  const revealsNotExist = /not found|ไม่พบ email|email ไม่มี/i.test(body);
  const errLine = body.split('\n').find((l: string) => ERR_PATTERN.test(l)) ?? '';

  RESULTS.push({
    id: 'TC-AUTH-004', scenario: 'Login email ไม่มีในระบบ',
    status: (stillOnLogin && !revealsNotExist) ? 'PASS' : 'FAIL',
    actualResult: stillOnLogin
      ? `ยังอยู่หน้า Login: "${errLine}"${revealsNotExist ? ' (เปิดเผยว่า email ไม่มี)' : ''}`
      : `Login ผ่านทั้งที่ email ไม่มีในระบบ`,
    remark: revealsNotExist ? 'Security Issue: Email Enumeration' : 'ระบบไม่เปิดเผย email enumeration ถูกต้อง',
    screenshots: shots,
  });
  console.log(`TC-AUTH-004: ${RESULTS.at(-1)!.status}`);
});

// ─── TC-AUTH-005 : ช่องว่าง ───────────────────────────────────────────────────
test('TC-AUTH-005 – Empty Fields Validation', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await goLogin(page);
  const shots = [await ss(page, 'AUTH-005_01_empty-form')];

  const btn = page.locator(SEL.signIn).first();
  const disabled = await btn.isDisabled().catch(() => false);
  if (!disabled) {
    await btn.click();
    await page.waitForTimeout(1500);
  }
  shots.push(await ss(page, 'AUTH-005_02_after-click'));
  const stillOnLogin = page.url().includes('/login');

  RESULTS.push({
    id: 'TC-AUTH-005', scenario: 'Validation ช่อง email/password ว่าง',
    status: (disabled || stillOnLogin) ? 'PASS' : 'FAIL',
    actualResult: disabled
      ? 'ปุ่ม Sign In ถูก disable เมื่อช่องว่าง'
      : stillOnLogin ? 'ยังอยู่หน้า Login หลัง click submit ช่องว่าง'
      : `ถูก redirect ไป ${page.url()} ทั้งที่ไม่กรอกข้อมูล`,
    remark: disabled ? 'ปุ่มถูก disable ถูกต้อง'
      : stillOnLogin ? 'HTML5 validation ทำงาน'
      : 'BUG: ไม่ validate ช่องว่าง',
    screenshots: shots,
  });
  console.log(`TC-AUTH-005: ${RESULTS.at(-1)!.status}`);
});

// ─── TC-AUTH-006 : Show/Hide Password ─────────────────────────────────────────
test('TC-AUTH-006 – Show/Hide Password Toggle', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await goLogin(page);
  await page.locator(SEL.password).fill('Pharm@1234');
  const shots = [await ss(page, 'AUTH-006_01_password-hidden')];

  const toggle = page.locator(SEL.showHide).first();
  const hasToggle = await toggle.isVisible().catch(() => false);

  if (hasToggle) {
    await toggle.click();
    await page.waitForTimeout(400);
    shots.push(await ss(page, 'AUTH-006_02_password-shown'));
    // password input เปลี่ยน index หลัง toggle — ใช้ nth(1) ตาม selector doc
    const typeAfterShow = await page.locator('input').nth(1).getAttribute('type').catch(() => 'unknown');

    await toggle.click();
    await page.waitForTimeout(400);
    shots.push(await ss(page, 'AUTH-006_03_password-hidden-again'));
    const typeAfterHide = await page.locator('input').nth(1).getAttribute('type').catch(() => 'unknown');

    const works = typeAfterShow === 'text' && typeAfterHide === 'password';
    RESULTS.push({
      id: 'TC-AUTH-006', scenario: 'ปุ่ม Show/Hide Password',
      status: works ? 'PASS' : 'FAIL',
      actualResult: `Show → type="${typeAfterShow}", Hide → type="${typeAfterHide}"`,
      remark: works ? 'Toggle ทำงานถูกต้อง'
        : `Toggle ไม่ทำงานตามที่คาดหวัง (Show=${typeAfterShow}, Hide=${typeAfterHide})`,
      screenshots: shots,
    });
  } else {
    RESULTS.push({
      id: 'TC-AUTH-006', scenario: 'ปุ่ม Show/Hide Password', status: 'FAIL',
      actualResult: 'ไม่พบปุ่ม Show/Hide toggle',
      remark: 'ระบบไม่มีปุ่ม toggle',
      screenshots: shots,
    });
  }
  console.log(`TC-AUTH-006: ${RESULTS.at(-1)!.status}`);
});

// ─── TC-AUTH-011 : Pharmacist → Home โดยตรง ───────────────────────────────────
test('TC-AUTH-011 – Pharmacist → Home directly (no supervisor step)', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await goLogin(page);
  await fillCreds(page, PHARMA.email, PHARMA.pass);
  await clickSignIn(page);
  const shots: string[] = [];
  if (!page.url().includes('/login')) {
    await completeStoreFlow(page, shots, 'AUTH-011');
  }
  shots.push(await ss(page, 'AUTH-011_final'));

  const finalUrl = page.url();
  const isLoggedIn = !finalUrl.includes('/login');
  const body = await getBodyText(page);
  const hasSupervisorPage = new RegExp(SEL.supervisorHeading.replace('text=', '') + '|supervising pharmacist', 'i').test(body);

  if (!isLoggedIn) {
    RESULTS.push({
      id: 'TC-AUTH-011', scenario: 'Pharmacist เข้า Home โดยตรง', status: 'FAIL',
      actualResult: 'Login ล้มเหลว ไม่สามารถทดสอบ flow ได้',
      remark: 'Pharmacist credential ไม่ถูกต้อง', screenshots: shots,
    });
  } else {
    RESULTS.push({
      id: 'TC-AUTH-011', scenario: 'Pharmacist เข้า Home โดยตรง',
      status: hasSupervisorPage ? 'FAIL' : 'PASS',
      actualResult: `URL: ${finalUrl}${hasSupervisorPage ? ' (ระบบบังคับเลือก supervisor)' : ''}`,
      remark: hasSupervisorPage
        ? 'BUG: เภสัชกรถูกบังคับเลือก supervisor ซึ่งไม่ถูกต้อง'
        : 'เภสัชกรเข้า Home โดยตรง ถูกต้อง',
      screenshots: shots,
    });
  }
  console.log(`TC-AUTH-011: ${RESULTS.at(-1)!.status}`);
});

// ─── TC-AUTH-012 : Operator ต้องเลือก Supervising Pharmacist ──────────────────
test('TC-AUTH-012 – Operator must select Supervising Pharmacist', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await goLogin(page);
  await fillCreds(page, OPERATOR.email, OPERATOR.pass);
  await clickSignIn(page);
  const shots = [await ss(page, 'AUTH-012_01_after-login')];

  await completeStoreFlow(page, shots, 'AUTH-012');
  shots.push(await ss(page, 'AUTH-012_final'));

  const finalUrl = page.url();
  const body = await getBodyText(page);
  const hasSupervisorStep =
    page.url().includes('select-supervisor') ||
    body.includes('เลือกเภสัชกรผู้ควบคุม') ||
    /supervising|select.?pharmacist/i.test(body + finalUrl);

  RESULTS.push({
    id: 'TC-AUTH-012', scenario: 'Operator ต้องเลือก Supervising Pharmacist',
    status: hasSupervisorStep ? 'PASS' : 'FAIL',
    actualResult: `URL: ${finalUrl} – ${hasSupervisorStep ? 'พบหน้าเลือก Supervising Pharmacist' : 'ไม่พบหน้าเลือก'}`,
    remark: hasSupervisorStep
      ? 'ระบบบังคับ Operator เลือก Supervising Pharmacist ถูกต้อง (FR-L02B)'
      : 'BUG: Operator เข้า Home โดยไม่ผ่านขั้นตอนเลือก Supervising Pharmacist',
    screenshots: shots,
  });
  console.log(`TC-AUTH-012: ${RESULTS.at(-1)!.status}`);
});

// ─── TC-AUTH-018 : SQL Injection ──────────────────────────────────────────────
test('TC-AUTH-018 – SQL Injection', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await goLogin(page);
  await page.locator(SEL.username).fill("' OR '1'='1");
  await page.locator(SEL.password).fill('x');
  await clickSignIn(page);
  const shots = [await ss(page, 'AUTH-018_01_sql-result')];

  const url  = page.url();
  const body = await getBodyText(page);
  const bypassed = !url.includes('/login');
  const dbError  = /sql|syntax error|database|ora-|mysql/i.test(body);

  RESULTS.push({
    id: 'TC-AUTH-018', scenario: 'SQL Injection ในช่อง username',
    status: (!bypassed && !dbError) ? 'PASS' : 'FAIL',
    actualResult: bypassed ? `SQL Injection bypass login! → ${url}`
      : dbError ? 'DB error เปิดเผยโครงสร้าง DB'
      : 'SQL Injection ถูกบล็อก ยังอยู่หน้า Login',
    remark: (!bypassed && !dbError) ? 'ระบบป้องกัน SQL Injection ได้ถูกต้อง'
      : 'CRITICAL Security Issue',
    screenshots: shots,
  });
  console.log(`TC-AUTH-018: ${RESULTS.at(-1)!.status}`);
});

// ─── TC-AUTH-019 : Brute-force / Rate Limit ───────────────────────────────────
test('TC-AUTH-019 – Brute-force / Rate Limit', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await goLogin(page);
  let rateLimited = false;
  let attempts = 0;

  for (let i = 0; i < 5 && !rateLimited; i++) {
    await page.locator(SEL.username).fill(OPERATOR.email);
    await page.locator(SEL.password).fill(`WrongPass${i}`);
    await page.locator(SEL.signIn).click();
    await page.waitForTimeout(2000);
    attempts++;
    const body = await getBodyText(page);
    rateLimited = /rate|too many|throttle|ล็อก|กรุณารอ|captcha/i.test(body);
  }

  const shots = [await ss(page, 'AUTH-019_01_brute-result')];
  RESULTS.push({
    id: 'TC-AUTH-019', scenario: 'Brute-force / Rate Limit',
    status: rateLimited ? 'PASS' : 'FAIL',
    actualResult: rateLimited
      ? `Rate Limit ตรวจจับได้หลัง ${attempts} ครั้ง`
      : `ไม่พบ Rate Limit หลังพยายาม ${attempts} ครั้ง`,
    remark: rateLimited ? 'ระบบมี brute-force protection'
      : 'BUG: ไม่มี Rate Limiting / Brute-force Protection – Security Risk',
    screenshots: shots,
  });
  console.log(`TC-AUTH-019: ${RESULTS.at(-1)!.status}`);
});

// ─── Save JSON ─────────────────────────────────────────────────────────────────
test.afterAll(async () => {
  writeResultsJson('test-results-login-final.json', RESULTS);
  console.log('\n════ SUMMARY ════');
  for (const r of RESULTS)
    console.log(`${r.id}: ${r.status} – ${r.scenario}`);
});
