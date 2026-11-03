// 回帰テスト：見つけたバグを再発させない。 node tests/regress.mjs
import kuromoji from 'kuromoji';
import { Detector, buildFlow, checkMyNumber, fixRadicals } from '../public/js/detect.js';
import { PROTECTED, effectOf, recordDecisions, recordLabel, learnedLabels, emptyStats, readUnderRect, encryptMemo, decryptMemo } from '../public/js/learn.js';
import { buildImagePdf, buildZip, buildCsv, inspectPdfBytes, inspectPngBytes } from '../public/js/export.js';
const tokenizer = await new Promise((ok, ng) => kuromoji.builder({ dicPath: 'node_modules/kuromoji/dict' }).build((e, t) => (e ? ng(e) : ok(t))));
const det = new Detector({ tokenizer });
let fail = 0, pass = 0;
const ok = (name, cond, info = '') => { if (cond) pass++; else { fail++; console.log('✗', name, info); } };
const line = (s, y = 0, x = 0, W = 24) => ({ text: s, conf: 1, vertical: false, box: [x, y, x + W * [...s].length, y + 28], chars: [...s].map((c, i) => ({ c, conf: 1, box: [x + i * W, y, x + (i + 1) * W, y + 28] })) });
const run = (lines) => det.run([{ pages: [{ lines }] }]).hits.filter((h) => h.tier !== 'low');
const texts = (hs, type) => hs.filter((h) => !type || h.type === type).map((h) => h.text.replace(/\s/g, ''));

// 1. PDF の部首の文字（⻘ ⻑）で住所・続柄が切れない
ok('部首→通常の字', fixRadicals('⻘葉台⻑男') === '青葉台長男');
let h = run([line('住所 東京都世田谷区⻘葉台南2丁目5番12号 パークハイツ⻘葉台南313号室に住んでいます')]);
ok('部首の字を含む住所', texts(h, 'address').some((t) => t.includes('青葉台南2丁目5番12号') && t.includes('313号室')), texts(h));

// 2. 肩書きを氏名に含めない・最後の字を落とさない（「代表取締役伊藤大」「弁護士田中大」の再発防止）
h = run([line('上記代表者代表取締役伊藤大輔')]);
ok('代表取締役を外す', texts(h, 'name').includes('伊藤大輔'), texts(h));
ok('肩書きが氏名に入らない', !texts(h).some((t) => /代表|取締役/.test(t)), texts(h));
h = run([line('債権者代理人弁護士田中大輔')]);
ok('弁護士は専門職に分ける', texts(h, 'proname').includes('田中大輔'), JSON.stringify(h.map((x) => [x.type, x.text])));
ok('弁護士の語が残らない', !texts(h).some((t) => /弁護士/.test(t)), texts(h));
h = run([line('氏名田中千代子昭和35年4月20日生')]);
ok('空白なしで次の語まで取らない', texts(h, 'name').includes('田中千代子'), texts(h));
ok('生年月日も別に取る', texts(h, 'birth').includes('昭和35年4月20日'), texts(h));
h = run([line('債務者 山田太郎')]);
ok('当事者の役割＋氏名', texts(h, 'name').includes('山田太郎'), texts(h));

// 2b. 調整外の書類で見つかった種類
h = run([line('戸籍に記録されている者一名幸子')]); ok('戸籍の名（【】の読み違い）', texts(h, 'name').includes('幸子'), texts(h));
h = run([line('【生年月日一昭和六十年八月十三日一配偶者区分】夫')]); ok('生年月日の記号ゆれ', texts(h, 'birth').includes('昭和六十年八月十三日'), texts(h));
h = run([line('【父】斎藤清母】石川明美【続柄】長男')]); ok('次の欄の見出しを取らない', texts(h, 'name').includes('斎藤清') && !texts(h, 'name').includes('斎藤清母'), texts(h));
h = run([line('緊急連絡先は配偶者の池田さくら（090-0123-4567）である')]); ok('ひらがなの名', texts(h, 'name').includes('池田さくら'), texts(h));
h = run([line('明美の面会は8月10日の午後でお願いします')]); ok('名だけの呼び名', texts(h, 'name').includes('明美'), texts(h));
h = run([line('（フリガナ）シミズ アイ'), line('橋本 結衣', 40, 0), line('これは幅を決めるための長い行で、折り返しの判定に使います。', 80, 0)]); ok('フリガナの下の氏名', texts(h, 'name').some((x) => x === '橋本結衣'), texts(h));
{
  const L = [line('住所又は居所 宮城県仙台市青葉区藤ノ森北8丁目24番4号 メゾン', 0, 0), line('藤ノ森北855号室', 40, 0)];
  const hh = run(L); ok('欄の中で折り返した住所', hh.some((x) => x.type === 'address' && x.text.includes('855号室')), hh.map((x) => x.text));
  const B = [line('生年月日 昭和34年1月3', 0, 0), line('日', 40, 0)];
  const hb = run(B); ok('日が次の行に落ちた生年月日', hb.some((x) => x.type === 'birth' && x.text.endsWith('日')), hb.map((x) => x.text));
}
h = run([line('賃貸人 若草電機株式会社')]); ok('当事者の会社名は会社扱い', texts(h, 'corp').length === 1 && !texts(h, 'workplace').length, JSON.stringify(h.map((x) => [x.type, x.text])));
// 2c. 2回目の調整外の書類で見つかった種類
h = run([line('養育費として月額金五万円を鈴蘭信用金庫楓支店の口座に振り込む')]);
ok('金額を銀行名に巻き込まない', !texts(h).some((x) => x.includes('万円')), texts(h));
ok('銀行名は拾う', texts(h, 'bank').some((x) => x.includes('鈴蘭信用金庫')), texts(h));
h = run([line('照会番号 250112345678')]); ok('別の番号は個人番号にしない', !texts(h, 'mynumber').length, texts(h));
h = run([line('甲乙間の長女みどり（昭和60年8月13日生）の親権者を乙と定める')]); ok('「の」なしの続柄', texts(h, 'name').includes('みどり'), texts(h));
h = run([line('お振込先 普通 1234567 名義 フジイ サトシ')]); ok('名義のカナ', texts(h, 'kana').some((x) => x.includes('フジイ')), texts(h));
h = run([line('楓が丘高等学校 卒業')]); ok('「が」を含む校名', texts(h, 'school').includes('楓が丘高等学校'), texts(h));
h = run([line('平成18年4月 楓電設株式会社 入社')]); ok('入社で勤務先', texts(h, 'workplace').includes('楓電設株式会社'), JSON.stringify(h.map((x) => [x.type, x.text])));
h = run([line('会社は雲雀丘運輸株式会社のままだよ')]); ok('会話の勤務先', texts(h, 'workplace').includes('雲雀丘運輸株式会社'), JSON.stringify(h.map((x) => [x.type, x.text])));
{
  const r = det.run([{ pages: [{ lines: [line('話者B 村上 亮'), line('亮が泣いてたんだよ', 40, 0)] }] }]).hits.filter((x) => x.tier !== 'low');
  ok('1文字の名（氏名が分かっている人）', r.some((x) => x.text === '亮'), r.map((x) => x.text));
}
// 2d. 3回目で見えた種類
h = run([line('原告の自宅であるつくば市潮見ヶ丘9丁目22番15号の玄関前において暴行を加えた')]);
ok('住所に「である」「の玄関前」を入れない', texts(h, 'address').includes('つくば市潮見ヶ丘9丁目22番15号'), texts(h));
h = run([line('原告は当時菜の花保険サービス株式会社に勤務しており')]); ok('「の」を含む会社名', texts(h, 'workplace').includes('菜の花保険サービス株式会社'), JSON.stringify(h.map((x) => [x.type, x.text])));
h = det.run([{ pages: [{ lines: [line('話者A 福田眞一'), line('話者B 村上亮', 40, 0), line('話者Aの発言です', 80, 0)] }] }]).hits.filter((x) => x.tier !== 'low');
ok('「話者」を氏名にしない', !h.some((x) => x.text.includes('話者')), h.map((x) => x.text));
// 2e. 実物に近いサンプルで見つかった種類
h = run([line('私は現在、株式会社ソレイユ物流に勤務しています。')]); ok('前株の勤務先', texts(h, 'workplace').includes('株式会社ソレイユ物流'), JSON.stringify(h.map((x) => [x.type, x.text])));
h = run([line('賃貸人 有限会社あおば不動産 との間で')]); ok('前株＋ひらがなの会社名', texts(h, 'corp').some((x) => x.includes('あおば不動産')), JSON.stringify(h.map((x) => [x.type, x.text])));
h = run([line('凛はさくらんぼ第二保育園に通っています')]); ok('ひらがなで始まる園名', texts(h, 'school').includes('さくらんぼ第二保育園'), texts(h));
h = run([line('職場にも電話があり、上司の井上課長に迷惑をかけました')]); ok('役職の前の名前', texts(h, 'name').includes('井上'), texts(h));
h = run([line('インスタも見てるぞ @sample_mari_000')]); ok('単独の@ID', texts(h, 'snsid').some((x) => x.includes('sample_mari_000')), texts(h));
h = run([line('お前のFacebook見たぞ https://www.facebook.com/sample.account.000000')]); ok('SNSのURL', texts(h, 'snsid').length === 1, texts(h));
h = run([line('メールは mari@example.jp まで')]); ok('メールを@IDと誤認しない', !texts(h, 'snsid').length, texts(h));
h = run([line('16歳未満の扶養親族')]); ok('16歳未満は年齢にしない', !texts(h, 'age').length, texts(h));
h = run([line('Surname / 姓 SAEKI Given name / 名 MARIKO')]); ok('旅券のラテン文字の氏名', texts(h, 'kana').includes('SAEKI') && texts(h, 'kana').includes('MARIKO'), texts(h));
ok('「姓」「名」を氏名にしない', !texts(h, 'name').length, texts(h));
h = run([line('給与 カ)ソレイユブツリュウ')]); ok('給与の振込元', texts(h, 'workplace').length === 1, texts(h));
{
  const L = [line('所在 東京都新宿区夢見丘1-2-3', 0, 0), line('構造 鉄筋コンクリート造3階建', 40, 0)];
  ok('「3階建」を住所の続きにしない', !run(L).some((x) => x.text.includes('鉄筋')), run(L).map((x) => x.text));
  const hh = run([line('住所又は居所'), line('(受給者番号)0417', 0, 600)]); ok('番号の欄を住所にしない', !hh.some((x) => x.text.includes('0417')), hh.map((x) => x.text));
}
h = run([line('同社の同僚長谷部 剛は、被告が社内で話していたと述べている')]); ok('同僚の後の名前', texts(h, 'name').includes('長谷部剛'), texts(h));
h = run([line('隣室に住む渡邊 美穂が物音を聞いている')]); ok('姓 空白 名', texts(h, 'name').includes('渡邊美穂'), texts(h));
h = run([line('お義母さんの携帯にも電話した。全員に伝えた')]); ok('続柄や全員を氏名にしない', !texts(h, 'name').length, texts(h));
h = run([line('東都テクノ工業(株) 生産技術部 第一課 主任')]); ok('(株)＋部署で勤務先', texts(h, 'workplace').some((x) => x.includes('東都テクノ工業')), texts(h));
{
  const r = det.run([{ pages: [{ lines: [line('私は株式会社ソレイユ物流に勤務しています')] }, { lines: [line('ソレイユの方は休めない。ソレイユ物流の人事に話す')] }] }]).hits.filter((x) => x.tier !== 'low');
  ok('略した勤務先も拾う', r.some((x) => x.page === 1 && x.type === 'workplace' && x.text.includes('ソレイユ物流')), r.map((x) => x.text));
}
h = run([line('地番 100番5 家屋番号 100番5の2')]); ok('地番と家屋番号', texts(h, 'address').length === 2, texts(h));
h = run([line('生年昭和24年1030 続柄 乙の義父')]); ok('月日が読めない生年月日', texts(h, 'birth').some((x) => x.includes('昭和24年1030')), texts(h));
h = run([line('出生昭和57年12月1日')]); ok('出生の欄', texts(h, 'birth').length === 1, texts(h));
{
  const r = det.run([{ pages: [{ lines: [line('氏名 佐伯 凛')] }, { lines: [line('悠斗と凛に会わせろ。長女凛がある。')] }] }]).hits.filter((x) => x.tier !== 'low' && x.page === 1);
  ok('1文字の名（助詞・続柄のあと）', r.filter((x) => x.text === '凛').length === 2, r.map((x) => x.text));
  const r2 = det.run([{ pages: [{ lines: [line('人事の中西さんの直通です')] }] }]).hits.filter((x) => x.tier !== 'low');
  ok('「さん」だけを氏名にしない', !r2.some((x) => x.text === 'さん'), r2.map((x) => x.text));
}
h = run([line('担当は小笠原相談員である')]); ok('役職の前の地名扱いの姓', texts(h, 'name').includes('小笠原'), texts(h));
h = run([line('番号第123412341234号'), line('神奈川県公安委員会', 40, 0)]); ok('公安委員会を住所にしない', !texts(h, 'address').length, texts(h));
// 3. 行の折り返しで語が切れない（「長男の拓／海」）
{
  const L = [line('2 相手方とは平成27年4月に結婚し、長男の拓', 0, 0), line('海をもうけました。私は東京都新宿区夢見丘', 40, 0), line('2丁目3番4号に住んでいます。以上', 80, 0)];
  L[0].box[2] = L[1].box[2] = 1000; L[2].box[2] = 700;
  const f = buildFlow(L); ok('折り返しは改行にしない', f.text.includes('拓海をもうけ'), f.text);
  const hh = run(L); ok('折り返した名前', texts(hh, 'name').includes('拓海'), texts(hh));
  ok('折り返した住所', texts(hh, 'address').some((t) => t.includes('夢見丘2丁目3番4号')), texts(hh));
  const addr = hh.find((x) => x.type === 'address');
  ok('2行にまたがる住所は枠が2つ', addr && addr.rects.length === 2, addr?.rects?.length);
}

// 4. 番号
const valid = '123456789018'; ok('個人番号の検査用数字', checkMyNumber(valid) && !checkMyNumber('123456789012'));
h = run([line('整理番号 123456789018')]); ok('整理番号は個人番号にしない', !texts(h, 'mynumber').length, texts(h));
h = run([line('個人番号'), line(valid, 0, 200)]); ok('欄が分かれた個人番号', texts(h, 'mynumber').includes(valid), texts(h));
h = run([line('法人番号 4010401000018')]); ok('13桁の法人番号は隠さない', !h.length, texts(h));
h = run([line('住民票コード'), line('57068012372', 0, 400)]); ok('住民票コード（長音で切れない）', texts(h, 'jukicode').includes('57068012372'), texts(h));
h = run([line('電話 090-0783-9479')]); ok('ハイフンの電話', texts(h, 'phone').includes('090-0783-9479'), texts(h));
h = run([line('携帯電話（番号〇九〇ー〇九六四ー〇六五九）')]); ok('漢数字の電話', texts(h, 'phone').some((t) => t.includes('〇九〇')), texts(h));
h = run([line('令和6年（家イ）第1234号 金15万円 平成27年4月1日')]); ok('事件番号・金額・日付は隠さない', !h.length, texts(h));
h = run([line('903-9436')]); ok('〒が読めない郵便番号', texts(h, 'postal').length === 1, texts(h));
h = run([line('在留カード番号 AB12345678CD')]); ok('在留カード', texts(h, 'zairyu').length === 1, texts(h));
h = run([line('振込スズキ ミサキ')]); ok('空白の有無によらずカナ氏名', texts(h, 'kana').length === 1, texts(h));
h = run([line('普通 1234567 あおぞら信用金庫東青葉台南支店')]);
ok('まとめた範囲の文字', texts(h).some((t) => t.includes('青葉台南支店')), texts(h));

// 5. 全ページへの展開
{
  const r = det.run([{ pages: [{ lines: [line('氏名 佐々木健太')] }, { lines: [line('佐々木から連絡がありました。佐々木健太の件です')] }] }]).hits;
  ok('同じ人を別ページでも拾う', r.filter((x) => x.page === 1 && x.type === 'name').length >= 2, r.map((x) => [x.page, x.text]));
}

// 6. 出力ファイル：文字の入れ物がないこと
{
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xd9]);
  const pdf = buildImagePdf([{ bytes: jpeg, width: 100, height: 141 }]);
  const r = inspectPdfBytes(pdf, ['山田太郎']); ok('自作PDFの構造', r.ok, JSON.stringify(r));
  const s = new TextDecoder('latin1').decode(pdf);
  ok('A4', s.includes('595.28 841.89'), s.slice(0, 200));
  ok('Info なし', !/\/Info|\/Producer|\/Creator/.test(s));
  const bad = new TextEncoder().encode('%PDF-1.5 <</Author(x)>> /Font'); ok('混入を検知できる', !inspectPdfBytes(bad, []).ok);
  const withExif = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 4, 0, 0, 0xff, 0xd9]); ok('EXIF を検知できる', inspectPdfBytes(withExif, []).jpegApp.length === 1);
  const noise = new Uint8Array([...new TextEncoder().encode('%PDF stream\n'), 55, 54, 50, 0, 1, ...new TextEncoder().encode('\nendstream')]);
  ok('画像データ内の短い数字の偶然一致で誤警告しない', inspectPdfBytes(noise, ['762']).leaked.length === 0, JSON.stringify(inspectPdfBytes(noise, ['762'])));
  ok('目次の数字と短い番号の偶然一致で誤警告しない', inspectPdfBytes(new TextEncoder().encode('xref\n0000123762 00000 n'), ['762']).leaked.length === 0);
  ok('長い番号の混入は検知する', inspectPdfBytes(new TextEncoder().encode('note 111111111118'), ['111111111118']).leaked.length === 1);
  const secret = new TextEncoder().encode('xx山田太郎xx'); ok('原文の混入を検知できる', inspectPdfBytes(secret, ['山田太郎']).leaked.length === 1);
  const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 1, 116, 69, 88, 116, 65, 0, 0, 0, 0]);
  ok('PNG の文字情報を検知できる', !inspectPngBytes(png).ok);
  const z = buildZip([{ name: 'a.txt', bytes: new Uint8Array([1, 2, 3]) }]); ok('ZIP の時刻を固定', z[10] === 0 && z[11] === 0 && z[12] === 33 && z[13] === 0);
}

// 7. 一覧：提出用に原文を入れない、数式として動かさない
{
  const rows = [{ evidence: '甲第1号証', page: 1, position: '上左', label: '氏名', reason: '欄のあとの名前', basis: 'x', how: '黒塗り', text: '山田太郎' }];
  ok('提出用CSVに原文なし', !buildCsv(rows, false).includes('山田太郎'));
  ok('控えには原文あり', buildCsv(rows, true).includes('山田太郎'));
  ok('数式の無効化', buildCsv([{ ...rows[0], text: '=HYPERLINK("x")' }], true).includes("'=HYPERLINK"));
}
h = run([line('原告名義のゆうちょ銀行の口座に振り込む')]); ok('名義の語を銀行名に入れない', texts(h, 'bank').includes('ゆうちょ銀行'), texts(h));
h = run([line('のぞみ銀行 本店 普通 1234567')]); ok('「の」で始まる銀行名', texts(h, 'bank').includes('のぞみ銀行'), texts(h));
h = run([line('陳 述 書')]); ok('字間を空けた見出しを氏名にしない', !texts(h, 'name').length, texts(h));
h = run([line('普 通 預 金 通 帳')]); ok('字間を空けた見出し（長い）', !texts(h, 'name').length, texts(h));
{
  const r = det.run([{ pages: [{ lines: [line('長男悠斗（8歳）と長女凛（3歳）をもうけました。')] }, { lines: [line('悠斗は3年生で、凛は保育園に通っています。')] }] }]).hits.filter((x) => x.tier !== 'low' && x.page === 1);
  ok('1文字の名を文中でも拾う', r.some((x) => x.text === '凛'), r.map((x) => x.text));
}
// 辞書が名前を分けても、名前をまるごと隠す（「長男■斗」の不具合）
for (const [src, want] of [
  ['両名の間には、長男悠斗（当時8歳）がある。', '悠斗'], ['長女悠真は保育園に通う。', '悠真'], ['長男の悠斗が転校した。', '悠斗'], ['長男の遥斗が転校した。', '遥斗'],
  ['長男蓮（当時8歳）', '蓮'], ['長女陽菜（3歳）', '陽菜'], ['長男奏太（8歳）', '奏太'], ['長男の大輝が転校した。', '大輝'],
  ['担任から佐伯大翔さんの様子を聞いた。', '大翔'], ['担任から佐伯悠人さんの様子を聞いた。', '悠人'], ['その日、奏太君は学校を休んだ。', '奏太'], ['その日、心愛ちゃんは休んだ。', '心愛'], ['その日、蓮君は休んだ。', '蓮'], ['氏名 佐伯 奏太', '奏太'],
]) {
  h = run([line(src)]).filter((x) => x.tier !== 'low' && (x.type === 'name' || x.type === 'proname'));
  ok(`名前をまるごと隠す：${src}`, h.some((x) => x.text.replace(/\s/g, '').includes(want)), JSON.stringify(h.map((x) => x.text)));
}
h = det.run([{ pages: [{ lines: [line('長男の蓮が転校した。')] }] }]).hits; ok('「長男の」のあとの1文字は最初は隠さず候補に出す', h.some((x) => x.text === '蓮' && x.tier === 'low'), JSON.stringify(h.map((x) => [x.text, x.tier])));
h = det.run([{ pages: [{ lines: [line('長男の件が残る。')] }] }]).hits; ok('「長男の件」は候補にしない', !h.some((x) => x.text === '件'), JSON.stringify(h.map((x) => x.text)));
// 地名の一部を人名につながない（「大田区汐見ヶ」を人として登録し、別の「東京」まで隠した不具合）
for (const src of ['原告の現住所（東京都大田区汐見ヶ丘一丁目7番2号）は秘匿の対象である。', '東京都千代田区錦町河岸二丁目八番三号', '神奈川県横浜市港北区桜樹台三丁目14番6号', '被告は東京都大田区に居住する。']) {
  const r = det.run([{ pages: [{ lines: [line(src)] }] }]);
  ok(`住所を人名にしない：${src}`, !r.people.length, JSON.stringify(r.people.map((p) => p.full)));
}
{
  const r = det.run([{ pages: [{ lines: [line('原告の現住所（東京都大田区汐見ヶ丘一丁目7番2号）は秘匿する。')] }, { lines: [line('東京都知事の所管する制度である。')] }] }]).hits.filter((x) => x.page === 1 && x.tier !== 'low');
  ok('住所の都道府県名を別のページで隠さない', !r.length, JSON.stringify(r.map((x) => x.text)));
}
// 旧姓と「母である〜」（「旧姓三上」「三上ふみ子」「ふみ子」が残った不具合）
h = run([line('原告（当時38歳。旧姓三上）と被告は婚姻した。')]); ok('旧姓のあとの名前', texts(h, 'name').includes('三上'), texts(h));
h = run([line('旧姓：田中')]); ok('旧姓の欄', texts(h, 'name').includes('田中'), texts(h));
{
  const r = det.run([{ pages: [{ lines: [line('夜、被告は原告の母である三上ふみ子（以下「ふみ子」という。）の面前で原告を怒鳴りつけ、ふみ子が通報した。')] }, { lines: [line('これは原告の母ふみ子から預かった金員である。')] }] }]).hits.filter((x) => x.tier !== 'low' && x.type === 'name');
  ok('母である〜をまるごと隠す', r.some((x) => x.page === 0 && x.text === '三上ふみ子'), JSON.stringify(r.map((x) => x.text)));
  ok('略した呼び名も隠す', r.filter((x) => x.page === 0 && x.text === 'ふみ子').length >= 1, JSON.stringify(r.map((x) => x.text)));
  ok('別のページの呼び名も隠す', r.some((x) => x.page === 1 && x.text.includes('ふみ子')), JSON.stringify(r.map((x) => x.text)));
}
for (const src of ['母である女性が来た。', '父である被告は', '夫である相手方が', '母であるため', '妻である原告は', '母である旨を述べた。', '妻であるものの']) {
  h = run([line(src)]).filter((x) => x.type === 'name');
  ok(`「である」のあとの普通の語：${src}`, !h.length, JSON.stringify(h.map((x) => x.text)));
}
// 公開するサンプルに、実在のものと重なりうる値を入れない
{
  const src = (await import('node:fs')).readFileSync('tests/gen/samples.mjs', 'utf8');
  ok('サンプルに実在の金融機関を使わない', !/ゆうちょ|みどり信用金庫|あさひ証券/.test(src));
  ok('サンプルのメールは例示用ドメインだけ', [...src.matchAll(/[\w.-]+@([\w.-]+)/g)].every((m) => /^example\.(jp|com)$/.test(m[1])));
  ok('サンプルの携帯番号は本物の桁数にしない', !/0[789]0[- ]\d{4}[- ]\d{4}|0120-|〇[七八九]〇ー/.test(src));
  const nums = [...src.matchAll(/(?<!\d)\d{12}(?!\d)/g)].map((m) => m[0]).filter(checkMyNumber);
  ok('サンプルの12桁は検査用数字が合わない', !nums.length, nums);
  const urls = [...src.matchAll(/https?:\/\/[^\s'"<)`]+/g)].map((m) => m[0]);
  ok('サンプルのSNSのURLは見本のアカウントだけ', urls.every((u) => /sample\./.test(u)), urls);
}
h = run([line('TEL044-000-2222（内線2214） 社員1DT-123456')]); ok('社員IDの読み間違い', texts(h, 'employee').includes('T-123456'), JSON.stringify(h.map((x) => x.text)));
h = run([line('内線 2214　社員ID T-123456')]); ok('社員IDの値', texts(h, 'employee').includes('T-123456'), JSON.stringify(h.map((x) => x.text)));
// 続柄や名前のあとの普通の語は名前にしない
for (const src of ['長女名義の口座', '長男及び長女', '長女夫婦', '長男出生後', '長女誕生', '祖父母の家', '長男宅', '長男の学校', '母の実家', '夫の暴力', '子の監護', '夫の元妻', '長男本人', '長女自身', '長男以外', '長男二人', '長男等', '赤ちゃんが泣く', '父ちゃんは', '叔母宅に行く', '息子夫婦と同居', '長男家族']) {
  h = run([line(src)]).filter((x) => x.tier !== 'low' && (x.type === 'name' || x.type === 'proname'));
  ok(`名前にしない：${src}`, !h.length, JSON.stringify(h.map((x) => x.text)));
}
h = run([line('山田太郎宅に行った。氏名 山田太郎')]).filter((x) => x.tier !== 'low' && x.type === 'name'); ok('名前の直後の「宅」は隠さない', h.every((x) => !x.text.includes('宅')), JSON.stringify(h.map((x) => x.text)));
{
  const r = det.run([{ pages: [{ lines: [line('長男樹（8歳）がいる。')] }, { lines: [line('庭の樹木を切った。樹が学校に行く。')] }] }]).hits.filter((x) => x.tier !== 'low' && x.page === 1 && x.type === 'name');
  ok('1文字の名は語の中では拾わない', r.length === 1 && r[0].text === '樹', JSON.stringify(r.map((x) => x.text)));
}
h = run([line('事業所名称株式会社ソレイユ物流')]); ok('見出しが続いた勤務先', texts(h, 'workplace').includes('株式会社ソレイユ物流'), JSON.stringify(h.map((x) => [x.type, x.text])));
h = run([line('被相続人三上隆夫（昭和24年10月30生、令和5年12月3死亡）')]); ok('「日」が読めない生年月日', texts(h, 'birth').includes('昭和24年10月30'), texts(h));
ok('死亡日は生年月日にしない', !texts(h, 'birth').some((x) => x.includes('令和5')), texts(h));
// 8. 学習
{
  const st = emptyStats();
  const mk = (type, rule, tier, on, baseOn) => ({ type, rule, tier, on, baseOn, seen: true });
  for (let i = 0; i < 10; i++) recordDecisions(st, [mk('corp', 'corp-party', 'mid', false, true), mk('mynumber', 'my-check', 'high', false, true), mk('address', 'addr-city-only', 'mid', false, true), mk('name', 'name-dict', 'mid', i < 2, true), mk('corp', 'corp', 'low', true, false)]);
  ok('よく解除する種類は最初は残す', effectOf(st, { type: 'corp', rule: 'corp-party', tier: 'mid' }) === 'demote');
  ok('個人番号は何度解除しても外れない', effectOf(st, { type: 'mynumber', rule: 'my-check', tier: 'high' }) === null);
  ok('住所は何度解除しても外れない', effectOf(st, { type: 'address', rule: 'addr-city-only', tier: 'mid' }) === null);
  ok('8割の解除で氏名の辞書候補は最初は残す', effectOf(st, { type: 'name', rule: 'name-dict', tier: 'mid' }) === 'demote');
  ok('確実な氏名（欄のあと）は変わらない', effectOf(st, { type: 'name', rule: 'name-dict', tier: 'high' }) === null);
  ok('よく隠す念のため候補は最初から隠す', effectOf(st, { type: 'corp', rule: 'corp', tier: 'low' }) === 'promote');
  const unseen = { type: 'corp', rule: 'x', tier: 'mid', on: false, baseOn: true, seen: false }; const st2 = emptyStats(); recordDecisions(st2, [unseen]);
  ok('見ていない項目は数えない', !Object.keys(st2.rules).length);
  const once = mk('corp', 'y', 'mid', false, true); recordDecisions(st2, [once]); recordDecisions(st2, [once]);
  ok('同じ項目は1回だけ数える', st2.rules['corp:y'].onN === 1);
  const js = JSON.stringify(st); ok('傾向の記録に原文が入らない', !/山田|太郎|[0-9]{6}/.test(js), js.slice(0, 120));
  recordLabel(st, '緊急連絡先'); ok('欄の名前は1回では使わない', !learnedLabels(st).includes('緊急連絡先'));
  recordLabel(st, '緊急連絡先'); ok('欄の名前は2回で使う', learnedLabels(st).includes('緊急連絡先'));
  ok('欄の名前：普通の語は覚える', det.isSafeLabel('緊急連絡先'));
  ok('欄の名前：人名は覚えない', !det.isSafeLabel('田中太郎'));
  ok('欄の名前：数字は覚えない', !det.isSafeLabel('090123'));
  ok('欄の名前：地名は覚えない', !det.isSafeLabel('大阪'));
  const hl = det.run([{ pages: [{ lines: [line('緊急連絡先 090-0123-4567 備考欄 夢見丘の叔父宅')] }] }], { learnedLabels: ['備考欄'] }).hits.filter((x) => x.tier !== 'low');
  ok('学習した欄の値を候補に出す', hl.some((x) => x.type === 'learned' && x.text.includes('夢見丘の叔父宅')), hl.map((x) => [x.type, x.text]));
  const L2 = [line('緊急連絡先 山田花子', 0, 0)];
  const u = readUnderRect(L2, [24 * 6 - 2, -2, 24 * 10 + 2, 30]); ok('手で塗った下の文字を読む', u.text === '山田花子', u); ok('左の欄の名前を読む', u.label === '緊急連絡先', u);
  const u2 = readUnderRect([line('連絡先', 0, 0), line('山田花子', 0, 200)], [198, -2, 300, 30]); ok('左隣の欄の名前を読む', u2.label === '連絡先' && u2.text === '山田花子', u2);
  const memo = { v: 1, words: ['長谷部'], hide: ['三上'], keep: ['佐伯真理子'], scene: 'hitoku' };
  const enc2 = await encryptMemo(memo, 'correct horse');
  ok('案件メモに平文が入らない', !Buffer.from(enc2).toString('utf8').includes('佐伯') && !Buffer.from(enc2).toString('latin1').includes('hitoku'));
  const back = await decryptMemo(enc2, 'correct horse'); ok('案件メモを開ける', back.keep[0] === '佐伯真理子' && back.scene === 'hitoku');
  let wrong = ''; try { await decryptMemo(enc2, 'wrong password'); } catch (e) { wrong = e.message; } ok('違うパスワードは失敗する', /パスワード/.test(wrong), wrong);
  let tooShort = ''; try { await encryptMemo(memo, 'short'); } catch (e) { tooShort = e.message; } ok('短いパスワードは拒否', /8文字/.test(tooShort));
  let bad2 = ''; try { await decryptMemo(new Uint8Array(40), 'x'); } catch (e) { bad2 = e.message; } ok('別のファイルは拒否', /案件メモ/.test(bad2));
  for (const t of ['mynumber', 'license', 'passport', 'pension', 'account', 'phone', 'address', 'honseki']) ok('保護の一覧: ' + t, PROTECTED.has(t));
}
console.log(`回帰テスト 合格 ${pass} / 不合格 ${fail}`);
process.exit(fail ? 1 : 0);
