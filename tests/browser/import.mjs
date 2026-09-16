/**
 * Importing a configuration from a document, in the page: pasted text reads
 * into a review table and loads; an image is shown and, where the host has an
 * AI, can be scanned; a PDF is rendered page by page and its text read on
 * arrival. The host's AI and the PDF renderer are stood in for by small
 * fakes installed before the page's scripts run, so the suite needs no
 * network and no Claude account.
 */

import { chromium } from 'playwright';
import { BASE, BROWSER } from './_env.mjs';

const b = await chromium.launch({ executablePath: BROWSER });
let pass = 0, fail = 0;
const t = async (n, fn) => { try { await fn(); console.log('ok   ' + n); pass++; }
  catch (e) { console.log('FAIL ' + n + ' -> ' + e.message.split('\n')[0].slice(0, 150)); fail++; } };

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

/* a host whose AI transcribes four line items, and a PDF renderer that
   reports one page of positioned text runs */
const HOST = `
  window.__ai = { calls: 0, images: 0 };
  const sample = async () => ({ text: '[]', truncated: false, modelTierApplied: 'default' });
  sample.json = (input, opts) => new Promise((resolve, reject) => {
    window.__ai.calls++; window.__ai.images = (opts.images || []).length; window.__ai.prompt = input;
    if (opts.signal?.aborted) return reject({ code: 'cancelled', message: 'aborted' });
    setTimeout(() => resolve([
      { type: 'R&S SMW-B1003', order: null, qty: 1, designation: '100 kHz to 3 GHz' },
      { type: 'R&S SMW-B13', order: null, qty: 1 },
      { type: 'R&S SMW-B10', order: null, qty: 2 },
      { type: null, order: '1036.4790.00', qty: 3, designation: 'Test port adapter' }
    ]), 450);
  });
  sample.limits = async () => ({ maxPromptBytes: 65536, images: { maxCount: 2, maxInputBytes: 20e6, mediaTypes: ['image/png', 'image/jpeg'] } });
  window.claude = { use: name => new Promise(r => setTimeout(() => r(name === 'sample' ? sample : null), 40)) };
  window.__ocr = { calls: 0, workers: 0 };
  window.Tesseract = { createWorker: async (lang, oem, opts) => (window.__ocr.workers++, {
    async recognize () {
      window.__ocr.calls++; window.__ocr.workers = (window.__ocr.workers || 0);
      opts.logger?.({ status: 'loading language traineddata', progress: 0.4 });
      opts.logger?.({ status: 'recognizing text', progress: 0.5 });
      await new Promise(r => setTimeout(r, 600));
      return { data: { text: '1.2 Frequency range 100 kHz to 20 GHz SMW-B1O2O 1428.51O7.O2 1 111,295.00\\n1.5 Wideband baseband generator SMW-B9 1413.735O.O2 2 87,100.00' } };
    },
    async terminate () { window.__ocr.terminated = true; }
  }) };
  const run = (str, x, y, w) => ({ str, transform: [1, 0, 0, 1, x, y], width: w || str.length * 5, height: 9 });
  window.pdfjsLib = { GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.resolve({ numPages: 1, getPage: async () => ({
    getTextContent: async () => ({ items: [
      run('1', 20, 700), run('2', 40, 700), run('R&S®SMW-B1006', 60, 700, 80), run('100 kHz to 6 GHz', 150, 700, 90), run('1428.4800.02', 300, 700, 60),
      run('2', 20, 680), run('1', 40, 680), run('R&S®SMW-B13T', 60, 680, 80), run('1413.3003.02', 300, 680, 60)
    ] }),
    getViewport: () => ({ width: 200, height: 100 }),
    render: () => ({ promise: Promise.resolve() })
  }) }) }) };`;

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
const rowsOf = p => p.locator('.import-table tbody tr');

/* ------------------------------------------------------ without a host */
{
  const { ctx, p, errs } = await page(false);

  await t('pasted quotation text reads into a review table', async () => {
    await openImport(p);
    if (!(await p.locator('#import-load').isDisabled())) throw new Error('Replace enabled with nothing read');
    await p.fill('#import-text', `Quotation No. 4711-2026
1 1 R&S SMW-B1020 100 kHz to 20 GHz 1428.5107.02
2 1 R&S SMW-B13T main module 1413.3003.02
3 2 R&S SMW-B10 baseband generator 1413.1200.02
4 3 Test port adapter, 2.92 mm female 1036.4790.00
5 1 R&S SMW-K999 unknown 9999.9999.99`);
    await p.waitForTimeout(500);
    if (await rowsOf(p).count() !== 4) throw new Error(await rowsOf(p).count() + ' rows');
    const summary = await p.locator('.import-summary').textContent();
    if (!summary.includes('4 options recognised') || !summary.includes('1 line not in the catalog')) throw new Error('summary: ' + summary);
    const first = (await rowsOf(p).first().textContent()).replace(/\s+/g, ' ');
    if (!first.includes('R&S®SMW-B1020') || !first.includes('1428.5107.02')) throw new Error('first row: ' + first);
    const adapter = rowsOf(p).filter({ hasText: '1036.4790.00' });
    if ((await adapter.locator('td').first().textContent()).trim() !== '1036.4790.00') throw new Error('the adapter is not named by its order number');
    if (await adapter.locator('input').inputValue() !== '3') throw new Error('adapter quantity not read');
    const unknown = await p.locator('.import-unknown-line').textContent();
    if (!unknown.includes('9999.9999.99')) throw new Error('unknown line not listed: ' + unknown);
    if (await p.locator('#import-scan').isVisible()) throw new Error('Scan with AI offered without a host');
  });

  await t('a quantity can be corrected before loading, and Replace loads the document alone', async () => {
    const b10 = rowsOf(p).filter({ hasText: '1413.1200.02' }).locator('input');
    await b10.fill('1');
    await b10.press('Tab');
    await p.click('#import-load');
    await p.waitForTimeout(600);
    if (await p.locator('.scrim').count()) throw new Error('the dialog stayed open');
    for (const id of ['B1020', 'B13T', 'B10', 'ADP-292F']) {
      if (!(await p.locator(`.card[data-opt="${id}"].on`).count())) throw new Error(id + ' not loaded');
    }
    if (await p.locator('.card[data-opt="B1003"].on').count()) throw new Error('the old configuration survived Replace');
    const hash = await p.evaluate(() => location.hash);
    if (!hash.includes('ADP-292F*3') || hash.includes('B10*2')) throw new Error('quantities wrong in the link: ' + hash);
    if (await p.inputValue('#config-name') !== 'Quotation 4711-2026') throw new Error('name is ' + await p.inputValue('#config-name'));
  });

  await t('an image is shown with Read the image on offer, and no AI without a host', async () => {
    await openImport(p);
    await p.setInputFiles('#import-file', { name: 'photo.png', mimeType: 'image/png', buffer: PNG });
    await p.waitForTimeout(300);
    if (!(await p.locator('#import-preview img').count())) throw new Error('no image shown');
    if (!(await p.locator('#import-ocr').isVisible())) throw new Error('Read the image not offered');
    if (await p.locator('#import-scan').isVisible()) throw new Error('Scan with AI offered without a host');
    const st = await p.locator('#import-status').textContent();
    if (!st.includes('runs here in the page')) throw new Error('status says: ' + st);
    if (!(await p.locator('#import-load').isDisabled())) throw new Error('Replace enabled with nothing read');
    await p.keyboard.press('Escape');
  });

  await t('a reader that cannot be fetched says so', async () => {
    await openImport(p);
    await p.evaluate(() => { window.Tesseract = { createWorker: async () => { throw new TypeError('Failed to fetch'); } }; });
    await p.waitForTimeout(300);        // the warm-up on a static host already ran into it
    await p.setInputFiles('#import-file', { name: 'photo.png', mimeType: 'image/png', buffer: PNG });
    await p.waitForTimeout(300);
    await p.click('#import-ocr');
    await p.waitForTimeout(400);
    const st = await p.locator('#import-status').textContent();
    if (!st.includes('could not be fetched')) throw new Error('status says: ' + st);
    if (!(await p.locator('#import-load').isDisabled())) throw new Error('Replace enabled with nothing read');
    await p.keyboard.press('Escape');
  });

  await t('a PDF that cannot be opened says so instead of failing silently', async () => {
    await openImport(p);
    await p.evaluate(() => { window.pdfjsLib = { getDocument: () => ({ promise: Promise.reject(new Error('no renderer')) }) }; });
    await p.setInputFiles('#import-file', { name: 'quote.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
    await p.waitForTimeout(400);
    const st = await p.locator('#import-status').textContent();
    if (!st.includes('could not be opened')) throw new Error('status says: ' + st);
    await p.keyboard.press('Escape');
  });

  if (errs.length) { console.log('FAIL JS errors: ' + [...new Set(errs)].join(' | ')); fail++; }
  await ctx.close();
}

/* --------------------------------------------------------- with a host */
{
  const { ctx, p, errs } = await page(true);

  await t('Read the image reads a picture in the page, corrects the slips, and fills the text box', async () => {
    await openImport(p);
    await p.setInputFiles('#import-file', { name: 'photo.png', mimeType: 'image/png', buffer: PNG });
    await p.waitForTimeout(300);
    if (!(await p.locator('#import-ocr').isVisible())) throw new Error('Read the image not offered');
    await p.click('#import-ocr');
    await p.waitForTimeout(100);
    if (!(await p.locator('#import-stop').isVisible())) throw new Error('no Stop while reading');
    if (!/Reading/.test(await p.locator('#import-status').textContent())) throw new Error('no progress shown');
    await p.waitForTimeout(900);
    const ocr = await p.evaluate(() => window.__ocr);
    if (ocr.calls !== 1 || ocr.workers !== 1 || ocr.terminated) throw new Error('engine use: ' + JSON.stringify(ocr));
    // a second read reuses the engine rather than starting it again
    await p.click('#import-ocr');
    await p.waitForTimeout(1000);
    const again = await p.evaluate(() => window.__ocr);
    if (again.calls !== 2 || again.workers !== 1) throw new Error('second read: ' + JSON.stringify(again));
    const got = {};
    for (const row of await rowsOf(p).all()) {
      const cells = await row.locator('td').allTextContents();
      got[cells[2].trim()] = await row.locator('input').inputValue();
    }
    if (got['1428.5107.02'] !== '1' || got['1413.7350.02'] !== '2') throw new Error('read ' + JSON.stringify(got));
    const box = await p.inputValue('#import-text');
    if (!box.includes('SMW-B1020 1428.5107.02')) throw new Error('the corrected text is not in the box: ' + box.slice(0, 80));
    const st = await p.locator('#import-status').textContent();
    if (!st.includes('check the quantities')) throw new Error('status says: ' + st);
    if (await p.locator('#import-load').isDisabled()) throw new Error('Replace still disabled');
    await p.keyboard.press('Escape');
  });

  await t('with a host, an image can be scanned and the result added to the configuration', async () => {
    await openImport(p);
    await p.setInputFiles('#import-file', { name: 'photo.png', mimeType: 'image/png', buffer: PNG });
    await p.waitForTimeout(300);
    if (!(await p.locator('#import-scan').isVisible())) throw new Error('Scan with AI not offered');
    await p.click('#import-scan');
    await p.waitForTimeout(120);
    if (!(await p.locator('#import-stop').isVisible())) throw new Error('no Stop while reading');
    await p.waitForTimeout(700);
    const ai = await p.evaluate(() => window.__ai);
    if (ai.calls !== 1 || ai.images !== 1 || !/JSON array/.test(ai.prompt)) throw new Error('the AI was asked ' + JSON.stringify(ai));
    if (await rowsOf(p).count() !== 4) throw new Error(await rowsOf(p).count() + ' rows from the AI');
    if (await p.locator('#import-stop').isVisible()) throw new Error('Stop still shown after the answer');
    await p.click('#import-merge');
    await p.waitForTimeout(600);
    const hash = await p.evaluate(() => location.hash);
    for (const s of ['B1003', 'B13', 'B10*2', 'ADP-292F*3']) if (!hash.includes(s)) throw new Error(s + ' missing from ' + hash);
  });

  await t('a PDF is rendered page by page and its text read on arrival', async () => {
    await openImport(p);
    await p.setInputFiles('#import-file', { name: 'quote.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
    await p.waitForTimeout(500);
    if (!(await p.locator('#import-preview canvas').count())) throw new Error('no page rendered');
    const cap = await p.locator('#import-preview figcaption').textContent();
    if (!cap.includes('Page 1 of 1')) throw new Error('caption: ' + cap);
    const got = {};
    for (const row of await rowsOf(p).all()) {
      const cells = await row.locator('td').allTextContents();
      got[cells[2].trim()] = await row.locator('input').inputValue();
    }
    if (got['1428.4800.02'] !== '2' || got['1413.3003.02'] !== '1') throw new Error('read ' + JSON.stringify(got));
    // the text layer settled it, so neither picture reader is offered
    if (await p.locator('#import-scan').isVisible() || await p.locator('#import-ocr').isVisible()) throw new Error('a picture reader offered for a page whose text was read');
    await p.click('#import-load');
    await p.waitForTimeout(600);
    const hash = await p.evaluate(() => location.hash);
    if (!hash.includes('B1006*2') || !hash.includes('B13T')) throw new Error('loaded ' + hash);
    if (!(await p.inputValue('#config-name')).includes('quote.pdf')) throw new Error('name is ' + await p.inputValue('#config-name'));
  });

  await t('Stop answers at once while the reader is still loading', async () => {
    await p.reload();                   // the engine is kept per page; a fresh page has none
    await p.waitForTimeout(600);
    await openImport(p);
    await p.evaluate(() => { window.Tesseract = { createWorker: () => new Promise(() => {}) }; });   // a load that hangs
    await p.setInputFiles('#import-file', { name: 'photo.png', mimeType: 'image/png', buffer: PNG });
    await p.waitForTimeout(300);
    await p.click('#import-ocr');
    await p.waitForTimeout(150);
    if (!(await p.locator('#import-status').textContent()).includes('Loading the reader')) throw new Error('not loading');
    if (!(await p.locator('#import-stop').isVisible())) throw new Error('no Stop while loading');
    await p.click('#import-stop');
    await p.waitForTimeout(150);
    const st = await p.locator('#import-status').textContent();
    if (st !== 'Stopped.') throw new Error('after Stop the status says: ' + st);
    if (await p.locator('#import-stop').isVisible()) throw new Error('Stop still shown');
    if (await p.locator('#import-ocr').isDisabled() || await p.locator('#import-scan').isDisabled()) throw new Error('buttons still disabled');
    await p.keyboard.press('Escape');
  });

  await t('Stop cancels a reading and closing the dialog does too', async () => {
    await openImport(p);
    await p.setInputFiles('#import-file', { name: 'photo.png', mimeType: 'image/png', buffer: PNG });
    await p.waitForTimeout(300);
    await p.click('#import-scan');
    await p.waitForTimeout(20);
    await p.click('#import-stop');
    await p.waitForTimeout(300);
    const st = await p.locator('#import-status').textContent();
    if (await rowsOf(p).count()) throw new Error('a stopped reading still produced rows');
    if (!/Stopped|Reading/.test(st)) throw new Error('status: ' + st);
    await p.click('#import-scan');
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    if (await p.locator('.scrim').count()) throw new Error('Escape did not close the dialog');
  });

  if (errs.length) { console.log('FAIL JS errors: ' + [...new Set(errs)].join(' | ')); fail++; }
  await ctx.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
