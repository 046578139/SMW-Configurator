"""For each RF path A frequency option, select it and record which path B options the vendor offers, plus B94L state."""
import sys, json
from lib import Drv, parse_row
d = Drv(sys.argv[1])
A = ['SMW-B1003','SMW-B1006','SMW-B1007','SMW-B1012','SMW-B1020','SMW-B1031','SMW-B1040','SMW-B1040N','SMW-B1044','SMW-B1044N','SMW-B1044O','SMW-B1056','SMW-B1056N','SMW-B1056O','SMW-B1067','SMW-B1067N','SMW-B1067O']
matrix = {}
for a in A:
    d.tab('RF Options 1st Path')
    p = None
    for r in d.rows():
        q = parse_row(r)
        if q['code'] == a: p = q; break
    if not p or not p['cols'] or not p['cols'][0]['ctrl_id']: print('no ctrl for', a); continue
    r = d({'op': 'tick', 'id': p['cols'][0]['ctrl_id']})
    dl = r.get('out', {}).get('dialogs'); d({'op': 'closeDialogs'})
    # Baseband main module state after selecting A (O variants may force B13XT)
    d.tab('Baseband'); bb = {}
    for rr in d.rows():
        q = parse_row(rr)
        if q['code'] in ('SMW-B13', 'SMW-B13T', 'SMW-B13XT'): bb[q['code']] = [(c['ctrl'], c['status']) for c in q['cols']]
    d.tab('RF Options 2. Path'); rows = [parse_row(r) for r in d.rows()]
    bopts = [(q['code'], [(c['ctrl'], c['status']) for c in q['cols']]) for q in rows if q['code'] and q['code'].startswith('SMW-B2')]
    b94 = next(([(c['ctrl'], c['status']) for c in q['cols']] for q in rows if q['code'] == 'SMW-B94L'), None)
    others = [(q['code'], [(c['ctrl'], c['status']) for c in q['cols']]) for q in rows if q['code'] and not q['code'].startswith('SMW-B2') and q['code'] != 'SMW-B94L']
    matrix[a] = {'dialogs': dl, 'pathB': bopts, 'B94L': b94, 'mainmodule': bb, 'others': others}
    print(f"{a:<11} dialogs={dl} B: {[b[0][4:] + ('' if b[1][0][0] != 'box-disabled' and b[1][0][0] != 'radio-off' else '') for b in bopts]} B94L={b94} main={ {k[4:]: v[0][0] for k, v in bb.items()} }", flush=True)
json.dump(matrix, open(sys.argv[2] if len(sys.argv) > 2 else 'rfmatrix.json', 'w'), indent=1)
