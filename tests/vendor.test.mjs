/**
 * Rules that came out of comparing the catalog with the R&S online
 * configurator (docs/vendor/, captured 2026-09-02). Each test names the
 * source that decided it: the configuration guide v06.00 where it speaks,
 * the vendor's rule engine where the guide is silent or was shown to be
 * incomplete, and the specifications where they settle a disagreement.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { BY_ID, EXTRAS, RF_PATH_MATRIX } from '../assets/js/catalog.js';
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

test('the cellular IoT chain hangs on K115, as the vendor has it (guide v06.00 differs)', () => {
  assert.ok(ok({ B1003: 1, B13: 1, B10: 1, K115: 1, K146: 1 }), 'K146 without K143');
  assert.ok(titles({ B1003: 1, B13: 1, B10: 1, K146: 1 }).includes('req-K146'));
  assert.ok(ok({ B1003: 1, B13: 1, B10: 1, K115: 1, K143: 1 }));
  assert.ok(titles({ B1003: 1, B13: 1, B10: 1, K143: 1 }).includes('req-K143'), 'K143 needs K115 too');
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

test('the GNSS options the specifications mark wideband-only need R&S SMW-B9/-B9F', () => {
  // GNSS specifications PD 3607.6896.22, option table: K122, K123, K128, K129,
  // K134, K135, K136-K139 and K360-K363 are listed for the R&S SMW-B9(F) column
  // only, while K108 and K109 are listed for both generator families.
  assert.ok(titles({ B1003: 1, B13: 1, B10: 1, K44: 1, K122: 1 }).includes('req-K122'));
  assert.ok(titles({ B1003: 1, B13: 1, B10: 1, K123: 1 }).includes('req-K123'));
  assert.ok(titles({ B1003: 1, B13: 1, B10: 1, K44: 1, K94: 1, K360: 1 }).includes('req-K360'));
  assert.ok(titles({ B1003: 1, B13: 1, B10: 1, K44: 1, K66: 1, K106: 1, K361: 1 }).includes('req-K361'));
  assert.ok(titles({ B1003: 1, B13: 1, B10: 1, K44: 1, K362: 1 }).includes('req-K362'));
  assert.ok(ok({ B1003: 1, B13XT: 1, B9: 1, K44: 1, K94: 1, K66: 1, K106: 1, K122: 1, K123: 1, K128: 1, K360: 1, K361: 1, K362: 1 }));
});

test('K108 and K109 also run on the standard generator (guide v06.00 and GNSS specifications)', () => {
  // The R&S online configurator offers them only with R&S SMW-B9/-B9F; both
  // paper sources list them for R&S SMW-B10 as well, so the guide stands.
  assert.ok(ok({ B1003: 1, B13T: 1, B10: 1, K44: 1, K108: 1, K109: 1 }));
  assert.ok(titles({ B1003: 1, B13: 1, B10: 1, K108: 1 }).includes('req-K108'), 'a GNSS standard is still needed');
});

test('GNSS channels are capped by the installed boards, not by a flat number', () => {
  // GNSS specifications PD 3607.6896.22: 102 channels per wideband generator or
  // fading simulator, 24 of them included with the instrument.
  const one = { B1003: 1, B13XT: 1, B9: 1, K44: 1 };
  assert.ok(ok({ ...one, K136: 5 }), '24 + 30 fits in 102');
  assert.ok(ok({ ...one, K139: 1 }), '24 + 48 fits in 102');
  assert.ok(titles({ ...one, K139: 2 }).includes('gnss-channels-max'), '24 + 96 does not');
  const full = { B1003: 1, B13XT: 1, B9: 2, B15: 4, K44: 1 };
  assert.ok(ok({ ...full, K139: 12 }), '24 + 576 fits in 612');
  assert.ok(titles({ ...full, K139: 12, K138: 1 }).includes('gnss-channels-max'), '24 + 600 does not');
});

test('waveform packages: only the 250-waveform ceiling limits them (guide step 12)', () => {
  assert.ok(ok({ B1003: 1, B13: 1, B10: 1, 'K200-1': 25 }));
  assert.ok(ok({ B1003: 1, B13: 1, B10: 1, 'K200-5': 50 }));
  assert.ok(titles({ B1003: 1, B13: 1, B10: 1, 'K200-5': 50, 'K200-1': 1 }).includes('waveforms'));
});

test('a proposed fix never names an RF path B option the path A option cannot carry', () => {
  for (const [sel, opt] of [[{ B1003: 1, B13: 1, B10: 1, K553: 1 }, 'K553'],
                            [{ B1003: 1, B13: 1, B10: 1, K554: 1 }, 'K554'],
                            [{ B1012: 1, B13: 1, B10: 1, K554: 1 }, 'K554']]) {
    const issue = validate(sel).errors.find(e => e.id === `req-${opt}`);
    assert.ok(issue, `${opt} is reported`);
    const a = Object.keys(sel).find(id => BY_ID[id]?.step === 1);
    for (const id of issue.fix) {
      if (BY_ID[id].step !== 5) continue;
      assert.ok(RF_PATH_MATRIX[a].includes(id), `${id} cannot be paired with ${a}`);
    }
  }
});

/* --------------------------------------------------------------- data */

test('options the vendor lists that guide v06.00 does not, with the vendor\'s rules', () => {
  const added = {
    K184: ['1434.9169.02', 'K144'], K185: ['1434.9223.02', 'K54'], K180: ['1434.8433.02', 'GEN'],
    K181: ['1434.9017.02', 'K149'], K182: ['1434.9052.02', 'K181'], K183: ['1434.9100.02', 'K116'],
    K484: ['1434.9181.02', 'K444'], K485: ['1434.9246.02', 'K254'], K480: ['1434.8456.02', 'GEN'],
    K481: ['1434.9030.02', 'K449'], K482: ['1434.9075.02', 'K481'], K483: ['1434.9123.02', 'K416'],
    K111: ['1414.3059.02', 'GEN'], K363: ['1434.8179.02', 'WGEN&K44&K66&K94&K107&K108']
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
  assert.equal(BY_ID.K554.reqText, 'Frequency option with 20 GHz or higher in the path where it is used');
  assert.equal(BY_ID.K122.reqText, 'R&S®SMW-B9/-B9F and one GNSS standard');
  assert.ok(!BY_ID.K129.reqText.includes('R and S'));
});
