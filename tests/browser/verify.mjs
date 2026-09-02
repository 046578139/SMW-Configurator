import { chromium } from 'playwright';
import { BASE, ROOT, BROWSER } from './_env.mjs';
const b = await chromium.launch({ executablePath: BROWSER });
const p = await b.newPage({ viewport: { width: 1560, height: 1000 }, deviceScaleFactor: 2, colorScheme: 'dark' });
const errs = [];
p.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
p.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
await p.goto(`file://${ROOT}/dist/smw200a-configurator.html`);
await p.waitForTimeout(600);
const check = async (n, fn) => { try { await fn(); console.log('PASS ', n); } catch (e) { console.log('FAIL ', n, '->', e.message); } };

await check('stylesheet is applied', async () => {
  const r = await p.evaluate(() => ({
    rules: document.styleSheets[0]?.cssRules.length || 0,
    font: getComputedStyle(document.body).fontFamily
  }));
  if (r.rules < 100) throw new Error('only ' + r.rules + ' css rules');
  if (/Times/.test(r.font)) throw new Error('fell back to serif: ' + r.font);
});
await p.click('[data-action=presets]'); await p.waitForTimeout(200);
await p.click('[data-preset=mimo]'); await p.waitForTimeout(400);
    await p.click('[data-view=schematic]').catch(()=>{}); await p.waitForTimeout(250);

await check('front and rear faces both draw', async () => {
  if (!(await p.locator('.viz-panel > svg').count())) throw new Error('no front svg');
  await p.click('[data-face=rear]'); await p.waitForTimeout(250);
  const t = await p.locator('.viz-panel > svg').innerHTML();
  if (!t.includes('DIG IQ IN/OUT')) throw new Error('module block missing from rear');
});
await check('nothing is drawn outside the chassis', async () => {
  const bad = await p.locator('.viz-panel > svg').evaluate(svg => {
    const vb = svg.viewBox.baseVal;
    return [...svg.querySelectorAll('text,rect,circle')].filter(el => {
      const bb = el.getBBox();
      return bb.x < -1 || bb.x + bb.width > vb.width + 1;
    }).map(el => el.textContent || el.tagName).slice(0, 5);
  });
  if (bad.length) throw new Error('overflowing: ' + bad.join(' | '));
});
await check('enlarge opens the panel at full width', async () => {
  await p.click('[data-action=enlarge]'); await p.waitForTimeout(300);
  const m = p.locator('.modal, [class*=modal]').first();
  if (!(await m.isVisible())) throw new Error('modal did not open');
  if (!(await p.locator('.viz-wide svg').count())) throw new Error('no enlarged svg');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
});
await check('relocation updates both counts', async () => {
  const before = await p.locator('.face').allTextContents();
  await p.fill('#search', 'B81'); await p.waitForTimeout(250);
  await p.locator('[data-toggle=B81]').first().click(); await p.waitForTimeout(300);
  await p.fill('#search', ''); await p.waitForTimeout(250);
  const after = await p.locator('.face').allTextContents();
  const n = s => s.map(x => parseInt(x.match(/\d+/)[0], 10));
  const [f0, r0] = n(before), [f1, r1] = n(after);
  if (f0 - f1 !== 3 || r1 - r0 !== 3) throw new Error(`front ${f0}->${f1}, rear ${r0}->${r1}`);
});
await check('configuration stays valid after B81', async () => {
  const chip = await p.locator('#status-chip').textContent();
  if (!chip.includes('valid')) throw new Error(chip.trim());
});
console.log(errs.length ? '\nISSUES:\n' + errs.join('\n') : '\nno JS errors');
await b.close();
