// 検出ルールの素早い試験：正解の文字列（OCRの誤りなし）で、見つかった割合と誤検出を見る
// 使い方: node tests/eval_text.mjs dev|held [詳細]
import fs from 'node:fs'; import path from 'node:path'; import kuromoji from 'kuromoji';
import { Detector } from '../public/js/detect.js';
const ROOT = path.resolve('tests/docs'); const set = process.argv[2] || 'dev'; const verbose = process.argv[3];
const tokenizer = await new Promise((ok, ng) => kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((e, t) => (e ? ng(e) : ok(t))));
// 行に見立てる：\t 区切りをセル、1文字=20px の仮の位置
function toLines(text) {
  const lines = []; let y = 0;
  for (const row of text.split('\n')) {
    let x = 0;
    for (const cell of row.split('\t')) {
      let s = cell.replace(/\s+$/, '');
      if (process.env.NOSP) s = s.replace(/[ 　]/g, ''); // OCR が空白を消した状態を再現
      if (s.trim()) lines.push({ text: s, vertical: false, conf: 1, box: [x, y, x + 20 * s.length, y + 24], chars: [...s].map((c, i) => ({ c, conf: 1, box: [x + i * 20, y, x + (i + 1) * 20, y + 24] })) });
      x += 20 * s.length + 40;
    }
    y += 40;
  }
  return lines;
}
const nz = (s) => s.normalize('NFKC').replace(/\s/g, '');
const det = new Detector({ tokenizer });
const stat = {}; let totE = 0, hitE = 0, fpKeep = 0, totK = 0; const misses = [], fps = [];
for (const m of JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'))) {
  if (m.set !== set) continue;
  const t = JSON.parse(fs.readFileSync(path.join(ROOT, m.id, 'truth.json'), 'utf8'));
  const lines = t.pageText.map(toLines);
  const { hits } = det.run([{ pages: lines.map((l) => ({ lines: l })) }]);
  const onHits = hits.filter((h) => h.tier !== 'low');
  const blob = onHits.map((h) => nz(h.text));
  const used = new Set();
  for (const e of t.entities) {
    if (e.type === 'seal') continue;
    totE++; const et = nz(e.text); const st = (stat[e.type] ||= { n: 0, ok: 0 }); st.n++;
    let ok = false;
    blob.forEach((b, i) => { if (!ok && !used.has(i) && b.includes(et)) { ok = true; if (b === et) used.add(i); } });
    if (ok) { st.ok++; hitE++; } else misses.push(`${m.id} [${e.type}] ${e.text}`);
  }
  const allEnt = t.entities.map((e) => nz(e.text));
  for (const k of t.keeps) { totK++; const kt = nz(k.text); const bad = onHits.find((h) => nz(h.text).includes(kt) || (kt.includes(nz(h.text)) && nz(h.text).length >= 3)); if (bad) { fpKeep++; fps.push(`${m.id} 隠してはいけない「${k.text}」← ${bad.type}「${bad.text}」`); } }
  for (const h of onHits) {
    const ht = nz(h.text);
    if (!allEnt.some((e) => e.includes(ht) || ht.includes(e))) fps.push(`${m.id} 余分 ${h.type}/${h.tier}「${h.text}」(${h.rule})`);
  }
}
console.log(`再現率 ${hitE}/${totE} = ${(hitE / totE * 100).toFixed(1)}%  隠してはいけない語を隠した ${fpKeep}/${totK}  余分な検出 ${fps.length}`);
console.log(Object.entries(stat).map(([k, v]) => `${k}:${v.ok}/${v.n}`).join(' '));
if (verbose) { console.log('--見落とし'); console.log(misses.join('\n')); console.log('--誤検出'); console.log(fps.join('\n')); }
