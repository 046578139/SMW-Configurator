"""usage: harvest.py PORT OUTDIR LABEL  -- click every status icon on every tab, record messages"""
import sys, json, time
from lib import Drv, parse_row, TABS, slug
port, outdir, label = sys.argv[1], sys.argv[2], sys.argv[3]
d = Drv(port)
for i, tab in enumerate(TABS):
    t0 = time.time()
    d.tab(tab, expand=(tab != 'Training'))
    rows = [parse_row(r) for r in d.rows()]
    out = []
    for p in rows:
        if not p['order'] and not p['cols']: continue
        for c in p['cols']:
            r = d({'op': 'status', 'id': c['icon_id']})
            c['msg'] = r['out']['text'] if r.get('ok') else 'FAIL ' + str(r.get('error'))[:80]
        out.append(p)
        print(f"[{label}] {p['code'] or '-':<14} {p['order'] or '-':<14} " + " | ".join(f"{c['status']}/{c['ctrl']}: {c['msg']}" for c in p['cols']), flush=True)
    json.dump({'tab': tab, 'baseline': label, 'rows': out}, open(f"{outdir}/{label}-{slug(tab, i)}.json", 'w'), indent=1)
    d({'op': 'shot', 'name': f"{label}-{slug(tab, i)}", 'full': True})
    print(f"[{label}] === {tab}: {len(out)} rows in {time.time() - t0:.0f}s", flush=True)
print(f"[{label}] ALL DONE", flush=True)
