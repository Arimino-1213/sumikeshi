// PP-OCRv5 mobile（文字の検出＋読み取り）を onnxruntime-web で動かす本体。
// ワーカーの中で動かす。結果は「行」と「1文字ごとの位置」を返す。
import * as ort from '../vendor/ort/ort.wasm.min.mjs';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class OcrEngine {
  constructor({ base = '../', threads = 4, detLimit = 1600 } = {}) {
    this.base = new URL(base, import.meta.url).href;
    this.threads = threads;
    this.detLimit = detLimit;
  }

  async init() {
    ort.env.wasm.wasmPaths = this.base + 'vendor/ort/';
    ort.env.wasm.numThreads = self.crossOriginIsolated ? this.threads : 1;
    ort.env.logLevel = 'error';
    const opt = { executionProviders: ['wasm'], graphOptimizationLevel: 'all', logSeverityLevel: 3 };
    const load = async (name) => {
      const r = await fetch(this.base + 'models/' + name);
      if (!r.ok) throw new Error('モデルを読み込めません: ' + name);
      return new Uint8Array(await r.arrayBuffer());
    };
    this.det = await ort.InferenceSession.create(await load('ppocrv5_det.onnx'), opt);
    this.rec = await ort.InferenceSession.create(await load('ppocrv5_rec.onnx'), opt);
    const dict = await (await fetch(this.base + 'models/ppocrv5_rec.dict.json')).json();
    this.chars = ['', ...dict, ' '];
    this.allowed = japaneseClasses(this.chars);
    return { threads: ort.env.wasm.numThreads };
  }

  // 画像（ImageData 相当）から行のリストを返す
  async recognize(img) {
    const t0 = performance.now();
    const canvas = new OffscreenCanvas(img.width, img.height);
    canvas.getContext('2d').putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
    const boxes = await this.detect(canvas);
    const t1 = performance.now();
    const lines = [];
    for (const b of boxes) {
      const line = await this.readBox(canvas, b);
      if (line && line.text.trim()) lines.push(line);
    }
    return { lines, detMs: t1 - t0, recMs: performance.now() - t1, width: img.width, height: img.height };
  }

  // 上下逆さまの判定：長い行をそのままと180度回した状態で読み比べる
  async flipScore(img, boxes) {
    const canvas = new OffscreenCanvas(img.width, img.height);
    canvas.getContext('2d').putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
    const flip = new OffscreenCanvas(img.width, img.height); const g = flip.getContext('2d');
    g.translate(img.width, img.height); g.rotate(Math.PI); g.drawImage(canvas, 0, 0);
    let a = 0, b = 0, n = 0;
    for (const q of boxes) {
      const box = { x0: q[0], y0: q[1], x1: q[2], y1: q[3] };
      const r1 = await this.readBox(canvas, box, true);
      const r2 = await this.readBox(flip, { x0: img.width - q[2], y0: img.height - q[3], x1: img.width - q[0], y1: img.height - q[1] }, true);
      if (r1) { a += r1.conf; } if (r2) { b += r2.conf; } n++;
    }
    return { normal: n ? a / n : 0, flipped: n ? b / n : 0 };
  }

  async detect(canvas) {
    const W = canvas.width, H = canvas.height;
    const s = Math.min(1, this.detLimit / Math.max(W, H));
    const w = Math.max(32, Math.round((W * s) / 32) * 32), h = Math.max(32, Math.round((H * s) / 32) * 32);
    const c = new OffscreenCanvas(w, h); const g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingQuality = 'high'; g.drawImage(canvas, 0, 0, w, h);
    const px = g.getImageData(0, 0, w, h).data;
    const inp = new Float32Array(3 * w * h);
    const mean = [0.485, 0.456, 0.406], std = [0.229, 0.224, 0.225];
    for (let i = 0, n = w * h; i < n; i++) { // BGR の順
      inp[i] = (px[i * 4 + 2] / 255 - mean[0]) / std[0];
      inp[i + n] = (px[i * 4 + 1] / 255 - mean[1]) / std[1];
      inp[i + 2 * n] = (px[i * 4] / 255 - mean[2]) / std[2];
    }
    const out = await this.det.run({ [this.det.inputNames[0]]: new ort.Tensor('float32', inp, [1, 3, h, w]) });
    const prob = out[this.det.outputNames[0]].data;
    const comps = components(prob, w, h, 0.3);
    const boxes = [];
    const sx = W / w, sy = H / h;
    for (const q of comps) {
      if (q.area < 12) continue;
      if (q.sum / q.area < 0.55) continue;
      const bw = q.x1 - q.x0 + 1, bh = q.y1 - q.y0 + 1;
      const d = (q.area * 1.5) / (2 * (bw + bh)); // DB の広げ幅（unclip 比 1.5）
      boxes.push({
        x0: clamp((q.x0 - d) * sx, 0, W), y0: clamp((q.y0 - d) * sy, 0, H),
        x1: clamp((q.x1 + 1 + d) * sx, 0, W), y1: clamp((q.y1 + 1 + d) * sy, 0, H),
      });
    }
    return boxes;
  }

  async readBox(canvas, b, quick = false) {
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    if (bw < 3 || bh < 3) return null;
    if (bh / bw >= 1.4) return this.readVertical(canvas, b, quick);
    const r = await this.readHorizontalCrop(canvas, b.x0, b.y0, bw, bh);
    return {
      box: [b.x0, b.y0, b.x1, b.y1], vertical: false, text: r.text, conf: r.conf,
      chars: r.chars.map((ch) => ({ c: ch.c, conf: ch.conf, box: [b.x0 + ch.a * bw, b.y0, b.x0 + ch.b * bw, b.y1] })),
    };
  }

  // 縦書きはまず90度回して読み、確かでないときだけ「文字を切り分けて横に並べ直す」方法でも読む
  async readVertical(canvas, b, quick = false) {
    const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
    const rot = new OffscreenCanvas(Math.ceil(bh), Math.ceil(bw));
    const rg = rot.getContext('2d');
    rg.translate(0, rot.height); rg.rotate(-Math.PI / 2);
    rg.drawImage(canvas, b.x0, b.y0, bw, bh, 0, 0, rot.height, rot.width);
    const r90 = await this.readCanvas(rot);
    const fromRot = (ch) => [b.x0, b.y0 + ch.a * bh, b.x1, b.y0 + ch.b * bh]; // 回した画像の左＝元の上
    const expected = Math.max(1, bh / (bw * 1.05));
    const score = (x) => x.conf * Math.min(1, x.chars.length / (expected * 0.75));
    let picked = r90, how = 'rot90', map = fromRot;
    if (!quick && score(r90) < 0.85) {
      const cells = splitVertical(canvas, b);
      const cellSize = Math.ceil(bw);
      const strip = new OffscreenCanvas(Math.max(1, cells.length * cellSize), cellSize);
      const g = strip.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, strip.width, strip.height);
      cells.forEach((cell, i) => {
        const ch = cell.y1 - cell.y0;
        g.drawImage(canvas, b.x0, cell.y0, bw, ch, i * cellSize, Math.max(0, (cellSize - ch) / 2), cellSize, ch);
      });
      const a = await this.readCanvas(strip);
      if (score(a) > score(r90)) {
        picked = a; how = 'cells';
        map = (ch) => {
          const i0 = clamp(Math.floor(ch.a * cells.length + 0.15), 0, cells.length - 1), i1 = clamp(Math.ceil(ch.b * cells.length - 0.15) - 1, i0, cells.length - 1);
          return [b.x0, cells[i0].y0, b.x1, cells[i1].y1];
        };
      }
    }
    return {
      box: [b.x0, b.y0, b.x1, b.y1], vertical: true, text: picked.text, conf: picked.conf, how,
      chars: picked.chars.map((ch) => ({ c: ch.c, conf: ch.conf, box: map(ch) })),
    };
  }

  async readHorizontalCrop(canvas, x, y, w, h) {
    const c = new OffscreenCanvas(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h)));
    c.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, c.width, c.height);
    return this.readCanvas(c);
  }

  // 1行分の画像を読む。a,b は「行の幅に対する文字の左端・右端」（0〜1）
  async readCanvas(src0) {
    const H = 48;
    const src = trimRows(src0);
    const W = clamp(Math.round((src.width / src.height) * H), 24, 3200);
    const c = new OffscreenCanvas(W, H); const g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, W, H);
    const px = g.getImageData(0, 0, W, H).data;
    // 暗い写真やかすれに備えて、行ごとに濃淡を広げる（濃い方の1%と薄い方の1%を基準に）
    const hist = new Int32Array(256);
    for (let i = 0; i < px.length; i += 4) hist[(px[i] * 77 + px[i + 1] * 150 + px[i + 2] * 29) >> 8]++;
    const total = W * H; let lo = 0, hi = 255, acc = 0;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * 0.01) { lo = v; break; } }
    acc = 0;
    for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= total * 0.01) { hi = v; break; } }
    const range = hi - lo;
    const adj = range >= 30 && range < 225 ? (v) => clamp(((v - lo) * 255) / range, 0, 255) : (v) => v;
    const inp = new Float32Array(3 * W * H);
    for (let i = 0, n = W * H; i < n; i++) {
      inp[i] = (adj(px[i * 4 + 2]) / 255 - 0.5) / 0.5;
      inp[i + n] = (adj(px[i * 4 + 1]) / 255 - 0.5) / 0.5;
      inp[i + 2 * n] = (adj(px[i * 4]) / 255 - 0.5) / 0.5;
    }
    const out = await this.rec.run({ [this.rec.inputNames[0]]: new ort.Tensor('float32', inp, [1, 3, H, W]) });
    const t = out[this.rec.outputNames[0]];
    const T = t.dims[1], C = t.dims[2], d = t.data;
    const raw = [];
    let prev = 0, cur = null;
    for (let i = 0; i < T; i++) {
      let best = 0, bv = -Infinity;
      const al = this.allowed;
      // 線の少ない字（大・田・目・一）が「空白」に負けて消えるので、空白の判定を少し厳しくする
      for (let j = 0; j < al.length; j++) { const k = al[j]; const v = k === 0 ? d[i * C] * 0.6 : d[i * C + k]; if (v > bv) { bv = v; best = k; } }
      if (best !== 0 && best === prev && cur) { cur.t1 = i; cur.conf = Math.max(cur.conf, bv); } else if (best !== 0) {
        cur = { k: best, t0: i, t1: i, conf: bv }; raw.push(cur);
      }
      prev = best;
    }
    const chars = raw.map((q, i) => {
      const left = i === 0 ? Math.max(0, q.t0 - 1) : (raw[i - 1].t1 + 1 + q.t0) / 2;
      const right = i === raw.length - 1 ? Math.min(T, q.t1 + 2) : (q.t1 + 1 + raw[i + 1].t0) / 2;
      return { c: this.chars[q.k] ?? '', conf: q.conf, a: left / T, b: right / T };
    });
    snapToInk(chars, px, W, H);
    return { text: chars.map((c) => c.c).join(''), conf: chars.length ? chars.reduce((s, c) => s + c.conf, 0) / chars.length : 0, chars };
  }
}

// 行の上下の余白を詰める。文字が小さいと線の少ない字（月・日・人・一）を読み落とすため
function trimRows(src) {
  const w = src.width, h = src.height; if (h < 12 || w < 12) return src;
  const g = src.getContext('2d', { willReadFrequently: true }); const d = g.getImageData(0, 0, w, h).data;
  let hi = 0, lo = 255;
  for (let i = 0; i < d.length; i += 4 * 3) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; if (v > hi) hi = v; if (v < lo) lo = v; }
  if (hi - lo < 50) return src;
  const th = hi - (hi - lo) * 0.4; const ink = new Int32Array(h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 4; if ((d[o] + d[o + 1] + d[o + 2]) / 3 < th) ink[y]++; }
  // 表の罫線のように端から端まである行は文字として数えない
  let top = 0, bot = h - 1; const line = w * 0.85;
  while (top < h && (ink[top] === 0 || ink[top] > line)) top++;
  while (bot > top && (ink[bot] === 0 || ink[bot] > line)) bot--;
  const inner = bot - top + 1; if (inner < 6 || inner > h * 0.92) return src;
  const m = Math.max(1, Math.round(inner * 0.1)); const y0 = Math.max(0, top - m), y1 = Math.min(h, bot + 1 + m);
  const c = new OffscreenCanvas(w, y1 - y0); c.getContext('2d').drawImage(src, 0, y0, w, y1 - y0, 0, 0, w, y1 - y0);
  return c;
}

// モデルは中国語の字も読む（愛→爱、債→债）。日本語で使う字（JIS 第1〜2水準ほか）だけを候補にする
function japaneseClasses(chars) {
  const ok = new Set();
  const dec = new TextDecoder('euc-jp');
  for (let a = 0xa1; a <= 0xfe; a++) for (let b = 0xa1; b <= 0xfe; b++) {
    const c = dec.decode(new Uint8Array([a, b]));
    if (c && c !== '\uFFFD') ok.add(c);
  }
  for (let i = 0x20; i < 0x7f; i++) ok.add(String.fromCharCode(i));
  for (let i = 0xff61; i <= 0xff9f; i++) ok.add(String.fromCharCode(i));
  for (const c of '髙﨑德濵栁彅塚邉邊齋齊櫻藏圓眞廣嶋﨑琢隆晴羽々〆ヶヵ㎡℃№㈱㈲①②③④⑤⑥⑦⑧⑨⑩') ok.add(c);
  const out = [0];
  chars.forEach((c, k) => { if (k && (ok.has(c) || ok.has(c.normalize('NFKC')))) out.push(k); });
  return out;
}

// 読み取りモデルの文字位置はおおよそなので、実際の画像の「文字の切れ目」に合わせ直す
function snapToInk(chars, px, W, H) {
  if (!chars.length) return;
  const ink = new Float32Array(W);
  let bg = 0; for (let i = 0; i < px.length; i += 4) { const v = (px[i] + px[i + 1] + px[i + 2]) / 3; if (v > bg) bg = v; }
  // 上下の端は枠線や隣の行が入りやすいので、中央の8割だけ見る
  for (let y = Math.floor(H * 0.1); y < H * 0.9; y++) for (let x = 0; x < W; x++) {
    const o = (y * W + x) * 4; const d = bg - (px[o] + px[o + 1] + px[o + 2]) / 3; if (d > 50) ink[x] += d;
  }
  const avg = chars.reduce((s, c) => s + (c.b - c.a), 0) / chars.length * W;
  for (let i = 0; i + 1 < chars.length; i++) {
    const est = chars[i].b * W, r = Math.max(2, avg * 0.3);
    let best = est, bv = Infinity;
    for (let x = Math.max(1, Math.floor(est - r)); x <= Math.min(W - 2, Math.ceil(est + r)); x++) {
      const v = ink[x] + Math.abs(x - est) * 0.5; // 同じくらい薄いなら近い方
      if (v < bv) { bv = v; best = x; }
    }
    chars[i].b = chars[i + 1].a = (best + 0.5) / W;
  }
  // 先頭と末尾は、インクのある所まで寄せる（ただし削りすぎない）
  let f = 0; while (f < W && ink[f] === 0) f++;
  let l = W - 1; while (l > 0 && ink[l] === 0) l--;
  if (f < chars[0].b * W) chars[0].a = Math.max(0, f - 1) / W;
  if (l > chars[chars.length - 1].a * W) chars[chars.length - 1].b = Math.min(W, l + 2) / W;
}

// 確率マップ→つながった領域（4近傍）
function components(prob, w, h, th) {
  const label = new Int32Array(w * h); const comps = []; const stack = [];
  for (let s = 0; s < w * h; s++) {
    if (prob[s] < th || label[s]) continue;
    const q = { x0: w, y0: h, x1: 0, y1: 0, area: 0, sum: 0 }; const id = comps.length + 1;
    label[s] = id; stack.push(s);
    while (stack.length) {
      const p = stack.pop(); const x = p % w, y = (p - x) / w;
      q.area++; q.sum += prob[p];
      if (x < q.x0) q.x0 = x; if (x > q.x1) q.x1 = x; if (y < q.y0) q.y0 = y; if (y > q.y1) q.y1 = y;
      if (x > 0 && !label[p - 1] && prob[p - 1] >= th) { label[p - 1] = id; stack.push(p - 1); }
      if (x < w - 1 && !label[p + 1] && prob[p + 1] >= th) { label[p + 1] = id; stack.push(p + 1); }
      if (y > 0 && !label[p - w] && prob[p - w] >= th) { label[p - w] = id; stack.push(p - w); }
      if (y < h - 1 && !label[p + w] && prob[p + w] >= th) { label[p + w] = id; stack.push(p + w); }
    }
    comps.push(q);
  }
  return comps;
}

// 縦の1行を文字ごとに切る：横方向の濃さの投影で隙間を探し、幅に近い高さへまとめる
function splitVertical(canvas, b) {
  const x = Math.floor(b.x0), y = Math.floor(b.y0), w = Math.max(1, Math.ceil(b.x1 - b.x0)), h = Math.max(1, Math.ceil(b.y1 - b.y0));
  const px = canvas.getContext('2d').getImageData(x, y, w, h).data;
  let bg = 0; for (let i = 0; i < px.length; i += 4) bg = Math.max(bg, (px[i] + px[i + 1] + px[i + 2]) / 3);
  const ink = new Float32Array(h);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const v = (px[(r * w + c) * 4] + px[(r * w + c) * 4 + 1] + px[(r * w + c) * 4 + 2]) / 3;
    if (bg - v > 60) ink[r]++;
  }
  const segs = []; let st = -1;
  for (let r = 0; r < h; r++) {
    const on = ink[r] > 0;
    if (on && st < 0) st = r;
    if (!on && st >= 0) { segs.push([st, r]); st = -1; }
  }
  if (st >= 0) segs.push([st, h]);
  if (!segs.length) return [{ y0: b.y0, y1: b.y1 }];
  const cell = w * 0.92; // 文字はほぼ正方形
  const merged = [];
  for (const s of segs) {
    const last = merged[merged.length - 1];
    if (last && s[1] - last[0] <= cell * 1.08) last[1] = s[1]; else merged.push([...s]);
  }
  // つながって長くなった塊は等分
  const cells = [];
  for (const m of merged) {
    const n = Math.max(1, Math.round((m[1] - m[0]) / cell));
    for (let i = 0; i < n; i++) cells.push({ y0: y + m[0] + ((m[1] - m[0]) * i) / n, y1: y + m[0] + ((m[1] - m[0]) * (i + 1)) / n });
  }
  // 上下に少し余白をつけて、切り口で文字が欠けないようにする
  return cells.map((q) => ({ y0: Math.max(0, q.y0 - 1), y1: Math.min(canvas.height, q.y1 + 1) }));
}
