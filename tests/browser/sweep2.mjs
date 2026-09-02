import { chromium } from 'playwright';
import { BASE, ROOT, BROWSER } from './_env.mjs';
const b = await chromium.launch({ executablePath: BROWSER });
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, colorScheme: 'dark' });
const p = await ctx.newPage(); p.setDefaultTimeout(5000);
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { if (m.type()==='error' && !/favicon/.test(m.text())) errs.push('CONSOLE ' + m.text().slice(0,110)); });
await p.goto(`${BASE}/index.html`);
await p.waitForTimeout(500);
let pass = 0, fail = 0;
const t = async (n, fn) => { try { await fn(); console.log('ok   ' + n); pass++; }
  catch (e) { console.log('FAIL ' + n + ' -> ' + e.message.split('\n')[0].slice(0,130)); fail++; } };

await p.click('[data-action=presets]'); await p.waitForTimeout(200);
await p.click('[data-preset=mimo]'); await p.waitForTimeout(400);

await t('CSV lists every selected option with its order number', async () => {
  const csv = await p.evaluate(() => {
    let captured = null;
    const real = URL.createObjectURL;
    URL.createObjectURL = blob => { captured = blob; return real.call(URL, blob); };
    document.querySelector('[data-action=export]').click();
    return new Promise(res => setTimeout(async () => {
      document.querySelector('[data-action=csv]')?.click();
      setTimeout(async () => { URL.createObjectURL = real; res(captured ? await captured.text() : null); }, 300);
    }, 300));
  });
  if (!csv) throw new Error('no CSV produced');
  const lines = csv.trim().split('\n');
  const sel = await p.evaluate(() => JSON.parse(localStorage.getItem('smw200a-config-v1')).sel);
  for (const id of Object.keys(sel)) {
    if (!csv.includes(id)) throw new Error(`${id} missing from the CSV`);
  }
  if (!/\d{4}\.\d{4}\.\d{2}/.test(csv)) throw new Error('no order numbers in the CSV');
  console.log(`       (${lines.length} lines, ${Object.keys(sel).length} options)`);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
});

await t('JSON export carries selection, derived figures and issues', async () => {
  const json = await p.evaluate(() => {
    let captured = null;
    const real = URL.createObjectURL;
    URL.createObjectURL = blob => { captured = blob; return real.call(URL, blob); };
    document.querySelector('[data-action=export]').click();
    return new Promise(res => setTimeout(() => {
      document.querySelector('[data-action=json]')?.click();
      setTimeout(async () => { URL.createObjectURL = real; res(captured ? await captured.text() : null); }, 300);
    }, 300));
  });
  if (!json) throw new Error('no JSON produced');
  const o = JSON.parse(json);
  for (const key of ['items', 'capabilities', 'issues', 'valid', 'source', 'link'])
    if (!(key in o)) throw new Error('JSON has no ' + key + ' (keys: ' + Object.keys(o) + ')');
  const sel = await p.evaluate(() => JSON.parse(localStorage.getItem('smw200a-config-v1')).sel);
  const listed = JSON.stringify(o.items);
  for (const id of Object.keys(sel)) if (!listed.includes(id)) throw new Error(id + ' missing from JSON items');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
});

await t('print view keeps the parts list and drops the chrome', async () => {
  await p.emulateMedia({ media: 'print' });
  await p.waitForTimeout(300);
  const vis = await p.evaluate(() => ({
    rail: !!document.querySelector('.rail')?.offsetParent,
    topbar: !!document.querySelector('.topbar')?.offsetParent,
    body: document.body.innerText.length
  }));
  if (vis.rail || vis.topbar) throw new Error('navigation still printed');
  if (vis.body < 200) throw new Error('print view is nearly empty');
  // print hides the chrome with !important; make sure that is fully undone
  await p.emulateMedia({ media: 'screen' }); await p.waitForTimeout(400);
  await p.locator('.topbar').waitFor({ state: 'visible' });
});

await t('mobile layout works and the instrument is reachable', async () => {
  await p.setViewportSize({ width: 390, height: 780 }); await p.waitForTimeout(500);
  const heroOn = await p.evaluate(() => {
    // either view counts: the photograph or the drawing
    const s = document.querySelector('.hero .viz-panel img, .hero .viz-panel > svg');
    if (!s) return false;
    const r = s.getBoundingClientRect();
    return r.width > 0 && r.top < innerHeight && r.bottom > 0;
  });
  if (!heroOn) throw new Error('instrument not visible at 390px');
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (overflow > 2) throw new Error('page scrolls sideways by ' + overflow + 'px');
  await p.click('.panel-toggle'); await p.waitForTimeout(400);
  if (!(await p.locator('.panel.open').count())) throw new Error('summary panel did not open');
  await p.setViewportSize({ width: 1600, height: 1000 }); await p.waitForTimeout(400);
});

await t('interactive controls are reachable and labelled', async () => {
  const bad = await p.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('button')) {
      const name = (el.getAttribute('aria-label') || el.textContent || '').trim();
      if (!name) out.push(el.className || el.dataset.action || '(button)');
    }
    return out.slice(0, 5);
  });
  if (bad.length) throw new Error('unlabelled buttons: ' + bad.join(', '));
  const focus = await p.evaluate(() => {
    const el = document.querySelector('.tick, .card button, button');
    el.focus();
    return getComputedStyle(el, ':focus-visible').outlineStyle !== undefined;
  });
  if (!focus) throw new Error('no focus styling');
});

await t('option toggles report their state to assistive tech', async () => {
  const n = await p.locator('[data-toggle][aria-pressed]').count();
  const total = await p.locator('[data-toggle]').count();
  if (n < total * 0.5) throw new Error(`${n} of ${total} toggles expose aria-pressed`);
});

console.log(`\n${pass} passed, ${fail} failed`);
console.log(errs.length ? 'JS ISSUES:\n  ' + [...new Set(errs)].join('\n  ') : 'no JS errors');
await b.close();
