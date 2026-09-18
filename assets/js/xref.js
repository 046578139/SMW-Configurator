/**
 * Cross-reference: from a competitor's configuration to an SMW200A one.
 *
 * The vendor tables (xref-keysight.js) say which SMW options answer each
 * competitor option; this module turns a document's option list into a
 * selection the rest of the page treats like any other - the same rules
 * validate it, the same auto-resolve fills in prerequisites, and nothing in
 * the catalog or the rules knows the selection came from a cross-reference.
 *
 * The selection is built from the rows alone: the main module and the
 * generator follow from what the rows need (a two-path module for analog
 * modulation, the wideband section only if a row asks for it), and every
 * option the rows name goes in once. autoResolve then adds what those
 * options require, and what it added is reported, so a reader can see which
 * SMW options came from the table and which from the SMW200A's own rules.
 */

import { BY_ID, typeName } from './catalog.js';
import { validate, autoResolve } from './rules.js';
import { E8267D, KEYSIGHT_VENDOR, readKeysight } from './xref-keysight.js';

export const XREF_MODELS = { E8267D };

export const XREF_STATUS = {
  covered: 'Covered by an SMW option',
  partial: 'Covered in part',
  standard: 'No option needed',
  none: 'Not covered',
  service: 'A service, quoted separately'
};

/** The name a configuration built from a cross-reference gets. */
export const xrefName = x => `Equivalent of ${x.vendor} ${x.model}`;

/**
 * Builds the SMW equivalent of a competitor's option list.
 *
 * @param {{vendor:string, model:string, options:Array<{code:string, line?:string, kit?:boolean}>,
 *   qty?:number, name?:string|null, unknown?:string[], other?:Array}} read  what readKeysight returned
 * @returns {object|null}  null when the model has no table
 */
export function crossReference (read) {
  if (!read?.model || !XREF_MODELS[read.model]) return null;
  const table = XREF_MODELS[read.model];

  const rows0 = read.options.map(o => ({ ...(table.options[o.code] || {}), code: o.code, line: o.line || '', kit: !!o.kit }));
  const platform = rows0.some(r => r.needs === 'wideband') ? 'wideband' : 'standard';
  const twoPath = platform === 'wideband' || rows0.some(r => r.needs === 'bb2');
  const mainModule = platform === 'wideband' ? 'B13XT' : twoPath ? 'B13T' : 'B13';
  const freqRow = rows0.find(r => r.step === 'Frequency range' && r.ids);
  const freq = freqRow ? (Array.isArray(freqRow.ids) ? freqRow.ids[0] : null) : null;

  const rows = rows0.map(r => {
    let ids = [];
    let status = r.status;
    let gap = r.gap;
    if (Array.isArray(r.ids)) ids = r.ids;
    else if (r.ids && typeof r.ids === 'object') ids = r.ids[platform] || [];
    else if (r.byFreq) {
      ids = (freq && r.byFreq[freq]) || [];
      status = ids.length ? 'covered' : 'none';
      if (ids.length) gap = undefined;
    }
    /* an answer that only works with some frequency options, and the document names another */
    if (r.needsFreq && freq && !r.needsFreq.includes(freq)) {
      ids = []; status = 'none'; gap = r.freqGap || gap;
    }
    return {
      code: r.code, kit: r.kit, line: r.line,
      step: r.step || '', name: r.name || '', page: r.page || '',
      status, ids: ids.filter(id => BY_ID[id]), note: r.note, gap
    };
  });

  /* the selection: main module, then everything the rows name, once each */
  const sel = { [mainModule]: 1 };
  const named = new Set();
  for (const r of rows) for (const id of r.ids) { sel[id] = 1; named.add(id); }
  const settled = autoResolve(sel);
  const added = Object.keys(settled).filter(id => !sel[id]);
  const v = validate(settled);

  return {
    vendor: read.vendor, model: read.model, family: table.family,
    qty: read.qty || 1, name: read.name || null,
    other: read.other || [], unknown: read.unknown || [],
    platform, mainModule, freq,
    rows,
    codes: rows.map(r => r.code),
    named: [...named],
    added,
    sel: settled,
    issues: v.errors.filter(e => !e.todo),
    todo: v.errors.filter(e => e.todo),
    base: table.base
  };
}

/**
 * Reads a document for a competitor's configuration and cross-references it
 * in one go. null when the document names nothing of the kind; an object
 * with `model: null` and `other` when it names a model this page has no
 * table for.
 */
export function readCompetitor (text) {
  const read = readKeysight(text);
  if (!read) return null;
  if (!read.model) return { vendor: read.vendor, model: null, other: read.other, rows: [], codes: [], sel: {}, unknown: read.unknown };
  return crossReference(read);
}

/**
 * The rows of a stored cross-reference (vendor, model, codes) against the
 * configuration as it is now: each row says whether every SMW option it named
 * is still selected.
 */
export function xrefRows (stored, sel) {
  if (!stored?.model || !XREF_MODELS[stored.model]) return [];
  const x = crossReference({ vendor: stored.vendor || KEYSIGHT_VENDOR, model: stored.model,
    options: (stored.codes || []).map(code => ({ code })) });
  if (!x) return [];
  return x.rows.map(r => ({
    ...r,
    present: r.ids.length ? r.ids.every(id => sel[id] > 0) : null,
    missing: r.ids.filter(id => !(sel[id] > 0))
  }));
}

/** "R&S®SMW-B1044, R&S®SMW-K22" - the type designations a row maps to. */
export const xrefTypes = ids => ids.map(typeName).join(', ');

/** "E8267D-544" for an instrument option, "N7617EMBC" for something ordered on its own. */
export const xrefCode = (model, code) => (/^(N\d|U\d|1C|R-50C|PS-)/.test(code) ? code : `${model}-${code}`);

/** For a parts list: which competitor options an SMW option answers. */
export function mappedFrom (stored, id) {
  if (!stored?.model) return [];
  return xrefRows(stored, {}).filter(r => r.ids.includes(id)).map(r => xrefCode(stored.model, r.code));
}
