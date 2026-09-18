/**
 * The R&S SMW200A's own rules: what the configuration guide says beyond an
 * option's requirements, conflicts and quantity limits.
 *
 * The engine (assets/js/rules.js) checks every option's own requirements
 * and calls the hooks in `smwRules` at fixed points: `context` once per
 * validation, `before` ahead of the per-option loop, `after` behind it,
 * and the three helpers that decide how a requirement is settled - which
 * option to add, which installed choice puts it out of reach, and which
 * single-select choice to offer instead. Every message and every fix here
 * is exactly what the engine produced when this code still lived inside it.
 */

import { parse, evaluate } from '../rules.js';
import {
  OPTIONS, BY_ID, SHORTHAND, RF_PATH_MATRIX, B94L_REQUIRED,
  O_VARIANTS, PHASE_NOISE_LEVELS, typeName
} from './catalog.js';

/* ------------------------------------------------------- derived helpers */

export const MAIN_MODULES = ['B13', 'B13T', 'B13XT'];

export const rfPathCount = sel =>
  1 + (OPTIONS.some(o => o.section === 'rf-b' && o.meta?.path === 'B' && sel[o.id]) ? 1 : 0);

export const freqA = sel => OPTIONS.find(o => o.step === 1 && sel[o.id]) || null;
export const freqB = sel => OPTIONS.find(o => o.step === 5 && o.meta?.path === 'B' && sel[o.id]) || null;
export const mainModule = sel => MAIN_MODULES.find(id => sel[id]) || null;

const smwLabel = id => (BY_ID[id] ? typeName(id) : id);

/** What the instrument-level checks need to know about a selection. */
export function smwContext (sel) {
  return { a: freqA(sel), b: freqB(sel), mm: mainModule(sel), paths: rfPathCount(sel) };
}

/* ------------------------------------------------- before the options */

export function smwBefore (sel, { a, b, mm }, { add, errors }) {
  /* --- mandatory items ------------------------------------------- */
  /* The two mandatory choices are marked `todo`: a configuration without them
     is not valid, but on a page nobody has touched yet they are the first two
     steps rather than mistakes, and the interface says so. */
  if (!a) {
    add(errors, { id: 'no-freq-a', todo: true, title: 'Choose an RF path A frequency option',
      detail: 'Every R&S®SMW200A needs one frequency option in RF path A. It sets the upper frequency limit of the instrument and cannot be retrofitted.',
      section: 'rf-a' });
  }
  if (!mm) {
    add(errors, { id: 'no-main-module', todo: true, title: 'Choose a baseband main module',
      detail: 'Every R&S®SMW200A needs a signal routing and baseband main module. It decides whether the standard or the wideband baseband section applies.',
      section: 'baseband' });
  }
  if (OPTIONS.filter(o => o.step === 1 && sel[o.id]).length > 1) {
    add(errors, { id: 'multi-freq-a', title: 'More than one RF path A frequency option',
      detail: 'RF path A takes exactly one frequency option.', section: 'rf-a' });
  }
  if (OPTIONS.filter(o => o.step === 5 && o.meta?.path === 'B' && sel[o.id]).length > 1) {
    add(errors, { id: 'multi-freq-b', title: 'More than one RF path B frequency option',
      detail: 'RF path B takes exactly one frequency option.', section: 'rf-b' });
  }
  if (MAIN_MODULES.filter(id => sel[id]).length > 1) {
    add(errors, { id: 'multi-mm', title: 'More than one baseband main module',
      detail: 'Choose exactly one of R&S®SMW-B13, -B13T or -B13XT.', section: 'baseband' });
  }

  /* --- RF path combination --------------------------------------- */
  if (a && b) {
    const allowed = RF_PATH_MATRIX[a.id] || [];
    if (!allowed.includes(b.id)) {
      add(errors, { id: 'rf-combo', title: 'RF path combination not available',
        detail: `${smwLabel(a.id)} in path A cannot be combined with ${smwLabel(b.id)} in path B. ` +
          (allowed.length
            ? `Possible path B options: ${allowed.map(smwLabel).join(', ')}.`
            : 'This frequency option is only available as a single-path instrument.'),
        section: 'rf-b', drop: [b.id] });
    }
  }

  /* --- deeper chassis -------------------------------------------- */
  const needsB94L = !!(b && B94L_REQUIRED.includes(b.id));
  if (needsB94L && !sel.B94L) {
    add(errors, { id: 'b94l-missing', title: 'Deeper chassis required',
      detail: `${smwLabel(b.id)} in RF path B requires the R&S®SMW-B94L deeper chassis.`,
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
      detail: `${smwLabel(oOpt)} is not compatible with ${smwLabel(mm)}. Use the wideband main module R&S®SMW-B13XT.`,
      section: 'baseband', swap: [mm, 'B13XT'] });
  }

  /* --- second RF path needs two I/Q paths ------------------------ */
  if (b && mm === 'B13') {
    add(errors, { id: 'path-b-needs-b13t', title: 'Second RF path needs two I/Q paths',
      detail: 'RF path B requires R&S®SMW-B13T or -B13XT as the baseband main module.',
      section: 'baseband', swap: ['B13', 'B13T'] });
  }

  /* --- phase noise level consistency ----------------------------- */
  for (const lvl of PHASE_NOISE_LEVELS) {
    if (!lvl.a) continue;
    if (sel[lvl.a] && b && !sel[lvl.b]) {
      add(errors, { id: `pn-${lvl.id}`, title: 'Phase noise level differs between RF paths',
        detail: `All installed RF paths must have the same phase noise performance level. ${smwLabel(lvl.a)} in path A needs ${smwLabel(lvl.b)} in path B.`,
        section: 'phase', fix: [lvl.b] });
    }
    if (sel[lvl.b] && !sel[lvl.a]) {
      add(errors, { id: `pn-orphan-${lvl.id}`, title: 'Phase noise option without its path A counterpart',
        detail: `${smwLabel(lvl.b)} requires ${smwLabel(lvl.a)} in RF path A.`,
        section: 'phase', fix: [lvl.a] });
    }
    if (sel[lvl.b] && !b) {
      add(errors, { id: `pn-nopath-${lvl.id}`, title: 'Phase noise option for a path that is not installed',
        detail: `${smwLabel(lvl.b)} needs a frequency option in RF path B.`,
        section: 'phase', drop: [lvl.b] });
    }
  }
}

/* -------------------------------------------------- after the options */

export function smwAfter (sel, { mm, paths }, { add, errors, warnings, info }) {
  /* --- baseband sections must not be mixed ----------------------- */
  const stdHw = OPTIONS.filter(o => o.group === 'Standard baseband' && sel[o.id]);
  const wideHw = OPTIONS.filter(o => o.group === 'Wideband baseband' && sel[o.id]);
  if (mm === 'B13XT' && stdHw.length) {
    add(errors, { id: 'std-on-wideband', title: 'Standard baseband options on a wideband instrument',
      detail: `${stdHw.map(o => smwLabel(o.id)).join(', ')} belong to the standard baseband section and ` +
              'need R&S®SMW-B13 or -B13T. Use the wideband equivalents instead.',
      section: 'bb-hw', drop: stdHw.map(o => o.id) });
  }
  if ((mm === 'B13' || mm === 'B13T') && wideHw.length) {
    add(errors, { id: 'wide-on-standard', title: 'Wideband baseband options on a standard instrument',
      detail: `${wideHw.map(o => smwLabel(o.id)).join(', ')} belong to the wideband baseband section and ` +
              'need R&S®SMW-B13XT. Use the standard equivalents instead.',
      section: 'bb-hw', drop: wideHw.map(o => o.id) });
  }
  if (stdHw.length && wideHw.length) {
    add(errors, { id: 'mixed-bb', title: 'Standard and wideband baseband hardware cannot be mixed',
      detail: `Remove either the standard options (${stdHw.map(o => smwLabel(o.id)).join(', ')}) ` +
              `or the wideband options (${wideHw.map(o => smwLabel(o.id)).join(', ')}).`,
      section: 'bb-hw' });
  }

  /* --- waveform package ceiling ---------------------------------- */
  const waveforms = (sel['K200-1'] || 0) + (sel['K200-5'] || 0) * 5 + (sel['K200-50'] || 0) * 50;
  if (waveforms > 250) {
    add(errors, { id: 'waveforms', title: 'Too many R&S®WinIQSIM2 waveforms',
      detail: `A maximum of 250 waveforms can be registered per instrument; this configuration registers ${waveforms}.`,
      section: 'std-wiq' });
  }

  /* --- GNSS channel ceiling --------------------------------------
     The GNSS specifications (PD 3607.6896.22) put 102 channels on each
     wideband generator and each fading simulator that carries a GNSS coder:
     204 with two R&S SMW-B9, 612 with two B9 and four B15. An instrument
     starts at 24 channels, so the extensions may fill the rest. */
  const gnssExtra = (sel.K136 || 0) * 6 + (sel.K137 || 0) * 12 + (sel.K138 || 0) * 24 + (sel.K139 || 0) * 48;
  const gnssBoards = (sel.B9 || 0) + (sel.B9F || 0) + (sel.B15 || 0);
  const gnssCap = 102 * gnssBoards;
  if (gnssExtra && 24 + gnssExtra > gnssCap) {
    const room = Math.max(0, gnssCap - 24);
    add(errors, { id: 'gnss-channels-max', title: 'Too many GNSS channels',
      detail: `Each R&S®SMW-B9/-B9F and each R&S®SMW-B15 carries up to 102 GNSS channels ` +
        `(204 with two R&S®SMW-B9, 612 with two R&S®SMW-B9 and four R&S®SMW-B15). ` +
        `This instrument holds ${gnssCap} channels, of which 24 come with it, ` +
        `so the extensions may add ${room}; this configuration adds ${gnssExtra}.`,
      section: 'std-int' });
  }

  /* --- two wideband generators take 0, 2 or 4 fading simulators --- */
  const wgen = (sel.B9 || 0) + (sel.B9F || 0);
  if (wgen >= 2 && sel.B15 === 1) {
    add(errors, { id: 'b15-odd', title: 'R&S®SMW-B15 quantity not available',
      detail: 'With two R&S®SMW-B9/-B9F, R&S®SMW-B15 can only be installed 0, 2 or 4 times.',
      section: 'fading', option: 'B15', setQty: ['B15', 2] });
  }

  /* --- advisory checks ------------------------------------------- */
  if (mm && !['B9', 'B9F', 'B10'].some(id => sel[id])) {
    add(warnings, { id: 'no-generator', title: 'No baseband generator',
      detail: 'Without R&S®SMW-B10 or -B9 the instrument produces CW and analog modulation only – no digital standards, ARB playback or fading.',
      section: 'bb-hw', fix: [mm === 'B13XT' ? 'B9' : 'B10'] });
  }
  if (sel.K555 && !sel['SMW-ZKK'] && !sel['SMW-ZKV']) {
    add(info, { id: 'k555-combiner', title: 'R&S®SMW-K555 needs an external power combiner',
      detail: 'Add the R&S®SMW-ZKK (40 GHz) or R&S®SMW-ZKV (67 GHz) combiner kit from the accessories, plus an analyzer or power meter.',
      section: 'extras' });
  }
  if (paths > 1 && !sel.B90 && (sel.K74 || sel.K75)) {
    add(info, { id: 'mimo-coherence', title: 'Consider phase coherence',
      detail: 'MIMO measurements across two RF paths usually want R&S®SMW-B90 phase coherence.',
      section: 'rf-enh', fix: ['B90'] });
  }
  if (sel.B9F && sel.B9) {
    add(errors, { id: 'b9-b9f', title: 'R&S®SMW-B9 and -B9F cannot be mixed',
      detail: 'Possible configurations are 1 × B9, 2 × B9, 1 × B9F or 2 × B9F.', section: 'bb-hw' });
  }
}

/* ------------------------------------------- settling a requirement */

/**
 * True when an option can never be added because the baseband main module
 * already chosen rules it out - B10 needs B13 or B13T, so it is unreachable on
 * a B13XT instrument. The engine uses it to choose between the branches of an
 * either/or requirement: offering the standard branch on a wideband instrument
 * sends the user down a road with no end.
 */
export function smwUnreachable (id, sel) {
  const mm = mainModule(sel);
  const opt = BY_ID[id];
  if (!mm || !opt?.requires) return false;
  const expanded = opt.requires.replace(/[A-Z][A-Z0-9]*/g, t => SHORTHAND[t] || t);
  const named = expanded.match(/B13XT|B13T|B13/g);
  return !!named && !named.includes(mm);
}

/**
 * The already-installed option that rules out every way of satisfying a
 * requirement. Single-select choices - the baseband main module, the RF path A
 * frequency - cannot be swapped behind the user's back, so when a requirement
 * can only be met by a different one of those, nothing can be added to fix it
 * and the option itself has to go instead.
 */
export function smwBlockedBy (need, sel, depth = 2) {
  const mm = mainModule(sel);
  const fa = freqA(sel);
  const ids = need.ids.filter(id => BY_ID[id]);
  if (!ids.length) return null;
  if (mm && ids.every(id => MAIN_MODULES.includes(id) && id !== mm)) return mm;
  /* A requirement that only frequency options can meet is settled by the RF
     path A choice: the other path A options are ruled out because one is
     already installed, and a path B option is ruled out unless path A can be
     paired with it. R&S SMW-K553 on a 3 GHz instrument is the case - naming
     the installed option explains an issue that otherwise offers nothing. */
  if (fa && ids.every(id => {
    const o = BY_ID[id];
    if (o.step === 1) return id !== fa.id;
    if (o.step === 5 && o.meta?.path === 'B') return !(RF_PATH_MATRIX[fa.id] || []).includes(id);
    return false;
  })) return fa.id;
  /* One step further: a requirement is equally out of reach when everything
     that could meet it is itself ruled out. R&S SMW-K123 asks for a wideband
     generator, which asks for R&S SMW-B13XT - on a B13 instrument the answer
     the user needs is "not with B13", not "add a B9" they cannot add either. */
  if (depth > 0) {
    const blockers = ids.map(id => {
      if (sel[id]) return null;
      const o = BY_ID[id];
      const clash = (o.conflicts || []).find(c => sel[c]);
      if (clash) return clash;
      if (!o.requires) return null;
      for (const n of evaluate(parse(o.requires), sel).need) {
        const by = smwBlockedBy(n, sel, depth - 1);
        if (by) return by;
      }
      return null;
    });
    if (blockers.every(Boolean)) return blockers[0];
  }
  return null;
}

/**
 * Picks the option to add when a requirement is unmet. Prefers something the
 * configuration already leans towards: the current baseband section first,
 * then the first id the guide lists.
 */
export function smwPickFix (need, sel) {
  const mmInstalled = mainModule(sel);
  const freqAInstalled = freqA(sel);
  const candidates = need.ids.filter(id => {
    if (!BY_ID[id]) return false;
    // never propose a second single-select item
    if (mmInstalled && MAIN_MODULES.includes(id) && id !== mmInstalled) return false;
    if (freqAInstalled && BY_ID[id].step === 1 && id !== freqAInstalled.id) return false;
    const fb = freqB(sel);
    if (fb && BY_ID[id].step === 5 && BY_ID[id].meta?.path === 'B' && id !== fb.id) return false;
    /* Proposing a path B option the installed path A option cannot be paired
       with trades one error for another: the fix button would add B2006 to a
       3 GHz instrument and raise rf-combo instead. */
    if (!fb && freqAInstalled && BY_ID[id].step === 5 && BY_ID[id].meta?.path === 'B' &&
        !(RF_PATH_MATRIX[freqAInstalled.id] || []).includes(id)) return false;
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

/**
 * The single-select choice to offer in place of the one that blocks a
 * requirement. Preference runs to the main module that carries the most:
 * B13T takes two I/Q paths where B13 takes one. Only a main module is ever
 * swapped this way.
 */
export function smwSwapFor (blocker, wanted) {
  const alt = ['B13T', 'B13XT', 'B13'].find(id => wanted.includes(id) && id !== blocker);
  return alt && MAIN_MODULES.includes(blocker) ? alt : null;
}

export const smwRules = {
  context: smwContext,
  before: smwBefore,
  after: smwAfter,
  unreachable: smwUnreachable,
  blockedBy: smwBlockedBy,
  pickFix: smwPickFix,
  swapFor: smwSwapFor
};
