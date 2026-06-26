"""
แก้ email pharmacist@medcare.com → pharma@medcare.com ในทุก cell ของชีท Test Cases
"""
import sys, os
import gspread
from google.oauth2.service_account import Credentials

def p(text):
    sys.stdout.buffer.write((str(text) + "\n").encode("utf-8"))

CREDS_FILE = "arincare-test-108540e51ee3.json"
SHEET_ID   = "15wwuPRsFZPaK0jIO_mDfmsImkf3MkALp4od1ZiIaAxk"
OLD_EMAIL  = "pharmacist@medcare.com"
NEW_EMAIL  = "pharma@medcare.com"

scopes = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
creds  = Credentials.from_service_account_file(CREDS_FILE, scopes=scopes)
gc     = gspread.authorize(creds)
sh     = gc.open_by_key(SHEET_ID)
ws     = sh.worksheet("Test Cases")

all_rows = ws.get("A1:M300")
updates  = []

for r_idx, row in enumerate(all_rows, 1):
    for c_idx, cell in enumerate(row, 1):
        if OLD_EMAIL in str(cell):
            new_val = str(cell).replace(OLD_EMAIL, NEW_EMAIL)
            a1 = gspread.utils.rowcol_to_a1(r_idx, c_idx)
            updates.append({"range": a1, "values": [[new_val]]})
            p(f"  row {r_idx:3d} col {c_idx:2d} ({a1}): แก้แล้ว")

if updates:
    ws.spreadsheet.values_batch_update({
        "valueInputOption": "RAW",
        "data": updates,
    })
    p(f"\nแก้ไขทั้งหมด {len(updates)} cells")
else:
    p("ไม่พบ pharmacist@medcare.com ในชีท")

p(f"Sheet: https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit")
