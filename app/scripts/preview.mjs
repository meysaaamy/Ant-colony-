import { createServer } from 'node:http';
import { readFile, access } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Zero-dependency static preview server for the exact bundle that ships inside
 * the APK (app/www → android/assets/www).
 *
 * - binds 0.0.0.0 so the sandbox preview proxy can reach it
 * - rebuilds automatically if www/ is missing or stale
 * - no host/origin allowlist and no framing headers, so the live preview embeds
 */
const APP_DIR = fileURLToPath(new URL('..', import.meta.url));
const ROOT = join(APP_DIR, 'www');
const PORT = Number(process.env.PORT || 5173);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

const exists = (p) => access(p).then(() => true, () => false);

/* Bundle on first run (or when the build output was cleaned). */
if (!(await exists(join(ROOT, 'index.html')))) {
  console.log('▸ www/ missing — bundling first…');
  execFileSync(process.execPath, [join(APP_DIR, 'scripts', 'build.mjs')], {
    cwd: APP_DIR,
    stdio: 'inherit',
  });
}

const server = createServer(async (req, res) => {
  const started = Date.now();
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    const path = join(ROOT, rel === '/' ? 'index.html' : rel);
    if (!path.startsWith(ROOT)) {
      res.writeHead(403).end();
      return;
    }
    const body = await readFile(path);
    res.writeHead(200, {
      'Content-Type': MIME[extname(path)] || 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-store',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : 'Not found');
  } finally {
    if (process.env.PREVIEW_LOG === '1') {
      console.log(`${req.method} ${req.url} → ${res.statusCode} (${Date.now() - started}ms)`);
    }
  }
});

server.keepAliveTimeout = 65_000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Myrmecodia preview → http://0.0.0.0:${PORT}  (root: ${ROOT})`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
