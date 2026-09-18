/**
 * Reading a configuration out of a document: order numbers settle items,
 * type designations settle the unambiguous ones, quantities come from the
 * forms the documents use, and what the catalog does not carry is listed
 * rather than dropped. The same reader serves pasted text, a PDF's text
 * layer and what an AI transcribes off an image.
 */

import '../assets/js/smw200a/index.js';   // activates the SMW200A profile the core modules work on
import test from 'node:test';
import assert from 'node:assert/strict';

import { readLine, readText, readAI, textLines, normalizeOcr, ocrImage, warmOcr, resetOcr, aiPrompt } from '../assets/js/import.js';
import { OPTIONS, BY_ID, BASE_UNIT, typeName } from '../assets/js/smw200a/catalog.js';

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
  // a distributor's layout: item, description, model, part number, quantity, price
  assert.equal(q('1.5 Wideband baseband generator, 500 MHz, 256 MS (HW opt.) SMW-B9 1413.7350.02 2 87,100.00'), 2);
  assert.equal(q('1.14 Fading Simulator and signal processor (HW opt.) SMW-B15 1414.4710.02 4 135,140.00'), 4);
  assert.equal(q('1.1 Vector signal generator, base unit SMW200A 1412.0000.02 1 6,075.00'), 1);
  assert.equal(q('SMW-K22 1413.4306.02 250.00'), 1);          // a price after the number is not a quantity
  assert.equal(q('SMW-K22 1413.4306.02 10,000.00 10,000.00'), 1);
  assert.equal(q('SMW-K22 1413.4306.02 2'), 2);
  assert.equal(readLine(''), null);
  assert.equal(readLine('nothing here').orders.length, 0);
});

test('no designation in the catalog reads as a quantity, and "DVB-S2X" is not two of anything', () => {
  // every option printed as a quotation line at quantity 1 must read as 1
  for (const o of OPTIONS) {
    const line = `3 1 ${o.code ? typeName(o.id) : ''} ${o.name} ${o.order} 1,000.00 1,000.00`;
    const r = readLine(line);
    assert.deepEqual(r.orders, [o.order], `${o.id}: ${line}`);
    assert.equal(r.qty, 1, `${o.id}: ${line}`);
  }
  assert.equal(readLine('5 1 R&S®SMW-K116 DVB-S2/DVB-S2X 1414.2630.02 3,000.00 3,000.00').qty, 1);
  assert.equal(readLine('R&S®SMW-K116 1414.2630.02 DVB-S2/DVB-S2X').qty, 1);
  assert.equal(readAI([{ type: 'R&S SMW-K116', order: '1414.2630.02', qty: 1, designation: 'DVB-S2/S2X' }]).items[0].qty, 1);
  // and an explicit quantity beats anything the designation could look like
  assert.equal(readAI([{ type: 'R&S SMW-K116', order: null, qty: 3, designation: '2 x something' }]).items[0].qty, 3);
});

test('a quantity next to an item belongs to that item, not to the whole line', () => {
  const r = readText('R&S SMW200A with R&S SMW-B1020, R&S SMW-B13T, 2 x R&S SMW-B10 and R&S SMW-K144, SMW-B9 4 pcs');
  assert.deepEqual(Object.fromEntries(r.items.map(i => [i.id, i.qty])), { B1020: 1, B13T: 1, B10: 2, K144: 1, B9: 4 });
  const line = readLine('2 x SMW-B10 and 3 x SMW-K144');
  assert.deepEqual(line.items.map(i => [i.value, i.qty]), [['B10', 2], ['K144', 3]]);
});

test('the line with the order number has the say on a quantity; a mention never changes it', () => {
  const r = readText(`2 1 R&S SMW-B1020 1428.5107.02
4 2 R&S SMW-B10 1413.1200.02
Configuration: R&S SMW-B1020, 2 x R&S SMW-B10, 5 x R&S SMW-B1020`);
  assert.deepEqual(r.items.map(i => [i.id, i.qty, i.via]), [['B1020', 1, 'order'], ['B10', 2, 'order']]);
  // the mention comes first: the order line still wins when it arrives
  const s = readText(`5 x R&S SMW-B1020\n2 1 R&S SMW-B1020 1428.5107.02`);
  assert.deepEqual(s.items.map(i => [i.id, i.qty, i.via]), [['B1020', 1, 'order']]);
  // among mentions alone, the largest stands
  assert.equal(readText('2 x SMW-B10\n3 x SMW-B10\nSMW-B10').items[0].qty, 3);
});

test('a short code with nothing in front of it is an address, not an option', () => {
  const r = readText(`University of Birmingham, Edgbaston, Birmingham B15 2TT
Messe München, Hall B13, Stand 210, Building B9, Gate K22, Solihull B90 4AA
R&S SMW-B15 and SMW-B13 and K144 and B1044O`);
  assert.deepEqual(r.items.map(i => i.id), ['B15', 'B13', 'K144', 'B1044O']);
  assert.equal(readLine('B15 2TT').items.length, 0);
  assert.equal(readLine('SMW-B15 2TT').items.length, 1);
  assert.equal(readLine('R&S B15').items.length, 1);
});

test('a line whose order number the catalog lacks is listed, and its code is not taken instead', () => {
  const r = readText('6 1 R&S®SMW-K144 5G NR (1 year licence) 1414.4990.71');
  assert.equal(r.items.length, 0, 'the perpetual option was imported for a timed licence');
  assert.equal(r.unknown.length, 1);
  assert.match(r.unknown[0].why, /1414\.4990\.71/);
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
  assert.match(aiPrompt(), /JSON array/);
  assert.match(aiPrompt(), /dddd\.dddd\.dd/);
});

test('what OCR gets wrong in numbers and codes is put right, and prose is left alone', () => {
  assert.equal(normalizeOcr('SMW-B1O2O 1428.51O7.O2'), 'SMW-B1020 1428.5107.02');
  assert.equal(normalizeOcr('SMW-KSO3 1414,362O,O2'), 'SMW-K503 1414.3620.02');
  assert.equal(normalizeOcr('SMW-BI3XT 1413 . 8005 . 02'), 'SMW-B13XT 1413.8005.02');
  assert.equal(normalizeOcr('Blue sky, BIT, 16.09.2026, 10,000.00'), 'Blue sky, B1T, 16.09.2026, 10,000.00');
  assert.equal(normalizeOcr(''), '');
  assert.equal(normalizeOcr(null), '');
  // and the reader then settles the corrected line by its order number
  const r = readText(normalizeOcr('1.2 Frequency range 100 kHz to 20 GHz SMW-B1O2O 1428.51O7.O2 1 111,295.00'));
  assert.deepEqual(r.items.map(i => [i.id, i.qty, i.via]), [['B1020', 1, 'order']]);
});

/* The engine, stood in for: a worker that starts after `startMs` (never, when
   null), reads `text`, and counts how often it was started and killed. */
function fakeEngine ({ startMs = 0, text = 'SMW-B1003 1428.4700.02', readMs = 0, fails = false } = {}) {
  const stats = { started: 0, killed: 0, reads: 0 };
  globalThis.Tesseract = {
    createWorker: (lang, oem, opts) => new Promise(resolve => {
      stats.started++;
      if (startMs === null) return;
      setTimeout(() => {
        opts.logger?.({ status: 'loading language traineddata', progress: 0.5 });
        resolve({
          recognize: () => new Promise((res, rej) => {
            stats.reads++;
            opts.logger?.({ status: 'recognizing text', progress: 0.5 });
            setTimeout(() => (fails ? rej(new Error('bad image')) : res({ data: { text } })), readMs);
          }),
          terminate: async () => { stats.killed++; }
        });
      }, startMs);
    })
  };
  return stats;
}
const settled = p => p.then(() => 'ok', e => e.code || e.message);

test('the OCR engine: Stop answers at once while it starts, and a start that takes too long is given up on', async () => {
  resetOcr();
  const hung = fakeEngine({ startMs: null });
  const ctl = new AbortController();
  const read = settled(ocrImage({}, { signal: ctl.signal, timeoutMs: 5000 }));
  setTimeout(() => ctl.abort(), 20);
  assert.equal(await read, 'cancelled');
  assert.equal(hung.started, 1);
  // the start is still hung; a bounded wait gives up on it
  assert.equal(await settled(warmOcr({ timeoutMs: 40 })), 'timeout');
  // and the next call begins afresh rather than waiting on the old start
  const quick = fakeEngine({ startMs: 5 });
  assert.equal(await settled(warmOcr({ timeoutMs: 1000 })), 'ok');
  assert.equal(quick.started, 1);
});

test('the OCR engine: one start serves every read, Stop kills a read, and a failed read starts afresh', async () => {
  resetOcr();
  const engine = fakeEngine({ startMs: 5, readMs: 5 });
  const stages = [];
  assert.equal(await ocrImage({}, { onProgress: m => stages.push(m.status) }), 'SMW-B1003 1428.4700.02');
  assert.equal(await ocrImage({}), 'SMW-B1003 1428.4700.02');
  assert.deepEqual([engine.started, engine.reads, engine.killed], [1, 2, 0]);
  assert.ok(stages.includes('recognizing text'));

  resetOcr();                       // the quick engine above would answer before the stop
  const ctl = new AbortController();
  const slow = fakeEngine({ startMs: 5, readMs: 5000 });
  const read = settled(ocrImage({}, { signal: ctl.signal }));
  setTimeout(() => ctl.abort(), 30);
  assert.equal(await read, 'cancelled');
  assert.equal(slow.killed, 1, 'a stopped read is killed');
  const fresh = fakeEngine({ startMs: 5 });
  assert.equal(await settled(ocrImage({})), 'ok');
  assert.equal(fresh.started, 1, 'the next read starts a new engine');

  resetOcr();
  const failing = fakeEngine({ startMs: 5, fails: true });
  assert.equal(await settled(ocrImage({})), 'bad image');
  assert.equal(failing.killed, 1);
  resetOcr();
  delete globalThis.Tesseract;
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
