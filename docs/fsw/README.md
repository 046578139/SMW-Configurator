# R&S®FSW profile: where the data comes from

The FSW configurator (`fsw.html`, profile `assets/js/fsw/`) is the second
instrument on the shared shell. This file says which documents its catalog
was transcribed from, how the instrument's structure was mapped onto the
configurator, and the decisions a reader re-checking a row should know.

## Sources

Rohde & Schwarz publishes no configuration guide for the FSW the way it does
for the SMW200A. The ordering information of the specifications stands in
for it, and the application data sheets supply what the specifications only
imply. All 38 documents are in `docs/source/fsw/` (they are Rohde & Schwarz
literature, published on rohde-schwarz.com; `INVENTORY.json` lists them with
page counts and checksums).

| Tag | Document | Publication |
| --- | --- | --- |
| SP | R&S®FSW Signal and Spectrum Analyzer, Specifications, 56 pages – ordering information p43–51, inputs and outputs p32–34, options p37–42 | PD 5215.6749.22, version 17.01, September 2025 |
| BR | R&S®FSW product brochure, 34 pages | PD 5215.6749.12, version 17.00 |
| – | 36 application data sheets, specifications, option and solution sheets (K6, K7, K15, K17, K18x, K30, K40, K54, K70, K76/77, K82–85, K91x, K95/97, K10x, K106, K118/119, K144–K184, K149, K192/193, K201, K575, B512R/B800R/K161R/K512RE/K800RE, B24U) | see `INVENTORY.json` |

Every row of `assets/js/fsw/catalog.js` carries the specifications page it
was transcribed from (`page`), and a row's note says when a data sheet
decided something the specifications leave open.

## How the instrument maps onto the configurator

- **The model is the base unit.** The FSW comes as seven models,
  R&S®FSW8 to R&S®FSW85 (1331.5003.08 to .85), with no separate frequency
  option. The models are catalog entries flagged `baseModel`, a single-select
  section the rules treat as the one mandatory choice, and the profile's
  `bomBase` hook makes the chosen model the parts list's base line. Because
  they are entries, a requirement can name them: "for R&S®FSW26/43/50/67/85"
  is `requires: 'M26P'`, and an option that a model rules out says
  "not available with FSW13" on its card and offers the lowest model that
  allows it.
- **One order number per model.** R&S®FSW-B24 (seven numbers), -B71 (four),
  -B21 (two) and -B8 (two) are sold under one code with a number per model.
  Each number is its own entry (`B24-43`, code `B24`, `meta.models`), so a
  parts list carries the right number and the reader settles the code from
  the number. The hardware sections show the variants for the chosen model
  and dim the others. The FSW50 and FSW67 each have two B24 numbers
  (.49/.51, .66/.67); the specifications do not say what tells them apart,
  and both rows say so.
- **Analysis bandwidth is one option per instrument** (SP p44/45): 28 MHz
  without an option; R&S®FSW-B40 to -B8001 raise it; the real-time analyzers
  -B512R and -B800R include 512 MHz and 2 GHz and take the same slot. The
  page shows the "included" level first. Most applications need a minimum
  ("to support signal analysis bandwidths > 10 MHz, one of the … options
  required"), written as the `BW10`, `BW160`, `BW512`, `BW1200`, `BW2001`
  and `BW4001` shorthands. An application that needs more than the option
  chosen is shown as unavailable with that option, and the issue offers the
  narrowest option that meets it.
- **Upgrades (R&S®FSW-Uxxx) are for an instrument in the field** (SP
  p49/50). They are multi-select, need the bandwidth they start from as
  printed, and count as the bandwidth they produce, so an instrument
  upgraded to 320 MHz satisfies an application that asks for B320. They are
  never proposed as a fix on a new instrument, and a configuration with a
  bandwidth option and no upgrade cannot reach one. `B124` accepts `U4002`
  as well, which the ordering information omits though it produces the
  4.4 GHz the row asks for; the note says so.
- **Floating licences** (SP p46 footnote 59: ".51 instead of .02, requires
  R&S®FSW-FL"). The 35 applications so marked have a `-FL` variant in a
  section of their own, each needing the smart card, conflicting with the
  fixed licence of the same application, and satisfying any requirement that
  names the application (`K8`, `NR` and the other shorthands accept either
  form).
- **Prerequisites as printed** (SP p46–48): K6S←K6; K8E←K8; K17S←K17 and
  512 MHz; K18D/K18F←K18; K18M←K18+K18D; K54CAL←K54; K60H/C/P←K60;
  K70M/P←K70; K91N/AC/AX/BE/P←K91; K91BN←K91+K91BE; K95/K97←2 GHz;
  K102←K100|K104; K103←K101|K105; K100/101/104/105/K91/K201←>10 MHz;
  K118/K119←160 MHz (the K118/K119 sheet: B160 for one carrier, B1200 for
  eight); K147/K148/K175/K184←K144|K145; K147C←K147; K171←K144|K145 and
  K148; K149←1.2 GHz; K192/K193←B320|B512 (the K192 sheet lists B320 as
  mandatory for both); K161R←B160|B320 and not with 512 MHz and up;
  K512RE←B512 only; K800RE←B1200|B2001 only; K552←B517|B1017 (the
  specifications print "K1017", which does not exist); B517←512 MHz and not
  with B4001/B6001/B8001 (SP p38); B1017←1.2 GHz; B106←B160/U160/B320;
  B108←1.2 GHz; B124←4.4 GHz; B71E←B71; B24U←FSW43/50/67 with B24.
- **Two discrepancies between documents** are noted on the rows: R&S®FSW-K201
  is 1331.7387.02 in the specifications and 1331.7382.02 in its own data
  sheet (the newer specifications are used); the FC330SR converter and the
  three ZN-ZTW torque wrenches share a block of four order numbers whose
  alignment the extraction cannot prove.
- **Out of scope**: the R&S®FSW3-KMxxx licences in the application
  specifications belong to the FSWX/FSW3 line ("the R&S®FSx and R&S®FSW3 …
  options run on the analyzer itself"), not to the FSW (1331.5003.xx); the
  oscilloscopes R&S®FSW-B2071 records through; the power sensors the
  specifications list as supported (p52/53).

## What the page derives

`derive()` gives the frequency range (the model, 90 GHz with B90G), the
analysis bandwidth in effect (option or highest upgrade), the real-time
capability (hardware or application, bandwidth and POI), the preamplifier
range, the electronic attenuator, the OCXO, the resolution bandwidth (10 MHz
standard, 40 MHz with B8E, 80 MHz with B8), the baseband inputs (digital,
analog 40/80 MHz, oscilloscope), the external mixer connections, the 40 Gbit/s
streaming bandwidth, the I/Q memory extension, and the counts the panel
shows. The front and rear panel drawings follow "Inputs and outputs" (SP
p32–34) and the option sections (p37–41): the RF input connector per model
(two inputs on the FSW85), the analog baseband BNCs (no inverted inputs on
the FSW85), the LO/IF ports of B21, the IF WIDE OUT of B160 to B512R, the
2 GHz IF output of the FSW26 and up, the digital baseband interface, the
QSFP+ streaming port, the generator control and the USB device port. There
are no photographs; the shell shows the drawing alone.

## Checking it

`node --test tests/fsw.test.mjs` sweeps the catalog (26 tests): integrity,
the per-model numbers against every model, the bandwidth ladder, every
prerequisite chain above, every option on some model resolving and on the
wrong model saying so without a fix, the upgrades, the floating variants,
the presets, the reader and the drawings. `node tests/browser/run.mjs fsw`
drives the page and the standalone build.
