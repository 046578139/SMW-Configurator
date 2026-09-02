# What the vendor's configurator says

Captured on 2026-09-02 from Rohde & Schwarz's online SMW200A configurator
(https://configurator.rohde-schwarz.com, knowledge base `config.SMW200A`),
with the scripts in `tools/vendor/`. These files are the second source the
catalog is checked against; the configuration guide in `docs/source/` stays
the first.

| file | contents |
| --- | --- |
| `catalog.json` | every option row the vendor shows: tab, group, subgroup, code, order number, designation, the control per column (radio, checkbox, quantity), whether the path B column is a placeholder |
| `rules.json` | for every option, per tab, per baseline configuration, per column: the status icon and the vendor's rule message |
| `rules-summary.txt` | the same, only the non-trivial messages, as text |
| `rf-path-matrix.json` | for each RF path A frequency option: the path B options offered, and the B94L and main-module state |

## Baselines

The vendor reports only the first unmet requirement, so every status icon was
clicked under four configurations and the chains reconstructed across them:

| label | selected |
| --- | --- |
| `default` | R&S®SMW-B1003 + -B13 (what the configurator starts with) |
| `std2` | -B13T + -B2003 + -B10 in path A and in path B |
| `wb2` | -B13XT + -B1044 + -B2044 + -B9 in path A and in path B |
| `hf1` | -B1067 + -B13XT + -B9 in path A |

## Reading the messages

- `X` with "Requires SMW-K511!" – blocked; K511 is the first thing missing.
- `X` with "SMW-K16 in 1st Path is required!" – the path B licence can only be
  ordered once the path A licence is; the vendor enforces that ordering for
  every per-path option.
- `blank` with "... is fundamentally allowed" – nothing blocks it.
- `TICK` – selected in that baseline.
- A `FAIL locator.click` entry is a capture artefact (a hidden placeholder
  cell), not a rule.
- "oder" / "und" / "Pfad" are German for or / and / path; a few messages mix
  languages.

## Presentation

The vendor's order of tabs: Selection · RF Options 1st Path · Baseband ·
RF Options 2. Path · Digital Standards / WinIQSIM2 · External PC Software ·
Other Options and Extras · Service Options · Training. Within a tab, groups
are collapsible; frequency options and phase-noise levels are radio groups,
everything else is a checkbox per path, and a few items are quantity inputs
(GNSS channel packs, waveform packages, 4× fading simulators).
