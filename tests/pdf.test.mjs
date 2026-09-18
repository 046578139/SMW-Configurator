/**
 * The parts-list PDF the page writes itself: a well-formed file, ASCII only,
 * that carries every line and pages when the list is long.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { partsListPdf } from '../assets/js/pdf.js';
import { bomLines } from '../assets/js/ui.js';
import { BASE_UNIT, typeName } from '../assets/js/smw200a/catalog.js';

const groupsOf = sel => {
  const groups = [];
  for (const l of bomLines(sel, BASE_UNIT)) {
    const last = groups[groups.length - 1];
    const row = { type: typeName(l.id), name: l.name, order: l.order, qty: l.qty };
    if (last && last.name === l.group) last.rows.push(row);
    else groups.push({ name: l.group, rows: [row] });
  }
  return groups;
};

const make = (sel, title = 'Two-path 20 GHz') => partsListPdf({
  title, subtitle: 'validated against the configuration guide',
  groups: groupsOf(sel), footer: 'Unofficial planning aid – confirm with Rohde & Schwarz'
});

/** Checks the file's skeleton the way a reader does: every object where the xref says it is. */
function wellFormed (pdf) {
  assert.ok(pdf.startsWith('%PDF-1.4\n'));
  assert.match(pdf, /%%EOF\n$/);
  assert.equal(/[^\x00-\x7f]/.test(pdf), false, 'a byte outside ASCII');
  const startxref = Number(pdf.match(/startxref\n(\d+)\n%%EOF/)[1]);
  assert.equal(pdf.slice(startxref, startxref + 4), 'xref');
  const count = Number(pdf.slice(startxref).match(/xref\n0 (\d+)/)[1]);
  const entries = pdf.slice(startxref).match(/^\d{10} \d{5} [nf] $/gm);
  assert.equal(entries.length, count);
  for (let i = 1; i < count; i++) {
    const offset = Number(entries[i].slice(0, 10));
    assert.equal(pdf.slice(offset, offset + `${i} 0 obj`.length), `${i} 0 obj`, `object ${i} is not at its offset`);
  }
  // every content stream's length is what it says
  for (const m of pdf.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
    const start = m.index + m[0].length;
    assert.equal(pdf.slice(start + Number(m[1]), start + Number(m[1]) + 10), '\nendstream', 'a stream length is off');
  }
  return count;
}

test('a parts list becomes a well-formed one-page PDF with every line on it', () => {
  const pdf = make({ B1020: 1, B13T: 1, B10: 2, K62: 2, 'ADP-292F': 3, 'DCV-2': 1 });
  wellFormed(pdf);
  assert.match(pdf, /\/Count 1 >>/);
  for (const s of ['R&S\\\\256SMW200A', '1412.0000.02', 'R&S\\\\256SMW-B1020', '1428.5107.02', '(2) Tj', '(3) Tj', '1036.4790.00', 'R&S\\\\256DCV-2']) {
    assert.ok(pdf.includes(s.replace('\\\\', '\\')), `${s} is not in the PDF`);
  }
  assert.ok(pdf.includes('(Two-path 20 GHz) Tj'));
  assert.ok(pdf.includes('(Page 1 of 1) Tj'));
  // parentheses and backslashes in text are escaped, the registered sign is an octal escape
  assert.ok(pdf.includes('\\256'), 'the registered sign is not encoded');
  const withParens = partsListPdf({ title: 'A (B) \\ C', subtitle: '', groups: [], footer: '' });
  assert.ok(withParens.includes('(A \\(B\\) \\\\ C) Tj'));
});

test('a long list runs over several pages, each with the headings and its number', () => {
  const sel = {};
  for (const id of ['B1044', 'B2044', 'B13XT', 'B9', 'B15', 'K62', 'K503', 'K504', 'K502', 'K544', 'K515', 'K525', 'K527',
    'K22', 'K23', 'K24', 'K16', 'K17', 'K18', 'K19', 'K40', 'K41', 'K42', 'K44', 'K45', 'K46', 'K47', 'K48', 'K49', 'K50',
    'K52', 'K53', 'K54', 'K55', 'K56', 'K57', 'K58', 'K59', 'K60', 'K61', 'K64', 'K65', 'K66', 'K67', 'K68', 'K69', 'K70',
    'K71', 'K72', 'K73', 'K74', 'K75', 'K76', 'K77', 'K78', 'K79', 'K80', 'K81']) sel[id] = 1;
  const pdf = make(sel, 'Everything');
  const count = wellFormed(pdf);
  const pages = Number(pdf.match(/\/Count (\d+) >>/)[1]);
  assert.ok(pages >= 2, `${pages} page(s) for ${Object.keys(sel).length} options`);
  assert.equal(count, 4 + 2 * pages + 1);
  assert.ok(pdf.includes(`(Page ${pages} of ${pages}) Tj`));
  assert.equal((pdf.match(/\(DESIGNATION\) Tj/g) || []).length, pages, 'headings on every page');
});

test('a designation too wide for its column is wrapped, not cut', () => {
  const pdf = partsListPdf({ title: 'T', subtitle: '', footer: '', groups: [{ name: 'G', rows: [{
    type: 'R&S SMW-K544', order: '1414.3707.02', qty: 1,
    name: 'User-defined frequency response correction with a designation long enough to need a second and a third line in the column'
  }] }] });
  wellFormed(pdf);
  assert.ok((pdf.match(/\(User-defined/g) || []).length === 1);
  assert.ok(pdf.includes('(second') || pdf.includes('second'), 'the tail of the designation is missing');
  const rowLines = pdf.match(/152\.00 [\d.]+ Td \(/g);
  assert.ok(rowLines.length >= 3, 'the designation was not wrapped');
});
