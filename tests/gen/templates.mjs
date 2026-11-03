// 架空の書類の型。<x t="種類">…</x> は隠すべき箇所、<k>…</k> は隠してはいけない箇所。
const x = (t, s) => `<x t="${t}">${s}</x>`;
const k = (s) => `<k>${s}</k>`;
const seal = (name) => `<x t="seal" class="seal">${name}</x>`;
export const CSS = `
*{box-sizing:border-box}body{margin:0;background:#fff;color:#111}
.page{width:794px;height:1123px;padding:70px 72px;position:relative;overflow:hidden;page-break-after:always;font-size:15px;line-height:1.75}
.page:last-child{page-break-after:auto}
.min{font-family:'Yu Mincho','MS Mincho',serif}.got{font-family:'Yu Gothic','Meiryo',sans-serif}.biz{font-family:'BIZ UDPGothic','Meiryo',sans-serif}.ms{font-family:'MS Mincho',serif}
h1{text-align:center;font-size:24px;letter-spacing:.4em;margin:6px 0 26px;font-weight:600}
table{border-collapse:collapse;width:100%;margin:10px 0}td,th{border:1px solid #222;padding:5px 8px;font-weight:normal;text-align:left;vertical-align:middle}
th{background:#eee}.r{text-align:right}.c{text-align:center}.sm{font-size:12.5px}.right{text-align:right}
.tate{writing-mode:vertical-rl;text-orientation:upright;font-size:17px;line-height:2.05;height:983px;width:650px;letter-spacing:.04em}
.tate .ind{padding-top:1em}
.seal{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border:2.5px solid #c8201c;border-radius:50%;color:#c8201c;font-size:15px;line-height:1;font-family:'MS Mincho',serif;vertical-align:middle;margin-left:6px}
.card{border:1.5px solid #333;border-radius:10px;padding:14px 18px;margin:0 0 24px;font-size:14px;line-height:1.7;position:relative}
.photo{position:absolute;right:16px;top:16px;width:90px;height:112px;background:linear-gradient(#c6d3df,#8fa2b4);border:1px solid #555}
.line{background:#7a97bb;font-family:'Yu Gothic','Meiryo',sans-serif;padding:0;}
.line .bar{background:#242e3d;color:#fff;padding:18px 24px;font-size:20px}
.line .msgs{padding:18px 22px}.bub{display:block;max-width:560px;width:fit-content;padding:9px 15px;border-radius:14px;margin:9px 0;font-size:16px;line-height:1.55;background:#fff}
.bub.me{background:#8de055;margin-left:auto}.who{font-size:12.5px;color:#f4f6fb;margin-top:12px}.day{text-align:center;color:#fff;font-size:12.5px;margin:12px}
pre.m{font-family:'Consolas','MS Gothic',monospace;font-size:13.5px;line-height:1.65;white-space:pre-wrap;margin:0}
`;
export const TEMPLATES = {
  // ========= 調整用（dev） =========
  d1_chinjutsu: { set: 'dev', kind: '横書き', build(w) {
    const a = w.person(), b = w.person(), c = w.person(); const ad = w.addr(), ad2 = w.addr();
    return `<div class="page min"><h1>陳述書</h1>
<div class="right">${k('令和6年（家イ）第1234号')} 夫婦関係調整調停事件</div>
<div class="right">${k('東京家庭裁判所')} 御中</div><div class="right">令和6年9月12日</div>
<div class="right">申立人 ${x('name', a.full)} ${seal(a.sei.slice(0, 1))}</div>
<p>1 私は、${x('name', a.full)}と申します。${x('birth', w.birth().sho)}生まれで、現在は${x('address', ad.full)}に住んでいます。連絡先は${x('phone', w.tel())}です。</p>
<p>2 相手方である${x('name', b.full)}（以下「相手方」といいます。）とは、平成27年4月に結婚し、長男の${x('name', c.mei)}をもうけました。${x('name', c.mei)}は現在、${x('school', w.school())}の3年生です。</p>
<p>3 私は、${x('workplace', w.corp() + '株式会社')}に勤務しています。相手方が職場に電話をかけてくることが${k('令和6年3月')}ごろから増えました。勤務先の電話番号は${x('phone', w.fix())}です。</p>
<p>4 令和6年5月10日、相手方から「${x('address', ad2.noPref)}のマンションに引っ越す」と告げられました。その後、生活費として毎月${k('金15万円')}の振込がありましたが、同年8月から止まっています。</p>
<p>5 私は${x('name', c.sei)}先生（担任）にも相談しました。メールでのご連絡は ${x('email', w.mail())} までお願いします。</p>
<p>以上のとおり、相違ありません。</p></div>`; } },
  d2_tsuchi_tate: { set: 'dev', kind: '縦書き', build(w) {
    const a = w.person(), b = w.person(), L = w.person(); const ad = w.addr(), ad2 = w.addr(); const t = w.tel();
    return `<div class="page ms"><div class="tate">
<div class="ind">通知書</div>
<div>冠省　当職は、貴殿の配偶者である${x('name', a.full)}氏から委任を受けた代理人として、次のとおり通知いたします。</div>
<div>一、依頼者の住所は${x('address', ad.kan)}であり、生年月日は${x('birth', w.birth().kan)}です。</div>
<div>二、貴殿は、${k('令和六年五月十日')}以降、依頼者の携帯電話（番号${x('phone', w.world_kanTel(t))}）へ繰り返し連絡をしています。</div>
<div>三、つきましては、本書到達後七日以内に、${k('金三百万円')}を下記の口座へお支払いください。</div>
<div>　${x('bank', w.bank())}　${x('bank', w.r.pick(w.P.town) + '支店')}　普通預金　${x('account', w.acct_kan())}</div>
<div>　口座名義　${x('name', a.full)}</div>
<div>四、ご回答は当職宛てにお願いします。</div>
<div class="ind">令和六年九月十二日</div>
<div>${x('address', ad2.kan)}　通知人代理人弁護士　${x('proname', L.full)}</div>
<div>被通知人　${x('name', b.full)}　殿</div>
</div></div>`; } },
  d3_kyuyo: { set: 'dev', kind: '表', build(w) {
    const a = w.person();
    return `<div class="page got"><h1>給与明細書</h1><div class="right">${k('2024年8月分')}（支給日 ${k('2024年8月25日')}）</div>
<table><tr><th>氏名</th><td>${x('name', a.sp)} 様</td><th>社員番号</th><td>${x('employee', 'E' + w.r.digits(5))}</td></tr>
<tr><th>会社名</th><td>${x('workplace', w.corp() + '株式会社')}</td><th>所属</th><td>第二営業部</td></tr></table>
<table><tr><th colspan="2">支給</th><th colspan="2">控除</th></tr>
<tr><td>基本給</td><td class="r">${k('285,000')}</td><td>健康保険料</td><td class="r">${k('14,250')}</td></tr>
<tr><td>時間外手当</td><td class="r">${k('32,400')}</td><td>厚生年金</td><td class="r">${k('26,840')}</td></tr>
<tr><td>通勤手当</td><td class="r">${k('12,300')}</td><td>雇用保険</td><td class="r">${k('1,920')}</td></tr>
<tr><td>支給合計</td><td class="r">${k('329,700')}</td><td>差引支給額</td><td class="r">${k('263,410')}</td></tr></table>
<table><tr><th>振込先</th><td>${x('bank', w.bank())} ${x('bank', w.r.pick(w.P.town) + '支店')} 普通 ${x('account', w.acct())}</td></tr>
<tr><th>個人番号</th><td>${x('mynumber', w.mynumber())}</td></tr></table></div>`; } },
  d4_juminhyo: { set: 'dev', kind: '表', build(w) {
    const a = w.person(), b = w.person(), ad = w.addr(), ho = w.addr();
    const b1 = w.birth(), b2 = w.birth();
    const n2 = a.sei + b.mei;
    return `<div class="page got"><h1>住民票の写し</h1>
<table class="sm"><tr><th style="width:90px">住所</th><td colspan="3">${x('address', ad.full)}</td></tr>
<tr><th>世帯主</th><td colspan="3">${x('name', a.zsp)}</td></tr></table>
<table class="sm"><tr><th>氏名</th><td>${x('name', a.zsp)}</td><th>生年月日</th><td>${x('birth', b1.sho)}</td><th>性別</th><td>男</td></tr>
<tr><th>続柄</th><td>世帯主</td><th>個人番号</th><td colspan="3">${x('mynumber', w.mynumber())}</td></tr>
<tr><th>本籍</th><td colspan="5">${x('honseki', ho.banchi)}</td></tr><tr><th>筆頭者</th><td colspan="5">${x('name', a.zsp)}</td></tr></table>
<table class="sm"><tr><th>氏名</th><td>${x('name', n2)}</td><th>生年月日</th><td>${x('birth', b2.sho)}</td><th>性別</th><td>女</td></tr>
<tr><th>続柄</th><td>妻</td><th>個人番号</th><td colspan="3">${x('mynumber', w.mynumber())}</td></tr>
<tr><th>住民票コード</th><td colspan="5">${x('jukicode', w.r.digits(11))}</td></tr></table>
<p>この写しは、世帯全員の住民票の原本と相違ないことを証明する。</p><p>${k('令和6年8月30日')}　${k('東京都○○区長')}</p></div>`; } },
  d5_tsucho: { set: 'dev', kind: '表', build(w) {
    const a = w.person();
    const row = (d, m, o, i, b) => `<tr><td>${k(d)}</td><td>${m}</td><td class="r">${o}</td><td class="r">${i}</td><td class="r">${b}</td></tr>`;
    return `<div class="page biz"><h1>普通預金通帳</h1>
<table><tr><th>金融機関</th><td>${x('bank', w.bank())}</td><th>支店名</th><td>${x('bank', w.r.pick(w.P.town) + '支店')}</td></tr>
<tr><th>口座番号</th><td>${x('account', w.acct())}</td><th>口座名義</th><td>${x('name', a.sp)} 様</td></tr></table>
<table class="sm"><tr><th>年月日</th><th>お取引内容</th><th>お支払金額</th><th>お預り金額</th><th>差引残高</th></tr>
${row('06-08-01', '電気料', '8,420', '', '352,180')}${row('06-08-05', '振込 ' + x('kana', a.kana), '', '120,000', '472,180')}
${row('06-08-10', 'カード ATM', '30,000', '', '442,180')}${row('06-08-15', '振込 ' + x('workplace', w.corp() + '（カ'), '', '263,410', '705,590')}
${row('06-08-20', '振込 ' + x('kana', w.person().kana), '50,000', '', '655,590')}${row('06-08-27', '水道料', '4,210', '', '651,380')}</table></div>`; } },
  d6_moushitate: { set: 'dev', kind: '横書き', build(w) {
    const L = w.person(), S = w.person(), D = w.person(), L2 = w.person(); const a1 = w.addr(), a2 = w.addr(), a3 = w.addr();
    return `<div class="page min"><h1>仮処分命令申立書</h1><div class="right">令和8年10月13日</div>
<div>${k('東京地方裁判所民事第9部')} 御中</div><div class="right">債権者代理人弁護士 ${x('proname', L.full)}</div>
<p>当事者の表示 別紙当事者目録記載のとおり</p><h1 style="font-size:17px;letter-spacing:.2em;margin-top:30px">当事者目録</h1>
<p>〒${x('postal', a1.postal)}<br>${x('address', a1.hyph)}<br>債権者 ${x('corp', w.corp() + '合同会社')}<br>上記代表者代表取締役 ${x('name', S.full)}</p>
<p>〒${x('postal', a2.postal)}<br>${x('address', a2.hyph)} ${k('○○法律事務所')}（送達場所）<br>電　話 ${x('phone', w.fix())}<br>ＦＡＸ ${x('phone', w.fix())}<br>債権者代理人弁護士 ${x('proname', L2.full)}</p>
<p>〒${x('postal', a3.postal)}<br>${x('address', a3.full)}<br>債務者 ${x('name', D.full)}</p>
<h1 style="font-size:17px;letter-spacing:.2em;margin-top:30px">申立ての趣旨</h1>
<p>債務者は、別紙物件目録記載の不動産について、譲渡、質権・抵当権・賃借権の設定その他一切の処分をしてはならない。との裁判を求める。</p>
<p>${k('民事保全法第23条')} 第1項による。被保全権利は${k('金500万円')}の売買代金返還請求権である。</p></div>`; } },
  d7_idcopy: { set: 'dev', kind: '表', build(w) {
    const a = w.person(), ad = w.addr();
    return `<div class="page got" style="font-size:14px">
<div class="card" style="height:230px"><b>運転免許証</b>（写し）<div class="photo"></div><br>氏名 ${x('name', a.full)}　${x('birth', w.birth().sho)}生<br>住所 ${x('address', ad.full)}<br>交付 ${k('令和5年3月1日')}　${k('東京都公安委員会')}<br>番号 第${x('license', w.license())}号<br>有効期限 ${k('令和10年4月1日')}まで</div>
<div class="card" style="height:190px"><b>健康保険 被保険者証</b><br>記号 ${x('insurance', w.r.digits(4))}　番号 ${x('insurance', w.r.digits(3))}<br>氏名 ${x('name', a.full)}<br>保険者番号 ${x('insurance', w.r.digits(8))}<br>事業所名称 ${x('workplace', w.corp() + '株式会社')}</div>
<div class="card" style="height:170px"><b>PASSPORT 旅券</b><br>Type P　Passport No. ${x('passport', w.passport())}<br>Surname / 姓 ${x('name', a.sei)}　Given name / 名 ${x('name', a.mei)}</div>
<div class="card" style="height:150px"><b>基礎年金番号通知書</b><br>基礎年金番号 ${x('pension', w.pension())}<br>氏名 ${x('name', a.full)}</div></div>`; } },
  d8_line: { set: 'dev', kind: '画面', build(w) {
    const a = w.person(), b = w.person(), ad = w.addr();
    return `<div class="page line"><div class="bar">${x('name', a.full)}</div><div class="msgs"><div class="day">8月12日（月）</div>
<div class="who">${x('name', a.sei)}</div><div class="bub">今日${k('19時')}に帰るね</div>
<div class="bub me">わかった。${x('name', b.mei)}のお迎えは私が行きます</div>
<div class="who">${x('name', a.sei)}</div><div class="bub">引っ越し先は ${x('address', ad.noPref)} だから</div>
<div class="bub me">電話は ${x('phone', w.tel())} でいい？</div><div class="bub">LINE IDは ${x('snsid', w.lineId())} に変えた</div>
<div class="bub me">${x('name', b.full)}さんにも伝えておきます</div><div class="bub">養育費は${k('5万円')}でお願い</div></div></div>`; } },

  // ========= 実力確認用（held-out）＝検出の調整には使わない =========
  h1_gensen: { set: 'held', kind: '表', build(w) {
    const a = w.person(), f = w.person(), ad = w.addr();
    return `<div class="page got sm"><h1 style="font-size:19px">令和5年分 給与所得の源泉徴収票</h1>
<table class="sm"><tr><th style="width:110px">支払を受ける者</th><td>住所又は居所 ${x('address', ad.full)}</td><td>（個人番号）${x('mynumber', w.mynumber())}</td></tr>
<tr><th>氏名</th><td>（フリガナ）${x('kana', a.kana)}<br>${x('name', a.zsp)}</td><td>生年月日 ${x('birth', w.birth().sho)}</td></tr></table>
<table class="sm"><tr><th>種別</th><th>支払金額</th><th>給与所得控除後の金額</th><th>所得控除の額の合計額</th><th>源泉徴収税額</th></tr>
<tr><td>給与・賞与</td><td class="r">${k('5,420,000')}</td><td class="r">${k('3,902,000')}</td><td class="r">${k('1,450,000')}</td><td class="r">${k('128,500')}</td></tr></table>
<table class="sm"><tr><th>控除対象配偶者 氏名</th><td>${x('name', f.full)}</td><th>個人番号</th><td>${x('mynumber', w.mynumber())}</td></tr></table>
<table class="sm"><tr><th>支払者</th><td>住所 ${x('corpaddr', w.addr().full)}<br>氏名又は名称 ${x('workplace', w.corp() + '株式会社')}<br>電話 ${x('phone', w.fix())}</td></tr></table>
<p class="sm">法人番号 ${k('4010401000018')}　整理番号 ${k('250901234567')}</p></div>`; } },
  h2_koseki_tate: { set: 'held', kind: '縦書き', build(w) {
    const a = w.person(), b = w.person(), c = w.person(); const ho = w.addr(), ho2 = w.addr();
    return `<div class="page ms"><div class="tate" style="font-size:16px">
<div>　　　　　　全部事項証明</div><div>本　籍　　${x('honseki', ho.banchi)}</div><div>氏　名　　${x('name', a.full)}</div>
<div>戸籍事項　戸籍編製　${k('平成二十七年四月一日')}</div>
<div>戸籍に記録されている者　【名】${x('name', a.mei)}</div><div>【生年月日】${x('birth', w.birth().kan)}　【配偶者区分】夫</div>
<div>【父】${x('name', w.person().full)}　【母】${x('name', w.person().full)}　【続柄】長男</div>
<div>戸籍に記録されている者　【名】${x('name', b.mei)}</div><div>【生年月日】${x('birth', w.birth().kan)}　【配偶者区分】妻</div>
<div>【従前戸籍】${x('honseki', ho2.banchi)}　${x('name', b.full)}</div>
<div>戸籍に記録されている者　【名】${x('name', c.mei)}</div><div>【生年月日】${x('birth', w.birth().kan)}　【続柄】長男</div>
<div>これは、戸籍に記録されている事項の全部を証明した書面である。</div><div>${k('令和六年八月三十日')}　　${k('○○市長')}</div></div></div>`; } },
  h3_shindan: { set: 'held', kind: '横書き', build(w) {
    const a = w.person(), dr = w.person(), ad = w.addr();
    return `<div class="page min"><h1>診断書</h1>
<table><tr><th style="width:120px">患者氏名</th><td>${x('name', a.full)}</td></tr><tr><th>生年月日</th><td>${x('birth', w.birth().sei)}（満${x('age', w.r.int(30, 60))}歳）</td></tr><tr><th>住所</th><td>${x('address', ad.zen)}</td></tr><tr><th>病名</th><td>適応障害</td></tr></table>
<p>上記の者は、${k('2024年6月3日')}より当院に通院中であり、上記の診断により今後${k('3か月')}の休養を要する。カルテ番号は${x('mrn', w.r.digits(8))}である。</p>
<p>なお、職場である${x('workplace', w.corp() + '株式会社')}との間の問題が発症の契機となっている旨、本人から聴取した。緊急連絡先は配偶者の${x('name', w.person().full)}（${x('phone', w.tel())}）である。</p>
<p class="right">${k('2024年9月2日')}</p><p class="right">医療法人社団 ${k('若草会 星見台クリニック')}<br>医師 ${x('proname', dr.full)} ${seal(dr.sei.slice(0, 1))}</p></div>`; } },
  h4_chintai: { set: 'held', kind: '横書き', build(w) {
    const a = w.person(), g = w.person(), ad = w.addr(), ad2 = w.addr();
    return `<div class="page min"><h1>建物賃貸借契約書</h1>
<p>賃貸人 ${k('若草電機株式会社')}（以下「甲」という。）と賃借人 ${x('name', a.sp)}（以下「乙」という。）は、次のとおり契約を締結する。</p>
<p>第1条 甲は乙に対し、次の建物を賃貸する。所在：${x('address', ad.hyph)}</p><p>第2条 賃料は月額${k('金85,000円')}とし、毎月末日までに支払う。契約期間は${k('令和5年4月1日')}から${k('令和7年3月31日')}までとする。</p>
<p>第3条 連帯保証人${x('name', g.full)}は、乙と連帯して本契約上の債務を負担する。</p><p>第4条 ${k('借地借家法第26条')}の定めに従う。車両は${x('car', w.car())}の1台に限り駐車場を利用できる。</p>
<table><tr><th style="width:100px">乙 住所</th><td>${x('address', ad.full)}</td></tr><tr><th>氏名</th><td>${x('name', a.full)} ${seal(a.sei.slice(0, 1))}</td></tr><tr><th>電話</th><td>${x('phone', w.tel())}</td></tr>
<tr><th>連帯保証人 住所</th><td>${x('address', ad2.full)}</td></tr><tr><th>氏名</th><td>${x('name', g.full)} ${seal(g.sei.slice(0, 1))}</td></tr><tr><th>生年月日</th><td>${x('birth', w.birth().sho)}</td></tr></table></div>`; } },
  h5_jidan_tate: { set: 'held', kind: '縦書き', build(w) {
    const a = w.person(), b = w.person(); const ad = w.addr(), ad2 = w.addr();
    return `<div class="page min"><div class="tate">
<div class="ind">示　談　書</div><div>${x('name', a.full)}（以下「甲」という。）と${x('name', b.full)}（以下「乙」という。）は、${k('令和五年十月三日')}に発生した事故について、次のとおり示談した。</div>
<div>第一条　乙は甲に対し、解決金として${k('金八十万円')}を支払う。</div><div>第二条　前条の金員は、${x('bank', w.bank())}${x('bank', w.r.pick(w.P.town) + '支店')}の甲名義の普通預金口座（口座番号${x('account', w.acct_kan())}）に振り込む。</div>
<div>第三条　甲及び乙は、本件に関し、本示談書に定めるほか何らの債権債務がないことを確認する。</div><div class="ind">${k('令和五年十二月一日')}</div>
<div>甲　住所　${x('address', ad.kan)}</div><div>　　氏名　${x('name', a.full)}</div><div>乙　住所　${x('address', ad2.kan)}</div><div>　　氏名　${x('name', b.full)}　電話　${x('phone', w.world_kanTel(w.tel()))}</div></div></div>`; } },
  h6_mail: { set: 'held', kind: '画面', build(w) {
    const a = w.person(), b = w.person(); const ad = w.addr();
    return `<div class="page got"><pre class="m">差出人: ${x('name', a.full)} &lt;${x('email', w.mail())}&gt;
送信日時: ${k('2024年7月3日')} 21:14
宛先: ${x('name', b.sp)} &lt;${x('email', w.mail())}&gt;
件名: Re: 面会交流の件

${x('name', b.sei)}さま

お世話になっております。先日お話しした件ですが、
${x('name', w.person().mei)}の面会は${k('8月10日')}の午後でお願いします。

場所は私の自宅（${x('address', ad.hyph)}）でも構いません。
待ち合わせは${k('駅前の改札')}にしましょう。

当日の連絡は ${x('phone', w.tel())} までお願いします。
Instagram: @${x('snsid', w.lineId())}

--
${x('name', a.full)}
${x('workplace', w.corp() + '株式会社')} 総務課
TEL ${x('phone', w.fix())}
</pre></div>`; } },

  // ========= 2回目の実力確認用（held2）：1回目の結果を見たあとに、別の書類の型として追加 =========
  n1_rirekisho: { set: 'held2', kind: '表', build(w) {
    const a = w.person(), ad = w.addr(), b = w.birth();
    return `<div class="page min"><h1>履 歴 書</h1><div class="right">${k('令和6年4月1日')}現在</div>
<table><tr><th style="width:100px">ふりがな</th><td>${x('kana', a.kana)}</td></tr><tr><th>氏　名</th><td style="font-size:22px">${x('name', a.zsp)}</td></tr>
<tr><th>生年月日</th><td>${x('birth', b.sho)}生（満${x('age', w.r.int(25, 60))}歳）</td></tr>
<tr><th>現住所</th><td>〒${x('postal', ad.postal)}<br>${x('address', ad.full)}</td></tr>
<tr><th>電話</th><td>${x('phone', w.tel())}</td></tr><tr><th>E-mail</th><td>${x('email', w.mail())}</td></tr></table>
<table><tr><th style="width:120px">年月</th><th>学歴・職歴</th></tr>
<tr><td>${k('平成18年3月')}</td><td>${x('school', w.school())} 卒業</td></tr><tr><td>${k('平成18年4月')}</td><td>${x('workplace', w.corp() + '株式会社')} 入社</td></tr><tr><td>${k('令和3年6月')}</td><td>一身上の都合により退職</td></tr></table></div>`; } },
  n2_kyogi_tate: { set: 'held2', kind: '縦書き', build(w) {
    const a = w.person(), b = w.person(), c = w.person(); const ad = w.addr(), ad2 = w.addr();
    return `<div class="page min"><div class="tate">
<div class="ind">離婚協議書</div><div>夫${x('name', a.full)}（以下「甲」という。）と妻${x('name', b.full)}（以下「乙」という。）は、離婚について次のとおり合意した。</div>
<div>第一条　甲乙間の長女${x('name', c.mei)}（${x('birth', w.birth().kan)}生）の親権者を乙と定める。</div>
<div>第二条　甲は乙に対し、養育費として月額${k('金五万円')}を、${x('bank', w.bank())}${x('bank', w.r.pick(w.P.town) + '支店')}の乙名義の口座（普通預金　口座番号${x('account', w.acct_kan())}）に振り込んで支払う。</div>
<div>第三条　甲は、${k('令和六年五月一日')}までに自宅から退去する。</div><div class="ind">${k('令和六年四月一日')}</div>
<div>甲　住所　${x('address', ad.kan)}</div><div>　　氏名　${x('name', a.full)}</div><div>乙　住所　${x('address', ad2.kan)}</div><div>　　氏名　${x('name', b.full)}</div></div></div>`; } },
  n3_nenkin: { set: 'held2', kind: '表', build(w) {
    const a = w.person(), ad = w.addr();
    return `<div class="page got"><h1 style="font-size:20px">年金分割のための情報通知書</h1>
<table class="sm"><tr><th>氏名</th><td>${x('name', a.full)}</td><th>生年月日</th><td>${x('birth', w.birth().sho)}</td></tr>
<tr><th>基礎年金番号</th><td>${x('pension', w.pension())}</td><th>性別</th><td>女</td></tr><tr><th>住所</th><td colspan="3">${x('address', ad.hyph)}</td></tr></table>
<table class="sm"><tr><th>対象期間</th><td>${k('平成20年4月')}〜${k('令和5年3月')}</td></tr><tr><th>標準報酬総額</th><td class="r">${k('42,350,000')}</td></tr><tr><th>按分割合の範囲</th><td>50%まで</td></tr></table>
<p class="sm">照会番号 ${k('250112345678')}　${k('日本年金機構')} ${k('○○年金事務所')}</p></div>`; } },
  n4_hanyaku: { set: 'held2', kind: '横書き', build(w) {
    const a = w.person(), b = w.person(), ad = w.addr();
    return `<div class="page min"><h1 style="font-size:20px">録音反訳書</h1><p>録音日時 ${k('令和5年11月2日')} 午後8時ごろ　場所 自宅リビング</p>
<p>話者A ${x('name', a.full)}　話者B ${x('name', b.full)}</p>
<p>A：だからさ、${x('name', a.sei)}の実家には言わないでって言ったよね。</p><p>B：${x('name', b.mei)}が泣いてたんだよ。もう限界だって。</p>
<p>A：来月から${x('address', ad.noPref)}に移るから。荷物はそのときに取りに来る。</p><p>B：連絡先は変わらないの？ ${x('phone', w.tel())} でいいの？</p>
<p>A：会社は${x('workplace', w.corp() + '株式会社')}のままだよ。</p><p>B：${k('慰謝料300万円')}の話はどうするの。</p></div>`; } },
  n5_ininjo: { set: 'held2', kind: '横書き', build(w) {
    const a = w.person(), L = w.person(), ad = w.addr(), ad2 = w.addr();
    return `<div class="page min"><h1>委 任 状</h1><p>${k('令和6年7月1日')}</p><p>私は、次の者を代理人と定め、下記の事項を委任します。</p>
<p>受任者 ${k('○○法律事務所')}<br>住所 ${x('address', ad2.hyph)}<br>弁護士 ${x('proname', L.full)}<br>電話 ${x('phone', w.fix())}</p>
<p>委任事項：${k('東京地方裁判所')}令和6年（ワ）第5678号 損害賠償請求事件に関する一切の件</p>
<table><tr><th style="width:90px">委任者 住所</th><td>${x('address', ad.banchi)}</td></tr><tr><th>氏名</th><td>${x('name', a.sp)} ${seal(a.sei.slice(0, 1))}</td></tr></table></div>`; } },
  n6_seikyu: { set: 'held2', kind: '表', build(w) {
    const a = w.person(), ad = w.addr();
    return `<div class="page biz"><h1 style="font-size:22px">請 求 書</h1><div class="right">請求番号 ${k('INV-2024-00871')}　発行日 ${k('2024年10月31日')}</div>
<p>${x('address', ad.full)}<br>${x('name', a.full)} 様</p>
<table class="sm"><tr><th>品名</th><th>数量</th><th>単価</th><th>金額</th></tr><tr><td>修理代金</td><td class="r">1</td><td class="r">${k('48,000')}</td><td class="r">${k('48,000')}</td></tr><tr><td>出張費</td><td class="r">1</td><td class="r">${k('5,000')}</td><td class="r">${k('5,000')}</td></tr><tr><td>合計（税込）</td><td></td><td></td><td class="r">${k('58,300')}</td></tr></table>
<p class="sm">お振込先：${x('bank', w.bank())} ${x('bank', w.r.pick(w.P.town) + '支店')} 普通 ${x('account', w.acct())}　名義 ${x('kana', w.person().kana)}</p>
<p class="sm">登録番号 ${k('T4010401000018')}　${k('有限会社サンプル修理')}</p></div>`; } },

  // ========= 3回目の実力確認用（held3）：2回目の結果を見たあとに、別の書類の型として追加 =========
  p1_junbi: { set: 'held3', kind: '横書き', build(w) {
    const a = w.person(), b = w.person(), L = w.person(), c = w.person(), ad = w.addr();
    return `<div class="page min"><div class="right">${k('令和6年（ワ）第2468号')} 損害賠償請求事件</div><h1>準備書面</h1><div class="right">${k('令和6年12月5日')}</div><div>${k('さいたま地方裁判所民事第3部')} 御中</div>
<div class="right">原告訴訟代理人弁護士 ${x('proname', L.full)}</div>
<p>第1 被告${x('name', b.full)}は、原告${x('name', a.full)}に対し、${k('令和5年8月20日')}午後9時ごろ、原告の自宅である${x('address', ad.noPref)}の玄関前において暴行を加えた。</p>
<p>第2 原告は、当時${x('workplace', w.corp() + '株式会社')}に勤務しており、事件後は休職を余儀なくされた。主治医の${x('name', c.sei)}医師は、加療${k('2週間')}を要すると診断した。</p>
<p>第3 ${x('name', a.sei)}は、翌日に${k('川口警察署')}へ被害届を提出した。被告の${x('name', b.sei)}は、${k('金120万円')}の支払義務を争っている。</p>
<p>第4 よって、原告は${k('民法第709条')}に基づき、上記金員の支払を求める。</p></div>`; } },
  p2_baibai_tate: { set: 'held3', kind: '縦書き', build(w) {
    const a = w.person(), b = w.person(); const ad = w.addr(), ad2 = w.addr();
    return `<div class="page ms"><div class="tate"><div class="ind">売買契約書</div>
<div>売主${x('name', a.full)}と買主${x('name', b.full)}は、次のとおり売買契約を締結した。</div>
<div>一、目的物は${x('address', ad.kan)}所在の土地とする。</div><div>二、代金は${k('金千二百万円')}とし、買主は${k('令和六年九月三十日')}までに支払う。</div>
<div>三、支払先は${x('bank', w.bank())}の売主名義の口座（口座番号${x('account', w.acct_kan())}）とする。</div><div class="ind">${k('令和六年八月一日')}</div>
<div>売主　住所　${x('address', ad2.kan)}　氏名　${x('name', a.full)}</div><div>買主　生年月日　${x('birth', w.birth().kan)}　電話　${x('phone', w.world_kanTel(w.tel()))}</div></div></div>`; } },
  p3_jiko: { set: 'held3', kind: '表', build(w) {
    const a = w.person(), b = w.person(), ad = w.addr(), ad2 = w.addr();
    return `<div class="page got sm"><h1 style="font-size:20px">交通事故証明書</h1><p>発生日時 ${k('令和6年3月14日')} 午前8時30分　照会記録簿番号 ${k('第12345号')}</p>
<table class="sm"><tr><th>甲 住所</th><td>${x('address', ad.hyph)}</td></tr><tr><th>氏名</th><td>${x('name', a.zsp)}</td></tr><tr><th>生年月日</th><td>${x('birth', w.birth().sho)}</td></tr><tr><th>車両番号</th><td>${x('car', w.car())}</td></tr><tr><th>自賠責証明書番号</th><td>${k('AB1234567890')}</td></tr></table>
<table class="sm"><tr><th>乙 住所</th><td>${x('address', ad2.full)}</td></tr><tr><th>氏名</th><td>${x('name', b.zsp)}</td></tr><tr><th>生年月日</th><td>${x('birth', w.birth().zen)}</td></tr><tr><th>車両番号</th><td>${x('car', w.car())}</td></tr></table>
<p class="sm">上記の事故を確認したことを証明する。${k('自動車安全運転センター')} ${k('○○事務所長')}</p></div>`; } },
  p4_sms: { set: 'held3', kind: '画面', build(w) {
    const a = w.person(), b = w.person(), ad = w.addr();
    return `<div class="page line"><div class="bar">${x('name', a.sei + ' ' + a.mei)}</div><div class="msgs"><div class="day">${k('2024年5月3日')}</div>
<div class="bub">${x('name', b.mei)}、話がある。${x('phone', w.fix())}に電話して</div><div class="bub me">今は無理です。仕事中なので</div>
<div class="bub">${x('workplace', w.corp() + '株式会社')}まで行くぞ</div><div class="bub me">やめてください。${x('address', ad.noPref)}には来ないで</div>
<div class="bub">保育料${k('3万円')}は払った</div><div class="bub me">子どもの${x('school', w.school())}にも連絡しないで</div></div></div>`; } },
};
