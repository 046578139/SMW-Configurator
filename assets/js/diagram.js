/**
 * Live visuals: a front-panel view whose spectrum display reflects the
 * configured signal, a block diagram of the signal chain, and a logarithmic
 * frequency ruler. Everything is plain SVG built from the derived state, so it
 * stays in step with the configuration without any drawing library.
 */

import { esc } from './util.js';

/** Small deterministic PRNG so a given configuration always draws the same trace. */
function rng (seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const hash = str => {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

/* ======================================================================== *
 * Front panel
 * ======================================================================== */

export function screenContent (x, y, w, h, d, sel, live) {
  const pad = 8;
  const gx = x + pad, gy = y + pad + 12, gw = w - pad * 2, gh = h - pad * 2 - 16;

  const grid = [];
  for (let i = 1; i < 4; i++) {
    const yy = gy + (gh / 4) * i;
    grid.push(`<line x1="${gx}" y1="${yy.toFixed(1)}" x2="${gx + gw}" y2="${yy.toFixed(1)}" stroke="#12303f" stroke-width=".5"/>`);
  }
  for (let i = 1; i < 6; i++) {
    const xx = gx + (gw / 6) * i;
    grid.push(`<line x1="${xx.toFixed(1)}" y1="${gy}" x2="${xx.toFixed(1)}" y2="${gy + gh}" stroke="#12303f" stroke-width=".5"/>`);
  }

  const head = live
    ? `${d.fMax ? d.fMax + ' GHz' : '—'}   ·   ${d.bandwidth ? (d.bandwidth >= 1000 ? d.bandwidth / 1000 + ' GHz' : d.bandwidth + ' MHz') : 'CW'} BW`
    : (d.freqA ? 'CW / analog modulation only' : 'no configuration');

  return `
  <text x="${gx}" y="${y + pad + 7}" font-size="9" fill="var(--accent)" font-family="ui-monospace,monospace"
    letter-spacing=".06em">${esc(head)}</text>
  ${grid.join('')}
  ${live ? spectrum(gx, gy, gw, gh, d, sel) : flatline(gx, gy, gw, gh)}
  <text x="${gx + gw}" y="${y + pad + 7}" font-size="7.5" fill="#3d6e7d" text-anchor="end"
    font-family="ui-monospace,monospace">${d.paths > 1 ? 'A+B' : 'A'}</text>`;
}

/** Draws a spectrum whose shape follows the configured signal. */
function spectrum (x, y, w, h, d, sel) {
  const seed = hash(Object.keys(sel).sort().join(',') + d.bandwidth);
  const rand = rng(seed);
  const N = 150;

  const bw = d.bandwidth || 0;
  const two = d.generators > 1;
  // relative occupied width of one carrier on screen; two carriers get a
  // narrower slice each so they stay readable as separate channels
  const frac = (bw ? 0.10 + 0.34 * (Math.log10(bw) / Math.log10(2000)) : 0.045) * (two ? 0.8 : 1);
  const carriers = two ? [0.27, 0.73] : [0.5];

  const noiseFloor = d.awgn ? 0.30 : 0.13;   // fraction of height above the bottom
  const notch = sel.K811 ? 1 : 0;
  const ripple = d.fadingChannels ? 1 : 0;

  const pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    let level = noiseFloor + (rand() - 0.5) * 0.05;

    for (const c of carriers) {
      const dist = Math.abs(t - c) / (frac / 2);
      if (dist < 1) {
        // flat-topped channel with rounded shoulders
        const shape = dist < 0.72 ? 1 : Math.cos(((dist - 0.72) / 0.28) * Math.PI / 2) ** 2;
        let amp = 0.78 * shape;
        if (ripple) amp *= 0.90 + 0.10 * Math.sin(t * 24 + (seed % 7));
        if (notch && Math.abs(dist - 0.35) < 0.06) amp *= 0.30;
        level = Math.max(level, noiseFloor + amp + (rand() - 0.5) * 0.035);
      } else if (dist < 3.2) {
        // adjacent channel shoulders
        const skirt = 0.34 * Math.exp(-(dist - 1) * 1.9);
        level = Math.max(level, noiseFloor + skirt + (rand() - 0.5) * 0.03);
      }
    }
    pts.push([x + t * w, y + h - Math.min(level, 0.97) * h]);
  }

  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('');
  const area = `${line}L${(x + w).toFixed(1)} ${(y + h).toFixed(1)}L${x.toFixed(1)} ${(y + h).toFixed(1)}Z`;

  return `<path d="${area}" fill="url(#trace)" opacity=".55"/>
    <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="1.1"
      stroke-linejoin="round" filter="url(#softGlow)"/>`;
}

function flatline (x, y, w, h) {
  const mid = y + h * 0.72;
  return `<path d="M${x} ${mid}L${x + w} ${mid}" stroke="#1d5566" stroke-width="1" stroke-dasharray="2 3"/>`;
}

/* ======================================================================== *
 * Signal chain block diagram
 * ======================================================================== */

export function renderChain (d, sel) {
  const W = 356;
  const GUT = 66;                    // left gutter for stage labels
  const X0 = GUT, BW = W - GUT - 12;
  const boxH = 36, gap = 26;

  const flow = d.generators > 0;
  const stroke = flow ? 'var(--accent)' : '#33415a';

  const stages = [];

  /* baseband generators */
  const gens = [];
  if (d.generators) {
    const label = d.genWide ? (sel.B9F ? 'B9F' : 'B9') : 'B10';
    const arb = d.arb >= 1024 ? `${d.arb / 1024} Gs` : `${d.arb} Ms`;
    const bw = d.bandwidth >= 1000 ? `${d.bandwidth / 1000} GHz` : `${d.bandwidth} MHz`;
    for (let i = 0; i < d.generators; i++) {
      gens.push({ label, sub: `${arb} · ${bw}`, tone: 'accent' });
    }
  } else {
    gens.push({ label: 'no generator', sub: 'CW and analog modulation', tone: 'dim' });
  }
  stages.push({ name: 'BASEBAND', items: gens });

  /* fading */
  if (d.faders) {
    stages.push({
      name: 'FADING',
      items: [{
        label: `${d.faders} × ${sel.B15 ? 'B15' : 'B14'}`,
        sub: `${d.fadingChannels} channels${d.mimo && d.mimo !== 'SISO' ? ' · MIMO ' + d.mimo.replace('up to ', '') : ''}`,
        tone: 'warn'
      }]
    });
  }

  /* routing */
  stages.push({
    name: 'ROUTING',
    items: [{
      label: d.mainModule || 'main module',
      sub: d.mainModule
        ? `${d.section === 'wideband' ? 'wideband' : 'standard'} · ${d.mainModule === 'B13' ? '1 I/Q path' : '2 I/Q paths'}`
        : 'required',
      tone: d.mainModule ? 'accent' : 'error'
    }]
  });

  /* RF paths */
  const rf = [];
  rf.push(d.freqA
    ? { label: 'RF path A', sub: `${d.freqA.meta.fMax} GHz · ${d.freqA.id}`, tone: 'accent' }
    : { label: 'RF path A', sub: 'required', tone: 'error' });
  if (d.freqB) rf.push({ label: 'RF path B', sub: `${d.freqB.meta.fMax} GHz · ${d.freqB.id}`, tone: 'blue' });
  stages.push({ name: 'RF', items: rf });

  /* outputs */
  const outs = [{ text: 'RF A', tone: d.freqA ? 'accent' : 'dim' }];
  if (d.freqB) outs.push({ text: 'RF B', tone: 'blue' });
  if (d.hasAnalogIQOut) outs.push({ text: 'I/Q out', tone: 'violet' });
  if (d.hasDigitalOut) outs.push({ text: 'DIG I/Q', tone: 'blue' });
  if (d.hasAnalogIQIn) outs.push({ text: 'I/Q in', tone: 'violet' });

  /* --- layout ---------------------------------------------------- */
  const boxes = [];
  const labels = [];
  const rowTop = [];
  let y = 8;

  for (const stage of stages) {
    rowTop.push(y);
    const n = stage.items.length;
    const g = 10;
    const w = (BW - g * (n - 1)) / n;
    stage.items.forEach((it, i) => boxes.push(block(X0 + i * (w + g), y, w, boxH, it)));
    labels.push(`<text x="${GUT - 11}" y="${y + boxH / 2 + 3}" font-size="7.5" fill="var(--text-faint)"
      text-anchor="end" letter-spacing=".05em" font-weight="600">${stage.name}</text>`);
    y += boxH + gap;
  }

  const outY = y - gap + 12;
  const H = outY + 30;

  /* --- connectors -------------------------------------------------- */
  const centre = (n, i) => { const g = 10, w = (BW - g * (n - 1)) / n; return X0 + i * (w + g) + w / 2; };
  const conns = [];
  for (let r = 0; r < stages.length - 1; r++) {
    const from = stages[r].items, to = stages[r + 1].items;
    const yA = rowTop[r] + boxH, yB = rowTop[r + 1];
    const links = Math.max(from.length, to.length);
    for (let i = 0; i < links; i++) {
      const x1 = centre(from.length, Math.min(i, from.length - 1));
      const x2 = centre(to.length, Math.min(i, to.length - 1));
      const mid = (yA + yB) / 2;
      conns.push(`<path d="M${x1.toFixed(1)} ${yA} C${x1.toFixed(1)} ${mid} ${x2.toFixed(1)} ${mid} ${x2.toFixed(1)} ${(yB - 5).toFixed(1)}"
        fill="none" stroke="${stroke}" stroke-width="1.4" stroke-opacity=".85" marker-end="url(#arw)"
        class="${flow ? 'flow' : ''}"/>`);
    }
  }

  /* --- output pills ------------------------------------------------ */
  const tone = { accent: 'var(--accent)', blue: 'var(--accent-2)', violet: 'var(--accent-3)', dim: 'var(--line)' };
  const pillW = Math.min(62, (BW - (outs.length - 1) * 7) / outs.length);
  const pills = outs.map((o, i) => {
    const px = X0 + i * (pillW + 7);
    return `<g>
      <rect x="${px.toFixed(1)}" y="${outY}" width="${pillW.toFixed(1)}" height="17" rx="8.5"
        fill="none" stroke="${tone[o.tone]}" stroke-width="1" stroke-opacity=".8"/>
      <text x="${(px + pillW / 2).toFixed(1)}" y="${outY + 11.5}" font-size="8" text-anchor="middle"
        fill="${tone[o.tone]}">${esc(o.text)}</text>
    </g>`;
  }).join('');

  return `
<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Signal chain block diagram">
  <defs>
    <marker id="arw" viewBox="0 0 8 8" refX="5.5" refY="4" markerWidth="4.6" markerHeight="4.6" orient="auto">
      <path d="M0 1L6 4L0 7Z" fill="${stroke}"/>
    </marker>
  </defs>
  <text x="${GUT - 11}" y="${outY + 11.5}" font-size="7.5" fill="var(--text-faint)"
    text-anchor="end" letter-spacing=".05em" font-weight="600">OUT</text>
  ${conns.join('')}
  ${boxes.join('')}
  ${labels.join('')}
  ${pills}
</svg>`;
}

/** One module box in the signal chain. */
function block (x, y, w, h, it) {
  const tones = {
    accent: ['var(--accent)', 'color-mix(in srgb, var(--accent) 12%, transparent)'],
    blue:   ['var(--accent-2)', 'color-mix(in srgb, var(--accent-2) 12%, transparent)'],
    warn:   ['var(--warn)', 'color-mix(in srgb, var(--warn) 12%, transparent)'],
    error:  ['var(--error)', 'color-mix(in srgb, var(--error) 10%, transparent)'],
    dim:    ['var(--line)', 'transparent']
  };
  const [line, fill] = tones[it.tone] || tones.dim;
  const textColour = it.tone === 'dim' ? 'var(--text-faint)' : 'var(--text)';
  return `
  <g class="mod">
    <rect x="${x.toFixed(1)}" y="${y}" width="${w.toFixed(1)}" height="${h}" rx="8"
      fill="${fill}" stroke="${line}" stroke-width="1"/>
    <text x="${(x + w / 2).toFixed(1)}" y="${y + 16}" font-size="11" font-weight="620"
      fill="${textColour}" text-anchor="middle">${esc(it.label)}</text>
    <text x="${(x + w / 2).toFixed(1)}" y="${y + 27}" font-size="8" fill="var(--text-faint)"
      text-anchor="middle">${esc(it.sub)}</text>
  </g>`;
}

/* ======================================================================== *
 * Logarithmic frequency ruler
 * ======================================================================== */

const F_MIN = 1e-4;   // 100 kHz in GHz - the lower limit of every frequency option
const F_MAX = 67;     // the highest option, R&S(R)SMW-B1067

const posOf = f => (Math.log10(Math.max(f, F_MIN)) - Math.log10(F_MIN)) /
                   (Math.log10(F_MAX) - Math.log10(F_MIN));

/**
 * Radio bands across the instrument's range, in GHz.
 *
 * Below 1 GHz these are the ITU designations; from 1 GHz up they are the IEEE
 * radar letters, which is how this equipment is usually talked about. The
 * ranges are contiguous so the strip reads as one scale.
 */
const BANDS = [
  [1e-4, 3e-4, 'LF'], [3e-4, 3e-3, 'MF'], [3e-3, 0.03, 'HF'],
  [0.03, 0.3, 'VHF'], [0.3, 1, 'UHF'],
  [1, 2, 'L'], [2, 4, 'S'], [4, 8, 'C'], [8, 12, 'X'],
  [12, 18, 'Ku'], [18, 27, 'K'], [27, 40, 'Ka'], [40, F_MAX, 'V']
];

/** The mobile bands the configurator is most often used against. */
const MOBILE = [
  [0.41, 7.125, 'FR1'],
  [24.25, 52.6, 'FR2', 'FR2 mmWave']
];

export function renderRuler (d) {
  const W = 356, H = 92;
  const x0 = 4, x1 = W - 4, span = x1 - x0;
  const bandY = 6, bandH = 13;
  const mobY = 21, mobH = 10;
  const barY = 38;
  const axisY = 66;

  const ticks = [
    [1e-4, '100 k'], [1e-3, '1 M'], [1e-2, '10 M'], [0.1, '100 M'],
    [1, '1 G'], [6, '6 G'], [20, '20 G'], [67, '67 G']
  ];

  const seg = (lo, hi) => {
    const a = x0 + posOf(lo) * span;
    return { x: a, w: (x0 + posOf(hi) * span) - a };
  };

  const bands = BANDS.map(([lo, hi, name], i) => {
    const { x, w } = seg(lo, hi);
    // a letter needs room; where there is none the band still shows as a slot
    const fits = w > name.length * 3.8 + 1.5;
    return `<g><title>${esc(name)} band</title>
      <rect x="${x.toFixed(1)}" y="${bandY}" width="${w.toFixed(1)}" height="${bandH}"
        fill="var(--text-faint)" fill-opacity="${i % 2 ? '.10' : '.05'}"/>
      <line x1="${x.toFixed(1)}" y1="${bandY}" x2="${x.toFixed(1)}" y2="${bandY + bandH}"
        stroke="var(--line)" stroke-opacity=".5"/>
      ${fits ? `<text x="${(x + w / 2).toFixed(1)}" y="${bandY + 9}" font-size="6.6"
        fill="var(--text-dim)" text-anchor="middle" letter-spacing=".04em"
        font-family="ui-monospace,monospace">${esc(name)}</text>` : ''}
    </g>`;
  }).join('');

  const mobile = MOBILE.map(([lo, hi, name, longName]) => {
    const { x, w } = seg(lo, hi);
    return `<g><title>5G NR ${esc(longName || name)}</title>
      <rect x="${x.toFixed(1)}" y="${mobY}" width="${w.toFixed(1)}" height="${mobH}" rx="2"
        fill="var(--accent-2)" fill-opacity=".14" stroke="var(--accent-2)" stroke-opacity=".35"/>
      ${w > name.length * 3.9 + 3 ? `<text x="${(x + w / 2).toFixed(1)}" y="${mobY + 7.4}"
        font-size="6.4" fill="var(--accent-2)" text-anchor="middle"
        font-family="ui-monospace,monospace">${esc(name)}</text>` : ''}
    </g>`;
  }).join('');

  const bar = (f, y, colour, label) => {
    if (!f) return '';
    const w = posOf(f) * span;
    const inside = w > span - 46;
    const tx = inside ? x0 + w - 6 : x0 + w + 6;
    return `
      <rect x="${x0}" y="${y}" width="${w.toFixed(1)}" height="9" rx="4.5"
        fill="${colour}" fill-opacity=".22" stroke="${colour}" stroke-width="1"/>
      <rect x="${x0}" y="${y}" width="${w.toFixed(1)}" height="9" rx="4.5" fill="${colour}" fill-opacity=".35"/>
      <text x="${tx.toFixed(1)}" y="${y + 7.4}" font-size="8" fill="${inside ? 'var(--bg)' : colour}"
        font-weight="${inside ? 700 : 400}" text-anchor="${inside ? 'end' : 'start'}"
        font-family="ui-monospace,monospace">${esc(label)}</text>`;
  };

  return `
<svg viewBox="0 0 ${W} ${H}" role="img"
  aria-label="Frequency coverage against the radio bands">
  ${bands}
  ${mobile}

  ${bar(d.freqA?.meta.fMax, barY, 'var(--accent)', d.freqA ? d.freqA.id : '')}
  ${d.freqB ? bar(d.freqB.meta.fMax, barY + 13, 'var(--accent-2)', d.freqB.id) : ''}
  ${d.freqA ? '' : `<text x="${x0 + 4}" y="${barY + 7.4}" font-size="7.5" fill="var(--text-faint)"
    font-family="ui-monospace,monospace">no frequency option chosen</text>`}

  <line x1="${x0}" y1="${axisY}" x2="${x1}" y2="${axisY}" stroke="var(--line)"/>
  ${ticks.map(([f, label], i) => {
    const tx = x0 + posOf(f) * span;
    const anchor = i === 0 ? 'start' : i === ticks.length - 1 ? 'end' : 'middle';
    return `<line x1="${tx.toFixed(1)}" y1="${axisY}" x2="${tx.toFixed(1)}" y2="${axisY + 4}" stroke="var(--line)"/>
      <text x="${tx.toFixed(1)}" y="${axisY + 14}" font-size="7.5" fill="var(--text-faint)"
        text-anchor="${anchor}" font-family="ui-monospace,monospace">${label}</text>`;
  }).join('')}
  <text x="${x0}" y="${H - 2}" font-size="7" fill="var(--text-faint)"
    >Every option starts at 100 kHz; the bar shows its upper limit.</text>
  <text x="${x1}" y="${H - 2}" font-size="7" fill="var(--text-faint)" text-anchor="end">Hz, logarithmic</text>
</svg>`;
}
