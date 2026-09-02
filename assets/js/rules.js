/**
 * Requirement expression parser and configuration validator.
 *
 * Grammar
 *   expr   := term ('|' term)*
 *   term   := factor ('&' factor)*
 *   factor := '(' expr ')' | atom
 *   atom   := IDENT ['*' INT]
 *
 * An atom counts every option in its group: `GEN*2` is satisfied by one
 * R&S SMW-B9 plus one -B10 as well as by two -B10, which matches the way the
 * configuration guide words "two R&S SMW-B9/-B10".
 */

import {
  OPTIONS, BY_ID, SHORTHAND, RF_PATH_MATRIX, B94L_REQUIRED,
  O_VARIANTS, PHASE_NOISE_LEVELS
} from './catalog.js';

/* ---------------------------------------------------------------- parser */

const cache = new Map();

export function parse (src) {
  if (cache.has(src)) return cache.get(src);
  const tokens = src.match(/[A-Za-z][A-Za-z0-9-]*|\d+|[()&|*]/g) || [];
  let i = 0;
  const peek = () => tokens[i];
  const eat = t => { if (tokens[i] !== t) throw new Error(`expected ${t} in "${src}"`); i++; };

  function expr () {
    const parts = [term()];
    while (peek() === '|') { i++; parts.push(term()); }
    return parts.length === 1 ? parts[0] : { or: parts };
  }
  function term () {
    const parts = [factor()];
    while (peek() === '&') { i++; parts.push(factor()); }
    return parts.length === 1 ? parts[0] : { and: parts };
  }
  function factor () {
    if (peek() === '(') { i++; const e = expr(); eat(')'); return e; }
    const name = tokens[i++];
    let n = 1;
    if (peek() === '*') { i++; n = parseInt(tokens[i++], 10); }
    const ids = (SHORTHAND[name] || name).split('|');
    return { ids, n, label: name };
  }

  const ast = expr();
  cache.set(src, ast);
  return ast;
}

/* ------------------------------------------------------------- evaluation */

const countOf = (ids, sel) => ids.reduce((sum, id) => sum + (sel[id] || 0), 0);

/**
 * Evaluates an expression against a selection.
 * Returns { ok, need } where `need` lists the unmet atoms on the cheapest
 * path to satisfying the expression.
 */
export function evaluate (node, sel) {
  if (node.ids) {
    const have = countOf(node.ids, sel);
    return have >= node.n
      ? { ok: true, need: [] }
      : { ok: false, need: [{ ids: node.ids, n: node.n, have, label: node.label }] };
  }
  if (node.and) {
    const results = node.and.map(n => evaluate(n, sel));
    return {
      ok: results.every(r => r.ok),
      need: results.flatMap(r => r.need)
    };
  }
  // or: satisfied by any branch
  const results = node.or.map(n => evaluate(n, sel));
  const hit = results.find(r => r.ok);
  if (hit) return { ok: true, need: [] };

  /* Branches that are each a plain requirement of the same size are one choice
     between options, so report them as a single need listing every option that
     would satisfy it. Reporting only the nearest branch loses the alternatives:
     it made "B13|B13T" read as needing B13, narrower than the guide's own
     wording, and left the fix with one candidate where there were two. */
  const first = node.or[0];
  if (node.or.every(n => n.ids && n.n === first.n)) {
    const ids = node.or.flatMap(n => n.ids);
    return { ok: false, need: [{ ids, n: first.n, have: countOf(ids, sel),
      label: node.or.map(n => n.label).join(' or ') }] };
  }

  // otherwise report the branch nearest to done
  const deficit = r => r.need.reduce((s, x) => s + (x.n - x.have), 0);
  const best = results.reduce((a, b) => (deficit(b) < deficit(a) ? b : a));
  return { ok: false, need: best.need };
}

export const holds = (src, sel) => !src || evaluate(parse(src), sel).ok;

/* ------------------------------------------------------- derived helpers */

export const rfPathCount = sel =>
  1 + (OPTIONS.some(o => o.section === 'rf-b' && o.meta?.path === 'B' && sel[o.id]) ? 1 : 0);

export const freqA = sel => OPTIONS.find(o => o.step === 1 && sel[o.id]) || null;
export const freqB = sel => OPTIONS.find(o => o.step === 5 && o.meta?.path === 'B' && sel[o.id]) || null;
export const mainModule = sel => ['B13', 'B13T', 'B13XT'].find(id => sel[id]) || null;

/** Highest quantity currently allowed for an option. */
export function maxQty (opt, sel) {
  if (opt.qtySteps) {
    const allowed = opt.qtySteps.filter(q => {
      const cond = opt.qtyStepsReq?.[q];
      return !cond || holds(cond, sel);
    });
    return allowed.length ? Math.max(...allowed) : opt.qtySteps[0];
  }
  const max = opt.max || 1;
  if (max <= 1) return 1;
  if (!opt.maxReq) return max;
  return holds(opt.maxReq, sel) ? max : 1;
}

/** Quantities the stepper may offer, in order. */
export function qtyChoices (opt, sel) {
  if (opt.qtySteps) {
    return opt.qtySteps.filter(q => {
      const cond = opt.qtyStepsReq?.[q];
      return !cond || holds(cond, sel);
    });
  }
  return Array.from({ length: maxQty(opt, sel) }, (_, k) => k + 1);
}

/* -------------------------------------------------------------- messages */

const label = id => (BY_ID[id] ? `R&S®SMW-${id}` : id);

export function needText (need) {
  const names = need.ids.map(label);
  const list = names.length > 3
    ? `${names.slice(0, 3).join(', ')} …`
    : names.join(' or ');
  if (need.n === 1) return list;
  return names.length > 1 ? `${need.n} × (${list})` : `${need.n} × ${list}`;
}

/* ------------------------------------------------------------- validation */

/**
 * Validates a whole selection.
 * @returns {{errors:Array, warnings:Array, info:Array, ok:boolean}}
 * Every issue carries `fix` (option ids to add) or `drop` (ids to remove)
 * so the UI can offer a one-click repair.
 */
export function validate (sel) {
  const errors = [];
  const warnings = [];
  const info = [];
  /* Issue ids are unique per problem, so the same problem reported from both
     sides - a clash both options declare - collapses into one entry. */
  const add = (list, issue) => {
    if (!list.some(e => e.id === issue.id)) list.push(issue);
  };

  const a = freqA(sel);
  const b = freqB(sel);
  const mm = mainModule(sel);
  const paths = rfPathCount(sel);

  /* --- mandatory items ------------------------------------------- */
  if (!a) {
    add(errors, { id: 'no-freq-a', title: 'RF path A frequency option missing',
      detail: 'Every R&S®SMW200A needs one frequency option in RF path A. It cannot be retrofitted.',
      section: 'rf-a' });
  }
  if (!mm) {
    add(errors, { id: 'no-main-module', title: 'Baseband main module missing',
      detail: 'Every R&S®SMW200A needs a signal routing and baseband main module.',
      section: 'baseband' });
  }
  if (OPTIONS.filter(o => o.step === 1 && sel[o.id]).length > 1) {
    add(errors, { id: 'multi-freq-a', title: 'More than one RF path A frequency option',
      detail: 'RF path A takes exactly one frequency option.', section: 'rf-a' });
  }
  if (['B13', 'B13T', 'B13XT'].filter(id => sel[id]).length > 1) {
    add(errors, { id: 'multi-mm', title: 'More than one baseband main module',
      detail: 'Choose exactly one of R&S®SMW-B13, -B13T or -B13XT.', section: 'baseband' });
  }

  /* --- RF path combination --------------------------------------- */
  if (a && b) {
    const allowed = RF_PATH_MATRIX[a.id] || [];
    if (!allowed.includes(b.id)) {
      add(errors, { id: 'rf-combo', title: 'RF path combination not available',
        detail: `${label(a.id)} in path A cannot be combined with ${label(b.id)} in path B. ` +
          (allowed.length
            ? `Possible path B options: ${allowed.map(label).join(', ')}.`
            : 'This frequency option is only available as a single-path instrument.'),
        section: 'rf-b', drop: [b.id] });
    }
  }

  /* --- deeper chassis -------------------------------------------- */
  const needsB94L = !!(b && B94L_REQUIRED.includes(b.id));
  if (needsB94L && !sel.B94L) {
    add(errors, { id: 'b94l-missing', title: 'Deeper chassis required',
      detail: `${label(b.id)} in RF path B requires the R&S®SMW-B94L deeper chassis.`,
      section: 'rf-b', fix: ['B94L'] });
  }
  if (sel.B94L && !needsB94L) {
    add(errors, { id: 'b94l-not-allowed', title: 'Deeper chassis not possible',
      detail: 'R&S®SMW-B94L is only available for the 2 × 12.75 GHz, 2 × 31.8 GHz and 2 × 44 GHz RF path combinations.',
      section: 'rf-b', drop: ['B94L'] });
  }

  /* --- "O" frequency options force the wideband main module ------ */
  const oOpt = O_VARIANTS.find(id => sel[id]);
  if (oOpt && mm && mm !== 'B13XT') {
    add(errors, { id: 'o-needs-b13xt', title: 'R&S®SMW-B13XT required',
      detail: `${label(oOpt)} is not compatible with ${label(mm)}. Use the wideband main module R&S®SMW-B13XT.`,
      section: 'baseband', fix: ['B13XT'], drop: [mm] });
  }

  /* --- second RF path needs two I/Q paths ------------------------ */
  if (b && mm === 'B13') {
    add(errors, { id: 'path-b-needs-b13t', title: 'Second RF path needs two I/Q paths',
      detail: 'RF path B requires R&S®SMW-B13T or -B13XT as the baseband main module.',
      section: 'baseband', fix: ['B13T'], drop: ['B13'] });
  }

  /* --- phase noise level consistency ----------------------------- */
  for (const lvl of PHASE_NOISE_LEVELS) {
    if (!lvl.a) continue;
    if (sel[lvl.a] && b && !sel[lvl.b]) {
      add(errors, { id: `pn-${lvl.id}`, title: 'Phase noise level differs between RF paths',
        detail: `All installed RF paths must have the same phase noise performance level. ${label(lvl.a)} in path A needs ${label(lvl.b)} in path B.`,
        section: 'phase', fix: [lvl.b] });
    }
    if (sel[lvl.b] && !sel[lvl.a]) {
      add(errors, { id: `pn-orphan-${lvl.id}`, title: 'Phase noise option without its path A counterpart',
        detail: `${label(lvl.b)} requires ${label(lvl.a)} in RF path A.`,
        section: 'phase', fix: [lvl.a] });
    }
    if (sel[lvl.b] && !b) {
      add(errors, { id: `pn-nopath-${lvl.id}`, title: 'Phase noise option for a path that is not installed',
        detail: `${label(lvl.b)} needs a frequency option in RF path B.`,
        section: 'phase', drop: [lvl.b] });
    }
  }

  /* --- per-option requirements, conflicts and quantities --------- */
  for (const opt of OPTIONS) {
    const qty = sel[opt.id] || 0;
    if (!qty) continue;

    if (opt.requires) {
      const res = evaluate(parse(opt.requires), sel);
      if (!res.ok) {
        const fixQty = {};
        const fix = [];
        const blockers = new Set();
        for (const n of res.need) {
          const id = pickFix(n, sel);
          if (!id) {
            const by = blockedBy(n, sel);
            if (by) blockers.add(by);
            continue;
          }
          fix.push(id);
          fixQty[id] = Math.max(fixQty[id] || 0, n.n);
        }

        const issue = { id: `req-${opt.id}`, title: `${label(opt.id)} is missing a prerequisite`,
          detail: `${opt.name} requires ${res.need.map(needText).join(' and ')}.`,
          section: opt.section, option: opt.id, fix, fixQty };

        /* If any part of the requirement is ruled out by a choice already made,
           adding the other parts cannot settle the issue - offering them as a
           fix produces a button that changes the configuration without fixing
           anything. Explain the block and offer the removal instead. */
        if (blockers.size) {
          issue.fix = [];
          issue.fixQty = {};
          issue.detail += ` ${[...blockers].map(label).join(' and ')} is installed, which rules that out.`;
          issue.drop = [opt.id];

          /* Removing the option is rarely what is wanted - the options that
             depend on it then break in turn. Changing the blocking choice is
             usually the single edit that settles the whole group, so offer it
             directly. Preference runs to the main module that carries the most:
             B13T takes two I/Q paths where B13 takes one. */
          if (blockers.size === 1) {
            const [blocker] = blockers;
            const wanted = res.need.flatMap(n => n.ids);
            const alt = ['B13T', 'B13XT', 'B13'].find(id => wanted.includes(id) && id !== blocker);
            if (alt && MAIN_MODULES.includes(blocker)) {
              issue.swap = [blocker, alt];
              issue.detail += ` Switching to ${label(alt)} settles it in one step;` +
                ` removing ${label(opt.id)} is the alternative.`;
            }
          }
        }
        add(errors, issue);
      }
    }

    for (const other of opt.conflicts || []) {
      /* Ordering the pair in the issue id collapses the duplicate when both
         sides declare the clash. Gating on opt.id < other instead dropped every
         one-way declaration that happened to sort the wrong way - all twenty of
         them, as it turned out. */
      if (sel[other]) {
        const pair = [opt.id, other].sort();
        add(errors, { id: `clash-${pair[0]}-${pair[1]}`, title: 'Options cannot be combined',
          detail: `${label(opt.id)} and ${label(other)} cannot be installed on the same instrument.`,
          section: opt.section, option: opt.id, drop: [other] });
      }
    }

    const cap = maxQty(opt, sel);
    if (qty > cap) {
      const why = opt.maxReq
        ? ` A second unit needs ${needText(evaluate(parse(opt.maxReq), sel).need[0] || { ids: [opt.maxReq], n: 1 })}.`
        : '';
      add(errors, { id: `qty-${opt.id}`, title: `Quantity of ${label(opt.id)} too high`,
        detail: `The current configuration supports ${cap} × ${label(opt.id)}.${why}`,
        section: opt.section, option: opt.id, setQty: [opt.id, cap] });
    }
    if (opt.qtySteps && !opt.qtySteps.includes(qty)) {
      add(errors, { id: `qtystep-${opt.id}`, title: `${label(opt.id)} quantity not available`,
        detail: `${label(opt.id)} can only be installed ${opt.qtySteps.join(', ')} times.`,
        section: opt.section, option: opt.id,
        setQty: [opt.id, opt.qtySteps.reduce((a2, q) => (q <= qty ? q : a2), opt.qtySteps[0])] });
    }

    /* options that must be present once per installed RF path */
    if (opt.perPath && paths > 1) {
      for (const expr of opt.perPath) {
        if (!holds(`${expr}*${paths}`, sel)) {
          const need = evaluate(parse(`${expr}*${paths}`), sel).need[0];
          const id = pickFix(need, sel);
          add(errors, { id: `perpath-${opt.id}-${expr}`,
            title: `${label(opt.id)} needs one set of options per RF path`,
            detail: `With ${paths} RF paths, ${label(opt.id)} requires ${needText(need)}.`,
            section: opt.section, option: opt.id,
            fix: id ? [id] : [], fixQty: id ? { [id]: need.n } : {} });
        }
      }
    }
  }

  /* --- baseband sections must not be mixed ----------------------- */
  const stdHw = OPTIONS.filter(o => o.group === 'Standard baseband' && sel[o.id]);
  const wideHw = OPTIONS.filter(o => o.group === 'Wideband baseband' && sel[o.id]);
  if (mm === 'B13XT' && stdHw.length) {
    add(errors, { id: 'std-on-wideband', title: 'Standard baseband options on a wideband instrument',
      detail: `${stdHw.map(o => label(o.id)).join(', ')} belong to the standard baseband section and ` +
              'need R&S®SMW-B13 or -B13T. Use the wideband equivalents instead.',
      section: 'bb-hw', drop: stdHw.map(o => o.id) });
  }
  if ((mm === 'B13' || mm === 'B13T') && wideHw.length) {
    add(errors, { id: 'wide-on-standard', title: 'Wideband baseband options on a standard instrument',
      detail: `${wideHw.map(o => label(o.id)).join(', ')} belong to the wideband baseband section and ` +
              'need R&S®SMW-B13XT. Use the standard equivalents instead.',
      section: 'bb-hw', drop: wideHw.map(o => o.id) });
  }
  if (stdHw.length && wideHw.length) {
    add(errors, { id: 'mixed-bb', title: 'Standard and wideband baseband hardware cannot be mixed',
      detail: `Remove either the standard options (${stdHw.map(o => label(o.id)).join(', ')}) ` +
              `or the wideband options (${wideHw.map(o => label(o.id)).join(', ')}).`,
      section: 'bb-hw' });
  }

  /* --- waveform package ceiling ---------------------------------- */
  const waveforms = (sel['K200-1'] || 0) + (sel['K200-5'] || 0) * 5 + (sel['K200-50'] || 0) * 50;
  if (waveforms > 250) {
    add(errors, { id: 'waveforms', title: 'Too many R&S®WinIQSIM2 waveforms',
      detail: `A maximum of 250 waveforms can be registered per instrument; this configuration registers ${waveforms}.`,
      section: 'std-wiq' });
  }

  /* --- advisory checks ------------------------------------------- */
  if (mm && !['B9', 'B9F', 'B10'].some(id => sel[id])) {
    add(warnings, { id: 'no-generator', title: 'No baseband generator',
      detail: 'Without R&S®SMW-B10 or -B9 the instrument produces CW and analog modulation only – no digital standards, ARB playback or fading.',
      section: 'bb-hw', fix: [mm === 'B13XT' ? 'B9' : 'B10'] });
  }
  if (sel.K555 && !sel['SMW-ZKK'] && !sel['SMW-ZKV']) {
    add(info, { id: 'k555-combiner', title: 'R&S®SMW-K555 needs an external power combiner',
      detail: 'Add the R&S®SMW-ZKK (40 GHz) or R&S®SMW-ZKV (67 GHz) combiner kit, plus an analyzer or power meter.',
      section: 'extras' });
  }
  if (paths > 1 && !sel.B90 && (sel.K74 || sel.K75)) {
    add(info, { id: 'mimo-coherence', title: 'Consider phase coherence',
      detail: 'MIMO measurements across two RF paths usually want R&S®SMW-B90 phase coherence.',
      section: 'rf-enh', fix: ['B90'] });
  }
  const gnssChannels = ['K136', 'K137', 'K138', 'K139'].some(id => sel[id]);
  if (gnssChannels && !['B9', 'B9F'].some(id => sel[id])) {
    add(warnings, { id: 'gnss-channels', title: 'Additional GNSS channels need wideband hardware',
      detail: 'GNSS channel extensions run on the R&S®SMW-B9/-B9F wideband baseband generator.',
      section: 'std-int' });
  }
  if (sel.B9F && sel.B9) {
    add(errors, { id: 'b9-b9f', title: 'R&S®SMW-B9 and -B9F cannot be mixed',
      detail: 'Possible configurations are 1 × B9, 2 × B9, 1 × B9F or 2 × B9F.', section: 'bb-hw' });
  }

  return { errors, warnings, info, ok: errors.length === 0 };
}

/**
 * Picks the option to add when a requirement is unmet. Prefers something the
 * configuration already leans towards: the current baseband section first,
 * then the first id the guide lists.
 */
/**
 * The already-installed option that rules out every way of satisfying a
 * requirement. Single-select choices - the baseband main module, the RF path A
 * frequency - cannot be swapped behind the user's back, so when a requirement
 * can only be met by a different one of those, nothing can be added to fix it
 * and the option itself has to go instead.
 */
export const MAIN_MODULES = ['B13', 'B13T', 'B13XT'];

function blockedBy (need, sel) {
  const mm = mainModule(sel);
  const fa = freqA(sel);
  const ids = need.ids.filter(id => BY_ID[id]);
  if (!ids.length) return null;
  if (mm && ids.every(id => MAIN_MODULES.includes(id) && id !== mm)) return mm;
  if (fa && ids.every(id => BY_ID[id].step === 1 && id !== fa.id)) return fa.id;
  return null;
}

function pickFix (need, sel) {
  const mmInstalled = mainModule(sel);
  const freqAInstalled = freqA(sel);
  const candidates = need.ids.filter(id => {
    if (!BY_ID[id]) return false;
    // never propose a second single-select item
    if (mmInstalled && MAIN_MODULES.includes(id) && id !== mmInstalled) return false;
    if (freqAInstalled && BY_ID[id].step === 1 && id !== freqAInstalled.id) return false;
    return true;
  });
  if (!candidates.length) return null;
  const already = candidates.find(id => sel[id]);
  if (already) return already;
  const mm = mainModule(sel);
  if (mm === 'B13XT') {
    const wide = candidates.find(id => ['B9', 'B15'].includes(id));
    if (wide) return wide;
  }
  if (mm === 'B13' || mm === 'B13T') {
    const std = candidates.find(id => ['B10', 'B14'].includes(id));
    if (std) return std;
  }
  return candidates[0];
}

/** Raises an option to at least `qty`, respecting its permitted quantity steps. */
function bump (sel, id, qty) {
  const opt = BY_ID[id];
  let value = Math.max(sel[id] || 0, qty);
  if (opt?.qtySteps) {
    value = opt.qtySteps.find(q => q >= value) ?? opt.qtySteps[opt.qtySteps.length - 1];
  }
  return { ...sel, [id]: value };
}

/** Applies one issue's suggested fix, or returns null when it has none. */
function applyFix (sel, issue) {
  let next = sel;
  let touched = false;
  for (const id of issue.fix || []) {
    const want = issue.fixQty?.[id] ?? 1;
    const after = bump(next, id, want);
    if (after[id] !== next[id]) { next = after; touched = true; }
  }
  if (issue.setQty) {
    const [id, qty] = issue.setQty;
    next = { ...next };
    if (qty > 0) next[id] = qty; else delete next[id];
    touched = true;
  }
  return touched ? next : null;
}

/**
 * Adds every option needed to make the current selection legal.
 *
 * Tries one fix at a time and follows its consequences recursively, keeping a
 * branch only when it leaves fewer problems than it started with. That lets
 * chains resolve (K512 -> K511 -> B10) while refusing dead ends, such as a
 * standard-baseband option on an instrument with the wideband main module.
 * Options are only ever added, never removed – dropping something the user
 * chose stays a deliberate act.
 */
/**
 * One improving move, with lookahead: a fix counts if the configuration it
 * leads to has fewer problems once its own consequences are settled. That
 * lookahead is what lets a chain of prerequisites resolve, so it earns the
 * recursion.
 */
function resolveOnce (sel, depth) {
  const errors = validate(sel).errors;
  if (!errors.length || depth === 0) return sel;

  for (const issue of errors) {
    const candidate = applyFix(sel, issue);
    if (!candidate) continue;
    const settled = resolveOnce(candidate, depth - 1);
    if (validate(settled).errors.length < errors.length) return settled;
  }
  return sel;
}

/**
 * Settles what can be settled by adding options.
 *
 * Repeats until the configuration stops changing, because one improving move
 * can expose another that the depth limit cut short - a second press used to
 * get further than the first, which makes the button look unreliable.
 *
 * Only ever adds. Removing an option the user deliberately chose is their
 * call, so issues that can only be settled that way carry a drop for the
 * Checks panel to offer instead.
 */
export function autoResolve (sel, depth = 12) {
  let current = sel;
  for (let pass = 0; pass < 8; pass++) {
    const next = resolveOnce(current, depth);
    if (next === current) break;
    current = next;
  }
  return current;
}
