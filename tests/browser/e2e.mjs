import { chromium } from 'playwright';
import { BASE, ROOT, BROWSER } from './_env.mjs';
const b = await chromium.launch({ executablePath: BROWSER });
const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true,
  permissions: ['clipboard-read', 'clipboard-write'] });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
const step = async (name, fn) => { try { await fn(); console.log('PASS ', name); }
  catch (e) { console.log('FAIL ', name, '->', e.message); } };

await p.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' });

await step('select a frequency option', async () => {
  await p.click('[data-toggle=B1006]');
  if (!(await p.locator('.card.on[data-opt=B1006]').count())) throw new Error('not marked on');
});

await step('frequency options behave as a single choice', async () => {
  await p.click('[data-toggle=B1020]');
  if (await p.locator('.card.on[data-opt=B1006]').count()) throw new Error('B1006 stayed selected');
  await p.click('[data-toggle=B1006]');
});

await step('choose the main module', () => p.click('[data-toggle=B13T]'));

await step('RF path B lists only the legal combinations', async () => {
  await p.click('[data-goto=rf-b]');
  await p.waitForTimeout(400);
  const shown = await p.locator('#sec-rf-b .cards.grid-2').first().locator('.card').count();
  if (shown !== 2) throw new Error(`expected 2 allowed path B options for B1006, saw ${shown}`);
});

await step('add RF path B', () => p.click('#sec-rf-b [data-toggle=B2006]'));

await step('phase noise pairs both paths automatically', async () => {
  await p.click('[data-level=ultra]');
  const sel = await p.evaluate(() => JSON.parse(localStorage.getItem('smw200a-config-v1')).sel);
  if (!sel.B711 || !sel.B721) throw new Error('B711/B721 not paired: ' + JSON.stringify(sel));
});

await step('quantity stepper respects the limit', async () => {
  await p.click('[data-toggle=B10]');
  await p.click('[data-step="B10:up"]');
  let sel = await p.evaluate(() => JSON.parse(localStorage.getItem('smw200a-config-v1')).sel);
  if (sel.B10 !== 2) throw new Error('did not reach 2, got ' + sel.B10);
  const disabled = await p.locator('[data-step="B10:up"]').first().isDisabled();
  if (!disabled) throw new Error('third unit should not be offered');
});

await step('search finds an option by order number', async () => {
  await p.fill('#search', '1414.4990.02');
  await p.waitForTimeout(250);
  const t = await p.locator('.section-title').first().textContent();
  if (!t.includes('1 option')) throw new Error('search returned: ' + t);
  await p.fill('#search', '');
});

await step('an unmet prerequisite is reported and fixable', async () => {
  await p.fill('#search', 'K512');
  await p.waitForTimeout(200);
  await p.click('[data-toggle=K512]');
  await p.fill('#search', '');
  await p.click('[data-tab=checks]');
  await p.waitForTimeout(200);
  if (!(await p.locator('.issue.error').count())) throw new Error('no error raised');
  await p.click('.panel-foot [data-action=resolve]');
  await p.waitForTimeout(400);
  const sel = await p.evaluate(() => JSON.parse(localStorage.getItem('smw200a-config-v1')).sel);
  if (!sel.K511) throw new Error('K511 not added by Fix issues');
});

await step('the configuration is valid after fixing', async () => {
  const chip = await p.locator('#status-chip').textContent();
  if (!chip.includes('valid')) throw new Error('status is: ' + chip.trim());
});

await step('share link round-trips', async () => {
  const hash = await p.evaluate(() => location.hash);
  if (!hash.includes('B1006')) throw new Error('hash missing options: ' + hash);
  const p2 = await ctx.newPage();
  await p2.goto(`${BASE}/index.html` + hash, { waitUntil: 'networkidle' });
  await p2.waitForTimeout(300);
  const on = await p2.locator('.card.on[data-opt=B1006]').count();
  await p2.close();
  if (!on) throw new Error('shared link did not restore the selection');
});

await step('export modal opens with the parts list', async () => {
  await p.click('.panel-foot [data-action=export]');
  await p.waitForTimeout(300);
  const rows = await p.locator('.modal .table tbody tr').count();
  if (rows < 5) throw new Error('only ' + rows + ' rows');
});

await step('CSV downloads', async () => {
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.modal [data-action=csv]')]);
  const path = await dl.path();
  const fs = await import('fs');
  const text = fs.readFileSync(path, 'utf8');
  if (!text.includes('R&S®SMW200A') || !text.includes('1428.4800.02')) throw new Error('unexpected CSV');
});

await step('JSON downloads with capabilities', async () => {
  // the export modal deliberately stays open after a download
  if (!(await p.locator('.scrim').count())) {
    await p.click('.panel-foot [data-action=export]');
    await p.waitForTimeout(200);
  }
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.modal [data-action=json]')]);
  const fs = await import('fs');
  const data = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  if (!data.valid || !data.capabilities || !data.items.length) throw new Error('payload incomplete');
  if (data.capabilities.phaseNoise !== 'Ultra low') throw new Error('capabilities wrong');
});

await step('escape closes the modal', async () => {
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  if (await p.locator('.scrim').count()) throw new Error('modal still open');
});

await step('slash focuses the search field', async () => {
  await p.keyboard.press('/');
  const id = await p.evaluate(() => document.activeElement.id);
  if (id !== 'search') throw new Error('focus went to ' + id);
  await p.keyboard.press('Escape');
});

await step('theme toggle persists', async () => {
  await p.click('[data-action=theme]');
  await p.waitForTimeout(150);
  const t = await p.evaluate(() => document.documentElement.dataset.theme);
  if (t !== 'light') throw new Error('theme is ' + t);
  await p.reload({ waitUntil: 'networkidle' });
  const t2 = await p.evaluate(() => document.documentElement.dataset.theme);
  if (t2 !== 'light') throw new Error('theme did not persist: ' + t2);
  await p.click('[data-action=theme]');
});

console.log(errs.length ? '\nJS ERRORS:\n' + errs.join('\n') : '\nno JS errors during the run');
await b.close();
