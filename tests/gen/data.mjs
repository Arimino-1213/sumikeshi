// 架空データの生成。実在の個人情報を使わないための決まり：
// ・電話は「市内局番が0で始まる番号」「090-0xxx」＝割り当てのない形だけを使う
// ・メールは example.com / example.jp（RFC 2606 の予約ドメイン）
// ・住所は実在の市区＋架空の町名
// ・銀行・会社・学校はすべて架空名
// ・個人番号は検査用数字だけ正しい乱数（実在の番号と照合していない）
export function rng(seed) {
  let s = seed >>> 0;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  r.pick = (a) => a[Math.floor(r() * a.length)];
  r.int = (a, b) => a + Math.floor(r() * (b - a + 1));
  r.digits = (n) => Array.from({ length: n }, () => r.int(0, 9)).join('');
  return r;
}
export const POOLS = {
  dev: {
    sei: ['山田', '佐藤', '鈴木', '高橋', '田中', '伊藤', '渡辺', '中村', '小林', '加藤', '吉田', '松本', '長谷川', '五十嵐', '小野寺'],
    mei: ['太郎', '花子', '健一', '美咲', '翔太', '陽菜', '一郎', '和子', '大輔', '由美', '蓮', '葵', '正雄', '千代子', '拓海'],
    kanaSei: ['ヤマダ', 'サトウ', 'スズキ', 'タナカ'], kanaMei: ['タロウ', 'ハナコ', 'ケンイチ', 'ミサキ'],
    town: ['夢見丘', '桜並木', '緑ヶ原', '青葉台南', '光が丘東'],
    city: [['東京都', '新宿区'], ['東京都', '世田谷区'], ['大阪府', '大阪市北区'], ['神奈川県', '横浜市中区'], ['愛知県', '名古屋市中区'], ['福岡県', '福岡市博多区']],
    bld: ['サンライズ', 'グランメゾン', 'コーポ', 'パークハイツ'],
    corp: ['夢見丘商事', '桜並木工業', '緑ヶ原物産'], bank: ['みらい中央銀行', 'あおぞら信用金庫東'], school: ['夢見丘第二小学校', '桜並木中学校'],
  },
  held: {
    sei: ['木村', '斎藤', '清水', '山口', '森', '池田', '橋本', '阿部', '石川', '前田', '藤原', '東海林', '四方田', '武者小路', '西園寺', '工藤', '金子'],
    mei: ['誠', '恵子', '浩二', '愛', '悠真', '結衣', '勝', '直子', '隆', '明美', '颯太', '凛', '清', '幸子', '芽依', '航平', 'さくら', 'ひかり'],
    kanaSei: ['キムラ', 'サイトウ', 'シミズ', 'イケダ'], kanaMei: ['マコト', 'ケイコ', 'コウジ', 'アイ'],
    town: ['星見台', '若草町東', '朝日野', '藤ノ森北', '白樺ヶ丘'],
    city: [['北海道', '札幌市中央区'], ['宮城県', '仙台市青葉区'], ['埼玉県', 'さいたま市大宮区'], ['京都府', '京都市左京区'], ['兵庫県', '神戸市灘区'], ['広島県', '広島市南区'], ['沖縄県', '那覇市']],
    bld: ['ハイム', 'メゾン', 'ロイヤル', 'ヴィラ'],
    corp: ['星見台建設', '若草電機', '朝日野食品'], bank: ['ひまわり第一銀行', '若葉信用組合南'], school: ['星見台小学校', '朝日野高等学校'],
  },
  held2: {
    sei: ['坂本', '岡田', '長尾', '小川', '藤井', '村上', '太田', '福田', '三浦', '宮崎', '久保田', '大久保', '辻', '林', '神谷', '南雲', '柏木', '宇佐美'],
    mei: ['裕子', '剛', '真由美', '聡', '菜々子', '大和', '茜', '亮', '和也', '久美子', 'みどり', 'あかり', '修', '陸', '智恵', '光太郎', '眞一', '遥'],
    kanaSei: ['オカダ', 'オガワ', 'フジイ', 'ムラカミ'], kanaMei: ['ユウコ', 'ツヨシ', 'サトシ', 'カズヤ'],
    town: ['雲雀丘', '浜風町', '楓が丘西', '小鳥谷', '鈴蘭台中'],
    city: [['千葉県', '千葉市美浜区'], ['静岡県', '浜松市中央区'], ['岡山県', '倉敷市'], ['熊本県', '熊本市東区'], ['長野県', '松本市'], ['東京都', '八王子市'], ['青森県', '八戸市']],
    bld: ['レジデンス', 'アーバン', 'カーサ', '第二'],
    corp: ['雲雀丘運輸', '楓電設', '浜風フーズ'], bank: ['さくら共立銀行', '鈴蘭信用金庫'], school: ['雲雀丘小学校', '楓が丘高等学校'],
  },
  held3: {
    sei: ['松田', '原田', '中島', '今井', '横山', '矢野', '野口', '菅原', '千葉', '大塚', '杉山', '白石', '浅野', '堀', '関', '目黒', '二階堂', '瀬戸内'],
    mei: ['雅子', '実', '香織', '徹', '純一', '桃子', '翼', '由紀', '弘', '沙織', 'まどか', 'ゆかり', '豊', '晃', '千尋', '慎太郎', '麗子', '楓'],
    kanaSei: ['マツダ', 'ハラダ', 'ナカジマ', 'ヤノ'], kanaMei: ['マサコ', 'ジュンイチ', 'カオリ', 'トオル'],
    town: ['杜の里', '潮見ヶ丘', '菜の花台', '岩清水', '蛍川東'],
    city: [['茨城県', 'つくば市'], ['石川県', '金沢市'], ['愛媛県', '松山市'], ['鹿児島県', '鹿児島市'], ['新潟県', '新潟市中央区'], ['東京都', '町田市'], ['奈良県', '生駒郡斑鳩町']],
    bld: ['シャトー', 'ドミール', 'エスポワール', 'プラザ'],
    corp: ['杜の里製作所', '潮見海運', '菜の花保険サービス'], bank: ['つばめ商業銀行', '岩清水信用金庫'], school: ['杜の里幼稚園', '潮見ヶ丘中学校'],
  },
};
const KAN = '〇一二三四五六七八九';
export const toKan = (s) => String(s).replace(/\d/g, (d) => KAN[+d]);
export const toZen = (s) => String(s).replace(/[0-9A-Za-z-]/g, (c) => (c === '-' ? '－' : String.fromCharCode(c.charCodeAt(0) + 0xfee0)));
export function kanNum(n) { // 123 → 百二十三（2桁まで）
  if (n < 10) return KAN[n];
  const t = Math.floor(n / 10), o = n % 10;
  return (t > 1 ? KAN[t] : '') + '十' + (o ? KAN[o] : '');
}
export function makeWorld(seed, pool) {
  const r = rng(seed); const P = POOLS[pool];
  const w = { r, P };
  w.person = () => { const sei = r.pick(P.sei), mei = r.pick(P.mei); return { sei, mei, full: sei + mei, sp: sei + ' ' + mei, zsp: sei + '　' + mei, kana: r.pick(P.kanaSei) + ' ' + r.pick(P.kanaMei) }; };
  w.addr = () => {
    const [pref, city] = r.pick(P.city); const town = r.pick(P.town); const a = r.int(1, 9), b = r.int(1, 40), c = r.int(1, 30);
    const room = r() < 0.5 ? null : r.pick(P.bld) + town + r.int(101, 905) + '号室';
    return { pref, city, town, a, b, c, room,
      hyph: pref + city + town + a + '-' + b + '-' + c + (room ? ' ' + room : ''),
      full: pref + city + town + a + '丁目' + b + '番' + c + '号' + (room ? ' ' + room : ''),
      noPref: city + town + a + '丁目' + b + '番' + c + '号',
      kan: pref + city + town + KAN[a] + '丁目' + kanNum(b) + '番' + kanNum(c) + '号',
      zen: pref + city + town + toZen(a) + '丁目' + toZen(b) + '番' + toZen(c) + '号',
      banchi: pref + city + town + kanNum(b) + '番地' + (c % 5 + 1), postal: `${r.int(100, 999)}-${r.digits(4)}` };
  };
  w.tel = () => '090-0' + r.digits(3) + '-' + r.digits(4);
  w.fix = () => r.pick(['03', '06', '045', '052', '092']) + '-0' + r.digits(3) + '-' + r.digits(4);
  w.mail = () => r.pick(['taro', 'hana', 'k.sato', 'yume', 'contact.me']) + r.int(10, 99) + '@' + r.pick(['example.com', 'example.jp', 'mail.example.org']);
  w.birth = () => { const y = r.int(25, 63), m = r.int(1, 12), d = r.int(1, 28); return { sho: `昭和${y}年${m}月${d}日`, zen: `昭和${toZen(y)}年${toZen(m)}月${toZen(d)}日`, kan: `昭和${kanNum(y)}年${kanNum(m)}月${kanNum(d)}日`, sei: `${1925 + y}年${m}月${d}日`, slash: `${1925 + y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}` }; };
  w.mynumber = () => {
    const base = r.digits(11); let sum = 0;
    for (let n = 1; n <= 11; n++) { const p = +base[11 - n]; const q = n <= 6 ? n + 1 : n - 5; sum += p * q; }
    const rem = sum % 11; const cd = rem <= 1 ? 0 : 11 - rem; return base + cd;
  };
  w.acct = () => r.digits(7);
  w.license = () => r.digits(12);
  w.passport = () => r.pick(['TK', 'MZ', 'TR']) + r.digits(7);
  w.pension = () => r.digits(4) + '-' + r.digits(6);
  w.car = () => r.pick(['品川', '横浜', 'なにわ', '名古屋']) + ' ' + r.int(300, 599) + ' ' + r.pick(['あ', 'さ', 'ま', 'ら']) + ' ' + r.int(10, 99) + '-' + r.int(10, 99);
  w.corp = () => r.pick(P.corp); w.bank = () => r.pick(P.bank); w.school = () => r.pick(P.school);
  w.lineId = () => 'yume_' + r.digits(4);
  return w;
}
