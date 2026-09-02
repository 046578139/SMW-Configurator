/**
 * Turns a selection into the capabilities of the resulting instrument.
 *
 * Figures come from the R&S(R)SMW200A specifications (PD 3606.8037.22 v31.00)
 * and the MIMO fading specifications (PD 3673.1276.22 v04.00); the option
 * dependencies come from the configuration guide.
 */

import { OPTIONS, BY_ID } from './catalog.js';
import { freqA, freqB, mainModule, rfPathCount } from './rules.js';

const q = (sel, id) => sel[id] || 0;

/** Logical fading channels, per the fading simulator specifications. */
/**
 * Logical faders available, from the MIMO and fading specifications.
 *
 * The two module types share every row of that table except the last: with
 * K74 and K75 and four modules installed, four B14 give up to 32 channels and
 * four B15 up to 64. They cannot be mixed, so the type is whichever is fitted.
 */
function fadingChannels (b14, b15, k74, k75) {
  const units = b14 + b15;
  if (!units) return 0;
  if (units === 1) return 1;
  if (!k74) return 2;
  if (units === 2) return 4;
  if (!k75) return 16;
  return b15 ? 64 : 32;
}

/**
 * Which connectors a configuration puts on which face of the instrument.
 *
 * The B81 to B84 options relocate the RF outputs from the front panel to the
 * rear, so the same frequency option lands on a different face depending on
 * what else is ordered. B81 and B83 take the path A I/Q inputs with them.
 */
function panelState (sel, a, b, paths, genStd, genWide) {
  const rearRfA = !!(sel.B81 || sel.B83);
  const rearRfB = !!(sel.B82 || sel.B84);
  return {
    rearRfA,
    rearRfB,
    // the guide sells B81/B83 as "rear panel connectors for RF path A and I/Q"
    rearIq: rearRfA,
    rfA: !!a && !rearRfA,
    rfB: paths > 1 && !rearRfB,
    iqA: !!a && !rearRfA,
    iqB: paths > 1,
    connA: a?.meta.conn || null,
    connB: b?.meta.conn || null,
    analogIqOut: !!(q(sel, 'K16') || q(sel, 'K17')),
    analogIqOut2: q(sel, 'K16') > 1,
    digitalOut: !!(q(sel, 'K18') || q(sel, 'K19')),
    hsDigital: !!sel.B13XT,
    modules: [
      ...Array(genStd).fill('standard'),
      ...Array(genWide).fill('wideband'),
      ...Array(q(sel, 'B14') + q(sel, 'B15')).fill('standard')
    ]
  };
}

export function derive (sel) {
  const a = freqA(sel);
  const b = freqB(sel);
  const mm = mainModule(sel);
  const paths = rfPathCount(sel);
  const section = mm ? BY_ID[mm].meta.bbSection : null;

  const genStd = q(sel, 'B10');
  const genWide = q(sel, 'B9') + q(sel, 'B9F');
  const generators = genStd + genWide;

  /* --- RF modulation bandwidth ---------------------------------- */

  /* An extension is per path: bought once it lifts the first path only, so the
     nth path gets whatever extension has been bought at least n times. Testing
     the quantities of all three extensions together, as this once did, let a
     second K527 raise a path whose bandwidth came from K522. */
  const bwFor = n => {
    if (genStd) return q(sel, 'K522') >= n ? 160 : 120;
    if (genWide) return q(sel, 'K527') >= n ? 2000 : q(sel, 'K525') >= n ? 1000 : 500;
    return 0;
  };
  const bandwidth = bwFor(1);
  const bwSecondPath = generators > 1 ? bwFor(2) : bandwidth;
  const bandwidthNote = !bandwidth ? ''
    : genStd ? (q(sel, 'K522') ? 'R&S®SMW-K522' : 'R&S®SMW-B10 base')
      : q(sel, 'K527') ? 'R&S®SMW-K527'
        : q(sel, 'K525') ? 'R&S®SMW-K525' : 'R&S®SMW-B9 base';

  /* --- ARB memory ------------------------------------------------ */
  let arb = 0;
  if (genStd) arb = q(sel, 'K512') ? 1024 : q(sel, 'K511') ? 512 : 64;
  else if (genWide) arb = q(sel, 'K515') ? 2048 : 256;

  /* --- fading ---------------------------------------------------- */
  const faders = q(sel, 'B14') + q(sel, 'B15');
  const channels = fadingChannels(q(sel, 'B14'), q(sel, 'B15'), q(sel, 'K74'), q(sel, 'K75'));
  let fadeBw = 0;
  if (q(sel, 'B14')) fadeBw = 160;
  else if (q(sel, 'B15')) fadeBw = q(sel, 'K823') ? 800 : q(sel, 'K822') ? 400 : 200;

  const mimo = q(sel, 'K75') ? 'up to 8×8' : q(sel, 'K74') ? 'up to 4×4' : faders ? 'SISO' : null;

  /* --- counts by family ------------------------------------------ */
  const countIn = section2 => OPTIONS
    .filter(o => o.section === section2 && sel[o.id])
    .reduce((n, o) => n + sel[o.id], 0);

  const waveforms = q(sel, 'K200-1') + q(sel, 'K200-5') * 5 + q(sel, 'K200-50') * 50;

  return {
    freqA: a, freqB: b, mainModule: mm, section, paths,
    fMax: Math.max(a?.meta.fMax || 0, b?.meta.fMax || 0),
    chassis: sel.B94L ? 'deep' : 'standard',
    generators, genStd, genWide,
    bandwidth, bandwidthNote, bwSecondPath,
    arb,
    faders, fadingChannels: channels, fadeBw, mimo,
    phaseNoise: sel.B711 ? 'Ultra low' : sel.B710 ? 'Improved close-in'
      : sel.B709 ? 'Low' : a ? 'Standard' : null,
    pulseModulator: q(sel, 'K22'),
    awgn: q(sel, 'K62'),
    clock: sel.K555 ? 4800 : null,
    standardsInternal: countIn('std-int'),
    standardsWinIQ: countIn('std-wiq'),
    pulseOptions: countIn('pulse'),
    waveforms,
    hasDigitalOut: !!(q(sel, 'K18') || q(sel, 'K19')),
    hasAnalogIQOut: !!(q(sel, 'K16') || q(sel, 'K17')),
    hasAnalogIQIn: !!q(sel, 'K739'),
    panel: panelState(sel, a, b, paths, genStd, genWide),
    coherent: !!q(sel, 'B90'),
    hwCount: OPTIONS.filter(o => o.id.startsWith('B') && sel[o.id]).reduce((n, o) => n + sel[o.id], 0),
    swCount: OPTIONS.filter(o => o.id.startsWith('K') && sel[o.id]).reduce((n, o) => n + sel[o.id], 0)
  };
}

/** The headline figures shown on the instrument panel. */
export function vitals (d) {
  const fmt = v => (v >= 1000 ? `${v / 1000} GHz` : `${v} MHz`);
  return [
    { key: 'freq', label: 'Frequency', value: d.fMax ? `to ${d.fMax} GHz` : '—',
      sub: d.paths > 1 ? `2 RF paths` : '1 RF path' },
    { key: 'bw', label: 'RF mod. bandwidth', value: d.bandwidth ? fmt(d.bandwidth) : '—',
      sub: d.bandwidthNote || 'no baseband generator' },
    { key: 'arb', label: 'ARB memory', value: d.arb ? (d.arb >= 1024 ? `${d.arb / 1024} Gsample` : `${d.arb} Msample`) : '—',
      sub: d.generators ? `${d.generators} × generator` : '—' },
    { key: 'fade', label: 'Fading', value: d.fadingChannels ? `${d.fadingChannels} channels` : '—',
      sub: d.mimo || 'no fading simulator' },
    { key: 'pn', label: 'Phase noise', value: d.phaseNoise || '—',
      sub: d.coherent ? 'phase coherent' : 'standard coupling' },
    { key: 'std', label: 'Standards', value: `${d.standardsInternal + d.standardsWinIQ}`,
      sub: `${d.standardsInternal} internal · ${d.standardsWinIQ} WinIQSIM2` }
  ];
}
