import sys, os
import gspread
from google.oauth2.service_account import Credentials

def p(text):
    sys.stdout.buffer.write((str(text) + "\n").encode("utf-8"))

CREDS_FILE = "arincare-test-108540e51ee3.json"
SHEET_ID   = "15wwuPRsFZPaK0jIO_mDfmsImkf3MkALp4od1ZiIaAxk"

scopes = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
creds  = Credentials.from_service_account_file(CREDS_FILE, scopes=scopes)
gc     = gspread.authorize(creds)
sh     = gc.open_by_key(SHEET_ID)
ws     = sh.worksheet("Test Cases")

all_rows = ws.get("A2:M300")

p("=== TC-PINFO ===")
for row in all_rows:
    if not row or not row[0].startswith("TC-PINFO"):
        continue
    tc_id  = row[0]
    module = row[1] if len(row) > 1 else ""
    func   = row[2] if len(row) > 2 else ""
    prio   = row[3] if len(row) > 3 else ""
    typ    = row[4] if len(row) > 4 else ""
    pre    = row[5] if len(row) > 5 else ""
    data   = row[6] if len(row) > 6 else ""
    steps  = row[7] if len(row) > 7 else ""
    expect = row[8] if len(row) > 8 else ""
    p(f"--- {tc_id} [{prio}] ---")
    p(f"  Module  : {module}")
    p(f"  Function: {func}")
    p(f"  Type    : {typ}")
    p(f"  Pre     : {pre}")
    p(f"  Data    : {data}")
    p(f"  Steps   : {steps[:300]}")
    p(f"  Expect  : {expect[:300]}")
    p("")
