/**
 * Runs the browser suites.
 *
 *   node tests/browser/run.mjs            all suites
 *   node tests/browser/run.mjs sweep xss  only those
 *
 * Each suite drives a real browser against a static server on the repo, which
 * is the only way to check the things that matter here: that a drawing has no
 * overlapping labels, that a sandboxed frame can still clear a configuration,
 * that the standalone build runs from file:// with no network at all.
 *
 * Needs Playwright and a Chromium binary. Override the browser with
 * SMW_BROWSER if it is not at the default path.
 */

import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url)).replace(/\/$/, '');
const PORT = Number(process.env.SMW_PORT || 8899);

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.png': 'image/png'
};

const server = createServer(async (req, res) => {
  const rel = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const path = join(ROOT, rel === '/' ? 'index.html' : rel);
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
});

const run = cmd => new Promise(done => {
  const child = spawn(process.execPath, cmd, {
    cwd: ROOT,
    env: { ...process.env, SMW_BASE: `http://127.0.0.1:${PORT}`, SMW_ROOT: ROOT }
  });
  let out = '';
  child.stdout.on('data', d => { out += d; });
  child.stderr.on('data', d => { out += d; });
  child.on('close', code => done({ code, out }));
});

await new Promise(r => server.listen(PORT, '127.0.0.1', r));

const wanted = process.argv.slice(2);
const suites = (await readdir(new URL('.', import.meta.url)))
  .filter(f => f.endsWith('.mjs') && f !== 'run.mjs' && !f.startsWith('_'))
  .map(f => f.replace('.mjs', ''))
  .filter(n => !wanted.length || wanted.includes(n))
  .sort();

let failed = 0;
for (const name of suites) {
  const { code, out } = await run([`tests/browser/${name}.mjs`]);
  const checks = (out.match(/^(ok|PASS)/gm) || []).length;
  const bad = code !== 0 || /^(FAIL|ISSUES:|PAGEERROR)/m.test(out) || /STILL BROKEN|OVERLAP:/.test(out);
  if (bad) failed++;
  console.log(`${bad ? 'FAIL' : 'ok  '}  ${name.padEnd(12)} ${checks} checks`);
  if (bad) console.log(out.split('\n').filter(l => /FAIL|ERR|ISSUE/.test(l)).slice(0, 6).map(l => '        ' + l).join('\n'));
}

server.close();
console.log(`\n${suites.length - failed} of ${suites.length} suites passed`);
process.exit(failed ? 1 : 0);
