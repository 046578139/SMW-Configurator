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
import { renderRuler, renderChain } from '../assets/js/diagram.js';
import { renderPhoto } from '../assets/js/photo.js';

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
  const one = derive({ B13T: 1, B10: 1, B1003: 1, K16: 1 });
  const two = derive({ B13T: 1, B10: 1, B1003: 1, K16: 2 });
  // a second K16 adds the second set of four analog I/Q outputs; K17 is the
  // wideband equivalent of K16 and cannot be installed twice, so it adds none
  assert.equal(faceCounts(two).rear - faceCounts(one).rear, 4);
  assert.equal(derive({ B13XT: 1, B9: 1, B1003: 1, K17: 1 }).panel.analogIqOut2, false);
});

test('labels stay in characters that render at label size', () => {
  const all = [...FRONT_PANEL, ...REAR_PANEL,
    ...Object.values(MODULE_PANELS)].flatMap(g => g.items);
  for (const i of all) {
    assert.equal(/^[\x20-\x7E\u00A9\u00AE\u03A9\u00D7]*$/.test(i.label), true,
      `${i.label} carries a character that may not render`);
  }
});

test('the front panel keeps the proportions of the instrument', () => {
  const svg = renderFront(derive({ B13: 1, B10: 1, B1003: 1 }), {});
  const [, w, h] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/).map(Number);
  // the 4 HU chassis face is about 2.45 times as wide as it is tall
  assert.equal(Math.abs(w / h - 2.44) < 0.12, true, `aspect was ${(w / h).toFixed(2)}`);
});

test('the RF outputs are labelled with the range the option provides', () => {
  assert.match(renderFront(derive({ B13: 1, B10: 1, B1003: 1 }), {}), /100kHz–3GHz/);
  assert.match(renderFront(derive({ B13: 1, B10: 1, B1067: 1 }), {}), /100kHz–67GHz/);
});

test('a relocated or absent RF output leaves a blanking plate', () => {
  const one = renderFront(derive({ B13: 1, B10: 1, B1003: 1 }), {});
  assert.match(one, /no second path/, 'path B is blanked when only one path is fitted');

  const moved = renderFront(derive({ B13: 1, B10: 1, B1003: 1, B81: 1 }), {});
  assert.match(moved, /on rear panel/, 'B81 leaves a plate where path A was');
  assert.equal(/100kHz–3GHz/.test(moved), false,
    'the range belongs with the connector, which is now on the rear');
});

test('the rear shows the rated current the configuration draws', () => {
  // the specifications give 7.3 A to 4.6 A for B13/B13T, and the higher
  // 8.9 A to 4.9 A once B13XT or the deeper chassis B94L is fitted
  assert.match(renderRear(derive({ B13: 1, B10: 1, B1003: 1 })), /7\.3…4\.6 A/);
  assert.match(renderRear(derive({ B13XT: 1, B9: 1, B1003: 1 })), /8\.9…4\.9 A/);
  // B94L is added for these path combinations by the resolver, not by derive,
  // so a hand built selection has to carry it
  assert.match(renderRear(derive({ B13T: 1, B10: 1, B1012: 1, B2012: 1, B94L: 1 })), /8\.9…4\.9 A/);
});

test('one module bay is drawn per installed module', () => {
  const count = svg => (svg.match(/BASEBAND GENERATOR/g) || []).length;
  assert.equal(count(renderRear(derive({ B13: 1, B10: 1, B1003: 1 }))), 1);
  assert.equal(count(renderRear(derive({ B13T: 1, B10: 2, B14: 2, B1003: 1, B2003: 1 }))), 4);
  assert.match(renderRear(derive({ B13: 1, B1003: 1 })), /NO BASEBAND MODULES FITTED/);
});

test('the rear RF cut-outs open only when an option puts an output there', () => {
  const plain = renderRear(derive({ B13: 1, B10: 1, B1003: 1 }));
  const moved = renderRear(derive({ B13: 1, B10: 1, B1003: 1, B81: 1 }));
  const live = svg => (svg.match(/stroke="var\(--accent\)" stroke-width="2"/g) || []).length;
  assert.equal(live(plain), 0, 'nothing on the rear until B81 to B84 is fitted');
  assert.equal(live(moved) > 0, true, 'B81 opens the path A cut-out');
});

test('group titles never overflow their box', () => {
  const d = derive({ B13T: 1, B1003: 1, B2003: 1, B10: 2, B14: 2, K16: 1, K18: 1 });
  // the narrow preview width is the tight case
  const svg = renderRear(d, 430);
  for (const m of svg.matchAll(/font-size="6\.4"[^>]*>([^<]*)</g)) {
    assert.equal(m[1].length <= 64, true, `title too long for its box: ${m[1]}`);
  }
});

/* ------------------------------------------------------------------ ruler */

test('the scale expands where the options differ, without hiding the rest', () => {
  const svg = renderRuler(derive({ B13: 1, B10: 1, B1003: 1 }));

  // the coverage bar still begins at the very left, because the option does
  // cover everything below the expanded range
  const bar = svg.match(/<rect x="([\d.]+)" y="[\d.]+" width="([\d.]+)" height="9"/);
  assert.ok(bar, 'a coverage bar is drawn');
  assert.equal(Number(bar[1]), 4, 'the bar starts at the left edge');

  // and the compressed segment is labelled rather than dropped
  assert.match(svg, /100 k</);
  assert.match(svg, /LF–UHF/);
  assert.match(svg, /Every option covers 100 kHz upward/);
});

test('adjacent frequency options are far enough apart to tell apart', () => {
  // the old scale ran from 100 kHz, which put 3 GHz at 77% of the width and
  // left the closest pair of options 0.7% apart
  const endOf = id => {
    const svg = renderRuler(derive({ B13: 1, B10: 1, [id]: 1 }));
    const m = svg.match(/<rect x="[\d.]+" y="[\d.]+" width="([\d.]+)" height="9"/);
    return Number(m[1]);
  };
  const ladder = ['B1003', 'B1006', 'B1007', 'B1012', 'B1020', 'B1031', 'B1040', 'B1044', 'B1056', 'B1067'];
  const widths = ladder.map(endOf);

  for (let i = 1; i < widths.length; i++) {
    assert.ok(widths[i] > widths[i - 1], `${ladder[i]} should reach past ${ladder[i - 1]}`);
  }
  // the tightest pair, 40 and 44 GHz, must still be visibly different
  const total = 352 - 4;
  const gaps = widths.slice(1).map((w, i) => (w - widths[i]) / total * 100);
  assert.ok(Math.min(...gaps) > 1.5,
    `closest options only ${Math.min(...gaps).toFixed(1)}% apart`);
  // and the lowest option should not be crammed against the right hand end
  assert.ok(widths[0] / total < 0.45, '3 GHz should sit well inside the scale');
});

test('the bar length follows the frequency option', () => {
  const width = id => Number(renderRuler(derive({ B13: 1, B10: 1, [id]: 1 }))
    .match(/<rect x="[\d.]+" y="[\d.]+" width="([\d.]+)" height="9"/)[1]);
  assert.ok(width('B1067') > width('B1020'), '67 GHz should reach further than 20 GHz');
  assert.ok(width('B1020') > width('B1003'), '20 GHz should reach further than 3 GHz');
});

test('every SVG reference resolves inside its own drawing', () => {
  // a url(#x) with no matching id renders as no paint, or drops the element
  // entirely in the case of a filter - and the drawing still looks plausible,
  // which is how a deleted defs block went unnoticed
  const d = derive({ B13T: 1, B10: 2, B1044: 1, B2020: 1, B94L: 1, B14: 2, K16: 1, K18: 1 });
  const drawings = {
    front: renderFront(d, {}, 'front'),
    rear: renderRear(d, 980, 'rear'),
    chain: renderChain(d, { B13T: 1, B10: 2 }),
    ruler: renderRuler(d)
  };
  for (const [name, svg] of Object.entries(drawings)) {
    const defined = new Set([...svg.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
    const used = [...svg.matchAll(/url\(#([^)]+)\)/g)].map(m => m[1]);
    for (const ref of used) {
      assert.ok(defined.has(ref), `${name} references #${ref} but never defines it`);
    }
  }
});

test('two drawings on one page do not share element ids', () => {
  const d = derive({ B13: 1, B10: 1, B1003: 1 });
  const ids = svg => new Set([...svg.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  const hero = ids(renderFront(d, {}, 'hero'));
  const zoom = ids(renderFront(d, {}, 'zoom'));
  for (const id of hero) {
    assert.equal(zoom.has(id), false, `both drawings define #${id}`);
  }
});

/* ---------------------------------------------------------- photo overlay */

test('the photograph overlay follows the configuration', () => {
  const front = sel => renderPhoto(derive(sel), 'front');

  // a single path: RF B is marked absent, path B I/Q with it
  const one = front({ B13: 1, B10: 1, B1003: 1 });
  assert.match(one, /RF A/);
  assert.match(one, /RF B none/, 'path B should read as absent');

  // B81 moves path A and its I/Q to the rear
  const moved = front({ B13: 1, B10: 1, B1003: 1, B81: 1 });
  assert.match(moved, /RF A → rear/);
  assert.equal(/RF A → rear/.test(one), false, 'not relocated without B81');

  // the rear then shows it as fitted there
  const rear = renderPhoto(derive({ B13: 1, B10: 1, B1003: 1, B81: 1 }), 'rear');
  assert.match(rear, /RF A/);
  assert.match(rear, /RF B → front/);
});

test('the overlay says when a configuration exceeds the photographed instrument', () => {
  const many = renderPhoto(derive({ B13T: 1, B10: 2, B1003: 1, B2003: 1, B14: 2 }), 'rear');
  assert.match(many, /more than the photographed instrument carries/);
  const few = renderPhoto(derive({ B13: 1, B10: 1, B1003: 1 }), 'rear');
  assert.equal(/more than the photographed/.test(few), false);
});

test('the overlay shares the photograph geometry and produces no stray numbers', () => {
  for (const face of ['front', 'rear']) {
    const svg = renderPhoto(derive({ B13T: 1, B10: 2, B1003: 1, B2003: 1 }), face);
    assert.match(svg, /viewBox="0 0 1280 720"/, `${face} overlay must match the image`);
    assert.equal(/NaN|Infinity|undefined/.test(svg), false, `${face} overlay has a bad value`);
    assert.match(svg, /<img src="[^"]+" alt="/, `${face} has no image`);
  }
});
