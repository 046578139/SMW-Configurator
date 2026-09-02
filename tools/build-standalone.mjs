/**
 * Builds a single self-contained HTML file from the site.
 *
 *   node tools/build-standalone.mjs [outfile]
 *
 * The result needs no server and no network: stylesheet and modules are
 * inlined, so it can be emailed, opened from a USB stick, or published as a
 * one-file page. It is a build product, not the source of truth - edit the
 * files under assets/ and rebuild.
 *
 * The modules form a plain dependency chain with no cycles and no clashing
 * top-level names, so concatenating them in order is enough; there is no
 * bundler to install.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(resolve(root, p), 'utf8');

/** Dependency order: every module only imports the ones above it. */
const MODULES = [
  'assets/js/util.js',
  'assets/js/photos.js',
  'assets/js/catalog.js',
  'assets/js/rules.js',
  'assets/js/derive.js',
  'assets/js/diagram.js',
  'assets/js/panel.js',
  'assets/js/photo.js',
  'assets/js/ui.js',
  'assets/js/presets.js',
  'assets/js/app.js'
];

/** Removes the module syntax that only makes sense across separate files. */
function flatten (source, path) {
  const stripped = source
    // import declarations, including the ones wrapped over several lines
    .replace(/^import\b[^;]*?from\s*['"][^'"]*['"]\s*;/gm, '')
    // bare re-exports such as `export { esc };`
    .replace(/^export\s*\{[^}]*\}\s*;/gm, '')
    // the `export` keyword in front of a declaration
    .replace(/^export\s+(?=(?:const|let|function|class)\b)/gm, '');

  for (const leftover of stripped.match(/^\s*(?:import|export)\b.*/gm) || []) {
    throw new Error(`${path}: unhandled module syntax -> ${leftover.trim()}`);
  }
  return `/* ---- ${path} ---- */\n${stripped.trim()}\n`;
}

/**
 * Guards the list above: every module another module imports has to be in it,
 * and it has to come first. Without this a forgotten entry produces a bundle
 * that parses cleanly and then fails at runtime on a missing name.
 */
function checkModuleList () {
  const seen = new Set();
  for (const path of MODULES) {
    const source = read(path);
    for (const m of source.matchAll(/from\s*['"]\.\/([^'"]+)['"]/g)) {
      const dep = `assets/js/${m[1]}`;
      if (!MODULES.includes(dep)) throw new Error(`${path} imports ${dep}, which is missing from MODULES`);
      if (!seen.has(dep)) throw new Error(`${path} imports ${dep}, which must come before it in MODULES`);
    }
    seen.add(path);
  }
}
checkModuleList();

/**
 * The photographs travel with the standalone page as data URIs. Without this
 * the file would reference assets/img/, which is exactly what a single file is
 * supposed to avoid.
 */
function inlinePhotos (source) {
  return source.replace(/'(assets\/img\/[^']+)'/g, (whole, rel) => {
    const bytes = readFileSync(resolve(root, rel));
    const type = rel.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return `'data:${type};base64,${bytes.toString('base64')}'`;
  });
}

const css = read('assets/css/app.css');
const html = read('index.html');

/**
 * Reads one whole tag out of the source.
 *
 * A regex cannot do this: the favicon's href is a data URI holding an inline
 * SVG, so the tag contains `>` characters inside quoted attributes. Stopping
 * at the first `>` truncates the tag and silently swallows whatever follows.
 */
function tagAt (source, startMarker) {
  const start = source.indexOf(startMarker);
  if (start === -1) return '';
  let quote = null;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; continue; }
    if (ch === '>') return source.slice(start, i + 1);
  }
  throw new Error(`unterminated tag at ${startMarker}`);
}

// the shell markup, without the document scaffolding and the module loader
const body = html
  .slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'))
  .replace(/<script type="module">[\s\S]*?<\/script>/, '')
  .replace(/<noscript>[\s\S]*?<\/noscript>/, '')
  .trim();

const script = MODULES.map(p => flatten(inlinePhotos(read(p)), p)).join('\n');

const out = process.argv[2] || 'dist/smw200a-configurator.html';
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>R&amp;S SMW200A Configurator</title>
<meta name="description" content="Interactive configurator for the Rohde &amp; Schwarz SMW200A vector signal generator, checked against the configuration guide.">
<meta name="color-scheme" content="dark light">
${tagAt(html, '<link rel="icon"')}
<style>
${css}
</style>
</head>
<body>
${body}
<script>
${script}
boot();
</script>
</body>
</html>
`;

/* A truncated tag in <head> silently eats the stylesheet, and the result still
   looks like valid HTML, so check the built page rather than trusting it. */
const styled = page.match(/<style>([\s\S]*?)<\/style>/);
if (!styled || styled[1].length < css.length) throw new Error('the stylesheet did not survive the build');
if (/<head>[\s\S]*?<[a-z]+[^<]*?=[^<]*?<style>/.test(page)) throw new Error('a tag in <head> is unterminated');
if (page.includes('assets/img/')) throw new Error('a photograph was left as a file reference');

mkdirSync(resolve(root, dirname(out)), { recursive: true });
writeFileSync(resolve(root, out), page);
console.log(`${out}  ${(Buffer.byteLength(page) / 1024).toFixed(0)} kB`);
