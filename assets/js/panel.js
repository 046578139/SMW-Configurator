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
import { screenContent, screenDefs } from './diagram.js';

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

const chassisDefs = ns => `
  <defs>
    <linearGradient id="${ns}-case" x1="0" y1="0" x2="0" y2="1">
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

/**
 * The front panel, drawn to the proportions of the instrument.
 *
 * Unlike the rear, the front does not change shape with the configuration - the
 * same controls are always there - so it is laid out at fixed coordinates taken
 * from the product photographs rather than reflowed to the available width. The
 * drawing is 1000 by 410 units, matching the roughly 2.45:1 face of the 4 HU
 * chassis, and scales with its container.
 *
 * What does change is the connectors: an RF output moved to the rear by B81 to
 * B84 leaves a blanking plate behind, as it does on the instrument, and the
 * frequency range printed beside each RF output follows the frequency option.
 */

const FW = 1000, FH = 410;

/* the right hand control field is light grey on the instrument */
const KEY_FACE = '#d5dae1', KEY_EDGE = '#98a1ae', KEY_INK = '#28313f';

/** A key on the light control field. */
function key (x, y, w, h, label, opts = {}) {
  const size = opts.size || 7.5;
  const lines = String(label).split('\n');
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"
      fill="${opts.fill || KEY_FACE}" stroke="${opts.edge || KEY_EDGE}" stroke-width=".9"/>
    ${lines.map((l, i) => `<text x="${x + w / 2}" y="${y + h / 2 + size * 0.36 + (i - (lines.length - 1) / 2) * (size * 1.4)}"
      font-size="${size}" fill="${opts.ink || KEY_INK}" text-anchor="middle"
      font-family="ui-sans-serif,system-ui,sans-serif">${esc(l)}</text>`).join('')}
  </g>`;
}

/** A soft key in the dark column beside the display. */
function softKey (x, y, w, h, label, tone) {
  const fill = tone === 'go' ? '#123028' : tone === 'help' ? '#3b2b10' : '#1b2534';
  const edge = tone === 'go' ? '#2c7d5f' : tone === 'help' ? '#8a6a1e' : '#3a4a63';
  const ink = tone === 'go' ? '#4fd8a0' : tone === 'help' ? '#f0a93a' : '#9aa8bc';
  const lines = label.split('\n');
  return `<g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${fill}" stroke="${edge}" stroke-width=".9"/>
    ${lines.map((l, i) => `<text x="${x + w / 2}" y="${y + h / 2 + 3 + (i - (lines.length - 1) / 2) * 11}"
      font-size="8" fill="${ink}" text-anchor="middle"
      font-family="ui-sans-serif,system-ui,sans-serif">${esc(l)}</text>`).join('')}
  </g>`;
}

/**
 * A connector on the light control field, or the blanking plate left behind
 * when the option that carries it puts it on the rear panel instead.
 */
function frontPort (cx, cy, kind, label, sub, on, colour) {
  if (!on) {
    return `<g opacity=".55">
      <rect x="${cx - 15}" y="${cy - 13}" width="30" height="26" rx="3"
        fill="#9aa3b0" stroke="${KEY_EDGE}" stroke-width=".9"/>
      <path d="M${cx - 7} ${cy - 6}l14 12M${cx + 7} ${cy - 6}l-14 12" stroke="#6f7986" stroke-width="1.1"/>
      <text x="${cx}" y="${cy + 25}" font-size="6.4" fill="#7b8695" text-anchor="middle"
        font-family="ui-monospace,monospace">${esc(sub || 'not fitted')}</text>
    </g>`;
  }
  const c = colour || '#3a4757';
  const big = kind === 'rf';
  const glyph = kind === 'usb'
    ? `<rect x="${cx - 11}" y="${cy - 5}" width="22" height="10" rx="1.5" fill="#2b3442" stroke="${c}" stroke-width="1"/>
       <rect x="${cx - 7}" y="${cy - 2}" width="14" height="4" fill="${c}" fill-opacity=".5"/>`
    : kind === 'odu'
      ? `<circle cx="${cx}" cy="${cy}" r="10" fill="#2b3442" stroke="${c}" stroke-width="1.2"/>
         ${[0, 60, 120, 180, 240, 300].map(a => {
           const r = (a * Math.PI) / 180;
           return `<circle cx="${(cx + Math.cos(r) * 4.4).toFixed(1)}" cy="${(cy + Math.sin(r) * 4.4).toFixed(1)}" r="1.2" fill="${c}"/>`;
         }).join('')}`
      : `<circle cx="${cx}" cy="${cy}" r="${big ? 15 : 11}" fill="#2b3442" stroke="${c}" stroke-width="${big ? 2 : 1.3}"/>
         <circle cx="${cx}" cy="${cy}" r="${big ? 7.5 : 5}" fill="#151c26" stroke="${c}" stroke-opacity=".6" stroke-width=".8"/>
         <circle cx="${cx}" cy="${cy}" r="${big ? 2.4 : 1.7}" fill="${c}"/>`;
  return `<g>
    ${glyph}
    <text x="${cx}" y="${cy + (big ? 25 : 22)}" font-size="${big ? 6.4 : 7}" fill="${KEY_INK}"
      text-anchor="middle" font-family="ui-monospace,monospace">${esc(label)}</text>
    ${sub ? `<text x="${cx}" y="${cy + (big ? 35 : 31)}" font-size="5.2" fill="#5d6775" text-anchor="middle"
      font-family="ui-monospace,monospace">${esc(sub)}</text>` : ''}
  </g>`;
}

export function renderFront (d, sel, ns = 'front') {
  const p = d.panel;
  const live = d.generators > 0;

  // marked on the instrument without spaces, which is also what fits here
  const rangeA = d.freqA ? `100kHz–${d.freqA.meta.fMax}GHz` : '';
  const rangeB = d.freqB ? `100kHz–${d.freqB.meta.fMax}GHz` : '';

  /* --- left: soft keys, indicators, power ------------------------------- */
  const SOFT = [['Preset', 'go'], ['Save\nRecall'], ['Local'], ['Setup'], ['HCopy'], ['Info'], ['Help', 'help']];
  const softCol = SOFT.map(([label, tone], i) =>
    softKey(58, 54 + i * 34, 76, 26, label, tone)).join('');

  /* --- right: hard keys, keypad, knob, navigation ------------------------ */
  const HARD = [
    ['Freq', 'Level', 'Home', '⇄', 'Resize\nWindow'],
    ['RF\nOn/Off', 'Mod\nOn/Off', '★', 'Esc', 'Wnd']
  ];
  const hardKeys = HARD.map((row, r) => row.map((label, c) =>
    key(586 + c * 57, 40 + r * 32, 50, 26, label, { size: 6.6 })).join('')).join('');

  const PAD = [['7', '8', '9', 'G/n'], ['4', '5', '6', 'M/µ'],
    ['1', '2', '3', 'k/m'], ['0', '.', '+/−', '×1']];
  const keypad = PAD.map((row, r) => row.map((label, c) =>
    key(586 + c * 50, 118 + r * 38, 44, 32, label, { size: c === 3 ? 8 : 11 })).join('')).join('');

  const knobX = 830, knobY = 160;
  const knob = `
    <circle cx="${knobX}" cy="${knobY}" r="40" fill="#a8b0bc" stroke="#868f9c" stroke-width="1.4"/>
    <circle cx="${knobX}" cy="${knobY}" r="31" fill="#39414d" stroke="#6d7681" stroke-width="1"/>
    <circle cx="${knobX}" cy="${knobY}" r="13" fill="#2a313a"/>
    <circle cx="${knobX}" cy="${knobY - 22}" r="3.4" fill="#d3d9e1"/>`;

  const navX = 830, navY = 268;
  const nav = `
    ${key(navX - 11, navY - 34, 22, 20, '▲', { size: 7 })}
    ${key(navX - 11, navY + 14, 22, 20, '▼', { size: 7 })}
    ${key(navX - 37, navY - 10, 22, 20, '◀', { size: 7 })}
    ${key(navX + 15, navY - 10, 22, 20, '▶', { size: 7 })}`;

  const editRow = `${key(586, 272, 44, 26, 'Insert', { size: 6.6 })}
    ${key(636, 272, 44, 26, '⌫', { size: 9 })}
    ${key(686, 272, 44, 26, '↵', { size: 9 })}`;

  /* --- bottom strip on the control field --------------------------------- */
  /* The RF outputs carry a path letter above and the range below, as they are
     marked on the instrument, so they need more room than the small ports. */
  const rfPort = (cx, letter, range, on, colour) => `
    <text x="${cx}" y="316" font-size="9" fill="${on ? KEY_INK : '#7b8695'}" text-anchor="middle"
      font-weight="700" font-family="ui-sans-serif,system-ui,sans-serif">${letter}</text>
    ${frontPort(cx, 342, 'rf', 'RF 50 Ω', range, on, colour)}`;

  const strip = `
    ${frontPort(592, 338, 'usb', 'USB', '', true)}
    ${frontPort(624, 338, 'usb', 'USB', '', true)}
    ${frontPort(658, 338, 'odu', 'SENSOR', '', true)}
    ${frontPort(692, 338, 'bnc', 'USER 1', '', true)}
    ${frontPort(724, 338, 'bnc', 'USER 2', '', true)}
    ${frontPort(756, 338, 'bnc', 'USER 3', '', true)}
    ${rfPort(802, 'A', p.rfA ? rangeA : 'on rear panel', p.rfA, 'var(--accent)')}
    ${rfPort(852, 'B', p.rearRfB ? 'on rear panel' : (p.rfB ? rangeB : 'no second path'),
      p.rfB, 'var(--accent-2)')}`;

  /* --- far right: analog I/Q inputs --------------------------------------- */
  const iqPort = (cy, label, on) => on
    ? `<circle cx="934" cy="${cy}" r="11" fill="#0f1620" stroke="var(--accent-3)" stroke-width="1.3"/>
       <circle cx="934" cy="${cy}" r="4.6" fill="#080d14" stroke="var(--accent-3)" stroke-opacity=".55" stroke-width=".8"/>
       <circle cx="934" cy="${cy}" r="1.7" fill="var(--accent-3)"/>
       <text x="916" y="${cy + 3}" font-size="9" fill="var(--accent-3)" text-anchor="end"
         font-family="ui-monospace,monospace">${esc(label)}</text>`
    : `<circle cx="934" cy="${cy}" r="11" fill="#141b25" stroke="#33415a" stroke-width="1"/>
       <path d="M928 ${cy - 6}l12 12M940 ${cy - 6}l-12 12" stroke="#33415a" stroke-width="1"/>
       <text x="916" y="${cy + 3}" font-size="9" fill="#3f4b5e" text-anchor="end"
         font-family="ui-monospace,monospace">${esc(label)}</text>`;

  const iq = `
    ${iqPort(112, 'I', p.iqA)}${iqPort(158, 'Q', p.iqA)}
    ${iqPort(220, 'I', p.iqB)}${iqPort(266, 'Q', p.iqB)}
    <text x="894" y="141" font-size="13" fill="${p.iqA ? '#c3ccd8' : '#3f4b5e'}"
      text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-weight="600">A</text>
    <text x="894" y="249" font-size="13" fill="${p.iqB ? '#c3ccd8' : '#3f4b5e'}"
      text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-weight="600">B</text>`;

  return `
<svg viewBox="0 0 ${FW} ${FH}" role="img"
  aria-label="Front panel of the configured R&S SMW200A">
  ${chassisDefs(ns)}

  <!-- side handles -->
  <rect x="3" y="4" width="33" height="402" rx="9" fill="#22344a" stroke="#38536f"/>
  <rect x="11" y="60" width="17" height="290" rx="8" fill="#1a2838" stroke="#2f4762"/>
  <rect x="964" y="4" width="33" height="402" rx="9" fill="#22344a" stroke="#38536f"/>
  <rect x="972" y="60" width="17" height="290" rx="8" fill="#1a2838" stroke="#2f4762"/>

  <!-- chassis, with the light top cover and base of the real unit -->
  <rect x="34" y="8" width="932" height="394" rx="4" fill="url(#${ns}-case)" stroke="#3b4a63"/>
  <rect x="34" y="8" width="932" height="13" rx="3" fill="#79838f"/>
  <rect x="34" y="389" width="932" height="13" rx="3" fill="#79838f"/>
  <circle cx="150" cy="404" r="5" fill="#6c7681"/><circle cx="850" cy="404" r="5" fill="#6c7681"/>

  ${softCol}
  <circle cx="66" cy="312" r="4" fill="#4fd8a0"/><circle cx="80" cy="312" r="4" fill="#39465c"/>
  <circle cx="96" cy="350" r="16" fill="#151d29" stroke="#4a5b76" stroke-width="1.3"/>
  <path d="M96 341v10" stroke="#9aa8bc" stroke-width="1.8" stroke-linecap="round"/>
  <path d="M89 344a9 9 0 1 0 14 0" fill="none" stroke="#9aa8bc" stroke-width="1.5"/>

  <!-- display -->
  <rect x="152" y="26" width="408" height="358" rx="3" fill="#0a0e15" stroke="#1b2636"/>
  <text x="166" y="45" font-size="8.5" fill="#8895a8" letter-spacing=".06em"
    font-family="ui-sans-serif,system-ui,sans-serif" font-weight="600">ROHDE &amp; SCHWARZ</text>
  <text x="452" y="45" font-size="8.5" fill="#c3ccd8" text-anchor="middle"
    font-family="ui-sans-serif,system-ui,sans-serif">SMW200A · Vector Signal Generator</text>
  <rect x="166" y="54" width="380" height="314" rx="2" fill="#04090e" stroke="#16283a"/>
  ${screenDefs(ns)}
  ${screenContent(166, 54, 380, 314, d, sel, live, ns)}

  <!-- control field -->
  <rect x="572" y="26" width="306" height="358" rx="3" fill="#b9c0ca" stroke="#8b95a3"/>
  ${hardKeys}
  ${keypad}
  ${knob}
  ${nav}
  ${editRow}
  ${strip}

  <!-- analog I/Q inputs and wordmark -->
  <text x="928" y="52" font-size="16" fill="#dbe3ee" text-anchor="middle" font-weight="700"
    font-family="ui-sans-serif,system-ui,sans-serif" letter-spacing=".04em">SMW</text>
  ${iq}
</svg>`;
}

/**
 * The rear panel, arranged as the instrument arranges it: a fixed input/output
 * column down the left, the system row and mains inlet across the top, and the
 * plug-in module bays stacked below.
 *
 * That arrangement is also how the rear grows with the configuration - one bay
 * per installed baseband generator or fading simulator - so the drawing extends
 * downward as modules are added rather than reflowing. The RF cut-outs in the
 * left column open up when B81 to B84 move an output to this face.
 */
export function renderRear (d, ns = 'rear') {
  const p = d.panel;
  const W = 1000;

  const item = (label, kind, type) => ({ label, kind, type });
  const byLabel = {};
  for (const g of REAR_PANEL) for (const i of g.items) byLabel[i.label] = i;
  const pick = label => byLabel[label] || item(label, 'bnc', 'BNC female');

  /* --- left column: reference, trigger, user, LO, GPIB ------------------- */
  const COL_X = 46, SUB = 70, ROW = 34;
  const pairs = [
    ['REF IN', 'REF OUT'], ['INST TRG A', 'INST TRG B'],
    ['USER 4', 'USER 5'], ['EFC', 'USER 6'], ['LO IN', 'LO OUT']
  ];
  const leftCol = pairs.map(([a, b], r) => {
    const y = 42 + r * ROW;
    return connector(COL_X, y, SUB, pick(a), tint(pick(a)))
      + connector(COL_X + SUB, y, SUB, pick(b), tint(pick(b)));
  }).join('');

  // the RF cut-outs, blanked until an option puts an output on this face
  const cutout = (cx, cy, on, label, colour) => on
    ? `<circle cx="${cx}" cy="${cy}" r="15" fill="#0d1520" stroke="${colour}" stroke-width="2"/>
       <circle cx="${cx}" cy="${cy}" r="7.5" fill="#060b12" stroke="${colour}" stroke-opacity=".6" stroke-width=".8"/>
       <circle cx="${cx}" cy="${cy}" r="2.4" fill="${colour}"/>
       <text x="${cx}" y="${cy + 26}" font-size="7" fill="${colour}" text-anchor="middle"
         font-family="ui-monospace,monospace">${esc(label)}</text>`
    : `<circle cx="${cx}" cy="${cy}" r="15" fill="#151d29" stroke="#33415a" stroke-width="1.2"/>
       <text x="${cx}" y="${cy + 26}" font-size="7" fill="#3f4b5e" text-anchor="middle"
         font-family="ui-monospace,monospace">${esc(label)}</text>`;

  const rfCutouts = `
    ${cutout(COL_X + 35, 232, p.rearRfA, 'RF A', 'var(--accent)')}
    ${cutout(COL_X + 105, 232, p.rearRfB, 'RF B', 'var(--accent-2)')}`;

  const gpib = `
    <path d="M${COL_X + 12} 300h116l-6 20h-104z" fill="#123a6b" stroke="#2f6bb5" stroke-width="1.2"
      stroke-linejoin="round"/>
    ${Array.from({ length: 12 }, (_, i) =>
      `<circle cx="${COL_X + 22 + i * 9}" cy="308" r="1.5" fill="#5b90d0"/>`).join('')}
    <text x="${COL_X + 70}" y="336" font-size="7" fill="#7fa8dc" text-anchor="middle"
      font-family="ui-monospace,monospace">IEEE 488</text>`;

  /* --- top: system drive, host ports, mains ------------------------------ */
  const SYS_X = 202;
  const hostPorts = ['DISPLAY PORT', 'HDMI', 'LAN', 'USB', 'USB DEVICE']
    .map((l, i) => connector(SYS_X + 8 + i * 78, 74, 78, pick(l), tint(pick(l)))).join('');

  const systemRow = `
    <rect x="${SYS_X}" y="36" width="404" height="26" rx="3" fill="#1b2534" stroke="#3a4a63"/>
    <circle cx="${SYS_X + 16}" cy="49" r="6" fill="#0f1620" stroke="#4a5b76"/>
    <circle cx="${SYS_X + 388}" cy="49" r="6" fill="#0f1620" stroke="#4a5b76"/>
    <text x="${SYS_X + 202}" y="52" font-size="7.5" fill="#8895a8" text-anchor="middle"
      letter-spacing=".1em" font-family="ui-monospace,monospace">SYSTEM DRIVE</text>
    ${hostPorts}`;

  const MAINS_X = 640;
  const mains = `
    <rect x="${MAINS_X}" y="36" width="312" height="82" rx="3" fill="#141c28" stroke="#33415a"/>
    <text x="${MAINS_X + 16}" y="56" font-size="6.4" fill="#7d8da3"
      font-family="ui-monospace,monospace">AC 100…240 V / 50…60 Hz</text>
    <text x="${MAINS_X + 16}" y="68" font-size="6.4" fill="#7d8da3"
      font-family="ui-monospace,monospace">AC 100…120 V / 400 Hz</text>
    <text x="${MAINS_X + 16}" y="80" font-size="6.4" fill="#7d8da3"
      font-family="ui-monospace,monospace">max. ${
        // the specifications give the higher rated current for B13XT or B94L
        d.chassis === 'deep' || p.hsDigital ? '8.9…4.9' : '7.3…4.6'} A</text>
    <rect x="${MAINS_X + 210}" y="52" width="22" height="34" rx="2" fill="#0f1620" stroke="#4a5b76"/>
    <rect x="${MAINS_X + 213}" y="55" width="16" height="14" rx="1" fill="#2a3442"/>
    <path d="M${MAINS_X + 250} 56h44v30h-44z" fill="#0f1620" stroke="#4a5b76" stroke-width="1.2"/>
    ${[0, 1, 2].map(i => `<rect x="${MAINS_X + 258 + i * 12}" y="64" width="5" height="9" rx="1" fill="#4a5b76"/>`).join('')}
    <text x="${MAINS_X + 272}" y="100" font-size="6.4" fill="#5d6e88" text-anchor="middle"
      font-family="ui-monospace,monospace">MAINS</text>`;

  /* --- module bays -------------------------------------------------------- */
  const BAY_X = 202, BAY_W = 750, BAY_H = 56, BAY_GAP = 6, BAY_TOP = 128;

  const bays = p.modules.map((kind, i) => {
    const y = BAY_TOP + i * (BAY_H + BAY_GAP);
    const items = MODULE_PANELS[kind].items;
    const slot = (BAY_W - 16) / items.length;
    const ports = items.map((it, n) =>
      connector(BAY_X + 8 + n * slot, y + 12, slot, it, tint(it)));
    return `
      <rect x="${BAY_X}" y="${y}" width="${BAY_W}" height="${BAY_H}" rx="3"
        fill="#131c29" stroke="#2b3a51"/>
      <text x="${BAY_X + 6}" y="${y + 9}" font-size="5.8" fill="#4a5a72"
        letter-spacing=".08em" font-family="ui-monospace,monospace"
        >${esc(`${MODULE_PANELS[kind].label.toUpperCase()} ${i + 1}`)}</text>
      ${ports.join('')}`;
  }).join('');

  const bayCount = p.modules.length;
  const bodyH = Math.max(402, BAY_TOP + bayCount * (BAY_H + BAY_GAP) + 22);
  const H = bodyH + 16;

  /* --- groups that are not carried by a module ---------------------------- */
  const extras = REAR_PANEL
    .filter(g => g.group === 'Analog I/Q outputs' || g.group === 'Digital I/Q')
    .map(g => ({ ...g, items: present(g.items, p) }))
    .filter(g => g.items.length);
  const extraY = BAY_TOP + bayCount * (BAY_H + BAY_GAP);
  const extraBay = extras.length
    ? (() => {
      const items = extras.flatMap(g => g.items);
      const slot = (BAY_W - 16) / Math.max(items.length, 1);
      return `
        <rect x="${BAY_X}" y="${extraY}" width="${BAY_W}" height="${BAY_H}" rx="3"
          fill="#131c29" stroke="#2b3a51"/>
        <text x="${BAY_X + 6}" y="${extraY + 9}" font-size="5.8" fill="#4a5a72"
          letter-spacing=".08em" font-family="ui-monospace,monospace">ANALOG AND DIGITAL I/Q OUTPUTS</text>
        ${items.map((it, n) => connector(BAY_X + 8 + n * slot, extraY + 12, slot, it, tint(it))).join('')}`;
    })()
    : '';

  const fullH = extras.length ? Math.max(H, extraY + BAY_H + 38) : H;
  const fullBody = fullH - 16;

  return `
<svg viewBox="0 0 ${W} ${fullH}" role="img"
  aria-label="Rear panel of the configured R&S SMW200A">
  ${chassisDefs(ns)}

  <rect x="3" y="4" width="33" height="${fullBody - 4}" rx="9" fill="#22344a" stroke="#38536f"/>
  <rect x="964" y="4" width="33" height="${fullBody - 4}" rx="9" fill="#22344a" stroke="#38536f"/>

  <rect x="34" y="8" width="932" height="${fullBody - 12}" rx="4" fill="url(#${ns}-case)" stroke="#3b4a63"/>
  <rect x="34" y="8" width="932" height="22" rx="3" fill="#79838f"/>
  <rect x="34" y="${fullBody - 18}" width="932" height="14" rx="3" fill="#79838f"/>

  <!-- left hand input and output column -->
  <rect x="40" y="34" width="152" height="${fullBody - 60}" rx="3" fill="#0f1620" stroke="#2b3a51"/>
  ${leftCol}
  ${rfCutouts}
  ${gpib}

  ${systemRow}
  ${mains}
  ${bays}
  ${extraBay}

  ${bayCount ? '' : `<text x="${BAY_X + BAY_W / 2}" y="${BAY_TOP + 30}" font-size="8"
    fill="#4a5a72" text-anchor="middle" letter-spacing=".1em"
    font-family="ui-monospace,monospace">NO BASEBAND MODULES FITTED</text>`}
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
