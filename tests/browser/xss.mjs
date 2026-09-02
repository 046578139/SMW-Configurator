import { chromium } from 'playwright';
import { BASE, ROOT, BROWSER } from './_env.mjs';
const b = await chromium.launch({ executablePath: BROWSER });
const ctx = await b.newContext({ colorScheme: 'dark' });
const p = await ctx.newPage(); p.setDefaultTimeout(5000);
let fired = 0;
await p.exposeFunction('__xss', () => { fired++; });
await p.addInitScript(() => { window.alert = () => window.__xss(); });
p.on('dialog', async d => { fired++; await d.dismiss(); });

const PAYLOADS = [
  '"><img src=x onerror=window.__xss()>',
  '</script><script>window.__xss()</script>',
  "' onmouseover='window.__xss()",
  '<svg onload=window.__xss()>',
  '${window.__xss()}',
  '"><style>@import"x"</style>'
];

// 1. through the configuration name field
for (const payload of PAYLOADS) {
  await p.goto(`${BASE}/index.html#c=B1003.B13.B10`);
  await p.waitForTimeout(400);
  await p.fill('#config-name', payload); await p.waitForTimeout(300);
  await p.click('[data-action=export]').catch(()=>{}); await p.waitForTimeout(300);
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  await p.click('[data-tab=checks]').catch(()=>{}); await p.waitForTimeout(200);
}
console.log((fired ? 'FAIL ' : 'ok   ') + 'no script executes from the configuration name');

// 2. through the URL hash, both the name and the option list
const before = fired;
for (const payload of PAYLOADS) {
  const u = `${BASE}/index.html#c=B1003.` + encodeURIComponent(payload) + '&n=' + encodeURIComponent(payload);
  await p.goto(u); await p.waitForTimeout(400);
  await p.click('[data-action=export]').catch(()=>{}); await p.waitForTimeout(250);
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
}
console.log((fired > before ? 'FAIL ' : 'ok   ') + 'no script executes from the URL hash');

// 3. does a payload survive into the DOM as markup rather than text?
await p.goto(`${BASE}/index.html#c=B1003.B13.B10`);
await p.waitForTimeout(300);
await p.fill('#config-name', '<b id=xsstest>bold</b>'); await p.waitForTimeout(300);
await p.click('[data-action=export]'); await p.waitForTimeout(400);
console.log((await p.locator('#xsstest').count() ? 'FAIL ' : 'ok   ') + 'markup arrives as text, not as HTML');
await p.keyboard.press('Escape');

await b.close();
