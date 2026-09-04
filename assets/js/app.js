/** Application state, rendering and event wiring. */

import { OPTIONS, BY_ID, SECTIONS, EXTRAS, BASE_UNIT, GUIDE, PHASE_NOISE_LEVELS, RF_PATH_MATRIX }
  from './catalog.js';
import { validate, autoResolve, holds, qtyChoices, maxQty, freqA, freqB, mainModule } from './rules.js';
import { derive, vitals } from './derive.js';
import { renderChain, renderRuler } from './diagram.js';
import { renderFront, renderRear, connectorNotes, faceCounts } from './panel.js';
import { renderPhoto } from './photo.js';
import { icon, esc, optionCard, freqCard, issueItem, bomPane, bomLines } from './ui.js';
import { PRESETS } from './presets.js';
import { productCode } from './util.js';

const STORE = 'smw200a-config-v1';

/* Storage is a convenience, never a requirement: private windows, sandboxed
   frames and browsers with site data blocked all make these calls throw. */
const store = {
  get (key) { try { return localStorage.getItem(key); } catch { return null; } },
  set (key, value) { try { localStorage.setItem(key, value); } catch { /* not available */ } }
};

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
  view: store.get('smw-view') === 'schematic' ? 'schematic' : 'photo',
  panelOpen: false
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ============================== persistence ============================== */

const encode = () => {
  const opts = Object.entries(state.sel).filter(([, q]) => q > 0)
    .map(([id, q]) => (q > 1 ? `${id}*${q}` : id)).join('.');
  return `#c=${encodeURIComponent(opts)}&n=${encodeURIComponent(state.name)}`;
};

function decode (hash) {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const sel = {};
  for (const token of (params.get('c') || '').split('.')) {
    if (!token) continue;
    const [id, qty] = token.split('*');
    if (BY_ID[id]) sel[id] = Math.max(1, parseInt(qty || '1', 10) || 1);
  }
  return { sel, name: params.get('n') || 'Untitled configuration' };
}

function save () {
  store.set(STORE, JSON.stringify({ sel: state.sel, name: state.name }));
  try { history.replaceState(null, '', encode()); } catch { /* sandboxed frame */ }
}

function load () {
  if (location.hash.includes('c=')) {
    const { sel, name } = decode(location.hash);
    if (Object.keys(sel).length) { state.sel = sel; state.name = name; return; }
  }
  try {
    const saved = JSON.parse(store.get(STORE) || 'null');
    if (saved?.sel) { state.sel = saved.sel; state.name = saved.name || state.name; }
  } catch { /* ignore malformed storage */ }
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
  else if (sec.id === 'extras') body = renderExtras();
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

function renderGrouped (opts) {
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
  for (const g of groups) g.items.sort(byCode);
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
  const chassis = state.sel.B94L
    ? `<div class="issue info"><div class="issue-title">${icon('info', 14)}<span>Deeper chassis added automatically</span></div>
       <div class="issue-detail">This RF path combination requires R&amp;S®SMW-B94L (1438.8150.02); it is
       included in the parts list.</div></div>` : '';
  return `
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

function renderExtras () {
  return EXTRAS.map(g => `
    <div class="group-head">${esc(g.group)}</div>
    <div class="cards">${g.items.map(it => {
      const suggested = it.hintIf && holds(it.hintIf, state.sel);
      return `
      <div class="card off" style="cursor:default">
        <span class="tick" style="visibility:hidden"></span>
        <div class="card-body">
          <div class="card-top"><span class="opt-id">${esc(it.id)}</span>
            ${suggested ? '<span class="chip met">suggested for this configuration</span>' : ''}</div>
          <p class="opt-name">${esc(it.name)}</p>
          ${it.note ? `<p class="opt-note">${esc(it.note)}</p>` : ''}
          <div class="opt-meta"><span class="opt-order">${esc(it.order)}</span></div>
        </div>
      </div>`;
    }).join('')}</div>`).join('');
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

  const tabs = [
    ['overview', 'Overview', 0],
    ['chain', 'Chain', 0],
    ['checks', 'Checks', issues],
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
  if (!freqA(state.sel) || !mainModule(state.sel)) {
    chip.className = 'chip unmet';
    chip.innerHTML = `${icon('alert', 11)} incomplete`;
  } else if (st.errors.length) {
    chip.className = 'chip unmet';
    chip.innerHTML = `${icon('alert', 11)} ${st.errors.length} issue${st.errors.length === 1 ? '' : 's'}`;
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
  const t = ev.target.closest('[data-toggle],[data-step],[data-level],[data-goto],[data-tab],[data-action],[data-fix],[data-drop],[data-setqty],[data-preset],[data-close],[data-face],[data-swap],[data-view]');
  if (!t) return;

  if (t.dataset.view) {
    state.view = t.dataset.view;
    store.set('smw-view', state.view);
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
      closeModal();
      afterChange();
      toast(`Loaded “${p.name}”`);
    }
    return;
  }
  if (t.dataset.close !== undefined) { closeModal(); return; }

  const action = t.dataset.action;
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
});

document.addEventListener('change', ev => {
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
  if (ev.key === '/' && document.activeElement.tagName !== 'INPUT') {
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

function openExport () {
  const lines = bomLines(state.sel, BASE_UNIT);
  const v = cached.validation;
  const groups = [];
  for (const l of lines) {
    const last = groups[groups.length - 1];
    if (last && last.name === l.group) last.rows.push(l);
    else groups.push({ name: l.group, rows: [l] });
  }
  openModal(`
  <div class="modal" role="dialog" aria-label="Parts list">
    <div class="modal-head">
      <div style="flex:1">
        <h2>${esc(state.name)}</h2>
        <p>${lines.length} line items ·
          ${v.errors.length ? `<span style="color:var(--error)">${v.errors.length} open issue${v.errors.length === 1 ? '' : 's'}</span>`
                            : '<span style="color:var(--ok)">validated against the configuration guide</span>'}</p>
      </div>
      <button class="btn btn-icon btn-ghost" data-close aria-label="Close">${icon('x', 16)}</button>
    </div>
    <div class="modal-body" style="padding:0">
      <table class="table">
        <thead><tr><th>Type</th><th>Designation</th><th>Order No.</th><th style="text-align:right">Qty</th></tr></thead>
        <tbody>
          ${groups.map(g => `
            <tr class="head-row"><td colspan="4">${esc(g.name)}</td></tr>
            ${g.rows.map(r => `
              <tr>
                <td class="c-id">${r.id === BASE_UNIT.id ? 'R&amp;S®SMW200A' : `R&amp;S®SMW-${esc(productCode(r.id))}`}</td>
                <td>${esc(r.name)}</td>
                <td class="c-order">${esc(r.order)}</td>
                <td class="c-qty">${r.qty}</td>
              </tr>`).join('')}`).join('')}
        </tbody>
      </table>
    </div>
    <div class="modal-foot">
      ${savingBlocked
        ? `<span style="flex:1;font-size:11.5px;color:var(--text-faint);align-self:center">
             Saving files is turned off in this view – print the list or copy the link instead.</span>`
        : ''}
      <button class="btn" data-action="print">${icon('print', 15)} Print</button>
      ${savingBlocked ? '' : `<button class="btn" data-action="json">${icon('copy', 15)} JSON</button>
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

const slug = () => state.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'smw200a';

function downloadCsv () {
  const rows = [['Type', 'Designation', 'Order No.', 'Quantity']];
  for (const l of bomLines(state.sel, BASE_UNIT)) {
    rows.push([l.id === BASE_UNIT.id ? 'R&S®SMW200A' : `R&S®SMW-${productCode(l.id)}`,
      l.name, l.order, l.qty]);
  }
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  download(`${slug()}.csv`, 'text/csv;charset=utf-8', '﻿' + csv);
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
      type: l.id === BASE_UNIT.id ? 'R&S®SMW200A' : `R&S®SMW-${productCode(l.id)}`,
      designation: l.name, orderNo: l.order, quantity: l.qty, group: l.group
    })),
    capabilities: derive(state.sel),
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

export function boot () {
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
  window.addEventListener('hashchange', () => {
    const { sel, name } = decode(location.hash);
    if (Object.keys(sel).length) { state.sel = sel; state.name = name; render(); }
  });
}
