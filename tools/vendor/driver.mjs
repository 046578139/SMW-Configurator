// Persistent Playwright driver for the camos configurator. Accepts JSON commands on 127.0.0.1:8765.
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import http from 'node:http';
import { mkdirSync as _mk } from 'node:fs';

const OUT = (process.env.OUTDIR || 'out') + '/';
const PORT = parseInt(process.env.PORT || '8765', 10);
mkdirSync(OUT, { recursive: true });
// usage: PORT=8765 OUTDIR=out node tools/vendor/driver.mjs   (then tools/vendor/cmd.sh 8765 '{"op":"goto"}' ...)
const START = 'https://configurator.rohde-schwarz.com/app/ch5c/ch5start?-AppName%3Ddefault+-configknb%3Dconfig.SMW200A';
import { existsSync } from 'node:fs';
// Chromium: the preinstalled binary when there is one, else whatever Playwright downloaded (SMW_BROWSER overrides).
const BROWSER = process.env.SMW_BROWSER || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
// Behind the Claude Code agent proxy, Chromium's TLS 1.3 handshake (post-quantum key share) is rejected by the
// upstream; limiting it to TLS 1.2 without PQ/ECH is what makes HTTPS work there. Harmless elsewhere.
const LAUNCH = { executablePath: BROWSER, headless: true,
  proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined,
  args: ['--disable-features=PostQuantumKyber,UseMLKEM,EncryptedClientHello', '--ssl-version-max=tls1.2'] };

const browser = await chromium.launch(LAUNCH);
const ctx = await browser.newContext({ viewport: { width: 1600, height: 5000 }, locale: 'en-US',
  userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36' });
const page = await ctx.newPage();
let net = [];
let pending = 0;
page.on('request', r => { if (r.url().includes('cH5C/HRQ') || r.url().includes('StartInternal')) { pending++; net.push({ kind: 'req', post: (r.postData() || '').slice(0, 3000) }); } });
page.on('response', async r => {
  if (r.url().includes('cH5C/HRQ') || r.url().includes('StartInternal')) {
    pending = Math.max(0, pending - 1);
    let body = ''; try { body = await r.text(); } catch {}
    net.push({ kind: 'res', status: r.status(), len: body.length, body: body.slice(0, 1500) });
  }
});
page.on('requestfailed', r => { if (r.url().includes('cH5C/HRQ')) pending = Math.max(0, pending - 1); });
page.on('pageerror', e => net.push({ kind: 'pageerror', text: String(e).slice(0, 500) }));
page.on('download', async d => { try { const p = `${OUT}download-${Date.now()}-${d.suggestedFilename()}`; await d.saveAs(p); net.push({ kind: 'download', path: p }); } catch (e) { net.push({ kind: 'download-error', text: String(e) }); } });
page.on('dialog', async d => { net.push({ kind: 'dialog', text: d.message() }); await d.dismiss(); });

const deepText = () => page.evaluate(() => {
  const out = [];
  const walk = (root, d) => {
    for (const node of root.childNodes) {
      if (node.nodeType === 3) { const t = node.textContent.replace(/\s+/g, ' ').trim(); if (t) out.push('  '.repeat(d) + t); }
      else if (node.nodeType === 1) {
        if (['SCRIPT', 'STYLE', 'LINK'].includes(node.tagName)) continue;
        const cs = getComputedStyle(node);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        if (node.shadowRoot) walk(node.shadowRoot, d + 1);
        walk(node, d + 1);
      }
    }
  };
  walk(document, 0);
  return out.join('\n');
});
// Flat listing of every visible element with an id: id, class, geometry, cursor, text, background-image
const elements = () => page.evaluate(() => {
  const out = [];
  const walk = (root) => {
    for (const el of root.querySelectorAll('*')) {
      if (el.shadowRoot) walk(el.shadowRoot);
      if (!el.id) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const txt = [...el.childNodes].filter(x => x.nodeType === 3).map(x => x.textContent.trim()).join(' ').trim();
      const bg = cs.backgroundImage && cs.backgroundImage !== 'none' ? cs.backgroundImage.replace(/^url\("?|"?\)$/g, '').slice(-40) : '';
      out.push({ id: el.id, tag: el.tagName.toLowerCase(), cls: typeof el.className === 'string' ? el.className : '', x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), cursor: cs.cursor, txt: txt.slice(0, 120), bg, type: el.getAttribute('type') || '', value: el.value !== undefined && typeof el.value === 'string' ? el.value.slice(0, 80) : '', title: el.getAttribute('title') || '' });
    }
  };
  walk(document);
  return out;
});
const settle = async (ms = 1500, max = 20000) => {
  const t0 = Date.now();
  let quiet = 0, lastLen = net.length;
  while (Date.now() - t0 < max) {
    await page.waitForTimeout(250);
    if (pending === 0 && net.length === lastLen) { quiet += 250; if (quiet >= ms) return; } else { quiet = 0; lastLen = net.length; }
  }
};

const ops = {
  async goto() { net = []; await page.goto(START, { waitUntil: 'domcontentloaded', timeout: 60000 }); await settle(3000, 40000); return 'ok'; },
  async click({ id, text, nth = 0, exact = true, dblclick = false, x, y }) {
    let loc;
    if (id) loc = page.locator(`#${id}`);
    else if (text) loc = page.getByText(text, { exact }).nth(nth);
    if (loc) { await loc.scrollIntoViewIfNeeded().catch(() => {}); if (dblclick) await loc.dblclick({ timeout: 10000 }); else await loc.click({ timeout: 10000 }); }
    else await page.mouse.click(x, y);
    await settle(); return 'clicked';
  },
  async hover({ id }) { await page.locator(`#${id}`).hover({ timeout: 10000 }); await settle(); return 'hovered'; },
  async type({ id, text, press }) { if (id) await page.locator(`#${id}`).click(); if (text) await page.keyboard.type(text); if (press) await page.keyboard.press(press); await settle(); return 'typed'; },
  async press({ key }) { await page.keyboard.press(key); await settle(); return 'pressed'; },
  async wheel({ id, dy = 600, x, y }) {
    if (id) { const b = await page.locator(`#${id}`).boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); }
    else if (x !== undefined) await page.mouse.move(x, y);
    await page.mouse.wheel(0, dy); await settle(); return 'wheeled';
  },
  async shot({ name = 'shot', full = false }) { const p = `${OUT}${name}.png`; await page.screenshot({ path: p, fullPage: full }); return p; },
  async text() { return await deepText(); },
  async elements({ filter }) { let els = await elements(); if (filter) { const re = new RegExp(filter, 'i'); els = els.filter(e => re.test(e.txt) || re.test(e.id) || re.test(e.cursor) || re.test(e.bg)); } return els; },
  async net({ clear = true }) { const n = net; if (clear) net = []; return n; },
  async eval({ js }) { return await page.evaluate(js); },
  async wait({ ms = 1000 }) { await page.waitForTimeout(ms); await settle(); return 'waited'; },
  async viewport({ w = 1600, h = 5000 }) { await page.setViewportSize({ width: w, height: h }); await settle(); return 'ok'; },
  async save({ name }) { const t = await deepText(); writeFileSync(`${OUT}${name}.txt`, t); const e = await elements(); writeFileSync(`${OUT}${name}.elements.json`, JSON.stringify(e, null, 1)); return { textLen: t.length, elements: e.length }; },

  async rows() {
    return await page.evaluate(() => {
      const items = [];
      const walk = (root) => {
        for (const el of root.querySelectorAll('*')) {
          if (el.shadowRoot) walk(el.shadowRoot);
          if (!el.id || !['DIV', 'IMG', 'SPAN', 'INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) continue;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const txt = [...el.childNodes].filter(x => x.nodeType === 3).map(x => x.textContent.replace(/\s+/g, ' ').trim()).join(' ').trim();
          const bg = cs.backgroundImage && cs.backgroundImage !== 'none' ? (cs.backgroundImage.match(/i=([0-9a-zA-Z_.]+)/) || [0, cs.backgroundImage.slice(0, 40)])[1] : '';
          const img = el.tagName === 'IMG' ? ((el.src || '').match(/i=([0-9a-f]+)/) || [0, el.src.slice(-30)])[1] : '';
          const val = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' ? el.value : '';
          if (!txt && !bg && !img && !val && el.tagName !== 'INPUT') continue;
          items.push({ id: el.id, tag: el.tagName, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), txt, bg, img, val, cls: typeof el.className === 'string' ? el.className.split(/\s+/).pop() : '', color: cs.color, cursor: cs.cursor, parent: el.parentElement ? el.parentElement.id : '' });
        }
      };
      walk(document);
      items.sort((a, b) => (a.y + a.h / 2) - (b.y + b.h / 2) || a.x - b.x);
      const rows = [];
      for (const it of items) {
        const cy = it.y + it.h / 2;
        const last = rows[rows.length - 1];
        if (last && Math.abs(last.cy - cy) <= 6) { last.items.push(it); }
        else rows.push({ cy, items: [it] });
      }
      return rows.map(r => ({ y: Math.round(r.cy), items: r.items.sort((a, b) => a.x - b.x) }));
    });
  },
  // Click a status icon, wait for the vendor's message box, read it, close it. All in-process.
  async status({ id, timeoutMs = 6000 }) {
    const q = 'camos-html5client';
    const getMb = () => page.evaluate(() => { const root = document.querySelector('camos-html5client').shadowRoot; return [...root.querySelectorAll('[data-messagebox]')].map(m => ({ text: m.textContent.replace(/\s+/g, ' ').trim(), btn: (m.querySelector('button') || {}).id || null })); });
    // close anything already open
    for (let i = 0; i < 3; i++) { const open = await getMb(); if (!open.length) break; await page.evaluate(() => { const root = document.querySelector('camos-html5client').shadowRoot; const b = root.querySelector('[data-messagebox] button'); if (b) b.click(); }); await page.waitForTimeout(300); }
    await page.locator(`#${id}`).click({ timeout: 10000 });
    const t0 = Date.now(); let mb = [];
    while (Date.now() - t0 < timeoutMs) { mb = await getMb(); if (mb.length) break; await page.waitForTimeout(120); }
    const text = mb.length ? mb[0].text.replace(/\s*OK$/, '') : null;
    if (mb.length) {
      await page.evaluate(() => { const root = document.querySelector('camos-html5client').shadowRoot; const b = root.querySelector('[data-messagebox] button'); if (b) b.click(); });
      const t1 = Date.now(); while (Date.now() - t1 < 4000) { if (!(await getMb()).length) break; await page.waitForTimeout(100); }
    }
    return { text, ms: Date.now() - t0 };
  },
  // Click a control (checkbox/radio) and wait briefly for the server round trip.
  async tick({ id, quiet = 500, max = 8000 }) {
    await page.locator(`#${id}`).click({ timeout: 10000 });
    await settle(quiet, max);
    const mb = await page.evaluate(() => { const root = document.querySelector('camos-html5client').shadowRoot; return [...root.querySelectorAll('[data-messagebox]')].map(m => m.textContent.replace(/\s+/g, ' ').trim()); });
    return { dialogs: mb };
  },
  async closeDialogs() {
    let n = 0;
    for (let i = 0; i < 5; i++) { const closed = await page.evaluate(() => { const root = document.querySelector('camos-html5client').shadowRoot; const b = root.querySelector('[data-messagebox] button'); if (b) { b.click(); return true; } return false; }); if (!closed) break; n++; await page.waitForTimeout(300); }
    return n;
  },
  async quit() { setTimeout(() => process.exit(0), 200); return 'bye'; },
};

const server = http.createServer(async (req, res) => {
  let body = ''; req.on('data', c => body += c);
  req.on('end', async () => {
    let cmd; try { cmd = JSON.parse(body || '{}'); } catch { res.writeHead(400); return res.end('bad json'); }
    try { const out = await ops[cmd.op](cmd); res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: true, out })); }
    catch (e) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: String(e.message || e).split('\n').slice(0, 3).join(' | ') })); }
  });
});
server.listen(PORT, '127.0.0.1', async () => {
  console.log('driver listening on ' + PORT);
  await ops.goto();
  writeFileSync(`${OUT}READY`, String(Date.now()));
  console.log('page loaded');
});
