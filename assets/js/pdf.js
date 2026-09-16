/**
 * The parts list as a PDF, written by the page itself.
 *
 * The page cannot always print: a viewer that frames it in a sandbox without
 * the modal permission ignores window.print() outright. A file it can always
 * hand over, so the parts list is written here - a few pages of text and
 * rules in Helvetica, which every reader carries, nothing compressed and
 * nothing outside ASCII (accented letters and symbols go in as WinAnsi octal
 * escapes), so the whole file is a plain string that any save path takes.
 */

/* Helvetica advance widths, 1/1000 em, for the printable ASCII range - to
   wrap a designation at the column's edge rather than guess. */
const WIDTHS = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584
];

/* The characters the catalog uses beyond ASCII, as WinAnsi codes with their
   Helvetica widths. Anything else prints as a question mark. */
const WINANSI = {
  '®': [0o256, 737], '–': [0o226, 556], '—': [0o227, 1000], '×': [0o327, 584],
  '·': [0o267, 278], '°': [0o260, 400], 'µ': [0o265, 556], '’': [0o222, 222],
  '‘': [0o221, 222], '“': [0o223, 333], '”': [0o224, 333], '…': [0o205, 1000],
  'ä': [0o344, 556], 'ö': [0o366, 556], 'ü': [0o374, 556], 'Ä': [0o304, 667],
  'Ö': [0o326, 778], 'Ü': [0o334, 722], 'ß': [0o337, 611], 'é': [0o351, 556],
  'è': [0o350, 556], 'à': [0o340, 556], 'ç': [0o347, 500], '€': [0o200, 556],
  ' ': [0o240, 278], '≤': [0o74, 584], '≥': [0o76, 584],
  // the narrow and thin spaces a file name or a number may carry print as a space
  ' ': [0o40, 278], ' ': [0o40, 278], ' ': [0o40, 278]
};

const widthOf = (text, size) => {
  let w = 0;
  for (const ch of String(text)) {
    const c = ch.charCodeAt(0);
    w += c >= 32 && c < 127 ? WIDTHS[c - 32] : (WINANSI[ch]?.[1] ?? 556);
  }
  return w / 1000 * size;
};

/** A PDF string literal: parentheses and backslashes escaped, everything above ASCII as octal. */
function literal (text) {
  let out = '';
  for (const ch of String(text)) {
    const c = ch.charCodeAt(0);
    if (ch === '(' || ch === ')' || ch === '\\') out += '\\' + ch;
    else if (c >= 32 && c < 127) out += ch;
    else if (WINANSI[ch]) out += WINANSI[ch][0] === 0o40 ? ' ' : '\\' + WINANSI[ch][0].toString(8).padStart(3, '0');
    else out += '?';
  }
  return `(${out})`;
}

/** Breaks text into lines no wider than `max` points at `size`. */
function wrap (text, size, max) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (widthOf(next, size) <= max || !cur) cur = next;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

const PAGE = { w: 595.28, h: 841.89, margin: 48 };
const COL = { type: 48, name: 152, order: 452, qty: 547 };   // x positions; qty is right-aligned
const NAME_W = COL.order - COL.name - 10;
const SIZE = 9;
const LEAD = 12;

/**
 * @param {object} doc
 * @param {string} doc.title        the configuration's name
 * @param {string} doc.subtitle     the line under it (line count, validation)
 * @param {Array<{name:string, rows:Array<{type:string, name:string, order:string, qty:number}>}>} doc.groups
 * @param {string} doc.footer       the colophon line printed on every page
 * @returns {string}                the PDF, ASCII only
 */
export function partsListPdf ({ title, subtitle, groups, footer }) {
  const pages = [];
  let ops = [];
  let y = 0;
  let pageNo = 0;

  const text = (x, yy, s, size = SIZE, font = 'F1', grey = false) => {
    ops.push(`BT ${grey ? '0.4 g ' : '0 g '}/${font} ${size} Tf ${x.toFixed(2)} ${yy.toFixed(2)} Td ${literal(s)} Tj ET`);
  };
  const textRight = (xRight, yy, s, size = SIZE, font = 'F1') => text(xRight - widthOf(s, size), yy, s, size, font);
  const rule = (yy, light = false) => {
    ops.push(`${light ? '0.85 G' : '0.6 G'} 0.5 w ${PAGE.margin} ${yy.toFixed(2)} m ${(PAGE.w - PAGE.margin).toFixed(2)} ${yy.toFixed(2)} l S`);
  };
  const columnHeads = () => {
    text(COL.type, y, 'TYPE', 7, 'F2', true);
    text(COL.name, y, 'DESIGNATION', 7, 'F2', true);
    text(COL.order, y, 'ORDER NO.', 7, 'F2', true);
    textRight(COL.qty, y, 'QTY', 7, 'F2');
    y -= 5;
    rule(y);
    y -= LEAD;
  };
  const newPage = () => {
    if (ops.length) pages.push(ops);
    ops = [];
    pageNo++;
    y = PAGE.h - PAGE.margin;
    if (pageNo === 1) {
      text(PAGE.margin, y - 6, title, 15, 'F2');
      y -= 24;
      text(PAGE.margin, y, subtitle, SIZE, 'F1', true);
      y -= 22;
    } else {
      text(PAGE.margin, y - 4, title, SIZE, 'F2', true);
      y -= 22;
    }
    columnHeads();
  };
  const bottom = PAGE.margin + 30;

  newPage();
  for (const g of groups) {
    if (y - 30 < bottom) newPage();
    y -= 4;
    text(COL.type, y, g.name.toUpperCase(), 7, 'F2', true);
    y -= LEAD + 2;
    for (const r of g.rows) {
      const lines = wrap(r.name, SIZE, NAME_W);
      const height = lines.length * LEAD + 4;
      if (y - height < bottom) { newPage(); }
      text(COL.type, y, r.type, SIZE, 'F2');
      lines.forEach((l, i) => text(COL.name, y - i * LEAD, l));
      text(COL.order, y, r.order);
      textRight(COL.qty, y, String(r.qty));
      y -= height;
      rule(y + 6, true);
    }
  }
  pages.push(ops);

  /* the footer needs the page count, so it goes on after the pages are known */
  const total = pages.length;
  pages.forEach((p, i) => {
    const yy = PAGE.margin - 14;
    p.push(`BT 0.4 g /F1 7 Tf ${PAGE.margin} ${yy} Td ${literal(footer)} Tj ET`);
    const label = `Page ${i + 1} of ${total}`;
    p.push(`BT 0.4 g /F1 7 Tf ${(PAGE.w - PAGE.margin - widthOf(label, 7)).toFixed(2)} ${yy} Td ${literal(label)} Tj ET`);
  });

  /* objects: 1 catalog, 2 pages, 3 F1, 4 F2, then a page and a content stream per page */
  const objects = [];
  const add = body => { objects.push(body); return objects.length; };
  add('<< /Type /Catalog /Pages 2 0 R >>');
  add('');   // the page tree, filled in once the page ids are known
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const pageIds = [];
  for (const p of pages) {
    const stream = p.join('\n');
    const contentId = add(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    pageIds.push(add(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.w} ${PAGE.h}] ` +
      `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`));
  }
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return out;
}
