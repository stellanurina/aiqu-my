// aiqu.my: public website server. No dependencies, Node 18+.
// Serves /public with clean URLs: /use-cases -> public/use-cases.html

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = path.join(__dirname, 'public');
const ROOT_REAL = fs.realpathSync(ROOT);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.pdf': 'application/pdf'
};

const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Content-Security-Policy-Report-Only': "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://www.google-analytics.com; frame-src https://calendar.google.com; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; report-uri /csp-report"
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
    let real;
    try { real = fs.realpathSync(full); } catch (e) { continue; }
    if (!real.startsWith(ROOT_REAL)) return null; // symlink escaped
    try { if (fs.statSync(real).isFile()) return real; } catch (e) { /* try next */ }
  }
  return null;
}

const GCAL_URL = (process.env.GCAL_URL || '').trim();

// Booking pages: put the Google Calendar booking link in place, or show the email fallback.
function bookingHtml(file) {
  let html = fs.readFileSync(file, 'utf8');
  if (GCAL_URL.startsWith('https://')) {
    html = html.replace(/<!--NOCAL-->[\s\S]*?<!--\/NOCAL-->/g, '').split('__GCAL_URL__').join(GCAL_URL.replace(/"/g, '&quot;'));
  } else {
    html = html.replace(/<!--CAL-->[\s\S]*?<!--\/CAL-->/g, '');
  }
  return html.replace(/<!--\/?(NO)?CAL-->/g, '');
}

// Cache book-a-demo.html rendering. Output depends only on the file contents and
// GCAL_URL, both fixed at process start, so re-reading on every request is wasted I/O.
const BOOKING_CACHE = new Map();
function getBookingHtml(file) {
  let html = BOOKING_CACHE.get(file);
  if (html !== undefined) return html;
  try { html = bookingHtml(file); } catch (e) { console.error('bookingHtml failed:', e.message); html = ''; }
  BOOKING_CACHE.set(file, html);
  return html;
}

function send(res, status, file, extraHeaders) {
  const ext = path.extname(file).toLowerCase();
  const isHtml = ext === '.html';
  res.writeHead(status, Object.assign({
    'Content-Type': TYPES[ext] || 'application/octet-stream',
    'Cache-Control': isHtml || file.endsWith('.dc.html') ? 'no-cache' : 'public, max-age=86400'
  }, SECURITY, extraHeaders || {}));
  if (path.basename(file) === 'book-a-demo.html') return res.end(getBookingHtml(file));
  const stream = fs.createReadStream(file);
  stream.on('error', () => {
    if (res.headersSent) return res.destroy();
    res.writeHead(500, Object.assign({ 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }, SECURITY));
    res.end('Internal server error');
  });
  stream.pipe(res);
}

const server = http.createServer((req, res) => {
  // CSP violation reports (report-only policy above). Accept and discard so browsers don't log a 405.
  if (req.method === 'POST' && (req.url || '').split('?')[0] === '/csp-report') {
    req.resume();
    res.writeHead(204, { 'Cache-Control': 'no-store' });
    return res.end();
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
  let url = req.url || '/';
  let langHandled = false;

  if (url === '/healthz') { res.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, SECURITY)); return res.end('{"ok":true}'); }

  // /favicon.ico -> /assets/favicon.svg. Browsers and crawlers always request it.
  if (url === '/favicon.ico') {
    const favicon = path.join(ROOT, 'assets', 'favicon.svg');
    try { if (fs.statSync(favicon).isFile()) return send(res, 200, favicon); } catch (e) { /* fall through to 404 */ }
  }

  // --- LANGUAGE ROUTING OVERRIDE ---
  // If user visits the root domain, silently serve the English version
  if (url === '/' || url === '/index.html') {
    url = '/en/';
  } 
  // If user clicks the Bahasa toggle (aiqu.my/id), silently serve the root Bahasa version
  else if (url === '/id' || url === '/id/') {
    url = '/index.html';
    langHandled = true;
  }
  // ---------------------------------
  
  // /en -> /en/ so relative files (Chat.dc.html) load from /en/
  if (url.split('?')[0] === '/en') { res.writeHead(301, { Location: '/en/' }); return res.end(); }

  // Old links: /index.html -> /, /use-cases.html -> /use-cases
  const clean = url.split('?')[0];
  if (clean === '/en/index.html') { res.writeHead(301, { Location: '/en/' }); return res.end(); }
  if (!langHandled && clean === '/index.html') { res.writeHead(301, { Location: '/' }); return res.end(); }
  if (!langHandled && clean.endsWith('.html') && !clean.endsWith('.dc.html')) { res.writeHead(301, { Location: clean.slice(0, -5) }); return res.end(); }
  
  const file = resolveFile(url);
  if (file) return send(res, 200, file);

  const notFound = path.join(ROOT, '404.html');
  if (fs.existsSync(notFound)) return send(res, 404, notFound);
  res.writeHead(404, Object.assign({ 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }, SECURITY));
  res.end('Not found');
});

server.listen(PORT, () => console.log(`aiqu.my running on http://localhost:${PORT}`));
