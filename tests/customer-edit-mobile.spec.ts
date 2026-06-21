/**
 * customer-edit-mobile.spec.ts
 *
 * Bug Investigation: การแก้ไขเบอร์มือถือและผลกระทบต่อ Search Index
 *
 * ปัญหาที่พบใน Production:
 *   สร้างลูกค้าด้วยเบอร์ A → แก้ไขเบอร์เป็น B → ค้นหาด้วยเบอร์ A
 *   ผลลัพธ์: ระบบยังค้นหาพบรายการนั้นทั้งที่เบอร์เปลี่ยนเป็น B แล้ว
 *
 * Scenarios ที่ครอบคลุม:
 *   EDIT-001  Bug หลัก : ค้นหาเบอร์เก่าหลังแก้ไข → ต้องไม่เจอ
 *   EDIT-002  Baseline  : ค้นหาเบอร์ใหม่หลังแก้ไข → ต้องเจอ
 *   EDIT-003  Duplicate : เบอร์ที่ถูก free ออกแล้วสร้างซ้ำได้ → ต้องสำเร็จ
 *   EDIT-004  Index      : หลังสร้างซ้ำ ค้นหาเบอร์ A พบแค่รายการใหม่เท่านั้น
 *   EDIT-005  Multi-hop  : A→B→C ค้นหา A/B ต้องไม่เจอ / C ต้องเจอ
 *   EDIT-006  Restore    : A→B→A กลับมาค้นหา A ต้องเจอ
 */

import { test, expect } from './fixtures.js';
import { shot } from '../utils/helpers.js';
import { uniqueMobile } from '../data/customer.testdata.js';

test.describe('แก้ไขเบอร์มือถือ - Bug: Stale Search & Duplicate Creation', () => {
  test.beforeEach(async ({ loggedIn, customerForm }) => {
    void loggedIn;
    await customerForm.openCustomerList();
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // EDIT-001 ● BUG ที่พบใน Production
  // พฤติกรรมที่ถูกต้อง: หลังแก้ไขเบอร์ A→B แล้ว ค้นหาด้วยเบอร์ A ต้องไม่พบ
  // ถ้า TEST FAIL = bug ยังมีอยู่ใน staging
  // ══════════════════════════════════════════════════════════════════════════════
  test('[EDIT-001] สร้าง(A) → แก้ไข(A→B) → ค้นหา(A) ต้องไม่พบ', async ({ page, customerForm }) => {
    const mobileA = uniqueMobile('086');
    const mobileB = uniqueMobile('087');

    // 1. สร้างลูกค้าด้วยเบอร์ A
    await customerForm.openNewCustomerForm();
    await customerForm.fillGeneral({ mobile: mobileA, firstName: 'EditTest' });
    await customerForm.save();
    await customerForm.expectSaveSuccess();
    await shot(page, 'EDIT-001_01_created-with-A');

    // 2. แก้ไขเบอร์ A → B
    await customerForm.editMobile(mobileA, mobileB);
    await shot(page, 'EDIT-001_02_edited-to-B');

    // 3. ค้นหาด้วยเบอร์เก่า A — ต้องไม่พบรายการใดๆ
    await customerForm.openCustomerList();
    await customerForm.searchCustomer(mobileA);
    await shot(page, 'EDIT-001_03_search-old-A');
    await customerForm.expectCustomerNotInList();
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // EDIT-002 ● Baseline: ค้นหาเบอร์ใหม่ B หลังแก้ไขต้องพบ
  // ══════════════════════════════════════════════════════════════════════════════
  test('[EDIT-002] สร้าง(A) → แก้ไข(A→B) → ค้นหา(B) ต้องพบ', async ({ page, customerForm }) => {
    const mobileA = uniqueMobile('086');
    const mobileB = uniqueMobile('087');

    await customerForm.openNewCustomerForm();
    await customerForm.fillGeneral({ mobile: mobileA, firstName: 'EditTest' });
    await customerForm.save();
    await customerForm.expectSaveSuccess();

    await customerForm.editMobile(mobileA, mobileB);
    await shot(page, 'EDIT-002_01_edited-to-B');

    // ค้นหาด้วยเบอร์ใหม่ B — ต้องพบ
    await customerForm.openCustomerList();
    await customerForm.searchCustomer(mobileB);
    await shot(page, 'EDIT-002_02_search-new-B');
    await customerForm.expectCustomerInList(mobileB);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // EDIT-003 ● Core Concern: เบอร์ที่ถูก "free" ออกแล้วสร้างลูกค้าใหม่ด้วยเบอร์นั้นได้
  // Risk: ระบบอาจยังถือว่าเบอร์ A "ใช้งานอยู่" → reject การสร้าง C2 ผิดพลาด
  // ══════════════════════════════════════════════════════════════════════════════
  test('[EDIT-003] C1(A) → แก้ไข C1(A→B) → สร้าง C2(A) ต้องสำเร็จ', async ({ page, customerForm }) => {
    const mobileA = uniqueMobile('086');
    const mobileB = uniqueMobile('087');

    // 1. สร้าง C1 ด้วยเบอร์ A
    await customerForm.openNewCustomerForm();
    await customerForm.fillGeneral({ mobile: mobileA, firstName: 'C1Customer' });
    await customerForm.save();
    await customerForm.expectSaveSuccess();
    await shot(page, 'EDIT-003_01_c1-created');

    // 2. แก้ C1 เบอร์ A → B (A ถูก free ออก)
    await customerForm.editMobile(mobileA, mobileB);
    await shot(page, 'EDIT-003_02_c1-edited-A-to-B');

    // 3. สร้าง C2 ด้วยเบอร์ A — ต้องสำเร็จ เพราะ A ไม่ได้ใช้งานแล้ว
    await customerForm.openCustomerList();
    await customerForm.openNewCustomerForm();
    await customerForm.fillGeneral({ mobile: mobileA, firstName: 'C2Customer' });
    await customerForm.save();
    await shot(page, 'EDIT-003_03_c2-save-attempt');
    await customerForm.expectSaveSuccess();
    await shot(page, 'EDIT-003_04_c2-created-ok');
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // EDIT-004 ● Search Integrity หลัง EDIT-003:
  //   ค้นหา A → พบ C2 (ใหม่) ไม่ใช่ C1 (ซึ่งตอนนี้มีเบอร์ B)
  //   ค้นหา B → พบ C1
  // ══════════════════════════════════════════════════════════════════════════════
  test('[EDIT-004] หลังสร้าง C2(A): ค้นหา A พบ C2 / ค้นหา B พบ C1', async ({ page, customerForm }) => {
    const mobileA = uniqueMobile('086');
    const mobileB = uniqueMobile('087');

    // Setup: C1(A) → edit A→B → C2(A)
    await customerForm.openNewCustomerForm();
    await customerForm.fillGeneral({ mobile: mobileA, firstName: 'C1Customer' });
    await customerForm.save();
    await customerForm.expectSaveSuccess();

    await customerForm.editMobile(mobileA, mobileB);

    await customerForm.openCustomerList();
    await customerForm.openNewCustomerForm();
    await customerForm.fillGeneral({ mobile: mobileA, firstName: 'C2Customer' });
    await customerForm.save();
    await customerForm.expectSaveSuccess();

    // ── Search A: ต้องพบ C2 (ไม่ใช่ C1) ──────────────────────────────────────
    await customerForm.openCustomerList();
    await customerForm.searchCustomer(mobileA);
    await shot(page, 'EDIT-004_01_search-A');
    await customerForm.expectCustomerInList(mobileA);
    // ตรวจว่า C2Customer อยู่ในผลลัพธ์
    await expect.soft(
      page.getByText('C2Customer', { exact: false }).first()
    ).toBeVisible({ timeout: 5_000 });
    // ตรวจว่า C1Customer ไม่อยู่ในผลลัพธ์
    await expect.soft(
      page.getByText('C1Customer', { exact: false }).first()
    ).not.toBeVisible({ timeout: 3_000 });

    // ── Search B: ต้องพบ C1 ──────────────────────────────────────────────────
    await customerForm.openCustomerList();
    await customerForm.searchCustomer(mobileB);
    await shot(page, 'EDIT-004_02_search-B');
    await customerForm.expectCustomerInList(mobileB);
    await expect.soft(
      page.getByText('C1Customer', { exact: false }).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // EDIT-005 ● Multi-hop: A → B → C
  //   ค้นหา A → ไม่พบ
  //   ค้นหา B → ไม่พบ (intermediate)
  //   ค้นหา C → พบ
  // ══════════════════════════════════════════════════════════════════════════════
  test('[EDIT-005] A→B→C: ค้นหา A, B ต้องไม่พบ / ค้นหา C ต้องพบ', async ({ page, customerForm }) => {
    const mobileA = uniqueMobile('086');
    const mobileB = uniqueMobile('087');
    const mobileC = uniqueMobile('088');

    // สร้างด้วย A
    await customerForm.openNewCustomerForm();
    await customerForm.fillGeneral({ mobile: mobileA, firstName: 'MultiHop' });
    await customerForm.save();
    await customerForm.expectSaveSuccess();

    // แก้ A → B
    await customerForm.editMobile(mobileA, mobileB);

    // แก้ B → C
    await customerForm.editMobile(mobileB, mobileC);
    await shot(page, 'EDIT-005_01_after-double-edit');

    // ค้นหา A → ต้องไม่พบ
    await customerForm.openCustomerList();
    await customerForm.searchCustomer(mobileA);
    await shot(page, 'EDIT-005_02_search-A');
    await customerForm.expectCustomerNotInList();

    // ค้นหา B (intermediate) → ต้องไม่พบ
    await customerForm.openCustomerList();
    await customerForm.searchCustomer(mobileB);
    await shot(page, 'EDIT-005_03_search-B');
    await customerForm.expectCustomerNotInList();

    // ค้นหา C (ปัจจุบัน) → ต้องพบ
    await customerForm.openCustomerList();
    await customerForm.searchCustomer(mobileC);
    await shot(page, 'EDIT-005_04_search-C');
    await customerForm.expectCustomerInList(mobileC);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // EDIT-006 ● Edit กลับเบอร์เดิม: A → B → A
  //   ค้นหา A ต้องพบ (เบอร์ถูกคืนกลับมา)
  //   ค้นหา B ต้องไม่พบ
  // ══════════════════════════════════════════════════════════════════════════════
  test('[EDIT-006] A→B→A (คืนเบอร์เดิม): ค้นหา A ต้องพบ / ค้นหา B ต้องไม่พบ', async ({ page, customerForm }) => {
    const mobileA = uniqueMobile('086');
    const mobileB = uniqueMobile('087');

    // สร้างด้วย A
    await customerForm.openNewCustomerForm();
    await customerForm.fillGeneral({ mobile: mobileA, firstName: 'RestoreTest' });
    await customerForm.save();
    await customerForm.expectSaveSuccess();

    // แก้ A → B
    await customerForm.editMobile(mobileA, mobileB);

    // แก้กลับ B → A
    await customerForm.editMobile(mobileB, mobileA);
    await shot(page, 'EDIT-006_01_restored-to-A');

    // ค้นหา A → ต้องพบ (คืนกลับมาแล้ว)
    await customerForm.openCustomerList();
    await customerForm.searchCustomer(mobileA);
    await shot(page, 'EDIT-006_02_search-A');
    await customerForm.expectCustomerInList(mobileA);

    // ค้นหา B → ต้องไม่พบ
    await customerForm.openCustomerList();
    await customerForm.searchCustomer(mobileB);
    await shot(page, 'EDIT-006_03_search-B');
    await customerForm.expectCustomerNotInList();
  });
});
