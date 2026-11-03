// 1書類の読み取り結果を見る: node tests/e2e/dbg.mjs d5_tsucho_s11 scan
import puppeteer from 'puppeteer-core';
import { start } from '../serve.mjs';
const [id, v] = process.argv.slice(2);
const port = 9000 + (process.pid % 900);
const srv = await start(port);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 300000, args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[誤り]', e.message));
await page.goto(`http://127.0.0.1:${port}/__t/e2e/eval.html`); await page.waitForFunction('window.ready===true');
await page.evaluate(() => window.boot());
const url = v === 'digital' ? `/__t/docs/${id}/digital.pdf` : `/__t/docs/${id}/${v}_p1.${v === 'photo' ? 'jpg' : 'png'}`;
const r = await page.evaluate((a, b, c) => window.evalOne(a, b, c), url, v === 'digital' ? 'a.pdf' : 'a.png', v === 'digital' ? 'application/pdf' : undefined);
const p = r.pages[0];
console.log(p.source, p.notes, p.width, p.height);
for (const l of p.lines) console.log((l.vertical ? '|' : '-'), l.conf.toFixed(2), l.box.map((x) => Math.round(x)).join(','), l.text);
console.log('--検出'); for (const h of r.hits) if (h.tier !== 'low') console.log(h.tier, h.type, h.rule, '[' + h.text + ']');
await browser.close(); srv.close();
