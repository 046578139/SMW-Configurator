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
  'assets/js/catalog.js',
  'assets/js/rules.js',
  'assets/js/derive.js',
  'assets/js/diagram.js',
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

const css = read('assets/css/app.css');
const html = read('index.html');

// the shell markup, without the document scaffolding and the module loader
const body = html
  .slice(html.indexOf('<body>') + 6, html.lastIndexOf('</body>'))
  .replace(/<script type="module">[\s\S]*?<\/script>/, '')
  .replace(/<noscript>[\s\S]*?<\/noscript>/, '')
  .trim();

const script = MODULES.map(p => flatten(read(p), p)).join('\n');

const out = process.argv[2] || 'dist/smw200a-configurator.html';
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>R&amp;S SMW200A Configurator</title>
<meta name="description" content="Interactive configurator for the Rohde &amp; Schwarz SMW200A vector signal generator, checked against the configuration guide.">
<meta name="color-scheme" content="dark light">
${html.match(/<link rel="icon"[^>]*>/)?.[0] || ''}
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

mkdirSync(resolve(root, dirname(out)), { recursive: true });
writeFileSync(resolve(root, out), page);
console.log(`${out}  ${(Buffer.byteLength(page) / 1024).toFixed(0)} kB`);
