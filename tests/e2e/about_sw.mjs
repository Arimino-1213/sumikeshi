// 読み込み済み（サービスワーカーが動いている）状態で「根拠と仕組み」が開けることを確かめる。node tests/e2e/about_sw.mjs [URL]
import puppeteer from 'puppeteer-core';
const URL_ = process.argv[2] || 'https://sumikeshi-jp.pages.dev/';
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'], defaultViewport: { width: 1440, height: 900 } });
const page = await browser.newPage(); const logs = []; page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text().slice(0, 160)); }); page.on('requestfailed', (r) => logs.push('失敗 ' + r.url().slice(0, 80) + ' ' + r.failure()?.errorText));
await page.goto(URL_, { waitUntil: 'load', timeout: 90000 });
await page.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller || false, { timeout: 120000 }).catch(() => logs.push('サービスワーカーが制御していない'));
if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) { await page.reload({ waitUntil: 'load' }); await page.waitForFunction(() => !!navigator.serviceWorker.controller, { timeout: 120000 }).catch(() => {}); }
console.log('制御中', await page.evaluate(() => !!navigator.serviceWorker.controller));
let fail = 0; const check = async (name, act) => { let ok = false, info = ''; try { await act(); await new Promise((r) => setTimeout(r, 1500)); const url = page.url(); const txt = await page.evaluate(() => document.body.innerText.slice(0, 40).replace(/\n/g, ' ')); info = url + ' ' + txt; ok = /根拠と仕組み/.test(await page.title()); } catch (e) { info = e.message.slice(0, 120); } console.log(ok ? '合格' : '不合格', name, info); if (!ok) fail++; };
await check('リンクから開く', async () => { await Promise.all([page.waitForNavigation({ timeout: 15000 }), page.evaluate(() => [...document.querySelectorAll('a')].find((x) => /根拠/.test(x.textContent)).click())]); });
await check('再読み込み', async () => { await page.reload({ waitUntil: 'load', timeout: 15000 }); });
await page.goto(URL_, { waitUntil: 'load' }).catch((e) => { console.log('不合格 はじめの画面へ戻る', e.message.slice(0, 100)); fail++; });
console.log('戻った題', await page.title());
await page.goto(URL_ + 'index.html', { waitUntil: 'load', timeout: 15000 }).then(async () => console.log('index.html', await page.title())).catch((e) => { console.log('不合格 index.html', e.message.slice(0, 100)); fail++; });
console.log('記録', [...new Set(logs)].slice(0, 6));
console.log(fail ? `不合格 ${fail}` : 'すべて合格');
await browser.close(); process.exit(fail ? 1 : 0);
