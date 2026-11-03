// 読み取り結果（tests/out/lines_*.txt）だけで検出をやり直す（OCR を待たずに検出の調整をする）
import fs from 'node:fs'; import kuromoji from 'kuromoji'; import { Detector } from '../public/js/detect.js';
const pat = new RegExp(process.argv[2] || '.');
const tokenizer = await new Promise((ok, ng) => kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((e, t) => (e ? ng(e) : ok(t))));
const line = (s, y) => ({ text: s, conf: 1, vertical: false, box: [0, y, 24 * [...s].length, y + 28], chars: [...s].map((c, i) => ({ c, conf: 1, box: [i * 24, y, (i + 1) * 24, y + 28] })) });
const ids = fs.readdirSync('tests/out').filter((f) => /^lines_/.test(f)).sort();
const docs = ids.map((f) => ({ pages: fs.readFileSync('tests/out/' + f, 'utf8').split('\n----\n').map((p) => ({ lines: p.split('\n').filter((s) => s.trim()).map((s, i) => line(s, i * 40)) })) }));
const { hits } = new Detector({ tokenizer }).run(docs);
for (const h of hits) if (pat.test(h.text)) console.log(ids[h.doc].slice(6, 12), 'p' + h.page, h.tier, h.type, h.rule, '[' + h.text + ']');
