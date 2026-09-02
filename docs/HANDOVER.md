# Handover

Everything needed to pick this project up in a fresh container. The
[README](../README.md) says what the configurator *is* and how it is built;
this file is about continuing the work — where things stand, what is still
open, and the container-level details that cost time to rediscover.

## Coordinates

| | |
| --- | --- |
| Repository | `https://github.com/046578139/SMW-Configurator` (public) |
| Branch | `claude/smw-online-configurator-hahn6b` — also the repository's **default** branch |
| Everything is pushed | there is no work living only in a container |
| Live preview | https://claude.ai/code/artifact/1134486f-4b7b-4a82-b005-dbe8b2385636 |

There is no `main`. The working branch is the default branch, so pushes to it
are what GitHub Pages would publish.

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
node --test                        # 74 pass, 0 fail
npm install                        # Playwright, ~1 dependency
node tests/browser/run.mjs         # 11 of 11 suites passed, 81 checks
node tools/build-standalone.mjs    # dist/smw200a-configurator.html  405 kB
```

`node --test` covers the rules engine, the panel drawings, the frequency scale
and the photo overlay geometry. The browser suites cover what a unit test
cannot see: labels overlapping in a drawing, a sandboxed frame still being able
to clear a configuration, the standalone build running from `file://` with no
network at all. They start their own static server on port 8899 — nothing to
launch first, except `tools/build-standalone.mjs` before the `standalone`
suite, which reads `dist/`.

If Chromium is not where Playwright looks, point `SMW_BROWSER` at it. The
suites also honour `SMW_BASE`, `SMW_ROOT` and `SMW_OUT` (see
`tests/browser/_env.mjs`).

## Where the work stands

239 options across 13 sections, every rule from the configuration guide, 8
validated starting points, two views of the instrument (photograph with a
configuration overlay, and a schematic that matches any configuration exactly),
a frequency scale, a signal-chain diagram, CSV/JSON/print export, and a
single-file build.

26 defects have been found and fixed — 4 reported by you, 22 found by review.
The ones worth knowing about because they shaped the code:

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

## Open items

Roughly in the order worth doing.

1. **Look at the vendor's own configurator** —
   `https://configurator.rohde-schwarz.com/app/ch5c/Run`. You asked twice and
   it was never reachable from the old container. Worth comparing rule
   coverage, option naming and the order in which it presents choices. This is
   the reason for moving containers, so it is first.
2. **Review the photo overlay.** `assets/js/photo.js` is the least-reviewed
   file — it came last and did not go through the review pass the rest did. Its
   overlay coordinates were measured against a grid drawn over the photographs
   at 1280×720; if the images in `assets/img/` are ever replaced, every
   coordinate in `FRONT`, `REAR` and `REAR_BAYS` has to be re-measured.
3. **Decide about ADV DATA/CTRL, ADV TRIG, ADV CLK and 1 GHz IN.** These
   connectors are plainly visible on the rear photograph but appear in no
   specification table, so the schematic deliberately does not draw them. Either
   find a source that pins them to an option, or draw them as always-present
   chassis connectors and say so.
4. **Enable GitHub Pages.** The workflow in `.github/workflows/pages.yml` is
   ready and publishes on pushes to the default branch, but Pages is not turned
   on for the repository yet (`has_pages: false`). Settings → Pages → Source:
   **GitHub Actions**. Nothing else is needed.
5. **Five options are newer than the guide.** R&S®SMW-K508, ‑K554, ‑K556,
   ‑K573 and ‑K575 appear only in the specifications document and are marked
   *newer than guide v06.00* in the interface. If a newer configuration guide
   turns up, their rules should be checked against it.

## Container notes

Small things that cost time in the last container.

- **Uploaded PDFs land in `/root/.claude/uploads/`.** Attached *images* do not
  — they arrive in the conversation only, so anything to keep has to be written
  out or committed. The nine source PDFs and the four product photographs are
  both in the repository (`docs/source/`, `docs/photos/`), so nothing has to be
  re-uploaded.
- **`pypdf` needs a stubbed `cryptography` module** in these images — the real
  one is broken and importing it fails before `pypdf` gets a chance. A stub
  module on `sys.path` is enough for text extraction. `Pillow` is not installed
  by default; `pip install pillow` if you need to touch images.
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
> all pass, then start on open item 1 — compare our rule coverage against
> `https://configurator.rohde-schwarz.com/app/ch5c/Run`, which this container
> should now be able to reach. Work on the branch
> `claude/smw-online-configurator-hahn6b`.
