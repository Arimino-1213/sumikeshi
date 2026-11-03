// テスト用の静的サーバー。public/_headers の内容を本番と同じように付ける。/__t/ は試験用ファイル。
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(HERE, '..', 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.onnx': 'application/octet-stream', '.png': 'image/png', '.jpg': 'image/jpeg', '.pdf': 'application/pdf', '.woff2': 'font/woff2', '.gz': 'application/octet-stream', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon' };
function headersFor(url) {
  const out = {};
  try {
    const raw = fs.readFileSync(path.join(PUB, '_headers'), 'utf8').split(/\r?\n/);
    let active = false;
    for (const l of raw) {
      if (!l.trim() || l.trim().startsWith('#')) continue;
      if (!/^\s/.test(l)) { const pat = l.trim().replace(/\*/g, '.*'); active = new RegExp('^' + pat + '$').test(url); continue; }
      if (active) { const i = l.indexOf(':'); out[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }
    }
  } catch {}
  return out;
}
export function start(port = 8791) {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = u.startsWith('/__t/') ? path.join(HERE, u.slice(5)) : path.join(PUB, u === '/' ? 'index.html' : u);
    if (!file.startsWith(u.startsWith('/__t/') ? HERE : PUB)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
    const h = u.startsWith('/__t/') ? { 'Cross-Origin-Embedder-Policy': 'require-corp', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Resource-Policy': 'same-origin' } : headersFor(u);
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', ...h });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((ok) => srv.listen(port, '127.0.0.1', () => ok(srv)));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) { await start(+process.argv[2] || 8791); console.log('http://127.0.0.1:' + (+process.argv[2] || 8791)); }
