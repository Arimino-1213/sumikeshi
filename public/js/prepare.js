// 1ページ分の仕上げ（紙の補正・傾き・向き・OCR・印影・画像の圧縮）。画面が固まらないようワーカーの中で動かす。
import { straightenPaper, deskew, findSeals, mul3, denoiseForOcr } from './rectify.js';

const IDENT = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const toCanvas = (img) => {
  const c = new OffscreenCanvas(img.width, img.height);
  c.getContext('2d').putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
  return c;
};
const fromCanvas = (c) => { const d = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height); return { data: d.data, width: d.width, height: d.height }; };
function rotateImage(img, quarter) {
  const sw = quarter % 2 ? img.height : img.width, sh = quarter % 2 ? img.width : img.height;
  const c = new OffscreenCanvas(sw, sh); const g = c.getContext('2d');
  g.translate(sw / 2, sh / 2); g.rotate((quarter * Math.PI) / 2); g.drawImage(toCanvas(img), -img.width / 2, -img.height / 2);
  return fromCanvas(c);
}
const scoreOf = (r) => r.lines.reduce((s, l) => s + l.text.length * Math.max(0, l.conf), 0);
const confOf = (r) => { const n = r.lines.reduce((s, l) => s + l.text.length, 0); return n ? scoreOf(r) / n : 0; };
const overlap = (a, b) => { const w = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), h = Math.min(a[3], b[3]) - Math.max(a[1], b[1]); if (w <= 0 || h <= 0) return 0; return (w * h) / Math.min((a[2] - a[0]) * (a[3] - a[1]), (b[2] - b[0]) * (b[3] - b[1])); };

async function photo(image, ocrEngine, allowStraighten, T) {
  let img = image, transform = IDENT; const notes = [];
  let t = performance.now();
  if (allowStraighten) {
    const p = straightenPaper(img);
    if (p) { img = p.image; transform = p.transform; notes.push('写真の紙をまっすぐに補正'); }
  }
  const s = deskew(img);
  if (s) { img = s.image; transform = mul3(s.transform, transform); notes.push(`傾きを補正（${s.degrees.toFixed(1)}度）`); }
  // ざらつきの多いスキャンは、読み取り用の画像だけノイズを取る（見た目と保存する画像は変えない）
  const forOcr = denoiseForOcr(img);
  T.fix = performance.now() - t; t = performance.now();
  let ocr = await ocrEngine.recognize(forOcr);
  T.det = ocr.detMs; T.rec = ocr.recMs; t = performance.now();
  // 向きがおかしい（読めない）ときだけ、回して読み直す
  if (confOf(ocr) < 0.8 || ocr.lines.length < 2) {
    let best = { q: 0, r: ocr, score: scoreOf(ocr) };
    for (const q of [1, 2, 3]) {
      const rot = rotateImage(img, q); const r = await ocrEngine.recognize(rot); const sc = scoreOf(r);
      if (sc > best.score * 1.3) best = { q, r, score: sc, img: rot };
    }
    if (best.q) {
      const w = img.width, h = img.height;
      const R = best.q === 1 ? [0, -1, h, 1, 0, 0, 0, 0, 1] : best.q === 2 ? [-1, 0, w, 0, -1, h, 0, 0, 1] : [0, 1, 0, -1, 0, w, 0, 0, 1];
      transform = mul3(R, transform); img = best.img; ocr = best.r; notes.push(`向きを${best.q * 90}度回して読みました`);
    }
  }
  // 逆さまでもモデルは自信ありげに読むことがある。長い行を読み比べて確かめる
  // 長い行を丸ごと読むと重いので、行の先頭の一部（文字8個分くらい）だけで比べる
  const longest = [...ocr.lines].sort((a, b) => b.text.length - a.text.length).slice(0, 3).map((l) => {
    const [x0, y0, x1, y1] = l.box; const v = l.vertical; const t = v ? x1 - x0 : y1 - y0;
    return v ? [x0, y0, x1, Math.min(y1, y0 + t * 8)] : [x0, y0, Math.min(x1, x0 + t * 8), y1];
  });
  if (longest.length) {
    const f = await ocrEngine.flipScore(img, longest);
    if (f.flipped > f.normal + 0.015) {
      const rot = rotateImage(img, 2);
      transform = mul3([-1, 0, img.width, 0, -1, img.height, 0, 0, 1], transform);
      img = rot; ocr = await ocrEngine.recognize(denoiseForOcr(rot)); notes.push('上下逆さまだったので回して読みました');
    }
  }
  T.flip = performance.now() - t;
  return { image: img, transform, lines: ocr.lines, notes, source: 'ocr' };
}

export async function preparePage(ocrEngine, payload) {
  const image = { data: payload.data, width: payload.width, height: payload.height };
  const T = {}; let r;
  if (payload.mode === 'text') r = { image, transform: IDENT, lines: payload.lines, notes: ['PDFの文字データを使用'], source: 'text' };
  else if (payload.mode === 'mix') {
    // 文字データ＋画像：画像の中も読む。重なる部分は文字データを優先
    const o = await ocrEngine.recognize(image); T.det = o.detMs; T.rec = o.recMs;
    const extra = o.lines.filter((l) => !payload.lines.some((q) => overlap(q.box, l.box) > 0.5));
    r = { image, transform: IDENT, lines: [...payload.lines, ...extra], notes: ['PDFの文字データと画像内のOCRを併用'], source: 'mix' };
  } else {
    r = await photo(image, ocrEngine, payload.allowStraighten !== false, T);
    if (payload.note) r.notes.push(payload.note);
    if (payload.pre) r.transform = mul3(r.transform, payload.pre);
  }
  let t = performance.now();
  const seals = findSeals(r.image);
  const lowConf = r.lines.filter((l) => l.conf < 0.7 && l.text.trim().length >= 2).map((l) => l.box);
  const blob = await toCanvas(r.image).convertToBlob({ type: 'image/png' });
  T.png = performance.now() - t;
  return { width: r.image.width, height: r.image.height, blob, lines: r.lines, seals, lowConf, transform: r.transform, notes: r.notes, source: r.source, timing: T };
}
