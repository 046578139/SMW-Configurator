/**
 * Fetches the third-party files the Import dialog loads on demand - the OCR
 * engine and the PDF renderer - so a deployment can serve them from its own
 * origin.
 *
 *   node tools/fetch-vendor.mjs            -> dist/vendor/
 *   node tools/fetch-vendor.mjs vendor     -> vendor/  (next to index.html, for GitHub Pages)
 *
 * The page looks for vendor/manifest.json beside itself and uses these
 * copies when they are there, the CDN when not. The copies matter on a host
 * that lets a script in from a CDN but blocks a worker's fetch from one: the
 * OCR language data is fetched, not scripted, and the engine sat waiting for
 * it. They are also quicker, and cached by the host like the page itself.
 *
 * Nothing here is committed: about 13 MB of files that the CDNs already
 * publish, pinned to the versions import.js names.
 */

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, process.argv[2] || 'dist/vendor');

export const VENDOR = {
  tesseract: '5.1.1',
  pdfjs: '4.10.38',
  files: {
    'tesseract/tesseract.esm.min.js': 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js',
    'tesseract/worker.min.js': 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
    'tesseract/tesseract-core-simd-lstm.wasm.js': 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-simd-lstm.wasm.js',
    'tesseract/tesseract-core-lstm.wasm.js': 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-lstm.wasm.js',
    'tesseract/eng.traineddata.gz': 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz',
    'pdfjs/pdf.min.mjs': 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs',
    'pdfjs/pdf.worker.min.mjs': 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs'
  }
};

let total = 0;
for (const [rel, url] of Object.entries(VENDOR.files)) {
  const path = resolve(out, rel);
  mkdirSync(dirname(path), { recursive: true });
  if (!existsSync(path) || statSync(path).size === 0) {
    // curl honours the proxy variables a container may need; Node's fetch does not
    execFileSync('curl', ['-sSL', '--fail', '--retry', '3', '-o', path, url], { stdio: 'inherit' });
  }
  /* A host that checks a script for text refuses a raw ESC byte. In a script
     one can only sit inside a string, a regular expression or a comment, and
     the four characters \x1b mean the same there. */
  if (/\.m?js$/.test(rel)) {
    const raw = readFileSync(path);
    if (raw.includes(0x1b)) writeFileSync(path, Buffer.from(raw.toString('latin1').replace(/\x1b/g, '\\x1b'), 'latin1'));
  }
  const size = statSync(path).size;
  total += size;
  console.log(`${(size / 1024).toFixed(0).padStart(6)} kB  ${rel}`);
}
/* A host that serves files by extension may not serve .gz, and checks a text
   name for text; the engine asks for <langPath>/eng.traineddata.gz and tells
   gzip by its first bytes, so a copy under a served binary name is what the
   page points it at (import.js). */
copyFileSync(resolve(out, 'tesseract/eng.traineddata.gz'), resolve(out, 'tesseract/eng.traineddata.gz.wasm'));
writeFileSync(resolve(out, 'manifest.json'), JSON.stringify({
  tesseract: VENDOR.tesseract, pdfjs: VENDOR.pdfjs, files: [...Object.keys(VENDOR.files), 'tesseract/eng.traineddata.gz.wasm']
}, null, 2) + '\n');
console.log(`${(total / 1024 / 1024).toFixed(1)} MB in ${out}`);
