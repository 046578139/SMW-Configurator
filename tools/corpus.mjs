/**
 * The behaviour corpus: what the engine says about a few thousand
 * configurations, recorded so a refactor can prove it changed nothing.
 *
 *   node tools/corpus.mjs            writes tests/fixtures/corpus.json.gz
 *   node --test tests/corpus.test.mjs   compares the engine against it
 *
 * The cases: every starting point, every option on its own, every option
 * with each RF path A frequency option and with each baseband main module,
 * the two-path combinations the guide allows, and a few hundred random
 * selections from a fixed seed. For each, the validation (issue ids in
 * order, with their fixes, drops, swaps and quantity settings, and a hash of
 * the wording), what auto-resolve makes of it, the derived capabilities and
 * the parts list.
 *
 * Regenerate it only when the catalog or a rule changed on purpose; the
 * diff of the fixture is then the record of what the change did. The file
 * is gzipped because it is a snapshot, not something to read.
 */

import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { corpusCases, describeCase } from '../tests/corpus-lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'tests/fixtures/corpus.json.gz');

const cases = corpusCases();
const t0 = Date.now();
const records = cases.map(c => ({ name: c.name, sel: c.sel, ...describeCase(c.sel) }));
const json = JSON.stringify({ version: 1, generatedAt: new Date().toISOString(), cases: records });
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, gzipSync(Buffer.from(json), { level: 9 }));
const digest = createHash('sha256').update(json).digest('hex').slice(0, 12);
console.log(`${records.length} cases in ${((Date.now() - t0) / 1000).toFixed(1)} s -> ${out} (${(json.length / 1024).toFixed(0)} kB raw, digest ${digest})`);
