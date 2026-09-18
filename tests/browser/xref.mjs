/**
 * The Keysight cross-reference in the page: a pasted E8267D listing becomes
 * a grouped cross-reference in the Import dialog, loads as the SMW200A
 * equivalent, shows up as a Cross-ref tab that watches the configuration,
 * and travels with the exports. An R&S document still reads the R&S way,
 * and a mixed one offers both.
 */

import { chromium } from 'playwright';
import { BASE, BROWSER } from './_env.mjs';

const b = await chromium.launch({ executablePath: BROWSER });
let pass = 0, fail = 0;
const t = async (n, fn) => { try { await fn(); console.log('ok   ' + n); pass++; }
  catch (e) { console.log('FAIL ' + n + ' -> ' + e.message.split('\n')[0].slice(0, 150)); fail++; } };

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

const LISTING = `Keysight Premium Used
Keysight E8267D-544
Installed Options
544 Frequency range from 250 kHz to 44 GHz Installed
1EH Improved harmonics below 2 GHz Installed
602 Internal baseband generator, 64 MSa memory Installed
H18 Wideband Modulation less than 3.2 GHz Installed
H1G Provides 1GHz In and Out to minimize phase drift Installed
HCC Provides 250MHz - 10GHz In and Out on the rear panel Installed
UNW Narrow pulse modulation Installed
UNY Enhanced phase noise Installed`;

/* a host whose AI transcribes a Keysight listing, and one that saves files */
const HOST = `
  window.__ai = { calls: 0 };
  const sample = async () => ({ text: '[]' });
  sample.json = (input, opts) => new Promise((resolve, reject) => {
    window.__ai.calls++; window.__ai.prompt = input;
    opts.signal?.addEventListener('abort', () => reject({ code: 'cancelled', message: 'aborted' }));
    setTimeout(() => resolve([
      { type: 'E8267D-520', order: null, qty: 1, designation: 'Frequency range 250 kHz to 20 GHz' },
      { type: 'UNT', order: null, qty: 1, designation: 'AM, FM, phase modulation and LF output' },
      { type: 'N7617EMBC', order: null, qty: 1, designation: 'WLAN' }
    ]), 300);
  });
  sample.limits = async () => ({ maxPromptBytes: 65536, images: { maxCount: 2, maxInputBytes: 20e6, mediaTypes: ['image/png'] } });
  window.__saves = [];
  const downloads = { save: async ({ filename, data }) => { window.__saves.push({ filename, data: String(data) }); } };
  window.claude = { use: name => new Promise(r => setTimeout(() => r(name === 'sample' ? sample : name === 'downloads' ? downloads : null), 40)) };`;

async function page (hosted) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, colorScheme: 'dark' });
  const p = await ctx.newPage(); p.setDefaultTimeout(5000);
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  if (hosted) await p.addInitScript(HOST);
  await p.goto(`${BASE}/index.html#c=B1003.B13`);
  await p.evaluate(() => { try { localStorage.clear(); } catch {} });
  await p.reload();
  await p.waitForTimeout(600);
  return { ctx, p, errs };
}
const openImport = async p => {
  if (await p.locator('.scrim').count()) { await p.keyboard.press('Escape'); await p.waitForTimeout(150); }
  await p.click('[data-action="import"]');
  await p.waitForTimeout(150);
};
const paste = async (p, text) => { await p.fill('#import-text', text); await p.waitForTimeout(500); };
const on = async (p, id) => !!(await p.locator(`.card[data-opt="${id}"].on`).count());

/* ------------------------------------------------------ without a host */
{
  const { ctx, p, errs } = await page(false);

  await t('a pasted E8267D listing becomes a grouped cross-reference', async () => {
    await openImport(p);
    await paste(p, LISTING);
    const summary = await p.locator('.import-summary').textContent();
    if (!/Keysight E8267D recognised · 8 options · SMW200A equivalent: 7 options/.test(summary.replace(/\s+/g, ' '))) throw new Error('summary: ' + summary);
    const heads = await p.locator('#import-result .group-head').allTextContents();
    for (const h of ['Covered by an SMW option', 'No option needed', 'Not covered']) if (!heads.includes(h)) throw new Error('groups: ' + heads.join(' | '));
    if (await p.locator('.xref-table tbody tr').count() !== 8) throw new Error(await p.locator('.xref-table tbody tr').count() + ' rows');
    const uny = p.locator('.xref-table tbody tr', { hasText: 'E8267D-UNY' });
    if (!(await uny.textContent()).includes('R&S®SMW-B711')) throw new Error('UNY row: ' + await uny.textContent());
    if (!(await uny.textContent()).includes('DS p12')) throw new Error('no citation on the UNY row');
    const eh = p.locator('.xref-table tbody tr', { hasText: 'E8267D-1EH' });
    if (!(await eh.textContent()).includes('Not covered')) throw new Error('1EH row: ' + await eh.textContent());
    if (await p.locator('.import-table').count()) throw new Error('the R&S table was drawn for a Keysight document');
    if (!/Load the SMW equivalent/.test(await p.locator('#import-load').textContent())) throw new Error('button says: ' + await p.locator('#import-load').textContent());
    if (await p.locator('#import-load').isDisabled()) throw new Error('Load disabled');
  });

  await t('loading it replaces the configuration with the equivalent, names it, and opens the Cross-ref tab', async () => {
    await p.click('#import-load');
    await p.waitForTimeout(600);
    if (await p.locator('.scrim').count()) throw new Error('the dialog stayed open');
    for (const id of ['B1044', 'B13', 'B10', 'B90', 'K22', 'K23']) if (!(await on(p, id))) throw new Error(id + ' not loaded');
    if (await on(p, 'B1003')) throw new Error('the old configuration survived');
    // the phase noise level is a radio row, not a card: the link says whether it is in
    if (!(await p.evaluate(() => location.hash)).includes('B711')) throw new Error('B711 not loaded');
    if (await p.inputValue('#config-name') !== 'Equivalent of Keysight E8267D') throw new Error('name is ' + await p.inputValue('#config-name'));
    const tab = p.locator('.panel-tabs .tab[data-tab="xref"]');
    if (!(await tab.count())) throw new Error('no Cross-ref tab');
    if (!(await tab.getAttribute('class')).includes('active')) throw new Error('the tab is not active');
    if ((await tab.textContent()).replace(/\s+/g, ' ').trim() !== 'Cross-ref 8') throw new Error('tab reads ' + await tab.textContent());
    if (await p.locator('.xref-row').count() !== 8) throw new Error(await p.locator('.xref-row').count() + ' rows in the pane');
    if (await p.locator('.xref-row.gone').count()) throw new Error('a row is flagged gone on a fresh load');
    const hash = await p.evaluate(() => location.hash);
    if (!hash.includes('B1044') || !hash.includes('K23')) throw new Error('link: ' + hash);
  });

  await t('the tab flags an SMW option that was taken out again, survives a reload, and can be forgotten', async () => {
    await p.click('.card[data-opt="K23"] [data-toggle]');
    await p.waitForTimeout(300);
    if (await on(p, 'K23')) throw new Error('K23 still on');
    await p.click('.panel-tabs .tab[data-tab="xref"]');
    await p.waitForTimeout(200);
    const gone = p.locator('.xref-row.gone');
    if (await gone.count() !== 1) throw new Error(await gone.count() + ' rows flagged');
    if (!(await gone.textContent()).includes('R&S®SMW-K23 removed')) throw new Error('flag reads: ' + await gone.textContent());
    if (!(await p.locator('.xref-lead').textContent()).includes('1 no longer fully')) throw new Error('lead: ' + await p.locator('.xref-lead').textContent());
    await p.reload();
    await p.waitForTimeout(600);
    if (!(await p.locator('.panel-tabs .tab[data-tab="xref"]').count())) throw new Error('the cross-reference did not survive a reload');
    await p.click('.panel-tabs .tab[data-tab="xref"]');
    await p.waitForTimeout(200);
    await p.click('[data-action="xref-forget"]');
    await p.waitForTimeout(300);
    if (await p.locator('.panel-tabs .tab[data-tab="xref"]').count()) throw new Error('the tab stayed');
    if (!(await on(p, 'B1044'))) throw new Error('forgetting the cross-reference changed the configuration');
    if (await p.inputValue('#config-name') !== 'Equivalent of Keysight E8267D') throw new Error('the name changed');
  });

  await t('an R&S document reads the R&S way, a mixed one offers both views, another Keysight model gets a plain answer', async () => {
    await openImport(p);
    await paste(p, '1 1 R&S SMW-B1020 100 kHz to 20 GHz 1428.5107.02\n2 1 R&S SMW-B13T 1413.3003.02');
    if (await p.locator('.xref-table').count()) throw new Error('a cross-reference for an R&S document');
    if (await p.locator('.import-table tbody tr').count() !== 2) throw new Error('R&S rows: ' + await p.locator('.import-table tbody tr').count());
    if (await p.locator('.import-switch').count()) throw new Error('a switch offered with nothing to switch to');
    await paste(p, '1 1 R&S SMW-B1020 100 kHz to 20 GHz 1428.5107.02\nAlternative: Keysight E8267D-520 with E8267D-UNW');
    if (await p.locator('.import-table tbody tr').count() !== 1) throw new Error('the R&S reading did not have the say');
    if (!(await p.locator('.import-switch').count())) throw new Error('no switch to the cross-reference');
    await p.click('.import-switch [data-action="import-view"]');
    await p.waitForTimeout(150);
    if (await p.locator('.xref-table tbody tr').count() !== 2) throw new Error('switching did not show the cross-reference');
    if (!/Load the SMW equivalent/.test(await p.locator('#import-load').textContent())) throw new Error('button not relabelled');
    await p.click('.import-switch [data-action="import-view"]');
    await p.waitForTimeout(150);
    if (await p.locator('.import-table tbody tr').count() !== 1) throw new Error('switching back failed');
    if (!/Replace configuration/.test(await p.locator('#import-load').textContent())) throw new Error('button not relabelled back');
    await paste(p, 'Keysight N5182B MXG vector signal generator with N5182B-506');
    const s = await p.locator('#import-result').textContent();
    if (!s.includes('N5182B') || !s.includes('no table for this model yet')) throw new Error('says: ' + s.replace(/\s+/g, ' ').slice(0, 160));
    if (!(await p.locator('#import-load').isDisabled())) throw new Error('Load enabled with no table');
    await p.keyboard.press('Escape');
  });

  await t('Add keeps the configuration and adds the equivalent to it', async () => {
    await p.goto(`${BASE}/index.html#c=B1003.B13.K62`);
    await p.reload();
    await p.waitForTimeout(600);
    await p.fill('#config-name', 'Bench rig');
    await p.locator('#config-name').press('Tab');
    await openImport(p);
    await paste(p, 'E8267D-UNW narrow pulse');
    if (!/Add the equivalent/.test(await p.locator('#import-merge').textContent())) throw new Error('Add not relabelled');
    await p.click('#import-merge');
    await p.waitForTimeout(600);
    for (const id of ['B1003', 'B13', 'K62', 'K22', 'K23']) if (!(await on(p, id))) throw new Error(id + ' missing after Add');
    if (await p.inputValue('#config-name') !== 'Bench rig') throw new Error('Add renamed the configuration');
    if (!(await p.locator('.panel-tabs .tab[data-tab="xref"]').count())) throw new Error('no Cross-ref tab after Add');
  });

  if (errs.length) { console.log('FAIL JS errors: ' + [...new Set(errs)].join(' | ')); fail++; }
  await ctx.close();
}

/* --------------------------------------------------------- with a host */
{
  const { ctx, p, errs } = await page(true);

  await t('what the AI reads off a Keysight page feeds the cross-reference, and the prompt names both vendors', async () => {
    await openImport(p);
    await p.setInputFiles('#import-file', { name: 'listing.png', mimeType: 'image/png', buffer: PNG });
    await p.waitForTimeout(300);
    if (!(await p.locator('#import-scan').isVisible())) throw new Error('Scan with AI not offered');
    await p.click('#import-scan');
    await p.waitForTimeout(900);
    const ai = await p.evaluate(() => window.__ai);
    if (ai.calls !== 1 || !/Keysight/.test(ai.prompt) || !/Rohde & Schwarz/.test(ai.prompt)) throw new Error('the AI was asked ' + JSON.stringify(ai).slice(0, 200));
    if (await p.locator('.xref-table tbody tr').count() !== 3) throw new Error(await p.locator('.xref-table tbody tr').count() + ' rows from the AI');
    const box = await p.inputValue('#import-text');
    if (!box.includes('E8267D-520')) throw new Error('the transcription is not in the box: ' + box.slice(0, 80));
    if (!(await p.locator('#import-status').textContent()).includes('Check the quantities')) throw new Error('status: ' + await p.locator('#import-status').textContent());
    await p.click('#import-load');
    await p.waitForTimeout(600);
    for (const id of ['B1020', 'B13T', 'K720', 'K24', 'K54', 'K147']) if (!(await on(p, id))) throw new Error(id + ' not loaded');
  });

  await t('the exports carry the cross-reference', async () => {
    await p.click('.panel-foot [data-action=export]');
    await p.waitForTimeout(300);
    const head = await p.locator('.modal-head p').textContent();
    if (!head.includes('mapped from Keysight E8267D')) throw new Error('header: ' + head.replace(/\s+/g, ' '));
    await p.click('.modal [data-action=csv]');
    await p.click('.modal [data-action=json]');
    await p.click('.modal [data-action=pdf]');
    await p.waitForTimeout(500);
    const saves = await p.evaluate(() => window.__saves);
    const csv = saves.find(s => s.filename.endsWith('.csv'))?.data || '';
    if (!csv.includes('"Mapped from"') || !/"R&S®SMW-K720".*"E8267D-UNT"/.test(csv)) throw new Error('csv: ' + csv.slice(0, 200));
    const json = JSON.parse(saves.find(s => s.filename.endsWith('.json'))?.data || '{}');
    if (json.crossref?.model !== 'E8267D' || json.crossref.options.length !== 3) throw new Error('json: ' + JSON.stringify(json.crossref).slice(0, 200));
    if (json.crossref.options[0].smw[0] !== 'R&S®SMW-B1020' || json.crossref.options[0].inConfiguration !== true) throw new Error('json row: ' + JSON.stringify(json.crossref.options[0]));
    const pdf = saves.find(s => s.filename.endsWith('.pdf'))?.data || '';
    if (!pdf.includes('(Cross-reference: Keysight E8267D) Tj') || !pdf.includes('E8267D-UNT')) throw new Error('the PDF has no cross-reference section');
    await p.keyboard.press('Escape');
  });

  if (errs.length) { console.log('FAIL JS errors: ' + [...new Set(errs)].join(' | ')); fail++; }
  await ctx.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
