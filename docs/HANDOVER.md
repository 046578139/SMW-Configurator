# Handover

Everything needed to pick this project up in a fresh container. The
[README](../README.md) says what the configurator *is* and how it is built;
this file is about continuing the work — where things stand, what is still
open, and the container-level details that cost time to rediscover.

## Coordinates

| | |
| --- | --- |
| Repository | `https://github.com/046578139/SMW-Configurator` (public) |
| Branch | `claude/continue-previous-session-lcfkeo` (this container's work); `claude/smw-online-configurator-hahn6b` is the repository's **default** branch and where the earlier work lives |
| Everything is pushed | there is no work living only in a container |
| Live preview | https://claude.ai/code/artifact/1134486f-4b7b-4a82-b005-dbe8b2385636 |

There is no `main`. The default branch is what GitHub Pages would publish;
the continuation branch has to be merged into it (or opened as a pull request)
for that to happen.

## Starting up

```sh
git clone https://github.com/046578139/SMW-Configurator
cd SMW-Configurator
python3 -m http.server 8000        # then open http://localhost:8000
```

That is the whole setup for the site. It has no dependencies and no build step
— plain HTML, CSS and ES modules. The only thing `npm install` brings is
Playwright, and only the browser suites need it.

## Checking it still works

Run these four in order. Expected output is written next to each; anything else
is a regression, not a fresh-container quirk.

```sh
node --test                        # 123 pass, 0 fail
npm install                        # Playwright, ~1 dependency
node tests/browser/run.mjs         # 14 of 14 suites passed, 113 checks
node tools/build-standalone.mjs    # dist/smw200a-configurator.html  480 kB
```

`node --test` covers the rules engine, the panel drawings, the frequency scale,
the photo overlay geometry, the rules adopted from the vendor comparison, the
saved-configurations store against a stand-in for the artifact's document
store, and the document reader behind Import. The browser suites cover what a
unit test cannot see: labels overlapping in a drawing, a sandboxed frame still
being able to clear a configuration, the standalone build running from
`file://` with no network at all, and the Save / Saved / Import dialogs with
stand-ins for the host's AI and the PDF renderer. They start their own static server on port 8899 — nothing to
launch first, except `tools/build-standalone.mjs` before the `standalone`
suite, which reads `dist/`.

If Chromium is not where Playwright looks, point `SMW_BROWSER` at it. The
suites also honour `SMW_BASE`, `SMW_ROOT` and `SMW_OUT` (see
`tests/browser/_env.mjs`).

## Where the work stands

253 options and 23 accessories across 13 sections, every rule from the configuration guide plus
the rules the vendor's own configurator enforces beyond it, 8 validated
starting points, two views of the instrument (photograph with a configuration
overlay, and a schematic that matches any configuration exactly), a frequency
scale, a signal-chain diagram, CSV/JSON/print export, and a single-file build.

The vendor's online configurator has been captured (`docs/vendor/`, tooling
in `tools/vendor/`) and compared with the catalog option by option. The RF
path matrix, the O-variant rules, the deeper chassis and the phase-noise
pairing matched. Twenty rule mismatches and fourteen missing options were
found and fixed, then the whole set was re-checked against the primary
documents, which reversed two of the decisions and sharpened three more;
`docs/vendor/README.md` lists what was adopted from the vendor, what came
from the GNSS specifications, what was kept against the vendor, and why.
`tests/vendor.test.mjs` pins every adopted rule to the source that decided
it, and `tests/browser/interface.mjs` covers the quantity controls.

26 defects had been found and fixed before that comparison — 4 reported by
you, 22 found by review. The ones worth knowing about because they shaped the
code:

- **`BY_ID` has a null prototype.** With a normal object, `BY_ID['valueOf']`
  is truthy, so a crafted URL hash could brick the page *and* persist through
  storage. Keep `Object.create(null)` if you touch `catalog.js`.
- **The standalone build guards itself.** A `<link>` regex that stopped at the
  first `>` was truncating the stylesheet tag at a `>` inside a data-URI SVG,
  so every standalone build had been silently unstyled. The builder now uses a
  quote-aware tag scanner and refuses to emit a page whose stylesheet did not
  survive, or one that still references `assets/img/`.
- **Sandboxed frames ignore `confirm`, `alert` and `prompt`**, and block
  downloads. That is why Reset uses an in-page dialog, the share fallback shows
  a text field, and export goes through a save API where the host offers one.
  Do not reintroduce a native dialog.
- **`autoResolve` needs both the recursive lookahead and the fixed-point
  loop.** Removing the lookahead cut resolution from 267 configurations to 133,
  and nothing failed — measure before and after if you change it.
- **A red test is not automatically a real defect.** More than once here the
  test was wrong and the code was right. Reproduce first.
- **The vendor shows only the first unmet requirement.** A message such as
  "Requires SMW-K511!" says nothing about what K511 itself needs; the harvest
  used four baseline configurations to see the chains, and a few questions
  still had to be settled by selecting options interactively
  (`tools/vendor/README.md`). The vendor's "K553 not possible with B1003,
  B1006 or higher required" was misread by one audit pass as excluding B1006 —
  an interactive check showed B1006 is fine, and the 6 GHz floor stayed.
- **The vendor is not automatically right where the guide is explicit.** It
  refuses R&S®SMW-K108 and ‑K109 without a wideband generator; the guide and
  the GNSS option table both list them for R&S®SMW-B10, so following the
  vendor there rejected configurations two paper sources allow. The rule of
  thumb that came out of it: adopt a vendor-only rule when a second document
  supports it or the guide is silent, and read the GNSS option table
  (PD 3607.6896.22, page 7) before deciding anything about a GNSS option —
  it settles the wideband question for every one of them.
- **A quantity a rule excludes must not be offered.** R&S®SMW-B15 comes in
  0, 2 or 4 units once two generators are installed, so the stepper has to
  drop 1 rather than let the first click raise an error. `qtyStepsNot` in
  `catalog.js` expresses that, and the card's invalid flag now reads the same
  list the stepper does.
- **Accessories are options without rules, not a separate list.** They were
  once inert cards with their own renderer, which meant no tick, no quantity,
  no place on the parts list and no URL. Folding them into `OPTIONS` (section
  `extras`, `accessory: true`, no `requires`) gave them all of that for free.
  What did need care is the name: the sources' type column gives some of
  them a designation of their own (R&S®ZZA-KN4 in the guide, ZZA-KN4B in
  the specifications and at the vendor; R&S®DCV-2; one R&S®ACASMW200A
  shared by all four accredited calibrations; R&S®DCV-ZP and the connector
  code RPC2.9-1.8 only at the vendor) and none at all to the digital I/Q
  cables, the spare SSD and the other test port adapters, which every source
  lists by order number alone. `code` on every option and `typeName()` in
  `catalog.js` carry that; `productCode()` would have printed "ADP" for
  3628.4728.02 and "R&S®SMW-BBCABLE" for a cable. The first pass got
  DCV-ZP wrong because the vendor capture's `code` field is blank for every
  R&S®-prefixed row - a regex artefact in `tools/vendor/lib.py`, not
  evidence; the vendor's type column is `texts[0]` in
  `docs/vendor/catalog.json`.
- **Import reads by order number first.** `import.js` matches a document's
  lines against the catalog: an order number settles an item (every order
  number in the catalog is unique, and a test keeps it so), a type
  designation settles it where the code maps to one option (R&S®SMW-K200
  and R&S®ACASMW200A do not, so those lines are listed as needing the
  number), and the quantity comes from "2 x", "2 pcs", "Qty: 2" or the
  second of two leading columns (an R&S quotation prints position, then
  quantity). Pasted text, a PDF's text layer (pdf.js 4.10.38 from cdnjs,
  loaded on first use; `window.pdfjsLib` is used instead when a host or a
  test provides one) and what the AI transcribes off an image all go through
  the same `readText()`, so one set of rules and tests covers every way in.
  Pictures are read in the page by Tesseract.js 5.1.1 (ESM build, worker and
  wasm core from jsdelivr, English data from `@tesseract.js-data/eng`,
  fetched on first use, about 7 MB); small sources are drawn up to 1800 px
  wide first, and `normalizeOcr()` puts O/0, I/1, S/5 and comma-for-dot
  slips right inside order numbers and code digits only. Starting the engine
  is the slow part (the 4 MB core and 3 MB language data, once per browser
  cache), so `warmOcr()` starts it ahead of the click where it is the only
  reader (no `window.claude`), the status line shows each stage the engine
  reports, one worker is kept for every read on the page, and a start that
  takes over a minute fails with `timeout` and a pointer to the other ways
  in - a viewer that blocks blob workers or cross-origin fetches would
  otherwise wait for ever. Which is what happened on claude.ai: the engine's
  core (a script) came in from the CDN, the language data (a fetch from
  inside the worker) never did, so `tools/fetch-vendor.mjs` downloads the
  engine, its language data and the PDF renderer into `dist/vendor/` (or
  `vendor/` for Pages), the artifact is published with them as supporting
  files, and `vendorBase()` in `import.js` looks for `vendor/manifest.json`
  beside the page once and prefers those same-origin copies. Quantities are
  per item: "2 x" applies to the code it precedes, an order line's quantity
  outranks a code mention, an explicit "Qty:" outranks everything, a
  designation never reads as one (a test prints every catalog option as a
  quotation line), a short code with no prefix is an address, and a line
  whose order number the catalog lacks is listed rather than read by its
  code – a timed licence must not import as the perpetual option. The AI is the
  `sample` capability: consent is per call and costs the viewer, so it runs
  only from the Scan button and can be stopped; images go as blobs, so PDF
  pages are rendered to PNG first, up to `limits().images.maxCount` per
  call. The Scan button is offered whenever the host resolves `sample`, and
  the status line names what is missing when it does not (the first cut hid
  it on a missing `limits()`, which left an image with no reading path).
  Real-world checks, both through the CDN in Chromium with the proxy flags
  from "Container notes": importing the configuration guide PDF itself reads
  all 28 pages and 252 options; a synthetic distributor quotation screenshot
  (item, description, model, part number, quantity, price) reads all 13
  options with their quantities in 6 s (`/tmp` scripts in the session, not
  kept: build a page with Playwright, screenshot it, upload the PNG).
  Quantities come from five layouts: "2 x", "2 pcs", "Qty: 2", position then
  quantity before the type (R&S), and the integer right after the order
  number (distributors); a price never reads as one because it carries a
  decimal part.
- **Saved configurations live in two layers.** `saved.js` keeps the named
  list in localStorage always and, when the page runs on claude.ai with the
  `db` capability declared, in the artifact's shared document store
  (collection `configs`) that every viewer of the page sees. The hosted list
  is the record and the local one its cache; only entries never uploaded
  (`origin: 'local'`) are sent up on connect, so a stale cache cannot bring
  back what someone else removed. Declaring `db` makes the artifact
  organization-internal, and a non-empty `capabilities` on republish must
  restate `downloads` (it is a full-set declaration).
- **`humanReq()` in `catalog.js` mangled every generated requirement text**
  ("R and S®SMW-R and S®SMW-B9") because it inserted "R&S®" before turning the
  "&" operator into a word. Nothing displayed it, so nobody noticed; it is
  fixed and tested now.

## Open items

Roughly in the order worth doing.

1. **Review the photo overlay.** `assets/js/photo.js` is the least-reviewed
   file — it came last and did not go through the review pass the rest did. Its
   overlay coordinates were measured against a grid drawn over the photographs
   at 1280×720; if the images in `assets/img/` are ever replaced, every
   coordinate in `FRONT`, `REAR` and `REAR_BAYS` has to be re-measured.
2. **Decide about ADV DATA/CTRL, ADV TRIG, ADV CLK and 1 GHz IN.** These
   connectors are plainly visible on the rear photograph but appear in no
   specification table, so the schematic deliberately does not draw them. Either
   find a source that pins them to an option, or draw them as always-present
   chassis connectors and say so.
3. **Enable GitHub Pages.** The workflow in `.github/workflows/pages.yml` is
   ready and publishes on pushes to the default branch, but Pages is not turned
   on for the repository yet (`has_pages: false`). Settings → Pages → Source:
   **GitHub Actions**. Nothing else is needed. The continuation branch also has
   to reach the default branch first (merge or pull request).
4. **Vendor questions that only R&S can answer.** Where the guide and the
   vendor disagree and neither source is obviously right, the guide was kept:
   K548 (vendor: once per instrument), K134's base-standard list, K122 and
   K97, the GNSS once-only options (K108, K109, K122, K129, K360–K363) for
   which the vendor shows a path B column, and K315's path B column. A sales
   contact could settle them in a minute; `docs/vendor/README.md` has the
   list.
5. **Five options are newer than the guide**, and now nineteen. R&S®SMW-K508,
   ‑K554, ‑K556, ‑K573 and ‑K575 come from the specifications; K180–K185,
   K480–K485, K111 and K363 from the vendor configurator, with the vendor's
   rules. No configuration guide newer than v06.00 was published as of
   2026-09-02 (the product page links v06.00); when one appears, check those
   nineteen against it. Re-capturing the vendor site takes about half an hour
   with `tools/vendor/` and would show whether its rules moved.
6. **Licence variants.** The vendor quotes portable and timed (1, 3, 6, 12
   month) licences for every software option and pre-selects a 3-month trial
   licence (T0). Only permanent licences are modelled; T0 is listed as an
   accessory.

## Container notes

Small things that cost time in the last two containers.

- **Chromium cannot do TLS through the agent proxy as shipped.** In a cloud
  container every HTTPS request from Playwright's Chromium died with
  `ERR_CONNECTION_RESET` while `curl` and Node worked, whatever proxy settings
  it was given. The proxy status endpoint showed the tunnel closing after a
  ~1.8 kB client hello and 39 bytes back: the upstream rejects Chromium's
  TLS 1.3 post-quantum key share. Launch with
  `--disable-features=PostQuantumKyber,UseMLKEM,EncryptedClientHello
  --ssl-version-max=tls1.2` and it connects normally (see
  `tools/vendor/driver.mjs`). The browser suites never noticed because they
  only talk to localhost.
- **The vendor configurator's entry URL** is on the product page, not the
  one the browser shows afterwards:
  `https://configurator.rohde-schwarz.com/app/ch5c/ch5start?-AppName%3Ddefault+-configknb%3Dconfig.SMW200A`.
  `/app/ch5c/Run` returns 404. `tools/vendor/README.md` explains how the app
  works and how to re-capture it.
- **Uploaded PDFs land in `/root/.claude/uploads/`.** Attached *images* do not
  — they arrive in the conversation only, so anything to keep has to be written
  out or committed. The nine source PDFs and the four product photographs are
  both in the repository (`docs/source/`, `docs/photos/`), so nothing has to be
  re-uploaded.
- **`pypdf` needs a stubbed `cryptography` module** in these images — the real
  one is broken and importing it fails before `pypdf` gets a chance. A stub
  package on `sys.path` (an empty `cryptography/__init__.py`) is enough for
  text extraction; `pip install pypdf` first. `Pillow` is not installed by
  default; `pip install pillow` if you need to touch images.
- **Chromium is preinstalled** at `/opt/pw-browsers/chromium` with
  `PLAYWRIGHT_BROWSERS_PATH` and `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` already
  set. Run `npm install` as normal — do not run `playwright install`. The
  suites use the preinstalled binary when it exists and fall back to whatever
  Playwright downloaded when it does not.
- **Artifact watch subscriptions are refused from a remote session.** The
  preview link above can be republished but not watched, so a republish from
  elsewhere will not wake the session.

## Picking up

A prompt that gets a new session oriented in one turn:

> This repository is an SMW200A configurator; read `docs/HANDOVER.md` and
> `README.md` first. Confirm the four checks under "Checking it still works"
> all pass, then start on open item 1. Work on the branch
> `claude/continue-previous-session-lcfkeo` (or merge it into the default
> branch `claude/smw-online-configurator-hahn6b` first if GitHub Pages should
> publish it).
