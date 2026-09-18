/**
 * Front and rear panel elevations of the R&S FSW that follow the
 * configuration.
 *
 * The connector inventory and the connector types come from the
 * specifications (inputs and outputs, p32 to p34; the option sections, p37
 * to p41); which connectors are fitted comes from the model and the options.
 * Positions are schematic: the specifications list what is fitted, not
 * where it sits on the panel.
 */

import { esc } from '../util.js';
import { FRONT_PANEL, REAR_PANEL } from './catalog.js';

/* ------------------------------------------------------------ glyphs */

const KEY_FACE = '#d5dae1', KEY_EDGE = '#98a1ae', KEY_INK = '#28313f';
const CHASSIS = '#c9ced6', CHASSIS_EDGE = '#8d95a2';

const SLOT = { w: 58, h: 50 };
const CHAR_W = 4.15;

/** The connectors of a group that this configuration fits. */
const present = (items, p) => items.filter(i => !i.when || p[i.when]);

/** A label broken into at most two lines that fit the slot. */
function wrapLabel (label, maxChars) {
  if (label.length <= maxChars) return [label];
  const cut = label.lastIndexOf(' ', maxChars);
  if (cut < 1) return [label.slice(0, maxChars - 1) + '…'];
  const rest = label.slice(cut + 1);
  return [label.slice(0, cut), rest.length > maxChars ? rest.slice(0, maxChars - 1) + '…' : rest];
}

/** One connector, drawn to suit its type so the panel can be read by shape. */
function glyph (kind, cx, cy, colour) {
  const c = colour;
  const shell = `stroke="${c}" fill="#0d1520"`;
  switch (kind) {
    case 'rf':
      return `<circle cx="${cx}" cy="${cy}" r="13" ${shell} stroke-width="1.6"/>
        <circle cx="${cx}" cy="${cy}" r="6.5" fill="#060b12" stroke="${c}" stroke-opacity=".6" stroke-width=".8"/>
        <circle cx="${cx}" cy="${cy}" r="1.8" fill="${c}"/>`;
    case 'sma':
      return `<circle cx="${cx}" cy="${cy}" r="7" ${shell} stroke-width="1.2"/>
        <circle cx="${cx}" cy="${cy}" r="1.4" fill="${c}"/>`;
    case 'bnc':
      return `<circle cx="${cx}" cy="${cy}" r="8.5" ${shell} stroke-width="1.1"/>
        <circle cx="${cx}" cy="${cy}" r="1.6" fill="${c}"/>
        <path d="M${cx - 8.5} ${cy - 2.5}v-2.5M${cx + 8.5} ${cy - 2.5}v-2.5" stroke="${c}" stroke-width="1.2"/>`;
    case 'jack':
      return `<circle cx="${cx}" cy="${cy}" r="5.5" ${shell} stroke-width="1.1"/>
        <circle cx="${cx}" cy="${cy}" r="1.6" fill="${c}"/>`;
    case 'power':
      return `<rect x="${cx - 10}" y="${cy - 8}" width="20" height="16" rx="2" ${shell} stroke-width="1.1"/>
        <path d="M${cx - 4} ${cy - 3}v6M${cx + 4} ${cy - 3}v6M${cx} ${cy + 1}v3" stroke="${c}" stroke-width="1.4"/>`;
    default:
      return `<rect x="${cx - 13}" y="${cy - 6.5}" width="26" height="13" rx="2" ${shell} stroke-width="1.1"/>
        <path d="M${cx - 9} ${cy}h18" stroke="${c}" stroke-opacity=".5" stroke-width="1" stroke-dasharray="1.5 1.5"/>`;
  }
}

/** One slot: glyph(s) and label. Option-dependent connectors are drawn in the accent. */
function slot (x, y, item, w = SLOT.w) {
  const colour = item.when ? 'var(--accent)' : 'var(--text-dim)';
  const n = item.count || 1;
  const cx = x + w / 2;
  const glyphs = n === 1
    ? glyph(item.kind, cx, y + 17, colour)
    : Array.from({ length: n }, (_, i) => glyph(item.kind, cx - (n - 1) * 9 + i * 18, y + 17, colour)).join('');
  const lines = wrapLabel(n > 1 ? `${item.label} ×${n}` : item.label, Math.floor((w - 4) / CHAR_W));
  const text = lines.map((l, i) => `<text x="${cx}" y="${y + 38 + i * 7.5}" font-size="6.2" text-anchor="middle"
      fill="${colour}" font-family="ui-monospace,monospace">${esc(l)}</text>`).join('');
  return `<g><title>${esc(item.label)} – ${esc(item.type)}</title>${glyphs}${text}</g>`;
}

/** A titled group of slots laid out in rows of `perRow`. Returns markup and size. */
function group (x, y, title, items, perRow, slotW = SLOT.w) {
  if (!items.length) return { svg: '', w: 0, h: 0 };
  const cols = Math.min(perRow, items.length);
  const rows = Math.ceil(items.length / perRow);
  const w = cols * slotW + 12;
  const h = rows * SLOT.h + 20;
  const body = items.map((it, i) =>
    slot(x + 6 + (i % perRow) * slotW, y + 16 + Math.floor(i / perRow) * SLOT.h, it, slotW)).join('');
  const svg = `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="#0b1119" fill-opacity=".55"
      stroke="var(--line)" stroke-width=".8"/>
    <text x="${x + 6}" y="${y + 10}" font-size="6.4" letter-spacing=".08em" fill="var(--text-dim)"
      font-family="ui-monospace,monospace">${esc(title.toUpperCase())}</text>
    ${body}`;
  return { svg, w, h };
}

/* ------------------------------------------------------------- front */

const FW = 1000, FH = 410;

function key (x, y, w, h, label, size = 6.6) {
  const lines = label.split('\n');
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${KEY_FACE}" stroke="${KEY_EDGE}" stroke-width=".8"/>
    ${lines.map((l, i) => `<text x="${x + w / 2}" y="${y + h / 2 + 2.4 + (i - (lines.length - 1) / 2) * 7.5}" font-size="${size}"
      text-anchor="middle" fill="${KEY_INK}" font-family="ui-sans-serif,system-ui,sans-serif" font-weight="600">${esc(l)}</text>`).join('')}`;
}

/** A deterministic spectrum trace: one carrier whose width follows the analysis bandwidth. */
function trace (x, y, w, h, d) {
  let s = 2166136261;
  const seedStr = `${d.model?.id || ''}|${d.bandwidth}|${d.apps}`;
  for (let i = 0; i < seedStr.length; i++) { s ^= seedStr.charCodeAt(i); s = Math.imul(s, 16777619); }
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const N = 140;
  const frac = 0.08 + 0.3 * (Math.log10(Math.max(d.bandwidth, 28)) / Math.log10(8312));
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    let level = 0.14 + (rand() - 0.5) * 0.05;
    const dist = Math.abs(t - 0.5) / (frac / 2);
    if (dist < 1) {
      const shape = dist < 0.7 ? 1 : Math.cos(((dist - 0.7) / 0.3) * Math.PI / 2) ** 2;
      level = Math.max(level, 0.14 + 0.72 * shape + (rand() - 0.5) * 0.03);
    } else if (dist < 3) {
      level = Math.max(level, 0.14 + 0.3 * Math.exp(-(dist - 1) * 2) + (rand() - 0.5) * 0.03);
    }
    pts.push([x + t * w, y + h - Math.min(level, 0.96) * h]);
  }
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
  return `<path d="${line}" fill="none" stroke="var(--accent)" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="${line}L${(x + w).toFixed(1)} ${(y + h).toFixed(1)}L${x} ${y + h}Z" fill="var(--accent)" fill-opacity=".12"/>`;
}

export function renderFront (d, sel, ns = 'front') {
  const p = d.panel;
  const live = !!d.model;

  /* --- screen --------------------------------------------------- */
  const SX = 24, SY = 26, SW = 600, SH = 316;
  const gx = SX + 12, gy = SY + 30, gw = SW - 84, gh = SH - 60;
  const grid = [];
  for (let i = 1; i < 5; i++) grid.push(`<line x1="${gx}" y1="${gy + gh / 5 * i}" x2="${gx + gw}" y2="${gy + gh / 5 * i}" stroke="#12303f" stroke-width=".6"/>`);
  for (let i = 1; i < 10; i++) grid.push(`<line x1="${gx + gw / 10 * i}" y1="${gy}" x2="${gx + gw / 10 * i}" y2="${gy + gh}" stroke="#12303f" stroke-width=".6"/>`);
  const SOFT = ['Frequency', 'Amplitude', 'Bandwidth', 'Sweep', 'Trace', 'Marker', 'Lines', 'Input'];
  const soft = SOFT.map((l, i) => `
    <rect x="${SX + SW - 66}" y="${SY + 30 + i * 33}" width="56" height="27" rx="3" fill="#13202c" stroke="#274150" stroke-width=".8"/>
    <text x="${SX + SW - 38}" y="${SY + 47 + i * 33}" font-size="6.6" text-anchor="middle" fill="#8fb3c4"
      font-family="ui-sans-serif,system-ui,sans-serif">${esc(l)}</text>`).join('');
  const head = live
    ? `${d.model.id}  ·  Spectrum  ·  Ref 0 dBm  ·  Span ${d.bandwidth >= 1000 ? `${d.bandwidth / 1000} GHz` : `${d.bandwidth} MHz`}`
    : 'no model chosen';
  const screen = `
    <rect x="${SX}" y="${SY}" width="${SW}" height="${SH}" rx="6" fill="#0a1118" stroke="#2a3441" stroke-width="1.2"/>
    <text x="${gx}" y="${SY + 18}" font-size="8.5" fill="var(--accent)" letter-spacing=".06em"
      font-family="ui-monospace,monospace">${esc(head)}</text>
    <text x="${gx + gw}" y="${SY + 18}" font-size="7.5" fill="#3d6e7d" text-anchor="end"
      font-family="ui-monospace,monospace">${live ? `RBW ${d.rbwMax} MHz max · ${d.apps} app${d.apps === 1 ? '' : 's'}` : ''}</text>
    ${grid.join('')}
    ${live ? trace(gx, gy, gw, gh, d)
      : `<path d="M${gx} ${gy + gh * 0.72}L${gx + gw} ${gy + gh * 0.72}" stroke="#1d5566" stroke-width="1" stroke-dasharray="2 3"/>`}
    ${soft}`;

  /* --- keys ----------------------------------------------------- */
  const KX = 644;
  const FUNC = [['FREQ', 'AMPT', 'SPAN', 'BW'], ['SWEEP', 'TRACE', 'MKR', 'MKR→'],
    ['PEAK\nSEARCH', 'TRIG', 'MEAS', 'MEAS\nCONFIG'], ['AUTO\nSET', 'INPUT/\nOUTPUT', 'SETUP', 'MODE']];
  const func = FUNC.map((row, r) => row.map((l, c) => key(KX + c * 82, 26 + r * 34, 76, 28, l)).join('')).join('');
  const PAD = [['7', '8', '9', 'GHz'], ['4', '5', '6', 'MHz'], ['1', '2', '3', 'kHz'], ['0', '.', '−', 'Hz']];
  const pad = PAD.map((row, r) => row.map((l, c) => key(KX + c * 51, 172 + r * 31, 46, 26, l, 7)).join('')).join('');
  const knob = `
    <circle cx="920" cy="212" r="34" fill="${KEY_FACE}" stroke="${KEY_EDGE}" stroke-width="1"/>
    <circle cx="920" cy="212" r="26" fill="none" stroke="${KEY_EDGE}" stroke-width=".6" stroke-dasharray="2 3"/>
    <circle cx="920" cy="190" r="3" fill="${KEY_INK}"/>
    ${key(864, 262, 30, 24, '◀', 8)}${key(940, 262, 30, 24, '▶', 8)}${key(902, 254, 36, 16, '▲', 7)}${key(902, 274, 36, 16, '▼', 7)}
    ${key(864, 172, 44, 26, 'ESC', 6.2)}${key(864, 204, 44, 26, 'UNDO', 6.2)}${key(864, 236, 44, 18, 'ENTER', 6)}`;
  const run = `${key(KX, 300, 96, 26, 'RUN SINGLE', 6.4)}${key(KX + 102, 300, 96, 26, 'RUN CONT', 6.4)}${key(KX + 216, 300, 46, 26, '⏻', 8)}`;

  /* --- bottom strip: the connectors ------------------------------ */
  const BY = 348;
  const parts = [];
  let x = 24;
  for (const g of FRONT_PANEL) {
    if (g.title === 'RF input') continue;
    const items = present(g.items, p);
    if (!items.length) continue;
    const gr = group(x, BY, g.title, items, 8);
    parts.push(gr.svg);
    x += gr.w + 10;
  }
  const rf = present(FRONT_PANEL.find(g => g.title === 'RF input').items, p)
    .map(it => ({ ...it, label: it.label, type: it.label === 'RF INPUT' ? (p.conn || it.type) : it.type }));
  const rfW = rf.length * 80 + 12;
  const rfGroup = group(FW - 24 - rfW, BY, `RF input · ${p.conn ? p.conn.split(';')[0] : 'per model'}`, rf, 2, 80);
  parts.push(rfGroup.svg);

  return `
<svg viewBox="0 0 ${FW} ${FH}" width="100%" role="img" aria-label="Front panel of the configured R&S FSW"
  data-ns="${esc(ns)}">
  <rect x="2" y="2" width="${FW - 4}" height="${FH - 4}" rx="14" fill="${CHASSIS}" stroke="${CHASSIS_EDGE}" stroke-width="1.5"/>
  <rect x="10" y="10" width="${FW - 20}" height="${FH - 20}" rx="10" fill="#dfe3e9" stroke="${CHASSIS_EDGE}" stroke-width=".6"/>
  <text x="${KX}" y="18" font-size="9" font-weight="700" fill="${KEY_INK}" letter-spacing=".08em"
    font-family="ui-sans-serif,system-ui,sans-serif">R&amp;S®${live ? esc(d.model.id) : 'FSW'}</text>
  <text x="${FW - 24}" y="18" font-size="7" fill="${KEY_INK}" text-anchor="end"
    font-family="ui-sans-serif,system-ui,sans-serif">SIGNAL AND SPECTRUM ANALYZER · 2 Hz … ${live ? esc(String(d.fMax)) : '–'} GHz</text>
  ${screen}
  ${func}${pad}${knob}${run}
  ${parts.join('')}
</svg>`;
}

/* -------------------------------------------------------------- rear */

export function renderRear (d, w = 1000, ns = 'rear') {
  const p = d.panel;
  /* two columns: the rear has few groups, and a narrower drawing is a larger one on the page */
  const W = 680;
  const COLS = 2, COL_W = 316, GAP = 14, X0 = 17, Y0 = 34;
  const heights = Array(COLS).fill(Y0);
  const parts = [];
  for (const g of REAR_PANEL) {
    const items = present(g.items, p);
    if (!items.length) continue;
    const col = heights.indexOf(Math.min(...heights));
    const gr = group(X0 + col * (COL_W + GAP), heights[col], g.title, items, 4, 74);
    parts.push(gr.svg);
    heights[col] += gr.h + 10;
  }
  const H = Math.max(...heights) + 20;
  void w;
  return `
<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Rear panel of the configured R&S FSW"
  data-ns="${esc(ns)}">
  <rect x="2" y="2" width="${W - 4}" height="${H - 4}" rx="14" fill="${CHASSIS}" stroke="${CHASSIS_EDGE}" stroke-width="1.5"/>
  <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="10" fill="#1a222d" stroke="${CHASSIS_EDGE}" stroke-width=".6"/>
  <text x="${X0}" y="24" font-size="8" font-weight="700" fill="#aab4c2" letter-spacing=".08em"
    font-family="ui-sans-serif,system-ui,sans-serif">R&amp;S®${d.model ? esc(d.model.id) : 'FSW'} · REAR</text>
  <text x="${W - 20}" y="24" font-size="7" fill="#8391a3" text-anchor="end"
    font-family="ui-sans-serif,system-ui,sans-serif">${d.ocxo ? 'OCXO reference (R&amp;S®FSW-B4) fitted' : 'standard reference'}${d.weight ? ` · ${esc(String(d.weight))} kg without options` : ''}</text>
  ${parts.join('')}
</svg>`;
}

/* ------------------------------------------------------------- notes */

/** What the drawing cannot say by itself: the RF connector and what comes with the model. */
export function connectorNotes (d) {
  const out = [];
  if (d.conn) {
    out.push({ label: 'RF input · front panel', value: d.conn,
      note: d.supplied ? `supplied: ${d.supplied}` : 'type N: no adapter supplied' });
  }
  if (d.extMixer) {
    out.push({ label: 'External mixer · front panel', value: 'LO OUT/IF IN and IF IN, SMA female',
      note: 'two 1 m cables included with R&S®FSW-B21' });
  }
  return out;
}

/** Total connector count per face, which is what changes most visibly. */
export function faceCounts (d) {
  const p = d.panel;
  const tally = items => items.reduce((n, i) => n + (i.count || 1), 0);
  const count = groups => groups.reduce((n, g) => n + tally(present(g.items, p)), 0);
  return { front: count(FRONT_PANEL), rear: count(REAR_PANEL) };
}
