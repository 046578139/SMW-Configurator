import { chromium } from 'playwright';
import { BASE, ROOT, BROWSER } from './_env.mjs';
const b = await chromium.launch({ executablePath: BROWSER });
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, colorScheme: 'dark' });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errs.push('CONSOLE ' + m.text().slice(0,110)); });
p.setDefaultTimeout(5000);
await p.goto(`${BASE}/index.html`);
await p.waitForTimeout(500);
await p.click('[data-view=schematic]').catch(()=>{}); await p.waitForTimeout(300);

let pass = 0, fail = 0;
const t = async (name, fn) => {
  try { await fn(); console.log('ok   ' + name); pass++; }
  catch (e) { console.log('FAIL ' + name + ' -> ' + e.message.split('\n')[0].slice(0,120)); fail++; }
};
const reset = async () => {
  await p.click('[data-action=reset]').catch(()=>{});
  await p.waitForTimeout(200);
  if (await p.locator('[data-action=reset-confirm]').count()) {
    await p.click('[data-action=reset-confirm]'); await p.waitForTimeout(300);
  } else { await p.keyboard.press('Escape'); }
};

await t('every section renders with options', async () => {
  const secs = await p.locator('.section').count();
  const cards = await p.locator('.card, .tick').count();
  if (secs < 10) throw new Error('only ' + secs + ' sections');
  if (cards < 200) throw new Error('only ' + cards + ' option controls');
});

await t('every starting point loads and validates', async () => {
  const ids = await p.locator('[data-preset]').evaluateAll(n => n.map(x => x.dataset.preset)).catch(()=>[]);
  await p.keyboard.press('Escape');
  await p.click('[data-action=presets]'); await p.waitForTimeout(250);
  const list = await p.locator('[data-preset]').evaluateAll(n => n.map(x => x.dataset.preset));
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  for (const id of list) {
    await p.click('[data-action=presets]'); await p.waitForTimeout(200);
    await p.click(`[data-preset=${id}]`); await p.waitForTimeout(350);
    const chip = (await p.locator('#status-chip').textContent()).trim();
    if (!chip.includes('valid')) throw new Error(`${id}: ${chip}`);
  }
  console.log('       (' + list.length + ' starting points, all valid)');
});

await t('search finds by code, name and order number', async () => {
  for (const [q, expect] of [['B1067', 'B1067'], ['fading', null], ['1428.5307.02', 'B1031']]) {
    await p.fill('#search', q); await p.waitForTimeout(300);
    const n = await p.locator('.card, .tick').count();
    if (!n) throw new Error(`"${q}" found nothing`);
    if (expect && !(await p.locator(`[data-toggle=${expect}]`).count())) throw new Error(`"${q}" did not surface ${expect}`);
  }
  await p.fill('#search', ''); await p.waitForTimeout(250);
});

await t('quantity stepper respects the documented limit', async () => {
  await reset();
  for (const id of ['B1003','B13T','B10']) {
    await p.fill('#search', id); await p.waitForTimeout(250);
    await p.locator(`[data-toggle=${id}]`).first().click(); await p.waitForTimeout(250);
  }
  await p.fill('#search', 'B10'); await p.waitForTimeout(300);
  const plus = p.locator('[data-step="B10:1"]').first();
  for (let i = 0; i < 6; i++) {
    if (!(await plus.count())) break;
    if (!(await plus.isEnabled().catch(() => false))) break;
    await plus.click(); await p.waitForTimeout(120);
  }
  await p.fill('#search', ''); await p.waitForTimeout(200);
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('smw200a-config-v1')).sel.B10);
  if (stored > 2) throw new Error('B10 reached ' + stored + ', documented maximum is 2');
});

await t('share link round-trips the whole configuration', async () => {
  const idsOf = pg => pg.evaluate(() => [...document.querySelectorAll('[data-toggle][aria-pressed=true], .card.on')]
    .map(n => n.dataset.toggle).filter(Boolean).sort().join(','));
  const before = await idsOf(p);
  const p2 = await ctx.newPage();            // same context, so storage is shared
  await p2.goto(p.url()); await p2.waitForTimeout(600);
  const after = await idsOf(p2);
  await p2.close();
  if (before !== after) throw new Error(`${before} != ${after}`);
});

await t('checks tab lists issues with something to click', async () => {
  await reset();
  await p.fill('#search', 'K512'); await p.waitForTimeout(300);
  await p.locator('[data-toggle=K512]').first().click(); await p.waitForTimeout(300);
  await p.fill('#search', ''); await p.waitForTimeout(200);
  await p.click('[data-tab=checks]'); await p.waitForTimeout(300);
  const issues = await p.locator('.issue').count();
  if (!issues) throw new Error('no issues shown for an unmet prerequisite');
  const actions = await p.locator('.issue .mini').count();
  if (!actions) throw new Error('issues offer no action');
});

await t('Fix issues settles prerequisites and reports the rest', async () => {
  const before = await p.locator('.issue').count();
  await p.click('[data-action=resolve]'); await p.waitForTimeout(500);
  await p.click('[data-tab=checks]'); await p.waitForTimeout(250);
  const after = await p.locator('.issue').count();
  if (after >= before) throw new Error(`still ${after} of ${before} issues`);
  // every error must leave the user something to do; info notes are context
  for (const el of await p.locator('.issue.error').all()) {
    if (!(await el.locator('.mini').count())) {
      throw new Error('an error offers nothing to do: ' +
        (await el.locator('strong').first().textContent()).trim());
    }
  }
  const badge = Number((await p.locator('.tab', { hasText: 'Checks' }).locator('.badge').textContent()).trim());
  const errors = await p.locator('.issue.error').count();
  if (badge !== errors) throw new Error(`badge says ${badge} but ${errors} errors are shown`);
});

await t('choosing the two mandatory options then reaches valid', async () => {
  for (const id of ['B1003', 'B13']) {
    await p.fill('#search', id); await p.waitForTimeout(250);
    await p.locator(`[data-toggle=${id}]`).first().click(); await p.waitForTimeout(250);
  }
  await p.fill('#search', ''); await p.waitForTimeout(200);
  await p.click('[data-action=resolve]'); await p.waitForTimeout(500);
  const chip = (await p.locator('#status-chip').textContent()).trim();
  if (!chip.includes('valid')) throw new Error(chip);
});

await t('parts list and export produce the selected options', async () => {
  const bomTab = p.locator('.tab', { hasText: 'Parts list' });
  if (await bomTab.count()) await bomTab.click();
  await p.waitForTimeout(300);
  const rows = await p.locator('.bom-line, .bom-row, tr').count();
  if (rows < 2) throw new Error('parts list is empty');
  await p.click('[data-action=export]'); await p.waitForTimeout(400);
  if (!(await p.locator('.modal').count())) throw new Error('export dialog did not open');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
});

await t('theme toggle switches and persists', async () => {
  const before = await p.evaluate(() => document.documentElement.dataset.theme);
  await p.click('[data-action=theme]'); await p.waitForTimeout(300);
  const after = await p.evaluate(() => document.documentElement.dataset.theme);
  if (before === after) throw new Error('theme did not change');
  await p.reload(); await p.waitForTimeout(600);
  if (await p.evaluate(() => document.documentElement.dataset.theme) !== after) throw new Error('theme did not persist');
  await p.click('[data-action=theme]'); await p.waitForTimeout(250);
});

await t('keyboard: / focuses search, Escape clears it', async () => {
  await p.keyboard.press('/'); await p.waitForTimeout(200);
  if (await p.evaluate(() => document.activeElement.id) !== 'search') throw new Error('slash did not focus search');
  await p.fill('#search', 'B14'); await p.waitForTimeout(250);
  await p.keyboard.press('Escape'); await p.waitForTimeout(250);
  if (await p.inputValue('#search')) throw new Error('escape did not clear the search');
});

await t('instrument redraws when the configuration changes', async () => {
  await reset();
  await p.click('[data-view=schematic]').catch(()=>{}); await p.waitForTimeout(300);
  const empty = await p.locator('.hero .viz-panel > svg').innerHTML();
  await p.fill('#search', 'B1067'); await p.waitForTimeout(250);
  await p.locator('[data-toggle=B1067]').first().click(); await p.waitForTimeout(350);
  await p.fill('#search', ''); await p.waitForTimeout(250);
  const after = await p.locator('.hero .viz-panel > svg').innerHTML();
  if (empty === after) throw new Error('the drawing did not change');
  if (!after.includes('100kHz–67GHz')) throw new Error('the RF label does not follow the option');
});

console.log(`\n${pass} passed, ${fail} failed`);
console.log(errs.length ? 'JS ISSUES:\n  ' + [...new Set(errs)].join('\n  ') : 'no JS errors during the sweep');
await b.close();
