// 1つの書類の検出結果を全部出す（調整用）
import fs from 'node:fs'; import path from 'node:path'; import kuromoji from 'kuromoji';
import { Detector } from '../public/js/detect.js';
const id = process.argv[2];
const tokenizer = await new Promise((ok, ng) => kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((e, t) => (e ? ng(e) : ok(t))));
const t = JSON.parse(fs.readFileSync(path.join('tests/docs', id, 'truth.json'), 'utf8'));
const toLines = (text) => { const lines = []; let y = 0; for (const row of text.split('\n')) { let x = 0; for (const cell of row.split('\t')) { const s = cell.replace(/\s+$/, ''); if (s.trim()) lines.push({ text: s, vertical: false, conf: 1, box: [x, y, x + 20 * s.length, y + 24], chars: [...s].map((c, i) => ({ c, conf: 1, box: [x + i * 20, y, x + (i + 1) * 20, y + 24] })) }); x += 20 * s.length + 40; } y += 40; } return lines; };
const det = new Detector({ tokenizer });
const { hits, people } = det.run([{ pages: t.pageText.map((p) => ({ lines: toLines(p) })) }]);
for (const h of hits) console.log(h.tier.padEnd(4), h.type.padEnd(10), h.rule.padEnd(16), h.text);
console.log('人', people.map((p) => p.full + '(' + p.sei + '/' + p.mei + ')').join(' '));
if (process.argv[3]) console.log(tokenizer.tokenize(process.argv[3]).map((q) => `${q.surface_form}[${q.pos},${q.pos_detail_1},${q.pos_detail_2},${q.pos_detail_3},${q.word_type}]`).join(' '));
