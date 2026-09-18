/**
 * The R&S FSW page end to end: the model as the one mandatory choice, the
 * per-model order numbers, a prerequisite settled by "Fix issues", a card
 * ruled out by the bandwidth chosen, the parts list with the model as its
 * base line, the reader, and the standalone build running from file://.
 */
import { chromium } from 'playwright';
import { BASE, ROOT, BROWSER } from './_env.mjs';
const b = await chromium.launch({ executablePath: BROWSER });
const ctx = await b.newContext({ viewport: { width: 1500, height: 950 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
const step = async (name, fn) => { try { await fn(); console.log('PASS ', name); }
  catch (e) { console.log('FAIL ', name, '->', e.message); } };
const sel = () => p.evaluate(() => JSON.parse(localStorage.getItem('fsw-config-v1') || '{}').sel || {});

await p.goto(`${BASE}/fsw.html`, { waitUntil: 'networkidle' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' });

await step('the page boots the FSW profile with its own storage', async () => {
  const t = await p.locator('.brand-title').textContent();
  if (!t.includes('FSW')) throw new Error('brand: ' + t);
  if (await p.locator('.view-switch').count()) throw new Error('a photo/schematic switch is shown, but the FSW has no photographs');
  const chip = await p.locator('#status-chip').textContent();
  if (!/1 (step|choice|to make|left)/i.test(chip) && !/model/i.test(chip)) console.log('      chip reads: ' + chip.trim());
});

await step('the model is a single choice', async () => {
  await p.click('[data-toggle=FSW26]');
  await p.click('[data-toggle=FSW43]');
  const s = await sel();
  if (s.FSW26 || !s.FSW43) throw new Error(JSON.stringify(s));
});

await step('hardware with one order number per model shows the chosen model\'s', async () => {
  await p.click('[data-goto=rf-hw]');
  await p.waitForTimeout(400);
  const shown = await p.locator('#sec-rf-hw .cards:not([style]) [data-opt^="B24-"]').count();
  if (shown !== 1) throw new Error(`expected one B24 card for the FSW43, saw ${shown}`);
  const id = await p.locator('#sec-rf-hw .cards:not([style]) [data-opt^="B24-"]').getAttribute('data-opt');
  if (id !== 'B24-43') throw new Error('shown: ' + id);
  await p.click('[data-toggle=B24-43]');
});

await step('a prerequisite is settled by Fix issues', async () => {
  await p.click('[data-goto=gp-apps]');
  await p.waitForTimeout(400);
  await p.click('[data-toggle=K17S]');
  await p.click('[data-tab=checks]');
  const txt = await p.locator('.panel-body').textContent();
  if (!txt.includes('K17S is missing a prerequisite')) throw new Error('no issue: ' + txt.slice(0, 200));
  await p.click('[data-action=resolve]');
  await p.waitForTimeout(300);
  const s = await sel();
  if (!s.K17 || !s.B512) throw new Error('not settled: ' + JSON.stringify(s));
});

await step('a card ruled out by the bandwidth chosen says so', async () => {
  await p.click('[data-goto=realtime]');
  await p.waitForTimeout(400);
  const chip = await p.locator('[data-opt=K161R] .chip').first().textContent();
  if (!chip.includes('not available with B512')) throw new Error('chip: ' + chip);
  if (await p.locator('[data-opt=K161R] [data-toggle]').count()) throw new Error('the card is still selectable');
});

await step('the parts list carries the model as its base line', async () => {
  await p.click('[data-tab=order]');
  const rows = await p.locator('.bom-row .bom-id').allTextContents();
  if (rows[0].trim() !== 'R&S®FSW43') throw new Error('first line: ' + rows[0]);
  if (rows.filter(r => r.includes('FSW43')).length !== 1) throw new Error('the model appears twice: ' + rows.join(', '));
  const total = await p.locator('.bom-total').textContent();
  if (!total.includes('5 line items')) throw new Error(total);
});

await step('the frequency ruler, chain and panels draw for the configuration', async () => {
  await p.click('[data-tab=overview]');
  const ruler = await p.locator('.panel-body .viz svg').first().getAttribute('aria-label');
  if (!ruler.includes('Frequency coverage')) throw new Error(ruler);
  await p.click('[data-tab=chain]');
  if (!(await p.locator('.panel-body .viz svg').first().innerHTML()).includes('RF IN')) throw new Error('no chain');
  await p.click('[data-face=rear]');
  await p.waitForTimeout(200);
  const rear = await p.locator('.hero .viz svg').first().getAttribute('aria-label');
  if (!rear.includes('Rear panel')) throw new Error(rear);
  await p.click('[data-face=front]');
});

await step('a starting point loads and validates', async () => {
  await p.click('[data-action=presets]');
  await p.click('[data-preset=mmwave]');
  await p.waitForTimeout(400);
  const s = await sel();
  if (!s.FSW85 || !s.B800R) throw new Error(JSON.stringify(s));
  const chip = await p.locator('#status-chip').textContent();
  if (!chip.includes('valid')) throw new Error('chip: ' + chip);
});

await step('the reader takes the model and a per-model order number', async () => {
  await p.click('[data-action=import]');
  await p.fill('textarea', 'R&S FSW26 1331.5003.26 1\nR&S FSW-B2001 1331.6916.14 1\nRF preamplifier 1313.0832.26 1\nR&S FSW-K18 1325.2170.02 1');
  await p.waitForTimeout(500);
  const txt = await p.locator('.modal').textContent();
  for (const want of ['R&S®FSW26', 'R&S®FSW-B2001', 'R&S®FSW-B24', 'R&S®FSW-K18']) {
    if (!txt.includes(want)) throw new Error('not read: ' + want);
  }
  await p.keyboard.press('Escape');
});

await step('the export view lists the parts with the model first', async () => {
  await p.click('[data-action=export]');
  await p.waitForTimeout(300);
  const txt = await p.locator('.modal').textContent();
  if (!txt.includes('1331.5003.85')) throw new Error('no model order number in the export view');
  await p.keyboard.press('Escape');
});

await step('the standalone FSW build runs from file:// with no network', async () => {
  const q = await ctx.newPage();
  const qerrs = [];
  q.on('pageerror', e => qerrs.push(e.message));
  await q.route('**/*', route => (route.request().url().startsWith('file://') ? route.continue() : route.abort()));
  await q.goto(`file://${ROOT}/dist/fsw-configurator.html`);
  await q.waitForTimeout(600);
  const cards = await q.locator('.card').count();
  if (cards < 7) throw new Error(`only ${cards} cards`);
  if (await q.locator('.brand-switch').count()) throw new Error('the standalone page keeps a link to a page it does not have');
  await q.click('[data-toggle=FSW85]');
  await q.click('[data-goto=rf-hw]');
  await q.waitForTimeout(300);
  if (!(await q.locator('[data-toggle=B90G]').count())) throw new Error('B90G not offered on the FSW85');
  if (qerrs.length) throw new Error(qerrs.join('; '));
  await q.close();
});

if (errs.length) console.log('ISSUES:', errs.join('\n'));
await b.close();
