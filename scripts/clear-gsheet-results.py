"""
clear-gsheet-results.py
ลบค่าใน col K (Actual Result), L (Status), M (Remark) ที่อัพเดทไปล่าสุด
"""

import os, sys
import gspread
from google.oauth2.service_account import Credentials

def p(text):
    sys.stdout.buffer.write((str(text) + "\n").encode("utf-8"))

BASE       = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CREDS_FILE = os.path.join(BASE, "arincare-test-108540e51ee3.json")
SHEET_ID   = "15wwuPRsFZPaK0jIO_mDfmsImkf3MkALp4od1ZiIaAxk"
SHEET_NAME = "Test Cases"

scopes = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]
creds = Credentials.from_service_account_file(CREDS_FILE, scopes=scopes)
gc    = gspread.authorize(creds)
sh    = gc.open_by_key(SHEET_ID)
ws    = sh.worksheet(SHEET_NAME)
p(f"เชื่อมต่อ: {sh.title} → '{SHEET_NAME}'")

# หา rows ที่มี TC-ID (col A)
all_ids = ws.col_values(1)
tc_rows = [i + 1 for i, v in enumerate(all_ids) if v and v.strip().startswith("TC-")]
p(f"พบ {len(tc_rows)} TC rows — จะล้าง col K, L, M")

sheet_id = ws._properties["sheetId"]

# ── Clear values (batch) ───────────────────────────────────────────────────────
clear_ranges = []
for row in tc_rows:
    clear_ranges.append(gspread.utils.rowcol_to_a1(row, 11))  # K
    clear_ranges.append(gspread.utils.rowcol_to_a1(row, 12))  # L
    clear_ranges.append(gspread.utils.rowcol_to_a1(row, 13))  # M

ws.spreadsheet.values_batch_clear({"ranges": clear_ranges})
p("ล้างค่าแล้ว (K, L, M)")

# ── Reset format: white bg, no bold ───────────────────────────────────────────
WHITE  = {"red": 1.0, "green": 1.0, "blue": 1.0}
BLACK  = {"red": 0.0, "green": 0.0, "blue": 0.0}
format_requests = []

for row in tc_rows:
    row0 = row - 1
    format_requests.append({
        "repeatCell": {
            "range": {
                "sheetId": sheet_id,
                "startRowIndex": row0, "endRowIndex": row0 + 1,
                "startColumnIndex": 10, "endColumnIndex": 13,  # K-M
            },
            "cell": {
                "userEnteredFormat": {
                    "backgroundColor": WHITE,
                    "textFormat": {"bold": False, "foregroundColor": BLACK},
                    "verticalAlignment": "TOP",
                    "wrapStrategy": "WRAP",
                }
            },
            "fields": "userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)",
        }
    })

sh.batch_update({"requests": format_requests})
p("รีเซ็ต format แล้ว (สีขาว, ไม่ bold)")
p(f"\nเสร็จ — Sheet: https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit")
