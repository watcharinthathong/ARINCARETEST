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
fails = []
skips = []
passes = 0

for row in all_rows:
    if not row or not row[0].startswith("TC-"):
        continue
    tc_id  = row[0] if len(row) > 0 else ""
    module = row[1] if len(row) > 1 else ""
    func   = row[2] if len(row) > 2 else ""
    prio   = row[3] if len(row) > 3 else ""
    actual = row[10] if len(row) > 10 else ""
    status = row[11] if len(row) > 11 else ""
    remark = row[12] if len(row) > 12 else ""

    if status == "PASS":
        passes += 1
    elif status == "FAIL":
        fails.append({"id": tc_id, "module": module, "func": func, "prio": prio, "actual": actual, "remark": remark})
    elif status.upper() in ("SKIP",) or status.upper().startswith("SKIP"):
        skips.append({"id": tc_id, "module": module, "func": func, "prio": prio, "actual": actual, "remark": remark})

p(f"PASS: {passes}")
p(f"FAIL: {len(fails)}")
p(f"SKIP: {len(skips)}")
p("")
p("=== FAIL ===")
for r in fails:
    p(f"[{r['prio']}] {r['id']} | {r['module']} | {r['func']}")
    p(f"  actual: {r['actual'][:200]}")
    if r["remark"]:
        p(f"  remark: {r['remark'][:200]}")
    p("")

p("=== SKIP ===")
for r in skips:
    p(f"[{r['prio']}] {r['id']} | {r['module']} | {r['func']}")
    p(f"  actual: {r['actual'][:200]}")
    if r.get("remark"):
        p(f"  remark: {r['remark'][:200]}")
    p("")
