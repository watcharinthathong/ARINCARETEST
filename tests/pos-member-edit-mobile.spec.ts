/**
 * pos-member-edit-mobile.spec.ts
 *
 * Bug Investigation (POS): การแก้ไขเบอร์มือถือสมาชิกและผลกระทบต่อ Search Index
 *
 * ปัญหาที่พบใน Production (POS):
 *   สร้างสมาชิกด้วยเบอร์ A → แก้ไขเบอร์เป็น B → ค้นหาด้วยเบอร์ A
 *   ผลลัพธ์: ระบบยังค้นหาพบรายการนั้นทั้งที่เบอร์เปลี่ยนเป็น B แล้ว
 *
 * Scenarios:
 *   POS-EDIT-001  Bug หลัก  : A→B → ค้นหา A ต้องไม่พบ
 *   POS-EDIT-002  Baseline  : A→B → ค้นหา B ต้องพบ
 *   POS-EDIT-003  Duplicate : A→B → สร้างสมาชิกใหม่ด้วย A ต้องสำเร็จ
 *   POS-EDIT-004  Index     : หลังสร้างซ้ำ ค้นหา A พบแค่รายการใหม่เท่านั้น
 *   POS-EDIT-005  Multi-hop : A→B→C ค้นหา A/B ต้องไม่พบ / C ต้องพบ
 *   POS-EDIT-006  Restore   : A→B→A กลับมาค้นหา A ต้องพบ
 */

import { test, expect } from './pos-fixtures.js';
import { shot } from '../utils/helpers.js';
import { uniquePosMobile } from '../data/pos-member.testdata.js';

test.describe('POS แก้ไขเบอร์สมาชิก - Bug: Stale Search Index', () => {
  test.beforeEach(async ({ posLoggedIn }) => {
    void posLoggedIn;
  });

  // ══════════════════════════════════════════════════════════════════
  // POS-EDIT-001 ● BUG หลัก
  // สร้าง(A) → แก้ไข(A→B) → ค้นหา(A) ต้องไม่พบ
  // FAIL = bug ยังอยู่
  // ══════════════════════════════════════════════════════════════════
  test('[POS-EDIT-001] สร้าง(A) → แก้ไข(A→B) → ค้นหา(A) ต้องไม่พบ', async ({ page, posRegister }) => {
    const mobileA = uniquePosMobile('086');
    const mobileB = uniquePosMobile('087');

    // 1. สร้างสมาชิกด้วยเบอร์ A
    await posRegister.openRegisterForm();
    await posRegister.fillGeneralInfo({ firstName: 'EditTest', lastName: 'PosA', gender: 'ชาย', mobile: mobileA });
    await posRegister.save();
    await posRegister.expectSaveSuccess();
    await shot(page, 'POS-EDIT-001_01_created-with-A');

    // 2. แก้ไขเบอร์ A → B
    await posRegister.editMemberMobile(mobileA, mobileB);
    await shot(page, 'POS-EDIT-001_02_edited-to-B');

    // 3. ค้นหาด้วยเบอร์เก่า A — ต้องไม่พบ
    await posRegister.searchMember(mobileA);
    await shot(page, 'POS-EDIT-001_03_search-old-A');
    await posRegister.expectMemberNotFound();
  });

  // ══════════════════════════════════════════════════════════════════
  // POS-EDIT-002 ● Baseline
  // สร้าง(A) → แก้ไข(A→B) → ค้นหา(B) ต้องพบ
  // ══════════════════════════════════════════════════════════════════
  test('[POS-EDIT-002] สร้าง(A) → แก้ไข(A→B) → ค้นหา(B) ต้องพบ', async ({ page, posRegister }) => {
    const mobileA = uniquePosMobile('086');
    const mobileB = uniquePosMobile('087');

    await posRegister.openRegisterForm();
    await posRegister.fillGeneralInfo({ firstName: 'EditTest', lastName: 'PosB', gender: 'ชาย', mobile: mobileA });
    await posRegister.save();
    await posRegister.expectSaveSuccess();

    await posRegister.editMemberMobile(mobileA, mobileB);
    await shot(page, 'POS-EDIT-002_01_edited-to-B');

    // ค้นหา B — ต้องพบ
    await posRegister.searchMember(mobileB);
    await shot(page, 'POS-EDIT-002_02_search-new-B');
    await posRegister.expectMemberFound(mobileB);
  });

  // ══════════════════════════════════════════════════════════════════
  // POS-EDIT-003 ● Duplicate Risk
  // C1(A) → แก้ไข C1(A→B) → สร้าง C2(A) ต้องสำเร็จ
  // (เบอร์ A ถูก "free" แล้ว ระบบต้องยอมรับการสร้างใหม่)
  // ══════════════════════════════════════════════════════════════════
  test('[POS-EDIT-003] C1(A) → แก้ไข C1(A→B) → สร้าง C2(A) ต้องสำเร็จ', async ({ page, posRegister }) => {
    const mobileA = uniquePosMobile('086');
    const mobileB = uniquePosMobile('087');

    // สร้าง C1 ด้วยเบอร์ A
    await posRegister.openRegisterForm();
    await posRegister.fillGeneralInfo({ firstName: 'C1Member', lastName: 'Pos', gender: 'ชาย', mobile: mobileA });
    await posRegister.save();
    await posRegister.expectSaveSuccess();
    await shot(page, 'POS-EDIT-003_01_c1-created');

    // แก้ C1: A → B
    await posRegister.editMemberMobile(mobileA, mobileB);
    await shot(page, 'POS-EDIT-003_02_c1-edited-A-to-B');

    // สร้าง C2 ด้วยเบอร์ A (ซึ่งถูก free แล้ว)
    await posRegister.openRegisterForm();
    await posRegister.fillGeneralInfo({ firstName: 'C2Member', lastName: 'Pos', gender: 'ชาย', mobile: mobileA });
    await posRegister.save();
    await shot(page, 'POS-EDIT-003_03_c2-save-attempt');
    await posRegister.expectSaveSuccess();
    await shot(page, 'POS-EDIT-003_04_c2-created-ok');
  });

  // ══════════════════════════════════════════════════════════════════
  // POS-EDIT-004 ● Search Integrity หลัง duplicate
  // ค้นหา A → พบ C2 เท่านั้น (ไม่ใช่ C1)
  // ค้นหา B → พบ C1
  // ══════════════════════════════════════════════════════════════════
  test('[POS-EDIT-004] หลังสร้าง C2(A): ค้นหา A พบ C2 / ค้นหา B พบ C1', async ({ page, posRegister }) => {
    const mobileA = uniquePosMobile('086');
    const mobileB = uniquePosMobile('087');

    // Setup: C1(A) → edit A→B → C2(A)
    await posRegister.openRegisterForm();
    await posRegister.fillGeneralInfo({ firstName: 'C1Member', lastName: 'Pos', gender: 'ชาย', mobile: mobileA });
    await posRegister.save();
    await posRegister.expectSaveSuccess();

    await posRegister.editMemberMobile(mobileA, mobileB);

    await posRegister.openRegisterForm();
    await posRegister.fillGeneralInfo({ firstName: 'C2Member', lastName: 'Pos', gender: 'ชาย', mobile: mobileA });
    await posRegister.save();
    await posRegister.expectSaveSuccess();

    // ─ Search A: พบ C2Member ไม่ใช่ C1Member ─────────────────────────────────
    await posRegister.searchMember(mobileA);
    await shot(page, 'POS-EDIT-004_01_search-A');
    await posRegister.expectMemberFound(mobileA);
    await expect.soft(page.getByText('C2Member', { exact: false }).first()).toBeVisible({ timeout: 5_000 });
    await expect.soft(page.getByText('C1Member', { exact: false }).first()).not.toBeVisible({ timeout: 3_000 });

    // ─ Search B: พบ C1Member ──────────────────────────────────────────────────
    await posRegister.searchMember(mobileB);
    await shot(page, 'POS-EDIT-004_02_search-B');
    await posRegister.expectMemberFound(mobileB);
    await expect.soft(page.getByText('C1Member', { exact: false }).first()).toBeVisible({ timeout: 5_000 });
  });

  // ══════════════════════════════════════════════════════════════════
  // POS-EDIT-005 ● Multi-hop A→B→C
  // ค้นหา A, B → ต้องไม่พบ (stale indexes)
  // ค้นหา C → ต้องพบ (current)
  // ══════════════════════════════════════════════════════════════════
  test('[POS-EDIT-005] A→B→C: ค้นหา A,B ต้องไม่พบ / ค้นหา C ต้องพบ', async ({ page, posRegister }) => {
    const mobileA = uniquePosMobile('086');
    const mobileB = uniquePosMobile('087');
    const mobileC = uniquePosMobile('088');

    await posRegister.openRegisterForm();
    await posRegister.fillGeneralInfo({ firstName: 'MultiHop', lastName: 'Pos', gender: 'ชาย', mobile: mobileA });
    await posRegister.save();
    await posRegister.expectSaveSuccess();

    await posRegister.editMemberMobile(mobileA, mobileB);
    await posRegister.editMemberMobile(mobileB, mobileC);
    await shot(page, 'POS-EDIT-005_01_after-double-edit');

    // ค้นหา A → ต้องไม่พบ
    await posRegister.searchMember(mobileA);
    await shot(page, 'POS-EDIT-005_02_search-A');
    await posRegister.expectMemberNotFound();

    // ค้นหา B (intermediate) → ต้องไม่พบ
    await posRegister.searchMember(mobileB);
    await shot(page, 'POS-EDIT-005_03_search-B');
    await posRegister.expectMemberNotFound();

    // ค้นหา C (ปัจจุบัน) → ต้องพบ
    await posRegister.searchMember(mobileC);
    await shot(page, 'POS-EDIT-005_04_search-C');
    await posRegister.expectMemberFound(mobileC);
  });

  // ══════════════════════════════════════════════════════════════════
  // POS-EDIT-006 ● Restore: A→B→A
  // ค้นหา A → ต้องพบ (คืนกลับมา)
  // ค้นหา B → ต้องไม่พบ
  // ══════════════════════════════════════════════════════════════════
  test('[POS-EDIT-006] A→B→A (คืนเบอร์เดิม): ค้นหา A ต้องพบ / ค้นหา B ต้องไม่พบ', async ({ page, posRegister }) => {
    const mobileA = uniquePosMobile('086');
    const mobileB = uniquePosMobile('087');

    await posRegister.openRegisterForm();
    await posRegister.fillGeneralInfo({ firstName: 'RestoreTest', lastName: 'Pos', gender: 'ชาย', mobile: mobileA });
    await posRegister.save();
    await posRegister.expectSaveSuccess();

    await posRegister.editMemberMobile(mobileA, mobileB);
    await posRegister.editMemberMobile(mobileB, mobileA);
    await shot(page, 'POS-EDIT-006_01_restored-to-A');

    // ค้นหา A → ต้องพบ
    await posRegister.searchMember(mobileA);
    await shot(page, 'POS-EDIT-006_02_search-A');
    await posRegister.expectMemberFound(mobileA);

    // ค้นหา B → ต้องไม่พบ
    await posRegister.searchMember(mobileB);
    await shot(page, 'POS-EDIT-006_03_search-B');
    await posRegister.expectMemberNotFound();
  });
});
