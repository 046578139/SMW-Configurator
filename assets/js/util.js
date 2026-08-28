/** Helpers shared by the rendering modules. */

/** Escapes text for interpolation into the HTML and SVG strings we build. */
export const esc = s => String(s ?? '').replace(/[&<>"]/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
