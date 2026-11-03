// 実力測定：本物のブラウザで「読み込み→補正→OCR→検出」を通し、正解の位置と重ねて評価する。
// 使い方: node tests/e2e/run_eval.mjs dev|held digital,clean,scan,photo [絞り込み] [出力名]
import puppeteer from 'puppeteer-core';
import fs from 'node:fs'; import path from 'node:path';
import { start } from '../serve.mjs';
const ROOT = path.resolve('tests/docs');
const set = process.argv[2] || 'dev', vars = (process.argv[3] || 'digital,clean,scan,photo').split(','), filter = process.argv[4] || '', outName = process.argv[5] || `eval_${set}`;
const srv = await start(8793);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 1200000, args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[ページの誤り]', e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) console.log('[ブラウザ]', m.text().slice(0, 300)); });
await page.goto('http://127.0.0.1:8793/__t/e2e/eval.html'); await page.waitForFunction('window.ready===true');
console.log('起動', await page.evaluate(() => window.boot()));
const applyH = (m, x, y) => { const w = m[6] * x + m[7] * y + m[8]; return [(m[0] * x + m[1] * y + m[2]) / w, (m[3] * x + m[4] * y + m[5]) / w]; };
// 正解の四角が黒塗りでどれだけ覆われたか（格子で数える）
function covered(rect, masks) {
  const N = 8; let hit = 0;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = rect[0] + ((rect[2] - rect[0]) * (i + 0.5)) / N, y = rect[1] + ((rect[3] - rect[1]) * (j + 0.5)) / N;
    if (masks.some((m) => x >= m[0] && x <= m[2] && y >= m[1] && y <= m[3])) hit++;
  }
  return hit / (N * N);
}
const imgSize = (b) => { if (b[0] === 0x89) return [b.readUInt32BE(16), b.readUInt32BE(20)]; let o = 2; while (o < b.length) { const mk = b[o + 1]; const len = b.readUInt16BE(o + 2); if (mk >= 0xc0 && mk <= 0xc3) return [b.readUInt16BE(o + 7), b.readUInt16BE(o + 5)]; o += 2 + len; } return null; };
const res = []; const misses = [], extras = [], keepsHit = [];
for (const m of JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'))) {
  if (m.set !== set || (filter && !m.id.includes(filter))) continue;
  for (const v of vars) {
    const t = JSON.parse(fs.readFileSync(path.join(ROOT, m.id, (v === 'digital' || v === 'clean') ? 'truth.json' : `truth_${v}.json`), 'utf8'));
    let url, name, type;
    if (v === 'digital') { url = `/__t/docs/${m.id}/digital.pdf`; name = 'a.pdf'; type = 'application/pdf'; } else { const e = v === 'photo' ? 'jpg' : 'png'; url = `/__t/docs/${m.id}/${v}_p1.${e}`; name = 'a.' + e; }
    const r = await page.evaluate((a, b, c) => window.evalOne(a, b, c), url, name, type);
    const pg = r.pages[0];
    if (process.env.DUMP) fs.writeFileSync('tests/out/dump.json', JSON.stringify(r, null, 0));
    const srcSize = imgSize(fs.readFileSync(path.join(ROOT, m.id, v === 'digital' ? 'clean_p1.png' : `${v}_p1.${v === 'photo' ? 'jpg' : 'png'}`)));
    const toPg = (q) => {
      if (v === 'digital') return [q[0] * pg.width, q[1] * pg.height, q[2] * pg.width, q[3] * pg.height];
      const pts = [[q[0], q[1]], [q[2], q[1]], [q[2], q[3]], [q[0], q[3]]].map(([x, y]) => applyH(pg.transform, x * srcSize[0], y * srcSize[1]));
      return [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
    };
    const masks = r.hits.filter((h) => h.tier !== 'low' && h.page === 0).flatMap((h) => h.rects.map((q) => ({ q, h })));
    const mq = [...masks.map((x) => x.q), ...pg.seals];
    const row = { id: m.id, kind: m.kind, v, n: 0, ok: 0, types: {}, keeps: 0, keepHit: 0, masks: mq.length, extra: 0, ms: r.ms, detectMs: r.detectMs, source: pg.source, notes: pg.notes };
    const truthRects = [];
    const ents = t.entities.filter((e) => e.page === 0);
    // 判定：文字の濃い画素が、どの1文字についても 5% 以上は残らないこと
    const inks = await page.evaluate((g, q) => window.inkLeft(g, q), ents.map((e) => e.rects.map(toPg)), mq);
    ents.forEach((e, i) => {
      const rects = e.rects.map(toPg); truthRects.push(...rects);
      const ink = inks[i]; const left = ink.total ? ink.left / ink.total : 0;
      const ok = ink.worst <= 0.05; const ty = (row.types[e.type] ||= [0, 0]); ty[1]++; row.n++;
      if (ok) { ty[0]++; row.ok++; } else misses.push(`${m.id}/${v} [${e.type}] ${e.text} 文字が残る${(left * 100).toFixed(0)}%（最悪の1字${(ink.worst * 100).toFixed(0)}%）`);
    });
    for (const k of t.keeps) { if (k.page !== 0) continue; row.keeps++; const rects = k.rects.map(toPg); const c = rects.length ? rects.reduce((s, q) => s + covered(q, mq), 0) / rects.length : 0; if (c > 0.3) { row.keepHit++; keepsHit.push(`${m.id}/${v} 隠してはいけない「${k.text}」覆い${(c * 100).toFixed(0)}%`); } }
    for (const { q, h } of masks) { const c = truthRects.some((tr) => { const w = Math.min(q[2], tr[2]) - Math.max(q[0], tr[0]), hh = Math.min(q[3], tr[3]) - Math.max(q[1], tr[1]); return w > 0 && hh > 0; }); if (!c) { row.extra++; extras.push(`${m.id}/${v} 余分 ${h.type}/${h.tier} ${h.rule}「${h.text}」`); } }
    res.push(row);
    console.log(m.id, v, `隠せた ${row.ok}/${row.n}`, `隠してはいけない ${row.keepHit}/${row.keeps}`, `余分 ${row.extra}/${row.masks}`, (r.ms / 1000).toFixed(1) + '秒', pg.source, pg.notes.join('／'));
  }
}
const agg = {};
const push = (k, r) => { const a = (agg[k] ||= { n: 0, ok: 0, keeps: 0, keepHit: 0, masks: 0, extra: 0, ms: 0, docs: 0 }); a.n += r.n; a.ok += r.ok; a.keeps += r.keeps; a.keepHit += r.keepHit; a.masks += r.masks; a.extra += r.extra; a.ms += r.ms; a.docs++; };
const types = {};
for (const r of res) { push(r.kind + '/' + r.v, r); push('版/' + r.v, r); push('全体', r); for (const [k, [o, n]] of Object.entries(r.types)) { const a = (types[k] ||= [0, 0]); a[0] += o; a[1] += n; } }
console.log('\n=== 集計 ===');
for (const [k, a] of Object.entries(agg).sort()) console.log(k.padEnd(14), `隠せた ${a.ok}/${a.n} = ${(a.ok / a.n * 100).toFixed(1)}%`, `隠してはいけない語 ${a.keepHit}/${a.keeps}`, `余分な黒塗り ${a.extra}/${a.masks} = ${(a.extra / Math.max(1, a.masks) * 100).toFixed(1)}%`, `1枚 ${(a.ms / a.docs / 1000).toFixed(1)}秒`);
console.log(Object.entries(types).map(([k, [o, n]]) => `${k}:${o}/${n}`).join(' '));
fs.mkdirSync('tests/out', { recursive: true });
fs.writeFileSync(`tests/out/${outName}.json`, JSON.stringify({ agg, types, res, misses, extras, keepsHit }, null, 1));
fs.writeFileSync(`tests/out/${outName}_detail.txt`, ['--見落とし', ...misses, '--隠してはいけない語', ...keepsHit, '--余分', ...extras].join('\n'));
await browser.close(); srv.close();
