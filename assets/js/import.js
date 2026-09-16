/**
 * Importing a configuration from a document.
 *
 * A Rohde & Schwarz quotation, order confirmation or configuration list
 * names every item by its order number and its type designation, and the
 * catalog carries both, so a document's text can be read into a selection
 * without guessing: an order number settles an item outright, a type
 * designation settles it where the code is unique (R&S SMW-K200 is three
 * order numbers, so it needs the number), and what matches neither is listed
 * for the reader to look at. The reading is the same for every way in - a
 * PDF's text layer, text pasted from an email, or the line items an AI read
 * off a photographed page - so they all end in the same review table.
 *
 * Nothing here is loaded until it is used: the PDF renderer and the OCR
 * engine come from a CDN on first use, and the AI is the host's, offered
 * only where the host has one (the `sample` capability on claude.ai). A
 * static copy of the page still reads pasted text, shows an uploaded image,
 * and reads it with the OCR engine when it can fetch that.
 */

import { OPTIONS, BASE_UNIT } from './catalog.js';

/* ------------------------------------------------------------- the index */

const BY_ORDER = new Map();
for (const o of OPTIONS) if (!BY_ORDER.has(o.order)) BY_ORDER.set(o.order, o.id);

/* code -> ids; more than one id means the code alone does not settle it */
const BY_CODE = new Map();
for (const o of OPTIONS) {
  if (!o.code) continue;
  if (!BY_CODE.has(o.code)) BY_CODE.set(o.code, []);
  BY_CODE.get(o.code).push(o.id);
}

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* Longest first, so "B1044O" is not read as "B1044" followed by an O. */
const CODE_ALT = [...BY_CODE.keys()].sort((a, b) => b.length - a.length).map(escapeRe).join('|');

/* "R&S SMW-K144", "R&S®SMW-K144", "SMW-K144", "SMW - K144", "K144", "ZZA-KN4B" */
const CODE_RE = new RegExp(
  `(?<![A-Z0-9-])(?:R\\s*&\\s*S\\s*\\u00ae?\\s*)?(?:SMW\\s*-?\\s*)?(${CODE_ALT})(?![A-Z0-9])`, 'gi');

/* 1428.4700.02 - also with the dots spaced out or replaced, as a PDF's text
   layer or a reader's transcription may print them */
const ORDER_RE = /(?<!\d)(\d{4})(?:\s*[.·․]\s*|\s+)(\d{4})(?:\s*[.·․]\s*|\s+)(\d{2})(?!\d)/g;

const NAME_RE = /(?:quotation|quote|offer|angebot|order confirmation|auftragsbestätigung|proposal)\s*(?:no\.?|nr\.?|number|#)?\s*[:#]?\s*([A-Z0-9][A-Z0-9\-\/.]{3,})/i;

/* ------------------------------------------------------------ one line */

/* What may stand before a quantity's digit: not another digit or a decimal
   mark (a price), and not a letter - "DVB-S2X" is a designation, not two of
   something. */
const QTY_LOCAL_BEFORE = /(?<![\dA-Za-z.,\/-])(\d{1,3})\s*[x×]\s*$/i;
const QTY_LOCAL_AFTER = /^\s*(\d{1,3})\s*(?:pcs?|pieces?|units?|ea|st(?:k|ück)?)\b/i;
const QTY_EXPLICIT = /\b(?:qty|quantity|menge|anzahl)\.?\s*[:#]?\s*(\d{1,3})\b/i;
const QTY_COLUMNS = /^\s*(\d{1,3})\s+(\d{1,3})\s+(?=#|\S)/;
const QTY_AFTER_ORDER = /#+\s+(\d{1,3})\b(?![.,]\d)/;

/**
 * What one line of a document says: the items on it - order numbers and type
 * codes, in order of appearance, each with its own quantity - and, for a
 * line that carries one item, the quantity read from the line as a whole.
 *
 * A quantity next to an item belongs to that item alone: "2 x R&S SMW-B10"
 * in a summary sentence raises B10, not the options named beside it. A line
 * with one item also takes "Qty: 2", the second of two leading columns (an
 * R&S quotation prints position and quantity before the type), or the
 * integer right after the order number (a distributor prints part number,
 * quantity, price). Everything else is 1; the review table lets the reader
 * correct it.
 *
 * A type code with no "R&S" or "SMW-" in front of it counts only when it is
 * four characters or more: "B15 2TT" is a postcode, "Hall B13" a venue.
 */
export function readLine (raw) {
  const line = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!line) return null;

  const spans = [];
  for (const m of line.matchAll(ORDER_RE)) {
    spans.push({ kind: 'order', value: `${m[1]}.${m[2]}.${m[3]}`, start: m.index, end: m.index + m[0].length });
  }
  for (const m of line.matchAll(CODE_RE)) {
    const start = m.index, end = m.index + m[0].length;
    if (spans.some(x => start < x.end && end > x.start)) continue;
    const exact = [...BY_CODE.keys()].find(k => k.toLowerCase() === m[1].toLowerCase());
    if (!exact) continue;
    const prefixed = /^(?:R\s*&|SMW)/i.test(m[0]);
    if (!prefixed && exact.length < 4) continue;
    spans.push({ kind: 'code', value: exact, start, end });
  }
  spans.sort((a, b) => a.start - b.start);
  if (!spans.length) return { line, orders: [], codes: [], qty: 1, items: [] };

  /* the items blanked out, same length, so positions still hold */
  let rest = line;
  for (const x of spans) rest = rest.slice(0, x.start) + '#'.repeat(x.end - x.start) + rest.slice(x.end);

  const local = x => {
    const before = rest.slice(0, x.start).replace(/[\s#]+$/, '');
    let m = before.match(QTY_LOCAL_BEFORE);
    if (m) return +m[1];
    const after = rest.slice(x.end);
    m = after.match(QTY_LOCAL_AFTER);
    return m ? +m[1] : 0;
  };
  const items = spans.map(x => ({ kind: x.kind, value: x.value, qty: local(x) }));

  /* one item on the line: the line's own quantity forms apply */
  const orders = items.filter(i => i.kind === 'order');
  const single = orders.length === 1 ? orders[0] : (!orders.length && items.length === 1 ? items[0] : null);
  let qty = 1;
  if (single) {
    let m;
    if ((m = rest.match(QTY_EXPLICIT))) qty = +m[1];
    else if (single.qty) qty = single.qty;
    else if ((m = rest.match(QTY_COLUMNS))) qty = +m[2];
    else if (orders.length && (m = rest.match(QTY_AFTER_ORDER))) qty = +m[1];
    if (!(qty >= 1 && qty <= 999)) qty = 1;
    for (const it of items) if (it.kind === single.kind && it.value === single.value) it.qty = qty;
  }
  for (const it of items) if (!(it.qty >= 1 && it.qty <= 999)) it.qty = 1;

  return {
    line,
    orders: orders.map(i => i.value),
    codes: items.filter(i => i.kind === 'code').map(i => i.value),
    qty: single ? qty : (items[0]?.qty || 1),
    items
  };
}

/* ------------------------------------------------------- the document */

/**
 * Reads a document's text into `{items, unknown, base, name}`: items are
 * `{id, qty, via, line}`; unknown holds lines that name something the
 * catalog does not carry, with a word on why; base says whether the base
 * unit was on the document.
 *
 * A line with an order number is settled by that number, right or wrong: a
 * number the catalog lacks is listed, and the type code beside it is not
 * taken instead - a timed licence printed with the perpetual option's code
 * must not import as the perpetual option. Codes alone settle a line only
 * where the code maps to one option.
 *
 * An option named on several lines is one item: the line that carries its
 * order number has the say on the quantity; among lines that only name the
 * code, the largest quantity stands. A quotation that repeats its items in
 * a summary, or a guide that mentions an option in every rule, is
 * describing it again, not ordering it again.
 */
export function readText (text) {
  const items = new Map();
  const unknown = [];
  let base = false;
  const add = (id, qty, via, line) => {
    const cur = items.get(id);
    if (!cur) { items.set(id, { id, qty, via, line }); return; }
    if (via === 'order' && cur.via !== 'order') { Object.assign(cur, { qty, via, line }); return; }
    if (via === 'code' && cur.via === 'order') return;
    if (qty > cur.qty) { cur.qty = qty; cur.line = line; }
  };

  for (const raw of String(text || '').split(/\r?\n/)) {
    const r = readLine(raw);
    if (!r || !r.items.length) continue;
    const orders = r.items.filter(i => i.kind === 'order');
    if (orders.length) {
      for (const it of orders) {
        if (it.value === BASE_UNIT.order) { base = true; continue; }
        const id = BY_ORDER.get(it.value);
        if (id) add(id, it.qty, 'order', r.line);
        else unknown.push({ line: r.line, order: it.value, why: `order number ${it.value} is not in the catalog` });
      }
      continue;
    }
    for (const it of r.items) {
      const ids = BY_CODE.get(it.value) || [];
      if (ids.length === 1) add(ids[0], it.qty, 'code', r.line);
      else if (ids.length > 1) {
        unknown.push({ line: r.line, code: it.value, why: `${it.value} covers ${ids.length} order numbers; the number is needed to tell them apart` });
      }
    }
  }
  const name = (String(text || '').match(NAME_RE) || [])[1] || null;
  return { items: [...items.values()], unknown, base, name: name ? name.replace(/[.,;:]+$/, '') : null };
}

/* ---------------------------------------------------------- from an AI */

/** What the host's AI is asked when it looks at the pages. */
export const AI_PROMPT =
  'The attached image(s) show a Rohde & Schwarz document - a quotation, order confirmation or ' +
  'configuration list - for an R&S SMW200A vector signal generator. Read every line item on them. ' +
  'Reply with only a JSON array of objects, one per line item, in document order: ' +
  '{"type": the type designation as printed (for example "R&S SMW-K144") or null, ' +
  '"order": the order number as printed, ten digits in the form dddd.dddd.dd, copied digit for digit, or null, ' +
  '"qty": the quantity as a number (1 if none is printed), ' +
  '"designation": the description text or null}. ' +
  'Include the base unit if it is listed. Do not add items that are not printed. ' +
  'Example: [{"type":"R&S SMW-B1003","order":"1428.4700.02","qty":1,"designation":"100 kHz to 3 GHz"}]';

/**
 * Turns what the AI returned into text and reads it like any other document,
 * so the same rules settle what it is. Anything that is not an array of
 * objects reads as an empty document.
 */
export function readAI (items) {
  if (!Array.isArray(items)) return readText('');
  const lines = items.filter(x => x && typeof x === 'object').map(x => {
    const qty = Number(x.qty);
    return `Qty: ${qty >= 1 ? Math.round(qty) : 1} ${x.type || ''} ${x.order || ''} ${x.designation || ''}`;
  });
  return readText(lines.join('\n'));
}

/* --------------------------------------------------- where the files are */

/* Same-origin copies of the third-party files, when the page was published
   with them (tools/fetch-vendor.mjs): a host may let a script in from a CDN
   and still block a worker's fetch from one - the OCR language data is
   fetched, not scripted - and its own origin is quicker besides. Looked for
   once, next to the page; a static copy of the page has none and uses the
   CDN. */
let vendorPromise = null;
export function vendorBase () {
  if (!vendorPromise) {
    vendorPromise = (async () => {
      if (typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return null;
      const base = new URL('vendor/', location.href).href;
      try {
        const r = await fetch(base + 'manifest.json', { cache: 'force-cache' });
        if (!r.ok) return null;
        const m = await r.json();
        return m && m.tesseract && m.pdfjs ? base : null;
      } catch { return null; }
    })();
  }
  return vendorPromise;
}

/* ----------------------------------------------------------------- PDFs */

const PDFJS = {
  lib: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs',
  worker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs'
};

let pdfjs = null;

/** The renderer, from the host if it has one, else the page's own copy, else the CDN. */
export async function loadPdfJs () {
  if (globalThis.pdfjsLib) return globalThis.pdfjsLib;
  if (!pdfjs) {
    pdfjs = (async () => {
      const base = await vendorBase();
      const paths = base ? { lib: base + 'pdfjs/pdf.min.mjs', worker: base + 'pdfjs/pdf.worker.min.mjs' } : PDFJS;
      const lib = await import(/* @vite-ignore */ paths.lib);
      lib.GlobalWorkerOptions.workerSrc = paths.worker;
      return lib;
    })().catch(err => { pdfjs = null; throw err; });
  }
  return pdfjs;
}

/**
 * The lines of text on a page, from the renderer's positioned runs: runs on
 * the same baseline form a line, left to right, with a space only where the
 * runs stand apart - a quotation's columns come out as one line each.
 */
export function textLines (runs) {
  const placed = runs
    .filter(r => r && typeof r.str === 'string' && r.str.trim() && Array.isArray(r.transform))
    .map(r => ({ str: r.str, x: r.transform[4], y: r.transform[5], w: r.width || 0, h: r.height || 0 }))
    .sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const lines = [];
  let cur = null;
  for (const r of placed) {
    const tol = Math.max(2, (r.h || 8) * 0.5);
    if (!cur || Math.abs(cur.y - r.y) > tol) { cur = { y: r.y, runs: [r] }; lines.push(cur); }
    else cur.runs.push(r);
  }
  return lines.map(l => {
    l.runs.sort((a, b) => a.x - b.x);
    let out = '';
    let end = null;
    for (const r of l.runs) {
      if (end !== null && r.x - end > 1) out += ' ';
      out += r.str;
      end = r.x + r.w;
    }
    return out.replace(/\s+/g, ' ').trim();
  }).filter(Boolean);
}

/**
 * Reads a PDF: the text lines of every page, and a rendering of the first
 * `render` pages for the preview and for the AI. Text is cheap and a
 * quotation's tables may sit at the end of a long document, so no page's text
 * is skipped; rendering is the slow part, so it stops at `render` pages.
 * `data` is the file's bytes.
 */
export async function readPdf (data, { render = 20, scale = 1.4, maxPages = 400 } = {}) {
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data }).promise;
  const count = doc.numPages;
  const pages = [];
  for (let n = 1; n <= Math.min(count, maxPages); n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    const lines = textLines(content.items || []);
    let canvas = null;
    if (n <= render && typeof document !== 'undefined') {
      const viewport = page.getViewport({ scale });
      canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    }
    pages.push({ n, lines, canvas });
  }
  return {
    count,
    pages,
    text: pages.map(p => p.lines.join('\n')).join('\n'),
    rendered: Math.min(count, render),
    truncated: count > maxPages
  };
}

/** A page's rendering as an image file the AI accepts. */
export const canvasToBlob = (canvas, type = 'image/png') =>
  new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('no image'))), type));

/* ------------------------------------------------------------------ OCR */

const TESSERACT = {
  lib: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js',
  worker: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
  core: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
  lang: 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int'
};

let tesseract = null;

/** Where the engine's files are: the page's own copies when published with it, else the CDN. */
async function tesseractPaths () {
  const base = await vendorBase();
  /* The engine asks for <langPath>/eng.traineddata.gz. A host that serves
     files by extension may not serve .gz, so the copy carries a served name
     and the path ends in a fragment: the fetch drops what follows it, and the
     engine tells gzip by the first bytes, not by the name. */
  return base
    ? { lib: base + 'tesseract/tesseract.esm.min.js', worker: base + 'tesseract/worker.min.js',
        core: base + 'tesseract', lang: base + 'tesseract/eng.traineddata.gz.txt#' }
    : TESSERACT;
}

/** The OCR engine, from the host if it has one, else the page's own copy, else the CDN. */
export async function loadTesseract () {
  if (globalThis.Tesseract) return globalThis.Tesseract;
  if (!tesseract) {
    tesseract = tesseractPaths()
      .then(paths => import(/* @vite-ignore */ paths.lib))
      .then(m => m.default || m)
      .catch(err => { tesseract = null; throw err; });
  }
  return tesseract;
}

/**
 * What OCR gets wrong in the tokens that matter: a 0 read as O, a 1 as I
 * or l, a 5 as S, inside an order number or the digits of a type code,
 * and a comma for the dot between the groups. Prose is left alone.
 */
export function normalizeOcr (text) {
  const digits = s => s.replace(/[Oo]/g, '0').replace(/[Il|]/g, '1').replace(/S/g, '5');
  return String(text || '')
    .replace(/\b([0-9OoIl|S]{4})\s?[.,\u00b7]\s?([0-9OoIl|S]{4})\s?[.,\u00b7]\s?([0-9OoIl|S]{2})\b/g,
      (m, a, b, c) => `${digits(a)}.${digits(b)}.${digits(c)}`)
    .replace(/\b([BK])([0-9OoIl|S]{1,4})([A-Z]{0,2})\b/g, (m, k, d, suf) => k + digits(d) + suf);
}

/* A photographed page reads best at about 300 dpi; a screenshot's 10 px
   type does not. Small sources are drawn larger before they are read. */
async function enlarge (source, minWidth = 1800, maxWidth = 4000) {
  if (typeof document === 'undefined') return source;
  const bitmap = source instanceof HTMLCanvasElement ? source : await createImageBitmap(source);
  const scale = Math.min(maxWidth / bitmap.width, Math.max(1, minWidth / bitmap.width));
  if (scale <= 1.01) return source;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

const fail = code => Object.assign(new Error(code), { code });

/* One worker serves every read on the page: starting it is the slow part -
   the engine and the language data, several megabytes on first use, then
   from the browser's cache - and a second picture should not pay it again.
   `listeners` lets whoever is waiting see the stages. */
let workerPromise = null;
const listeners = new Set();
const report = m => { for (const fn of listeners) fn(m); };

/** Forgets a running engine; the next read starts one. Kills it if it is up. */
export function resetOcr () {
  const gone = workerPromise;
  workerPromise = null;
  if (gone) gone.then(w => w.terminate()).catch(() => {});
}

/**
 * Starts the OCR engine, or hands back the one already running. `onProgress`
 * hears the engine's stages ({status, progress}); `timeoutMs` bounds the
 * start, since a viewer that blocks a piece of it would otherwise wait for
 * ever. Cheap to call ahead of time where the engine is the only reader.
 */
export function warmOcr ({ onProgress, timeoutMs = 60000 } = {}) {
  if (onProgress) listeners.add(onProgress);
  if (!workerPromise) {
    workerPromise = (async () => {
      const T = await loadTesseract();
      const paths = await tesseractPaths();
      const worker = await T.createWorker('eng', 1, {
        workerPath: paths.worker, corePath: paths.core, langPath: paths.lang,
        logger: report
      });
      return worker;
    })().catch(err => { workerPromise = null; throw err; });
  }
  const pending = workerPromise;
  let timer;
  const late = new Promise((_, reject) => { timer = setTimeout(() => reject(fail('timeout')), timeoutMs); });
  return Promise.race([pending, late])
    .catch(err => {
      // a start that took too long is given up on: the next call begins afresh
      if (err?.code === 'timeout' && workerPromise === pending) workerPromise = null;
      throw err;
    })
    .finally(() => { clearTimeout(timer); if (onProgress) listeners.delete(onProgress); });
}

/**
 * Reads the text off an image - a File, a Blob or a canvas - in the page.
 * `onProgress` hears the stages, `signal` stops it. Resolves the text with
 * the OCR slips in numbers and codes put right.
 */
export async function ocrImage (source, { onProgress, signal, timeoutMs } = {}) {
  /* Stop has to answer at once in every phase, and neither the engine's
     start nor a read in progress settles on its own when told to - so both
     are raced against the signal. A start that is stopped goes on in the
     background and serves the next read; a read that is stopped is killed. */
  const cancelled = new Promise((_, reject) => {
    if (signal?.aborted) return reject(fail('cancelled'));
    signal?.addEventListener('abort', () => reject(fail('cancelled')), { once: true });
  });
  cancelled.catch(() => {});
  const worker = await Promise.race([warmOcr({ onProgress, timeoutMs }), cancelled]);
  const stop = () => { workerPromise = null; worker.terminate().catch(() => {}); };
  signal?.addEventListener('abort', stop, { once: true });
  if (onProgress) listeners.add(onProgress);
  try {
    const { data } = await Promise.race([worker.recognize(await enlarge(source)), cancelled]);
    return normalizeOcr(data?.text || '');
  } catch (err) {
    if (signal?.aborted) throw fail('cancelled');
    stop();                       // a failed read: the next one starts afresh
    throw err;
  } finally {
    signal?.removeEventListener('abort', stop);
    if (onProgress) listeners.delete(onProgress);
  }
}
