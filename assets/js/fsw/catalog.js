/**
 * R&S(R)FSW signal and spectrum analyzer option catalog.
 *
 * Rohde & Schwarz publishes no configuration guide for the FSW the way it
 * does for the SMW200A, so every row here is transcribed from the ordering
 * information of "R&S(R)FSW Signal and Spectrum Analyzer - Specifications",
 * version 17.01, September 2025 (PD 5215.6749.22), pages 43 to 51, kept in
 * docs/source/fsw/. The `page` field points at the page a row came from. The
 * application data sheets in the same directory were read for the rows
 * whose prerequisites the specifications only imply; where one adds
 * something, the row's note says which.
 *
 * The FSW differs from the SMW200A in one structural way: the base unit is
 * one of seven models (R&S FSW8 to FSW85, order numbers 1331.5003.08 to
 * .85) rather than a chassis plus a frequency option. The models are
 * catalog entries like everything else - a single-select group the rules
 * treat as the instrument's base line - so a requirement can name them:
 * "for R&S FSW26/43/50/67/85" is `requires: 'M26P'`.
 *
 * Requirement expressions use the mini-language parsed in rules.js:
 *   A&B   both        A|B   either        A*2   two units of A
 *   (...) grouping    and the named shorthands below
 */

import { productCode } from '../util.js';

/**
 * A stand-in for the parts list's base line: the chosen model takes its
 * place (the profile's `bomBase`). Its id is what the URL and the reader
 * fall back to when no model has been chosen yet.
 */
export const BASE_UNIT = {
  id: 'FSW',
  name: 'R&S®FSW signal and spectrum analyzer – choose a model',
  sub: 'The model is the base unit: R&S®FSW8 to R&S®FSW85',
  order: '1331.5003.xx'
};

export const GUIDE = {
  title: 'R&S®FSW Signal and Spectrum Analyzer – Specifications, ordering information',
  version: 'Version 17.01, September 2025',
  pd: 'PD 5215.6749.22'
};

/* ------------------------------------------------------------------ *
 * Models
 * ------------------------------------------------------------------ */

/** The seven models, lowest first; the order the ladder and swaps use. */
export const MODELS = ['FSW8', 'FSW13', 'FSW26', 'FSW43', 'FSW50', 'FSW67', 'FSW85'];

/**
 * The analysis bandwidth options, one per instrument, lowest first. The
 * real-time analyzers include a bandwidth (B512R: 512 MHz, B800R: 2 GHz)
 * and take the same slot. U-options are upgrades of an instrument already
 * in the field; they are multi-select and count as the bandwidth they
 * produce (see SHORTHAND).
 */
export const BANDWIDTH = ['B40', 'B80', 'B160', 'B320', 'B512', 'B512R', 'B1200', 'B2001', 'B800R', 'B4001', 'B6001', 'B8001'];

/* ------------------------------------------------------------------ *
 * Named shorthands used inside requirement expressions
 * ------------------------------------------------------------------ */
export const SHORTHAND = {
  MODEL: MODELS.join('|'),
  M8TO13: 'FSW8|FSW13',
  M8TO26: 'FSW8|FSW13|FSW26',
  M26P: 'FSW26|FSW43|FSW50|FSW67|FSW85',
  M26TO50: 'FSW26|FSW43|FSW50',
  M26TO67: 'FSW26|FSW43|FSW50|FSW67',
  M43P: 'FSW43|FSW50|FSW67|FSW85',
  M43TO67: 'FSW43|FSW50|FSW67',
  /* "to support signal analysis bandwidths > 10 MHz, one of the B40/-B80/-B160/-B320/-B512/-B512R/-B1200/-B2001/-B800R/-B4001/-B6001/-B8001 options required" (p46/47) */
  BW10: 'B40|U40|B80|U80|B160|U160|B320|U320|B512|U512|B512R|U512R|B1200|U1200|B2001|U2001|B800R|B4001|U4001|U4002|B6001|U6001|B8001|U8001',
  BW160: 'B160|U160|B320|U320|B512|U512|B512R|U512R|B1200|U1200|B2001|U2001|B800R|B4001|U4001|U4002|B6001|U6001|B8001|U8001',
  BW320: 'B320|U320|B512|U512|B512R|U512R|B1200|U1200|B2001|U2001|B800R|B4001|U4001|U4002|B6001|U6001|B8001|U8001',
  BW512: 'B512|U512|B512R|U512R|B1200|U1200|B2001|U2001|B800R|B4001|U4001|U4002|B6001|U6001|B8001|U8001',
  BW1200: 'B1200|U1200|B2001|U2001|B800R|B4001|U4001|U4002|B6001|U6001|B8001|U8001',
  BW2001: 'B2001|U2001|B800R|B4001|U4001|U4002|B6001|U6001|B8001|U8001',
  BW4001: 'B4001|U4001|U4002|B6001|U6001|B8001|U8001',
  /* any R&S FSW-B24 (one order number per model), any B71, any B21, any B8 */
  B24ANY: 'B24-13|B24-26|B24-43|B24-49|B24-51|B24-66|B24-67',
  B24EDR: 'B24-43|B24-49|B24-51|B24-66|B24-67',
  B71ANY: 'B71-13|B71-26|B71-67|B71-86',
  B21ANY: 'B21-28|B21-86',
  B8ANY: 'B8E|B8-26|B8-02',
  /* a 5G NR base licence, downlink or uplink */
  NR: 'K144|K145',
  DIGIQ40: 'B517|B1017'
};

/**
 * RF input connector fitted to each model, from the "Inputs and outputs"
 * table (p32). The FSW85 has two RF inputs.
 */
export const RF_CONNECTOR = {
  FSW8: 'N female',
  FSW13: 'N female',
  FSW26: 'APC 3.5 mm male (compatible with SMA)',
  FSW43: '2.92 mm male (compatible with SMA)',
  FSW50: '1.85 mm male (compatible with 2.4 mm)',
  FSW67: '1.85 mm male (compatible with 2.4 mm)',
  FSW85: '1.00 mm male; RF input 2: 1.85 mm male'
};

/** The adapter and tools supplied with a model (p43, "Accessories supplied"). */
export const SUPPLIED = {
  FSW26: 'adapter 3.5 mm (APC3.5-compatible) female/female',
  FSW43: 'adapter 2.92 mm female/female',
  FSW50: 'adapter 1.85 mm female/female',
  FSW67: 'adapter 1.85 mm female/female',
  FSW85: 'adapter 1.0 mm female/female and 1.85 mm female/female, torque wrench for 1.0 mm connectors (0.23 Nm)'
};

/* ------------------------------------------------------------------ *
 * Sections shown in the configurator
 * ------------------------------------------------------------------ */
export const SECTIONS = [
  { id: 'model',     label: 'Model',                    steps: [], kind: 'single', icon: 'wave',
    blurb: 'Mandatory. The model is the base unit and sets the upper frequency limit, the RF input connector and which hardware options exist for it. It cannot be changed later.' },
  { id: 'bandwidth', label: 'Analysis bandwidth',       steps: [], kind: 'single', icon: 'sliders',
    blurb: 'One option per instrument: every FSW analyses 28 MHz without an option; the options raise that to 40 MHz … 8.3 GHz, and the two real-time analyzers include 512 MHz and 2 GHz. Most measurement applications need a minimum.' },
  { id: 'rf-hw',     label: 'RF front end',             steps: [], kind: 'multi',  icon: 'plus',
    blurb: 'Preamplifier, electronic attenuator, reference, resolution bandwidth, harmonic filters, external mixer connections and the 90 GHz extension. Several carry a different order number per model; the ones for the chosen model are shown.' },
  { id: 'io-hw',     label: 'Inputs, outputs and memory', steps: [], kind: 'multi', icon: 'stack',
    blurb: 'Baseband inputs (digital, analog, oscilloscope), the 40 Gbit/s I/Q streaming output, I/Q memory extensions, generator control, storage and remote control.' },
  { id: 'gp-apps',   label: 'General-purpose applications', steps: [], kind: 'multi', icon: 'pulse',
    blurb: 'Pulse, transient, modulation, amplifier, noise, phase noise, spurious, EMI and vector signal analysis, plus corrections, streaming and monitoring services. Keycodes, installed by the user.' },
  { id: 'cellular',  label: 'Cellular standards',       steps: [], kind: 'multi',  icon: 'radio',
    blurb: 'GSM, WCDMA, TD-SCDMA, CDMA2000, 1xEV-DO, LTE, NB-IoT, Verizon 5GTF and 5G NR measurement applications. Many need an analysis bandwidth option to cover the channel bandwidths of the standard.' },
  { id: 'wireless',  label: 'Wireless, broadband and satellite', steps: [], kind: 'multi', icon: 'wifi',
    blurb: 'Bluetooth®, WLAN (802.11a to 802.11bn, ad and ay), UWB, DOCSIS 3.1 and OneWeb measurement applications.' },
  { id: 'realtime',  label: 'Real-time analysis',       steps: [], kind: 'multi',  icon: 'noise',
    blurb: 'The real-time measurement applications; each needs a particular analysis bandwidth option and is not offered with the others. The real-time hardware (R&S®FSW-B512R, -B800R) is under Analysis bandwidth.' },
  { id: 'floating',  label: 'Floating licences',        steps: [], kind: 'multi',  icon: 'pc',
    blurb: 'Every application marked "also available as floating license" in the ordering information, under its .51 order number. A floating licence needs the R&S®FSW-FL smart card and cannot be combined with the fixed licence of the same application.' },
  { id: 'upgrades',  label: 'Upgrades',                 steps: [], kind: 'multi',  icon: 'refresh',
    blurb: 'For an instrument already in the field: each upgrade needs the bandwidth it starts from and counts as the bandwidth it produces. A new instrument takes the option itself.' },
  { id: 'extras',    label: 'Accessories',              steps: [], kind: 'extras', icon: 'box',
    blurb: 'Rack adapter, noise sources, attenuators, adapters, cables, external mixers, frontends and tools from the ordering information. They carry no configuration rules, so pick what you need and set the quantity yourself – a card says when the configuration suggests one.' }
];

/* ------------------------------------------------------------------ *
 * Option catalog
 *
 * id          option code without the "R&S(R)FSW-" prefix; a model is its
 *             own code (FSW26); an option sold under one code with one
 *             order number per model carries the number's suffix (B24-26)
 * name        designation as printed in the ordering information
 * order       R&S order number
 * page        page of the specifications the row is transcribed from
 * section     section id above
 * group       sub-heading inside the section
 * requires    machine-checkable requirement expression (null = none)
 * reqText     the ordering information's own wording, shown in the UI
 * conflicts   option ids that may not be installed at the same time
 * note        the ordering information's "Remarks" column, and anything a
 *             data sheet adds
 * retrofit    'no' | 'factory' | 'service' | 'user' | 'keycode' | 'accessory'
 * meta        values used to derive instrument capabilities; `models`
 *             lists the models a per-model order number is for
 * baseModel   true for the seven models
 * floating    true for a .51 floating licence
 * code/brand  the type designation printed on a quotation
 * accessory   true for the ordering information's extras, which carry no rules
 * hintIf      expression that makes an accessory's card say it is suggested
 * ------------------------------------------------------------------ */

const M = (id, ghz, order, weight) => ({
  id, name: `Signal and spectrum analyzer, 2 Hz to ${ghz} GHz`, order, page: 43,
  section: 'model', group: 'Models', retrofit: 'no', baseModel: true,
  code: id, brand: 'R&S®',
  note: id === 'FSW85' ? '2 Hz to 90 GHz with R&S®FSW-B90G (YIG preselector off). Two RF inputs: 1.00 mm to 85 GHz and 1.85 mm to 67 GHz.' : undefined,
  meta: { fMax: ghz, conn: RF_CONNECTOR[id], supplied: SUPPLIED[id] || null, weight }
});

const BW = (id, name, order, mhz, opts = {}) => ({
  id, name, order, page: 44, section: 'bandwidth', group: 'Analysis bandwidth',
  retrofit: 'service', meta: { bw: mhz }, ...opts
});

/* a keycode application */
const K = (id, name, order, page, section, group, opts = {}) => ({
  id, name, order, page, section, group, retrofit: 'keycode', ...opts
});

/* an upgrade of an instrument already in the field */
const U = (id, name, order, mhz, requires, opts = {}) => ({
  id, name, order, page: 49, section: 'upgrades', group: 'Analysis bandwidth upgrades',
  retrofit: 'user', requires, meta: { bw: mhz, upgrade: true }, ...opts
});

export const OPTIONS = [

  /* -- Models (p43) ------------------------------------------------ */
  M('FSW8',  8,    '1331.5003.08', 20.2),
  M('FSW13', 13.6, '1331.5003.13', 21.5),
  M('FSW26', 26.5, '1331.5003.26', 21.5),
  M('FSW43', 43.5, '1331.5003.43', 22.4),
  M('FSW50', 50,   '1331.5003.50', 22.4),
  M('FSW67', 67,   '1331.5003.67', 23.7),
  M('FSW85', 85,   '1331.5003.85', 27.9),

  /* -- Analysis bandwidth (p44/45) --------------------------------- */
  BW('B40',   '40 MHz analysis bandwidth',    '1313.0861.02', 40,   { retrofit: 'user' }),
  BW('B80',   '80 MHz analysis bandwidth',    '1313.0878.02', 80,   { retrofit: 'user' }),
  BW('B160',  '160 MHz analysis bandwidth',   '1325.4850.14', 160),
  BW('B320',  '320 MHz analysis bandwidth',   '1325.4867.14', 320,  { note: 'Includes 200 MHz IF filter.' }),
  BW('B512',  '512 MHz analysis bandwidth',   '1331.7106.14', 512,  { note: 'Includes 200 MHz IF filter.' }),
  BW('B1200', '1.2 GHz analysis bandwidth',   '1331.6400.14', 1200, { requires: 'M26P',
    reqText: 'R&S®FSW26/43/50/67/85',
    note: 'For R&S®FSW26/43/50/67/85 ex-factory and for later upgrade of instruments without analysis bandwidth option; an instrument with one takes R&S®FSW-U1200 instead.' }),
  BW('B2001', '2 GHz analysis bandwidth',     '1331.6916.14', 2000, { requires: 'M26P',
    reqText: 'R&S®FSW26/43/50/67/85',
    note: 'For R&S®FSW26/43/50/67/85 ex-factory and for later upgrade of instruments without analysis bandwidth option; an instrument with R&S®FSW-B1200 takes R&S®FSW-U2001 instead.' }),
  BW('B4001', '4.4 GHz analysis bandwidth',   '1338.5215.14', 4400, { requires: 'M43P', page: 44,
    reqText: 'R&S®FSW43/50/67/85', conflicts: ['B517'],
    note: 'For R&S®FSW43/50/67/85 ex-factory and for later upgrade of instruments without analysis bandwidth option (with B80/B160/B320/B512: R&S®FSW-U4001; with B1200/B2001: R&S®FSW-U4002). Retrofittable from serial numbers FSW43 101587, FSW50 101420, FSW67 101540, FSW85 101650. Not available with R&S®FSW-B517.' }),
  BW('B6001', '6.4 GHz analysis bandwidth',   '1338.5221.14', 6400, { requires: 'M43P', page: 44,
    reqText: 'R&S®FSW43/50/67/85', conflicts: ['B517'],
    note: 'For R&S®FSW43/50/67/85 ex-factory; later upgrades go through R&S®FSW-U4001/-U4002 and -U6001. Same serial-number limit as B4001. Not available with R&S®FSW-B517.' }),
  BW('B8001', '8.312 GHz analysis bandwidth', '1338.5238.14', 8312, { requires: 'M43P', page: 45,
    reqText: 'R&S®FSW43/50/67/85', conflicts: ['B517'],
    note: 'For R&S®FSW43/50/67/85 ex-factory; later upgrades go through R&S®FSW-U4001/-U4002, -U6001 and -U8001. Same serial-number limit as B4001. Not available with R&S®FSW-B517.' }),
  { id: 'B512R', name: 'Real-time spectrum analyzer 512 MHz, POI ≤ 15 µs', order: '1331.7106.16', page: 45,
    section: 'bandwidth', group: 'Real-time analyzers', retrofit: 'service',
    note: 'Includes 512 MHz analysis bandwidth and 200 MHz IF filter. Upper operating temperature with active real-time analysis limited to +45 °C (p35).',
    meta: { bw: 512, realtime: { bw: 512, poi: '≤ 15 µs' } } },
  { id: 'B800R', name: 'Real-time spectrum analyzer 800 MHz, POI ≤ 15 µs', order: '1331.6400.16', page: 45,
    section: 'bandwidth', group: 'Real-time analyzers', retrofit: 'service',
    requires: 'M26P', reqText: 'R&S®FSW26/43/50/67/85',
    note: 'For R&S®FSW26/43/50/67/85. Includes 2000 MHz analysis bandwidth; export license required. Upper operating temperature with active real-time analysis limited to +40 °C (p35).',
    meta: { bw: 2000, realtime: { bw: 800, poi: '≤ 15 µs' } } },

  /* -- RF front end (p43/44/45) ------------------------------------ */
  { id: 'B4', name: 'OCXO precision frequency reference', order: '1313.0703.02', page: 43,
    section: 'rf-hw', group: 'Reference and resolution bandwidth', retrofit: 'user' },
  { id: 'B8E', name: 'Resolution bandwidth up to 40 MHz', order: '1338.6911.02', page: 43,
    section: 'rf-hw', group: 'Reference and resolution bandwidth', retrofit: 'user',
    conflicts: ['B8-26', 'B8-02'],
    note: 'For every model. The signal analysis bandwidth is defined by the analysis bandwidth options, not by this option. Retrofittable from serial numbers FSW8 101342, FSW13 101344, FSW26 101664, FSW43 101450, FSW50 101322, FSW67 101409, FSW85 101573.' },
  { id: 'B8-26', name: 'Resolution bandwidth up to 80 MHz', order: '1313.2464.26', page: 43,
    section: 'rf-hw', group: 'Reference and resolution bandwidth', retrofit: 'service',
    requires: 'M8TO26', reqText: 'R&S®FSW8/13/26', conflicts: ['B8E', 'B8-02'],
    note: 'For R&S®FSW8/13/26. The signal analysis bandwidth is defined by the analysis bandwidth options, not by this option.',
    meta: { models: ['FSW8', 'FSW13', 'FSW26'] } },
  { id: 'B8-02', name: 'Resolution bandwidth up to 80 MHz', order: '1313.2464.02', page: 43,
    section: 'rf-hw', group: 'Reference and resolution bandwidth', retrofit: 'service',
    requires: 'M43P', reqText: 'R&S®FSW43/50/67/85', conflicts: ['B8E', 'B8-26'],
    note: 'For R&S®FSW43/50/67/85; export license required. The signal analysis bandwidth is defined by the analysis bandwidth options, not by this option.',
    meta: { models: ['FSW43', 'FSW50', 'FSW67', 'FSW85'] } },

  { id: 'B24-13', name: 'RF preamplifier, 100 kHz to 13.6 GHz', order: '1313.0832.13', page: 44,
    section: 'rf-hw', group: 'Preamplifier and attenuator', retrofit: 'service',
    requires: 'M8TO13', reqText: 'R&S®FSW8/13', conflicts: ['B24-26', 'B24-43', 'B24-49', 'B24-51', 'B24-66', 'B24-67'],
    note: 'For R&S®FSW8/13. Gain 15 dB or 30 dB, selectable (p39).',
    meta: { models: ['FSW8', 'FSW13'], preamp: 13.6 } },
  { id: 'B24-26', name: 'RF preamplifier, 100 kHz to 26.5 GHz', order: '1313.0832.26', page: 44,
    section: 'rf-hw', group: 'Preamplifier and attenuator', retrofit: 'service',
    requires: 'FSW26', reqText: 'R&S®FSW26', conflicts: ['B24-13', 'B24-43', 'B24-49', 'B24-51', 'B24-66', 'B24-67'],
    note: 'For R&S®FSW26. Gain 15 dB or 30 dB, selectable (p39).',
    meta: { models: ['FSW26'], preamp: 26.5 } },
  { id: 'B24-43', name: 'RF preamplifier, 100 kHz to 43.5 GHz', order: '1313.0832.43', page: 44,
    section: 'rf-hw', group: 'Preamplifier and attenuator', retrofit: 'service',
    requires: 'FSW43', reqText: 'R&S®FSW43', conflicts: ['B24-13', 'B24-26', 'B24-49', 'B24-51', 'B24-66', 'B24-67'],
    note: 'For R&S®FSW43. 15 dB gain from serial number 102163; the enhanced dynamic range preamplifier is included from serial number 102224 (p39, p49).',
    meta: { models: ['FSW43'], preamp: 43.5 } },
  { id: 'B24-49', name: 'RF preamplifier, 100 kHz to 50 GHz', order: '1313.0832.49', page: 44,
    section: 'rf-hw', group: 'Preamplifier and attenuator', retrofit: 'service',
    requires: 'FSW50', reqText: 'R&S®FSW50', conflicts: ['B24-13', 'B24-26', 'B24-43', 'B24-51', 'B24-66', 'B24-67'],
    note: 'For R&S®FSW50. The ordering information lists two order numbers for this model (.49 and .51) without saying what tells them apart – confirm with Rohde & Schwarz.',
    meta: { models: ['FSW50'], preamp: 50 } },
  { id: 'B24-51', name: 'RF preamplifier, 100 kHz to 50 GHz', order: '1313.0832.51', page: 44,
    section: 'rf-hw', group: 'Preamplifier and attenuator', retrofit: 'service',
    requires: 'FSW50', reqText: 'R&S®FSW50', conflicts: ['B24-13', 'B24-26', 'B24-43', 'B24-49', 'B24-66', 'B24-67'],
    note: 'For R&S®FSW50. Second of the two order numbers listed for this model – confirm with Rohde & Schwarz.',
    meta: { models: ['FSW50'], preamp: 50 } },
  { id: 'B24-66', name: 'RF preamplifier, 100 kHz to 67 GHz', order: '1313.0832.66', page: 44,
    section: 'rf-hw', group: 'Preamplifier and attenuator', retrofit: 'service',
    requires: 'FSW67', reqText: 'R&S®FSW67', conflicts: ['B24-13', 'B24-26', 'B24-43', 'B24-49', 'B24-51', 'B24-67'],
    note: 'For R&S®FSW67. The ordering information lists two order numbers for this model (.66 and .67) without saying what tells them apart – confirm with Rohde & Schwarz.',
    meta: { models: ['FSW67'], preamp: 67 } },
  { id: 'B24-67', name: 'RF preamplifier, 100 kHz to 67 GHz', order: '1313.0832.67', page: 44,
    section: 'rf-hw', group: 'Preamplifier and attenuator', retrofit: 'service',
    requires: 'FSW67', reqText: 'R&S®FSW67', conflicts: ['B24-13', 'B24-26', 'B24-43', 'B24-49', 'B24-51', 'B24-66'],
    note: 'For R&S®FSW67. Second of the two order numbers listed for this model – confirm with Rohde & Schwarz.',
    meta: { models: ['FSW67'], preamp: 67 } },
  { id: 'B25', name: 'Electronic attenuator, 1 dB steps', order: '1313.0990.02', page: 44,
    section: 'rf-hw', group: 'Preamplifier and attenuator', retrofit: 'service',
    requires: 'M8TO26', reqText: 'R&S®FSW8/13/26',
    note: 'For R&S®FSW8/13/26. 0 dB to 30 dB in 1 dB steps, 10 MHz to 8 GHz (FSW8) or 13.6 GHz (FSW13/26) (p39).',
    meta: { models: ['FSW8', 'FSW13', 'FSW26'] } },

  { id: 'B13', name: 'Highpass filter for harmonic measurements', order: '1313.0761.02', page: 43,
    section: 'rf-hw', group: 'Filters, mixers and frequency extension', retrofit: 'user',
    note: 'Two filters: 1 GHz to 1.75 GHz and 1.75 GHz to 3 GHz, stopband attenuation > 20 dB (p37).' },
  { id: 'B21-28', name: 'LO/IF connections for external mixers', order: '1313.1100.28', page: 43,
    section: 'rf-hw', group: 'Filters, mixers and frequency extension', retrofit: 'service',
    requires: 'M26TO67', reqText: 'R&S®FSW26/43/50/67', conflicts: ['B21-86'],
    note: 'For R&S®FSW26/43/50/67. Includes two 1 m cables for the IF and LO ports. LO 7.65 GHz to 17.45 GHz; 2-port mixers are not supported with B800R/B1200/B2001/B4001/B6001/B8001 (p38).',
    meta: { models: ['FSW26', 'FSW43', 'FSW50', 'FSW67'] } },
  { id: 'B21-86', name: 'LO/IF connections for external mixers', order: '1313.1100.86', page: 43,
    section: 'rf-hw', group: 'Filters, mixers and frequency extension', retrofit: 'service',
    requires: 'FSW85', reqText: 'R&S®FSW85', conflicts: ['B21-28'],
    note: 'For R&S®FSW85. Includes two 1 m cables for the IF and LO ports.',
    meta: { models: ['FSW85'] } },
  { id: 'B90G', name: 'Frequency extension 90 GHz', order: '1331.7693.02', page: 45,
    section: 'rf-hw', group: 'Filters, mixers and frequency extension', retrofit: 'no',
    requires: 'FSW85', reqText: 'R&S®FSW85 only',
    note: 'For R&S®FSW85 only; without preselection above 85 GHz. Not retrofittable.',
    meta: { models: ['FSW85'], fMax: 90 } },

  /* -- Inputs, outputs and memory (p43/45) ------------------------- */
  { id: 'B17', name: 'Digital baseband interface', order: '1313.0784.02', page: 43,
    section: 'io-hw', group: 'Baseband inputs', retrofit: 'user',
    note: 'R&S®Digital I/Q Interface in and out, 26-pin MDR, up to 200 Msample/s; I/Q bandwidth 28 MHz, or 40/80/160 MHz with the matching analysis bandwidth option (p37). The R&S®SMU-Z6 cable connects it to another R&S instrument.',
    meta: { digitalIq: true } },
  { id: 'B71-13', name: 'Analog baseband inputs, 40 MHz analysis bandwidth', order: '1313.1651.13', page: 45,
    section: 'io-hw', group: 'Baseband inputs', retrofit: 'service',
    requires: 'M8TO13', reqText: 'R&S®FSW8/13', conflicts: ['B71-26', 'B71-67', 'B71-86'],
    note: 'For R&S®FSW8/13. Four BNC inputs (I, Q and their inverses), DC to 40 MHz, ±0.25 V to ±2 V full scale (p40).',
    meta: { models: ['FSW8', 'FSW13'], analogBb: 40 } },
  { id: 'B71-26', name: 'Analog baseband inputs, 40 MHz analysis bandwidth', order: '1313.1651.26', page: 45,
    section: 'io-hw', group: 'Baseband inputs', retrofit: 'service',
    requires: 'M26TO50', reqText: 'R&S®FSW26/43/50', conflicts: ['B71-13', 'B71-67', 'B71-86'],
    note: 'For R&S®FSW26/43/50. Four BNC inputs (I, Q and their inverses), DC to 40 MHz (p40).',
    meta: { models: ['FSW26', 'FSW43', 'FSW50'], analogBb: 40 } },
  { id: 'B71-67', name: 'Analog baseband inputs, 40 MHz analysis bandwidth', order: '1313.1651.67', page: 45,
    section: 'io-hw', group: 'Baseband inputs', retrofit: 'service',
    requires: 'FSW67', reqText: 'R&S®FSW67', conflicts: ['B71-13', 'B71-26', 'B71-86'],
    note: 'For R&S®FSW67. RF measurements using probes are not available on the FSW67 (p41).',
    meta: { models: ['FSW67'], analogBb: 40 } },
  { id: 'B71-86', name: 'Analog baseband inputs, 40 MHz analysis bandwidth', order: '1313.1651.86', page: 45,
    section: 'io-hw', group: 'Baseband inputs', retrofit: 'service',
    requires: 'FSW85', reqText: 'R&S®FSW85', conflicts: ['B71-13', 'B71-26', 'B71-67'],
    note: 'For R&S®FSW85. The inverted inputs and probe measurements are not available on the FSW85 (p40, p41).',
    meta: { models: ['FSW85'], analogBb: 40 } },
  { id: 'B71E', name: '80 MHz analysis bandwidth for analog baseband inputs', order: '1313.6547.02', page: 45,
    section: 'io-hw', group: 'Baseband inputs', retrofit: 'user',
    requires: 'B71ANY', reqText: 'R&S®FSW-B71',
    note: 'R&S®FSW-B71 required. Extends the analog baseband inputs from 40 MHz to 80 MHz.',
    meta: { analogBb: 80 } },
  { id: 'B2071', name: 'Oscilloscope baseband inputs', order: '1331.8302.02', page: 45,
    section: 'io-hw', group: 'Baseband inputs', retrofit: 'user',
    note: 'Available for all models. Records I/Q data through an R&S®RTO1044, RTO2044 or RTO2064 oscilloscope with the R&S®RTO-B4 option; the oscilloscope is ordered separately (p41).',
    meta: { scopeIq: true } },

  { id: 'B517', name: 'DIG IQ 40G streaming out interface', order: '1331.6980.02', page: 45,
    section: 'io-hw', group: 'I/Q streaming', retrofit: 'user',
    requires: 'BW512', reqText: 'R&S®FSW-B512/-U512/-B1200/-U1200/-B2001/-U2001/-B800R',
    conflicts: ['B4001', 'B6001', 'B8001'],
    note: 'R&S®FSW-B512/-U512/-B1200/-U1200/-B2001/-U2001/-B800R required. QSFP+, 40 Gbit/s, 16 bit at up to 600 Msample/s, I/Q bandwidth 80 MHz to 512 MHz. Not available with B4001/B6001/B8001 (p38). The R&S®DIGIQ-HS cable connects it.',
    meta: { stream: 512 } },
  { id: 'B1017', name: 'DIG IQ 40G streaming out interface, max. 1 GHz bandwidth', order: '1350.7008.02', page: 45,
    section: 'io-hw', group: 'I/Q streaming', retrofit: 'user',
    requires: 'BW1200', reqText: 'R&S®FSW-B1200/-U1200/-B2001/-U2001/-B800R',
    note: 'R&S®FSW-B1200/-U1200/-B2001/-U2001/-B800R required. As B517, plus 12 bit at 1200 Msample/s for 1 GHz I/Q bandwidth (p38).',
    meta: { stream: 1000 } },

  { id: 'B106', name: 'I/Q memory extension 6 GB', order: '1331.6451.02', page: 45,
    section: 'io-hw', group: 'I/Q memory', retrofit: 'user',
    requires: 'B160|U160|B320|U320', reqText: 'R&S®FSW-B160/-U160/-B320',
    note: 'R&S®FSW-B160/-U160/-B320 required (an instrument upgraded with R&S®FSW-U320 has one of them).',
    meta: { memory: 6 } },
  { id: 'B108', name: 'I/Q memory extension 8 GB', order: '1331.6751.02', page: 45,
    section: 'io-hw', group: 'I/Q memory', retrofit: 'user',
    requires: 'B1200|U1200|B2001|U2001|B800R', reqText: 'R&S®FSW-B1200/-U1200/-B2001/-U2001/-B800R',
    meta: { memory: 8 } },
  { id: 'B124', name: 'I/Q memory extension 24 GB', order: '1338.5273.02', page: 45,
    section: 'io-hw', group: 'I/Q memory', retrofit: 'user',
    requires: 'BW4001', reqText: 'R&S®FSW-B4001/-U4001/-B6001/-U6001/-B8001/-U8001',
    note: 'R&S®FSW-B4001/-U4001/-B6001/-U6001/-B8001/-U8001 required. R&S®FSW-U4002 is accepted here as well: it produces the same 4.4 GHz bandwidth, though the ordering information does not list it.',
    meta: { memory: 24 } },

  { id: 'B10', name: 'External generator control', order: '1313.1622.02', page: 43,
    section: 'io-hw', group: 'Control, storage and security', retrofit: 'service',
    note: 'IEC/IEEE bus and aux control of an R&S signal generator (SMA100B, SMB100B, SMW200A and others, p37) for tracking generator measurements.' },
  { id: 'B112', name: 'USB instrument remote control, type B plug', order: '1353.3290.02', page: 45,
    section: 'io-hw', group: 'Control, storage and security', retrofit: 'user',
    note: 'One USB 2.0 type B port for remote instrument control (p33).' },
  { id: 'B18', name: 'Spare solid state drive (removable hard drive)', order: '1313.0790.21', page: 43,
    section: 'io-hw', group: 'Control, storage and security', retrofit: 'user' },
  { id: 'B33', name: 'USB mass memory write protection', order: '1313.3602.02', page: 44,
    section: 'io-hw', group: 'Control, storage and security', retrofit: 'factory',
    note: 'Pre-installed in the factory; not retrofittable.' },
  { id: 'FL', name: 'Floating license smart card, with USB adapter', order: '1345.1940.02', page: 45,
    section: 'floating', group: 'Smart card', retrofit: 'user', kind: 'hw',
    note: 'Required by every floating licence (.51 order numbers).' },

  /* -- General-purpose applications (p46/48) ----------------------- */
  K('K6',   'Pulse measurements',                 '1313.1322.02', 46, 'gp-apps', 'Pulse and transient'),
  K('K6S',  'Time side lobe measurements',        '1325.3738.02', 46, 'gp-apps', 'Pulse and transient',
    { requires: 'K6', reqText: 'R&S®FSW-K6' }),
  K('K60',  'Transient measurement application',  '1313.7495.02', 46, 'gp-apps', 'Pulse and transient'),
  K('K60H', 'Transient hop measurement',          '1322.9916.02', 46, 'gp-apps', 'Pulse and transient',
    { requires: 'K60', reqText: 'R&S®FSW-K60' }),
  K('K60C', 'Transient chirp measurement',        '1322.9745.02', 46, 'gp-apps', 'Pulse and transient',
    { requires: 'K60', reqText: 'R&S®FSW-K60' }),
  K('K60P', 'Transient phase noise measurement',  '1353.2413.02', 46, 'gp-apps', 'Pulse and transient',
    { requires: 'K60', reqText: 'R&S®FSW-K60' }),

  K('K7',   'AM/FM/PM modulation analysis',       '1313.1339.02', 46, 'gp-apps', 'Modulation and signal analysis'),
  K('K15',  'VOR/ILS measurements',               '1331.4388.02', 46, 'gp-apps', 'Modulation and signal analysis'),
  K('K17',  'Multicarrier group delay measurements', '1313.4150.02', 46, 'gp-apps', 'Modulation and signal analysis'),
  K('K17S', 'Frequency subspan measurements for multi carrier group delay measurements', '1338.5896.02', 46, 'gp-apps', 'Modulation and signal analysis',
    { requires: 'K17&BW512', reqText: 'R&S®FSW-K17 and one of R&S®FSW-B512/-B512R/-B1200/-B2001/-B800R/-B4001/-B6001/-B8001',
      note: 'R&S®FSW-K17 and a minimum internal analysis bandwidth of 512 MHz required (K17 data sheet p7).' }),
  K('K70',  'Vector signal analysis',             '1313.1416.02', 46, 'gp-apps', 'Modulation and signal analysis'),
  K('K70M', 'Multi-modulation analysis',          '1338.4177.02', 46, 'gp-apps', 'Modulation and signal analysis',
    { requires: 'K70', reqText: 'R&S®FSW-K70' }),
  K('K70P', 'BER PRBS measurements',              '1338.3893.02', 46, 'gp-apps', 'Modulation and signal analysis',
    { requires: 'K70', reqText: 'R&S®FSW-K70' }),
  K('K96',  'OFDM signal analysis',               '1313.1539.02', 47, 'gp-apps', 'Modulation and signal analysis',
    { note: 'Custom OFDM and DFT-s-OFDM signals with a known FFT size and cyclic prefix; reads the configuration file of R&S®SMW-K114.' }),

  K('K18',  'Amplifier measurements',             '1325.2170.02', 46, 'gp-apps', 'Amplifier and noise'),
  K('K18D', 'Direct DPD measurements',            '1331.6845.02', 46, 'gp-apps', 'Amplifier and noise',
    { requires: 'K18', reqText: 'R&S®FSW-K18' }),
  K('K18F', 'Frequency response measurements',    '1338.7230.02', 46, 'gp-apps', 'Amplifier and noise',
    { requires: 'K18', reqText: 'R&S®FSW-K18' }),
  K('K18M', 'Memory polynomial DPD',              '1345.1470.02', 46, 'gp-apps', 'Amplifier and noise',
    { requires: 'K18&K18D', reqText: 'R&S®FSW-K18 and R&S®FSW-K18D' }),
  K('K19',  'Noise power ratio measurements',     '1331.8283.02', 46, 'gp-apps', 'Amplifier and noise'),
  K('K30',  'Noise figure measurements',          '1313.1380.02', 46, 'gp-apps', 'Amplifier and noise',
    { note: 'Y-factor method with an R&S®FS-SNS smart noise source (accessories), or a generator as LO for frequency-converting devices.' }),
  K('K40',  'Phase noise measurements',           '1313.1397.02', 46, 'gp-apps', 'Amplifier and noise'),
  K('K50',  'Spurious measurements',              '1325.2893.02', 46, 'gp-apps', 'Amplifier and noise'),

  K('K54',  'EMI measurements',                   '1313.1400.02', 46, 'gp-apps', 'EMI',
    { note: 'CISPR 16-1-1 and MIL-STD/DO-160 detectors and bandwidths, limit lines, 16 markers; the K54 data sheet recommends R&S®FSW-B24 and R&S®FSW-B10.' }),
  K('K54CAL', 'CISPR calibration for R&S®FSW-K54', '1331.5932.02', 46, 'gp-apps', 'EMI',
    { requires: 'K54', reqText: 'R&S®FSW-K54', note: 'In line with ISO 17025 and ISO 9000.' }),

  K('K33',  'Security write protection of solid-state drive', '1322.7936.02', 46, 'gp-apps', 'Corrections, streaming and services'),
  K('K544', 'User-defined frequency correction by SnP file', '1338.2716.02', 48, 'gp-apps', 'Corrections, streaming and services',
    { note: 'Corrects frequency response (amplitude and phase) of the measurement setup from a Touchstone file.' }),
  K('K552', 'Custom digital baseband connection', '1338.4554.02', 48, 'gp-apps', 'Corrections, streaming and services',
    { requires: 'DIGIQ40', reqText: 'R&S®FSW-B517 or R&S®FSW-B1017',
      note: 'The ordering information prints "R&S®FSW-B517 or R&S®FSW-K1017 option required"; no K1017 exists, and the 1 GHz streaming interface is R&S®FSW-B1017, which is what is checked here.' }),
  K('K553', 'External frontend control',          '1350.6118.02', 48, 'gp-apps', 'Corrections, streaming and services',
    { note: 'Supports the I/Q analyzer, R&S®FSW-K91, -K144 and -K145. Controls an R&S®FE44S, FE50DTR, FE110SR or FE170SR external frontend (accessories, p51).' }),
  K('K575', 'I/Q noise cancellation',             '1353.2894.02', 48, 'gp-apps', 'Corrections, streaming and services',
    { note: 'Firmware option only, no hardware change; removes the analyzer\'s own wideband receiver noise from the EVM result (K575 solution sheet).' }),
  K('K980', 'Health and utilization monitoring service (HUMS)', '1350.6718.02', 48, 'gp-apps', 'Corrections, streaming and services',
    { note: 'SNMP, REST, SCPI and device web readout of health, utilization and service information (p42).' }),
  K('VSE',  'Local VSE enabler',                  '1345.2253.02', 48, 'gp-apps', 'Corrections, streaming and services',
    { note: 'With R&S®FSW-VSE installed on the FSW, the corresponding R&S®FSW-Kxx options are enabled on R&S®VSE.' }),

  /* -- Real-time applications (p48) -------------------------------- */
  K('K161R', '160 MHz real-time measurement application, POI ≤ 15 µs', '1338.2700.02', 48, 'realtime', 'Real-time applications',
    { requires: 'B160|U160|B320|U320', reqText: 'one of R&S®FSW-B160/-B320',
      conflicts: ['B512', 'U512', 'B512R', 'U512R', 'B1200', 'U1200', 'B2001', 'U2001', 'B800R', 'B4001', 'U4001', 'U4002', 'B6001', 'U6001', 'B8001', 'U8001'],
      note: 'One of R&S®FSW-B160/-B320 required; not available for B512/B512R/B1200/B2001/B800R/B4001/B6001/B8001.',
      meta: { realtime: { bw: 160, poi: '≤ 15 µs' } } }),
  K('K512RE', '512 MHz real-time measurement application, POI > 15 µs', '1338.4731.02', 48, 'realtime', 'Real-time applications',
    { requires: 'B512|U512', reqText: 'R&S®FSW-B512',
      conflicts: ['B160', 'U160', 'B320', 'U320', 'B512R', 'U512R', 'B1200', 'U1200', 'B2001', 'U2001', 'B800R', 'B4001', 'U4001', 'U4002', 'B6001', 'U6001', 'B8001', 'U8001'],
      note: 'R&S®FSW-B512 required; not available for B160/B320/B512R/B1200/B2001/B800R/B4001/B6001/B8001.',
      meta: { realtime: { bw: 512, poi: '> 15 µs' } } }),
  K('K800RE', '800 MHz real-time measurement application, POI > 15 µs', '1338.7801.02', 48, 'realtime', 'Real-time applications',
    { requires: 'B1200|U1200|B2001|U2001', reqText: 'one of R&S®FSW-B1200/-B2001',
      conflicts: ['B160', 'U160', 'B320', 'U320', 'B512', 'U512', 'B512R', 'U512R', 'B800R', 'B4001', 'U4001', 'U4002', 'B6001', 'U6001', 'B8001', 'U8001'],
      note: 'One of R&S®FSW-B1200/-B2001 required; not available for B160/B320/B512/B512R/B800R/B4001/B6001/B8001.',
      meta: { realtime: { bw: 800, poi: '> 15 µs' } } }),

  /* -- Cellular standards (p46/47) --------------------------------- */
  K('K10',  'GSM/EDGE/EDGE evolution/VAMOS measurements', '1313.1368.02', 46, 'cellular', '2G and 3G'),
  K('K72',  '3GPP FDD (WCDMA) BS measurements (incl. HSDPA and HSDPA+)', '1313.1422.02', 46, 'cellular', '2G and 3G'),
  K('K73',  '3GPP FDD (WCDMA) MS measurements (incl. HSUPA and HSUPA+)', '1313.1439.02', 46, 'cellular', '2G and 3G'),
  K('K76',  'TD-SCDMA BS measurements',           '1313.1445.02', 46, 'cellular', '2G and 3G'),
  K('K77',  'TD-SCDMA UE measurements',           '1313.1451.02', 46, 'cellular', '2G and 3G'),
  K('K82',  'CDMA2000 BS measurements',           '1313.1468.02', 46, 'cellular', '2G and 3G'),
  K('K83',  'CDMA2000 MS measurements',           '1313.1474.02', 46, 'cellular', '2G and 3G'),
  K('K84',  '1xEV-DO BS measurements',            '1313.1480.02', 46, 'cellular', '2G and 3G'),
  K('K85',  '1xEV-DO MS measurements',            '1313.1497.02', 46, 'cellular', '2G and 3G'),

  K('K100', 'EUTRA/LTE FDD BS measurements',      '1313.1545.02', 47, 'cellular', 'LTE and NB-IoT',
    { requires: 'BW10', reqText: 'an analysis bandwidth option for channel bandwidths > 10 MHz',
      note: 'To support signal analysis bandwidths > 10 MHz, one of the analysis bandwidth options is required. Checked as a requirement here: LTE channels of 15 and 20 MHz need one.' }),
  K('K101', 'EUTRA/LTE FDD UE measurements',      '1313.1551.02', 47, 'cellular', 'LTE and NB-IoT',
    { requires: 'BW10', reqText: 'an analysis bandwidth option for channel bandwidths > 10 MHz',
      note: 'To support signal analysis bandwidths > 10 MHz, one of the analysis bandwidth options is required.' }),
  K('K102', 'EUTRA/LTE BS MIMO measurements',     '1313.1568.02', 47, 'cellular', 'LTE and NB-IoT',
    { requires: 'K100|K104', reqText: 'R&S®FSW-K100 or R&S®FSW-K104' }),
  K('K103', 'EUTRA/LTE-Advanced uplink measurements', '1313.2478.02', 47, 'cellular', 'LTE and NB-IoT',
    { requires: 'K101|K105', reqText: 'R&S®FSW-K101 or R&S®FSW-K105' }),
  K('K104', 'EUTRA/LTE TDD BS measurements',      '1313.1574.02', 47, 'cellular', 'LTE and NB-IoT',
    { requires: 'BW10', reqText: 'an analysis bandwidth option for channel bandwidths > 10 MHz',
      note: 'To support signal analysis bandwidths > 10 MHz, one of the analysis bandwidth options is required.' }),
  K('K105', 'EUTRA/LTE TDD uplink measurements',  '1313.1580.02', 47, 'cellular', 'LTE and NB-IoT',
    { requires: 'BW10', reqText: 'an analysis bandwidth option for channel bandwidths > 10 MHz',
      note: 'To support signal analysis bandwidths > 10 MHz, one of the analysis bandwidth options is required.' }),
  K('K106', 'EUTRA/LTE NB-IoT downlink measurements', '1331.6351.02', 47, 'cellular', 'LTE and NB-IoT'),

  K('K118', 'VERIZON 5GTF DL',                    '1331.7370.02', 47, 'cellular', 'Verizon 5GTF',
    { requires: 'BW160', reqText: 'one of R&S®FSW-B160/-B320/-B512/-B512R/-B1200/-B2001/-B800R/-B4001/-B6001/-B8001',
      note: 'R&S®FSW-B160 for one component carrier, R&S®FSW-B1200 for eight carriers measured simultaneously (K118/K119 data sheet p4).' }),
  K('K119', 'VERIZON 5GTF UL',                    '1331.8060.02', 47, 'cellular', 'Verizon 5GTF',
    { requires: 'BW160', reqText: 'one of R&S®FSW-B160/-B320/-B512/-B512R/-B1200/-B2001/-B800R/-B4001/-B6001/-B8001',
      note: 'Same hardware requirements as R&S®FSW-K118 (K118/K119 data sheet p4).' }),

  K('K144', '5G NR Rel. 15 downlink measurements', '1338.3606.02', 47, 'cellular', '5G NR',
    { note: 'A matching bandwidth option is needed for the wider channel bandwidths – R&S®FSW-B160 for every FR1 channel bandwidth (5G NR specifications p10).' }),
  K('K145', '5G NR Rel. 15 uplink measurements',   '1338.3612.02', 47, 'cellular', '5G NR',
    { note: 'A matching bandwidth option is needed for the wider channel bandwidths – R&S®FSW-B160 for every FR1 channel bandwidth (5G NR specifications p10).' }),
  K('K147', '5G NR combined ACLR/SEM/EVM measurements', '1338.6486.02', 47, 'cellular', '5G NR',
    { requires: 'NR', reqText: 'R&S®FSW-K144 or R&S®FSW-K145' }),
  K('K147C', '5G NR multi-CC combined ACLR/SEM/EVM measurements', '1351.1355.02', 47, 'cellular', '5G NR',
    { requires: 'K147', reqText: 'R&S®FSW-K147' }),
  K('K148', '5G NR Rel. 16 extension for uplink/downlink', '1350.6624.02', 47, 'cellular', '5G NR',
    { requires: 'NR', reqText: 'R&S®FSW-K144 or R&S®FSW-K145' }),
  K('K171', '5G NR Rel. 17 extension for uplink/downlink', '1350.7108.02', 47, 'cellular', '5G NR',
    { requires: 'NR&K148', reqText: 'R&S®FSW-K144/-K145 and R&S®FSW-K148' }),
  K('K175', '5G NR ORAN measurements',             '1353.2642.02', 47, 'cellular', '5G NR',
    { requires: 'NR', reqText: 'R&S®FSW-K144/-K145' }),
  K('K184', '5G NR Beyond 5G measurements extension for uplink/downlink', '1353.4151.02', 47, 'cellular', '5G NR',
    { requires: 'NR', reqText: 'R&S®FSW-K144/-K145' }),

  /* -- Wireless, broadband and satellite (p46/47) ------------------ */
  K('K8',   'Bluetooth® BR/EDR/LE measurements',  '1313.1351.02', 46, 'wireless', 'Bluetooth®'),
  K('K8E',  'Bluetooth® 6.0 channel sounding',    '1353.3284.02', 46, 'wireless', 'Bluetooth®',
    { requires: 'K8', reqText: 'R&S®FSW-K8' }),

  K('K91',  'WLAN 802.11a/b/g measurements',      '1313.1500.02', 46, 'wireless', 'WLAN',
    { requires: 'BW10', reqText: 'an analysis bandwidth option for channel bandwidths > 10 MHz',
      note: 'To support signal analysis bandwidths > 10 MHz, one of the analysis bandwidth options is required (20 MHz channels need one). The WLAN specifications: an analysis bandwidth at least the channel bandwidth – 40, 80, 160 or 320 MHz for the wider standards.' }),
  K('K91N', 'WLAN 802.11n measurements',          '1313.1516.02', 46, 'wireless', 'WLAN',
    { requires: 'K91', reqText: 'R&S®FSW-K91', note: 'R&S®FSW-K91 required; 40 MHz channels need R&S®FSW-B40 or wider.' }),
  K('K91AC', 'WLAN 802.11ac measurements',        '1313.4209.02', 46, 'wireless', 'WLAN',
    { requires: 'K91', reqText: 'R&S®FSW-K91', note: 'R&S®FSW-K91 required; 80/160 MHz channels need R&S®FSW-B80/-B160 or wider.' }),
  K('K91AX', 'WLAN 802.11ax measurements',        '1331.6345.02', 46, 'wireless', 'WLAN',
    { requires: 'K91', reqText: 'R&S®FSW-K91', note: 'R&S®FSW-K91 required; 160 MHz channels need R&S®FSW-B160 or wider.' }),
  K('K91BE', 'WLAN 802.11be measurements',        '1350.6730.02', 46, 'wireless', 'WLAN',
    { requires: 'K91', reqText: 'R&S®FSW-K91', note: 'R&S®FSW-K91 required; 320 MHz channels need R&S®FSW-B320 or wider.' }),
  K('K91P', 'WLAN 802.11p measurements',          '1321.5646.02', 46, 'wireless', 'WLAN',
    { requires: 'K91', reqText: 'R&S®FSW-K91' }),
  K('K91BN', 'WLAN 802.11bn measurements',        '1353.4374.02', 46, 'wireless', 'WLAN',
    { requires: 'K91&K91BE', reqText: 'R&S®FSW-K91 and R&S®FSW-K91BE' }),
  K('K95',  'WLAN 802.11ad measurements',         '1313.1639.02', 47, 'wireless', 'WLAN',
    { requires: 'BW2001', reqText: 'R&S®FSW-B2001/-B800R/-B4001/-B6001/-B8001',
      note: 'R&S®FSW-B2001/-B800R/-B4001/-B6001/-B8001 required; R&S®FSW-B24 recommended for over-the-air measurements (K95/K97 data sheet).' }),
  K('K97',  'WLAN 802.11ay measurements',         '1338.4902.02', 47, 'wireless', 'WLAN',
    { requires: 'BW2001', reqText: 'R&S®FSW-B2001/-B800R/-B4001/-B6001/-B8001',
      note: 'R&S®FSW-B2001/-B800R/-B4001/-B6001/-B8001 required. Channel bonding up to 7.04 GHz wants R&S®FSW-B4001 or wider (K97 option sheet).' }),

  K('K149', 'HRP UWB measurements',                '1350.6930.02', 47, 'wireless', 'UWB, DOCSIS and satellite',
    { requires: 'BW1200', reqText: 'R&S®FSW-B1200/-B2001/-B800R/-B4001/-B6001/-B8001',
      note: 'R&S®FSW-B1200/-B2001/-B800R/-B4001/-B6001/-B8001 required; the UWB specifications list the R&S®FSW26 and up.' }),
  K('K192', 'DOCSIS 3.1 OFDM downstream',          '1325.4138.02', 47, 'wireless', 'UWB, DOCSIS and satellite',
    { requires: 'B320|U320|B512|U512', reqText: 'one of R&S®FSW-B320/-B512',
      note: 'One of R&S®FSW-B320/-B512 required (192 MHz OFDM channels); the K192 data sheet lists B320 as mandatory.' }),
  K('K193', 'DOCSIS 3.1 OFDMA upstream',           '1325.4144.02', 47, 'wireless', 'UWB, DOCSIS and satellite',
    { requires: 'B320|U320|B512|U512', reqText: 'one of R&S®FSW-B320/-B512',
      note: 'The K192 data sheet lists the 320 MHz analysis bandwidth as mandatory for both DOCSIS applications.' }),
  K('K201', 'OneWeb reverse link measurements',    '1331.7387.02', 47, 'wireless', 'UWB, DOCSIS and satellite',
    { requires: 'BW10', reqText: 'an analysis bandwidth option for channel bandwidths > 10 MHz',
      note: 'The K201 data sheet (v02.00) prints 1331.7382.02; the specifications (v17.01) print 1331.7387.02, which is used here – confirm with Rohde & Schwarz.' }),

  /* -- Upgrades (p49/50) ------------------------------------------- */
  U('U40',   'Analysis bandwidth upgrade from 28 MHz to 40 MHz',   '1313.5205.02', 40,   null,
    { note: 'User-retrofittable.' }),
  U('U80',   'Analysis bandwidth upgrade from 40 MHz to 80 MHz',   '1313.5211.02', 80,   'B40|U40',
    { reqText: 'R&S®FSW-B40 or R&S®FSW-U40', note: 'User-retrofittable.' }),
  U('U160',  'Analysis bandwidth upgrade from 80 MHz to 160 MHz',  '1325.5357.14', 160,  'B80|U80',
    { reqText: 'R&S®FSW-B80 or R&S®FSW-U80', retrofit: 'service' }),
  U('U320',  'Analysis bandwidth upgrade from 160 MHz to 320 MHz', '1313.7189.02', 320,  'B160|U160',
    { reqText: 'R&S®FSW-B160/-U160', note: 'User-retrofittable.' }),
  U('U512',  'Analysis bandwidth upgrade from 80 MHz to 512 MHz',  '1321.6320.24', 512,  'B80|U80',
    { reqText: 'R&S®FSW-B80 or R&S®FSW-U80', retrofit: 'service',
      conflicts: ['B160', 'U160', 'B320'], note: 'Excludes R&S®FSW-B160/-U160/-B320.' }),
  U('U512R', 'Upgrade real-time spectrum analyzer 512 MHz, POI ≤ 15 µs', '1321.6320.26', 512, 'B80|U80',
    { reqText: 'R&S®FSW-B80 or R&S®FSW-U80', retrofit: 'service', group: 'Real-time upgrade',
      note: 'Includes 512 MHz analysis bandwidth.', meta: { bw: 512, upgrade: true, realtime: { bw: 512, poi: '≤ 15 µs' } } }),
  U('U1200', 'Analysis bandwidth upgrade from 80 MHz, 160 MHz, 320 MHz, 512 MHz to 1.2 GHz', '1331.7006.14', 1200,
    'M26P&(B80|U80|B160|U160|B320|U320|B512|U512)',
    { reqText: 'R&S®FSW26/43/50/67/85 with R&S®FSW-B80 or -B160/-U160 or -B320/-U320 or -B512/-U512', retrofit: 'service',
      conflicts: ['B512R', 'U512R'],
      note: 'For R&S®FSW26/43/50/67/85. Not available for instruments with R&S®FSW-B512R or -U512R.' }),
  U('U2001', 'Analysis bandwidth upgrade from 1.2 GHz to 2 GHz', '1331.7070.02', 2000, 'B1200|U1200',
    { reqText: 'R&S®FSW-B1200 or R&S®FSW-U1200', note: 'User-retrofittable; calibration recommended to verify specifications.' }),
  U('U4001', 'Analysis bandwidth upgrade from 80 MHz, 160 MHz, 320 MHz, 512 MHz to 4.4 GHz', '1338.5244.43', 4400,
    'M43P&(B80|U80|B160|U160|B320|U320|B512|U512)',
    { reqText: 'R&S®FSW43/50/67/85 with R&S®FSW-B80 or -B160/-U160 or -B320/-U320 or -B512/-U512', retrofit: 'service',
      conflicts: ['B512R', 'U512R', 'B517'],
      note: 'For R&S®FSW43/50/67/85, from the same serial numbers as B4001. Not available for instruments with R&S®FSW-B512R or -U512R.' }),
  U('U4002', 'Analysis bandwidth upgrade from 1.2 GHz, 2 GHz to 4.4 GHz', '1338.6192.43', 4400,
    'M43P&(B1200|U1200|B2001|U2001)',
    { reqText: 'R&S®FSW43/50/67/85 with R&S®FSW-B1200/-U1200 or -B2001/-U2001', retrofit: 'service',
      conflicts: ['B512R', 'U512R', 'B517'],
      note: 'For R&S®FSW43/50/67/85, from the same serial numbers as B4001. Not available for instruments with R&S®FSW-B512R or -U512R.' }),
  U('U6001', 'Analysis bandwidth upgrade from 4.4 GHz to 6.4 GHz', '1338.5250.02', 6400,
    'M43P&(B4001|U4001|U4002)',
    { reqText: 'R&S®FSW43/50/67/85 with R&S®FSW-B4001/-U4001/-U4002', page: 50, conflicts: ['B517'],
      note: 'User-retrofittable; calibration recommended to verify specifications.' }),
  U('U8001', 'Analysis bandwidth upgrade from 6.4 GHz to 8.312 GHz', '1338.5267.02', 8312,
    'M43P&(B6001|U6001)',
    { reqText: 'R&S®FSW43/50/67/85 with R&S®FSW-B6001/-U6001', page: 50, conflicts: ['B517'],
      note: 'User-retrofittable; calibration recommended to verify specifications.' }),
  { id: 'B24U', name: 'Upgrade kit for enhanced dynamic range preamplifier', order: '1350.7443.xx', page: 49,
    section: 'upgrades', group: 'Preamplifier upgrade', retrofit: 'service',
    requires: 'M43TO67&B24EDR', reqText: 'R&S®FSW43/50/67 with R&S®FSW-B24',
    note: 'For R&S®FSW43/50/67 with R&S®FSW-B24; the order number\'s suffix follows the model (printed as "xx"). Instruments from serial numbers FSW43 102224, FSW50 101676, FSW67 101721 have it included in B24 (p49). Enhanced dynamic front end: about 9 dB lower noise floor and 5 dB better TOI at 39 GHz (fact sheet).' }
];

/* ------------------------------------------------------------------ *
 * Floating licences (footnote 59, p46/47)
 *
 * "Also available as floating license. Order number is xxxx.xxxx.51 instead
 * of xxxx.xxxx.02 and requires R&S FSW-FL hardware option." The variant
 * keeps the application's requirements, needs the smart card, and rules
 * out the fixed licence of the same application; a requirement that names
 * the application is met by either form (see the shorthands added below).
 * ------------------------------------------------------------------ */
export const FLOATABLE = [
  'K8', 'K8E', 'K10', 'K30', 'K40', 'K70', 'K70M', 'K70P', 'K72', 'K73',
  'K91', 'K91N', 'K91AC', 'K91AX', 'K91BE', 'K91P', 'K91BN', 'K95', 'K96', 'K97',
  'K100', 'K101', 'K102', 'K103', 'K104', 'K105', 'K106',
  'K144', 'K145', 'K147', 'K147C', 'K148', 'K149', 'K184', 'K544'
];

const byIdSoFar = Object.fromEntries(OPTIONS.map(o => [o.id, o]));
for (const id of FLOATABLE) {
  const base = byIdSoFar[id];
  if (!base) throw new Error(`floating licence for unknown option ${id}`);
  const fl = {
    ...base,
    id: `${id}-FL`,
    code: id,
    name: `${base.name} (floating license)`,
    order: base.order.replace(/\.02$/, '.51'),
    section: 'floating',
    group: `${SECTIONS.find(s => s.id === base.section).label} – floating`,
    requires: base.requires ? `(${base.requires})&FL` : 'FL',
    reqText: `${base.reqText ? base.reqText + '; ' : ''}R&S®FSW-FL smart card`,
    conflicts: [...(base.conflicts || []), id],
    floating: true,
    note: 'Floating license, .51 order number; needs the R&S®FSW-FL smart card. Not with the fixed licence of the same application.'
  };
  base.conflicts = [...(base.conflicts || []), fl.id];
  OPTIONS.push(fl);
  /* an expression that names the application accepts either form */
  SHORTHAND[id] = `${id}|${fl.id}`;
}
/* and so does a shorthand that lists it: NR is K144 or K145 in either form */
for (const [name, list] of Object.entries(SHORTHAND)) {
  if (FLOATABLE.includes(name)) continue;
  SHORTHAND[name] = list.split('|').flatMap(id => (FLOATABLE.includes(id) ? [id, `${id}-FL`] : [id])).join('|');
}

/* ------------------------------------------------------------------ *
 * Accessories (p50/51)
 *
 * The ordering information's recommended extras: no configuration rules,
 * quantity the customer's to choose. `hintIf` only decides whether a card
 * says the configuration suggests the item.
 * ------------------------------------------------------------------ */
export const EXTRAS = [
  { group: 'Recommended extras', items: [
    { id: 'ZZA-KN5', name: '19" rack adapter', order: '1175.3040.00', code: 'ZZA-KN5', max: 1 },
    { id: 'PCK-HP', name: 'Headphones', order: '0708.9010.00', code: 'PCK', max: 2 },
    { id: 'PCK-1M', name: 'IEC/IEEE bus cable, length: 1 m', order: '0292.2013.10', code: 'PCK', hintIf: 'B10' },
    { id: 'PCK-2M', name: 'IEC/IEEE bus cable, length: 2 m', order: '0292.2013.20', code: 'PCK', hintIf: 'B10' }
  ]},
  { group: 'Noise sources (smart noise sources for noise figure and gain measurement, require R&S®FSW-K30)', items: [
    { id: 'FS-SNS18', name: 'Smart noise source, to 18 GHz', order: '1338.8008.18', code: 'FS-SNS18', hintIf: 'K30' },
    { id: 'FS-SNS26', name: 'Smart noise source, to 26.5 GHz', order: '1338.8008.26', code: 'FS-SNS26', hintIf: 'K30&M26P' },
    { id: 'FS-SNS40', name: 'Smart noise source, to 40 GHz', order: '1338.8008.40', code: 'FS-SNS40', hintIf: 'K30&M43P' },
    { id: 'FS-SNS55', name: 'Smart noise source, to 55 GHz', order: '1338.8008.55', code: 'FS-SNS55', hintIf: 'K30&(FSW50|FSW67|FSW85)' },
    { id: 'FS-SNS67', name: 'Smart noise source, to 67 GHz', order: '1338.8008.67', code: 'FS-SNS67', hintIf: 'K30&(FSW67|FSW85)' },
    { id: 'FS-SNS90', name: 'Smart noise source, to 90 GHz', order: '1338.8008.90', code: 'FS-SNS90', hintIf: 'K30&FSW85' },
    { id: 'FS-SNS110', name: 'Smart noise source, to 110 GHz', order: '1338.8008.11', code: 'FS-SNS110', hintIf: 'K30&B21ANY' }
  ]},
  { group: 'Matching pads and attenuators', items: [
    { id: 'RAM', name: 'Matching pad 50/75 Ω, L section, matching at both ends', order: '0358.5414.02', code: 'RAM' },
    { id: 'RAZ', name: 'Matching pad 50/75 Ω, series resistor 25 Ω, matching at one end (taken into account in instrument function RF INPUT 75 Ω)', order: '0358.5714.02', code: 'RAZ' },
    { id: 'RBU100', name: 'High-power attenuator, 100 W, 3/6/10/20/30 dB, 1 GHz', order: '1073.8495.xx', code: 'RBU100',
      note: 'The suffix picks the attenuation: .03, .06, .10, .20 or .30.' },
    { id: 'RBU50', name: 'High-power attenuator, 50 W, 6/10/20/30 dB, 2 GHz', order: '1073.8695.xx', code: 'RBU50',
      note: 'The suffix picks the attenuation: .06, .10, .20 or .30.' },
    { id: 'RDL50', name: 'High-power attenuator, 50 W, 20 dB, 6 GHz', order: '1035.1700.52', code: 'RDL50' }
  ]},
  { group: 'RF adapters and cables', items: [
    { id: 'AD-100F-100F', name: 'Coaxial adapter, 1.00 mm (f) – 1.00 mm (f)', order: '3592.8694.00', code: null, hintIf: 'FSW85' },
    { id: 'AD-100F-185F', name: 'Coaxial adapter, 1.00 mm (f) – 1.85 mm (f)', order: '3628.4734.02', code: null, hintIf: 'FSW85' },
    { id: 'AD-185F-185F', name: 'Coaxial adapter, 1.85 mm (f) – 1.85 mm (f)', order: '3588.9654.00', code: null, hintIf: 'FSW50|FSW67' },
    { id: 'CB-185-U', name: 'Coaxial semi-rigid cable, 1.85 mm (m) – 1.85 mm (m), length: 90 mm, U shape', order: '1325.1251.00', code: null },
    { id: 'AD-185F-292F', name: 'Coaxial adapter, 1.85 mm (f) – 2.92 mm (f)', order: '3628.4728.02', code: null },
    { id: 'AD-292F-292F', name: 'Coaxial adapter, 2.92 mm (f) – 2.92 mm (f)', order: '3588.8664.00', code: null, hintIf: 'FSW43' },
    { id: 'AD-35F-35F', name: 'Coaxial adapter, 3.5 mm (f) – 3.5 mm (f), APC3.5-compatible', order: '3689.9442.00', code: null, hintIf: 'FSW26' },
    { id: 'AD-35M-35M', name: 'Coaxial adapter, 3.5 mm (m) – 3.5 mm (m), APC3.5-compatible', order: '3587.7770.00', code: null },
    { id: 'AD-NF-35M', name: 'Coaxial adapter, N (f) – 3.5 mm (m), APC3.5-compatible', order: '3587.7806.00', code: null },
    { id: 'AD-NF-35F', name: 'Coaxial adapter, N (f) – 3.5 mm (f), APC3.5-compatible', order: '3587.7829.00', code: null },
    { id: 'CB-SMA-1M', name: 'Coaxial cable, SMA (m) – SMA (m), length: 1 m', order: '3586.9970.00', code: null, hintIf: 'B21ANY' },
    { id: 'FS-Z124', name: 'DUT positioner for R&S®FSW85', order: '1338.4783.02', code: 'FS-Z124', max: 1, hintIf: 'FSW85' }
  ]},
  { group: 'Connectors and cables', items: [
    { id: 'PROBE-PWR', name: 'Probe power connector, 3-pin', order: '1065.9480.00', code: null },
    { id: 'RT-ZA9', name: 'Type N adapter for R&S®RT-Zxx oscilloscope probes', order: '1417.0909.02', code: 'RT-ZA9', hintIf: 'B71-13' },
    { id: 'RT-ZA51', name: 'Type 3.5 mm adapter for R&S®RT-Zxx oscilloscope probes', order: '1803.5365.02', code: 'RT-ZA51', hintIf: 'B71-26' },
    { id: 'SMU-Z6', name: 'Cable for connecting digital baseband interfaces of Rohde & Schwarz instruments (accessory for R&S®FSW-B17)', order: '1415.0201.02', code: 'SMU-Z6', hintIf: 'B17' },
    { id: 'DIGIQ-HS', name: 'Cable for connecting high speed digital baseband interfaces of Rohde & Schwarz instruments (accessory for R&S®FSW-B517)', order: '3641.2948.03', code: 'DIGIQ-HS', hintIf: 'DIGIQ40' },
    { id: 'FSE-Z4', name: 'DC block, 10 kHz to 18 GHz (type N)', order: '1084.7443.03', code: 'FSE-Z4', hintIf: 'M8TO13' }
  ]},
  { group: 'External harmonic mixers (for R&S®FSW26/43/50/67/85 with R&S®FSW-B21)', items: [
    { id: 'FS-Z60',  name: 'Harmonic mixer, 40 GHz to 60 GHz',   order: '1048.0171.02', code: 'FS-Z60',  brand: 'RPG ', max: 1, hintIf: 'B21ANY' },
    { id: 'FS-Z75',  name: 'Harmonic mixer, 50 GHz to 75 GHz',   order: '3638.2240.02', code: 'FS-Z75',  brand: 'RPG ', max: 1, hintIf: 'B21ANY' },
    { id: 'FS-Z90',  name: 'Harmonic mixer, 60 GHz to 90 GHz',   order: '3638.2270.02', code: 'FS-Z90',  brand: 'RPG ', max: 1, hintIf: 'B21ANY' },
    { id: 'FS-Z110', name: 'Harmonic mixer, 75 GHz to 110 GHz',  order: '3638.2292.02', code: 'FS-Z110', brand: 'RPG ', max: 1, hintIf: 'B21ANY' },
    { id: 'FS-Z140', name: 'Harmonic mixer, 90 GHz to 140 GHz',  order: '3622.0708.02', code: 'FS-Z140', brand: 'RPG ', max: 1, hintIf: 'B21ANY' },
    { id: 'FS-Z170', name: 'Harmonic mixer, 110 GHz to 170 GHz', order: '3622.0714.02', code: 'FS-Z170', brand: 'RPG ', max: 1, hintIf: 'B21ANY' },
    { id: 'FS-Z220', name: 'Harmonic mixer, 140 GHz to 220 GHz', order: '3593.3250.02', code: 'FS-Z220', brand: 'RPG ', max: 1, hintIf: 'B21ANY' },
    { id: 'FS-Z325', name: 'Harmonic mixer, 220 GHz to 325 GHz', order: '3593.3267.02', code: 'FS-Z325', brand: 'RPG ', max: 1, hintIf: 'B21ANY',
      note: 'RPG is Radiometer Physics GmbH, a Rohde & Schwarz company.' },
    { id: 'FC330SR', name: 'Frequency converter: downconverter, 220 GHz to 330 GHz', order: '1444.6310.02', code: 'FC330SR', max: 1,
      note: 'The ordering information sets four order numbers beside R&S®FC330SR and three R&S®ZN-ZTW torque wrenches; 1444.6310.02 is read as the converter\'s – confirm with Rohde & Schwarz.' }
  ]},
  { group: 'Waveguide to coaxial adapters and horn antennas', items: [
    { id: 'WCA110-F', name: 'Waveguide to coaxial adapter, WR10 – 1 mm (f)', order: '3626.1067.02', code: 'WCA110', max: 2 },
    { id: 'WCA110-M', name: 'Waveguide to coaxial adapter, WR10 – 1 mm (m)', order: '3626.1067.03', code: 'WCA110', max: 2 },
    { id: 'WCA90-M',  name: 'Waveguide to coaxial adapter, WR12 – 1 mm (m)', order: '3626.1050.03', code: 'WCA90', max: 2 },
    { id: 'WCA75-F',  name: 'Waveguide to coaxial adapter, WR15 – 1 mm (f)', order: '3626.1044.02', code: 'WCA75', max: 2 },
    { id: 'WCA75-M',  name: 'Waveguide to coaxial adapter, WR15 – 1 mm (m)', order: '3626.1044.03', code: 'WCA75', max: 2 },
    { id: 'WCA90-F',  name: 'Waveguide to coaxial adapter, WR12 – 1 mm (f)', order: '3626.1050.02', code: 'WCA90', max: 2 },
    { id: 'FH-SG-170', name: 'Horn antenna, 110 GHz to 170 GHz', order: '3629.2493.02', code: 'FH-SG-170', max: 2 },
    { id: 'FH-SG-40',  name: 'Horn antenna, 26 GHz to 40 GHz',   order: '3629.2393.02', code: 'FH-SG-40', max: 2 },
    { id: 'FH-SG-75',  name: 'Horn antenna, 50 GHz to 75 GHz',   order: '3629.2458.02', code: 'FH-SG-75', max: 2 },
    { id: 'FH-SG-90',  name: 'Horn antenna, 60 GHz to 90 GHz',   order: '3629.2464.02', code: 'FH-SG-90', max: 2 }
  ]},
  { group: 'External frontends supported by R&S®FSW-K553', items: [
    { id: 'FE44S',   name: 'External frontend from 24 GHz to 44 GHz',   order: '1338.7001.02', code: 'FE44S',   max: 1, hintIf: 'K553' },
    { id: 'FE50DTR', name: 'External frontend from 36 GHz to 50 GHz',   order: '1347.4099.02', code: 'FE50DTR', max: 1, hintIf: 'K553' },
    { id: 'FE110SR', name: 'External frontend from 70 GHz to 110 GHz',  order: '1348.4840.02', code: 'FE110SR', max: 1, hintIf: 'K553' },
    { id: 'FE170SR', name: 'External frontend from 110 GHz to 170 GHz', order: '1347.9090.02', code: 'FE170SR', max: 1, hintIf: 'K553' }
  ]},
  { group: 'Tools', items: [
    { id: 'ZN-ZTW-N', name: 'Torque wrench for type N connectors, 1.5 Nm coupling torque (for R&S®FSW8/13)', order: '1328.8534.35', code: 'ZN-ZTW', max: 1, hintIf: 'M8TO13',
      note: 'The three wrenches are read in the order the ordering information prints them – confirm the suffix with Rohde & Schwarz.' },
    { id: 'ZN-ZTW-09', name: 'Torque wrench for 3.5/2.92/2.4/1.85 mm connectors, 0.9 Nm coupling torque (for R&S®FSW26/43/50/67)', order: '1328.8534.11', code: 'ZN-ZTW', max: 1, hintIf: 'M26TO67' },
    { id: 'ZN-ZTW-1MM', name: 'Torque wrench for 1.0 mm connectors, 0.23 Nm coupling torque (for R&S®FSW85)', order: '1328.8534.71', code: 'ZN-ZTW', max: 1,
      note: 'Supplied with the R&S®FSW85.' }
  ]}
];

/* How many of a repeatable accessory the quantity field offers: a ceiling
   for a field, not a rule. */
const ACCESSORY_MAX = 20;

OPTIONS.push(...EXTRAS.flatMap(g => g.items.map(it => ({
  id: it.id, name: it.name, order: it.order, code: it.code, brand: it.brand ?? 'R&S®',
  page: g.group.startsWith('External harmonic') || g.group.startsWith('Waveguide') || g.group.startsWith('External frontends') || g.group === 'Tools' ? 51 : 50,
  section: 'extras', group: g.group,
  accessory: true, retrofit: 'accessory',
  max: it.max || ACCESSORY_MAX,
  hintIf: it.hintIf, note: it.note
}))));

/* Every option is printed as a type designation: the product's own prefix
   and the code. Models and accessories carry their own code and brand. */
for (const o of OPTIONS) {
  if (o.code === undefined) o.code = productCode(o.id);
  if (o.brand === undefined) o.brand = 'R&S®FSW-';
}

/* A null prototype, so a lookup only answers for an option that exists. */
export const BY_ID = Object.assign(Object.create(null),
  Object.fromEntries(OPTIONS.map(o => [o.id, o])));

/* A clash the ordering information prints on one row holds for both: the
   real-time applications name the bandwidths they are not available for, and
   the bandwidth's own card has to say so too. */
for (const o of OPTIONS) {
  for (const c of o.conflicts || []) {
    const other = BY_ID[c];
    if (!other) throw new Error(`${o.id} conflicts with unknown option ${c}`);
    other.conflicts = other.conflicts || [];
    if (!other.conflicts.includes(o.id)) other.conflicts.push(o.id);
  }
}

/**
 * The type designation printed on a quotation: R&S(R)FSW26 for a model,
 * R&S(R)FSW-K18 for an option, an accessory's own designation, or the
 * order number where R&S prints none.
 */
export function typeName (id) {
  if (id === BASE_UNIT.id) return 'R&S®FSW';
  const o = BY_ID[id];
  if (!o) return `R&S®FSW-${productCode(id)}`;
  return o.code ? o.brand + o.code : o.order;
}

/* ------------------------------------------------------------------ *
 * Panel connectors
 *
 * Transcribed from "Inputs and outputs" (p32 to p34) and the option
 * sections (p37 to p41). `when` names the derived condition that makes a
 * connector present; entries without one are fitted to every instrument.
 * Positions in the drawing are schematic - the specifications give the
 * inventory and the connector types, not a panel layout.
 * ------------------------------------------------------------------ */

/** Connectors on the front panel. */
export const FRONT_PANEL = [
  { title: 'RF input', items: [
    { label: 'RF INPUT', kind: 'rf', type: 'per model (p32)', when: 'model' },
    { label: 'RF INPUT 2', kind: 'rf', type: '1.85 mm male, to 67 GHz', when: 'rf2' }
  ]},
  { title: 'External mixer', items: [
    { label: 'LO OUT / IF IN', kind: 'sma', type: 'SMA female, 50 Ω', when: 'extMixer' },
    { label: 'IF IN', kind: 'sma', type: 'SMA female, 50 Ω', when: 'extMixer' }
  ]},
  { title: 'Analog baseband', items: [
    { label: 'BASEBAND INPUT I', kind: 'bnc', type: 'BNC female, 50 Ω', when: 'analogBb' },
    { label: 'BASEBAND INPUT Q', kind: 'bnc', type: 'BNC female, 50 Ω', when: 'analogBb' },
    { label: 'BASEBAND INPUT Ī', kind: 'bnc', type: 'BNC female, 50 Ω', when: 'analogBbInv' },
    { label: 'BASEBAND INPUT Q̄', kind: 'bnc', type: 'BNC female, 50 Ω', when: 'analogBbInv' }
  ]},
  { title: 'Front', items: [
    { label: 'TRIGGER 1 IN', kind: 'bnc', type: 'BNC female, 0.5 V to 3.5 V' },
    { label: 'PROBE POWER', kind: 'digital', type: '+15 V / −12.6 V, 150 mA' },
    { label: 'NOISE SOURCE CTRL', kind: 'bnc', type: 'BNC female, 0 V / 28 V' },
    { label: 'POWER SENSOR', kind: 'digital', type: '7-pin LEMOSA female' },
    { label: 'USB', kind: 'digital', type: 'type A, USB 2.0', count: 2 },
    { label: 'PHONES', kind: 'jack', type: '3.5 mm mini-jack, 10 Ω' }
  ]}
];

/** Connectors on the rear panel. */
export const REAR_PANEL = [
  { title: 'Reference', items: [
    { label: 'REF IN 1–50 MHz', kind: 'bnc', type: 'BNC female, > 0 dBm' },
    { label: 'REF IN 100 MHz/1 GHz', kind: 'sma', type: 'SMA female, 0 to 10 dBm' },
    { label: 'REF OUT 10 MHz', kind: 'bnc', type: 'BNC female, 10 dBm' },
    { label: 'REF OUT 1–50 MHz', kind: 'bnc', type: 'BNC female' },
    { label: 'REF OUT 100 MHz', kind: 'sma', type: 'SMA female, 6 dBm' },
    { label: 'REF OUT 640 MHz', kind: 'sma', type: 'SMA female, 16 dBm' }
  ]},
  { title: 'IF and video', items: [
    { label: 'IF/VIDEO OUT', kind: 'bnc', type: 'BNC female, 50 Ω' },
    { label: 'IF WIDE OUT', kind: 'sma', type: 'SMA female, 50 Ω', when: 'ifWide' },
    { label: 'IF OUT 2 GHz', kind: 'sma', type: 'SMA female, 50 Ω', when: 'if2g' }
  ]},
  { title: 'Trigger and sync', items: [
    { label: 'TRIGGER 2 IN/OUT', kind: 'bnc', type: 'BNC female' },
    { label: 'TRIGGER 3 IN/OUT', kind: 'bnc', type: 'BNC female' },
    { label: 'SYNC IN', kind: 'digital', type: 'HDMI' },
    { label: 'SYNC OUT', kind: 'digital', type: 'HDMI' },
    { label: 'AUX PORT', kind: 'digital', type: '9-pin D-Sub male' }
  ]},
  { title: 'Baseband and streaming', items: [
    { label: 'DIGITAL BASEBAND IN', kind: 'digital', type: '26-pin MDR female', when: 'digitalIq' },
    { label: 'DIGITAL BASEBAND OUT', kind: 'digital', type: '26-pin MDR female', when: 'digitalIq' },
    { label: 'DIG IQ 40G', kind: 'digital', type: 'QSFP+', when: 'stream' },
    { label: 'EXT GEN CONTROL', kind: 'digital', type: 'IEC/IEEE bus, aux control', when: 'extGen' }
  ]},
  { title: 'Computer', items: [
    { label: 'IEC/IEEE BUS', kind: 'digital', type: '24-pin Amphenol female' },
    { label: 'LAN', kind: 'digital', type: 'RJ-45, 10/100/1000BASE-T' },
    { label: 'DVI-D', kind: 'digital', type: 'external monitor' },
    { label: 'DISPLAYPORT', kind: 'digital', type: 'external monitor' },
    { label: 'USB', kind: 'digital', type: 'type A, USB 2.0', count: 5 },
    { label: 'USB DEVICE', kind: 'digital', type: 'type B, remote control', when: 'usbRemote' },
    { label: 'AC POWER', kind: 'power', type: '100 V to 240 V, 50/60/400 Hz' }
  ]}
];
