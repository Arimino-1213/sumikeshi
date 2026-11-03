// 読み込みの作りを確かめる：1ページ読めたら確認できる／画面が固まらない／中止できる／書類を外せる。各段階の時間も出す
import puppeteer from 'puppeteer-core'; import path from 'node:path'; import fs from 'node:fs';
import { start } from '../serve.mjs';
const port = 9000 + (process.pid % 900); const srv = await start(port);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 900000, args: ['--no-sandbox'], defaultViewport: { width: 1440, height: 900 } });
let fail = 0; const ok = (n, c, i = '') => { console.log(c ? '合格' : '不合格', n, c ? '' : i); if (!c) fail++; };
const page = await browser.newPage(); const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const S = 'サンプル書類/';
const fsAll = ['甲第3号証_源泉徴収票（スキャン）.jpg', '甲第4号証_預金通帳（スマホ撮影）.jpg', '甲第6号証_通知書（縦書き・スキャン）.pdf', '甲第8号証_診断書（カラースキャン）.pdf', '甲第9号証_賃貸借契約書（スマホ撮影）.pdf'].map((f) => path.resolve(S + f));
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
// 長いタスク（画面の固まり）を数える
await page.evaluate(() => { window.__long = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push(Math.round(e.duration)); }).observe({ type: 'longtask', buffered: true }); });
let t0 = Date.now();
await (await page.$('#fileInput')).uploadFile(...fsAll);
await page.waitForFunction(() => document.body.dataset.view === 'work', { timeout: 300000 });
const first = (Date.now() - t0) / 1000; console.log(`確認を始められるまで ${first.toFixed(1)} 秒`);
ok('読み取りの途中で確認に入れる', await page.evaluate(() => document.body.dataset.reading === '1'));
ok('中止ボタンが見える', await page.$eval('#readBar', (e) => !e.hidden));
ok('保存は読み取り中は押せない', await page.$eval('#toFinish', (e) => e.disabled));
await page.screenshot({ path: 'tests/out/shots/r1_reading.png' });
// 読み取り中に操作できるか
const c0 = await page.$$eval('#overlay .m.on', (e) => e.length);
if (c0) { await page.click('#overlay .m.on'); await sleep(150); const c1 = await page.$$eval('#overlay .m.on', (e) => e.length); ok('読み取り中も枠を操作できる', c1 === c0 - 1, `${c0}→${c1}`); await page.click('#undo'); }
await page.waitForFunction(() => document.body.dataset.reading !== '1', { timeout: 600000 });
const all = (Date.now() - t0) / 1000; console.log(`全部読み終えるまで ${all.toFixed(1)} 秒`);
// 読み取りが終わった瞬間に、全書類の候補が出ていること（欠けたまま保存させない）
const atEnd = await page.evaluate(async () => { const { S: st } = await import('/js/app.js'); return { docs: st.docs.map((d, i) => st.items.filter((x) => x.doc === i).length), dis: document.getElementById('toFinish').disabled, detecting: st.detecting }; });
ok('読み終えた時点で全書類に候補がある', atEnd.docs.every((n) => n > 0), JSON.stringify(atEnd)); ok('その時点で更新は終わっている', atEnd.detecting === 0 && !atEnd.dis, JSON.stringify(atEnd));
const long = await page.evaluate(() => window.__long); console.log('画面が50ms以上固まった回数', long.length, '最長', Math.max(0, ...long), 'ms', '上位', long.sort((a, b) => b - a).slice(0, 6));
ok('読み終えたら保存できる', await page.$eval('#toFinish', (e) => !e.disabled));
const n = await page.$$eval('.thumb', (e) => e.length); ok('全ページ読めた', n === 6, n);
// 書類を外す
const before = await page.$$eval('.doc-name', (e) => e.length);
await page.click('.doc-x'); await sleep(1500);
ok('書類を外せる', (await page.$$eval('.doc-name', (e) => e.length)) === before - 1);
// 読み取り中に追加→中止
t0 = Date.now();
await (await page.$('#addInput')).uploadFile(...fsAll.slice(0, 3));
await page.waitForFunction(() => document.body.dataset.reading === '1', { timeout: 20000 }); await sleep(800);
await page.click('#cancelRead'); const tc = Date.now();
await page.waitForFunction(() => document.body.dataset.reading !== '1', { timeout: 60000 });
console.log(`中止にかかった時間 ${((Date.now() - tc) / 1000).toFixed(1)} 秒`);
ok('中止すると読み取りが止まる', true);
await sleep(300); ok('中止のあとも今までの書類が残る', (await page.$$eval('.doc-name', (e) => e.length)) >= before - 1);
await page.waitForFunction(() => document.getElementById('list').children.length > 0, { timeout: 60000 });
ok('中止のあとも候補が出る', (await page.$$eval('#list .row', (e) => e.length)) > 0);
ok('中止のあと保存できる', await page.$eval('#toFinish', (e) => !e.disabled));
// 中止のあとまた読める
await (await page.$('#addInput')).uploadFile(path.resolve(S + '甲第2号証_給与明細（文字データ入り）.pdf'));
await page.waitForFunction(() => document.body.dataset.reading !== '1', { timeout: 120000 }); await sleep(300);
ok('中止のあとまた読める', (await page.$$eval('.doc-name', (e) => e.textContent), true) && (await page.$$eval('.doc-name', (e) => e.some((d) => d.textContent.includes('甲第2号証')))));
// 最初の読み込み中に中止：はじめの画面に戻る
const p2 = await (await browser.createBrowserContext()).newPage(); await p2.setViewport({ width: 1440, height: 900 }); p2.on('pageerror', (e) => errs.push(e.message));
await p2.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
await (await p2.$('#fileInput')).uploadFile(fsAll[0]); await p2.waitForFunction(() => document.body.dataset.view === 'loading', { timeout: 15000 }); await sleep(500);
await p2.screenshot({ path: 'tests/out/shots/r2_loading.png' });
await p2.click('#cancelLoad');
await p2.waitForFunction(() => document.body.dataset.view === 'start' && document.body.dataset.reading !== '1', { timeout: 30000 });
ok('最初の読み込みを中止するとはじめの画面に戻る', true);
await (await p2.$('#fileInput')).uploadFile(path.resolve(S + '甲第2号証_給与明細（文字データ入り）.pdf'));
await p2.waitForFunction(() => document.body.dataset.view === 'work', { timeout: 200000 }); ok('そのあと読み直せる', true);
// 段階ごとの時間
const t = await page.evaluate(async () => { const { S: st } = await import('/js/app.js'); return st.docs.flatMap((d) => d.pages.map((p) => ({ n: d.name.slice(0, 14), lines: p.lines.length, ...Object.fromEntries(Object.entries(p.timing || {}).map(([k, v]) => [k, Math.round(v)])) }))); });
console.table(t);
ok('画面の誤りなし', errs.length === 0, errs.slice(0, 3));
console.log(fail ? `不合格 ${fail}` : 'すべて合格');
await browser.close(); srv.close(); process.exit(fail ? 1 : 0);
