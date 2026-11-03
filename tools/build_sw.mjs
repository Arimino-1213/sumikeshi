// public の全ファイルを一覧にした sw.js を作る（回線が切れても動かすため）。公開前に毎回実行する。
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
const ROOT = path.resolve('public');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
const files = walk(ROOT).map((f) => path.relative(ROOT, f).replaceAll('\\', '/')).filter((f) => !['_headers', 'sw.js', '_redirects', 'robots.txt', 'sitemap.xml'].includes(f)).sort();
const hash = crypto.createHash('sha256');
for (const f of files) { hash.update(f); hash.update(fs.readFileSync(path.join(ROOT, f))); }
const version = hash.digest('hex').slice(0, 12);
const sw = `// 自動生成（tools/build_sw.mjs）。書類は扱わない：プログラムとモデルのファイルだけを端末に控える。
const VERSION = 'sumi-${version}';
const FILES = ${JSON.stringify(['./', ...files])};
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
// 本番は about.html → /about へ転送する。転送された応答をそのまま返すと、ページを開くときにブラウザが拒否する
const clean = (r) => (r.redirected ? r.blob().then((b) => new Response(b, { status: r.status, statusText: r.statusText, headers: r.headers })) : r);
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then((c) => c.match(e.request, { ignoreSearch: true }).then((hit) => (hit ? clean(hit) : fetch(e.request)))));
});
`;
fs.writeFileSync(path.join(ROOT, 'sw.js'), sw);
const total = files.reduce((s, f) => s + fs.statSync(path.join(ROOT, f)).size, 0);
const big = files.filter((f) => fs.statSync(path.join(ROOT, f)).size > 25 * 1024 * 1024);
console.log(`sw.js 作成 版=${version} ファイル=${files.length} 合計=${(total / 1048576).toFixed(1)}MB 25MiB超=${big.length}`);
