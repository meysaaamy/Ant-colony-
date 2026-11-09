/**
 * Live-server smoke check: boots the page *over HTTP* from the running preview
 * server (not from disk) and asserts the app actually mounts and paints chrome.
 *
 * This is the closest thing to a browser we have in this sandbox, and it catches
 * exactly the failure a green curl can hide: a page that returns 200 but never
 * renders (bad MIME, 404 on a sub-resource, boot-time exception).
 *
 *   node scripts/smoke-live.mjs [url]      default http://127.0.0.1:5173/
 */
import { JSDOM, VirtualConsole } from 'jsdom';

const BASE = process.argv[2] || process.env.PREVIEW_URL || 'http://127.0.0.1:5173/';
const watchdog = setTimeout(() => {
  console.error('✗ smoke watchdog fired after 45s — exiting');
  process.exit(2);
}, 45_000);
watchdog.unref?.();

const problems = [];
const requests = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => problems.push(`jsdomError: ${e.message}`));
vc.on('error', (...a) => problems.push(`console.error: ${a.join(' ')}`));

const gradient = { addColorStop() {} };
function stubCanvas(window) {
  const makeCtx = (canvas) =>
    new Proxy(
      {},
      {
        get(t, prop) {
          if (prop in t) return t[prop];
          if (prop === 'canvas') return canvas;
          if (prop === 'createLinearGradient' || prop === 'createRadialGradient' || prop === 'createPattern')
            return () => gradient;
          if (prop === 'createImageData' || prop === 'getImageData')
            return (w = 1, h = 1) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h });
          if (prop === 'measureText') return () => ({ width: 8 });
          return () => {};
        },
        set(t, prop, v) {
          t[prop] = v;
          return true;
        },
      }
    );
  window.HTMLCanvasElement.prototype.getContext = function () {
    return (this.__ctx ||= makeCtx(this));
  };
  window.HTMLCanvasElement.prototype.setPointerCapture = function () {};
  window.HTMLCanvasElement.prototype.releasePointerCapture = function () {};
  window.addEventListener('error', (e) => problems.push(`window.error: ${e.message}`));
  window.addEventListener('unhandledrejection', (e) => problems.push(`unhandled rejection: ${e.reason}`));
}

const dom = await JSDOM.fromURL(BASE, {
  runScripts: 'dangerously',
  resources: 'usable',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse: stubCanvas,
});

const { window } = dom;
const { document } = window;
window.addEventListener('error', (e) => problems.push(`window.error: ${e.message}`));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* Wait for React to replace the boot splash with the real cockpit. */
let mounted = false;
for (let i = 0; i < 100 && !mounted; i++) {
  await wait(100);
  mounted = !!document.querySelector('.hud-top') && !!document.querySelector('.dock button.slot');
}

const checks = [];
const check = (name, pass, detail = '') => checks.push({ name, pass, detail });
const q = (s) => document.querySelector(s);
const qa = (s) => [...document.querySelectorAll(s)];

check('HTTP page loaded', document.readyState !== 'loading', `readyState=${document.readyState}`);
check('React mounted', mounted);
check('boot splash replaced', !q('.boot-text') || !q('.boot-text')?.textContent?.includes('Awakening'), q('.boot-text')?.textContent || 'gone');
check('no boot error shown', !q('#boot-error') || getComputedStyleSafe(window, q('#boot-error')), '');
check('canvas present', !!q('canvas'), q('canvas') ? `${q('canvas').width}x${q('canvas').height}` : 'missing');
check('top HUD present', !!q('.hud-top'), '');
check('bottom cockpit present', !!q('.stack') || !!q('[class*="cockpit"]'), '');
const slots = qa('.dock button.slot');
check('6 tool buttons', slots.length === 6, `${slots.length} found`);
check('exactly one tool selected', slots.filter((b) => b.getAttribute('aria-pressed') === 'true').length === 1, '');
check('every tool has a label', slots.every((b) => (b.getAttribute('aria-label') || '').trim().length > 0), '');
check('bespoke SVG icons only', qa('svg').length >= 6 && qa('img').length === 0, `svg=${qa('svg').length} img=${qa('img').length}`);
check('stylesheet applied', qa('style, link[rel=stylesheet]').length > 0, '');
check('no emoji in chrome', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(document.body.textContent || ''), '');
check('no runtime errors', problems.length === 0, problems.slice(0, 3).join(' | '));

const failed = checks.filter((c) => !c.pass);
for (const c of checks) {
  console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.detail ? `  (${c.detail})` : ''}`);
}
console.log(
  failed.length
    ? `\n${failed.length}/${checks.length} live checks FAILED`
    : `\n${checks.length}/${checks.length} live checks passed — served page mounts and paints.`
);

dom.window.close();
clearTimeout(watchdog);
process.exit(failed.length ? 1 : 0);

function getComputedStyleSafe(win, el) {
  try {
    return win.getComputedStyle(el).display !== 'block';
  } catch {
    return true;
  }
}
