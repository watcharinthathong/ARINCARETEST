"""
update-telepharmacy-results.py
อ่านผลจาก test-results-login-final.json และ test-results-home.json
แล้วเขียนกลับเข้า Arincare_Telepharmacy_TestCases.xlsx

col 11 = Actual Result
col 12 = Status  (PASS/FAIL/SKIP)
col 13 = Remark + screenshot list
"""

import json, os, sys
import openpyxl
from openpyxl.styles import PatternFill, Font, Alignment

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXCEL   = os.path.join(BASE, "Arincare_Telepharmacy_TestCases.xlsx")
JSON_L  = os.path.join(BASE, "test-results-login-final.json")
JSON_H  = os.path.join(BASE, "test-results-home.json")

# ── Styles ─────────────────────────────────────────────────────────────────────
PASS_FILL  = PatternFill("solid", fgColor="C6EFCE")   # green
FAIL_FILL  = PatternFill("solid", fgColor="FFC7CE")   # red
SKIP_FILL  = PatternFill("solid", fgColor="FFEB9C")   # yellow
PASS_FONT  = Font(bold=True, color="276221", size=10)
FAIL_FONT  = Font(bold=True, color="9C0006", size=10)
SKIP_FONT  = Font(bold=True, color="9C6500", size=10)
NORM_FONT  = Font(size=9)
WRAP_ALIGN = Alignment(wrap_text=True, vertical="top")

def p(text):
    sys.stdout.buffer.write((text + "\n").encode("utf-8"))

# ── Load results ───────────────────────────────────────────────────────────────
results = {}
for fpath in [JSON_L, JSON_H]:
    if os.path.exists(fpath):
        with open(fpath, "r", encoding="utf-8") as f:
            for r in json.load(f):
                results[r["id"]] = r
        p(f"Loaded: {os.path.basename(fpath)}  ({len(results)} total so far)")
    else:
        p(f"WARN: {fpath} not found")

if not results:
    p("ERROR: No result JSON files found — run tests first")
    sys.exit(1)

# ── Open workbook ──────────────────────────────────────────────────────────────
wb = openpyxl.load_workbook(EXCEL)
ws = wb["Test Cases"]

# ── Build TC-ID → row index map ────────────────────────────────────────────────
row_map = {}
for row in range(2, ws.max_row + 1):
    tc_id = ws.cell(row, 1).value
    if tc_id:
        row_map[str(tc_id).strip()] = row

p(f"\nExcel has {len(row_map)} test case rows")

# ── Write results ──────────────────────────────────────────────────────────────
updated = 0
skipped = []

for tc_id, r in sorted(results.items()):
    row = row_map.get(tc_id)
    if row is None:
        skipped.append(tc_id)
        continue

    status    = r.get("status", "")
    actual    = r.get("actualResult", "")
    remark    = r.get("remark", "")
    shots     = r.get("screenshots", [])

    # col 11 — Actual Result
    c11 = ws.cell(row, 11)
    c11.value     = actual
    c11.font      = NORM_FONT
    c11.alignment = WRAP_ALIGN

    # col 12 — Status
    c12 = ws.cell(row, 12)
    c12.value = status
    if status == "PASS":
        c12.fill = PASS_FILL
        c12.font = PASS_FONT
    elif status == "FAIL":
        c12.fill = FAIL_FILL
        c12.font = FAIL_FONT
    else:
        c12.fill = SKIP_FILL
        c12.font = SKIP_FONT
    c12.alignment = Alignment(horizontal="center", vertical="center")

    # col 13 — Remark + screenshots
    ss_text = ""
    if shots:
        ss_text = "\n\nScreenshots:\n" + "\n".join(f"  • {s}" for s in shots[:5])
        if len(shots) > 5:
            ss_text += f"\n  ... +{len(shots)-5} more"

    c13 = ws.cell(row, 13)
    c13.value     = remark + ss_text
    c13.font      = NORM_FONT
    c13.alignment = WRAP_ALIGN

    # adjust row height
    ws.row_dimensions[row].height = max(30, 15 + shots[:5].__len__() * 12)

    updated += 1
    icon = "✅" if status == "PASS" else "❌" if status == "FAIL" else "⏭️"
    p(f"  {icon} row {row:3d} | {tc_id} | {status}")

# ── Save ───────────────────────────────────────────────────────────────────────
wb.save(EXCEL)

p(f"\n{'='*50}")
p(f"Updated : {updated} rows")
p(f"Skipped : {len(skipped)} (not in Excel: {', '.join(skipped) if skipped else 'none'})")
p(f"Saved   : {EXCEL}")
