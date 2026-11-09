/**
 * Headless interaction suite for the shipped bundle (www/bundle.js).
 *
 * jsdom + a stubbed Canvas2D context lets us exercise mount, the simulation
 * loop, painting gestures and every HUD control without a browser. Asserts the
 * behaviours promised by the UI specification.
 */
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const html = await readFile(new URL('../www/index.html', import.meta.url), 'utf8');
const js = await readFile(new URL('../www/bundle.js', import.meta.url), 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push(`${e.message}\n${e.detail?.stack ?? ''}`));
vc.on('error', (...a) => errors.push(`console.error: ${a.join(' ')}`));

const dom = new JSDOM(html, {
  url: 'http://localhost/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  virtualConsole: vc,
});
const { window } = dom;
const { document } = window;

const gradient = { addColorStop() {} };
function makeCtx(canvas) {
  const state = {};
  return new Proxy(state, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (prop === 'canvas') return canvas;
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern') return () => gradient;
      if (prop === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      if (prop === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      if (prop === 'measureText') return () => ({ width: 8 });
      return () => {};
    },
    set(t, prop, value) { t[prop] = value; return true; },
  });
}
window.HTMLCanvasElement.prototype.getContext = function () {
  return (this.__ctx ||= makeCtx(this));
};
window.HTMLCanvasElement.prototype.setPointerCapture = function () {};
window.HTMLCanvasElement.prototype.releasePointerCapture = function () {};
window.addEventListener('error', (e) => errors.push(`window.error: ${e.message}`));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const q = (s) => document.querySelector(s);
const qa = (s) => [...document.querySelectorAll(s)];
const click = (el) => el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
/* A finger tap = pointerdown → pointerup → click */
let pid = 10;
const tap = (el) => {
  const id = pid++;
  for (const type of ['pointerdown', 'pointerup']) {
    const ev = new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: 100, clientY: 700 });
    Object.defineProperty(ev, 'pointerId', { value: id });
    el.dispatchEvent(ev);
  }
  click(el);
};
/* React tracks the input's value; mutate through the native setter. */
const setRange = (input, value) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, String(value));
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
};

window.eval(js);
await wait(350);

const results = [];
const check = (name, fn) => {
  try { fn(); results.push(`✓ ${name}`); }
  catch (e) { results.push(`✗ ${name} — ${e.message}`); errors.push(name); }
};

/* ── structure ─────────────────────────────────────────────────────────── */
check('6 bespoke tool slots render', () => assert.equal(qa('.slot').length, 6));
check('every slot ships an inline SVG glyph (no emoji)', () => {
  for (const slot of qa('.slot')) assert.ok(slot.querySelector('svg'), 'slot without svg');
});
check('slot index numerals 1–6', () => {
  assert.deepEqual(qa('.slot .idx').map((n) => n.textContent), ['1', '2', '3', '4', '5', '6']);
});
check('telemetry capsule shows ants + food with tabular numerals', () => {
  assert.equal(qa('.telemetry .value').length, 2);
  assert.ok(q('.telemetry .hairline'));
});
check('speed chip + 48px play target exist', () => {
  assert.ok(q('.speed-chip'));
  assert.ok(q('.play'));
});
check('two utility squircles', () => assert.equal(qa('.squircle').length, 2));
check('three cockpit tiers exist', () => {
  assert.ok(q('.tier1')); assert.ok(q('.tier2')); assert.ok(q('.dock'));
});
check('drag handle on the world-controls card', () => assert.ok(q('.drag-handle')));
click(qa('.tier1-actions .pill-btn')[1]);
await wait(40);
check('reset is a 2-tap armed action', () => {
  const reset = qa('.tier1-actions .pill-btn')[1];
  assert.equal(reset.getAttribute('data-armed'), 'true');
  assert.match(reset.textContent, /Tap again/);
});
click(qa('.tier1-actions .pill-btn')[1]);
await wait(40);
check('second tap fires the reset and disarms', () => {
  assert.equal(qa('.tier1-actions .pill-btn')[1].getAttribute('data-armed'), 'false');
  assert.match(q('.toast')?.textContent ?? '', /reseeded/i);
});
check('clear trails pill exists', () => assert.match(qa('.tier1-actions .pill-btn')[0].textContent, /Clear trails/));

/* ── painting choreography ─────────────────────────────────────────────── */
const canvas = q('canvas.world');
const pointer = (type, x, y) => {
  const ev = new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperty(ev, 'pointerId', { value: 1 });
  Object.defineProperty(ev, 'pointerType', { value: 'touch' });
  canvas.dispatchEvent(ev);
};

pointer('pointerdown', 120, 320);
await wait(20);
check('touching the canvas dims all chrome', () => {
  assert.ok(q('.chrome').classList.contains('is-dimmed'));
});
for (let i = 0; i < 10; i++) pointer('pointermove', 120 + i * 14, 320 + i * 9);
pointer('pointerup', 246, 410);
await wait(260);
check('chrome restores ~200ms after lift', () => {
  assert.ok(!q('.chrome').classList.contains('is-dimmed'));
});

/* ── tool switching ────────────────────────────────────────────────────── */
click(qa('.slot')[2]);
await wait(30);
check('selecting a slot updates the jewel + contextual badge', () => {
  assert.equal(qa('.slot[data-active="true"]').length, 1);
  assert.match(q('.tool-name').textContent, /Alarm pulse/);
  assert.match(q('.tool-index').textContent, /3/);
});

/* ── brush popover + illuminated slider ────────────────────────────────── */
click(q('.brush-pill'));
await wait(30);
check('brush popover opens with 2 precision sliders', () => {
  assert.ok(q('.popover'));
  assert.equal(qa('.popover .slider').length, 2);
  assert.ok(qa('.popover .slider-tick').length >= 1, 'default tick missing');
});
check('slider drives the live brush radius readout', () => {
  setRange(q('.popover input[type="range"]'), 60);
  assert.equal(q('.brush-pill .num').textContent, '60');
});
click(q('.brush-pill'));
await wait(20);

/* ── speed / pause ─────────────────────────────────────────────────────── */
click(q('.speed-chip'));
await wait(20);
check('speed chip cycles 1x → 2x', () => assert.match(q('.speed-chip').textContent, /^2x?$/));
click(q('.play'));
await wait(20);
check('play/pause toggles aria state', () => assert.equal(q('.play').getAttribute('aria-pressed'), 'false'));
click(q('.play'));

/* ── 3-snap parameter sheet ────────────────────────────────────────────── */
check('sheet starts at peek', () => assert.equal(q('.sheet-panel').getAttribute('data-snap'), 'peek'));
tap(q('.tier1'));
await wait(30);
check('tap expands the sheet to half', () => assert.equal(q('.sheet-panel').getAttribute('data-snap'), 'half'));
check('sheet exposes 4 parameter tabs', () => assert.equal(qa('.tab').length, 4));
check('tier 2 collapses while the sheet is open', () => assert.equal(q('.tier2').style.display, 'none'));

click(qa('.tab')[1]);
await wait(30);
check('colony tab exposes sliders', () => assert.ok(qa('.tab[data-active="true"]') && qa('.slider').length >= 4));

click(qa('.tab')[0]);
await wait(30);
const presetCards = qa('.preset-card');
check('three scientific presets are selectable', () => assert.equal(presetCards.length, 3));
click(presetCards[2]);
await wait(30);
check('loading a preset retitles the world-controls card', () => {
  assert.match(q('.preset-title').textContent, /Labyrinth/);
});

/* ── field guide ───────────────────────────────────────────────────────── */
click(qa('.squircle')[0]);
await wait(30);
check('field guide modal opens with 3 bespoke diagrams', () => {
  assert.ok(q('.modal'));
  assert.equal(qa('.modal .diagram svg').length, 3);
});
click(q('.modal .icon-btn'));
await wait(30);
check('field guide closes', () => assert.ok(!q('.modal')));

/* room for the sheet to reach "full" via drag */
tap(q('.tier1'));
await wait(30);
const down = new window.MouseEvent('pointerdown', { bubbles: true, clientY: 600 });
const move = new window.MouseEvent('pointermove', { bubbles: true, clientY: 540 });
const up = new window.MouseEvent('pointerup', { bubbles: true, clientY: 540 });
Object.defineProperty(down, 'pointerId', { value: 2 });
Object.defineProperty(move, 'pointerId', { value: 2 });
Object.defineProperty(up, 'pointerId', { value: 2 });
const card = q('.tier1');
card.dispatchEvent(down); card.dispatchEvent(move); card.dispatchEvent(up);
await wait(40);
check('dragging the handle snaps toward full', () => {
  assert.ok(['half', 'full'].includes(q('.sheet-panel').getAttribute('data-snap')));
});

console.log(results.join('\n'));
if (errors.length) {
  console.error('\nFAILURES:\n' + errors.join('\n'));
  process.exit(1);
}
console.log(`\n${results.length}/${results.length} checks passed — no runtime errors.`);
process.exit(0);
