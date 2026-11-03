// PP-OCRv5（アプリと同じ補正つき・ブラウザ）で、語の完全一致と文字再現を測る。Indra と同じ書類・同じ物差し。
import puppeteer from 'puppeteer-core';
import fs from 'node:fs'; import path from 'node:path';
import { start } from '../serve.mjs';
const ROOT = path.resolve('tests/docs');
const port = 9000 + (process.pid % 900);
const srv = await start(port);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 1200000, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${port}/__t/e2e/eval.html`); await page.waitForFunction('window.ready===true');
await page.evaluate(() => window.boot());
const norm = (s) => s.normalize('NFKC').replace(/\s/g, '').replace(/[ー－―‐−–—]/g, '-').replace(/[⻘]/g, '青');
const bag = (s) => { const m = new Map(); for (const c of s) m.set(c, (m.get(c) || 0) + 1); return m; };
const out = [];
for (const m of JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'))) {
  if (m.set !== 'dev') continue;
  for (const v of ['clean', 'scan', 'photo']) {
    const t = JSON.parse(fs.readFileSync(path.join(ROOT, m.id, v === 'clean' ? 'truth.json' : `truth_${v}.json`), 'utf8'));
    const r = await page.evaluate((a, b) => window.evalOne(a, b), `/__t/docs/${m.id}/${v}_p1.${v === 'photo' ? 'jpg' : 'png'}`, 'a.png');
    const got = norm(r.pages[0].lines.map((l) => l.text).join(''));
    const tb = bag(norm(t.pageText[0])), gb = bag(got); let hit = 0, tot = 0;
    for (const [c, n] of tb) { tot += n; hit += Math.min(n, gb.get(c) || 0); }
    const ents = t.entities.filter((e) => e.type !== 'seal'); const eh = ents.filter((e) => got.includes(norm(e.text))).length;
    out.push({ id: m.id, kind: m.kind, v, recall: hit / tot, eh, en: ents.length, sec: r.ms / 1000 });
    console.log('ppocr', m.id, v, '文字再現', (hit / tot).toFixed(3), '語', `${eh}/${ents.length}`, (r.ms / 1000).toFixed(1) + '秒');
  }
}
fs.writeFileSync('tests/out/compare_pp.json', JSON.stringify(out));
await browser.close(); srv.close();
