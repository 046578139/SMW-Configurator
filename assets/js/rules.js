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
 *
 * The engine knows nothing about a particular instrument. The catalog, the
 * shorthand names an expression may use and the instrument's own rules come
 * from the active profile (instrument.js): `profile.rules` may carry
 *   context(sel)                what the instrument-level checks need
 *   before(sel, ctx, lists)     checks ahead of the per-option loop
 *   after(sel, ctx, lists)      checks behind it
 *   unreachable(id, sel)        an option no fix can ever add here
 *   blockedBy(need, sel)        the installed choice that rules a need out
 *   pickFix(need, sel)          which option to add for a need
 *   swapFor(blocker, wanted)    the single-select choice to offer instead
 * and each is optional; the engine alone checks requirements, conflicts and
 * quantities and settles them by adding the first candidate.
 */

import { inst } from './instrument.js';

/* ---------------------------------------------------------------- parser */

/* one cache per profile, so two instruments' shorthands never mix */
const caches = new WeakMap();
const cacheFor = () => {
  const p = inst();
  let c = caches.get(p);
  if (!c) { c = new Map(); caches.set(p, c); }
  return c;
};

export function parse (src) {
  const cache = cacheFor();
  if (cache.has(src)) return cache.get(src);
  const SHORTHAND = inst().SHORTHAND || {};
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

/* the profile's hooks, each optional */
const hook = name => inst().rules?.[name] || null;
const unreachable = (id, sel) => { const h = hook('unreachable'); return h ? h(id, sel) : false; };
const blockedBy = (need, sel) => { const h = hook('blockedBy'); return h ? h(need, sel) : null; };
const pickFix = (need, sel) => { const h = hook('pickFix'); return h ? h(need, sel) : defaultPickFix(need, sel); };

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

  /* Otherwise report the branch nearest to done - but only among the branches
     that can still be taken. Two branches are often equally far off, and the
     first was being chosen regardless of whether the installed main module
     allows it. */
  const reachable = results.filter(r =>
    !r.need.some(n => n.ids.every(id => unreachable(id, sel))));
  const pool = reachable.length ? reachable : results;
  const deficit = r => r.need.reduce((s, x) => s + (x.n - x.have), 0);
  const best = pool.reduce((a, b) => (deficit(b) < deficit(a) ? b : a));
  return { ok: false, need: best.need };
}

export const holds = (src, sel) => !src || evaluate(parse(src), sel).ok;

/* ------------------------------------------------------------ quantities */

/** Highest quantity currently allowed for an option. */
export function maxQty (opt, sel) {
  if (opt.qtySteps) {
    const allowed = opt.qtySteps.filter(q => stepAllowed(opt, q, sel));
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
    const allowed = opt.qtySteps.filter(q => stepAllowed(opt, q, sel));
    return allowed.length ? allowed : [opt.qtySteps[0]];
  }
  return Array.from({ length: maxQty(opt, sel) }, (_, k) => k + 1);
}

/**
 * Whether a quantity from `qtySteps` is available in this configuration.
 * `qtyStepsReq` names what a quantity needs; `qtyStepsNot` names what rules it
 * out - one R&S SMW-B15 is a configuration only while a single R&S SMW-B9 is
 * installed, because two generators take none, two or four.
 */
function stepAllowed (opt, q, sel) {
  const req = opt.qtyStepsReq?.[q];
  const not = opt.qtyStepsNot?.[q];
  return (!req || holds(req, sel)) && !(not && holds(not, sel));
}

/* -------------------------------------------------------------- messages */

const label = id => (inst().BY_ID[id] ? inst().typeName(id) : id);

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
  const { OPTIONS, BY_ID } = inst();
  const errors = [];
  const warnings = [];
  const info = [];
  /* Issue ids are unique per problem, so the same problem reported from both
     sides - a clash both options declare - collapses into one entry. */
  const add = (list, issue) => {
    if (!list.some(e => e.id === issue.id)) list.push(issue);
  };
  const lists = { add, errors, warnings, info, label, needText };

  const ctx = hook('context') ? hook('context')(sel) : {};
  const paths = ctx.paths ?? 1;

  /* --- the instrument's own checks ahead of the options ---------- */
  hook('before')?.(sel, ctx, lists);

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

          /* Asking for two of something whose second unit has its own condition
             is only half an answer: raising the quantity alone leaves the
             requirement unmet and the resolver with nothing that improves. Ask
             for what lifts the cap as well. */
          const cand = BY_ID[id];
          if (n.n > maxQty(cand, sel) && cand.maxReq) {
            for (const m of evaluate(parse(cand.maxReq), sel).need) {
              const lift = pickFix(m, sel);
              if (!lift || lift === id) continue;
              if (!fix.includes(lift)) fix.push(lift);
              fixQty[lift] = Math.max(fixQty[lift] || 0, m.n);
            }
          }
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
             directly when the instrument knows one. */
          if (blockers.size === 1) {
            const [blocker] = blockers;
            const wanted = res.need.flatMap(n => n.ids);
            const alt = hook('swapFor') ? hook('swapFor')(blocker, wanted) : null;
            if (alt) {
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
      /* The reason lives in maxReq for a plain "up to two", and in
         qtyStepsReq for an option that comes in fixed quantities. */
      const stepReq = opt.qtySteps && opt.qtyStepsReq?.[opt.qtySteps.find(q => q > cap)];
      const reason = opt.maxReq || stepReq;
      const why = reason
        ? ` ${opt.maxReq ? 'A second unit needs' : 'More units need'} ${needText(evaluate(parse(reason), sel).need[0] || { ids: [reason], n: 1 })}.`
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

  /* --- the instrument's own checks behind the options ------------ */
  hook('after')?.(sel, ctx, lists);

  return { errors, warnings, info, ok: errors.length === 0 };
}

/**
 * The option already installed that puts `opt` out of reach, or null when it
 * is merely not set up yet. A clash is decisive; so is a requirement that only
 * a different single-select choice - a frequency option, a main module - could
 * meet, which the profile's blockedBy knows. The interface uses this to show
 * an option as unavailable rather than letting it be selected into an error
 * nothing can settle.
 */
export function ruledOutBy (opt, sel) {
  const clash = (opt.conflicts || []).find(id => sel[id]);
  if (clash) return clash;
  if (!opt.requires) return null;
  const res = evaluate(parse(opt.requires), sel);
  if (res.ok) return null;
  for (const need of res.need) {
    const by = blockedBy(need, sel);
    if (by) return by;
  }
  return null;
}

/** Without a profile hook: something already installed, else the first candidate the guide lists. */
function defaultPickFix (need, sel) {
  const { BY_ID } = inst();
  const candidates = need.ids.filter(id => BY_ID[id]);
  if (!candidates.length) return null;
  return candidates.find(id => sel[id]) || candidates[0];
}

/** Raises an option to at least `qty`, respecting its permitted quantity steps. */
function bump (sel, id, qty) {
  const opt = inst().BY_ID[id];
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
