"""usage: setup_baseline.py PORT 'Tab|CODE|colindex' ..."""
import sys
from lib import Drv, parse_row, find_row
d = Drv(sys.argv[1])
for step in sys.argv[2:]:
    tab, code, col = step.split('|'); col = int(col)
    d.tab(tab)
    p = find_row(d.rows(), code)
    if not p: print('NOT FOUND', step); continue
    if col >= len(p['cols']) or not p['cols'][col]['ctrl_id']: print('NO CTRL', step, p['cols']); continue
    r = d({'op': 'tick', 'id': p['cols'][col]['ctrl_id']})
    p2 = find_row(d.rows(), code)
    print(f"{step:<40} -> {[ (c['status'], c['ctrl']) for c in p2['cols'] ]} dialogs={r.get('out', {}).get('dialogs')}")
    d({'op': 'closeDialogs'})
