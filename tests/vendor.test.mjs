/**
 * Rules that came out of comparing the catalog with the R&S online
 * configurator (docs/vendor/, captured 2026-09-02). Each test names the
 * source that decided it: the configuration guide v06.00 where it speaks,
 * the vendor's rule engine where the guide is silent or was shown to be
 * incomplete, and the specifications where they settle a disagreement.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { BY_ID, EXTRAS } from '../assets/js/catalog.js';
import { validate } from '../assets/js/rules.js';

const titles = sel => validate(sel).errors.map(e => e.id);
const ok = sel => validate(sel).ok;

/* ----------------------------------------------------------- RF options */

test('K553: one licence per RF path, each path with its own 6 GHz option (guide steps 4 and 7, vendor)', () => {
  assert.ok(ok({ B1006: 1, B13: 1, B10: 1, K553: 1 }), 'a 6 GHz path A option is enough for one licence');
  assert.ok(titles({ B1003: 1, B13: 1, B10: 1, K553: 1 }).includes('req-K553'), '3 GHz is below the floor');
  assert.ok(titles({ B1006: 1, B13T: 1, B2003: 1, B10: 1, K553: 2 }).includes('qty-K553'),
    'a 3 GHz path B cannot carry the second licence');
  assert.ok(ok({ B1006: 1, B13T: 1, B2006: 1, B10: 1, K553: 2 }), 'two qualifying paths, two licences');
});

test('K554: 20 GHz or higher in the path where it is used (vendor; guide v06.00 has no entry)', () => {
  assert.ok(titles({ B1003: 1, B13: 1, B10: 1, K554: 1 }).includes('req-K554'));
  assert.ok(titles({ B1006: 1, B13: 1, B10: 1, K554: 1 }).includes('req-K554'));
  assert.ok(ok({ B1020: 1, B13: 1, B10: 1, K554: 1 }));
  assert.ok(titles({ B1020: 1, B13T: 1, B2006: 1, B10: 1, K554: 2 }).includes('qty-K554'),
    'a 6 GHz path B cannot carry the second licence');
  assert.ok(ok({ B1020: 1, B13T: 1, B2020: 1, B10: 1, K554: 2 }));
});

test('rear connectors: B83 accepts B1040N; B82 and B84 accept either path A rear option (vendor)', () => {
  assert.ok(ok({ B1040N: 1, B13: 1, B10: 1, B83: 1 }));
  assert.ok(ok({ B1020: 1, B13T: 1, B2006: 1, B10: 1, B83: 1, B82: 1 }), 'B82 on a 20 GHz / 6 GHz instrument');
  assert.ok(ok({ B1006: 1, B13T: 1, B2020: 1, B10: 1, B81: 1, B84: 1 }), 'B84 on a 6 GHz / 20 GHz instrument');
  assert.ok(titles({ B1020: 1, B13T: 1, B2006: 1, B10: 1, B82: 1 }).includes('req-B82'));
});

/* --------------------------------------------------------- baseband */

test('K546 Digital Doherty needs B90 phase coherence (specifications and vendor; guide v06.00 omits it)', () => {
  const base = { B1006: 1, B13T: 1, B2006: 1, B10: 2, K541: 2, K546: 1 };
  assert.ok(titles(base).includes('req-K546'));
  assert.ok(ok({ ...base, B90: 1 }));
});

test('K544 needs a baseband generator as well as the main module (vendor)', () => {
  assert.ok(titles({ B1003: 1, B13: 1, K544: 1 }).includes('req-K544'));
  assert.ok(ok({ B1003: 1, B13: 1, B10: 1, K544: 1 }));
});

test('K69, K81, K175: the second unit counts K55 and K115 together (guide "two R&S SMW-K55/-K115")', () => {
  assert.ok(ok({ B1003: 1, B13T: 1, B10: 2, K55: 1, K115: 1, K69: 2 }));
  assert.ok(ok({ B1003: 1, B13T: 1, B10: 2, K55: 1, K144: 1, K81: 2 }));
  assert.ok(ok({ B1003: 1, B13T: 1, B10: 2, K55: 1, K144: 1, K175: 2 }));
  assert.ok(titles({ B1003: 1, B13T: 1, B10: 2, K55: 1, K69: 2 }).includes('qty-K69'));
});

test('K146 runs on K115 alone (vendor; guide v06.00 lists K143)', () => {
  assert.ok(ok({ B1003: 1, B13: 1, B10: 1, K115: 1, K146: 1 }));
  assert.ok(titles({ B1003: 1, B13: 1, B10: 1, K146: 1 }).includes('req-K146'));
});

/* ------------------------------------------------------------ fading */

test('B15: once with one B9; two or four with two B9; never one with two (guide step 14, vendor)', () => {
  assert.ok(ok({ B1044: 1, B13XT: 1, B9: 1, B15: 1 }));
  assert.ok(titles({ B1044: 1, B13XT: 1, B9: 1, B15: 2 }).includes('qty-B15'), 'two B15 need two B9');
  assert.ok(titles({ B1044: 1, B13XT: 1, B9: 2, B15: 1 }).includes('b15-odd'));
  assert.ok(ok({ B1044: 1, B13XT: 1, B9: 2, B15: 2 }));
  assert.ok(ok({ B1044: 1, B13XT: 1, B9: 2, B15: 4 }));
});

test('K75 higher-order MIMO needs four fading simulators (vendor and specifications)', () => {
  const two = { B1044: 1, B13XT: 1, B9: 2, B15: 2, K74: 1, K75: 1 };
  assert.ok(titles(two).includes('req-K75'));
  assert.ok(ok({ ...two, B15: 4 }));
  const std = { B1006: 1, B13T: 1, B2006: 1, B10: 2, B14: 2, K74: 1, K75: 1 };
  assert.ok(titles(std).includes('req-K75'));
  assert.ok(ok({ ...std, B14: 4 }));
});

/* -------------------------------------------------------------- GNSS */

test('K108, K109, K122, K123, K128 need the wideband generator (vendor; guide v06.00 names none)', () => {
  assert.ok(titles({ B1003: 1, B13T: 1, B10: 2, K44: 1, K108: 1 }).includes('req-K108'));
  assert.ok(ok({ B1003: 1, B13XT: 1, B9: 1, K44: 1, K108: 1, K109: 1, K122: 1 }));
  assert.ok(titles({ B1003: 1, B13: 1, B10: 1, K123: 1 }).includes('req-K123'));
  assert.ok(ok({ B1003: 1, B13XT: 1, B9: 1, K123: 1, K128: 1 }));
});

test('GNSS channel packs: several times, up to 612 channels in total (guide "several times", GNSS specs)', () => {
  assert.ok(ok({ B1003: 1, B13XT: 1, B9: 1, K44: 1, K136: 5 }));
  assert.ok(ok({ B1003: 1, B13XT: 1, B9: 1, K44: 1, K139: 12 }), '12 × 48 = 576 extra channels');
  assert.ok(titles({ B1003: 1, B13XT: 1, B9: 1, K44: 1, K139: 12, K138: 1 }).includes('gnss-channels-max'));
});

test('waveform packages: only the 250-waveform ceiling limits them (guide step 12)', () => {
  assert.ok(ok({ B1003: 1, B13: 1, B10: 1, 'K200-1': 25 }));
  assert.ok(ok({ B1003: 1, B13: 1, B10: 1, 'K200-5': 50 }));
  assert.ok(titles({ B1003: 1, B13: 1, B10: 1, 'K200-5': 50, 'K200-1': 1 }).includes('waveforms'));
});

/* --------------------------------------------------------------- data */

test('options the vendor lists that guide v06.00 does not, with the vendor\'s rules', () => {
  const added = {
    K184: ['1434.9169.02', 'K144'], K185: ['1434.9223.02', 'K54'], K180: ['1434.8433.02', 'GEN'],
    K181: ['1434.9017.02', 'K149'], K182: ['1434.9052.02', 'K181'], K183: ['1434.9100.02', 'K116'],
    K484: ['1434.9181.02', 'K444'], K485: ['1434.9246.02', 'K254'], K480: ['1434.8456.02', 'GEN'],
    K481: ['1434.9030.02', 'K449'], K482: ['1434.9075.02', 'K481'], K483: ['1434.9123.02', 'K416'],
    K111: ['1414.3059.02', 'GEN'], K363: ['1434.8179.02', 'K44&K66&K94&K107&K108']
  };
  for (const [id, [order, requires]] of Object.entries(added)) {
    const o = BY_ID[id];
    assert.ok(o, `${id} is in the catalog`);
    assert.equal(o.order, order, `${id} order number`);
    assert.equal(o.requires, requires, `${id} requirement`);
    assert.equal(o.since, 'vendor', `${id} is marked as coming from the vendor configurator`);
  }
  assert.ok(titles({ B1003: 1, B13: 1, B10: 1, K184: 1 }).includes('req-K184'));
  assert.ok(ok({ B1003: 1, B13: 1, B10: 1, K144: 1, K184: 1 }));
  assert.equal(BY_ID.K363.max, 1);
});

test('order numbers the guide left out come from the vendor and the specifications', () => {
  assert.equal(BY_ID.K980.order, '1414.6893.02');
  assert.equal(BY_ID.K309.order, '1414.6706.02');
  const extras = Object.fromEntries(EXTRAS.flatMap(g => g.items).map(it => [it.id, it.order]));
  assert.equal(extras['ZZA-KN4B'], '1703.1346.00');
  assert.equal(extras['BBCABLE-2M'], '3716.5425.00');
  assert.equal(extras['SMW-T0'], '1414.6970.23');
});

test('requirement wording is the guide\'s, not the shorthand', () => {
  assert.equal(BY_ID.K40.reqText, 'R&S®SMW-B9/-B10');
  assert.equal(BY_ID.K141.reqText, 'R&S®SMW-B9 and R&S®SMW-K525 and R&S®SMW-K527');
  assert.equal(BY_ID.K69.reqText, 'R&S®SMW-K55/-K115');
  assert.equal(BY_ID.K554.reqText,
    'a frequency option of 20 GHz or higher in RF path A or a frequency option of 20 GHz or higher in RF path B');
  assert.ok(!BY_ID.K129.reqText.includes('R and S'));
});
