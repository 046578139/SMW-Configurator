"""usage: normalize.py OUTDIR DEST.json -- turn OUTDIR/tab*.rows.json (all tabs, expanded, default state) into a clean vendor catalog JSON."""
import json, glob, re, sys
from lib import parse_row, NAMES, TABS, slug
OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
DEST = sys.argv[2] if len(sys.argv) > 2 else 'vendor-catalog.json'
GROUP_ICONS = ('353d92e8', '8b617142')   # + / - group toggles
catalog = {'source': 'https://configurator.rohde-schwarz.com/app/ch5c/ch5start?-AppName%3Ddefault+-configknb%3Dconfig.SMW200A', 'captured': '2026-09-02', 'tabs': []}
for i, tab in enumerate(TABS):
    data = json.load(open(f"{OUT}/{slug(tab, i)}.rows.json")); rows = data['out'] if isinstance(data, dict) else data
    tabrec = {'name': tab, 'groups': []}
    group = None; subgroup = None; colhdr = None
    for row in rows:
        if row['y'] < 300: continue
        p = parse_row(row)
        texts = [it for it in row['items'] if it['txt']]
        toggle = [it for it in row['items'] if it['bg'] and it['bg'][:8] in GROUP_ICONS]
        if toggle and not p['order']:
            name = next((t['txt'] for t in texts if t['x'] > toggle[0]['x']), '?')
            group = {'name': name, 'subgroups': []}; tabrec['groups'].append(group); subgroup = None; colhdr = None
            continue
        if texts and all(t['txt'] in ('Path A', 'Path B') for t in texts):
            colhdr = [t['txt'] for t in texts]; continue
        if p['order'] or p['cols']:
            if group is None: group = {'name': '(none)', 'subgroups': []}; tabrec['groups'].append(group)
            if subgroup is None: subgroup = {'name': None, 'options': []}; group['subgroups'].append(subgroup)
            cols = []
            for k, c in enumerate(p['cols']):
                cols.append({'path': (colhdr[k] if colhdr and len(p['cols']) > 1 and k < len(colhdr) else None), 'ctrl': c['ctrl'], 'status': c['status']})
            subgroup['options'].append({'code': p['code'], 'order': p['order'], 'desig': p['desig'], 'cols': cols, 'dummy_b': any(h.startswith('Dummy') for h in p['hidden']), 'inputs': [x['val'] for x in p['inputs']], 'texts': [t for t in p['texts'] if t != 'R&S®']})
        elif len(texts) == 1 and texts[0]['w'] > 120 and not p['inputs']:
            # a single wide text line with no order number: a subgroup heading
            subgroup = {'name': texts[0]['txt'], 'options': []}
            if group is None: group = {'name': '(none)', 'subgroups': []}; tabrec['groups'].append(group)
            group['subgroups'].append(subgroup)
        elif texts:
            tgt = subgroup if subgroup is not None else group
            if tgt is not None: tgt.setdefault('notes', []).append(' | '.join(t['txt'] for t in texts))
    catalog['tabs'].append(tabrec)
json.dump(catalog, open(DEST, 'w'), indent=1, ensure_ascii=False)
n = 0
for t in catalog['tabs']:
    print('##', t['name'])
    for g in t['groups']:
        for sg in g['subgroups']:
            opts = sg['options']; n += len(opts)
            print(f"   {g['name']} / {sg['name']}: {len(opts)}: " + ", ".join((o['code'] or o['order'] or '?') + ('*' if o['dummy_b'] else '') + f"[{','.join((c['ctrl'] or '-')[:8] for c in o['cols'])}]" for o in opts)[:300])
            for note in sg.get('notes', []): print('      note:', note[:150])
        for note in g.get('notes', []): print('      gnote:', note[:150])
print('total option rows', n)
