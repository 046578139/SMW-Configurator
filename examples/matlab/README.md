# R&S®FSWP measurement demo for MATLAB

`fswp_phase_noise_demo.m` drives a Rohde & Schwarz FSWP phase noise analyzer
from MATLAB with plain SCPI commands. It connects, configures a phase noise
measurement, runs it, reads every result back, plots the trace and saves the
lot. If the spectrum analyzer option R&S®FSWP-B1 is installed it also runs a
spectrum sweep with a peak marker and a channel power measurement.

Every command is written out in the script, so it doubles as a worked
reference for the FSWP command set. The helper functions at the bottom of the
file are generic SCPI plumbing and can be lifted into your own scripts.

## What it measures

Phase noise, on the FSWP's native application:

- carrier frequency and level as found by the instrument
- spot noise at every decade offset and at up to six custom offsets
- integrated phase noise, residual PM, residual FM and RMS jitter over the
  whole offset range, and over a user-defined jitter band
- the spur list, as offset/level pairs
- the full trace, offset frequency against dBc/Hz

Spectrum (R&S®FSWP-B1 only): a single sweep around the carrier, the peak with
marker 1, channel power over a configurable bandwidth, and the trace.

Results are printed to the console, plotted in two figures, and saved as
`.mat` and `.csv` files in `results/` next to the script (ignored by git).

## Requirements

- MATLAB R2020b or newer. The default connection is a raw SCPI socket on
  port 5025 through `tcpclient`, which ships with base MATLAB. No toolbox is
  needed.
- Optional: Instrument Control Toolbox R2021a or newer if you prefer VISA
  (HiSLIP or VXI-11). Put a VISA resource string in `cfg.resource` and the
  script uses `visadev` instead.
- An FSWP reachable over the network. Its address is under
  SETUP > Network + Remote on the instrument. Port 5025 (raw socket) and
  4880 (HiSLIP) must be open between the PC and the instrument.

## Running it

1. Open the script and edit the **Settings** section at the top, at least
   `cfg.resource` (address) and `cfg.carrierHz` (your DUT's frequency).
2. Run the whole file, or step through it section by section with
   Ctrl+Enter. The sections are: connect, configure, run, read results,
   plot, save, optional spectrum, disconnect.
3. Watch the console. Measurement progress is reported every ten seconds,
   and any error the instrument reports is printed with the step it came
   from.

If the script stops with an error the socket stays open; `clear fswp` closes
it.

## Settings

| Setting | Meaning |
| --- | --- |
| `cfg.resource` | hostname/IP (raw socket) or VISA resource string |
| `cfg.carrierHz`, `cfg.autoSearch` | nominal carrier, and whether the FSWP searches for it |
| `cfg.offsetStartHz`, `cfg.offsetStopHz` | offset range in half-decade steps (1, 3, 10, 30 ...) |
| `cfg.sweepMode` | `NORMal`, `FAST`, `AVERaged` or `MANual` half-decade table |
| `cfg.xcorrFactor`, `cfg.rbwPercent` | cross-correlation and RBW factors used in `NORMal` mode |
| `cfg.averages` | number of measurements averaged |
| `cfg.smoothingPercent` | trace smoothing aperture, 0 turns it off |
| `cfg.spotOffsetsHz` | custom spot noise offsets, up to six |
| `cfg.jitterRangeHz` | user range for the second set of integrated results |
| `cfg.spectrumDemo` | `"auto"` runs the spectrum part if B1 is installed, or `"on"` / `"off"` |
| `cfg.spanHz`, `cfg.rbwHz`, `cfg.refLevel_dBm`, `cfg.chanBwHz` | spectrum sweep settings |
| `cfg.resetInstrument` | `*RST` before configuring, so runs are repeatable |
| `cfg.outputFolder` | where the `.mat` and `.csv` files go |

Lower start offsets and higher cross-correlation factors make the
measurement much longer. The script asks the instrument for its time
estimate (`SWE:DUR?`) and sets the timeout from that, so long measurements
do not trip a fixed read timeout.

## The SCPI commands used

| Step | Commands |
| --- | --- |
| Identify and preset | `*IDN?`, `*OPT?`, `*RST`, `*CLS`, `*OPC?`, `SYST:DISP:UPD ON`, `FORM:DATA REAL,32` |
| Select the application | `INST:SEL PNOise`, `INST:CRE:NEW SANalyzer,'name'`, `INST:LIST?`, `INST:SEL 'name'` |
| Signal | `SENS:FREQ:CENT`, `SENS:ADJ:CONF:FREQ:AUT`, `INP:ATT:AUTO` |
| Offset range and half decades | `SENS:FREQ:STAR`, `SENS:FREQ:STOP`, `SENS:SWE:MODE`, `SENS:SWE:XFAC`, `SENS:LIST:BWID:RAT`, `SENS:SWE:COUN` |
| Traces and spot noise | `DISP:WIND1:TRAC1:SMO:STAT`, `DISP:WIND1:TRAC1:SMO:APER`, `CALC1:SNO:DEC:STAT`, `CALC1:SNO<m>:X`, `CALC1:SNO<m>:STAT` |
| Run and synchronise | `INIT:CONT OFF`, `SENS:SWE:DUR?`, `INIT:IMM;*OPC`, `*ESR?`, `ABOR` |
| Results | `FETC:PNO1:MEAS:FREQ?`, `FETC:PNO1:MEAS:LEV?`, `CALC1:SNO:DEC:X?`, `CALC1:SNO:DEC:Y?`, `CALC1:SNO<m>:Y?`, `FETC:PNO1:IPN?`, `FETC:PNO1:RPM?`, `FETC:PNO1:RFM?`, `FETC:PNO1:RMS?`, `FETC:PNO1:SPUR?`, `TRAC1:DATA? TRACE1`, `TRAC1:DATA:X? TRACE1` |
| User range (optional) | `CALC1:EVAL:USER1:STAR`, `CALC1:EVAL:USER1:STOP`, `CALC1:EVAL:USER1:STAT`, `FETC:PNO1:USER1:IPN?`, `FETC:PNO1:USER1:RMS?` |
| Spectrum (B1) | `SENS:FREQ:SPAN`, `SENS:BWID:RES`, `SENS:BWID:VID:AUTO`, `DISP:WIND1:TRAC1:Y:SCAL:RLEV`, `DISP:WIND1:TRAC1:MODE`, `SENS:SWE:TIME:AUTO`, `CALC1:MARK1:FUNC:POW:SEL CPOW`, `SENS:POW:ACH:BWID:CHAN1`, `CALC1:MARK1:MAX`, `CALC1:MARK1:X?`, `CALC1:MARK1:Y?`, `CALC1:MARK1:FUNC:POW:RES? CPOW` |
| Errors | `SYST:ERR?` drained after every step |

Manual half-decade tables (`cfg.sweepMode = "MANual"`) take one RBW and one
cross-correlation count per half decade:

```
SENS:LIST:RANG<ri>:BWID:RES <percent>
SENS:LIST:RANG<ri>:XCO <count>
```

## How the helpers work

- **Synchronisation.** `scpiRunSingle` sends `INIT:IMM;*OPC` and polls
  `*ESR?` until bit 0 is set. That waits for measurements of any length
  without a long blocking read, keeps MATLAB responsive, and aborts the
  measurement if it overruns the timeout.
- **Numeric answers.** `scpiQueryNumbers` reads the first byte of the answer
  and handles both an ASCII list and an IEEE 488.2 binary block, so the
  same code works whichever `FORM:DATA` is active. The FSWP's "no value"
  marker 9.91e37 becomes `NaN`.
- **Errors.** `scpiCheck` drains `SYST:ERR?` and stops the script with the
  instrument's own message; `scpiWarn` does the same for optional steps and
  lets the script continue.

## Sources and caveats

Command syntax was checked against the Rohde & Schwarz remote-control
driver for the FSWP (`RsFswp` 4.10 on PyPI, which is generated from the
instrument's command tree) and the R&S FSWP user manual, chapters "Remote
commands for phase noise measurements" and "Remote commands for spectrum
measurements". Firmware versions differ in detail. The user evaluation
range and the return to the phase noise channel are treated as optional
steps that only warn, and the trace reader copes with either separate x/y
queries or interleaved pairs. If your instrument rejects a command, the
error message names it; the user manual for your firmware version is the
authority.

The script has been checked for syntax with a MATLAB parser but not run
against an instrument as part of this repository. R&S® is a registered
trademark of Rohde & Schwarz; this project is not affiliated with or
endorsed by Rohde & Schwarz.
