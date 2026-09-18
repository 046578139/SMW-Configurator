/**
 * Regression tests for the R&S FSW profile.
 * Run with:  node --test tests/fsw.test.mjs
 *
 * Every expectation cites the row of the ordering information it protects
 * (FSW specifications v17.01, PD 5215.6749.22, pages 43 to 51), so a failing
 * test points straight at the line that it came from.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { FSW } from '../assets/js/fsw/index.js';   // activates the FSW profile the core modules work on
import {
  OPTIONS, BY_ID, MODELS, BANDWIDTH, FLOATABLE, SHORTHAND, BASE_UNIT, typeName, FRONT_PANEL, REAR_PANEL
} from '../assets/js/fsw/catalog.js';
import { validate, autoResolve, holds, parse, ruledOutBy, needText } from '../assets/js/rules.js';
import { bomLines, optionCard, freqCard } from '../assets/js/ui.js';
import { derive, vitals } from '../assets/js/fsw/derive.js';
import { PRESETS } from '../assets/js/fsw/presets.js';
import { analysisBw } from '../assets/js/fsw/rules.js';
import { readText } from '../assets/js/import.js';
import { summarize } from '../assets/js/saved.js';

const ids = sel => validate(sel).errors.map(e => e.id);
const ok = sel => validate(sel).ok;
const issue = (sel, id) => validate(sel).errors.find(e => e.id === id);

/* ---------------------------------------------------------------- catalog */

test('catalog is internally consistent', () => {
  const seen = new Set();
  for (const o of OPTIONS) {
    assert.ok(!seen.has(o.id), `duplicate option id ${o.id}`);
    seen.add(o.id);
    assert.ok(o.name && o.order && o.section && o.group, `${o.id} is missing a required field`);
    assert.match(o.order, /^\d{4}\.\d{4}\.(\d{2}|xx)$/, `${o.id}: order number ${o.order}`);
    assert.ok(FSW.SECTIONS.some(s => s.id === o.section), `${o.id}: unknown section ${o.section}`);
    if (!o.accessory) assert.ok(o.page >= 43 && o.page <= 51, `${o.id}: page ${o.page} is outside the ordering information`);
  }
  assert.equal(MODELS.length, 7);
  assert.equal(OPTIONS.filter(o => o.baseModel).length, 7);
});

test('every requirement expression parses and names known options', () => {
  const known = new Set(OPTIONS.map(o => o.id));
  const leaves = node => node.ids ? [node] : (node.and || node.or).flatMap(leaves);
  for (const o of OPTIONS) {
    for (const expr of [o.requires, o.maxReq, o.hintIf].filter(Boolean)) {
      for (const leaf of leaves(parse(expr))) {
        for (const id of leaf.ids) assert.ok(known.has(id), `${o.id}: "${expr}" names unknown option ${id}`);
      }
    }
  }
  for (const [name, list] of Object.entries(SHORTHAND)) {
    for (const id of list.split('|')) assert.ok(known.has(id), `shorthand ${name} names unknown option ${id}`);
  }
});

test('conflicts are declared on both sides', () => {
  for (const o of OPTIONS) {
    for (const other of o.conflicts || []) {
      assert.ok(BY_ID[other], `${o.id} conflicts with unknown ${other}`);
      assert.ok((BY_ID[other].conflicts || []).includes(o.id), `${o.id} conflicts with ${other} but not the other way round`);
    }
  }
});

test('order numbers are unique except where the ordering information prints "xx"', () => {
  const byOrder = new Map();
  for (const o of OPTIONS) {
    if (o.order.endsWith('xx')) continue;
    assert.ok(!byOrder.has(o.order), `${o.id} and ${byOrder.get(o.order)} share ${o.order}`);
    byOrder.set(o.order, o.id);
  }
});

test('the models carry the numbers 1331.5003.08 to .85 and their connectors (p43, p32)', () => {
  assert.deepEqual(MODELS.map(id => BY_ID[id].order),
    ['1331.5003.08', '1331.5003.13', '1331.5003.26', '1331.5003.43', '1331.5003.50', '1331.5003.67', '1331.5003.85']);
  assert.deepEqual(MODELS.map(id => BY_ID[id].meta.fMax), [8, 13.6, 26.5, 43.5, 50, 67, 85]);
  assert.equal(BY_ID.FSW8.meta.conn, 'N female');
  assert.match(BY_ID.FSW85.meta.conn, /1\.00 mm male/);
});

test('type designations print as on a quotation', () => {
  assert.equal(typeName('FSW26'), 'R&S®FSW26');
  assert.equal(typeName('K18'), 'R&S®FSW-K18');
  assert.equal(typeName('B24-43'), 'R&S®FSW-B24');
  assert.equal(typeName('K8-FL'), 'R&S®FSW-K8');
  assert.equal(typeName('VSE'), 'R&S®FSW-VSE');
  assert.equal(typeName('ZZA-KN5'), 'R&S®ZZA-KN5');
  assert.equal(typeName('FS-Z60'), 'RPG FS-Z60');
  assert.equal(typeName('AD-NF-35F'), '3587.7829.00', 'an adapter without a type designation prints its order number');
  assert.equal(typeName(BASE_UNIT.id), 'R&S®FSW');
});

/* --------------------------------------------------------- floating licences */

test('every application marked "also available as floating license" has a .51 variant needing R&S FSW-FL (p46, footnote 59)', () => {
  for (const id of FLOATABLE) {
    const fl = BY_ID[`${id}-FL`];
    assert.ok(fl, `${id} has no floating variant`);
    assert.equal(fl.order, BY_ID[id].order.replace(/\.02$/, '.51'));
    assert.equal(fl.code, BY_ID[id].code);
    assert.ok(fl.floating && fl.section === 'floating');
    /* on an FSW43: the 802.11ad/ay and UWB applications need a bandwidth the FSW8 cannot take */
    assert.ok(!ok({ FSW43: 1, [fl.id]: 1 }), `${fl.id} must need the smart card`);
    assert.ok(ok(autoResolve({ FSW43: 1, [fl.id]: 1 })), `${fl.id} must resolve`);
    assert.ok(autoResolve({ FSW43: 1, [fl.id]: 1 }).FL, `${fl.id} resolves by adding FL`);
    assert.ok(ids({ FSW43: 1, FL: 1, [id]: 1, [fl.id]: 1 }).some(x => x.startsWith('clash-')), `${id} and ${fl.id} clash`);
  }
  assert.equal(OPTIONS.filter(o => o.floating).length, FLOATABLE.length);
});

test('a requirement that names an application is met by either form of it', () => {
  assert.ok(ok({ FSW8: 1, FL: 1, 'K8-FL': 1, K8E: 1 }), 'K8E on a floating K8');
  assert.ok(ok({ FSW8: 1, B40: 1, FL: 1, K91: 1, 'K91N-FL': 1 }), 'floating K91N on a fixed K91');
  assert.ok(ok({ FSW8: 1, B160: 1, K144: 1, K148: 1, K171: 1 }));
  assert.ok(ok({ FSW8: 1, B160: 1, FL: 1, 'K144-FL': 1, 'K148-FL': 1, K171: 1 }), 'K171 on floating NR licences');
  const need = validate({ FSW8: 1, K8E: 1 }).errors.find(e => e.id === 'req-K8E');
  assert.equal(needText({ ids: ['K8', 'K8-FL'], n: 1 }), 'R&S®FSW-K8', 'the two forms print once');
  assert.deepEqual(need.fix, ['K8'], 'the fixed licence is what a fix adds');
});

/* ----------------------------------------------------------- the model */

test('the model is the one mandatory choice, and there is exactly one', () => {
  assert.ok(ids({}).includes('no-model'));
  assert.ok(validate({}).errors.find(e => e.id === 'no-model').todo, 'an untouched page has a step, not a fault');
  assert.ok(ok({ FSW8: 1 }));
  assert.ok(ids({ FSW8: 1, FSW26: 1 }).includes('multi-model'));
  assert.deepEqual(FSW.ui.exclusive('FSW26'), MODELS.filter(m => m !== 'FSW26'));
  assert.ok(FSW.ui.required('model', {}));
  assert.ok(!FSW.ui.required('model', { FSW8: 1 }));
});

test('the model is the parts list base line, never an option line', () => {
  const lines = bomLines({ FSW43: 1, B2001: 1, K144: 1 }, BASE_UNIT);
  assert.equal(lines[0].id, 'FSW43');
  assert.equal(lines[0].order, '1331.5003.43');
  assert.equal(lines[0].group, 'Base unit');
  assert.ok(!lines.slice(1).some(l => l.id === 'FSW43'));
  assert.equal(lines.length, 3);
  const none = bomLines({ K144: 1 }, BASE_UNIT);
  assert.equal(none[0].id, 'FSW', 'without a model the stand-in heads the list');
});

test('options with one order number per model are for that model only (p43, p44, p45)', () => {
  const cases = [
    ['B24-13', ['FSW8', 'FSW13']], ['B24-26', ['FSW26']], ['B24-43', ['FSW43']],
    ['B24-49', ['FSW50']], ['B24-51', ['FSW50']], ['B24-66', ['FSW67']], ['B24-67', ['FSW67']],
    ['B71-13', ['FSW8', 'FSW13']], ['B71-26', ['FSW26', 'FSW43', 'FSW50']], ['B71-67', ['FSW67']], ['B71-86', ['FSW85']],
    ['B21-28', ['FSW26', 'FSW43', 'FSW50', 'FSW67']], ['B21-86', ['FSW85']],
    ['B8-26', ['FSW8', 'FSW13', 'FSW26']], ['B8-02', ['FSW43', 'FSW50', 'FSW67', 'FSW85']],
    ['B25', ['FSW8', 'FSW13', 'FSW26']], ['B90G', ['FSW85']],
    ['B1200', ['FSW26', 'FSW43', 'FSW50', 'FSW67', 'FSW85']], ['B2001', ['FSW26', 'FSW43', 'FSW50', 'FSW67', 'FSW85']],
    ['B800R', ['FSW26', 'FSW43', 'FSW50', 'FSW67', 'FSW85']],
    ['B4001', ['FSW43', 'FSW50', 'FSW67', 'FSW85']], ['B6001', ['FSW43', 'FSW50', 'FSW67', 'FSW85']], ['B8001', ['FSW43', 'FSW50', 'FSW67', 'FSW85']]
  ];
  for (const [id, models] of cases) {
    for (const m of MODELS) {
      const sel = { [m]: 1, [id]: 1 };
      if (models.includes(m)) assert.ok(ok(sel), `${id} on ${m} should be fine: ${ids(sel)}`);
      else {
        const e = issue(sel, `req-${id}`);
        assert.ok(e, `${id} on ${m} should be refused`);
        assert.deepEqual(e.fix, [], 'nothing can be added to settle it');
        assert.deepEqual(e.drop, [id]);
        assert.equal(ruledOutBy(BY_ID[id], { [m]: 1 }), m, `${id}'s card says ${m} rules it out`);
      }
    }
    assert.deepEqual(BY_ID[id].meta?.models || models, models);
  }
});

test('a model that rules an option out is offered for swapping to the lowest that allows it', () => {
  const e = issue({ FSW13: 1, 'B21-28': 1 }, 'req-B21-28');
  assert.deepEqual(e.swap, ['FSW13', 'FSW26']);
  assert.deepEqual(issue({ FSW13: 1, B90G: 1 }, 'req-B90G').swap, ['FSW13', 'FSW85']);
  assert.deepEqual(issue({ FSW13: 1, B4001: 1 }, 'req-B4001').swap, ['FSW13', 'FSW43']);
  /* an indirect need too: the 1 GHz streaming interface wants a bandwidth only the FSW26 and up take */
  assert.deepEqual(issue({ FSW8: 1, B1017: 1 }, 'req-B1017').swap, ['FSW8', 'FSW26']);
  assert.deepEqual(issue({ FSW8: 1, B124: 1 }, 'req-B124').swap, ['FSW8', 'FSW43']);
});

/* ----------------------------------------------------- analysis bandwidth */

test('one analysis bandwidth option per instrument; the real-time analyzers include theirs (p44, p45)', () => {
  assert.ok(ids({ FSW26: 1, B160: 1, B512: 1 }).includes('multi-bw'));
  assert.ok(ids({ FSW26: 1, B512R: 1, B2001: 1 }).includes('multi-bw'));
  assert.deepEqual(FSW.ui.exclusive('B160'), BANDWIDTH.filter(b => b !== 'B160'));
  assert.equal(analysisBw({ FSW26: 1 }).bw, 28);
  assert.equal(analysisBw({ FSW26: 1, B512R: 1 }).bw, 512);
  assert.equal(analysisBw({ FSW26: 1, B800R: 1 }).bw, 2000);
  assert.equal(analysisBw({ FSW26: 1, B80: 1, U160: 1, U320: 1 }).bw, 320, 'upgrades count as the bandwidth they produce');
  const sel = { FSW26: 1, B512: 1 };
  FSW.ui.setLevel('bw-none', sel);
  assert.deepEqual(sel, { FSW26: 1 });
});

test('an application that needs a wider bandwidth than the one chosen names it and offers the swap', () => {
  const e = issue({ FSW26: 1, B160: 1, K17: 1, K17S: 1 }, 'req-K17S');
  assert.ok(e, 'K17S needs 512 MHz or more (p46)');
  assert.deepEqual(e.fix, []);
  assert.deepEqual(e.swap, ['B160', 'B512']);
  assert.equal(ruledOutBy(BY_ID.K17S, { FSW26: 1, B160: 1, K17: 1 }), 'B160');
  /* without a bandwidth option, the fix adds the narrowest that does */
  const r = autoResolve({ FSW26: 1, K17S: 1 });
  assert.ok(ok(r) && r.K17 && r.B512, JSON.stringify(r));
  assert.ok(!r.U512, 'a new instrument takes the option, not an upgrade');
});

test('bandwidth prerequisites as printed (p46 to p48)', () => {
  const needs = [
    ['K91', 'B40'], ['K100', 'B40'], ['K101', 'B40'], ['K104', 'B40'], ['K105', 'B40'], ['K201', 'B40'],
    ['K118', 'B160'], ['K119', 'B160'], ['K192', 'B320'], ['K193', 'B320'],
    ['K95', 'B2001'], ['K97', 'B2001'], ['K149', 'B1200'], ['B517', 'B512'], ['B1017', 'B1200'],
    ['B106', 'B160'], ['B108', 'B1200'], ['B124', 'B4001']
  ];
  for (const [id, first] of needs) {
    const model = first === 'B4001' ? 'FSW43' : 'FSW26';
    assert.ok(!ok({ [model]: 1, [id]: 1 }), `${id} alone must fail`);
    const r = autoResolve({ [model]: 1, [id]: 1 });
    assert.ok(ok(r), `${id} resolves: ${ids(r)}`);
    assert.ok(r[first], `${id} resolves with ${first}, got ${JSON.stringify(r)}`);
  }
  assert.ok(ok({ FSW26: 1, B2001: 1, K95: 1 }) && ok({ FSW26: 1, B800R: 1, K97: 1 }));
  assert.ok(ok({ FSW43: 1, B4001: 1, K149: 1, B124: 1 }));
  assert.ok(ok({ FSW43: 1, B1200: 1, U4002: 1, B124: 1 }), 'U4002 gives the 4.4 GHz B124 asks for');
  assert.ok(!ok({ FSW43: 1, B4001: 1, B517: 1 }), 'B517 is not available with B4001 (p38)');
});

test('the real-time applications each take one bandwidth and refuse the others (p48)', () => {
  assert.ok(ok({ FSW26: 1, B160: 1, K161R: 1 }) && ok({ FSW26: 1, B320: 1, K161R: 1 }));
  assert.ok(ids({ FSW26: 1, B512: 1, K161R: 1 }).includes('clash-B512-K161R'));
  assert.ok(ok({ FSW26: 1, B512: 1, K512RE: 1 }));
  assert.ok(ids({ FSW26: 1, B512R: 1, K512RE: 1 }).includes('clash-B512R-K512RE'));
  assert.ok(ok({ FSW26: 1, B1200: 1, K800RE: 1 }) && ok({ FSW26: 1, B2001: 1, K800RE: 1 }));
  assert.ok(ids({ FSW26: 1, B800R: 1, K800RE: 1 }).includes('clash-B800R-K800RE'));
  assert.equal(derive({ FSW26: 1, B2001: 1, K800RE: 1 }).realtime.bw, 800);
  assert.equal(derive({ FSW26: 1, B512R: 1 }).realtime.poi, '≤ 15 µs');
});

/* -------------------------------------------------- application chains */

test('application prerequisites as printed (p46, p47)', () => {
  const chains = [
    ['K6S', ['K6']], ['K8E', ['K8']], ['K18D', ['K18']], ['K18F', ['K18']], ['K18M', ['K18', 'K18D']],
    ['K54CAL', ['K54']], ['K60H', ['K60']], ['K60C', ['K60']], ['K60P', ['K60']], ['K70M', ['K70']], ['K70P', ['K70']],
    ['K91N', ['K91', 'B40']], ['K91AC', ['K91', 'B40']], ['K91AX', ['K91', 'B40']], ['K91BE', ['K91', 'B40']], ['K91P', ['K91', 'B40']],
    ['K91BN', ['K91', 'K91BE', 'B40']], ['K102', ['K100', 'B40']], ['K103', ['K101', 'B40']],
    ['K147', ['K144']], ['K147C', ['K147', 'K144']], ['K148', ['K144']], ['K171', ['K144', 'K148']], ['K175', ['K144']], ['K184', ['K144']],
    ['K552', ['B517', 'B512']], ['B71E', ['B71-26']], ['B24U', ['B24-43']]
  ];
  for (const [id, adds] of chains) {
    const model = id === 'B24U' ? 'FSW43' : 'FSW26';
    assert.ok(!ok({ [model]: 1, [id]: 1 }), `${id} alone must fail`);
    const r = autoResolve({ [model]: 1, [id]: 1 });
    assert.ok(ok(r), `${id} resolves: ${ids(r)}`);
    for (const a of adds) assert.ok(r[a], `${id} resolves with ${a}, got ${JSON.stringify(r)}`);
  }
  assert.ok(ok({ FSW26: 1, K104: 1, B40: 1, K102: 1 }), 'K102 takes K104 as well as K100');
  assert.ok(ok({ FSW26: 1, K105: 1, B40: 1, K103: 1 }), 'K103 takes K105 as well as K101');
  assert.ok(ok({ FSW26: 1, K145: 1, K148: 1, K171: 1 }), 'the 5G NR extensions take the uplink licence too');
  assert.ok(ok({ FSW26: 1, B1200: 1, B1017: 1, K552: 1 }), 'K552 takes B1017 as well as B517');
});

test('every option can be added to some model, alone or resolved, and a wrong model says so', () => {
  for (const o of OPTIONS) {
    if (o.baseModel) continue;
    const fits = MODELS.filter(m => validate(autoResolve({ [m]: 1, [o.id]: 1 })).ok);
    assert.ok(fits.length, `${o.id} resolves on no model`);
    /* on a model that cannot take it, the issue names the model and offers no fix */
    for (const m of MODELS.filter(m => !fits.includes(m))) {
      const v = validate({ [m]: 1, [o.id]: 1 });
      const e = v.errors.find(x => x.option === o.id || (x.drop || []).includes(o.id));
      assert.ok(e, `${o.id} on ${m}: no issue names it`);
      assert.ok(!e.fix?.length, `${o.id} on ${m}: a fix is offered that cannot settle it`);
    }
  }
});

test('upgrades are for an instrument in the field, and follow the ladder (p49, p50)', () => {
  assert.ok(ok({ FSW26: 1, U40: 1 }));
  assert.ok(!ok({ FSW26: 1, U80: 1 }) && ok({ FSW26: 1, U40: 1, U80: 1 }) && ok({ FSW26: 1, B40: 1, U80: 1 }));
  assert.ok(ok({ FSW26: 1, B80: 1, U160: 1, U320: 1 }));
  assert.ok(!ok({ FSW26: 1, B80: 1, U512: 1, U160: 1 }), 'U512 excludes U160');
  assert.ok(ok({ FSW26: 1, B512: 1, U1200: 1, U2001: 1 }));
  assert.ok(!ok({ FSW13: 1, B512: 1, U1200: 1 }), 'U1200 is for FSW26 and up');
  assert.ok(ok({ FSW43: 1, B2001: 1, U4002: 1, U6001: 1, U8001: 1 }));
  assert.ok(!ok({ FSW43: 1, B512R: 1, U4001: 1 }), 'not for instruments with B512R');
  assert.equal(analysisBw({ FSW43: 1, B2001: 1, U4002: 1, U6001: 1, U8001: 1 }).bw, 8312);
  /* an upgrade is never proposed as a fix on a new instrument */
  assert.ok(!Object.keys(autoResolve({ FSW26: 1, B80: 1, K95: 1 })).some(id => id.startsWith('U')));
});

test('the accessories carry no rules and say when the configuration suggests them', () => {
  for (const o of OPTIONS.filter(o => o.accessory)) {
    assert.ok(!o.requires && !o.conflicts, `${o.id} is an accessory with a rule`);
    assert.ok(ok({ FSW8: 1, [o.id]: 1 }));
  }
  assert.ok(holds(BY_ID['FS-SNS26'].hintIf, { FSW26: 1, K30: 1 }));
  assert.ok(!holds(BY_ID['FS-SNS26'].hintIf, { FSW8: 1, K30: 1 }));
  assert.ok(holds(BY_ID['DIGIQ-HS'].hintIf, { B1017: 1 }));
  assert.ok(holds(BY_ID['FS-Z110'].hintIf, { 'B21-86': 1 }));
});

test('advisory checks: what a data sheet recommends and what an accessory supplies', () => {
  const info = sel => validate(sel).info.map(i => i.id);
  assert.ok(info({ FSW26: 1, K30: 1 }).includes('k30-source'));
  assert.ok(!info({ FSW26: 1, K30: 1, 'FS-SNS26': 1 }).includes('k30-source'));
  assert.ok(info({ FSW26: 1, 'B21-28': 1 }).includes('b21-mixer'));
  assert.ok(info({ FSW26: 1, K553: 1 }).includes('k553-frontend'));
  assert.ok(info({ FSW26: 1, K54: 1 }).includes('k54-preamp'));
  assert.ok(!info({ FSW85: 1, K54: 1 }).includes('k54-preamp'), 'the FSW85 has no B24');
  assert.ok(info({ FSW26: 1, FL: 1 }).includes('fl-unused'));
  assert.ok(info({ FSW26: 1, B800R: 1 }).includes('realtime-temp'));
  assert.ok(info({ FSW26: 1, B17: 1 }).includes('b17-cable'));
});

/* ------------------------------------------------------ derived figures */

test('derived capabilities follow the specifications', () => {
  const d = derive({ FSW85: 1, B90G: 1, B800R: 1, 'B21-86': 1, K97: 1, B108: 1, B1017: 1 });
  assert.equal(d.fMax, 90);
  assert.equal(d.bandwidth, 2000);
  assert.equal(d.realtime.bw, 800);
  assert.equal(d.preamp, 0, 'no preamplifier exists for the FSW85');
  assert.equal(d.memory, 8);
  assert.equal(d.stream, 1000);
  assert.ok(d.extMixer && d.panel.rf2 && d.panel.if2g && !d.panel.analogBbInv);
  const v = vitals(d);
  assert.equal(v[0].value, '2 Hz to 90 GHz');
  assert.equal(v[1].value, '2 GHz');
  const e = derive({ FSW8: 1, 'B24-13': 1, B25: 1, 'B8-26': 1, 'B71-13': 1, B71E: 1 });
  assert.equal(e.preamp, 13.6);
  assert.equal(e.rbwMax, 80);
  assert.equal(e.analogBb, 80);
  assert.ok(e.panel.analogBbInv && !e.panel.if2g && !e.panel.rf2);
  assert.equal(derive({}).fMax, 0);
});

test('the panels list what the model and the options fit', () => {
  const p = derive({ FSW8: 1 });
  const c = FSW.panel.faceCounts(p);
  const q = FSW.panel.faceCounts(derive({ FSW85: 1, 'B21-86': 1, 'B71-86': 1, B17: 1, B517: 1, B10: 1, B112: 1 }));
  assert.ok(q.front > c.front && q.rear > c.rear);
  for (const g of [...FRONT_PANEL, ...REAR_PANEL]) for (const i of g.items) {
    assert.ok(i.label && i.kind && i.type, `${i.label} is incomplete`);
    if (i.when) assert.ok(i.when in p.panel, `${i.label}: unknown condition ${i.when}`);
  }
  const front = FSW.panel.renderFront(p, { FSW8: 1 }, 't');
  const rear = FSW.panel.renderRear(p, 600, 't');
  assert.ok(front.startsWith('\n<svg') && rear.startsWith('\n<svg'));
  assert.ok(front.includes('RF INPUT') && !front.includes('RF INPUT 2'));
  assert.ok(FSW.panel.renderFront(derive({ FSW85: 1 }), { FSW85: 1 }).includes('RF INPUT 2'));
  assert.ok(!rear.includes('DIG IQ 40G') && FSW.panel.renderRear(derive({ FSW26: 1, B512: 1, B517: 1 })).includes('DIG IQ 40G'));
  assert.ok(FSW.diagram.renderRuler(p).includes('FSW8 · 8 GHz'));
  assert.ok(FSW.diagram.renderChain(p, {}).includes('RF IN'));
});

test('the cards render every option and every model', () => {
  for (const o of OPTIONS) {
    if (o.baseModel) assert.ok(freqCard(o, {}, 85).includes(o.order));
    else assert.ok(optionCard(o, {}).includes(o.order.replace('xx', 'xx')));
  }
  assert.ok(optionCard(BY_ID.K17S, { FSW26: 1, B160: 1 }).includes('not available with B160'));
  assert.ok(optionCard(BY_ID.K17S, { FSW26: 1 }).includes('needs K17 + B512'));
  assert.ok(optionCard(BY_ID.FL, {}).includes('hardware'));
  for (const sec of FSW.SECTIONS) {
    const body = FSW.ui.renderSection(sec, { FSW26: 1 });
    if (body != null) assert.ok(body.length > 100, `${sec.id} renders`);
  }
});

/* ----------------------------------------------------------- presets */

test('every starting point is a valid configuration', () => {
  for (const p of PRESETS) {
    const v = validate(p.sel);
    assert.ok(v.ok, `${p.id}: ${v.errors.map(e => e.id).join(', ')}`);
    assert.ok(MODELS.some(m => p.sel[m]), `${p.id} names a model`);
    for (const id of Object.keys(p.sel)) assert.ok(BY_ID[id], `${p.id} names unknown ${id}`);
  }
});

/* ------------------------------------------------------ reader and summary */

test('the document reader reads the model, the options and a per-model order number', () => {
  const r = readText('R&S FSW26 1331.5003.26 1\nR&S®FSW-B2001 1331.6916.14 1\nR&S FSW-K18 1325.2170.02 2\nRF preamplifier 1313.0832.26 1\nFSW-B24 1313.0832.13');
  const got = Object.fromEntries(r.items.map(i => [i.id, i.qty]));
  assert.equal(got.FSW26, 1);
  assert.equal(got.B2001, 1);
  assert.equal(got.K18, 2);
  assert.equal(got['B24-26'], 1, 'the order number settles which B24');
  assert.equal(got['B24-13'], 1, 'and so does the next one');
  assert.equal(summarize({ FSW26: 1, B2001: 1, K18: 1, K18D: 1 }), 'FSW26 · B2001 · 3 options');
  assert.equal(summarize({}), '0 options');
});
