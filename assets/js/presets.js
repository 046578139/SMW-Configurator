/**
 * Starting points for common measurement tasks. Each one is a legal
 * configuration on its own; the configurator validates them like any other
 * selection, so they can be adjusted freely afterwards.
 */

export const PRESETS = [
  {
    id: 'minimum',
    name: 'Minimum instrument',
    icon: 'chip',
    desc: 'The smallest orderable R&S®SMW200A: 3 GHz path A, standard baseband main module and one baseband generator.',
    tags: ['3 GHz', '120 MHz BW'],
    sel: { B1003: 1, B13: 1, B10: 1 }
  },
  {
    id: 'nr-fr1',
    name: '5G NR sub-6 GHz device test',
    icon: 'radio',
    desc: 'FR1 signal generation with 5G NR up to Release 16, AWGN and LTE for fallback testing.',
    tags: ['6 GHz', '160 MHz BW', '5G NR'],
    sel: { B1006: 1, B13T: 1, B10: 1, K522: 1, K62: 1, K144: 1, K148: 1, K55: 1, K119: 1 }
  },
  {
    id: 'nr-fr2',
    name: '5G NR FR2 mmWave',
    icon: 'wave',
    desc: 'Wideband baseband with 1 GHz modulation bandwidth at 44 GHz, plus external frontend control for over-the-air setups.',
    tags: ['44 GHz', '1 GHz BW', 'mmWave'],
    sel: { B1044: 1, B13XT: 1, B9: 1, K525: 1, K62: 1, K144: 1, K148: 1, K553: 1, K544: 1 }
  },
  {
    id: 'mimo',
    name: '2×2 MIMO fading',
    icon: 'mimo',
    desc: 'Two baseband generators, four fading simulators and MIMO routing for receiver performance tests under fading.',
    tags: ['6 GHz', 'MIMO', 'fading'],
    sel: {
      B1006: 1, B13T: 1, B2006: 1, B10: 2, K522: 2, B14: 4,
      K71: 2, K72: 2, K74: 1, K62: 2, K55: 2, K144: 2, B90: 1
    }
  },
  {
    id: 'gnss',
    name: 'GNSS simulation',
    icon: 'sat',
    desc: 'High-dynamics GNSS generator with the four global constellations, extra channels and real-world scenarios.',
    tags: ['3 GHz', 'GNSS', 'B9F'],
    sel: {
      B1003: 1, B13XT: 1, B9F: 1, K44: 1, K66: 1, K94: 1, K107: 1,
      K98: 1, K123: 1, K132: 1, K134: 1, K136: 1, K108: 1, K109: 1
    }
  },
  {
    id: 'radar',
    name: 'Radar and EW pulse generation',
    icon: 'pulse',
    desc: 'Wideband ARB with real-time control interface, pulse modulator and the R&S®Pulse Sequencer option chain.',
    tags: ['44 GHz', 'PDW', 'radar'],
    sel: {
      B1044: 1, B13XT: 1, B9: 1, K525: 1, K502: 1, K503: 1, K506: 1,
      K22: 1, K23: 1, K300: 1, K301: 1, K302: 1, B711: 1
    }
  },
  {
    id: 'wlan',
    name: 'Wi-Fi 6E / Wi-Fi 7',
    icon: 'wifi',
    desc: 'IEEE 802.11ax and 802.11be generation up to 7.5 GHz with wideband baseband and crest factor reduction.',
    tags: ['7.5 GHz', '802.11be'],
    sel: { B1007: 1, B13XT: 1, B9: 1, K525: 1, K54: 1, K142: 1, K147: 1, K548: 1, K62: 1 }
  },
  {
    id: 'satcom',
    name: 'Satellite / DVB-S2X',
    icon: 'sat',
    desc: 'Ka-band capable single path with DVB-S2/S2X including Annex E and DVB-RCS2 return link.',
    tags: ['31.8 GHz', 'DVB-S2X'],
    sel: { B1031: 1, B13XT: 1, B9: 1, K525: 1, K116: 1, K176: 1, K169: 1, K62: 1, K544: 1 }
  }
];
