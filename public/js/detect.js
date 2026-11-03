// 個人情報の検出。入力はページごとの「行（文字＋位置）」。DOM を使わないので Node でも試験できる。
// 方針：見落としを減らす側に倒す。確かさを tier で持ち（high / mid / low）、low は最初は隠さず一覧に出すだけ。
import { CATEGORIES } from './categories.js';

const PREF = '北海道|青森県|岩手県|宮城県|秋田県|山形県|福島県|茨城県|栃木県|群馬県|埼玉県|千葉県|東京都|神奈川県|新潟県|富山県|石川県|福井県|山梨県|長野県|岐阜県|静岡県|愛知県|三重県|滋賀県|京都府|大阪府|兵庫県|奈良県|和歌山県|鳥取県|島根県|岡山県|広島県|山口県|徳島県|香川県|愛媛県|高知県|福岡県|佐賀県|長崎県|熊本県|大分県|宮崎県|鹿児島県|沖縄県';
const WARD23 = '千代田区|中央区|港区|新宿区|文京区|台東区|墨田区|江東区|品川区|目黒区|大田区|世田谷区|渋谷区|中野区|杉並区|豊島区|北区|荒川区|板橋区|練馬区|足立区|葛飾区|江戸川区';
const SEIREI = '札幌市|仙台市|さいたま市|千葉市|横浜市|川崎市|相模原市|新潟市|静岡市|浜松市|名古屋市|京都市|大阪市|堺市|神戸市|岡山市|広島市|北九州市|福岡市|熊本市';
const NUM = '[0-9]+|[〇一二三四五六七八九十百千]+';
const SEP = '[\\s]*'; // 同じ行の中の空白
const CJK = '一-龥々〆ヶヵ';
const KANA = 'ぁ-んァ-ヶー';
// 番地のかたち：「三丁目4番5号」「3-4-5」「十二番地3」
const BANCHI = `(?:(?:${NUM})丁目(?:${SEP}(?:${NUM})(?:番地?|ー|-|の))?(?:${SEP}(?:${NUM})(?:号|ー|-|の)?)?(?:${SEP}(?:${NUM})号?)?|(?:${NUM})番地?(?:の?(?:${NUM}))?(?:${SEP}(?:${NUM})号)?|(?:[0-9]+[-ー－][0-9]+(?:[-ー－][0-9]+)?))`;
const BUILDING = `(?:[ 　]?[${CJK}${KANA}A-Za-z0-9・]{0,24}?(?:[0-9〇一二三四五六七八九十百]+(?:号室|階|Ｆ|F|号棟)))?`;

const LABEL_NAME = /(話者\s*[A-Za-z]?|旧\s*姓|同僚|友人|知人|上司|部下|隣人|同級生|主治医|担当医|氏\s*名|お名前|名\s*前|申立人|相手方|原告|被告|債権者|債務者|被通知人|通知人|被相続人|相続人|配偶者|世帯主|筆頭者|代表取締役|代表社員|代表者|理事長|連帯保証人|保証人|受取人|口座名義|名義人|名義|担当者|患者名|被保険者|契約者|賃借人|賃貸人|買主|売主|差出人|宛先|送信者|受信者|【名】|【父】|【母】|Surname|Given\s*name|姓|名)\s*[:：/／]?\s*/g;
const NAME_TAIL_STOP = /^[君氏様殿宅側等方達分名家他外邸著作宛印会父母夫妻子兄弟姉妹孫]$/; // 名前の直後に来ても名前の一部ではない1文字
const NAME_HEAD_STOP = /^[甲乙丙丁父母兄弟姉妹妻夫子孫姪甥娘祖叔伯私同当本各両故亡元前現旧新実義養継被原諸貴]$/; // 名前の直前に来ても名前の一部ではない1文字
const KIN_NEXT_STOP = /^[宅側等方達分名家嫁婿夫妻父母子兄弟姉妹孫他外後前時]$/; // 「長男宅」「祖父母」
const KIN_WORD_STOP = /^(夫婦|家族|親子|兄弟|姉妹|夫妻|一家|世帯|同士|自身|本人|以外|全員|二人|一人|三人|名義|学校|宅地|自宅|実家|部屋|名前|氏名|住所|年齢|当時|現在|以降|以前|以後|同様|同席|同居|別居|不在|死亡|出生|誕生|入学|卒業|進学|就職|結婚|離婚)$/;
const NOT_ONE_KANJI_NAME = /^[赤母父兄姉弟妹孫嬢坊爺婆叔伯娘息子夫妻主諸貴暴細皆奥]$/; // 「赤ちゃん」「父ちゃん」
const KIN = /((?:長男|長女|次男|次女|三男|三女|息子|祖父|祖母|叔父|叔母)の?|(?:娘|子|夫|妻|父|母|兄|弟|姉|妹|孫|甥|姪)の)/g;
const HONORIFIC = /(さん|さま|様|殿|氏|君|ちゃん|くん|先生)/g;
const PRO_BEFORE = /(弁護士|司法書士|行政書士|税理士|社会保険労務士|医師|裁判官|書記官|調停委員|公証人|代理人)\s*/g;
// 人名として拾わない語
const NOT_NAME = /^(さん|さま|ちゃん|くん|殿|様|全員|両名|同人|相手|双方|義母|義父|義兄|義弟|義姉|義妹|姓|名|話者|皆|貴|同|当|本|各|御|奥|お客|ご|お|先|上記|下記|別紙|当事者|本人|代理人|申立人|相手方|原告|被告|債権者|債務者|裁判所|裁判官|書記官|法律|事務所|事件|住所|電話|番号|氏名|名前|会社|株式|有限|合同|同会社|生年月日|個人|職場|勤務先|担当|医師|弁護士|先生|患者|保険|健康|支店|銀行|口座|普通|当座|預金|名義|金額|合計|以上|以下|次|甲|乙|丙|丁|代表|代表者|上記代表者|理事|取締役|所属|部長|課長|主任|保証人|連帯保証人|世帯主|筆頭者|続柄|統柄|性別|男|女|戸籍|本籍|従前戸籍|配偶者|配偶者区分|父|母|子|長男|長女|夫|妻|全部事項|記録|印|フリガナ|カナ|ID|種別|支払者|宛先|差出人|送信|件名|Surname|Given)$/;
const NOT_NAME_PART = /(話者|全員|義母|義父|同僚|友人|知人|上司|部下|代表|取締役|弁護士|司法書士|行政書士|税理士|理事|役員|社員|部長|課長|裁判所|事務所|会社|法人|銀行|支店|役所|区長|市長|町長|村長|知事|委員会|法務局|年金|保険|番号|住所|電話|氏名|生年月日|申立|相手方|代理人|当事者|目録|記載|提出|証明|事項|戸籍|区分|名義|株式|有限|合同|以下|以上|上記|下記|との|について|として|及び|また|ただし|なお|これ|それ|こと|もの|ため|から|まで|より|では|には|とは|です|ます|する|した|して|いる|ある|ない|なる|れる|られる)/;
// よくある名（2文字以上）。文中の呼び名を拾うための補助で、1文字の名は誤検出が多いので入れない
const GIVEN_NAMES = '浩一|悠斗|真理子|由香|一郎|二郎|三郎|四郎|五郎|太郎|次郎|健一|健二|健太|健司|浩一|浩二|浩司|誠一|誠二|清一|正一|正二|正雄|正夫|義雄|和夫|和也|和彦|和男|幸雄|幸一|幸男|秀雄|秀樹|英樹|英雄|昭夫|昭雄|明夫|武志|武夫|博之|博文|隆一|隆司|隆史|隆志|達也|達夫|哲也|哲夫|拓也|拓海|拓哉|大輔|大樹|大地|大和|大翔|大雅|翔太|翔平|悠斗|悠太|悠真|悠人|陽翔|陽太|陸斗|蒼太|颯太|颯真|蓮斗|海斗|航平|恭平|修平|純平|康平|直樹|直人|直也|雄太|雄一|裕太|裕介|裕也|祐介|雅人|雅之|真一|真司|慎一|慎吾|亮太|亮介|涼太|優太|優斗|勇気|勇太|和樹|一樹|春樹|智也|智之|俊介|俊也|孝之|孝一|貴之|敏夫|信夫|信行|茂雄|稔|花子|和子|幸子|恵子|明美|直美|由美|裕子|洋子|良子|京子|久美子|真由美|由美子|美智子|千代子|智子|智美|陽子|順子|節子|悦子|典子|紀子|則子|敦子|純子|聡子|恭子|清子|静子|澄子|文子|富子|光子|礼子|友子|美穂|美香|美咲|美優|美月|美羽|真理|真奈|麻衣|麻美|舞子|結衣|結菜|陽菜|陽葵|葵衣|芽依|愛子|愛美|彩香|彩乃|菜々子|奈々|七海|凛子|莉子|咲良|桜子|さくら|ひかり|みどり|あかり|はるか|ひなた|めぐみ|ゆうき|けんた|しょうた|たろう|はなこ';
const CORP = '株式会社|有限会社|合同会社|合資会社|合名会社|一般社団法人|一般財団法人|社会福祉法人|医療法人|学校法人|NPO法人|特定非営利活動法人|税理士法人|弁護士法人';
const ERA = '昭和|平成|令和|大正|明治|[SHRTM]\\.?\\s?';
const DATE = `(?:(?:${ERA})\\s*(?:元|${NUM})\\s*年\\s*(?:${NUM})\\s*月\\s*(?:${NUM})\\s*日|(?:19|20)[0-9]{2}\\s*年\\s*[0-9]{1,2}\\s*月\\s*[0-9]{1,2}\\s*日|(?:19|20)[0-9]{2}[/.-][0-9]{1,2}[/.-][0-9]{1,2}|[SHRTM]\\.?\\s?[0-9]{1,2}[/.][0-9]{1,2}[/.][0-9]{1,2})`;

const KAN_D = { '〇': '0', '零': '0', '一': '1', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6', '七': '7', '八': '8', '九': '9' };

export function checkMyNumber(d) {
  if (!/^[0-9]{12}$/.test(d)) return false;
  let s = 0;
  for (let n = 1; n <= 11; n++) s += +d[11 - n] * (n <= 6 ? n + 1 : n - 5);
  const r = s % 11; return +d[11] === (r <= 1 ? 0 : 11 - r);
}
function luhn(d) {
  let s = 0, alt = false;
  for (let i = d.length - 1; i >= 0; i--) { let v = +d[i]; if (alt) { v *= 2; if (v > 9) v -= 9; } s += v; alt = !alt; }
  return s % 10 === 0;
}

// PDF の文字データには、見た目は同じで別コードの「部首の文字」が混ざることがある（青→⻘ 長→⻑）。NFKC では直らない分を変換する
const RADICALS = { '⺠': '民', '⺟': '母', '⺢': '水', '⺮': '竹', '⺯': '糸', '⻁': '虎', '⻄': '西', '⻅': '見', '⻆': '角', '⻇': '角', '⻑': '長', '⻘': '青', '⻝': '食', '⻤': '鬼', '⻩': '黄', '⻫': '斉', '⻭': '歯', '⻯': '竜', '⻲': '亀', '⻨': '麦', '⻬': '斉', '⻮': '歯', '⻰': '竜', '⻳': '亀', '⻋': '車', '⻃': '日', '⺐': '尢', '⺓': '幺', '⺡': '水', '⺣': '火', '⺤': '爪', '⺩': '王', '⺫': '目', '⺬': '示', '⺲': '罒', '⺶': '羊', '⺸': '羊', '⺼': '肉', '⻊': '足', '⻎': '辶' };
export const fixRadicals = (s) => s.replace(/[\u2E80-\u2EF3]/g, (c) => RADICALS[c] || c);

// 行を読む順に並べて1本の文字列にする。map[i] = {l:行番号, c:文字番号}。セルの区切りは \t、行末は \n
export function buildFlow(lines) {
  const items = lines.map((l, i) => ({ l, i, cx: (l.box[0] + l.box[2]) / 2, cy: (l.box[1] + l.box[3]) / 2, w: l.box[2] - l.box[0], h: l.box[3] - l.box[1] }));
  const vert = items.filter((q) => q.l.vertical).reduce((s, q) => s + q.l.text.length, 0);
  const horiz = items.filter((q) => !q.l.vertical).reduce((s, q) => s + q.l.text.length, 0);
  const isVert = vert > horiz;
  const rows = [];
  // 縦書きのページでは「列」、横書きのページでは「段」にまとめる
  const main = (q) => (isVert ? q.cx : q.cy); const size = (q) => (isVert ? Math.min(q.w, 60) : q.h);
  const sorted = [...items].sort((a, b) => (isVert ? main(b) - main(a) : main(a) - main(b)));
  for (const q of sorted) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(main(q) - row.at) < Math.min(size(q), row.size) * 0.55) row.items.push(q);
    else rows.push({ at: main(q), size: size(q), items: [q] });
  }
  let text = ''; const map = [];
  const pushText = (s, ref) => { for (const ch of s) { text += ch; map.push(ref); } };
  const edgeMin = Math.min(...items.map((q) => (isVert ? q.l.box[1] : q.l.box[0]))), edgeMax = Math.max(...items.map((q) => (isVert ? q.l.box[3] : q.l.box[2])));
  const span = Math.max(1, edgeMax - edgeMin);
  rows.forEach((row, ri) => {
    row.items.sort((a, b) => (isVert ? a.cy - b.cy : a.cx - b.cx));
    row.items.forEach((q, n) => {
      if (n) pushText('\t', null);
      const cs = q.l.chars;
      cs.forEach((ch, ci) => {
        const norm = fixRadicals(ch.c).normalize('NFKC');
        for (const u of norm) { text += u; map.push({ l: q.i, c: ci }); }
      });
    });
    // 紙面いっぱいまで届く行は折り返しとみなし、改行を入れない（文の途中で語が切れないように）
    const next = rows[ri + 1];
    const a0 = Math.min(...row.items.map((q) => (isVert ? q.l.box[1] : q.l.box[0]))), a1 = Math.max(...row.items.map((q) => (isVert ? q.l.box[3] : q.l.box[2])));
    const wrapped = next && row.items.length === 1 && a1 >= edgeMax - span * 0.04 && a0 <= edgeMin + span * 0.12
      && (isVert ? next.items[0].l.box[1] : next.items[0].l.box[0]) <= edgeMin + span * 0.12;
    if (!wrapped) pushText('\n', null);
  });
  return { text, map, isVert };
}

class Collector {
  constructor(flow, lines, page, docIndex) { Object.assign(this, { flow, lines, page, docIndex }); this.hits = []; }
  add(start, end, type, tier, reason, rule) {
    while (start < end && /[\s]/.test(this.flow.text[start])) start++;
    while (end > start && /[\s]/.test(this.flow.text[end - 1])) end--;
    if (end <= start) return null;
    const hit = { type, tier, reason, rule, page: this.page, doc: this.docIndex, start, end, text: this.flow.text.slice(start, end).replace(/\s+/g, ' ') };
    this.hits.push(hit); return hit;
  }
}

const isNameChars = (s) => new RegExp(`^[${CJK}${KANA}]+$`).test(s);

export class Detector {
  constructor({ tokenizer = null } = {}) { this.tk = tokenizer; }

  tokens(text) {
    if (!this.tk) return [];
    return this.tk.tokenize(text).map((t) => ({ s: t.surface_form, at: t.word_position - 1, pos: t.pos, d1: t.pos_detail_1, d2: t.pos_detail_2, d3: t.pos_detail_3, unk: t.word_type === 'UNKNOWN' }));
  }

  // 1ページ分
  scanPage(lines, page, docIndex) {
    const flow = buildFlow(lines); const col = new Collector(flow, lines, page, docIndex);
    const raw = flow.text;
    // ハイフンの揺れをそろえた版（長さは同じ）
    const t = raw.replace(/[－―‐−–—‑]/g, '-');
    // 漢数字を算用数字にした版（長さは同じ。縦書きの番号用）
    const k = t.replace(/[〇零一二三四五六七八九]/g, (c) => KAN_D[c]).replace(/[ーｰ]/g, '-');
    this.numbers(col, t, k);
    this.places(col, t, k);
    this.birth(col, t);
    const toks = this.tokens(t);
    this.names(col, t, toks);
    this.schoolWork(col, t, toks);
    this.spatialLabels(col, lines, flow);
    this.continuations(col, lines, flow);
    // 手で隠したことのある欄（学習）
    for (const lab of this.learned || []) {
      const re = new RegExp(`${lab.replace(/[.*+?^\${}()|[\]\\]/g, '\\$&')}[ \\t:：]*([^\\t\\n、。]{2,30})`, 'g'); let lm;
      while ((lm = re.exec(t))) { const i = lm.index + lm[0].length - lm[1].length; col.add(i, i + lm[1].length, 'learned', 'mid', `手で隠したことのある欄「${lab}」の値`, 'learned-label'); }
    }
    return { flow, hits: col.hits };
  }

  numbers(col, t, k) {
    const add = col.add.bind(col);
    const near = (i, re, span = 24) => re.test(t.slice(Math.max(0, i - span), i));
    let m;
    // 個人番号：検査用数字が合う12桁、または「個人番号」の近く
    const reMy = /(?<![0-9])([0-9]{4}[ -]?[0-9]{4}[ -]?[0-9]{4})(?![0-9])/g;
    while ((m = reMy.exec(k))) {
      const d = m[1].replace(/[ -]/g, ''); const i = m.index;
      const labeled = near(i, /(個人番号|マイナンバー|個人番号カード)/, 40);
      const license = near(i, /(免許|第\s*$)/, 18);
      if (license && !labeled) continue;
      if (labeled) add(i, i + m[1].length, 'mynumber', 'high', '「個人番号」の近くにある12桁の番号', 'my-label');
      else if (checkMyNumber(d) && !/([^人]番号|No\.?|ID|コード)[\s:：]*$/.test(t.slice(Math.max(0, i - 12), i)) && !near(i, /(伝票|請求書|照会)/, 16)) add(i, i + m[1].length, 'mynumber', 'high', '個人番号と同じ形（検査用数字も一致）の12桁', 'my-check');
    }
    // 運転免許証：第＋12桁＋号、または「免許」の近く
    const reLic = /(?<![0-9])([0-9]{12})(?![0-9])/g;
    while ((m = reLic.exec(k))) {
      const i = m.index;
      if (near(i, /(免許|運転)/, 80) || (/第\s*$/.test(k.slice(Math.max(0, i - 3), i)) && /^\s*号/.test(k.slice(i + 12, i + 15)))) {
        if (!col.hits.some((h) => h.type === 'mynumber' && h.start === i)) add(i, i + 12, 'license', 'high', '運転免許証の12桁の番号', 'license');
      }
    }
    // 住民票コード
    const reJu = /住民票コ[-ー]ド[^0-9]{0,8}([0-9]{11})/g;
    while ((m = reJu.exec(k))) { const i = m.index + m[0].length - 11; add(i, i + 11, 'jukicode', 'high', '「住民票コード」の11桁', 'juki'); }
    // 旅券
    const rePass = /(?<![A-Za-z0-9])([A-Z]{2}[0-9]{7})(?![0-9])/g;
    while ((m = rePass.exec(t))) add(m.index, m.index + m[1].length, 'passport', 'high', '旅券番号の形（英字2文字＋数字7桁）', 'passport');
    // 在留カード（英字2＋数字8＋英字2）
    const reZai = /(?<![A-Za-z0-9])([A-Z]{2}[0-9]{8}[A-Z]{2})(?![A-Za-z0-9])/g;
    while ((m = reZai.exec(t))) add(m.index, m.index + m[1].length, 'zairyu', 'high', '在留カード番号の形（英字2＋数字8＋英字2）', 'zairyu');
    // 基礎年金番号
    const rePen = /(?<![0-9-])([0-9]{4}-[0-9]{6})(?![0-9-])/g;
    while ((m = rePen.exec(k))) add(m.index, m.index + m[1].length, 'pension', 'high', '基礎年金番号の形（4桁-6桁）', 'pension');
    const rePenL = /基礎年金番号[^0-9]{0,6}([0-9]{10})/g;
    while ((m = rePenL.exec(k))) { const i = m.index + m[0].length - 10; add(i, i + 10, 'pension', 'high', '「基礎年金番号」の10桁', 'pension-l'); }
    // 保険証
    const reIns = /(記号|番号|保険者番号|被保険者番号)[\s:：]*([0-9]{2,8})(?![0-9])/g;
    while ((m = reIns.exec(k))) {
      const i = m.index + m[0].length - m[2].length;
      const ctx = k.slice(Math.max(0, i - 80), i);
      if (/(保険|被保険者)/.test(ctx) && !/(証券|電話)/.test(m[0])) add(i, i + m[2].length, 'insurance', 'high', '保険証の記号・番号', 'insurance');
    }
    // 口座番号
    const reAcc = /(口座番号|口座|普通預金|普通|定期預金|定期|当座預金|当座|総合口座|貯蓄|証券口座|番号|No\.?)[\s:：（(]*(?:番号)?[\s:：]*([0-9]{6,8}|[0-9]{3}-[0-9]{7})(?![0-9])/g;
    while ((m = reAcc.exec(k))) { const i = m.index + m[0].length - m[2].length; add(i, i + m[2].length, 'account', 'high', '口座番号（「' + m[1] + '」の直後の数字）', 'account'); }
    // カード番号
    const reCard = /(?<![0-9])([0-9]{4}[ -]?[0-9]{4}[ -]?[0-9]{4}[ -]?[0-9]{4})(?![0-9])/g;
    while ((m = reCard.exec(t))) if (luhn(m[1].replace(/[ -]/g, ''))) add(m.index, m.index + m[1].length, 'card', 'high', 'カード番号の形（16桁・検査用数字も一致）', 'card');
    // 社員番号・カルテ番号
    const reEmp = /(社員番号|従業員番号|職員番号|社員No\.?|従業員No\.?|(?:社員|従業員|職員)[I1lｌ]D)[\s:：]*([A-Za-z]?[A-Za-z0-9-]{2,12})/g;
    while ((m = reEmp.exec(t))) { const i = m.index + m[0].length - m[2].length; add(i, i + m[2].length, 'employee', 'mid', '「' + m[1] + '」の値', 'employee'); }
    const reMrn = /(カルテ番号|カルテNo\.?|患者番号|患者ID|診察券番号|ID番号)[\s:：は]*([A-Za-z0-9-]{3,14})/g;
    while ((m = reMrn.exec(t))) { const i = m.index + m[0].length - m[2].length; add(i, i + m[2].length, 'mrn', 'mid', '「' + m[1] + '」の値', 'mrn'); }
    // 車のナンバー
    const reCar = new RegExp(`([${CJK}]{1,4}|なにわ|とちぎ|つくば|いわき|ふじ)\\s*([0-9]{2,3})\\s*([あ-ん])\\s*([0-9]{1,2}[-・]?[0-9]{2})`, 'g');
    while ((m = reCar.exec(t))) add(m.index, m.index + m[0].length, 'car', 'high', '自動車の登録番号の形', 'car');
    // 郵便番号
    const rePost = /([〒〠]\s*)([0-9]{3}[-ー]?[0-9]{4})(?![0-9])/g;
    while ((m = rePost.exec(k))) { const i = m.index + m[1].length; add(i, i + m[2].length, 'postal', 'high', '〒のあとの郵便番号', 'postal'); }
    const rePost2 = /(郵便番号)[\s:：]*([0-9]{3}-?[0-9]{4})(?![0-9])/g;
    while ((m = rePost2.exec(k))) { const i = m.index + m[0].length - m[2].length; add(i, i + m[2].length, 'postal', 'high', '「郵便番号」の値', 'postal-l'); }
    // 〒が読み取れなかった郵便番号：欄や行の先頭にある 123-4567
    const rePost3 = /(^|[\n\t])\s*[^\s0-9]{0,2}\s*([0-9]{3}-[0-9]{4})(?=\s*($|[\n\t]|[^0-9-]))/g;
    while ((m = rePost3.exec(k))) { const i = m.index + m[0].length - m[2].length; if (!col.hits.some((h) => h.type === 'postal' && h.start === i)) add(i, i + m[2].length, 'postal', 'mid', '行の先頭にある郵便番号の形', 'postal-bare'); }
    // メール
    const reMail = /[A-Za-z0-9._%+-]+\s?[@＠]\s?[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
    while ((m = reMail.exec(t))) add(m.index, m.index + m[0].length, 'email', 'high', 'メールアドレスの形', 'email');
    // SNS
    const reSns = /(LINE\s?ID|LINEID|ライン\s?ID|Instagram|インスタ(?:グラム)?|Twitter|ツイッター|Facebook|TikTok|SNS|アカウント|[^A-Za-z]X)\s*[:：は@＠\s]*\s*(@?[A-Za-z][A-Za-z0-9._-]{2,30})/g;
    while ((m = reSns.exec(t))) { const i = m.index + m[0].length - m[2].length; add(i, i + m[2].length, 'snsid', 'high', 'SNSのアカウント（「' + m[1].trim() + '」の直後）', 'sns'); }
    const reAt = /(?<![A-Za-z0-9._%+-])@([A-Za-z][A-Za-z0-9._]{2,30})/g;
    while ((m = reAt.exec(t))) add(m.index, m.index + m[0].length, 'snsid', 'high', '@で始まるSNSのアカウント', 'sns-at');
    const reUrl = /https?:\/\/(?:www\.)?(?:facebook|instagram|twitter|x|tiktok|linkedin)\.com\/[A-Za-z0-9._\/-]+/g;
    while ((m = reUrl.exec(t))) add(m.index, m.index + m[0].length, 'snsid', 'high', 'SNSのページの URL', 'sns-url');
    const reLine = /(?:LINE|ライン)の?\s?ID[^A-Za-z0-9]{0,10}([A-Za-z0-9._-]{3,30})/g;
    while ((m = reLine.exec(t))) { const i = m.index + m[0].length - m[1].length; add(i, i + m[1].length, 'snsid', 'high', 'LINE の ID', 'sns-line'); }
    // 電話：ハイフン区切りの形、または「電話」「TEL」の近くの10〜11桁
    const rePhone = /(?<![0-9-])(\+81[ -]?[0-9]{1,4}[ -]?[0-9]{1,4}[ -]?[0-9]{3,4}|0[0-9]{0,4}[ \-()（）][ ]?[0-9]{1,4}[ \-()（）][ ]?[0-9]{3,4}|0[0-9]{9,10})(?![0-9-])/g;
    while ((m = rePhone.exec(k))) {
      const d = m[1].replace(/[^0-9]/g, ''); const i = m.index;
      const isLong = /^[0-9]+$/.test(m[1]);
      if (!m[1].startsWith('+') && (d.length < 10 || d.length > 11)) continue;
      const labeled = near(i, /(電話|TEL|Tel|tel|FAX|Fax|fax|携帯|連絡先|ＴＥＬ|ＦＡＸ|番号)/, 14);
      if (isLong && !labeled && !/^0[5789]0/.test(d)) continue;
      if (col.hits.some((h) => h.start <= i && h.end > i)) continue;
      add(i, i + m[1].length, 'phone', 'high', labeled ? '「電話」などの近くにある番号' : '電話番号の形', 'phone');
    }
    // 漢数字だけで書いた番号（縦書き）：〇で始まる長い列
    const reKanTel = /(?<![〇一二三四五六七八九])〇[〇一二三四五六七八九ー\-－ｰ―]{8,14}(?![〇一二三四五六七八九])/g;
    while ((m = reKanTel.exec(t))) if (!col.hits.some((h) => h.start <= m.index && h.end > m.index)) add(m.index, m.index + m[0].length, 'phone', 'high', '漢数字で書かれた電話番号の形', 'phone-kan');
  }

  places(col, t, k) {
    // 住所はページの改行をまたぐことがあるので、\n を除いた版で探す
    const idx = []; let j = '';
    for (let i = 0; i < t.length; i++) if (t[i] !== '\n') { j += t[i]; idx.push(i); }
    idx.push(t.length);
    const add = (a, b, type, tier, reason, rule) => { if (/(委員会|裁判所|警察署|法務局)/.test(j.slice(a, b))) return null; return col.add(idx[a], idx[b - 1] + 1, type, tier, reason, rule); };
    const typeAt = (a) => (/(本\s*籍|従前戸籍)[^\t]{0,4}$/.test(j.slice(Math.max(0, a - 8), a)) ? 'honseki' : 'address');
    const labelAt = (a) => (/(住所|居所|所在地?|自宅|現住所|本\s*籍|従前戸籍|送付先|送達場所|引っ越し先|転居先)[\s:：はの]*$/.test(j.slice(Math.max(0, a - 12), a)));
    const reason = (ty) => (ty === 'honseki' ? '「本籍」の欄の地名' : '都道府県・市区町村＋番地の形の住所');
    let m;
    const seen = [];
    const take = (a, b, tier, rsn, rule) => { const ty = typeAt(a); if (seen.some(([x, y]) => a < y && b > x)) return; seen.push([a, b]); add(a, b, ty, tier, rsn || reason(ty), rule); };
    // ① 都道府県から始まる＋番地
    const re1 = new RegExp(`(${PREF})[^\\s\\t、。,()（）「」]{1,28}?${BANCHI}${BUILDING}`, 'g');
    while ((m = re1.exec(j))) take(m.index, m.index + m[0].length, 'high', null, 'addr-pref');
    // ② 23区・政令市・一般の市町村＋番地（都道府県なし）
    const re2 = new RegExp(`(?:${WARD23}|(?:${SEIREI})[${CJK}]{0,4}区?|[${CJK}]{1,4}市(?:[${CJK}]{1,3}区)?|[${CJK}]{1,3}郡[${CJK}]{1,3}[町村])[^\\s\\t、。,()（）「」]{0,18}?${BANCHI}${BUILDING}`, 'g');
    while ((m = re2.exec(j))) take(m.index, m.index + m[0].length, 'high', '市区町村＋番地の形の住所', 'addr-city');
    // ③ 「住所」「本籍」の欄の値（番地がなくても）
    const re3 = /(?:住所又は居所|現住所|住\s*所|居\s*所|所\s*在\s*地?|自宅|本\s*籍|従前戸籍|送付先|送達場所|住居所)[\s:：]*([^\t\n]{2,44})/g;
    const tl = t; // 欄の値は行内だけを見る
    while ((m = re3.exec(tl))) {
      let v = m[1]; let start = m.index + m[0].length - v.length;
      const lead = /^(?:である|であり|は|の|が|も)+/.exec(v);
      if (lead) { start += lead[0].length; v = v.slice(lead[0].length); }
      // 番地まであれば、そこで終わりにする（「…22番15号の玄関前」の「の玄関前」を取らない）
      const bm = new RegExp(`^[^\\t\\n]*?${BANCHI}${BUILDING}`).exec(v);
      if (bm) v = bm[0];
      const cut = v.search(/(であり|です|でした|にて|に住|に居|、|。|（|\()/);
      if (cut > 0) v = v.slice(0, cut);
      if (!/(都|道|府|県|市|区|町|村|郡|丁目|番)/.test(v)) continue;
      if (/(裁判所|記載のとおり|別紙|番号|委員会|警察|役所|^[（(])/.test(v)) continue;
      const a = idx.indexOf(start); if (a < 0) continue;
      const lab = m[0].slice(0, m[0].length - m[1].length);
      const ty = /(本\s*籍|従前戸籍)/.test(lab) ? 'honseki' : 'address';
      if (seen.some(([x, y]) => a < y && a + v.length > x)) continue;
      seen.push([a, a + v.length]); add(a, a + v.length, ty, 'high', ty === 'honseki' ? '「本籍」の欄の値' : '「住所」の欄の値', 'addr-label');
    }
    // ④ 都道府県＋市区町村だけ（番地なし）＝おおよその居場所が分かる
    const re4 = new RegExp(`(${PREF})[${CJK}${KANA}]{1,8}?(?:市|区|郡|町|村)(?:[${CJK}]{1,4}区)?`, 'g');
    while ((m = re4.exec(j))) {
      const a = m.index, b = a + m[0].length;
      if (seen.some(([x, y]) => a < y && b > x)) continue;
      if (/^(長|議会|役所|役場|立|民|公安|警察|知事|内)/.test(j.slice(b, b + 2))) continue;
      seen.push([a, b]); add(a, b, 'address', 'mid', '都道府県＋市区町村（おおよその居場所が分かる）', 'addr-city-only');
    }
    // 不動産の地番・家屋番号（所在が分かる）
    const reLot = /(地番|家屋番号)[\s:：]*([0-9〇一二三四五六七八九十百千]+番[0-9〇一二三四五六七八九十]*(?:の[0-9〇一二三四五六七八九十]+)?)/g;
    while ((m = reLot.exec(t))) { const i = m.index + m[0].length - m[2].length; col.add(i, i + m[2].length, 'address', 'mid', `「${m[1]}」の値`, 'addr-lot'); }
    // 銀行・支店
    const reBank = new RegExp(`[${CJK}${KANA}]{1,12}(?:銀行|信用金庫|信金|信用組合|信組|労働金庫|農業協同組合|ゆうちょ銀行|証券)[東西南北]?`, 'g');
    while ((m = reBank.exec(t))) {
      // OCR が読点を消すと「金五万円を鈴蘭信用金庫」のように続くので、最後の助詞より後ろだけを名前とする
      const cut = Math.max(m[0].lastIndexOf('の') > 0 ? m[0].lastIndexOf('の') : -1, ...['を', 'は', 'で', 'へ', 'に', '、', '。', '円', '人'].map((c) => m[0].lastIndexOf(c)));
      const st = m.index + cut + 1;
      if (m.index + m[0].length - st >= 3) col.add(st, m.index + m[0].length, 'bank', 'mid', '金融機関の名前（口座の特定につながる）', 'bank');
    }
    const reBranch = new RegExp(`[${CJK}${KANA}]{1,10}支店`, 'g');
    while ((m = reBranch.exec(t))) {
      if (/(本店|当|同|貴|各|弊|当該|御)支店$/.test(m[0])) continue;
      const cutB = Math.max(...['を', 'は', 'で', 'へ', 'に', '、', '。', '円', '行', '庫'].map((c) => m[0].lastIndexOf(c)));
      if (cutB >= 0) { m.index += cutB + 1; m[0] = m[0].slice(cutB + 1); if (m[0].length < 3) continue; }
      const ctx = t.slice(Math.max(0, m.index - 40), m.index + 40);
      if (/(銀行|信用|信金|信組|金庫|口座|普通|預金|振込|通帳)/.test(ctx)) col.add(m.index, m.index + m[0].length, 'bank', 'mid', '支店名（口座の特定につながる）', 'branch');
    }
  }

  birth(col, t) {
    let m;
    const reL = new RegExp(`(生年月日|誕生日|生\\s*年\\s*月\\s*日)[】\\]\\s:：は一ー-]*(${DATE}|(?:${ERA})\\s*(?:元|${NUM})\\s*年\\s*(?:${NUM})\\s*月\\s*(?:${NUM})?)`, 'g');
    while ((m = reL.exec(t))) { const i = m.index + m[0].length - m[2].length; col.add(i, i + m[2].length, 'birth', 'high', '「生年月日」の値', 'birth-label'); }
    const reD = new RegExp(`(生年月日|生年|出生|誕生日)[】\\]\\s:：は]*((?:${ERA})\\s*(?:元|[0-9]{1,2})\\s*年\\s*[0-9]{1,4}\\s*月?\\s*[0-9]{0,2}\\s*日?)`, 'g');
    while ((m = reD.exec(t))) { const i = m.index + m[0].length - m[2].length; if (!col.hits.some((h) => h.type === 'birth' && h.start === i)) col.add(i, i + m[2].length, 'birth', 'high', '「' + m[1] + '」の値（月日の字が読めていない可能性）', 'birth-partial'); }
    const reS0 = new RegExp(`((?:${ERA})\\s*(?:元|[0-9]{1,2})\\s*年\\s*[0-9]{3,4})(?=[、。)）\\s]|生)`, 'g');
    while ((m = reS0.exec(t))) if (/(生|被相続人|氏名|名)/.test(t.slice(Math.max(0, m.index - 10), m.index + m[0].length + 2))) col.add(m.index, m.index + m[0].length, 'birth', 'mid', '月日の字が読めていない日付', 'birth-partial2');
    // 「日」が読めなかった形（昭和24年10月30生）
    const reS1 = new RegExp(`((?:${ERA})\\s*(?:元|${NUM})\\s*年\\s*(?:${NUM})\\s*月\\s*(?:${NUM}))(?=生)`, 'g');
    while ((m = reS1.exec(t))) col.add(m.index, m.index + m[1].length, 'birth', 'mid', '月日のあとに「生」（日の字が読めていない）', 'birth-partial3');
    const reS = new RegExp(`(${DATE})\\s*(生まれ|生|出生)`, 'g');
    while ((m = reS.exec(t))) { if (!col.hits.some((h) => h.type === 'birth' && h.start === m.index)) col.add(m.index, m.index + m[1].length, 'birth', 'high', '日付のあとに「生」', 'birth-sei'); }
    const reAge = new RegExp(`(?:満\\s*)?(${NUM})\\s*歳(?!未満|以上|以下|超|から|まで)`, 'g');
    while ((m = reAge.exec(t))) col.add(m.index, m.index + m[0].length, 'age', 'mid', '年齢', 'age');
  }

  // ---- 氏名 ----
  isNameLike(s) {
    const clean = s.replace(/[\s　]/g, '');
    if (clean.length < 1 || clean.length > 10) return false;
    if (!isNameChars(clean)) return false;
    if (NOT_NAME.test(clean)) return false;
    if (NOT_NAME_PART.test(clean)) return false;
    if (/^[ぁ-ん]{1}$/.test(clean)) return false;
    if (/^[ー]/.test(clean)) return false;
    if (this.tk) {
      const ts = this.tokens(clean);
      const allKanji = /^[一-龥]+$/.test(clean); // 辞書にない漢字は「組織」と読まれるが、組織名の根拠にはならない
      if (ts.some((q) => q.pos === '助詞' || q.pos === '助動詞' || (q.pos === '動詞' && !(allKanji && q.s.length === 1)) || q.pos === '副詞' || q.pos === '接続詞' || q.pos === '連体詞' || (q.pos === '形容詞' && !(allKanji && q.s.length === 1)))) {
        if (!/^[ぁ-ん]{2,4}$/.test(clean)) return false;
      }
      if (ts.some((q) => q.d1 === '代名詞' || q.d1 === '数' || (q.d2 === '組織' && !(q.unk && allKanji)) || q.d1 === '非自立')) return false;
    }
    return true;
  }

  // 続柄の直後の漢字の並びが名前かどうか。名前なら長さを返す
  // direct は「長男悠斗」の形（の がない）。「長男の悠斗」は普通の語が来やすいので1文字ずつの語が2つ以上並ぶときだけ
  kinRun(t, toks, start, direct) {
    const run = new RegExp(`^[${CJK}]{1,5}`).exec(t.slice(start, start + 6));
    if (!run) return 0;
    let s = run[0].replace(/[君氏様殿]$/, '');
    if (!s || s.length > 4 || NOT_NAME.test(s) || NOT_NAME_PART.test(s) || KIN_NEXT_STOP.test(s)) return 0;
    const inRun = toks.filter((q) => q.at >= start && q.at < start + s.length);
    if (!inRun.length || inRun.some((q) => q.at + q.s.length > start + s.length)) return 0; // 「及び」のように並びの外まで続く語
    const common = inRun.some((q) => q.s.length >= 2 && !q.unk && q.d1 !== '固有名詞');
    // 「名義」「夫婦」「出生」のような普通の語。ただし「長男蒼空」のように名に使う語もあるので、の がない形で普通の名詞1語だけなら名前の候補に残す
    if (common && !(direct && inRun.length === 1 && inRun[0].d1 === '一般' && !KIN_WORD_STOP.test(s))) return 0;
    if (!['名詞', '接頭詞'].includes(inRun[0].pos) && !inRun[0].unk) return 0;
    if (inRun[0].d1 === '数' && /[人名歳才年回度件枚本個月日時分]$/.test(s)) return 0; // 「長男二人」
    if (direct) return s.length;
    if (s.length < 2 || NAME_HEAD_STOP.test(s[0]) || /[夫妻父母子兄弟姉妹孫]$/.test(s)) return 0;
    return s.length;
  }

  // 位置 end の手前にある名詞の連なりを、名前の候補として切り出す
  backNouns(t, toks, end, maxTok = 3) {
    let i = toks.findIndex((q) => q.at + q.s.length === end);
    if (i < 0) return null;
    let start = end, n = 0;
    while (i >= 0 && n < maxTok) {
      const q = toks[i];
      const okTok = (q.pos === '名詞' && q.d1 !== '代名詞' && q.d1 !== '数' && q.d1 !== '接尾' && q.d1 !== '非自立' && q.d1 !== 'サ変接続' && q.d1 !== '副詞可能') || q.unk;
      if (!okTok || !isNameChars(q.s)) break;
      if (n > 0 && NOT_NAME.test(q.s)) break;
      if (n > 0 && q.d1 === '一般' && !q.unk && q.s.length >= 2) break; // 「配偶者」のような普通の名詞は名前の前で止める
      start = q.at; n++; i--;
    }
    if (start === end) return null;
    return { start, end };
  }

  names(col, t, toks) {
    let m;
    // 辞書は名前を「悠／斗」「大／翔」「奏／太」と分けることがある。隣の1文字が漢字の並びの端までなら、同じ名前とみなす
    const isKanji = (c) => !!c && /^[一-龥]$/.test(c); // ヶ や 々 は入れない（「汐見ヶ丘」）
    const widen = (a, b) => {
      const nx = toks.find((q) => q.at === b);
      if (nx && nx.s.length === 1 && isKanji(nx.s) && nx.pos === '名詞' && nx.d1 !== '数' && nx.d2 !== '人名' && nx.d2 !== '地域' && !NAME_TAIL_STOP.test(nx.s) && !isKanji(t[b + 1]) && b - a <= 5) b += 1;
      let i = toks.findIndex((q) => q.at + q.s.length === a);
      if (i >= 0 && toks[i].s.length === 1 && isKanji(toks[i].s) && (toks[i].pos === '名詞' || toks[i].pos === '接頭詞') && toks[i].d2 !== '地域' && !NAME_HEAD_STOP.test(toks[i].s)) {
        const before = toks[i - 1];
        const adjacent = before && before.at + before.s.length === toks[i].at;
        if (!adjacent || !isKanji(t[toks[i].at - 1])) a = toks[i].at;
        else if (before.d2 === '人名' || before.d2 === '地域') a = before.at;
      }
      return [a, b];
    };
    const addName = (a0, b0, tier, reason, rule, type = 'name') => {
      if (!this.isNameLike(t.slice(a0, b0))) return null;
      let [a, b] = tier === 'low' ? [a0, b0] : widen(a0, b0);
      if (!this.isNameLike(t.slice(a, b))) { a = a0; b = b0; }
      return col.add(a, b, type, tier, reason, rule);
    };
    // ① 欄・役割のあと：「氏名 山田太郎」「申立人 山田太郎」
    const ROLE = /^(?:上記|同|代表者|代表取締役|代表社員|取締役|理事長|理事|代理人|法定代理人|復代理人|弁護士|司法書士|行政書士|税理士|社会保険労務士|医師|担当)[\s]*/;
    const PRO_ROLE = /(弁護士|司法書士|行政書士|税理士|社会保険労務士|医師)/;
    const valueAfter = (start0) => {
      // OCR は「代表者代表取締役伊藤大輔」のように空白を消す。肩書きを先に外してから名前を切り出す
      let start = start0, role = '', r;
      while ((r = ROLE.exec(t.slice(start, start + 12)))) { start += r[0].length; role += r[0]; }
      if (PRO_ROLE.test(role)) return null; // 専門職は ④ で別に扱う
      // 値は 空白1つまでをはさんだ2かたまり（「山田 太郎」）
      const re = new RegExp(`^[${CJK}${KANA}]{1,8}(?:[ 　][${CJK}${KANA}]{1,8})?`);
      const v = re.exec(t.slice(start, start + 22));
      if (!v) return null;
      let s = v[0];
      // 空白が消えて次の語まで続いているとき（「田中千代子昭和」）
      const next = s.search(/(昭和|平成|令和|大正|明治|西暦|生年|住所|電話|性別|続柄|交付|番号|勤務|職業|年齢|記号)/);
      if (next > 0) s = s.slice(0, next);
      const stop = s.search(/(様|殿|さん|さま|氏(?![名])|印|生|の|は|が|を|に|と|で|も|へ|（|\()/);
      if (stop > 0) {
        const tail = s.slice(stop);
        // 名前の中のひらがなは残す（「さくら」など）。助詞の位置で切る
        if (!/^[ぁ-ん]{2,4}$/.test(s)) s = s.slice(0, stop);
        void tail;
      }
      if (/\s/.test(s)) {
        // 「山田 太郎」は1つの名前。「田中千代子　昭和」のように次の語まで取らない
        const parts = s.split(/[ 　]/);
        if (parts[0].length > 4 || (parts[1] || '').length > 4 || !parts[1] || !this.isNameLike(parts[1]) || (parts[1].length === 1 && parts[1] === parts[0][0]) || /^(昭和|平成|令和|大正|明治|西暦|生年|住所|電話|男|女|性別|続柄|交付|番号)/.test(parts[1])) s = parts[0];
      }
      // 【 が読めず「父】斎藤清母】石川」のようになったとき、】の直前の1文字は次の欄の見出し
      if (t[start + s.length] === '】' && s.length >= 2) s = s.slice(0, -1);
      return { a: start, b: start + s.length };
    };
    // 戸籍の「【名】」は 【 】 が「一」に読まれたり消えたりする
    const reKosekiName = new RegExp(`記録されている者[\\s]*[一ー【\\[(]?\\s*名[】\\])一ー]?\\s*([${CJK}${KANA}]{1,8})`, 'g');
    while ((m = reKosekiName.exec(t))) { const i = m.index + m[0].length - m[1].length; if (this.isNameLike(m[1])) addName(i, i + m[1].length, 'high', '戸籍の「名」の欄の値', 'name-koseki'); }
    LABEL_NAME.lastIndex = 0;
    while ((m = LABEL_NAME.exec(t))) {
      const lab = m[1].replace(/\s/g, '');
      const start = m.index + m[0].length;
      const v = valueAfter(start);
      if (!v) continue;
      const after = t.slice(v.b, v.b + 2);
      const value = t.slice(v.a, v.b);
      if (lab === '姓' || lab === '名') { // 単独の「姓」「名」は欄らしいときだけ
        if (!/[\s/／:：]/.test(m[0].slice(lab.length, lab.length + 1) || '') && m[0].length === lab.length) continue;
        const before = t[m.index - 1] || '\n';
        if (!/[\s/／（(【]/.test(before)) continue;
      }
      // 「申立人である〜」「相手方は」は名前ではない
      if (/^(である|であり|は|が|の|を|に|と|も|へ|ら|等)/.test(value)) continue;
      if (/^(の|は|が|を|に)/.test(t.slice(start, start + 1))) continue;
      // 役割語の後ろは、名前らしさを強めに確かめる
      const strict = !/(氏名|お名前|名前|【名】|【父】|【母】|Surname|Givenname|筆頭者|世帯主|口座名義|名義)/.test(lab);
      if (strict && !this.personish(value)) continue;
      if (new RegExp(`^(${CORP})`).test(value) || new RegExp(`(${CORP})$`).test(value)) continue;
      addName(v.a, v.b, 'high', `「${lab}」のあとの名前`, 'name-label');
      void after;
    }
    // ② 敬称の前：「山田太郎氏」「佐藤さん」
    HONORIFIC.lastIndex = 0;
    while ((m = HONORIFIC.exec(t))) {
      let r = this.backNouns(t, toks, m.index);
      if (!r && /^(さん|君|ちゃん|くん)$/.test(m[1])) {
        // 「心／愛」「結／愛」のように接尾語に読まれる名：1文字ずつの語だけが並ぶときに限る
        const run = new RegExp(`[${CJK}]{2,3}$`).exec(t.slice(Math.max(0, m.index - 3), m.index));
        if (run && toks.filter((q) => q.at >= m.index - run[0].length && q.at < m.index).every((q) => q.s.length === 1)) r = { start: m.index - run[0].length, end: m.index };
      }
      if (!r) continue;
      // 「海／斗さん」のように1文字ずつに分かれたときは、前の1文字も名前に入れる
      const pv = toks.find((q) => q.at + q.s.length === r.start);
      if (r.end - r.start === 1 && /^(さん|君|ちゃん|くん)$/.test(m[1]) && pv && pv.s.length === 1 && isKanji(pv.s) && pv.pos === '名詞' && !NAME_HEAD_STOP.test(pv.s)) r = { start: pv.at, end: r.end };
      const s = t.slice(r.start, r.end);
      const oneKanjiName = /^(君|ちゃん|くん)$/.test(m[1]) && isKanji(s) && !NOT_ONE_KANJI_NAME.test(s);
      if (s.length < 2 && !this.personish(s) && !oneKanjiName) continue;
      if (m[1] === '先生' && !this.personish(s)) continue;
      if (m[1] === '氏' && /^(同|両|当|本|貴|各|上記|前記|氏)$/.test(s)) continue;
      addName(r.start, r.end, 'high', `敬称「${m[1]}」の前の名前`, 'name-hon');
    }
    // ②の2 役職の前：「井上課長」「吉岡教諭」
    const reTitle = /(課長|部長|係長|主任|社長|店長|次長|院長|所長|教諭|担任|相談員|看護師|保育士)/g;
    while ((m = reTitle.exec(t))) {
      const r = this.backNouns(t, toks, m.index, 2); if (!r) continue;
      const s0 = t.slice(r.start, r.end);
      if (s0.length >= 2 && this.personish(s0) && toks.some((q) => q.at >= r.start && q.at < r.end && (q.d2 === '人名' || q.d2 === '地域' || q.unk))) addName(r.start, r.end, 'mid', `役職「${m[1]}」の前の名前`, 'name-title');
    }
    // ③ 続柄のあと：「長男の健一」
    KIN.lastIndex = 0;
    while ((m = KIN.exec(t))) {
      const start = m.index + m[0].length;
      const q = toks.find((x) => x.at === start);
      // 「長女みどり」のようなひらがなの名は、名詞に分かれないことがある
      const hira = /^[ぁ-ん]{2,4}(?=[（(、。\s]|$)/.exec(t.slice(start, start + 6));
      if (hira) { addName(start, start + hira[0].length, 'mid', `続柄「${m[1].replace(/の$/, '')}」のあとの名前`, 'name-kin'); continue; }
      const kinName = this.kinRun(t, toks, start, !m[0].endsWith('の'));
      if (kinName) { col.add(start, start + kinName, 'name', 'mid', `続柄「${m[1].replace(/の$/, '')}」のあとの名前`, 'name-kin'); continue; }
      // ここまでで名前と読めなかった普通の語（「学校」「夫婦」「実家」）は、辞書で固有名とされるものだけ見る
      const proper = q && (q.unk || q.d1 === '固有名詞') && isNameChars(q.s);
      if (!proper) {
        // 「長男の蓮が」は「長男の件が」と見分けられないので、最初は隠さず候補にだけ出す
        if (/^(長男|長女|次男|次女|三男|三女|息子)の$/.test(m[0]) && isKanji(t[start]) && !isKanji(t[start + 1]) && /^[がはをとにも（(、]/.test(t.slice(start + 1, start + 2)) && !NOT_ONE_KANJI_NAME.test(t[start]) && !/^[件方分顔手話声前後時頃姿歳目耳口足頭体心友物服靴鞄机席為他家名]$/.test(t[start])) { col.add(start, start + 1, 'name', 'low', `続柄「${m[1].replace(/の$/, '')}」のあとの1文字（名前かもしれません）`, 'name-kin-lone'); continue; }
        continue;
      }
      let end = start + q.s.length;
      const nx = toks.find((x) => x.at === end);
      if (nx && nx.d2 === '人名') end += nx.s.length;
      if (this.personish(t.slice(start, end)) || /^[ぁ-ん]{2,4}$/.test(t.slice(start, end))) addName(start, end, 'mid', `続柄「${m[1].replace(/の$/, '')}」のあとの名前`, 'name-kin');
    }
    // ③の2 「母である三上ふみ子」：辞書が「三／上ふみ／子」と分けても、区切りまでを1つの名前として読む
    const reIs = /(母|父|夫|妻|兄|弟|姉|妹|娘|息子|祖父|祖母|叔父|叔母|長男|長女|次男|次女|三男|三女|友人|同僚|上司|部下)である/g;
    while ((m = reIs.exec(t))) {
      const start = m.index + m[0].length;
      const v = new RegExp(`^[${CJK}ァ-ヶー][${CJK}${KANA}]{1,7}?(?=[（(、。\\s]|は|が|を|に|と|の|も|さん|氏|様|$)`).exec(t.slice(start, start + 12));
      if (!v || NOT_NAME.test(v[0]) || NOT_NAME_PART.test(v[0])) continue;
      const ts = toks.filter((q) => q.at >= start && q.at < start + v[0].length);
      if (ts.length === 1 && !ts[0].unk && ts[0].d1 !== '固有名詞') continue; // 「母である女性」
      if (ts.some((q) => q.pos === '助詞' || q.pos === '助動詞' || q.pos === '動詞')) continue; // 「母である旨を述べた」
      col.add(start, start + v[0].length, 'name', 'mid', `続柄「${m[1]}である」のあとの名前`, 'name-kin');
    }
    // ④ 専門職：「弁護士 山田太郎」「医師 佐藤花子」
    PRO_BEFORE.lastIndex = 0;
    while ((m = PRO_BEFORE.exec(t))) {
      const start = m.index + m[0].length;
      const v = new RegExp(`^[${CJK}${KANA}]{1,6}(?:[ 　][${CJK}${KANA}]{1,6})?`).exec(t.slice(start, start + 16));
      if (!v) continue;
      const s = v[0].split(/(?:は|が|の|を|に|と|で|も|へ)/)[0];
      if (s && this.personish(s)) addName(start, start + s.length, 'mid', `「${m[1]}」のあとの氏名`, 'name-pro', 'proname');
    }
    // ⑤ 辞書：姓＋名の並び
    for (let i = 0; i < toks.length; i++) {
      const q = toks[i];
      const seiLike = q.d2 === '人名' && (q.d3 === '姓' || q.d3 === '一般');
      const placeLike = q.d2 === '地域' && q.s.length >= 2;
      if (!seiLike && !placeLike) continue;
      const nx = toks[i + 1]; if (!nx || nx.at !== q.at + q.s.length) {
        const nx2 = toks[i + 1];
        if (!(nx2 && t.slice(q.at + q.s.length, nx2.at).length === 1 && /[ 　]/.test(t[q.at + q.s.length]))) continue;
      }
      if (!nx) continue;
      const meiLike = (nx.d2 === '人名' && nx.d3 !== '姓') || (nx.unk && nx.s.length <= 3 && new RegExp(`^[${CJK}]+$`).test(nx.s));
      const seiMei = seiLike && nx.d2 === '人名';
      if (!meiLike && !seiMei) continue;
      addName(q.at, nx.at + nx.s.length, 'mid', '人名の辞書にある姓＋名の並び', 'name-dict');
    }
    // ⑤の2 姓＋辞書にない短い名（「伊藤拓海」が 伊藤／拓／海 に分かれる場合）
    for (let i = 0; i < toks.length; i++) {
      const q = toks[i];
      if (!(q.d2 === '人名' && q.d3 === '姓') || col.hits.some((h) => h.start <= q.at && h.end > q.at)) continue;
      let j = i + 1, end = q.at + q.s.length;
      while (j < toks.length && j <= i + 2 && toks[j].at === end && toks[j].pos === '名詞' && toks[j].d1 !== '接尾' && toks[j].d1 !== '数' && toks[j].s.length <= 2 && new RegExp(`^[${CJK}]+$`).test(toks[j].s)) { end += toks[j].s.length; j++; }
      const given = t.slice(q.at + q.s.length, end);
      if (j === i + 1 || given.length > 3) continue;
      const next = t[end] || '\n';
      if (new RegExp(`[${CJK}]`).test(next) || /[区市町村駅店社部課県橋局署庁院所長]$/.test(given)) continue;
      addName(q.at, end, 'mid', '人名の辞書にある姓＋短い名', 'name-dict2');
    }
    // ⑤の2b 姓 空白 名（「渡邊 美穂」）
    for (let i = 0; i < toks.length; i++) {
      const q = toks[i]; if (!(q.d2 === '人名' && q.d3 === '姓')) continue;
      const after = q.at + q.s.length; const r2 = new RegExp(`^[ 　]([${CJK}]{1,3}|[ぁ-ん]{2,4})(?![${CJK}]|[ 　][${CJK}])`).exec(t.slice(after, after + 8));
      // 「陳 述 書」「金 通 帳」のような字間を空けた見出しは名前にしない
      if (r2 && (q.s.length >= 2 || r2[1].length >= 2) && !new RegExp(`[ 　][${CJK}]$`).test(t.slice(Math.max(0, q.at - 2), q.at))) addName(q.at, after + r2[0].length, 'mid', '姓のあとに空白と名', 'name-sp');
    }
    // ⑤の4 姓＋ひらがなの名（「池田さくら」）
    for (let i = 0; i < toks.length; i++) {
      const q = toks[i]; if (!(q.d2 === '人名' && q.d3 === '姓')) continue;
      const after = q.at + q.s.length; const hira = /^[ぁ-ん]{2,4}/.exec(t.slice(after, after + 5));
      if (!hira) continue;
      // 助詞で始まるものは名前にしない（「田中さんは」「佐藤のもと」）
      if (/^(さん|さま|ちゃん|くん|の|は|が|を|に|と|で|も|へ|や|から|まで|より|など|こと|もの|ため)/.test(hira[0])) continue;
      addName(q.at, after + hira[0].length, 'mid', '姓のあとにひらがなの名', 'name-hira');
    }
    // ⑤の5 フリガナの欄の次の行は氏名
    const reFuri = /(?:フリガナ|ふりがな)[）)\s:：]*[ァ-ヶー 　]{2,24}[\t\n]+\s*([^\t\n]{2,12})/g;
    while ((m = reFuri.exec(t))) { const i = m.index + m[0].length - m[1].length; const v = m[1].trim(); if (this.isNameLike(v)) addName(i, i + m[1].length, 'high', '「フリガナ」の下の氏名', 'name-furi'); }
    // ⑤の6 名だけの呼び名：辞書の人名のあとに助詞（「明美の面会は」）
    for (let i = 0; i < toks.length; i++) {
      const q = toks[i]; if (q.d2 !== '人名' || q.s.length < 2) continue;
      const prev = toks[i - 1], next = toks[i + 1];
      if (!next || next.pos !== '助詞' || !/^(の|は|が|を|に|と|も|から|へ)$/.test(next.s)) continue;
      if (prev && prev.at + prev.s.length === q.at && prev.pos === '名詞') continue;
      if (col.hits.some((h) => h.start <= q.at && h.end > q.at)) continue;
      addName(q.at, q.at + q.s.length, 'mid', '人名の辞書にある語のあとに助詞', 'name-particle');
    }
    // ⑤の7 よくある名前のあとに助詞（辞書では地名扱いの「明美」、分かれてしまう「拓海」など）
    const reGiven = new RegExp(`(?<![${CJK}])(${GIVEN_NAMES})(?=の|は|が|を|に|と|も|から|へ|や|、|。|さん|ちゃん|くん|君|[（(\\t\\n]|$)`, 'g');
    while ((m = reGiven.exec(t))) { if (!col.hits.some((h) => h.start <= m.index && h.end > m.index)) addName(m.index, m.index + m[1].length, 'mid', 'よくある名前のあとに助詞', 'name-given'); }
    // ⑤の3 欄や吹き出しの中身が人名だけ（LINEの相手の名前など）
    const cellRe = /[^\t\n]+/g;
    while ((m = cellRe.exec(t))) {
      const s = m[0].trim().replace(/(様|さま|さん|殿|君|ちゃん|くん)$/, ''); const a = m.index + m[0].indexOf(s);
      if (s.length < 2 || s.length > 8 || col.hits.some((h) => h.start <= a && h.end > a)) continue;
      const ts = toks.filter((q) => q.at >= a && q.at < a + s.length);
      if (ts.length && ts.length <= 3 && ts[0].d2 === '人名' && ts.every((q) => q.pos === '名詞') && this.isNameLike(s)) addName(a, a + s.length, 'mid', '欄の中身が人名だけ', 'name-cell-only');
    }
    // ⑥ 辞書：姓だけ・名だけ（2文字以上）。誤検出が多いので low
    for (const q of toks) if (q.d2 === '人名' && q.s.length >= 2 && !col.hits.some((h) => h.start <= q.at && h.end > q.at)) {
      addName(q.at, q.at + q.s.length, 'low', '人名の辞書にある語（前後から名前と断定できない）', 'name-dict-lone');
    }
    const reLatin = /(Surname|Given\s*name)[^A-Za-z]{0,8}([A-Z][A-Z-]{1,24})/g;
    while ((m = reLatin.exec(t))) { const i = m.index + m[0].length - m[2].length; col.add(i, i + m[2].length, 'kana', 'high', '旅券の氏名欄', 'name-latin'); }
    // 給与の振込元（勤務先が分かる）
    const rePay = /(給与|賞与|キュウヨ)[\s]*((?:[カ力ｶ][)）]|[(（][カ力ｶ][)）])[ァ-ヶー]{2,20})/g;
    while ((m = rePay.exec(t))) { const i = m.index + m[0].length - m[2].length; col.add(i, i + m[2].length, 'workplace', 'mid', '給与の振込元の会社名', 'work-pay'); }
    // ⑦ カナ氏名：「フリガナ ヤマダ タロウ」「振込 ヤマダ タロウ」
    const reKana = /(フリガナ|ふりがな|カナ氏名|氏名カナ|カナ|振込|振替|フリコミ|送金|ご依頼人|口座名義|名義人|名義)[）)\s:：]*([ァ-ヶー]{2,10}[ 　]?[ァ-ヶー]{0,10})/g;
    while ((m = reKana.exec(t))) { const i = m.index + m[0].length - m[2].length; col.add(i, i + m[2].length, 'kana', 'high', `「${m[1]}」のあとのカタカナの氏名`, 'name-kana'); }
  }

  personish(s) {
    const clean = s.replace(/[\s　]/g, '');
    if (!isNameChars(clean)) return false;
    if (NOT_NAME.test(clean) || NOT_NAME_PART.test(clean)) return false;
    if (!this.tk) return clean.length >= 2 && clean.length <= 8;
    const ts = this.tokens(clean);
    if (!ts.length || ts.length > 4) return false;
    if (ts.some((q) => q.d2 === '人名')) return true;
    // 辞書にない語（珍しい名前）
    if (ts.every((q) => q.unk || q.d2 === '地域' || q.d1 === '固有名詞')) return true;
    // 全部が1〜2文字の漢字名詞で、合わせて2〜5文字（「東海林 芽依」など）
    if (clean.length >= 2 && clean.length <= 5 && new RegExp(`^[${CJK}]+$`).test(clean) && ts.every((q) => q.pos === '名詞' && q.d1 !== 'サ変接続' && q.d1 !== '形容動詞語幹' && q.d1 !== '接尾')) return ts.some((q) => q.s.length <= 2) && !ts.some((q) => q.d1 === '一般' && q.s.length >= 3);
    if (/^[ぁ-ん]{2,4}$/.test(clean)) return true;
    return false;
  }

  schoolWork(col, t, toks) {
    let m;
    // 学校・園
    const reSch = new RegExp(`[${CJK}${KANA}]{0,14}?(小学校|中学校|高等学校|高校|幼稚園|保育園|保育所|こども園|専門学校|大学)`, 'g');
    while ((m = reSch.exec(t))) {
      const end = m.index + m[0].length;
      const nameEnd = end - m[1].length;
      // 校名は「楓が丘」「緑の森」のように「が・の・ヶ」をはさむことがある
      const run = new RegExp(`[${CJK}ァ-ヶー]+(?:[がのヶケ][${CJK}ァ-ヶー]+)*$`).exec(t.slice(Math.max(0, nameEnd - 16), nameEnd));
      let start = run ? nameEnd - run[0].length : -1;
      if (start >= 0) { const hp = /(?:^|[はにをがのと、。\s])([ぁ-ん]{3,8})$/.exec(t.slice(Math.max(0, start - 10), start)); if (hp) start -= hp[1].length; }
      if (start < 0) continue;
      if (!t.slice(start, nameEnd)) continue;
      col.add(start, end, 'school', 'mid', '学校・園の名前（居場所の手がかり）', 'school');
    }
    // 会社名
    const reCorp = new RegExp(`(?:(${CORP})[ 　]?([${CJK}${KANA}A-Za-z0-9・]{1,16})|([${CJK}${KANA}A-Za-z0-9・]{1,16}?)(${CORP}))`, 'g');
    while ((m = reCorp.exec(t))) {
      const a = m.index; let b = a + m[0].length;
      if (m[1]) { // 前株：「株式会社ソレイユ物流に勤務」の「に勤務」を会社名に入れない
        const cutAt = m[2].search(/(に|で|を|は|が|と|も|へ|から|まで|より|など|の(?:[^ぁ-ん]|$))/);
        if (cutAt > 0) b = a + m[0].length - m[2].length + cutAt;
      }
      let start = a;
      if (m[3]) {
        // 会社名は普通の名詞も含むので、ひらがな以外が続く範囲を会社名とみなす
        const tail = new RegExp(`[${CJK}ァ-ヶーA-Za-z0-9・]+(?:[のがヶケ][${CJK}ァ-ヶーA-Za-z0-9・]+)*$`).exec(m[3]);
        // 「私は株式会社ソレイユ物流に」：前がひらがなで終わるなら、会社の種類が名前の前にある形
        start = tail ? a + tail.index : b - m[4].length;
        // 「事業所名称株式会社…」のように見出しが続くことがあるので、全部外す
        for (let lead; (lead = /^(債権者|債務者|申立人|相手方|原告|被告|賃貸人|賃借人|勤務先|職場|会社名|事業所|名称|上記|本件|当社|弊社|貴社|当時|現在|以前|先月|今月|来月|去年|昨年|今年|今は|今)/.exec(t.slice(start, b)));) start += lead[0].length;
        // 会社の種類だけになったら、後ろの名前まで広げる
        if (new RegExp(`^(${CORP})$`).test(t.slice(start, b))) {
          const nm = new RegExp(`^[ 　]?[${CJK}${KANA}A-Za-z0-9・]{1,16}`).exec(t.slice(b, b + 18));
          if (nm) { const c2 = nm[0].search(/(に|で|を|は|が|と|も|へ|から|まで|より|など|の(?:[^ぁ-ん]|$))/); const len = c2 > 0 ? c2 : nm[0].length; if (c2 !== 0) b += len; }
        }
      }
      const before = t.slice(Math.max(0, start - 14), start);
      const after = t.slice(b, b + 8);
      if (/(勤務先|勤め先|職場|会社名|事業所|就業先|名称|所属|支払者)[\s:：はである]*$/.test(before) || /^[\s（）()]*(に勤|で勤|で働|に就|に入社|入社|入職|退職|在籍|勤務|総務|営業|人事|経理|のまま)/.test(after) || /(会社は|職場は|勤め先は|勤務先は|転職先は)\s*$/.test(before)) {
        col.add(start, b, 'workplace', 'mid', '勤務先と分かる会社名', 'work-label');
      } else if (/(債権者|債務者|申立人|相手方|原告|被告|賃貸人|賃借人)\s*$/.test(before)) {
        col.add(start, b, 'corp', 'mid', '当事者の会社名（法人名は原則隠さない。全部隠す場面のみ）', 'corp-party');
      } else col.add(start, b, 'corp', 'low', '会社・団体の名前（ふつうは隠さない）', 'corp');
    }
    // 「東都テクノ工業(株)」の形
    const reKabu = new RegExp(`([${CJK}ァ-ヶーA-Za-z0-9・]{2,16})\\((?:株|有|合)\\)`, 'g');
    while ((m = reKabu.exec(t))) {
      const after = t.slice(m.index + m[0].length, m.index + m[0].length + 14);
      const work = /^[\s]*[一-龥々]{1,10}(部|課|室|係|支店|営業所|工場)/.test(after) || /(勤務先|勤め先|職場|会社は)[\s:：は]*$/.test(t.slice(Math.max(0, m.index - 8), m.index));
      col.add(m.index, m.index + m[0].length, work ? 'workplace' : 'corp', work ? 'mid' : 'low', work ? '部署名が続く会社名' : '会社・団体の名前（ふつうは隠さない）', work ? 'work-kabu' : 'corp');
    }
    // 「勤務先」の欄の値で会社の形でないもの
    const reW = new RegExp(`(勤務先|勤め先|職場|会社名|事業所名称|事業所|就業先)[\\s:：はである]*([${CJK}${KANA}A-Za-z0-9・]{2,20})`, 'g');
    while ((m = reW.exec(t))) {
      const i = m.index + m[0].length - m[2].length;
      if (!/(電話|番号|名称|住所|との|に|へ|から)/.test(m[2]) && !col.hits.some((h) => h.start <= i && h.end > i && h.type === 'workplace')) col.add(i, i + m[2].length, 'workplace', 'mid', `「${m[1]}」の値`, 'work-value');
    }
    // 振込相手の会社
    const reF = /(振込|振替)[\s]*([^\t\n]{2,20}[（(][カ力ｶ]|[（(][カ力ｶ][）)][^\t\n]{1,20})/g;
    while ((m = reF.exec(t))) { const i = m.index + m[0].length - m[2].length; col.add(i, i + m[2].length, 'workplace', 'mid', '振込相手の会社名', 'work-transfer'); }
  }

  // 表：見出しの欄の真下・右の欄を値として読む（flow で繋がらない場合の補い）
  spatialLabels(col, lines, flow) {
    const add = (ln, type, tier, reason, rule) => {
      const a = flow.map.findIndex((q) => q && q.l === ln); if (a < 0) return;
      let b = a; while (b + 1 < flow.map.length && flow.map[b + 1] && flow.map[b + 1].l === ln) b++;
      col.add(a, b + 1, type, tier, reason, rule);
    };
    lines.forEach((L, i) => {
      const lab = L.text.replace(/\s/g, '').replace(/[:：]$/, '');
      const isName = /^(氏名|お名前|患者氏名|契約者氏名|名前)$/.test(lab);
      const isAddr = /^(住所|現住所|本籍|所在地|住所又は居所)$/.test(lab);
      if (!isName && !isAddr) return;
      const [x0, y0, x1, y1] = L.box; const h = y1 - y0;
      let best = -1, bd = 1e9;
      lines.forEach((M, j) => {
        if (j === i) return;
        const [a0, b0, a1, b1] = M.box;
        const cy = (b0 + b1) / 2;
        const right = a0 >= x1 - h * 0.2 && cy > y0 && cy < y1; // 右隣
        const below = b0 >= y1 - h * 0.2 && b0 < y1 + h * 3 && a0 < x1 + h && a1 > x0 - h; // 真下
        if (!(right || below)) return;
        const d = right ? a0 - x1 : (b0 - y1) * 2 + h;
        if (d < bd) { bd = d; best = j; }
      });
      if (best < 0) return;
      const v = lines[best].text.trim();
      if (isName && v.replace(/\s/g, '').length >= 2 && !/^[一-龥]$/.test(v) && this.isNameLike(v.replace(/(様|殿)$/, ''))) add(best, 'name', 'high', `表の「${lab}」の欄の値`, 'name-cell');
      if (isAddr && /(都|道|府|県|市|区|町|村|丁目|番)/.test(v) && !/番号|^[（(]/.test(v)) add(best, /本籍/.test(lab) ? 'honseki' : 'address', 'high', `表の「${lab}」の欄の値`, 'addr-cell');
    });
  }

  // 住所や日付が欄の中で折り返しているとき、真下（縦書きは左）の短い行を続きとして取る
  continuations(col, lines, flow) {
    const endLine = (h) => { for (let i = h.end - 1; i >= h.start; i--) if (flow.map[i]) return flow.map[i].l; return -1; };
    for (const h of [...col.hits]) {
      if (!['address', 'honseki', 'birth'].includes(h.type)) continue;
      const li = endLine(h); if (li < 0) continue; const L = lines[li];
      // その行の最後まで届いている検出だけ
      const lastIdx = flow.map.reduce((m, q, i) => (q && q.l === li ? i : m), -1);
      if (lastIdx >= h.end + 1) continue;
      const th = L.vertical ? L.box[2] - L.box[0] : L.box[3] - L.box[1];
      const next = lines.findIndex((M, j) => {
        if (j === li || !M.text) return false;
        if (L.vertical) return M.vertical && M.box[2] <= L.box[0] + th * 0.3 && L.box[0] - M.box[2] < th * 1.2 && Math.abs(M.box[1] - L.box[1]) < th * 1.5;
        return !M.vertical && M.box[1] >= L.box[3] - th * 0.3 && M.box[1] - L.box[3] < th * 0.9 && Math.abs(M.box[0] - L.box[0]) < th * 1.2;
      });
      if (next < 0) continue;
      const v = lines[next].text.trim();
      const a = flow.map.findIndex((q) => q && q.l === next); if (a < 0) continue;
      let b = a; while (b + 1 < flow.map.length && flow.map[b + 1] && flow.map[b + 1].l === next) b++;
      if (h.type === 'birth') {
        const r = /^\s*(?:[0-9〇一二三四五六七八九十]+\s*)?日/.exec(v);
        if (r && !/日$/.test(h.text)) col.add(a, a + r[0].length, 'birth', 'high', '前の行からの続き', 'cont-birth');
      } else if (v.length <= 26 && /(号室|号棟|階|[FＦ]|棟|号|番地?[0-9〇一二三四五六七八九十]*|[0-9]{2,4})$/.test(v) && !/(電話|番号|氏名|生年|TEL|FAX|令和|平成|昭和|構造|面積|造|㎡|委員会|警察|円|有効|交付|[0-9]\.[0-9])/.test(v) && !/(号室|階)$/.test(h.text)) {
        col.add(a, b + 1, h.type, 'high', '前の行からの続き', 'cont-addr');
      }
    }
  }

  // 欄の名前として覚えてよいか：人名・地名や数字を含むものは覚えない（端末に原文を残さないため）
  isSafeLabel(label) {
    const s = (label || '').trim();
    if (s.length < 2 || s.length > 8 || /[0-9０-９@]/.test(s)) return false;
    if (!new RegExp(`^[${CJK}${KANA}A-Za-z]+$`).test(s)) return false;
    if (!this.tk) return false;
    const ts = this.tokens(s);
    if (ts.some((q) => q.d2 === '人名' || q.d2 === '地域' || q.d2 === '組織' || q.unk)) return false;
    return ts.every((q) => q.pos === '名詞');
  }

  // 全ページをまとめて処理：1回目で見つけた人名を2回目で全ページに広げる
  run(docs, { roster = [], keepWords = [], forceWords = [], learnedLabels = [] } = {}) {
    this.learned = learnedLabels;
    const pagesOut = [];
    docs.forEach((doc, di) => doc.pages.forEach((p, pi) => {
      const r = this.scanPage(p.lines, pi, di);
      pagesOut.push({ di, pi, ...r, lines: p.lines });
    }));
    // 人の一覧を作る
    const people = new Map(); // key: つなげた氏名
    const addPerson = (full, source) => {
      full = full.replace(/(さん|さま|ちゃん|くん|様|殿)$/, '');
      const s = full.replace(/[\s　]/g, ''); if (s.length < 2 || !isNameChars(s)) return;
      if (!people.has(s)) people.set(s, { full: s, sources: new Set(), count: 0, ...this.splitName(full) });
      people.get(s).sources.add(source); people.get(s).count++;
    };
    for (const name of roster) addPerson(name, '指定');
    for (const pg of pagesOut) for (const h of pg.hits) {
      if ((h.type === 'name' || h.type === 'proname') && (h.tier === 'high' || h.tier === 'mid') && h.text.replace(/\s/g, '').length >= 2) {
        addPerson(h.text, h.rule);
        const key = h.text.replace(/[\s　]/g, '');
        if (key.replace(/(さん|さま|ちゃん|くん|様|殿)$/, '') !== key) continue;
        if (people.has(key)) { if (h.type === 'proname') people.get(key).asPro = true; else if (!/^name-(dict|cell-only)/.test(h.rule)) people.get(key).asParty = true; }
      }
    }
    // 続柄のあとで見つけた1文字の名（「長女凛」）は、同じ書類の中の同じ名も拾う
    const singles = new Set();
    for (const pg of pagesOut) for (const h of pg.hits) if (h.rule === 'name-kin' && h.text.trim().length === 1) singles.add(h.text.trim());
    for (const c of singles) if (![...people.values()].some((p) => p.mei === c)) people.set('\u0000' + c, { full: c, mei: c, sei: null, sources: new Set(['name-kin']), count: 1 });
    // 広げる
    for (const pg of pagesOut) this.propagate(pg, people);
    // 勤務先として見つけた会社は、「株式会社」を省いた呼び名（ソレイユ物流）も全書類で拾う
    const works = new Set();
    for (const pg of pagesOut) for (const h of pg.hits) if (h.type === 'workplace') {
      const core = pg.flow.text.slice(h.start, h.end).replace(/\s/g, '').replace(new RegExp(`(${CORP}|\\(株\\)|\\(有\\))`, 'g'), '');
      if (core.length >= 3 && core.length <= 16 && new RegExp(`^[${CJK}${KANA}A-Za-z0-9・]+$`).test(core)) works.add(core);
    }
    for (const pg of pagesOut) for (const w of works) for (const [a, b] of this.findLoose(pg.flow.text, w)) {
      // 「株式会社」が前にあれば一緒に隠す
      const pre = new RegExp(`(${CORP})[ 　]?$`).exec(pg.flow.text.slice(Math.max(0, a - 12), a));
      const st = pre ? a - pre[0].length : a;
      pg.hits.push({ type: 'workplace', tier: 'mid', reason: '勤務先と同じ会社の呼び名', rule: 'prop-work', page: pg.pi, doc: pg.di, start: st, end: b, text: pg.flow.text.slice(st, b) });
    }
    // 指定語
    for (const pg of pagesOut) for (const w of forceWords) {
      const needle = w.replace(/[\s　]/g, ''); if (!needle) continue;
      this.findLoose(pg.flow.text, needle).forEach(([a, b]) => pg.hits.push({ type: 'word', tier: 'high', reason: '指定した語', rule: 'force', page: pg.pi, doc: pg.di, start: a, end: b, text: pg.flow.text.slice(a, b) }));
    }
    const out = [];
    for (const pg of pagesOut) {
      const merged = mergeHits(pg.hits);
      for (const h of merged) {
        if (keepWords.some((w) => w && h.text.replace(/\s/g, '').includes(w.replace(/\s/g, '')))) continue;
        const rects = hitRects(h, pg.flow, pg.lines);
        if (!rects.length) continue;
        // 重なりをまとめると範囲が広がるので、文字も範囲に合わせて取り直す
        out.push({ ...h, text: pg.flow.text.slice(h.start, h.end).replace(/\s+/g, ' ').trim(), rects, label: CATEGORIES[h.type]?.label || h.type });
      }
    }
    return { hits: out, people: [...people.values()].filter((p) => p.full.length >= 2).map((p) => ({ ...p, sources: [...p.sources] })) };
  }

  splitName(full) {
    const parts = full.trim().split(/[ 　]+/);
    if (parts.length >= 2) return { sei: parts[0], mei: parts.slice(1).join('') };
    const s = full.trim();
    if (this.tk) {
      const ts = this.tokens(s);
      if (ts.length >= 2 && (ts[0].d3 === '姓' || ts[0].d2 === '地域' || ts[0].d2 === '人名' || ts[0].unk || ts[0].d1 === '一般')) return { sei: ts[0].s, mei: ts.slice(1).map((q) => q.s).join('') };
    }
    return { sei: null, mei: null };
  }

  findLoose(text, needle) {
    // 間の空白・タブ・改行を許して探す
    const out = []; const re = new RegExp([...needle].map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s]{0,2}'), 'g'); let m;
    while ((m = re.exec(text))) out.push([m.index, m.index + m[0].length]);
    return out;
  }

  propagate(pg, people) {
    const t = pg.flow.text;
    const put = (a, b, type, tier, reason, rule) => pg.hits.push({ type, tier, reason, rule, page: pg.pi, doc: pg.di, start: a, end: b, text: t.slice(a, b).replace(/\s+/g, ' ') });
    for (const p of people.values()) {
      // 弁護士・医師などとしてだけ出てくる人は、専門職のまま広げる
      const ty = p.asPro && !p.asParty ? 'proname' : 'name', tier = ty === 'proname' ? 'mid' : 'high';
      if (p.full.length >= 2) for (const [a, b] of this.findLoose(t, p.full)) put(a, b, ty, tier, `同じ書類で見つけた氏名「${p.full}」と同じ`, 'prop-full');
      // 姓だけ・名だけ（2文字以上。別の語の一部になっていないか前後を見る）
      for (const [part, which] of [[p.sei, '姓'], [p.mei, '名']]) {
        if (!part || part.length < 2) continue;
        for (const [a, b] of this.findLoose(t, part)) {
          const before = t[a - 1] || '', after = t[b] || '';
          const wrapped = (new RegExp(`[${CJK}]`).test(before) && !/[名者氏父母夫妻]/.test(before)) || (which === '姓' && new RegExp(`[${CJK}]`).test(after) && !/[様殿氏君]/.test(after));
          if (wrapped) continue;
          put(a, b, ty, 'mid', `同じ書類で見つけた氏名「${p.full}」の${which}と同じ`, 'prop-part');
        }
      }
      if (p.mei && p.mei.length === 1) {
        const re1 = new RegExp(`(?:(?<![${CJK}${KANA}])|(?<=[とやもはがのをに、]|長女|長男|次女|次男|三女|三男|夫|妻))${p.mei}(?=が|は|を|に|と|の|も|さん|ちゃん|くん|君|[（(、。\\t\\n]|$)`, 'g'); let q;
        while ((q = re1.exec(t))) put(q.index, q.index + 1, ty, 'mid', `同じ書類で見つけた氏名「${p.full}」の名と同じ（1文字）`, 'prop-part1');
      }
      // 読み間違い：1文字違いまで（3文字以上の氏名）
      if (p.full.length >= 3) {
        for (let i = 0; i + p.full.length <= t.length; i++) {
          const seg = t.slice(i, i + p.full.length);
          if (/[\s]/.test(seg)) continue;
          let diff = 0; for (let k = 0; k < seg.length && diff < 2; k++) if (seg[k] !== p.full[k]) diff++;
          if (diff === 1 && new RegExp(`^[${CJK}${KANA}]+$`).test(seg) && (seg[0] === p.full[0] || seg[seg.length - 1] === p.full[p.full.length - 1])) {
            const before = t[i - 1] || ''; if (new RegExp(`[${CJK}]`).test(before)) continue;
            put(i, i + seg.length, ty, 'mid', `氏名「${p.full}」と1文字違い（読み間違いの可能性）`, 'prop-fuzzy');
          }
        }
      }
    }
  }
}

const TIER_RANK = { high: 3, mid: 2, low: 1 };
const TYPE_RANK = { mynumber: 9, license: 8, passport: 8, pension: 8, jukicode: 8, account: 7, insurance: 7, phone: 7, email: 7, address: 6, honseki: 6, postal: 6, birth: 6, name: 5, kana: 5, proname: 5.5, workplace: 4, school: 4, bank: 3, corp: 1 };
// 重なった検出を1つにまとめる：確かさが上のものを主にし、範囲は広い方に合わせる
export function mergeHits(hits) {
  const sorted = [...hits].sort((a, b) => a.start - b.start || b.end - a.end);
  const out = [];
  for (const h of sorted) {
    const prev = out[out.length - 1];
    if (prev && h.start < prev.end) {
      const pr = [TIER_RANK[prev.tier], TYPE_RANK[prev.type] || 0], nr = [TIER_RANK[h.tier], TYPE_RANK[h.type] || 0];
      const hBetter = nr[0] > pr[0] || (nr[0] === pr[0] && nr[1] > pr[1]);
      if (prev.type === 'corp' || h.type === 'corp' || h.tier === 'low' || prev.tier === 'low') {
        if (hBetter) { const merged = { ...h, start: Math.min(prev.start, h.start), end: Math.max(prev.end, h.end) }; merged.text = merged.text; out[out.length - 1] = merged; } else prev.end = Math.max(prev.end, h.end);
        continue;
      }
      if (hBetter) { out[out.length - 1] = { ...h, start: Math.min(prev.start, h.start), end: Math.max(prev.end, h.end) }; } else prev.end = Math.max(prev.end, h.end);
      continue;
    }
    out.push({ ...h });
  }
  return out;
}

// 検出の文字範囲→黒塗りの四角（行ごとに1つ）。読み取りのズレを見越して少し広げる
export function hitRects(h, flow, lines) {
  const byLine = new Map();
  for (let i = h.start; i < h.end; i++) {
    const q = flow.map[i]; if (!q) continue;
    if (!byLine.has(q.l)) byLine.set(q.l, []);
    byLine.get(q.l).push(q.c);
  }
  const rects = [];
  for (const [l, cs] of byLine) {
    const L = lines[l]; const c0 = Math.min(...cs), c1 = Math.max(...cs);
    const a = L.chars[c0]?.box, b = L.chars[c1]?.box; if (!a || !b) continue;
    let x0 = Math.min(a[0], b[0]), y0 = Math.min(a[1], b[1]), x1 = Math.max(a[2], b[2]), y1 = Math.max(a[3], b[3]);
    const lineThick = L.vertical ? L.box[2] - L.box[0] : L.box[3] - L.box[1];
    const pad = lineThick * (L.exact ? 0.12 : 0.14); // OCR の文字位置には誤差があるので前後に少し余裕を持たせる
    if (L.vertical) { x0 = L.box[0]; x1 = L.box[2]; y0 -= pad; y1 += pad; } else { y0 = L.box[1]; y1 = L.box[3]; x0 -= pad; x1 += pad; }
    rects.push([x0, y0, x1, y1]);
  }
  return rects;
}
