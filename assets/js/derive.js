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
function fadingChannels (units, k74, k75) {
  if (!units) return 0;
  if (units === 1) return 1;
  if (!k74) return 2;
  if (units === 2) return 4;
  return k75 ? 32 : 16;      // four modules installed
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
  let bandwidth = 0, bandwidthNote = '';
  if (genStd) {
    bandwidth = q(sel, 'K522') ? 160 : 120;
    bandwidthNote = q(sel, 'K522') ? 'R&S®SMW-K522' : 'R&S®SMW-B10 base';
  } else if (genWide) {
    if (q(sel, 'K527')) { bandwidth = 2000; bandwidthNote = 'R&S®SMW-K527'; }
    else if (q(sel, 'K525')) { bandwidth = 1000; bandwidthNote = 'R&S®SMW-K525'; }
    else { bandwidth = 500; bandwidthNote = 'R&S®SMW-B9 base'; }
  }
  // an extension bought once only lifts one of two paths
  const bwSecondPath = generators > 1 && bandwidth > (genStd ? 120 : 500)
    ? (q(sel, 'K522') > 1 || q(sel, 'K527') > 1 || q(sel, 'K525') > 1 ? bandwidth : (genStd ? 120 : 500))
    : bandwidth;

  /* --- ARB memory ------------------------------------------------ */
  let arb = 0;
  if (genStd) arb = q(sel, 'K512') ? 1024 : q(sel, 'K511') ? 512 : 64;
  else if (genWide) arb = q(sel, 'K515') ? 2048 : 256;

  /* --- fading ---------------------------------------------------- */
  const faders = q(sel, 'B14') + q(sel, 'B15');
  const channels = fadingChannels(faders, q(sel, 'K74'), q(sel, 'K75'));
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
