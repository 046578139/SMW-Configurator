/**
 * Turns a selection into the capabilities of the resulting R&S FSW.
 *
 * Figures come from the FSW specifications (PD 5215.6749.22 v17.01): the
 * models' frequency ranges and connectors (p32, p43), the analysis
 * bandwidth options (p44/45), the preamplifier and attenuator (p39), the
 * baseband inputs (p37, p40/41), the streaming interfaces (p38) and the
 * real-time options (p45, p48).
 */

import { OPTIONS, BY_ID, MODELS, typeName } from './catalog.js';
import { modelOpt, analysisBw, anyOf } from './rules.js';

const q = (sel, id) => sel[id] || 0;

/** The widest real-time capability installed, hardware or application. */
function realtimeOf (sel) {
  let best = null;
  for (const o of OPTIONS) {
    const rt = o.meta?.realtime;
    if (!rt || !sel[o.id]) continue;
    if (!best || rt.bw > best.bw) best = { ...rt, by: o.id };
  }
  return best;
}

/**
 * Which connectors a configuration puts on the instrument. The specifications
 * give the inventory; the model and the options decide what is fitted.
 */
function panelState (sel, model, d) {
  const m = model?.id || null;
  const m26 = MODELS.indexOf(m) >= MODELS.indexOf('FSW26');
  return {
    model: !!model,
    conn: model?.meta.conn || null,
    rf2: m === 'FSW85',
    extMixer: d.extMixer,
    analogBb: d.analogBb > 0,
    analogBbInv: d.analogBb > 0 && m !== 'FSW85',
    ifWide: ['B160', 'U160', 'B320', 'U320', 'B512', 'U512', 'B512R', 'U512R'].some(id => sel[id]),
    if2g: !!model && m26,
    digitalIq: d.digitalIq,
    stream: d.stream > 0,
    extGen: !!sel.B10,
    usbRemote: !!sel.B112
  };
}

export function derive (sel) {
  const model = modelOpt(sel);
  const { bw, by } = analysisBw(sel);
  const fMax = model ? (sel.B90G ? 90 : model.meta.fMax) : 0;

  const preampId = anyOf(sel, 'B24ANY');
  const preamp = preampId ? BY_ID[preampId].meta.preamp : 0;
  const b71 = anyOf(sel, 'B71ANY');
  const analogBb = b71 ? (sel.B71E ? 80 : 40) : 0;
  const extMixerId = anyOf(sel, 'B21ANY');
  const stream = sel.B1017 ? 1000 : sel.B517 ? 512 : 0;
  const memory = sel.B124 ? 24 : sel.B108 ? 8 : sel.B106 ? 6 : 0;
  const rbwMax = (sel['B8-26'] || sel['B8-02']) ? 80 : sel.B8E ? 40 : 10;
  const realtime = realtimeOf(sel);

  const countIn = section => OPTIONS
    .filter(o => o.section === section && sel[o.id])
    .reduce((n, o) => n + sel[o.id], 0);
  const floating = OPTIONS.filter(o => o.floating && sel[o.id]).length;
  const apps = countIn('gp-apps') + countIn('cellular') + countIn('wireless') + countIn('realtime') + floating;

  const d = {
    model, fMax,
    conn: model?.meta.conn || null,
    supplied: model?.meta.supplied || null,
    bandwidth: bw, bandwidthBy: by,
    bandwidthNote: by ? typeName(by) : 'standard, no option',
    realtime,
    preamp, preampBy: preampId,
    eAtt: !!sel.B25,
    ocxo: !!sel.B4,
    rbwMax,
    harmonicFilters: !!sel.B13,
    extMixer: !!extMixerId,
    extension90: !!sel.B90G,
    digitalIq: !!sel.B17,
    analogBb,
    scopeIq: !!sel.B2071,
    stream,
    memory,
    extGen: !!sel.B10,
    upgrades: OPTIONS.filter(o => o.meta?.upgrade && sel[o.id]).map(o => o.id),
    apps, floating,
    appsGeneral: countIn('gp-apps'),
    appsStandards: countIn('cellular') + countIn('wireless'),
    appsRealtime: countIn('realtime'),
    weight: model?.meta.weight || null,
    hwCount: OPTIONS.filter(o => !o.accessory && !o.baseModel && /^(B|U|FL)/.test(o.id) && sel[o.id]).reduce((n, o) => n + sel[o.id], 0),
    swCount: OPTIONS.filter(o => !o.accessory && /^(K|VSE)/.test(o.id) && sel[o.id]).reduce((n, o) => n + sel[o.id], 0),
    accessoryCount: OPTIONS.filter(o => o.accessory && sel[o.id]).reduce((n, o) => n + sel[o.id], 0),
    /* the shell's drawings expect these names */
    paths: 1,
    generators: 0
  };
  d.panel = panelState(sel, model, d);
  void q;
  return d;
}

/** The headline figures shown on the instrument panel. */
export function vitals (d) {
  const fmt = v => (v >= 1000 ? `${v / 1000} GHz` : `${v} MHz`);
  const short = c => (c ? c.replace(/ \(.*?\)/g, '').replace('; RF input 2: ', ' + ') : '');
  return [
    { key: 'freq', label: 'Frequency', value: d.fMax ? `2 Hz to ${d.fMax} GHz` : '—',
      sub: d.model ? `${d.model.id}${d.extension90 ? ' + B90G' : ''} · ${short(d.conn)}` : 'no model' },
    { key: 'bw', label: 'Analysis bandwidth', value: fmt(d.bandwidth),
      sub: d.bandwidthNote },
    { key: 'rt', label: 'Real-time', value: d.realtime ? `${fmt(d.realtime.bw)}` : '—',
      sub: d.realtime ? `POI ${d.realtime.poi} · ${typeName(d.realtime.by)}` : 'no real-time option' },
    { key: 'fe', label: 'RF front end', value: d.preamp ? `preamp to ${d.preamp} GHz` : 'no preamplifier',
      sub: [d.eAtt ? 'electronic attenuator' : null, d.ocxo ? 'OCXO' : null, `RBW to ${d.rbwMax} MHz`].filter(Boolean).join(' · ') },
    { key: 'io', label: 'Inputs and memory', value: d.memory ? `+${d.memory} GB I/Q` : 'standard memory',
      sub: [d.digitalIq ? 'digital I/Q' : null, d.analogBb ? `analog BB ${d.analogBb} MHz` : null,
        d.scopeIq ? 'oscilloscope I/Q' : null, d.extMixer ? 'external mixers' : null,
        d.stream ? `40G stream ${fmt(d.stream)}` : null].filter(Boolean).join(' · ') || 'RF input only' },
    { key: 'apps', label: 'Applications', value: `${d.apps}`,
      sub: `${d.appsGeneral} general · ${d.appsStandards} standards · ${d.appsRealtime} real-time${d.floating ? ` · ${d.floating} floating` : ''}` }
  ];
}
