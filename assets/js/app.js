/** Application state, rendering and event wiring. */

import { OPTIONS, BY_ID, SECTIONS, BASE_UNIT, GUIDE, PHASE_NOISE_LEVELS, RF_PATH_MATRIX, typeName }
  from './smw200a/catalog.js';
import { useInstrument, inst } from './instrument.js';
import { validate, autoResolve, qtyChoices, maxQty, ruledOutBy } from './rules.js';
import { freqA, freqB, mainModule } from './smw200a/rules.js';
import { derive, vitals } from './smw200a/derive.js';
import { renderChain, renderRuler } from './smw200a/diagram.js';
import { renderFront, renderRear, connectorNotes, faceCounts } from './smw200a/panel.js';
import { renderPhoto } from './smw200a/photo.js';
import { icon, esc, optionCard, freqCard, issueItem, bomPane, bomLines } from './ui.js';
import { PRESETS } from './smw200a/presets.js';
import { SavedStore, packSel, unpackSel, summarize, savedKey } from './saved.js';
import { readText, aiText, parseAiJson, readPdf, canvasToBlob, ocrImage, warmOcr, aiPrompt } from './import.js';
import { readCompetitor, xrefRows, xrefName, xrefTypes, xrefCode, xrefSummary, mappedFrom, XREF_STATUS } from './xref.js';
import { partsListPdf } from './pdf.js';

/* this instrument's own key for the configuration on screen */
const STORE = () => inst().storage.config;

/* Storage is a convenience, never a requirement: private windows, sandboxed
   frames and browsers with site data blocked all make these calls throw. */
const store = {
  get (key) { try { return localStorage.getItem(key); } catch { return null; } },
  set (key, value) { try { localStorage.setItem(key, value); } catch { /* not available */ } }
};

/* The named configurations behind the Save and Saved buttons: this browser's
   list, and the page's own list when a host offers one (saved.js). */
const saved = new SavedStore(store);

/** The host page may stamp a theme on the root element; otherwise follow the OS. */
function initialTheme () {
  const saved = store.get('smw-theme');
  if (saved === 'light' || saved === 'dark') return saved;
  const stamped = document.documentElement.dataset.theme;
  if (stamped === 'light' || stamped === 'dark') return stamped;
  return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

const state = {
  sel: {},
  name: 'Untitled configuration',
  section: 'rf-a',
  tab: 'overview',
  search: '',
  theme: initialTheme(),
  face: 'front',
  view: 'photo',          // read from storage at boot, once the profile is known
  panelOpen: false,
  /* where the configuration came from when it is the equivalent of a
     competitor's: { vendor, model, codes, name, when }, or null */
  xref: null
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ============================== persistence ============================== */

const encode = () =>
  `#c=${encodeURIComponent(packSel(state.sel))}&n=${encodeURIComponent(state.name)}`;

function decode (hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  return { sel: unpackSel(params.get('c')), name: params.get('n') || 'Untitled configuration' };
}

function save () {
  store.set(STORE(), JSON.stringify({ sel: state.sel, name: state.name, xref: state.xref }));
  try { history.replaceState(null, '', encode()); } catch { /* sandboxed frame */ }
}

function load () {
  let stored = null;
  try { stored = JSON.parse(store.get(STORE()) || 'null'); } catch { /* ignore malformed storage */ }
  if (location.hash.includes('c=')) {
    const { sel, name } = decode(location.hash);
    if (Object.keys(sel).length) {
      state.sel = sel; state.name = name;
      /* the page writes its own link into the address bar, so a hash that
         matches what was stored is this browser's own configuration and its
         cross-reference comes back with it; a pasted link carries none */
      if (stored?.xref?.model && packSel(stored.sel || {}) === packSel(sel)) state.xref = stored.xref;
      return;
    }
  }
  if (stored?.sel) {
    state.sel = stored.sel; state.name = stored.name || state.name;
    state.xref = stored.xref?.model ? stored.xref : null;
  }
}

/* ============================== mutations =============================== */

function setQty (id, qty) {
  const opt = BY_ID[id];
  if (!opt) return;
  if (qty <= 0) delete state.sel[id];
  else state.sel[id] = qty;

  // single-select groups: one frequency option per path, one main module
  if (qty > 0) {
    if (opt.step === 1) OPTIONS.filter(o => o.step === 1 && o.id !== id).forEach(o => delete state.sel[o.id]);
    if (opt.step === 2) ['B13', 'B13T', 'B13XT'].filter(x => x !== id).forEach(x => delete state.sel[x]);
    if (opt.step === 5 && opt.meta?.path === 'B') {
      OPTIONS.filter(o => o.step === 5 && o.meta?.path === 'B' && o.id !== id).forEach(o => delete state.sel[o.id]);
    }
  }
  afterChange();
}

function toggle (id) {
  const opt = BY_ID[id];
  if (!opt) return;
  if (state.sel[id]) {
    delete state.sel[id];
  } else if (ruledOutBy(opt, state.sel)) {
    // the card says which choice rules it out; adding it would only produce
    // an error that nothing in this section can settle
    return;
  } else {
    const choices = qtyChoices(opt, state.sel);
    setQty(id, choices[0] || 1);
    return;
  }
  afterChange();
}

/** Keeps the deeper chassis in step with the RF path B choice. */
function syncAuto () {
  const b = freqB(state.sel);
  const needs = b && ['B2012', 'B2031', 'B2044', 'B2044N', 'B2044O'].includes(b.id);
  if (needs) state.sel.B94L = 1;
  else delete state.sel.B94L;
}

/** Phase noise is one level for the whole instrument. */
function setPhaseLevel (levelId) {
  for (const lvl of PHASE_NOISE_LEVELS) {
    if (lvl.a) { delete state.sel[lvl.a]; delete state.sel[lvl.b]; }
  }
  const lvl = PHASE_NOISE_LEVELS.find(l => l.id === levelId);
  if (lvl?.a) {
    state.sel[lvl.a] = 1;
    if (freqB(state.sel)) state.sel[lvl.b] = 1;
  }
  afterChange();
}

function afterChange () {
  syncAuto();
  // keep the path B phase noise option paired with path A
  const b = freqB(state.sel);
  for (const lvl of PHASE_NOISE_LEVELS) {
    if (!lvl.a) continue;
    if (state.sel[lvl.a] && b) state.sel[lvl.b] = 1;
    if (!b) delete state.sel[lvl.b];
  }
  save();
  render();
}

/* ============================== rendering =============================== */

function sectionOptions (id) {
  if (id === 'phase') return [];
  return OPTIONS.filter(o => o.section === id && !o.auto);
}

function sectionStatus (sec) {
  const { errors } = cached.validation;
  const opts = sectionOptions(sec.id);
  const chosen = opts.reduce((n, o) => n + (state.sel[o.id] || 0), 0);
  // a broken rule marks the section; a choice not yet made only flags it
  const hasError = errors.some(e => e.section === sec.id && !e.todo);
  let dot = null;
  if (hasError) dot = 'err';
  else if (sec.id === 'rf-a' && !freqA(state.sel)) dot = 'req';
  else if (sec.id === 'baseband' && !mainModule(state.sel)) dot = 'req';
  else if (chosen) dot = 'done';
  return { chosen, dot };
}

let cached = { validation: { errors: [], warnings: [], info: [], ok: false }, derived: null };

function renderRail () {
  return SECTIONS.map(sec => {
    const { chosen, dot } = sectionStatus(sec);
    return `
    <button class="nav-item ${state.section === sec.id ? 'active' : ''}" data-goto="${sec.id}">
      <span class="nav-icon">${icon(sec.icon, 15)}</span>
      <span class="nav-label">${esc(sec.label)}</span>
      ${dot ? `<span class="nav-dot ${dot}"></span>` : ''}
      ${chosen ? `<span class="nav-count">${chosen}</span>` : ''}
    </button>`;
  }).join('');
}

function renderSection (sec) {
  const stepBadge = sec.steps.length
    ? `<span class="step-badge">Guide step ${sec.steps.join(' + ')}</span>` : '';

  let body = '';
  if (sec.id === 'rf-a') body = renderFreqA();
  else if (sec.id === 'rf-b') body = renderFreqB();
  else if (sec.id === 'phase') body = renderPhase();
  else if (sec.id === 'bb-hw') body = renderBasebandHw();
  /* the accessories keep the ordering information's own sequence: half of them
     have no type designation to sort by */
  else if (sec.id === 'extras') body = renderGrouped(sectionOptions('extras'), { sort: false });
  else body = renderGrouped(sectionOptions(sec.id));

  return `
<section class="section" id="sec-${sec.id}" data-section="${sec.id}">
  <div class="section-head">
    <div class="section-eyebrow">${icon(sec.icon, 13)} ${esc(sec.label)} ${stepBadge}</div>
    <h2 class="section-title">${esc(sec.label)}</h2>
    <p class="section-blurb">${esc(sec.blurb)}</p>
  </div>
  ${body}
</section>`;
}

const byCode = (x, y) => x.id.localeCompare(y.id, undefined, { numeric: true });

function renderGrouped (opts, { sort = true } = {}) {
  if (!opts.length) return '<div class="empty">Nothing to configure here yet.</div>';
  const groups = [];
  for (const o of opts) {
    const last = groups[groups.length - 1];
    if (last && last.name === o.group) last.items.push(o);
    else groups.push({ name: o.group, items: [o] });
  }
  /* Options added after the guide (since: 'specs' / 'vendor') are appended to
     the catalog; sorting by code keeps every group in the ordering-information
     order the guide and the vendor both use. */
  if (sort) for (const g of groups) g.items.sort(byCode);
  return groups.map(g => `
    ${groups.length > 1 ? `<div class="group-head">${esc(g.name)}</div>` : ''}
    <div class="cards">${g.items.map(o => optionCard(o, state.sel)).join('')}</div>`).join('');
}

function renderFreqA () {
  const opts = OPTIONS.filter(o => o.step === 1);
  return `<div class="cards grid-2">${opts.map(o => freqCard(o, state.sel)).join('')}</div>`;
}

function renderFreqB () {
  const a = freqA(state.sel);
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
  const cards = opts.filter(o => allowed.includes(o.id)).map(o => freqCard(o, state.sel)).join('');
  const blocked = opts.filter(o => !allowed.includes(o.id));
  /* the one-path main module rules every path B option out; the way through is
     the main module, so it is offered here rather than left to the cards */
  const onePath = mainModule(state.sel) === 'B13'
    ? `<div class="issue info">
        <div class="issue-title">${icon('info', 14)}<span>A second RF path needs a two-path main module</span></div>
        <div class="issue-detail">R&amp;S®SMW-B13 carries one I/Q path to the RF section. RF path B needs
          R&amp;S®SMW-B13T (two paths, standard baseband) or R&amp;S®SMW-B13XT (two paths, wideband).</div>
        <div class="issue-actions">
          <button class="mini mini-go" data-swap="B13,B13T">Use B13T instead of B13</button>
          <button class="mini" data-swap="B13,B13XT">Use B13XT instead of B13</button>
        </div>
      </div>` : '';
  const chassis = state.sel.B94L
    ? `<div class="issue info"><div class="issue-title">${icon('info', 14)}<span>Deeper chassis added automatically</span></div>
       <div class="issue-detail">This RF path combination requires R&amp;S®SMW-B94L (1438.8150.02); it is
       included in the parts list.</div></div>` : '';
  return `
    ${onePath}
    <div class="cards grid-2">${cards}</div>
    ${chassis}
    ${blocked.length ? `<div class="group-head">Not available with R&amp;S®SMW-${esc(a.id)}</div>
      <div class="cards grid-2" style="opacity:.42;pointer-events:none">
        ${blocked.map(o => freqCard(o, state.sel)).join('')}</div>` : ''}`;
}

function renderPhase () {
  const b = freqB(state.sel);
  const current = PHASE_NOISE_LEVELS.find(l => l.a && state.sel[l.a])?.id || 'std';
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

function renderBasebandHw () {
  const mm = mainModule(state.sel);
  if (!mm) {
    return `<div class="empty">Choose a baseband main module first – it decides whether the standard
      or the wideband baseband hardware applies.</div>`;
  }
  const wideband = mm === 'B13XT';
  const group = wideband ? 'Wideband baseband' : 'Standard baseband';
  const opts = OPTIONS.filter(o => o.section === 'bb-hw' && o.group === group).sort(byCode);
  const other = OPTIONS.filter(o => o.section === 'bb-hw' && o.group !== group && state.sel[o.id]);
  return `
    <div class="issue info">
      <div class="issue-title">${icon('info', 14)}<span>${wideband ? 'Wideband' : 'Standard'} baseband section (guide step ${wideband ? 9 : 8})</span></div>
      <div class="issue-detail">R&amp;S®SMW-${esc(mm)} is installed, so the ${wideband ? 'wideband' : 'standard'}
        baseband options apply – up to ${wideband ? '2 GHz' : '160 MHz'} RF bandwidth. The two sections cannot be mixed.</div>
    </div>
    <div class="cards">${opts.map(o => optionCard(o, state.sel)).join('')}</div>
    ${other.length ? `<div class="group-head">Selected but not compatible</div>
      <div class="cards">${other.map(o => optionCard(o, state.sel)).join('')}</div>` : ''}`;
}

function renderSearch () {
  const q = state.search.toLowerCase();
  const hits = OPTIONS.filter(o =>
    o.id.toLowerCase().includes(q) ||
    o.name.toLowerCase().includes(q) ||
    o.order.includes(q) ||
    (o.group || '').toLowerCase().includes(q));
  if (!hits.length) {
    return `<div class="empty">No option matches “${esc(state.search)}”.</div>`;
  }
  return `
  <section class="section">
    <div class="section-head">
      <div class="section-eyebrow">${icon('search', 13)} Search</div>
      <h2 class="section-title">${hits.length} option${hits.length === 1 ? '' : 's'} match “${esc(state.search)}”</h2>
    </div>
    <div class="cards">${hits.map(o => optionCard(o, state.sel)).join('')}</div>
  </section>`;
}

function colophon () {
  return `
  <div class="colophon">
    <strong>Unofficial planning aid.</strong> Built from published Rohde &amp; Schwarz
    documentation — ${esc(GUIDE.title)}, ${esc(GUIDE.version)} (${esc(GUIDE.pd)}) — and
    the matching specifications documents. Not affiliated with or endorsed by
    Rohde &amp; Schwarz, and no substitute for a quotation: it carries no prices or
    availability, and R&amp;S states that data without tolerance limits is not binding.
    Confirm any configuration with Rohde &amp; Schwarz before ordering.
    Product photographs are Rohde &amp; Schwarz's own, shown to identify the instrument.
    R&amp;S® is a registered trademark of Rohde &amp; Schwarz; other marks belong to their owners.
  </div>`;
}

/* ------------------------------------------------------------- side panel */

function renderPanel () {
  const d = cached.derived;
  const v = cached.validation;
  const issues = v.errors.length + v.warnings.length + v.info.length;

  /* Choices still to make read as steps; only a broken rule is an error. */
  const todo = v.errors.filter(e => e.todo);
  const broken = v.errors.filter(e => !e.todo);

  if (state.tab === 'xref' && !state.xref) state.tab = 'overview';
  const tabs = [
    ['overview', 'Overview', 0],
    ['chain', 'Chain', 0],
    ['checks', 'Checks', issues],
    ...(state.xref ? [['xref', 'Cross-ref', xrefRows(state.xref, state.sel).length]] : []),
    ['order', 'Parts list', bomLines(state.sel, BASE_UNIT).length]
  ];

  let body = '';
  if (state.tab === 'overview') {
    body = `
      <div class="pane-title">Frequency coverage</div>
      <div class="viz">${renderRuler(d)}</div>
      <div class="pane-title">Key figures</div>
      <div class="vitals">${vitals(d).map(v2 => `
        <div class="vital">
          <div class="vital-label">${esc(v2.label)}</div>
          <div class="vital-value">${esc(v2.value)}</div>
          <div class="vital-sub">${esc(v2.sub)}</div>
        </div>`).join('')}</div>`;
  } else if (state.tab === 'chain') {
    body = `
      <div class="viz">${renderChain(d, state.sel)}</div>
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
  } else if (state.tab === 'checks') {
    body = issues
      ? [...todo.map(e => issueItem(e, 'todo')),
         ...broken.map(e => issueItem(e, 'error')),
         ...v.warnings.map(e => issueItem(e, 'warning')),
         ...v.info.map(e => issueItem(e, 'info'))].join('')
      : `<div class="all-clear">${icon('shield', 38)}
          <strong>Configuration is valid</strong>
          Every option's prerequisites are satisfied and no rule from the configuration guide is broken.
        </div>`;
  } else if (state.tab === 'xref' && state.xref) {
    body = xrefPane();
  } else {
    body = bomPane(state.sel, BASE_UNIT);
  }

  return `
  <div class="panel-tabs">
    ${tabs.map(([id, label, count]) => `
      <button class="tab ${state.tab === id ? 'active' : ''}" data-tab="${id}">${esc(label)}
        ${count ? `<span class="badge ${id === 'checks' && broken.length ? 'bad' : ''}">${count}</span>` : ''}
      </button>`).join('')}
  </div>
  <div class="panel-body">${body}</div>
  <div class="panel-foot">
    <button class="btn" data-action="resolve" ${broken.length ? '' : 'disabled'}>
      ${icon('wand', 15)} Fix issues</button>
    <button class="btn btn-primary" data-action="export">${icon('download', 15)} Export</button>
  </div>`;
}

/**
 * The Cross-ref pane: the competitor's options the configuration was built
 * from, each with the SMW options that answer it, and a flag where one of
 * those has since been taken out of the configuration.
 */
function xrefPane () {
  const x = state.xref;
  const rows = xrefRows(x, state.sel);
  const gone = rows.filter(r => r.present === false);
  return `
    <div class="pane-title">Mapped from ${esc(x.vendor)} ${esc(x.model)}</div>
    <p class="xref-lead">${rows.length} ${esc(x.vendor)} option${rows.length === 1 ? '' : 's'} read from
      ${x.name ? `quote ${esc(x.name)}` : 'the document'}${gone.length
        ? ` · <span class="xref-warn">${gone.length} no longer fully in this configuration</span>`
        : ' · every mapped option is still selected'}.</p>
    <div class="xref-list">${rows.map(r => `
      <div class="xref-row ${esc(r.status)}${r.present === false ? ' gone' : ''}">
        <div class="xref-code">${esc(xrefCode(x.model, r.code))}</div>
        <div class="xref-what">${esc(r.name)}</div>
        <div class="xref-to">${r.ids.length ? esc(xrefTypes(r.ids)) : esc(XREF_STATUS[r.status])}${r.present === false
          ? ` <span class="chip unmet"><span>${esc(r.missing.map(typeName).join(', '))} removed</span></span>` : ''}</div>
        ${r.gap ? `<div class="xref-gap">${esc(r.gap)}</div>` : ''}
      </div>`).join('')}</div>
    <button class="btn btn-sm" data-action="xref-forget">${icon('x', 14)} Forget the cross-reference</button>`;
}

/**
 * The instrument, drawn at the head of the main column so it is on screen at
 * every width. It used to live in the side pane, which slides off screen below
 * 1000px and took the drawing with it.
 *
 * The drawing is sized to the space it actually has rather than scaled down to
 * fit, because the connector labels stop being readable once the SVG is
 * squeezed much below its natural width.
 */
/**
 * Above 1000px the right hand column is on screen and scrolls independently of
 * the options, so the instrument lives at the top of it and stays put while you
 * work down the list. Below that the column is positioned off screen, so the
 * instrument goes back to the main column and sticks to the top of it instead.
 */
const WIDE = matchMedia('(min-width: 1001px)');
const instrumentHost = () => (WIDE.matches ? $('#panel') : $('#main-inner'));

function panelWidth () {
  const host = instrumentHost();
  const room = (host?.clientWidth || 900) - (WIDE.matches ? 28 : 34);
  return Math.round(Math.max(340, Math.min(880, room)));
}

function renderHero () {
  const d = cached.derived;
  const counts = faceCounts(d);
  const notes = connectorNotes(d);
  const rear = state.face === 'rear';
  const w = panelWidth();

  return `
  <section class="hero" aria-label="Configured instrument">
    <div class="hero-head">
      <div class="face-switch" role="group" aria-label="Panel face">
        <button class="face ${rear ? '' : 'active'}" data-face="front">
          Front <span class="face-count">${counts.front}</span></button>
        <button class="face ${rear ? 'active' : ''}" data-face="rear">
          Rear <span class="face-count">${counts.rear}</span></button>
      </div>
      <div class="view-switch" role="group" aria-label="How to show the instrument">
        <button class="view ${state.view === 'photo' ? 'active' : ''}" data-view="photo"
          title="The instrument as photographed, with your configuration marked on it">Photo</button>
        <button class="view ${state.view === 'schematic' ? 'active' : ''}" data-view="schematic"
          title="A drawing that matches any configuration exactly">Schematic</button>
      </div>
      <button class="btn btn-ghost btn-sm" data-action="enlarge">
        ${icon('search', 14)} Enlarge</button>
    </div>
    <div class="viz viz-panel">
      ${state.view === 'photo'
        ? renderPhoto(d, rear ? 'rear' : 'front')
        : (rear ? renderRear(d, w, 'hero') : renderFront(d, state.sel, 'hero'))}
    </div>
    ${notes.length ? `<div class="conn-notes">${notes.map(n => `
      <div class="conn-note">
        <span class="conn-label">${esc(n.label)}</span>
        <span class="conn-value">${esc(n.value)}</span>
        ${n.note ? `<span class="conn-sub">${esc(n.note)}</span>` : ''}
      </div>`).join('')}</div>` : ''}
    <p class="viz-caption">${state.view === 'photo'
      ? 'Photograph of a fully equipped instrument; the rings mark what this configuration fits.'
      : 'Schematic elevation — connector inventory and types follow the specifications, positions are indicative.'}</p>
  </section>`;
}

/* ------------------------------------------------------------------ paint */

function render () {
  cached.validation = validate(state.sel);
  cached.derived = derive(state.sel);

  $('#rail').innerHTML = renderRail();
  const wide = WIDE.matches;
  $('#main-inner').innerHTML = (wide ? '' : renderHero()) + (state.search
    ? renderSearch()
    : SECTIONS.map(renderSection).join('')) + colophon();
  $('#panel').innerHTML = (wide ? renderHero() : '') + renderPanel();
  $('#config-name').value = state.name;

  const st = cached.validation;
  const chip = $('#status-chip');
  /* A choice not yet made is not a fault, so the header says how many are
     left rather than raising an alarm; only a broken rule does that. */
  const broken = st.errors.filter(e => !e.todo);
  const left = st.errors.length - broken.length;
  if (broken.length) {
    chip.className = 'chip unmet';
    chip.innerHTML = `${icon('alert', 11)} ${broken.length} issue${broken.length === 1 ? '' : 's'}`;
  } else if (left) {
    chip.className = 'chip step';
    chip.innerHTML = `${icon('chevron', 11)} ${left} choice${left === 1 ? '' : 's'} left`;
  } else {
    chip.className = 'chip met';
    chip.innerHTML = `${icon('check', 11)} valid`;
  }
}

/* ============================== interactions ============================ */

function scrollToSection (id) {
  state.section = id;
  // the sections are not in the document while search results are showing
  if (state.search) {
    state.search = '';
    $('#search').value = '';
    render();
  }
  const el = document.getElementById(`sec-${id}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.goto === id));
}

function toast (message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${icon('check', 15)} ${esc(message)}`;
  document.body.append(el);
  setTimeout(() => el.remove(), 2400);
}

document.addEventListener('click', ev => {
  const t = ev.target.closest('[data-toggle],[data-step],[data-level],[data-goto],[data-tab],[data-action],[data-fix],[data-drop],[data-setqty],[data-preset],[data-close],[data-face],[data-swap],[data-view],[data-load],[data-forget]');
  if (!t) return;

  if (t.dataset.view) {
    state.view = t.dataset.view;
    store.set(inst().storage.view, state.view);
    $('.hero')?.replaceWith(document.createRange().createContextualFragment(renderHero()));
    return;
  }

  if (t.dataset.face) {
    state.face = t.dataset.face;
    $('.hero')?.replaceWith(document.createRange().createContextualFragment(renderHero()));
    return;
  }

  if (t.dataset.toggle) { toggle(t.dataset.toggle); return; }
  if (t.dataset.level) { setPhaseLevel(t.dataset.level); return; }

  if (t.dataset.step) {
    const [id, dir] = t.dataset.step.split(':');
    const opt = BY_ID[id];
    const choices = qtyChoices(opt, state.sel);
    const now = state.sel[id] || 0;
    const idx = choices.indexOf(now);
    if (dir === 'up' && idx < choices.length - 1) setQty(id, choices[idx + 1]);
    if (dir === 'down') setQty(id, idx > 0 ? choices[idx - 1] : 0);
    return;
  }

  if (t.dataset.goto) {
    scrollToSection(t.dataset.goto);
    if (window.innerWidth <= 1000) closePanel();
    return;
  }
  if (t.dataset.tab) { state.tab = t.dataset.tab; render(); return; }

  if (t.dataset.fix) {
    const qtys = JSON.parse(t.dataset.fixqty || '{}');
    for (const id of t.dataset.fix.split(',')) {
      const opt = BY_ID[id];
      let want = qtys[id] || 1;
      if (opt?.qtySteps) want = opt.qtySteps.find(q => q >= want) ?? opt.qtySteps[0];
      state.sel[id] = Math.max(state.sel[id] || 0, want);
    }
    afterChange();
    return;
  }
  if (t.dataset.swap) {
    const [from, to] = t.dataset.swap.split(',');
    delete state.sel[from];
    state.sel[to] = 1;
    afterChange();
    toast(`Switched to R&S®SMW-${to}`);
    return;
  }

  if (t.dataset.drop) {
    for (const id of t.dataset.drop.split(',')) delete state.sel[id];
    afterChange();
    return;
  }
  if (t.dataset.setqty) {
    const [id, qty] = t.dataset.setqty.split(':');
    setQty(id, parseInt(qty, 10));
    return;
  }
  if (t.dataset.preset) {
    const p = PRESETS.find(x => x.id === t.dataset.preset);
    if (p) {
      state.sel = { ...p.sel };
      state.name = p.name;
      state.xref = null;
      closeModal();
      afterChange();
      toast(`Loaded “${p.name}”`);
    }
    return;
  }
  if (t.dataset.load) {
    const rec = saved.find(t.dataset.load);
    if (rec) {
      state.sel = unpackSel(rec.c);
      state.name = rec.name;
      state.xref = null;
      // an entry may name options a later catalog no longer carries
      const gone = rec.c.split('.').filter(Boolean).length - Object.keys(state.sel).length;
      closeModal();
      afterChange();
      toast(gone > 0
        ? `Loaded “${rec.name}” – ${gone} option${gone === 1 ? '' : 's'} no longer in the catalog`
        : `Loaded “${rec.name}”`);
    }
    return;
  }
  if (t.dataset.forget) {
    const rec = saved.find(t.dataset.forget);
    if (rec) { saved.remove(rec.id); openSaved(); toast(`Removed “${rec.name}”`); }
    return;
  }
  if (t.dataset.close !== undefined) { closeModal(); return; }

  const action = t.dataset.action;
  if (action === 'save') {
    if (!Object.keys(state.sel).length) { toast('Nothing to save yet'); return; }
    const { rec, replaced } = saved.save({ name: saveName(), sel: state.sel });
    if ($('.saved-list, .saved-empty')) openSaved();     // the list is open: refresh it
    toast(`${replaced ? 'Updated' : 'Saved'} “${rec.name}”`);
    return;
  }
  if (action === 'saved') { openSaved(); return; }
  if (action === 'import') { openImport(); return; }
  if (action === 'import-scan') { scanImport(); return; }
  if (action === 'import-ocr') { ocrImport(); return; }
  if (action === 'import-stop') { imp.ctl?.abort(); return; }
  if (action === 'import-load') { applyImport('replace'); return; }
  if (action === 'import-merge') { applyImport('merge'); return; }
  if (action === 'import-view') { imp.view = t.dataset.importview; renderImportResult(); return; }
  if (action === 'xref-forget') {
    state.xref = null;
    if (state.tab === 'xref') state.tab = 'overview';
    afterChange();
    toast('Cross-reference forgotten – the configuration stays');
    return;
  }
  if (action === 'resolve') {
    const before = validate(state.sel).errors.length;
    state.sel = autoResolve(state.sel);
    afterChange();
    const after = validate(state.sel).errors.length;
    const fixed = before - after;

    /* Some issues cannot be settled by adding anything - a missing main module,
       or an option ruled out by one already chosen. Saying "0 of 5 resolved"
       reads as a failure; these need a decision, and the Checks panel now
       carries the wording and a Remove button for each one. */
    if (!after) toast('All issues resolved');
    else if (fixed) toast(`${fixed} of ${before} resolved · ${after} need a choice`);
    else toast(`${after} issue${after === 1 ? '' : 's'} need a choice – see Checks`);
  }
  if (action === 'presets') openPresets();
  if (action === 'export') openExport();
  if (action === 'enlarge') {
    const d2 = cached.derived;
    const rear = state.face === 'rear';
    const counts = faceCounts(d2);
    openModal(`
    <div class="modal modal-wide" role="dialog" aria-label="${rear ? 'Rear' : 'Front'} panel">
      <div class="modal-head">
        <div style="flex:1">
          <h2>${rear ? 'Rear' : 'Front'} panel</h2>
          <p>${rear ? counts.rear : counts.front} connectors on this face.</p>
        </div>
        <button class="btn btn-icon btn-ghost" data-close aria-label="Close">${icon('x', 16)}</button>
      </div>
      <div class="modal-body">
        <div class="viz viz-wide">${state.view === 'photo'
          ? renderPhoto(d2, rear ? 'rear' : 'front')
          : (rear ? renderRear(d2, 980, 'zoom') : renderFront(d2, state.sel, 'zoom'))}</div>
        <p class="viz-caption">Schematic elevation. The connectors fitted and their types
          follow the specifications; positions on the panel are indicative.</p>
      </div>
    </div>`);
    return;
  }

  if (action === 'share') {
    const link = location.origin + location.pathname + encode();
    (navigator.clipboard?.writeText(link) ?? Promise.reject())
      .then(() => toast('Link copied to clipboard'))
      .catch(() => openModal(`
      <div class="modal" role="dialog" aria-label="Shareable link">
        <div class="modal-head">
          <div style="flex:1">
            <h2>Copy this link</h2>
            <p>It carries the whole configuration.</p>
          </div>
          <button class="btn btn-icon btn-ghost" data-close aria-label="Close">${icon('x', 16)}</button>
        </div>
        <div class="modal-body">
          <input class="link-field" readonly value="${esc(link)}">
        </div>
      </div>`));
    return;
  }
  /* Asked in the page rather than through confirm(). A sandboxed frame - which
     is how this is usually embedded - ignores the native dialogs and returns
     false, so the button appeared to do nothing at all. */
  if (action === 'reset') {
    const n = Object.keys(state.sel).length;
    if (!n) { toast('Nothing to clear'); return; }
    openModal(`
    <div class="modal" role="dialog" aria-label="Clear configuration">
      <div class="modal-head">
        <div style="flex:1">
          <h2>Clear this configuration?</h2>
          <p>${n} option${n === 1 ? '' : 's'} will be removed. This cannot be undone.</p>
        </div>
        <button class="btn btn-icon btn-ghost" data-close aria-label="Close">${icon('x', 16)}</button>
      </div>
      <div class="modal-foot">
        <button class="btn" data-close>Keep it</button>
        <button class="btn btn-danger" data-action="reset-confirm">
          ${icon('trash', 15)} Clear configuration</button>
      </div>
    </div>`);
    return;
  }

  if (action === 'reset-confirm') {
    closeModal();
    state.sel = {};
    state.name = 'Untitled configuration';
    state.xref = null;
    afterChange();
    toast('Configuration cleared');
    return;
  }
  if (action === 'theme') {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    store.set('smw-theme', state.theme);
    applyTheme();
  }
  if (action === 'panel') { state.panelOpen ? closePanel() : openPanel(); }
  if (action === 'csv') { downloadCsv(); }
  if (action === 'json') { downloadJson(); }
  if (action === 'print') { window.print(); }
  if (action === 'pdf') { downloadPdf(); }
});

document.addEventListener('change', ev => {
  const edited = ev.target.closest('[data-import-qty]');
  if (edited && imp.result) {
    const it = imp.result.items.find(i => i.id === edited.dataset.importQty);
    if (it) { it.qty = Math.max(1, Math.min(999, parseInt(edited.value, 10) || 1)); edited.value = it.qty; }
    return;
  }
  const field = ev.target.closest('[data-qty]');
  if (!field) return;
  const id = field.dataset.qty;
  const opt = BY_ID[id];
  if (!opt) return;
  const typed = parseInt(field.value, 10);
  setQty(id, Number.isFinite(typed) ? Math.max(0, Math.min(maxQty(opt, state.sel), typed)) : 0);
});

document.addEventListener('input', ev => {
  if (ev.target.id === 'search') { state.search = ev.target.value.trim(); render(); }
  if (ev.target.id === 'config-name') { state.name = ev.target.value || 'Untitled configuration'; save(); }
});

document.addEventListener('click', ev => {
  const field = ev.target.closest('.link-field');
  if (field) field.select();
});

document.addEventListener('keydown', ev => {
  const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  if (ev.key === '/' && !typing) {
    ev.preventDefault(); $('#search').focus();
  }
  if (ev.key === 'Escape') {
    if ($('.scrim')) closeModal();
    else if (state.search) { state.search = ''; $('#search').value = ''; render(); }
  }
});

/* section highlighting while scrolling */
function watchScroll () {
  const observer = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting) {
        const id = e.target.dataset.section;
        state.section = id;
        $$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.goto === id));
      }
    }
  }, { root: $('#main'), rootMargin: '-10% 0px -75% 0px' });
  const attach = () => $$('.section[data-section]').forEach(s => observer.observe(s));
  attach();
  new MutationObserver(attach).observe($('#main-inner'), { childList: true });
}

/* ============================== overlays ================================ */

function openModal (html) {
  closeModal();
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = html;
  scrim.addEventListener('click', e => { if (e.target === scrim) closeModal(); });
  document.body.append(scrim);
  document.body.classList.add('modal-open');   // lets @media print swap what is printed
}
function closeModal () {
  $('.scrim')?.remove();
  document.body.classList.remove('modal-open');
  imp.ctl?.abort();          // an AI reading still running belongs to the closed dialog
  revokeImportUrls();
}

function openPresets () {
  openModal(`
  <div class="modal" role="dialog" aria-label="Starting points">
    <div class="modal-head">
      <div style="flex:1">
        <h2>Start from a typical setup</h2>
        <p>Each starting point is a valid configuration. Adjust anything afterwards.</p>
      </div>
      <button class="btn btn-icon btn-ghost" data-close aria-label="Close">${icon('x', 16)}</button>
    </div>
    <div class="modal-body">
      <div class="preset-grid">
        ${PRESETS.map(p => `
          <button class="preset" data-preset="${p.id}">
            <div class="preset-icon">${icon(p.icon, 17)}</div>
            <div class="preset-name">${esc(p.name)}</div>
            <div class="preset-desc">${esc(p.desc)}</div>
            <div class="preset-tags">${p.tags.map(t => `<span class="chip">${esc(t)}</span>`).join('')}</div>
          </button>`).join('')}
      </div>
    </div>
  </div>`);
}

/* The header's name is the handle, but the default one would make every save
   the same entry - and on a narrow screen the field is not even shown - so an
   untitled configuration is saved under what it is. */
const saveName = () => (state.name === 'Untitled configuration' ? summarize(state.sel) : state.name);

function openSaved () {
  const rows = saved.list.map(r => `
    <div class="saved-row" data-saved="${esc(r.id)}">
      <div class="saved-main">
        <div class="saved-name">${esc(r.name)}</div>
        <div class="saved-meta">${esc(r.sum)}${r.savedAt ? ` · ${esc(when(r.savedAt))}` : ''}</div>
      </div>
      <button class="btn" data-load="${esc(r.id)}">Load</button>
      <button class="btn btn-icon btn-ghost" data-forget="${esc(r.id)}"
        title="Remove “${esc(r.name)}”" aria-label="Remove ${esc(r.name)}">${icon('trash', 15)}</button>
    </div>`).join('');
  openModal(`
  <div class="modal" role="dialog" aria-label="Saved configurations">
    <div class="modal-head">
      <div style="flex:1">
        <h2>Saved configurations</h2>
        <p>${saved.hosted
          ? 'Kept on this page – everyone who opens it sees the same list, and can change it.'
          : window.claude?.use
            ? 'Kept in this browser – the page’s own list is not available right now.'
            : 'Kept in this browser. On claude.ai the list is kept on the page itself.'}</p>
      </div>
      <button class="btn btn-icon btn-ghost" data-close aria-label="Close">${icon('x', 16)}</button>
    </div>
    <div class="modal-body">
      ${rows ? `<div class="saved-list">${rows}</div>`
             : `<div class="empty saved-empty">Nothing saved yet. Save keeps the current configuration
                under the name in the header; saving under the same name updates it.</div>`}
    </div>
    <div class="modal-foot">
      <button class="btn btn-primary" data-action="save">${icon('save', 15)} Save current as “${esc(saveName())}”</button>
    </div>
  </div>`);
}

/* ============================== import ================================= */

/* The import dialog's working state: what was dropped in, what was read from
   it, and the AI reading in flight, if any. */
const imp = { file: null, urls: [], pages: [], text: '', result: null, xref: null, view: 'rs', ctl: null, ai: null, limits: null };

/* The host's AI, where there is one (the sample capability on claude.ai).
   Resolved once; null everywhere else, and the dialog says so. */
let aiPromise;
const aiHost = () => (aiPromise ??= (window.claude?.use?.('sample') ?? Promise.resolve(null)).catch(() => null));

function revokeImportUrls () {
  for (const u of imp.urls) URL.revokeObjectURL(u);
  imp.urls = [];
}

function openImport () {
  imp.ctl?.abort();
  revokeImportUrls();
  Object.assign(imp, { file: null, pages: [], text: '', result: null, xref: null, view: 'rs', ctl: null });
  openModal(`
  <div class="modal modal-wide" role="dialog" aria-label="Import a configuration">
    <div class="modal-head">
      <div style="flex:1">
        <h2>Import a configuration</h2>
        <p>Drop a Rohde &amp; Schwarz quotation or configuration list – a PDF or a photograph – or paste its
          text. Order numbers and type designations are matched against the catalog. A Keysight E8267D
          configuration is cross-referenced to its SMW200A equivalent instead.</p>
      </div>
      <button class="btn btn-icon btn-ghost" data-close aria-label="Close">${icon('x', 16)}</button>
    </div>
    <div class="modal-body import-body">
      <div class="import-src">
        <label class="dropzone" id="import-drop" for="import-file">
          ${icon('upload', 22)}
          <strong>Drop a file here or click to choose</strong>
          <span>PDF, JPEG, PNG, WebP, GIF or plain text</span>
          <input id="import-file" type="file" accept=".pdf,application/pdf,image/*,.txt,.csv,.md,text/plain" hidden>
        </label>
        <textarea id="import-text" class="import-text" spellcheck="false" rows="7"
          placeholder="…or paste the text of the quotation here" aria-label="Document text"></textarea>
        <div class="import-tools">
          <button class="btn btn-primary" data-action="import-scan" id="import-scan" hidden>${icon('sparkle', 15)} Scan with AI</button>
          <button class="btn" data-action="import-ocr" id="import-ocr" hidden>${icon('search', 15)} Read the image</button>
          <button class="btn" data-action="import-stop" id="import-stop" hidden>${icon('x', 15)} Stop</button>
          <span class="import-status" id="import-status" aria-live="polite"></span>
        </div>
      </div>
      <div class="import-out">
        <div class="import-preview" id="import-preview"></div>
        <div id="import-result"></div>
      </div>
    </div>
    <div class="modal-foot">
      <span class="import-note" id="import-note"></span>
      <button class="btn" data-action="import-merge" id="import-merge" disabled>Add to current</button>
      <button class="btn btn-primary" data-action="import-load" id="import-load" disabled>${icon('download', 15)} Replace configuration</button>
    </div>
  </div>`);

  const file = $('#import-file');
  file.addEventListener('change', () => { if (file.files[0]) takeImportFile(file.files[0]); });
  const drop = $('#import-drop');
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', e => {
    e.preventDefault(); drop.classList.remove('over');
    const f = e.dataTransfer?.files?.[0];
    if (f) takeImportFile(f);
  });
  let timer;
  $('#import-text').addEventListener('input', e => {
    clearTimeout(timer);
    timer = setTimeout(() => readImportText(e.target.value, 'pasted text'), 250);
  });
  aiHost().then(async host => {
    imp.aiWhy = !window.claude?.use ? 'no host' : host ? null : 'the host offers the page no AI';
    if (!host || !$('#import-scan')) return;
    imp.limits = await (host.limits?.() ?? Promise.resolve(null)).catch(() => null);
    imp.ai = host;
    syncImportTools();
  });
}

const importStatus = text => { const el = $('#import-status'); if (el) el.textContent = text; };

async function takeImportFile (f) {
  revokeImportUrls();
  Object.assign(imp, { file: f, pages: [], text: '', result: null, xref: null, view: 'rs' });
  const preview = $('#import-preview');
  if (!preview) return;
  const isPdf = f.type === 'application/pdf' || /\.pdf$/i.test(f.name);

  if (f.type.startsWith('image/')) {
    const url = URL.createObjectURL(f);
    imp.urls.push(url);
    preview.innerHTML = `<img src="${url}" alt="${esc(f.name)}">`;
    importStatus('');
    renderImportResult();
    syncImportTools();
    return;
  }
  if (isPdf) {
    preview.innerHTML = '';
    importStatus('Opening the PDF…');
    try {
      const pdf = await readPdf(await f.arrayBuffer());
      if (imp.file !== f) return;                       // another file came in meanwhile
      imp.pages = pdf.pages;
      const shown = pdf.pages.filter(p => p.canvas);
      preview.innerHTML = shown.map(p =>
        `<figure class="import-page"><figcaption>Page ${p.n} of ${pdf.count}</figcaption></figure>`).join('');
      shown.forEach((p, i) => preview.children[i].prepend(p.canvas));
      if (pdf.text.trim()) {
        readImportText(pdf.text, f.name);
        importStatus(pdf.count > shown.length
          ? `The text of all ${pdf.count} pages was read; the first ${shown.length} are shown.` : '');
      } else {
        renderImportResult();
        importStatus('This PDF carries no text – it looks scanned.');
      }
    } catch {
      if (imp.file !== f) return;
      imp.pages = [];
      importStatus('The PDF could not be opened here. The PDF reader loads from the web on first use; paste the text instead.');
    }
    syncImportTools();
    return;
  }
  // anything else is taken as text
  const text = await f.text();
  if (imp.file !== f) return;                         // another file came in meanwhile
  const box = $('#import-text');
  if (box) box.value = text.slice(0, 200000);
  preview.innerHTML = '';
  importStatus('');
  readImportText(text, f.name);
  syncImportTools();
}

function readImportText (text, source) {
  imp.text = text;
  imp.source = source;
  imp.result = text.trim() ? readText(text) : null;
  imp.xref = text.trim() ? readCompetitor(text) : null;
  /* the R&S reading has the say when both readers found something; the
     cross-reference when only it did */
  imp.view = imp.result?.items.length ? 'rs' : imp.xref ? 'xref' : 'rs';
  renderImportResult();
}

/** Whether any reader made something of the document. */
const importRead = () => !!(imp.result?.items.length || imp.xref?.rows?.length || imp.xref?.other?.length);

/* Where there is a picture and no text, two readers are offered: the OCR
   engine, which runs in the page wherever it can be fetched, and the host's
   AI where the host has one. The status line says what is on offer and why
   the rest is not, so a greyed button is never a mystery. */
function syncImportTools () {
  const scan = $('#import-scan'), ocr = $('#import-ocr');
  if (!scan || !ocr) return;
  const isImage = !!imp.file?.type.startsWith('image/');
  // a picture, or rendered pages whose text layer gave nothing to read
  const scannable = isImage || (imp.pages.some(p => p.canvas) && !importRead());
  ocr.hidden = !scannable;
  scan.hidden = !(imp.ai && scannable);
  const st = $('#import-status');
  if (st && !st.textContent && scannable && !importRead()) {
    const what = isImage ? 'the image' : 'the pages';
    st.textContent = !scan.hidden
      ? `Scan with AI is the quick way here – Claude reads ${what} on your account. Read ${what} runs in the page instead (a 7 MB download, once).`
      : `Read ${what} runs here in the page (a 7 MB download, once)${imp.aiWhy === 'no host' ? '' : ` – ${imp.aiWhy || 'the AI has not answered yet'}`}.`;
  }
  /* where the page's own reader is the only one, start fetching it now so
     the button does not begin with the download */
  if (scannable && !window.claude?.use) warmOcr().catch(() => {});
}

/* What the engine reports while it starts and reads, in the status line. */
function ocrStage (m, page = '') {
  const pct = m.progress > 0 && m.progress < 1 ? ` ${Math.round(m.progress * 100)} %` : '';
  switch (m.status) {
    case 'loading tesseract core': return `Loading the reader… the engine, about 4 MB, once${pct}`;
    case 'initializing tesseract': case 'initializing api': return 'Starting the reader…';
    case 'loading language traineddata': return `Loading the reader… language data, about 3 MB, once${pct}`;
    case 'recognizing text': return `Reading${page}…${pct}`;
    default: return `Loading the reader… ${m.status || ''}`.trim();
  }
}

const importErrorOf = err => err?.code || (/Failed to fetch|import|network|load/i.test(err?.message || '') ? 'offline' : 'error');

/* Reads the picture in the page. The engine and its language data come from
   the CDN on the first use, several megabytes, so the status says what is
   happening and the reading can be stopped. */
async function ocrImport () {
  const ocr = $('#import-ocr'), scan = $('#import-scan'), stop = $('#import-stop');
  if (!ocr || imp.busy) return;
  const isImage = !!imp.file?.type.startsWith('image/');
  const sources = isImage ? [imp.file] : imp.pages.filter(p => p.canvas).map(p => p.canvas);
  if (!sources.length) return;
  const MAX = 5;
  if (sources.length > MAX) toast(`Reading the first ${MAX} pages; paste the rest as text if needed`);

  const ctl = new AbortController();
  imp.ctl = ctl;
  imp.busy = true;
  ocr.disabled = true; scan.disabled = true; stop.hidden = false;
  importStatus('Loading the reader…');
  try {
    const texts = [];
    for (const [i, src] of sources.slice(0, MAX).entries()) {
      const page = sources.length > 1 ? ` page ${i + 1} of ${Math.min(sources.length, MAX)}` : '';
      texts.push(await ocrImage(src, { signal: ctl.signal, onProgress: m => importStatus(ocrStage(m, page)) }));
    }
    if (ctl.signal.aborted) return;
    const text = texts.join('\n');
    const box = $('#import-text');
    if (box) box.value = text;                    // so a misread digit can be corrected and read again
    readImportText(text, isImage ? 'the image' : 'the pages');
    importStatus(importRead()
      ? 'Read in the page – check the quantities and the codes, a picture is never read perfectly. The text is in the box to correct.'
      : 'Nothing recognisable was read. A sharper, larger picture reads better; or paste the text.');
  } catch (err) {
    const code = importErrorOf(err);
    const other = imp.ai ? 'Scan with AI is the quick way here, or paste the text.' : 'Paste the text instead.';
    importStatus(code === 'cancelled' ? 'Stopped.'
      : code === 'timeout' ? `The reader did not start within a minute – this viewer may not let it run. ${other}`
      : code === 'offline' ? `The reader could not be fetched (it comes from the web on first use). ${other}`
      : `The image could not be read here. ${other}`);
  } finally {
    if (imp.ctl === ctl) imp.ctl = null;
    imp.busy = false;
    ocr.disabled = false; scan.disabled = false; stop.hidden = true;
  }
}

function renderImportResult () {
  const out = $('#import-result');
  if (!out) return;
  const r = imp.result;
  const x = imp.xref;
  const load = $('#import-load'), merge = $('#import-merge'), note = $('#import-note');
  load.innerHTML = `${icon('download', 15)} Replace configuration`;
  merge.textContent = 'Add to current';
  if (imp.view === 'xref' && x) { renderXrefResult(x, !!r?.items.length); return; }
  if (!r) { out.innerHTML = ''; load.disabled = merge.disabled = true; note.textContent = ''; return; }
  const n = r.items.length;
  const u = r.unknown.length;
  out.innerHTML = `
    ${x?.model && x.rows.length ? `<div class="import-switch">The document also names a ${esc(x.vendor)} ${esc(x.model)} –
      <button class="btn-link" data-action="import-view" data-importview="xref">show the SMW200A equivalent</button></div>` : ''}
    <div class="import-summary">${n ? `${n} option${n === 1 ? '' : 's'} recognised` : 'Nothing recognised'}${
      r.base ? ' · base unit' : ''}${u ? ` · ${u} line${u === 1 ? '' : 's'} not in the catalog` : ''}</div>
    ${n ? `<table class="table import-table">
      <thead><tr><th>Type</th><th>Designation</th><th>Order No.</th><th style="text-align:right">Qty</th></tr></thead>
      <tbody>${r.items.map(it => {
        const o = BY_ID[it.id];
        return `<tr>
          <td class="c-id">${esc(typeName(it.id))}</td>
          <td>${esc(o.name)}</td>
          <td class="c-order">${esc(o.order)}</td>
          <td class="c-qty"><input class="qty-input" type="number" min="1" max="999" value="${it.qty}"
            data-import-qty="${esc(it.id)}" aria-label="Quantity of ${esc(it.id)}"></td>
        </tr>`; }).join('')}</tbody>
    </table>` : ''}
    ${u ? `<div class="import-unknown"><div class="group-head">Not in the catalog</div>${
      r.unknown.map(x => `<div class="import-unknown-line"><span>${esc(x.line)}</span><small>${esc(x.why)}</small></div>`).join('')}</div>` : ''}`;
  load.disabled = merge.disabled = !n;
  note.textContent = n
    ? 'Replace starts from the document alone; Add keeps what is configured and raises a quantity where the document has more.'
    : '';
}

/**
 * The cross-reference view: the competitor's options in five groups by what
 * the SMW200A makes of them, each with the SMW options, the page it was read
 * from and the figures that decided it; then what the SMW200A's own rules
 * added, and anything the table has no row for.
 */
function renderXrefResult (x, alsoRs) {
  const out = $('#import-result');
  const load = $('#import-load'), merge = $('#import-merge'), note = $('#import-note');
  if (!x.model) {
    const names = x.other.map(o => `${o.model} (${o.family})`).join(', ');
    out.innerHTML = x.other.length
      ? `<div class="import-summary">Keysight ${esc(names)} recognised</div>
         <p class="xref-lead">Only the Keysight E8267D is cross-referenced so far – there is no table for this model yet.</p>`
      : `<div class="import-summary">Keysight option codes, no model</div>
         <p class="xref-lead">${esc(x.candidates.join(', '))} look like Keysight PSG option codes, but no model name was read.
           If the instrument is an E8267D, add “E8267D” to the text in the box.</p>`;
    load.disabled = merge.disabled = true; note.textContent = '';
    return;
  }
  const n = Object.keys(x.sel).length;
  const plural = (k, w) => `${k} ${w}${k === 1 ? '' : 's'}`;
  const group = status => x.rows.filter(r => r.status === status);
  const table = rows => `<table class="table xref-table">
    <thead><tr><th>${esc(x.model)} option</th><th>SMW200A</th></tr></thead>
    <tbody>${rows.map(r => `<tr>
      <td><div class="c-id">${esc(xrefCode(x.model, r.code))}${r.kit ? ' <small>kit</small>' : ''}</div>
        <div class="xref-what">${esc(r.name)}</div><div class="xref-page">${esc(r.page)}</div></td>
      <td>${r.ids.length ? `<span class="c-id">${esc(xrefTypes(r.ids))}</span>` : `<span class="xref-st ${esc(r.status)}">${esc(XREF_STATUS[r.status])}</span>`}
        ${r.gap ? `<div class="xref-gap">${esc(r.gap)}</div>` : r.note ? `<div class="xref-note">${esc(r.note)}</div>` : ''}</td>
    </tr>`).join('')}</tbody></table>`;
  out.innerHTML = `
    <div class="import-summary">Keysight ${esc(x.model)} ${x.inferred ? 'taken from its options' : 'recognised'} · ${plural(x.rows.length, 'option')} ·
      SMW200A equivalent: ${plural(n, 'option')}${x.qty > 1 ? ` · ${x.qty} instruments quoted, the equivalent is for one` : ''}</div>
    ${x.inferred ? '<p class="xref-lead">No model name was read; Option 602 or another vector-only option says this is an E8267D.</p>' : ''}
    ${alsoRs ? `<div class="import-switch">The document also lists R&amp;S options –
      <button class="btn-link" data-action="import-view" data-importview="rs">show them</button></div>` : ''}
    ${['covered', 'partial', 'standard', 'none', 'service'].map(s => group(s).length
      ? `<div class="group-head">${esc(XREF_STATUS[s])}</div>${table(group(s))}` : '').join('')}
    ${x.todo.length ? `<div class="xref-added">${esc(x.todo.map(e => e.title).join(' · '))} – the document names none.</div>` : ''}
    ${x.added.length ? `<div class="xref-added">Added by the SMW200A's own rules: ${esc(xrefTypes(x.added))}</div>` : ''}
    ${x.issues.length ? `<div class="import-unknown"><div class="group-head">Open issues in the equivalent</div>${
      x.issues.map(e => `<div class="import-unknown-line"><span>${esc(e.title)}</span><small>${esc(e.detail)}</small></div>`).join('')}</div>` : ''}
    ${x.unknown.length ? `<div class="import-unknown"><div class="group-head">Not in the cross-reference table</div>${
      x.unknown.map(c => `<div class="import-unknown-line"><span>${esc(c)}</span><small>no row for this code yet</small></div>`).join('')}</div>` : ''}
    <div class="xref-basis">${esc(x.base)}</div>`;
  load.disabled = merge.disabled = !n;
  load.innerHTML = `${icon('download', 15)} Load the SMW equivalent`;
  merge.textContent = 'Add the equivalent';
  note.textContent = n
    ? 'Load starts from the equivalent alone; Add keeps what is configured. Rows cite the Keysight page (CG configuration guide, DS data sheet) and the R&S specifications (SP).'
    : '';
}

function applyImport (mode) {
  if (imp.view === 'xref' && imp.xref?.model) { applyXref(mode); return; }
  const r = imp.result;
  if (!r?.items.length) return;
  const sel = mode === 'merge' ? { ...state.sel } : {};
  for (const it of r.items) sel[it.id] = mode === 'merge' ? Math.max(sel[it.id] || 0, it.qty) : it.qty;
  state.sel = sel;
  if (mode !== 'merge') {
    state.name = r.name ? `Quotation ${r.name}` : imp.file ? `Imported from ${imp.file.name}` : 'Imported configuration';
    state.xref = null;
  }
  const n = r.items.length;
  closeModal();
  afterChange();
  toast(`${mode === 'merge' ? 'Added' : 'Loaded'} ${n} option${n === 1 ? '' : 's'} from the document`);
}

/* Loads the SMW200A equivalent of a competitor's configuration, and keeps
   the cross-reference with it so the panel can show where each option came
   from. */
function applyXref (mode) {
  const x = imp.xref;
  const n = Object.keys(x.sel).length;
  if (!n) return;
  const sel = mode === 'merge' ? { ...state.sel } : {};
  for (const [id, q] of Object.entries(x.sel)) sel[id] = Math.max(sel[id] || 0, q);
  state.sel = sel;
  state.xref = { vendor: x.vendor, model: x.model, codes: x.codes, name: x.name, when: new Date().toISOString() };
  if (mode !== 'merge') state.name = xrefName(x);
  state.tab = 'xref';
  closeModal();
  afterChange();
  toast(`${mode === 'merge' ? 'Added' : 'Loaded'} the SMW200A equivalent of a ${x.vendor} ${x.model}: ${n} option${n === 1 ? '' : 's'}`);
}

const importErrorText = code => ({
  cancelled: 'Stopped.',
  upstream_error: 'The connection to the AI broke off – try again.',
  session_expired: 'Your claude.ai session has expired – sign in again, then try again.',
  capability_removed: 'This viewer\'s AI could not be used from the page – Read the image instead.',
  images_unavailable: 'This viewer cannot send images to the AI – Read the image instead.',
  not_granted: 'Reading with AI was not allowed for this page.',
  sampling_disabled: 'AI is not available on this account.',
  rate_limited: 'Too many requests for now – try again in a little while.',
  image_rejected: 'That image could not be read – try a smaller or clearer one.',
  refused: 'The AI declined to read this document.',
  invalid_json: 'The AI answered, but not in a form that could be read – try again.',
  empty_completion: 'The AI returned nothing – try again.',
  prompt_too_large: 'The document is too large to send at once.'
})[code] || 'The document could not be read just now – try again.';

/* Asks the host's AI to read the page(s). Consent, cost and time are the
   viewer's, so this runs on the button alone, shows that it is working, and
   can be stopped. */
async function scanImport () {
  const host = imp.ai;
  const scan = $('#import-scan'), stop = $('#import-stop'), ocr = $('#import-ocr');
  if (!host || !scan || imp.busy) return;
  // busy from the first moment: preparing the pages already takes a while
  const ctl = new AbortController();
  imp.ctl = ctl;
  imp.busy = true;
  scan.disabled = true; if (ocr) ocr.disabled = true;
  stop.hidden = false;
  const idle = () => {
    if (imp.ctl === ctl) imp.ctl = null;
    imp.busy = false;
    scan.disabled = false; if (ocr) ocr.disabled = false;
    stop.hidden = true;
  };
  let images;
  try {
    if (imp.file?.type.startsWith('image/')) {
      images = [imp.file];
    } else {
      const max = imp.limits?.images?.maxCount || 1;
      const canvases = imp.pages.filter(p => p.canvas).map(p => p.canvas);
      images = await Promise.all(canvases.slice(0, max).map(c => canvasToBlob(c)));
      if (canvases.length > max) toast(`Only the first ${max} page${max === 1 ? '' : 's'} can be scanned at once`);
    }
  } catch { importStatus('The pages could not be prepared for scanning.'); idle(); return; }
  if (!images?.length || ctl.signal.aborted) { idle(); return; }

  importStatus('Reading the document… the AI looks at the page first, which can take up to a minute.');
  const opts = {
    images, signal: ctl.signal, modelTier: 'default',
    // nothing arrives while the AI thinks; once it writes, say so
    onText: ({ text }) => importStatus(`Reading the document… ${text.length} characters transcribed so far.`)
  };
  /* What the AI wrote, however it came: parsed by the host, parsed here
     when the host's sampler cannot, or as the raw reply when neither
     parses - the readers take text, so even prose with codes in it reads. */
  const settle = (items, raw) => {
    if (ctl.signal.aborted) return;
    const text = Array.isArray(items) ? aiText(items) : String(raw || '');
    const box = $('#import-text');
    if (box && text) box.value = text;             // so a misread code can be corrected and read again
    readImportText(text, 'AI');
    importStatus(importRead()
      ? (Array.isArray(items) ? 'Check the quantities before loading – a column can be misread.'
                              : 'The AI answered in prose; what could be read of it is in the box.')
      : 'The AI found no line item it could name. Its answer is in the box.');
  };
  try {
    let items;
    if (typeof host.json === 'function') {
      try {
        items = await host.json(aiPrompt(), opts);
      } catch (err) {
        if (err?.code === 'invalid_json' && err.text) { settle(parseAiJson(err.text), err.text); return; }
        if (err?.code !== 'capability_removed') throw err;
      }
    }
    if (items === undefined) {                    // an older viewer: the plain call, parsed here
      const { text } = await host(aiPrompt(), opts);
      items = parseAiJson(text);
      settle(items, text);
      return;
    }
    settle(items);
  } catch (err) {
    importStatus(importErrorText(err?.code));
    if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'images_unavailable'].includes(err?.code)) {
      imp.ai = null;
      imp.aiWhy = err.code === 'images_unavailable' ? 'this viewer cannot send images to the AI' : 'the AI is not available in this view';
      scan.hidden = true;
    }
  } finally {
    idle();
  }
}

/** "16 Sep 2026, 19:40" in the viewer's locale; the raw stamp if it does not parse. */
function when (iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso
    : d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** The count on the Saved button, and a word when the page could not keep a save. */
function renderSavedCount () {
  const el = $('#saved-count');
  if (el) el.textContent = saved.list.length;
  const e = saved.lastError;
  if (e && !e.shown) {
    e.shown = true;
    toast(e.what === 'subscribe' ? 'The page’s list could not be reached – using this browser’s'
      : e.what === 'remove' ? 'That could not be removed from the page – it may come back'
      : e.code === 'quota_exceeded' ? 'The page’s list is full – kept in this browser instead'
      : 'Could not keep that on the page – kept in this browser instead');
  }
}

/* A viewer that frames the page in a sandbox without the modal permission
   ignores window.print() outright, so the sandboxed host gets no Print
   button - the PDF the page writes itself is the way to paper there. */
const printable = () => !window.claude?.use;

function openExport () {
  const lines = bomLines(state.sel, BASE_UNIT);
  const v = cached.validation;
  const groups = [];
  for (const l of lines) {
    const last = groups[groups.length - 1];
    if (last && last.name === l.group) last.rows.push(l);
    else groups.push({ name: l.group, rows: [l] });
  }
  /* a configuration built from a competitor's: every SMW line says which
     of their options it answers, and their options are listed in full
     under the parts list with what the SMW200A makes of each */
  const x = state.xref ? xrefSummary(state.xref, state.sel, BASE_UNIT.id) : null;
  const cols = x ? 5 : 4;
  openModal(`
  <div class="modal ${x ? 'modal-wide' : ''}" role="dialog" aria-label="Parts list">
    <div class="modal-head">
      <div style="flex:1">
        <h2>${esc(state.name)}</h2>
        <p>${lines.length} line items ·${x ? ` the SMW200A equivalent of a ${esc(x.vendor)} ${esc(x.model)} with ${x.rows.length} option${x.rows.length === 1 ? '' : 's'}${x.name ? ` (quote ${esc(x.name)})` : ''} ·` : ''}
          ${v.errors.length ? `<span style="color:var(--error)">${v.errors.length} open issue${v.errors.length === 1 ? '' : 's'}</span>`
                            : '<span style="color:var(--ok)">validated against the configuration guide</span>'}</p>
      </div>
      <button class="btn btn-icon btn-ghost" data-close aria-label="Close">${icon('x', 16)}</button>
    </div>
    <div class="modal-body" style="padding:0">
      <table class="table">
        <thead><tr><th>Type</th><th>Designation</th>${x ? `<th>Answers ${esc(x.model)}</th>` : ''}<th>Order No.</th><th style="text-align:right">Qty</th></tr></thead>
        <tbody>
          ${groups.map(g => `
            <tr class="head-row"><td colspan="${cols}">${esc(g.name)}</td></tr>
            ${g.rows.map(r => `
              <tr>
                <td class="c-id">${esc(typeCol(r.id))}</td>
                <td>${esc(r.name)}</td>
                ${x ? `<td class="c-from">${esc(x.origin(r.id) || '—')}</td>` : ''}
                <td class="c-order">${esc(r.order)}</td>
                <td class="c-qty">${r.qty}</td>
              </tr>`).join('')}`).join('')}
        </tbody>
      </table>
      ${x ? `
      <table class="table export-xref">
        <thead><tr><th>${esc(x.model)} option requested</th><th>What it is</th><th>SMW200A answer</th></tr></thead>
        <tbody>
          <tr class="head-row"><td colspan="3">The ${esc(x.vendor)} ${esc(x.model)} as configured${x.name ? ` – quote ${esc(x.name)}` : ''}</td></tr>
          ${x.rows.map(r => `
            <tr class="${r.present === false ? 'gone' : ''}">
              <td class="c-id">${esc(xrefCode(x.model, r.code))}</td>
              <td>${esc(r.name)}<div class="xref-page">${esc(r.step)} · ${esc(r.page)}</div></td>
              <td>${r.ids.length ? `<span class="c-id">${esc(xrefTypes(r.ids))}</span>` : `<span class="xref-st ${esc(r.status)}">${esc(XREF_STATUS[r.status])}</span>`}${
                r.status === 'partial' && r.ids.length ? ` <span class="xref-st partial">– in part</span>` : ''}${
                r.present === false ? `<div class="xref-gap">${esc(r.missing.map(typeName).join(', '))} no longer in this configuration</div>` : ''}${
                r.gap ? `<div class="xref-gap">${esc(r.gap)}</div>` : r.note ? `<div class="xref-note">${esc(r.note)}</div>` : ''}</td>
            </tr>`).join('')}
        </tbody>
      </table>` : ''}
    </div>
    <div class="modal-foot">
      ${savingBlocked
        ? `<span class="export-note">Saving files is turned off in this view${printable()
            ? ` – print the list or copy the link instead.` : ` and it cannot print – copy the link instead.`}</span>`
        : !printable() ? '<span class="export-note">This view cannot print; the PDF is the parts list on paper.</span>' : ''}
      ${printable() ? `<button class="btn" data-action="print">${icon('print', 15)} Print</button>` : ''}
      ${savingBlocked ? '' : `<button class="btn" data-action="pdf">${icon('print', 15)} PDF</button>
      <button class="btn" data-action="json">${icon('copy', 15)} JSON</button>
      <button class="btn btn-primary" data-action="csv">${icon('download', 15)} CSV</button>`}
    </div>
  </div>`);
}

/* ---------------------------------------------------------------- saving */

/**
 * Some hosts sandbox the frame and hand saving to the platform instead of
 * letting the page start a download. Where that host exists we ask it; a
 * plain web server has no such host and the ordinary anchor works.
 * Resolved lazily, because the host answers well after the first render.
 */
let savePromise;
const saveHost = () => (savePromise ??= window.claude?.use?.('downloads') ?? Promise.resolve(null));

/** True when a host is present but refuses saving, so the buttons can say so. */
let savingBlocked = false;

async function download (filename, mime, text) {
  const host = await saveHost();
  if (host) {
    try {
      await host.save({ filename, data: text });
      toast(`Saved ${filename}`);
    } catch (err) {
      if (err?.code === 'declined') return;                     // the viewer said no
      if (err?.code === 'rate_limited') { toast('One save at a time – try again in a moment'); return; }
      toast(`${filename} could not be saved here`);
    }
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(`${filename} downloaded`);
}

/* The tables carry the order number in a column of their own, so an accessory
   R&S lists by order number alone gets an empty Type cell there rather than
   the number twice - which is how the vendor's own parts list reads. */
const typeCol = id => (BY_ID[id]?.code === null ? '' : typeName(id));

const slug = () => state.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'smw200a';

function downloadCsv () {
  const rows = [['Type', 'Designation', 'Order No.', 'Quantity', ...(state.xref ? ['Mapped from'] : [])]];
  for (const l of bomLines(state.sel, BASE_UNIT)) {
    rows.push([typeCol(l.id), l.name, l.order, l.qty, ...(state.xref ? [mappedFrom(state.xref, l.id).join('; ')] : [])]);
  }
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  download(`${slug()}.csv`, 'text/csv;charset=utf-8', '﻿' + csv);
}

function downloadPdf () {
  const lines = bomLines(state.sel, BASE_UNIT);
  const v = validate(state.sel);
  const x = state.xref ? xrefSummary(state.xref, state.sel, BASE_UNIT.id) : null;
  const groups = [];
  for (const l of lines) {
    const last = groups[groups.length - 1];
    const from = x ? x.origin(l.id) : '';
    const row = { type: typeCol(l.id) || l.order, name: from ? `${l.name} – ${/^[A-Z0-9]/.test(from) ? 'answers ' : ''}${from}` : l.name, order: l.order, qty: l.qty };
    if (last && last.name === l.group) last.rows.push(row);
    else groups.push({ name: l.group, rows: [row] });
  }
  const pdf = partsListPdf({
    title: state.name,
    subtitle: `${lines.length} line items · ${v.errors.length
      ? `${v.errors.length} open issue${v.errors.length === 1 ? '' : 's'}`
      : 'validated against the configuration guide'} · ${new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`,
    groups,
    sections: xrefSections(),
    footer: `Unofficial planning aid built from ${GUIDE.title}, ${GUIDE.version}. Not a quotation – confirm any configuration with Rohde & Schwarz before ordering.`
  });
  download(`${slug()}.pdf`, 'application/pdf', pdf);
}

/** The competitor's options as text lines for the PDF, after the parts list. */
function xrefSections () {
  if (!state.xref) return [];
  const rows = xrefRows(state.xref, state.sel);
  return [{
    title: `${state.xref.vendor} ${state.xref.model} options requested${state.xref.name ? ` (quote ${state.xref.name})` : ''} and the SMW200A answer`,
    lines: rows.map(r => `${xrefCode(state.xref.model, r.code)}  ${r.name} -> ${r.ids.length ? xrefTypes(r.ids) : XREF_STATUS[r.status]}${
      r.status === 'partial' && r.ids.length ? ' (in part)' : ''}${r.present === false ? ' (no longer in this configuration)' : ''}${
      r.gap ? `. ${r.gap}` : ''}`)
  }];
}

function downloadJson () {
  const v = validate(state.sel);
  const payload = {
    name: state.name,
    generatedAt: new Date().toISOString(),
    source: `${GUIDE.title}, ${GUIDE.version} (${GUIDE.pd})`,
    valid: v.ok,
    issues: v.errors.map(e => ({ title: e.title, detail: e.detail })),
    items: bomLines(state.sel, BASE_UNIT).map(l => ({
      type: typeCol(l.id), designation: l.name, orderNo: l.order, quantity: l.qty, group: l.group
    })),
    capabilities: derive(state.sel),
    crossref: state.xref ? {
      vendor: state.xref.vendor, model: state.xref.model, quote: state.xref.name,
      options: xrefRows(state.xref, state.sel).map(r => ({
        code: xrefCode(state.xref.model, r.code), name: r.name, status: r.status,
        smw: r.ids.map(typeName), inConfiguration: r.present
      }))
    } : null,
    link: location.origin + location.pathname + encode()
  };
  download(`${slug()}.json`, 'application/json', JSON.stringify(payload, (k, val) =>
    (k === 'freqA' || k === 'freqB' ? (val && val.id) || null : val), 2));
}

/* ============================== boot ==================================== */

function applyTheme () {
  document.documentElement.dataset.theme = state.theme;
  const btn = $('#theme-btn');
  if (btn) btn.innerHTML = icon(state.theme === 'dark' ? 'sun' : 'moon', 15);
}

function openPanel () {
  state.panelOpen = true;
  $('#panel').classList.add('open');
  // the toggle moves clear of the panel's own Export button while it is open
  document.body.classList.add('panel-open');
}
function closePanel () {
  state.panelOpen = false;
  $('#panel').classList.remove('open');
  document.body.classList.remove('panel-open');
}

export function boot (profile) {
  useInstrument(profile);
  state.view = store.get(inst().storage.view) === 'schematic' ? 'schematic' : 'photo';
  // a host that sandboxes the frame is the only case where this matters
  if (window.claude?.use) {
    saveHost().then(host => { savingBlocked = !host; }).catch(() => { savingBlocked = true; });
  }
  WIDE.addEventListener('change', render);

  let resizeTimer;
  let drawnAt = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      // only the rear panel is sized to its container; the front has fixed
      // proportions, so comparing its viewBox with the width would always differ
      const want = panelWidth();
      if (Math.abs(want - drawnAt) > 40) { drawnAt = want; render(); }
    }, 180);
  });
  drawnAt = panelWidth();

  // the count belongs to the catalog, not to a number typed into the markup
  const search = $('#search');
  if (search) search.placeholder = `Search ${OPTIONS.length} options — press /`;

  load();
  syncAuto();
  applyTheme();
  render();
  watchScroll();

  /* The saved list: this browser's copy now, the page's own copy once the
     host answers - or never, on a static server, which is fine. */
  saved.load();
  saved.onChange(renderSavedCount);
  renderSavedCount();
  saved.connect(window.claude?.use?.('db') ?? Promise.resolve(null));
  // a save or removal in another tab of this browser
  window.addEventListener('storage', e => {
    if (e.key === savedKey()) { saved.load(); renderSavedCount(); if ($('.saved-list, .saved-empty')) openSaved(); }
  });
  window.addEventListener('hashchange', () => {
    const { sel, name } = decode(location.hash);
    if (Object.keys(sel).length) { state.sel = sel; state.name = name; state.xref = null; render(); }
  });
}
