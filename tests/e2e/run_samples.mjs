// サンプル書類を実際のアプリの処理に通し、答え合わせの表を作る
import puppeteer from 'puppeteer-core';
import fs from 'node:fs'; import path from 'node:path';
import { start } from '../serve.mjs';
const SAMPLE = path.resolve('サンプル書類'); const RAW = path.resolve('tests/samples_raw');
const port = 9000 + (process.pid % 900); const srv = await start(port);
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, protocolTimeout: 900000, args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('[誤り]', e.message));
await page.goto(`http://127.0.0.1:${port}/__t/e2e/eval.html`); await page.waitForFunction('window.ready===true');
await page.evaluate(() => window.boot());
const files = fs.readdirSync(SAMPLE).filter((f) => /\.(pdf|jpg|png)$/.test(f));
const man = JSON.parse(fs.readFileSync(path.join(RAW, 'manifest.json'), 'utf8'));
const LABEL = { name: '氏名', kana: '氏名（カナ）', proname: '弁護士・医師の氏名', birth: '生年月日', age: '年齢', mynumber: '個人番号', jukicode: '住民票コード', license: '免許証番号', passport: '旅券番号', pension: '基礎年金番号', insurance: '保険証の記号番号', account: '口座番号', bank: '銀行・支店名', employee: '社員番号', mrn: 'カルテ番号', car: '車のナンバー', address: '住所', corpaddr: '会社・医院の住所', corp: '会社・団体', card: 'カード番号', postal: '郵便番号', honseki: '本籍', workplace: '勤務先', school: '学校・園', phone: '電話・FAX', email: 'メール', snsid: 'SNSのID', seal: '印影' };
const nz = (s) => s.normalize('NFKC').replace(/\s/g, '').replace(/[ー－―‐−–—]/g, '-');
const out = []; let totH = 0, totN = 0, totKeep = 0, totK = 0;
const loaded = [];
for (const m of man) {
  const key = m.title.split('（')[0].split('_')[0];
  const short = { a12_junbi: '複雑_原告', a13_isan: '複雑_遺産', a14_hanyaku: '複雑_録音' }[m.id];
  const fname = files.find((f) => (short ? f.startsWith(short) : f.startsWith(m.title.split('（')[0]) || f.startsWith(key + '_')));
  const b = fs.readFileSync(path.join(SAMPLE, fname));
  const r = await page.evaluate(async (b64, name) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bin])); const type = name.endsWith('.pdf') ? 'application/pdf' : name.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return window.loadOnly(url, name.endsWith('.pdf') ? 'a.pdf' : 'a.' + name.slice(-3), type);
  }, b.toString('base64'), fname);
  loaded.push({ m, fname, r });
  if (process.env.DUMP) fs.writeFileSync(`tests/out/lines_${m.id}.txt`, r.pages.map((p) => p.lines.join('\n')).join('\n----\n'));
  console.log('読み取り', fname, r.sec.toFixed(1) + '秒', r.pages.map((p) => p.source + (p.notes.length ? '(' + p.notes.join('／') + ')' : '')).join(' '));
}
const hits = await page.evaluate(() => window.detectAll());
loaded.forEach(({ m, fname, r }, di) => {
  const t = JSON.parse(fs.readFileSync(path.join(RAW, m.id, 'truth.json'), 'utf8'));
  const on = hits.filter((h) => h.doc === di && h.tier !== 'low');
  let sealLeft = r.pages.reduce((s, p) => s + p.seals, 0), hit = 0; const rows = []; const used = new Set();
  for (const e of t.entities) {
    let found = false;
    if (e.type === 'seal') { if (sealLeft > 0) { sealLeft--; found = true; } } else {
      const et = nz(e.text);
      // 同じ語を先に当て、1つの候補は1つの答えにしか使わない（「三上ふみ子」の候補で「三上」を合格にしない）
      let c = on.findIndex((h, i) => !used.has(i) && h.page === e.page && nz(h.text) === et);
      if (c < 0) c = on.findIndex((h, i) => !used.has(i) && h.page === e.page && nz(h.text).includes(et) && !t.entities.some((o) => o !== e && o.page === e.page && nz(o.text) === nz(h.text)));
      if (c >= 0) { found = true; used.add(c); } else {
        const near = on.find((h) => h.page === e.page && [...et].filter((ch) => nz(h.text).includes(ch)).length / et.length >= 0.75 && et.length >= 3);
        if (near) found = true;
      }
    }
    if (found) hit++;
    rows.push({ page: e.page + 1, type: LABEL[e.type] || e.type, text: e.text.replace(/\s+/g, ' '), found, hand: e.hand });
  }
  const bad = t.keeps.filter((q) => on.some((h) => h.page === q.page && nz(h.text).includes(nz(q.text)))).map((q) => q.text);
  const extra = on.filter((h) => !t.entities.some((e) => e.page === h.page && (nz(e.text).includes(nz(h.text)) || nz(h.text).includes(nz(e.text))))).map((h) => `${h.label}「${h.text}」`);
  totH += hit; totN += t.entities.length; totKeep += bad.length; totK += t.keeps.length;
  out.push({ fname, pages: t.pages, hit, n: t.entities.length, sec: r.sec, source: r.pages.map((p) => p.source), bad, extra, rows, low: hits.filter((h) => h.doc === di && h.tier === 'low').map((h) => h.text).slice(0, 8) });
  console.log(`${fname}  見つけた ${hit}/${t.entities.length}  隠してはいけない語を隠した ${bad.length}  余分 ${extra.length}`);
  for (const q of rows.filter((q) => !q.found)) console.log('   見落とし', q.page, q.type, q.text);
  for (const q of bad) console.log('   隠してはいけない', q);
  for (const q of extra) console.log('   余分', q);
});
console.log(`合計 ${totH}/${totN} = ${(totH / totN * 100).toFixed(1)}%  隠してはいけない語を隠した ${totKeep}/${totK}`);
fs.mkdirSync('tests/out', { recursive: true }); fs.writeFileSync('tests/out/samples.json', JSON.stringify({ out, totH, totN, totKeep, totK }, null, 1));
await browser.close(); srv.close();
