/**
 * R&S(R) SMW200A option catalog.
 *
 * Every entry is transcribed from "R&S(R)SMW200A Vector Signal Generator --
 * Configuration guide", version 06.00, May 2024 (PD 3606.8037.92), which is
 * kept in docs/source/ for reference. The `step` field points back at the
 * step number used by that guide so any rule can be traced to its source.
 *
 * Requirement expressions use the mini-language parsed in rules.js:
 *   A&B   both        A|B   either        A*2   two units of A
 *   (...) grouping    GEN / WGEN / BB / GNSS / RFB  named shorthands
 */

export const BASE_UNIT = {
  id: 'SMW200A',
  name: 'R&S®SMW200A vector signal generator',
  sub: 'Base unit incl. power cable and quick start guide',
  order: '1412.0000.02'
};

export const GUIDE = {
  title: 'R&S®SMW200A Vector Signal Generator – Configuration guide',
  version: 'Version 06.00, May 2024',
  pd: 'PD 3606.8037.92'
};

/* ------------------------------------------------------------------ *
 * Named shorthands used inside requirement expressions
 * ------------------------------------------------------------------ */
export const SHORTHAND = {
  // any baseband generator (the guide's "R&S SMW-B9/-B10")
  GEN: 'B9|B9F|B10',
  // wideband generator only; B9F accepts everything that runs on B9
  WGEN: 'B9|B9F',
  // any baseband main module
  BB: 'B13|B13T|B13XT',
  // main modules that carry two I/Q paths
  BB2: 'B13T|B13XT',
  // a GNSS standard, as listed for K108/K109
  GNSS: 'K44|K66|K94|K97|K98|K106|K107|K123|K128|K132',
  // the shorter GNSS list used by K129/K134/K136..K139
  GNSSB: 'K44|K66|K94|K97|K98|K107|K123|K128|K132',
  // a frequency option in RF path B
  RFB: 'B2003|B2006|B2007|B2012|B2020|B2031|B2044|B2044N|B2044O',
  // a frequency option of 6 GHz or above in either path (K553)
  F6: 'B1006|B1007|B1012|B1020|B1031|B1040|B1040N|B1044|B1044N|B1044O|' +
      'B1056|B1056N|B1056O|B1067|B1067N|B1067O|' +
      'B2006|B2007|B2012|B2020|B2031|B2044|B2044N|B2044O',
  // any RF path A frequency option
  RFA: 'B1003|B1006|B1007|B1012|B1020|B1031|B1040|B1040N|B1044|B1044N|' +
       'B1044O|B1056|B1056N|B1056O|B1067|B1067N|B1067O',
  // RF path A frequency options that are not "O" variants
  RFAX: 'B1003|B1006|B1007|B1012|B1020|B1031|B1040|B1040N|B1044|B1044N|' +
        'B1056|B1056N|B1067|B1067N'
};

/** Frequency options that force the wideband main module and block B90/K739/K545. */
export const O_VARIANTS = ['B1044O', 'B1056O', 'B1067O', 'B2044O'];

/**
 * RF path A -> permitted RF path B frequency options.
 * Transcribed from section 1.2 "Frequency options and RF path configurations".
 * An empty array means path A can only be used as a single-path instrument.
 */
export const RF_PATH_MATRIX = {
  B1003:  ['B2003'],
  B1006:  ['B2006', 'B2020'],
  B1007:  ['B2007'],
  B1012:  ['B2006', 'B2012'],
  B1020:  ['B2006', 'B2020'],
  B1031:  ['B2031'],
  B1040:  [],
  B1040N: [],
  B1044:  ['B2044'],
  B1044N: ['B2044N'],
  B1044O: ['B2044O'],
  B1056:  [],
  B1056N: [],
  B1056O: [],
  B1067:  [],
  B1067N: [],
  B1067O: []
};

/** RF path B options that require the deeper chassis (R&S SMW-B94L). */
export const B94L_REQUIRED = ['B2012', 'B2031', 'B2044', 'B2044N', 'B2044O'];

/** The four phase noise performance levels; all installed paths must match. */
export const PHASE_NOISE_LEVELS = [
  { id: 'std',      label: 'Standard performance',   a: null,   b: null,
    blurb: 'Comes with the frequency option – no extra option needed.' },
  { id: 'low',      label: 'Low phase noise',        a: 'B709', b: 'B719',
    blurb: 'Lower broadband noise floor across the tuning range.' },
  { id: 'improved', label: 'Improved close-in phase noise', a: 'B710', b: 'B720',
    blurb: 'Optimised for close-in offsets near the carrier.' },
  { id: 'ultra',    label: 'Ultra low phase noise',  a: 'B711', b: 'B721',
    blurb: 'Best-in-class phase noise for demanding radar and ADC clock work.' }
];

/* ------------------------------------------------------------------ *
 * Sections shown in the configurator (guide steps in brackets)
 * ------------------------------------------------------------------ */
export const SECTIONS = [
  { id: 'rf-a',      label: 'RF path A',            steps: [1],    kind: 'single', icon: 'wave',
    blurb: 'Mandatory. Sets the upper frequency limit of the instrument. Cannot be retrofitted – choose with headroom.' },
  { id: 'baseband',  label: 'Baseband main module', steps: [2],    kind: 'single', icon: 'chip',
    blurb: 'Mandatory. Decides whether you get the standard baseband section (up to 160 MHz RF bandwidth) or the wideband section (up to 2 GHz).' },
  { id: 'rf-b',      label: 'RF path B',            steps: [5],    kind: 'single', icon: 'split',
    blurb: 'Optional second RF path. Only certain path A / path B frequency combinations exist; the deeper chassis is added automatically where it is required.' },
  { id: 'phase',     label: 'Phase noise',          steps: [3, 6], kind: 'level',  icon: 'noise',
    blurb: 'One performance level for the whole instrument. When RF path B is installed the matching path B option is ordered automatically.' },
  { id: 'rf-enh',    label: 'RF path enhancements', steps: [4, 7], kind: 'multi',  icon: 'plus',
    blurb: 'Enhancements for the RF paths. Options marked "floating" are ordered twice only if you need them in both paths at the same time.' },
  { id: 'bb-hw',     label: 'Baseband hardware',    steps: [8, 9], kind: 'multi',  icon: 'stack',
    blurb: 'Generators, memory and bandwidth for the baseband section you picked. Standard and wideband hardware cannot be mixed.' },
  { id: 'bb-enh',    label: 'Baseband enhancements',steps: [10],   kind: 'multi',  icon: 'sliders',
    blurb: 'Signal conditioning and impairment tools that sit on top of the baseband hardware.' },
  { id: 'std-int',   label: 'Digital standards',    steps: [11],   kind: 'multi',  icon: 'radio',
    blurb: 'Real-time and ARB standards generated inside the instrument.' },
  { id: 'std-wiq',   label: 'WinIQSIM2 standards',  steps: [12],   kind: 'multi',  icon: 'pc',
    blurb: 'Waveforms calculated on an external PC with R&S®WinIQSIM2 and played back by the instrument.' },
  { id: 'pulse',     label: 'Pulse Sequencer',      steps: [13],   kind: 'multi',  icon: 'pulse',
    blurb: 'Radar and EW signal creation with the external R&S®Pulse Sequencer software.' },
  { id: 'fading',    label: 'MIMO & fading',        steps: [14],   kind: 'multi',  icon: 'mimo',
    blurb: 'Fading simulators, MIMO routing and multi-entity scenarios.' },
  { id: 'other',     label: 'Other options',        steps: [15],   kind: 'multi',  icon: 'panel',
    blurb: 'Rear panel connectors, storage and service tooling.' },
  { id: 'extras',    label: 'Accessories',          steps: [],     kind: 'extras', icon: 'box',
    blurb: 'Recommended extras from the ordering information. Not validated against the configuration rules.' }
];

/* ------------------------------------------------------------------ *
 * Option catalog
 *
 * id          option code without the "R&S(R)SMW-" prefix
 * name        designation as printed in the guide
 * order       R&S order number
 * step        step number in the configuration guide
 * section     section id above
 * group       sub-heading inside the section
 * requires    machine-checkable requirement expression (null = none)
 * reqText     the guide's own "Requires" wording, shown in the UI
 * max         maximum quantity (default 1)
 * maxReq      expression that must hold before quantity may exceed 1
 * qtySteps    explicit list of permitted quantities (overrides max)
 * conflicts   option ids that may not be installed at the same time
 * note        the guide's "Remarks" column
 * retrofit    'no' | 'factory' | 'service' | 'keycode'
 * meta        values used to derive instrument capabilities
 * ------------------------------------------------------------------ */

/**
 * RF output connector fitted for each frequency option, from the front panel
 * connector table in the specifications. The frequency option decides the
 * connector, so the configurator can state which one an instrument arrives with.
 */
export const RF_CONNECTOR = {
  'N female':
    ['B1003', 'B1006', 'B1007', 'B2003', 'B2006', 'B2007'],
  'PC 2.92 mm female':
    ['B1012', 'B1020', 'B1031', 'B1040', 'B1040N', 'B2012', 'B2020', 'B2031'],
  'PC 1.85 mm male':
    ['B1044', 'B1044N', 'B1044O', 'B2044', 'B2044N', 'B2044O'],
  '1.85 mm female':
    ['B1056', 'B1056N', 'B1056O', 'B1067', 'B1067N', 'B1067O']
};

/** Extra wording the specifications attach to some of those connectors. */
export const CONNECTOR_NOTE = {
  'PC 2.92 mm female': 'test port adapter, interchangeable port connector system',
  'PC 1.85 mm male': 'adapter 1.85 mm female/female included',
  '1.85 mm female': 'interchangeable 1.85 mm female/female wear and tear adapter'
};

const CONN_OF = {};
for (const [type, ids] of Object.entries(RF_CONNECTOR)) for (const id of ids) CONN_OF[id] = type;

const F = (id, ghz, order, opts = {}) => ({
  id, name: `100 kHz to ${ghz} GHz`, order, step: 1, section: 'rf-a',
  group: 'Frequency options, RF path A', retrofit: 'no',
  meta: { fMax: ghz, path: 'A', conn: CONN_OF[id] }, ...opts
});

const FB = (id, ghz, order, opts = {}) => ({
  id, name: `100 kHz to ${ghz} GHz, RF path B`, order, step: 5, section: 'rf-b',
  group: 'Frequency options, RF path B', retrofit: 'no',
  reqText: 'R&S®SMW-B13T or R&S®SMW-B13XT',
  requires: 'BB2', meta: { fMax: ghz, path: 'B', conn: CONN_OF[id] }, ...opts
});

const LIMITED = 'I/Q modulation bandwidth and minimum pulse width limited';

export const OPTIONS = [

  /* -- Step 1: frequency options, RF path A ------------------------ */
  F('B1003',  3,     '1428.4700.02'),
  F('B1006',  6,     '1428.4800.02'),
  F('B1007',  7.5,   '1428.7700.02'),
  F('B1012',  12.75, '1428.4900.02'),
  F('B1020',  20,    '1428.5107.02'),
  F('B1031',  31.8,  '1428.5307.02'),
  F('B1040',  40,    '1428.8506.02'),
  F('B1040N', 40,    '1428.8606.02', { note: LIMITED }),
  F('B1044',  44,    '1428.5507.02'),
  F('B1044N', 44,    '1428.5407.02', { note: LIMITED }),
  F('B1044O', 44,    '1442.0144.02', { note: LIMITED + '; wideband baseband main module only' }),
  F('B1056',  56,    '1438.9357.02'),
  F('B1056N', 56,    '1438.9457.02', { note: LIMITED }),
  F('B1056O', 56,    '1442.0244.02', { note: LIMITED + '; wideband baseband main module only' }),
  F('B1067',  67,    '1428.8106.02'),
  F('B1067N', 67,    '1428.8306.02', { note: LIMITED }),
  F('B1067O', 67,    '1442.0344.02', { note: LIMITED + '; wideband baseband main module only' }),

  /* -- Step 2: signal routing and baseband main module ------------- */
  { id: 'B13', name: 'Signal routing and baseband main module, one I/Q path to RF section',
    order: '1413.2807.02', step: 2, section: 'baseband', group: 'Baseband main modules',
    retrofit: 'factory', conflicts: O_VARIANTS,
    note: 'Not compatible with R&S®SMW-BxxxxO frequency options. A second RF path needs R&S®SMW-B13T or -B13XT.',
    meta: { bbSection: 'standard', iqPaths: 1, maxBw: 160 } },
  { id: 'B13T', name: 'Signal routing and baseband main module, two I/Q paths to RF section',
    order: '1413.3003.02', step: 2, section: 'baseband', group: 'Baseband main modules',
    retrofit: 'factory', conflicts: O_VARIANTS,
    note: 'Required for a second RF path. Not compatible with R&S®SMW-BxxxxO frequency options.',
    meta: { bbSection: 'standard', iqPaths: 2, maxBw: 160 } },
  { id: 'B13XT', name: 'Wideband signal routing and baseband main module, two I/Q paths to RF section',
    order: '1413.8005.02', step: 2, section: 'baseband', group: 'Baseband main modules',
    retrofit: 'factory',
    note: 'Retrofitting only for instruments with serial number 102700 or higher.',
    meta: { bbSection: 'wideband', iqPaths: 2, maxBw: 2000 } },

  /* -- Step 5: frequency options, RF path B ------------------------ */
  FB('B2003',  3,     '1428.5707.02'),
  FB('B2006',  6,     '1428.5807.02'),
  FB('B2007',  7.5,   '1428.7900.02'),
  FB('B2012',  12.75, '1438.8950.02', { reqText: 'R&S®SMW-B13T or R&S®SMW-B13XT; R&S®SMW-B94L' }),
  FB('B2020',  20,    '1428.6103.02'),
  FB('B2031',  31.8,  '1438.8750.02', { reqText: 'R&S®SMW-B13T or R&S®SMW-B13XT; R&S®SMW-B94L' }),
  FB('B2044',  44,    '1438.8350.02', { reqText: 'R&S®SMW-B13T or R&S®SMW-B13XT; R&S®SMW-B94L' }),
  FB('B2044N', 44,    '1438.8550.02', { note: LIMITED, reqText: 'R&S®SMW-B13T or R&S®SMW-B13XT; R&S®SMW-B94L' }),
  FB('B2044O', 44,    '1442.0444.02', { note: LIMITED, requires: 'B13XT',
    reqText: 'R&S®SMW-B13XT; R&S®SMW-B94L' }),
  { id: 'B94L', name: 'Deeper chassis', order: '1438.8150.02', step: 5, section: 'rf-b',
    group: 'Platform option for two-path instruments', retrofit: 'no', auto: true,
    note: 'Mandatory – and only possible – for the 2 × 12.75 GHz, 2 × 31.8 GHz and 2 × 44 GHz RF path combinations.',
    meta: { chassis: 'deep' } },

  /* -- Steps 3 + 6: phase noise ------------------------------------ */
  { id: 'B709', name: 'Low phase noise, RF path A', order: '1428.7300.02', step: 3,
    section: 'phase', group: 'Phase noise performance options, RF path A', retrofit: 'no',
    requires: 'RFA', reqText: 'Frequency option (step 1)', conflicts: ['B710', 'B711'] },
  { id: 'B710', name: 'Improved close-in phase noise performance, RF path A', order: '1428.6503.02',
    step: 3, section: 'phase', group: 'Phase noise performance options, RF path A', retrofit: 'no',
    requires: 'RFA', reqText: 'Frequency option (step 1)', conflicts: ['B709', 'B711'] },
  { id: 'B711', name: 'Ultra low phase noise, RF path A', order: '1428.6703.02', step: 3,
    section: 'phase', group: 'Phase noise performance options, RF path A', retrofit: 'no',
    requires: 'RFA', reqText: 'Frequency option (step 1)', conflicts: ['B709', 'B710'] },
  { id: 'B719', name: 'Low phase noise, RF path B', order: '1428.7500.02', step: 6,
    section: 'phase', group: 'Phase noise performance options, RF path B', retrofit: 'no',
    requires: 'RFB&B709', reqText: 'Frequency options in RF paths A and B, R&S®SMW-B709 in RF path A',
    conflicts: ['B720', 'B721'] },
  { id: 'B720', name: 'Improved close-in phase noise performance, RF path B', order: '1428.6903.02',
    step: 6, section: 'phase', group: 'Phase noise performance options, RF path B', retrofit: 'no',
    requires: 'RFB&B710', reqText: 'Frequency options in RF paths A and B, R&S®SMW-B710 in RF path A',
    conflicts: ['B719', 'B721'] },
  { id: 'B721', name: 'Ultra low phase noise, RF path B', order: '1428.7100.02', step: 6,
    section: 'phase', group: 'Phase noise performance options, RF path B', retrofit: 'no',
    requires: 'RFB&B711', reqText: 'Frequency options in RF paths A and B, R&S®SMW-B711 in RF path A',
    conflicts: ['B719', 'B720'] },

  /* -- Steps 4 + 7: RF path enhancements --------------------------- */
  { id: 'B90', name: 'Phase coherence', order: '1413.5841.02', step: 4, section: 'rf-enh',
    group: 'Other RF options', retrofit: 'service', requires: 'RFAX', conflicts: O_VARIANTS,
    reqText: 'Frequency option other than R&S®SMW-B1xxxO',
    note: 'Installed once, usable with all installed RF paths.' },
  { id: 'K22', name: 'Pulse modulator', order: '1413.3249.02', step: 4, section: 'rf-enh',
    group: 'Other RF options', retrofit: 'keycode', requires: 'RFA', max: 2, maxReq: 'RFB',
    reqText: 'A frequency option in the path where it is used',
    note: 'Floating license – order twice to use it in both RF paths at the same time.', floating: true },
  { id: 'K23', name: 'Pulse generator', order: '1413.3284.02', step: 4, section: 'rf-enh',
    group: 'Other RF options', retrofit: 'keycode', requires: 'BB', max: 2, maxReq: 'BB2',
    reqText: 'R&S®SMW-B13/-B13T/-B13XT',
    note: 'Floating license – order twice to use it in both RF paths at the same time.', floating: true },
  { id: 'K24', name: 'Multifunction generator', order: '1413.3332.02', step: 4, section: 'rf-enh',
    group: 'Other RF options', retrofit: 'keycode', requires: 'BB', max: 2, maxReq: 'BB2',
    reqText: 'R&S®SMW-B13/-B13T/-B13XT',
    note: 'Floating license – order twice to use it in both RF paths at the same time.', floating: true },
  { id: 'K553', name: 'External frontend control', order: '1414.6758.02', step: 4, section: 'rf-enh',
    group: 'Other RF options', retrofit: 'keycode', requires: 'F6', max: 2, maxReq: 'RFB',
    reqText: 'Frequency option with 6 GHz or higher' },
  { id: 'K703', name: '100 MHz, 1 GHz ultra low noise reference input/output', order: '1413.7380.02',
    step: 4, section: 'rf-enh', group: 'Other RF options', retrofit: 'keycode', requires: 'RFA',
    reqText: 'Frequency option (step 1)', note: 'Installed once, usable with all installed RF paths.' },
  { id: 'K704', name: 'Flexible reference input (1 MHz to 100 MHz)', order: '1414.6541.02',
    step: 4, section: 'rf-enh', group: 'Other RF options', retrofit: 'keycode', requires: 'RFA',
    reqText: 'Frequency option (step 1)', note: 'Installed once, usable with all installed RF paths.' },
  { id: 'K720', name: 'AM/FM/φM', order: '1413.7438.02', step: 4, section: 'rf-enh',
    group: 'Other RF options', retrofit: 'keycode', requires: 'RFA&BB2', max: 2, maxReq: 'B2003|B2006|B2007|B2012|B2020',
    reqText: 'Frequency option and R&S®SMW-B13T/-B13XT',
    note: 'Floating license. In RF path B not available with R&S®SMW-B2031/-B2044(N/O).', floating: true },
  { id: 'K739', name: 'Differential analog I/Q inputs', order: '1413.7167.02', step: 4,
    section: 'rf-enh', group: 'Other RF options', retrofit: 'keycode', requires: 'RFAX',
    conflicts: O_VARIANTS, reqText: 'Frequency option other than R&S®SMW-B1xxxO' },

  /* -- Step 8: standard baseband hardware -------------------------- */
  { id: 'B10', name: 'Baseband generator with ARB (64 Msample) and digital modulation (real-time), 120 MHz RF bandwidth',
    order: '1413.1200.02', step: 8, section: 'bb-hw', group: 'Standard baseband',
    retrofit: 'service', requires: 'B13|B13T', reqText: 'R&S®SMW-B13 or R&S®SMW-B13T',
    max: 2, maxReq: 'B13T', note: 'Can be installed once or twice.',
    meta: { gen: 'standard', arb: 64, bw: 120 } },
  { id: 'K16', name: 'Differential analog I/Q outputs', order: '1413.3384.02', step: 8,
    section: 'bb-hw', group: 'Standard baseband', retrofit: 'keycode', requires: 'B13|B13T',
    reqText: 'R&S®SMW-B13 or R&S®SMW-B13T', max: 2, maxReq: 'B13T' },
  { id: 'K18', name: 'Digital baseband output', order: '1413.3432.02', step: 8, section: 'bb-hw',
    group: 'Standard baseband', retrofit: 'keycode', requires: 'B13|B13T',
    reqText: 'R&S®SMW-B13 or R&S®SMW-B13T', max: 2, maxReq: 'B13T' },
  { id: 'K501', name: 'Extended sequencing', order: '1413.9218.02', step: 8, section: 'bb-hw',
    group: 'Standard baseband', retrofit: 'keycode', requires: 'B10', reqText: 'R&S®SMW-B10',
    max: 2, maxReq: 'B10*2' },
  { id: 'K511', name: 'ARB memory extension to 512 Msample', order: '1413.6860.02', step: 8,
    section: 'bb-hw', group: 'Standard baseband', retrofit: 'keycode', requires: 'B10',
    reqText: 'R&S®SMW-B10', max: 2, maxReq: 'B10*2', meta: { arb: 512 } },
  { id: 'K512', name: 'ARB memory extension to 1 Gsample', order: '1413.6919.02', step: 8,
    section: 'bb-hw', group: 'Standard baseband', retrofit: 'keycode', requires: 'K511',
    reqText: 'R&S®SMW-K511', max: 2, maxReq: 'K511*2', meta: { arb: 1024 } },
  { id: 'K522', name: 'Baseband extension to 160 MHz RF bandwidth', order: '1413.6960.02', step: 8,
    section: 'bb-hw', group: 'Standard baseband', retrofit: 'keycode', requires: 'B10',
    reqText: 'R&S®SMW-B10', max: 2, maxReq: 'B10*2', meta: { bw: 160 } },

  /* -- Step 9: wideband baseband hardware -------------------------- */
  { id: 'B9', name: 'Wideband baseband generator with ARB (256 Msample), 500 MHz RF bandwidth',
    order: '1413.7350.02', step: 9, section: 'bb-hw', group: 'Wideband baseband',
    retrofit: 'service', requires: 'B13XT', reqText: 'R&S®SMW-B13XT', max: 2, conflicts: ['B9F'],
    note: 'Can be installed once or twice. Cannot be mixed with R&S®SMW-B9F.',
    meta: { gen: 'wideband', arb: 256, bw: 500 } },
  { id: 'B9F', name: 'Wideband baseband generator for GNSS with high dynamics, ARB (256 Msample), 500 MHz RF bandwidth',
    order: '1434.7808.02', step: 9, section: 'bb-hw', group: 'Wideband baseband',
    retrofit: 'service', requires: 'B13XT', reqText: 'R&S®SMW-B13XT', max: 2, conflicts: ['B9'],
    note: 'Can be installed once or twice. Cannot be mixed with R&S®SMW-B9. Enhancements for R&S®SMW-B9 also work here.',
    meta: { gen: 'wideband', arb: 256, bw: 500, gnssHighDyn: true } },
  { id: 'K17', name: 'Wideband differential analog I/Q outputs', order: '1414.2346.02', step: 9,
    section: 'bb-hw', group: 'Wideband baseband', retrofit: 'keycode', requires: 'B13XT',
    reqText: 'R&S®SMW-B13XT', note: 'Can be installed once.' },
  { id: 'K19', name: 'Digital baseband output for wideband baseband', order: '1414.3865.02',
    step: 9, section: 'bb-hw', group: 'Wideband baseband', retrofit: 'keycode', requires: 'B13XT',
    reqText: 'R&S®SMW-B13XT', max: 2 },
  { id: 'K502', name: 'Wideband extended sequencing', order: '1413.9260.02', step: 9,
    section: 'bb-hw', group: 'Wideband baseband', retrofit: 'keycode', requires: 'WGEN',
    reqText: 'R&S®SMW-B9', max: 2, maxReq: 'WGEN*2' },
  { id: 'K503', name: 'Real-time control interface', order: '1414.3620.02', step: 9,
    section: 'bb-hw', group: 'Wideband baseband', retrofit: 'keycode', requires: 'K502',
    reqText: 'R&S®SMW-K502', max: 2, maxReq: 'K502*2' },
  { id: 'K504', name: 'Real-time control interface with enhanced PDW rate and control PDWs',
    order: '1414.3665.02', step: 9, section: 'bb-hw', group: 'Wideband baseband',
    retrofit: 'keycode', requires: 'K503', reqText: 'R&S®SMW-K503', max: 2, maxReq: 'K503*2' },
  { id: 'K506', name: 'Agile sequencing', order: '1413.3555.02', step: 9, section: 'bb-hw',
    group: 'Wideband baseband', retrofit: 'keycode', requires: 'WGEN', reqText: 'R&S®SMW-B9',
    max: 2, maxReq: 'WGEN*2' },
  { id: 'K507', name: 'ARB Ethernet upload', order: '1414.6206.02', step: 9, section: 'bb-hw',
    group: 'Wideband baseband', retrofit: 'keycode', requires: 'WGEN', reqText: 'R&S®SMW-B9',
    max: 2, maxReq: 'WGEN*2' },
  { id: 'K515', name: 'ARB memory extension to 2 Gsample', order: '1413.9360.02', step: 9,
    section: 'bb-hw', group: 'Wideband baseband', retrofit: 'keycode', requires: 'WGEN',
    reqText: 'R&S®SMW-B9', max: 2, maxReq: 'WGEN*2', meta: { arb: 2048 } },
  { id: 'K525', name: 'Baseband extension to 1 GHz RF bandwidth', order: '1414.6129.02', step: 9,
    section: 'bb-hw', group: 'Wideband baseband', retrofit: 'keycode', requires: 'WGEN',
    reqText: 'R&S®SMW-B9', max: 2, maxReq: 'WGEN*2', meta: { bw: 1000 } },
  { id: 'K527', name: 'Baseband extension to 2 GHz RF bandwidth', order: '1414.6158.02', step: 9,
    section: 'bb-hw', group: 'Wideband baseband', retrofit: 'keycode', requires: 'K525',
    reqText: 'R&S®SMW-K525', max: 2, maxReq: 'K525*2', meta: { bw: 2000 } },

  /* -- Step 10: baseband enhancements ------------------------------ */
  { id: 'K62', name: 'Additive white Gaussian noise (AWGN)', order: '1413.3484.02', step: 10,
    section: 'bb-enh', group: 'Baseband enhancements', retrofit: 'keycode', requires: 'BB',
    reqText: 'R&S®SMW-B13/-B13T/-B13XT', max: 2, maxReq: 'BB2' },
  { id: 'K80', name: 'Bit error rate tester', order: '1414.6187.02', step: 10, section: 'bb-enh',
    group: 'Baseband enhancements', retrofit: 'keycode', requires: 'GEN',
    reqText: 'R&S®SMW-B10 or R&S®SMW-B9', note: 'Can be installed once.' },
  { id: 'K540', name: 'Envelope tracking', order: '1413.7215.02', step: 10, section: 'bb-enh',
    group: 'Baseband enhancements', retrofit: 'keycode',
    requires: '((B13|B13T)&K16)|(B13XT&K17)',
    reqText: 'R&S®SMW-B13/-B13T and -K16, or R&S®SMW-B13XT and -K17',
    max: 2, maxReq: 'B13T&K16*2' },
  { id: 'K541', name: 'AM/AM, AM/φM predistortion', order: '1413.7267.02', step: 10,
    section: 'bb-enh', group: 'Baseband enhancements', retrofit: 'keycode', requires: 'GEN',
    reqText: 'R&S®SMW-B9/-B10', max: 2, maxReq: 'GEN*2&RFB&BB2' },
  { id: 'K544', name: 'User-defined frequency response correction', order: '1414.3707.02', step: 10,
    section: 'bb-enh', group: 'Baseband enhancements', retrofit: 'keycode', requires: 'BB',
    reqText: 'R&S®SMW-B13/-B13T/-B13XT', max: 2, maxReq: 'BB2' },
  { id: 'K545', name: 'RF port alignment', order: '1414.6429.02', step: 10, section: 'bb-enh',
    group: 'Baseband enhancements', retrofit: 'keycode', requires: 'B90&GEN&K61&K544',
    conflicts: O_VARIANTS,
    reqText: 'R&S®SMW-B90 and, for each installed RF path, R&S®SMW-B9/-B10, -K61 and -K544',
    note: 'Can be installed once. Not compatible with R&S®SMW-BxxxxO frequency options.',
    perPath: ['GEN', 'K61', 'K544'] },
  { id: 'K546', name: 'Digital Doherty', order: '1414.6487.02', step: 10, section: 'bb-enh',
    group: 'Baseband enhancements', retrofit: 'keycode', requires: 'K541*2&GEN*2&RFB&BB2',
    reqText: 'Two R&S®SMW-K541, two R&S®SMW-B9/-B10, two RF paths and R&S®SMW-B13T/-B13XT',
    note: 'Can be installed once.' },
  { id: 'K548', name: 'Crest factor reduction', order: '1414.6641.02', step: 10, section: 'bb-enh',
    group: 'Baseband enhancements', retrofit: 'keycode', requires: 'GEN', reqText: 'R&S®SMW-B9/-B10',
    max: 2, maxReq: 'GEN*2' },
  { id: 'K551', name: 'Slow I/Q', order: '1413.9724.02', step: 10, section: 'bb-enh',
    group: 'Baseband enhancements', retrofit: 'keycode', requires: '(B10&K18)|(WGEN&K19)',
    reqText: 'R&S®SMW-B10 and -K18, or R&S®SMW-B9 and -K19' },
  { id: 'K555', name: 'Bandwidth extension', order: '1414.6229.02', step: 10, section: 'bb-enh',
    group: 'Baseband enhancements', retrofit: 'keycode',
    requires: 'RFA&RFB&B9*2&K525*2&K527*2',
    reqText: 'R&S®SMW-B1xxx and -B2xxx frequency options, two R&S®SMW-B9, two -K525, two -K527',
    note: 'Can be installed once. Combines both paths – needs an R&S®SMW-ZKK/-ZKV combiner kit.',
    meta: { clock: 4800 } },
  { id: 'K810', name: 'Enhanced noise generation', order: '1414.6341.02', step: 10,
    section: 'bb-enh', group: 'Baseband enhancements', retrofit: 'keycode', requires: 'K62',
    reqText: 'R&S®SMW-K62', max: 2, maxReq: 'K62*2' },
  { id: 'K811', name: 'Notched signals', order: '1414.6364.02', step: 10, section: 'bb-enh',
    group: 'Baseband enhancements', retrofit: 'keycode', requires: 'GEN', reqText: 'R&S®SMW-B9/-B10',
    max: 2, maxReq: 'GEN*2' },

  /* -- Step 14: multichannel, MIMO and fading ---------------------- */
  { id: 'B14', name: 'Fading simulator', order: '1413.1500.02', step: 14, section: 'fading',
    group: 'Multichannel, MIMO and fading', retrofit: 'service', requires: '(B13|B13T)&B10',
    reqText: 'R&S®SMW-B13/-B13T and at least one R&S®SMW-B10', qtySteps: [1, 2, 4],
    note: 'Can be installed once, twice or four times.', meta: { fader: 'standard' } },
  { id: 'B15', name: 'Fading simulator and signal processor', order: '1414.4710.02', step: 14,
    section: 'fading', group: 'Multichannel, MIMO and fading', retrofit: 'service',
    requires: 'B13XT&WGEN', reqText: 'R&S®SMW-B13XT and at least one R&S®SMW-B9',
    qtySteps: [2, 4], qtyStepsReq: { 4: 'WGEN*2' },
    note: 'Two or four units; four require two R&S®SMW-B9.', meta: { fader: 'wideband' } },
  { id: 'K71', name: 'Dynamic fading', order: '1413.3532.02', step: 14, section: 'fading',
    group: 'Multichannel, MIMO and fading', retrofit: 'keycode', requires: 'B14|B15',
    reqText: 'R&S®SMW-B14 or R&S®SMW-B15', max: 2, maxReq: 'B14*2|B15*2' },
  { id: 'K72', name: 'Enhanced fading models', order: '1413.3584.02', step: 14, section: 'fading',
    group: 'Multichannel, MIMO and fading', retrofit: 'keycode', requires: 'B14|B15',
    reqText: 'R&S®SMW-B14 or R&S®SMW-B15', max: 2, maxReq: 'B14*2|B15*2' },
  { id: 'K73', name: 'OTA-MIMO fading enhancements', order: '1414.2300.02', step: 14,
    section: 'fading', group: 'Multichannel, MIMO and fading', retrofit: 'keycode',
    requires: '(B14*2|B15*2)&K74&K72*2',
    reqText: 'Two or four R&S®SMW-B14 or -B15, R&S®SMW-K74, two R&S®SMW-K72' },
  { id: 'K74', name: 'MIMO fading/routing', order: '1413.3632.02', step: 14, section: 'fading',
    group: 'Multichannel, MIMO and fading', retrofit: 'keycode',
    requires: '(B13T&B10*2&B14*2)|(B13XT&WGEN*2&B15*2)',
    reqText: 'R&S®SMW-B13T, two -B10, two or four -B14; or R&S®SMW-B13XT, two -B9, two or four -B15',
    meta: { mimo: '4x4' } },
  { id: 'K75', name: 'Higher-order MIMO', order: '1413.9576.02', step: 14, section: 'fading',
    group: 'Multichannel, MIMO and fading', retrofit: 'keycode',
    requires: 'K74&((B13T&B10*2&B14*2)|(B13XT&WGEN*2&B15*2))',
    reqText: 'R&S®SMW-K74 plus the hardware listed for K74', meta: { mimo: '8x8' } },
  { id: 'K76', name: 'Multiple entities', order: '1413.9624.02', step: 14, section: 'fading',
    group: 'Multichannel, MIMO and fading', retrofit: 'keycode',
    requires: '(B13T&B10*2)|(B13XT&WGEN*2)',
    reqText: 'R&S®SMW-B13T and two -B10, or R&S®SMW-B13XT and two -B9' },
  { id: 'K78', name: 'Radar echo generation', order: '1414.1833.02', step: 14, section: 'fading',
    group: 'Multichannel, MIMO and fading', retrofit: 'keycode', requires: 'B14',
    reqText: 'R&S®SMW-B14', max: 2, maxReq: 'B14*2' },
  { id: 'K550', name: 'Stream extender', order: '1413.7315.02', step: 14, section: 'fading',
    group: 'Multichannel, MIMO and fading', retrofit: 'keycode', requires: 'B10*2&K76',
    reqText: 'Two R&S®SMW-B10, R&S®SMW-K76' },
  { id: 'K820', name: 'Customized dynamic fading', order: '1414.2581.02', step: 14,
    section: 'fading', group: 'Multichannel, MIMO and fading', retrofit: 'keycode', requires: 'K71',
    reqText: 'R&S®SMW-K71', max: 2, maxReq: 'K71*2' },
  { id: 'K821', name: 'MIMO subsets for higher-order MIMO', order: '1414.4403.02', step: 14,
    section: 'fading', group: 'Multichannel, MIMO and fading', retrofit: 'keycode', requires: 'K75',
    reqText: 'R&S®SMW-K75' },
  { id: 'K822', name: 'Fading bandwidth extension to 400 MHz', order: '1414.6712.02', step: 14,
    section: 'fading', group: 'Multichannel, MIMO and fading', retrofit: 'keycode', requires: 'B15',
    reqText: 'R&S®SMW-B15', max: 2, maxReq: 'B15*2', meta: { fadeBw: 400 } },
  { id: 'K823', name: 'Fading bandwidth extension to 800 MHz', order: '1414.6735.02', step: 14,
    section: 'fading', group: 'Multichannel, MIMO and fading', retrofit: 'keycode', requires: 'K822',
    reqText: 'R&S®SMW-K822', max: 2, maxReq: 'K822*2', meta: { fadeBw: 800 } },

  /* -- Step 15: other options -------------------------------------- */
  { id: 'B81', name: 'Rear panel connectors for RF path A (3/6 GHz) and I/Q', order: '1413.5893.02',
    step: 15, section: 'other', group: 'Other options', retrofit: 'service',
    requires: 'B1003|B1006', reqText: 'R&S®SMW-B1003 or R&S®SMW-B1006' },
  { id: 'B82', name: 'Rear panel connectors for RF path B (3/6 GHz)', order: '1413.5941.02',
    step: 15, section: 'other', group: 'Other options', retrofit: 'service',
    requires: '(B2003|B2006)&B81', reqText: 'R&S®SMW-B2003 or -B2006, and R&S®SMW-B81' },
  { id: 'B83', name: 'Rear panel connectors for RF path A (20/31.8/40 GHz) and I/Q',
    order: '1414.0937.02', step: 15, section: 'other', group: 'Other options', retrofit: 'service',
    requires: 'B1020|B1031|B1040', reqText: 'R&S®SMW-B1020/-B1031/-B1040' },
  { id: 'B84', name: 'Rear panel connectors for RF path B (20 GHz)', order: '1414.1033.02',
    step: 15, section: 'other', group: 'Other options', retrofit: 'service', requires: 'B2020&B83',
    reqText: 'R&S®SMW-B2020 and R&S®SMW-B83' },
  { id: 'B93', name: 'Solid-state drive', order: '1414.1885.02', step: 15, section: 'other',
    group: 'Other options', retrofit: 'service' },
  { id: 'K980', name: 'Health and utilization monitoring service (HUMS)', order: 'not listed',
    step: 15, section: 'other', group: 'Other options', retrofit: 'keycode',
    note: 'Can be installed once.' },

  /* -- Step 11: internal digital modulation systems ----------------- */
  ...expand(11, 'std-int', 'Cellular standards', [
    ['K40',  'GSM/EDGE',                                  '1413.3684.02', 'GEN'],
    ['K41',  'EDGE Evolution',                            '1413.3732.02', 'K40'],
    ['K42',  '3GPP FDD',                                  '1413.3784.02', 'GEN'],
    ['K46',  'CDMA2000®',                                 '1413.3884.02', 'GEN'],
    ['K47',  '1xEV-DO',                                   '1413.3932.02', 'GEN'],
    ['K50',  'TD-SCDMA',                                  '1413.4039.02', 'GEN'],
    ['K51',  'TD-SCDMA enhanced BS/MS tests',             '1413.4080.02', 'K50'],
    ['K55',  'LTE Release 8',                             '1413.4180.02', 'GEN'],
    ['K68',  'TETRA Release 2',                           '1413.4439.02', 'GEN'],
    ['K69',  'LTE closed-loop BS test',                   '1413.4480.02', 'K55|K115', 'K55*2|K115*2'],
    ['K81',  'Log file generation',                       '1413.4539.02', 'K55|K115|K144', 'K55*2|K115*2|K144*2'],
    ['K83',  '3GPP FDD HSPA/HSPA+, enhanced BS/MS tests', '1413.4580.02', 'K42'],
    ['K84',  'LTE Release 9',                             '1413.5435.02', 'K55'],
    ['K85',  'LTE Release 10 (LTE-Advanced)',             '1413.5487.02', 'K55'],
    ['K87',  '1xEV-DO Rev. B',                            '1413.6519.02', 'K47'],
    ['K112', 'LTE Release 11',                            '1413.8505.02', 'K55'],
    ['K113', 'LTE Release 12',                            '1414.1933.02', 'K55'],
    ['K115', 'Cellular IoT',                              '1414.2723.02', 'GEN'],
    ['K118', 'Verizon 5GTF signals',                      '1414.3465.02', 'GEN'],
    ['K119', 'LTE Release 13/14/15',                      '1414.3542.02', 'K55'],
    ['K130', 'OneWeb user-defined signal generation',     '1414.3788.02', 'GEN', undefined,
             'Only available to authorized OneWeb customers.'],
    ['K143', 'Cellular IoT Release 14',                   '1414.6064.02', 'GEN'],
    ['K144', '5G New Radio',                              '1414.4990.02', 'GEN'],
    ['K145', '5G NR closed-loop BS test',                 '1414.6506.02', 'K144'],
    ['K146', 'Cellular IoT Release 15',                   '1414.6564.02', 'K143'],
    ['K148', '5G NR Release 16',                          '1414.6664.02', 'K144'],
    ['K170', '5G NR sidelink',                            '1413.8640.02', 'GEN'],
    ['K171', '5G NR Release 17',                          '1413.7280.02', 'K148'],
    ['K175', 'U-plane generation',                        '1413.3261.02', 'K55|K144', 'K55*2|K144*2'],
    ['K355', 'OneWeb reference signals',                  '1414.3742.02', 'GEN', undefined,
             'Only available to authorized OneWeb customers.']
  ]),
  ...expand(11, 'std-int', 'Wireless connectivity standards', [
    ['K54',  'IEEE 802.11 (a/b/g/n/j/p)',                 '1413.4139.02', 'GEN'],
    ['K60',  'Bluetooth® EDR',                            '1413.4239.02', 'GEN'],
    ['K86',  'IEEE 802.11ac',                             '1413.5635.02', 'K54'],
    ['K117', 'Bluetooth® 5.x',                            '1414.3336.02', 'K60'],
    ['K131', 'LoRa®',                                     '1414.6464.02', 'GEN'],
    ['K141', 'IEEE 802.11ad',                             '1414.1333.02', 'WGEN&K525&K527', 'K527*2',
             'Runs on R&S®SMW-B9 only; requires R&S®SMW-K525 and -K527.'],
    ['K142', 'IEEE 802.11ax',                             '1414.3259.02', 'K54'],
    ['K147', 'IEEE 802.11be',                             '1413.6677.02', 'K54'],
    ['K149', 'HRP UWB',                                   '1414.6912.02', 'WGEN'],
    ['K177', 'IEEE 802.11ay',                             '1434.8191.02', 'K141'],
    ['K178', 'Bluetooth® 5.4 and channel sounding',       '1434.8279.02', 'K117']
  ]),
  ...expand(11, 'std-int', 'Navigation standards', [
    ['K44',  'GPS',                                       '1413.3832.02', 'GEN'],
    ['K66',  'Galileo',                                   '1413.4380.02', 'GEN'],
    ['K94',  'GLONASS',                                   '1414.1485.02', 'GEN'],
    ['K97',  'NavIC/IRNSS',                               '1414.6258.02', 'GEN'],
    ['K98',  'Modernized GPS',                            '1414.1533.02', 'GEN'],
    ['K106', 'SBAS/QZSS',                                 '1414.2923.02', 'K44'],
    ['K107', 'BeiDou',                                    '1414.1585.02', 'GEN'],
    ['K108', 'Real-world scenarios',                      '1414.2975.02', 'GNSS', '-'],
    ['K109', 'GNSS real-time interfaces (RT remote control)', '1414.3013.02', 'GNSS', '-'],
    ['K122', 'Virtual RTK reference station',             '1414.6993.02',
             'K44|K66|K94|K98|K107|K123|K132', '-'],
    ['K123', 'Modernized GLONASS',                        '1413.3310.02', 'GEN'],
    ['K128', 'P(Y)-/M-/PRS-noise',                        '1413.3361.02', 'GEN'],
    ['K129', 'Matched-spectrum GNSS interferer',          '1434.8410.02', 'WGEN&GNSSB', '-'],
    ['K132', 'Modernized BeiDou',                         '1414.6606.02', 'GEN'],
    ['K134', 'Upgrade to dual-frequency GNSS',            '1414.6770.02', 'WGEN&GNSSB', 'WGEN*2'],
    ['K135', 'Upgrade to triple-frequency GNSS',          '1414.6793.02', 'K134', 'K134*2'],
    ['K136', 'Add 6 GNSS channels',                       '1414.6812.02', 'WGEN&GNSSB', '+4'],
    ['K137', 'Add 12 GNSS channels',                      '1414.6835.02', 'WGEN&GNSSB', '+4'],
    ['K138', 'Add 24 GNSS channels',                      '1414.6858.02', 'WGEN&GNSSB', '+4'],
    ['K139', 'Add 48 GNSS channels',                      '1414.6935.02', 'WGEN&GNSSB', '+4'],
    ['K360', 'ERA-GLONASS test suite',                    '1414.2800.02', 'K44&K94', '-'],
    ['K361', 'eCall test suite',                          '1414.2846.02', 'K44&K66&K106', '-'],
    ['K362', 'GNSS test suite',                           '1414.6406.02',
             'K44|K66|K94|K97|K98|K107|K132', '-']
  ]),
  ...expand(11, 'std-int', 'Broadcast standards', [
    ['K52',  'DVB-H/DVB-T',                               '1413.6090.02', 'GEN'],
    ['K116', 'DVB-S2/S2X',                                '1414.2630.02', 'GEN'],
    ['K169', 'DVB-RCS2',                                  '1413.8711.02', 'GEN'],
    ['K176', 'DVB-S2/DVB-S2X Annex E',                    '1413.8686.02', 'K116']
  ]),
  ...expand(11, 'std-int', 'Other standards and modulation systems', [
    ['K61',  'Multicarrier CW signal generation',         '1413.4280.02', 'GEN'],
    ['K89',  'NFC A/B/F',                                 '1413.6619.02', 'GEN'],
    ['K114', 'OFDM signal generation',                    '1414.1985.02', 'GEN'],
    ['K542', 'Baseband power sweep',                      '1413.9876.02', 'GEN']
  ]),

  /* -- Step 12: R&S WinIQSIM2 digital modulation systems ------------ */
  ...expand(12, 'std-wiq', 'Cellular standards', [
    ['K240', 'GSM/EDGE',                                  '1413.4739.02', 'GEN'],
    ['K241', 'EDGE Evolution',                            '1413.4780.02', 'K240'],
    ['K242', '3GPP FDD',                                  '1413.4839.02', 'GEN'],
    ['K246', 'CDMA2000®',                                 '1413.4939.02', 'GEN'],
    ['K247', '1xEV-DO',                                   '1413.4980.02', 'GEN'],
    ['K250', 'TD-SCDMA',                                  '1413.5087.02', 'GEN'],
    ['K251', 'TD-SCDMA enhanced BS/MS tests',             '1413.5135.02', 'K250'],
    ['K255', 'LTE Release 8',                             '1413.5235.02', 'GEN'],
    ['K268', 'TETRA Release 2',                           '1413.5387.02', 'GEN'],
    ['K283', '3GPP FDD HSPA/HSPA+, enhanced BS/MS tests', '1413.6290.02', 'K242'],
    ['K284', 'LTE Release 9',                             '1413.5535.02', 'K255'],
    ['K285', 'LTE Release 10 (LTE-Advanced)',             '1413.5587.02', 'K255'],
    ['K287', '1xEV-DO Rev. B',                            '1413.6560.02', 'K247'],
    ['K412', 'LTE Release 11 and enhanced features',      '1413.8557.02', 'K255'],
    ['K413', 'LTE Release 12',                            '1414.2030.02', 'K255'],
    ['K415', 'Cellular IoT',                              '1414.2769.02', 'GEN'],
    ['K418', 'Verizon 5GTF signals',                      '1414.3507.02', 'GEN'],
    ['K419', 'LTE Release 13/14/15',                      '1414.3588.02', 'K255'],
    ['K430', 'OneWeb user-defined signal generation',     '1414.3820.02', 'GEN'],
    ['K443', 'Cellular IoT Release 14',                   '1414.6093.02', 'K415'],
    ['K444', '5G New Radio',                              '1414.5022.02', 'GEN'],
    ['K446', 'Cellular IoT Release 15',                   '1414.6587.02', 'K415'],
    ['K448', '5G New Radio Release 16',                   '1414.6687.02', 'K444'],
    ['K470', '5G NR sidelink',                            '1413.8663.02', 'GEN'],
    ['K471', '5G NR Release 17',                          '1413.7296.02', 'K448']
  ]),
  ...expand(12, 'std-wiq', 'Wireless connectivity standards', [
    ['K254', 'IEEE 802.11 (a/b/g/n/j/p)',                 '1413.5187.02', 'GEN'],
    ['K260', 'Bluetooth® EDR',                            '1413.5287.02', 'GEN'],
    ['K286', 'IEEE 802.11ac',                             '1413.5687.02', 'K254'],
    ['K417', 'Bluetooth® 5.x',                            '1414.3371.02', 'K260'],
    ['K431', 'LoRa®',                                     '1414.6441.02', 'GEN'],
    ['K441', 'IEEE 802.11ad',                             '1414.1385.02', 'WGEN&K525&K527', 'K527*2',
             'Runs on R&S®SMW-B9; requires R&S®SMW-K525 and -K527.'],
    ['K442', 'IEEE 802.11ax',                             '1414.3294.02', 'K254'],
    ['K447', 'IEEE 802.11be',                             '1413.6683.02', 'K254'],
    ['K449', 'HRP UWB',                                   '1414.6958.02', 'WGEN'],
    ['K477', 'IEEE 802.11ay',                             '1434.8210.02', 'K441'],
    ['K478', 'Bluetooth® 5.4 and channel sounding',       '1434.8291.02', 'K417']
  ]),
  ...expand(12, 'std-wiq', 'Navigation standards', [
    ['K244', 'GPS, 1 satellite',                          '1413.4880.02', 'GEN'],
    ['K266', 'Galileo, 1 satellite',                      '1413.7015.02', 'GEN'],
    ['K294', 'GLONASS, 1 satellite',                      '1413.7067.02', 'GEN'],
    ['K297', 'IRNSS',                                     '1414.6287.02', 'GEN'],
    ['K298', 'Modernized GPS, 1 satellite',               '1414.3171.02', 'GEN'],
    ['K407', 'BeiDou, 1 satellite',                       '1413.7115.02', 'GEN'],
    ['K423', 'Modernized GLONASS',                        '1413.3410.02', 'GEN'],
    ['K432', 'Modernized BeiDou, 1 SV',                   '1414.6629.02', 'GEN']
  ]),
  ...expand(12, 'std-wiq', 'Broadcast standards', [
    ['K252', 'DVB-H/DVB-T',                               '1413.6190.02', 'GEN'],
    ['K253', 'DAB/T-DMB',                                 '1413.6248.02', 'GEN'],
    ['K416', 'DVB-S2/S2X',                                '1414.2681.02', 'GEN'],
    ['K469', 'DVB-RCS2',                                  '1413.9130.02', 'GEN'],
    ['K476', 'DVB-S2/DVB-S2X Annex E',                    '1413.9076.02', 'K416']
  ]),
  ...expand(12, 'std-wiq', 'Other standards and modulation systems', [
    ['K261', 'Multicarrier CW signal generation',         '1413.5335.02', 'GEN'],
    ['K262', 'Additive white Gaussian noise (AWGN)',      '1413.6460.02', 'GEN'],
    ['K289', 'NFC A/B/F',                                 '1413.6654.02', 'GEN'],
    ['K414', 'OFDM signal generation',                    '3636.0434.02', 'GEN']
  ]),
  ...expand(12, 'std-wiq', 'Waveform packages for signals from R&S®WinIQSIM2', [
    ['K200-1',  '1 waveform',   '1414.6870.71', 'GEN', '+20', 'Max. 250 registered waveforms per instrument.'],
    ['K200-5',  '5 waveforms',  '1414.6870.72', 'GEN', '+20', 'Max. 250 registered waveforms per instrument.'],
    ['K200-50', '50 waveforms', '1414.6870.75', 'GEN', '+5',  'Max. 250 registered waveforms per instrument.']
  ]),

  /* -- Step 13: R&S Pulse Sequencer software ------------------------ */
  ...expand(13, 'pulse', 'Options with R&S®Pulse Sequencer software', [
    ['K300', 'Pulse sequencing',                    '1413.8805.02', 'GEN'],
    ['K301', 'Enhanced pulse sequencing',           '1413.9776.02', 'K300'],
    ['K302', 'Radar platforms',                     '1413.8857.02', 'K301'],
    ['K304', 'Moving emitters and receiver',        '1413.8957.02', 'WGEN&K502&K301',
             'WGEN*2&K502*2&K301*2'],
    ['K306', 'Multiple emitters (interleaved)',     '1413.9053.02', 'WGEN&K502&K301',
             'WGEN*2&K502*2&K301*2'],
    ['K307', 'Multiple emitters extension (interleaved)', '1413.3510.02', 'K306'],
    ['K308', 'Direction finding',                   '1414.1433.02', 'K301'],
    ['K309', 'Import of 2D maps',                   'not listed',   'K301'],
    ['K315', 'Pulse-on-pulse simulation',           '1414.6529.02',
             'B9*2&K502*2&B15*2&(K503*2|K301*2)', '-'],
    ['K350', 'DFS signal generation',               '1413.9160.02', 'GEN']
  ])
];

/**
 * Expands the compact standards tables above into full option records.
 * Row: [id, name, order, requires, maxSpec?, note?]
 *   maxSpec  undefined -> quantity 2 allowed when "<requires>*2" holds
 *            '-'       -> single unit only
 *            '+N'      -> up to N units, no extra condition
 *            other     -> expression that must hold for quantity 2
 */
function expand (step, section, group, rows) {
  return rows.map(([id, name, order, requires, maxSpec, note]) => {
    let max = 1, maxReq = null;
    if (maxSpec === undefined) {
      if (/^[A-Z][A-Z0-9-]*$/.test(requires)) { max = 2; maxReq = requires + '*2'; }
    } else if (maxSpec === '-') {
      max = 1;
    } else if (/^\+\d+$/.test(maxSpec)) {
      max = parseInt(maxSpec.slice(1), 10);
    } else {
      max = 2; maxReq = maxSpec;
    }
    return {
      id, name, order, step, section, group, requires, max, maxReq,
      reqText: humanReq(requires), retrofit: 'keycode',
      note: note || (max > 1 ? 'Can be installed twice if the required hardware is present twice.' : undefined)
    };
  });
}

/** Turns a requirement expression into the wording used in the guide. */
function humanReq (expr) {
  return expr
    .replace(/WGEN/g, 'R&S®SMW-B9')
    .replace(/GEN/g, 'R&S®SMW-B9/-B10')
    .replace(/GNSSB|GNSS/g, 'a GNSS standard')
    .replace(/\bBB2\b/g, 'R&S®SMW-B13T/-B13XT')
    .replace(/\bBB\b/g, 'R&S®SMW-B13/-B13T/-B13XT')
    .replace(/\b(B\d[\dA-Z]*|K\d+(?:-\d+)?)\b/g, 'R&S®SMW-$1')
    .replace(/\*2/g, ' (×2)')
    .replace(/&/g, ' and ')
    .replace(/\|/g, ' or ');
}

/** Accessories and services from the ordering information. Advisory only. */
export const EXTRAS = [
  { group: 'Recommended extras', items: [
    { id: 'ZZA-KN4',  name: '19" rack adapter', order: '1175.3033.00' },
    { id: 'SMU-Z6',   name: 'Cable for R&S® digital baseband interfaces, 2 m', order: '1415.0201.02',
      hintIf: 'K18|K19' },
    { id: 'BBCABLE',  name: 'Cable for R&S® digital baseband interfaces, 0.5 m', order: '1208.3213.00',
      hintIf: 'K18|K19' },
    { id: 'DIGIQ-HS', name: 'Cable for HS digital I/Q interface (optical, QSFP+)', order: '3641.2948.03',
      hintIf: 'K19' },
    { id: 'TS-USB1',  name: 'USB serial adapter for RS-232 remote control', order: '6124.2531.00' }
  ]},
  { group: 'Power combiner kits and cables (R&S®SMW-K555)', items: [
    { id: 'SMW-ZKK',  name: 'Combiner kit, 40 GHz', order: '1434.7908.02', hintIf: 'K555' },
    { id: 'SMW-ZKV',  name: 'Combiner kit, 67 GHz', order: '1434.7989.02', hintIf: 'K555' },
    { id: 'ZV-Z195',  name: 'Cable, 2.92 mm (m) to 2.92 mm (m)', order: '1306.4536.36', hintIf: 'K555' },
    { id: 'ZV-Z196',  name: 'Cable, 1.85 mm (m) to 1.85 mm (m)', order: '1306.4559.25', hintIf: 'K555' }
  ]},
  { group: 'Test port adapters', items: [
    { id: 'ADP-292F', name: 'Test port adapter, 2.92 mm female', order: '1036.4790.00',
      hintIf: 'B1012|B2012|B1020|B2020|B1031|B2031|B1040|B1040N' },
    { id: 'ADP-292M', name: 'Test port adapter, 2.92 mm male', order: '1036.4802.00',
      hintIf: 'B1012|B2012|B1020|B2020|B1031|B2031|B1040|B1040N' },
    { id: 'ADP-NF',   name: 'Test port adapter, N female', order: '1036.4777.00',
      hintIf: 'B1012|B2012|B1020|B2020|B1031|B2031|B1040|B1040N' },
    { id: 'ADP-NM',   name: 'Test port adapter, N male', order: '1036.4783.00',
      hintIf: 'B1012|B2012|B1020|B2020|B1031|B2031|B1040|B1040N' },
    { id: 'ADP-185FF', name: 'Coaxial adapter 1.85 mm (f) – 1.85 mm (f)', order: '3588.9654.00',
      hintIf: 'B1044|B2044|B1044N|B2044N|B1044O|B2044O|B1056|B1056N|B1056O|B1067|B1067N|B1067O' },
    { id: 'ADP-185292', name: 'Coaxial adapter 1.85 mm (f) – 2.92 mm (f)', order: '3628.4728.02',
      hintIf: 'B1044|B2044|B1044N|B2044N|B1044O|B2044O' }
  ]},
  { group: 'Documentation and calibration', items: [
    { id: 'DCV-2', name: 'Documentation of calibration values', order: '0240.2193.18' },
    { id: 'ACA-6',  name: 'Accredited calibration, up to 6 GHz', order: '3596.7005.03' },
    { id: 'ACA-75', name: 'Accredited calibration, 7.5 GHz', order: '3598.3507.03' },
    { id: 'ACA-44', name: 'Accredited calibration, 12.75 GHz to 44 GHz', order: '3596.7011.03' },
    { id: 'ACA-67', name: 'Accredited calibration, 56 GHz and 67 GHz', order: '3598.9540.03' }
  ]}
];


/* Options that appear in the specifications document (version 31.00) but not
   yet in configuration guide version 06.00. Marked so their origin is clear. */
OPTIONS.push(...expand(4, 'rf-enh', 'Other RF options', [
  ['K554', 'External multiplier control', '1413.7309.02', 'RFA', 'RFB']
]).map(o => ({ ...o, since: 'specs' })));

OPTIONS.push(...expand(9, 'bb-hw', 'Wideband baseband', [
  ['K508', 'ARB Ethernet streaming',                        '1434.8256.02', 'WGEN', 'WGEN*2'],
  ['K573', 'Ethernet streaming with dynamic offset control','1434.9146.02', 'K508', 'K508*2'],
  ['K556', 'Customized digital input',                      '1434.8310.02', 'WGEN', 'WGEN*2']
]).map(o => ({ ...o, since: 'specs' })));

OPTIONS.push(...expand(10, 'bb-enh', 'Baseband enhancements', [
  ['K575', 'RF linearization (Linearize RF)', '1434.8379.02', 'GEN', 'GEN*2']
]).map(o => ({ ...o, since: 'specs' })));

export const BY_ID = Object.fromEntries(OPTIONS.map(o => [o.id, o]));

/* ------------------------------------------------------------------ *
 * Panel connectors
 *
 * Transcribed from the "Connectors" section of the specifications: the
 * front panel table, the rear panel table, and the two tables covering
 * connectors carried by the baseband generator and fading simulator
 * modules themselves.
 *
 * `when` names the derived condition that makes a connector present or
 * active; entries without one are fitted to every instrument. Positions
 * in the drawing are schematic - the specifications give the inventory
 * and the connector types, not a panel layout.
 * ------------------------------------------------------------------ */

/** Connectors on the front panel. */
export const FRONT_PANEL = [
  { group: 'RF output', items: [
    { label: 'RF 50 Ω', sub: 'path A', kind: 'rf', when: 'rfA', path: 'A' },
    { label: 'RF 50 Ω', sub: 'path B', kind: 'rf', when: 'rfB', path: 'B' }
  ] },
  { group: 'Analog I/Q modulation inputs', items: [
    { label: 'I', sub: 'path A', kind: 'bnc', type: 'BNC female', when: 'iqA' },
    { label: 'Q', sub: 'path A', kind: 'bnc', type: 'BNC female', when: 'iqA' },
    { label: 'I', sub: 'path B', kind: 'bnc', type: 'BNC female', when: 'iqB' },
    { label: 'Q', sub: 'path B', kind: 'bnc', type: 'BNC female', when: 'iqB' }
  ] },
  { group: 'User and utility', items: [
    { label: 'USB', kind: 'usb', type: 'USB type A' },
    { label: 'SENSOR', kind: 'odu', type: '6-pin ODU MINI-SNAP series B' },
    { label: 'USER 1', kind: 'bnc', type: 'BNC female' },
    { label: 'USER 2', kind: 'bnc', type: 'BNC female' },
    { label: 'USER 3', kind: 'bnc', type: 'BNC female' }
  ] }
];

/** Connectors on the rear panel, excluding those carried by the modules. */
export const REAR_PANEL = [
  { group: 'RF output, relocated', items: [
    { label: 'RF 50 Ω', sub: 'path A', kind: 'rf', when: 'rearRfA', path: 'A' },
    { label: 'RF 50 Ω', sub: 'path B', kind: 'rf', when: 'rearRfB', path: 'B' },
    { label: 'I', sub: 'path A', kind: 'bnc', type: 'BNC female', when: 'rearIq' },
    { label: 'Q', sub: 'path A', kind: 'bnc', type: 'BNC female', when: 'rearIq' }
  ] },
  { group: 'Reference and local oscillator', items: [
    { label: 'REF IN', kind: 'bnc', type: 'BNC female' },
    { label: 'REF OUT', kind: 'bnc', type: 'BNC female' },
    { label: 'EFC', kind: 'bnc', type: 'BNC female' },
    { label: 'LO IN', kind: 'sma', type: 'SMA female' },
    { label: 'LO OUT', kind: 'sma', type: 'SMA female' }
  ] },
  { group: 'Trigger, user and analog inputs', items: [
    { label: 'INST TRG A', kind: 'bnc', type: 'BNC female' },
    { label: 'INST TRG B', kind: 'bnc', type: 'BNC female', when: 'rfB' },
    { label: 'USER 4', kind: 'bnc', type: 'BNC female' },
    { label: 'USER 5', kind: 'bnc', type: 'BNC female' },
    { label: 'USER 6', kind: 'bnc', type: 'BNC female' },
    { label: 'EXT 1', kind: 'bnc', type: 'BNC female' },
    { label: 'EXT 2', kind: 'bnc', type: 'BNC female' }
  ] },
  { group: 'Analog I/Q outputs', items: [
    { label: 'I/LF OUT 1', kind: 'bnc', type: 'BNC female', when: 'analogIqOut' },
    // the specifications set the inverting outputs with an overline; spelled out
    // here because the combining character does not survive at label size
    { label: 'I-BAR 1', kind: 'bnc', type: 'BNC female', when: 'analogIqOut' },
    { label: 'Q/LF OUT 2', kind: 'bnc', type: 'BNC female', when: 'analogIqOut' },
    { label: 'Q-BAR 1', kind: 'bnc', type: 'BNC female', when: 'analogIqOut' },
    { label: '2nd SET', sub: 'I, I-bar, Q, Q-bar', kind: 'bnc', type: 'BNC female',
      count: 4, when: 'analogIqOut2' }
  ] },
  { group: 'Digital I/Q', items: [
    { label: 'DIG I/Q OUT 1', kind: 'mdr', type: '26-pin MDR', when: 'digitalOut' },
    { label: 'DIG I/Q OUT 2', kind: 'mdr', type: '26-pin MDR', when: 'digitalOut' },
    { label: 'HS DIG I/Q OUT 1', kind: 'qsfp', type: 'QSFP+/QSFP 28', when: 'hsDigital' },
    { label: 'HS DIG I/Q OUT 2', kind: 'qsfp', type: 'QSFP+/QSFP 28', when: 'hsDigital' }
  ] },
  { group: 'Remote control and service', items: [
    { label: 'LAN', kind: 'rj45', type: 'RJ-45' },
    { label: 'USB DEVICE', kind: 'usb', type: 'USB type B' },
    { label: 'USB', kind: 'usb', type: 'USB type A' },
    { label: 'IEEE 488', kind: 'gpib', type: '24-pin Amphenol series 57 female' },
    { label: 'DISPLAY PORT', kind: 'video', type: 'for future use' },
    { label: 'HDMI', kind: 'video', type: 'for future use' }
  ] }
];

/**
 * Connector sets carried by the plug-in modules. One block appears on the
 * rear panel for each installed module, so the rear panel grows with the
 * baseband and fading hardware.
 */
export const MODULE_PANELS = {
  standard: {
    label: 'Standard baseband generator / fading simulator',
    items: [
      { label: 'T/M/C 1', kind: 'bnc', type: 'BNC female' },
      { label: 'T/M 2', kind: 'bnc', type: 'BNC female' },
      { label: 'T/M 3', kind: 'bnc', type: 'BNC female' },
      { label: 'T/M/C 4', kind: 'bnc', type: 'BNC female' },
      { label: 'T/M 5', kind: 'bnc', type: 'BNC female' },
      { label: 'T/M 6', kind: 'bnc', type: 'BNC female' },
      { label: 'DIG IQ IN/OUT 1', kind: 'mdr', type: '26-pin MDR' },
      { label: 'DIG IQ IN/OUT 2', kind: 'mdr', type: '26-pin MDR' }
    ]
  },
  wideband: {
    label: 'Wideband baseband generator',
    items: [
      { label: 'T/M/C 1', kind: 'bnc', type: 'BNC female, for future use' },
      { label: 'T/M 2', kind: 'bnc', type: 'BNC female, for future use' },
      { label: 'T/M/C 3', kind: 'bnc', type: 'BNC female, for future use' },
      { label: 'T/M 4', kind: 'bnc', type: 'BNC female, for future use' },
      { label: 'DIG IQ IN/OUT 1', kind: 'mdr', type: '26-pin MDR, for future use' },
      { label: 'DIG IQ IN/OUT 2', kind: 'mdr', type: '26-pin MDR, for future use' },
      { label: 'HS DIG IQ IN/OUT 1', kind: 'qsfp', type: 'QSFP+/QSFP 28' },
      { label: 'HS DIG IQ IN/OUT 2', kind: 'qsfp', type: 'QSFP+/QSFP 28' }
    ]
  }
};
