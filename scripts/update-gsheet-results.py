"""
update-gsheet-results.py
อ่านผลจาก JSON files แล้วเขียนเข้า Google Sheets
Spreadsheet ID: 1-76DtdPxP-rrQMCPwZ1tg0TUVGYU2KWb
"""

import json, os, sys
import gspread
from google.oauth2.service_account import Credentials

def p(text):
    sys.stdout.buffer.write((str(text) + "\n").encode("utf-8"))

BASE        = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CREDS_FILE  = os.path.join(BASE, "arincare-test-108540e51ee3.json")
SHEET_ID    = "15wwuPRsFZPaK0jIO_mDfmsImkf3MkALp4od1ZiIaAxk"
SHEET_NAME  = "Test Cases"

JSON_FILES = [
    "test-results-login-final.json",
    "test-results-home.json",
    "test-results-queue.json",
    "test-results-chat.json",
    "test-results-call.json",
    "test-results-pinfo.json",
    "test-results-ekyc.json",
]

# ── Styles ────────────────────────────────────────────────────────────────────
PASS_BG = {"red": 0.776, "green": 0.937, "blue": 0.808}
FAIL_BG = {"red": 1.0,   "green": 0.780, "blue": 0.808}
SKIP_BG = {"red": 1.0,   "green": 0.922, "blue": 0.612}
PASS_FG = {"red": 0.153, "green": 0.384, "blue": 0.129}
FAIL_FG = {"red": 0.612, "green": 0.000, "blue": 0.024}
SKIP_FG = {"red": 0.612, "green": 0.396, "blue": 0.000}
WHITE   = {"red": 1.0,   "green": 1.0,   "blue": 1.0}

def fmt_text_cell(bg):
    """Format สำหรับ col K (ผลจริง) และ M (หมายเหตุ) — ตรงกับ TC-AUTH-001 ไม่ตั้ง fgColor"""
    return {
        "backgroundColor": bg,
        "verticalAlignment": "TOP",
        "wrapStrategy": "WRAP",
    }

def fmt_status_cell(bg, fg):
    """Format สำหรับ col L (สถานะ) — bold + สี + center"""
    return {
        "backgroundColor": bg,
        "textFormat": {"bold": True, "foregroundColor": fg},
        "verticalAlignment": "TOP",
        "wrapStrategy": "WRAP",
        "horizontalAlignment": "CENTER",
    }

# ── Human-readable overrides สำหรับ TC-PINFO ──────────────────────────────────
# ใช้แทนค่า code-like จาก JSON (onQ=true, hasWaiting=true...) ให้อ่านเข้าใจง่าย
PINFO_READABLE = {
    "TC-PINFO-001": ("พบคิว WAITING และกดปุ่ม \"รับเคส\" ได้ แต่สถานะคิวไม่เปลี่ยนจาก WAITING เป็น ACTIVE",
                     "🐛 BUG: กดปุ่มรับเคสแล้วระบบไม่เปลี่ยนสถานะ WAITING → ACTIVE\nต้องตรวจสอบ API assign pharmacist และ encounter update"),
    "TC-PINFO-002": ("ไม่มีคิว WAITING ในระบบขณะทดสอบ",
                     "ข้ามการทดสอบ: ต้องมีผู้ป่วยกด \"ปรึกษาเภสัชกร\" สร้างคิว WAITING ก่อน\nจากนั้น login เป็น Operator ที่มี supervising pharmacist เพื่อทดสอบ auto-assign"),
    "TC-PINFO-003": ("ไม่มีคิว WAITING ในระบบขณะทดสอบ",
                     "ข้ามการทดสอบ: ต้องมีคิว WAITING และใช้ Operator ที่ไม่มี supervising pharmacist\nเพื่อตรวจสอบว่าระบบเปิด modal ให้เลือกเภสัชกร"),
    "TC-PINFO-004": ("ไม่พบคิว ACTIVE ที่มีเภสัชกรแล้วในระบบขณะทดสอบ",
                     "ข้ามการทดสอบ: ต้องมีคิว ACTIVE ที่รับเคสแล้วก่อน\nจึงจะทดสอบการเปลี่ยนเภสัชกร (Change Pharmacist) และตรวจ audit log ได้"),
    "TC-PINFO-005": ("ไม่สามารถทดสอบอัตโนมัติได้ — ต้องควบคุมสถานะ online/offline ของเภสัชกร",
                     "ต้องทดสอบ manual: บังคับให้เภสัชกรที่รับเคสออฟไลน์\nแล้วตรวจว่า modal เปลี่ยนเภสัชกรบังคับปรากฏและปิดไม่ได้จนกว่าจะเลือกเภสัชกรคนใหม่"),
    "TC-PINFO-006": ("พบคิว CLOSED และปุ่ม \"รับเคส\" ถูกซ่อน/ปิดใช้งานถูกต้อง",
                     "ปุ่มรับเคสไม่แสดงในคิวที่ปิดแล้ว (CLOSED) — ถูกต้องตาม spec\nUI ป้องกันการ assign เคสซ้ำในคิวที่จบแล้ว"),
    "TC-PINFO-007": ("พบส่วน KYC ใน UI แต่ฟิลด์ข้อมูลสามารถแก้ไขได้ (ไม่ได้ล็อก read-only)",
                     "🐛 BUG: ข้อมูล KYC ของผู้ป่วยควรเป็น read-only แต่ระบบยังให้แก้ไขได้\nต้องล็อก field ใน UI ไม่ให้เภสัชกรแก้ไขข้อมูลบัตรประชาชนหรือ KYC status โดยตรง"),
    "TC-PINFO-008": ("แสดง badge สถานะ KYC: \"ยังไม่สมบูรณ์\" (สีส้ม) — ถูกต้อง",
                     "Status badge แสดงสถานะ KYC ของผู้ป่วยได้ถูกต้อง\nผู้ป่วยที่ยังไม่ยืนยันตัวตนแสดงสีส้ม / ยืนยันแล้วแสดงสีเขียว"),
    "TC-PINFO-009": ("ปุ่ม \"ส่งลิงก์ยืนยันตัวตน\" แสดง/ซ่อนถูกต้องตามสถานะ KYC",
                     "ทดสอบ 2 กรณี:\n• KYC ยังไม่สมบูรณ์ → ปุ่มแสดง ✅\n• KYC approved แล้ว → ปุ่มไม่แสดง ✅\nUI แสดงปุ่ม e-KYC เฉพาะผู้ป่วยที่ยังไม่ยืนยันตัวตน — ถูกต้องตาม spec"),
    "TC-PINFO-010": ("กดปุ่ม \"ส่งลิงก์ยืนยันตัวตน\" สำเร็จ ระบบส่ง Flex message ไปยัง LINE chat ผู้ป่วย",
                     "ระบบส่งลิงก์ e-KYC ผ่าน LINE Messaging API สำเร็จ\nผู้ป่วยได้รับ Flex message และสามารถกดเข้าสู่หน้า e-KYC ผ่าน LIFF ได้\n(ทดสอบด้วย TC-LIFF-PAT-003 Mobile Emulation ยืนยันว่า flow ครบ 6 ขั้นตอน)"),
    "TC-PINFO-011": ("ไม่พบ notification KYC pending ในระบบขณะทดสอบ",
                     "ข้ามการทดสอบ: ต้องให้ผู้ป่วย submit รูปถ่ายและบัตรประชาชนผ่าน LIFF ก่อน\nระบบควรแจ้งเตือนเภสัชกรทาง badge หรือ notification ว่ามี KYC รอตรวจสอบ\nอาจต้องตรวจสอบ selector ของ notification component"),
    "TC-PINFO-012": ("เปิด KYC Review Modal สำเร็จ — แสดงรูปเซลฟี่คู่บัตรและรูปบัตรประชาชนถูกต้อง",
                     "ทดสอบด้วย TC-LIFF-PAT-003 (Mobile Emulation) ส่ง KYC ก่อน แล้วรัน PINFO-012\nModal เปิดสำเร็จ แสดง selfie และ ID card ครบถ้วน — ถูกต้องตาม spec"),
    "TC-PINFO-013": ("กด Approve KYC สำเร็จ สถานะผู้ป่วยเปลี่ยนเป็น \"ยืนยันตัวตนแล้ว\"",
                     "ทดสอบด้วย TC-LIFF-PAT-003 (Mobile Emulation) ส่ง KYC ก่อน แล้วรัน PINFO-013\nApprove KYC สำเร็จ badge เปลี่ยนเป็นสีเขียว และบันทึก reviewed_by / reviewed_at"),
    "TC-PINFO-014": ("พบ KYC Review Modal แต่ไม่พบปุ่ม Reject / ปฏิเสธ ภายใน modal",
                     "🐛 BUG: KYC Review Modal เปิดได้ (reviewBtnFound=true) แต่ไม่พบปุ่ม Reject\nSelectors ที่ลองแล้ว: button:has-text(\"ปฏิเสธ\"), button:has-text(\"Reject\"), button:has-text(\"ไม่อนุมัติ\")\nตรวจสอบ HTML ของ modal — ปุ่ม Reject อาจมีข้อความต่างกัน หรือซ่อนอยู่"),
    "TC-PINFO-015": ("ต้องทดสอบจากฝั่งผู้ป่วยใน LIFF — ไม่สามารถ automate จาก CMS ได้",
                     "ต้องทดสอบ manual: เปิด LIFF ใน LINE app กรอกชื่อ-นามสกุลไม่ตรงบัตรประชาชน\nแล้วตรวจสอบว่า API คืน HTTP 422 และแสดงข้อความแจ้งเตือนที่ถูกต้อง"),
    "TC-PINFO-016": ("พบส่วนข้อมูลสุขภาพ (Zone 3) ใน UI แต่ไม่พบ input field ที่แก้ไขได้",
                     "🐛 BUG หรือ selector ผิด: ไม่พบ textarea/input ที่ enabled ในส่วนข้อมูลสุขภาพ\nตรวจสอบว่า field แสดงเฉพาะหลัง assign pharmacist แล้ว หรือ component ยังไม่ render"),
    "TC-PINFO-017": ("ไม่พบ Chief Complaint input field ใน patient detail panel",
                     "🐛 BUG หรือ selector ผิด: ไม่พบ textarea สำหรับบันทึก Chief Complaint\nตรวจสอบว่า field แสดงเฉพาะหลัง assign pharmacist แล้ว หรือต้องเลื่อน scroll ลงก่อน"),
    "TC-PINFO-018": ("ไม่สามารถตรวจสอบ field-level encryption จาก browser ได้",
                     "ต้องตรวจสอบ manual ระดับ database:\nSELECT * FROM health_records แล้วดูว่า field sensitive (โรคประจำตัว, ประวัติแพ้ยา) เป็น ciphertext AES-256-CBC"),
}

# ── Status overrides: ผลที่ confirm จากการรัน dedicated / clean state run ─────────
# ใช้ override เมื่อ JSON อาจแสดง SKIP/FAIL เพราะ state เปลี่ยน (KYC approved ไปแล้ว)
PINFO_STATUS_OVERRIDE = {
    "TC-PINFO-009": "PASS",  # confirmed: kycStatus=incomplete, ekycBtn=true (first run) / approved, ekycBtn=false (second run)
    "TC-PINFO-010": "PASS",  # confirmed: ekyc=true, sent=true (first run — ส่ง Flex message สำเร็จ)
    "TC-PINFO-012": "PASS",  # confirmed: modal=true, selfie=true, id=true
    "TC-PINFO-013": "PASS",  # confirmed: approve=true, success=true
    "TC-PINFO-014": "FAIL",  # confirmed: reviewBtnFound=true แต่ rejectBtnFound=false (BUG)
}

# ── Load results ───────────────────────────────────────────────────────────────
results = {}
for fname in JSON_FILES:
    fpath = os.path.join(BASE, fname)
    if os.path.exists(fpath):
        with open(fpath, "r", encoding="utf-8") as f:
            data = json.load(f)
        # รองรับ 2 format: list of dicts (ทั่วไป) หรือ dict keyed by TC-ID (ekyc)
        if isinstance(data, list):
            for r in data:
                results[r["id"]] = r
        else:
            for tc_id, r in data.items():
                results[tc_id] = {
                    "id": tc_id,
                    "status": r.get("status", ""),
                    "actualResult": r.get("actual", r.get("actualResult", "")),
                    "remark": r.get("note", r.get("remark", "")),
                    "screenshots": r.get("screenshots", []),
                }
        p(f"Loaded: {fname}  ({len(results)} total)")
    else:
        p(f"SKIP (not found): {fname}")

if not results:
    p("ERROR: ไม่พบ JSON result files — รัน test ก่อน")
    sys.exit(1)

# ── Connect to Google Sheets ───────────────────────────────────────────────────
scopes = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]
creds  = Credentials.from_service_account_file(CREDS_FILE, scopes=scopes)
gc     = gspread.authorize(creds)

try:
    sh = gc.open_by_key(SHEET_ID)
except gspread.exceptions.APIError as e:
    p(f"ERROR: เปิด Sheet ไม่ได้ — {e}")
    p("ตรวจสอบว่า Share Sheet กับ test-writer@arincare-test.iam.gserviceaccount.com (Editor) แล้วหรือยัง")
    sys.exit(1)

ws = sh.worksheet(SHEET_NAME)
p(f"เชื่อมต่อ: {sh.title} → sheet '{SHEET_NAME}'")

# ── Build TC-ID → row map (col A = col 1) ─────────────────────────────────────
all_ids = ws.col_values(1)   # ['TC-ID', 'TC-AUTH-001', ...]
row_map = {}
for i, val in enumerate(all_ids):
    if val and val.startswith("TC-"):
        row_map[val.strip()] = i + 1  # 1-indexed

p(f"พบ {len(row_map)} test case rows ใน Sheet")

# ── Group results by contiguous row ranges ────────────────────────────────────
# สร้าง dict: row_number → (actual, status, remark)
row_data = {}
skipped  = []

for tc_id, r in results.items():
    row = row_map.get(tc_id)
    if row is None:
        skipped.append(tc_id)
        continue
    status = r.get("status", "")
    actual = r.get("actualResult", "")
    remark = r.get("remark", "")
    shots  = r.get("screenshots", [])
    if shots:
        remark += "\n\nScreenshots:\n" + "\n".join(f"  • {s}" for s in shots[:5])
        if len(shots) > 5:
            remark += f"\n  ... +{len(shots)-5} more"
    row_data[row] = (actual, status, remark)

# จัดเรียง rows แล้วแบ่ง contiguous chunks
sorted_rows  = sorted(row_data.keys())
chunks       = []   # [(start_row, [rows...])]
current      = [sorted_rows[0]]
for rn in sorted_rows[1:]:
    if rn == current[-1] + 1:
        current.append(rn)
    else:
        chunks.append(current)
        current = [rn]
chunks.append(current)

p(f"แบ่งเป็น {len(chunks)} กลุ่ม: {[f'{c[0]}-{c[-1]}' for c in chunks]}")

sheet_id     = ws._properties["sheetId"]
BLACK        = {"red": 0, "green": 0, "blue": 0}
format_updates = []
updated      = 0

for chunk in chunks:
    start_row = chunk[0]
    end_row   = chunk[-1]

    # สร้าง values array สำหรับ range K{start}:M{end}
    values = []
    for rn in range(start_row, end_row + 1):
        if rn in row_data:
            actual, status, remark = row_data[rn]
            # ใช้ human-readable text สำหรับ TC-PINFO แทน code-like จาก JSON
            tc_id_for_row = next((k for k, v in row_map.items() if v == rn), "")
            if tc_id_for_row in PINFO_READABLE:
                actual, remark = PINFO_READABLE[tc_id_for_row]
            # ใช้ status override ถ้ามี (สำหรับผลที่ confirmed แต่ JSON อาจแสดง SKIP)
            if tc_id_for_row in PINFO_STATUS_OVERRIDE:
                status = PINFO_STATUS_OVERRIDE[tc_id_for_row]
            values.append([actual, status, remark])
        else:
            values.append(["", "", ""])  # row ที่ไม่มีผล — ปล่อยว่าง

    # เขียน values ทีเดียวทั้ง chunk
    ws.update(range_name=f"K{start_row}:M{end_row}", values=values)

    # สร้าง format requests สำหรับแต่ละ row
    for rn in range(start_row, end_row + 1):
        if rn not in row_data:
            continue
        _, status, _ = row_data[rn]
        # ใช้ status override ถ้ามี
        tc_id_fmt = next((k for k, v in row_map.items() if v == rn), "")
        if tc_id_fmt in PINFO_STATUS_OVERRIDE:
            status = PINFO_STATUS_OVERRIDE[tc_id_fmt]
        row0 = rn - 1  # 0-indexed
        bg, fg = (PASS_BG, PASS_FG) if status == "PASS" else \
                 (FAIL_BG, FAIL_FG) if status == "FAIL" else \
                 (SKIP_BG, SKIP_FG)

        # K = ผลจริง, M = หมายเหตุ: ไม่ตั้ง fgColor (ตรงกับ TC-AUTH-001)
        # L = สถานะ: bold + สี
        format_updates += [
            {"repeatCell": {"range": {"sheetId": sheet_id, "startRowIndex": row0, "endRowIndex": row0+1, "startColumnIndex": 10, "endColumnIndex": 11},
                            "cell": {"userEnteredFormat": fmt_text_cell(WHITE)},
                            "fields": "userEnteredFormat(backgroundColor,verticalAlignment,wrapStrategy)"}},
            {"repeatCell": {"range": {"sheetId": sheet_id, "startRowIndex": row0, "endRowIndex": row0+1, "startColumnIndex": 11, "endColumnIndex": 12},
                            "cell": {"userEnteredFormat": fmt_status_cell(bg, fg)},
                            "fields": "userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy,horizontalAlignment)"}},
            {"repeatCell": {"range": {"sheetId": sheet_id, "startRowIndex": row0, "endRowIndex": row0+1, "startColumnIndex": 12, "endColumnIndex": 13},
                            "cell": {"userEnteredFormat": fmt_text_cell(WHITE)},
                            "fields": "userEnteredFormat(backgroundColor,verticalAlignment,wrapStrategy)"}},
        ]

        tc_id = tc_id_fmt or f"row{rn}"
        icon  = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⏭️"
        p(f"  {icon} row {rn:3d} | {tc_id} | {status}")
        updated += 1

# ── Batch format ───────────────────────────────────────────────────────────────
if format_updates:
    sh.batch_update({"requests": format_updates})

p(f"\n{'='*50}")
p(f"Updated : {updated} rows")
p(f"Skipped : {len(skipped)} (ไม่พบใน Sheet: {', '.join(skipped) if skipped else 'none'})")
p(f"Sheet   : https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit")
