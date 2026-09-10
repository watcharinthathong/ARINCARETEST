"""
create-medex-cart-badge-excel.py
สร้าง Excel รวม Test Plan + Test Case สำหรับฟีเจอร์ "Product Card (In-Cart Badge)" บน MedEx Marketplace
เนื้อหา Test Plan มาจาก docs/test-cases/Arincare_MedEx_ProductCardInCartBadge_TestPlan.md
Sheets: Test Plan, Test Cases, สรุป & Coverage
สถานะ: อัปเดตตามผลรัน Playwright automation จริงล่าสุด (2026-09-07) — 34 Pass / 0 Fail / 26 Skip ข้าม 3 device
เคสที่ไม่อยู่ใน AUTOMATION_RESULTS (7.4 Edge Cases, 7.5 Responsive ที่ไม่ใช่ popup) ยังเป็น "Not Run" (manual)
"""

import os
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter
from collections import Counter

BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(BASE, "docs", "test-cases", "Arincare_MedEx_ProductCardInCartBadge_TestPlan_TestCases.xlsx")

# ── Styles (ตาม convention เดิม: docs/test-cases/Arincare_POS_PaymentMethod_TestCases.xlsx) ──
HEADER_FILL = PatternFill("solid", fgColor="1F4E78")
HEADER_FONT = Font(name="Tahoma", bold=True, color="FFFFFF", size=11)
BODY_FONT   = Font(name="Tahoma", size=10)
BOLD_FONT   = Font(name="Tahoma", size=10, bold=True)
NOTRUN_FILL = PatternFill("solid", fgColor="D9D9D9")
NOTRUN_FONT = Font(name="Tahoma", bold=True, color="404040", size=10)
PASS_FILL   = PatternFill("solid", fgColor="C6EFCE")
PASS_FONT   = Font(name="Tahoma", bold=True, color="276221", size=10)
SKIP_FILL   = PatternFill("solid", fgColor="FFEB9C")
SKIP_FONT   = Font(name="Tahoma", bold=True, color="9C6500", size=10)
WRAP_TOP    = Alignment(wrap_text=True, vertical="top")
CENTER      = Alignment(horizontal="center", vertical="center", wrap_text=True)
thin        = Side(style="thin", color="CCCCCC")
BORDER      = Border(left=thin, right=thin, top=thin, bottom=thin)

PRE_LOGIN = ("Login app-stg.arincare.com สำเร็จ (env TEST_USERNAME/TEST_PASSWORD) → เลือกบริษัท → "
             "ไปที่ https://app-stg.arincare.com/companies/marketplace?page=1 ได้เลย (ไม่ต้องเลือกสาขา)")

# ผลรัน Playwright automation จริงล่าสุด (2026-09-07, HEADLESS=false, 3 device: Desktop Chrome /
# Mobile Chrome-Android / Mobile Safari-iPhone) — 34 Pass / 0 Fail / 26 Skip รวม
# tc_id -> (status, note)
AUTOMATION_RESULTS = {
    "TC-BADGE-P01": ("Skip", "ไม่ปลอดภัยบน shared staging (ตะกร้าว่างจริงไม่การันตีได้) — เหลือเป็น manual"),
    "TC-BADGE-P02": ("Pass", "Automated — Desktop only (popover ใช้ hover ซึ่งมีเฉพาะ Desktop)"),
    "TC-BADGE-P03": ("Pass", "Automated — Desktop only"),
    "TC-BADGE-P04": ("Skip", "Manual/exploratory (boundary หนัก ต้องเพิ่ม 10-15+ SKU)"),
    "TC-BADGE-P05": ("Pass", "Automated — Desktop only"),
    "TC-BADGE-P06": ("Pass", "Automated — Desktop only"),
    "TC-BADGE-P07": ("Pass", "Automated รวมกับ P08 เป็นเทสเดียว (Mobile) — ยืนยันแล้วว่ามือถือมี popup เหมือน Desktop ทุกประการ (แก้จากที่เคยสรุปผิดว่าไม่มี popup)"),
    "TC-BADGE-P08": ("Pass", "Automated รวมกับ P07 เป็นเทสเดียว (Mobile)"),
    "TC-BADGE-P09": ("Pass", "Automated — Desktop only"),
    "TC-BADGE-C01": ("Pass", "Automated — Cross-device (Desktop + Mobile Chrome + Mobile Safari)"),
    "TC-BADGE-C02": ("Pass", "Automated — Desktop only (ต้องใช้ inline control บนการ์ด list ซึ่งมือถือไม่มี)"),
    "TC-BADGE-C03": ("Pass", "Automated — Cross-device"),
    "TC-BADGE-C04": ("Pass", "Automated — Cross-device"),
    "TC-BADGE-C05": ("Pass", "Automated — Cross-device"),
    "TC-BADGE-C06": ("Pass*", "Automated — Desktop only, dynamic-skip อัตโนมัติถ้าไม่เจอ SKU หลายหน่วยขายจริงในรายชื่อ candidate ที่เตรียมไว้"),
    "TC-BADGE-C06B": ("Pass*", "Automated — Desktop only, dynamic-skip เช่นเดียวกับ C06 (เป็นเทสเดียวกัน)"),
    "TC-BADGE-C07": ("Skip", "ต้องยืนยัน UI tab/pagination ก่อนเขียน automation ได้"),
    "TC-BADGE-S01": ("Pass", "Automated — Cross-device (ส่วน popover check เฉพาะ Desktop)"),
    "TC-BADGE-S02": ("Pass", "Automated — Cross-device"),
    "TC-BADGE-S03": ("Pass", "Automated — Cross-device"),
    "TC-BADGE-S04": ("Pass", "Automated — Cross-device (multi-context จำลอง 2 tab)"),
    "TC-BADGE-S05": ("Pass", "Automated — Desktop only (rapid-click ใช้ inline control บนการ์ด list)"),
    # หัวข้อ 13 — tests/medex/cart-payment-bank-transfer-e2e.spec.ts (2026-09-09, ยืนยัน Pass จริงบน staging)
    "TC-E2E-CART-003": ("Pass", "Automated — Desktop only (E2E spec: cart-payment-bank-transfer-e2e.spec.ts)"),
    "TC-E2E-PAYMENT-001": ("Pass", "Automated — Desktop only"),
    "TC-E2E-BANK-001": ("Pass", "Automated — Desktop only, ใช้ไฟล์ fixtures/test-image.jpg แนบจริง"),
    "TC-E2E-BANK-002": ("Pass", "Automated — Desktop only, cross-check User+Admin Cart list จริง"),
    "TC-E2E-BANK-003": ("Pass", "Automated — Desktop only, Admin approve จริงผ่าน dropdown+หมายเหตุ"),
    "TC-E2E-BANK-004": ("Pass", "Automated รวมอยู่ในเทสเดียวกับ BANK-003"),
    "TC-E2E-MYPURCHASE-002": ("Pass", "Automated — Desktop only"),
    "TC-E2E-SYNC-001": ("Pass", "Automated รวมอยู่ในเทสเดียวกับ MYPURCHASE-002 (เช็คยอด 210.00 ตรงกันทุกหน้า)"),
    "TC-E2E-SYNC-002": ("Pass", "Automated รวมอยู่ในเทสเดียวกับ MYPURCHASE-002"),
    "TC-E2E-CART-001": ("Pass", "Automated — Desktop only (เทสอิสระ ไม่ผูกกับ Bank Transfer flow)"),
    "TC-E2E-CART-002": ("Pass", "Automated — Desktop only, ⚠️ ปรับให้ตรง UI จริง: เลือกได้แค่ระดับร้านค้า (seller group) ไม่มี checkbox รายสินค้า"),
    "TC-E2E-ADMIN-CART-001": ("Pass", "Automated — Desktop only, เช็ค columns/สถานะ/ลิงก์รายละเอียดทั่วไป (ไม่ผูกกับ transaction เฉพาะเจาะจง)"),
    "TC-E2E-ADMIN-ORDER-001": ("Pass", "Automated — Desktop only, เช็ค columns/สถานะ/ลิงก์รายละเอียดทั่วไป"),
    # tests/medex/cart-promotion-price-calculation.spec.ts (2026-09-09) — โปรโมชั่น/คูปองจริงบน staging
    "TC-CARTPRICE-016": ("Pass", "Automated — ใช้ PROMO-B-009 (ACCU-CHEK ACTIVE ครบ 5 กล่อง) พิสูจน์กลไก Product-level discount"),
    "TC-CARTPRICE-017": ("Pass", "Automated รวมอยู่ในเทสเดียวกับ 016"),
    "TC-CARTPRICE-013": ("Pass", "Automated แบบ reconciliation (ไม่ผูกสูตรตายตัว เพราะพบว่า PROMO-B-001–004 apply พร้อมกันหลายตัว)"),
    "TC-CARTPRICE-014": ("Pass", "Automated รวมอยู่ในเทสเดียวกับ 013"),
    "TC-CARTPRICE-020": ("Pass", "Automated — ใช้คูปอง REGULAR_PRICE_10_PC จริง, idempotent (รองรับกรณีคูปองค้าง apply จากรันก่อนหน้า)"),
    "TC-CARTPRICE-021": ("Pass", "Automated — Promotion + Coupon stacking พร้อมกัน + reconciliation ครบ"),
    # tests/arinlink/po-quotation.spec.ts (2026-09-09)
    "TC-PO-ADMIN-003": ("Pass", "Automated — negative case: กด เพิ่มสินค้า ก่อนเลือก supplier ต้องเจอ alert"),
    "TC-PO-ADMIN-004": ("Pass", "Automated — mutually exclusive store-type toggle"),
    "TC-PO-ADMIN-005": ("Pass", "Automated — ค้นหาลูกค้าด้วย ARC ID auto-fill + readonly check"),
    "TC-PO-ADMIN-001": ("Pass", "Automated — คอลัมน์ราคาหลังลดมีค่าจริงหลัง add product + save"),
    "TC-PO-ADMIN-002": ("Pass", "Automated แบบ reconciliation (sign convention ฝั่ง Admin ต่างจาก User — ส่วนลดแสดงเป็นค่าบวก)"),
    "TC-PO-ADMIN-006": ("Pass", "Automated — ยืนยัน Summary ไม่ recalculate ก่อน Save แล้ว recalculate ถูกต้องหลัง Save"),
    "TC-PO-ADMIN-007": ("Pass", "Automated — เพิ่มสินค้า 2 รอบ + Save ทุกรอบ ยอดเพิ่มขึ้นถูกต้องไม่ตกหล่น"),
    "TC-PO-ADMIN-008": ("Pass", "Automated — กด Export แล้วมี popup/response เกิดขึ้นจริง (ยังไม่ได้ตรวจเนื้อหา PDF ละเอียด)"),
    "TC-CARTPRICE-015": ("Pass", "🔴 Automated — ยืนยัน 'สภาพปัจจุบัน' ว่าสินค้าแถมไม่ trigger เลยแม้เข้าเงื่อนไข (พบเป็นบั๊ก/ยังไม่ implement ไม่ใช่ automation ผิด) ต้องแจ้ง Dev ตรวจสอบ"),
    "TC-PO-ADMIN-009": ("Pass", "Automated — cross-check ยอดสุทธิ+ลูกค้าที่ save แล้วตรงกับหน้า PO List จริง"),
    "TC-CARTPRICE-018": ("Pass", "🔴 Automated — ยืนยัน 'สภาพปัจจุบัน' เหมือน 015 (PROMO-B-012 แถม CARDURA ไม่ trigger เลยแม้ซื้อครบ 12 กล่อง)"),
    "TC-CARTPRICE-019": ("Pass", "🔴 Automated — ยืนยัน 'สภาพปัจจุบัน' PROMO-B-013 (Product Combination) ครบทุกเงื่อนไข (mandatory+จำนวน+ยอด) แล้วก็ยังไม่แถม PCO00099"),
}

# (tc_id, tab, priority, type, precondition, test_data, steps, expected)
CASES = [
    # 7.1 Cart Summary Popup
    ("TC-BADGE-P01", "MedEx - Cart Popup", "High", "Functional",
     PRE_LOGIN + " ตะกร้าว่างเปล่า (ยังไม่เคยเพิ่มสินค้า)", "-",
     "1. กดไอคอน \"ตะกร้าสินค้าของฉัน\" มุมขวาบน",
     "แสดง popup ในสถานะ empty state ที่เหมาะสม (ข้อความแจ้งว่ายังไม่มีสินค้า) ไม่ error ไม่ค้าง ไม่แสดงเลขคำสั่งซื้อ/ยอดรวมของเก่า"),

    ("TC-BADGE-P02", "MedEx - Cart Popup", "Critical", "Functional",
     PRE_LOGIN + " เพิ่งเพิ่ม \"PROSCAR 5 MG TABLETS 30'S\" หน่วย \"กล่อง\" จำนวน 1 กล่อง ลงตะกร้า",
     "PROSCAR 5 MG TABLETS 30'S, หน่วย กล่อง, จำนวน 1, ราคา 1,580.00 บาท",
     "1. Hover เมาส์ไปที่ปุ่ม \"ตะกร้าสินค้าของฉัน\" (ห้ามคลิก — คลิกจะ navigate ไปหน้าตะกร้าเต็มทันที ไม่เปิด popup)\n2. ตรวจสอบเนื้อหาใน popup ทั้งหมด",
     "Popup แสดง: จำนวนรายการ = 1 รายการ, ชื่อสินค้า PROSCAR 5 MG TABLETS 30'S, จำนวน 1 กล่อง, ราคาต่อหน่วย 1,580.00, "
     "ยอดรวม 1,580.00, ยอดรวมทั้งสิ้น 1,580.00, ปุ่ม \"ดูตะกร้าสินค้า\" — เลขคำสั่งซื้อที่แสดงเป็นค่า placeholder เท่านั้น "
     "(ยืนยันแล้วว่าไม่ผูก backend จริง — ดู Test Plan หัวข้อ 2 ข้อ 1) ตรวจแค่ว่ามีแสดงและไม่เปลี่ยนกลางคันขณะเปิด popup ค้างไว้"),

    ("TC-BADGE-P03", "MedEx - Cart Popup", "High", "Functional",
     PRE_LOGIN + " เพิ่มสินค้า 3 รายการต่างกันลงตะกร้า (เช่น ACCIN-BP 5G., BILAXTEN KIDS 10 MG TABLETS 10'S, SUCEE TABLETS 28'S)",
     "3 SKU ต่างกัน จำนวน/หน่วยต่างกัน", "1. Hover เมาส์ไปที่ปุ่มตะกร้า\n2. ตรวจสอบว่าครบทั้ง 3 รายการ\n3. ตรวจยอดรวมด้วยการคำนวณเอง (ราคา x จำนวน แต่ละรายการ)",
     "แสดงครบทั้ง 3 รายการ ไม่มีรายการตกหล่น/ซ้ำ ยอดรวมทั้งสิ้น = ผลรวมของทุกรายการถูกต้อง"),

    ("TC-BADGE-P04", "MedEx - Cart Popup", "Medium", "Boundary",
     PRE_LOGIN + " เพิ่มสินค้าอย่างน้อย 10-15 รายการที่ต่างกันลงตะกร้า (จนล้นพื้นที่ popup ปกติ)",
     "สินค้า 10-15 SKU", "1. Hover เมาส์ไปที่ปุ่มตะกร้า\n2. สังเกตพื้นที่แสดงรายการ\n3. ลอง scroll ภายใน popup",
     "รายการสินค้าเลื่อนดูได้ด้วย scrollbar ภายใน popup โดยที่ปุ่ม \"ดูตะกร้าสินค้า\" และแถบยอดรวมยังคงอยู่ที่เดิม (ไม่เลื่อนหายไปกับ scroll)"),

    ("TC-BADGE-P05", "MedEx - Cart Popup", "Critical", "Functional",
     PRE_LOGIN + " มีสินค้าในตะกร้าอย่างน้อย 1 รายการ และเปิด popup อยู่", "-",
     "1. กดปุ่ม \"ดูตะกร้าสินค้า\" ใน popup",
     "นำทางไปหน้าตะกร้าสินค้าเต็ม (cart page) สำเร็จ และรายการ/จำนวน/ยอดรวมที่แสดงในหน้าตะกร้าตรงกับที่เห็นใน popup ก่อนหน้า"),

    ("TC-BADGE-P06", "MedEx - Cart Popup", "Medium", "Functional",
     PRE_LOGIN + " Hover ค้างที่ปุ่มตะกร้าจน popup เปิดอยู่ (Desktop)", "-",
     "1. เอาเมาส์ออกจากปุ่มตะกร้า/popup ไปยังจุดอื่นบนหน้าจอ",
     "Popup ปิดลง ไม่มีการเปลี่ยนแปลงใดๆ ต่อสถานะสินค้าในตะกร้า (จำนวน/รายการเดิมยังอยู่ครบเมื่อ hover เปิด popup ใหม่อีกครั้ง)"),

    ("TC-BADGE-P07", "MedEx - Cart Popup (Mobile)", "High", "Functional",
     PRE_LOGIN + " (ทดสอบผ่านมือถือจริงหรือ emulator: Pixel 7 / iPhone 13) มีสินค้าในตะกร้าอย่างน้อย 1 รายการ", "-",
     "1. แตะไอคอน \"ตะกร้าสินค้าของฉัน\" 1 ครั้งแรก",
     "✅ ยืนยันจริงบน staging 2026-09-07: Popup แสดง — component เดียวกับที่ Desktop โชว์ตอน hover เป๊ะ (ไม่ใช่ bottom sheet แยกต่างหาก) ยังไม่ navigate ไปหน้าตะกร้า (แก้จากที่เคยสรุปผิดระหว่างทางว่า \"มือถือไม่มี popup\")"),

    ("TC-BADGE-P08", "MedEx - Cart Popup (Mobile)", "High", "Functional",
     PRE_LOGIN + " Popup เปิดอยู่แล้ว (ต่อจาก TC-BADGE-P07)", "-",
     "1. แตะปุ่ม \"ตะกร้าสินค้าของฉัน\" เดิมซ้ำอีกครั้ง",
     "✅ ยืนยันจริงบน staging 2026-09-07: นำไปหน้าตะกร้าเต็มสำเร็จ — automated รวมกับ P07 เป็นเทสเดียว (`TC-BADGE-P07/P08-MOBILE`) ยังไม่ได้ทดสอบ 2 รูปแบบเวลา (แตะรัว vs เว้นช่วง) แยกกันในเทสอัตโนมัติ ถือเป็นส่วนที่เหลือให้ทำเพิ่มถ้าต้องการความละเอียดสูงขึ้น"),

    ("TC-BADGE-P09", "MedEx - Cart Popup", "High", "Functional",
     PRE_LOGIN + " มีสินค้า 1 รายการในตะกร้า", "เพิ่มสินค้าอีก 1 รายการใหม่ระหว่างทดสอบ",
     "1. เปิด popup ตรวจสอบว่ามี 1 รายการ\n2. ปิด popup\n3. กลับไปหน้ารายการสินค้า เพิ่มสินค้าใหม่อีก 1 รายการ\n4. เปิด popup อีกครั้ง",
     "Popup แสดงข้อมูลล่าสุด (2 รายการ) ไม่ค้างค่าเก่า (cache) จากครั้งก่อน"),

    # 7.2 In-Cart Badge บน Product Card
    ("TC-BADGE-C01", "MedEx - Product Card", "Critical", "Functional",
     PRE_LOGIN + " สินค้ายังไม่เคยอยู่ในตะกร้า", "สินค้าใดๆ ในหน้ารายการสินค้า เช่น TANSY ONE 1.5 MG TABLETS 1'S",
     "1. กด \"เพิ่มสินค้าลงตะกร้า\" บน card สินค้า\n2. สังเกต card สินค้าเดิมทันทีโดยไม่ refresh หน้า",
     "Badge สีเขียว \"อยู่ในตะกร้าแล้ว · 1 [หน่วย]\" ปรากฏบน card ทันทีโดยไม่ต้อง refresh"),

    ("TC-BADGE-C02", "MedEx - Product Card", "High", "Functional",
     PRE_LOGIN + " สินค้าอยู่ในตะกร้าแล้ว 1 หน่วย (จาก TC-BADGE-C01) — ⚠️ ยืนยันจริงบน staging 2026-09-07: "
     "\"เพิ่มลงตะกร้า\" คือการตั้งค่าจำนวนให้เท่ากับที่เลือกบนการ์ด ไม่ใช่บวกสะสม (พฤติกรรมเดียวกับกฎเปลี่ยนหน่วยขายในหัวข้อ 2 ข้อ 2)",
     "-",
     "1. ตั้งจำนวนบน card สินค้าเดิมเป็น 2 แล้วกด \"เพิ่มสินค้าลงตะกร้า\" อีกครั้ง\n2. สังเกต badge",
     "ตัวเลขใน badge ต้อง**แทนที่**เป็น \"อยู่ในตะกร้าแล้ว · 2 [หน่วย]\" ไม่ใช่ \"3\" (1 เดิม + 2 ใหม่) — ถ้าระบบบวกสะสมแทนที่จะแทนที่ ถือว่าขัดกับพฤติกรรมจริงที่ยืนยันแล้ว ต้องรายงานเป็นบั๊ก/ความไม่สอดคล้อง"),

    ("TC-BADGE-C03", "MedEx - Product Card", "Critical", "Functional",
     PRE_LOGIN + " สินค้าอยู่ในตะกร้าแล้ว (มี badge แสดงอยู่)", "-",
     "1. เปิด popup หรือหน้าตะกร้าเต็ม\n2. ลดจำนวนสินค้านั้นจนเหลือ 0 หรือกดลบออกจากตะกร้า\n3. กลับมาหน้ารายการสินค้า สังเกต card เดิม",
     "Badge หายไปจาก card ทันที (กลับสู่สถานะปกติที่ไม่มี badge)"),

    ("TC-BADGE-C04", "MedEx - Product Card", "High", "Functional",
     PRE_LOGIN + " สินค้าอยู่ในตะกร้าแล้ว 1 รายการ (badge แสดงอยู่)", "-",
     "1. กด Refresh หน้าเว็บ (F5)\n2. รอโหลดหน้าเสร็จ สังเกต card สินค้าเดิม",
     "Badge ยังคงแสดงถูกต้องตามสถานะตะกร้าจริงหลัง refresh (ไม่ใช่ local state ชั่วคราวที่หายไปเมื่อ reload)"),

    ("TC-BADGE-C05", "MedEx - Product Card", "Medium", "Negative",
     PRE_LOGIN + " สินค้าบางรายการไม่เคยถูกเพิ่มลงตะกร้าเลย", "-",
     "1. เลื่อนดูหน้ารายการสินค้า\n2. ตรวจสอบ card ของสินค้าที่ไม่เคยเพิ่ม",
     "ไม่มี badge \"อยู่ในตะกร้าแล้ว\" แสดงบน card ของสินค้าที่ไม่เคยเพิ่มลงตะกร้า (regression check ป้องกัน badge ขึ้นผิดใบ)"),

    ("TC-BADGE-C06", "MedEx - Product Card", "Critical", "Functional",
     PRE_LOGIN + " เลือกสินค้าที่มีมากกว่า 1 หน่วยขาย (เช่น กล่อง/แผง) เพิ่มด้วยหน่วยแรกจำนวน 1 ก่อน",
     "รายชื่อสินค้าผู้ใช้เตรียมไว้ให้ (ยังไม่ยืนยันว่าตัวไหนมีหลายหน่วยขายจริง — QA เช็คหน้าสินค้าก่อน เลือกตัวแรกที่มี dropdown หน่วยมากกว่า 1 ตัวเลือก): "
     "PCO12338, PCO12250 (GOLDEN CUP BRAND INHALANT LAVENDER SCENT 2 CC), PCO12293 (เยลลี่นอนหลับ), "
     "PCO12248 (TIFFY DEY SYRUP 60 ML), PCO00012 (ยาแก้ไอ L.P. น้ำดำตราเสือดาว 60 มล.), PCO00094 (ACCU-CHEK ACTIVE), "
     "PCO00300 (APROVEL 150MG.14'S.), PCO00351 (ATORVASTATIN SDZ.20MG.10'S.), PCO01126 (COOL BABY 3ซอง), "
     "PCO00861 (CARDENOL 10MG.(TO)), PCO00110 (ACCUPRIL 40MG.7'S.), PCO00128 (ACNOTIN 10MG.10'S.)",
     "1. ยืนยัน badge ขึ้น \"อยู่ในตะกร้าแล้ว · 1 [หน่วยแรก]\"\n2. เปลี่ยน dropdown หน่วยบน card เป็นหน่วยที่สอง\n3. กด \"เพิ่มสินค้าลงตะกร้า\" อีกครั้งด้วยจำนวน 2",
     "Badge ต้องแทนที่เป็น \"อยู่ในตะกร้าแล้ว · 2 [หน่วยที่สอง]\" (หน่วย/จำนวนล่าสุด) ไม่ใช่แสดงทั้งสองหน่วยพร้อมกัน และไม่ใช่บวกสะสมข้ามหน่วย "
     "(ยืนยันกฎแล้วใน Test Plan หัวข้อ 2 ข้อ 2: \"ยอดจะเปลี่ยนไปตามหน่วยที่เลือกล่าสุด\")"),

    ("TC-BADGE-C06B", "MedEx - Cart Popup / Cart Page", "High", "Integration",
     "ต่อจาก TC-BADGE-C06 (เปลี่ยนหน่วยจากหน่วยแรกเป็นหน่วยที่สองแล้ว)", "-",
     "1. เปิด popup ตะกร้า\n2. เปิดหน้าตะกร้าเต็ม\n3. ตรวจสอบจำนวน line ของสินค้านี้",
     "มี line เดียวของสินค้านี้ด้วยหน่วยที่สอง จำนวน 2 เท่านั้น ไม่มี line ค้างของหน่วยแรกเดิมหลงเหลืออยู่"),

    ("TC-BADGE-C07", "MedEx - Product Card", "Medium", "Functional",
     PRE_LOGIN + " สินค้าที่เพิ่มลงตะกร้าปรากฏอยู่ได้หลายหน้า (pagination) หรือหลาย filter/tab (เช่น \"สินค้าปกติ\" และ \"สินค้าแนะนำ\")",
     "-", "1. เพิ่มสินค้า A ลงตะกร้าจากหน้า/tab หนึ่ง\n2. เปลี่ยนไปหน้า/tab อื่นที่มี card ของสินค้า A ปรากฏซ้ำ (เช่น \"สินค้าแนะนำโดย Nicha AI\")",
     "Badge \"อยู่ในตะกร้าแล้ว\" แสดงตรงกันทุกจุดที่ card ของสินค้า A ปรากฏ ไม่ใช่แค่จุดที่กดเพิ่มครั้งแรก"),

    # 7.3 State Sync (Critical)
    ("TC-BADGE-S01", "MedEx - Cross-check", "Critical", "Integration",
     PRE_LOGIN + " ตะกร้าว่างเปล่า", "สินค้า A ใดๆ",
     "1. เพิ่มสินค้า A จาก card\n2. ตรวจ badge บน card A\n3. ตรวจตัวเลขบนไอคอนตะกร้า (มุมขวาบน)\n4. เปิด popup ตรวจว่ามีสินค้า A\n5. เข้าหน้าตะกร้าเต็ม ตรวจว่ามีสินค้า A",
     "ทั้ง 4 จุด (badge/ไอคอนตะกร้า/popup/หน้าตะกร้าเต็ม) ต้องแสดงจำนวนสินค้า A ตรงกันทั้งหมด — ถือเป็น Critical หากจุดใดจุดหนึ่งไม่ตรง"),

    ("TC-BADGE-S02", "MedEx - Cross-check", "Critical", "Integration",
     "มีสินค้า A ในตะกร้าแล้ว (badge แสดงอยู่บน card)", "-",
     "1. ลบสินค้า A ออกจากหน้าตะกร้าเต็ม (ไม่ใช่จาก card)\n2. กลับมาหน้ารายการสินค้า สังเกต card A",
     "Badge บน card A ต้องหายไปด้วย แม้การลบเกิดขึ้นจากหน้าตะกร้าเต็ม ไม่ใช่จาก card โดยตรง"),

    ("TC-BADGE-S03", "MedEx - Cross-check", "High", "Integration",
     "มีสินค้า A ในตะกร้า 1 หน่วย (badge แสดง \"· 1\")", "-",
     "1. เข้าหน้าตะกร้าเต็ม แก้จำนวนสินค้า A เป็น 5\n2. กลับมาหน้ารายการสินค้า สังเกต card A",
     "Badge บน card A อัปเดตเป็น \"· 5\" ตรงกับที่แก้จากหน้าตะกร้าเต็ม"),

    ("TC-BADGE-S04", "MedEx - Multi-tab", "Medium", "Integration",
     PRE_LOGIN + " (เปิด 2 tab/browser ด้วย user เดียวกัน)", "-",
     "1. Tab 1: เพิ่มสินค้า A ลงตะกร้า\n2. Tab 2 (ยังไม่ reload): สังเกต badge/ไอคอนตะกร้า\n3. Tab 2: กด Refresh (F5)\n4. สังเกตอีกครั้ง",
     "ก่อน reload: Tab 2 ไม่จำเป็นต้องอัปเดตทันที (ยืนยันแล้วว่า sync เฉพาะตอน reload ไม่ใช่ real-time) — "
     "หลัง reload: Tab 2 ต้องแสดงค่าตรงกับ Tab 1 เสมอ"),

    ("TC-BADGE-S05", "MedEx - Concurrency", "High", "Edge Case",
     PRE_LOGIN + " อยู่หน้ารายการสินค้า", "สินค้า A ใดๆ",
     "1. กดปุ่ม \"+\" บน card สินค้า A ติดกันรัวๆ 10 ครั้งเร็วที่สุด\n2. รอ 2-3 วินาทีให้ระบบประมวลผลเสร็จ\n3. ตรวจ badge, popup, หน้าตะกร้าเต็ม",
     "ยอดสุดท้ายทั้ง 3 จุดตรงกันและเท่ากับจำนวนที่กดจริง (หรือค่าตั้งต้น+10 ตามพฤติกรรมปุ่ม) ไม่มี race condition ทำให้ตัวเลขเพี้ยนหรือไม่ตรงกันระหว่างจุด"),

    # 7.4 Edge Cases / Negative
    ("TC-BADGE-E01", "MedEx - Edge Case", "High", "Edge Case",
     PRE_LOGIN + " เพิ่มสินค้า \"CITAZOL TABLETS 50 mg.\" (PCO12253) ลงตะกร้าขณะยังมีสต็อกปกติ",
     "สินค้าที่ทราบว่าจะถูกปรับเป็น Out of Stock — หลัก: CITAZOL TABLETS 50 mg. (PCO12253); สำรอง (เผื่อกรณีแรกไม่เข้าเงื่อนไข): "
     "AROTIKA COOL GEL 35G. (PCO00322), SOLMAX 500 MG CAPSULES 10'S (PCO12266), KREMIL-S TABLETS 10'S (PCO12270), "
     "DECOLGEN PRIN TABLETS 4'S (PCO12271)",
     "1. ยืนยัน badge \"อยู่ในตะกร้าแล้ว\" แสดงบน card CITAZOL\n2. ให้ทีม/ระบบปรับสถานะสินค้านี้เป็น Out of Stock (จำลองหรือรอสถานะจริงเปลี่ยน)\n3. กลับมาสังเกต card, badge, และ popup",
     "Badge บน card และรายการใน popup ต้องคงค่าเดิมไว้เฉยๆ ไม่ลบออก ไม่ error ไม่มี warning ทันที (ยืนยันแล้วว่าถือเป็นการจองสิทธิ์ไว้แล้ว — Test Plan หัวข้อ 2 ข้อ 4)"),

    ("TC-BADGE-E01B", "MedEx - Cart Page", "High", "Integration",
     "ต่อจาก TC-BADGE-E01 (มีสินค้า Out of Stock ค้างอยู่ในตะกร้า)", "-",
     "1. ไปหน้าตะกร้าเต็ม\n2. กดปุ่ม \"ชำระเงิน\"",
     "ระบบต้องคำนวณ/ตรวจสอบ stock ใหม่ ณ จุดนี้ (แจ้งเตือนหรือบล็อกตามดีไซน์จริง) — เป็น smoke case เชื่อมต่อยืนยันว่าไม่ปล่อยให้สั่งซื้อสินค้าหมดสต็อกหลุดไปถึงคำสั่งซื้อจริงได้"),

    ("TC-BADGE-E02", "MedEx - Edge Case", "Low", "Edge Case",
     PRE_LOGIN + " ตะกร้ามีสินค้าจากผู้ผลิต/ร้านค้าหลายรายในบิลเดียว", "สินค้าจากอย่างน้อย 2 ผู้ผลิตต่างกัน",
     "1. เพิ่มสินค้าจาก 2 ผู้ผลิตต่างกันลงตะกร้า\n2. เปิด popup ตรวจสอบการจัดกลุ่มรายการ",
     "Popup แสดงรายการถูกต้องตามการออกแบบจริง (แยกกลุ่มตามผู้ผลิต หรือรวมเป็นรายการเดียว) ยอดรวมทั้งสิ้นถูกต้องไม่ว่ากรณีใด"),

    ("TC-BADGE-E03", "MedEx - Edge Case", "Medium", "Negative",
     PRE_LOGIN + " สินค้าที่มี stock จำกัด (เช่น เหลือ 5 ชิ้น)", "สินค้าที่มี stock เหลือน้อย",
     "1. พยายามเพิ่มจำนวนในตะกร้าเกินกว่า stock คงเหลือ (เช่น เพิ่มเป็น 10 ทั้งที่เหลือ 5)",
     "ระบบไม่ error/ค้าง — มีการจำกัดจำนวนสูงสุดหรือแสดง warning ตามดีไซน์จริง (ต้องยืนยันพฤติกรรมจริงกับ Dev หากยังไม่เคยเห็น)"),

    ("TC-BADGE-E04", "MedEx - Session", "Medium", "Security/Edge Case",
     "มีสินค้าในตะกร้า (badge แสดงอยู่) แล้ว session หมดอายุหรือถูก logout", "-",
     "1. Logout หรือรอ session หมดอายุขณะมีสินค้าในตะกร้า\n2. Login ใหม่ด้วย user เดิม (หรือ user อื่น)\n3. ตรวจสอบ badge",
     "Login ด้วย user เดิม: badge ต้องตรงกับตะกร้าจริงของ user นั้น — Login ด้วย user อื่น: ต้องไม่เห็น badge/ตะกร้าของ user ก่อนหน้าเลย (data isolation)"),

    # 7.5 Responsive / Cross-Device
    ("TC-BADGE-R01", "MedEx - Responsive", "Medium", "UI",
     PRE_LOGIN + " (Desktop, Chrome, ความกว้างจอ ≥1280px)", "-",
     "1. เพิ่มสินค้าลงตะกร้า\n2. เปิด popup ตรวจตำแหน่งและการจัดวาง",
     "Popup แสดงตำแหน่งใกล้ไอคอนตะกร้า ไม่ล้นขอบจอ ไม่บัง element สำคัญอื่นบน header"),

    ("TC-BADGE-R02", "MedEx - Responsive", "Low", "UI",
     PRE_LOGIN + " (Tablet, ความกว้างจอ ~768-1024px)", "-",
     "1. ปรับขนาดหน้าจอ/ใช้ tablet จริง ไล่ความกว้างผ่านจุดที่คาดว่าเป็น breakpoint\n2. เปิด popup ที่แต่ละความกว้าง",
     "Popup สลับรูปแบบระหว่าง desktop-style กับ mobile half-screen ที่ breakpoint ใดๆ ก็ตามที่ทีม Dev ออกแบบไว้ โดยไม่มีช่วงที่ popup แสดงผลพัง/ซ้อนทับผิดรูป"),

    ("TC-BADGE-R03", "MedEx - Responsive (Mobile)", "High", "UI",
     PRE_LOGIN + " (มือถือจริง — iOS Safari และ Android Chrome)", "-",
     "1. ทดสอบ badge บน product card ว่าไม่ล้น/ไม่บังราคาสินค้า\n2. ทดสอบ popup ครึ่งจอ + ปุ่มแตะซ้ำ (ตาม TC-BADGE-P07/P08) บนอุปกรณ์จริงทั้ง 2 แพลตฟอร์ม",
     "แสดงผลถูกต้องสวยงามทั้ง iOS Safari และ Android Chrome ไม่มี layout แตก/badge ล้นออกนอก card"),
]

# ══════════════════════════════════════════════════════════════════════════════
# ส่วนขยาย (2026-09-09): Cart Page — Price Calculation & Display Order Logic
# ครอบคลุม 3 repo (arinlink / web-app / web-admin) 7 หน้าจอ — ดู Test Plan หัวข้อ 12
# ══════════════════════════════════════════════════════════════════════════════

PRICE_EXAMPLE = (
    "ตัวอย่างอ้างอิงจาก screenshot: A=100บาท×10, B=100บาท×10 (รวม 2,000), ส่วนลดรายตัว A/B -100 แต่ละตัว "
    "(รวม -200 → 1,800), Promotion ท้ายบิล 10% ของ 1,800 = -180 (→1,620), Coupon -100 (→1,520 = ยอดสุทธิรวม VAT)"
)

CARTPRICE_CASES = [
    ("TC-CARTPRICE-001", "web-app - Cart /cart", "Critical", "Functional",
     "อยู่หน้าตะกร้าสินค้า มีสินค้า ≥2 รายการ", PRICE_EXAMPLE,
     "1. เพิ่มสินค้า A (100×10) และ B (100×10) ลงตะกร้า\n2. ตรวจสอบ \"ราคารวม\" ใน Summary ท้ายบิล",
     "ราคารวม = Σ(ราคาต่อหน่วย × จำนวน) ทุกบรรทัด = 2,000.00"),

    ("TC-CARTPRICE-002", "web-app - Cart /cart", "High", "Functional",
     "สินค้ามีส่วนลดรายตัว (per-item discount) ตั้งไว้จาก Admin", PRICE_EXAMPLE,
     "1. เปิดหน้าตะกร้า\n2. ตรวจสอบคอลัมน์ราคาต่อบรรทัดของสินค้าที่มีส่วนลด",
     "แสดงราคาเดิมขีดฆ่า + ราคาใหม่ถูกต้องต่อบรรทัด (เช่น 1,000 ขีดฆ่า → 900)"),

    ("TC-CARTPRICE-003", "web-app - Cart /cart", "Critical", "Functional",
     "มีสินค้าในตะกร้าที่ผ่านการหักส่วนลดรายตัว + Promotion + Coupon ครบตามตัวอย่าง", PRICE_EXAMPLE,
     "1. ตรวจคอลัมน์ \"ราคาหลังลด\" ต่อบรรทัดของสินค้า A และ B\n2. รวมค่า \"ราคาหลังลด\" ทุกบรรทัด",
     "คอลัมน์ \"ราคาหลังลด\" คือยอดสุทธิทั้งบิลที่ปันส่วนตามสัดส่วนมูลค่าแต่ละบรรทัด (A=760, B=760 ในตัวอย่าง) — Σ ราคาหลังลดทุกบรรทัด ต้อง = ยอดสุทธิทั้งบิล (1,520.00) เป๊ะ ไม่ใช่แค่ราคาหลังหักส่วนลดรายตัว (900)"),

    ("TC-CARTPRICE-004", "web-app - Cart /cart", "Critical", "Functional",
     "มีส่วนลดรายตัว + Promotion \"ท้ายบิล %\" พร้อมกัน", PRICE_EXAMPLE,
     "1. ตรวจสอบยอด Promotion ใน Summary",
     "Promotion คำนวณจากยอดหลังหักส่วนลดรายตัวแล้ว (1,800 × 10% = 180) ไม่ใช่จากยอดรวมดิบ (2,000 × 10% = 200 ต้องไม่ใช่ค่านี้)"),

    ("TC-CARTPRICE-005", "web-app - Cart /cart", "High", "Functional",
     "มีทั้งส่วนลดรายตัวและ Promotion", PRICE_EXAMPLE,
     "1. ตรวจสอบบรรทัด \"ส่วนลดโปรโมชั่น\" ใน Summary",
     "\"ส่วนลดโปรโมชั่น\" = ส่วนลดรายตัวรวมทุกบรรทัด (200) + Promotion (180) = 380.00 (รวมเป็นตัวเลขเดียว ไม่แยกแสดง)"),

    ("TC-CARTPRICE-006", "web-app - Cart /cart", "High", "Functional",
     "ใช้ Coupon ร่วมกับ Promotion", PRICE_EXAMPLE,
     "1. ใส่/เลือก Coupon ที่ลด -100\n2. ตรวจยอดหลัง Coupon",
     "หัก Coupon (-100) จากยอดหลัง Promotion (1,620) เสมอ = 1,520.00 (Coupon หักหลัง Promotion ไม่ใช่หักจากยอดรวมดิบ)"),

    ("TC-CARTPRICE-007", "web-app - Cart /cart", "High", "Functional",
     "มียอดสุทธิที่ต้องแยก VAT (รวม VAT 7% แล้ว)", "ยอดสุทธิ 1,520.00",
     "1. ตรวจ \"ราคาก่อนภาษี\" และ \"ภาษี\" ใน Summary",
     "ราคาก่อนภาษี = ยอดสุทธิ ÷ 1.07 = 1,420.56, ภาษี = ยอดสุทธิ − ราคาก่อนภาษี = 99.44 — ผลรวม 2 ค่า ต้อง = ยอดสุทธิ (1,520.00) เป๊ะ ไม่มีเศษสตางค์หาย"),

    ("TC-CARTPRICE-008", "web-app - Cart /cart", "Medium", "UI",
     "มีสินค้า+ส่วนลด+Promotion+Coupon+ค่าส่งครบ", "-",
     "1. ตรวจลำดับการแสดงผลแถวใน Summary ท้ายบิล (ตำแหน่งบนจอจริง ไล่จากบนลงล่าง)",
     "ต้องเรียงตามลำดับ: ราคารวม → ส่วนลดโปรโมชั่น → คูปองส่วนลด → ค่าส่ง → ราคาก่อนภาษี → ภาษี → ยอดสุทธิ"),

    ("TC-CARTPRICE-009", "web-app - Cart /cart", "High", "Functional",
     "มี Coupon ใช้งานอยู่แล้วในตะกร้า (ต่อจาก TC-CARTPRICE-006)", "-",
     "1. กดไอคอนถังขยะข้างรายการ Coupon เพื่อลบออก\n2. ตรวจ Summary ทุกยอดใหม่",
     "คำนวณใหม่ทันที ยอดสุทธิเพิ่มขึ้นกลับไปเป็นยอดหลัง Promotion เดิม (1,620.00) ทุก field re-calculate ถูกต้องหมด ไม่มีค่าค้าง"),

    ("TC-CARTPRICE-010", "web-app - Cart /cart", "High", "Functional",
     "มีสินค้า+ส่วนลด+Promotion+Coupon ครบ", "-",
     "1. กด +/- ปรับจำนวนสินค้า A จาก 10 เป็น 5\n2. ตรวจราคาทุกชั้น (ต่อบรรทัด + Summary)",
     "ราคาทุกชั้นคำนวณใหม่ถูกต้องตามลำดับเดิมทั้งหมด (ราคารวม, ส่วนลดรายตัว, Promotion, Coupon, VAT, ราคาหลังลดต่อบรรทัด) ไม่มีค่าไหนค้างจากก่อนแก้จำนวน"),

    ("TC-CARTPRICE-011", "web-app - Cart /cart", "Medium", "Negative",
     "ตะกร้ามีสินค้าที่ไม่มีส่วนลด/Promotion/Coupon เลย", "-",
     "1. เพิ่มสินค้าปกติไม่มีโปรโมชั่นลงตะกร้า\n2. ตรวจคอลัมน์ราคาหลังลด และ Summary",
     "ราคาหลังลดต่อบรรทัด = ราคารวมของบรรทัดนั้นเฉยๆ (ไม่มี allocation ผิดพลาด) — ⚠️ ต้องยืนยัน design จริงว่า Summary แสดงแถวส่วนลด/คูปองเป็น 0.00 หรือซ่อนไปเลย"),

    ("TC-CARTPRICE-012", "web-app - Cart /cart", "Medium", "Boundary",
     "ตะกร้ามี 3 บรรทัดขึ้นไป ราคาไม่เท่ากัน (หารสัดส่วนไม่ลงตัว)", "เช่น A=333, B=333, C=334 (รวม 1,000) มีส่วนลด/Promotion ร่วม",
     "1. ตรวจ Σ ราคาหลังลดทุกบรรทัด เทียบกับยอดสุทธิ",
     "ผลรวมราคาหลังลดทุกบรรทัดต้อง = ยอดสุทธิเป๊ะ แม้สัดส่วนหารไม่ลงตัว (มี logic เผื่อเศษสตางค์ไปลงบรรทัดใดบรรทัดหนึ่ง ไม่ปล่อยหายไปเฉยๆ)"),

    # หัวข้อ 12.5 (2026-09-09): ข้อมูลโปรโมชั่นจริงจากผู้ใช้ — บริษัททดสอบการซื้อสินค้า B (MKPv2)
    ("TC-CARTPRICE-013", "web-app - Cart /cart", "High", "Functional",
     "บริษัททดสอบการซื้อสินค้า B (MKPv2) มีโปรโมชั่น PROMO-B-001/002 (Order - Discount %)", "PROMO-B-001: ครบ 1,000.- ลด 5% | PROMO-B-002: ครบ 3,000.- ลด 8%",
     "1. เพิ่มสินค้ารวมครบ 1,000 บาท → ตรวจส่วนลด 5%\n2. เพิ่มจนครบ 3,000 บาท → ตรวจว่าใช้ threshold ไหน (5% หรือ 8%)",
     "คำนวณ % จากยอดหลังหักส่วนลดรายตัวถูกต้องตาม logic หัวข้อ 12.1 — ⚠️ ต้องยืนยัน priority กับ Dev เมื่อเข้าเงื่อนไขทั้ง 2 promo พร้อมกัน (ใช้ threshold สูงสุด หรือใช้ตัวแรก)"),

    ("TC-CARTPRICE-014", "web-app - Cart /cart", "High", "Functional",
     "มีโปรโมชั่น PROMO-B-003/004 (Order - Discount บาท)", "PROMO-B-003: ครบ 1,000.- ลด 50 บาท | PROMO-B-004: ครบ 3,000.- ลด 200 บาท",
     "1. เพิ่มสินค้ารวมครบ 1,000 บาท → ตรวจลด 50 บาทตายตัว\n2. ยอดต่ำกว่า 1,000 → ตรวจว่าไม่ได้รับส่วนลด",
     "ลดเป็นจำนวนเงินตายตัวถูกต้อง (ไม่ใช่ %) ยอดต่ำกว่า threshold ต้องไม่มีส่วนลดนี้"),

    ("TC-CARTPRICE-015", "web-app - Cart /cart", "High", "Functional",
     "มีโปรโมชั่น PROMO-B-005/006 (Order - แถมสินค้า)", "PROMO-B-005: ครบ 1,500.- แถม COOL BABY 3ซอง (PCO01126) x1 | PROMO-B-006: ครบ 2,500.- แถม CUTINOVA HYDRO (PCO01208) x1",
     "1. เพิ่มสินค้ารวมครบ 1,500 บาท → ตรวจสินค้าแถมถูกเพิ่มอัตโนมัติ\n2. ตรวจราคาสินค้าแถม",
     "สินค้าแถมถูกเพิ่มเข้าตะกร้า/บิลอัตโนมัติ ราคา 0.00 ไม่นับรวมในยอดที่ต้องชำระ แต่แสดงในรายการสินค้า"),

    ("TC-CARTPRICE-016", "web-app - Cart /cart", "High", "Functional",
     "มีโปรโมชั่น PROMO-B-007/008 (Product - Discount ตามมูลค่า)", "PROMO-B-007: ซื้อ APROVEL (PCO00300) ครบ 2,000.- ลดเพิ่ม 5% | PROMO-B-008: ซื้อ CYMBALTA (PCO01212) ครบ 3,500.- ลดเพิ่ม 60 บาท",
     "1. เพิ่ม APROVEL ครบ 2,000 บาท (มีสินค้าอื่นในตะกร้าด้วย) → ตรวจส่วนลดเฉพาะ APROVEL",
     "ส่วนลดคิดเฉพาะสินค้านั้นๆ ไม่กระทบราคาสินค้าอื่นในตะกร้า คอลัมน์ \"ราคาหลังลด\" ของบรรทัดนี้สะท้อนส่วนลดถูกต้อง"),

    ("TC-CARTPRICE-017", "web-app - Cart /cart", "High", "Boundary",
     "มีโปรโมชั่น PROMO-B-009/010 (Product - Discount ตามจำนวน/ขั้นบันได)", "PROMO-B-009: ACCU-CHEK ACTIVE (PCO00094) ครบ 5 กล่อง ลด 5% | PROMO-B-010: ATORVASTATIN (PCO00351) ครบ 12 กล่อง ลด 7% (ก่อนภาษี)",
     "1. ซื้อ PCO00094 จำนวน 4 กล่อง → ตรวจว่าไม่เข้าเงื่อนไข\n2. เพิ่มเป็น 5 กล่อง → ตรวจว่าได้ส่วนลด 5%\n3. ทดสอบ PCO00351 ครบ 12 กล่อง ตรวจฐานคำนวณ 7% ต้องเป็น \"ก่อนภาษี\"",
     "Threshold จำนวนชิ้นแม่นยำ (4 ไม่เข้า, 5 เข้า) และ PROMO-B-010 คำนวณ 7% จากฐานก่อนภาษีตามที่ระบุ ไม่ใช่ยอดรวม VAT"),

    ("TC-CARTPRICE-018", "web-app - Cart /cart", "High", "Functional",
     "มีโปรโมชั่น PROMO-B-012 (Product - แถมสินค้าตามจำนวน)", "ซื้อ ACCUPRIL (PCO00110) ครบ 12 กล่อง แถม CARDURA 2MG.10'S. (PCO00865) x1",
     "1. ซื้อ PCO00110 ครบ 12 กล่อง → ตรวจสินค้าแถม PCO00865 ถูกเพิ่ม",
     "🔴 ทดสอบจริงแล้ว (2026-09-09): ซื้อครบ 12 กล่องจริง แต่ **ไม่มี CARDURA ปรากฏในตะกร้าเลย** — เหมือน "
     "TC-CARTPRICE-015 (PROMO-B-005) ยืนยันว่าโปรโมชั่นแถมสินค้าทุกประเภทที่ทดสอบมาไม่ทำงานเลยในระบบปัจจุบัน "
     "ต้องแจ้ง Dev ตรวจสอบ"),

    ("TC-CARTPRICE-019", "web-app - Cart /cart", "Critical", "Edge Case",
     "มีโปรโมชั่น PROMO-B-013 (Product Combination — เคสซับซ้อนที่สุด)",
     "ซื้อคละกลุ่ม ACCU-CHEK (PCO00094/95/96/97) รวมกันครบ 10 ชิ้น + ยอดรวมขั้นต่ำ 4,000 บาท + ต้องมี PCO00094 อย่างน้อย 1 ชิ้น (Mandatory) → แถม PCO00099 x1 "
     "(ราคาจริง: PCO00094=310, PCO00097=759 — ใช้ 1×PCO00094 + 9×PCO00097 = 10 ชิ้น, 7,141 บาท ครบทุกเงื่อนไขพอดี)",
     "1. ซื้อ 1×PCO00094 + 9×PCO00097 (ครบ 10 ชิ้น, 7,141 บาท, มี Mandatory item) → ตรวจสินค้าแถม PCO00099",
     "🔴 ทดสอบจริงแล้ว (2026-09-09): เข้าเงื่อนไขครบทั้ง 3 ข้อ (mandatory+จำนวน+ยอดเงิน) แต่ **ไม่มี PCO00099 "
     "ปรากฏเลย** — สอดคล้องกับ TC-CARTPRICE-015/018 ยืนยันว่าฟีเจอร์แถมสินค้าไม่ทำงานทั้งระบบ ไม่ได้ทดสอบ "
     "negative case ทั้ง 3 แบบ (ไม่มี mandatory/จำนวนไม่ครบ/ยอดไม่ครบ) เพราะ positive case พื้นฐานยังไม่ผ่านเลย"),

    ("TC-CARTPRICE-020", "web-app - Cart /cart", "High", "Functional",
     "มีคูปอง REGULAR_PRICE_10_PC", "code: REGULAR_PRICE_10_PC — ลด 10% สินค้าราคาปกติ",
     "1. ใส่ code คูปองกับสินค้าที่ไม่มีโปรโมชั่นอื่นอยู่แล้ว → ตรวจลด 10%\n2. ทดลองใส่กับสินค้าที่มี Product-level promotion อยู่แล้ว (เช่น APROVEL ใน PROMO-B-007) → ตรวจพฤติกรรม",
     "ใช้ได้กับสินค้า \"ราคาปกติ\" ลด 10% ถูกต้อง — ⚠️ ต้องยืนยันกับ Dev ว่าใช้ร่วมกับสินค้าที่มีโปรโมชั่นอยู่แล้วได้หรือไม่ (ตาม naming code น่าจะใช้ไม่ได้)"),

    ("TC-CARTPRICE-021", "web-app - Cart /cart", "Critical", "Edge Case",
     "เข้าเงื่อนไข Order-level promotion (เช่น PROMO-B-001) พร้อมมีคูปอง REGULAR_PRICE_10_PC ในตะกร้าเดียวกัน", "-",
     "1. เพิ่มสินค้าครบ 1,000 บาท (เข้า PROMO-B-001)\n2. ใส่ code คูปอง REGULAR_PRICE_10_PC เพิ่ม\n3. ตรวจลำดับการหักและ Summary",
     "Coupon หักจากยอดหลัง Promotion เสมอ ไม่ใช่คิดจากยอดรวมดิบ (ตาม logic หัวข้อ 12.1: รายตัว→Promotion→Coupon→VAT) Summary แยกบรรทัด \"ส่วนลดโปรโมชั่น\"/\"คูปองส่วนลด\" ถูกต้อง"),

    # 12.7.1 web-app: Cart UI เพิ่มเติม (นอกเหนือจากตัวเลข)
    ("TC-CARTUI-001", "web-app - Cart /cart", "Medium", "UI",
     "อยู่หน้าตะกร้าสินค้า มีสินค้าที่มี reference_code และ product_name", "-",
     "1. ตรวจคอลัมน์สินค้าในตาราง",
     "reference_code และ product_name รวมแสดงในคอลัมน์เดียวกัน อ่านครบทั้ง 2 ค่า ไม่ตัดข้อความ"),

    ("TC-CARTUI-002", "web-app - Cart /cart", "Critical", "UI",
     "มีสินค้าในตะกร้าที่ผ่านการคำนวณส่วนลดแล้ว", "-",
     "1. ตรวจตำแหน่งคอลัมน์ \"ราคาหลังลด\"",
     "อยู่ข้างคอลัมน์ \"รวม\" ค่าตรงตาม logic การปันส่วนใน TC-CARTPRICE-003"),

    ("TC-CARTUI-003", "web-app - Cart /cart", "High", "Negative",
     "อยู่หน้าตะกร้าสินค้า", "-",
     "1. ปรับหน่วย หรือ จำนวนสินค้าในตะกร้าซ้ำๆ หลายครั้ง\n2. สังเกตหน้าจอระหว่างโหลด",
     "ต้อง**ไม่มี** spinner สีขาวขึ้นวาบเต็มหน้าจอ (regression case กันบั๊ก UX เดิมกลับมา) ใช้ partial/inline loading indicator แทน"),

    # 12.7.2 web-app: รายละเอียดคำสั่งซื้อ /orders/:orderRef/detail
    ("TC-ORDERDETAIL-WEBAPP-001", "web-app - Order Detail", "Critical", "Functional",
     "มีคำสั่งซื้อที่ผ่านการคำนวณส่วนลด/Promotion แล้วอย่างน้อย 1 รายการ — ⚠️ ยังไม่ได้สำรวจ selector จริงบน staging", "-",
     "1. เปิดหน้า /orders/:orderRef/detail\n2. ตรวจคอลัมน์ \"ราคาหลังลด\"",
     "แสดงข้าง \"รวม\" ค่าถูกต้องตาม logic เดียวกับ TC-CARTPRICE-003"),

    ("TC-ORDERDETAIL-WEBAPP-002", "web-app - Order Detail", "Medium", "UI",
     "อยู่หน้ารายละเอียดคำสั่งซื้อ", "-",
     "1. ตรวจการจัดวางคอลัมน์ \"รวม\" และ \"ราคาหลังลด\"",
     "จัดชิดขวา (right-align) ทั้งคู่"),

    ("TC-ORDERDETAIL-WEBAPP-003", "web-app - Order Detail", "High", "Functional",
     "คำสั่งซื้อมีสินค้าที่ต้องระบุ Lot/วันหมดอายุ", "-",
     "1. ตรวจจำนวน Lot ที่แสดง\n2. กดปุ่มดูรายละเอียด Lot/Expire",
     "จำนวน Lot ถูกต้อง modal เปิดแสดงรายละเอียด Lot/Expire ครบถ้วน"),

    ("TC-ORDERDETAIL-WEBAPP-004", "web-app - Order Detail", "High", "Functional",
     "อยู่หน้ารายละเอียดคำสั่งซื้อ", "-",
     "1. ตรวจ Summary ท้ายบิล",
     "แสดงครบทุกยอด (ราคารวม/ส่วนลด/ภาษี/ยอดสุทธิ) ตรงกับยอดที่จ่ายจริงตอนสั่งซื้อ"),

    # 12.7.3 web-app: สรุปรายการสั่งซื้อ /cart/checkout/detail
    ("TC-CARTCHECKOUT-WEBAPP-001", "web-app - Checkout Detail", "Critical", "Integration",
     "ผ่านจากหน้าตะกร้า (/cart) มาหน้าสรุปรายการสั่งซื้อ", "-",
     "1. เปรียบเทียบคอลัมน์ \"ราคาหลังลด\" กับหน้า /cart ก่อนหน้า",
     "ค่าตรงกับหน้า /cart เป๊ะ ไม่เปลี่ยนระหว่างเปลี่ยนหน้า"),

    ("TC-CARTCHECKOUT-WEBAPP-002", "web-app - Checkout Detail", "High", "Integration",
     "อยู่หน้าสรุปรายการสั่งซื้อ", "-",
     "1. เปรียบเทียบ Summary ท้ายบิลกับหน้า /cart",
     "แสดงครบทุกยอด ตรงกับหน้า /cart ก่อนหน้าเป๊ะ"),

    # 12.7.4 web-app: ชำระเงิน /payment/summary + Modal มือถือ
    ("TC-PAYMENT-WEBAPP-001", "web-app - Payment Summary (Desktop)", "Critical", "Functional",
     "อยู่หน้าชำระเงินบน Desktop", "-",
     "1. ตรวจ Summary ท้ายบิล",
     "แสดงครบทุกยอดถูกต้อง"),

    ("TC-PAYMENT-WEBAPP-002", "web-app - Payment Summary (Mobile Modal)", "Critical", "Integration",
     "อยู่หน้าชำระเงินบนมือถือ (Modal)", "-",
     "1. เปิด Modal สรุปยอดบนมือถือ\n2. เปรียบเทียบทุกยอดกับ Desktop ของคำสั่งซื้อเดียวกัน",
     "ตัวเลขทุกบรรทัดตรงกับ Desktop เป๊ะ (คนละ component กันเสี่ยงไม่ sync)"),

    # 12.7.5 arinlink: รายละเอียดคำสั่งซื้อ /company/:companySlug/orders/:orderRef/detail
    ("TC-ORDERDETAIL-ARINLINK-001", "arinlink - Order Detail (TH)", "Critical", "Functional",
     "มีคำสั่งซื้อในระบบ arinlink — ⚠️ repo ใหม่ ยังไม่เคยสำรวจ selector/login flow ในเซสชันนี้", "-",
     "1. เปิดหน้า /company/:companySlug/orders/:orderRef/detail (ภาษาไทย default)\n2. ตรวจ Summary ท้ายตาราง",
     "แสดงครบทุกยอดตาม logic ใหม่ (ราคารวม/ส่วนลด/ค่าส่ง/ภาษี/ยอดสุทธิ)"),

    ("TC-ORDERDETAIL-ARINLINK-002", "arinlink - Order Detail (EN)", "Critical", "Functional",
     "อยู่หน้ารายละเอียดคำสั่งซื้อ arinlink", "-",
     "1. สลับภาษาเป็นอังกฤษ (EN)\n2. ตรวจ label ทุกบรรทัดของ Summary",
     "แปลถูกต้องทุก label ตัวเลข/รูปแบบทศนิยม (comma separator, ทศนิยม 2 ตำแหน่ง) ไม่เปลี่ยนตามภาษา"),

    ("TC-ORDERDETAIL-ARINLINK-003", "arinlink - Order Detail", "Medium", "Integration",
     "คำสั่งซื้อเดียวกันดูได้ทั้งฝั่ง arinlink และ web-app", "-",
     "1. เปรียบเทียบตัวเลขใน Summary ระหว่างหน้า arinlink กับหน้า web-app order detail ของคำสั่งซื้อเดียวกัน",
     "ตัวเลขตรงกันเป๊ะทุกบรรทัด (cross-check ข้ามระบบ)"),

    # 12.7.6 web-admin: PO List (Edit PO) /sales-manage-order/po/{uuid}
    # ✅ Selector สำรวจจริงแล้ว 2026-09-09 — login: ADMIN_BASE_URL/ADMIN_EMAIL/ADMIN_PASSWORD ใน .env
    # (pattern เดียวกับ tests/arinlink/arinlink-tier-setup.spec.ts) → /arinlink/sales-manage-order/po
    # → กด "สร้างใบเสนอราคา" → หน้า /arinlink/sales-manage-order/po/{uuid}
    ("TC-PO-ADMIN-001", "web-admin - PO Edit", "Critical", "Functional",
     "Login admin-stg.arincare.com (ADMIN_EMAIL/ADMIN_PASSWORD) สำเร็จ → อยู่หน้า /arinlink/sales-manage-order/po/{uuid} "
     "→ เลือก supplier ที่ #supplier_search แล้ว (ต้องเลือกก่อนเพิ่มสินค้าได้ — ดู TC-PO-ADMIN-003) → เพิ่มสินค้า ≥2 รายการที่มีส่วนลด",
     "ใช้สูตร/ตัวเลขเดียวกับ PRICE_EXAMPLE ใน TC-CARTPRICE-001",
     "1. เพิ่มสินค้า A, B ลงตาราง #link-purchase-detail-table\n2. ตรวจคอลัมน์ \"ราคาหลังลด\" (คอลัมน์สุดท้ายก่อนปุ่มลบ ถัดจาก \"Total\")",
     "แสดงค่าถูกต้องตาม logic การปันส่วนในหัวข้อ 12.1 (Σ ราคาหลังลดทุกแถว = #form_gross_amount)"),

    ("TC-PO-ADMIN-002", "web-admin - PO Edit", "Critical", "Functional",
     "อยู่หน้า Edit PO มีสินค้า+ส่วนลด/โปรโมชั่น/คูปองครบ", "-",
     "1. ตรวจค่าใน field: #form_total_amount_before_all_discount, #form_promotion_discount_amount, "
     "#form_coupon_discount_amount, #form_shipping_amount, #form_gross_amount_before_tax, #form_tax_amount, #form_gross_amount",
     "✅ ลำดับ field ID บน DOM ตรงกับลำดับที่ต้องการอยู่แล้ว (ราคารวม→ส่วนลดโปรโมชั่น→คูปอง→ค่าส่ง→ก่อนภาษี→ภาษี→ยอดสุทธิ) เช็คแค่ค่าตัวเลขถูกต้องตรงกับ PO จริง"),

    ("TC-PO-ADMIN-003", "web-admin - PO Edit", "High", "Negative",
     "อยู่หน้าสร้าง PO ใหม่ ยังไม่ได้เลือก \"ร้านค้า\" (supplier) ที่ #supplier_search เลย", "-",
     "1. กดปุ่ม \"เพิ่มสินค้า\" (button.btn-default) โดยไม่เลือก supplier ก่อน",
     "🔴 พบจริงจากการสำรวจ: ขึ้น modal แจ้งเตือน \"กรุณาเลือกร้านค้าก่อน\" ทันที ไม่เปิด modal เพิ่มสินค้าให้"),

    ("TC-PO-ADMIN-004", "web-admin - PO Edit", "Medium", "Functional",
     "อยู่หน้า Edit PO ส่วน \"เลือกประเภทร้านค้า(เลือกได้แค่ 1 ตัวเลือก)\"", "-",
     "1. คลิกปุ่ม \"ร้านค้าบน MKP\"\n2. คลิกปุ่ม \"ร้านค้า Offline\"\n3. สังเกตว่าปุ่มไหนถูกไฮไลต์ (class btn-warning)",
     "✅ ทดสอบจริงแล้ว: mutually exclusive ทำงานถูกต้อง — class btn-warning (สีส้ม/เลือกอยู่) ย้ายไปปุ่มที่คลิกล่าสุดเสมอ เลือกได้จริงแค่ 1 ตัวเลือก"),

    ("TC-PO-ADMIN-005", "web-admin - PO Edit", "Medium", "Functional",
     "อยู่หน้าสร้าง PO ใหม่", "ค้นหาด้วย ARC ID เช่น \"ARC1258\" (บัญชีทดสอบ Watcharin TestTest)",
     "1. พิมพ์ \"ARC1258\" ที่ #company_search\n2. เลือกผลลัพธ์จาก dropdown\n3. ตรวจฟิลด์ที่ auto-fill",
     "✅ ทดสอบจริงแล้ว: dropdown โชว์ \"ARC1258 Watcharin TestTest\" ตัวเดียว เลือกแล้ว #company_info_arc_reference_code=\"ARC1258\", "
     "#company_info_name=\"Watcharin TestTest\" ถูกต้อง (ฟิลด์ readonly ทั้งหมด)"),

    # เพิ่มเติม 2026-09-09: กฎ Quotation save-per-add-product + PDF export (ยังใช้หน้า PO เดิมที่สำรวจแล้ว)
    ("TC-PO-ADMIN-006", "web-admin - PO Edit", "Critical", "Functional",
     "อยู่หน้า Edit PO เพิ่งเพิ่มสินค้า A เข้าตาราง #link-purchase-detail-table แต่ยังไม่กด \"บันทึกใบเสนอราคา\"", "-",
     "1. เพิ่มสินค้า A\n2. ตรวจ Summary field ทั้ง 7 ตัว (#form_total_amount_before_all_discount ฯลฯ) ก่อนกด Save\n"
     "3. กด \"บันทึกใบเสนอราคา\"\n4. ตรวจ Summary อีกครั้งหลัง Save",
     "ก่อน Save: Summary ยังไม่นับสินค้า A เข้าไป (ค้างค่าก่อนหน้า) — หลัง Save: recalculate ถูกต้องทันที "
     "(ยืนยันกฎจากผู้ใช้: ต้องกด Save ทุกครั้งหลังเพิ่มสินค้า ระบบถึงจะคำนวณใหม่)"),

    ("TC-PO-ADMIN-007", "web-admin - PO Edit", "High", "Functional",
     "อยู่หน้า Edit PO", "เพิ่มสินค้า B → Save → เพิ่มสินค้า C → Save (ทำซ้ำหลายรอบ)",
     "1. เพิ่มสินค้า B → กด Save → จด Summary\n2. เพิ่มสินค้า C → กด Save → จด Summary ใหม่",
     "ยอดถูกต้องทุกรอบ ไม่มีค่าตกหล่น/ซ้ำจากรอบก่อนหน้า (Summary รอบ 2 = รอบ 1 + สินค้า C เท่านั้น)"),

    ("TC-PO-ADMIN-008", "web-admin - PO Edit", "High", "Functional",
     "อยู่หน้า Edit PO ที่มีสินค้า+ส่วนลดครบ และกด \"บันทึกใบเสนอราคา\" ล่าสุดแล้ว", "-",
     "1. กดปุ่ม \"Export ใบเสนอราคา\" (PDF)\n2. เปิดไฟล์ PDF ตรวจ: เลขที่ใบเสนอราคา, วันที่, ชื่อลูกค้า, รายการสินค้า, "
     "จำนวน, ราคาต่อหน่วย, ส่วนลด, ยอดรวม, ยอดสุทธิ, ข้อมูลบริษัท/ร้านค้า",
     "ทุกค่าใน PDF ตรงกับที่แสดงบนหน้าจอ ณ ขณะกด Export เป๊ะ ไม่มีค่าเก่าค้าง/ไม่มีค่าขาดหาย"),

    ("TC-PO-ADMIN-009", "web-admin - PO Edit", "Medium", "Integration",
     "เพิ่งบันทึก/แก้ไขใบเสนอราคาเสร็จ", "-",
     "1. จด uuid จาก URL หน้า edit + ยอดสุทธิที่ save ไว้\n2. เข้าหน้า PO List (/arinlink/sales-manage-order/po)\n"
     "3. หาแถวที่ลิงก์ Detail ชี้ไปที่ uuid เดียวกัน เทียบ ARC ID ลูกค้า + Total Amount",
     "✅ ทดสอบจริงแล้ว: ARC ID และยอดสุทธิ (Total Amount ในลิสต์ ซึ่งแสดงแบบมี comma คั่นหลักพัน เช่น "
     "\"1,243.26\") ตรงกับที่บันทึกไว้ล่าสุดเป๊ะ — ยังไม่ได้ cross-check กับฝั่ง User (จะทำเมื่อมี Order "
     "จริงที่เชื่อมโยงมาจาก PO นี้)"),

    # 12.7.7 web-admin: Order List (View Order Details) /order-management/order/{id}
    ("TC-ORDER-ADMIN-001", "web-admin - Order Management", "High", "Integration",
     "มีคำสั่งซื้อในระบบที่ลูกค้าสั่งผ่าน web-app แล้ว", "-",
     "1. เปิดหน้า /order-management/order/{id}\n2. ตรวจ Summary ท้ายตาราง เทียบกับที่ลูกค้าเห็นฝั่ง web-app",
     "แยกราคารวม/ส่วนลดโปรโมชั่น/ภาษี/ยอดสุทธิ ตามสูตรคำนวณใหม่ ตรงกับฝั่ง web-app เป๊ะ (cross-check ข้ามระบบ Admin ↔ Client)"),
]

# ── หัวข้อ 13 (2026-09-09): End-to-End Cart → Payment → Order (User + Admin) ──
E2E_CASES = [
    ("TC-E2E-CART-001", "User - Cart", "Critical", "Functional",
     "มีสินค้าในตะกร้าอย่างน้อย 1 รายการ", "-",
     "1. เปิด /companies/marketplace/order-management/cart (การซื้อของฉัน → รายการตะกร้า)\n"
     "2. ตรวจรายการ/ราคารวม/วันที่ชำระ/อายุตะกร้าสินค้า/สถานะการชำระ (Ref No. link → /order-management/cart/{id})",
     "ข้อมูลครบถ้วนถูกต้อง — ✅ ยืนยันแล้วว่าหน้านี้เป็น checkout-history list คนละหน้ากับ shopping cart /companies/marketplace/cart"),

    ("TC-E2E-CART-002", "User - Cart", "High", "Functional",
     "ตะกร้า Shopping (/companies/marketplace/cart) มีสินค้า 2 รายการจากผู้ขาย 2 ร้านต่างกัน", "เลือก checkbox เฉพาะร้านค้าเดียว",
     "1. ติ๊กเลือก checkbox ของร้านค้าใดร้านค้าหนึ่งเท่านั้น (ไม่แตะ \"เลือกทั้งหมด\")\n2. กด \"ชำระเงิน\"\n3. ตรวจรายการในหน้าชำระเงิน",
     "✅ ทดสอบจริงแล้ว: เฉพาะสินค้าของร้านที่เลือกเท่านั้นที่ปรากฏในหน้าชำระเงิน — ⚠️ **แก้จากที่เข้าใจผิดตอนแรก**: "
     "ตะกร้าไม่มี checkbox เลือกสินค้ารายตัว มีแค่ checkbox ระดับ \"ร้านค้า\" (seller group) เท่านั้น อยู่ใน <thead><tr><th> "
     "ของแต่ละ mini-table ต่อร้าน ไม่ใช่ต่อแถวสินค้า (พบจริงตอนเขียน automation 2026-09-09)"),

    ("TC-E2E-CART-003", "User - Cart", "High", "Functional",
     "ตะกร้า Shopping (/companies/marketplace/cart) มีสินค้า ≥1 รายการ", "-",
     "1. กด checkbox exact-text \"เลือกซื้อรายการสินค้า (เลือกทั้งหมด)\"\n2. กด \"ชำระเงิน\"",
     "✅ ทดสอบจริงแล้ว: ทุกรายการถูกเลือกและปรากฏครบในหน้าชำระเงิน — ⚠️ selector ต้องหา checkbox ด้วย exact-text label แล้ว "
     "XPath preceding-sibling (input[type=checkbox].first() เฉยๆ จะไปโดนช่อง \"ที่อยู่ใบกำกับภาษี\" แทน)"),

    ("TC-E2E-PAYMENT-001", "User - Payment", "Critical", "Functional",
     "เลือกสินค้าจากตะกร้าแล้วกดชำระเงินมา", "-",
     "1. เปิด /companies/marketplace/payment\n2. เทียบจำนวน/ราคา/ส่วนลด/ยอดที่ต้องชำระ กับหน้าตะกร้าก่อนหน้า",
     "✅ ทดสอบจริงแล้ว: ข้อมูลครบถ้วน ยอดรวมสุทธิตรงกับหน้าตะกร้าเป๊ะ — พบ stepper 3 step (รอการชำระ→ตรวจสอบสถานะ→ชำระเรียบร้อย) "
     "และ \"เลขที่ใบสั่งซื้อ\" (Order ref) ถูกจองแสดงไว้ล่วงหน้าตั้งแต่ก่อนชำระเงินเสร็จ"),

    ("TC-E2E-BANK-001", "User - Payment (Bank Transfer)", "Critical", "Functional",
     "อยู่หน้าชำระเงิน เลือกแท็บ \"โอนผ่านธนาคาร\" (getByText, ไม่ใช่ radio)", "ไฟล์ .jpg จาก ~/Downloads/, วันที่/เวลา/จำนวนเงิน",
     "1. กด \"แนบหลักฐานการโอน\" → เปิด modal \"รายละเอียดการโอนเงิน\"\n"
     "2. กรอกวันที่: input[placeholder=\"วว/ดด/ปปปป\"]\n3. กรอกเวลา: input[placeholder=\"00\"] ×2 (ชม./นาที แยกช่อง)\n"
     "4. กรอกจำนวนเงิน: input[placeholder=\"0.00\"]\n5. อัพโหลดไฟล์: input[type=\"file\"] (accept .jpeg/.jpg/.png)\n"
     "6. กด \"ตกลง\" ในโมดัล\n7. ติ๊ก checkbox ยอมรับ + กด \"ส่งหลักฐานการโอน\"",
     "✅ ทดสอบจริงสำเร็จ 2026-09-09 ด้วยไฟล์ jpg จริง: ทุกฟิลด์บันทึกถูกต้อง หน้าเปลี่ยนเป็น \"คำสั่งซื้ออยู่ระหว่างตรวจสอบ\" "
     "stepper ขยับไป step 2 \"ตรวจสอบสถานะ\""),

    ("TC-E2E-BANK-002", "User+Admin - Cart (Bank Transfer)", "Critical", "Functional",
     "ส่งหลักฐานการโอนเงินผ่าน TC-E2E-BANK-001 แล้ว แต่ Admin ยังไม่ได้ตรวจสอบ/อนุมัติ", "-",
     "1. เปิด User Cart list (/order-management/cart) → ตรวจรายการ+สถานะ\n"
     "2. Login admin-stg → เปิด Admin Cart (/arinlink/order-management/cart?page=1) → ตรวจรายการเดียวกัน (ค้นด้วย Ref No.)",
     "✅ ทดสอบจริงแล้ว: รายการยังอยู่ใน Cart list ทั้งสองฝั่ง สถานะ = \"รอตรวจสอบ\" ตรงกัน 100% (Ref No./ราคารวม/Arc ID/Company Buyer) "
     "และ Admin Order List (ก่อน approve) ยังไม่มี Order ปรากฏเลยตามคาด"),

    ("TC-E2E-BANK-003", "Admin - Cart/Order (Bank Transfer)", "Critical", "Functional",
     "มีรายการ Bank Transfer สถานะ \"รอตรวจสอบ\" ใน Admin Cart", "หมายเหตุอนุมัติ (required field)",
     "1. เปิด Admin Cart → คลิก .dropdown-toggle ของแถวนั้น → เลือก \"ชำระเงินเเล้ว\" (partial-text match, DB สะกดซ้ำ เ 2 ตัว)\n"
     "2. Modal \"เปลี่ยนสถานะการชำระเงิน\" เปิดขึ้น → กรอกช่อง \"หมายเหตุ\" (textarea, required — ถ้าไม่กรอกปุ่ม บันทึก จะไม่ทำงานแบบไม่มี error ชัดเจน)\n"
     "3. กด \"บันทึก\"\n4. เปิด Admin Order List → ตรวจว่ามี Order ใหม่\n5. เปิด User Order List ฝั่ง User ตรวจเช่นกัน",
     "✅ ทดสอบจริงสำเร็จ 2026-09-09: Cart status เปลี่ยนเป็น \"ชำระเงินแล้ว\" ทันที และ Order ปรากฏใน Order List ทันที "
     "(สถานะออเดอร์=\"รับออเดอร์แล้ว\", สถานะการชำระ=\"ชำระเงินแล้ว\") ข้อมูลตรงกันทั้ง User Order และ Admin Order 100%"),

    ("TC-E2E-BANK-004", "User+Admin - Cross-check (Bank Transfer)", "High", "Integration",
     "ทำ TC-E2E-BANK-002 (ก่อน approve) และ TC-E2E-BANK-003 (หลัง approve) มาแล้วทั้งคู่", "-",
     "1. เทียบ snapshot ข้อมูลก่อน-หลัง Admin เปลี่ยนสถานะแบบ field-by-field: Cart status, Order existence, Payment status",
     "✅ ทดสอบจริงแล้ว: ทุก field เปลี่ยนพร้อมกันสอดคล้องกัน — ก่อน approve ไม่มี Order เลยในลิสต์, หลัง approve ปรากฏทันทีครบทุก field "
     "ไม่มี field ไหนค้างสถานะเก่า"),

    ("TC-E2E-QR-001", "User+Admin - QR Payment", "Critical", "Functional",
     "อยู่หน้าชำระเงิน เลือกแท็บ QR Code (button:has-text(\"สแกน QR Code\") — selector สำรวจไว้แล้ว)", "-",
     "1. ชำระผ่าน QR Code จนสำเร็จ\n2. ตรวจ User Order ทันที\n3. ตรวจ Admin Order ทันที",
     "⏸️ ยังทดสอบจริงไม่ได้ — ต้องมี sandbox/mock payment gateway บน staging (Open Item ค้าง) "
     "คาดว่าระบบสร้าง Order ทันทีหลังชำระสำเร็จ สถานะ \"ชำระเงินแล้ว\" ข้อมูลตรงกันทั้ง User และ Admin (ยังไม่ยืนยัน)"),

    ("TC-E2E-CC-001", "User+Admin - Credit Card Payment", "Critical", "Functional",
     "อยู่หน้าชำระเงิน เลือกแท็บบัตรเครดิต", "-",
     "1. ชำระผ่านบัตรเครดิตจนสำเร็จ\n2. ตรวจ User Order ทันที\n3. ตรวจ Admin Order ทันที",
     "⏸️ ยังทดสอบจริงไม่ได้ เหตุผลเดียวกับ QR (ไม่มี sandbox gateway) คาดว่าพฤติกรรม/timing เหมือน QR (ยังไม่ยืนยัน)"),

    ("TC-E2E-MYPURCHASE-001", "User - My Purchase (Cart)", "High", "Integration",
     "ทำรายการผ่านช่องทางใดช่องทางหนึ่ง (QR/CC/Bank) มาแล้วบางส่วน", "-",
     "1. เปิด \"การซื้อของฉัน → รายการตะกร้า\" (/order-management/cart) หลังแต่ละขั้นตอนของทุก flow\n"
     "2. ตรวจ Ref No./ราคารวม/วันที่ชำระ/อายุตะกร้าสินค้า/สถานะการชำระ",
     "✅ ทดสอบจริงแล้ว (Bank Transfer): ข้อมูลตรงกับ state ปัจจุบันจริง อัปเดตทันทีตามแต่ละขั้นตอน "
     "(รอตรวจสอบ→ชำระเงินแล้ว) — QR/CC ยัง ⏸️ รอ Open Item เดียวกับ TC-E2E-QR-001/CC-001"),

    ("TC-E2E-MYPURCHASE-002", "User - My Purchase (Order)", "High", "Integration",
     "มี Order ถูกสร้างแล้วจากช่องทางใดช่องทางหนึ่ง", "-",
     "1. เปิด \"การซื้อของฉัน → รายการออเดอร์\" (/order-management/order)\n"
     "2. เปิด Order Detail ตรวจ breadcrumb {Ref No.}/{เลขที่ออเดอร์}, Tracking, ตารางสินค้า(ราคาหลังลด), Summary 7 field, ลิงก์ \"พิมพ์ใบสั่งซื้อ\"",
     "✅ ทดสอบจริงแล้ว (Bank Transfer): ข้อมูลถูกต้องครบทุก field, breadcrumb ยืนยันความสัมพันธ์ Cart↔Order ตรงๆ, "
     "คอลัมน์ราคาหลังลด+Summary ตรงกับสูตรหัวข้อ 12.1 เป๊ะ"),

    ("TC-E2E-MYPURCHASE-003", "User - My Purchase (Cross-flow)", "Medium", "Integration",
     "ทดสอบครบทั้ง 3 ช่องทางชำระเงินแล้ว", "-",
     "1. เทียบจังหวะการย้ายรายการจาก Cart list → Order list ของแต่ละช่องทาง",
     "✅ ยืนยันแล้วสำหรับ Bank Transfer: ไม่ปรากฏใน Order list จนกว่า Admin approve — QR/CC ยัง ⏸️ รอ Open Item "
     "(คาดว่าย้ายทันทีตาม business rule ที่ผู้ใช้ระบุ แต่ยังไม่ได้ยืนยันด้วยการทดสอบจริง)"),

    ("TC-E2E-ADMIN-CART-001", "Admin - Cart", "Critical", "Functional",
     "มีรายการชำระเงินหลายสถานะ (รอตรวจสอบ/อนุมัติแล้ว) ปนกันใน Admin Cart", "-",
     "1. เปิด Admin Cart (/arinlink/order-management/cart?page=1)\n"
     "2. ตรวจคอลัมน์ Ref No./Sale Zone/Arc ID/Company Buyer/Buyer Province/Total/Cart Update/Cart Expire/Payment Status(dropdown)/Payment Date/Payment Type "
     "ทั้งก่อนและหลัง Admin ปรับสถานะ",
     "✅ ทดสอบจริงแล้ว: แสดงข้อมูลถูกต้องครบทุกสถานะ ตรงกับที่ User ส่งมา 100% — ⚠️ Payment Status dropdown-menu ถูก teleport "
     "ออกจาก <tr> ตอนเปิด ต้อง query แบบ global (ul.dropdown-menu:visible) เวลาเขียน automation"),

    ("TC-E2E-ADMIN-ORDER-001", "Admin - Order", "Critical", "Integration",
     "มี Order ถูกสร้างแล้วจากทุกช่องทางชำระเงิน", "-",
     "1. เปิด Admin Order (/arinlink/order-management/order?page=1)\n"
     "2. ตรวจ Order Status(dropdown: ใหม่/ส่งใบสั่งซื้อแล้ว/รับออเดอร์แล้ว/.../รอจัดส่งการสั่งซื้อ)/Payment Status/รายการสินค้า/จำนวน/ราคา/ส่วนลด/ยอดรวม",
     "✅ ทดสอบจริงแล้ว (Bank Transfer): ถูกต้องตรงกับข้อมูลต้นทางจาก Cart+Payment ทุก field — ⚠️ ลิงก์รายละเอียดต้องใช้ "
     "a[href*=\"/order-management/order/\"] ตรงๆ ห้ามใช้ .last()/svg generic (จะโดนปุ่มพิมพ์ dropdown แทน)"),

    ("TC-E2E-SYNC-001", "Cross-cutting - Data Sync", "Critical", "Integration",
     "ทำรายการ Cart→Payment→Order ผ่านช่องทางใดช่องทางหนึ่งจนจบ flow", "-",
     "1. บันทึกรายการสินค้า (Product/Qty/Unit Price/Discount/Total) ที่หน้า Cart\n"
     "2. เทียบค่าเดียวกันที่หน้า Payment → Order (User) → Order (Admin)",
     "✅ ทดสอบจริงแล้ว (Bank Transfer, ACCIN-BP 5G x1 = 210.00): ตรงกันทุกจุดตลอด Flow ไม่มีจุดไหนตัวเลขเพี้ยน/สินค้าตกหล่น"),

    ("TC-E2E-SYNC-002", "Cross-cutting - Data Sync", "Critical", "Integration",
     "เหมือน TC-E2E-SYNC-001", "-",
     "1. บันทึกยอดเงินรวม/ส่วนลด/ยอดที่ต้องชำระที่หน้า Cart\n2. เทียบค่าเดียวกันตลอด Flow เดียวกับ TC-E2E-SYNC-001",
     "✅ ทดสอบจริงแล้ว (Bank Transfer): ยอด 210.00 ถูกต้องตรงกันทุกหน้าตลอด Flow (Cart Shopping→Payment→User Cart list→Admin Cart→Admin Order)"),
]

# ── Test Plan content (จาก docs/test-cases/Arincare_MedEx_ProductCardInCartBadge_TestPlan.md) ──
TITLE_FONT = Font(name="Tahoma", bold=True, size=14, color="1F4E78")
SECTION_FONT = Font(name="Tahoma", bold=True, size=12, color="1F4E78")
SUBHEAD_FONT = Font(name="Tahoma", bold=True, size=10, color="1F4E78")

PLAN_META = [
    ("เลขที่", "TP-MEDEX-2026-01"),
    ("Feature", "Product Card In-Cart Badge (Cart Popup + Green Status Badge)"),
    ("Platform", "Med-Ex Marketplace (Web) — https://app-stg.arincare.com/companies/marketplace"),
    ("QA", "Watcharin"),
    ("วันที่", "2026-09-07"),
]

PLAN_SCOPE_IN = [
    "1. Cart Summary Popup — เปิดเมื่อกด \"ตะกร้าสินค้าของฉัน\" (ไอคอนรถเข็นบน header): "
    "จำนวนรายการในตะกร้า, เลขคำสั่งซื้อ, รายการสินค้า, จำนวน, ราคา, ยอดรวมทั้งหมด, ยอดรวมย่อย, "
    "ปุ่ม \"ดูตะกร้าสินค้า\", scroll เมื่อรายการเยอะ, พฤติกรรมมือถือ (แตะครั้งแรก=popup ครึ่งจอ, แตะซ้ำ=ไปหน้าตะกร้าเต็ม)",
    "2. In-Cart Badge บน Product Card — ป้ายสีเขียว \"อยู่ในตะกร้าแล้ว · N กล่อง\" เมื่อสินค้าถูกเพิ่มลงตะกร้าแล้ว",
    "3. ความสอดคล้องของสถานะ (state sync) ระหว่าง: badge บนการ์ด ↔ popup ↔ ไอคอนตะกร้า ↔ หน้าตะกร้าเต็ม",
]
PLAN_SCOPE_OUT = [
    "Checkout flow / การชำระเงินจริง (ทดสอบแยกใน suite อื่น)",
    "โปรโมชั่น/คูปองส่วนลดที่มีผลต่อราคา (นอกจากตรวจว่าตัวเลขที่ popup แสดงตรงกับหน้าตะกร้า)",
    "POS-v2 / Web-App ERP (feature นี้อยู่บน Med-Ex Marketplace เท่านั้น)",
]
PLAN_GOALS = [
    "Pass rate ≥ 95%, Critical bug = 0 ก่อนขึ้น production",
    "Badge/popup/cart ต้องแสดงยอดตรงกันเสมอ ไม่มี race condition ที่ทำให้ตัวเลขไม่ตรงกัน (ความเสี่ยงหลักของฟีเจอร์นี้)",
]

PLAN_RULES_HEADERS = ["#", "คำถาม", "คำตอบที่ยืนยันแล้ว", "ผลต่อ Test Design"]
PLAN_RULES = [
    ("1", "เลขคำสั่งซื้อ (#OR-260907-0017) ใน popup คืออะไร?",
     "เป็นตัวอย่าง (mock/placeholder) ไม่ใช่ draft order ที่ผูกกับ backend จริง",
     "ไม่ต้องทดสอบ order-number persistence/uniqueness อย่างเข้มงวด — ตรวจแค่ว่ามีเลขแสดงและไม่เปลี่ยนกลางคันระหว่างเปิด popup ค้างไว้ก็พอ"),
    ("2", "สินค้าเดียวกัน หน่วยขายต่างกัน (กล่อง/แผง/หลอด) → แยก line หรือรวม?",
     "ยอดจะเปลี่ยนไปตามหน่วยที่เลือกล่าสุด — ระบบใช้ 1 line ต่อสินค้า คำนวณ/แสดงตามหน่วยล่าสุดที่เลือก ไม่สะสมแยกหน่วย",
     "Badge/popup ต้องแสดงหน่วยและจำนวนของการเลือกล่าสุดเท่านั้น ต้องมีเคสตรวจว่าเปลี่ยนหน่วยแล้วค่าเก่าไม่ค้าง/ไม่บวกซ้ำ"),
    ("3", "Sync ข้าม tab/session แบบ real-time หรือไม่?",
     "Sync เฉพาะตอน reload หน้าเท่านั้น ไม่ใช่ real-time",
     "ตัด multi-tab real-time ออกจาก scope — ทดสอบว่า \"หลัง reload แล้วต้อง sync ถูกต้อง\" แทน"),
    ("4", "สินค้ากลายเป็น Out of Stock ภายหลัง badge/popup ต้องทำอย่างไร?",
     "คงไว้เฉยๆ เพราะถือว่าจองสิทธิ์ไว้แล้ว คำนวณใหม่เฉพาะตอนไปหน้าตะกร้าแล้วกดชำระเงินเท่านั้น",
     "Badge/popup ไม่ต้องอัปเดตสถานะ stock แบบ real-time — จุดตรวจ stock จริงย้ายไปที่ step \"กดชำระเงิน\""),
    ("5", "Mobile \"แตะซ้ำ\" หมายถึงอะไร?",
     "แตะเมื่อใดก็ได้ตราบใด popup ยังเปิดอยู่ ไม่จำกัดเวลา",
     "Test case ต้องครอบคลุมแตะซ้ำทั้งแบบเร็วติดกันและเว้นช่วงนาน ตราบใด popup ยังไม่ถูกปิด ต้อง navigate ไปหน้าตะกร้าเสมอ"),
    ("6", "ยอดรวมใน popup รวม VAT/ส่วนลดไหม?",
     "ไม่รวม — เป็นแค่ราคาสินค้า x จำนวน ก่อนคำนวณจริงตอน checkout",
     "ยอดรวมใน popup ไม่จำเป็นต้อง match กับยอดชำระจริงหลัง checkout — เทียบกับหน้าตะกร้า (ก่อนคำนวณ) เท่านั้น"),
]

PLAN_STRATEGY_HEADERS = ["Test Type", "Approach"]
PLAN_STRATEGY = [
    ("Functional (Popup)", "Manual black-box ตาม AC + automated Playwright regression"),
    ("Functional (Badge)", "Manual + automated — เน้น state sync กับ 4 จุด (card / popup / icon counter / cart page)"),
    ("UI/Visual", "Manual — สี badge (สีเขียวตาม design system), ตำแหน่ง, responsive breakpoint"),
    ("Integration", "Automated — ทดสอบ cart API ↔ UI state ให้ตรงกันจริง ไม่ใช่แค่ mock"),
    ("Cross-browser/Device", "Chrome, Safari (iOS), มือถือ Android/iOS จริงหรือ emulator"),
    ("Regression", "รวมเข้า Med-Ex regression suite — ดูรายการบั๊กที่เคยพบบน platform นี้ในหัวข้อ Risk"),
    ("Concurrency", "Manual/exploratory — multi-tab, rapid click +/-"),
]

PLAN_ENTRY = [
    "[x] Business rule ยืนยันครบแล้ว",
    "[ ] Feature deploy บน Med-Ex Staging (app-stg.arincare.com/companies/marketplace) แล้ว",
    "[ ] มีบัญชีทดสอบที่มีสินค้าให้เพิ่มลงตะกร้าได้จริง",
    "[ ] Staging มีสินค้าอย่างน้อย: 1 รายการปกติ, 1 รายการที่มีหลายหน่วยขาย (กล่อง/แผง), 1 รายการ Out of Stock",
]
PLAN_EXIT = [
    "[ ] Pass rate ≥ 95%, Critical/Major bug = 0 (open)",
    "[ ] Badge, Popup, ไอคอนตะกร้า, หน้าตะกร้าเต็ม แสดงตัวเลขตรงกันทุกกรณีที่ทดสอบ (Critical หากไม่ตรง)",
    "[ ] Regression suite เดิมของ Med-Ex (ถ้ามี) ผ่าน 100%",
    "[ ] ทดสอบ responsive มือถือผ่านครบตาม breakpoint ที่ยืนยันแล้ว",
]

PLAN_RISK_HEADERS = ["#", "ความเสี่ยง", "โอกาส", "ผลกระทบ", "Mitigation"]
PLAN_RISKS = [
    ("R1", "Badge/Popup/ไอคอนตะกร้า แสดงตัวเลขไม่ตรงกัน (state desync) เมื่อเพิ่ม/ลบ/แก้จำนวนพร้อมกันจากหลายจุด",
     "สูง", "สูง (ผู้ใช้สั่งซื้อผิดจำนวน)", "ทดสอบ cross-check ทุก action, ทำเป็น regression case ถาวร"),
    ("R2", "เปลี่ยนหน่วยขาย (กล่อง/แผง/หลอด) แล้ว badge/popup ค้างค่าหน่วยก่อนหน้า หรือบวกซ้ำแทนที่จะแทนที่",
     "กลาง", "สูง", "ทดสอบ \"เปลี่ยนหน่วยแล้วค่าต้องแทนที่ ไม่สะสม\" ตามกฎที่ยืนยันแล้ว"),
    ("R3", "Mobile tap-once-vs-twice logic ทำงานผิด (เผลอ navigate ไปหน้าตะกร้าทั้งที่ตั้งใจแค่ดู popup)",
     "กลาง", "กลาง (UX เสีย)", "ทดสอบแตะปุ่มซ้ำได้ทุกเมื่อขณะ popup ยังเปิดอยู่ ทั้งแบบเร็วติดกันและเว้นช่วงนาน"),
    ("R4", "Popup scroll พังเมื่อสินค้าในตะกร้าเยอะมาก (เช่น 50+ รายการ)",
     "ต่ำ-กลาง", "กลาง", "Boundary test ด้วยจำนวนรายการมาก"),
    ("R5", "Modal ซ้อนทับกับ modal อื่นบนแพลตฟอร์มเดียวกัน (เคยพบปัญหานี้จริงกับ Popup Notification บน Med-Ex)",
     "กลาง", "กลาง", "ทดสอบร่วมกับสถานการณ์ที่มี popup/modal อื่นแสดงพร้อมกัน"),
    ("R6", "Popup แสดงยอดรวมไม่ตรงกับหน้าตะกร้าก่อนคำนวณ (คนละเรื่องกับ checkout ที่มี VAT/ส่วนลด ซึ่งไม่ต้อง match)",
     "ต่ำ-กลาง", "กลาง", "เทียบ popup กับหน้าตะกร้า (ราคา x จำนวน ล้วนๆ) เท่านั้น"),
    ("R7", "สินค้า Out of Stock ที่ยังคงแสดงในตะกร้า (ตามดีไซน์) แต่กลับไปคำนวณ/บล็อกผิดเวลา",
     "ต่ำ", "กลาง", "ยืนยันว่า badge/popup ไม่มีการเช็ค stock ระหว่างทาง มีแค่ตอนกดชำระเงินเท่านั้น"),
    ("R8", "Performance: popup โหลดช้าเมื่อสินค้าในตะกร้าเยอะ ทำให้ผู้ใช้กดซ้ำ",
     "ต่ำ", "กลาง", "วัดเวลาโหลด popup, ทดสอบ rapid click"),
]

PLAN_SCENARIO_GROUPS = [
    ("7.1 Cart Summary Popup (TC-BADGE-P01–P09)",
     "เปิด popup เมื่อตะกร้าว่าง/มีสินค้า, หลายรายการ, scroll เมื่อรายการเยอะ, ปุ่มดูตะกร้าสินค้า, "
     "ปิด popup, พฤติกรรมมือถือ (ครึ่งจอ + แตะซ้ำ), popup ต้องไม่ค้างค่าเก่า"),
    ("7.2 In-Cart Badge บน Product Card (TC-BADGE-C01–C07, C06B)",
     "badge ขึ้นทันทีเมื่อเพิ่มสินค้า, อัปเดตเมื่อเพิ่ม/ลด, หายเมื่อเอาออก, คงอยู่หลัง refresh, "
     "ไม่ขึ้นผิดใบ, เปลี่ยนหน่วยขายต้องแทนที่ไม่สะสม, ตรงกันทุกจุดที่การ์ดปรากฏซ้ำ"),
    ("7.3 State Sync — Critical R1 (TC-BADGE-S01–S05)",
     "badge/ไอคอนตะกร้า/popup/หน้าตะกร้าเต็มต้องตรงกันเสมอ, ลบ/แก้จากหน้าตะกร้าเต็มต้องสะท้อนกลับที่ card, "
     "multi-tab sync เฉพาะหลัง reload, rapid click ต้องไม่มี race condition"),
    ("7.4 Edge Cases / Negative (TC-BADGE-E01–E04, E01B)",
     "Out of Stock คงในตะกร้าเฉยๆจนกว่าจะกดชำระเงิน, หลายผู้ผลิตในบิลเดียว, เกิน stock คงเหลือ, session หมดอายุ/เปลี่ยน user"),
    ("7.5 Responsive / Cross-Device (TC-BADGE-R01–R03)",
     "Desktop ≥1280px, Tablet breakpoint, มือถือจริง iOS Safari + Android Chrome"),
]

PLAN_SCHEDULE_HEADERS = ["Activity", "Owner"]
PLAN_SCHEDULE = [
    ("เขียน Test Case ละเอียด (business rule ยืนยันแล้ว)", "QA"),
    ("Manual execution รอบแรก", "QA"),
    ("เขียน Playwright automation (regression หลัก: 7.1–7.3)", "QA"),
    ("Bug fix & retest", "Dev + QA"),
    ("Regression + Sign-off", "QA + PM"),
]

PLAN_ENV = [
    ("URL", "https://app-stg.arincare.com/companies/marketplace?page=1 (ต้อง Login Web-App + เลือกบริษัทก่อน — ไม่ต้องเลือกสาขา ไปที่ URL นี้ได้เลย)"),
    ("Account", "ใช้บัญชีทดสอบ ERP เดิม (TEST_USERNAME/TEST_PASSWORD ใน .env) ที่มีสิทธิ์เข้า Med-Ex Marketplace"),
    ("Browser", "Chrome latest (หลัก), Safari iOS (mobile scenario)"),
    ("Tools", "Playwright + TypeScript"),
]

PLAN_NOTES = [
    "Med-Ex Marketplace เป็น platform ที่เพิ่งเพิ่มเข้ามาในระบบ (2026-08-31) และเคยพบปัญหา delay/caching กับฟีเจอร์อื่น "
    "(Popup Notification) — ควรถือเป็นความเสี่ยงร่วมด้าน performance/caching สำหรับฟีเจอร์นี้ด้วย",
    "ห้ามใช้ข้อมูล production หรือบัญชีอื่นที่ไม่ใช่บัญชีทดสอบของทีมในการทดสอบบน staging",
]

PLAN_AUTOMATION_HEADLINE = (
    "ผลรันล่าสุด (2026-09-07): 34 Pass / 0 Fail / 26 Skip ข้าม 3 device (Desktop Chrome, "
    "Mobile Chrome-Android, Mobile Safari-iPhone) — ไฟล์: tests/medex/product-card-in-cart-badge.spec.ts"
)
PLAN_AUTOMATION_CORRECTION = (
    "🟢 แก้ไขข้อสรุปที่เคยผิดระหว่างทาง: เคยสรุปว่า \"มือถือไม่มี popup ครึ่งจอ แตะแล้ว navigate ตรงไปหน้าตะกร้าเต็ม\" "
    "— ผิด ยืนยันซ้ำแล้วว่ามือถือมี popup เหมือน Desktop ทุกประการ (แตะครั้งแรก=popup, แตะซ้ำ=ไปตะกร้า) ตรงตาม mockup เดิม"
)
PLAN_AUTOMATION_FINDINGS = [
    "โปรโมชั่นบางตัวมี modal ยืนยันคั่นก่อนเพิ่มลงตะกร้าจริง — ต้อง verify ว่า modal ปิดจริงหลังคลิก \"ตกลง\" "
    "(รอปุ่มหายไป) ไม่ใช่คลิกแล้วเดาว่าสำเร็จ เคยเจอคลิกไม่ error แต่ modal ไม่ปิดจริง",
    "ช่องค้นหาต้องคลิก suggestion แรกใน autocomplete dropdown (ห้ามใช้ปุ่ม \"ค้นหา\"/กด Enter) และต้องรอ debounce "
    "~1 วินาทีก่อนเช็ค dropdown ไม่งั้นอาจกดผิดสินค้าจาก query ก่อนหน้าที่ค้างอยู่",
    "พบข้อมูลสินค้าซ้ำในแคตตาล็อกข้ามร้านค้า (PROSCAR, TANSY) — ร้านหนึ่งมีสต็อกจริง อีกร้าน Out of Stock "
    "ต้องข้าม Out of Stock อัตโนมัติ + กรองด้วยชื่อสินค้าที่คาดหวังตอนค้นหา",
    "การ์ดสินค้าบนหน้า list มี control ครบ (หน่วย/จำนวน/ปุ่มเพิ่ม) เฉพาะ Desktop เท่านั้น มือถือต้องแตะเข้าไปหน้า"
    "รายละเอียดสินค้าก่อนเสมอ (คนละ component/selector กันสิ้นเชิง)",
    "PHP Debugbar (dev toolbar ของ staging เอง) ต้องซ่อนด้วย CSS ตั้งแต่ต้น ไม่งั้น intercept การคลิก",
    "Headless Chromium โดน nginx บล็อก (403) บน staging นี้ — ต้องรันแบบ headless: false เท่านั้น",
]


def write_table(ws, row, headers, data_rows, col_widths, header_col_start=1):
    for col, (h, w) in enumerate(zip(headers, col_widths), start=header_col_start):
        c = ws.cell(row, col, h)
        c.fill = HEADER_FILL
        c.font = HEADER_FONT
        c.alignment = CENTER
        c.border = BORDER
        ws.column_dimensions[get_column_letter(col)].width = max(
            ws.column_dimensions[get_column_letter(col)].width or 0, w)
    row += 1
    for data in data_rows:
        for col, val in enumerate(data, start=header_col_start):
            c = ws.cell(row, col, val)
            c.border = BORDER
            c.font = BODY_FONT
            c.alignment = WRAP_TOP
        ws.row_dimensions[row].height = 60
        row += 1
    return row + 1


def write_bullets(ws, row, items, col=1):
    for item in items:
        c = ws.cell(row, col, "• " + item)
        c.font = BODY_FONT
        c.alignment = WRAP_TOP
        row += 1
    return row + 1


# ── Build workbook ───────────────────────────────────────────────────────────
wb = openpyxl.Workbook()

# --- Sheet 0: Test Plan ---
wp = wb.active
wp.title = "Test Plan"
wp.column_dimensions["A"].width = 30
wp.column_dimensions["B"].width = 30
wp.column_dimensions["C"].width = 30
wp.column_dimensions["D"].width = 40

r = 1
wp.cell(r, 1, "TEST PLAN — MedEx: Product Card (In-Cart Badge)").font = TITLE_FONT
r += 2

for k, v in PLAN_META:
    wp.cell(r, 1, k).font = BOLD_FONT
    wp.cell(r, 2, v).font = BODY_FONT
    wp.cell(r, 2).alignment = WRAP_TOP
    r += 1
r += 1

wp.cell(r, 1, "1. SCOPE & OBJECTIVES").font = SECTION_FONT
r += 1
wp.cell(r, 1, "ขอบเขตที่ทดสอบ (In Scope)").font = SUBHEAD_FONT
r += 1
r = write_bullets(wp, r, PLAN_SCOPE_IN)
wp.cell(r, 1, "ขอบเขตที่ยกเว้นรอบนี้ (Out of Scope)").font = SUBHEAD_FONT
r += 1
r = write_bullets(wp, r, PLAN_SCOPE_OUT)
wp.cell(r, 1, "เป้าหมาย").font = SUBHEAD_FONT
r += 1
r = write_bullets(wp, r, PLAN_GOALS)

wp.cell(r, 1, "2. CONFIRMED BUSINESS RULES — ยืนยันจากผู้ใช้งาน/PM แล้ว (2026-09-07)").font = SECTION_FONT
r += 1
r = write_table(wp, r, PLAN_RULES_HEADERS, PLAN_RULES, [6, 34, 34, 40])

wp.cell(r, 1, "3. TEST STRATEGY").font = SECTION_FONT
r += 1
r = write_table(wp, r, PLAN_STRATEGY_HEADERS, PLAN_STRATEGY, [24, 60])
wp.cell(r - 1, 1, "เครื่องมือ: Playwright + TypeScript — เพิ่มชุดใหม่ tests/medex/product-card-in-cart-badge.spec.ts").font = BODY_FONT
r += 1

wp.cell(r, 1, "4. ENTRY CRITERIA").font = SECTION_FONT
r += 1
r = write_bullets(wp, r, PLAN_ENTRY)
wp.cell(r, 1, "5. EXIT CRITERIA").font = SECTION_FONT
r += 1
r = write_bullets(wp, r, PLAN_EXIT)

wp.cell(r, 1, "6. RISK ANALYSIS").font = SECTION_FONT
r += 1
r = write_table(wp, r, PLAN_RISK_HEADERS, PLAN_RISKS, [6, 44, 10, 20, 40])

wp.cell(r, 1, "7. TEST SCENARIOS (สรุปกลุ่ม — รายละเอียดเต็มอยู่ใน sheet \"Test Cases\")").font = SECTION_FONT
r += 1
r = write_table(wp, r, ["กลุ่ม", "ครอบคลุม"], PLAN_SCENARIO_GROUPS, [34, 70])

wp.cell(r, 1, "8. TEST SCHEDULE").font = SECTION_FONT
r += 1
r = write_table(wp, r, PLAN_SCHEDULE_HEADERS, PLAN_SCHEDULE, [50, 16])

wp.cell(r, 1, "9. TEST ENVIRONMENT").font = SECTION_FONT
r += 1
for k, v in PLAN_ENV:
    wp.cell(r, 1, k).font = BOLD_FONT
    wp.cell(r, 2, v).font = BODY_FONT
    wp.cell(r, 2).alignment = WRAP_TOP
    r += 1
r += 1

wp.cell(r, 1, "10. หมายเหตุจาก QA Context ที่เกี่ยวข้อง").font = SECTION_FONT
r += 1
r = write_bullets(wp, r, PLAN_NOTES)

wp.cell(r, 1, "11. AUTOMATION STATUS (2026-09-07)").font = SECTION_FONT
r += 1
wp.cell(r, 1, PLAN_AUTOMATION_HEADLINE).font = BOLD_FONT
wp.cell(r, 1).alignment = WRAP_TOP
r += 1
wp.cell(r, 1, PLAN_AUTOMATION_CORRECTION).font = BODY_FONT
wp.cell(r, 1).alignment = WRAP_TOP
r += 2
wp.cell(r, 1, "พบเพิ่มเติมระหว่างเขียน automation").font = SUBHEAD_FONT
r += 1
r = write_bullets(wp, r, PLAN_AUTOMATION_FINDINGS)

wp.cell(r, 1, "12. ส่วนขยาย (2026-09-09): Cart Page — Price Calculation & Display Order Logic").font = SECTION_FONT
r += 1
wp.cell(r, 1, "นอกขอบเขตเดิม (หัวข้อ 1 เคยยกเว้นโปรโมชั่น/คูปอง) — ดูรายละเอียดสูตรคำนวณเต็มใน "
              "docs/test-cases/Arincare_MedEx_ProductCardInCartBadge_TestPlan.md หัวข้อ 12.1 (Test Data ใน sheet Test Cases มีตัวอย่างตัวเลขครบ)").font = BODY_FONT
wp.cell(r, 1).alignment = WRAP_TOP
r += 2
wp.cell(r, 1, "Logic สั้น: ราคาสินค้า → ส่วนลดรายตัว → Promotion (คิดจากยอดหลังหักส่วนลดรายตัว) → Coupon → "
              "ยอดสุทธิ (รวม VAT 7%) → แยกราคาก่อนภาษี/VAT — คอลัมน์ \"ราคาหลังลด\" ต่อบรรทัดต้องปันส่วนจากยอดสุทธิ "
              "ทั้งบิล ไม่ใช่แค่ส่วนลดรายตัว").font = BOLD_FONT
wp.cell(r, 1).alignment = WRAP_TOP
r += 2
wp.cell(r, 1, "ขอบเขตเต็ม — กระทบ 3 repo, 7 หน้าจอ").font = SUBHEAD_FONT
r += 1
PLAN_EXTENSION_SCOPE_HEADERS = ["Repo", "เมนู", "URL", "สิ่งที่เปลี่ยน"]
PLAN_EXTENSION_SCOPE = [
    ("arinlink", "คำสั่งซื้อ → รายละเอียดคำสั่งซื้อ", "/company/:companySlug/orders/:orderRef/detail",
     "ปรับ Summary ท้ายตารางตามสูตรใหม่ + รองรับ TH/EN"),
    ("web-app", "ตะกร้าสินค้า (Cart)", "/cart",
     "รวมคอลัมน์ code+name, เพิ่ม \"ราคาหลังลด\", กัน spinner ขาววาบ, Summary ครบ"),
    ("web-app", "รายการสั่งซื้อของฉัน → รายละเอียด", "/orders/:orderRef/detail",
     "เพิ่ม \"ราคาหลังลด\", right-align, เช็ค Lot/Expire modal, Summary ครบ"),
    ("web-app", "สรุปรายการสั่งซื้อ (Cart Detail)", "/cart/checkout/detail",
     "เพิ่ม \"ราคาหลังลด\", Summary ครบ"),
    ("web-app", "ชำระเงิน (Payment Summary) + Modal มือถือ", "/payment/summary",
     "Summary ต้องตรงกันทั้ง Desktop และ Modal มือถือ"),
    ("web-admin", "Sales Manage Order → PO List (Edit PO)", "/sales-manage-order/po/{uuid}",
     "เพิ่ม \"ราคาหลังลด\" ในตาราง PO, Summary ครบ"),
    ("web-admin", "Order Management → Order List", "/order-management/order/{id}",
     "Summary ท้ายตารางตามสูตรใหม่"),
]
r = write_table(wp, r, PLAN_EXTENSION_SCOPE_HEADERS, PLAN_EXTENSION_SCOPE, [14, 34, 40, 50])
wp.cell(r, 1, "⚠️ arinlink และ web-admin เป็น repo ใหม่ที่ยังไม่เคยสำรวจ selector/login flow ในเซสชันนี้ "
              "ต้องทำ discovery ก่อนเขียน automation ได้จริง").font = BODY_FONT
wp.cell(r, 1).alignment = WRAP_TOP
r += 2

wp.cell(r, 1, "13. ส่วนขยาย (2026-09-09): End-to-End Cart → Payment → Order (User + Admin)").font = SECTION_FONT
r += 1
wp.cell(r, 1, "ขอบเขตใหม่: ไม่ใช่แค่ความถูกต้องของตัวเลขราคา (หัวข้อ 12) แต่ต้องตรวจ Flow ทั้งกระบวนการซื้อ + สถานะ "
              "+ ความสอดคล้องของข้อมูลข้าม 8+ หน้าจอ ทั้งฝั่ง User และ Admin").font = BODY_FONT
wp.cell(r, 1).alignment = WRAP_TOP
r += 2

PLAN_E2E_URL_HEADERS = ["หน้า", "URL", "หมายเหตุ"]
PLAN_E2E_URLS = [
    ("ตะกร้า Shopping (User Cart)", "/companies/marketplace/cart", "✅ ยืนยันแล้วหัวข้อ 11 (34 เคส) — ใส่/ลบ/แก้จำนวนสินค้า มีปุ่ม ชำระเงิน"),
    ("การซื้อของฉัน → รายการตะกร้า", "/companies/marketplace/order-management/cart",
     "✅ สำรวจจริงแล้ว 2026-09-09 — คนละหน้ากับ /companies/marketplace/cart จริง (checkout-history list ไม่ใช่ shopping cart)"),
    ("ชำระเงิน (Payment)", "/companies/marketplace/payment", "✅ สำรวจ selector จริงครบแล้ว (3 tab QR/บัตรเครดิต/โอนผ่านธนาคาร)"),
    ("การซื้อของฉัน → Order", "/companies/marketplace/order-management/order", "✅ สำรวจแล้ว"),
    ("Admin Cart", "admin-stg.arincare.com/arinlink/order-management/cart?page=1", "✅ สำรวจแล้ว (คนละหน้ากับ PO ที่สำรวจในหัวข้อ 12.7.6)"),
    ("Admin Order", "admin-stg.arincare.com/arinlink/order-management/order?page=1", "✅ สำรวจแล้ว"),
]
r = write_table(wp, r, PLAN_E2E_URL_HEADERS, PLAN_E2E_URLS, [22, 46, 60])
r += 1

wp.cell(r, 1, "Business Rule ตามช่องทางชำระเงิน (ยืนยัน + Bank Transfer ทดสอบจริง end-to-end แล้ว)").font = SUBHEAD_FONT
r += 1
PLAN_E2E_PAYMENT_HEADERS = ["ช่องทาง", "หลังชำระ/ส่งหลักฐาน", "สถานะ Order", "Order ถูกสร้างเมื่อไหร่"]
PLAN_E2E_PAYMENT = [
    ("QR Code", "ชำระสำเร็จทันที", "ชำระเงินแล้ว", "ทันทีหลังชำระสำเร็จ (ยังไม่ทดสอบจริง — ไม่มี sandbox gateway)"),
    ("Credit Card", "ชำระสำเร็จทันที", "ชำระเงินแล้ว", "ทันทีหลังชำระสำเร็จ (ยังไม่ทดสอบจริง — ไม่มี sandbox gateway)"),
    ("Bank Transfer", "รายการยังอยู่ใน Cart list สถานะ \"รอตรวจสอบ\"", "ไม่ปรากฏใน Order Management",
     "✅ ทดสอบจริง end-to-end สำเร็จ 2026-09-09 — เลขที่ Order ถูกจองไว้ล่วงหน้าตั้งแต่หน้า Payment แต่ไม่โผล่ใน Order List "
     "จนกว่า Admin จะกดเปลี่ยนสถานะเป็น \"ชำระเงินแล้ว\""),
]
r = write_table(wp, r, PLAN_E2E_PAYMENT_HEADERS, PLAN_E2E_PAYMENT, [16, 30, 20, 55])
wp.cell(r, 1, "🔴 Bank Transfer คือช่องทางที่ซับซ้อนและมีความเสี่ยงสูงสุด — ✅ ทดสอบจริงครบ 2 checkpoint แล้ว (ก่อน/หลัง Admin approve) "
              "ผ่าน live E2E test จริงบน staging").font = BOLD_FONT
wp.cell(r, 1).alignment = WRAP_TOP
r += 2

wp.cell(r, 1, "✅ Live Discovery Findings หลัก (2026-09-09) — ดู docs/e2e-cart-payment-discovery/ สำหรับ screenshot/HTML ทุกขั้นตอน").font = SUBHEAD_FONT
r += 1
PLAN_E2E_FINDINGS = [
    "Cart list select-all checkbox: ต้องหาด้วย exact-text \"เลือกซื้อรายการสินค้า (เลือกทั้งหมด)\" แล้วใช้ XPath preceding-sibling หา input "
    "— input[type=checkbox].first() เฉยๆ จะไปโดนช่องอื่น (ที่อยู่ใบกำกับภาษี) แทน",
    "หน้า Cart Detail และ Order Detail มีคอลัมน์ \"ราคาหลังลด\" และ Summary 7 field ตรงกับสูตรหัวข้อ 12.1 เป๊ะ — ยืนยันด้วยข้อมูลจริง",
    "Bank Transfer modal มีฟิลด์เวลาเป็น input[placeholder=\"00\"] 2 ตัว (ชม./นาที แยกกัน) ไม่ใช่ time picker เดียว",
    "Admin Cart/Order List: Payment Status/Order Status เป็น Bootstrap dropdown เปลี่ยนได้ทันทีจาก list — แต่ <ul class=\"dropdown-menu\"> "
    "ถูก teleport ออกจาก <tr> ตอนเปิด ต้อง query แบบ global (ul.dropdown-menu:visible) ไม่ใช่ scope ในแถว",
    "เปลี่ยนสถานะ Admin Cart เป็น \"ชำระเงินแล้ว\" ต้องกรอกช่อง \"หมายเหตุ\" (textarea, required) ก่อน ไม่งั้นปุ่มบันทึกจะไม่ทำงาน "
    "แบบไม่มี error message ชัดเจน (native HTML5 validation)",
    "ยืนยัน end-to-end จริง: submit หลักฐานโอนเงิน (ไฟล์ jpg จริง) → เห็นสถานะ \"รอตรวจสอบ\" ทั้ง User+Admin ตรงกัน → Admin approve "
    "+ กรอกหมายเหตุ → Order ปรากฏใน Order List ทันที สถานะ \"รับออเดอร์แล้ว\"/\"ชำระเงินแล้ว\" ถูกต้องครบ",
]
for item in PLAN_E2E_FINDINGS:
    wp.cell(r, 1, f"• {item}").font = BODY_FONT
    wp.cell(r, 1).alignment = WRAP_TOP
    r += 1
r += 1

wp.cell(r, 1, "Open Items ที่ยังค้าง").font = SUBHEAD_FONT
r += 1
PLAN_E2E_OPEN_ITEMS = [
    "ต้องมีบัญชี/เครื่องมือทดสอบ QR Payment และ Credit Card Payment จริงบน staging (sandbox/mock gateway) — ยังทดสอบจริงไม่ได้",
    "ยืนยันกับ Dev ว่า QR/CC ย้ายรายการจาก Cart ไป Order ทันทีจริงหรือไม่ (คล้าย pattern ที่เห็นจาก Bank Transfer) — รอช่องทางทดสอบจริง",
]
for item in PLAN_E2E_OPEN_ITEMS:
    wp.cell(r, 1, f"• {item}").font = BODY_FONT
    wp.cell(r, 1).alignment = WRAP_TOP
    r += 1
r += 1

# --- Sheet 1: Test Cases ---
ws = wb.create_sheet("Test Cases")
headers = ["TC-ID", "Tab/หน้าจอ", "Priority", "Type", "Precondition",
           "Test Data", "Steps", "Expected Result", "Actual Result", "Status", "Notes"]
widths = [14, 24, 10, 16, 32, 24, 40, 44, 16, 11, 10]

for col, (h, w) in enumerate(zip(headers, widths), start=1):
    c = ws.cell(1, col, h)
    c.fill = HEADER_FILL
    c.font = HEADER_FONT
    c.alignment = CENTER
    c.border = BORDER
    ws.column_dimensions[get_column_letter(col)].width = w
ws.freeze_panes = "A2"

STATUS_STYLE = {
    "Pass": (PASS_FILL, PASS_FONT),
    "Pass*": (PASS_FILL, PASS_FONT),
    "Skip": (SKIP_FILL, SKIP_FONT),
    "Not Run": (NOTRUN_FILL, NOTRUN_FONT),
}

ALL_CASES = CASES + CARTPRICE_CASES + E2E_CASES

for i, (tc_id, tab, pri, typ, pre, data, steps, expected) in enumerate(ALL_CASES, start=2):
    result = AUTOMATION_RESULTS.get(tc_id)
    status = result[0] if result else "Not Run"
    note = result[1] if result else "Manual — ยังไม่ automate"
    # TC-BADGE-* automate ไว้ตั้งแต่ 2026-09-07 (หัวข้อ 11) — ที่เหลือทั้งหมด (CARTPRICE/E2E/PO-ADMIN)
    # automate ในรอบหลัง 2026-09-09 ทั้งหมด ห้าม fallback เป็น 09-07 เหมือนที่เคยเขียนผิดไว้
    pass_date = "2026-09-07" if tc_id.startswith("TC-BADGE-") else "2026-09-09"
    actual = f"ผ่านจริงบน staging {pass_date}" if status.startswith("Pass") else "-"
    row = [tc_id, tab, pri, typ, pre, data, steps, expected, actual, status, note]
    for col, val in enumerate(row, start=1):
        c = ws.cell(i, col, val)
        c.border = BORDER
        c.font = BOLD_FONT if col == 1 else BODY_FONT
        c.alignment = CENTER if col in (1, 3, 4, 9, 10) else WRAP_TOP
    status_cell = ws.cell(i, 10)
    fill, font = STATUS_STYLE.get(status, (NOTRUN_FILL, NOTRUN_FONT))
    status_cell.fill = fill
    status_cell.font = font
    ws.row_dimensions[i].height = 110

# --- Sheet 2: สรุป & Coverage ---
ws2 = wb.create_sheet("สรุป & Coverage")
ws2.column_dimensions["A"].width = 45
ws2.column_dimensions["B"].width = 14

def section_title(row, text):
    c = ws2.cell(row, 1, text)
    c.font = Font(name="Tahoma", bold=True, size=12, color="1F4E78")
    return row + 1

r = 1
r = section_title(r, "Test Case Summary — MedEx Product Card (In-Cart Badge)")
r += 1

pass_count = sum(1 for tc in ALL_CASES if AUTOMATION_RESULTS.get(tc[0], ("Not Run",))[0].startswith("Pass"))
skip_count = sum(1 for tc in ALL_CASES if AUTOMATION_RESULTS.get(tc[0], ("Not Run",))[0] == "Skip")
notrun_count = len(ALL_CASES) - pass_count - skip_count

meta = [
    ("Platform", "MedEx Marketplace (Product Card Badge) + ส่วนขยาย Price Calculation (arinlink/web-app/web-admin — หัวข้อ 12)"),
    ("อ้างอิง Test Plan", "docs/test-cases/Arincare_MedEx_ProductCardInCartBadge_TestPlan.md"),
    ("วันที่ออกแบบ Test Case", "2026-09-07 (Badge) / 2026-09-09 (Price Calculation)"),
    ("วันที่ execute จริง (Playwright automation)", "2026-09-07 (เฉพาะ Product Card Badge — ส่วนขยาย Price Calculation ยังไม่ automate)"),
    ("Device ที่ทดสอบ", "Desktop Chrome / Mobile Chrome-Android (Pixel 7) / Mobile Safari-iPhone (iPhone 13)"),
    ("สถานะ", f"Pass {pass_count} / Skip {skip_count} / Not Run (manual) {notrun_count}"),
    ("จำนวน Test Case ทั้งหมด", len(ALL_CASES)),
    ("  — Product Card Badge (7.1–7.5)", len(CASES)),
    ("  — Price Calculation ส่วนขยาย (12.4, 12.7)", len(CARTPRICE_CASES)),
    ("  — End-to-End Cart→Payment→Order ส่วนขยาย (13.4)", len(E2E_CASES)),
]
for k, v in meta:
    ws2.cell(r, 1, k).font = BOLD_FONT
    ws2.cell(r, 2, v).font = BODY_FONT
    ws2.cell(r, 1).border = BORDER
    ws2.cell(r, 2).border = BORDER
    r += 1

r += 1
r = section_title(r, "สรุปตาม Priority")
ws2.cell(r, 1, "Priority").font = HEADER_FONT
ws2.cell(r, 1).fill = HEADER_FILL
ws2.cell(r, 2, "จำนวน").font = HEADER_FONT
ws2.cell(r, 2).fill = HEADER_FILL
r += 1
pri_counts = Counter(c[2] for c in ALL_CASES)
for pri in ["Critical", "High", "Medium", "Low"]:
    if pri in pri_counts:
        ws2.cell(r, 1, pri).font = BODY_FONT
        ws2.cell(r, 2, pri_counts[pri]).font = BODY_FONT
        r += 1
ws2.cell(r, 1, "รวม").font = BOLD_FONT
ws2.cell(r, 2, len(ALL_CASES)).font = BOLD_FONT
r += 2

r = section_title(r, "สรุปตามประเภท (Type)")
ws2.cell(r, 1, "Type").font = HEADER_FONT
ws2.cell(r, 1).fill = HEADER_FILL
ws2.cell(r, 2, "จำนวน").font = HEADER_FONT
ws2.cell(r, 2).fill = HEADER_FILL
r += 1
type_counts = Counter(c[3] for c in ALL_CASES)
for t, n in sorted(type_counts.items()):
    ws2.cell(r, 1, t).font = BODY_FONT
    ws2.cell(r, 2, n).font = BODY_FONT
    r += 1
r += 1

r = section_title(r, "สรุปตามกลุ่ม Scenario")
group_counts = Counter(c[0].split("-")[2][0] for c in CASES)  # P/C/S/E/R prefix letter
label_map = {"P": "Cart Summary Popup", "C": "In-Cart Badge บน Product Card",
             "S": "State Sync (Cross-check)", "E": "Edge Cases / Negative", "R": "Responsive / Cross-Device"}
ws2.cell(r, 1, "กลุ่ม").font = HEADER_FONT
ws2.cell(r, 1).fill = HEADER_FILL
ws2.cell(r, 2, "จำนวน").font = HEADER_FONT
ws2.cell(r, 2).fill = HEADER_FILL
r += 1
for k in ["P", "C", "S", "E", "R"]:
    if k in group_counts:
        ws2.cell(r, 1, label_map[k]).font = BODY_FONT
        ws2.cell(r, 2, group_counts[k]).font = BODY_FONT
        r += 1
r += 1

r = section_title(r, "สรุปตามหน้าจอ/Repo (ส่วนขยาย Price Calculation — หัวข้อ 12)")
ws2.cell(r, 1, "หน้าจอ").font = HEADER_FONT
ws2.cell(r, 1).fill = HEADER_FILL
ws2.cell(r, 2, "จำนวน").font = HEADER_FONT
ws2.cell(r, 2).fill = HEADER_FILL
r += 1
page_counts = Counter(c[1] for c in CARTPRICE_CASES)
for page, n in page_counts.items():
    ws2.cell(r, 1, page).font = BODY_FONT
    ws2.cell(r, 2, n).font = BODY_FONT
    r += 1
ws2.cell(r, 1, "รวม (ส่วนขยาย)").font = BOLD_FONT
ws2.cell(r, 2, len(CARTPRICE_CASES)).font = BOLD_FONT
r += 2

r = section_title(r, "สรุปตามหน้าจอ (ส่วนขยาย End-to-End Cart→Payment→Order — หัวข้อ 13)")
ws2.cell(r, 1, "หน้าจอ").font = HEADER_FONT
ws2.cell(r, 1).fill = HEADER_FILL
ws2.cell(r, 2, "จำนวน").font = HEADER_FONT
ws2.cell(r, 2).fill = HEADER_FILL
r += 1
e2e_page_counts = Counter(c[1] for c in E2E_CASES)
for page, n in e2e_page_counts.items():
    ws2.cell(r, 1, page).font = BODY_FONT
    ws2.cell(r, 2, n).font = BODY_FONT
    r += 1
ws2.cell(r, 1, "รวม (E2E ส่วนขยาย)").font = BOLD_FONT
ws2.cell(r, 2, len(E2E_CASES)).font = BOLD_FONT
r += 2

r = section_title(r, "สถานะหลัง Execute จริง (2026-09-07)")
prep_notes = [
    "[เสร็จแล้ว] TC-BADGE-P07/P08 (Mobile popup) — automated และ Pass จริงบน Mobile Chrome (Pixel 7 emulation) "
    "และ Mobile Safari (iPhone 13 emulation) ผ่าน Playwright device emulation ไม่ต้องใช้อุปกรณ์จริงแล้ว "
    "(ยกเว้นอยากทวนซ้ำบนเครื่องจริงเพื่อความมั่นใจสูงสุดก่อน sign-off)",
    "[เสร็จแล้ว] TC-BADGE-C06/C06B (หลายหน่วยขาย) — automated แบบ dynamic-skip ไล่เช็ค 12 SKU candidate อัตโนมัติ "
    "เลือกตัวแรกที่มี dropdown หน่วยมากกว่า 1 ตัวเลือกจริง ไม่ต้องเช็คมือแล้ว",
    "[ยังไม่ automate] TC-BADGE-E01/E01B (Out of Stock) — ยังเป็น manual รายชื่อสินค้า Out of Stock: หลัก "
    "CITAZOL TABLETS 50 mg. (PCO12253) + สำรองอีก 4 SKU ดู Test Data ในเคส",
    "[ยังไม่ automate] TC-BADGE-R01–R03 อื่นที่ไม่ใช่ popup (เช่น layout ทั่วไปไม่ล้นจอ) — ยังเป็น manual",
    f"[อัปเดต 2026-09-09] ส่วนขยาย Price Calculation (TC-CARTPRICE-*, TC-CARTUI-*, TC-ORDERDETAIL-*, "
    "TC-CARTCHECKOUT-*, TC-PAYMENT-*, TC-PO-ADMIN-*, TC-ORDER-ADMIN-*) — ออกแบบเป็น Scenario ครบแล้วทั้งหมด "
    f"({len(CARTPRICE_CASES)} เคส) รวมเคสโปรโมชั่น/คูปองจริง 9 เคส (TC-CARTPRICE-013–021) ที่ได้ข้อมูลจากผู้ใช้แล้ว และ selector "
    "จริงของ arinlink/web-admin PO page (หัวข้อ 12.7.6) — ยังไม่ automate เป็น Playwright spec ถาวร เหลือรอแค่ business rule "
    "การ stack โปรโมชั่น/คูปองหลายตัว (ดู Open Item #3 หัวข้อ 12.5) ก่อนล็อก assertion",
    f"[เสร็จแล้ว 2026-09-09] ส่วนขยาย End-to-End Cart→Payment→Bank Transfer (TC-E2E-CART-003/PAYMENT-001/BANK-001–004/"
    "MYPURCHASE-002/SYNC-001–002, 9 จาก 17 เคส) — automated เป็น regression suite ถาวรแล้วที่ "
    "tests/medex/cart-payment-bank-transfer-e2e.spec.ts (Desktop only) รัน Pass จริงครบ 4 เทสบน staging รวมถึงส่ง "
    "หลักฐานการโอนเงินจริง + Admin approve จริง + ตรวจ Order ปรากฏจริงทุกจุด (Page Object ใหม่: MedExPaymentPage.ts, "
    "AdminOrderManagementPage.ts) — เหลือ TC-E2E-QR-001/CC-001/CART-001-002/ADMIN-CART-001/ADMIN-ORDER-001/"
    "MYPURCHASE-001/003 ที่ยังไม่ automate (บางส่วนติด Open Item เรื่อง sandbox gateway)",
]
for note in prep_notes:
    ws2.cell(r, 1, "• " + note).font = BODY_FONT
    ws2.cell(r, 1).alignment = WRAP_TOP
    r += 1

wb.save(OUT)
print(f"Saved: {OUT}")
print(f"Test Cases: {len(ALL_CASES)} (Badge: {len(CASES)}, Price Calculation ส่วนขยาย: {len(CARTPRICE_CASES)}, "
      f"End-to-End ส่วนขยาย: {len(E2E_CASES)})")
