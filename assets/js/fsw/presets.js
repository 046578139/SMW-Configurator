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
    desc: 'The smallest orderable R&S®FSW: the 8 GHz model with its standard 28 MHz analysis bandwidth and no options.',
    tags: ['8 GHz', '28 MHz BW'],
    sel: { FSW8: 1 }
  },
  {
    id: 'nr-fr1',
    name: '5G NR FR1 base station',
    icon: 'radio',
    desc: '13.6 GHz model with 160 MHz analysis bandwidth for every FR1 channel bandwidth, preamplifier, electronic attenuator, OCXO, and 5G NR downlink, uplink, Release 16 and combined ACLR/SEM/EVM.',
    tags: ['13.6 GHz', '160 MHz BW', '5G NR'],
    sel: { FSW13: 1, B160: 1, 'B24-13': 1, B25: 1, B4: 1, K144: 1, K145: 1, K148: 1, K147: 1 }
  },
  {
    id: 'nr-fr2',
    name: '5G NR FR2 mmWave',
    icon: 'wave',
    desc: '43.5 GHz model with 2 GHz analysis bandwidth, preamplifier, 5G NR up to Release 17, external frontend control with an R&S®FE44S, and frequency response correction.',
    tags: ['43.5 GHz', '2 GHz BW', 'FR2'],
    sel: { FSW43: 1, B2001: 1, 'B24-43': 1, K144: 1, K145: 1, K148: 1, K171: 1, K553: 1, K544: 1, FE44S: 1 }
  },
  {
    id: 'wifi7',
    name: 'Wi-Fi 7 (802.11be)',
    icon: 'wifi',
    desc: '13.6 GHz model with 512 MHz analysis bandwidth for 320 MHz channels, preamplifier, the WLAN chain from 802.11a to 802.11be, and I/Q noise cancellation for the tightest EVM.',
    tags: ['13.6 GHz', '512 MHz BW', '802.11be'],
    sel: { FSW13: 1, B512: 1, 'B24-13': 1, K91: 1, K91N: 1, K91AC: 1, K91AX: 1, K91BE: 1, K575: 1 }
  },
  {
    id: 'radar',
    name: 'Radar and EW pulse analysis',
    icon: 'pulse',
    desc: '43.5 GHz model with 2 GHz analysis bandwidth, 800 MHz real-time, 8 GB I/Q memory, OCXO, pulse and time sidelobe, transient hop and chirp, and vector signal analysis.',
    tags: ['43.5 GHz', '2 GHz BW', 'real-time'],
    sel: { FSW43: 1, B2001: 1, K800RE: 1, B108: 1, B4: 1, K6: 1, K6S: 1, K60: 1, K60H: 1, K60C: 1, K70: 1 }
  },
  {
    id: 'amplifier',
    name: 'Amplifier characterisation and DPD',
    icon: 'sliders',
    desc: '26.5 GHz model with 1.2 GHz analysis bandwidth, preamplifier, external generator control, and the amplifier chain: K18 with direct and memory polynomial DPD, frequency response and noise power ratio.',
    tags: ['26.5 GHz', '1.2 GHz BW', 'DPD'],
    sel: { FSW26: 1, B1200: 1, 'B24-26': 1, B10: 1, K18: 1, K18D: 1, K18F: 1, K18M: 1, K19: 1, 'PCK-1M': 1 }
  },
  {
    id: 'emi',
    name: 'EMI precompliance',
    icon: 'shield',
    desc: '8 GHz model with preamplifier, electronic attenuator and OCXO, EMI measurements with CISPR calibration, external generator control and a rack adapter.',
    tags: ['8 GHz', 'CISPR', 'EMI'],
    sel: { FSW8: 1, 'B24-13': 1, B25: 1, B4: 1, K54: 1, K54CAL: 1, B10: 1, 'ZZA-KN5': 1 }
  },
  {
    id: 'noise',
    name: 'Phase noise and noise figure',
    icon: 'noise',
    desc: '26.5 GHz model with preamplifier and OCXO, phase noise and noise figure measurements with a 26.5 GHz smart noise source, and analog modulation analysis.',
    tags: ['26.5 GHz', 'phase noise', 'noise figure'],
    sel: { FSW26: 1, 'B24-26': 1, B4: 1, K40: 1, K30: 1, 'FS-SNS26': 1, K7: 1 }
  },
  {
    id: 'mmwave',
    name: 'mmWave to 90 GHz with real-time',
    icon: 'sat',
    desc: '85 GHz model extended to 90 GHz, 800 MHz real-time analyzer with 2 GHz analysis bandwidth, external mixer connections with a 110 GHz harmonic mixer, 802.11ay, vector signal analysis and frequency response correction.',
    tags: ['90 GHz', 'real-time', '802.11ay'],
    sel: { FSW85: 1, B90G: 1, B800R: 1, 'B21-86': 1, 'FS-Z110': 1, K97: 1, K70: 1, K544: 1 }
  }
];
