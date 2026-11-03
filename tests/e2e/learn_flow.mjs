// 学習機能を実際の画面で確かめる。①案件メモ（解除→次の書類へ反映・暗号化・読み込み）②傾向（端末の記録に原文がないこと・番号が外れないこと）
import puppeteer from 'puppeteer-core';
import fs from 'node:fs'; import path from 'node:path';
import { start } from '../serve.mjs';
const port = 9000 + (process.pid % 900); const srv = await start(port);
const DL = path.resolve('tests/out/dl_memo'); fs.rmSync(DL, { recursive: true, force: true }); fs.mkdirSync(DL, { recursive: true });
const SHOT = path.resolve('tests/out/shots'); fs.mkdirSync(SHOT, { recursive: true });
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 600000, args: ['--no-sandbox'], defaultViewport: { width: 1440, height: 900 } });
let fail = 0; const ok = (name, cond, info = '') => { console.log(cond ? '合格' : '不合格', name, cond ? '' : info); if (!cond) fail++; };
const errs = [];
const page = await browser.newPage();
const cdp = await page.createCDPSession(); await cdp.send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: DL });
page.on('pageerror', (e) => errs.push(e.message));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const toWork = () => page.waitForFunction(() => document.body.dataset.view === 'work' && document.body.dataset.reading !== '1', { timeout: 300000 });
const items = () => page.evaluate(async () => { const { S } = await import('/js/app.js'); return S.items.map((i) => ({ doc: i.doc, page: i.page, type: i.type, text: i.text, on: i.on, need: i.need, seen: i.seen, by: i.learnedBy })); });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
// ---- ①：1つ目の書類で「佐伯 真理子」を残す ----
await (await page.$('#fileInput')).uploadFile(path.resolve('サンプル書類/甲第2号証_給与明細（文字データ入り）.pdf'));
await toWork(); await page.waitForSelector('#list .row');
const rowOf = (text) => page.evaluate((t) => { const r = [...document.querySelectorAll('#list .row')].find((e) => e.querySelector('.row-val').textContent.replace(/\s/g, '').includes(t)); return r ? r.querySelector('input').click() || true : false; }, text);
ok('一覧に氏名がある', await rowOf('佐伯真理子')); await wait(100);
let it = await items(); ok('解除が全箇所に効く', it.filter((i) => i.text.replace(/\s/g, '') === '佐伯真理子').every((i) => !i.on));
// 個人番号など番号類：口座を解除しても案件メモには入らない
ok('口座番号も一覧にある', await rowOf('1234567')); await wait(100);
// 手で塗る（空きの場所でなく、文字の上）
await page.evaluate(() => document.querySelectorAll('.thumb')[0].click()); await wait(200);
// ---- 2つ目の書類を足す：同じ名前は最初から残る、口座は隠す ----
await (await page.$('#addInput')).uploadFile(path.resolve('サンプル書類/甲第7号証_陳述書（文字データ入り）.pdf'));
await page.waitForFunction(() => document.body.dataset.view === 'loading', { timeout: 5000 }).catch(() => {});
await toWork(); await wait(500);
it = await items();
const second = it.filter((i) => i.doc === 1 && i.text.replace(/\s/g, '') === '佐伯真理子');
ok('次の書類でも同じ語は残す', second.length > 0 && second.every((i) => !i.on), JSON.stringify(second.slice(0, 2)));
ok('理由に案件メモと出る', second.every((i) => /残すと決めた/.test(i.by)), second[0]?.by);
ok('要確認の表示は消えない（他の項目は隠す）', it.filter((i) => i.doc === 1 && i.type === 'phone').every((i) => i.on));
await page.screenshot({ path: path.join(SHOT, 'l1_memo_applied.png') });
// ---- 案件メモの画面と暗号化 ----
await page.click('#openMemo'); await wait(200);
await page.screenshot({ path: path.join(SHOT, 'l2_memo_dialog.png') });
ok('案件メモに語が出る', (await page.$eval('#memoWords', (e) => e.textContent)).includes('佐伯真理子'));
await page.type('#memoPass', 'short'); await page.click('#saveMemo'); await wait(200);
ok('短いパスワードは止まる', /8文字/.test(await page.$eval('#memoError', (e) => e.textContent)));
await page.$eval('#memoPass', (e) => { e.value = ''; }); await page.type('#memoPass', 'test-pass-1234'); await page.click('#saveMemo'); await wait(4000);
const files = fs.readdirSync(DL); ok('暗号化ファイルを保存', files.some((f) => f.endsWith('.sumi')), files);
const memoFile = path.join(DL, files.find((f) => f.endsWith('.sumi')));
const raw = fs.readFileSync(memoFile);
ok('ファイルに原文が見えない', !raw.toString('utf8').includes('佐伯') && !raw.includes(Buffer.from('佐伯', 'utf8')));
await page.click('#closeMemo');
// ---- 端末に残る内容 ----
await page.click('#toFinish'); await page.waitForSelector('#evTable tbody tr'); await page.click('#backWork'); await wait(100);
await page.evaluate(() => document.querySelector('#nextReview').click()); await wait(100);
for (let n = 0; n < 60; n++) { if (!/残り/.test(await page.$eval('#reviewCount', (e) => e.textContent))) break; await page.keyboard.press('Enter'); await wait(20); }
await page.click('#toFinish'); await page.waitForSelector('#evTable tbody tr'); await page.click('#runExport');
await page.waitForFunction(() => !document.getElementById('downloads').hidden, { timeout: 300000 });
const ls = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
console.log('端末に残った内容', ls.slice(0, 300));
ok('端末の記録に回数がある', /rules/.test(ls) && /onN/.test(ls));
ok('端末の記録に氏名がない', !/佐伯|真理子|浩一|悠斗|ソレイユ|桜樹台/.test(ls), ls.slice(0, 200));
ok('端末の記録に番号がない', !/[0-9]{5,}/.test(ls.replace(/"onN":\d+|"onOff":\d+|"offN":\d+|"offOn":\d+/g, '')), ls.slice(0, 200));
const idb = await page.evaluate(async () => (indexedDB.databases ? (await indexedDB.databases()).length : 0)); ok('IndexedDB は使わない', idb === 0);
// ---- ページを開き直して案件メモを読み込む ----
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
await page.click('#openMemoStart'); await wait(200);
await page.type('#memoPass', 'wrong-password');
await (await page.$('#loadMemo')).uploadFile(memoFile); await wait(4000);
ok('違うパスワードは読み込めない', /パスワード/.test(await page.$eval('#memoError', (e) => e.textContent)), await page.$eval('#memoError', (e) => e.textContent));
await page.$eval('#memoPass', (e) => { e.value = ''; }); await page.type('#memoPass', 'test-pass-1234');
await (await page.$('#loadMemo')).uploadFile(memoFile); await wait(4000);
ok('正しいパスワードで読み込める', (await page.$eval('#memoWords', (e) => e.textContent)).includes('佐伯真理子'));
await page.click('#closeMemo');
await (await page.$('#fileInput')).uploadFile(path.resolve('サンプル書類/複雑_原告第2準備書面（文字データ入り）.pdf')); await toWork(); await wait(500);
it = await items();
const third = it.filter((i) => i.text.replace(/\s/g, '') === '佐伯真理子');
ok('別の日の書類にも反映', third.length > 0 && third.every((i) => !i.on), JSON.stringify(third.slice(0, 2)));
// ---- ②：傾向を仕込んで効果を見る（番号は外れず、変わったものは要確認に出る）----
await page.evaluate(() => { const st = { v: 1, labels: { 備考欄: { n: 3 } }, rules: { 'proname:name-pro': { type: 'proname', rule: 'name-pro', onN: 20, onOff: 20, offN: 0, offOn: 0 }, 'mynumber:my-label': { type: 'mynumber', rule: 'my-label', onN: 50, onOff: 50, offN: 0, offOn: 0 }, 'phone:phone': { type: 'phone', rule: 'phone', onN: 50, onOff: 50, offN: 0, offOn: 0 } } }; localStorage.setItem('sumi.learn.v1', JSON.stringify(st)); });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
await (await page.$('#fileInput')).uploadFile(path.resolve('サンプル書類/複雑_原告第2準備書面（文字データ入り）.pdf'), path.resolve('サンプル書類/甲第2号証_給与明細（文字データ入り）.pdf')); await toWork(); await wait(500);
it = await items();
const pros = it.filter((i) => i.type === 'proname');
ok('よく解除する弁護士名は最初は残す', pros.length > 0 && pros.filter((i) => /解除/.test(i.by)).every((i) => !i.on), JSON.stringify(pros.slice(0, 3)));
ok('変わった候補は要確認に出る', pros.filter((i) => /解除/.test(i.by)).every((i) => i.need));
ok('電話は50回解除していても隠す', it.filter((i) => i.type === 'phone').every((i) => i.on));
await page.screenshot({ path: path.join(SHOT, 'l3_learned.png') });
// 学習を止める／消す
await page.click('#openMemo'); await wait(150); await page.screenshot({ path: path.join(SHOT, 'l4_learn_table.png') });
await page.click('#learnOn'); await wait(1200);
it = await items(); ok('止めると元に戻る', it.filter((i) => i.type === 'proname').every((i) => i.on));
await page.click('#clearLearn'); await wait(800);
ok('消すと記録がなくなる', await page.evaluate(() => !localStorage.getItem('sumi.learn.v1')));
await page.click('#closeMemo');
ok('画面の誤りなし', errs.length === 0, errs.slice(0, 3));
console.log(fail ? `学習の試験 不合格 ${fail}` : '学習の試験 すべて合格');
await browser.close(); srv.close();
process.exit(fail ? 1 : 0);
