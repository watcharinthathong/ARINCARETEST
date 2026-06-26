"""
update-pinfo-readable.py
เขียน ผลการทดสอบจริง และ หมายเหตุ ของ TC-PINFO ให้อ่านเข้าใจง่าย
รูปแบบเดียวกับ TC-AUTH-001
"""
import sys, time, gspread
from google.oauth2.service_account import Credentials
import os

def p(t): sys.stdout.buffer.write((str(t)+'\n').encode('utf-8'))

BASE       = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CREDS_FILE = os.path.join(BASE, 'arincare-test-108540e51ee3.json')
SHEET_ID   = '15wwuPRsFZPaK0jIO_mDfmsImkf3MkALp4od1ZiIaAxk'

PASS_BG = {'red':0.776,'green':0.937,'blue':0.808}
FAIL_BG = {'red':1.0,  'green':0.780,'blue':0.808}
SKIP_BG = {'red':1.0,  'green':0.922,'blue':0.612}
PASS_FG = {'red':0.153,'green':0.384,'blue':0.129}
FAIL_FG = {'red':0.612,'green':0.000,'blue':0.024}
SKIP_FG = {'red':0.612,'green':0.396,'blue':0.000}
WHITE   = {'red':1.0,  'green':1.0,  'blue':1.0}
BLACK   = {'red':0.0,  'green':0.0,  'blue':0.0}

# ─── ผลการทดสอบจริง + หมายเหตุ แบบอ่านเข้าใจ ───────────────────────────────
PINFO_RESULTS = [
    {
        'id': 'TC-PINFO-001', 'status': 'FAIL',
        'actual':  'พบคิว WAITING และกดปุ่ม "รับเคส" ได้ แต่สถานะคิวไม่เปลี่ยนจาก WAITING เป็น ACTIVE',
        'remark':  '🐛 BUG: กดปุ่มรับเคสแล้วระบบไม่เปลี่ยนสถานะ WAITING → ACTIVE\nต้องตรวจสอบ API assign pharmacist และ encounter update',
    },
    {
        'id': 'TC-PINFO-002', 'status': 'SKIP',
        'actual':  'ไม่มีคิว WAITING ในระบบขณะทดสอบ',
        'remark':  'ข้ามการทดสอบ: ต้องมีผู้ป่วยกด "ปรึกษาเภสัชกร" สร้างคิว WAITING ก่อน\nจากนั้น login เป็น Operator ที่มี supervising pharmacist เพื่อทดสอบ auto-assign',
    },
    {
        'id': 'TC-PINFO-003', 'status': 'SKIP',
        'actual':  'ไม่มีคิว WAITING ในระบบขณะทดสอบ',
        'remark':  'ข้ามการทดสอบ: ต้องมีคิว WAITING และใช้ Operator ที่ไม่มี supervising pharmacist\nเพื่อตรวจสอบว่าระบบเปิด modal ให้เลือกเภสัชกร',
    },
    {
        'id': 'TC-PINFO-004', 'status': 'SKIP',
        'actual':  'ไม่พบคิว ACTIVE ที่มีเภสัชกรแล้วในระบบขณะทดสอบ',
        'remark':  'ข้ามการทดสอบ: ต้องมีคิว ACTIVE ที่รับเคสแล้วก่อน\nจึงจะทดสอบการเปลี่ยนเภสัชกร (Change Pharmacist) และตรวจ audit log ได้',
    },
    {
        'id': 'TC-PINFO-005', 'status': 'SKIP',
        'actual':  'ไม่สามารถทดสอบอัตโนมัติได้ — ต้องควบคุมสถานะ online/offline ของเภสัชกร',
        'remark':  'ต้องทดสอบ manual: บังคับให้เภสัชกรที่รับเคสออฟไลน์\nแล้วตรวจว่า modal เปลี่ยนเภสัชกรบังคับปรากฏและปิดไม่ได้จนกว่าจะเลือกเภสัชกรคนใหม่',
    },
    {
        'id': 'TC-PINFO-006', 'status': 'PASS',
        'actual':  'พบคิว CLOSED และปุ่ม "รับเคส" ถูกซ่อน/ปิดใช้งานถูกต้อง',
        'remark':  'ปุ่มรับเคสไม่แสดงในคิวที่ปิดแล้ว (CLOSED) — ถูกต้องตาม spec\nUI ป้องกันการ assign เคสซ้ำในคิวที่จบแล้ว',
    },
    {
        'id': 'TC-PINFO-007', 'status': 'FAIL',
        'actual':  'พบส่วน KYC ใน UI แต่ฟิลด์ข้อมูลสามารถแก้ไขได้ (ไม่ได้ล็อก read-only)',
        'remark':  '🐛 BUG: ข้อมูล KYC ของผู้ป่วยควรเป็น read-only แต่ระบบยังให้แก้ไขได้\nต้องล็อก field ใน UI ไม่ให้เภสัชกรแก้ไขข้อมูลบัตรประชาชนหรือ KYC status โดยตรง',
    },
    {
        'id': 'TC-PINFO-008', 'status': 'PASS',
        'actual':  'แสดง badge สถานะ KYC: "ยังไม่สมบูรณ์" (สีส้ม) — ถูกต้อง',
        'remark':  'Status badge แสดงสถานะ KYC ของผู้ป่วยได้ถูกต้อง\nผู้ป่วยที่ยังไม่ยืนยันตัวตนแสดงสีส้ม / ยืนยันแล้วแสดงสีเขียว',
    },
    {
        'id': 'TC-PINFO-009', 'status': 'PASS',
        'actual':  'ผู้ป่วย KYC ยังไม่สมบูรณ์ → ปุ่ม "ส่งลิงก์ยืนยันตัวตน" แสดงถูกต้อง',
        'remark':  'ระบบแสดงปุ่ม e-KYC เฉพาะผู้ป่วยที่ยังไม่ผ่าน KYC\nถ้าผู้ป่วย KYC สำเร็จแล้ว ปุ่มจะไม่แสดง — ถูกต้องตาม spec',
    },
    {
        'id': 'TC-PINFO-010', 'status': 'PASS',
        'actual':  'กดปุ่ม "ส่งลิงก์ยืนยันตัวตน" สำเร็จ ระบบยืนยันการส่ง Flex message',
        'remark':  'ระบบส่งลิงก์ e-KYC ไปยัง LINE chat ของผู้ป่วยสำเร็จ\nผู้ป่วยจะได้รับ Flex message ให้กดเพื่อทำ e-KYC',
    },
    {
        'id': 'TC-PINFO-011', 'status': 'SKIP',
        'actual':  'ไม่พบ notification KYC pending ในระบบขณะทดสอบ',
        'remark':  'ข้ามการทดสอบ: ต้องให้ผู้ป่วย submit รูปถ่ายและบัตรประชาชนผ่าน LIFF ก่อน\nจากนั้นระบบจะแจ้งเตือนเภสัชกรให้ตรวจสอบ KYC',
    },
    {
        'id': 'TC-PINFO-012', 'status': 'SKIP',
        'actual':  'ไม่พบปุ่ม "ตรวจสอบ KYC" — ไม่มีคิวที่รอ review KYC ในระบบ',
        'remark':  'ข้ามการทดสอบ: ต้องมีผู้ป่วย submit e-KYC (รูปถ่ายหน้า + บัตรประชาชน) ผ่าน LIFF ก่อน\nจึงจะทดสอบ modal เปรียบเทียบ Selfie vs ID Card ได้',
    },
    {
        'id': 'TC-PINFO-013', 'status': 'SKIP',
        'actual':  'ไม่พบปุ่ม "ตรวจสอบ KYC" — ไม่มี KYC ที่รอ approve ในระบบ',
        'remark':  'ข้ามการทดสอบ: ต้องมี KYC pending review ก่อน\nจากนั้น Approve เพื่อตรวจว่าสถานะเปลี่ยนเป็น "ยืนยันตัวตนแล้ว" และบันทึก reviewed_by/reviewed_at',
    },
    {
        'id': 'TC-PINFO-014', 'status': 'SKIP',
        'actual':  'ไม่พบปุ่ม "ตรวจสอบ KYC" — ไม่มี KYC ที่รอ reject ในระบบ',
        'remark':  'ข้ามการทดสอบ: ต้องมี KYC pending review ก่อน\nจากนั้น Reject พร้อมระบุเหตุผล และตรวจว่าระบบส่ง push notification แจ้งผู้ป่วย',
    },
    {
        'id': 'TC-PINFO-015', 'status': 'SKIP',
        'actual':  'ต้องทดสอบจากฝั่งผู้ป่วยใน LIFF — ไม่สามารถ automate จาก CMS ได้',
        'remark':  'ต้องทดสอบ manual: เปิด LIFF ใน LINE app กรอกชื่อ-นามสกุลไม่ตรงบัตรประชาชน\nแล้วตรวจสอบว่า API คืน HTTP 422 และแสดงข้อความแจ้งเตือนที่ถูกต้อง',
    },
    {
        'id': 'TC-PINFO-016', 'status': 'FAIL',
        'actual':  'พบส่วนข้อมูลสุขภาพ (Zone 3) ใน UI แต่ไม่พบ input field ที่แก้ไขได้',
        'remark':  '🐛 BUG หรือ selector ผิด: ไม่พบ textarea/input ที่ enabled ในส่วนข้อมูลสุขภาพ\nตรวจสอบว่า field แสดงเฉพาะหลัง assign pharmacist แล้ว หรือ component ยังไม่ render',
    },
    {
        'id': 'TC-PINFO-017', 'status': 'FAIL',
        'actual':  'ไม่พบ Chief Complaint input field ใน patient detail panel',
        'remark':  '🐛 BUG หรือ selector ผิด: ไม่พบ textarea สำหรับบันทึก Chief Complaint\nตรวจสอบว่า field แสดงเฉพาะหลัง assign pharmacist แล้ว หรือต้องเลื่อน scroll ลงก่อน',
    },
    {
        'id': 'TC-PINFO-018', 'status': 'SKIP',
        'actual':  'ไม่สามารถตรวจสอบ field-level encryption จาก browser ได้',
        'remark':  'ต้องตรวจสอบ manual ระดับ database:\nSELECT * FROM health_records แล้วดูว่า field sensitive (โรคประจำตัว, ประวัติแพ้ยา) เป็น ciphertext AES-256-CBC',
    },
]

# ── Connect ────────────────────────────────────────────────────────────────────
creds = Credentials.from_service_account_file(CREDS_FILE,
    scopes=['https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive'])
gc = gspread.authorize(creds)
sh = gc.open_by_key(SHEET_ID)
ws = sh.worksheet('Test Cases')
sheet_id = ws._properties['sheetId']

all_ids = ws.col_values(1)
start_row = next((i+1 for i, v in enumerate(all_ids) if v.strip() == 'TC-PINFO-001'), None)
end_row   = start_row + len(PINFO_RESULTS) - 1
p(f'TC-PINFO rows: {start_row} – {end_row}')

# ── Write values ──────────────────────────────────────────────────────────────
rows_data = [[r['actual'], r['status'], r['remark']] for r in PINFO_RESULTS]
ws.update(range_name=f'K{start_row}:M{end_row}', values=rows_data)
p(f'Values written to K{start_row}:M{end_row}')
time.sleep(1)

# ── Apply color format ────────────────────────────────────────────────────────
format_requests = []
for i, r in enumerate(PINFO_RESULTS):
    status  = r['status']
    row_idx = start_row + i - 1  # 0-indexed for GridRange
    bg, fg  = (PASS_BG,PASS_FG) if status=='PASS' else (FAIL_BG,FAIL_FG) if status=='FAIL' else (SKIP_BG,SKIP_FG)

    fmt_white  = {'backgroundColor':WHITE,'textFormat':{'foregroundColor':BLACK},'verticalAlignment':'TOP','wrapStrategy':'WRAP'}
    fmt_status = {'backgroundColor':bg,'textFormat':{'bold':True,'foregroundColor':fg},'verticalAlignment':'TOP','wrapStrategy':'WRAP','horizontalAlignment':'CENTER'}
    f_base   = 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)'
    f_status = 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy,horizontalAlignment)'

    format_requests += [
        {'repeatCell':{'range':{'sheetId':sheet_id,'startRowIndex':row_idx,'endRowIndex':row_idx+1,'startColumnIndex':10,'endColumnIndex':11},'cell':{'userEnteredFormat':fmt_white},'fields':f_base}},
        {'repeatCell':{'range':{'sheetId':sheet_id,'startRowIndex':row_idx,'endRowIndex':row_idx+1,'startColumnIndex':11,'endColumnIndex':12},'cell':{'userEnteredFormat':fmt_status},'fields':f_status}},
        {'repeatCell':{'range':{'sheetId':sheet_id,'startRowIndex':row_idx,'endRowIndex':row_idx+1,'startColumnIndex':12,'endColumnIndex':13},'cell':{'userEnteredFormat':fmt_white},'fields':f_base}},
    ]

    icon = '✅' if status=='PASS' else '❌' if status=='FAIL' else '⏭️'
    p(f'{icon} {r["id"]} | {status} | {r["actual"][:60]}')

sh.batch_update({'requests': format_requests})
p('Formats applied')

# ── Verify ─────────────────────────────────────────────────────────────────────
time.sleep(1)
verify = ws.get(f'K{start_row}:M{end_row}')
p(f'\nVerify {len(verify)} rows:')
for i, row in enumerate(verify):
    tc_id  = PINFO_RESULTS[i]['id']
    status = row[1] if len(row) > 1 else ''
    actual = row[0][:55] if len(row) > 0 else ''
    icon   = '✅' if status=='PASS' else '❌' if status=='FAIL' else '⏭️'
    p(f'  {icon} {tc_id}: {actual}')

p(f'\nSheet: https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit')
