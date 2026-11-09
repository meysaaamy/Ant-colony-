import { build } from 'esbuild';
import { rm, mkdir, copyFile } from 'node:fs/promises';

/**
 * Bundles the sandbox into a classic (non-module) IIFE + CSS pair that a
 * WebView can load straight off file:///android_asset/www/index.html.
 * ES modules are deliberately avoided: file:// module scripts are blocked by
 * the WebView's opaque-origin CORS rules.
 */
const outdir = 'www';

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

await build({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  format: 'iife',
  target: ['chrome61', 'safari12'],
  jsx: 'automatic',
  minify: true,
  legalComments: 'none',
  sourcemap: false,
  define: { 'process.env.NODE_ENV': '"production"' },
  outfile: `${outdir}/bundle.js`,
  logLevel: 'info',
});

await copyFile('index.html', `${outdir}/index.html`);
console.log('✓ bundled → www/');
