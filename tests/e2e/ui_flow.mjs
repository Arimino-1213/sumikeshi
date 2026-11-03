// 実際の画面を操作する試験（本番と同じ安全設定で）。入れる→確認→手で追加→保存→検査→ダウンロードまで。
import puppeteer from 'puppeteer-core';
import fs from 'node:fs'; import path from 'node:path';
import { start } from '../serve.mjs';
const port = 9000 + (process.pid % 900);
const srv = await start(port);
const DL = path.resolve('tests/out/dl'); fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true });
const SHOT = path.resolve('tests/out/shots'); fs.mkdirSync(SHOT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 900000, args: ['--no-sandbox'], defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage();
const cdp = await page.createCDPSession();
await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL, eventsEnabled: true });
const reqs = [], errs = [], csp = [];
page.on('request', (r) => reqs.push({ url: r.url(), method: r.method() }));
page.on('pageerror', (e) => errs.push('ページ: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 300)); if (/Content Security Policy/.test(m.text())) csp.push(m.text().slice(0, 200)); });
const log = (...a) => console.log(...a);
const shot = (n) => page.screenshot({ path: path.join(SHOT, n + '.png') });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 3200)); await shot('01_start');
// 実際に上がった安全設定を確かめる
const head = await page.evaluate(async () => { const r = await fetch('/'); return { csp: r.headers.get('content-security-policy'), coop: r.headers.get('cross-origin-opener-policy') }; });
log('CSP', head.csp ? 'あり' : 'なし', '/ connect-src self:', /connect-src 'self'/.test(head.csp || ''));
// 外へ送れないこと（わざと送ってみる）
const blocked = await page.evaluate(async () => { try { await fetch('https://example.com/?x=1', { mode: 'no-cors', method: 'POST', body: 'test' }); return '送れてしまった'; } catch (e) { return '止められた'; } });
log('外への送信テスト:', blocked);
// 書類を入れる
const input = await page.$('#fileInput');
const files = ['tests/docs/_leak/with_hidden.pdf', 'tests/docs/_leak/with_exif.jpg', 'tests/docs/_leak/with_text.png', 'tests/docs/d2_tsuchi_tate_s11/photo_p1.jpg', 'tests/docs/d4_juminhyo_s11/digital.pdf'];
const t0 = Date.now();
await input.uploadFile(...files.map((f) => path.resolve(f)));
await page.waitForFunction(() => document.body.dataset.view === 'work' && document.body.dataset.reading !== '1', { timeout: 600000 });
log('読み取り', ((Date.now() - t0) / 1000).toFixed(1), '秒 / ', files.length, 'ファイル');
await page.waitForSelector('#overlay .m'); await new Promise((r) => setTimeout(r, 500)); await shot('02_work');
// 要確認を順に見る（Enter で次へ）
let n = 0; await page.click('#nextReview');
for (; n < 200; n++) {
  const left = await page.$eval('#reviewCount', (e) => e.textContent);
  if (!/残り/.test(left)) break;
  if (n === 1) { await new Promise((r) => setTimeout(r, 500)); await shot('03_focus'); }
  await page.keyboard.press('Enter'); await new Promise((r) => setTimeout(r, 25));
}
log('要確認を確認した件数', n);
// 全ページを開く
const nThumb = await page.$$eval('.thumb', (e) => e.length);
for (let i = 0; i < nThumb; i++) { await (await page.$$('.thumb'))[i].click(); await new Promise((r) => setTimeout(r, 120)); }
log('開いたページ', nThumb);
// 手で範囲を追加：最後のページの空き場所をドラッグ
const box = await (await page.$('#overlay')).boundingBox();
await page.mouse.move(box.x + 60, box.y + 60); await page.mouse.down(); await page.mouse.move(box.x + 200, box.y + 90, { steps: 4 }); await page.mouse.up();
const hasManual = await page.$$eval('#overlay .m', (els) => els.some((e) => e.title.startsWith('手で追加')));
log('手で追加', hasManual);
// 枠をクリックで解除→戻す
const before = await page.$$eval('#overlay .m.on', (e) => e.length);
await page.click('#overlay .m.on.seen, #overlay .m.on'); const after = await page.$$eval('#overlay .m.on', (e) => e.length);
await page.click('#undo'); const undone = await page.$$eval('#overlay .m.on', (e) => e.length);
log('クリックで解除', before, '→', after, '／戻す', undone);
// 語の追加
await page.type('#wordInput', '世帯主'); await page.keyboard.press('Enter');
await page.waitForFunction(() => /世帯主/.test(document.getElementById('toast').textContent), { timeout: 30000 });
log('語の追加:', await page.$eval('#toast', (e) => e.textContent));
// 仕上がり表示
await page.click('#modeFinal'); await new Promise((r) => setTimeout(r, 300)); await shot('04_final'); await page.click('#modeEdit');
// 保存へ
await page.click('#toFinish'); await page.waitForSelector('#evTable tbody tr'); await shot('05_finish');
await page.type('#optCase', '令和6年（家）第123号');
await page.click('#runExport');
await page.waitForFunction(() => !document.getElementById('downloads').hidden || document.getElementById('checks').textContent.includes('失敗'), { timeout: 600000 });
await new Promise((r) => setTimeout(r, 300)); await shot('06_checked');
const checks = await page.$$eval('#checks li', (ls) => ls.map((l) => l.textContent.replace(/\s+/g, ' ')));
log('--- 画面の検査結果'); checks.forEach((c) => log(' ', c));
// ダウンロード
const dls = [];
cdp.on('Browser.downloadWillBegin', (e) => dls.push(e.suggestedFilename));
for (const sel of ['#dlAll', '#dlPng', '#dlList', '#dlInternal']) { await page.click(sel); await new Promise((r) => setTimeout(r, 900)); }
await new Promise((r) => setTimeout(r, 1500));
log('ダウンロード', dls);
const foreign = reqs.filter((r) => !r.url.startsWith(`http://127.0.0.1:${port}`) && !r.url.startsWith('blob:') && !r.url.startsWith('data:'));
const nonGet = reqs.filter((r) => r.method !== 'GET');
log('通信', reqs.length, '件 / 外部', foreign.length, foreign.map((r) => r.url).slice(0, 5), '/ GET以外', nonGet.length, nonGet.map((r) => r.url + ' ' + r.method).slice(0, 5));
log('画面の通信カウンタ', await page.$eval('#netCount', (e) => e.textContent));
log('画面の誤り', errs.length, errs.slice(0, 8));
log('CSPで止まったもの', csp.length, csp.slice(0, 6));
const storage = await page.evaluate(async () => { const dbs = indexedDB.databases ? await indexedDB.databases() : []; return { local: localStorage.length, session: sessionStorage.length, idb: dbs.length, caches: (await caches.keys()).length }; });
log('端末への保存', storage);
fs.writeFileSync('tests/out/ui_flow.json', JSON.stringify({ checks, dls, reqsTotal: reqs.length, foreign, nonGet, errs, csp, storage, blocked }, null, 1));
await browser.close(); srv.close();
