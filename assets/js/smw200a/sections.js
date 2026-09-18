/**
 * The R&S SMW200A's own parts of the page: the sections that are not a plain
 * list of cards (the two frequency ladders, the phase noise levels, the
 * baseband hardware that follows the main module), the single-select groups,
 * what changes automatically with a choice, and the chain pane. The shell
 * (assets/js/app.js) calls these through the profile's `ui` and draws every
 * other section itself.
 */

import { icon, esc, optionCard, freqCard, groupedCards, byCode } from '../ui.js';
import { OPTIONS, BY_ID, RF_PATH_MATRIX, PHASE_NOISE_LEVELS } from './catalog.js';
import { freqA, freqB, mainModule, MAIN_MODULES } from './rules.js';
import { renderChain } from './diagram.js';

/** The options a section lists; the phase noise section is drawn as levels instead. */
function smwSectionOptions (id) {
  if (id === 'phase') return [];
  return OPTIONS.filter(o => o.section === id && !o.auto);
}

function renderFreqA (sel) {
  const opts = OPTIONS.filter(o => o.step === 1);
  return `<div class="cards grid-2">${opts.map(o => freqCard(o, sel)).join('')}</div>`;
}

function renderFreqB (sel) {
  const a = freqA(sel);
  const opts = OPTIONS.filter(o => o.step === 5 && o.meta?.path === 'B');
  if (!a) {
    return `<div class="empty">Choose the RF path A frequency option first – it decides which
      path B options are available.</div>`;
  }
  const allowed = RF_PATH_MATRIX[a.id] || [];
  if (!allowed.length) {
    return `<div class="issue info">
      <div class="issue-title">${icon('info', 14)}<span>Single path instrument</span></div>
      <div class="issue-detail">R&amp;S®SMW-${esc(a.id)} in RF path A cannot be combined with a second
        RF path. Choose a different path A frequency option if you need two paths.</div>
    </div>`;
  }
  const cards = opts.filter(o => allowed.includes(o.id)).map(o => freqCard(o, sel)).join('');
  const blocked = opts.filter(o => !allowed.includes(o.id));
  /* the one-path main module rules every path B option out; the way through is
     the main module, so it is offered here rather than left to the cards */
  const onePath = mainModule(sel) === 'B13'
    ? `<div class="issue info">
        <div class="issue-title">${icon('info', 14)}<span>A second RF path needs a two-path main module</span></div>
        <div class="issue-detail">R&amp;S®SMW-B13 carries one I/Q path to the RF section. RF path B needs
          R&amp;S®SMW-B13T (two paths, standard baseband) or R&amp;S®SMW-B13XT (two paths, wideband).</div>
        <div class="issue-actions">
          <button class="mini mini-go" data-swap="B13,B13T">Use B13T instead of B13</button>
          <button class="mini" data-swap="B13,B13XT">Use B13XT instead of B13</button>
        </div>
      </div>` : '';
  const chassis = sel.B94L
    ? `<div class="issue info"><div class="issue-title">${icon('info', 14)}<span>Deeper chassis added automatically</span></div>
       <div class="issue-detail">This RF path combination requires R&amp;S®SMW-B94L (1438.8150.02); it is
       included in the parts list.</div></div>` : '';
  return `
    ${onePath}
    <div class="cards grid-2">${cards}</div>
    ${chassis}
    ${blocked.length ? `<div class="group-head">Not available with R&amp;S®SMW-${esc(a.id)}</div>
      <div class="cards grid-2" style="opacity:.42;pointer-events:none">
        ${blocked.map(o => freqCard(o, sel)).join('')}</div>` : ''}`;
}

function renderPhase (sel) {
  const b = freqB(sel);
  const current = PHASE_NOISE_LEVELS.find(l => l.a && sel[l.a])?.id || 'std';
  return `<div class="levels">${PHASE_NOISE_LEVELS.map(lvl => {
    const on = current === lvl.id;
    const codes = lvl.a ? (b ? `${lvl.a} + ${lvl.b}` : lvl.a) : 'included';
    const orders = lvl.a
      ? [BY_ID[lvl.a]?.order, b ? BY_ID[lvl.b]?.order : null].filter(Boolean).join(' · ')
      : 'no extra option';
    return `
    <div class="card ${on ? 'on' : 'off'}" data-level="${lvl.id}">
      <button class="tick round" data-level="${lvl.id}" aria-pressed="${on}"
        aria-label="Select ${esc(lvl.label)} phase noise">${icon('check', 13)}</button>
      <div class="card-body" data-level="${lvl.id}">
        <div class="card-top"><span class="opt-id">${esc(codes)}</span></div>
        <p class="opt-name">${esc(lvl.label)}</p>
        <p class="opt-note">${esc(lvl.blurb)}</p>
        <div class="opt-meta"><span class="opt-order">${esc(orders)}</span></div>
      </div>
    </div>`;
  }).join('')}</div>`;
}

function renderBasebandHw (sel) {
  const mm = mainModule(sel);
  if (!mm) {
    return `<div class="empty">Choose a baseband main module first – it decides whether the standard
      or the wideband baseband hardware applies.</div>`;
  }
  const wideband = mm === 'B13XT';
  const group = wideband ? 'Wideband baseband' : 'Standard baseband';
  const opts = OPTIONS.filter(o => o.section === 'bb-hw' && o.group === group).sort(byCode);
  const other = OPTIONS.filter(o => o.section === 'bb-hw' && o.group !== group && sel[o.id]);
  return `
    <div class="issue info">
      <div class="issue-title">${icon('info', 14)}<span>${wideband ? 'Wideband' : 'Standard'} baseband section (guide step ${wideband ? 9 : 8})</span></div>
      <div class="issue-detail">R&amp;S®SMW-${esc(mm)} is installed, so the ${wideband ? 'wideband' : 'standard'}
        baseband options apply – up to ${wideband ? '2 GHz' : '160 MHz'} RF bandwidth. The two sections cannot be mixed.</div>
    </div>
    <div class="cards">${opts.map(o => optionCard(o, sel)).join('')}</div>
    ${other.length ? `<div class="group-head">Selected but not compatible</div>
      <div class="cards">${other.map(o => optionCard(o, sel)).join('')}</div>` : ''}`;
}

/** The chain pane: the signal chain drawing and the configuration's counts. */
function renderChainPane (d, sel) {
  return `
      <div class="viz">${renderChain(d, sel)}</div>
      <div class="pane-title">Configuration</div>
      <div class="vitals">
        <div class="vital"><div class="vital-label">Hardware options</div>
          <div class="vital-value">${d.hwCount}</div><div class="vital-sub">B-options</div></div>
        <div class="vital"><div class="vital-label">Software options</div>
          <div class="vital-value">${d.swCount}</div><div class="vital-sub">K-options, keycode</div></div>
        <div class="vital"><div class="vital-label">Baseband</div>
          <div class="vital-value">${d.section ? (d.section === 'wideband' ? 'Wideband' : 'Standard') : '—'}</div>
          <div class="vital-sub">${esc(d.mainModule || 'no main module')}</div></div>
        <div class="vital"><div class="vital-label">Chassis</div>
          <div class="vital-value">${d.chassis === 'deep' ? 'Deep' : 'Standard'}</div>
          <div class="vital-sub">${d.chassis === 'deep' ? 'R&amp;S®SMW-B94L' : 'included in base unit'}</div></div>
      </div>`;
}

export const smwUi = {
  sectionOptions: smwSectionOptions,

  /** A mandatory choice still to make in a section: the rail marks it. */
  required: (id, sel) => (id === 'rf-a' && !freqA(sel)) || (id === 'baseband' && !mainModule(sel)),

  /** A section body of its own; null leaves the section to the shell's grouped cards. */
  renderSection (sec, sel) {
    if (sec.id === 'rf-a') return renderFreqA(sel);
    if (sec.id === 'rf-b') return renderFreqB(sel);
    if (sec.id === 'phase') return renderPhase(sel);
    if (sec.id === 'bb-hw') return renderBasebandHw(sel);
    /* the accessories keep the ordering information's own sequence: half of them
       have no type designation to sort by */
    if (sec.id === 'extras') return groupedCards(smwSectionOptions('extras'), sel, { sort: false });
    return null;
  },

  /** Single-select groups: choosing `id` clears the others of its group. */
  exclusive (id) {
    const opt = BY_ID[id];
    if (!opt) return [];
    if (opt.step === 1) return OPTIONS.filter(o => o.step === 1 && o.id !== id).map(o => o.id);
    if (opt.step === 2) return MAIN_MODULES.filter(x => x !== id);
    if (opt.step === 5 && opt.meta?.path === 'B') {
      return OPTIONS.filter(o => o.step === 5 && o.meta?.path === 'B' && o.id !== id).map(o => o.id);
    }
    return [];
  },

  /** Keeps the deeper chassis in step with the RF path B choice; runs at boot and after every change. */
  sync (sel) {
    const b = freqB(sel);
    const needs = b && ['B2012', 'B2031', 'B2044', 'B2044N', 'B2044O'].includes(b.id);
    if (needs) sel.B94L = 1;
    else delete sel.B94L;
  },

  /** After every change: keep the path B phase noise option paired with path A. */
  afterChange (sel) {
    const b = freqB(sel);
    for (const lvl of PHASE_NOISE_LEVELS) {
      if (!lvl.a) continue;
      if (sel[lvl.a] && b) sel[lvl.b] = 1;
      if (!b) delete sel[lvl.b];
    }
  },

  /** Phase noise is one level for the whole instrument. */
  setLevel (levelId, sel) {
    for (const lvl of PHASE_NOISE_LEVELS) {
      if (lvl.a) { delete sel[lvl.a]; delete sel[lvl.b]; }
    }
    const lvl = PHASE_NOISE_LEVELS.find(l => l.id === levelId);
    if (lvl?.a) {
      sel[lvl.a] = 1;
      if (freqB(sel)) sel[lvl.b] = 1;
    }
  },

  renderChainPane
};
