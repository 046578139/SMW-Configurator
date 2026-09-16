/**
 * The saved-configurations list: its two layers and what happens between
 * them. The hosted layer is stood in for by a small in-memory document store
 * with the same shape as the artifact's - collection, doc, set, delete, a
 * snapshot on every write with the contract's metadata, and an error
 * callback - so the cases that matter can be driven: a refused write, a
 * store that is briefly away, a first delivery served from a cache, a
 * subscription that dies.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { SavedStore, packSel, unpackSel, summarize, SAVED_KEY } from '../assets/js/saved.js';

const memory = () => {
  const m = new Map();
  return { get: k => (m.has(k) ? m.get(k) : null), set: (k, v) => m.set(k, v), m };
};

function fakeDb (seed = [], { firstFromCache = false } = {}) {
  const docs = new Map(seed.map(({ id, ...body }) => [id, body]));
  const listeners = [];
  const log = [];
  let deliveries = 0;
  let rejectSet = null, rejectDelete = null;
  const snapshot = () => ({
    docs: [...docs.entries()]
      .sort((x, y) => String(y[1].savedAt).localeCompare(String(x[1].savedAt)))
      .map(([id, body]) => ({ id, exists: true, data: () => body })),
    metadata: { fromCache: firstFromCache && deliveries === 0, hasPendingWrites: false }
  });
  const notify = () => { const s = snapshot(); deliveries++; for (const l of listeners) l.next(s); };
  const die = code => { for (const l of listeners) l.error?.({ code, message: code }); listeners.length = 0; };
  return {
    docs, log,
    failNextSet (code) { rejectSet = code; },
    failNextDelete (code) { rejectDelete = code; },
    refresh: notify,                              // the periodic redelivery of an unchanged view
    die,
    remoteWrite (id, body) { docs.set(id, body); notify(); },  // another viewer, from their browser
    collection: () => ({
      orderBy: () => ({ limit: () => ({
        onSnapshot: (next, error) => { listeners.push({ next, error }); queueMicrotask(notify); return () => {}; }
      }) }),
      doc: id => ({
        async set (body) {
          log.push(['set', id]);
          if (rejectSet) { const code = rejectSet; rejectSet = null; throw { code, message: code }; }
          docs.set(id, { ...body }); notify();
        },
        async delete () {
          log.push(['delete', id]);
          if (rejectDelete) { const code = rejectDelete; rejectDelete = null; throw { code, message: code }; }
          docs.delete(id); notify();
        }
      })
    })
  };
}

const settle = (ms = 5) => new Promise(r => setTimeout(r, ms));
const stored = storage => JSON.parse(storage.get(SAVED_KEY) || '[]');

test('the link token format round-trips a selection and drops what the catalog lacks', () => {
  const sel = { B1003: 1, B13: 1, 'K200-1': 30, K62: 2 };
  assert.equal(packSel(sel), 'B1003.B13.K200-1*30.K62*2');
  assert.deepEqual(unpackSel(packSel(sel)), sel);
  assert.deepEqual(unpackSel('B1003.valueOf.NOPE*3..K62*0'), { B1003: 1, K62: 1 });
  assert.deepEqual(unpackSel(''), {});
  assert.deepEqual(unpackSel(null), {});
});

test('a saved entry is summarised by path A, main module and size', () => {
  assert.equal(summarize({ B1020: 1, B13T: 1, B10: 1, K62: 2 }), 'B1020 · B13T · 5 options');
  assert.equal(summarize({ K62: 1 }), '1 option');
  assert.equal(summarize({}), '0 options');
});

test('saving keeps the list in this browser and saving under a name again updates it', () => {
  const storage = memory();
  const s = new SavedStore(storage);
  s.load();
  const first = s.save({ name: '  Two path  ', sel: { B1020: 1, B13T: 1, B10: 1 } });
  assert.equal(first.replaced, false);
  assert.equal(first.rec.name, 'Two path');
  assert.equal(first.rec.c, 'B1020.B13T.B10');
  assert.equal(first.rec.origin, 'local');
  const again = s.save({ name: 'Two path', sel: { B1020: 1, B13T: 1, B10: 2 } });
  assert.equal(again.replaced, true);
  assert.equal(again.rec.id, first.rec.id, 'the same name is the same entry');
  assert.equal(s.list.length, 1);
  assert.equal(s.list[0].c, 'B1020.B13T.B10*2');
  s.save({ name: '', sel: { B1003: 1 } });
  assert.equal(s.list[0].name, 'Untitled configuration');

  // a fresh store over the same storage sees the same list, newest first
  const t = new SavedStore(storage);
  assert.deepEqual(t.load().map(r => r.name), ['Untitled configuration', 'Two path']);
  assert.equal(t.remove(first.rec.id), true);
  assert.equal(t.remove('nope'), false);
  assert.equal(stored(storage).length, 1);
});

test('a broken, foreign or unusable storage value never reaches the list', () => {
  for (const raw of ['{', '"x"', '[1, {"id": 3}, {"id": "a"}]', null]) {
    const storage = memory();
    if (raw !== null) storage.set(SAVED_KEY, raw);
    assert.deepEqual(new SavedStore(storage).load(), []);
  }
  // an id is also a document path segment, so one that could not be a path is not a record
  const storage = memory();
  storage.set(SAVED_KEY, JSON.stringify([
    { id: 'a/b', name: 'x', c: 'B1003' }, { id: '', name: 'x', c: 'B1003' }, { id: 'ok-1', name: 'x', c: 'B1003' }]));
  assert.deepEqual(new SavedStore(storage).load().map(r => r.id), ['ok-1']);
});

test('without a host the list stays local and says so', async () => {
  const s = new SavedStore(memory());
  s.load();
  s.save({ name: 'A', sel: { B1003: 1 } });
  assert.equal(await s.connect(Promise.resolve(null)), false);
  assert.equal(await s.connect(Promise.reject(new Error('no host'))), false);
  assert.equal(s.hosted, false);
  assert.equal(s.list.length, 1);
});

test('with a host the page\'s list is the record and this browser\'s list its cache', async () => {
  const db = fakeDb([{ id: 'h1', name: 'From another browser', c: 'B1044.B13XT.B9', sum: 'B1044 · B13XT · 3 options', savedAt: '2026-09-10T10:00:00.000Z' }]);
  const storage = memory();
  const s = new SavedStore(storage);
  s.load();
  const local = s.save({ name: 'Saved before the host answered', sel: { B1003: 1, B13: 1 } });
  const changes = [];
  s.onChange(st => changes.push(st.list.map(r => r.name)));

  assert.equal(await s.connect(Promise.resolve(db)), true);
  await settle();
  assert.equal(s.hosted, true);
  assert.deepEqual(s.list.map(r => r.name).sort(), ['From another browser', 'Saved before the host answered']);
  // the local entry went up exactly once and is now a mirrored one
  assert.deepEqual(db.log.filter(l => l[0] === 'set').map(l => l[1]), [local.rec.id]);
  assert.ok(db.docs.has(local.rec.id));
  assert.ok(s.list.every(r => r.origin === 'hosted'));
  // and the cache is the hosted list
  assert.deepEqual(stored(storage).map(r => r.id).sort(), [local.rec.id, 'h1'].sort());

  // a save now goes to the page; a removal too
  const { rec } = s.save({ name: 'New', sel: { B1006: 1, B13: 1 } });
  await settle();
  assert.ok(db.docs.has(rec.id));
  assert.equal(db.docs.get(rec.id).c, 'B1006.B13');
  assert.equal(s.find(rec.id).origin, 'hosted');
  s.remove('h1');
  await settle();
  assert.ok(!db.docs.has('h1'));
  assert.ok(!s.list.some(r => r.id === 'h1'));

  // another viewer's write shows up without anything being done here
  db.remoteWrite('h2', { name: 'Theirs', c: 'B1003.B13', sum: 'B1003 · B13 · 2 options', savedAt: '2026-09-16T12:00:00.000Z' });
  await settle();
  assert.ok(s.list.some(r => r.name === 'Theirs'));
  assert.ok(changes.length >= 3, 'listeners were told');
});

test('a cached copy of a hosted entry is never sent back up', async () => {
  // the entry was deleted from the page by someone else while this browser
  // still held it in its cache: connecting must not resurrect it
  const storage = memory();
  storage.set(SAVED_KEY, JSON.stringify([
    { id: 'gone', name: 'Deleted elsewhere', c: 'B1003.B13', sum: '', savedAt: '2026-09-01T00:00:00.000Z', origin: 'hosted' },
    { id: 'mine', name: 'Never uploaded', c: 'B1006.B13', sum: '', savedAt: '2026-09-02T00:00:00.000Z', origin: 'local' }
  ]));
  const db = fakeDb();
  const s = new SavedStore(storage);
  s.load();
  await s.connect(Promise.resolve(db));
  await settle();
  assert.deepEqual(db.log.map(l => l[1]), ['mine']);
  assert.deepEqual(s.list.map(r => r.id), ['mine']);
});

test('an entry the page refused stays in this browser through later snapshots and a reload', async () => {
  const db = fakeDb([{ id: 'h1', name: 'Theirs', c: 'B1003.B13', sum: '', savedAt: '2026-09-10T10:00:00.000Z' }]);
  const storage = memory();
  const s = new SavedStore(storage);
  s.load();
  await s.connect(Promise.resolve(db));
  await settle();
  db.failNextSet('quota_exceeded');
  const { rec } = s.save({ name: 'Too many', sel: { B1003: 1 } });
  await settle();
  assert.deepEqual(s.lastError, { code: 'quota_exceeded', what: 'save' });
  assert.equal(s.find(rec.id).origin, 'local', 'a refused write does not make a hosted entry');
  assert.ok(!db.docs.has(rec.id));

  // the periodic redelivery, another viewer's save, and the user's own next
  // save all bring snapshots - none of them may drop what the page refused
  db.refresh();
  await settle();
  assert.ok(s.find(rec.id), 'gone on a redelivery');
  db.remoteWrite('h2', { name: 'Other viewer', c: 'B1006.B13', sum: '', savedAt: '2026-09-16T12:00:00.000Z' });
  await settle();
  assert.ok(s.find(rec.id), 'gone on another viewer\'s write');
  s.save({ name: 'Fine', sel: { B1006: 1 } });
  await settle();
  assert.ok(s.find(rec.id), 'gone on the next successful save');
  assert.ok(stored(storage).some(r => r.id === rec.id && r.origin === 'local'), 'not in the cache');

  // a reload: the entry is still there and is offered to the page once more
  const t = new SavedStore(storage);
  t.load();
  assert.ok(t.find(rec.id));
  const before = db.log.length;
  await t.connect(Promise.resolve(db));
  await settle();
  assert.ok(t.find(rec.id));
  assert.deepEqual(db.log.slice(before), [['set', rec.id]]);
  assert.equal(t.find(rec.id).origin, 'hosted', 'the page took it this time');
});

test('a store that is briefly away gets one more try, for a write and for a removal', async () => {
  const db = fakeDb([{ id: 'h1', name: 'Theirs', c: 'B1003.B13', sum: '', savedAt: '2026-09-10T10:00:00.000Z' }]);
  const s = new SavedStore(memory());
  s.load();
  await s.connect(Promise.resolve(db));
  await settle();
  db.failNextSet('unavailable');
  const { rec } = s.save({ name: 'Flaky', sel: { B1003: 1 } });
  await settle(900);
  assert.equal(s.lastError, null);
  assert.ok(db.docs.has(rec.id));
  assert.equal(db.log.filter(l => l[1] === rec.id).length, 2, 'one retry, no more');
  assert.equal(s.find(rec.id).origin, 'hosted');
  db.failNextDelete('unavailable');
  s.remove('h1');
  await settle(900);
  assert.ok(!db.docs.has('h1'));
  assert.equal(s.lastError, null);
  // and a removal the page refuses for good is reported as a removal
  db.remoteWrite('h3', { name: 'Stuck', c: 'B1003', sum: '', savedAt: '2026-09-17T00:00:00.000Z' });
  await settle();
  db.failNextDelete('invalid_argument');
  s.remove('h3');
  await settle();
  assert.deepEqual(s.lastError, { code: 'invalid_argument', what: 'remove' });
});

test('a first delivery served from a cache is shown but not written down', async () => {
  const db = fakeDb([{ id: 'h1', name: 'Theirs', c: 'B1003.B13', sum: '', savedAt: '2026-09-10T10:00:00.000Z' }], { firstFromCache: true });
  const storage = memory();
  const s = new SavedStore(storage);
  s.load();
  const local = s.save({ name: 'Mine', sel: { B1006: 1 } });
  await s.connect(Promise.resolve(db));
  await settle();
  // the cached view is on screen, but nothing has been sent or cached yet
  assert.deepEqual(s.list.map(r => r.name).sort(), ['Mine', 'Theirs']);
  assert.equal(db.log.length, 0);
  assert.deepEqual(stored(storage).map(r => r.id), [local.rec.id]);
  // the definitive delivery settles it
  db.refresh();
  await settle();
  assert.deepEqual(db.log, [['set', local.rec.id]]);
  assert.deepEqual(stored(storage).map(r => r.id).sort(), [local.rec.id, 'h1'].sort());
});

test('a subscription that dies leaves the list as it was and further saves local', async () => {
  const db = fakeDb([{ id: 'h1', name: 'Theirs', c: 'B1003.B13', sum: '', savedAt: '2026-09-10T10:00:00.000Z' }]);
  const s = new SavedStore(memory());
  s.load();
  await s.connect(Promise.resolve(db));
  await settle();
  assert.equal(s.hosted, true);
  db.die('revoked');
  assert.equal(s.hosted, false);
  assert.equal(s.db, null);
  assert.deepEqual(s.lastError, { code: 'revoked', what: 'subscribe' });
  assert.ok(s.find('h1'), 'what was last seen stays');
  const before = db.log.length;
  const { rec } = s.save({ name: 'After', sel: { B1003: 1 } });
  await settle();
  assert.equal(db.log.length, before, 'nothing more is sent');
  assert.equal(rec.origin, 'local');
});
