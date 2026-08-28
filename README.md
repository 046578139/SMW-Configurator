# R&S®SMW200A Configurator

An interactive configurator for the Rohde & Schwarz SMW200A vector signal
generator. Pick options, watch the instrument take shape, and get a parts list
that has been checked against every rule in the configuration guide.

It is a static site — plain HTML, CSS and ES modules, no build step, no runtime
dependencies. Open `index.html` and it runs.

![Overview](docs/screenshot-overview.png)

## What it does

**Checks the rules, rather than just collecting clicks.** All 239 options carry
their prerequisites, conflicts and quantity limits from the configuration guide.
Selecting R&S®SMW-K512 without R&S®SMW-K511 is not silently accepted — the
Checks panel names what is missing and offers to add it. *Fix issues* follows
prerequisite chains to a valid configuration, and refuses dead ends instead of
inventing an instrument that cannot be ordered.

Rules covered include the RF path A/B combination matrix, the deeper-chassis
requirement, the "O" frequency variants that force the wideband main module,
phase noise levels that must match across paths, the standard/wideband baseband
split, floating licences, per-RF-path option sets, and quantity steps such as
the fading simulator's 1 / 2 / 4.

**Shows the instrument, not a list of checkboxes.** The front-panel view has a
working spectrum display: carrier count follows the number of baseband
generators, occupied bandwidth follows the installed extensions, AWGN lifts the
noise floor, fading adds ripple, and R&S®SMW-K811 carves notches. The signal
chain diagram animates from baseband through fading and routing to the RF
connectors, and the frequency ruler places both paths on a log axis against
sub-6 GHz and FR2.

**Gets you started and gets out of the way.** Eight validated starting points
cover common tasks — 5G NR FR1 and FR2, MIMO fading, GNSS, radar and EW, Wi-Fi,
satellite. Search spans every option by code, name or order number. The full
configuration lives in the URL, so a link is a complete handover.

Export gives CSV, JSON (parts list plus derived capabilities and any open
issues) or a printable page.

## Running it

Any static file server works; ES modules need HTTP rather than `file://`.

```sh
python3 -m http.server 8000     # then open http://localhost:8000
```

Tests:

```sh
node --test
```

### One file, no server

```sh
node tools/build-standalone.mjs        # -> dist/smw200a-configurator.html
```

Inlines the stylesheet and every module into a single ~160 kB HTML file that
runs by double-clicking it — no server, no network. Useful for handing the
configurator to someone who just wants to open it. The builder has no
dependencies: the modules form a plain chain with no cycles and no clashing
top-level names, so concatenating them in order is all it takes.

The file is a build product and is not checked in; rebuild it after changing
anything under `assets/`.

## Where the data comes from

Everything is transcribed from Rohde & Schwarz product documentation, kept in
`docs/source/` so any entry can be traced back:

| Document | Used for |
| --- | --- |
| `SMW200A_configguide_en_3606803792_v0600.pdf` | option list, order numbers, all configuration rules, step numbering |
| `SMW200A_specs_en_3606803722_v3100.pdf` | derived figures; five options newer than the guide |
| `SMW200AMIMOFading_specs_en_3673127622_v0400.pdf` | fading channel counts and MIMO orders |
| `DigitalStandards_specs_en_5213943422_v2800.pdf` | digital standards background |
| `GNSSAvionicsSimulationRSSignalGenerators_specs_en_3607689622_v1700.pdf` | GNSS channel behaviour |
| `PulseSequencerSoftware_specs_en_3607138822_v1300.pdf` | Pulse Sequencer option chain |
| `WinIQSIM2_specs_en_5213746022_v2200.pdf` | WinIQSIM2 standards |
| `SMWZKK_ZKV_datsw_en_3683823822_v0200.pdf` | combiner kits for R&S®SMW-K555 |
| `WIC5GMobiledevicetestingmisc3609763192.pdf` | 5G device test context |

The configuration guide is version 06.00 (May 2024). Five options appear only in
the specifications document (version 31.00) — R&S®SMW-K508, ‑K554, ‑K556, ‑K573
and ‑K575. They are included and marked *newer than guide v06.00* in the
interface.

## How it is put together

```
index.html              shell and layout
assets/css/app.css      design system, both themes
assets/js/
  util.js               shared helpers
  catalog.js            239 options: order numbers, rules, quantity limits
  rules.js              expression parser, validator, autoResolve
  derive.js             selection -> instrument capabilities
  diagram.js            front panel, signal chain, frequency ruler (SVG)
  ui.js                 icon set and stateless render helpers
  presets.js            validated starting points
  app.js                state, rendering, events, export
tests/rules.test.mjs    28 regression tests
tools/build-standalone.mjs  single-file build
```

Requirements are written in a small expression language that mirrors the
guide's *Requires* column:

```js
requires: '((B13|B13T)&K16)|(B13XT&K17)'   // R&S®SMW-K540, envelope tracking
maxReq:   'B10*2'                          // a second unit needs two R&S®SMW-B10
```

`A&B` is both, `A|B` is either, `A*2` needs two units, and named shorthands
stand in for groups the guide keeps referring to — `GEN` is any baseband
generator, `WGEN` the wideband ones, `BB` any main module, `GNSS` any navigation
standard. An atom counts every option in its group, so `GEN*2` is satisfied by
one R&S®SMW-B9 plus one ‑B10 exactly as the guide intends.

### Adding or changing an option

Add a record to `OPTIONS` in `catalog.js`. The interface, validation, search,
parts list and export all follow from the data — no other file needs touching
unless the option introduces a rule the expression language cannot state, in
which case `validate()` in `rules.js` is where special cases live.

`node --test` will tell you if an expression references an unknown option, if a
conflict is declared on only one side, or if a starting point stopped being
valid.

## Publishing

`.github/workflows/pages.yml` publishes the site to GitHub Pages on pushes to
the default branch. It needs Pages enabled for the repository with **Source:
GitHub Actions** (Settings → Pages). Nothing else is required — the site is
served exactly as it sits in the repository.

## Hosting notes

The app degrades rather than breaking where a host is restrictive. Browser
storage is treated as a convenience — private windows and sandboxed frames make
those calls throw, and the configurator carries on without them, since the full
configuration also lives in the URL. Some hosts sandbox the frame and never let
a page start a download; where such a host exposes a save API the export buttons
use it, and where saving is refused outright the dialog says so instead of
offering a button that does nothing. On an ordinary web server neither path
applies and downloads work normally.

## Scope

This is a planning aid built from public documentation, not an ordering system.
It carries no prices and no availability, and R&S documentation states that data
without tolerance limits is not binding. Confirm any configuration with Rohde &
Schwarz before ordering.

R&S® is a registered trademark of Rohde & Schwarz. Bluetooth®, CDMA2000®, LoRa®
and other marks belong to their respective owners. This project is not
affiliated with or endorsed by Rohde & Schwarz.
