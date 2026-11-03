// 追加の確認：スマホ幅／20ページのPDF／向きが違う書類／回線なしでの動作／壊れたファイル
import puppeteer from 'puppeteer-core';
import fs from 'node:fs'; import path from 'node:path';
import { start } from '../serve.mjs';
const port = 9000 + (process.pid % 900); const srv = await start(port);
const SHOT = path.resolve('tests/out/shots'); fs.mkdirSync(SHOT, { recursive: true });
const which = (process.argv[2] || 'mobile,long,rotate,offline,broken').split(',');
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 1200000, args: ['--no-sandbox'], defaultViewport: { width: 1440, height: 900 } });
const fresh = async (vp) => { const ctx = await browser.createBrowserContext(); const p = await ctx.newPage(); if (vp) await p.setViewport(vp); p.on('pageerror', (e) => console.log('  [誤り]', e.message)); return p; };
const up = async (p, files) => { await (await p.$('#fileInput')).uploadFile(...files.map((f) => path.resolve(f))); };
const toWork = (p) => p.waitForFunction(() => document.body.dataset.view === 'work' && document.body.dataset.reading !== '1', { timeout: 900000 });

if (which.includes('mobile')) {
  const p = await fresh({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto(`http://127.0.0.1:${port}/`); await new Promise((r) => setTimeout(r, 3000));
  const ov = () => p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
  console.log('スマホ はじめ 横幅', await ov()); await p.screenshot({ path: path.join(SHOT, 'm1_start.png'), fullPage: true });
  await up(p, ['tests/docs/d3_kyuyo_s11/digital.pdf']); await toWork(p); await new Promise((r) => setTimeout(r, 800));
  console.log('スマホ 確認 横幅', await ov()); await p.screenshot({ path: path.join(SHOT, 'm2_work.png'), fullPage: true });
  await p.evaluate(() => document.getElementById('toFinish').click()); await new Promise((r) => setTimeout(r, 400));
  console.log('スマホ 保存 横幅', await ov()); await p.screenshot({ path: path.join(SHOT, 'm3_finish.png'), fullPage: true });
  await p.goto(`http://127.0.0.1:${port}/about.html`); console.log('スマホ 説明 横幅', await ov()); await p.screenshot({ path: path.join(SHOT, 'm4_about.png') });
  await p.browserContext().close();
}
if (which.includes('long')) {
  const p = await fresh(); await p.goto(`http://127.0.0.1:${port}/`);
  const t0 = Date.now(); await up(p, ['tests/docs/_leak/long20.pdf']); await toWork(p);
  const sec = (Date.now() - t0) / 1000;
  const n = await p.$$eval('.thumb', (e) => e.length);
  const mem = await p.evaluate(() => performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
  console.log(`20ページ：ページ ${n}／${sec.toFixed(0)} 秒（1ページ ${(sec / n).toFixed(1)} 秒）／JSメモリ ${mem}MB`);
  await p.evaluate(() => document.getElementById('toFinish').click()); await p.click('#runExport');
  const t1 = Date.now(); await p.waitForFunction(() => !document.getElementById('downloads').hidden || /失敗/.test(document.getElementById('checks').textContent), { timeout: 900000 });
  console.log('書き出しと検査', ((Date.now() - t1) / 1000).toFixed(0), '秒', await p.$$eval('#checks .mark', (m) => m.map((x) => x.textContent).join(' ')));
  await p.browserContext().close();
}
if (which.includes('rotate')) {
  for (const f of ['rot90.png', 'rot180.png', 'rot270.png']) {
    const p = await fresh(); await p.goto(`http://127.0.0.1:${port}/`);
    await up(p, ['tests/docs/_leak/' + f]); await toWork(p);
    const r = await p.evaluate(() => { const m = [...document.querySelectorAll('#overlay .m')].map((e) => e.title); const i = document.getElementById('pageImg'); return { n: m.length, sample: m.slice(0, 3), ratio: document.getElementById('paper').style.aspectRatio }; });
    console.log('向き', f, r); await p.browserContext().close();
  }
}
if (which.includes('offline')) {
  const p = await fresh(); await p.goto(`http://127.0.0.1:${port}/`);
  await p.evaluate(async () => { const r = await navigator.serviceWorker.ready; if (r.installing || r.waiting) await new Promise((ok) => setTimeout(ok, 1000)); });
  await p.waitForFunction(async () => (await caches.keys()).length > 0 && navigator.serviceWorker.controller !== undefined, { timeout: 120000 });
  await new Promise((r) => setTimeout(r, 12000));
  const cached = await p.evaluate(async () => { const k = await caches.keys(); const c = await caches.open(k[0]); return (await c.keys()).length; });
  await p.setOfflineMode(true); await p.reload({ waitUntil: 'load' });
  await up(p, ['tests/docs/d1_chinjutsu_s11/scan_p1.png']); await toWork(p);
  console.log('回線なしで読み取り：控えたファイル', cached, '／黒塗り候補', await p.$$eval('#overlay .m', (e) => e.length));
  await p.browserContext().close();
}
if (which.includes('broken')) {
  const p = await fresh(); await p.goto(`http://127.0.0.1:${port}/`);
  fs.writeFileSync('tests/docs/_leak/broken.pdf', 'これはPDFではありません');
  await up(p, ['tests/docs/_leak/broken.pdf']);
  await p.waitForFunction(() => !document.getElementById('startError').hidden, { timeout: 120000 });
  console.log('壊れたPDF：', await p.$eval('#startError', (e) => e.textContent));
  await p.browserContext().close();
}
await browser.close(); srv.close();
