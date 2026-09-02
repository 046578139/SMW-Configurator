import { chromium } from 'playwright';
import { BASE, ROOT, BROWSER } from './_env.mjs';
const b = await chromium.launch({ executablePath: BROWSER });
const p = await b.newPage({ viewport: { width: 1500, height: 950 }, colorScheme: 'dark' });
p.on('console', m => { if (m.type()==='error') console.log('CONSOLE', m.text().slice(0,120)); });

// reproduce the artifact viewer: the page runs inside a sandboxed iframe
await p.setContent(`<iframe id="f" src="${BASE}/index.html"
  sandbox="allow-scripts allow-same-origin" style="width:1400px;height:900px;border:0"></iframe>`);
await p.waitForTimeout(1200);
const f = p.frameLocator('#f');

console.log('does confirm() work in this frame?',
  await p.frames()[1].evaluate(() => { try { return window.confirm('x'); } catch (e) { return 'threw: ' + e.message.slice(0,60); } }));

await f.locator('[data-action=presets]').click(); await p.waitForTimeout(250);
await f.locator('[data-preset=mimo]').click(); await p.waitForTimeout(400);
const before = await f.locator('.card.on').count();
await f.locator('[data-action=reset]').click(); await p.waitForTimeout(400);
console.log((await f.locator('[data-action=reset-confirm]').count() ? 'ok   ' : 'FAIL ') + 'clearing asks in the page, not through confirm()');
console.log('  asks:', (await f.locator('.modal h2').textContent().catch(()=>'(none)')).trim(),
  '|', (await f.locator('.modal-head p').textContent().catch(()=>'')).trim());

// cancelling must leave the configuration alone
await f.locator('.modal-foot .btn').first().click(); await p.waitForTimeout(300);
console.log(((await f.locator('.card.on').count()) === before ? 'ok   ' : 'FAIL ') + 'cancelling leaves the configuration alone');

await f.locator('[data-action=reset]').click(); await p.waitForTimeout(350);
await f.locator('[data-action=reset-confirm]').click(); await p.waitForTimeout(500);
const after = await f.locator('.card.on').count();
// a fresh page always shows the default phase-noise level as selected
console.log((after <= 1 ? 'ok   ' : 'FAIL ') + `clearing empties the configuration (${before} -> ${after})`);

// the share fallback must not use prompt() either
await f.locator('[data-action=share]').click(); await p.waitForTimeout(500);
const field = f.locator('.link-field');
console.log((await field.count() > 0 ? 'ok   ' : 'FAIL ') + 'the share fallback shows the link in the page, not through prompt()');
await b.close();
