# Competitor cross-reference

Import reads a competitor's configuration and points at the R&S®SMW200A
options that give the same capabilities. One model is mapped so far: the
Keysight E8267D PSG vector signal generator. This file says where the
mapping comes from, how it is kept apart from the configurator itself, and
how to add a model.

## Where the rows come from

Every row in `assets/js/xref-keysight.js` cites its sources:

| Tag | Document | Publication |
| --- | --- | --- |
| CG | E8267D PSG Vector Signal Generator, Configuration Guide, 12 pages | 5989-1326EN, July 23, 2025 |
| DS | E8267D PSG Vector Signal Generator, Data Sheet, 36 pages | 5989-0697EN, July 21, 2023 |
| SP | R&S®SMW200A Vector Signal Generator, Specifications | version 31.00, May 2026 |

The Keysight literature is copyrighted and is **not in the repository**:
`docs/source/keysight/` is ignored by git. The two documents above, and the
other Keysight brochures and guides collected while choosing the target, sit
there in the container that did the work. Anyone re-checking a row needs the
same two PDFs from keysight.com (the site refuses automated downloads; a
browser gets them). The R&S specifications are in `docs/source/`.

The configuration guide gives the option list, what each option is for and
what it requires (its thirteen ordering steps and the upgrade-kit table). The
data sheet gives the figures a row is decided on. Where a figure decides a
row, the row says so with the numbers and both pages, for example:

> Option UNY at 3.2 to 10 GHz: −72 / −85 / −101 / −120 / −120 dBc/Hz at
> 10 Hz / 100 Hz / 1 kHz / 10 kHz / 100 kHz (DS p12). R&S SMW-B711 at
> 10 GHz: −77 / −91 / −115 / −124 / −126 dBc/Hz (SP p23) – better at every
> offset.

Statuses, as the page shows them:

| Status | Meaning |
| --- | --- |
| covered | one or more SMW options give the capability |
| partial | covered in part; the row says what is missing (513 → B1012 stops at 12.75 GHz; the video option covers DVB-T/H and DVB-S2 but not ISDB-T) |
| standard | the SMW200A has it with no option (wideband modulation below 3.2 GHz, digital I/Q inputs, the waveform toolkit) |
| none | the SMW200A does not offer it (the 1EH low-band harmonic filters, a rack slide kit, extenders above 170 GHz) |
| service | a calibration plan or start-up service, quoted separately |

Decisions worth knowing:

- **Phase noise is mapped by the figures, not the names.** Keysight's
  "ultra-low" UNX is beaten at every offset by R&S SMW-B710 (improved
  close-in), and B709 would fall 2 dB short at 10 Hz; "enhanced ultra-low"
  UNY maps to B711. A test pins the cited figures to the rows.
- **Analog modulation forces a two-path main module.** FM and phase
  modulation on the SMW200A need R&S SMW-B13T or -B13XT (SP p30–31), so an
  E8267D with Option UNT resolves to B13T; without it, B13.
- **The wideband external I/Q of Option 016 needs no SMW option**: the
  SMW200A's analog I/Q inputs give ±1 GHz above 2.5 GHz on every frequency
  option except B1007/B1012 (SP p36). Option 016's differential inputs are
  R&S SMW-K739.
- **Options that depend on the frequency**: rear-panel connectors (1EM) map
  to R&S SMW-B83 only for the 20 and 31.8 GHz options; the millimetre-wave
  extenders map to R&S SMW-K554, which needs a 20 GHz option or higher, so
  with Option 513 the row says so instead of producing a configuration the
  rules reject.
- **Upgrade kits** (E8267DK-xxx) read as their option; the kits that are not
  plain options (005, 2EH, 3EU, R2C, 2NW, 700) have rows of their own.

## Keeping it apart from the configurator

The user asked for certainty that the cross-reference cannot contaminate
the configurator. The separation is structural, and tested:

- **One-way dependency.** `xref-keysight.js` imports nothing from the
  catalog; `xref.js` imports `catalog.js` and `rules.js` and nothing imports
  either `xref` module except `app.js`. `catalog.js`, `rules.js`, `derive.js`
  and the R&S reader in `import.js` are unchanged by the feature (`git log`
  shows it).
- **The SMW ids in the table are looked up, never trusted.** A test checks
  that every id the table names exists in the catalog, and that every option
  on its own, every option with each frequency option, and the whole guide's
  worth together resolve to a selection the unchanged rules engine accepts
  (`tests/xref.test.mjs`).
- **The equivalent is an ordinary configuration.** `crossReference()` builds
  a selection from the rows, hands it to `autoResolve()` for prerequisites
  and to `validate()` like any other, and reports what the rules added apart
  from what the table named. Nothing downstream knows where it came from
  except the Cross-ref tab, which reads `state.xref` (vendor, model, the
  option codes) and recomputes the rows against the current selection.
- **Two readers, one text, no confusion.** The R&S reader (`readText`) and
  the Keysight reader (`readKeysight`) both run on every document. The R&S
  reading has the say when it finds anything; the cross-reference is shown
  when only it did, and a mixed document offers a switch. A test runs every
  Keysight row as a quotation line through the R&S reader (nothing read)
  and every R&S option through the Keysight reader (nothing read).

## What the page does with it

- The Import dialog groups the rows by status, cites the pages, lists what
  the SMW200A's own rules added, and offers *Load the SMW equivalent* or
  *Add the equivalent*. Loading names the configuration
  "Equivalent of Keysight E8267D" and opens the **Cross-ref** tab beside
  Checks, which flags a mapped SMW option that is later taken out and can
  forget the cross-reference (the configuration stays).
- The cross-reference is kept with the configuration in this browser (it
  survives a reload) but not in a shared link or a saved entry: a link
  carries the selection alone.
- Exports carry it. The export view gains an *Answers E8267D* column on
  every SMW line (the Keysight options it answers, or "stands in for the
  E8267D", "main module – every SMW200A needs one", "added by the SMW200A's
  rules") and a second table under the parts list with every Keysight
  option requested, what it is, and the SMW200A answer. The CSV gets a
  *Mapped from* column, the JSON a `crossref` object, the PDF the same
  suffix on each line and a section after the parts list.
- The AI prompt names both vendors, so a scanned Keysight page transcribes
  into the same text the readers take; the OCR path reads a listing with
  bare codes ("544  Frequency range…") the same way, forgiving the usual
  OCR slips ("EB267D" for E8267D, "6O2" for 602). A transcription that
  dropped the header still reads as an E8267D when a vector-only option
  (602, 016, H18, 403 …) is among its rows, and the summary says the model
  was taken from its options. A rendered copy of a
  used-equipment listing read all eight options in 3 s through the page's
  OCR (`tests/browser/xref.mjs` covers the pasted, AI and export paths).

## Adding a model

1. Put its configuration guide and data sheet in `docs/source/keysight/`
   (ignored by git) and note their publication numbers.
2. Add a table like `E8267D` to `xref-keysight.js` with a row per option:
   `status`, `ids` (a list, `{standard, wideband}` by baseband section, or
   `byFreq` by frequency option), `needs` for a platform the row forces,
   `needsFreq`/`freqGap` for an answer that only works with some frequency
   options, `note` or `gap`, and `page`.
3. Register it in `XREF_MODELS` in `xref.js` and remove it from
   `OTHER_MODELS`; extend the reader if the model's documents print codes in
   a form the current patterns do not read.
4. Run `node --test tests/xref.test.mjs`: the integrity and validation tests
   sweep every model in `XREF_MODELS` once the code loops over them, and
   the mirror sweep must stay clean.
