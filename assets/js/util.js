/** Helpers shared by the rendering modules. */

/** Escapes text for interpolation into the HTML and SVG strings we build. */
export const esc = s => String(s ?? '').replace(/[&<>"]/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * The product code printed on a quotation.
 *
 * A few options are sold under one code with a different order number per
 * quantity - R&S®SMW-K200 comes as 1, 5 or 50 waveforms - so the catalog gives
 * each its own id and strips the suffix for display. Printing the id would put
 * a code on the parts list that does not exist.
 */
export const productCode = id => id.replace(/-\d+$/, '');
