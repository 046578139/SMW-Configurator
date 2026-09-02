/**
 * The panel view claims to show which connectors an instrument arrives with.
 * These check the two things it can get wrong: the connector type a frequency
 * option fits, and which face a connector ends up on once the B81 to B84
 * options relocate the RF outputs.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { derive } from '../assets/js/derive.js';
import { RF_CONNECTOR, FRONT_PANEL, REAR_PANEL, MODULE_PANELS } from '../assets/js/catalog.js';
import { renderFront, renderRear, faceCounts, connectorNotes } from '../assets/js/panel.js';

const base = { B13: 1, B10: 1 };

test('every frequency option maps to exactly one connector type', () => {
  const seen = new Map();
  for (const [type, ids] of Object.entries(RF_CONNECTOR)) {
    for (const id of ids) {
      assert.equal(seen.has(id), false, `${id} is listed under two connector types`);
      seen.set(id, type);
    }
  }
});

test('the connector type follows the frequency option', () => {
  assert.equal(derive({ ...base, B1003: 1 }).panel.connA, 'N female');
  assert.equal(derive({ ...base, B1020: 1 }).panel.connA, 'PC 2.92 mm female');
  assert.equal(derive({ ...base, B1044: 1 }).panel.connA, 'PC 1.85 mm male');
  assert.equal(derive({ ...base, B1067: 1 }).panel.connA, '1.85 mm female');
});

test('B81 moves RF path A and its I/Q to the rear panel', () => {
  const front = derive({ ...base, B1003: 1 });
  const rear = derive({ ...base, B1003: 1, B81: 1 });

  assert.equal(front.panel.rfA, true, 'path A starts on the front');
  assert.equal(front.panel.iqA, true);
  assert.equal(rear.panel.rfA, false, 'B81 takes path A off the front');
  assert.equal(rear.panel.iqA, false, 'B81 takes the path A I/Q with it');
  assert.equal(rear.panel.rearRfA, true);
  assert.equal(rear.panel.rearIq, true);

  // three connectors leave the front panel and arrive on the rear
  assert.equal(faceCounts(front).front - faceCounts(rear).front, 3);
  assert.equal(faceCounts(rear).rear - faceCounts(front).rear, 3);
});

test('B83 relocates path A the same way for the higher frequency options', () => {
  const d = derive({ ...base, B1020: 1, B83: 1 });
  assert.equal(d.panel.rearRfA, true);
  assert.equal(d.panel.rfA, false);
  assert.match(connectorNotes(d)[0].label, /rear panel/);
});

test('B82 and B84 move only path B', () => {
  const sel = { B13T: 1, B10: 1, B1003: 1, B2003: 1, B82: 1, B81: 1 };
  const d = derive(sel);
  assert.equal(d.panel.rearRfB, true);
  assert.equal(d.panel.rfB, false);
  // path A went with B81, path B with B82
  assert.equal(d.panel.rearRfA, true);
});

test('the rear panel grows one connector block per installed module', () => {
  const one = derive({ ...base, B1003: 1 });
  const many = derive({ B13T: 1, B1003: 1, B2003: 1, B10: 2, B14: 2 });

  assert.equal(one.panel.modules.length, 1);
  assert.equal(many.panel.modules.length, 4, 'two generators and two fading simulators');

  const perBlock = MODULE_PANELS.standard.items.length;
  assert.equal(faceCounts(many).rear - faceCounts(one).rear >= perBlock * 3, true);
});

test('a wideband generator brings the high speed digital connectors', () => {
  const d = derive({ B13XT: 1, B1003: 1, B9: 1 });
  assert.equal(d.panel.modules[0], 'wideband');
  assert.equal(d.panel.hsDigital, true);
  assert.match(renderRear(d), /HS DIG IQ IN\/OUT 1/);
});

test('both faces render valid single-root SVG for an empty configuration', () => {
  const d = derive({});
  for (const svg of [renderFront(d, {}), renderRear(d)]) {
    assert.match(svg.trim(), /^<svg /);
    assert.equal(svg.trim().endsWith('</svg>'), true);
    assert.equal((svg.match(/<svg /g) || []).length, 1);
  }
});

test('no connector is drawn without a documented type', () => {
  const documented = i => i.kind === 'rf' || typeof i.type === 'string';
  for (const g of [...FRONT_PANEL, ...REAR_PANEL]) {
    for (const i of g.items) assert.equal(documented(i), true, `${i.label} has no connector type`);
  }
  for (const m of Object.values(MODULE_PANELS)) {
    for (const i of m.items) assert.equal(documented(i), true, `${i.label} has no connector type`);
  }
});

test('a slot standing for several connectors is counted as several', () => {
  const one = derive({ B13: 1, B10: 1, B1003: 1, K16: 1 });
  const two = derive({ B13: 1, B10: 1, B1003: 1, K17: 1 });
  // K17 adds the second set of four analog I/Q outputs
  assert.equal(faceCounts(two).rear - faceCounts(one).rear, 4);
});

test('labels stay in characters that render at label size', () => {
  const all = [...FRONT_PANEL, ...REAR_PANEL,
    ...Object.values(MODULE_PANELS)].flatMap(g => g.items);
  for (const i of all) {
    assert.equal(/^[\x20-\x7E\u00A9\u00AE\u03A9\u00D7]*$/.test(i.label), true,
      `${i.label} carries a character that may not render`);
  }
});

test('the front chassis grows when the connector strip wraps', () => {
  const d = derive({ B13T: 1, B10: 1, B1003: 1, B2003: 1 });
  const heightOf = svg => Number(svg.match(/viewBox="0 0 [\d.]+ ([\d.]+)"/)[1]);

  const wide = heightOf(renderFront(d, {}, 900));
  const narrow = heightOf(renderFront(d, {}, 380));
  assert.equal(narrow > wide, true,
    'a narrow panel wraps its connector strip and needs a taller chassis');

  // the wordmark sits inside the chassis; the strip must finish above it
  for (const w of [900, 640, 500, 430, 380]) {
    const svg = renderFront(d, {}, w);
    const h = heightOf(svg) - 16;
    const labels = [...svg.matchAll(/<text x="[\d.]+" y="([\d.]+)" font-size="6\.6"/g)]
      .map(m => Number(m[1]));
    assert.equal(Math.max(...labels) < h - 6, true,
      `at ${w} a connector label runs into the wordmark`);
  }
});

test('group titles never overflow their box', () => {
  const d = derive({ B13T: 1, B1003: 1, B2003: 1, B10: 2, B14: 2, K16: 1, K18: 1 });
  // the narrow preview width is the tight case
  const svg = renderRear(d, 430);
  for (const m of svg.matchAll(/font-size="6\.4"[^>]*>([^<]*)</g)) {
    assert.equal(m[1].length <= 64, true, `title too long for its box: ${m[1]}`);
  }
});
