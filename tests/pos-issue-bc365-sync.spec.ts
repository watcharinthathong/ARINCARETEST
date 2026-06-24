/**
 * Bug Investigation: BC365 Customer sync ขาด Mobile Phone No., Email, Contact Name
 *
 * Issue: เมื่อสมัครสมาชิกใหม่และข้อมูลถูก sync ไปยัง BC365
 * พบว่า fields เหล่านี้ไม่มีใน BC365 record:
 *   - Mobile Phone No.
 *   - Email
 *   - Contact Name
 *
 * Approach (ไม่มี direct BC365 URL ใน config):
 *   1. Intercept POST/PUT requests ที่ POS ส่งไป backend เมื่อ save member
 *   2. ตรวจสอบว่า payload มี mobile_number, email, first_name/last_name ครบ
 *   3. Screenshot + request log สำหรับ manual verification ฝั่ง BC365
 *
 * หาก BC365 URL พร้อมใช้งาน: เพิ่ม BC365_URL ใน .env แล้ว uncomment ส่วน
 * BC365-SYNC-003 เพื่อ navigate ไปตรวจสอบ customer record โดยตรง
 *
 * Test IDs: BC365-SYNC-001..003
 */

import { test, expect } from './pos-fixtures.js';
import { shot } from '../utils/helpers.js';
import { uniquePosMobile, posMinimalMember } from '../data/pos-member.testdata.js';

type CapturedRequest = {
  method: string;
  url: string;
  body: unknown;
  rawBody: string;
};

function captureNonGetRequests(page: import('@playwright/test').Page): CapturedRequest[] {
  const captured: CapturedRequest[] = [];
  page.on('request', req => {
    if (req.method() === 'GET') return;
    const raw = req.postData() ?? '';
    let parsed: unknown = raw;
    try { parsed = JSON.parse(raw); } catch { /* form-encoded or empty */ }
    captured.push({ method: req.method(), url: req.url(), body: parsed, rawBody: raw });
  });
  return captured;
}

test.describe('BC365 Bug: Customer sync ขาด Mobile / Email / Contact Name', () => {
  test.beforeEach(async ({ posLoggedIn }) => {
    void posLoggedIn;
  });

  // ══════════════════════════════════════════════════════════════════
  // BC365-SYNC-001
  // ตรวจสอบ API request มี mobile_number หรือไม่
  // FAIL = POS ไม่ส่ง mobile → bug อยู่ที่ POS frontend
  // PASS = POS ส่ง mobile → bug อยู่ที่ server-side sync (BC365 adapter)
  // ══════════════════════════════════════════════════════════════════
  test('[BC365-SYNC-001] สมัครสมาชิก → API request ต้องมี mobile_number ใน payload', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('086');
    const requests = captureNonGetRequests(page);

    await posRegister.openRegisterForm();
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile });
    await shot(page, 'BC365-SYNC-001_01_filled');
    await posRegister.save();
    await posRegister.expectSaveSuccess();
    await shot(page, 'BC365-SYNC-001_02_saved');

    // รอ async requests ที่อาจ trigger หลัง save เล็กน้อย
    await page.waitForTimeout(2_000);

    const allBodies = requests.map(r => r.rawBody).join('\n');
    const mobileRelated = requests.filter(
      r => r.rawBody.includes(mobile) || r.rawBody.includes('mobile_number') || r.rawBody.includes('phone')
    );

    console.log('[BC365-SYNC-001] Non-GET requests count:', requests.length);
    console.log('[BC365-SYNC-001] mobile-related requests:', JSON.stringify(mobileRelated, null, 2));

    expect.soft(
      allBodies.includes(mobile),
      `API request ต้องมีเบอร์มือถือ "${mobile}" ใน body`
    ).toBeTruthy();

    expect.soft(
      allBodies.includes('mobile_number') || allBodies.includes('phone') || allBodies.includes('mobile'),
      'API request ต้องมี field mobile_number / phone / mobile'
    ).toBeTruthy();
  });

  // ══════════════════════════════════════════════════════════════════
  // BC365-SYNC-002
  // ตรวจสอบ API request มี email หรือไม่
  // ══════════════════════════════════════════════════════════════════
  test('[BC365-SYNC-002] สมัครสมาชิกพร้อม email → API request ต้องมี email ใน payload', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('087');
    const testEmail = `bc365.test.${Date.now()}@example.com`;
    const requests = captureNonGetRequests(page);

    await posRegister.openRegisterForm();
    await posRegister.fillGeneralInfo({ ...posMinimalMember, mobile, email: testEmail });
    await shot(page, 'BC365-SYNC-002_01_filled');
    await posRegister.save();
    await posRegister.expectSaveSuccess();
    await shot(page, 'BC365-SYNC-002_02_saved');

    await page.waitForTimeout(2_000);

    const allBodies = requests.map(r => r.rawBody).join('\n');
    const emailRelated = requests.filter(
      r => r.rawBody.includes(testEmail) || r.rawBody.includes('"email"')
    );

    console.log('[BC365-SYNC-002] email-related requests:', JSON.stringify(emailRelated, null, 2));

    expect.soft(
      allBodies.includes(testEmail),
      `API request ต้องมี email "${testEmail}" ใน body`
    ).toBeTruthy();

    expect.soft(
      allBodies.includes('"email"') || allBodies.includes('email='),
      'API request ต้องมี field email'
    ).toBeTruthy();
  });

  // ══════════════════════════════════════════════════════════════════
  // BC365-SYNC-003
  // Full info (ชื่อ/เบอร์/email) → ตรวจสอบ API payload ครบทุก field
  // + Screenshot สำหรับ manual BC365 verification
  // ══════════════════════════════════════════════════════════════════
  test('[BC365-SYNC-003] สมัครสมาชิกครบ (ชื่อ/เบอร์/email) → API payload ต้องมีครบทุก field', async ({ page, posRegister }) => {
    const mobile = uniquePosMobile('088');
    const email   = `bc365.full.${Date.now()}@example.com`;
    const firstName = 'ทดสอบ';
    const lastName  = 'BC365';
    const requests = captureNonGetRequests(page);

    await posRegister.openRegisterForm();
    await posRegister.fillGeneralInfo({
      firstName,
      lastName,
      mobile,
      email,
      birthDate: '01/01/1992',
      gender: 'ชาย',
    });
    await shot(page, 'BC365-SYNC-003_01_filled-all-fields');
    await posRegister.save();
    await posRegister.expectSaveSuccess();
    await shot(page, 'BC365-SYNC-003_02_saved-success');

    await page.waitForTimeout(2_000);

    const allBodies = requests.map(r => r.rawBody).join('\n');

    // แสดง requests ทั้งหมดหลัง save สำหรับ debug
    const postSaveRequests = requests.slice(-15);
    console.log('[BC365-SYNC-003] All non-GET requests (last 15):', JSON.stringify(postSaveRequests, null, 2));

    // Assertions — แต่ละ field ที่ต้องส่งไป BC365
    const checks: { field: string; present: boolean }[] = [
      { field: 'mobile_number / phone',    present: allBodies.includes(mobile) },
      { field: 'email',                    present: allBodies.includes(email) },
      { field: `first_name (${firstName})`, present: allBodies.includes(firstName) },
      { field: `last_name (${lastName})`,  present: allBodies.includes(lastName) },
    ];

    for (const { field, present } of checks) {
      expect.soft(present, `API request ต้องมี ${field}`).toBeTruthy();
    }

    // Log summary
    console.log('[BC365-SYNC-003] Field check summary:',
      checks.map(c => `${c.field}: ${c.present ? '✓' : '✗ MISSING'}`).join(', ')
    );
  });
});
