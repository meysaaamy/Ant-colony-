/**
 * Headless smoke test: loads the *shipped* bundle (www/bundle.js) inside jsdom
 * with a stubbed Canvas2D context and exercises mount + a synthetic paint
 * gesture. Catches runtime exceptions that a type-check cannot.
 */
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../www/index.html', import.meta.url), 'utf8');
const js = await readFile(new URL('../www/bundle.js', import.meta.url), 'utf8');

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push(e.message + '\n' + (e.detail?.stack || '')));
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const dom = new JSDOM(html, {
  url: 'http://localhost/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  virtualConsole: vc,
});
const { window } = dom;

/* ---- Canvas2D stub ---------------------------------------------------- */
const gradient = { addColorStop() {} };
function makeCtx(canvas) {
  const state = {};
  return new Proxy(state, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (prop === 'canvas') return canvas;
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern') {
        return () => gradient;
      }
      if (prop === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      if (prop === 'getImageData') return (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
      if (prop === 'measureText') return () => ({ width: 8 });
      if (prop === 'setTransform' || prop === 'resetTransform') return () => {};
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

window.addEventListener('error', (e) => errors.push('window.error: ' + e.message));
window.eval(js);

await new Promise((r) => setTimeout(r, 400));

/* ---- synthetic stroke ------------------------------------------------- */
const canvas = window.document.querySelector('canvas.world');
function pointer(type, x, y) {
  const ev = new window.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
  Object.defineProperty(ev, 'pointerId', { value: 1 });
  Object.defineProperty(ev, 'pointerType', { value: 'touch' });
  canvas.dispatchEvent(ev);
}
pointer('pointerdown', 100, 300);
for (let i = 0; i < 12; i++) pointer('pointermove', 100 + i * 12, 300 + i * 8);
pointer('pointerup', 232, 396);

/* tap each dock slot, open brush popover + parameters sheet */
const slots = [...window.document.querySelectorAll('.slot')];
slots[3].dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
window.document.querySelector('.brush-pill').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
await new Promise((r) => setTimeout(r, 250));

const q = (s) => window.document.querySelector(s);
const report = {
  slots: slots.length,
  activeSlot: window.document.querySelectorAll('.slot[data-active="true"]').length,
  popover: !!q('.popover'),
  sliders: window.document.querySelectorAll('.popover .slider').length,
  telemetry: q('.telemetry .value')?.textContent,
  toolName: q('.tool-name')?.textContent,
  canvasPainted: !!canvas.width,
  errors,
};
console.log(JSON.stringify(report, null, 2));
process.exit(errors.length ? 1 : 0);
