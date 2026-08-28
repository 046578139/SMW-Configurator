/**
 * Regression tests for the configuration rules.
 * Run with:  node --test tests/
 *
 * Every expectation cites the rule it protects, so a failing test points
 * straight at the paragraph in the configuration guide that it came from.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { OPTIONS, BY_ID, RF_PATH_MATRIX, O_VARIANTS } from '../assets/js/catalog.js';
import { validate, autoResolve, holds, parse, evaluate, maxQty, qtyChoices } from '../assets/js/rules.js';
import { derive } from '../assets/js/derive.js';
import { PRESETS } from '../assets/js/presets.js';

const titles = sel => validate(sel).errors.map(e => e.id);
const ok = sel => validate(sel).ok;

/* ---------------------------------------------------------------- catalog */

test('catalog is internally consistent', () => {
  const ids = new Set();
  for (const o of OPTIONS) {
    assert.ok(!ids.has(o.id), `duplicate option id ${o.id}`);
    ids.add(o.id);
    assert.ok(o.name && o.order && o.section, `${o.id} is missing a required field`);
  }
});

test('every requirement expression parses and names known options', () => {
  const known = new Set(OPTIONS.map(o => o.id));
  const leaves = node => node.ids ? [node] : (node.and || node.or).flatMap(leaves);
  for (const o of OPTIONS) {
    for (const expr of [o.requires, o.maxReq, ...(o.perPath || [])].filter(Boolean)) {
      const ast = parse(expr);
      for (const leaf of leaves(ast)) {
        for (const id of leaf.ids) {
          assert.ok(known.has(id), `${o.id}: expression "${expr}" names unknown option ${id}`);
        }
      }
    }
  }
});

test('conflicts are declared on both sides where both options exist', () => {
  for (const o of OPTIONS) {
    for (const other of o.conflicts || []) {
      if (!BY_ID[other]) continue;
      const back = BY_ID[other].conflicts || [];
      const symmetric = back.includes(o.id) ||
        // frequency variants list the main modules rather than the reverse
        O_VARIANTS.includes(o.id) || O_VARIANTS.includes(other);
      assert.ok(symmetric, `${o.id} conflicts with ${other} but not the other way round`);
    }
  }
});

/* -------------------------------------------------------------- mandatory */

test('an empty configuration reports both mandatory items', () => {
  assert.deepEqual(titles({}).sort(), ['no-freq-a', 'no-main-module']);
});

test('a frequency option plus a main module is already valid', () => {
  assert.ok(ok({ B1003: 1, B13: 1 }));
});

/* ------------------------------------------------------------- RF paths */

test('RF path combinations follow the matrix in section 1.2', () => {
  for (const [a, allowed] of Object.entries(RF_PATH_MATRIX)) {
    const needsWideband = O_VARIANTS.includes(a);
    const mm = needsWideband ? 'B13XT' : 'B13T';
    for (const b of OPTIONS.filter(o => o.step === 5 && o.meta?.path === 'B')) {
      const sel = { [a]: 1, [mm]: 1, [b.id]: 1 };
      if (['B2012', 'B2031', 'B2044', 'B2044N', 'B2044O'].includes(b.id)) sel.B94L = 1;
      const errs = titles(sel);
      if (allowed.includes(b.id)) {
        assert.ok(!errs.includes('rf-combo'), `${a} + ${b.id} should be allowed`);
      } else {
        assert.ok(errs.includes('rf-combo'), `${a} + ${b.id} should be rejected`);
      }
    }
  }
});

test('a second RF path needs two I/Q paths to the RF section', () => {
  assert.ok(titles({ B1003: 1, B13: 1, B2003: 1 }).includes('path-b-needs-b13t'));
  assert.ok(ok({ B1003: 1, B13T: 1, B2003: 1 }));
});

test('the deeper chassis is required for 2 x 12.75, 2 x 31.8 and 2 x 44 GHz', () => {
  for (const [a, b] of [['B1012', 'B2012'], ['B1031', 'B2031'], ['B1044', 'B2044']]) {
    assert.ok(titles({ [a]: 1, B13T: 1, [b]: 1 }).includes('b94l-missing'), `${a}+${b}`);
    assert.ok(ok({ [a]: 1, B13T: 1, [b]: 1, B94L: 1 }), `${a}+${b} with B94L`);
  }
});

test('the deeper chassis is refused where it is not needed', () => {
  assert.ok(titles({ B1003: 1, B13T: 1, B2003: 1, B94L: 1 }).includes('b94l-not-allowed'));
});

test('"O" frequency options require the wideband main module', () => {
  for (const id of ['B1044O', 'B1056O', 'B1067O']) {
    assert.ok(titles({ [id]: 1, B13T: 1 }).includes('o-needs-b13xt'), id);
    assert.ok(ok({ [id]: 1, B13XT: 1 }), id);
  }
});

/* ----------------------------------------------------------- phase noise */

test('both RF paths must sit at the same phase noise level', () => {
  const base = { B1003: 1, B13T: 1, B2003: 1 };
  assert.ok(titles({ ...base, B709: 1 }).includes('pn-low'));
  assert.ok(ok({ ...base, B709: 1, B719: 1 }));
  assert.ok(titles({ ...base, B709: 1, B720: 1 }).length > 0, 'mismatched levels must fail');
});

test('a path B phase noise option without RF path B is refused', () => {
  assert.ok(titles({ B1003: 1, B13T: 1, B709: 1, B719: 1 }).includes('pn-nopath-low'));
});

/* -------------------------------------------------------------- baseband */

test('standard and wideband baseband hardware cannot be mixed', () => {
  assert.ok(titles({ B1003: 1, B13XT: 1, B9: 1, B10: 1 }).includes('std-on-wideband'));
  assert.ok(titles({ B1003: 1, B13T: 1, B10: 1, B9: 1 }).includes('wide-on-standard'));
});

test('R&S SMW-B9 and -B9F cannot be combined', () => {
  assert.ok(titles({ B1003: 1, B13XT: 1, B9: 1, B9F: 1 }).includes('b9-b9f'));
});

test('enhancements written for B9 also accept B9F', () => {
  assert.ok(ok({ B1003: 1, B13XT: 1, B9F: 1, K515: 1, K525: 1, K502: 1 }));
});

/* ------------------------------------------------------------ quantities */

test('a second unit is only offered once its condition holds', () => {
  const one = { B1003: 1, B13: 1, B10: 1 };
  assert.equal(maxQty(BY_ID.B10, one), 1, 'B13 carries a single I/Q path');
  assert.equal(maxQty(BY_ID.B10, { B1003: 1, B13T: 1, B10: 1 }), 2);
  assert.ok(titles({ ...one, B10: 2 }).includes('qty-B10'));
});

test('the fading simulator only comes in 1, 2 or 4 units', () => {
  const base = { B1003: 1, B13T: 1, B10: 1 };
  assert.deepEqual(qtyChoices(BY_ID.B14, base), [1, 2, 4]);
  assert.ok(titles({ ...base, B14: 3 }).includes('qtystep-B14'));
  assert.ok(ok({ ...base, B14: 4 }));
});

test('R&S SMW-B15 needs two generators before four units are possible', () => {
  assert.deepEqual(qtyChoices(BY_ID.B15, { B1003: 1, B13XT: 1, B9: 1 }), [2]);
  assert.deepEqual(qtyChoices(BY_ID.B15, { B1003: 1, B13XT: 1, B9: 2 }), [2, 4]);
});

test('WinIQSIM2 waveform packages stop at 250 registered waveforms', () => {
  const base = { B1003: 1, B13XT: 1, B9: 1 };
  assert.ok(ok({ ...base, 'K200-50': 5 }));
  assert.ok(titles({ ...base, 'K200-50': 5, 'K200-5': 1 }).includes('waveforms'));
});

/* ------------------------------------------------------- prerequisites */

test('prerequisite chains are reported against the option that broke', () => {
  const errs = validate({ B1003: 1, B13: 1, K512: 1 }).errors;
  assert.equal(errs[0].id, 'req-K512');
  assert.ok(errs[0].fix.includes('K511'));
});

test('an option needing one set per RF path checks both paths', () => {
  const twoPaths = { B1003: 1, B13T: 1, B2003: 1, B10: 1, B90: 1, K61: 1, K544: 1, K545: 1 };
  assert.ok(titles(twoPaths).some(t => t.startsWith('perpath-K545')));
  const complete = { ...twoPaths, B10: 2, K61: 2, K544: 2 };
  assert.ok(ok(complete));
});

/* ------------------------------------------------------------ autoResolve */

test('autoResolve follows a chain to a valid configuration', () => {
  const fixed = autoResolve({ B1003: 1, B13: 1, K512: 1 });
  assert.ok(ok(fixed));
  assert.equal(fixed.K511, 1);
  assert.equal(fixed.B10, 1);
});

test('autoResolve raises quantities rather than adding an illegal single unit', () => {
  const fixed = autoResolve({ B1003: 1, B13XT: 1, B9: 2, K74: 1 });
  assert.ok(ok(fixed));
  assert.equal(fixed.B15, 2);
});

test('autoResolve refuses a dead end instead of inventing a second main module', () => {
  const fixed = autoResolve({ B1067: 1, B13XT: 1, K512: 1 });
  assert.equal(fixed.B13, undefined);
  assert.equal(fixed.B13T, undefined);
  assert.equal(fixed.B13XT, 1);
});

test('autoResolve never removes something the user chose', () => {
  const start = { B1044: 1, B13T: 1, B2020: 1, K144: 1 };
  const fixed = autoResolve(start);
  for (const id of Object.keys(start)) assert.ok(fixed[id], `${id} was dropped`);
});

/* --------------------------------------------------------------- presets */

test('every starting point is a valid configuration', () => {
  for (const p of PRESETS) {
    const v = validate(p.sel);
    assert.ok(v.ok, `${p.id}: ${v.errors.map(e => e.title).join(', ')}`);
  }
});

/* ------------------------------------------------------------ capabilities */

test('derived figures follow the installed options', () => {
  const std = derive({ B1006: 1, B13T: 1, B10: 1 });
  assert.equal(std.bandwidth, 120);
  assert.equal(std.arb, 64);

  const wide = derive({ B1067: 1, B13XT: 1, B9: 2, K525: 2, K527: 2, K515: 2 });
  assert.equal(wide.bandwidth, 2000);
  assert.equal(wide.arb, 2048);

  const mimo = derive({ B1006: 1, B13T: 1, B10: 2, B14: 4, K74: 1, K75: 1 });
  assert.equal(mimo.fadingChannels, 32);
  assert.equal(mimo.mimo, 'up to 8×8');
});

test('a shorthand counts every option in its group', () => {
  assert.ok(holds('GEN*2', { B9: 1, B10: 1 }));
  assert.ok(!holds('GEN*2', { B10: 1 }));
  assert.ok(holds('WGEN', { B9F: 1 }));
  assert.equal(evaluate(parse('GEN*2'), { B10: 1 }).need[0].have, 1);
});
