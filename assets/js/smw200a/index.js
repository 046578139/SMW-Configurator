/**
 * The R&S SMW200A instrument profile: everything the page knows about this
 * instrument, in one object the core activates at boot (instrument.js).
 *
 * The catalog and its constants, the instrument's own rules (rules.js), the
 * derived capabilities, the starting points, the drawings and photographs,
 * the Keysight cross-reference table, the storage keys this instrument's
 * configurations are kept under, and the words the document reader needs.
 * A second instrument is another object of the same shape.
 */

import { useInstrument } from '../instrument.js';
import {
  OPTIONS, BY_ID, BASE_UNIT, SECTIONS, GUIDE, SHORTHAND, typeName
} from './catalog.js';
import { smwRules, freqA, mainModule } from './rules.js';
import { derive, vitals } from './derive.js';
import { PRESETS } from './presets.js';
import { renderChain, renderRuler } from './diagram.js';
import { renderFront, renderRear, connectorNotes, faceCounts } from './panel.js';
import { renderPhoto } from './photo.js';
import { E8267D, OTHER_MODELS, KEYSIGHT_VENDOR, readKeysight } from './xref-keysight.js';
import { smwUi } from './sections.js';

/** "B1020 · B13T · 7 options" - enough to tell saved entries apart. */
function smwSummarize (sel) {
  const parts = [];
  const a = freqA(sel);
  const mm = mainModule(sel);
  if (a) parts.push(a.id);
  if (mm) parts.push(mm);
  const n = Object.values(sel).reduce((s, q) => s + (q > 0 ? q : 0), 0);
  parts.push(`${n} option${n === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

export const SMW200A = {
  id: 'smw200a',
  name: 'R&S®SMW200A',
  family: 'vector signal generator',

  /* the catalog */
  OPTIONS, BY_ID, BASE_UNIT, SECTIONS, GUIDE, SHORTHAND, typeName,
  /* the order the parts list groups sections in */
  bomOrder: ['rf-a', 'baseband', 'rf-b', 'phase', 'rf-enh', 'bb-hw', 'bb-enh',
    'fading', 'std-int', 'std-wiq', 'pulse', 'other', 'extras'],

  /* the instrument's own rules, called by the engine at fixed points */
  rules: smwRules,

  /* what a selection amounts to */
  derive, vitals, summarize: smwSummarize,
  PRESETS,

  /* the sections this instrument draws itself, its single-select groups and what follows a choice */
  ui: smwUi,

  /* drawings and photographs */
  diagram: { renderChain, renderRuler },
  panel: { renderFront, renderRear, connectorNotes, faceCounts },
  photo: { renderPhoto },

  /* where this browser keeps this instrument's configurations */
  storage: {
    config: 'smw200a-config-v1',
    saved: 'smw200a-saved-v1',
    view: 'smw-view',
    collection: 'configs'
  },

  /* the document reader: the type prefix its codes carry, and what the AI is asked */
  reader: {
    prefix: 'SMW',
    intro: 'Drop a Rohde & Schwarz quotation or configuration list – a PDF or a photograph – or paste its ' +
      'text. Order numbers and type designations are matched against the catalog. A Keysight E8267D ' +
      'configuration is cross-referenced to its SMW200A equivalent instead.',
    prompt:
      'The attached image(s) show a signal generator document - a quotation, order confirmation, ' +
      'configuration list or product listing - for a Rohde & Schwarz R&S SMW200A or for a Keysight PSG ' +
      '(E8267D). Read every line item or option row on them. ' +
      'Reply with only a JSON array of objects, one per line, in document order: ' +
      '{"type": the type designation or option code as printed (for example "R&S SMW-K144", "E8267D-544" or "UNW") or null, ' +
      '"order": the order number as printed, ten digits in the form dddd.dddd.dd, copied digit for digit, or null, ' +
      '"qty": the quantity as a number (1 if none is printed), ' +
      '"designation": the description text or null}. ' +
      'Include the instrument model if it is printed. Do not add items that are not printed. ' +
      'Example: [{"type":"R&S SMW-B1003","order":"1428.4700.02","qty":1,"designation":"100 kHz to 3 GHz"}]'
  },

  /* competitor cross-reference: the vendor reader and the tables it can answer from */
  xref: { vendor: KEYSIGHT_VENDOR, models: { E8267D }, other: OTHER_MODELS, read: readKeysight }
};

/* Importing the profile makes it the active one - a page or a test that
   loads it wants exactly that; boot() does it again explicitly. */
useInstrument(SMW200A);
