import os, sys
import gspread
from google.oauth2.service_account import Credentials

def p(text):
    sys.stdout.buffer.write((str(text) + "\n").encode("utf-8"))

BASE       = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CREDS_FILE = os.path.join(BASE, "arincare-test-108540e51ee3.json")
SHEET_ID   = "15wwuPRsFZPaK0jIO_mDfmsImkf3MkALp4od1ZiIaAxk"

scopes = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]
creds  = Credentials.from_service_account_file(CREDS_FILE, scopes=scopes)
gc     = gspread.authorize(creds)
sh     = gc.open_by_key(SHEET_ID)
ws     = sh.worksheet("Test Cases")

# header row
header = ws.row_values(1)
p("=== HEADER ROW ===")
for i, h in enumerate(header, 1):
    p(f"  col {i:2d}: {h}")

p("\n=== ตัวอย่าง rows 2-6 ===")
rows = ws.get("A2:P6")
for i, row in enumerate(rows, 2):
    p(f"row {i}: {row}")
