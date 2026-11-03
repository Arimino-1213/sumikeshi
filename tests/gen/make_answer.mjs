// サンプル書類の答え合わせ表を作る（tests/out/samples.json と正解データから）
import fs from 'node:fs'; import path from 'node:path';
const j = JSON.parse(fs.readFileSync('tests/out/samples.json', 'utf8'));
const RAW = 'tests/samples_raw'; const man = JSON.parse(fs.readFileSync(path.join(RAW, 'manifest.json'), 'utf8'));
const cell = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const rows = [['ファイル', 'ページ', '区分', '種類', '語', '自動で見つかったか', '備考']];
j.out.forEach((o, i) => {
  for (const r of o.rows) rows.push([o.fname, r.page, '隠す候補', r.type, r.text, r.found ? '○' : '×（手で追加）', r.hand ? '手書き風の字' : '']);
  const t = JSON.parse(fs.readFileSync(path.join(RAW, man[i].id, 'truth.json'), 'utf8'));
  for (const k of t.keeps) rows.push([o.fname, k.page + 1, '隠さない語', '', k.text, o.bad.includes(k.text) ? '×（隠れてしまう）' : '○', '']);
});
fs.writeFileSync('サンプル書類/答え合わせ.csv', '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n');
const lines = j.out.map((o) => `  ${o.fname}　${o.pages}ページ　見つけた ${o.hit}/${o.n}　読み取り ${o.sec.toFixed(0)}秒`);
fs.writeFileSync('サンプル書類/はじめに.txt', `墨消し サンプル書類（すべて架空です）

人物・住所・電話・口座・個人番号などはすべて作りものです。
1つの事件の書類一式として作っているので、同じ人物が書類をまたいで出てきます。

■ 試し方
1. アプリを Chrome で開く
2. 「どこまで隠しますか」を選ぶ（最初は「全部」）
3. このフォルダの書類をまとめてドラッグする
4. 「確認を始める」で要確認を1件ずつ見る（H＝隠す、N＝残す、Enter＝次へ）
5. 「保存へ進む」→「書き出して検査する」

■ 見どころ
・甲第4号証、甲第9号証、参考、複雑_録音反訳：スマホ写真の背景が消えてまっすぐに直る
・甲第6号証：縦書きと漢数字の電話番号
・甲第2号証、甲第7号証、複雑_原告第2準備書面：文字データ入りPDF（読み取りが速い）
・複雑_原告第2準備書面：「東京都知事」「山田町」「中村区役所」は隠さず、人名だけ隠す
・甲第5号証：LINEの相手の名前の小さい字は読めないことがある
・灰色のスキャンの印影、手書き、顔写真、QRコードは自動では見つからない。ドラッグで塗る

■ 答え合わせ
答え合わせ.csv（Excel で開けます）に、隠す候補と隠さない語、自動で見つかったかを1語ずつ載せています。
全部まとめて入れたときの結果です：見つけた ${j.totH}/${j.totN}（${(j.totH / j.totN * 100).toFixed(1)}%）、隠してはいけない語を隠した ${j.totKeep}/${j.totK}

${lines.join('\n')}

この数字は、これらの書類を見ながら直したあとの値です。未知の書類ではもっと下がります（docs/測定結果.md を参照）。
`);
console.log('作成', rows.length - 1, '行');
