/**
 * Reading a configuration out of a document: order numbers settle items,
 * type designations settle the unambiguous ones, quantities come from the
 * forms the documents use, and what the catalog does not carry is listed
 * rather than dropped. The same reader serves pasted text, a PDF's text
 * layer and what an AI transcribes off an image.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { readLine, readText, readAI, textLines, AI_PROMPT } from '../assets/js/import.js';
import { OPTIONS, BY_ID, BASE_UNIT } from '../assets/js/catalog.js';

const QUOTE = `Rohde & Schwarz GmbH & Co. KG
Quotation No. 4711-2026 Date 16.09.2026
Pos. Qty Type Designation Order No. Unit price Total
1 1 R&S®SMW200A Vector signal generator 1412.0000.02 10,000.00 10,000.00
2 1 R&S®SMW-B1020 100 kHz to 20 GHz 1428.5107.02 20,000.00 20,000.00
3 1 R&S®SMW-B13T Signal routing and baseband main module, two I/Q paths 1413.3003.02 5,000.00 5,000.00
4 2 R&S®SMW-B10 Baseband generator with ARB (64 Msample) 1413.1200.02 4,000.00 8,000.00
5 1 R&S®SMW-K200 50 waveforms 1414.6870.75 1,000.00 1,000.00
6 3 Test port adapter, 2.92 mm female 1036.4790.00 100.00 300.00
7 1 R&S®DCV-2 Documentation of calibration values 0240.2193.18 200.00 200.00
8 1 R&S®SMW-K999 An option this catalog does not know 9999.9999.99 1.00 1.00
Total 44,501.00`;

test('every order number in the catalog is unique, so a number settles an item', () => {
  const seen = new Map();
  for (const o of OPTIONS) {
    assert.ok(!seen.has(o.order), `${o.id} and ${seen.get(o.order)} share ${o.order}`);
    seen.set(o.order, o.id);
  }
  assert.ok(!seen.has(BASE_UNIT.order));
});

test('a quotation reads into the options it lists, with quantities and the base unit', () => {
  const r = readText(QUOTE);
  const got = Object.fromEntries(r.items.map(i => [i.id, i.qty]));
  assert.deepEqual(got, { B1020: 1, B13T: 1, B10: 2, 'K200-50': 1, 'ADP-292F': 3, 'DCV-2': 1 });
  assert.ok(r.items.every(i => i.via === 'order'), 'a quotation settles everything by order number');
  assert.equal(r.base, true);
  assert.equal(r.name, '4711-2026');
  assert.equal(r.unknown.length, 1);
  assert.match(r.unknown[0].why, /9999\.9999\.99 is not in the catalog/);
  assert.match(r.unknown[0].line, /K999/);
  // the date, the prices and the totals never read as anything
  assert.ok(!r.items.some(i => i.qty > 3));
});

test('type designations settle an item where the code is unique, and say so where it is not', () => {
  const r = readText(`2 x SMW-B9
R&S SMW-K144 5G NR
SMW - B13XT
ZZA-KN4B rack adapter
R&S® DCV-ZP
K200 without a number
ACASMW200A accredited calibration`);
  const got = Object.fromEntries(r.items.map(i => [i.id, i.qty]));
  assert.deepEqual(got, { B9: 2, K144: 1, B13XT: 1, 'ZZA-KN4B': 1, 'DCV-ZP': 1 });
  assert.ok(r.items.every(i => i.via === 'code'));
  assert.deepEqual(r.unknown.map(u => u.code), ['K200', 'ACASMW200A']);
  assert.match(r.unknown[0].why, /3 order numbers/);
  assert.match(r.unknown[1].why, /4 order numbers/);
});

test('the longest code wins, so a suffixed variant is never read as its base', () => {
  assert.deepEqual(readText('R&S SMW-B1044O').items.map(i => i.id), ['B1044O']);
  assert.deepEqual(readText('SMW-B1044').items.map(i => i.id), ['B1044']);
  assert.deepEqual(readText('SMW-B13T and SMW-B13').items.map(i => i.id), ['B13T', 'B13']);
  assert.deepEqual(readText('RPC2.9-1.8 adapter').items.map(i => i.id), ['ADP-185292']);
});

test('quantities are read from the forms documents use, and default to one', () => {
  const q = line => readLine(line).qty;
  assert.equal(q('2 x R&S SMW-B9 baseband generator'), 2);
  assert.equal(q('R&S SMW-B9 4 pcs'), 4);
  assert.equal(q('Qty: 3 R&S SMW-K22'), 3);
  assert.equal(q('12 2 R&S SMW-K22 1413.4306.02'), 2);        // position, then quantity
  assert.equal(q('1 R&S SMW-K22 1413.4306.02'), 1);           // one leading column is a position
  assert.equal(q('R&S SMW-K22 1413.4306.02 250.00 250.00'), 1);   // prices are not quantities
  assert.equal(q('R&S SMW-B1003 1428.4700.02'), 1);
  assert.equal(q('1000 x SMW-B9'), 1);                        // out of range reads as one
  assert.equal(readLine(''), null);
  assert.equal(readLine('nothing here').orders.length, 0);
});

test('an order number is read with its dots spaced out or replaced', () => {
  for (const s of ['1428.4700.02', '1428 . 4700 . 02', '1428·4700·02', '1428 4700 02', '1428.4700 .02']) {
    assert.deepEqual(readText(`item ${s}`).items.map(i => i.id), ['B1003'], s);
  }
  // a date or a price never looks like one
  assert.equal(readText('16.09.2026 and 10,000.00 and 1234567890').items.length, 0);
});

test('an option named on several lines is one item at the largest quantity, and the base unit alone is not an option', () => {
  // a quotation's summary repeats its line items; a guide names an option in
  // every rule about it - neither is a second order
  const r = readText(`1 2 R&S SMW-B9 ${BY_ID.B9.order}\nR&S SMW-B9 ${BY_ID.B9.order}\nR&S SMW-B9 is required for\nSMW200A ${BASE_UNIT.order}`);
  assert.deepEqual(r.items.map(i => [i.id, i.qty, i.via]), [['B9', 2, 'order']]);
  assert.equal(r.base, true);
  // and a code mention never outranks the line with the order number
  const c = readText(`SMW-K144 5G NR\n1 1 R&S SMW-K144 ${BY_ID.K144.order}`);
  assert.deepEqual(c.items.map(i => [i.id, i.via]), [['K144', 'order']]);
  assert.deepEqual(readText(''), { items: [], unknown: [], base: false, name: null });
  assert.deepEqual(readText(null).items, []);
});

test('what an AI transcribes is read by the same rules', () => {
  const r = readAI([
    { type: 'R&S SMW-B1003', order: '1428.4700.02', qty: 1, designation: '100 kHz to 3 GHz' },
    { type: 'R&S SMW-B13', order: null, qty: '1', designation: null },
    { type: null, order: '1036.4790.00', qty: 3 },
    { type: 'R&S SMW-K200', order: null, qty: 1 },
    { type: 'R&S SMW-K22', order: '1413.3484.02', qty: 2 },   // the number (K62's) wins over the code
    'not an object', null
  ]);
  const got = Object.fromEntries(r.items.map(i => [i.id, i.qty]));
  assert.deepEqual(got, { B1003: 1, B13: 1, 'ADP-292F': 3, K62: 2 });
  assert.equal(BY_ID.K62.order, '1413.3484.02');
  assert.equal(r.unknown.length, 1);
  assert.deepEqual(readAI('nonsense').items, []);
  assert.deepEqual(readAI(null).items, []);
  assert.match(AI_PROMPT, /JSON array/);
  assert.match(AI_PROMPT, /dddd\.dddd\.dd/);
});

test('a page\'s text runs are joined into lines by baseline, with columns kept apart', () => {
  const run = (str, x, y, w = str.length * 5) => ({ str, transform: [1, 0, 0, 1, x, y], width: w, height: 9 });
  const lines = textLines([
    run('1428.4700.02', 300, 700), run('R&S', 60, 700.4, 16), run('®', 76, 700, 5), run('SMW-B1003', 81, 700),
    run('1', 20, 700), run('1', 40, 700),
    run('SMW-B13', 60, 680), run('1413.', 300, 680, 25), run('2807.02', 325, 680),
    run('   ', 10, 660), { str: 'no transform' }
  ]);
  assert.deepEqual(lines, ['1 1 R&S®SMW-B1003 1428.4700.02', 'SMW-B13 1413.2807.02']);
  const r = readText(lines.join('\n'));
  assert.deepEqual(r.items.map(i => i.id), ['B1003', 'B13']);
  assert.equal(BY_ID.B13.order, '1413.2807.02');
});
