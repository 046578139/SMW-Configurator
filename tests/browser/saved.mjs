/**
 * Saving a configuration from the header and getting it back: in this
 * browser alone, and on the page itself when a host offers the artifact's
 * document store. The host is stood in for by a small store installed before
 * the page's own scripts run, which keeps its documents in a storage key of
 * its own so they outlive a reload the way the real one does.
 */

import { chromium } from 'playwright';
import { BASE, BROWSER } from './_env.mjs';

const b = await chromium.launch({ executablePath: BROWSER });
let pass = 0, fail = 0;
const t = async (n, fn) => { try { await fn(); console.log('ok   ' + n); pass++; }
  catch (e) { console.log('FAIL ' + n + ' -> ' + e.message.split('\n')[0].slice(0, 140)); fail++; } };

const HOSTED = `
  (() => {
    const KEY = '__fake_db_configs';
    const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
    const write = docs => localStorage.setItem(KEY, JSON.stringify(docs));
    const listeners = [];
    const snap = () => ({ docs: Object.entries(read())
      .sort((x, y) => String(y[1].savedAt).localeCompare(String(x[1].savedAt)))
      .map(([id, body]) => ({ id, exists: true, data: () => body })) });
    const notify = () => listeners.forEach(fn => fn(snap()));
    const db = Object.freeze({
      collection: () => ({
        orderBy: () => ({ limit: () => ({ onSnapshot: (next) => { listeners.push(next); setTimeout(notify, 30); return () => {}; } }) }),
        doc: id => ({
          async set (body) { const d = read(); d[id] = body; write(d); notify(); },
          async delete () { const d = read(); delete d[id]; write(d); notify(); }
        })
      })
    });
    window.claude = { use: name => new Promise(r => setTimeout(() => r(name === 'db' ? db : null), 50)) };
  })();`;

async function page (hosted) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, colorScheme: 'dark' });
  const p = await ctx.newPage(); p.setDefaultTimeout(5000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  if (hosted) await p.addInitScript(HOSTED);
  return { ctx, p, errs };
}
const open = async (p, hash) => {
  await p.goto(`${BASE}/index.html${hash ? '#c=' + hash : ''}`);
  await p.reload();                 // a hash change alone is not a fresh load
  await p.waitForTimeout(700);
};
const count = async p => (await p.locator('#saved-count').textContent()).trim();
const rows = p => p.locator('.saved-row');

/* ------------------------------------------------------- this browser */
{
  const { ctx, p, errs } = await page(false);
  await p.goto(`${BASE}/index.html`);
  await p.evaluate(() => { try { localStorage.clear(); } catch {} });

  await t('Save keeps the configuration under the name in the header', async () => {
    await open(p, 'B1020.B13T.B10');
    await p.fill('#config-name', 'Two-path 20 GHz');
    await p.locator('#config-name').press('Tab');
    if (await count(p) !== '0') throw new Error('count starts at ' + await count(p));
    await p.click('[data-action="save"]');
    await p.waitForTimeout(300);
    if (await count(p) !== '1') throw new Error('count is ' + await count(p) + ' after saving');
    if (!(await p.locator('.toast').textContent()).includes('Saved “Two-path 20 GHz”')) throw new Error('no confirmation');
  });

  await t('the list shows the name, what it is and when', async () => {
    await p.click('[data-action="saved"]');
    await p.waitForTimeout(300);
    if (await rows(p).count() !== 1) throw new Error(await rows(p).count() + ' rows');
    const text = (await rows(p).first().textContent()).replace(/\s+/g, ' ');
    if (!text.includes('Two-path 20 GHz')) throw new Error('name missing: ' + text);
    if (!text.includes('B1020 · B13T · 3 options')) throw new Error('summary missing: ' + text);
    if (!/20\d\d/.test(text)) throw new Error('date missing: ' + text);
    const sub = await p.locator('.modal-head p').textContent();
    if (!sub.includes('Kept in this browser')) throw new Error('the list does not say where it lives: ' + sub);
    await p.click('[data-close]');
  });

  await t('saving under the same name updates the entry rather than adding one', async () => {
    await p.locator('.nav-item', { hasText: 'RF path enhancements' }).click();
    await p.waitForTimeout(300);
    await p.locator('.card[data-opt="K22"] .tick').click();
    await p.waitForTimeout(300);
    await p.click('[data-action="save"]');
    await p.waitForTimeout(300);
    if (await count(p) !== '1') throw new Error('count is ' + await count(p));
    if (!(await p.locator('.toast').last().textContent()).includes('Updated')) throw new Error('did not say it updated');
    await p.click('[data-action="saved"]');
    await p.waitForTimeout(300);
    const text = (await rows(p).first().textContent()).replace(/\s+/g, ' ');
    if (!text.includes('4 options')) throw new Error('the entry was not updated: ' + text);
    await p.click('[data-close]');
  });

  await t('the list is still there after a reload, and Load brings the configuration back', async () => {
    await open(p, 'B1003.B13');                     // a different configuration
    if (await count(p) !== '1') throw new Error('count is ' + await count(p) + ' after reload');
    await p.click('[data-action="saved"]');
    await p.waitForTimeout(300);
    await rows(p).first().locator('[data-load]').click();
    await p.waitForTimeout(500);
    if (await p.locator('.scrim').count()) throw new Error('the list stayed open');
    const name = await p.inputValue('#config-name');
    if (name !== 'Two-path 20 GHz') throw new Error('name is ' + name);
    for (const id of ['B1020', 'B13T', 'B10', 'K22']) {
      if (!(await p.locator(`.card[data-opt="${id}"].on`).count())) throw new Error(id + ' not restored');
    }
    if (await p.locator('.card[data-opt="B1003"].on').count()) throw new Error('the old configuration is still there');
    if (!(await p.evaluate(() => location.hash)).includes('B1020')) throw new Error('the link was not updated');
  });

  await t('removing an entry empties the list', async () => {
    await p.click('[data-action="saved"]');
    await p.waitForTimeout(300);
    await rows(p).first().locator('[data-forget]').click();
    await p.waitForTimeout(300);
    if (await rows(p).count()) throw new Error('the row is still there');
    if (!(await p.locator('.saved-empty').count())) throw new Error('no empty state');
    if (await count(p) !== '0') throw new Error('count is ' + await count(p));
    await p.click('[data-close]');
  });

  await t('with nothing chosen there is nothing to save', async () => {
    await p.click('[data-action="reset"]');
    await p.waitForTimeout(200);
    await p.click('[data-action="reset-confirm"]');
    await p.waitForTimeout(300);
    await p.click('[data-action="save"]');
    await p.waitForTimeout(200);
    if (await count(p) !== '0') throw new Error('an empty configuration was saved');
    if (!(await p.locator('.toast').last().textContent()).includes('Nothing to save')) throw new Error('no word about it');
  });

  if (errs.length) { console.log('FAIL JS errors: ' + [...new Set(errs)].join(' | ')); fail++; }
  await ctx.close();
}

/* ----------------------------------------------------- on the page itself */
{
  const { ctx, p, errs } = await page(true);
  await p.goto(`${BASE}/index.html`);
  await p.evaluate(() => { try { localStorage.clear(); } catch {} });

  await t('with a host, a save goes to the page and the list says so', async () => {
    await open(p, 'B1044.B13XT.B9*2');
    await p.fill('#config-name', 'Wideband pair');
    await p.locator('#config-name').press('Tab');
    await p.waitForTimeout(200);                    // the host answers after ~80 ms
    await p.click('[data-action="save"]');
    await p.waitForTimeout(400);
    const hostedDocs = await p.evaluate(() => JSON.parse(localStorage.getItem('__fake_db_configs') || '{}'));
    const bodies = Object.values(hostedDocs);
    if (bodies.length !== 1 || bodies[0].name !== 'Wideband pair' || bodies[0].c !== 'B1044.B13XT.B9*2') {
      throw new Error('the page store holds ' + JSON.stringify(hostedDocs));
    }
    await p.click('[data-action="saved"]');
    await p.waitForTimeout(300);
    const sub = await p.locator('.modal-head p').textContent();
    if (!sub.includes('Kept on this page')) throw new Error('the list does not say it is on the page: ' + sub);
    await p.click('[data-close]');
  });

  await t('the page\'s list comes back in a browser that never saw it', async () => {
    // wipe this browser's own cache but leave the page's store: a new browser
    await p.evaluate(() => localStorage.removeItem('smw200a-saved-v1'));
    await open(p, 'B1003.B13');
    await p.waitForTimeout(300);
    if (await count(p) !== '1') throw new Error('count is ' + await count(p) + ' from the page store alone');
    await p.click('[data-action="saved"]');
    await p.waitForTimeout(300);
    const text = (await rows(p).first().textContent()).replace(/\s+/g, ' ');
    if (!text.includes('Wideband pair')) throw new Error('entry missing: ' + text);
    await rows(p).first().locator('[data-load]').click();
    await p.waitForTimeout(500);
    if (!(await p.locator('.card[data-opt="B1044"].on').count())) throw new Error('not restored from the page store');
  });

  await t('a removal reaches the page store too', async () => {
    await p.click('[data-action="saved"]');
    await p.waitForTimeout(300);
    await rows(p).first().locator('[data-forget]').click();
    await p.waitForTimeout(400);
    const hostedDocs = await p.evaluate(() => JSON.parse(localStorage.getItem('__fake_db_configs') || '{}'));
    if (Object.keys(hostedDocs).length) throw new Error('still on the page: ' + JSON.stringify(hostedDocs));
    await p.click('[data-close]');
  });

  if (errs.length) { console.log('FAIL JS errors: ' + [...new Set(errs)].join(' | ')); fail++; }
  await ctx.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
