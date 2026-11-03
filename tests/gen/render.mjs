// 架空書類を HTML から作る：PDF（文字データあり）・200dpi 画像・正解の位置（文字単位）
import puppeteer from 'puppeteer-core';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { makeWorld, toKan } from './data.mjs'; import { TEMPLATES, CSS } from './templates.mjs';
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const seeds = (process.argv[2] || '11,29').split(',').map(Number); const onlySet = process.argv[3];
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 200 / 96 });
const manifest = [];
for (const [id, tpl] of Object.entries(TEMPLATES)) for (const seed of seeds) {
  if (onlySet && tpl.set !== onlySet) continue;
  const w = makeWorld(seed * 7 + id.length * 13, tpl.set);
  w.world_kanTel = (t) => toKan(t).replace(/-/g, 'ー');
  w.acct_kan = () => toKan(w.acct());
  const body = tpl.build(w);
  await page.setContent(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${body}</body></html>`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const truth = await page.evaluate(() => {
    const pages = [...document.querySelectorAll('.page')];
    const pick = (el, kind) => {
      const pg = el.closest('.page'); const pr = pg.getBoundingClientRect(); const rects = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n; const text = el.textContent;
      if (kind === 'seal') { const r = el.getBoundingClientRect(); rects.push([r.left - pr.left, r.top - pr.top, r.right - pr.left, r.bottom - pr.top]); }
      else while ((n = walker.nextNode())) for (let i = 0; i < n.length; i++) {
        if (/\s/.test(n.data[i])) continue;
        const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1);
        const r = rg.getBoundingClientRect(); if (!r.width || !r.height) continue;
        // 枠は行の高さではなく文字そのものの大きさにする（文字サイズ分だけ中心から取る）
        const cs = getComputedStyle(n.parentElement); const f = parseFloat(cs.fontSize) * 0.55; const tate = cs.writingMode.startsWith('vertical');
        const mx = (r.left + r.right) / 2, my = (r.top + r.bottom) / 2;
        const q = tate ? [mx - f, r.top, mx + f, r.bottom] : [r.left, my - f, r.right, my + f];
        rects.push([q[0] - pr.left, q[1] - pr.top, q[2] - pr.left, q[3] - pr.top]);
      }
      return { page: pages.indexOf(pg), text, rects: rects.map((q) => [q[0] / pr.width, q[1] / pr.height, q[2] / pr.width, q[3] / pr.height]) };
    };
    return {
      pages: pages.length,
      entities: [...document.querySelectorAll('x')].map((el) => ({ type: el.getAttribute('t'), ...pick(el, el.getAttribute('t')) })),
      keeps: [...document.querySelectorAll('k')].map((el) => pick(el, 'k')),
      pageText: pages.map((p) => p.innerText),
    };
  });
  const dir = path.join(OUT, `${id}_s${seed}`); fs.mkdirSync(dir, { recursive: true });
  await page.pdf({ path: path.join(dir, 'digital.pdf'), width: '794px', height: '1123px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  const els = await page.$$('.page');
  for (let i = 0; i < els.length; i++) await els[i].screenshot({ path: path.join(dir, `clean_p${i + 1}.png`) });
  fs.writeFileSync(path.join(dir, 'truth.json'), JSON.stringify({ id, seed, set: tpl.set, kind: tpl.kind, ...truth }));
  manifest.push({ id: `${id}_s${seed}`, set: tpl.set, kind: tpl.kind, pages: truth.pages });
}
// 既存の一覧に足す（同じ ID は置き換え）
const prev = onlySet && fs.existsSync(path.join(OUT, 'manifest.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8')).filter((m) => !manifest.some((q) => q.id === m.id)) : [];
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify([...prev, ...manifest], null, 1));
await browser.close(); console.log('作成', manifest.length, '件');
