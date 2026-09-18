/**
 * Live visuals for the R&S FSW: a block diagram of the receiver chain and a
 * logarithmic frequency ruler. Plain SVG built from the derived state, so it
 * stays in step with the configuration without any drawing library.
 */

import { esc } from '../util.js';

/* ======================================================================== *
 * Frequency ruler
 * ======================================================================== */

const F_LO = 1;      // GHz, start of the expanded axis
const F_MAX = 110;   // GHz, its end - beyond the 90 GHz the FSW85 reaches

/** IEEE radar bands, the labels engineers use for these ranges. */
const BANDS = [
  [1, 2, 'L'], [2, 4, 'S'], [4, 8, 'C'], [8, 12, 'X'], [12, 18, 'Ku'],
  [18, 27, 'K'], [27, 40, 'Ka'], [40, 75, 'V'], [75, 110, 'W']
];

/** Allocations worth seeing against the instrument's reach. */
const MOBILE = [
  [3.3, 4.2, 'n78', '5G NR FR1 n77/n78, 3.3 GHz to 4.2 GHz'],
  [5.15, 7.125, 'Wi-Fi', '5 GHz and 6 GHz WLAN, 5.15 GHz to 7.125 GHz'],
  [24.25, 29.5, 'FR2', '5G NR FR2 n257/n258, 24.25 GHz to 29.5 GHz'],
  [37, 43.5, 'n260', '5G NR FR2 n259/n260, 37 GHz to 43.5 GHz'],
  [57, 71, '60G', '60 GHz WLAN 802.11ad/ay, 57 GHz to 71 GHz']
];

export function renderRuler (d) {
  const W = 356, H = 98;
  const x0 = 4, x1 = W - 4;
  const TAIL = 32;                 // the compressed segment below 1 GHz
  const GAP = 9;                   // where the axis break sits
  const xA = x0 + TAIL + GAP;      // start of the expanded axis
  const span = x1 - xA;

  const bandY = 6, bandH = 13;
  const mobY = 21, mobH = 10;
  const barY = 36;
  const bar2Y = 49;
  const pipY = 62;
  const axisY = 72;

  const at = f => xA + ((Math.log10(Math.min(Math.max(f, F_LO), F_MAX)) - Math.log10(F_LO)) /
    (Math.log10(F_MAX) - Math.log10(F_LO))) * span;

  const bands = BANDS.map(([lo, hi, name], i) => {
    const x = at(lo), w = at(hi) - x;
    return `<g><title>${esc(name)} band</title>
      <rect x="${x.toFixed(1)}" y="${bandY}" width="${w.toFixed(1)}" height="${bandH}"
        fill="var(--text-faint)" fill-opacity="${i % 2 ? '.10' : '.05'}"/>
      <line x1="${x.toFixed(1)}" y1="${bandY}" x2="${x.toFixed(1)}" y2="${bandY + bandH}"
        stroke="var(--line)" stroke-opacity=".5"/>
      <text x="${(x + w / 2).toFixed(1)}" y="${bandY + 9}" font-size="6.8" fill="var(--text-dim)"
        text-anchor="middle" letter-spacing=".04em"
        font-family="ui-monospace,monospace">${esc(name)}</text></g>`;
  }).join('');

  /* a label only where the band is wide enough to carry it; the title says the rest */
  const mobile = MOBILE.map(([lo, hi, name, full]) => {
    const x = at(lo), w = at(hi) - x;
    const fits = w >= name.length * 3.9 + 4;
    return `<g><title>${esc(full)}</title>
      <rect x="${x.toFixed(1)}" y="${mobY}" width="${w.toFixed(1)}" height="${mobH}" rx="2"
        fill="var(--accent-2)" fill-opacity=".14" stroke="var(--accent-2)" stroke-opacity=".35"/>
      ${fits ? `<text x="${(x + w / 2).toFixed(1)}" y="${mobY + 7.4}" font-size="6.2" fill="var(--accent-2)"
        text-anchor="middle" font-family="ui-monospace,monospace">${esc(name)}</text>` : ''}</g>`;
  }).join('');

  const bar = (f, y, colour, label) => {
    if (!f) return '';
    const end = at(f);
    const inside = end > x1 - label.length * 4.6 - 10;
    return `
      <rect x="${x0}" y="${y}" width="${(end - x0).toFixed(1)}" height="9" rx="4.5"
        fill="${colour}" fill-opacity=".22" stroke="${colour}" stroke-width="1"/>
      <rect x="${x0}" y="${y}" width="${(end - x0).toFixed(1)}" height="9" rx="4.5"
        fill="${colour}" fill-opacity=".35"/>
      ${inside
        ? `<text x="${(end - 6).toFixed(1)}" y="${y + 7.4}" font-size="7.5" fill="var(--bg)"
             text-anchor="end" font-weight="700"
             font-family="ui-monospace,monospace">${esc(label)}</text>`
        : `<text x="${(end + 6).toFixed(1)}" y="${y + 7.4}" font-size="7.5" fill="${colour}"
             font-family="ui-monospace,monospace">${esc(label)}</text>`}`;
  };

  const bx = x0 + TAIL;
  const brk = `
    <rect x="${bx}" y="${bandY - 1}" width="${GAP}" height="${axisY - bandY + 2}"
      fill="var(--surface)"/>
    <path d="M${bx + 2} ${axisY + 3}l4 -${axisY - bandY + 4}M${bx + 5.5} ${axisY + 3}l4 -${axisY - bandY + 4}"
      stroke="var(--line)" stroke-width="1"/>`;

  const ticks = [1, 2, 5, 10, 20, 50, 100].map(f => `
    <line x1="${at(f).toFixed(1)}" y1="${axisY}" x2="${at(f).toFixed(1)}" y2="${axisY + 4}" stroke="var(--text-dim)"/>
    <text x="${at(f).toFixed(1)}" y="${axisY + 13}" font-size="7" fill="var(--text-dim)" text-anchor="middle"
      font-family="ui-monospace,monospace">${f}</text>`).join('');

  const mixer = d.extMixer
    ? `<text x="${x1}" y="${pipY + 4}" font-size="6.6" fill="var(--text-dim)" text-anchor="end"
         font-family="ui-monospace,monospace">external mixers to 325 GHz →</text>` : '';

  return `
<svg viewBox="0 0 ${W} ${H}" role="img"
  aria-label="Frequency coverage against the radio bands">
  <rect x="${x0}" y="${bandY}" width="${TAIL}" height="${bandH}"
    fill="var(--text-faint)" fill-opacity=".05"/>
  <text x="${x0 + TAIL / 2}" y="${bandY + 9}" font-size="6" fill="var(--text-faint)"
    text-anchor="middle" font-family="ui-monospace,monospace">2 Hz–1 GHz</text>
  ${bands}
  ${mobile}
  ${bar(d.fMax, barY, 'var(--accent)', d.model ? `${d.model.id}${d.extension90 ? '+B90G' : ''} · ${d.fMax} GHz` : '')}
  ${bar(d.preamp, bar2Y, 'var(--accent-2)', d.preamp ? `preamp · ${d.preamp} GHz` : '')}
  ${mixer}
  <line x1="${x0}" y1="${axisY}" x2="${x1}" y2="${axisY}" stroke="var(--text-dim)"/>
  ${ticks}
  <text x="${x1}" y="${axisY + 22}" font-size="7" fill="var(--text-faint)" text-anchor="end"
    font-family="ui-monospace,monospace">GHz, logarithmic</text>
  ${brk}
</svg>`;
}

/* ======================================================================== *
 * Receiver chain block diagram
 * ======================================================================== */

const fmtBw = v => (v >= 1000 ? `${v / 1000} GHz` : `${v} MHz`);

function block (x, y, w, h, title, sub, on, tone = 'accent') {
  const stroke = on ? `var(--${tone})` : 'var(--line)';
  const fill = on ? `var(--${tone})` : 'var(--text-faint)';
  return `
    <g><title>${esc(title)}${sub ? ` – ${esc(sub)}` : ''}</title>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${fill}" fill-opacity="${on ? '.12' : '.04'}"
      stroke="${stroke}" stroke-width="${on ? 1.2 : 1}" ${on ? '' : 'stroke-dasharray="3 2"'}/>
    <text x="${x + w / 2}" y="${y + (sub ? 13 : h / 2 + 3)}" font-size="7" font-weight="700" text-anchor="middle"
      fill="${on ? 'var(--text)' : 'var(--text-faint)'}" font-family="ui-monospace,monospace">${esc(title)}</text>
    ${sub ? `<text x="${x + w / 2}" y="${y + 24}" font-size="6.2" text-anchor="middle"
      fill="${on ? 'var(--text-dim)' : 'var(--text-faint)'}" font-family="ui-monospace,monospace">${esc(sub)}</text>` : ''}
    </g>`;
}

const arrow = (x1, y1, x2, y2, on) =>
  `<path d="M${x1} ${y1}L${x2} ${y2}" stroke="${on ? 'var(--text-dim)' : 'var(--line)'}" stroke-width="1" fill="none"
     marker-end="url(#fsw-arrow)"/>`;

export function renderChain (d, sel) {
  const W = 356, H = 196;
  const BW = 44, BH = 34, STEP = 50, X0 = 6, Y = 80;
  const live = !!d.model;
  const rt = d.realtime;

  const main = [
    ['RF IN', d.model ? `to ${d.fMax} GHz` : 'no model', live],
    ['ATT', d.eAtt ? '0–79 dB · e-att' : '0–79 dB', live],
    ['PREAMP', d.preamp ? `to ${d.preamp} GHz` : 'not fitted', !!d.preamp],
    ['MIXER', d.model ? (d.model.meta.fMax > 8 ? 'YIG presel.' : 'lowpass') : '', live],
    ['IF', `RBW ≤ ${d.rbwMax} MHz`, live],
    ['A/D', fmtBw(d.bandwidth), live],
    ['APPS', `${d.apps}`, d.apps > 0]
  ];
  const blocks = main.map(([t, s, on], i) => block(X0 + i * STEP, Y, BW, BH, t, s, on)).join('');
  const links = main.slice(1).map((_, i) =>
    arrow(X0 + i * STEP + BW, Y + BH / 2, X0 + (i + 1) * STEP - 1, Y + BH / 2, live)).join('');

  /* alternative inputs, each into the digitiser */
  const inputs = [
    ['EXT MIXER', d.extMixer ? 'B21 · to 325 GHz' : 'B21', d.extMixer],
    ['ANALOG BB', d.analogBb ? `B71 · ${d.analogBb} MHz` : 'B71', d.analogBb > 0],
    ['DIGITAL BB', d.digitalIq ? 'B17 · 200 MS/s' : 'B17', d.digitalIq],
    ['SCOPE I/Q', d.scopeIq ? 'B2071 · RTO' : 'B2071', d.scopeIq]
  ];
  const inY = Y + BH + 36;
  const inBlocks = inputs.map(([t, s, on], i) => {
    const x = X0 + 50 + i * 60;
    const cx = x + 26;
    const target = i === 0 ? X0 + 3 * STEP + BW / 2 : X0 + 5 * STEP + BW / 2;
    return block(x, inY, 52, BH, t, s, on, 'accent-2') +
      `<path d="M${cx} ${inY}V${inY - 12}H${target}V${Y + BH + 1}" stroke="${on ? 'var(--accent-2)' : 'var(--line)'}"
         stroke-width="1" fill="none" ${on ? '' : 'stroke-dasharray="3 2"'} marker-end="url(#fsw-arrow)"/>`;
  }).join('');

  /* outputs, each out of the digitiser or the IF */
  /* each out of the block beneath it: the IF, the digitiser, the applications */
  const outputs = [
    ['IF OUT', 'BNC · 2 GHz SMA', live, 4, 186, 46],
    ['DIG IQ 40G', d.stream ? `${d.stream === 1000 ? 'B1017' : 'B517'} · ${fmtBw(d.stream)}` : 'B517/B1017', d.stream > 0, 5, 238, 58],
    ['REAL-TIME', rt ? `${fmtBw(rt.bw)} · ${rt.poi}` : 'no option', !!rt, 6, 300, 54]
  ];
  const outY = Y - 36 - BH + 8;
  const outBlocks = outputs.map(([t, s, on, from, bx, w]) => {
    const lx = X0 + from * STEP + BW / 2;
    return block(bx, outY, w, BH, t, s, on, 'accent-2') +
      `<path d="M${lx} ${Y}V${outY + BH + 1}" stroke="${on ? 'var(--accent-2)' : 'var(--line)'}"
         stroke-width="1" fill="none" ${on ? '' : 'stroke-dasharray="3 2"'} marker-end="url(#fsw-arrow)"/>`;
  }).join('');

  const memory = d.memory
    ? `<text x="${X0 + 5 * STEP + BW / 2}" y="${Y + BH + 10}" font-size="6.2" text-anchor="middle" fill="var(--text-dim)"
         font-family="ui-monospace,monospace">+${d.memory} GB</text>` : '';

  const head = live
    ? `${d.model.id} · ${fmtBw(d.bandwidth)} analysis bandwidth${d.upgrades.length ? ' (upgraded)' : ''}`
    : 'no configuration';
  void sel;
  return `
<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Receiver chain of the configured instrument">
  <defs>
    <marker id="fsw-arrow" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="5" markerHeight="5" orient="auto">
      <path d="M0 0L6 3L0 6z" fill="var(--text-dim)"/>
    </marker>
  </defs>
  <text x="${X0}" y="10" font-size="7.5" fill="var(--accent)" letter-spacing=".06em"
    font-family="ui-monospace,monospace">${esc(head)}</text>
  ${outBlocks}
  ${links}
  ${blocks}
  ${memory}
  ${inBlocks}
</svg>`;
}
