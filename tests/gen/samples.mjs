// 動作確認用のサンプル書類（すべて架空）。1つの事件の書証ひとそろいとして、人物が書類をまたいで出てくる。
// <x t="種類"> は隠す候補の正解。<k> は隠さない語。出力は tests/samples_raw/ へ（make_samples.py が仕上げる）。
import puppeteer from 'puppeteer-core';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '..', 'samples_raw');
const x = (t, s) => `<x t="${t}">${s}</x>`; const k = (s) => `<k>${s}</k>`;
const seal = (s, cls = '') => `<x t="seal" class="seal ${cls}">${[...s].map((c) => `<i>${c}</i>`).join('')}</x>`;
const mihon = `<div class="mihon">見本（架空の書類）</div>`;
// ===== 事件の登場人物（すべて架空。番号類は 09-1234-5678 や 1234… のように一目で見本と分かる値、メールは example.jp、町名と金融機関は架空、SNS は sample_ で始まる ID） =====
const P = {
  mari: { n: '佐伯 真理子', f: '佐伯真理子', sei: '佐伯', mei: '真理子', kana: 'サエキ マリコ', birth: '昭和55年7月18日', birthK: '昭和五十五年七月十八日', my: '123456789012', tel: '09-1234-5678', telK: '〇九ー一二三四ー五六七八', mail: 'mari.saeki72@example.jp' },
  koichi: { n: '佐伯 浩一', f: '佐伯浩一', sei: '佐伯', mei: '浩一', kana: 'サエキ コウイチ', birth: '昭和52年2月3日', birthK: '昭和五十二年二月三日', my: '111122224444', tel: '09-8765-4321' },
  yuto: { n: '佐伯 悠斗', f: '佐伯悠斗', mei: '悠斗', birth: '平成28年5月9日', my: '222233334444' },
  rin: { n: '佐伯 凛', f: '佐伯凛', mei: '凛', birth: '令和2年11月24日', my: '333344445555' },
  lawyer: { f: '黒田恭介', sp: '黒田 恭介' }, doctor: { f: '南条典子', sp: '南条 典子' }, hoshonin: { f: '三上隆夫', sp: '三上 隆夫', birth: '昭和24年10月30日' }, teacher: { sei: '吉岡' }, friend: { f: '柴田由香', sei: '柴田' },
};
const ADDR = { now: '神奈川県横浜市港北区桜樹台三丁目14番6号 メゾン桜樹台203号室', nowH: '神奈川県横浜市港北区桜樹台3-14-6 メゾン桜樹台203号室', nowK: '神奈川県横浜市港北区桜樹台三丁目十四番六号', zip: '223-0099', hide: '東京都大田区汐見ヶ丘一丁目7番2号', hideShort: '大田区汐見ヶ丘一丁目7番2号', hideK: '東京都大田区汐見ヶ丘一丁目七番二号', hideZip: '144-0098', honseki: '静岡県静岡市葵区鷹匠野四丁目二十番地', jikka: '長野県松本市浅間里二丁目5番11号', firm: '東京都千代田区錦町河岸二丁目8番3号 河岸ビル5階', firmZip: '101-0099', hos: '横浜市港北区桜樹台一丁目2番3号', corpAddr: '神奈川県川崎市高津区新梶ヶ谷四丁目9番1号', landlordAddr: '神奈川県横浜市港北区桜樹台二丁目1番1号' };
const WORK = { mari: '株式会社ソレイユ物流', koichi: '東都テクノ工業株式会社' };
const SCHOOL = { yuto: '横浜市立桜樹台小学校', rin: 'さくらんぼ第二保育園' };
const BANK = { b: 'かもめ中央銀行', br: '桜樹台支店', acct: '1234567', b2: 'しおさい信用金庫', br2: '川崎北支店', acct2: '7654321' };
const CAR = '横浜 300 あ 00-00';
const CSS = `
*{box-sizing:border-box}html,body{margin:0;background:#fff;color:#16161a}
.page{width:794px;height:1123px;padding:64px 70px;position:relative;overflow:hidden;page-break-after:always;font-size:14.5px;line-height:1.72}
.page:last-child{page-break-after:auto}
.min{font-family:'MS Mincho','Yu Mincho',serif}.yu{font-family:'Yu Mincho','MS Mincho',serif}.got{font-family:'Yu Gothic','Meiryo',sans-serif}.ms{font-family:'MS Gothic','Meiryo',monospace}.biz{font-family:'BIZ UDPGothic','Meiryo',sans-serif}
h1{text-align:center;font-weight:600;font-size:23px;letter-spacing:.35em;margin:6px 0 22px}h2{font-size:15px;font-weight:600;margin:16px 0 4px}
table{border-collapse:collapse;width:100%;margin:8px 0}td,th{border:1px solid #333;padding:4px 7px;font-weight:normal;text-align:left;vertical-align:middle}th{background:#f0f0ee}
.r{text-align:right}.c{text-align:center}.right{text-align:right}.sm{font-size:12px;line-height:1.5}.xs{font-size:10.5px;line-height:1.4}.nb td,.nb th{border:0}.mt{margin-top:18px}
.mihon{position:absolute;left:0;right:0;bottom:12px;text-align:center;font:9.5px 'Meiryo',sans-serif;color:#888}
.seal{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;width:44px;height:44px;border:2.4px solid #c9201a;border-radius:50%;color:#c9201a;font-size:13px;line-height:1;font-family:'MS Mincho',serif;vertical-align:middle;margin-left:4px;font-weight:bold;opacity:.88}
.seal i{font-style:normal}.seal.sq{border-radius:3px;width:62px;height:62px;display:inline-grid;grid-template-columns:1fr 1fr;place-items:center;font-size:17px;position:absolute;right:66px;top:-20px}
.tate{writing-mode:vertical-rl;text-orientation:upright;font-size:17px;line-height:2.15;height:990px;letter-spacing:.06em}
.chiмon{}
.jimon{background-image:repeating-linear-gradient(45deg,rgba(90,110,160,.06) 0 2px,transparent 2px 7px),repeating-linear-gradient(-45deg,rgba(90,110,160,.06) 0 2px,transparent 2px 7px)}
.tsu{background:#fbfaf3}.tsu table td,.tsu table th{border-color:#7f93a8}.tsu th{background:#e8eef2;color:#253a4e}
.line{background:#8ea6c6;font-family:'Yu Gothic','Meiryo',sans-serif;padding:0}.line .bar{background:#22303f;color:#fff;padding:20px 24px;font-size:21px}.line .msgs{padding:14px 22px}
.b{display:block;max-width:540px;width:fit-content;padding:9px 14px;border-radius:15px;margin:8px 0;font-size:15.5px;line-height:1.5;background:#fff}.b.me{background:#7fdc5a;margin-left:auto}.who{font-size:12px;color:#f5f7fb;margin-top:10px}.t{font-size:10.5px;color:#eef;margin:0 6px}.day{text-align:center;color:#fff;font-size:12px;margin:10px}
.card{border:1.5px solid #333;border-radius:9px;padding:12px 16px;position:relative;margin:0 0 20px;font-size:14px;line-height:1.75}.ph{position:absolute;right:14px;top:14px;width:92px;height:116px;background:linear-gradient(#b9c8d6,#7d90a4);border:1px solid #555}
.sign{font-family:'HGSeikaishotaiPRO','HGS行書体','HG行書体','Yu Mincho',serif;font-size:21px}
`;
const docs = {
  a01_juminhyo: { title: '甲第1号証_住民票の写し（スキャン）', html: `<div class="page min jimon"><h1>住民票の写し</h1>
<table class="sm"><tr><th style="width:80px">住所</th><td colspan="3">${x('address', ADDR.now)}</td></tr>
<tr><th>世帯主</th><td colspan="3">${x('name', P.koichi.n)}</td></tr></table>
<table class="sm"><tr><th style="width:80px">氏名</th><td>${x('name', P.koichi.n)}</td><th>生年月日</th><td>${x('birth', P.koichi.birth)}</td><th>性別</th><td>男</td></tr><tr><th>続柄</th><td>世帯主</td><th>個人番号</th><td colspan="3">${x('mynumber', P.koichi.my)}</td></tr>
<tr><th>本籍</th><td colspan="5">${x('honseki', ADDR.honseki)}</td></tr><tr><th>筆頭者</th><td colspan="5">${x('name', P.koichi.n)}</td></tr><tr><th>住民票コード</th><td colspan="5">${x('jukicode', '12345678901')}</td></tr></table>
<table class="sm"><tr><th style="width:80px">氏名</th><td>${x('name', P.mari.n)}</td><th>生年月日</th><td>${x('birth', P.mari.birth)}</td><th>性別</th><td>女</td></tr><tr><th>続柄</th><td>妻</td><th>個人番号</th><td colspan="3">${x('mynumber', P.mari.my)}</td></tr><tr><th>住民票コード</th><td colspan="5">${x('jukicode', '10987654321')}</td></tr></table>
<table class="sm"><tr><th style="width:80px">氏名</th><td>${x('name', P.yuto.n)}</td><th>生年月日</th><td>${x('birth', P.yuto.birth)}</td><th>性別</th><td>男</td></tr><tr><th>続柄</th><td>子</td><th>個人番号</th><td colspan="3">${x('mynumber', P.yuto.my)}</td></tr></table>
<table class="sm"><tr><th style="width:80px">氏名</th><td>${x('name', P.rin.n)}</td><th>生年月日</th><td>${x('birth', P.rin.birth)}</td><th>性別</th><td>女</td></tr><tr><th>続柄</th><td>子</td><th>個人番号</th><td colspan="3">${x('mynumber', P.rin.my)}</td></tr></table>
<p class="mt">この写しは、世帯全員の住民票の原本と相違ないことを証明する。</p><p>${k('令和6年9月2日')}</p><p class="right">${k('○○市長')}　○○ ○○ ${seal('市長印', 'x')}</p>${mihon}</div>` },
  a02_kyuyo: { title: '甲第2号証_給与明細（文字データ入りPDF）', html: [['2024年6月分', '2024年6月25日', '298,000', '24,600', '11,850', '334,450', '15,120', '27,450', '2,007', '8,210', '16,300', '265,363'], ['2024年7月分', '2024年7月25日', '298,000', '18,300', '11,850', '328,150', '15,120', '27,450', '1,969', '7,900', '16,300', '259,411']].map((m) => `<div class="page got"><h1 style="font-size:21px">給与明細書</h1><div class="right">${k(m[0])}　支給日 ${k(m[1])}</div>
<table><tr><th style="width:90px">所属</th><td>第二物流課</td><th style="width:90px">社員番号</th><td>${x('employee', 'S12345')}</td></tr><tr><th>氏名</th><td colspan="3">${x('name', P.mari.n)} 様</td></tr></table>
<table><tr><th colspan="2">支給</th><th colspan="2">控除</th></tr><tr><td>基本給</td><td class="r">${k(m[2])}</td><td>健康保険料</td><td class="r">${k(m[6])}</td></tr><tr><td>時間外手当</td><td class="r">${k(m[3])}</td><td>厚生年金保険料</td><td class="r">${k(m[7])}</td></tr><tr><td>通勤手当</td><td class="r">${k(m[4])}</td><td>雇用保険料</td><td class="r">${k(m[8])}</td></tr><tr><td></td><td></td><td>所得税</td><td class="r">${k(m[9])}</td></tr><tr><td></td><td></td><td>住民税</td><td class="r">${k(m[10])}</td></tr><tr><th>支給合計</th><td class="r">${k(m[5])}</td><th>差引支給額</th><td class="r">${k(m[11])}</td></tr></table>
<table><tr><th style="width:90px">振込先</th><td>${x('bank', BANK.b)} ${x('bank', BANK.br)} 普通 ${x('account', BANK.acct)}</td></tr></table>
<p class="mt right sm">${x('workplace', WORK.mari)}　人事総務部<br>${x('corpaddr', ADDR.corpAddr)}　TEL ${x('phone', '044-000-1111')}</p>${mihon}</div>`).join('') },
  a03_gensen: { title: '甲第3号証_源泉徴収票（スキャン）', html: `<div class="page got sm"><h1 style="font-size:18px;letter-spacing:.1em">令和5年分　給与所得の源泉徴収票</h1>
<table class="sm"><tr><th style="width:90px" rowspan="2">支払を受ける者</th><td style="width:58%">住所又は居所<br>${x('address', ADDR.nowH)}</td><td>（受給者番号）${k('0417')}<br>（個人番号）${x('mynumber', P.koichi.my)}</td></tr><tr><td>（フリガナ）${x('kana', P.koichi.kana)}<br><span style="font-size:15px">${x('name', P.koichi.n)}</span></td><td>生年月日 ${x('birth', P.koichi.birth)}</td></tr></table>
<table class="sm"><tr><th>種別</th><th>支払金額</th><th>給与所得控除後の金額</th><th>所得控除の額の合計額</th><th>源泉徴収税額</th></tr><tr><td>給与・賞与</td><td class="r">${k('6,842,000')}</td><td class="r">${k('5,012,800')}</td><td class="r">${k('1,624,300')}</td><td class="r">${k('172,400')}</td></tr></table>
<table class="sm"><tr><th>控除対象配偶者</th><td>氏名 ${x('name', P.mari.f)}</td><td>個人番号 ${x('mynumber', P.mari.my)}</td></tr><tr><th>16歳未満の扶養親族</th><td>氏名 ${x('name', P.yuto.f)}</td><td>氏名 ${x('name', P.rin.f)}</td></tr></table>
<table class="sm"><tr><th style="width:60px" rowspan="3">支払者</th><td>住所又は所在地 ${x('corpaddr', '東京都品川区東雲海岸二丁目4番8号')}</td></tr><tr><td>氏名又は名称 ${x('workplace', WORK.koichi)}</td></tr><tr><td>電話 ${x('phone', '03-0000-2222')}　法人番号 ${k('1234567890123')}</td></tr></table>
<p class="xs mt">整理番号 ${k('250901234567')}　税務署提出用ではありません</p>${mihon}</div>` },
  a04_tsucho: { title: '甲第4号証_預金通帳（スマホ撮影）', html: `<div class="page biz tsu"><h1 style="font-size:20px;color:#253a4e">普通預金通帳</h1><div class="c sm">${x('bank', BANK.b)}　${x('bank', BANK.br)}</div>
<table><tr><th style="width:90px">店番</th><td>${k('218')}</td><th style="width:90px">口座番号</th><td>${x('account', BANK.acct)}</td></tr><tr><th>お名前</th><td colspan="3">${x('name', P.mari.n)} 様</td></tr></table>
<table class="sm mt"><tr><th style="width:92px">年月日</th><th>お取引内容</th><th style="width:96px">お支払金額</th><th style="width:96px">お預り金額</th><th style="width:96px">差引残高</th></tr>
${[['06-07-25', `給与 ${x('kana', 'カ）ソレイユブツリュウ')}`, '', '259,411', '612,084'], ['06-07-27', '電気料', '9,642', '', '602,442'], ['06-07-28', `振込 ${x('kana', P.koichi.kana)}`, '', '80,000', '682,442'], ['06-07-31', 'カード ATM', '50,000', '', '632,442'], ['06-08-01', `振替 ${x('kana', 'ミカミ タカオ')}`, '30,000', '', '602,442'], ['06-08-05', '水道料', '5,180', '', '597,262'], ['06-08-10', 'カード ATM', '40,000', '', '557,262'], ['06-08-20', `振込 ${x('kana', 'シバタ ユカ')}`, '', '15,000', '572,262'], ['06-08-26', `給与 ${x('kana', 'カ）ソレイユブツリュウ')}`, '', '261,330', '833,592']].map((r) => `<tr><td>${k(r[0])}</td><td>${r[1]}</td><td class="r">${r[2]}</td><td class="r">${r[3]}</td><td class="r">${r[4]}</td></tr>`).join('')}</table>${mihon}</div>` },
  a05_line: { title: '甲第5号証_LINEトーク画面', html: `<div class="page line"><div class="bar">${x('name', P.koichi.mei)}</div><div class="msgs"><div class="day">${k('2024年8月12日')}（月）</div>
<div class="who">${x('name', P.koichi.mei)}</div><div class="b">今どこにいるんだよ。電話に出ろ</div>
<div class="b me">子どもたちと実家にいます。しばらく戻りません</div><div class="who">${x('name', P.koichi.mei)}</div><div class="b">${x('address', ADDR.jikka)}だろ。これから行くからな</div>
<div class="b me">やめてください。${x('name', P.yuto.mei)}が怖がっています</div><div class="who">${x('name', P.koichi.mei)}</div><div class="b">${x('school', SCHOOL.yuto)}にも行くぞ。担任の${x('name', P.teacher.sei)}先生に話す</div>
<div class="b me">連絡は弁護士の${x('proname', P.lawyer.f)}先生にお願いします。${x('phone', '03-0000-1111')}です</div><div class="who">${x('name', P.koichi.mei)}</div><div class="b">会社にも電話するからな。${x('workplace', WORK.mari)}だろ</div>
<div class="b me">これ以上続くなら警察に相談します</div><div class="who">${x('name', P.koichi.mei)}</div><div class="b">新しい番号は ${x('phone', P.koichi.tel)} だ。かけてこい</div><div class="b">インスタも見てるぞ @${x('snsid', 'sample_mari_000')}</div><div class="b me">生活費の${k('8万円')}だけは振り込んでください</div></div></div>` },
  a06_tsuchi: { title: '甲第6号証_通知書（縦書き・スキャン）', html: `<div class="page ms" style="padding:66px 64px"><div class="tate min">
<div>　　　　　通　知　書</div><div>　　　　　　　　　　　　　　　　　　${k('令和六年八月二十日')}</div>
<div>${x('address', ADDR.nowK)}</div><div>　被通知人　${x('name', P.koichi.f)}　殿</div>
<div>${x('address', ADDR.firm.replace('二丁目8番3号', '二丁目八番三号').replace('5階', '五階'))}</div><div>　通知人代理人弁護士　${x('proname', P.lawyer.f)}</div>
<div>冠省　当職は、貴殿の配偶者である${x('name', P.mari.f)}氏（以下「通知人」といいます。）から依頼を受けた代理人として、次のとおり通知いたします。</div>
<div>一　通知人は、貴殿からの度重なる連絡により心身の不調をきたしており、今後の連絡は全て当職宛てにされるよう求めます。</div>
<div>二　通知人の携帯電話（番号${x('phone', P.mari.telK)}）及び勤務先への直接の連絡は、一切お控えください。</div>
<div>三　長男${x('name', P.yuto.mei)}（${x('birth', '平成二十八年五月九日')}生）及び長女${x('name', P.rin.mei)}の養育費として、毎月末日限り${k('金八万円')}を下記の口座へ支払うよう求めます。</div>
<div>　　${x('bank', BANK.b)}　${x('bank', BANK.br)}　普通預金　口座番号${x('account', '一二三四五六七')}</div><div>　　口座名義　${x('name', P.mari.f)}</div>
<div>四　本書到達後十日以内に、当職宛てに書面でご回答ください。ご回答なき場合は、${k('横浜家庭裁判所')}への調停の申立てを含め、法的手続をとる予定です。</div><div>　　　　　　　　　　　　　　　　　　　　　　　　　草々</div></div>${mihon}</div>` },
  a07_chinjutsu: { title: '甲第7号証_陳述書（文字データ入りPDF）', html: `<div class="page yu"><h1>陳　述　書</h1><div class="right">${k('令和6年（家イ）第5678号')}　夫婦関係調整調停事件</div><div>${k('横浜家庭裁判所')}　御中</div><div class="right">${k('令和6年10月4日')}</div><div class="right" style="position:relative">申立人　<span class="sign">${x('name', P.mari.f)}</span> ${seal('佐伯')}</div>
<h2>第1　私の経歴と家族について</h2><p>1　私は、${x('birth', P.mari.birth)}生まれの${x('age', '44')}歳です。平成27年4月に相手方${x('name', P.koichi.f)}と結婚し、長男${x('name', P.yuto.mei)}（8歳）と長女${x('name', P.rin.mei)}（3歳）をもうけました。</p>
<p>2　私は現在、${x('workplace', WORK.mari)}に勤務しています。${x('name', P.yuto.mei)}は${x('school', SCHOOL.yuto)}の3年生で、${x('name', P.rin.mei)}は${x('school', SCHOOL.rin)}に通っています。</p>
<h2>第2　別居に至る経緯</h2><p>3　相手方は、令和4年ごろから仕事の不満を理由に私を怒鳴るようになりました。令和6年6月15日には、自宅の${x('address', ADDR.nowH)}で、私の腕をつかんで壁に押しつけました。そのときの診断書を甲第8号証として提出します。</p>
<p>4　私は令和6年8月11日、子どもたちと一緒に実家（${x('address', ADDR.jikka)}）に避難しました。実家の電話番号は${x('phone', '0263-00-1111')}です。その後、友人の${x('name', P.friend.f)}さんの助けを借りて、現在は${x('address', ADDR.hideShort)}で生活しています。</p></div>
<div class="page yu"><p>5　相手方は、別居後も私の携帯電話（${x('phone', P.mari.tel)}）に1日に何十回も電話をかけてきました。職場にも電話があり、上司の${x('name', '井上')}課長に迷惑をかけました。甲第5号証はそのときのやりとりです。</p>
<p>6　相手方は勤務先の${x('workplace', WORK.koichi)}から毎月の給与を得ていますが、生活費は令和6年8月から一度も支払われていません。私のメールアドレス（${x('email', P.mari.mail)}）にも、「${x('name', P.yuto.mei)}を連れて帰ってこい」というメールが届きました。</p>
<h2>第3　今後について</h2><p>7　私は離婚を希望します。親権は私が持ち、養育費として毎月${k('金8万円')}の支払いを求めます。住所は相手方に知られたくありません。車（${x('car', CAR)}）も相手方に見つからないよう、知人の駐車場に置いています。</p>
<p>8　財産分与については、${x('bank', BANK.b2)}${x('bank', BANK.br2)}の相手方名義の口座（口座番号${x('account', BANK.acct2)}）に約${k('金320万円')}の預金があると聞いています。</p><p class="mt">以上のとおり、相違ありません。</p>${mihon}</div>` },
  a08_shindan: { title: '甲第8号証_診断書（カラースキャン）', html: `<div class="page min"><h1>診　断　書</h1>
<table><tr><th style="width:110px">氏名</th><td>${x('name', P.mari.n)}</td><th style="width:50px">性別</th><td style="width:60px">女</td></tr><tr><th>生年月日</th><td colspan="3">${x('birth', P.mari.birth)}（${x('age', '43')}歳）</td></tr><tr><th>住所</th><td colspan="3">${x('address', ADDR.nowH)}</td></tr><tr><th>病名</th><td colspan="3">左上腕打撲傷、適応障害</td></tr></table>
<p class="mt">上記の者は、${k('令和6年6月15日')}、夫から腕をつかまれ壁に押しつけられたとして同月16日に当院を受診した。左上腕に約5cmの皮下出血を認める。今後${k('2週間')}の加療を要する見込みである。</p>
<p>カルテ番号：${x('mrn', '00123456')}　保険証記号番号：記号 ${x('insurance', '1234')} 番号 ${x('insurance', '567')}</p><p>緊急連絡先：友人 ${x('name', P.friend.f)}（${x('phone', '09-2222-3333')}）</p>
<p class="mt">上記のとおり診断する。</p><p class="right">${k('令和6年6月16日')}</p><div class="right" style="position:relative;margin-top:26px">医療法人社団 ${k('若葉会 桜樹台クリニック')}<br>${x('corpaddr', ADDR.hos)}<br>医師　${x('proname', P.doctor.sp)} ${seal('南条')}</div>${mihon}</div>` },
  a09_chintai: { title: '甲第9号証_賃貸借契約書（スマホ撮影PDF）', html: `<div class="page yu"><h1 style="font-size:21px">建物賃貸借契約書</h1><p>賃貸人 ${k('有限会社あおば不動産')}（以下「甲」という。）と賃借人 ${x('name', P.koichi.n)}（以下「乙」という。）は、次のとおり建物賃貸借契約を締結した。</p>
<p>第1条（目的物）甲は乙に対し、次の建物を賃貸する。<br>　所在 ${x('address', ADDR.nowH)}<br>　構造 鉄筋コンクリート造3階建　専有面積 58.32㎡</p><p>第2条（期間）${k('令和4年4月1日')}から${k('令和6年3月31日')}までの2年間とする。</p><p>第3条（賃料）賃料は月額${k('金98,000円')}、共益費は${k('金5,000円')}とし、毎月27日までに翌月分を甲の指定する口座に振り込む。</p><p>第4条（敷金）乙は敷金として${k('金196,000円')}を甲に預ける。</p><p>第5条（禁止事項）乙は、甲の書面による承諾なく、賃借権の譲渡又は転貸をしてはならない。</p><p>第6条（解除）乙が賃料を3か月以上滞納したときは、甲は催告なく本契約を解除できる。</p><p>第7条（準拠）本契約に定めのない事項は、${k('借地借家法')}その他の法令に従う。</p><p>第8条（駐車場）乙は、車両 ${x('car', CAR)} に限り、敷地内駐車場を使用できる。</p>${mihon}</div>
<div class="page yu"><p>本契約の成立を証するため本書2通を作成し、各自記名押印のうえ1通を保有する。</p><p class="right">${k('令和4年3月20日')}</p>
<table><tr><th style="width:120px">甲（賃貸人）</th><td style="position:relative">住所 ${x('corpaddr', ADDR.landlordAddr)}<br>${k('有限会社あおば不動産')}　代表取締役 ${x('name', '岩崎 誠司')}<br>電話 ${x('phone', '045-000-1111')}</td></tr>
<tr><th>乙（賃借人）</th><td>住所 ${x('address', ADDR.jikka)}<br>氏名 <span class="sign">${x('name', P.koichi.f)}</span> ${seal('佐伯')}<br>生年月日 ${x('birth', P.koichi.birth)}　電話 ${x('phone', P.koichi.tel)}<br>勤務先 ${x('workplace', WORK.koichi)}</td></tr>
<tr><th>連帯保証人</th><td>住所 ${x('address', '長野県松本市浅間里二丁目5番11号')}<br>氏名 <span class="sign">${x('name', P.hoshonin.f)}</span> ${seal('三上')}<br>生年月日 ${x('birth', P.hoshonin.birth)}　続柄 乙の義父</td></tr></table>${mihon}</div>` },
  a10_id: { title: '甲第10号証_身分証のコピー', html: `<div class="page got" style="font-size:13.5px">
<div class="card" style="height:252px"><b>運転免許証（写し）</b><div class="ph"></div><br>氏名 ${x('name', P.mari.f)}　${x('birth', P.mari.birth)}生<br>住所 ${x('address', ADDR.nowH)}<br>交付 ${k('令和4年8月3日')}　${k('98765')}<br>${k('令和9年8月18日')}まで有効<br>番号 第${x('license', '123412341234')}号<br>${k('神奈川県公安委員会')}</div>
<div class="card" style="height:186px"><b>健康保険 被保険者証</b><br>記号 ${x('insurance', '1234')}　番号 ${x('insurance', '567')}<br>氏名 ${x('name', P.mari.f)}　生年月日 ${x('birth', P.mari.birth)}<br>保険者番号 ${x('insurance', '12345678')}<br>事業所名称 ${x('workplace', WORK.mari)}</div>
<div class="card" style="height:150px"><b>PASSPORT / 旅券</b><br>Type P　Passport No. ${x('passport', 'XX1234567')}<br>Surname / 姓 ${x('kana', 'SAEKI')}　Given name / 名 ${x('kana', 'MARIKO')}</div>
<div class="card" style="height:120px"><b>基礎年金番号通知書</b><br>基礎年金番号 ${x('pension', '1234-567890')}<br>氏名 ${x('name', P.mari.f)}</div>${mihon}</div>` },
  a11_moushitate: { title: '参考_仮処分命令申立書（スマホ撮影PDF）', html: `<div class="page min"><h1>仮処分命令申立書</h1><div class="right">${k('令和6年11月5日')}</div><div>${k('東京地方裁判所民事第9部')}　御中</div><div class="right">債権者代理人弁護士　${x('proname', P.lawyer.f)}　${seal('黒田')}</div>
<p class="mt">当事者の表示　別紙当事者目録記載のとおり</p><p>申立ての趣旨　債務者は、別紙物件目録記載の不動産について、譲渡、質権、抵当権又は賃借権の設定その他一切の処分をしてはならない。</p><p>被保全権利　売買代金返還請求権　${k('金850万円')}</p>
<h1 style="font-size:17px;margin-top:34px;letter-spacing:.2em">当事者目録</h1>
<p>〒${x('postal', ADDR.hideZip)}<br>${x('address', ADDR.hide)}<br>債権者　${x('name', P.mari.f)}</p>
<p>〒${x('postal', ADDR.firmZip)}<br>${x('address', ADDR.firm)}<br>${k('黒田法律事務所')}（送達場所）<br>電　話　${x('phone', '03-0000-1111')}<br>ＦＡＸ　${x('phone', '03-0000-1112')}<br>債権者代理人弁護士　${x('proname', P.lawyer.f)}</p>
<p>〒${x('postal', ADDR.zip)}<br>${x('address', ADDR.nowH)}<br>債務者　${x('name', P.koichi.f)}</p>${mihon}</div>
<div class="page min"><h1 style="font-size:18px">申立ての理由</h1><p>第1　当事者　債権者と債務者は夫婦であり、現在別居中である。</p><p>第2　被保全権利　債権者は、${k('令和3年5月10日')}、債務者との間で別紙物件目録記載の不動産の売買契約を締結し、代金${k('金850万円')}を${x('bank', BANK.b2)}${x('bank', BANK.br2)}の債務者名義の口座（口座番号${x('account', BANK.acct2)}）に振り込んだ。</p>
<p>第3　保全の必要性　債務者は${x('workplace', WORK.koichi)}を退職する予定であり、知人の${x('name', '柏原 剛')}に不動産を譲渡しようとしている。債務者の携帯電話（${x('phone', P.koichi.tel)}）への連絡にも応じない。</p>
<p>疎明方法　甲第1号証ないし甲第10号証</p><p class="right">以上</p>${mihon}</div>` },

  // ===== 実際の証拠書面に近い複雑な文章 =====
  a12_junbi: { title: '準備書面（第2回・長文・文字データ入り）', html: `<div class="page yu"><div class="right">${k('令和6年（家ホ）第1234号')} 離婚等請求事件</div><div class="right">原告 ${x('name', P.mari.f)}　被告 ${x('name', P.koichi.f)}</div><h1 style="margin-top:18px">原告第2準備書面</h1><div class="right">${k('令和7年2月14日')}</div><div>${k('横浜家庭裁判所第3民事部')} 合議係　御中</div><div class="right">原告訴訟代理人弁護士　${x('proname', P.lawyer.f)}</div>
<p>原告は、被告の${k('令和6年12月20日')}付け答弁書に対し、次のとおり反論する。なお、略称は従前の例による。</p>
<h2>第1　婚姻関係の破綻について</h2>
<p>1　原告（${x('birth', 'S55.7.18')}生、当時${x('age', '38')}歳。旧姓${x('name', '三上')}）と被告（${x('birth', '1977年2月3日')}生）は、${k('平成27年4月18日')}に婚姻の届出をした夫婦である（甲1）。両名の間には、長男${x('name', P.yuto.mei)}（当時2歳）及び長女${x('name', P.rin.mei)}がある。婚姻後、両名は被告の肩書地である${x('address', '横浜市港北区桜樹台3丁目14番地6')}で同居していたが、原告は${k('令和6年8月11日')}、子らを連れて同所を出た。</p>
<p>2　被告は、答弁書第2の3において「原告が一方的に家を出た」と主張する。しかし、同月10日の夜、被告は原告の母である${x('name', '三上ふみ子')}（以下「ふみ子」という。）の面前で原告を怒鳴りつけ、ふみ子が${k('港北警察署')}に通報している（甲12）。${x('name', 'ふみ子')}の陳述によれば、臨場した警察官は被告に対し厳重に注意したという。<sup>1)</sup></p>
<p>3　また、被告の勤務先である${x('workplace', WORK.koichi)}（以下「東都テクノ」という。）の同僚${x('name', '長谷部 剛')}は、被告が社内で「妻には金を渡していない」と話していたと述べている（甲13）。同人は同社${k('川崎事業所')}に勤務し、被告の直属の部下である。</p>
<h2>第2　暴力の事実について</h2>
<p>4　被告は暴行の事実を否認する。しかし、${k('令和6年6月15日')}午後8時30分ごろの暴行については、翌日の${k('桜樹台クリニック')}の診断書（甲8）のほか、隣室に住む${x('name', '渡邊 美穂')}（${x('address', '桜樹台3丁目14番6号')} 204号室）が怒鳴り声と物音を聞いている（甲14）。担当の${x('proname', P.doctor.f)}医師も、受傷の態様は原告の説明と矛盾しないと述べる。</p>
<p class="xs" style="border-top:1px solid #888;margin-top:14px;padding-top:4px">1) 通報記録は${k('神奈川県警察本部')}へ弁護士会照会中である（照会番号${k('第2024-887号')}）。通報者の連絡先 ${x('phone', '(0263) 00-1111')}。</p>${mihon}</div>
<div class="page yu"><p>5　なお、被告は、原告が${k('中村区役所')}や${k('山田町')}の支援窓口に虚偽の相談をしたと主張するが、そのような事実はない。原告が相談したのは${x('address', '大田区')}の女性相談窓口であり、担当は${x('name', '小笠原')}相談員である。被告の主張は、${k('東京都知事')}の所管する制度に対する誤解に基づくものと思われる。</p>
<h2>第3　婚姻費用及び養育費について</h2>
<p>6　被告の令和5年の給与収入は${k('金684万2000円')}である（甲3）。これに対し原告は、${x('workplace', 'ソレイユ物流')}（甲2。以下「ソレイユ」という。）から年収約${k('390万円')}を得ているにすぎない。${k('東京・大阪養育費等研究会')}の算定表によれば、婚姻費用は月額${k('12万円')}から${k('14万円')}の範囲となる。</p>
<p>7　被告は、原告名義の${x('bank', 'うみねこ銀行')}の口座（記号${x('account', '12340')}　番号${x('account', '12345678')}）に${k('金230万円')}があると主張するが、これは原告の母${x('name', 'ふみ子')}から預かった金員である。また、クレジットカード（番号${x('card', '4111 1111 1111 1111')}）の利用明細を見ても、原告に浪費の事実はない（甲15）。</p>
<h2>第4　親権について</h2>
<p>8　長男は${x('school', SCHOOL.yuto)}（以下「同校」という。）に通っていたが、別居後は転校を余儀なくされ、現在は${x('school', '汐見ヶ丘小学校')}に在籍している。同校の担任である${x('name', '吉岡')}教諭は、転校後の長男の様子について落ち着いていると述べている。長女は${x('school', SCHOOL.rin)}から${x('school', '汐見ヶ丘保育園')}へ転園した。監護の継続性からみて、親権者は原告と定めるのが相当である。</p>
<p>9　最高裁判所${k('昭和56年7月16日')}第一小法廷判決及び${k('東京高等裁判所平成29年1月26日')}判決の趣旨に照らしても、破綻について主たる責任のある被告からの主張は失当である（${k('民法第770条第1項第5号')}）。</p>
<h2>第5　求釈明</h2>
<p>10　被告は、原告の現住所を探知する目的で、興信所（${k('株式会社アイリス調査')}）に調査を依頼した事実の有無を明らかにされたい。原告の現住所（${x('address', ADDR.hide)}）は秘匿の対象であり、本書面の相手方送付分では黒塗りとする。連絡は${x('email', 'kuroda-law@example.jp')}又は${x('phone', '０３－００００－１１１１')}（当職）宛てに願いたい。</p><p class="right">以上</p>${mihon}</div>` },
  a13_isan: { title: '遺産分割協議書と相続関係図（スキャン）', html: `<div class="page min"><h1>遺産分割協議書</h1>
<p>被相続人 ${x('name', '三上 隆夫')}（${x('birth', '昭和24年10月30日')}生、${k('令和5年12月3日')}死亡。本籍 ${x('honseki', '長野県松本市浅間里二丁目100番地')}、最後の住所 ${x('address', ADDR.jikka)}）の遺産について、相続人全員で協議した結果、次のとおり分割する。</p>
<p>第1条　次の不動産は、妻 ${x('name', '三上ふみ子')} が取得する。</p>
<table class="sm"><tr><th>所在</th><td>${x('address', '松本市浅間里二丁目')}</td><th>地番</th><td>${x('address', '100番5')}</td></tr><tr><th>地目</th><td>宅地</td><th>地積</th><td>${k('214.87㎡')}</td></tr><tr><th>家屋番号</th><td>${x('address', '100番5の2')}</td><th>床面積</th><td>${k('98.23㎡')}</td></tr></table>
<p>第2条　次の預金は、長女 ${x('name', P.mari.f)} が取得する。</p><table class="sm"><tr><th>金融機関</th><th>支店</th><th>種別</th><th>口座番号</th><th>残高</th></tr><tr><td>${x('bank', 'あずさ信用組合')}</td><td>${x('bank', '浅間支店')}</td><td>普通</td><td>${x('account', '1111111')}</td><td class="r">${k('4,235,118')}</td></tr><tr><td>${x('bank', BANK.b)}</td><td>${x('bank', '松本支店')}</td><td>定期</td><td>${x('account', '0012345')}</td><td class="r">${k('2,000,000')}</td></tr></table>
<p>第3条　次の株式は、長男 ${x('name', '三上 健司')} が取得する。${k('株式会社信州精機')} 普通株式 ${k('1,200株')}（証券口座 ${x('bank', 'さざなみ証券')} ${x('account', '123-4567890')}）</p>
<p>第4条　本協議書に定めのない遺産が判明したときは、${x('name', 'ふみ子')}が取得する。</p>
<p class="mt">以上の協議を証するため、本書3通を作成し、各自署名押印のうえ各1通を保有する。　${k('令和6年3月15日')}</p>
<table class="sm"><tr><th style="width:70px">住所</th><td>${x('address', ADDR.jikka)}</td><th style="width:40px">氏名</th><td><span class="sign">${x('name', '三上ふみ子')}</span> ${seal('三上')}</td></tr><tr><th>住所</th><td>${x('address', ADDR.nowH)}</td><th>氏名</th><td><span class="sign">${x('name', P.mari.f)}</span> ${seal('佐伯')}</td></tr><tr><th>住所</th><td>${x('address', '埼玉県川越市若葉台東五丁目2番地9')}</td><th>氏名</th><td><span class="sign">${x('name', '三上 健司')}</span> ${seal('三上')}</td></tr></table>${mihon}</div>
<div class="page min"><h1 style="font-size:19px">相続関係説明図</h1><p class="sm">被相続人 ${x('name', '三上 隆夫')} 相続関係説明図</p>
<table class="sm mt nb"><tr><td style="width:46%;border:1px solid #333;vertical-align:top">本籍 ${x('honseki', '長野県松本市浅間里二丁目100番地')}<br>最後の住所 ${x('address', ADDR.jikka)}<br>出生 ${x('birth', '昭和24年10月30日')}<br>死亡 ${k('令和5年12月3日')}<br>（被相続人）${x('name', '三上 隆夫')}</td><td class="c" style="width:8%">＝</td><td style="border:1px solid #333;vertical-align:top">住所 ${x('address', ADDR.jikka)}<br>出生 ${x('birth', '昭和27年3月21日')}<br>（妻・相続人）${x('name', '三上 ふみ子')}<br>（分割により取得）</td></tr></table>
<p class="c" style="margin:4px 0">｜</p>
<table class="sm nb"><tr><td style="width:48%;border:1px solid #333;vertical-align:top">住所 ${x('address', ADDR.nowH)}<br>出生 ${x('birth', P.mari.birth)}<br>（長女・相続人）${x('name', P.mari.f)}<br>配偶者 ${x('name', P.koichi.f)}</td><td style="width:4%"></td><td style="border:1px solid #333;vertical-align:top">住所 ${x('address', '埼玉県川越市若葉台東五丁目2番地9')}<br>出生 ${x('birth', '昭和57年12月1日')}<br>（長男・相続人）${x('name', '三上 健司')}<br>電話 ${x('phone', '049-000-1111')}</td></tr></table>
<p class="sm mt">上記のとおり相違ありません。　${k('令和6年3月20日')}<br>作成者　住所 ${x('address', '長野県松本市中央緑町一丁目2番3号')}　司法書士 ${x('proname', '宮下 俊夫')} ${seal('宮下')}</p><p class="xs mt">添付書類：戸籍謄本（除籍）、住民票の除票、固定資産評価証明書、印鑑証明書（登録番号 ${x('mrn', '第12345号')}）</p>${mihon}</div>` },
  a14_hanyaku: { title: '録音反訳とメール印刷', html: `<div class="page got" style="font-size:13.5px"><h1 style="font-size:19px">録音反訳書</h1><p class="sm">録音日時：${k('令和6年7月28日')} 午後9時12分〜　場所：自宅リビング　反訳者：${x('name', '藤本 あゆみ')}（${k('株式会社速記サービス横浜')}）<br>話者：真＝${x('name', P.mari.f)}（以下、真）、浩＝${x('name', P.koichi.f)}（以下、浩）</p>
<p>浩：だからさ、何回言えばわかるんだよ。お前の実家の、${x('name', 'ふみ子')}さん、あの人にいちいち言うなって。</p><p>真：言ってないよ。お母さんが心配して電話してきただけ。</p><p>浩：心配？ あのな、${x('name', '柴田')}にも言ったろ。${x('name', '由香')}ちゃん。あいつ、俺の会社の${x('name', '長谷部')}と知り合いなんだよ、知ってた？</p><p>真：……知らなかった。</p>
<p>浩：だから全部こっちに筒抜けなんだよ。で、${x('name', '悠斗')}の学校の件、どうなった。</p><p>真：${x('name', '吉岡')}先生には、えっと、来週話すって言ったけど。</p><p>浩：来週？ お前さ、${x('school', '桜樹台小')}の保護者会も出てないだろ。</p><p>真：パートが${k('8時')}までだから、無理だって……ソレイユの方も休めないし。</p>
<p>浩：知るかよ。……（物音）……おい、その通帳よこせ。</p><p>真：やめて、痛い、離して。</p><p>浩：うるせえな。（約10秒、聞き取り不能）<br>　　暗証番号なんだよ。${k('4桁')}のやつ。</p><p>真：言えない。これ、${x('name', '凛')}の保育料なの。</p><p>浩：じゃあ、お前の親父の、${x('name', '隆夫')}さんに出してもらえよ。金持ってんだろ、${x('address', '松本')}の家売ればいいじゃん。</p>
<p class="xs mt">（以上、録音時間 12分34秒のうち該当部分）</p>${mihon}</div>
<div class="page ms" style="font-size:13px;line-height:1.6"><p>差出人: ${x('name', P.koichi.f)} &lt;${x('email', 'k.saeki1977@example.jp')}&gt;<br>送信日時: ${k('2024年8月15日')}（木）23:41<br>宛先: ${x('email', P.mari.mail)}<br>CC: ${x('email', 'fumiko.mikami@example.jp')}<br>件名: Re: Re: 子どもたちのこと</p><hr>
<p>${x('name', P.mari.mei)}へ</p><p>そっちが弁護士を立てるならこっちも考える。${x('name', '黒田')}とかいう弁護士から手紙が来たけど、俺は認めない。<br>${x('name', '悠斗')}と${x('name', '凛')}に会わせろ。来週の土曜${k('10時')}に${k('横浜駅西口')}に連れてこい。</p>
<p>実家（${x('address', '松本市浅間里2-5-11')}）にいるのは分かってる。お義母さんの携帯 ${x('phone', '09 1111 2222')} にも電話した。<br>会社にも連絡する。${x('workplace', 'ソレイユ物流')}の人事の${x('name', '中西')}さんの直通は ${x('phone', '０４４－０００－３３３３')} だよな。</p><p>あと、お前のFacebook見たぞ。 ${x('snsid', 'https://www.facebook.com/sample.account.000000')}<br>写真の場所もだいたい分かる。インスタは @${x('snsid', 'sample_mari_000')}、LINEのIDも変えただろ（${x('snsid', 'sample_id_000')}）。</p><p>--<br>${x('name', P.koichi.f)}<br>${x('workplace', '東都テクノ工業（株）')} 生産技術部 第一課 主任<br>〒${x('postal', '213-0098')} ${x('corpaddr', '川崎市高津区新梶ヶ谷四丁目9番1号')}<br>TEL ${x('phone', '044-000-2222')}（内線 ${k('2214')}）　社員ID ${x('employee', 'T-123456')}</p>${mihon}</div>` },
};
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 200 / 96 });
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });
const man = [];
for (const [id, d] of Object.entries(docs)) {
  await page.setContent(`<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>${CSS}</style></head><body>${d.html}</body></html>`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const truth = await page.evaluate(() => {
    const pages = [...document.querySelectorAll('.page')];
    const rect = (el) => { const pg = el.closest('.page'), pr = pg.getBoundingClientRect(); const r = el.getBoundingClientRect(); return { page: pages.indexOf(pg) }; };
    return { pages: pages.length, entities: [...document.querySelectorAll('x')].map((el) => ({ type: el.getAttribute('t'), text: el.getAttribute('t') === 'seal' ? '（印影）' + el.textContent : el.textContent, ...rect(el), hand: !!el.closest('.sign') })), keeps: [...document.querySelectorAll('k')].map((el) => ({ text: el.textContent, ...rect(el) })) };
  });
  const dir = path.join(OUT, id); fs.mkdirSync(dir, { recursive: true });
  await page.pdf({ path: path.join(dir, 'digital.pdf'), width: '794px', height: '1123px', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  const els = await page.$$('.page');
  for (let i = 0; i < els.length; i++) await els[i].screenshot({ path: path.join(dir, `p${i + 1}.png`) });
  fs.writeFileSync(path.join(dir, 'truth.json'), JSON.stringify({ id, title: d.title, ...truth }));
  man.push({ id, title: d.title, pages: truth.pages, entities: truth.entities.length });
  console.log(d.title, truth.pages, 'ページ', truth.entities.length, '箇所');
}
fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(man, null, 1));
await browser.close();
