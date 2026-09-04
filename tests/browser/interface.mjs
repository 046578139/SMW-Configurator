/**
 * What the page puts in front of someone, which a unit test cannot see: a
 * configuration nobody has started yet must read as two choices to make, not
 * as two faults; an option that comes in fixed quantities must not offer one
 * the configuration rules out; and the options that run into the dozens need
 * a field rather than a stepper nobody would click 250 times.
 */

import { chromium } from 'playwright';
import { BASE, BROWSER } from './_env.mjs';

const b = await chromium.launch({ executablePath: BROWSER });
const ctx = await b.newContext({ viewport: { width: 1600, height: 1000 }, colorScheme: 'dark' });
const p = await ctx.newPage(); p.setDefaultTimeout(5000);
const errs = []; p.on('pageerror', e => errs.push(e.message));
let pass = 0, fail = 0;
const t = async (n, fn) => { try { await fn(); console.log('ok   ' + n); pass++; }
  catch (e) { console.log('FAIL ' + n + ' -> ' + e.message.split('\n')[0].slice(0, 130)); fail++; } };

const open = async (hash) => { await p.goto(`${BASE}/index.html#c=${hash}`); await p.waitForTimeout(600); };
const card = id => p.locator(`.card[data-opt="${id}"]`);
/* The summary pane shows one tab at a time; the parts list and the checks
   each have to be selected before they are in the page. */
const tab = async (name) => { await p.click(`[data-tab="${name}"]`); await p.waitForTimeout(400); };

await t('a waveform package is typed, not clicked 250 times', async () => {
  await open('B1003.B13.B10.K200-1');
  await p.locator('.nav-item', { hasText: 'WinIQSIM2' }).click();
  await p.waitForTimeout(400);
  const field = card('K200-1').locator('input.qty-input');
  if (!(await field.count())) throw new Error('no quantity field on a 250-unit option');
  await field.fill('30');
  await field.press('Enter');
  await p.waitForTimeout(500);
  const shown = await card('K200-1').locator('input.qty-input').inputValue();
  if (shown !== '30') throw new Error('field shows ' + shown + ' after typing 30');
  await tab('order');
  const row = await p.locator('.bom-row', { hasText: '1414.6870.71' }).first().textContent();
  if (!row.includes('30')) throw new Error('the parts list says ' + row.replace(/\s+/g, ' ').trim());
});

await t('a typed quantity above the ceiling is held at the ceiling', async () => {
  const field = card('K200-1').locator('input.qty-input');
  await field.fill('900');
  await field.press('Enter');
  await p.waitForTimeout(500);
  const shown = await card('K200-1').locator('input.qty-input').inputValue();
  if (Number(shown) !== 250) throw new Error('field shows ' + shown + ', expected the 250 ceiling');
  await tab('checks');
  const issues = await p.locator('.panel-body .issue.error').allTextContents();
  if (issues.some(x => x.includes('waveform'))) throw new Error('over the ceiling after clamping');
});

await t('two fading simulators are the smallest choice once two generators are in', async () => {
  await open('B1044.B13XT.B9*2');
  await p.locator('.nav-item', { hasText: 'MIMO' }).click();
  await p.waitForTimeout(400);
  await card('B15').locator('.tick').first().click();
  await p.waitForTimeout(600);
  const qty = (await card('B15').locator('.qty span').textContent()).trim();
  if (qty !== '2') throw new Error('ticking B15 with two B9 gave ' + qty);
  await tab('checks');
  const errors = await p.locator('.panel-body .issue.error').allTextContents();
  if (errors.length) throw new Error('ticking a valid option raised: ' + errors[0].slice(0, 60));
});

await t('one fading simulator is the choice when a single generator is in', async () => {
  await open('B1044.B13XT.B9');
  await p.locator('.nav-item', { hasText: 'MIMO' }).click();
  await p.waitForTimeout(400);
  await card('B15').locator('.tick').first().click();
  await p.waitForTimeout(600);
  const qty = (await card('B15').locator('.qty span').textContent()).trim();
  if (qty !== '1') throw new Error('ticking B15 with one B9 gave ' + qty);
  await tab('checks');
  if (await p.locator('.panel-body .issue.error').count()) throw new Error('a single B15 on one B9 was refused');
});

await t('a quantity the rules exclude marks the card, not only the issue list', async () => {
  await open('B1044.B13XT.B9*2.B15');
  await p.locator('.nav-item', { hasText: 'MIMO' }).click();
  await p.waitForTimeout(500);
  const cls = await card('B15').getAttribute('class');
  if (!cls.includes('invalid')) throw new Error('card not marked: ' + cls);
  await tab('checks');
  const errors = await p.locator('.panel-body .issue.error').allTextContents();
  if (!errors.some(x => x.includes('0, 2 or 4'))) throw new Error('the reason was not reported');
});

await t('a fresh page presents the two mandatory choices as steps, not errors', async () => {
  await p.goto(`${BASE}/index.html`);
  await p.evaluate(() => { try { localStorage.clear(); } catch {} });
  // dropping the hash is a same-document navigation, so the page has to be
  // reloaded for the cleared storage to take effect
  await p.reload();
  await p.waitForTimeout(700);
  await tab('checks');
  if (await p.locator('.panel-body .issue.error').count()) throw new Error('an untouched page reports errors');
  const steps = await p.locator('.panel-body .issue.todo').allTextContents();
  if (steps.length !== 2) throw new Error(steps.length + ' steps, expected 2');
  if (!steps.join(' ').includes('Choose an RF path A frequency option')) {
    throw new Error('the first step does not read as a choice: ' + steps[0].slice(0, 60));
  }
  // "badge" contains "bad", so the class has to be matched as a whole token
  if (await p.locator('.tab .badge.bad').count()) throw new Error('the tab badge is still red');
  if (await p.locator('.nav-item .nav-dot.err').count()) throw new Error('a section is marked broken');
  if (await p.locator('.nav-item .nav-dot.req').count() !== 2) throw new Error('the two sections are not flagged as still to choose');
  if (!(await p.locator('[data-action="resolve"]').isDisabled())) throw new Error('Fix issues offered with nothing broken');
  const chip = p.locator('#status-chip');
  const chipText = (await chip.textContent()).trim();
  if (chipText !== '2 choices left') throw new Error('the header says "' + chipText + '"');
  if (!(await chip.getAttribute('class')).split(/\s+/).includes('step')) {
    throw new Error('the header chip is still styled as a warning');
  }
});

await t('a real rule violation still reads as an error', async () => {
  await open('B1003.B13.B2003');
  await tab('checks');
  if (!(await p.locator('.panel-body .issue.error').count())) throw new Error('a broken rule was not reported as an error');
  if (!(await p.locator('.tab .badge.bad').count())) throw new Error('the tab badge is not red');
  if (await p.locator('[data-action="resolve"]').isDisabled()) throw new Error('Fix issues not offered');
  const cls = (await p.locator('#status-chip').getAttribute('class')).split(/\s+/);
  if (!cls.includes('unmet')) throw new Error('the header does not flag a broken rule: ' + cls.join(' '));
});

console.log(`\n${pass} passed, ${fail} failed`);
console.log(errs.length ? 'JS: ' + [...new Set(errs)].join(' | ') : 'no JS errors');
await b.close();
process.exit(fail ? 1 : 0);
