/**
 * The Keysight E8267D cross-reference: the table names only options the
 * catalog has and produces only configurations the rules accept; the reader
 * finds the model and its options in the forms documents use; and the two
 * readers never mistake one vendor's document for the other's.
 */

import '../assets/js/smw200a/index.js';   // activates the SMW200A profile the core modules work on
import test from 'node:test';
import assert from 'node:assert/strict';

import { E8267D, OTHER_MODELS, readKeysight } from '../assets/js/smw200a/xref-keysight.js';
import { crossReference, readCompetitor, xrefRows, xrefSummary, mappedFrom, xrefCode, xrefName, XREF_STATUS } from '../assets/js/xref.js';
import { readText, readAI, aiText, parseAiJson } from '../assets/js/import.js';
import { OPTIONS, BY_ID, typeName } from '../assets/js/smw200a/catalog.js';
import { validate } from '../assets/js/rules.js';

const CODES = Object.keys(E8267D.options);
const idsOf = row => Array.isArray(row.ids) ? row.ids
  : row.ids ? Object.values(row.ids).flat()
  : row.byFreq ? Object.values(row.byFreq).flat() : [];

const LISTING = `Keysight Premium Used
Keysight E8267D-544
From USD 305,339.45 Save 35%
Installed Options
544 Frequency range from 250 kHz to 44 GHz Installed
1EH Improved harmonics below 2 GHz Installed
602 Internal baseband generator, 64 MSa memory Installed
H18 Wideband Modulation less than 3.2 GHz Installed
H1G Provides 1GHz In and Out to minimize phase drift for
frequency between 250KHz - 250MHz Installed
HCC Provides 250MHz - 10GHz In and Out on the rear panel Installed
UNW Narrow pulse modulation Installed
UNY Enhanced phase noise Installed`;

const QUOTE = `Quote # Q-2026-0917
1 2 E8267D PSG vector signal generator
2 1 E8267D-544 Frequency range 250 kHz to 44 GHz
3 1 E8267D-UNY Enhanced ultra-low phase noise
4 1 E8267DK-016 Wideband external I/Q inputs (upgrade kit)
5 1 Option 602 Internal baseband generator
6 1 N7617EMBC PathWave Signal Generation for WLAN
7 1 N5179V-W2B VDI WR2.8 extender
8 1 R-50C-011-3 Calibration plan, 3 years
9 1 E8267D-ZZZ Something the table does not carry`;

test('every SMW id the table names is in the catalog, and every row is well formed', () => {
  for (const [code, row] of Object.entries(E8267D.options)) {
    assert.ok(Object.keys(XREF_STATUS).includes(row.status), `${code}: status ${row.status}`);
    assert.ok(row.name && row.page && row.step, `${code}: name, page and step`);
    for (const id of idsOf(row)) assert.ok(BY_ID[id], `${code} names ${id}, which the catalog lacks`);
    if (row.status === 'covered') assert.ok(idsOf(row).length, `${code} is covered by nothing`);
    if (['none', 'standard', 'service'].includes(row.status)) assert.equal(idsOf(row).length, 0, `${code} is ${row.status} yet names options`);
    if (row.status === 'partial') assert.ok(row.gap, `${code} is partial without saying what is missing`);
  }
  assert.ok(CODES.length >= 90);
});

test('each option on its own, with each frequency, resolves to a configuration the rules accept', () => {
  const FREQ = ['513', '520', '532', '544'];
  for (const freq of FREQ) {
    for (const code of CODES.filter(c => !FREQ.includes(c) || c === freq)) {
      const x = crossReference({ vendor: 'Keysight', model: 'E8267D', options: [{ code: freq }, { code }] });
      assert.equal(x.issues.length, 0, `${freq}+${code}: ${x.issues.map(e => e.title).join('; ')}`);
      assert.equal(x.todo.length, 0, `${freq}+${code}: ${x.todo.map(e => e.title).join('; ')}`);
      assert.equal(validate(x.sel).ok, true, `${freq}+${code} does not validate`);
    }
  }
});

test('a whole configuration guide worth of options resolves cleanly, bar the pairs Keysight itself forbids', () => {
  // UNX/UNY are mutually exclusive (CG p2) and map to two phase noise levels, so one goes
  const all = CODES.filter(c => !['513', '520', '532', 'UNX'].includes(c));
  const x = crossReference({ vendor: 'Keysight', model: 'E8267D', options: all.map(code => ({ code })) });
  assert.equal(x.issues.length, 0, x.issues.map(e => e.title).join('; '));
  assert.equal(x.mainModule, 'B13T', 'UNT asks for a two-path main module');
  assert.equal(x.sel.B10, 1);
  assert.equal(x.sel.K501, 1, 'SP2 on the standard generator');
  assert.equal(x.sel.K18, 1, '003 on the standard generator');
  // and the two exclusive ones together are reported, not hidden
  const clash = crossReference({ vendor: 'Keysight', model: 'E8267D', options: [{ code: '544' }, { code: 'UNX' }, { code: 'UNY' }] });
  assert.ok(clash.issues.length, 'B710 with B711 must be an open issue');
});

test('the platform follows the rows: analog modulation takes B13T, a plain instrument B13, and rear connectors depend on the frequency', () => {
  const plain = crossReference({ vendor: 'Keysight', model: 'E8267D', options: [{ code: '544' }, { code: '602' }] });
  assert.deepEqual(Object.keys(plain.sel).sort(), ['B10', 'B13', 'B1044'].sort());
  assert.equal(plain.added.length, 0);
  const am = crossReference({ vendor: 'Keysight', model: 'E8267D', options: [{ code: '520' }, { code: 'UNT' }] });
  assert.deepEqual(Object.keys(am.sel).sort(), ['B1020', 'B13T', 'K24', 'K720'].sort());
  // an extender needs a 20 GHz option under it: with 513 the row says so instead of failing later
  const ext13 = crossReference({ vendor: 'Keysight', model: 'E8267D', options: [{ code: '513' }, { code: 'N5179V-W15' }] });
  assert.equal(ext13.rows[1].status, 'none');
  assert.match(ext13.rows[1].gap, /B1012 rules it out/);
  assert.equal(ext13.issues.length, 0);
  const ext20 = crossReference({ vendor: 'Keysight', model: 'E8267D', options: [{ code: '520' }, { code: 'N5179V-W15' }] });
  assert.deepEqual(ext20.rows[1].ids, ['K554']);
  const rear20 = crossReference({ vendor: 'Keysight', model: 'E8267D', options: [{ code: '520' }, { code: '1EM' }] });
  assert.deepEqual(rear20.rows[1].ids, ['B83']);
  assert.equal(rear20.rows[1].status, 'covered');
  const rear44 = crossReference({ vendor: 'Keysight', model: 'E8267D', options: [{ code: '544' }, { code: '1EM' }] });
  assert.deepEqual(rear44.rows[1].ids, []);
  assert.equal(rear44.rows[1].status, 'none');
  assert.match(rear44.rows[1].gap, /no rear-panel option/);
  // what the SMW200A's own rules add is reported apart from what the table named
  const ext = crossReference({ vendor: 'Keysight', model: 'E8267D', options: [{ code: '544' }, { code: 'N7620B' }] });
  assert.deepEqual(ext.added, ['B10'], 'pulse sequencing needs a generator the document did not name');
  assert.ok(!ext.named.includes('B10'));
});

test('a product listing with bare codes at the start of each row reads completely', () => {
  const x = readCompetitor(LISTING);
  assert.equal(x.model, 'E8267D');
  assert.deepEqual(x.codes, ['544', '1EH', '602', 'H18', 'H1G', 'HCC', 'UNW', 'UNY']);
  assert.deepEqual(Object.keys(x.sel).sort(), ['B10', 'B13', 'B1044', 'B711', 'B90', 'K22', 'K23'].sort());
  assert.equal(x.issues.length, 0);
  const st = Object.fromEntries(x.rows.map(r => [r.code, r.status]));
  assert.equal(st['1EH'], 'none');
  assert.equal(st.H18, 'standard');
  assert.equal(st.H1G, 'covered');
  assert.equal(x.qty, 1);
});

test('what the page\'s OCR made of a real listing reads too: the 8 taken for a B, a 0 for an O, a 1 for an I', () => {
  // the text the OCR engine put in the box for the user's screenshot of a used-equipment listing
  const ocr = `Keysight Premium Used From
Keysight EB267D-544 USD 305,339.45 save 35%
— Instrument Options A
Installed Options A
544 Frequency range from 250 kHz to 44 GHz Installed
1EH Improved harmonics below 2 GHz Installed
6O2 Internal baseband generator, 64 MSa memory Installed
HI8 Wideband Modulation less than 3.2 GHz Installed
H1G Provides 1GHz In and Out to minimize phase drift for
frequency between 250KHz - 250MHz Installed
HCC Provides 250MHz - 10GHz In and Out on the rear panel Installed
UNW Narrow pulse modulation Installed
UNY Enhanced phase noise Installed`;
  const x = readCompetitor(ocr);
  assert.equal(x.model, 'E8267D');
  assert.deepEqual(x.codes, ['544', '1EH', '602', 'H18', 'H1G', 'HCC', 'UNW', 'UNY']);
  assert.deepEqual(x.unknown, []);
  // the kit form survives the same slip, and a code that is nothing even fixed stays unknown
  assert.deepEqual(readKeysight('EB267DK-O16 upgrade\nEB267D-ZZ9').options.map(o => [o.code, o.kit]), [['016', true]]);
  assert.deepEqual(readKeysight('EB267D-ZZ9').unknown, ['ZZ9']);
  // the R&S reader still reads nothing off it
  assert.equal(readText(ocr).items.length, 0);
});

test('a quotation reads the model, its options in every form, upgrade kits, standalone numbers and the unknowns', () => {
  const r = readKeysight(QUOTE);
  assert.equal(r.model, 'E8267D');
  assert.equal(r.qty, 2, 'two instruments quoted');
  assert.equal(r.name, 'Q-2026-0917');
  assert.deepEqual(r.options.map(o => o.code), ['544', 'UNY', '016', 'N7617EMBC', 'N5179V-W2B', 'R-50C-011-3', '602']);
  assert.equal(r.options.find(o => o.code === '016').kit, true);
  assert.deepEqual(r.unknown, ['ZZZ']);
  assert.equal(r.other.length, 0);
  // "E8267D PSG" is the model and its family, not an option called PSG
  assert.ok(!r.unknown.includes('PSG'));
  const x = crossReference(r);
  assert.equal(x.rows.find(r2 => r2.code === 'N5179V-W2B').status, 'none');
  assert.equal(x.rows.find(r2 => r2.code === 'R-50C-011-3').status, 'service');
  assert.equal(x.qty, 2);
});

test('what an AI transcribes off a Keysight page reads through the same reader', () => {
  const items = [
    { type: 'E8267D-544', order: null, qty: 1, designation: 'Frequency range from 250 kHz to 44 GHz' },
    { type: '1EH', order: null, qty: 1, designation: 'Improved harmonics below 2 GHz' },
    { type: 'UNW', order: null, qty: 1, designation: 'Narrow pulse modulation' }
  ];
  const x = readCompetitor(aiText(items));
  assert.deepEqual(x.codes, ['544', '1EH', 'UNW']);
  // and an R&S transcription still reads the R&S way, through the same text
  const rs = [{ type: 'R&S SMW-B1003', order: '1428.4700.02', qty: 1, designation: '100 kHz to 3 GHz' }];
  assert.deepEqual(readAI(rs).items.map(i => i.id), ['B1003']);
  assert.deepEqual(readText(aiText(rs)).items.map(i => i.id), ['B1003']);
  assert.equal(readCompetitor(aiText(rs)), null);
  assert.equal(aiText('not an array'), '');
});

test('a transcription that dropped the header still names the instrument when a vector-only option is on it', () => {
  const x = readCompetitor('Qty: 1 544 Frequency range from 250 kHz to 44 GHz\nQty: 1 1EH Improved harmonics\nQty: 1 602 Internal baseband generator\nQty: 1 UNW Narrow pulse');
  assert.equal(x.model, 'E8267D');
  assert.equal(x.inferred, true);
  assert.deepEqual(x.codes, ['544', '1EH', '602', 'UNW']);
  // codes the analog PSG shares are not enough to guess a model: they are reported as codes with none
  const c = readCompetitor('544 Frequency range\n1EH Improved harmonics\nUNW Narrow pulse\nUNY Enhanced phase noise');
  assert.equal(c.model, null);
  assert.deepEqual(c.candidates, ['544', '1EH', 'UNW', 'UNY']);
  assert.deepEqual(c.rows, []);
  // and two stray codes are nothing at all
  assert.equal(readCompetitor('544 Frequency range\nUNW Narrow pulse'), null);
});

test('the AI\'s reply is read leniently when the host cannot parse it: fences, stray sentences, a trailing comma', () => {
  assert.deepEqual(parseAiJson('Here you go:\n```json\n[{"type":"E8267D-544","qty":1,}]\n```'), [{ type: 'E8267D-544', qty: 1 }]);
  assert.deepEqual(parseAiJson('The rows are [{"type":"UNW"}] as listed.'), [{ type: 'UNW' }]);
  assert.deepEqual(parseAiJson('{"type":"UNW"}'), { type: 'UNW' });
  assert.equal(parseAiJson('no json here'), null);
  assert.equal(parseAiJson(''), null);
  // prose with codes in it still reads as a document
  assert.deepEqual(readCompetitor('I can see a Keysight E8267D-544 with options UNW and UNY installed.').codes, ['544', 'UNW', 'UNY']);
});

test('another Keysight model is recognised by name and answered with no table, never with a guess', () => {
  const x = readCompetitor('Quotation for one N5182B MXG vector signal generator with N5182B-506 and N5182B-656');
  assert.equal(x.model, null);
  assert.deepEqual(x.other.map(o => o.model), ['N5182B']);
  assert.equal(x.other[0].family, OTHER_MODELS.N5182B);
  assert.deepEqual(x.rows, []);
  assert.deepEqual(x.sel, {});
  assert.equal(readCompetitor('nothing from either vendor here'), null);
  assert.equal(readCompetitor(''), null);
});

test('neither reader mistakes the other vendor\'s document: every Keysight row through the R&S reader, every R&S option through the Keysight one', () => {
  // a Keysight line per table row, as a quotation prints it
  const ksLines = CODES.map(code => `1 1 ${xrefCode('E8267D', code)} ${E8267D.options[code].name}`);
  const rs = readText(['1 1 E8267D PSG vector signal generator', ...ksLines].join('\n'));
  assert.equal(rs.items.length, 0, `the R&S reader read ${rs.items.map(i => i.id).join(', ')} off a Keysight document`);
  assert.equal(rs.unknown.length, 0);
  // and every R&S option as a quotation line, one document
  const rsLines = OPTIONS.map(o => `3 1 ${o.code ? typeName(o.id) : ''} ${o.name} ${o.order}`);
  assert.equal(readKeysight(rsLines.join('\n')), null, 'the Keysight reader found something on an R&S quotation');
  // the R&S reader still reads its own lines when both are on one page
  const both = readText([...rsLines.slice(0, 5), 'E8267D-544'].join('\n'));
  assert.equal(both.items.length, 5);
  const ks = readKeysight([...rsLines.slice(0, 5), 'E8267D-544'].join('\n'));
  assert.deepEqual(ks.options.map(o => o.code), ['544']);
});

test('a stored cross-reference is checked against the configuration as it is now', () => {
  const stored = { vendor: 'Keysight', model: 'E8267D', codes: ['544', 'UNT', 'N7617EMBC', '1EH'] };
  const rows = xrefRows(stored, { B1044: 1, K720: 1, K54: 1, K86: 1, K142: 1, K147: 1 });
  assert.deepEqual(rows.map(r => [r.code, r.present, r.missing]), [
    ['544', true, []], ['UNT', false, ['K24']], ['N7617EMBC', true, []], ['1EH', null, []]
  ]);
  assert.deepEqual(mappedFrom(stored, 'K720'), ['E8267D-UNT']);
  assert.deepEqual(mappedFrom(stored, 'K54'), ['N7617EMBC']);
  assert.deepEqual(mappedFrom(stored, 'B13'), []);
  assert.deepEqual(mappedFrom(null, 'B13'), []);
  // a parts list can say where each of its lines came from
  const sum = xrefSummary({ vendor: 'Keysight', model: 'E8267D', codes: ['544', 'UNT', 'N7620B'] }, { B1044: 1, B13T: 1, K720: 1, K24: 1, K300: 1, K301: 1, B10: 1 }, 'SMW200A');
  assert.equal(sum.origin('K720'), 'E8267D-UNT');
  assert.equal(sum.origin('K300'), 'N7620B');
  assert.equal(sum.origin('B13T'), 'main module – every SMW200A needs one');
  assert.equal(sum.origin('B10'), 'added by the SMW200A\'s rules');
  assert.equal(sum.origin('SMW200A'), 'stands in for the E8267D');
  assert.equal(sum.origin('K62'), '');
  assert.equal(xrefSummary(null, {}, 'SMW200A'), null);
  assert.deepEqual(xrefRows({ model: 'E8257D', codes: ['520'] }, {}), [], 'no table, no rows');
  assert.equal(xrefName({ vendor: 'Keysight', model: 'E8267D' }), 'Equivalent of Keysight E8267D');
  assert.equal(xrefCode('E8267D', 'UNW'), 'E8267D-UNW');
  assert.equal(xrefCode('E8267D', '1CM114A'), '1CM114A');
});

test('the phase noise rows are decided by the figures, and the figures are the ones cited', () => {
  // UNX at 3.2-10 GHz (DS p11) against B710 at 10 GHz (SP p22), 10 Hz to 100 kHz
  const unx = [-65, -81, -101, -110, -110], b710 = [-77, -91, -111, -117, -119];
  const uny = [-72, -85, -101, -120, -120], b711 = [-77, -91, -115, -124, -126];
  unx.forEach((v, i) => assert.ok(b710[i] <= v, `B710 at offset ${i} is ${b710[i]}, UNX ${v}`));
  uny.forEach((v, i) => assert.ok(b711[i] <= v, `B711 at offset ${i} is ${b711[i]}, UNY ${v}`));
  assert.match(E8267D.options.UNX.note, /-77 \/ -91 \/ -111 \/ -117 \/ -119/);
  assert.match(E8267D.options.UNY.note, /-77 \/ -91 \/ -115 \/ -124 \/ -126/);
  assert.deepEqual(E8267D.options.UNX.ids, ['B710']);
  assert.deepEqual(E8267D.options.UNY.ids, ['B711']);
});
