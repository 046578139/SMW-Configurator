import { chromium } from 'playwright';
import { BASE, ROOT, BROWSER } from './_env.mjs';
const b = await chromium.launch({ executablePath: BROWSER });
const ctx = await b.newContext({ viewport: { width: 1700, height: 1000 }, colorScheme: 'dark' });
const p = await ctx.newPage(); p.setDefaultTimeout(6000);
const errs = []; p.on('pageerror', e => errs.push(e.message));
let pass=0, fail=0;
const t = async (n, fn) => { try { await fn(); console.log('ok   '+n); pass++; }
  catch(e){ console.log('FAIL '+n+' -> '+e.message.split('\n')[0].slice(0,110)); fail++; } };

await p.goto(`${BASE}/index.html#c=B1044.B13T.B2020.B94L.B10*2`);
await p.waitForTimeout(800);

await t('the photograph is the default view and actually loads', async () => {
  const img = p.locator('.photo img');
  if (!(await img.count())) throw new Error('no photograph shown');
  const ok = await img.evaluate(el => el.complete && el.naturalWidth > 0);
  if (!ok) throw new Error('the image did not load');
});
await t('switching to the schematic and back works', async () => {
  await p.click('[data-view=schematic]'); await p.waitForTimeout(400);
  if (await p.locator('.photo').count()) throw new Error('photo still shown');
  if (!(await p.locator('.viz-panel > svg').count())) throw new Error('no schematic');
  await p.click('[data-view=photo]'); await p.waitForTimeout(400);
  if (!(await p.locator('.photo').count())) throw new Error('photo did not come back');
});
await t('the choice survives a reload', async () => {
  await p.click('[data-view=schematic]'); await p.waitForTimeout(300);
  await p.reload(); await p.waitForTimeout(700);
  if (await p.locator('.photo').count()) throw new Error('did not remember the schematic');
  await p.click('[data-view=photo]'); await p.waitForTimeout(300);
});
await t('the rear photograph loads too', async () => {
  await p.click('[data-face=rear]'); await p.waitForTimeout(500);
  const ok = await p.locator('.photo img').evaluate(el => el.complete && el.naturalWidth > 0);
  if (!ok) throw new Error('rear image did not load');
});
await t('markers stay on the connectors when the panel is resized', async () => {
  await p.click('[data-face=front]'); await p.waitForTimeout(400);
  const rel = async () => p.evaluate(() => {
    const img = document.querySelector('.photo img').getBoundingClientRect();
    const c = document.querySelector('.photo-overlay circle').getBoundingClientRect();
    return [(c.x + c.width/2 - img.x) / img.width, (c.y + c.height/2 - img.y) / img.height];
  });
  const wide = await rel();
  await p.setViewportSize({ width: 900, height: 900 }); await p.waitForTimeout(600);
  const narrow = await rel();
  const drift = Math.max(Math.abs(wide[0]-narrow[0]), Math.abs(wide[1]-narrow[1]));
  if (drift > 0.005) throw new Error('marker drifted by ' + (drift*100).toFixed(1) + '% of the image');
  await p.setViewportSize({ width: 1700, height: 1000 });
});
console.log(`\n${pass} passed, ${fail} failed`);
console.log(errs.length ? 'JS: ' + errs[0] : 'no JS errors');
await b.close();
