"""
add-liff-testcases.py
เพิ่ม TC-LIFF-PAT-001..006 ลงใน Google Sheet (Test Cases tab)
ต่อจาก TC-NFR-009 (row 190) → เพิ่มที่ row 191–196
"""
import sys, time
from google.oauth2.service_account import Credentials
import gspread
import os

def p(t): sys.stdout.buffer.write((str(t)+'\n').encode('utf-8'))

BASE       = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CREDS_FILE = os.path.join(BASE, 'arincare-test-108540e51ee3.json')
SHEET_ID   = '15wwuPRsFZPaK0jIO_mDfmsImkf3MkALp4od1ZiIaAxk'

# ── Colors ────────────────────────────────────────────────────────────────────
PASS_BG = {'red':0.776,'green':0.937,'blue':0.808}
FAIL_BG = {'red':1.0,  'green':0.780,'blue':0.808}
SKIP_BG = {'red':1.0,  'green':0.922,'blue':0.612}
PASS_FG = {'red':0.153,'green':0.384,'blue':0.129}
FAIL_FG = {'red':0.612,'green':0.000,'blue':0.024}
SKIP_FG = {'red':0.612,'green':0.396,'blue':0.000}
WHITE   = {'red':1.0,'green':1.0,'blue':1.0}
BLACK   = {'red':0.0,'green':0.0,'blue':0.0}

# ── TC-LIFF-PAT data (13 columns A–M) ────────────────────────────────────────
# [TC-ID, โมดูล, ฟังก์ชัน, Priority, ประเภท, เงื่อนไขก่อนทดสอบ,
#  ข้อมูลทดสอบ, ขั้นตอนการทดสอบ, ผลลัพธ์คาดหวัง, อ้างอิง Req,
#  ผลการทดสอบจริง, สถานะ, หมายเหตุ]

LIFF_TESTS = [
    [
        'TC-LIFF-PAT-001',
        'LIFF-Patient',
        'Mobile Emulation เปิด LIFF Profile (iPhone 13)',
        'High',
        'Positive (Happy Path)',
        'มี liff-session.json (LINE OAuth session ของผู้ป่วย มานี มีใจ)\nChromium รองรับ devices[iPhone 13]',
        'Device: iPhone 13 emulation\nURL: telepharmacy-liff.vercel.app/profile\nstorageState: liff-session.json',
        '1. เปิด Playwright mobile-liff project (iPhone 13 + Chromium)\n2. โหลด storageState=liff-session.json\n3. Navigate ไป /profile?provider_code=...\n4. รอหน้าโหลด\n5. ตรวจสอบว่าพบปุ่ม "ยืนยันตัวตน (e-KYC)"',
        'หน้า LIFF Profile โหลดสำเร็จใน Mobile Emulation\nแสดงข้อมูลผู้ป่วยและปุ่ม "ยืนยันตัวตน (e-KYC)"',
        'LIFF-PAT-01',
        'Mobile Emulation สำเร็จ → profile page โหลดได้\nพบปุ่ม "ยืนยันตัวตน (e-KYC)" และชื่อผู้ป่วย มานี มีใจ',
        'PASS',
        'ใช้ Playwright devices["iPhone 13"] + browserName="chromium"\n(WebKit ไม่รองรับ fake camera flags)\nstorageState=liff-session.json สำหรับ LINE OAuth\nถ่ายภาพ: PAT001_01_profile.png',
    ],
    [
        'TC-LIFF-PAT-002',
        'LIFF-Patient',
        'หา e-KYC Flex Message ใน LINE Chat',
        'Medium',
        'Positive',
        'เภสัชกรกด "ส่งลิงก์ยืนยันตัวตน" (TC-PINFO-010) สำเร็จแล้ว\nผู้ป่วยได้รับ Flex Message ใน LINE Chat',
        'LINE Chat LIFF URL: liff.line.me/2010469964-fi8ZhQ7k/chat\nผู้ป่วย: มานี มีใจ (patientId=32)',
        '1. เปิด LIFF /chat ใน Mobile Emulation\n2. ค้นหา Flex Message ที่เภสัชกรส่ง e-KYC link\n3. ตรวจสอบว่ามีปุ่มกดเพื่อทำ e-KYC',
        'พบ Flex Message ใน LINE Chat ที่มีปุ่มกดเพื่อเข้าสู่ขั้นตอน e-KYC',
        'LIFF-PAT-02',
        'SKIP — Flex Message อยู่ใน LINE native app\nไม่สามารถ automate ผ่าน browser LIFF ได้\n(LIFF /chat สร้างคิวปรึกษา ไม่ใช่หน้า chat messages)',
        'SKIP',
        'ต้องทดสอบ manual ผ่าน LINE app จริง\nLIFF /chat = สร้าง consultation queue เท่านั้น\nFlex Messages อยู่ใน LINE Messaging (ไม่ใช่ LIFF WebView)',
    ],
    [
        'TC-LIFF-PAT-003',
        'LIFF-Patient',
        'Submit e-KYC ครบ 6 ขั้นตอนผ่าน LIFF Profile',
        'Critical',
        'Positive (Happy Path)',
        'ผู้ป่วย KYC ยังไม่สมบูรณ์ (incomplete)\nmี liff-session.json\nChrome flags: --use-fake-device-for-media-stream',
        'Fake camera: --use-fake-device-for-media-stream (test pattern สีเขียว)\nURL entry: /profile → กด "ยืนยันตัวตน (e-KYC)"',
        '1. เปิด /profile → กด "ยืนยันตัวตน (e-KYC)"\n2. Intro page → กด "เริ่มต้นยืนยันตัวตน"\n3. หน้ากล้องบัตรประชาชน → กด capture (w-16 center button)\n4. OCR Review → กด "ใช้รูปนี้"\n5. หน้ากล้องเซลฟี่ → กด capture\n6. Confirm page → กด "ยืนยันและส่งข้อมูล"\n7. ตรวจสอบ /ekyc/success',
        'ระบบส่ง KYC สำเร็จ → หน้า "ยืนยันตัวตนสำเร็จ"\nCMS แสดง KYC status = pending_review สำหรับผู้ป่วย',
        'FR-LIFF-03 / TC-PINFO-012',
        'KYC 6 ขั้นตอนสำเร็จ: intro→id-card→ocr-review→selfie→confirm→success\nCMS แสดง pending review สำหรับ TC-PINFO-012/013/014',
        'PASS',
        'ต้องรันก่อน TC-PINFO-012/013/014 เพื่อสร้าง pending KYC\nCamera button selector: button[class*="w-16"] (center/larger)\nFake camera bypass ทำให้ถ่ายรูปได้โดยไม่ต้องมีกล้องจริง\nถ่ายภาพ: PAT003_*_.png',
    ],
    [
        'TC-LIFF-PAT-004',
        'LIFF-Patient',
        'Intercept KYC URL จาก CMS แล้วเปิดบน Mobile Emulation',
        'Medium',
        'Integration',
        'เภสัชกร login CMS สำเร็จ\nTC-PINFO-010 ส่ง e-KYC link แล้ว (มี KYC URL จาก API response)',
        'KYC LIFF URL ที่ดักจับจาก CMS API response\nMobile emulation: iPhone 13',
        '1. รัน TC-PINFO-010 เพื่อส่ง e-KYC link\n2. ดักจับ KYC URL จาก network request/response\n3. เปิด URL นั้นบน Mobile Emulation (iPhone 13)\n4. ตรวจสอบว่าหน้า e-KYC โหลดสำเร็จของผู้ป่วยที่ถูกต้อง',
        'URL เปิดได้ใน Mobile Emulation\nโหลดหน้า e-KYC ของผู้ป่วยที่ถูกต้อง\nสามารถเริ่มขั้นตอน KYC ได้',
        'FR-LIFF-04',
        'Intercept KYC URL สำเร็จ\nเปิดหน้า e-KYC บน Mobile Emulation ได้\nURL โหลดหน้า intro/profile ถูกต้อง',
        'PASS',
        'ใช้ร่วมกับ TC-PINFO-010 เพื่อ end-to-end test ฝั่ง pharmacist → patient\nURL structure: telepharmacy-liff.vercel.app/{path}?provider_code=...\nถ่ายภาพ: PAT004_*_.png',
    ],
    [
        'TC-LIFF-PAT-005',
        'LIFF-Patient',
        '[BUG] ปุ่ม "ยืนยันและส่งข้อมูล" ล็อคหลังกดกลับ-ถ่ายใหม่ (ID Card + Selfie)',
        'High',
        'Negative / Bug Investigation',
        'อยู่ระหว่างขั้นตอน e-KYC\nผู้ป่วยกำลังถ่ายรูป (บัตรประชาชนหรือเซลฟี่)',
        'กระบวนการ: ถ่ายบัตร → OCR review → ถ่ายบัตรใหม่ → ใช้รูปนี้ → ถ่ายเซลฟี่ → กลับ → ถ่ายใหม่',
        '1. ถ่ายบัตรประชาชน → ถึง OCR Review\n2. กด "ถ่ายบัตรใหม่" (กดกลับ)\n3. ถ่ายบัตรอีกครั้ง → OCR Review → กด "ใช้รูปนี้"\n4. ถ่ายเซลฟี่ → ถึง Confirm page\n5. กด "ถ่ายเซลฟี่ใหม่" (กดกลับ)\n6. ถ่ายเซลฟี่ใหม่ → กลับมา Confirm page\n7. ตรวจสอบว่าปุ่ม "ยืนยันและส่งข้อมูล" ยังกดได้',
        'ปุ่ม "ยืนยันและส่งข้อมูล" ยังคงกดได้ปกติหลังกดกลับ-ถ่ายใหม่\nไม่มี state ค้างที่ทำให้ปุ่ม disabled',
        'BUG-LIFF-001',
        '🐛 Bug บน real device — ปุ่ม "ยืนยันและส่งข้อมูล" กดไม่ได้\nAutomation (fake camera) ผ่านได้เพราะ stream ไม่มีปัญหา\nComputed style: pointer-events=none หรือ opacity<0.5 หลัง retake',
        'FAIL',
        '🐛 BUG: กดกลับ-ถ่ายใหม่แล้วปุ่มล็อค\nRoot cause (hypothesis): camera stream ไม่ reinitialize หลัง back navigation\n→ captured image = null/corrupted → form validation ไม่ผ่าน → submit disabled\nAutomation ผ่าน (fake stream สม่ำเสมอ) แต่ real device ไม่ผ่าน\nDev: ตรวจ selfieImage/idCardImage state reset เมื่อ navigate back',
    ],
    [
        'TC-LIFF-PAT-006',
        'LIFF-Patient',
        '[BUG] กด back ออกจากหน้ากล้องเซลฟี่ก่อนถ่าย แล้วกลับมาถ่าย',
        'High',
        'Negative / Bug Investigation',
        'อยู่ที่หน้ากล้องเซลฟี่ (/ekyc/selfie)\nผ่าน intro → id-card → ocr-review → ใช้รูปนี้ มาแล้ว',
        'กด back button (w-12 ซ้าย) บนหน้ากล้องเซลฟี่ก่อนถ่าย\nจากนั้นกลับมาที่หน้าเซลฟี่อีกครั้งและถ่าย',
        '1. ผ่าน intro → id-card capture → OCR review → ใช้รูปนี้\n2. ถึงหน้ากล้องเซลฟี่ (/ekyc/selfie)\n3. กด back button (w-12 ซ้าย) โดยยังไม่ถ่าย\n4. ระบบกลับไปที่ id-card (back button รีเซ็ต id-card state ด้วย)\n5. ถ่ายบัตรใหม่ → OCR → ใช้รูปนี้ → ถึงเซลฟี่อีกครั้ง\n6. ถ่ายเซลฟี่\n7. ตรวจสอบปุ่ม "ยืนยันและส่งข้อมูล" ใน confirm page',
        'ปุ่ม "ยืนยันและส่งข้อมูล" กดได้หลังจากกลับมาถ่ายใหม่\nCamera reinitialize ได้ถูกต้องหลัง back navigation',
        'BUG-LIFF-002',
        '🐛 Bug บน real device — ปุ่มล็อคหลัง back จากหน้ากล้องเซลฟี่\nพบว่า back button บน selfie cam กลับไป /ekyc/id-card (ไม่ใช่ ocr-review)\nAutomation ผ่านได้ (fake camera reinit ทันที)',
        'FAIL',
        '🐛 BUG: กด back ออกจาก selfie cam ก่อนถ่าย → กล้องไม่ reinit\nพบ: back บน /ekyc/selfie → ไป /ekyc/id-card (reset id-card state ด้วย)\nReal device: camera stream release แต่ไม่ restart → ภาพ null → ปุ่มล็อค\nDev: ตรวจ useEffect cleanup/mount ของ selfie camera component\nเพิ่ม isStreamReady state ก่อนอนุญาตให้ user กด capture',
    ],
]

# ── Connect ────────────────────────────────────────────────────────────────────
creds = Credentials.from_service_account_file(CREDS_FILE,
    scopes=['https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive'])
gc = gspread.authorize(creds)
sh = gc.open_by_key(SHEET_ID)
ws = sh.worksheet('Test Cases')
sheet_id = ws._properties['sheetId']

# ── หา row เริ่มต้น ────────────────────────────────────────────────────────────
all_a = ws.col_values(1)
# ตรวจว่า TC-LIFF-PAT-001 มีอยู่แล้วหรือเปล่า
existing = next((i+1 for i, v in enumerate(all_a) if v.strip() == 'TC-LIFF-PAT-001'), None)
if existing:
    start_row = existing
    p(f'TC-LIFF-PAT-001 มีอยู่แล้วที่ row {start_row} → update แทน')
else:
    last_data = max((i+1 for i, v in enumerate(all_a) if v.strip()), default=1)
    start_row = last_data + 1
    p(f'เพิ่มใหม่ต่อจาก row {last_data} → start row {start_row}')

end_row = start_row + len(LIFF_TESTS) - 1
p(f'Writing rows {start_row}–{end_row} ({len(LIFF_TESTS)} rows)\n')

# ── Write values A:M ──────────────────────────────────────────────────────────
ws.update(range_name=f'A{start_row}:M{end_row}', values=LIFF_TESTS)
p(f'Values written to A{start_row}:M{end_row}')
time.sleep(1)

# ── Apply formatting ───────────────────────────────────────────────────────────
fmt_requests = []
for i, tc in enumerate(LIFF_TESTS):
    status  = tc[11]  # column L (index 11)
    row_0   = start_row + i - 1  # 0-indexed
    bg, fg  = (PASS_BG,PASS_FG) if status=='PASS' else (FAIL_BG,FAIL_FG) if status=='FAIL' else (SKIP_BG,SKIP_FG)

    # A–J: white bg, black text, wrap, top-align
    fmt_base = {
        'backgroundColor': WHITE,
        'textFormat': {'foregroundColor': BLACK, 'fontSize': 10},
        'verticalAlignment': 'TOP',
        'wrapStrategy': 'WRAP',
    }
    # L (status): colored bg, bold
    fmt_status = {
        'backgroundColor': bg,
        'textFormat': {'bold': True, 'foregroundColor': fg, 'fontSize': 10},
        'verticalAlignment': 'TOP',
        'wrapStrategy': 'WRAP',
        'horizontalAlignment': 'CENTER',
    }
    f_base   = 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)'
    f_status = 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy,horizontalAlignment)'

    # A–J (cols 0–9)
    fmt_requests.append({'repeatCell': {
        'range': {'sheetId': sheet_id, 'startRowIndex': row_0, 'endRowIndex': row_0+1,
                  'startColumnIndex': 0, 'endColumnIndex': 10},
        'cell': {'userEnteredFormat': fmt_base}, 'fields': f_base,
    }})
    # K (col 10) actual result
    fmt_requests.append({'repeatCell': {
        'range': {'sheetId': sheet_id, 'startRowIndex': row_0, 'endRowIndex': row_0+1,
                  'startColumnIndex': 10, 'endColumnIndex': 11},
        'cell': {'userEnteredFormat': fmt_base}, 'fields': f_base,
    }})
    # L (col 11) status
    fmt_requests.append({'repeatCell': {
        'range': {'sheetId': sheet_id, 'startRowIndex': row_0, 'endRowIndex': row_0+1,
                  'startColumnIndex': 11, 'endColumnIndex': 12},
        'cell': {'userEnteredFormat': fmt_status}, 'fields': f_status,
    }})
    # M (col 12) remark
    fmt_requests.append({'repeatCell': {
        'range': {'sheetId': sheet_id, 'startRowIndex': row_0, 'endRowIndex': row_0+1,
                  'startColumnIndex': 12, 'endColumnIndex': 13},
        'cell': {'userEnteredFormat': fmt_base}, 'fields': f_base,
    }})

    icon = '✅' if status=='PASS' else '❌' if status=='FAIL' else '⏭️'
    p(f'{icon} row {start_row+i-1:3d} | {tc[0]} | {status} | {tc[2][:50]}')

sh.batch_update({'requests': fmt_requests})
p('\nFormats applied ✅')

# ── Verify ─────────────────────────────────────────────────────────────────────
time.sleep(1)
verify = ws.get(f'A{start_row}:M{end_row}')
p(f'\nVerify {len(verify)} rows:')
for i, r in enumerate(verify):
    tc_id   = r[0]  if len(r) > 0  else '?'
    status  = r[11] if len(r) > 11 else ''
    fn      = r[2]  if len(r) > 2  else ''
    icon    = '✅' if status=='PASS' else '❌' if status=='FAIL' else '⏭️'
    p(f'  {icon} {tc_id}: {status} | {fn[:55]}')

p(f'\nSheet: https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit')
