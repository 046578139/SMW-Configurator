import json, subprocess, re
NAMES = {"f6de4cc4": "TICK", "43d004bd": "blank", "a89ebb91": "X", "898c423d": "REDX", "a94f5198": "box-off", "49e07fcb": "box-on", "80d57901": "radio-on", "081d6c4f": "radio-off", "5fc5428c": "box-disabled"}
STATUS = {"TICK", "blank", "X", "REDX"}
TABS = ["RF Options 1st Path", "Baseband", "RF Options 2. Path", "Digital Standards / WinIQSIM2", "External PC Software", "Other Options and Extras", "Service Options", "Training"]
def slug(tab, i): return f"tab{i+1}-" + re.sub(r'[^a-z0-9]+', '-', tab.lower()).strip('-')
class Drv:
    def __init__(self, port): self.port = str(port)
    def __call__(self, o, timeout=180):
        r = subprocess.run(['./cmd.sh', self.port, json.dumps(o)], capture_output=True, text=True, timeout=timeout)
        try: return json.loads(r.stdout)
        except Exception: return {'ok': False, 'error': r.stdout[:300] + r.stderr[:300]}
    def tab(self, name, expand=True):
        self({'op': 'closeDialogs'})
        r = self({'op': 'click', 'text': name, 'exact': True, 'nth': 0}); self({'op': 'wait', 'ms': 800})
        if expand: self({'op': 'click', 'text': 'Expand all', 'exact': False}); self({'op': 'wait', 'ms': 1500})
        return r
    def rows(self): return self({'op': 'rows'})['out']
def parse_row(row):
    texts = [it for it in row['items'] if it['txt']]
    order = next((it['txt'] for it in texts if re.match(r'^\d{4}\.\d{4}[.A-Z]\d{2}$', it['txt'])), None)
    ox = next((it['x'] for it in texts if it['txt'] == order), 262) if order else 262
    codes = [it for it in texts if re.match(r'^[A-Z][A-Za-z0-9_-]*[-_][A-Za-z0-9-]+$', it['txt']) and it['x'] < ox]
    code = max(codes, key=lambda it: it['x'])['txt'] if codes else None
    hidden = [it['txt'] for it in codes if it['txt'] != code]
    desig = next((it['txt'] for it in texts if it['x'] > 340 and it['w'] > 250), None)
    imgs = [it for it in row['items'] if it['img']]
    status = [it for it in imgs if NAMES.get(it['img'][:8]) in STATUS]
    ctrls = [it for it in imgs if NAMES.get(it['img'][:8]) and NAMES.get(it['img'][:8]) not in STATUS]
    cols = []
    ctrls_sorted = sorted(ctrls, key=lambda c: c['x']); status_sorted = sorted(status, key=lambda c: c['x'])
    if ctrls_sorted and len(status_sorted) == len(ctrls_sorted):
        # one status icon per control (Baseband/RF tabs): pair in x order
        for ic, ctrl in zip(status_sorted, ctrls_sorted):
            cols.append({'x': ctrl['x'], 'icon_id': ic['id'], 'status': NAMES.get(ic['img'][:8]), 'ctrl_id': ctrl['id'], 'ctrl': NAMES.get(ctrl['img'][:8]), 'shared_status': False})
    elif ctrls_sorted and len(status_sorted) == 1:
        # one status icon shared by all controls of the row (Digital Standards tab)
        ic = status_sorted[0]
        for ctrl in ctrls_sorted:
            cols.append({'x': ctrl['x'], 'icon_id': ic['id'], 'status': NAMES.get(ic['img'][:8]), 'ctrl_id': ctrl['id'], 'ctrl': NAMES.get(ctrl['img'][:8]), 'shared_status': True})
    else:
        for ic in status_sorted:
            ctrl = next((c for c in ctrls_sorted if 0 < c['x'] - ic['x'] <= 22), None)
            cols.append({'x': ic['x'], 'icon_id': ic['id'], 'status': NAMES.get(ic['img'][:8]), 'ctrl_id': ctrl['id'] if ctrl else None, 'ctrl': NAMES.get(ctrl['img'][:8]) if ctrl else None, 'shared_status': False})
    inputs = [{'id': it['id'], 'x': it['x'], 'val': it['val']} for it in row['items'] if it['tag'] == 'INPUT']
    bgs = [{'id': it['id'], 'x': it['x'], 'bg': it['bg']} for it in row['items'] if it['bg'] and it['w'] <= 20]
    return {'y': row['y'], 'code': code, 'hidden': hidden, 'order': order, 'desig': desig, 'cols': cols, 'inputs': inputs, 'small_bg': bgs, 'texts': [it['txt'] for it in texts]}
def find_row(rows, code):
    for r in rows:
        p = parse_row(r)
        if p['code'] == code: return p
    return None
