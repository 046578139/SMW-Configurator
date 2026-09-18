/**
 * What the behaviour corpus records, shared by the generator (tools/corpus.mjs)
 * and the test that compares against it. Everything the page derives from a
 * selection goes through here, so a change anywhere in the engine shows up.
 */

import { createHash } from 'node:crypto';

import { OPTIONS, BASE_UNIT, RF_PATH_MATRIX } from '../assets/js/smw200a/catalog.js';
import { validate, autoResolve, MAIN_MODULES } from '../assets/js/rules.js';
import { derive, vitals } from '../assets/js/smw200a/derive.js';
import { bomLines } from '../assets/js/ui.js';
import { PRESETS } from '../assets/js/smw200a/presets.js';
import { summarize, packSel } from '../assets/js/saved.js';

const sha = s => createHash('sha256').update(s).digest('hex').slice(0, 16);

/* a small deterministic generator, so the random cases are the same every run */
function rng (seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** The cases, each `{name, sel}`. */
export function corpusCases () {
  const cases = [];
  const add = (name, sel) => cases.push({ name, sel });
  const freqA = OPTIONS.filter(o => o.step === 1).map(o => o.id);
  const all = OPTIONS.map(o => o.id);

  add('empty', {});
  for (const p of PRESETS) add(`preset ${p.id}`, { ...p.sel });
  for (const id of all) add(`alone ${id}`, { [id]: 1 });
  for (const f of freqA) for (const id of all) if (id !== f) add(`${f} + ${id}`, { [f]: 1, [id]: 1 });
  for (const mm of MAIN_MODULES) for (const id of all) if (id !== mm) add(`${mm} + ${id}`, { [mm]: 1, [id]: 1 });
  for (const [a, bs] of Object.entries(RF_PATH_MATRIX)) for (const b of bs) add(`${a} + ${b} + B13T`, { [a]: 1, [b]: 1, B13T: 1 });
  for (const [a, bs] of Object.entries(RF_PATH_MATRIX)) for (const b of bs) add(`${a} + ${b} + B13XT + B9*2`, { [a]: 1, [b]: 1, B13XT: 1, B9: 2 });

  const rand = rng(20260918);
  for (let i = 0; i < 400; i++) {
    const n = 3 + Math.floor(rand() * 6);
    const sel = {};
    for (let k = 0; k < n; k++) {
      const id = all[Math.floor(rand() * all.length)];
      sel[id] = rand() < 0.2 ? 2 : 1;
    }
    add(`random ${i}`, sel);
  }
  return cases;
}

/** Everything recorded about one selection, in a stable, comparable form. */
export function describeCase (sel) {
  const v = validate(sel);
  const issue = e => ({
    id: e.id, todo: !!e.todo, section: e.section || null, option: e.option || null,
    fix: e.fix || [], fixQty: e.fixQty || {}, drop: e.drop || [], swap: e.swap || null, setQty: e.setQty || null,
    text: sha(`${e.title}\n${e.detail}`)
  });
  const resolved = autoResolve(sel);
  const d = derive(sel);
  return {
    validation: { ok: v.ok, errors: v.errors.map(issue), warnings: v.warnings.map(issue), info: v.info.map(issue) },
    resolved: packSel(resolved),
    resolvedOk: validate(resolved).ok,
    derived: JSON.parse(JSON.stringify(d, (k, val) => (k === 'freqA' || k === 'freqB' ? (val && val.id) || null : val))),
    vitals: vitals(d),
    bom: bomLines(sel, BASE_UNIT).map(l => `${l.group}|${l.id}|${l.order}|${l.qty}`),
    summary: summarize(sel)
  };
}
