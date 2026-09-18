/**
 * The R&S FSW's own rules: what the ordering information says beyond an
 * option's requirements, conflicts and quantity limits, and how a
 * requirement is settled on an instrument whose base unit is a model and
 * whose analysis bandwidth is one option.
 *
 * The engine (assets/js/rules.js) checks every option's own requirements
 * and calls the hooks in `fswRules` at fixed points: `context` once per
 * validation, `before` ahead of the per-option loop, `after` behind it,
 * and the helpers that decide how a requirement is settled - which option
 * to add, which installed choice puts it out of reach, and which
 * single-select choice to offer instead.
 */

import { parse, evaluate } from '../rules.js';
import { OPTIONS, BY_ID, SHORTHAND, MODELS, BANDWIDTH, typeName } from './catalog.js';

/* ------------------------------------------------------- derived helpers */

/** The model chosen, or null. */
export const modelOf = sel => MODELS.find(id => sel[id]) || null;
export const modelOpt = sel => { const m = modelOf(sel); return m ? BY_ID[m] : null; };

/** The analysis bandwidth option chosen (one per instrument), or null. */
export const bwOption = sel => BANDWIDTH.find(id => sel[id]) || null;

/** Whether the configuration describes an upgrade of an instrument in the field. */
export const hasUpgrade = sel => OPTIONS.some(o => o.meta?.upgrade && sel[o.id]);

/**
 * The analysis bandwidth the instrument ends up with, in MHz: 28 MHz with
 * no option; else the highest of the option and the upgrades installed,
 * with the id that provides it.
 */
export function analysisBw (sel) {
  let bw = 28;
  let by = null;
  for (const o of OPTIONS) {
    if (sel[o.id] && o.meta?.bw && o.meta.bw > bw) { bw = o.meta.bw; by = o.id; }
  }
  return { bw, by };
}

const ids = expr => SHORTHAND[expr].split('|');
export const anyOf = (sel, expr) => ids(expr).find(id => sel[id]) || null;

const fswLabel = id => (BY_ID[id] ? typeName(id) : id);

/** What the instrument-level checks need to know about a selection. */
export function fswContext (sel) {
  return { model: modelOf(sel), bw: bwOption(sel), paths: 1 };
}

/* ------------------------------------------------- before the options */

export function fswBefore (sel, { model }, { add, errors }) {
  /* The model is the one mandatory choice; on an untouched page it is the
     first step rather than a mistake, and the interface says so. */
  if (!model) {
    add(errors, { id: 'no-model', todo: true, title: 'Choose a model',
      detail: 'Every R&S®FSW is one of seven models, R&S®FSW8 to R&S®FSW85. The model is the base unit: it sets the upper frequency limit and which hardware options exist for it, and it cannot be changed later.',
      section: 'model' });
  }
  const models = MODELS.filter(id => sel[id]);
  if (models.length > 1) {
    add(errors, { id: 'multi-model', title: 'More than one model',
      detail: `An instrument is one model; ${models.map(fswLabel).join(', ')} are selected.`,
      section: 'model', drop: models.slice(1) });
  }
  const bws = BANDWIDTH.filter(id => sel[id]);
  if (bws.length > 1) {
    add(errors, { id: 'multi-bw', title: 'More than one analysis bandwidth option',
      detail: `An instrument takes one analysis bandwidth option; ${bws.map(fswLabel).join(', ')} are selected. ` +
        'The real-time analyzers R&S®FSW-B512R and -B800R include their bandwidth; a wider bandwidth on an instrument in the field is an upgrade (R&S®FSW-Uxxx).',
      section: 'bandwidth', drop: bws.slice(1) });
  }
}

/* -------------------------------------------------- after the options */

export function fswAfter (sel, { model }, { add, warnings, info }) {
  /* --- upgrades on a new instrument ------------------------------- */
  const upgrades = OPTIONS.filter(o => o.meta?.upgrade && sel[o.id]);
  if (upgrades.length && !bwOption(sel) && upgrades.some(o => o.id === 'U40')) {
    add(info, { id: 'upgrade-new', title: 'Upgrades on an instrument without an analysis bandwidth option',
      detail: 'The upgrades are for an instrument already in the field. A new instrument takes the bandwidth option itself (R&S®FSW-B40 to -B8001), at one order number.',
      section: 'upgrades' });
  }

  /* --- things the accessories supply ----------------------------- */
  if ((sel.K30 || sel['K30-FL']) && !OPTIONS.some(o => o.id.startsWith('FS-SNS') && sel[o.id])) {
    add(info, { id: 'k30-source', title: 'R&S®FSW-K30 measures with a noise source',
      detail: 'Noise figure measurements by the Y-factor method need an R&S®FS-SNS smart noise source, listed under accessories; a generator can serve as LO for frequency-converting devices instead.',
      section: 'extras' });
  }
  if (anyOf(sel, 'B21ANY') && !OPTIONS.some(o => /^FS-Z\d/.test(o.id) && sel[o.id])) {
    add(info, { id: 'b21-mixer', title: 'External mixer connections without a mixer',
      detail: 'R&S®FSW-B21 provides the LO and IF connections; the harmonic mixers themselves (R&S®FS-Z60 to FS-Z325) are under accessories.',
      section: 'extras' });
  }
  if (sel.K553 && !['FE44S', 'FE50DTR', 'FE110SR', 'FE170SR'].some(id => sel[id])) {
    add(info, { id: 'k553-frontend', title: 'External frontend control without a frontend',
      detail: 'R&S®FSW-K553 controls an R&S®FE44S, FE50DTR, FE110SR or FE170SR external frontend, listed under accessories.',
      section: 'extras' });
  }
  if (sel.B17 && !sel['SMU-Z6']) {
    add(info, { id: 'b17-cable', title: 'Digital baseband interface without its cable',
      detail: 'The R&S®SMU-Z6 cable (accessories) connects R&S®FSW-B17 to the digital I/Q interface of another Rohde & Schwarz instrument.',
      section: 'extras', fix: ['SMU-Z6'] });
  }
  if (anyOf(sel, 'DIGIQ40') && !sel['DIGIQ-HS']) {
    add(info, { id: 'b517-cable', title: 'DIG IQ 40G interface without its cable',
      detail: 'The R&S®DIGIQ-HS cable (accessories) connects the 40 Gbit/s streaming interface.',
      section: 'extras', fix: ['DIGIQ-HS'] });
  }

  /* --- advisory: what a data sheet recommends ---------------------- */
  if (sel.K54 && model && model !== 'FSW85' && !anyOf(sel, 'B24ANY')) {
    add(info, { id: 'k54-preamp', title: 'EMI measurements usually want the preamplifier',
      detail: 'The R&S®FSW-K54 data sheet lists R&S®FSW-B24 and R&S®FSW-B10 as recommended options for EMI measurements.',
      section: 'rf-hw' });
  }
  if ((sel.K95 || sel['K95-FL'] || sel.K97 || sel['K97-FL']) && model && model !== 'FSW85' && !anyOf(sel, 'B24ANY')) {
    add(info, { id: 'k95-preamp', title: 'Over-the-air 802.11ad/ay measurements want the preamplifier',
      detail: 'The R&S®FSW-K95/-K97 data sheet recommends R&S®FSW-B24 for over-the-air measurements.',
      section: 'rf-hw' });
  }
  if (sel.FL && !OPTIONS.some(o => o.floating && sel[o.id])) {
    add(info, { id: 'fl-unused', title: 'Smart card without a floating licence',
      detail: 'R&S®FSW-FL is only needed by floating licences (.51 order numbers); none is selected.',
      section: 'floating', drop: ['FL'] });
  }
  if (model && (sel.B512R || sel.B800R)) {
    add(info, { id: 'realtime-temp', title: 'Real-time analyzer: operating temperature limit',
      detail: `With ${sel.B800R ? 'R&S®FSW-B800R' : 'R&S®FSW-B512R'} the upper operating temperature during real-time analysis is limited to ${sel.B800R ? '+40 °C' : '+45 °C'} (specifications p35).`,
      section: 'bandwidth' });
  }
  const wide = ['B1200', 'U1200', 'B2001', 'U2001', 'B800R', 'B4001', 'U4001', 'U4002', 'B6001', 'U6001', 'B8001', 'U8001'].filter(id => sel[id]);
  if (wide.length && (sel.B8E || sel['B8-26'] || sel['B8-02'])) {
    add(info, { id: 'b8-note', title: 'Resolution bandwidth options do not set the analysis bandwidth',
      detail: 'R&S®FSW-B8E/-B8 raise the resolution bandwidth of the swept spectrum to 40 MHz or 80 MHz; the signal analysis bandwidth is defined by the analysis bandwidth option alone.',
      section: 'rf-hw' });
  }
  void warnings;
}

/* ------------------------------------------- settling a requirement */

/**
 * True when an option can never be added here: another model or another
 * analysis bandwidth option is already chosen (both single-select), an
 * upgrade on a configuration that is a new instrument, or a requirement
 * that names models other than the one chosen.
 */
export function fswUnreachable (id, sel, depth = 2) {
  const model = modelOf(sel);
  const bw = bwOption(sel);
  const opt = BY_ID[id];
  if (!opt) return false;
  if (opt.baseModel) return !!model && id !== model;
  /* first the model: a bandwidth option for the FSW26 and up is out of reach on an FSW8
     whether or not a bandwidth has been chosen */
  if (model && opt.requires) {
    const expanded = opt.requires.replace(/[A-Z][A-Z0-9-]*/g, t => SHORTHAND[t] || t);
    const named = expanded.match(/\bFSW\d+\b/g);
    if (named && !named.includes(model)) return true;
  }
  if (BANDWIDTH.includes(id)) return !!bw && id !== bw;
  if (opt.meta?.upgrade && bw && !hasUpgrade(sel)) return true;
  /* one step further: an upgrade to 2 GHz is out of reach on an FSW8 because
     everything it needs - 1.2 GHz first - is */
  if (depth > 0 && opt.requires) {
    for (const n of evaluate(parse(opt.requires), sel).need) {
      if (n.ids.every(x => !sel[x] && fswUnreachable(x, sel, depth - 1))) return true;
    }
  }
  return false;
}

/**
 * The already-installed choice that rules out every way of satisfying a
 * requirement. The model and the analysis bandwidth option are single-select
 * choices that cannot be swapped behind the user's back, so when a
 * requirement can only be met by a different one of those, nothing can be
 * added to fix it; the issue names the choice and offers the swap instead.
 * Looks through what each candidate itself needs, so a requirement that can
 * only be met by an upgrade of the wrong bandwidth is out of reach too.
 */
export function fswBlockedBy (need, sel, depth = 2) {
  const model = modelOf(sel);
  const bw = bwOption(sel);
  const upgrading = hasUpgrade(sel);
  const candidates = need.ids.filter(id => BY_ID[id]);
  if (!candidates.length) return null;
  const blockerOf = id => {
    if (sel[id]) return null;
    const o = BY_ID[id];
    if (o.baseModel) return model && id !== model ? model : null;
    if (BANDWIDTH.includes(id) && bw && id !== bw) return bw;
    /* a new instrument takes the option, not an upgrade of a bandwidth it does not have */
    if (o.meta?.upgrade && bw && !upgrading) return bw;
    const clash = (o.conflicts || []).find(c => sel[c]);
    if (clash) return clash;
    if (depth > 0 && o.requires) {
      for (const n of evaluate(parse(o.requires), sel).need) {
        const by = fswBlockedBy(n, sel, depth - 1);
        if (by) return by;
      }
    }
    return null;
  };
  const blockers = candidates.map(blockerOf);
  return blockers.every(Boolean) ? blockers[0] : null;
}

/**
 * Picks the option to add when a requirement is unmet: never a second
 * model or a second bandwidth option, never an upgrade on a new instrument;
 * something already installed first, else the first the ordering
 * information lists (the B option before its upgrade).
 */
export function fswPickFix (need, sel) {
  const model = modelOf(sel);
  const bw = bwOption(sel);
  const upgrading = hasUpgrade(sel);
  const candidates = need.ids.filter(id => {
    const o = BY_ID[id];
    if (!o) return false;
    if (o.baseModel && model && id !== model) return false;
    if (BANDWIDTH.includes(id) && bw && id !== bw) return false;
    if (o.meta?.upgrade && bw && !upgrading) return false;
    /* a per-model order number for another model: B71E on an FSW26 wants B71-26, not the first B71 listed */
    if (fswUnreachable(id, sel)) return false;
    return true;
  });
  if (!candidates.length) return null;
  return candidates.find(id => sel[id]) || candidates[0];
}

/**
 * The single-select choice to offer in place of the one that blocks a
 * requirement: the lowest model that meets it, or the narrowest bandwidth
 * option that does.
 */
export function fswSwapFor (blocker, wanted) {
  if (MODELS.includes(blocker)) {
    /* the lowest model on which something wanted can be had - the model itself
       when the requirement names models, else one where a wanted option is in reach */
    return MODELS.find(m => m !== blocker && wanted.some(id =>
      MODELS.includes(id) ? id === m : (BY_ID[id] && !fswUnreachable(id, { [m]: 1 })))) || null;
  }
  if (BANDWIDTH.includes(blocker)) return BANDWIDTH.find(id => wanted.includes(id)) || null;
  return null;
}

export const fswRules = {
  context: fswContext,
  before: fswBefore,
  after: fswAfter,
  unreachable: fswUnreachable,
  blockedBy: fswBlockedBy,
  pickFix: fswPickFix,
  swapFor: fswSwapFor
};
