// aiqu.my: public website server. No dependencies, Node 18+.
// Serves /public with clean URLs: /use-cases -> public/use-cases.html

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(__dirname, 'public');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.pdf': 'application/pdf'
};

const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000'
};

function resolveFile(urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath.split('?')[0]); } catch (e) { return null; }
  if (p.includes('\0')) return null;
  if (p.endsWith('/')) p += 'index';
  const candidates = path.extname(p) ? [p] : [p + '.html', p + '/index.html'];
  for (const c of candidates) {
    const full = path.join(ROOT, path.normalize(c));
    if (!full.startsWith(ROOT)) return null; // block ../ tricks
    try { if (fs.statSync(full).isFile()) return full; } catch (e) { /* try next */ }
  }
  return null;
}

function send(res, status, file, extraHeaders) {
  const ext = path.extname(file).toLowerCase();
  const isHtml = ext === '.html';
  res.writeHead(status, Object.assign({
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Cache-Control': isHtml || file.endsWith('.dc.html') ? 'no-cache' : 'public, max-age=86400'
  }, SECURITY, extraHeaders || {}));
  fs.createReadStream(file).pipe(res);
}

const server = http.createServer((req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, SECURITY); return res.end(); }
  const url = req.url || '/';

  if (url === '/healthz') { res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, SECURITY)); return res.end('{"ok":true}'); }

  // Old links: /index.html -> /, /use-cases.html -> /use-cases
  const clean = url.split('?')[0];
  if (clean === '/index.html') { res.writeHead(301, { Location: '/' }); return res.end(); }
  if (clean.endsWith('.html') && !clean.endsWith('.dc.html')) { res.writeHead(301, { Location: clean.slice(0, -5) }); return res.end(); }

  const file = resolveFile(url);
  if (file) return send(res, 200, file);

  const notFound = path.join(ROOT, '404.html');
  if (fs.existsSync(notFound)) return send(res, 404, notFound);
  res.writeHead(404, Object.assign({ 'Content-Type': 'text/plain' }, SECURITY));
  res.end('Not found');
});

server.listen(PORT, () => console.log(`aiqu.my running on http://localhost:${PORT}`));
