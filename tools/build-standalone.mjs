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
 * bundler to install. One build per instrument: `--profile fsw` builds the
 * FSW page from fsw.html and the FSW profile (dist/fsw-configurator.html).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = p => readFileSync(resolve(root, p), 'utf8');

/** The core: knows no instrument, reaches the active profile through instrument.js. */
const CORE = [
  'assets/js/util.js',
  'assets/js/instrument.js',
  'assets/js/rules.js',
  'assets/js/ui.js',
  'assets/js/saved.js',
  'assets/js/import.js',
  'assets/js/xref.js',
  'assets/js/pdf.js'
];

/**
 * One build per instrument: its page, its profile modules in dependency
 * order (every module only imports the ones above it, the core included),
 * the name the page boots, and where the file goes.
 */
const PROFILES = {
  smw200a: {
    page: 'index.html',
    boot: 'SMW200A',
    out: 'dist/smw200a-configurator.html',
    modules: [
      'assets/js/smw200a/photos.js',
      'assets/js/smw200a/catalog.js',
      'assets/js/smw200a/rules.js',
      'assets/js/smw200a/derive.js',
      'assets/js/smw200a/diagram.js',
      'assets/js/smw200a/panel.js',
      'assets/js/smw200a/photo.js',
      'assets/js/smw200a/presets.js',
      'assets/js/smw200a/xref-keysight.js',
      'assets/js/smw200a/sections.js',
      'assets/js/smw200a/index.js'
    ]
  },
  fsw: {
    page: 'fsw.html',
    boot: 'FSW',
    out: 'dist/fsw-configurator.html',
    modules: [
      'assets/js/fsw/catalog.js',
      'assets/js/fsw/rules.js',
      'assets/js/fsw/derive.js',
      'assets/js/fsw/diagram.js',
      'assets/js/fsw/panel.js',
      'assets/js/fsw/presets.js',
      'assets/js/fsw/sections.js',
      'assets/js/fsw/index.js'
    ]
  }
};

/*   node tools/build-standalone.mjs [outfile] [--profile smw200a|fsw]   */
const args = process.argv.slice(2);
const profileFlag = args.indexOf('--profile');
const profileName = profileFlag === -1 ? 'smw200a' : args[profileFlag + 1];
const PROFILE = PROFILES[profileName];
if (!PROFILE) throw new Error(`unknown profile ${profileName}; one of ${Object.keys(PROFILES).join(', ')}`);
const outArg = args.filter((a, i) => a !== '--profile' && i !== profileFlag + 1)[0];

/** Dependency order: core, the profile, then the shell. */
const MODULES = [...CORE, ...PROFILE.modules, 'assets/js/app.js'];

/** Removes the module syntax that only makes sense across separate files. */
function flatten (source, path) {
  const stripped = source
    // import declarations, including the ones wrapped over several lines
    .replace(/^import\b[^;]*?from\s*['"][^'"]*['"]\s*;/gm, '')
    // bare re-exports such as `export { esc };`
    .replace(/^export\s*\{[^}]*\}\s*;/gm, '')
    // the `export` keyword in front of a declaration
    .replace(/^export\s+(?=(?:const|let|function|class|async\s+function)\b)/gm, '');

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
  /* the modules share one scope once flattened, so a top-level name declared
     twice is a SyntaxError that leaves the page blank - caught here, by name */
  const declared = new Map();
  for (const path of MODULES) {
    const source = read(path);
    for (const m of source.matchAll(/from\s*['"](\.\.?\/[^'"]+)['"]/g)) {
      const dep = posix.normalize(posix.join(posix.dirname(path), m[1]));
      if (!MODULES.includes(dep)) throw new Error(`${path} imports ${dep}, which is missing from MODULES`);
      if (!seen.has(dep)) throw new Error(`${path} imports ${dep}, which must come before it in MODULES`);
    }
    for (const m of source.matchAll(/^(?:export\s+)?(?:const|let|var|function|class|async\s+function)\s+([A-Za-z_$][\w$]*)/gm)) {
      if (declared.has(m[1])) throw new Error(`${path} declares ${m[1]}, which ${declared.get(m[1])} already declares`);
      declared.set(m[1], path);
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
const html = read(PROFILE.page);

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
  // a single file has no neighbour to switch to
  .replace(/ · <a class="brand-switch"[\s\S]*?<\/a>/, '')
  .trim();

const script = MODULES.map(p => flatten(inlinePhotos(read(p)), p)).join('\n');

const out = outArg || PROFILE.out;
/* the page's own title and description, so the two builds are not told apart by hand */
const title = html.match(/<title>[\s\S]*?<\/title>/)[0];
const description = tagAt(html, '<meta name="description"');
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
${title}
${description}
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
boot(${PROFILE.boot});
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
