import { chromium } from 'playwright';
import { BASE, ROOT, BROWSER } from './_env.mjs';
const b = await chromium.launch({ executablePath: BROWSER });
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, colorScheme: 'dark' });
const p = await ctx.newPage(); p.setDefaultTimeout(5000);
const errs = []; p.on('pageerror', e => errs.push(e.message));
let pass = 0, fail = 0;
const t = async (n, fn) => { try { await fn(); console.log('ok   ' + n); pass++; }
  catch (e) { console.log('FAIL ' + n + ' -> ' + e.message.split('\n')[0].slice(0,110)); fail++; } };
await p.goto(`${BASE}/index.html`);
await p.waitForTimeout(500);

await t('a prototype key in the URL does not break the page', async () => {
  await p.goto(`${BASE}/index.html#c=valueOf.hasOwnProperty.constructor`);
  await p.waitForTimeout(600);
  if (errs.length) throw new Error(errs[0]);
  if (!(await p.locator('#panel').innerHTML()).length) throw new Error('the summary pane never rendered');
  const chip = await p.locator('#status-chip').textContent();
  if (chip.includes('checking')) throw new Error('status stuck at ' + chip.trim());
});

await t('primary button keeps its gradient on hover', async () => {
  await p.goto(`${BASE}/index.html#c=B1003.B13.B10`); await p.waitForTimeout(500);
  const btn = p.locator('[data-action=export]');
  const before = await btn.evaluate(el => getComputedStyle(el).backgroundImage);
  await btn.hover(); await p.waitForTimeout(200);
  const after = await btn.evaluate(el => getComputedStyle(el).backgroundImage);
  if (before === 'none') throw new Error('no gradient to begin with');
  if (after !== before) throw new Error('gradient lost on hover');
});

await t('section navigation works while a search is active', async () => {
  await p.fill('#search', 'fading'); await p.waitForTimeout(350);
  await p.locator('.nav-item').nth(3).click(); await p.waitForTimeout(500);
  if (await p.inputValue('#search')) throw new Error('search still active');
  if (!(await p.locator('.section').count())) throw new Error('sections not restored');
});

await t('exporting reports once, not twice', async () => {
  await p.click('[data-action=export]'); await p.waitForTimeout(350);
  await p.click('[data-action=csv]'); await p.waitForTimeout(500);
  const n = await p.locator('.toast').count();
  if (n > 1) throw new Error(n + ' toasts');
  await p.keyboard.press('Escape');
});

await t('the floating button clears the panel footer on a narrow screen', async () => {
  await p.setViewportSize({ width: 420, height: 820 }); await p.waitForTimeout(500);
  await p.click('.panel-toggle'); await p.waitForTimeout(500);
  const [tog, exp] = await Promise.all([
    p.locator('.panel-toggle').boundingBox(),
    p.locator('.panel-foot [data-action=export]').boundingBox()
  ]);
  const overlap = tog && exp &&
    Math.min(tog.x+tog.width, exp.x+exp.width) > Math.max(tog.x, exp.x) &&
    Math.min(tog.y+tog.height, exp.y+exp.height) > Math.max(tog.y, exp.y);
  if (overlap) throw new Error('still overlapping the Export button');
  await p.setViewportSize({ width: 1600, height: 1000 });
});

console.log(`\n${pass} passed, ${fail} failed`);
console.log(errs.length ? 'JS: ' + [...new Set(errs)].join(' | ') : 'no JS errors');
await b.close();
