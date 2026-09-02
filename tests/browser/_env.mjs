/**
 * Shared settings for the browser suites, so a suite runs the same way under
 * run.mjs and on its own.
 *
 *   SMW_BASE     origin the static server is on   (run.mjs sets it)
 *   SMW_ROOT     repository root on disk          (run.mjs sets it)
 *   SMW_BROWSER  path to a Chromium binary; unset means let Playwright pick
 *                the browser it downloaded itself
 *   SMW_OUT      where suites write screenshots
 */

import { existsSync, mkdirSync } from 'node:fs';
import { env } from 'node:process';

const PREINSTALLED = '/opt/pw-browsers/chromium';

export const BASE = env.SMW_BASE || 'http://127.0.0.1:8899';
export const ROOT = env.SMW_ROOT ||
  new URL('../..', import.meta.url).pathname.replace(/\/$/, '');
export const BROWSER = env.SMW_BROWSER ||
  (existsSync(PREINSTALLED) ? PREINSTALLED : undefined);
export const OUT = env.SMW_OUT || new URL('./out', import.meta.url).pathname;

export const outDir = () => { mkdirSync(OUT, { recursive: true }); return OUT; };
