/**
 * The R&S FSW's own parts of the page: the model ladder, the analysis
 * bandwidth choice with its "included" level, the hardware sections whose
 * options carry one order number per model, the single-select groups, and
 * the chain pane. The shell (assets/js/app.js) calls these through the
 * profile's `ui` and draws every other section itself.
 */

import { icon, esc, optionCard, freqCard, groupedCards } from '../ui.js';
import { OPTIONS, BY_ID, MODELS, BANDWIDTH } from './catalog.js';
import { modelOf, bwOption, analysisBw } from './rules.js';
import { renderChain } from './diagram.js';

/** Options sold under one code with one order number per model, and the two RBW options. */
const FAMILY = { B24: 'B24', B71: 'B71', B21: 'B21', B8: 'B8', B8E: 'B8' };

/** The options a section lists. */
function fswSectionOptions (id) {
  return OPTIONS.filter(o => o.section === id && !o.auto);
}

function renderModels (sel) {
  return `<div class="cards grid-2">${MODELS.map(id => freqCard(BY_ID[id], sel, 85)).join('')}</div>`;
}

function renderBandwidth (sel) {
  const bw = bwOption(sel);
  const { bw: eff, by } = analysisBw(sel);
  const standard = `
    <div class="card ${bw ? 'off' : 'on'}" data-opt="bw-none">
      <button class="tick round" data-level="bw-none" aria-pressed="${!bw}"
        aria-label="Standard 28 MHz analysis bandwidth, no option">${icon('check', 13)}</button>
      <div class="card-body" data-level="bw-none">
        <div class="card-top"><span class="opt-id">included</span><span class="opt-kind hw">standard</span></div>
        <p class="opt-name">28 MHz analysis bandwidth</p>
        <p class="opt-note">Every R&amp;S®FSW analyses 28 MHz without an option; the options below raise it.</p>
        <div class="opt-meta"><span class="opt-order">no extra option</span></div>
      </div>
    </div>`;
  const opts = OPTIONS.filter(o => o.section === 'bandwidth');
  const ladder = opts.filter(o => o.group === 'Analysis bandwidth');
  const realtime = opts.filter(o => o.group === 'Real-time analyzers');
  const upgraded = by && BY_ID[by].meta?.upgrade
    ? `<div class="issue info"><div class="issue-title">${icon('info', 14)}<span>Upgraded instrument</span></div>
       <div class="issue-detail">With the upgrades under Upgrades this instrument analyses ${eff >= 1000 ? `${eff / 1000} GHz` : `${eff} MHz`}
       (R&amp;S®FSW-${esc(by)}).</div></div>` : '';
  return `
    ${upgraded}
    <div class="group-head">Analysis bandwidth – one per instrument</div>
    <div class="cards">${standard}${ladder.map(o => optionCard(o, sel)).join('')}</div>
    <div class="group-head">Real-time analyzers – include their analysis bandwidth</div>
    <div class="cards">${realtime.map(o => optionCard(o, sel)).join('')}</div>`;
}

/**
 * A hardware section: the options with one order number per model are
 * shown for the chosen model, and dimmed for the others - the way the
 * ordering information lists them, "for R&S FSW8/13", is a fact about the
 * number, not a rule the user has to know.
 */
function renderHardware (sec, sel) {
  const model = modelOf(sel);
  const all = fswSectionOptions(sec.id);
  const fits = o => !o.meta?.models || !model || o.meta.models.includes(model) || sel[o.id];
  const shown = all.filter(fits);
  const hidden = all.filter(o => !fits(o));
  const perModel = all.some(o => o.meta?.models);
  const hint = perModel && !model
    ? `<div class="issue info">
        <div class="issue-title">${icon('info', 14)}<span>Choose a model first</span></div>
        <div class="issue-detail">${sec.id === 'rf-hw'
          ? 'The preamplifier, the external mixer connections and the 80 MHz resolution bandwidth carry one order number per model; every variant is listed until a model is chosen.'
          : 'The analog baseband inputs carry one order number per model; every variant is listed until a model is chosen.'}</div>
      </div>` : '';
  return `
    ${hint}
    ${groupedCards(shown, sel)}
    ${hidden.length ? `<div class="group-head">Order numbers for other models</div>
      <div class="cards" style="opacity:.42;pointer-events:none">${hidden.map(o => optionCard(o, sel)).join('')}</div>` : ''}`;
}

/** The chain pane: the receiver drawing and the configuration's counts. */
function renderChainPane (d, sel) {
  return `
      <div class="viz">${renderChain(d, sel)}</div>
      <div class="pane-title">Configuration</div>
      <div class="vitals">
        <div class="vital"><div class="vital-label">Model</div>
          <div class="vital-value">${d.model ? esc(d.model.id) : '—'}</div>
          <div class="vital-sub">${d.model ? esc(d.model.order) : 'base unit not chosen'}</div></div>
        <div class="vital"><div class="vital-label">Hardware options</div>
          <div class="vital-value">${d.hwCount}</div><div class="vital-sub">B- and U-options</div></div>
        <div class="vital"><div class="vital-label">Software options</div>
          <div class="vital-value">${d.swCount}</div><div class="vital-sub">K-options, keycode${d.floating ? ` · ${d.floating} floating` : ''}</div></div>
        <div class="vital"><div class="vital-label">Accessories</div>
          <div class="vital-value">${d.accessoryCount}</div><div class="vital-sub">from the ordering information</div></div>
      </div>`;
}

export const fswUi = {
  sectionOptions: fswSectionOptions,

  /** The model is the one mandatory choice: the rail marks it until it is made. */
  required: (id, sel) => id === 'model' && !modelOf(sel),

  /** A section body of its own; null leaves the section to the shell's grouped cards. */
  renderSection (sec, sel) {
    if (sec.id === 'model') return renderModels(sel);
    if (sec.id === 'bandwidth') return renderBandwidth(sel);
    if (sec.id === 'rf-hw' || sec.id === 'io-hw') return renderHardware(sec, sel);
    /* the accessories keep the ordering information's own sequence */
    if (sec.id === 'extras') return groupedCards(fswSectionOptions('extras'), sel, { sort: false });
    return null;
  },

  /** Single-select groups: choosing `id` clears the others of its group. */
  exclusive (id) {
    const opt = BY_ID[id];
    if (!opt) return [];
    if (opt.baseModel) return MODELS.filter(x => x !== id);
    if (BANDWIDTH.includes(id)) return BANDWIDTH.filter(x => x !== id);
    const fam = FAMILY[opt.code];
    if (fam && !opt.accessory) {
      return OPTIONS.filter(o => o.id !== id && !o.accessory && FAMILY[o.code] === fam).map(o => o.id);
    }
    /* a floating licence stands in for the fixed one, and the other way round */
    if (opt.floating) return [id.replace(/-FL$/, '')];
    if (BY_ID[`${id}-FL`]) return [`${id}-FL`];
    return [];
  },

  /** The "included" bandwidth level: no analysis bandwidth option at all. */
  setLevel (levelId, sel) {
    if (levelId === 'bw-none') for (const id of BANDWIDTH) delete sel[id];
  },

  renderChainPane
};
