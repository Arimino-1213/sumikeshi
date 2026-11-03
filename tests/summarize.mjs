// 測定結果をまとめる
import fs from 'node:fs';
const load = (n) => JSON.parse(fs.readFileSync(`tests/out/${n}.json`, 'utf8'));
const GROUP = { mynumber: '番号', jukicode: '番号', license: '番号', passport: '番号', pension: '番号', insurance: '番号', account: '番号', card: '番号', employee: '番号', mrn: '番号', car: '番号', bank: '番号', address: '居場所', corpaddr: '居場所', postal: '居場所', honseki: '居場所', workplace: '居場所', school: '居場所', corp: 'その他', phone: '連絡先', email: '連絡先', snsid: '連絡先', name: '氏名', kana: '氏名', proname: '氏名', birth: '生年月日・年齢', age: '生年月日・年齢', seal: '印影' };
function report(title, names) {
  const t = { n: 0, ok: 0, k: 0, kh: 0, m: 0, e: 0 }; const types = {}, groups = {}, vs = {}, kinds = {};
  for (const nm of names) {
    const j = load(nm);
    for (const r of j.res) {
      t.n += r.n; t.ok += r.ok; t.k += r.keeps; t.kh += r.keepHit; t.m += r.masks; t.e += r.extra;
      const a = (vs[r.v] ||= [0, 0, 0, 0]); a[0] += r.ok; a[1] += r.n; a[2] += r.ms; a[3]++;
      const b = (kinds[r.kind] ||= [0, 0]); b[0] += r.ok; b[1] += r.n;
    }
    for (const [k, [o, n]] of Object.entries(j.types)) { const x = (types[k] ||= [0, 0]); x[0] += o; x[1] += n; const g = (groups[GROUP[k] || k] ||= [0, 0]); g[0] += o; g[1] += n; }
  }
  const pc = (o, n) => `${o}/${n}（${(o / n * 100).toFixed(1)}%）`;
  console.log(`\n## ${title}`);
  console.log(`隠せた ${pc(t.ok, t.n)}／隠してはいけない語を隠した ${pc(t.kh, t.k)}／余分な黒塗り ${pc(t.e, t.m)}`);
  console.log('版：' + Object.entries(vs).map(([k, a]) => `${k} ${pc(a[0], a[1])} 1枚${(a[2] / a[3] / 1000).toFixed(1)}秒`).join('／'));
  console.log('形：' + Object.entries(kinds).map(([k, a]) => `${k} ${pc(a[0], a[1])}`).join('／'));
  console.log('種類：' + Object.entries(groups).map(([k, a]) => `${k} ${pc(a[0], a[1])}`).join('／'));
  console.log('細目：' + Object.entries(types).map(([k, a]) => `${k} ${a[0]}/${a[1]}`).join(' '));
}
report('実力（未知の書類・初回のみ）1回目', ['held_all']);
report('実力（未知の書類・初回のみ）2回目', ['held2_all']);
report('実力（未知の書類・初回のみ）3回目', ['held3_all']);
report('実力 3回の合計', ['held_all', 'held2_all', 'held3_all']);
report('完成版：調整用の書類', ['final_dev']);
report('完成版：3種の確認書類（見たあとに直したので参考値）', ['final_held', 'final_held2', 'final_held3']);
