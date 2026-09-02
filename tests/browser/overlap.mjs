import { chromium } from 'playwright';
import { BASE, ROOT, BROWSER } from './_env.mjs';
const b = await chromium.launch({ executablePath: BROWSER });
let bad = 0;
for (const w of [1500, 1200, 1000, 820, 640, 500, 430, 380]) {
  for (const face of ['front', 'rear']) {
    const p = await b.newPage({ viewport: { width: w, height: 950 }, colorScheme: 'dark' });
    await p.goto(`${BASE}/index.html`);
    await p.waitForTimeout(350);
    await p.click('[data-action=presets]'); await p.waitForTimeout(150);
    await p.click('[data-preset=mimo]'); await p.waitForTimeout(350);
    await p.click('[data-view=schematic]').catch(()=>{}); await p.waitForTimeout(250);
    if (face === 'rear') { await p.click('[data-face=rear]'); await p.waitForTimeout(250); }
    const hits = await p.locator('.hero .viz-panel > svg').evaluate(svg => {
      const t = [...svg.querySelectorAll('text')].map(el => ({ s: el.textContent.trim(), b: el.getBBox() }))
        .filter(x => x.s);
      const out = [];
      for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) {
        const a = t[i].b, c = t[j].b;
        const ox = Math.min(a.x + a.width, c.x + c.width) - Math.max(a.x, c.x);
        const oy = Math.min(a.y + a.height, c.y + c.height) - Math.max(a.y, c.y);
        if (ox <= 1.5 || oy <= 1.5) continue;
        // lines of one stacked label share a centre and sit directly above each
        // other; they are one control, not two colliding ones
        const sameStack = Math.abs((a.x + a.width / 2) - (c.x + c.width / 2)) < 2.5;
        if (sameStack) continue;
        out.push(`"${t[i].s}" x "${t[j].s}"`);
      }
      return out.slice(0, 3);
    });
    if (hits.length) { bad++; console.log(`FAIL ${w}px ${face}: ${hits.join(' ; ')}`); }
    else console.log(`ok   ${w}px ${face}`);
    await p.close();
  }
}
console.log(bad ? `\n${bad} overlapping combinations` : '\nno overlapping labels at any width');
await b.close();
