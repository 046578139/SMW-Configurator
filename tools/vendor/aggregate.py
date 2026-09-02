"""usage: aggregate.py HARVESTDIR DEST.json > summary.txt -- merge HARVESTDIR/<baseline>-tab*.json into one rules file"""
import json, glob, re, collections, sys
HDIR = sys.argv[1] if len(sys.argv) > 1 else 'harvest'
DEST = sys.argv[2] if len(sys.argv) > 2 else 'vendor-rules.json'
BASELINES = {'default': 'B1003 + B13 (as delivered by the configurator)', 'std2': 'B13T + B2003 + B10 in path A and B', 'wb2': 'B13XT + B1044 + B2044 + B9 in path A and B', 'hf1': 'B1067 + B13XT + B9 in path A'}
rules = collections.OrderedDict(); order = {}
for f in sorted(glob.glob(f'{HDIR}/*-tab*.json')):
    d = json.load(open(f)); base = d['baseline']; tab = d['tab']
    for row in d['rows']:
        code = row['code'] or row['order'] or '?'
        cols = []
        for k, c in enumerate(row['cols']):
            path = ('A', 'B')[k] if len(row['cols']) == 2 else None
            cols.append({'path': path, 'ctrl': c['ctrl'], 'status': c['status'], 'msg': c.get('msg')})
        rules.setdefault(code, {}).setdefault(tab, {})[base] = cols
        if row['order']: order[code] = row['order']
out = {'baselines': BASELINES, 'captured': '2026-09-02', 'rules': rules, 'orders': order}
json.dump(out, open(DEST, 'w'), indent=1, ensure_ascii=False)
def trivial(m): return (not m) or 'fundamentally allowed' in m
print(f"{len(rules)} codes")
for code, tabs in rules.items():
    lines = []
    for tab, bases in tabs.items():
        for base, cols in bases.items():
            for c in cols:
                if not trivial(c['msg']) or c['status'] in ('TICK', 'REDX'):
                    lines.append(f"    [{base:>7} {tab[:8]:<8} {c['path'] or '-'}] {c['status']:<5} {c['msg']}")
    if lines:
        print(code, order.get(code, ''))
        seen = set()
        for l in lines:
            if l not in seen: print(l); seen.add(l)
