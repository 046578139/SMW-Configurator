import { chromium } from 'playwright';
import { BASE, ROOT, BROWSER, outDir } from './_env.mjs';

const OUT_DIR = outDir();
const b = await chromium.launch({ executablePath: BROWSER });
const p = await b.newPage({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 });
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
p.on('request', r => { const u = r.url(); if (!u.startsWith('file:') && !u.startsWith('data:')) errs.push('NETWORK ' + u); });

// opened straight off disk, no server at all
await p.goto(`file://${ROOT}/dist/smw200a-configurator.html`);
await p.waitForTimeout(600);
const check = async (name, fn) => { try { await fn(); console.log('PASS ', name); } catch (e) { console.log('FAIL ', name, '->', e.message); } };

await check('renders the option list', async () => {
  const n = await p.locator('.card').count();
  if (n < 100) throw new Error('only ' + n + ' cards');
});
await check('preset loads and validates', async () => {
  await p.click('[data-action=presets]');
  await p.waitForTimeout(200);
  await p.click('[data-preset=mimo]');
  await p.waitForTimeout(400);
  const chip = await p.locator('#status-chip').textContent();
  if (!chip.includes('valid')) throw new Error(chip.trim());
});
await check('diagrams draw', async () => {
  const svgs = await p.locator('.viz svg').count();
  if (svgs < 2) throw new Error('only ' + svgs + ' diagrams');
  await p.click('[data-tab=chain]');
  await p.waitForTimeout(200);
  if (!(await p.locator('.viz svg .mod').count())) throw new Error('no chain blocks');
});
await check('validation still fires', async () => {
  await p.fill('#search', 'K546');
  await p.waitForTimeout(200);
  await p.click('[data-toggle=K546]');
  await p.fill('#search', '');
  await p.click('[data-tab=checks]');
  await p.waitForTimeout(200);
  if (!(await p.locator('.issue.error').count())) throw new Error('no error raised');
});
await check('colophon is present', async () => {
  const t = await p.locator('.colophon').textContent();
  if (!t.includes('Not affiliated')) throw new Error('disclaimer missing');
});
await p.click('[data-tab=overview]');
await p.waitForTimeout(300);
await p.screenshot({ path: `${OUT_DIR}/standalone.png` });
console.log(errs.length ? '\nISSUES:\n' + errs.join('\n') : '\nno errors, no network requests');
await b.close();
