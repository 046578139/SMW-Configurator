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

/**
 * What one line of a document says: the order numbers and type codes on it
 * and the quantity it carries. Quantity is read from the forms the documents
 * use - "2 x", "2 pcs", "Qty: 2", the second of two leading columns (an R&S
 * quotation prints position and quantity before the type), or the integer
 * right after the order number (a distributor's quotation prints the part
 * number, then the quantity, then the price) - and is 1 where nothing says
 * otherwise. The review table lets the reader correct it.
 */
export function readLine (raw) {
  const line = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!line) return null;

  const orders = [];
  let rest = line.replace(ORDER_RE, (m, a, b, c) => { orders.push(`${a}.${b}.${c}`); return ' # '; });
  const codes = [];
  rest = rest.replace(CODE_RE, (m, code) => {
    const exact = [...BY_CODE.keys()].find(k => k.toLowerCase() === code.toLowerCase());
    if (exact) codes.push(exact);
    return ' # ';
  });
  if (!orders.length && !codes.length) return { line, orders, codes, qty: 1 };

  let qty = 1;
  let m;
  if ((m = rest.match(/(?<![\d.,])(\d{1,3})\s*[x×]\s*(?:#|$)/i))) qty = +m[1];
  else if ((m = rest.match(/(?<![\d.,])(\d{1,3})\s*(?:pcs?|pieces?|units?|ea|st(?:k|ück)?)\b/i))) qty = +m[1];
  else if ((m = rest.match(/\b(?:qty|quantity|menge|anzahl)\.?\s*[:#]?\s*(\d{1,3})\b/i))) qty = +m[1];
  else if ((m = rest.match(/^\s*(\d{1,3})\s+(\d{1,3})\s+#/))) qty = +m[2];
  else if ((m = rest.match(/^\s*(\d{1,3})\s+(\d{1,3})\s/))) qty = +m[2];
  // "... 1413.7350.02 2 87,100.00": the quantity sits after the number, and a
  // price never reads as one - it carries a decimal part
  else if (orders.length && (m = rest.match(/#\s+(\d{1,3})\b(?![.,]\d)/))) qty = +m[1];
  if (!(qty >= 1 && qty <= 999)) qty = 1;
  return { line, orders, codes, qty };
}

/* ------------------------------------------------------- the document */

/**
 * Reads a document's text into `{items, unknown, base, name}`: items are
 * `{id, qty, via, line}`; unknown holds lines that name something the
 * catalog does not carry, with a word on why; base says whether the base
 * unit was on the document.
 *
 * An option named on several lines is one item at the largest quantity
 * seen, not the sum: a quotation that repeats its items in a summary, or a
 * guide that mentions an option in every rule, is describing it again, not
 * ordering it again - two of something is printed as a quantity of two. A
 * line settled by order number outranks one that only names the code.
 */
export function readText (text) {
  const items = new Map();
  const unknown = [];
  let base = false;
  const add = (id, qty, via, line) => {
    const cur = items.get(id);
    if (!cur) { items.set(id, { id, qty, via, line }); return; }
    if (qty > cur.qty) { cur.qty = qty; cur.line = line; }
    if (via === 'order' && cur.via !== 'order') { cur.via = 'order'; cur.line = line; }
  };

  for (const raw of String(text || '').split(/\r?\n/)) {
    const r = readLine(raw);
    if (!r || (!r.orders.length && !r.codes.length)) continue;
    let settled = false;
    for (const order of r.orders) {
      if (order === BASE_UNIT.order) { base = true; settled = true; continue; }
      const id = BY_ORDER.get(order);
      if (id) { add(id, r.qty, 'order', r.line); settled = true; }
      else unknown.push({ line: r.line, order, why: `order number ${order} is not in the catalog` });
    }
    if (settled) continue;
    for (const code of r.codes) {
      const ids = BY_CODE.get(code) || [];
      if (ids.length === 1) { add(ids[0], r.qty, 'code', r.line); settled = true; }
      else if (ids.length > 1) {
        unknown.push({ line: r.line, code, why: `${code} covers ${ids.length} order numbers; the number is needed to tell them apart` });
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

/* ----------------------------------------------------------------- PDFs */

const PDFJS = {
  lib: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs',
  worker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs'
};

let pdfjs = null;

/** The renderer, from the host if it has one, else from the CDN on first use. */
export async function loadPdfJs () {
  if (globalThis.pdfjsLib) return globalThis.pdfjsLib;
  if (!pdfjs) {
    pdfjs = import(/* @vite-ignore */ PDFJS.lib).then(lib => {
      lib.GlobalWorkerOptions.workerSrc = PDFJS.worker;
      return lib;
    }).catch(err => { pdfjs = null; throw err; });
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

/** The OCR engine, from the host if it has one, else from the CDN on first use. */
export async function loadTesseract () {
  if (globalThis.Tesseract) return globalThis.Tesseract;
  if (!tesseract) {
    tesseract = import(/* @vite-ignore */ TESSERACT.lib)
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

/**
 * Reads the text off an image - a File, a Blob or a canvas - in the page.
 * `onProgress` gets 0..1 while it reads; `signal` stops it. Resolves the
 * text with the OCR slips in numbers and codes put right.
 */
export async function ocrImage (source, { onProgress, signal } = {}) {
  const T = await loadTesseract();
  if (signal?.aborted) throw Object.assign(new Error('cancelled'), { code: 'cancelled' });
  const worker = await T.createWorker('eng', 1, {
    workerPath: TESSERACT.worker, corePath: TESSERACT.core, langPath: TESSERACT.lang,
    logger: m => { if (onProgress && m.status === 'recognizing text') onProgress(m.progress || 0); }
  });
  const stop = () => worker.terminate();
  signal?.addEventListener('abort', stop, { once: true });
  try {
    const { data } = await worker.recognize(await enlarge(source));
    if (signal?.aborted) throw Object.assign(new Error('cancelled'), { code: 'cancelled' });
    return normalizeOcr(data?.text || '');
  } finally {
    signal?.removeEventListener('abort', stop);
    await worker.terminate().catch(() => {});
  }
}
