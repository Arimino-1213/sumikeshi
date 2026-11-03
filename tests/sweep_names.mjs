// 名前が途中で切れて一部だけ隠れないかを、名前×言い回しの総当たりで数える（名前はすべて例示。実在の人を指さない）
import kuromoji from 'kuromoji'; import { Detector } from '../public/js/detect.js';
const tokenizer = await new Promise((ok, ng) => kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((e, t) => (e ? ng(e) : ok(t))));
const line = (s, y = 0) => ({ text: s, conf: 1, vertical: false, box: [0, y, 24 * [...s].length, y + 28], chars: [...s].map((c, i) => ({ c, conf: 1, box: [i * 24, y, (i + 1) * 24, y + 28] })) });
const NAMES = '悠斗 陽翔 蓮 結衣 陽菜 湊 大翔 颯太 葵 結菜 蒼空 莉子 心春 陽葵 樹 碧 律 朝陽 悠真 咲良 蒼 凛 健一 太郎 花子 美咲 翔太 拓海 優奈 真央 瑛太 怜 楓 紬 芽依 柚希 琉生 煌 遥斗 陸斗 海斗 悠人 陽斗 奏太 歩夢 心愛 結愛 一花 美月 七海 健司 隆夫 真理子 浩一 大輝 健太郎 由美 恵子 誠 修'.split(' ');
const TPL = [
  ['長男', (n) => `両名の間には、長男${n}（当時8歳）がある。`],
  ['長女', (n) => `長女${n}は保育園に通っている。`],
  ['長男の', (n) => `長男の${n}が転校した。`],
  ['氏名欄', (n) => `氏名 佐伯 ${n}`],
  ['姓名', (n) => `被告佐伯${n}は、次のとおり述べた。`],
  ['敬称さん', (n) => `担任から佐伯${n}さんの様子を聞いた。`],
  ['名だけ君', (n) => `その日、${n}君は学校を休んだ。`],
  ['名だけちゃん', (n) => `その日、${n}ちゃんは保育園を休んだ。`],
];
let total = 0, full = 0, part = 0, none = 0; const bad = new Map(), byT = {};
for (const [tn, f] of TPL) {
  byT[tn] = { full: 0, part: 0, none: 0 };
  for (const n of NAMES) {
    const s = f(n); const at = s.indexOf(n); const end = at + n.length;
    const { hits } = new Detector({ tokenizer }).run([{ pages: [{ lines: [line(s)] }] }]);
    const cov = new Set();
    for (const h of hits) if (h.tier !== 'low' && (h.type === 'name' || h.type === 'proname')) { const i = s.indexOf(h.text); if (i < 0) { console.log('位置不明', h.text); continue; } for (let k = i; k < i + h.text.length; k++) cov.add(k); }
    let c = 0; for (let k = at; k < end; k++) if (cov.has(k)) c++;
    total++;
    if (c === n.length) { full++; byT[tn].full++; } else if (c) { part++; byT[tn].part++; bad.set(`${tn}:${n}`, '一部'); } else { none++; byT[tn].none++; bad.set(`${tn}:${n}`, 'なし'); }
  }
}
console.log(`全 ${total}　全部隠れた ${full}　一部だけ ${part}　隠れない ${none}`);
console.table(byT);
const parts = [...bad].filter(([, v]) => v === '一部').map(([k]) => k);
console.log('一部だけ:', parts.join(' '));
if (process.argv[2]) console.log('隠れない:', [...bad].filter(([, v]) => v === 'なし').map(([k]) => k).join(' '));
process.exit(0);
