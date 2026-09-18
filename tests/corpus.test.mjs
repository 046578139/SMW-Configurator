/**
 * The engine against its recorded behaviour: every case in the corpus must
 * validate, resolve, derive and list exactly as it did when the fixture was
 * written. A difference is either a regression or a deliberate change; for
 * the latter, regenerate with `node tools/corpus.mjs` and commit the fixture
 * with the change that caused it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

import { corpusCases, describeCase } from './corpus-lib.mjs';

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/corpus.json.gz', import.meta.url))).toString());

test('the corpus has the cases the generator produces', () => {
  const now = corpusCases();
  assert.equal(fixture.cases.length, now.length, 'the case list changed - regenerate the fixture');
  now.forEach((c, i) => assert.equal(fixture.cases[i].name, c.name, `case ${i} is ${c.name}, the fixture has ${fixture.cases[i].name}`));
});

test('every recorded case still validates, resolves, derives and lists the same way', () => {
  const diffs = [];
  for (const rec of fixture.cases) {
    const now = describeCase(rec.sel);
    const a = JSON.stringify(now), b = JSON.stringify({ validation: rec.validation, resolved: rec.resolved, resolvedOk: rec.resolvedOk, derived: rec.derived, vitals: rec.vitals, bom: rec.bom, summary: rec.summary });
    if (a !== b) {
      const which = Object.keys(now).filter(k => JSON.stringify(now[k]) !== JSON.stringify(rec[k]));
      diffs.push(`${rec.name}: ${which.join(', ')}`);
    }
  }
  assert.deepEqual(diffs.slice(0, 20), [], `${diffs.length} of ${fixture.cases.length} cases differ`);
});
