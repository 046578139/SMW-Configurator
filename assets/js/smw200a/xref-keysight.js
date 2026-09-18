/**
 * Keysight E8267D PSG -> R&S SMW200A cross-reference.
 *
 * A competitor's quotation names its instrument by model and its options by
 * short codes (E8267D-544, N7617EMBC). This module knows those codes and,
 * for each, says which R&S SMW200A options give the same capability, which
 * capabilities the SMW200A carries as standard, and which it does not offer.
 * Every row cites the page of the Keysight document it was read from and,
 * where a figure decides the row, the page of the R&S specifications.
 *
 * The dependency runs one way only: nothing in the configurator's own
 * catalog, rules or derivations refers to this file, and the SMW ids named
 * here are looked up in the catalog by the resolver (xref.js), never the
 * other way round. The table is data; a test checks that every id it names
 * exists and that every configuration it can produce validates.
 *
 * Sources (Keysight literature is not in the repository; see docs/xref):
 *   CG  E8267D PSG Vector Signal Generator, Configuration Guide, 5989-1326EN,
 *       July 23, 2025 (12 pages)
 *   DS  E8267D PSG Vector Signal Generator, Data Sheet, 5989-0697EN,
 *       July 21, 2023 (36 pages)
 *   SP  R&S SMW200A Specifications, version 31.00, May 2026
 *
 * Statuses:
 *   covered   an SMW option (or several) gives the capability - `ids`
 *   standard  the SMW200A has it without an option
 *   partial   covered in part; `gap` says what is missing
 *   none      the SMW200A does not offer it
 *   service   a calibration or start-up service, not a product option
 *
 * `ids` may be a list, or `{ standard: [...], wideband: [...] }` when the
 * choice depends on which baseband section the equivalent ends up with.
 * `needs` names a platform a row forces: 'bb2' (a two-path main module) or
 * 'wideband' (the wideband main module and generator). `byFreq` gives the
 * ids per frequency option where only some have an answer, and `needsFreq`
 * lists the frequency options an answer works with at all (`freqGap` says
 * why when the document's does not).
 */

export const KEYSIGHT_VENDOR = 'Keysight';

export const E8267D = {
  model: 'E8267D',
  family: 'PSG vector signal generator',
  guide: 'E8267D configuration guide 5989-1326EN (July 2025)',
  datasheet: 'E8267D data sheet 5989-0697EN (July 2023)',
  /* One RF path, high output power and a step attenuator are standard on the
     PSG (CG p2); the SMW200A base unit always carries one frequency option
     and one baseband main module (SP p84, footnote 25). */
  base: 'The SMW200A base unit (1412.0000.02) stands in for the E8267D chassis; every SMW200A also needs a frequency option and a baseband main module (SP p84).',
  options: {
    /* ---- Step 1: frequency range (CG p2) ---------------------------- */
    513: { step: 'Frequency range', name: 'Frequency range 250 kHz to 13 GHz', page: 'CG p2', status: 'partial', ids: ['B1012'],
      gap: 'R&S SMW-B1012 stops at 12.75 GHz, 250 MHz short of 13 GHz; take R&S SMW-B1020 to cover the whole range. Both underrange to 100 kHz (SP p84).',
      note: 'The PSG ships an APC-3.5 mm male connector; B1012 has a PC 2.92 mm female (SP p84).' },
    520: { step: 'Frequency range', name: 'Frequency range 250 kHz to 20 GHz', page: 'CG p2', status: 'covered', ids: ['B1020'],
      note: '100 kHz to 20 GHz (SP p84). The PSG ships an APC-3.5 mm male connector; B1020 has a PC 2.92 mm female.' },
    532: { step: 'Frequency range', name: 'Frequency range 250 kHz to 31.8 GHz', page: 'CG p2', status: 'covered', ids: ['B1031'],
      note: '100 kHz to 31.8 GHz (SP p84). The PSG ships a 2.4 mm male connector; B1031 has a PC 2.92 mm female.' },
    544: { step: 'Frequency range', name: 'Frequency range 250 kHz to 44 GHz', page: 'CG p2', status: 'covered', ids: ['B1044'],
      note: '100 kHz to 44 GHz (SP p84). The PSG ships a 2.4 mm male connector; B1044 has a PC 1.85 mm male - the 1.85 mm to 2.92 mm adapter is in the accessories.' },

    /* ---- Step 2: spectral purity (CG p2; DS p9-13; SP p19-23) -------- */
    UNX: { step: 'Spectral purity', name: 'Ultra-low phase noise', page: 'CG p2', status: 'covered', ids: ['B710'],
      note: 'Option UNX at 3.2 to 10 GHz: -65 / -81 / -101 / -110 / -110 dBc/Hz at 10 Hz / 100 Hz / 1 kHz / 10 kHz / 100 kHz (DS p11). R&S SMW-B710 at 10 GHz: -77 / -91 / -111 / -117 / -119 dBc/Hz (SP p22) - better at every offset. R&S SMW-B709 (SP p21) beats UNX from 100 Hz up but is 2 dB short at 10 Hz.' },
    UNY: { step: 'Spectral purity', name: 'Enhanced ultra-low phase noise', page: 'CG p2', status: 'covered', ids: ['B711'],
      note: 'Option UNY at 3.2 to 10 GHz: -72 / -85 / -101 / -120 / -120 dBc/Hz at 10 Hz / 100 Hz / 1 kHz / 10 kHz / 100 kHz (DS p12). R&S SMW-B711 at 10 GHz: -77 / -91 / -115 / -124 / -126 dBc/Hz (SP p23) - better at every offset.' },
    '1EH': { step: 'Spectral purity', name: 'Improved harmonics below 2 GHz', page: 'CG p2', status: 'none',
      note: 'Option 1EH brings harmonics from 60 MHz to 2 GHz down to -55 dBc (DS p9). The SMW200A specifies < -30 dBc up to 3.5 GHz and < -55 dBc above it for every unit (SP p19); no low-band filter option is offered.' },

    /* ---- Step 3: modulation (CG p3; DS p16-20; SP p29-34) ------------ */
    UNT: { step: 'Modulation', name: 'AM, FM, phase modulation and LF output', page: 'CG p3', status: 'covered', ids: ['K720', 'K24'], needs: 'bb2',
      note: 'R&S SMW-K720 is AM/FM/PM; frequency and phase modulation need a two-path main module (SP p30-31), so the equivalent takes R&S SMW-B13T. R&S SMW-K24 is the multifunction generator whose LF generators feed the modulators and the LF output (SP p34, p81).' },
    UNU: { step: 'Modulation', name: 'Pulse modulation (150 ns minimum pulse width)', page: 'CG p3', status: 'covered', ids: ['K22', 'K23'],
      note: 'R&S SMW-K22: on/off ratio > 80 dB, rise/fall < 10 ns, minimum pulse width 20 ns (SP p32) against UNU\'s 150 ns (DS p19). UNU includes an internal pulse generator; R&S SMW-K23 is the SMW200A\'s.' },
    UNW: { step: 'Modulation', name: 'Narrow pulse modulation (20 ns minimum pulse width)', page: 'CG p3', status: 'covered', ids: ['K22', 'K23'],
      note: 'R&S SMW-K22: minimum pulse width 20 ns, rise/fall < 10 ns (< 15 ns above 20 GHz options), on/off > 80 dB, PRF to 10 MHz (SP p32); UNW: 20 ns, 10 ns (6 ns typ) above 400 MHz, 80 dB, PRF to 14.28 MHz (DS p19-20). R&S SMW-K23 stands in for the internal pulse generator.' },
    HNS: { step: 'Modulation', name: 'Modified narrow pulse modulation (UNW below 31.8 GHz, UNU above)', page: 'CG p3', status: 'covered', ids: ['K22', 'K23'],
      note: 'A customised UNW for export-regulated markets (CG p3, footnote 4). R&S SMW-K22 keeps 20 ns across the whole range of R&S SMW-B1044 (SP p32).' },

    /* ---- Step 4: ramp sweep (CG p3; DS p5; SP p11, p18) ------------- */
    '007': { step: 'Ramp sweep', name: 'Analog ramp sweep of frequency and amplitude', page: 'CG p3', status: 'partial',
      gap: 'The SMW200A sweeps frequency and level as standard, as a step sweep in discrete steps with 1 ms dwell and list mode (SP p11, p18). It has no analog ramp sweep and no 8757D scalar analyzer interface (DS p5).' },

    /* ---- Step 5: internal baseband generator (CG p3; DS p24; SP p46, p57) */
    602: { step: 'Baseband generator', name: 'Internal baseband generator, 64 MSa memory, 80 MHz RF modulation bandwidth', page: 'CG p3', status: 'covered',
      ids: { standard: ['B10'], wideband: ['B9'] },
      note: 'R&S SMW-B10: ARB with 64 Msample and real-time digital modulation, 120 MHz RF bandwidth (SP p46) against 64 MSa and 80 MHz (DS p24). On the wideband section the generator is R&S SMW-B9 with 256 Msample and 500 MHz (SP p57).' },
    '009': { step: 'Baseband generator', name: 'Removable 8 GB flash memory', page: 'CG p3', status: 'covered', ids: ['B93'],
      note: 'Option 009 moves every user file onto a removable card (DS p30, p33). R&S SMW-B93 is the SMW200A\'s solid-state drive; the spare SSD in the accessories serves the same purpose of keeping user data out of a shared instrument.' },

    /* ---- Step 6: wideband external I/Q (CG p4; DS p22; SP p36, p40) -- */
    '016': { step: 'External I/Q', name: 'Wideband external differential I/Q inputs (up to 2 GHz RF modulation bandwidth above 3.2 GHz)', page: 'CG p4', status: 'covered', ids: ['K739'],
      note: 'The SMW200A\'s analog I/Q inputs feed the I/Q modulator directly with +/-1 GHz above 2.5 GHz and +/-40 % of the carrier below it on every frequency option except B1007/B1012 (+/-500 MHz), no option needed (SP p36, p40). R&S SMW-K739 adds the differential input mode that Option 016 has.' },
    HBQ: { step: 'External I/Q', name: 'Band-limited wideband differential external I/Q inputs (> 300 MHz above 3.2 GHz)', page: 'CG p4', status: 'covered', ids: ['K739'],
      note: 'Covered by the standard analog I/Q inputs, +/-1 GHz above 2.5 GHz (SP p36); R&S SMW-K739 makes them differential.' },
    H18: { step: 'External I/Q', name: 'Wideband modulation below 3.2 GHz (up to 2 GHz)', page: 'CG p4', status: 'standard',
      note: 'Below 2.5 GHz the SMW200A modulation bandwidth is +/-40 % of the carrier frequency (+/-32 % up to 300 MHz), with every unit (SP p36); Option 016 or HBQ is what H18 depends on (CG p4).' },

    /* ---- Step 7: signal creation software (CG p4-6) ------------------ */
    403: { step: 'Signal creation', name: 'Calibrated noise (AWGN) generation', page: 'CG p4', status: 'covered', ids: ['K62'],
      note: 'R&S SMW-K62 additive white Gaussian noise with settable C/N, Eb/No (SP).' },
    409: { step: 'Signal creation', name: 'GPS personality (multi-satellite GPS signals)', page: 'CG p4', status: 'covered', ids: ['K44'],
      note: 'R&S SMW-K44 GPS.' },
    423: { step: 'Signal creation', name: 'Scenario generator for MS-GPS personality (custom GPS scenario files)', page: 'CG p4', status: 'covered', ids: ['K44', 'K108'],
      note: 'R&S SMW-K108 real-world scenarios, on top of a GNSS standard.' },
    SP1: { step: 'Signal creation', name: 'Signal Studio for jitter injection', page: 'CG p4', status: 'none',
      note: 'A connectivity kit for jitter tolerance tests with Keysight BERTs (CG p4). The SMW200A has no counterpart.' },
    N7600EMBC: { step: 'Signal creation', name: 'PathWave Signal Generation for 3GPP W-CDMA/HSPA+', page: 'CG p4', status: 'covered', ids: ['K42', 'K83'],
      note: 'R&S SMW-K42 3GPP FDD with R&S SMW-K83 HSPA/HSPA+ enhanced BS/MS tests.' },
    N7601EMBC: { step: 'Signal creation', name: 'PathWave Signal Generation for cdma2000/1xEV-DO', page: 'CG p4', status: 'covered', ids: ['K46', 'K47'],
      note: 'R&S SMW-K46 CDMA2000 and R&S SMW-K47 1xEV-DO.' },
    N7602EMBC: { step: 'Signal creation', name: 'PathWave Signal Generation for GSM/EDGE/Evo', page: 'CG p4', status: 'covered', ids: ['K40', 'K41'],
      note: 'R&S SMW-K40 GSM/EDGE and R&S SMW-K41 EDGE Evolution.' },
    N7606EMBC: { step: 'Signal creation', name: 'PathWave Signal Generation for Bluetooth (BR+EDR, LE 4.0/4.2/5.x)', page: 'CG p4', status: 'covered', ids: ['K60', 'K117'],
      note: 'R&S SMW-K60 Bluetooth EDR and R&S SMW-K117 Bluetooth 5.x.' },
    N7607EMBC: { step: 'Signal creation', name: 'PathWave Signal Generation for DFS radar profiles', page: 'CG p4', status: 'covered', ids: ['K350'],
      note: 'R&S SMW-K350 DFS signal generation (FCC, ETSI, Japan MIC, ... radar profiles). Keysight pairs it with Option UNW; the pulse modulator is not needed on the SMW200A for DFS bursts from the baseband.' },
    N7608EMBC: { step: 'Signal creation', name: 'PathWave Signal Generation Pro for custom modulation (custom OFDM and I/Q waveforms)', page: 'CG p5', status: 'covered', ids: ['K114'],
      note: 'R&S SMW-K114 OFDM signal generation; custom digital modulation and ARB playback are part of the baseband generator (SP p46).' },
    N7609EMBC: { step: 'Signal creation', name: 'PathWave Signal Generation for GNSS (GPS, GLONASS, Galileo, BeiDou, SBAS, QZSS)', page: 'CG p5', status: 'covered', ids: ['K44', 'K94', 'K66', 'K107', 'K106'],
      note: 'One R&S SMW option per constellation: K44 GPS, K94 GLONASS, K66 Galileo, K107 BeiDou, K106 SBAS/QZSS.' },
    N7610EMBC: { step: 'Signal creation', name: 'PathWave Signal Generation for IoT (802.15.4g Wi-SUN, 802.15.4 ZigBee, Z-Wave)', page: 'CG p5', status: 'partial', ids: ['K180'],
      gap: 'R&S SMW-K180 covers IEEE 802.15.4 O-QPSK (ZigBee). Wi-SUN (802.15.4g) and Z-Wave have no SMW200A option.' },
    N7612EMBC: { step: 'Signal creation', name: 'PathWave Signal Generation for TD-SCDMA/HSPA', page: 'CG p5', status: 'covered', ids: ['K50', 'K51'],
      note: 'R&S SMW-K50 TD-SCDMA with R&S SMW-K51 enhanced BS/MS tests.' },
    N7614EMBC: { step: 'Signal creation', name: 'PathWave Signal Generation for power amplifier test (CFR, DPD)', page: 'CG p5', status: 'covered', ids: ['K548', 'K541'],
      note: 'R&S SMW-K548 crest factor reduction and R&S SMW-K541 AM/AM, AM/PM predistortion; R&S SMW-K575 (RF linearization) is the newer alternative for the DPD part.' },
    N7617EMBC: { step: 'Signal creation', name: 'PathWave Signal Generation for WLAN 802.11 a/b/g/j/p/n/ac/ax/be (80 MHz)', page: 'CG p5', status: 'covered', ids: ['K54', 'K86', 'K142', 'K147'],
      note: 'R&S SMW-K54 802.11 a/b/g/n/j/p, K86 802.11ac, K142 802.11ax, K147 802.11be.' },
    N7620B: { step: 'Signal creation', name: 'PathWave Signal Generation for pulse building', page: 'CG p5', status: 'covered', ids: ['K300', 'K301'],
      note: 'R&S SMW-K300 pulse sequencing with R&S SMW-K301 enhanced pulse sequencing. Keysight lists N7620B twice: with Option 602 for narrowband and with Option 016 plus an M8190A for wideband waveforms; the SMW200A builds both inside the instrument.' },
    N7621B: { step: 'Signal creation', name: 'PathWave Signal Generation for multitone distortion (with M8190A)', page: 'CG p5', status: 'covered', ids: ['K61', 'K811'],
      note: 'R&S SMW-K61 multicarrier CW and R&S SMW-K811 notched signals (NPR); pre-distortion of the generator is R&S SMW-K541.' },
    N7622C: { step: 'Signal creation', name: 'PathWave Signal Generation Toolkit (waveform download and playback)', page: 'CG p5', status: 'standard',
      note: 'The ARB accepts .wv, .mat, .csv and .iq.tar files (SP p46); the R&S ARB Toolbox and WinIQSIM2 are free downloads.' },
    N7623EMBC: { step: 'Signal creation', name: 'PathWave Signal Generation for digital video (DVB-T/H/C/S/S2, ISDB-T, DTMB, CMMB, J.83, ATSC)', page: 'CG p5', status: 'partial', ids: ['K52', 'K116'],
      gap: 'R&S SMW-K52 covers DVB-T/H and R&S SMW-K116 DVB-S2/S2X. DVB-C, ISDB-T, DTMB, CMMB, J.83 and ATSC are not SMW200A options.' },
    N7624EMBC: { step: 'Signal creation', name: 'PathWave Signal Generation for LTE FDD (with LTE-Advanced)', page: 'CG p6', status: 'covered', ids: ['K55', 'K85'],
      note: 'R&S SMW-K55 LTE Release 8 covers FDD and TDD; R&S SMW-K85 is LTE-Advanced (Release 10).' },
    N7625EMBC: { step: 'Signal creation', name: 'PathWave Signal Generation for LTE TDD (with LTE-Advanced)', page: 'CG p6', status: 'covered', ids: ['K55', 'K85'],
      note: 'The same R&S SMW-K55 and K85 as for LTE FDD; one licence covers both duplex modes.' },
    N7626EMBC: { step: 'Signal creation', name: 'PathWave Signal Generation for V2X', page: 'CG p6', status: 'covered', ids: ['K55', 'K119'],
      note: 'LTE-V2X sidelink is Release 14: R&S SMW-K119 LTE Release 13/14/15 on R&S SMW-K55. 5G NR sidelink is R&S SMW-K170.' },
    N6171A: { step: 'Signal creation', name: 'MATLAB software', page: 'CG p6', status: 'standard',
      note: 'Third-party software; it drives the SMW200A over SCPI like any instrument. Nothing to order from R&S.' },

    /* ---- Step 8: custom options (CG p6; SP p12-13, p27, p40) --------- */
    H1G: { step: 'Custom options', name: 'Add 1 GHz external phase reference (multi-source phase coherency, 100 kHz to 250 MHz)', page: 'CG p6', status: 'covered', ids: ['B90'],
      note: 'R&S SMW-B90 phase coherence: LO in/out for two RF paths or several instruments over the whole frequency range (SP p27).' },
    H1S: { step: 'Custom options', name: 'Add 1 GHz external frequency reference input', page: 'CG p6', status: 'covered', ids: ['K703'],
      note: 'R&S SMW-K703 100 MHz and 1 GHz ultra low noise reference input/output (SP p12-13).' },
    HBR: { step: 'Custom options', name: 'Modified wideband differential external I/Q inputs (3.2 to 10.35 GHz, > 1.3 GHz)', page: 'CG p6', status: 'covered', ids: ['K739'],
      note: 'A band-limited Option 016 for export-regulated markets (CG p6, footnote 7). The SMW200A inputs are the same as for Option 016.' },
    HCC: { step: 'Custom options', name: 'Add input and output of phase reference LO (multi-source phase coherency)', page: 'CG p6', status: 'covered', ids: ['B90'],
      note: 'R&S SMW-B90: LO IN and REF/LO OUT on the rear panel couple two or more instruments (SP p27).' },
    HFA: { step: 'Custom options', name: 'Modified upper frequency limit (10.35 GHz)', page: 'CG p6', status: 'none',
      note: 'An export-related cap on Option 520 (CG p6). The lowest SMW200A microwave option is R&S SMW-B1012 at 12.75 GHz.' },
    SP2: { step: 'Custom options', name: 'Dynamic sequencing (change ARB sequences on command)', page: 'CG p6', status: 'covered',
      ids: { standard: ['K501'], wideband: ['K502'] },
      note: 'R&S SMW-K501 extended sequencing on the standard generator, R&S SMW-K502 wideband extended sequencing on R&S SMW-B9.' },

    /* ---- Step 9: connectors (CG p7; SP p84-85, accessories) ---------- */
    '1ED': { step: 'Connectors', name: 'Type-N (f) RF output connector', page: 'CG p7', status: 'covered', ids: ['ADP-NF'],
      note: 'R&S SMW-B1012/-B1020 come with a PC 2.92 mm female connector; the N female test port adapter (1036.4777.00) is the accessory for it.' },
    '1EM': { step: 'Connectors', name: 'Moves all front panel connectors to the rear panel', page: 'CG p7', status: 'partial',
      byFreq: { B1020: ['B83'], B1031: ['B83'] },
      gap: 'R&S SMW-B83 puts RF path A and the I/Q connectors on the rear for the 20, 31.8 and 40 GHz options; there is no rear-panel option for R&S SMW-B1012 or R&S SMW-B1044.' },
    '003': { step: 'Connectors', name: 'PSG digital output connectivity with N5102A', page: 'CG p7', status: 'covered',
      ids: { standard: ['K18'], wideband: ['K19'] },
      note: 'R&S SMW-K18 digital baseband output (R&S SMW-K19 on the wideband section); R&S digital I/Q cables are in the accessories.' },
    '004': { step: 'Connectors', name: 'PSG digital input connectivity with N5102A', page: 'CG p7', status: 'standard',
      note: 'The digital I/Q inputs are on the baseband main module itself (SP p43-44); only outputs need R&S SMW-K18.' },

    /* ---- Step 10: accessories (CG p8) -------------------------------- */
    '1CM114A': { step: 'Accessories', name: 'Rackmount flange kit', page: 'CG p8', status: 'covered', ids: ['ZZA-KN4B'],
      note: 'R&S ZZA-KN4B 19" rack adapter.' },
    '1CN103A': { step: 'Accessories', name: 'Front handle kit', page: 'CG p8', status: 'none',
      note: 'No handle kit is listed for the SMW200A.' },
    '1CP106A': { step: 'Accessories', name: 'Rackmount kit with front handles', page: 'CG p8', status: 'covered', ids: ['ZZA-KN4B'],
      note: 'R&S ZZA-KN4B 19" rack adapter.' },
    '1CR100A': { step: 'Accessories', name: 'Rack slide kit', page: 'CG p8', status: 'none',
      note: 'No slide kit is listed for the SMW200A.' },
    N5102A: { step: 'Accessories', name: 'Baseband Studio digital signal interface module', page: 'CG p8', status: 'none',
      note: 'The SMW200A talks digital I/Q to R&S instruments directly, and to third-party formats through the R&S EX-IQ-BOX, a separate product outside this catalog.' },
    U3035P: { step: 'Accessories', name: 'Distribution network - PSG (master LO to several generators)', page: 'CG p8', status: 'none',
      note: 'R&S SMW-B90 couples the LO from one SMW200A to the next directly (SP p27); no distribution box is listed.' },

    /* ---- Step 11: frequency extenders (CG p8) ------------------------ */
    'N5179V-W19': { step: 'Frequency extender', name: 'VDI WR19 extension module, 40 to 60 GHz', page: 'CG p8', status: 'covered', ids: ['K554'], needsFreq: ['B1020', 'B1031', 'B1044'],
      freqGap: 'R&S SMW-K554 needs a frequency option of 20 GHz or more in the path it controls (R&S SMW-B1020 and up); R&S SMW-B1012 rules it out.',
      note: 'R&S SMW-K554 external multiplier control drives the R&S SMZ75 (50 to 75 GHz), a separate product. R&S SMW-B1056/-B1067 reach 56/67 GHz with no extender at all.' },
    'N5179V-W15': { step: 'Frequency extender', name: 'VDI WR15 extension module, 50 to 75 GHz', page: 'CG p8', status: 'covered', ids: ['K554'], needsFreq: ['B1020', 'B1031', 'B1044'],
      freqGap: 'R&S SMW-K554 needs a frequency option of 20 GHz or more in the path it controls (R&S SMW-B1020 and up); R&S SMW-B1012 rules it out.',
      note: 'R&S SMW-K554 external multiplier control with the R&S SMZ75 (50 to 75 GHz), a separate product.' },
    'N5179V-W12': { step: 'Frequency extender', name: 'VDI WR12 extension module, 60 to 90 GHz', page: 'CG p8', status: 'covered', ids: ['K554'], needsFreq: ['B1020', 'B1031', 'B1044'],
      freqGap: 'R&S SMW-K554 needs a frequency option of 20 GHz or more in the path it controls (R&S SMW-B1020 and up); R&S SMW-B1012 rules it out.',
      note: 'R&S SMW-K554 external multiplier control with the R&S SMZ90 (60 to 90 GHz), a separate product.' },
    'N5179V-W10': { step: 'Frequency extender', name: 'VDI WR10 extension module, 75 to 110 GHz', page: 'CG p8', status: 'covered', ids: ['K554'], needsFreq: ['B1020', 'B1031', 'B1044'],
      freqGap: 'R&S SMW-K554 needs a frequency option of 20 GHz or more in the path it controls (R&S SMW-B1020 and up); R&S SMW-B1012 rules it out.',
      note: 'R&S SMW-K554 external multiplier control with the R&S SMZ110 (75 to 110 GHz), a separate product.' },
    'N5179V-W08': { step: 'Frequency extender', name: 'VDI WR8.0 extension module, 90 to 140 GHz', page: 'CG p8', status: 'partial', ids: ['K554'], needsFreq: ['B1020', 'B1031', 'B1044'],
      freqGap: 'R&S SMW-K554 needs a frequency option of 20 GHz or more in the path it controls (R&S SMW-B1020 and up); R&S SMW-B1012 rules it out.',
      gap: 'R&S SMW-K554 with the R&S SMZ170 covers 110 to 170 GHz; 90 to 110 GHz is the R&S SMZ110.' },
    'N5179V-W06': { step: 'Frequency extender', name: 'VDI WR6.5 extension module, 110 to 170 GHz', page: 'CG p8', status: 'covered', ids: ['K554'], needsFreq: ['B1020', 'B1031', 'B1044'],
      freqGap: 'R&S SMW-K554 needs a frequency option of 20 GHz or more in the path it controls (R&S SMW-B1020 and up); R&S SMW-B1012 rules it out.',
      note: 'R&S SMW-K554 external multiplier control with the R&S SMZ170 (110 to 170 GHz), a separate product.' },
    'N5179V-W05': { step: 'Frequency extender', name: 'VDI WR5.1 extension module, 140 to 220 GHz', page: 'CG p8', status: 'none',
      note: 'The R&S SMZ multipliers stop at 170 GHz.' },
    'N5179V-W04': { step: 'Frequency extender', name: 'VDI WR4.3 extension module, 170 to 260 GHz', page: 'CG p8', status: 'none',
      note: 'The R&S SMZ multipliers stop at 170 GHz.' },
    'N5179V-W03': { step: 'Frequency extender', name: 'VDI WR3.4 extension module, 220 to 330 GHz', page: 'CG p8', status: 'none',
      note: 'The R&S SMZ multipliers stop at 170 GHz.' },
    'N5179V-W2B': { step: 'Frequency extender', name: 'VDI WR2.8 extension module, 260 to 400 GHz', page: 'CG p8', status: 'none',
      note: 'The R&S SMZ multipliers stop at 170 GHz.' },
    'N5179V-W02': { step: 'Frequency extender', name: 'VDI WR2.2 extension module, 325 to 500 GHz', page: 'CG p8', status: 'none',
      note: 'The R&S SMZ multipliers stop at 170 GHz.' },
    'N5179V-W1B': { step: 'Frequency extender', name: 'VDI WR1.5 extension module, 500 to 750 GHz', page: 'CG p8', status: 'none',
      note: 'The R&S SMZ multipliers stop at 170 GHz.' },
    'N5179V-W01': { step: 'Frequency extender', name: 'VDI WR1.0 extension module, 750 to 1100 GHz', page: 'CG p8', status: 'none',
      note: 'The R&S SMZ multipliers stop at 170 GHz.' },

    /* ---- Step 12: calibration (CG p9) -------------------------------- */
    UK6: { step: 'Calibration', name: 'Commercial calibration certificate with test data', page: 'CG p9', status: 'covered', ids: ['DCV-2'],
      note: 'R&S DCV-2 documentation of calibration values.' },
    A6J: { step: 'Calibration', name: 'ANSI Z540-1-1994 calibration', page: 'CG p9', status: 'covered', ids: ['ACA-44'],
      note: 'R&S ACASMW200A accredited calibration, 12.75 GHz to 44 GHz - the range every E8267D falls in.' },
    AMG: { step: 'Calibration', name: 'Keysight Cal + Uncertainties + Guardbanding (accredited)', page: 'CG p9', status: 'covered', ids: ['ACA-44'],
      note: 'R&S ACASMW200A accredited calibration, 12.75 GHz to 44 GHz.' },
    '1A7': { step: 'Calibration', name: 'Keysight Cal + Uncertainties + Guardbanding (compliant)', page: 'CG p9', status: 'covered', ids: ['ACA-44'],
      note: 'R&S ACASMW200A accredited calibration, 12.75 GHz to 44 GHz.' },
    'R-50C-011-3': { step: 'Calibration', name: 'Calibration plan, return to Keysight, 3 years', page: 'CG p9', status: 'service' },
    'R-50C-011-5': { step: 'Calibration', name: 'Calibration plan, return to Keysight, 5 years', page: 'CG p9', status: 'service' },
    'R-50C-011-7': { step: 'Calibration', name: 'Calibration plan, return to Keysight, 7 years', page: 'CG p9', status: 'service' },
    'R-50C-011-10': { step: 'Calibration', name: 'Calibration plan, return to Keysight, 10 years', page: 'CG p9', status: 'service' },
    'R-50C-011-MU-3': { step: 'Calibration', name: 'Keysight calibration + uncertainties, 3 years', page: 'CG p9', status: 'service' },
    'R-50C-011-MU-5': { step: 'Calibration', name: 'Keysight calibration + uncertainties, 5 years', page: 'CG p9', status: 'service' },
    'R-50C-016-3': { step: 'Calibration', name: 'Keysight calibration + uncertainties + guardbanding, 3 years', page: 'CG p9', status: 'service' },
    'R-50C-016-5': { step: 'Calibration', name: 'Keysight calibration + uncertainties + guardbanding, 5 years', page: 'CG p9', status: 'service' },
    'R-50C-021-3': { step: 'Calibration', name: 'ANSI Z540-1-1994 calibration, 3 years', page: 'CG p9', status: 'service' },
    'R-50C-021-5': { step: 'Calibration', name: 'ANSI Z540-1-1994 calibration, 5 years', page: 'CG p9', status: 'service' },

    /* ---- Step 13: start-up assistance (CG p9) ------------------------ */
    'PS-S10': { step: 'Start-up assistance', name: 'Remote scheduled assistance', page: 'CG p9', status: 'service' },
    'PS-S20': { step: 'Start-up assistance', name: 'Startup assistance', page: 'CG p9', status: 'service' },
    'PS-X10': { step: 'Start-up assistance', name: 'Custom services', page: 'CG p9', status: 'service' },

    /* ---- Upgrade kits that are not plain E8267DK-<option> (CG p10-11) - */
    '005': { step: 'Upgrade kit', name: '6 GB internal hard drive', page: 'CG p10', status: 'standard',
      note: 'Every SMW200A stores waveforms on a solid state disk (SP p46).' },
    '2EH': { step: 'Upgrade kit', name: 'Improved harmonics below 2 GHz (newer serial numbers)', page: 'CG p11', status: 'none',
      note: 'The same as Option 1EH: the SMW200A offers no low-band harmonic filter.' },
    '3EU': { step: 'Upgrade kit', name: '5 to 7 dB more output power below 3.2 GHz', page: 'CG p11', status: 'standard',
      note: 'The SMW200A level range is specified per frequency option with no power option (SP p13); compare the tables before deciding.' },
    R2C: { step: 'Upgrade kit', name: 'Core instrument firmware enhancements', page: 'CG p11', status: 'standard',
      note: 'SMW200A firmware updates are free downloads.' },
    '2NW': { step: 'Upgrade kit', name: 'Narrow pulse modulation (newer serial numbers)', page: 'CG p11', status: 'covered', ids: ['K22', 'K23'],
      note: 'The same as Option UNW.' },
    700: { step: 'Upgrade kit', name: 'Factory installation and calibration charge', page: 'CG p11', status: 'service' }
  }
};

/** The models this module recognises but cannot map yet, so a document naming one gets a plain answer. */
export const OTHER_MODELS = {
  E8257D: 'PSG analog signal generator',
  E8663D: 'PSG RF analog signal generator',
  E8267C: 'PSG vector signal generator (earlier model)',
  E4438C: 'ESG vector signal generator',
  N5181B: 'MXG X-Series RF analog signal generator',
  N5182B: 'MXG X-Series RF vector signal generator',
  N5183B: 'MXG X-Series microwave analog signal generator',
  N5171B: 'EXG X-Series RF analog signal generator',
  N5172B: 'EXG X-Series RF vector signal generator',
  N5173B: 'EXG X-Series microwave analog signal generator',
  M9383B: 'VXG microwave signal generator',
  M9384B: 'VXG microwave signal generator',
  AP5001A: 'RF analog signal generator',
  AP5002A: 'microwave analog signal generator',
  AP5021A: 'G3 analog signal generator',
  AP5022A: 'G3 analog signal generator',
  AP5041A: 'vector signal generator',
  AP5042A: 'G3 vector signal generator'
};

/* ------------------------------------------------------------- reading */

const escapeKs = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* The option codes that stand on their own on a document (software, accessories,
   extenders, services), longest first so "N5179V-W2B" is not read as "N5179V-W2". */
const KS_STANDALONE = Object.keys(E8267D.options).filter(c => /^(N\d|U\d|1C|R-50C|PS-)/.test(c))
  .sort((a, b) => b.length - a.length);
const KS_STANDALONE_RE = new RegExp(`(?<![A-Z0-9-])(${KS_STANDALONE.map(escapeKs).join('|')})(?![A-Z0-9])`, 'gi');

/* "E8267D-544", "E8267D-UNX", "E8267DK-016" (an upgrade kit), "E8267D/544";
   with a space only a numeric option follows ("E8267D 544"), so "E8267D PSG"
   is the model and its family, not an option */
const KS_MODEL_OPT_RE = /\bE8267D(K)?(?:\s*[-\/]\s*([A-Z0-9]{3})|\s+(\d{3}))(?![A-Z0-9])/gi;
/* "Option 544", "Opt. UNX", "Opt UNY" - only counted once the model is known */
const KS_BARE_OPT_RE = /\b(?:option|opt\.?)\s+([A-Z0-9]{3})(?![A-Z0-9])/gi;
/* A code on its own at the start of a row, as a product listing or an
   "installed options" table prints it ("1EH  Improved harmonics below 2 GHz"),
   also after the quantity an AI transcription puts first; only the codes the
   table carries, only once the model is known, and a code that is all digits
   must not be the start of a longer number ("700.00"). */
const KS_ROW_CODES = Object.keys(E8267D.options).filter(c => /^[A-Z0-9]{3}$/i.test(c)).sort((a, b) => b.length - a.length);
const KS_ROW_CODE_RE = /^(?:qty:?\s*\d+\s+)?([A-Z0-9|]{3})(?![A-Z0-9.,])/i;
const KS_ROW_CODE_SET = new Set(KS_ROW_CODES.map(c => c.toUpperCase()));
/* A code with a letter in it anywhere on a line ("Options UNW, UNY and 1EH
   installed") - digits-only codes are too much like other numbers for that. */
const KS_ALPHA_CODES = KS_ROW_CODES.filter(c => /[A-Z]/i.test(c));
const KS_ALPHA_CODE_RE = new RegExp(`(?<![A-Z0-9-])(${KS_ALPHA_CODES.map(escapeKs).join('|')})(?![A-Z0-9])`, 'gi');
/* Options only the vector PSG has (the analog E8257D shares the frequency,
   phase noise, modulation and connector codes): one of these on a document
   that names no model is enough to take it for an E8267D. */
const KS_VECTOR_ONLY = new Set(['602', '016', 'HBQ', 'H18', 'HBR', '403', '409', '423', 'SP1', 'SP2', '003', '004', '009']);
const KS_MODEL_RE = /\bE8267D\b/i;
const KS_OTHER_RE = new RegExp(`\\b(${Object.keys(OTHER_MODELS).join('|')})\\b`, 'gi');
const KS_NAME_RE = /(?:quotation|quote|proposal)\s*(?:no\.?|number|#|id)?\s*[:#]?\s*([A-Z0-9][A-Z0-9\-\/.]{3,})/i;
const KS_QTY_BEFORE = /(?<![\dA-Za-z.,\/-])(\d{1,3})\s*[x×]\s*$/i;
const KS_QTY_EXPLICIT = /\b(?:qty|quantity)\.?\s*[:#]?\s*(\d{1,3})\b/i;
const KS_QTY_COLUMNS = /^\s*(\d{1,3})\s+(\d{1,3})\s+(?=\S)/;

/* What a picture reader makes of the model name: the 8 as a B, the 6 as a G,
   the D as an O; "EB267D-544" is E8267D-544. */
const KS_MODEL_SLIP = /\bE[8B]2[6G]7[DO](?=[K\s\-\/]|$)/gi;
/* and of a code: an O for a 0, an I or l for a 1, an S for a 5, a B for an 8 -
   tried only when the code as read is not one the table carries */
const slipFix = c => c.replace(/O/g, '0').replace(/[Il|]/g, '1').replace(/S/g, '5').replace(/B/g, '8');

/**
 * Reads a document's text for a Keysight configuration.
 *
 * The model comes from "E8267D" anywhere on the page; its options from
 * "E8267D-544" (or "E8267DK-544", an upgrade kit) and, once the model is
 * known, from "Option 544" on its own; software, accessories, extenders and
 * services from their own ordering numbers. A code the table does not carry
 * is listed under `unknown`. Other Keysight models are recognised by name so
 * the page can say it has no mapping for them yet.
 *
 * @returns {{vendor:string, model:string|null, family:string|null, qty:number,
 *   options:Array<{code:string, line:string, kit:boolean}>, unknown:string[],
 *   name:string|null, other:Array<{model:string, family:string}>}|null}
 *   null when nothing Keysight is on the document.
 */
export function readKeysight (text) {
  const src = String(text || '').replace(KS_MODEL_SLIP, m => (m.endsWith('K') ? 'E8267DK' : 'E8267D'));
  const lines = src.split(/\r?\n/).map(l => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const options = new Map();
  const unknown = [];
  const other = new Map();
  let model = null;
  let qty = 1;

  const find = code => Object.keys(E8267D.options).find(k => k.toLowerCase() === code.toLowerCase());
  const take = (code, line, kit = false) => {
    const key = find(code) || find(slipFix(code));
    if (!key) { if (!unknown.includes(code.toUpperCase())) unknown.push(code.toUpperCase()); return; }
    if (!options.has(key)) options.set(key, { code: key, line, kit });
  };

  for (const line of lines) {
    for (const m of line.matchAll(KS_OTHER_RE)) {
      const id = m[1].toUpperCase();
      if (!other.has(id)) other.set(id, { model: id, family: OTHER_MODELS[id] });
    }
    let onLine = false;
    for (const m of line.matchAll(KS_MODEL_OPT_RE)) {
      model = 'E8267D'; onLine = true;
      take(m[2] || m[3], line, !!m[1]);
    }
    if (!onLine && KS_MODEL_RE.test(line)) {
      model = 'E8267D';
      /* the model on its own: "2 x E8267D" or "1 2 E8267D PSG" counts instruments */
      const before = line.slice(0, line.search(KS_MODEL_RE));
      let n = 1, m;
      if ((m = before.match(KS_QTY_BEFORE))) n = +m[1];
      else if ((m = line.match(KS_QTY_EXPLICIT))) n = +m[1];
      else if ((m = line.match(KS_QTY_COLUMNS))) n = +m[2];
      if (n >= 1 && n <= 99) qty = Math.max(qty, n);
    }
    for (const m of line.matchAll(KS_STANDALONE_RE)) take(m[1], line);
  }
  /* bare "Option 544" lines, rows that start with a code, and lettered codes
     anywhere belong to the model once one is named anywhere */
  if (model) {
    for (const line of lines) {
      for (const m of line.matchAll(KS_BARE_OPT_RE)) take(m[1], line);
      const row = line.match(KS_ROW_CODE_RE);
      if (row && (KS_ROW_CODE_SET.has(row[1].toUpperCase()) || KS_ROW_CODE_SET.has(slipFix(row[1].toUpperCase())))) take(row[1], line);
      for (const m of line.matchAll(KS_ALPHA_CODE_RE)) take(m[1], line);
    }
  }
  /* No model named: a transcription may have dropped the header. Rows that
     start with PSG option codes still say what the instrument is when one of
     them exists only on the vector model; otherwise they are reported as
     codes with no model, so the page can ask for it. */
  let inferred = false;
  const candidates = [];
  if (!model) {
    for (const line of lines) {
      const row = line.match(KS_ROW_CODE_RE);
      if (!row) continue;
      const raw = row[1].toUpperCase();
      const code = KS_ROW_CODE_SET.has(raw) ? raw : KS_ROW_CODE_SET.has(slipFix(raw)) ? slipFix(raw) : null;
      if (code && !candidates.includes(code)) candidates.push(code);
    }
    if (candidates.length >= 2 && candidates.some(c => KS_VECTOR_ONLY.has(c))) {
      model = 'E8267D'; inferred = true;
      for (const line of lines) {
        const row = line.match(KS_ROW_CODE_RE);
        if (row && (KS_ROW_CODE_SET.has(row[1].toUpperCase()) || KS_ROW_CODE_SET.has(slipFix(row[1].toUpperCase())))) take(row[1], line);
        for (const m of line.matchAll(KS_ALPHA_CODE_RE)) take(m[1], line);
      }
    }
  }
  if (!model && !other.size && candidates.length < 3) return null;
  const name = (src.match(KS_NAME_RE) || [])[1] || null;
  return {
    vendor: KEYSIGHT_VENDOR,
    model, family: model ? E8267D.family : null, qty, inferred,
    options: [...options.values()],
    unknown,
    name: name ? name.replace(/[.,;:]+$/, '') : null,
    other: [...other.values()],
    candidates: model ? [] : candidates
  };
}
