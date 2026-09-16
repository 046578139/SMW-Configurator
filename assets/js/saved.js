/**
 * Saved configurations.
 *
 * A configuration is kept under its name as the same token string the link
 * carries ("B1003.B13.K200-1*30"), so a saved entry is a link with a name and
 * a date, and loading one is decoding a link. Two layers hold the list:
 *
 *   - the browser's own storage, always, so saving works wherever the page is
 *     served and the list is there on the next visit from the same browser;
 *   - the artifact's document store when the page runs on claude.ai, which
 *     every viewer of the page shares - a configuration saved there is on the
 *     page for the next person who opens it, in any browser.
 *
 * When the hosted store is reachable it is the record and the local list is
 * its cache: the hosted list replaces the local one, and anything saved
 * locally before the store answered is sent up once. When it is not - a
 * static server, a saved file, a host that never answers - the local list is
 * all there is, and the page says so.
 */

import { BY_ID } from './catalog.js';
import { freqA, mainModule } from './rules.js';

export const SAVED_KEY = 'smw200a-saved-v1';

/** The selection as the link carries it. */
export const packSel = sel => Object.entries(sel).filter(([, q]) => q > 0)
  .map(([id, q]) => (q > 1 ? `${id}*${q}` : id)).join('.');

/** A link's token string back to a selection; unknown ids are dropped. */
export function unpackSel (str) {
  const sel = {};
  for (const token of String(str || '').split('.')) {
    if (!token) continue;
    const [id, qty] = token.split('*');
    if (BY_ID[id]) sel[id] = Math.max(1, parseInt(qty || '1', 10) || 1);
  }
  return sel;
}

/** "B1020 · B13T · 7 options" - enough to tell saved entries apart. */
export function summarize (sel) {
  const parts = [];
  const a = freqA(sel);
  const mm = mainModule(sel);
  if (a) parts.push(a.id);
  if (mm) parts.push(mm);
  const n = Object.values(sel).reduce((s, q) => s + (q > 0 ? q : 0), 0);
  parts.push(`${n} option${n === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const byDate = (x, y) => (y.savedAt || '').localeCompare(x.savedAt || '');

/**
 * The list, with its two layers behind one interface.
 *
 * `storage` is a {get, set} pair over string keys that never throws (the
 * page's own wrapper around localStorage). `connect()` takes the promise
 * `claude.use('db')` returns and does the right thing with null.
 */
export class SavedStore {
  constructor (storage) {
    this.storage = storage;
    this.list = [];
    this.hosted = false;
    this.db = null;
    this.listeners = [];
  }

  onChange (fn) { this.listeners.push(fn); }
  emit () { for (const fn of this.listeners) fn(this); }

  /** Reads the local layer. Safe to call before the DOM exists. */
  load () {
    try {
      const raw = JSON.parse(this.storage.get(SAVED_KEY) || '[]');
      this.list = Array.isArray(raw)
        ? raw.filter(r => r && typeof r.id === 'string' && typeof r.name === 'string' && typeof r.c === 'string')
        : [];
    } catch { this.list = []; }
    this.list.sort(byDate);
    return this.list;
  }

  persist () {
    this.storage.set(SAVED_KEY, JSON.stringify(this.list));
    this.emit();
  }

  find (id) { return this.list.find(r => r.id === id) || null; }

  /**
   * Saves under the name, replacing an entry that already carries it - the
   * name field in the header is the handle, so saving twice updates rather
   * than piling up copies. Returns the record and whether it replaced one.
   */
  save ({ name, sel }) {
    const clean = String(name || '').trim() || 'Untitled configuration';
    const prior = this.list.find(r => r.name === clean);
    const rec = {
      id: prior ? prior.id : newId(),
      name: clean,
      c: packSel(sel),
      sum: summarize(sel),
      savedAt: new Date().toISOString(),
      origin: this.hosted ? 'hosted' : 'local'
    };
    this.list = [rec, ...this.list.filter(r => r.id !== rec.id)];
    this.persist();
    if (this.db) this.push(rec);
    return { rec, replaced: !!prior };
  }

  remove (id) {
    const had = this.find(id);
    this.list = this.list.filter(r => r.id !== id);
    this.persist();
    if (this.db && had) {
      this.db.collection('configs').doc(id).delete().catch(err => this.fail(err, 'remove'));
    }
    return !!had;
  }

  /** Writes one record to the hosted store. */
  push (rec) {
    const body = { name: rec.name, c: rec.c, sum: rec.sum, savedAt: rec.savedAt };
    return this.db.collection('configs').doc(rec.id).set(body)
      .then(() => { rec.origin = 'hosted'; })
      .catch(err => this.fail(err, 'save'));
  }

  fail (err, what) {
    this.lastError = { code: err?.code || 'unavailable', what };
    this.emit();
  }

  /**
   * Attaches the hosted layer. `dbPromise` resolves to the store's namespace
   * or null; nothing about the page waits for it.
   */
  async connect (dbPromise) {
    let db = null;
    try { db = await dbPromise; } catch { db = null; }
    if (!db) return false;
    this.db = db;
    let first = true;
    db.collection('configs').orderBy('savedAt', 'desc').limit(500).onSnapshot(snap => {
      const hosted = snap.docs.filter(d => d.exists).map(d => {
        const b = d.data() || {};
        return { id: d.id, name: String(b.name || ''), c: String(b.c || ''),
          sum: String(b.sum || ''), savedAt: String(b.savedAt || ''), origin: 'hosted' };
      }).filter(r => r.name && typeof r.c === 'string');
      /* Anything saved into the local list before the store answered has not
         been sent yet; mirrored entries have, and are never sent again - that
         would bring back a configuration someone else deleted. */
      const pending = first ? this.list.filter(r => r.origin !== 'hosted' && !hosted.some(h => h.id === r.id)) : [];
      first = false;
      this.hosted = true;
      this.list = [...pending, ...hosted].sort(byDate);
      this.persist();
      for (const rec of pending) this.push(rec);
    }, err => {
      /* A dead subscription leaves the page with what it last saw; the
         local layer keeps working, and further saves stay local. */
      this.fail(err, 'subscribe');
      this.db = null;
      this.hosted = false;
      this.emit();
    });
    return true;
  }
}
