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
  the per-path options of the Baseband and Digital Standards tabs. The RF-tab
  options (K22, K23, K24, K553, K554, K720) are separate rows per path with
  their own prerequisites and no ordering rule. Our quantity model ("2 ×" is
  the path B licence, allowed once the second unit's condition holds) is
  equivalent, so nothing changed for it.
- `blank` with "... is fundamentally allowed" – nothing blocks it.
- `TICK` – selected in that baseline.
- A `FAIL locator.click` entry is a capture artefact (a hidden placeholder
  cell), not a rule.
- "oder" / "und" / "Pfad" are German for or / and / path; a few messages mix
  languages.

## What the comparison changed, and what it did not

Adopted from the vendor (each option's note says so): K553 and K554 are one
licence per RF path with the path's own frequency floor (6 GHz, 20 GHz); B83
accepts B1040N; B82 and B84 accept either path A rear-connector option; K546
needs B90; K544 needs a baseband generator; K75 needs four fading simulators;
B15 comes once with one B9 and never once with two; K143 and K146 both hang on
K115; the K69/K81/K175 second unit counts K55 and K115 together; the waveform
packages are capped by the 250-waveform ceiling rather than by an arbitrary
per-pack number; K980 and K309 got their order numbers; fourteen newer options
were added.

Adopted from the GNSS specifications (PD 3607.6896.22), whose option table
settles what the vendor and the guide disagree about: K122, K123, K128, K129,
K134, K135, the K136-K139 channel packs and the K360-K363 test suites are
listed for the wideband generator only, so they require R&S SMW-B9/-B9F; and
the channel ceiling follows the installed boards, 102 channels each, rather
than a flat number.

Kept against the vendor, with the guide as the primary source: K108 and K109
on the standard generator (the vendor offers them only with B9/B9F, but the
guide and the GNSS option table both list them for B10); K548 twice with two
generators (vendor: once); K134's base-standard list (vendor: shorter); K122
without K97 (vendor: accepts it); K17 once (vendor agrees, the second column
is a placeholder); B93 as an option (vendor: a spare-SSD accessory); K477 and
K253 (not offered online). Two vendor messages contain slips worth knowing:
K441 asks for a non-existent "K257", a transposition of K527, and the K75 rule
in the wideband groups says "4x SMW-B14" where it means B15.

Not modelled: the vendor's portable and timed (1/3/6/12 month) licence
variants, the pre-selected 3-month trial licence T0 (listed as an accessory),
the service and training tabs, and the path-A-first ordering of path B
licences.

## Presentation

The vendor's order of tabs: Selection · RF Options 1st Path · Baseband ·
RF Options 2. Path · Digital Standards / WinIQSIM2 · External PC Software ·
Other Options and Extras · Service Options · Training. Within a tab, groups
are collapsible; frequency options and phase-noise levels are radio groups,
everything else is a checkbox per path, and a few items are quantity inputs
(GNSS channel packs, waveform packages, 4× fading simulators).
