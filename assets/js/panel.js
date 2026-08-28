/**
 * Front and rear panel elevations that follow the configuration.
 *
 * The connector inventory and the connector types come from the specifications;
 * which face a connector sits on comes from the configuration, because the
 * B81 to B84 options move the RF outputs from the front panel to the rear and
 * every baseband generator or fading simulator module brings its own block of
 * rear panel connectors. Positions are schematic: the specifications list what
 * is fitted, not where it sits on the panel.
 */

import { esc } from './util.js';
import { FRONT_PANEL, REAR_PANEL, MODULE_PANELS, CONNECTOR_NOTE } from './catalog.js';
import { screenContent } from './diagram.js';

/* ------------------------------------------------------------ glyphs */

/**
 * Slot the drawing reserves for one connector. The width follows the longest
 * label in a group, because the digital connectors carry names several times
 * the length of a BNC's and a fixed slot runs them into each other.
 */
const SLOT = { w: 62, h: 34 };
const CHAR_W = 4.15;   // width of one character at the 6.6px label size

const slotWidth = items =>
  Math.max(SLOT.w, ...items.map(i => i.label.length * CHAR_W + 12));

/** Group titles are set in the box above the connectors and must not run past it. */
const TITLE_CHAR_W = 4.6;
function fitTitle (text, boxW) {
  const room = Math.floor((boxW - 14) / TITLE_CHAR_W);
  return text.length <= room ? text : `${text.slice(0, Math.max(1, room - 1)).trimEnd()}…`;
}

/**
 * One connector, drawn to suit its type so the panel can be read by shape:
 * threaded RF and SMA, bayonet BNC, and the rectangular digital housings.
 */
function connector (x, y, w, item, colour) {
  const cx = x + w / 2;
  const cy = y + 11;
  const c = colour || 'var(--text-dim)';
  const shell = `stroke="${c}" fill="#0d1520"`;

  let glyph;
  switch (item.kind) {
    case 'rf':
      glyph = `<circle cx="${cx}" cy="${cy}" r="9.5" ${shell} stroke-width="1.5"/>
        <circle cx="${cx}" cy="${cy}" r="5" fill="#060b12" stroke="${c}" stroke-opacity=".6" stroke-width=".8"/>
        <circle cx="${cx}" cy="${cy}" r="1.6" fill="${c}"/>`;
      break;
    case 'sma':
      glyph = `<circle cx="${cx}" cy="${cy}" r="6.5" ${shell} stroke-width="1.2"/>
        <circle cx="${cx}" cy="${cy}" r="1.3" fill="${c}"/>`;
      break;
    case 'bnc':
      glyph = `<circle cx="${cx}" cy="${cy}" r="7.5" ${shell} stroke-width="1.1"/>
        <circle cx="${cx}" cy="${cy}" r="1.5" fill="${c}"/>
        <path d="M${cx - 7.5} ${cy - 2.5}v-2M${cx + 7.5} ${cy - 2.5}v-2"
          stroke="${c}" stroke-width="1.4" stroke-linecap="round"/>`;
      break;
    case 'odu':
      glyph = `<circle cx="${cx}" cy="${cy}" r="7" ${shell} stroke-width="1.1"/>
        ${[0, 60, 120, 180, 240, 300].map(a => {
          const r = (a * Math.PI) / 180;
          return `<circle cx="${(cx + Math.cos(r) * 3.2).toFixed(1)}" cy="${(cy + Math.sin(r) * 3.2).toFixed(1)}" r="0.9" fill="${c}"/>`;
        }).join('')}`;
      break;
    case 'mdr':
      glyph = `<rect x="${cx - 13}" y="${cy - 4.5}" width="26" height="9" rx="2" ${shell} stroke-width="1.1"/>
        <rect x="${cx - 9.5}" y="${cy - 1.8}" width="19" height="3.6" rx="1" fill="#060b12" stroke="${c}" stroke-opacity=".5" stroke-width=".6"/>`;
      break;
    case 'qsfp':
      glyph = `<rect x="${cx - 14}" y="${cy - 5.5}" width="28" height="11" rx="1.5" ${shell} stroke-width="1.3"/>
        <rect x="${cx - 10.5}" y="${cy - 2.6}" width="21" height="5.2" rx="1" fill="#060b12" stroke="${c}" stroke-opacity=".55" stroke-width=".6"/>
        <circle cx="${cx + 16}" cy="${cy}" r="1.4" fill="${c}"/>`;
      break;
    case 'rj45':
      glyph = `<path d="M${cx - 8} ${cy - 5}h16v10h-16z M${cx - 3} ${cy + 5}v2.5h6v-2.5"
          ${shell} stroke-width="1.1" stroke-linejoin="round"/>`;
      break;
    case 'usb':
      glyph = `<rect x="${cx - 9}" y="${cy - 4}" width="18" height="8" rx="1" ${shell} stroke-width="1.1"/>
        <rect x="${cx - 6}" y="${cy - 1.5}" width="12" height="3" fill="${c}" fill-opacity=".35"/>`;
      break;
    case 'gpib':
      glyph = `<path d="M${cx - 17} ${cy - 4.5}h34l-2.5 9h-29z" ${shell} stroke-width="1.1" stroke-linejoin="round"/>`;
      break;
    default: // video and anything else rectangular
      glyph = `<rect x="${cx - 10}" y="${cy - 4}" width="20" height="8" rx="1.5" ${shell} stroke-width="1.1"/>`;
  }

  return `<g>
    ${glyph}
    <text x="${cx}" y="${y + 27}" font-size="6.6" fill="${c}" text-anchor="middle"
      font-family="ui-monospace,monospace" letter-spacing=".04em">${esc(item.label)}</text>
    ${item.sub ? `<text x="${cx}" y="${y + 33.5}" font-size="5.6" fill="var(--text-faint)"
      text-anchor="middle" font-family="ui-monospace,monospace">${esc(item.sub)}</text>` : ''}
  </g>`;
}

/** Colour a connector by what it carries, so the faces read at a glance. */
function tint (item) {
  if (item.kind === 'rf') return item.path === 'B' ? 'var(--accent-2)' : 'var(--accent)';
  if (item.kind === 'qsfp' || item.kind === 'mdr') return 'var(--accent-2)';
  if (item.label.startsWith('I') || item.label.startsWith('Q')) return 'var(--accent-3)';
  return null;
}

/* ------------------------------------------------------------ layout */

/** Keeps the connectors a configuration actually fits. */
const present = (items, panel) => items.filter(i => !i.when || panel[i.when]);

/**
 * Packs group boxes into rows of a fixed width, two connectors deep, the way
 * the real panel packs them. Returns the markup and the height it consumed.
 */
function packGroups (groups, x0, y0, maxW) {
  const rows = [];
  let row = [], rowW = 0;

  for (const g of groups) {
    const slot = slotWidth(g.items);
    // as many columns as fit the row, then as many rows as the group needs
    const cols = Math.max(1, Math.min(Math.ceil(g.items.length / 2),
      Math.floor((maxW - 16) / slot)));
    const w = cols * slot + 16;
    if (rowW + w > maxW && row.length) { rows.push(row); row = []; rowW = 0; }
    row.push({ ...g, w, cols, slot });
    rowW += w;
  }
  if (row.length) rows.push(row);

  // spread any width left over in a row across its groups, so the blocks meet
  // edge to edge the way they do on the real panel instead of leaving gaps
  for (const r of rows) {
    const used = r.reduce((n, g) => n + g.w, 0);
    const spare = maxW - used;
    if (spare <= 0) continue;
    for (const g of r) {
      const share = spare * (g.w / used);
      g.slot += share / g.cols;
      g.w += share;
    }
  }

  const out = [];
  const rowH = r => SLOT.h * Math.max(...r.map(g => Math.ceil(g.items.length / g.cols))) + 22;
  let y = y0;

  rows.forEach(r => {
    const GROUP_H = rowH(r);
    let x = x0;
    for (const g of r) {
      out.push(`
        <rect x="${x}" y="${y}" width="${g.w - 8}" height="${GROUP_H}" rx="4"
          fill="#131c29" stroke="#2b3a51"/>
        <text x="${x + 7}" y="${y + 12}" font-size="6.4" fill="var(--text-faint)"
          letter-spacing=".1em" font-family="ui-monospace,monospace"
          >${esc(fitTitle(g.group.toUpperCase(), g.w - 8))}<title>${esc(g.group)}</title></text>`);
      g.items.forEach((it, i) => {
        const cx = x + 4 + (i % g.cols) * g.slot;
        const cy = y + 16 + Math.floor(i / g.cols) * SLOT.h;
        out.push(connector(cx, cy, g.slot, it, tint(it)));
      });
      x += g.w;
    }
    y += GROUP_H + 10;
  });

  return { markup: out.join(''), height: y - y0 };
}

/* ------------------------------------------------------------ faces */

const CHASSIS = `
  <defs>
    <linearGradient id="pcase" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2b3648"/><stop offset="1" stop-color="#1a2231"/>
    </linearGradient>
  </defs>`;

/** Rack ears, drawn so the two faces read as the same instrument. */
const ears = (h, W) => `
  <path d="M2 6h10v${h}H2z" fill="#243044" stroke="#3b4a63" stroke-width="1"/>
  <path d="M${W - 12} 6h10v${h}H${W - 12}z" fill="#243044" stroke="#3b4a63" stroke-width="1"/>
  <circle cx="7" cy="16" r="2" fill="#0d1520" stroke="#4d5f7d" stroke-width=".7"/>
  <circle cx="7" cy="${h - 4}" r="2" fill="#0d1520" stroke="#4d5f7d" stroke-width=".7"/>
  <circle cx="${W - 7}" cy="16" r="2" fill="#0d1520" stroke="#4d5f7d" stroke-width=".7"/>
  <circle cx="${W - 7}" cy="${h - 4}" r="2" fill="#0d1520" stroke="#4d5f7d" stroke-width=".7"/>`;

export function renderFront (d, sel, W = 812) {
  const p = d.panel;
  const live = d.generators > 0;
  const bodyH = 238;

  const scale = W / 812;
  const dispX = 26, dispY = 22, dispW = 330 * scale, dispH = 168;
  const keyX = dispX + dispW + 22, knobX = keyX + 42;

  // the keypad and the rotary control, fitted to every instrument
  const keys = [];
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      keys.push(`<rect x="${keyX + c * 21}" y="${58 + r * 19}" width="17" height="15" rx="2.5"
        fill="#1b2534" stroke="#33415a" stroke-width=".8"/>`);
    }
  }

  const groups = FRONT_PANEL
    .map(g => ({ ...g, items: present(g.items, p) }))
    .filter(g => g.items.length);
  const connX = knobX + 40;
  const packed = packGroups(groups, connX, 26, W - connX - 16);

  return `
<svg viewBox="0 0 ${W} ${bodyH + 16}" role="img"
  aria-label="Front panel of the configured R&S SMW200A">
  ${CHASSIS}
  <rect x="10" y="6" width="${W - 20}" height="${bodyH}" rx="7" fill="url(#pcase)" stroke="#3b4a63"/>
  ${ears(bodyH, W)}

  <rect x="${dispX}" y="${dispY}" width="${dispW}" height="${dispH}" rx="5"
    fill="#04090e" stroke="#16283a"/>
  ${screenContent(dispX, dispY, dispW, dispH, d, sel, live)}

  ${keys.join('')}
  <circle cx="${knobX}" cy="160" r="26" fill="#1b2534" stroke="#3d4d67" stroke-width="1.4"/>
  <circle cx="${knobX}" cy="160" r="19" fill="#151d29" stroke="#33415a"/>
  <circle cx="${knobX}" cy="145" r="2.4" fill="var(--text-faint)"/>

  ${packed.markup}

  <text x="26" y="${bodyH + 1}" font-size="7.5" fill="#5d6e88" letter-spacing=".16em"
    font-family="ui-monospace,monospace">R&amp;S SMW200A VECTOR SIGNAL GENERATOR</text>
  <text x="${W - 26}" y="${bodyH + 1}" font-size="7.5" fill="#5d6e88" text-anchor="end"
    letter-spacing=".1em" font-family="ui-monospace,monospace">FRONT${
      d.chassis === 'deep' ? ' · DEEPER CHASSIS' : ''}</text>
</svg>`;
}

export function renderRear (d, W = 812) {
  const p = d.panel;

  const groups = REAR_PANEL
    .map(g => ({ ...g, items: present(g.items, p) }))
    .filter(g => g.items.length);

  // one block per installed module, in the order the modules are fitted
  const moduleGroups = p.modules.map((kind, i) => ({
    group: `${MODULE_PANELS[kind].label} ${i + 1}`,
    items: MODULE_PANELS[kind].items
  }));

  const fixed = packGroups(groups, 22, 24, W - 44);
  const mods = packGroups(moduleGroups, 22, 24 + fixed.height + 14, W - 44);
  const bodyH = 24 + fixed.height + 14 + mods.height + 18;

  return `
<svg viewBox="0 0 ${W} ${bodyH + 16}" role="img"
  aria-label="Rear panel of the configured R&S SMW200A">
  ${CHASSIS}
  <rect x="10" y="6" width="${W - 20}" height="${bodyH}" rx="7" fill="url(#pcase)" stroke="#3b4a63"/>
  ${ears(bodyH, W)}
  ${fixed.markup}
  ${moduleGroups.length ? `<line x1="22" y1="${18 + fixed.height + 8}" x2="${W - 22}"
    y2="${18 + fixed.height + 8}" stroke="#2b3a51" stroke-dasharray="3 3"/>` : ''}
  ${mods.markup}
  <text x="26" y="${bodyH + 1}" font-size="7.5" fill="#5d6e88" letter-spacing=".16em"
    font-family="ui-monospace,monospace">${
      p.modules.length ? `${p.modules.length} MODULE BLOCK${p.modules.length === 1 ? '' : 'S'} FITTED`
        : 'NO BASEBAND MODULES'}</text>
  <text x="${W - 26}" y="${bodyH + 1}" font-size="7.5" fill="#5d6e88" text-anchor="end"
    letter-spacing=".1em" font-family="ui-monospace,monospace">REAR</text>
</svg>`;
}

/* --------------------------------------------------------- inventory */

/** The connector types a configuration ends up with, for the text summary. */
export function connectorNotes (d) {
  const p = d.panel;
  const out = [];
  if (p.connA) {
    out.push({
      label: `RF path A · ${p.rearRfA ? 'rear panel' : 'front panel'}`,
      value: p.connA,
      note: CONNECTOR_NOTE[p.connA] || ''
    });
  }
  if (p.connB) {
    out.push({
      label: `RF path B · ${p.rearRfB ? 'rear panel' : 'front panel'}`,
      value: p.connB,
      note: CONNECTOR_NOTE[p.connB] || ''
    });
  }
  return out;
}

/** Total connector count per face, which is what changes most visibly. */
export function faceCounts (d) {
  const p = d.panel;
  const tally = items => items.reduce((n, i) => n + (i.count || 1), 0);
  const count = groups => groups.reduce((n, g) => n + tally(present(g.items, p)), 0);
  const modules = p.modules.reduce((n, k) => n + tally(MODULE_PANELS[k].items), 0);
  return { front: count(FRONT_PANEL), rear: count(REAR_PANEL) + modules };
}
