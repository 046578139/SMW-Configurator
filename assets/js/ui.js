/** Icon set and stateless render helpers. */

import { BY_ID } from './catalog.js';
import { esc, productCode } from './util.js';
import { holds, evaluate, parse, needText, qtyChoices, maxQty } from './rules.js';

const P = {
  wave:    '<path d="M2 12c2 0 2-7 4-7s2 14 4 14 2-7 4-7 2 7 4 7 2-7 4-7"/>',
  chip:    '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
  split:   '<path d="M3 12h5l4-6h9M12 18h9M8 12l4 6"/><circle cx="21" cy="6" r="1.6"/><circle cx="21" cy="18" r="1.6"/>',
  noise:   '<path d="M2 16l3-6 2 4 3-9 2.5 12L15 8l2 6 2-3h3"/>',
  plus:    '<path d="M12 5v14M5 12h14"/>',
  stack:   '<path d="M12 2l9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  radio:   '<circle cx="12" cy="12" r="2"/><path d="M4.9 19.1a10 10 0 010-14.2M19.1 4.9a10 10 0 010 14.2M7.8 16.2a6 6 0 010-8.4M16.2 7.8a6 6 0 010 8.4"/>',
  pc:      '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  pulse:   '<path d="M2 12h4l2-7 3 14 2-9 2 4h7"/>',
  mimo:    '<circle cx="5" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="19" cy="18" r="2"/><path d="M7 6h10M7 18h10M6.5 7.7l11 8.6M6.5 16.3l11-8.6"/>',
  panel:   '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9h6M6 13h4"/><circle cx="18" cy="12" r="2"/>',
  box:     '<path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8"/>',
  sat:     '<path d="M13 21a9 9 0 01-9-9M17 21A13 13 0 004 8"/><circle cx="6" cy="19" r="1.6"/><path d="M14.5 3.5l6 6-3.5 3.5-6-6z"/><path d="M11 7l-3 3M17 13l-3 3"/>',
  wifi:    '<path d="M2 8.8a16 16 0 0120 0M5 12.5a11 11 0 0114 0M8.5 16.2a6 6 0 017 0"/><circle cx="12" cy="20" r="1"/>',
  check:   '<path d="M20 6L9 17l-5-5"/>',
  alert:   '<path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z"/>',
  info:    '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  shield:  '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
  search:  '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  trash:   '<path d="M4 7h16M10 4h4M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  download:'<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  share:   '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
  refresh: '<path d="M3 12a9 9 0 0115-6.7L21 8M21 3v5h-5M21 12a9 9 0 01-15 6.7L3 16M3 21v-5h5"/>',
  sun:     '<circle cx="12" cy="12" r="4"/><path d="M12 1v3M12 20v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M1 12h3M20 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  moon:    '<path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/>',
  x:       '<path d="M18 6L6 18M6 6l12 12"/>',
  minus:   '<path d="M5 12h14"/>',
  sparkle: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z"/>',
  wand:    '<path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8l1.4 1.4M17.8 6.2l1.4-1.4M3 21l9-9M12.2 6.2l-1.4-1.4"/>',
  list:    '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  print:   '<path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  copy:    '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>',
  gauge:   '<path d="M12 21a9 9 0 100-18 9 9 0 000 18z"/><path d="M12 12l4-4"/>',
  chevron: '<path d="M9 18l6-6-6-6"/>'
};

export const icon = (name, size = 16) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor"
    stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${P[name] || P.chip}</svg>`;

export { esc };

/** "R&S®SMW-K144" with the ® rendered small. */
const fullId = id => {
  const code = esc(productCode(id));
  // B1044O / B1056N and friends: highlight the trailing letter so it cannot be
  // mistaken for a digit when someone copies an order code.
  const m = code.match(/^(B\d+)([A-Z]+)$/);
  return `R&amp;S®SMW-${m ? `${m[1]}<span class="opt-suffix">${m[2]}</span>` : code}`;
};

/* ------------------------------------------------------------------ cards */

export function optionCard (opt, sel, opts = {}) {
  const qty = sel[opt.id] || 0;
  const on = qty > 0;
  const met = holds(opt.requires, sel);
  const choices = qtyChoices(opt, sel);
  const cap = maxQty(opt, sel);
  const showQty = (opt.max > 1 || opt.qtySteps) && on;
  const invalid = on && (!met || qty > cap || (opt.qtySteps && !opt.qtySteps.includes(qty)));

  const chips = [];
  if (opt.requires) {
    const res = evaluate(parse(opt.requires), sel);
    chips.push(res.ok
      ? `<span class="chip met">${icon('check', 11)} prerequisites met</span>`
      : `<span class="chip unmet">${icon('alert', 11)} needs ${esc(res.need.map(needText).join(' + ')).replace(/R&amp;S®SMW-/g, '')}</span>`);
  }
  if (opt.floating) chips.push('<span class="chip float">floating license</span>');
  if (opt.since === 'specs') chips.push('<span class="chip new">newer than guide v06.00</span>');
  if (opt.since === 'vendor') chips.push('<span class="chip new">from the R&amp;S online configurator, not in guide v06.00</span>');
  if (opt.max > 1 || opt.qtySteps) {
    chips.push(`<span class="chip">up to ${opt.qtySteps ? opt.qtySteps[opt.qtySteps.length - 1] : opt.max} ×</span>`);
  }

  return `
<div class="card ${on ? 'on' : 'off'} ${invalid ? 'invalid' : ''}" data-opt="${esc(opt.id)}">
  <button class="tick ${opts.round ? 'round' : ''}" data-toggle="${esc(opt.id)}"
    aria-pressed="${on}" aria-label="${on ? 'Remove' : 'Add'} ${esc(opt.id)}">${icon('check', 13)}</button>
  <div class="card-body" data-toggle="${esc(opt.id)}">
    <div class="card-top">
      <span class="opt-id">${fullId(opt.id)}</span>
      <span class="opt-kind ${opt.id.startsWith('B') ? 'hw' : 'sw'}">${opt.id.startsWith('B') ? 'hardware' : 'software'}</span>
    </div>
    <p class="opt-name">${esc(opt.name)}</p>
    ${opt.note ? `<p class="opt-note">${esc(opt.note)}</p>` : ''}
    <div class="opt-meta">
      <span class="opt-order">${esc(opt.order)}</span>
      ${chips.join('')}
    </div>
  </div>
  ${showQty ? qtyStepper(opt, qty, choices) : ''}
</div>`;
}

function qtyStepper (opt, qty, choices) {
  const idx = choices.indexOf(qty);
  const canDown = qty > choices[0] || qty > 0;
  const canUp = idx > -1 && idx < choices.length - 1;
  return `
  <div class="qty">
    <button data-step="${esc(opt.id)}:down" ${canDown ? '' : 'disabled'} aria-label="Fewer">${icon('minus', 12)}</button>
    <span>${qty}</span>
    <button data-step="${esc(opt.id)}:up" ${canUp ? '' : 'disabled'} aria-label="More">${icon('plus', 12)}</button>
  </div>`;
}

/** Frequency options get a card that shows the range on a bar. */
export function freqCard (opt, sel, maxGhz = 67) {
  const on = !!sel[opt.id];
  const pct = Math.max(4, (Math.log10(opt.meta.fMax) + 1) / (Math.log10(maxGhz) + 1) * 100);
  return `
<div class="card freq-card ${on ? 'on' : 'off'}" data-opt="${esc(opt.id)}" data-toggle="${esc(opt.id)}">
  <div class="freq-top">
    <div>
      <div class="freq-val">${opt.meta.fMax}<small>GHz</small></div>
      <div class="opt-id" style="margin-top:2px">${fullId(opt.id)}</div>
    </div>
    <button class="tick round" data-toggle="${esc(opt.id)}" aria-pressed="${on}"
      aria-label="Select ${esc(opt.id)}">${icon('check', 13)}</button>
  </div>
  <div class="freq-bar"><div class="freq-fill" style="width:${pct.toFixed(1)}%"></div></div>
  <div class="opt-meta">
    <span class="opt-order">${esc(opt.order)}</span>
  </div>
  ${opt.note ? `<div class="freq-foot">${esc(opt.note)}</div>` : ''}
</div>`;
}

/* ----------------------------------------------------------------- issues */

export function issueItem (issue, kind) {
  const glyph = kind === 'error' ? 'alert' : kind === 'warning' ? 'alert' : 'info';
  const actions = [];
  if (issue.fix?.length) {
    actions.push(`<button class="mini go" data-fix="${esc(issue.fix.join(','))}"
      data-fixqty="${esc(JSON.stringify(issue.fixQty || {}))}">Add ${issue.fix.map(f => f).join(', ')}</button>`);
  }
  if (issue.swap) {
    const [from, to] = issue.swap;
    actions.push(`<button class="mini mini-go" data-swap="${esc(from)},${esc(to)}"
      >Use ${esc(to)} instead of ${esc(from)}</button>`);
  }
  if (issue.drop?.length) {
    actions.push(`<button class="mini" data-drop="${esc(issue.drop.join(','))}">Remove ${issue.drop.join(', ')}</button>`);
  }
  if (issue.setQty) {
    actions.push(`<button class="mini" data-setqty="${esc(issue.setQty.join(':'))}">Set to ${issue.setQty[1]}</button>`);
  }
  if (issue.section) {
    actions.push(`<button class="mini" data-goto="${esc(issue.section)}">Go to section</button>`);
  }
  return `
<div class="issue ${kind}">
  <div class="issue-title">${icon(glyph, 14)}<span>${esc(issue.title)}</span></div>
  <div class="issue-detail">${issue.detail}</div>
  ${actions.length ? `<div class="issue-actions">${actions.join('')}</div>` : ''}
</div>`;
}

/* -------------------------------------------------------------------- BOM */

/** Groups the selection into ordering-information style blocks. */
export function bomLines (sel, base) {
  const lines = [{ id: base.id, name: base.name, order: base.order, qty: 1, group: 'Base unit' }];
  const order = ['rf-a', 'baseband', 'rf-b', 'phase', 'rf-enh', 'bb-hw', 'bb-enh',
    'fading', 'std-int', 'std-wiq', 'pulse', 'other'];
  const seen = Object.keys(sel).filter(id => sel[id] > 0 && BY_ID[id]);
  seen.sort((a, b) => {
    const oa = order.indexOf(BY_ID[a].section), ob = order.indexOf(BY_ID[b].section);
    if (oa !== ob) return oa - ob;
    return BY_ID[a].group.localeCompare(BY_ID[b].group) || a.localeCompare(b, undefined, { numeric: true });
  });
  for (const id of seen) {
    const o = BY_ID[id];
    lines.push({ id, name: o.name, order: o.order, qty: sel[id], group: o.group, step: o.step });
  }
  return lines;
}

export function bomPane (sel, base) {
  const lines = bomLines(sel, base);
  const groups = [];
  for (const l of lines) {
    const last = groups[groups.length - 1];
    if (last && last.name === l.group) last.rows.push(l);
    else groups.push({ name: l.group, rows: [l] });
  }
  const items = lines.reduce((n, l) => n + l.qty, 0);
  return `
  ${groups.map(g => `
    <div class="bom-group">
      <div class="bom-group-title">${esc(g.name)}</div>
      ${g.rows.map(r => `
        <div class="bom-row">
          <div>
            <div class="bom-id">${fullId(r.id)}</div>
            <div class="bom-name">${esc(r.name)}</div>
            <div class="bom-order">${esc(r.order)}</div>
          </div>
          <div class="bom-qty">×${r.qty}</div>
        </div>`).join('')}
    </div>`).join('')}
  <div class="bom-total">
    <span>${lines.length} line items</span>
    <strong>${items} units</strong>
  </div>`;
}
