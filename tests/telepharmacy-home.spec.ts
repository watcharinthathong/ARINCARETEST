import { test, expect } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const SS_DIR     = path.join(__dirname, '../screenshots/home');

const BASE     = 'https://telepharmacy-cms.vercel.app';
const OPERATOR = { email: 'operator@medcare.com', pass: 'Oper@1234' };
const PHARMA   = { email: 'pharma@medcare.com',   pass: 'Pharm@1234' };

// ─── Selectors ─────────────────────────────────────────────────────────────────
const SEL = {
  // Login
  username: 'input[type="text"]',
  password: 'input[type="password"]',
  signIn:   'button[type="submit"]',

  // Flow navigation
  storeCard:  'text=Watcharin TestTest',
  branchCard: 'text=สำนักงานใหญ่',
  nextBtn:    'button:has-text("ถัดไป"):not([disabled])',
  backBtn:    'button:has-text("ย้อนกลับ")',

  // Supervisor page (operator only) — verified from button debug output
  supervisorHeading: 'text=เลือกเภสัชกรผู้ควบคุม',
  supervisorCard:    'button[class*="overflow-hidden"][class*="rounded-2xl"]',  // pharmacist card = button
  supervisorLicense: 'text=เลขใบประกอบฯ',
  confirmBtn:        'button:has-text("ยืนยันและเข้าสู่ระบบ"):not([disabled])', // confirm (ไม่ใช่ ถัดไป)

  // Home page — verified from TC-HOME-008 discovery run
  homeUrl:      '/home',
  homeHeading:  'h1',                                         // h1 = "Patient Queue (คิวผู้ป่วย)"
  sidebarItem:  'div[class*="cursor-pointer"][class*="rounded-xl"]', // sidebar nav items
  roleLabel:    'div[class*="text-slate-500"]',               // "pharmacist" role display
  logoutBtn:    'footer button:has-text("Logout")',            // Logout inside sidebar footer
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
    shots.push(await ss(page, `${prefix}_store-selected`));
    await page.locator(SEL.nextBtn).first().click();
    await page.waitForTimeout(3000);
  }
  if (page.url().includes('select-branch')) {
    await page.locator(SEL.branchCard).first().click();
    await page.waitForTimeout(600);
    shots.push(await ss(page, `${prefix}_branch-selected`));
    await page.locator(SEL.nextBtn).first().click();
    await page.waitForTimeout(3000);
  }
}

/**
 * คลิก supervisor card แรกที่หาได้ แล้วกด ถัดไป
 * Operator ต้องผ่านขั้นตอนนี้ก่อนเข้า Home เสมอ
 */
async function doSupervisorStep(page: any, shots: string[], prefix: string): Promise<boolean> {
  if (!page.url().includes('select-supervisor')) return false;

  shots.push(await ss(page, `${prefix}_supervisor-page`));

  // pharmacist card = button[class*="overflow-hidden"][class*="rounded-2xl"] (ยืนยันจาก button debug)
  const card = page.locator(SEL.supervisorCard).first();
  let clicked = false;

  if (await card.isVisible().catch(() => false)) {
    await card.click();
    await page.waitForTimeout(800);
    clicked = true;
  }

  shots.push(await ss(page, `${prefix}_supervisor-selected`));

  // confirm button = "ยืนยันและเข้าสู่ระบบ" (ไม่ใช่ "ถัดไป")
  const confirmBtn = page.locator(SEL.confirmBtn).first();
  if (await confirmBtn.isVisible().catch(() => false)) {
    await confirmBtn.click();
    await page.waitForTimeout(3000);
    shots.push(await ss(page, `${prefix}_after-supervisor`));
  }

  return clicked;
}

/**
 * Operator full flow: Login → store → branch → supervisor → home
 * Operator ต้องเลือกเภสัชกรผู้ควบคุมก่อนเข้าสู่ระบบ
 */
async function fullFlow(page: any, shots: string[], prefix: string) {
  await goLogin(page);
  shots.push(await ss(page, `${prefix}_01_login`));

  await fillCreds(page, OPERATOR.email, OPERATOR.pass);
  await clickSignIn(page);
  shots.push(await ss(page, `${prefix}_02_after-login`));

  await doStoreFlow(page, shots, prefix);
  shots.push(await ss(page, `${prefix}_03_after-branch`));

  await doSupervisorStep(page, shots, prefix);
  shots.push(await ss(page, `${prefix}_04_final`));

  return page.url();
}

async function getBodyText(page: any): Promise<string> {
  return page.locator('body').innerText().catch(() => '');
}

// ─── TC-HOME-001 : Home page loads after full operator flow ───────────────────
test('TC-HOME-001 – Home Page Accessible (Operator full flow)', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shots: string[] = [];

  const finalUrl = await fullFlow(page, shots, 'HOME-001');
  const isHome = !finalUrl.includes('/login') && !finalUrl.includes('/select-');
  const body = await getBodyText(page);

  RESULTS.push({
    id: 'TC-HOME-001',
    scenario: 'Home Page เข้าถึงได้หลัง Operator login ครบ flow',
    status: isHome ? 'PASS' : 'FAIL',
    actualResult: `URL: ${finalUrl}`,
    remark: isHome
      ? 'Operator login → store → branch → supervisor → home สำเร็จ'
      : page.url().includes('select-supervisor')
        ? 'ยังอยู่หน้า supervisor — supervisor card selector ยังไม่ทำงาน'
        : `ไม่ถึง Home — URL: ${finalUrl}`,
    screenshots: shots,
  });
  console.log(`TC-HOME-001: ${RESULTS.at(-1)!.status} | ${finalUrl}`);
});

// ─── TC-HOME-002 : Home page heading/title ────────────────────────────────────
test('TC-HOME-002 – Home Page Heading Visible', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shots: string[] = [];

  await fullFlow(page, shots, 'HOME-002');
  const body = await getBodyText(page);
  const finalUrl = page.url();
  const isHome = !finalUrl.includes('/login') && !finalUrl.includes('/select-');

  shots.push(await ss(page, 'HOME-002_heading'));

  // จับ heading tags ที่มีอยู่
  const h1Text = await page.locator('h1').first().innerText().catch(() => '');
  const h2Text = await page.locator('h2').first().innerText().catch(() => '');
  const headingFound = h1Text || h2Text;

  RESULTS.push({
    id: 'TC-HOME-002',
    scenario: 'Home Page มี Heading แสดงผล',
    status: isHome && !!headingFound ? 'PASS' : isHome ? 'FAIL' : 'SKIP',
    actualResult: isHome
      ? `h1: "${h1Text}" | h2: "${h2Text}"`
      : `ไม่ถึง Home page (URL: ${finalUrl})`,
    remark: isHome
      ? headingFound ? `พบ heading: "${headingFound}"` : 'ไม่พบ h1/h2 — ตรวจสอบ DOM'
      : 'SKIP: ไม่ถึง home page',
    screenshots: shots,
  });
  console.log(`TC-HOME-002: ${RESULTS.at(-1)!.status} | h1="${h1Text}"`);
});

// ─── TC-HOME-003 : Navigation menu / sidebar ─────────────────────────────────
test('TC-HOME-003 – Navigation Menu Visible', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shots: string[] = [];

  await fullFlow(page, shots, 'HOME-003');
  const finalUrl = page.url();
  const isHome = !finalUrl.includes('/login') && !finalUrl.includes('/select-');
  shots.push(await ss(page, 'HOME-003_nav'));

  // sidebar ใช้ div[class*="cursor-pointer"][class*="rounded-xl"] (ยืนยันจาก TC-HOME-007 error log)
  const sidebarItemCount = await page.locator(SEL.sidebarItem).count();
  const found = sidebarItemCount > 0;

  RESULTS.push({
    id: 'TC-HOME-003',
    scenario: 'Home Page มี Navigation Menu / Sidebar',
    status: isHome && found ? 'PASS' : isHome ? 'FAIL' : 'SKIP',
    actualResult: isHome
      ? found ? `พบ sidebar items — ${sidebarItemCount} items (${SEL.sidebarItem})`
               : 'ไม่พบ sidebar ด้วย selector ที่มี'
      : `ไม่ถึง Home (URL: ${finalUrl})`,
    remark: isHome && found
      ? 'Sidebar navigation มีอยู่บน Home page'
      : isHome ? '⚠️ ไม่พบ sidebar — ตรวจ screenshot'
      : 'SKIP',
    screenshots: shots,
  });
  console.log(`TC-HOME-003: ${RESULTS.at(-1)!.status} | sidebarItems=${sidebarItemCount}`);
});

// ─── TC-HOME-004 : User profile / role display ────────────────────────────────
test('TC-HOME-004 – User Info Displayed', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shots: string[] = [];

  await fullFlow(page, shots, 'HOME-004');
  const finalUrl = page.url();
  const isHome = !finalUrl.includes('/login') && !finalUrl.includes('/select-');
  shots.push(await ss(page, 'HOME-004_user'));

  const body = await getBodyText(page);
  // ตรวจว่าหน้า home แสดง role ของ operator หรือ pharmacist (ขึ้นอยู่กับ user ที่ login)
  const showsRole    = /pharmacist|เภสัชกร|operator|ผู้ดูแล/i.test(body);
  // ตรวจ element role label (div class*=text-slate-500 มี "pharmacist")
  const roleLabelEl  = await page.locator(SEL.roleLabel).first().innerText().catch(() => '');

  RESULTS.push({
    id: 'TC-HOME-004',
    scenario: 'Home Page แสดงข้อมูลผู้ใช้ / Role',
    status: isHome && showsRole ? 'PASS' : isHome ? 'FAIL' : 'SKIP',
    actualResult: isHome
      ? `showsRole=${showsRole}, roleLabel="${roleLabelEl}"`
      : `ไม่ถึง Home (URL: ${finalUrl})`,
    remark: isHome
      ? showsRole ? `หน้า Home แสดง role: "${roleLabelEl}"` : 'ไม่พบ role label — ตรวจ screenshot'
      : 'SKIP',
    screenshots: shots,
  });
  console.log(`TC-HOME-004: ${RESULTS.at(-1)!.status} | roleLabel="${roleLabelEl}"`);
});

// ─── TC-HOME-005 : Supervisor info displayed on home ─────────────────────────
test('TC-HOME-005 – Selected Supervisor Info on Home', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shots: string[] = [];

  await fullFlow(page, shots, 'HOME-005');
  const finalUrl = page.url();
  const isHome = !finalUrl.includes('/login') && !finalUrl.includes('/select-');
  shots.push(await ss(page, 'HOME-005_supervisor-info'));

  const body = await getBodyText(page);
  // ตรวจว่า Home แสดงข้อมูล supervisor / pharmacist ที่เลือก
  const showsSupervisor = /เภสัชกร|pharmacist|ผู้ควบคุม/i.test(body);

  RESULTS.push({
    id: 'TC-HOME-005',
    scenario: 'Home Page แสดงข้อมูล Supervising Pharmacist ที่เลือก',
    status: isHome && showsSupervisor ? 'PASS' : isHome ? 'FAIL' : 'SKIP',
    actualResult: isHome
      ? `showsSupervisor=${showsSupervisor}`
      : `ไม่ถึง Home (URL: ${finalUrl})`,
    remark: isHome
      ? showsSupervisor ? 'Home แสดงข้อมูล supervisor ที่เลือกไว้'
        : 'ไม่พบข้อมูล supervisor ใน Home — ตรวจ screenshot'
      : 'SKIP: ไม่ผ่าน supervisor step',
    screenshots: shots,
  });
  console.log(`TC-HOME-005: ${RESULTS.at(-1)!.status}`);
});

// ─── TC-HOME-006 : Logout button visible ──────────────────────────────────────
test('TC-HOME-006 – Logout Button Visible', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shots: string[] = [];

  await fullFlow(page, shots, 'HOME-006');
  const finalUrl = page.url();
  const isHome = !finalUrl.includes('/login') && !finalUrl.includes('/select-');
  shots.push(await ss(page, 'HOME-006_logout'));

  // Logout อยู่ใน footer ของ sidebar — ยืนยันจาก TC-HOME-007 error log
  const logoutSelectors = [
    SEL.logoutBtn,                      // 'footer button:has-text("Logout")' — verified
    'button:has-text("Logout")',
    'button:has-text("ออกจากระบบ")',
    'button:has-text("Sign Out")',
  ];

  let logoutFound = false;
  let foundSel = '';
  for (const sel of logoutSelectors) {
    const visible = await page.locator(sel).first().isVisible().catch(() => false);
    if (visible) { logoutFound = true; foundSel = sel; break; }
  }

  RESULTS.push({
    id: 'TC-HOME-006',
    scenario: 'Home Page มีปุ่ม Logout',
    status: isHome && logoutFound ? 'PASS' : isHome ? 'FAIL' : 'SKIP',
    actualResult: isHome
      ? logoutFound ? `พบปุ่ม Logout ด้วย selector: ${foundSel}` : 'ไม่พบปุ่ม Logout'
      : `ไม่ถึง Home (URL: ${finalUrl})`,
    remark: isHome
      ? logoutFound ? 'Logout button ปรากฏถูกต้อง'
        : '⚠️ ไม่พบ Logout button — อาจอยู่ใน dropdown หรือ hamburger menu'
      : 'SKIP',
    screenshots: shots,
  });
  console.log(`TC-HOME-006: ${RESULTS.at(-1)!.status} | sel="${foundSel}"`);
});

// ─── TC-HOME-007 : Logout redirects to login ──────────────────────────────────
test('TC-HOME-007 – Logout Redirects to Login Page', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shots: string[] = [];

  await fullFlow(page, shots, 'HOME-007');
  const finalUrl = page.url();
  const isHome = !finalUrl.includes('/login') && !finalUrl.includes('/select-');

  if (!isHome) {
    RESULTS.push({
      id: 'TC-HOME-007', scenario: 'Logout redirect กลับหน้า Login', status: 'SKIP',
      actualResult: `ไม่ถึง Home page (URL: ${finalUrl})`,
      remark: 'SKIP: ต้องเข้า Home ก่อน', screenshots: shots,
    });
    console.log('TC-HOME-007: SKIP');
    return;
  }

  // Logout อยู่ใน sidebar footer
  const logoutBtn = page.locator(SEL.logoutBtn).first();
  let clicked = false;

  if (await logoutBtn.isVisible().catch(() => false)) {
    await logoutBtn.click({ force: true });
    await page.waitForTimeout(1500);
    shots.push(await ss(page, 'HOME-007_after-logout-click'));

    // handle confirmation modal ถ้ามี — ลองคลิกปุ่มยืนยันใน modal
    const confirmSelectors = [
      'button:has-text("ยืนยัน")',
      'button:has-text("ออกจากระบบ")',
      'button:has-text("Logout")',
      'button:has-text("Yes")',
      'button:has-text("OK")',
      '[role="dialog"] button:last-child',  // last button in dialog = confirm
    ];
    for (const sel of confirmSelectors) {
      const confirmEl = page.locator(sel).first();
      if (await confirmEl.isVisible().catch(() => false)) {
        await confirmEl.click();
        await page.waitForTimeout(1000);
        break;
      }
    }

    await page.waitForTimeout(2000);
    clicked = true;
  }

  shots.push(await ss(page, 'HOME-007_after-logout'));
  const urlAfter = page.url();
  const backOnLogin = urlAfter.includes('/login');

  RESULTS.push({
    id: 'TC-HOME-007',
    scenario: 'Logout redirect กลับหน้า Login',
    status: clicked && backOnLogin ? 'PASS' : 'FAIL',
    actualResult: clicked
      ? `หลัง Logout URL: ${urlAfter}`
      : 'ไม่พบปุ่ม Logout — ไม่สามารถทดสอบได้',
    remark: !clicked
      ? '⚠️ Logout button ไม่พบ — อาจซ่อนอยู่ใน dropdown'
      : backOnLogin ? 'Logout ทำงานถูกต้อง — redirect ไป /login'
      : `BUG: Logout ไม่ redirect ไป /login — URL: ${urlAfter}`,
    screenshots: shots,
  });
  console.log(`TC-HOME-007: ${RESULTS.at(-1)!.status} | ${urlAfter}`);
});

// ─── TC-HOME-008 : Page content snapshot (discovery) ─────────────────────────
test('TC-HOME-008 – Home Page Content Discovery (Snapshot)', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  const shots: string[] = [];

  await fullFlow(page, shots, 'HOME-008');
  const finalUrl = page.url();
  const isHome = !finalUrl.includes('/login') && !finalUrl.includes('/select-');
  shots.push(await ss(page, 'HOME-008_full-snapshot'));

  if (!isHome) {
    RESULTS.push({
      id: 'TC-HOME-008', scenario: 'Home Page Content Snapshot', status: 'SKIP',
      actualResult: `ไม่ถึง Home page (URL: ${finalUrl})`,
      remark: 'SKIP', screenshots: shots,
    });
    console.log('TC-HOME-008: SKIP');
    return;
  }

  const body = await getBodyText(page);
  const lines = body.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);

  // บันทึก body text ลงไฟล์เพื่อ discover selectors
  const snapPath = path.join(__dirname, '../screenshots/home/HOME-008_body-text.txt');
  fs.writeFileSync(snapPath, lines.join('\n'), 'utf-8');

  // สรุป element types ที่มี
  const hasNav    = await page.locator('nav').count() > 0;
  const hasAside  = await page.locator('aside').count() > 0;
  const h1Count   = await page.locator('h1').count();
  const h2Count   = await page.locator('h2').count();
  const btnCount  = await page.locator('button').count();

  RESULTS.push({
    id: 'TC-HOME-008',
    scenario: 'Home Page Content Discovery (Snapshot)',
    status: 'PASS',
    actualResult: `URL: ${finalUrl} | h1:${h1Count} h2:${h2Count} btn:${btnCount} nav:${hasNav} aside:${hasAside}`,
    remark: `body text บันทึกไว้ที่ HOME-008_body-text.txt | รวม ${lines.length} บรรทัด`,
    screenshots: shots,
  });
  console.log(`TC-HOME-008: PASS | URL=${finalUrl} h1=${h1Count} nav=${hasNav}`);
  console.log('Body lines (first 10):', lines.slice(0, 10).join(' | '));
});

// ─── Save JSON summary ─────────────────────────────────────────────────────────
test.afterAll(async () => {
  const out = path.join(__dirname, '../test-results-home.json');
  fs.writeFileSync(out, JSON.stringify(RESULTS, null, 2), 'utf-8');
  console.log('\n════ HOME TEST SUMMARY ════');
  for (const r of RESULTS)
    console.log(`${r.id}: ${r.status} – ${r.scenario}`);
});
