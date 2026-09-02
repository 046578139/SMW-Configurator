# Capturing the vendor's configurator

The scripts in this directory drive Rohde & Schwarz's own SMW200A configurator
(https://configurator.rohde-schwarz.com, a camos HTML5 client) in a headless
Chromium and write what it shows into `docs/vendor/`. They exist so the
comparison can be repeated when the vendor updates the knowledge base.

The entry URL comes from the SMW200A product page:

```
https://configurator.rohde-schwarz.com/app/ch5c/ch5start?-AppName%3Ddefault+-configknb%3Dconfig.SMW200A
```

(`/app/ch5c/Run`, the URL the browser shows afterwards, is not an entry point
and returns 404.)

## How the app works, in brief

The page is a thin client: `cH5C/Start` opens a server session, the server
sends UI opcodes over `cH5C/HRQ` (plain HTTP POST, no WebSocket), and the
client builds a shadow DOM of generated `div`s and `img`s. There is no
HTML to scrape offline - the browser has to be driven.

Every option row carries a status image and a control image:

| image | meaning |
| --- | --- |
| green tick | selected and valid |
| blank | allowed, not selected |
| grey X | blocked - clicking it opens the vendor's message with the first unmet requirement |
| red X | selected but invalid |
| square / ticked square | checkbox off / on |
| circle / dotted circle | radio off / on |

Per-path options have a **Path A** and a **Path B** column; a hidden
`Dummy_Kxxx` label in column B means the option is ordered once per
instrument. Clicking a status icon is what `harvest.py` does for every option
under several baseline configurations.

## Running it

```sh
npm install                                   # Playwright
cd tools/vendor
PORT=8765 OUTDIR=out node driver.mjs &        # persistent browser, JSON commands on 127.0.0.1:8765
./cmd.sh 8765 '{"op":"click","id":"e66"}'     # open the SMW200A base unit from the selection page
python3 capture-tabs.py 8765 out              # every tab expanded -> out/tab*.rows.json + screenshots
python3 normalize.py out ../../docs/vendor/catalog.json
python3 harvest.py 8765 harvest default       # click every status icon -> harvest/default-tab*.json
python3 setup_baseline.py 8765 'Baseband|SMW-B13T|0' 'RF Options 2. Path|SMW-B2003|0' 'Baseband|SMW-B10|0' 'Baseband|SMW-B10|1'
python3 harvest.py 8765 harvest std2
python3 aggregate.py harvest ../../docs/vendor/rules.json > ../../docs/vendor/rules-summary.txt
python3 rfmatrix.py 8765 ../../docs/vendor/rf-path-matrix.json
./cmd.sh 8765 '{"op":"quit"}'
```

Several driver instances on different ports run in parallel; each is its own
vendor session, so one instance per baseline is the fastest layout. The
baselines used for the committed data are listed in `docs/vendor/README.md`.

Driver commands (`cmd.sh PORT JSON`): `goto`, `click {id|text}`, `tick {id}`,
`status {id}` (click a status icon, read and close the message box), `rows`
(every visible element grouped into rows with image hashes), `text`, `shot
{name, full}`, `save {name}`, `net`, `eval {js}`, `closeDialogs`, `wait {ms}`,
`quit`.

## Container quirk

In a Claude Code cloud container, outbound HTTPS goes through an agent proxy
that rejects Chromium's TLS 1.3 client hello (the post-quantum key share makes
it ~1.8 kB; the tunnel closes after 39 bytes). `curl` and Node work; Chromium
does not, whatever proxy settings you give it. The fix is in `driver.mjs`:

```
--disable-features=PostQuantumKyber,UseMLKEM,EncryptedClientHello --ssl-version-max=tls1.2
```

With those flags Chromium connects through `HTTPS_PROXY` normally.
