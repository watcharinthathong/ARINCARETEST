"""
update-pinfo-results.py
อัพเดทผล TC-PINFO ทั้ง 18 rows ใน Google Sheet โดยใช้ range update
"""
import json, sys, time, gspread
from google.oauth2.service_account import Credentials
import os

def p(t): sys.stdout.buffer.write((str(t)+'\n').encode('utf-8'))

BASE       = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CREDS_FILE = os.path.join(BASE, 'arincare-test-108540e51ee3.json')
SHEET_ID   = '15wwuPRsFZPaK0jIO_mDfmsImkf3MkALp4od1ZiIaAxk'
JSON_FILE  = os.path.join(BASE, 'test-results-pinfo.json')

PASS_BG = {'red':0.776,'green':0.937,'blue':0.808}
FAIL_BG = {'red':1.0,  'green':0.780,'blue':0.808}
SKIP_BG = {'red':1.0,  'green':0.922,'blue':0.612}
PASS_FG = {'red':0.153,'green':0.384,'blue':0.129}
FAIL_FG = {'red':0.612,'green':0.000,'blue':0.024}
SKIP_FG = {'red':0.612,'green':0.396,'blue':0.000}
WHITE   = {'red':1.0,  'green':1.0,  'blue':1.0}
BLACK   = {'red':0.0,  'green':0.0,  'blue':0.0}

creds = Credentials.from_service_account_file(CREDS_FILE,
    scopes=['https://www.googleapis.com/auth/spreadsheets',
            'https://www.googleapis.com/auth/drive'])
gc = gspread.authorize(creds)
sh = gc.open_by_key(SHEET_ID)
ws = sh.worksheet('Test Cases')
sheet_id = ws._properties['sheetId']

with open(JSON_FILE, encoding='utf-8') as f:
    results_list = json.load(f)

pinfo = sorted(
    [r for r in results_list if r['id'].startswith('TC-PINFO')],
    key=lambda x: x['id']
)
p(f'Loaded {len(pinfo)} TC-PINFO results')

all_ids = ws.col_values(1)
start_row = next((i+1 for i, v in enumerate(all_ids) if v.strip() == 'TC-PINFO-001'), None)
if not start_row:
    p('ERROR: ไม่พบ TC-PINFO-001 ใน Sheet')
    sys.exit(1)

end_row = start_row + len(pinfo) - 1
p(f'Writing rows {start_row}-{end_row}')

# Build values array
rows_data = []
for r in pinfo:
    actual = r.get('actualResult', '')
    status = r.get('status', '')
    remark = r.get('remark', '')
    shots  = r.get('screenshots', [])
    if shots:
        remark += '\n\nScreenshots:\n' + '\n'.join(f'  - {s}' for s in shots[:5])
    rows_data.append([actual, status, remark])

# Write ทั้งหมดใน range เดียว
rng = f'K{start_row}:M{end_row}'
ws.update(range_name=rng, values=rows_data)
p(f'Values written to {rng}')
time.sleep(1)

# Apply format
format_requests = []
for i, r in enumerate(pinfo):
    status  = r.get('status', '')
    row_idx = start_row + i - 1  # 0-indexed for GridRange
    bg, fg  = (PASS_BG,PASS_FG) if status=='PASS' else (FAIL_BG,FAIL_FG) if status=='FAIL' else (SKIP_BG,SKIP_FG)

    fmt_white = {'backgroundColor':WHITE,'textFormat':{'foregroundColor':BLACK},'verticalAlignment':'TOP','wrapStrategy':'WRAP'}
    fmt_status = {'backgroundColor':bg,'textFormat':{'bold':True,'foregroundColor':fg},'verticalAlignment':'TOP','wrapStrategy':'WRAP','horizontalAlignment':'CENTER'}
    fields_base   = 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy)'
    fields_status = 'userEnteredFormat(backgroundColor,textFormat,verticalAlignment,wrapStrategy,horizontalAlignment)'

    format_requests += [
        {'repeatCell':{'range':{'sheetId':sheet_id,'startRowIndex':row_idx,'endRowIndex':row_idx+1,'startColumnIndex':10,'endColumnIndex':11},'cell':{'userEnteredFormat':fmt_white},'fields':fields_base}},
        {'repeatCell':{'range':{'sheetId':sheet_id,'startRowIndex':row_idx,'endRowIndex':row_idx+1,'startColumnIndex':11,'endColumnIndex':12},'cell':{'userEnteredFormat':fmt_status},'fields':fields_status}},
        {'repeatCell':{'range':{'sheetId':sheet_id,'startRowIndex':row_idx,'endRowIndex':row_idx+1,'startColumnIndex':12,'endColumnIndex':13},'cell':{'userEnteredFormat':fmt_white},'fields':fields_base}},
    ]

    icon = '✅' if status=='PASS' else '❌' if status=='FAIL' else '⏭️'
    p(f'{icon} row {start_row+i-1:3d} | {r["id"]} | {status}')

sh.batch_update({'requests': format_requests})
p('Formats applied')

# Verify
time.sleep(1)
verify = ws.get(f'K{start_row}:M{end_row}')
p(f'\nVerify ({len(verify)} rows written):')
for i, row in enumerate(verify):
    tc_id = pinfo[i]['id'] if i < len(pinfo) else '?'
    status_val = row[1] if len(row) > 1 else ''
    actual_val = row[0][:50] if len(row) > 0 else ''
    icon = '✅' if status_val=='PASS' else '❌' if status_val=='FAIL' else '⏭️'
    p(f'  {icon} {tc_id}: {status_val} | {actual_val}')

p(f'\nSheet: https://docs.google.com/spreadsheets/d/{SHEET_ID}/edit')
