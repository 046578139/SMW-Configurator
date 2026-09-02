import json, subprocess, sys, re
PORT = sys.argv[1] if len(sys.argv) > 1 else '8766'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'out'
def cmd(o):
    r = subprocess.run(['./cmd.sh', PORT, json.dumps(o)], capture_output=True, text=True)
    try: return json.loads(r.stdout)
    except Exception: return {'ok': False, 'error': r.stdout[:300] + r.stderr[:300]}
TABS = ["RF Options 1st Path", "Baseband", "RF Options 2. Path", "Digital Standards / WinIQSIM2", "External PC Software", "Other Options and Extras", "Service Options", "Training"]
for i, tab in enumerate(TABS):
    slug = f"tab{i+1}-" + re.sub(r'[^a-z0-9]+', '-', tab.lower()).strip('-')
    r = cmd({'op': 'click', 'text': tab, 'exact': True, 'nth': 0})
    cmd({'op': 'wait', 'ms': 1500})
    r2 = cmd({'op': 'click', 'text': 'Expand all', 'exact': False})
    cmd({'op': 'wait', 'ms': 2500})
    rows = cmd({'op': 'rows'})
    if not rows.get('ok'): print(tab, 'ROWS FAIL', rows); continue
    json.dump(rows['out'], open(f'{OUT}/{slug}.rows.json', 'w'), indent=1)
    cmd({'op': 'shot', 'name': slug, 'full': True})
    n_img = sum(1 for row in rows['out'] for it in row['items'] if it['img'])
    n_ord = sum(1 for row in rows['out'] for it in row['items'] if re.match(r'^\d{4}\.\d{4}[.K]\d{2}$', it['txt']))
    print(f"{tab:<32} rows={len(rows['out']):>4} imgs={n_img:>4} orders={n_ord:>4} expand={r2.get('ok')}")
