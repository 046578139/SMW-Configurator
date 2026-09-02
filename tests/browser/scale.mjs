import { chromium } from 'playwright';
import { BASE, ROOT, BROWSER, outDir } from './_env.mjs';

const OUT_DIR = outDir();
const b = await chromium.launch({ executablePath: BROWSER });
const ctx = await b.newContext({ viewport: { width: 1900, height: 1050 }, deviceScaleFactor: 2, colorScheme: 'dark' });
const p = await ctx.newPage(); p.setDefaultTimeout(6000);
const errs = []; p.on('pageerror', e => errs.push(e.message));
for (const [hash, name] of [
  ['#c=B1003.B13.B10', 'scale-3ghz.png'],
  ['#c=B1044.B13T.B2020.B94L.B10*2', 'scale-two.png']
]) {
  await p.goto(`${BASE}/index.html` + hash);
  await p.waitForTimeout(700);
  const svg = p.locator('svg[aria-label="Frequency coverage against the radio bands"]');
  await svg.screenshot({ path: `${OUT_DIR}/${name}` });
  const bad = await svg.evaluate(s => {
    const t = [...s.querySelectorAll('text')].map(e => ({ s: e.textContent.trim(), b: e.getBBox() })).filter(x => x.s);
    const out = [];
    for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) {
      const a = t[i].b, c = t[j].b;
      if (Math.min(a.x+a.width, c.x+c.width) - Math.max(a.x, c.x) > -2 &&
          Math.min(a.y+a.height, c.y+c.height) - Math.max(a.y, c.y) > 0.5 &&
          Math.abs((a.x+a.width/2)-(c.x+c.width/2)) > 2.5) out.push(`"${t[i].s}"x"${t[j].s}"`);
    }
    return out;
  });
  console.log((bad.length ? 'FAIL ' : 'ok   ') + name.replace('.png','').padEnd(14) +
    (bad.length ? ' overlapping: ' + bad.join(', ') : ' no labels overlap or touch'));
}
console.log(errs.length ? 'ERR ' + errs[0] : 'no JS errors');
await b.close();
