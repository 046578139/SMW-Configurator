/**
 * The instrument as photographed, with the configuration marked on it.
 *
 * The photograph is of one particular instrument - two RF paths to 44 GHz,
 * every connector fitted - so on its own it would misrepresent most
 * configurations. What makes it a configurator rather than decoration is the
 * overlay: each connector the configuration decides carries a ring saying
 * whether it is fitted, absent, or moved to the other face.
 *
 * Positions are pixels in the 1280 x 720 photographs, read off a measured
 * grid. The overlay carries the same viewBox and aspect ratio as the image, so
 * the two scale together and the rings stay circular at any size.
 */

import { esc } from './util.js';
import { PHOTOS } from './photos.js';

const PHOTO_W = 1280, PHOTO_H = 720;

/** Connectors on the front whose state the configuration decides. */
const FRONT = [
  { x: 1022, y: 508, r: 21, key: 'rfA', label: 'RF A', tone: 'on' },
  { x: 1108, y: 508, r: 21, key: 'rfB', label: 'RF B', tone: 'second' },
  { x: 1085, y: 211, r: 15, key: 'iqA', label: 'I', tone: 'iq' },
  { x: 1085, y: 272, r: 15, key: 'iqA', label: 'Q', tone: 'iq' },
  { x: 1085, y: 333, r: 15, key: 'iqB', label: 'I', tone: 'iq' },
  { x: 1085, y: 400, r: 15, key: 'iqB', label: 'Q', tone: 'iq' }
];

/** The RF cut-outs on the rear, and the bays the plug-in modules fill. */
const REAR = [
  { x: 163, y: 318, r: 20, key: 'rearRfA', label: 'RF A', tone: 'on' },
  { x: 163, y: 447, r: 20, key: 'rearRfB', label: 'RF B', tone: 'second' }
];

const REAR_BAYS = [
  { x: 360, y: 368, w: 800, h: 62 },
  { x: 360, y: 432, w: 800, h: 62 },
  { x: 360, y: 497, w: 800, h: 66 }
];

const TONE = {
  on: { ring: 'var(--accent)', ink: 'var(--accent)' },
  second: { ring: 'var(--accent-2)', ink: 'var(--accent-2)' },
  iq: { ring: 'var(--accent-3)', ink: 'var(--accent-3)' },
  off: { ring: '#6d7683', ink: '#6d7683' }
};

/**
 * A ring on the connector and a chip naming it.
 *
 * A chip rather than bare text: the photograph is light where the connectors
 * are and already carries its own printed labels, so plain type either
 * disappears into it or reads as part of the instrument.
 */
function marker (spot, on, note, drop = 0) {
  const t = on ? TONE[spot.tone] : TONE.off;
  const { x, y, r } = spot;
  const text = note ? `${spot.label} ${note}` : spot.label;
  const w = text.length * 8.6 + 14;
  const cy = y + r + 12 + drop;

  return `<g class="spot spot-${on ? 'on' : 'off'}">
    <circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${t.ring}"
      stroke-width="${on ? 3.4 : 2.4}"${on ? '' : ' stroke-dasharray="9 7"'}/>
    ${on ? '' : `<path d="M${x - r * 0.55} ${y - r * 0.55}l${r * 1.1} ${r * 1.1}
      M${x + r * 0.55} ${y - r * 0.55}l${-r * 1.1} ${r * 1.1}"
      stroke="${t.ring}" stroke-width="2.4"/>`}
    <rect x="${x - w / 2}" y="${cy}" width="${w}" height="22" rx="5"
      fill="${on ? t.ring : '#4a535f'}"/>
    <text x="${x}" y="${cy + 15.5}" font-size="14" fill="${on ? '#08131c' : '#e7ecf3'}"
      text-anchor="middle" font-family="ui-monospace,monospace"
      font-weight="700">${esc(text)}</text>
  </g>`;
}

export function renderPhoto (d, face) {
  const p = d.panel;
  const front = face === 'front';
  let spots;
  if (front) {
    spots = FRONT.map(s => {
      if (s.key === 'rfA') {
        return marker(s, p.rfA, p.rfA ? '' : (p.rearRfA ? '→ rear' : 'none'));
      }
      if (s.key === 'rfB') {
        // staggered, or the two chips would sit on top of each other
        return marker(s, p.rfB, p.rfB ? '' : (p.rearRfB ? '→ rear' : 'none'), 26);
      }
      return marker(s, p[s.key], '');
    }).join('');
  } else {
    spots = REAR.map((s, i) => marker(s, p[s.key], p[s.key] ? '' : '→ front', i * 26)).join('');

    const fitted = p.modules.length;
    spots += REAR_BAYS.map((b, i) => {
      const on = i < fitted;
      const t = on ? TONE.on : TONE.off;
      return `<g class="spot spot-${on ? 'on' : 'off'}">
        <rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="4" fill="none"
          stroke="${t.ring}" stroke-width="${on ? 3 : 2}"${on ? '' : ' stroke-dasharray="9 7"'}/>
        <text x="${b.x + b.w - 10}" y="${b.y + b.h - 8}" font-size="17" fill="${t.ink}"
          text-anchor="end" font-family="ui-monospace,monospace"
          >${on ? esc(`module ${i + 1}`) : 'empty bay'}</text>
      </g>`;
    }).join('');

    if (fitted > REAR_BAYS.length) {
      spots += `<text x="640" y="700" font-size="19" fill="var(--warn)" text-anchor="middle"
        font-family="ui-monospace,monospace"
        >${fitted} modules configured – more than the photographed instrument carries</text>`;
    }
  }

  return `
  <figure class="photo">
    <img src="${esc(PHOTOS[face])}" alt="R&amp;S SMW200A ${front ? 'front' : 'rear'} panel">
    <svg class="photo-overlay" viewBox="0 0 ${PHOTO_W} ${PHOTO_H}"
      role="img" aria-label="Configured connectors marked on the photograph">
      ${spots}
    </svg>
  </figure>`;
}
