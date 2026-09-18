/**
 * The R&S FSW instrument profile: everything the page knows about this
 * instrument, in one object the core activates at boot (instrument.js).
 *
 * The catalog and its constants, the instrument's own rules (rules.js), the
 * derived capabilities, the starting points, the drawings, the storage keys
 * this instrument's configurations are kept under, and the words the
 * document reader needs. It has no photographs and no competitor
 * cross-reference; the shell does without both.
 */

import { useInstrument } from '../instrument.js';
import {
  OPTIONS, BY_ID, BASE_UNIT, SECTIONS, GUIDE, SHORTHAND, typeName
} from './catalog.js';
import { fswRules, modelOpt, bwOption, analysisBw } from './rules.js';
import { derive, vitals } from './derive.js';
import { PRESETS } from './presets.js';
import { renderChain, renderRuler } from './diagram.js';
import { renderFront, renderRear, connectorNotes, faceCounts } from './panel.js';
import { fswUi } from './sections.js';

/** "FSW26 · B2001 · 7 options" - enough to tell saved entries apart. */
function fswSummarize (sel) {
  const parts = [];
  const m = modelOpt(sel);
  const bw = bwOption(sel) || analysisBw(sel).by;
  if (m) parts.push(m.id);
  if (bw) parts.push(bw);
  const n = Object.entries(sel).reduce((s, [id, q]) => s + (q > 0 && !BY_ID[id]?.baseModel ? q : 0), 0);
  parts.push(`${n} option${n === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

/** The parts list's base line: the model chosen, or the stand-in until one is. */
function fswBomBase (sel) {
  const m = modelOpt(sel);
  return m ? { id: m.id, name: m.name, order: m.order } : BASE_UNIT;
}

export const FSW = {
  id: 'fsw',
  name: 'R&S®FSW',
  family: 'signal and spectrum analyzer',

  /* the catalog */
  OPTIONS, BY_ID, BASE_UNIT, SECTIONS, GUIDE, SHORTHAND, typeName,
  /* the order the parts list groups sections in */
  bomOrder: ['model', 'bandwidth', 'rf-hw', 'io-hw', 'gp-apps', 'realtime', 'cellular', 'wireless',
    'floating', 'upgrades', 'extras'],
  /* the base line of the parts list is the model */
  bomBase: fswBomBase,

  /* the instrument's own rules, called by the engine at fixed points */
  rules: fswRules,

  /* what a selection amounts to */
  derive, vitals, summarize: fswSummarize,
  PRESETS,

  /* the sections this instrument draws itself, its single-select groups */
  ui: fswUi,

  /* drawings; no photographs */
  diagram: { renderChain, renderRuler },
  panel: { renderFront, renderRear, connectorNotes, faceCounts },
  photo: null,

  /* where this browser keeps this instrument's configurations */
  storage: {
    config: 'fsw-config-v1',
    saved: 'fsw-saved-v1',
    view: 'fsw-view',
    collection: 'fsw-configs'
  },

  /* the document reader: the type prefix its codes carry, and what the AI is asked */
  reader: {
    prefix: 'FSW',
    intro: 'Drop a Rohde & Schwarz quotation or configuration list – a PDF or a photograph – or paste its ' +
      'text. Order numbers and type designations are matched against the catalog; the model (R&S®FSW26, ' +
      '1331.5003.26) is read like any option.',
    prompt:
      'The attached image(s) show a signal and spectrum analyzer document - a quotation, order confirmation, ' +
      'configuration list or product listing - for a Rohde & Schwarz R&S FSW (R&S FSW8, FSW13, FSW26, FSW43, ' +
      'FSW50, FSW67 or FSW85). Read every line item or option row on them. ' +
      'Reply with only a JSON array of objects, one per line, in document order: ' +
      '{"type": the type designation or option code as printed (for example "R&S FSW26", "R&S FSW-K18" or "B24") or null, ' +
      '"order": the order number as printed, ten digits in the form dddd.dddd.dd, copied digit for digit, or null, ' +
      '"qty": the quantity as a number (1 if none is printed), ' +
      '"designation": the description text or null}. ' +
      'Include the instrument model if it is printed. Do not add items that are not printed. ' +
      'Example: [{"type":"R&S FSW26","order":"1331.5003.26","qty":1,"designation":"Signal and spectrum analyzer, 2 Hz to 26.5 GHz"}]'
  }
};

/* Importing the profile makes it the active one - a page or a test that
   loads it wants exactly that; boot() does it again explicitly. */
useInstrument(FSW);
